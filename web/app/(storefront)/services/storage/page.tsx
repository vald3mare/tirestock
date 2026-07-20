import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/blocks/Breadcrumbs";
import { Button } from "@/components/ui/Button";
import { buttonClasses } from "@/components/ui/buttonStyles";
import { Field } from "@/components/ui/Field";
import { submitStorageRequest } from "./actions";

// Услуга «Хранение шин и колёс» (Figma → «Услуга — Хранение колёс», 37:388).
// Хранение — приоритетный сервис бизнеса. Кнопка «Записаться» ведёт к форме,
// форма шлёт заявку в tradesk через outbox (server action, без клиентского JS).
// TODO: цены за сезон — в макете плейсхолдеры, уточнить у Виталия;
//       фото склада (реальное!) — ждём от клиента; сверить URL со старым сайтом.

export const metadata: Metadata = {
  title: "Хранение шин и колёс в СПб | TireStock",
  description:
    "Сезонное хранение шин и колёс на собственном тёплом складе в Санкт-Петербурге. Приём в день обращения, −30% при покупке от 4 шин.",
};

const prices = [
  { label: "R13–R15", price: "2 500 ₽" },
  { label: "R16–R18", price: "3 000 ₽" },
  { label: "R19 и больше", price: "3 500 ₽" },
  { label: "Колёса в сборе", price: "+500 ₽" },
];

const bullets = [
  "Тёплое помещение — резина не стареет от перепадов",
  "Приём и выдача в день обращения",
  "Маркировка и учёт каждого комплекта",
];

export default async function StoragePage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const { sent, error } = await searchParams;

  return (
    <main id="main" className="mx-auto max-w-content px-4 pb-20">
      <Breadcrumbs
        items={[
          { label: "Главная", href: "/" },
          { label: "Сервис" },
          { label: "Хранение колёс" },
        ]}
      />

      <div className="mt-6 flex flex-col items-stretch gap-8 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-132 pt-4">
          <h1 className="text-h2 text-black lg:text-h1">Хранение шин и колёс</h1>
          <p className="mt-6 text-body text-dark">
            Собственный тёплый склад в Санкт-Петербурге. Примем колёса в день обращения,
            промаркируем и вернём к сезону — привезёте машину, уедете уже переобутыми.
          </p>
          <ul className="mt-6 flex flex-col gap-3">
            {bullets.map((b) => (
              <li key={b} className="flex items-center gap-3 text-body text-dark">
                <span className="size-2 shrink-0 rounded-full bg-blue" aria-hidden="true" />
                {b}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <a href="#signup" className={buttonClasses("primary")}>
              Записаться
            </a>
            <a href="tel:+78126146442" className={buttonClasses("secondary", "md", "tnum")}>
              +7 (812) 614-64-42
            </a>
          </div>
        </div>
        {/* TODO: реальное фото склада от клиента */}
        <div className="flex aspect-[136/85] w-full shrink-0 items-center justify-center rounded-card-lg bg-light lg:h-85 lg:w-136">
          <p className="text-caption text-grey">фото склада (реальное!)</p>
        </div>
      </div>

      <section aria-labelledby="prices-h" className="mt-16">
        <h2 id="prices-h" className="text-service-lg font-extrabold text-black">
          Стоимость за сезон
        </h2>
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          {prices.map((p) => (
            <div key={p.label} className="flex flex-col gap-1.5 rounded-card-lg border border-line bg-white p-5">
              <p className="text-caption-lg text-grey">{p.label}</p>
              <p className="tnum text-price text-black">{p.price}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 inline-block rounded-card bg-light px-4 py-3 text-body font-semibold text-dark">
          −30% на хранение при покупке от 4 шин в нашем магазине
        </p>
      </section>

      <section id="signup" aria-labelledby="signup-h" className="mt-20">
        <div className="flex flex-col gap-6 rounded-container bg-light p-5 lg:p-10">
          <div>
            <h2 id="signup-h" className="text-h2 text-black">
              Записаться на хранение
            </h2>
            <p className="mt-2 text-body text-grey">
              Оставьте телефон — перезвоним, согласуем день и примем колёса.
            </p>
          </div>
          {sent === "1" ? (
            <p className="text-subtitle font-semibold text-dark">
              Заявка отправлена — перезвоним в рабочее время.
            </p>
          ) : (
            <form action={submitStorageRequest} className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-start">
              <div className="flex-1">
                <Field name="name" autoComplete="name" placeholder="Например: Иван…" aria-label="Имя" />
              </div>
              <div className="flex-1">
                <Field
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  spellCheck={false}
                  required
                  placeholder="Например: +7 (921) 123-45-67…"
                  aria-label="Телефон"
                />
              </div>
              <Button type="submit">Записаться</Button>
            </form>
          )}
          {error && (
            <p className="text-body text-dark">
              {error === "phone"
                ? "Укажите телефон — без него не сможем перезвонить."
                : "Не получилось отправить заявку. Позвоните нам: +7 (812) 614-64-42."}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
