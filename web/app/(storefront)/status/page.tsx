import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/blocks/Breadcrumbs";
import { Button } from "@/components/ui/Button";
import { getOrderStatus, type OrderStatus } from "@/lib/api/client";
import { formatPrice } from "@/lib/format";
import { metadataFor } from "@/lib/seo";

// Страница «Статус заказа» (/status/, URL 1:1 со старым сайтом — SEO). Обратная
// интеграция tradesk: по номеру заказа тянем статус из tradesk (GET /data/status).
// Server Component: форма GET ?code=, результат рендерится на сервере (как старый).

export function generateMetadata(): Promise<Metadata> {
  return metadataFor("/status", {
    title: "Проверить статус заказа — TireStock",
    description: "Узнайте текущий статус и дату исполнения вашего заказа TireStock по номеру.",
  });
}

// Полоса прогресса по этапу (step 1..4). 0 — без полосы (Новый/Отменён).
function ProgressBar({ step }: { step: number }) {
  const steps = ["В работе", "Сборка / погрузка", "Водитель в пути", "Готов к выдаче"];
  return (
    <ol className="mt-4 flex gap-2" aria-label="Этапы заказа">
      {steps.map((label, i) => {
        const done = i < step;
        return (
          <li key={label} className="flex flex-1 flex-col gap-1.5">
            <span
              className={"h-1.5 rounded-full " + (done ? "bg-blue" : "bg-line")}
              aria-hidden="true"
            />
            <span className={"text-legal " + (done ? "text-dark" : "text-grey")}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function StatusResult({ st }: { st: OrderStatus }) {
  if (!st.found) {
    return (
      <div className="mt-8 rounded-container bg-light p-6">
        <p className="text-body text-dark">
          Заказ №{st.code} не найден. Проверьте номер — он указан в СМС или назван менеджером.
        </p>
      </div>
    );
  }
  return (
    <div className="mt-8">
      <h2 className="text-h2 text-black">Заказ №{st.code}</h2>
      <div className="mt-4 flex flex-col gap-1.5 text-body text-dark">
        {st.point && (
          <p>
            Пункт выдачи: <span className="font-semibold">{st.point}</span>
          </p>
        )}
        {st.date && (
          <p>
            Дата: <span className="tnum font-semibold">{st.date}</span>
          </p>
        )}
        <p>
          Статус: <span className="font-semibold text-blue">{st.status_text}</span>
        </p>
      </div>

      {st.step > 0 && <ProgressBar step={st.step} />}

      {(st.products?.length ?? 0) > 0 && (
        <>
          <h3 className="mt-8 text-service text-dark">Состав заказа</h3>
          <div className="mt-3 overflow-x-auto rounded-card-lg border border-line">
            <table className="w-full min-w-[480px] text-left">
              <thead>
                <tr className="border-b border-line text-caption text-grey">
                  <th className="px-4 py-3 font-medium">Наименование</th>
                  <th className="tnum px-4 py-3 font-medium">Кол-во</th>
                  <th className="tnum px-4 py-3 font-medium">Цена</th>
                  <th className="tnum px-4 py-3 font-medium">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {st.products.map((p, i) => (
                  <tr key={i} className="border-b border-line last:border-0 text-caption-lg text-dark">
                    <td className="px-4 py-3">{p.name}</td>
                    <td className="tnum px-4 py-3">{p.qty} шт.</td>
                    <td className="tnum px-4 py-3">{formatPrice(p.price)}</td>
                    <td className="tnum px-4 py-3">{formatPrice(p.sum)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default async function OrderStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const code = (await searchParams).code?.trim() ?? "";
  const status = code ? await getOrderStatus(code).catch(() => null) : null;

  return (
    <main id="main" className="mx-auto max-w-content px-4 pb-20">
      <Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: "Статус заказа" }]} />

      <h1 className="mt-6 text-h2 text-black lg:text-h1">Проверить статус заказа</h1>
      <p className="mt-4 max-w-180 text-body text-dark">
        Как только заказ будет готов к выдаче, мы оповестим вас по СМС или звонком. Здесь можно
        узнать текущий статус и дату исполнения заказа по его номеру.
      </p>

      <form method="GET" className="mt-8 flex max-w-140 flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1">
          <span className="mb-1.5 block text-caption text-grey">Номер заказа</span>
          <input
            name="code"
            defaultValue={code}
            required
            placeholder="Например: C288416…"
            className="w-full rounded-field border border-line bg-white px-5 py-3.5 text-field text-dark placeholder:text-grey hover:border-grey focus-visible:border-blue"
          />
        </label>
        <Button type="submit" className="sm:w-auto">Узнать</Button>
      </form>

      {code && status && <StatusResult st={status} />}
      {code && !status && (
        <div className="mt-8 rounded-container bg-light p-6">
          <p className="text-body text-dark">
            Не удалось проверить статус. Попробуйте позже или позвоните нам.
          </p>
        </div>
      )}
    </main>
  );
}
