package orders_test

// Обязательные тесты по конвенциям: outbox-воркер (доставка, ретраи, failed,
// SKIP LOCKED без дублей). Нужен реальный Postgres: задайте TEST_DATABASE_URL
// (см. README), иначе тесты пропускаются.

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"tirestock/api/internal/db"
	"tirestock/api/internal/integrations/mock"
	"tirestock/api/internal/orders"
)

func testPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL не задан — пропуск интеграционных тестов outbox")
	}
	if err := db.Migrate(url); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	pool, err := db.NewPool(context.Background(), url)
	if err != nil {
		t.Fatalf("pool: %v", err)
	}
	t.Cleanup(pool.Close)
	if _, err := pool.Exec(context.Background(), "TRUNCATE outbox, orders RESTART IDENTITY"); err != nil {
		t.Fatalf("truncate: %v", err)
	}
	return pool
}

func testConfig() orders.WorkerConfig {
	return orders.WorkerConfig{
		Interval:    time.Second,
		BatchSize:   10,
		MaxAttempts: 3,
		BaseDelay:   time.Minute,
	}
}

func discardLog() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func createTestOrder(t *testing.T, svc *orders.Service, key string) int64 {
	t.Helper()
	id, err := svc.CreateOrder(context.Background(), orders.CreateOrderInput{
		IdempotencyKey: key,
		CustomerName:   "Тест Тестович",
		Phone:          "+7 (921) 000-00-00",
		Items: []orders.OrderItem{
			{Slug: "nokian-hakkapeliitta-10p-205-55-r16", Name: "Nokian Hakkapeliitta 10p", Price: 12490, Qty: 4},
		},
	})
	if err != nil {
		t.Fatalf("CreateOrder: %v", err)
	}
	return id
}

// Заказ пишется вместе со строкой outbox; воркер доставляет её (pending → delivered).
func TestWorkerDeliversOrder(t *testing.T) {
	pool := testPool(t)
	ctx := context.Background()
	svc := orders.NewService(pool)
	delivery := mock.NewOrderDelivery()
	w := orders.NewWorker(pool, delivery, testConfig(), discardLog())

	orderID := createTestOrder(t, svc, "key-deliver-1")

	n, err := w.ProcessOnce(ctx)
	if err != nil {
		t.Fatalf("ProcessOnce: %v", err)
	}
	if n != 1 {
		t.Fatalf("обработано %d записей, ожидалась 1", n)
	}
	got := delivery.Delivered()
	if len(got) != 1 || got[0].Kind != orders.KindOrder {
		t.Fatalf("доставлено %v, ожидалась 1 запись kind=order", got)
	}

	q := db.New(pool)
	row, err := q.GetOutbox(ctx, 1)
	if err != nil {
		t.Fatalf("GetOutbox: %v", err)
	}
	if row.Status != "delivered" {
		t.Errorf("status = %q, want delivered", row.Status)
	}
	_ = orderID
}

// Идемпотентность: повторный CreateOrder с тем же ключом не создаёт второй заказ/outbox.
func TestCreateOrderIdempotent(t *testing.T) {
	pool := testPool(t)
	svc := orders.NewService(pool)

	id1 := createTestOrder(t, svc, "key-idem-1")
	id2 := createTestOrder(t, svc, "key-idem-1")
	if id1 != id2 {
		t.Errorf("повторный заказ создал новый id: %d != %d", id1, id2)
	}

	var count int
	if err := pool.QueryRow(context.Background(), "SELECT count(*) FROM outbox").Scan(&count); err != nil {
		t.Fatalf("count outbox: %v", err)
	}
	if count != 1 {
		t.Errorf("в outbox %d записей, ожидалась 1", count)
	}
}

