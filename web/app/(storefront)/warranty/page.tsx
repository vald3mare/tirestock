import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/blocks/Breadcrumbs";

// «Гарантия и возврат» (Figma → «Инфо — Гарантия и возврат», 117:607). URL
// /warranty/ — 1:1 со старым сайтом (SEO). Закрывает требование «процедуры
// возврата денежных средств, обмена товаров при отказе». Контент — со старого
// tirestock.ru/warranty/.

export const metadata: Metadata = {
  title: "Гарантия и возврат шин | TireStock",
  description:
    "Гарантия производителя 12 месяцев, срок гарантийного хранения шин 5 лет. Возврат в течение 7 дней с момента получения, возврат денег — в течение 10 дней.",
};

const facts = [
  {
    label: "Гарантийный срок",
    value: "12 месяцев",
    note: "со дня продажи — гарантия завода-изготовителя",
  },
  {
    label: "Срок гарантийного хранения",
    value: "5 лет",
    note: "с даты изготовления (указана на боковине шины)",
  },
  {
    label: "Сертификация",
    value: "ГОСТ",
    note: "Р41.30-99 (Правила №30 ЕЭК ООН) — все шины сертифицированы",
  },
];

const voidCases = [
  "серийный номер шины умышленно стёрт;",
  "шина подвергалась ремонту, шлифовке, восстановлению или переделке рисунка протектора;",
  "нарушены условия эксплуатации — несоответствие давления, перегрузки и т. п.;",
  "автомобиль имеет механические повреждения либо диски несоответствующего или нестандартного размера;",
  "остаточная глубина рисунка протектора — 2,5 мм и менее.",
];

const returnSteps = [
  "До получения заказа отказаться от него можно в любой момент.",
  "После получения на возврат есть 7 календарных дней — при сохранении товарного вида, потребительских свойств и документа о покупке.",
  "Товар возвращается в пункт выдачи; при возврате составляется заявление и акт возврата.",
  "Деньги вернём в течение 10 дней с даты требования, за вычетом стоимости доставки.",
];

export default function WarrantyPage() {
  return (
    <main id="main" className="mx-auto max-w-content px-4 pb-20">
      <Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: "Гарантия и возврат" }]} />

      <h1 className="mt-6 text-h2 text-black lg:text-h1">Гарантия и возврат</h1>
      <p className="mt-6 max-w-182 text-body text-dark">
        На все шины действует гарантия производителя. Если товар не подошёл — вернём деньги или
        обменяем в течение 7 дней с момента получения.
      </p>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3 lg:gap-6">
        {facts.map((f) => (
          <div key={f.label} className="flex flex-col gap-1.5 rounded-card-lg border border-line bg-white p-6">
            <p className="text-caption-lg text-grey">{f.label}</p>
            <p className="tnum text-price text-black">{f.value}</p>
            <p className="text-caption-lg text-dark">{f.note}</p>
          </div>
        ))}
      </div>

      <section aria-labelledby="void-h" className="mt-14">
        <h2 id="void-h" className="text-service-lg font-extrabold text-black">
          Гарантия не действует, если
        </h2>
        <ul className="mt-5 flex max-w-182 flex-col gap-3">
          {voidCases.map((c) => (
            <li key={c} className="flex items-start gap-3 text-body text-dark">
              <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-grey" aria-hidden="true" />
              {c}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="return-h" className="mt-14">
        <h2 id="return-h" className="text-service-lg font-extrabold text-black">
          Возврат и обмен
        </h2>
        <ol className="mt-5 flex max-w-182 flex-col gap-3">
          {returnSteps.map((s, i) => (
            <li key={s} className="flex items-start gap-3 text-body text-dark">
              <span className="font-extrabold text-blue" aria-hidden="true">
                {i + 1}
              </span>
              {s}
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="law-h" className="mt-12 rounded-container bg-light p-6">
        <h2 id="law-h" className="text-body font-semibold text-dark">
          Важно
        </h2>
        <p className="mt-2 text-caption-lg text-grey">
          Возврат товара, бывшего в употреблении, невозможен (п. 1 ст. 25 Закона «О защите прав
          потребителей»). Товары из Перечня, утверждённого Постановлением Правительства РФ
          от 19.01.1998 № 55, возврату и обмену не подлежат.
        </p>
      </section>
    </main>
  );
}
