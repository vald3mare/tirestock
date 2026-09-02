import Link from "next/link";
import { requireUser } from "@/lib/admin-session";
import { adminOrders, type DeliveryStatus } from "@/lib/api/admin";
import { formatPrice } from "@/lib/format";
import { retryOrderAction } from "../../actions";

// Монитор заказов: проекция outbox. Статус доставки в tradesk = статус строки outbox
// (delivered/pending/failed). «Повторить» возвращает недоставленный заказ в очередь.
// Табы фильтруют по статусу (в URL, ?status=). Счётчики — из stats.

const tabs: { key: string; label: string }[] = [
  { key: "", label: "Все" },
  { key: "failed", label: "Ошибки доставки" },
  { key: "pending", label: "В очереди" },
  { key: "delivered", label: "Доставлены" },
];

const dt = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const statusMeta: Record<DeliveryStatus, { label: string; cls: string }> = {
  delivered: { label: "Доставлен", cls: "bg-green-soft text-green" },
  pending: { label: "В очереди", cls: "bg-light text-grey" },
  failed: { label: "Ошибка", cls: "bg-red-soft text-red" },
};

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { token } = await requireUser();
  const { status = "" } = await searchParams;
  const { items, stats } = await adminOrders(token, { status });

  return (
    <main id="main" className="mx-auto max-w-content">
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="text-h2 text-black">Заказы</h1>
        <p className="tnum text-caption-lg text-grey">
          за сегодня: {stats.today} · в очереди на отправку: {stats.queued} · ошибок: {stats.failed}
        </p>
      </header>

      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Фильтр заказов">
        {tabs.map((t) => {
          const active = status === t.key;
          const href = t.key ? `/admin/orders?status=${t.key}` : "/admin/orders";
          return (
            <Link
              key={t.label}
              href={href}
              role="tab"
              aria-selected={active}
              className={
                "flex min-h-touch items-center rounded-field px-4 py-2.5 text-nav transition-colors " +
                (active ? "bg-blue text-white" : "bg-white text-dark hover:bg-line/50")
              }
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      <div className="mt-6 overflow-x-auto rounded-card-lg border border-line bg-white">
        <table className="w-full min-w-[720px] text-left">
          <thead>
            <tr className="border-b border-line text-caption text-grey">
              <th className="px-4 py-4 font-medium">№</th>
              <th className="px-4 py-4 font-medium">Дата</th>
              <th className="px-4 py-4 font-medium">Клиент</th>
              <th className="px-4 py-4 font-medium">Телефон</th>
              <th className="px-4 py-4 font-medium">Сумма</th>
              <th className="px-4 py-4 font-medium">№ в tradesk</th>
              <th className="px-4 py-4 font-medium">Доставка в tradesk</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-body text-grey">
                  Заказов нет.
                </td>
              </tr>
            ) : (
              items.map((o) => {
                const m = statusMeta[o.delivery_status];
                return (
                  <tr key={o.id} className="border-b border-line last:border-0 text-caption-lg text-dark">
                    <td className="tnum px-4 py-4 text-grey">{o.id}</td>
                    <td className="tnum px-4 py-4 text-grey">{dt.format(new Date(o.created_at))}</td>
                    <td className="px-4 py-4">{o.customer_name}</td>
                    <td className="tnum px-4 py-4">{o.phone}</td>
                    <td className="tnum px-4 py-4">{formatPrice(o.total)}</td>
                    {/* Данные заказа живут в tradesk — у себя держим только его номер,
                        чтобы менеджер знал, где смотреть, без дублирования учётки. */}
                    <td className="tnum px-4 py-4 text-grey">{o.tradesk_number || "—"}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <span className={"inline-flex rounded-badge px-2.5 py-1 text-caption font-semibold " + m.cls}>
                          {m.label}
                        </span>
                        <Link
                          href={`/admin/orders/${o.id}`}
                          className="text-caption-lg font-semibold text-blue hover:underline"
                        >
                          Подробнее
                        </Link>
                        {o.delivery_status === "failed" && (
                          <form action={retryOrderAction}>
                            <input type="hidden" name="id" value={o.id} />
                            <button
                              type="submit"
                              className="cursor-pointer text-caption-lg text-grey hover:text-blue"
                            >
                              Повторить
                            </button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-caption text-grey">
        Заказ создаётся на сайте и сохраняется у нас, затем воркер доставляет его в tradesk.
        «Ошибка» = все ретраи исчерпаны — жми «Повторить» или проверь tradesk.
      </p>
    </main>
  );
}