// Неудачная доставка: attempts растёт, next_retry_at уходит в будущее (экспонента),
// после MaxAttempts — status=failed.
func TestWorkerRetriesAndFails(t *testing.T) {
	pool := testPool(t)
	ctx := context.Background()
	svc := orders.NewService(pool)
	delivery := mock.NewOrderDelivery()
	delivery.FailWith(errors.New("tradesk недоступен"))
	cfg := testConfig() // MaxAttempts=3
	w := orders.NewWorker(pool, delivery, cfg, discardLog())

	createTestOrder(t, svc, "key-retry-1")
	q := db.New(pool)

	// Попытка 1: ретрай запланирован в будущее.
	if _, err := w.ProcessOnce(ctx); err != nil {
		t.Fatalf("ProcessOnce#1: %v", err)
	}
	row, _ := q.GetOutbox(ctx, 1)
	if row.Status != "pending" || row.Attempts != 1 {
		t.Fatalf("после 1-й неудачи: status=%q attempts=%d, want pending/1", row.Status, row.Attempts)
	}
	if !row.NextRetryAt.Time.After(time.Now()) {
		t.Errorf("next_retry_at должен быть в будущем, получено %v", row.NextRetryAt.Time)
	}
	if row.LastError == "" {
		t.Error("last_error пуст")
	}

	// Возвращаем запись «в прошлое», чтобы воркер взял её снова.
	rewind := func() {
		if _, err := pool.Exec(ctx, "UPDATE outbox SET next_retry_at = now() - interval '1 hour' WHERE id = 1"); err != nil {
			t.Fatalf("rewind: %v", err)
		}
	}

	rewind()
	if _, err := w.ProcessOnce(ctx); err != nil {
		t.Fatalf("ProcessOnce#2: %v", err)
	}
	row, _ = q.GetOutbox(ctx, 1)
	if row.Status != "pending" || row.Attempts != 2 {
		t.Fatalf("после 2-й неудачи: status=%q attempts=%d, want pending/2", row.Status, row.Attempts)
	}

	// Попытка 3 = MaxAttempts → failed.
	rewind()
	if _, err := w.ProcessOnce(ctx); err != nil {
		t.Fatalf("ProcessOnce#3: %v", err)
	}
	row, _ = q.GetOutbox(ctx, 1)
	if row.Status != "failed" || row.Attempts != 3 {
		t.Fatalf("после 3-й неудачи: status=%q attempts=%d, want failed/3", row.Status, row.Attempts)
	}

	// failed-запись воркер больше не трогает.
	rewind()
	n, err := w.ProcessOnce(ctx)
	if err != nil {
		t.Fatalf("ProcessOnce#4: %v", err)
	}
	if n != 0 {
		t.Errorf("failed-запись снова взята в работу (n=%d)", n)
	}
}

// Ретрай не берётся раньше next_retry_at.
func TestWorkerRespectsNextRetryAt(t *testing.T) {
	pool := testPool(t)
	ctx := context.Background()
	svc := orders.NewService(pool)
	delivery := mock.NewOrderDelivery()
	delivery.FailWith(errors.New("временная ошибка"))
	w := orders.NewWorker(pool, delivery, testConfig(), discardLog())

	createTestOrder(t, svc, "key-wait-1")
	if _, err := w.ProcessOnce(ctx); err != nil {
		t.Fatalf("ProcessOnce#1: %v", err)
	}

	delivery.FailWith(nil) // доставка «починилась», но время ретрая ещё не пришло
	n, err := w.ProcessOnce(ctx)
	if err != nil {
		t.Fatalf("ProcessOnce#2: %v", err)
	}
	if n != 0 {
		t.Errorf("запись взята до next_retry_at (n=%d)", n)
	}
}

// SKIP LOCKED: параллельные воркеры не доставляют одну запись дважды.
func TestWorkerConcurrentNoDuplicates(t *testing.T) {
	pool := testPool(t)
	ctx := context.Background()
	svc := orders.NewService(pool)
	delivery := mock.NewOrderDelivery()
	cfg := testConfig()
	cfg.BatchSize = 100

	const total = 20
	for i := range total {
		createTestOrder(t, svc, fmt.Sprintf("key-conc-%d", i))
	}

	var wg sync.WaitGroup
	for range 4 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			w := orders.NewWorker(pool, delivery, cfg, discardLog())
			if _, err := w.ProcessOnce(ctx); err != nil {
				t.Errorf("ProcessOnce: %v", err)
			}
		}()
	}
	wg.Wait()

	if got := len(delivery.Delivered()); got != total {
		t.Errorf("доставлено %d записей, ожидалось ровно %d (без дублей и потерь)", got, total)
	}
}
