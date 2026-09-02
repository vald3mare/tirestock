package orderstatus

import (
	"context"
	"testing"
)

// stubSource — источник с заранее заданным ответом.
type stubSource struct {
	raw *Raw
	err error
}

func (s stubSource) FetchStatus(context.Context, string) (*Raw, error) { return s.raw, s.err }

func TestLookupMapsStatuses(t *testing.T) {
	cases := []struct {
		name     string
		status   string
		wantText string
		wantStep int
	}{
		{"new", "new", "Новый", 0},
		{"process", "process", "В работе", 1},
		{"payed", "payed", "В работе", 1},
		{"transit", "transit", "Сборка на складе / Погрузка", 2},
		{"ready", "ready", "Готов к выдаче", 4},
		{"complete", "complete", "Выполнен", 4},
		{"cancel", "cancel", "Отменён", 0},
		{"unknown", "wtf", "В обработке", 0},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			svc := NewService(stubSource{raw: &Raw{Status: c.status}})
			st, err := svc.Lookup(context.Background(), "C1")
			if err != nil {
				t.Fatalf("Lookup: %v", err)
			}
			if !st.Found {
				t.Fatalf("ожидался found=true")
			}
			if st.StatusText != c.wantText {
				t.Errorf("текст: got %q, want %q", st.StatusText, c.wantText)
			}
			if st.Step != c.wantStep {
				t.Errorf("step: got %d, want %d", st.Step, c.wantStep)
			}
		})
	}
}

func TestLookupStockPoint26IsDriverEnRoute(t *testing.T) {
	svc := NewService(stubSource{raw: &Raw{Status: "stock", PointID: 26}})
	st, _ := svc.Lookup(context.Background(), "C1")
	if st.StatusText != "Водитель в пути" || st.Step != 3 {
		t.Errorf("stock/point26: got %q step=%d, want «Водитель в пути» step=3", st.StatusText, st.Step)
	}
}

func TestLookupEmptyCodeAndNotFound(t *testing.T) {
	svc := NewService(stubSource{raw: nil})
	if st, _ := svc.Lookup(context.Background(), "  "); st.Found {
		t.Error("пустой код: ожидался found=false")
	}
	if st, _ := svc.Lookup(context.Background(), "C404"); st.Found {
		t.Error("nil raw: ожидался found=false")
	}
}

func TestLookupFiltersZeroPricedProductsAndFormatsDate(t *testing.T) {
	svc := NewService(stubSource{raw: &Raw{
		Status: "ready",
		Date:   "2026-08-25",
		Products: []RawProduct{
			{ProductName: "Шина A", ProductQty: 4, ProductRetailPrice: 5000},
			{ProductName: "Скрытая", ProductQty: 1, ProductRetailPrice: 0}, // отфильтровать
		},
	}})
	st, _ := svc.Lookup(context.Background(), "C1")
	if len(st.Products) != 1 {
		t.Fatalf("позиций: got %d, want 1 (нулевая цена отфильтрована)", len(st.Products))
	}
	if st.Products[0].Sum != 20000 {
		t.Errorf("сумма: got %d, want 20000", st.Products[0].Sum)
	}
	if st.Date != "25-08-2026" {
		t.Errorf("дата: got %q, want 25-08-2026", st.Date)
	}
}
