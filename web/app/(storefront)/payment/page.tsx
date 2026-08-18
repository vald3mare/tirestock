import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/blocks/Breadcrumbs";

// «Оплата и заказ» (Figma → «Инфо — Оплата и заказ», 117:606). URL /payment/ —
// 1:1 со старым сайтом (SEO). Закрывает два требования: описание процедуры
// заказа и способы оплаты. Эквайринга нет (решение Виталия, 08.2026) — онлайн-
// оплату картами и электронные деньги со старой страницы убрали осознанно.

export const metadata: Metadata = {
  title: "Оплата и оформление заказа | TireStock",
  description:
    "Как заказать шины в TireStock: оформление на сайте или по телефону, подтверждение менеджером, оплата наличными при получении или по счёту.",
};

const steps = [
  {
    title: "Выберите шины",
    text: "В каталоге или через подбор по размеру. Добавьте в корзину и оформите заказ — или просто позвоните.",
  },
  {
    title: "Подтверждение",
    text: "Менеджер свяжется с вами, подтвердит наличие, цену и удобный способ получения.",
  },
  {
    title: "Оплата",
    text: "Оплатите заказ при получении наличными или заранее по счёту — как вам удобнее.",
  },
  {
    title: "Получение",
    text: "Заберите заказ в пункте выдачи или дождитесь доставки. О готовности сообщим по СМС или звонком.",
  },
];

const methods = [
  {
    title: "Наличными при получении",
    text: "В магазине, пункте выдачи или водителю нашей службы доставки.",
  },
  {
    title: "Безналичный перевод на счёт",
    text: "Для физических и юридических лиц. Счёт выставит менеджер после подтверждения заказа.",
  },
];

export default function PaymentPage() {
  return (
    <main id="main" className="mx-auto max-w-content px-4 pb-20">
      <Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: "Оплата" }]} />

      <h1 className="mt-6 text-h2 text-black lg:text-h1">Оплата и заказ</h1>
      <p className="mt-6 max-w-182 text-body text-dark">
        Заказ можно оформить на сайте или по телефону. Менеджер свяжется с вами, подтвердит
        наличие товара и удобный способ получения.
      </p>

      <section aria-labelledby="order-h" className="mt-10">
        <h2 id="order-h" className="text-service-lg font-extrabold text-black">
          Как сделать заказ
        </h2>
        <ol className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {steps.map((s, i) => (
            <li key={s.title} className="flex flex-col gap-2 rounded-card-lg border border-line bg-white p-6">
              <span className="tnum text-price text-blue" aria-hidden="true">
                {i + 1}
              </span>
              <h3 className="text-body font-semibold text-dark">{s.title}</h3>
              <p className="text-caption-lg text-grey">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="pay-h" className="mt-14">
        <h2 id="pay-h" className="text-service-lg font-extrabold text-black">
          Способы оплаты
        </h2>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-6">
          {methods.map((m) => (
            <div key={m.title} className="flex flex-col gap-2 rounded-card-lg border border-line bg-white p-6">
              <h3 className="text-body font-semibold text-dark">{m.title}</h3>
              <p className="text-caption-lg text-grey">{m.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="note-h" className="mt-12 rounded-container bg-light p-6">
        <h2 id="note-h" className="text-body font-semibold text-dark">
          Обратите внимание
        </h2>
        <p className="mt-2 text-caption-lg text-grey">
          Онлайн-оплата банковскими картами на сайте не производится — мы не запрашиваем данные
          банковских карт. Проверить статус заказа можно по телефону{" "}
          <a href="tel:+78126146442" className="tnum font-semibold text-dark hover:text-blue">
            +7 (812) 614-64-42
          </a>
          .
        </p>
      </section>
    </main>
  );
}
