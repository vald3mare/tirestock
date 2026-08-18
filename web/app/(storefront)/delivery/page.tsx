import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/blocks/Breadcrumbs";

// «Доставка» (Figma → «Инфо — Доставка», 117:605). URL /delivery/ — 1:1 со старым
// сайтом (SEO). Контент перенесён со старого tirestock.ru/delivery/ + блок
// «Экспортные ограничения» (требование: инфо о доставке и экспортных ограничениях).

export const metadata: Metadata = {
  title: "Доставка шин по СПб, Ленобласти и регионам России | TireStock",
  description:
    "Доставка шин по Санкт-Петербургу — 500 ₽, бесплатно от 30 000 ₽. По Ленобласти — 30 ₽/км. В регионы России — транспортными компаниями, до ТК «ПЭК» бесплатно.",
};

const zones = [
  {
    title: "По Санкт-Петербургу",
    price: "500 ₽",
    bullets: [
      "Бесплатно при заказе от 30 000 ₽",
      "Доставка до дома (не до квартиры)",
      "В сезон сроки согласует менеджер",
    ],
  },
  {
    title: "По Ленинградской области",
    price: "30 ₽/км",
    bullets: ["Расстояние считается от КАД/ЗСД", "Точную стоимость назовёт менеджер"],
  },
  {
    title: "В регионы России",
    price: "от 0 ₽",
    bullets: [
      "До терминала ТК «ПЭК» — бесплатно",
      "До любой другой ТК — 400 ₽",
      "Бесплатно при заказе от 30 000 ₽",
    ],
  },
];

const regionSteps = [
  "Отправляем товар в транспортную компанию после полной оплаты заказа.",
  "Квитанцию об отправке пришлём на электронную почту.",
  "Услуги транспортной компании оплачиваются при получении по её тарифам.",
  "Транспортная компания на выбор: ПЭК, Деловые Линии, Байкал-Сервис, ЖелДорЭкспедиция, СДЭК — или любая другая.",
];

export default function DeliveryPage() {
  return (
    <main id="main" className="mx-auto max-w-content px-4 pb-20">
      <Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: "Доставка" }]} />

      <h1 className="mt-6 text-h2 text-black lg:text-h1">Доставка</h1>
      <p className="mt-6 max-w-182 text-body text-dark">
        Доставим шины к вашему дому, в пункт выдачи или до терминала транспортной компании.
        Стоимость и сроки зависят от города и суммы заказа.
      </p>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
        {zones.map((z) => (
          <div key={z.title} className="flex flex-col gap-2 rounded-card-lg border border-line bg-white p-6">
            <h2 className="text-body font-semibold text-dark">{z.title}</h2>
            <p className="tnum text-price text-black">{z.price}</p>
            <ul className="mt-1 flex flex-col gap-1.5">
              {z.bullets.map((b) => (
                <li key={b} className="flex items-start gap-2 text-caption-lg text-grey">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-grey" aria-hidden="true" />
                  {b}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <section aria-labelledby="regions-h" className="mt-14">
        <h2 id="regions-h" className="text-service-lg font-extrabold text-black">
          Как проходит доставка в регионы
        </h2>
        <ol className="mt-5 flex max-w-182 flex-col gap-3">
          {regionSteps.map((s, i) => (
            <li key={s} className="flex items-start gap-3 text-body text-dark">
              <span className="font-extrabold text-blue" aria-hidden="true">
                {i + 1}
              </span>
              {s}
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="export-h" className="mt-12 rounded-container bg-light p-6">
        <h2 id="export-h" className="text-body font-semibold text-dark">
          Экспортные ограничения
        </h2>
        <p className="mt-2 text-caption-lg text-grey">
          Доставка товаров осуществляется только по территории Российской Федерации.
          Международная доставка и экспорт не осуществляются.
        </p>
      </section>
    </main>
  );
}
