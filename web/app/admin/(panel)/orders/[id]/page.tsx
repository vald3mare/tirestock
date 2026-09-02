import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/admin-session";
import { adminOrder, type AdminOrderDetail, type DeliveryStatus } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { formatPrice } from "@/lib/format";
import { retryOrderAction } from "@/app/admin/actions";

// Детальная карточка заказа (админка). Наши данные (из БД) + ЖИВОЙ статус из
// tradesk по номеру (обратная интеграция /data/status). Статус доставки В tradesk
// (наш outbox) отделён от статуса заказа В tradesk (движение по складу/выдаче).

const dt = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

// Статус доставки заказа В tradesk (наш outbox).
const deliveryMeta: Record<DeliveryStatus, { label: string; cls: string }> = {
  pending: { label: "В очереди на отправку", cls: "bg-light text-grey" },
  delivered: { label: "Отправлен в tradesk", cls: "bg-green-soft text-green" },
  failed: { label: "Ошибка отправки", cls: "bg-red-soft text-red" },
};

// Полоса прогресса статуса заказа В tradesk (step 1..4 из обратной интеграции).
function ProgressBar({ step }: { step: number }) {
  const steps = ["В работе", "Сборка / погрузка", "Водитель в пути", "Готов / выдан"];
  return (
    <ol className="mt-3 flex gap-2" aria-label="Этапы заказа в tradesk">
      {steps.map((label, i) => (
        <li key={label} className="flex flex-1 flex-col gap-1.5">
          <span className={"h-1.5 rounded-full " + (i < step ? "bg-blue" : "bg-line")} aria-hidden="true" />
          <span className={"text-legal " + (i < step ? "text-dark" : "text-grey")}>{label}</span>
        </li>
      ))}
    </ol>
  );
}

function TradeskStatusCard({ order }: { order: AdminOrderDetail }) {
  const st = order.status;
  // Номера ещё нет — заказ не доставлен в tradesk.
  if (!order.tradesk_number) {
    return (
      <div className="rounded-card-lg border border-line bg-light p-5">
        <p className="text-caption-lg text-grey">
          Заказ ещё не отправлен в tradesk — статус появится после доставки.
        </p>
      </div>
    );
  }
  // Номер есть, но tradesk не ответил (недоступен / заказ не найден в учётке).
  if (!st || !st.found) {
    return (
      <div className="rounded-card-lg border border-line bg-light p-5">
        <p className="text-caption-lg text-dark">
          Номер в tradesk: <span className="tnum font-semibold">{order.tradesk_number}</span>
        </p>
        <p className="mt-1 text-caption text-grey">
          Живой статус временно недоступен (tradesk не ответил). Обновите страницу позже.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-card-lg border border-line bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-body text-dark">
          Статус в tradesk: <span className="font-semibold text-blue">{st.status_text}</span>
        </p>
        <p className="tnum text-caption text-grey">№ {order.tradesk_number}</p>
      </div>
      {st.point && <p className="mt-1 text-caption-lg text-grey">Пункт: {st.point}</p>}
      {st.date && <p className="text-caption-lg text-grey">Дата: <span className="tnum">{st.date}</span></p>}
      {st.step > 0 && <ProgressBar step={st.step} />}
    </div>
  );
}

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { token } = await requireUser();
  const { id } = await params;

  const order = await adminOrder(token, Number(id)).catch((err) => {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  });

  const dm = deliveryMeta[order.delivery_status];

  return (
    <main id="main" className="mx-auto max-w-content">
      <nav className="text-caption text-grey" aria-label="Хлебные крошки">
        <Link href="/admin/orders" className="hover:text-dark">
          Заказы
        </Link>{" "}
        / Заказ №{order.id}
      </nav>

      <header className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="text-h2 text-black">Заказ №{order.id}</h1>
        <span className={"inline-flex rounded-badge px-2.5 py-1 text-caption font-semibold " + dm.cls}>
          {dm.label}
        </span>
        {order.delivery_status === "failed" && (
          <form action={retryOrderAction}>
            <input type="hidden" name="id" value={order.id} />
            <button type="submit" className="cursor-pointer text-caption-lg font-semibold text-blue hover:underline">
              Повторить отправку
            </button>
          </form>
        )}
      </header>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Клиент и оформление */}
        <section className="flex flex-col gap-3 rounded-card-lg border border-line bg-white p-6">
          <h2 className="text-service text-dark">Покупатель</h2>
          <dl className="flex flex-col gap-2 text-caption-lg">
            <Row label="Имя" value={order.customer_name} />
            <Row label="Телефон" value={<a href={`tel:${order.phone}`} className="text-blue hover:underline">{order.phone}</a>} />
            <Row label="Оформлен" value={dt.format(new Date(order.created_at))} />
            <Row label="Сумма" value={<span className="tnum font-semibold">{formatPrice(order.total)}</span>} />
          </dl>
          {order.comment && (
            <div className="mt-1 rounded-card bg-light p-3">
              <p className="text-caption text-grey">Комментарий (способ получения, адрес):</p>
              <p className="mt-1 text-caption-lg text-dark">{order.comment}</p>
            </div>
          )}
        </section>

        {/* Живой статус в tradesk */}
        <section className="flex flex-col gap-3">
          <h2 className="text-service text-dark">Статус в учётной системе</h2>
          <TradeskStatusCard order={order} />
          {order.delivery_status === "failed" && order.last_error && (
            <p className="text-caption text-red">Ошибка доставки: {order.last_error}</p>
          )}
        </section>
      </div>

      {/* Состав заказа (снимок на момент оформления) */}
      <section className="mt-6">
        <h2 className="text-service text-dark">Состав заказа</h2>
        <div className="mt-3 overflow-x-auto rounded-card-lg border border-line bg-white">
          <table className="w-full min-w-[560px] text-left">
            <thead>
              <tr className="border-b border-line text-caption text-grey">
                <th className="px-4 py-3 font-medium">Наименование</th>
                <th className="px-4 py-3 font-medium">Артикул</th>
                <th className="tnum px-4 py-3 font-medium">Кол-во</th>
                <th className="tnum px-4 py-3 font-medium">Цена</th>
                <th className="tnum px-4 py-3 font-medium">Сумма</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((it, i) => (
                <tr key={i} className="border-b border-line last:border-0 text-caption-lg text-dark">
                  <td className="px-4 py-3">{it.name}</td>
                  <td className="tnum px-4 py-3 text-grey">{it.code || "—"}</td>
                  <td className="tnum px-4 py-3">{it.qty} шт.</td>
                  <td className="tnum px-4 py-3">{formatPrice(it.price)}</td>
                  <td className="tnum px-4 py-3">{formatPrice(it.price * it.qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-grey">{label}</dt>
      <dd className="text-right text-dark">{value}</dd>
    </div>
  );
}
