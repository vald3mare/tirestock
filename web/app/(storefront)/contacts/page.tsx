import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/blocks/Breadcrumbs";
import { SHOP } from "@/lib/shop";
import { yandexEmbedUrl } from "@/lib/pickup-points";

// «Контакты» (Figma → «Инфо — Контакты», 117:608). URL /contacts/ — 1:1 со
// старым сайтом (SEO). Закрывает требование «контактная информация: телефон,
// адрес, реквизиты Организации». Реквизиты — со старого tirestock.ru/contacts/
// (ООО «ВИТАСФЕРА»). TODO: на /about/ старого сайта другие реквизиты (ИП Бунин) —
// уточнить у Виталия, какие актуальны.

export const metadata: Metadata = {
  title: "Контакты интернет-магазина шин TireStock",
  description:
    "Телефон +7 (812) 614-64-42, info@tirestock.ru. Санкт-Петербург, Петровская коса и 33 пункта выдачи по городу. Реквизиты организации.",
};

const requisites = [
  "ИНН 7811745818 · КПП 781101001 · ОГРН 1207800036718",
  "Юридический адрес: 192029, Санкт-Петербург, ул. Новосёлов, д. 49, литера Е, помещ. 1Н",
  "Р/с 40702810110000828233 · АО «ТИНЬКОФФ БАНК»",
  "БИК 044525974 · К/с 30101810145250000974",
];

export default function ContactsPage() {

  return (
    <main id="main" className="mx-auto max-w-content px-4 pb-20">
      <Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: "Контакты" }]} />

      <h1 className="mt-6 text-h2 text-black lg:text-h1">Контакты</h1>
      <p className="mt-6 max-w-182 text-body text-dark">
        Есть вопросы по подбору, заказу или доставке? Позвоните или напишите нам — поможем.
      </p>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
        <div className="flex flex-col gap-1.5 rounded-card-lg border border-line bg-white p-6">
          <p className="text-caption-lg text-grey">Телефон</p>
          <a href={SHOP.phoneHref} className="tnum text-subtitle font-extrabold text-blue hover:underline">
            {SHOP.phone}
          </a>
          <p className="text-caption-lg text-dark">Пн–Пт 9:00–21:00 · Сб–Вс 9:00–20:00</p>
        </div>
        <div className="flex flex-col gap-1.5 rounded-card-lg border border-line bg-white p-6">
          <p className="text-caption-lg text-grey">Электронная почта</p>
          <a href="mailto:info@tirestock.ru" className="text-subtitle font-extrabold text-blue hover:underline">
            info@tirestock.ru
          </a>
          <p className="text-caption-lg text-dark">Ответим в течение рабочего дня</p>
        </div>
        <div className="flex flex-col gap-1.5 rounded-card-lg border border-line bg-white p-6">
          <p className="text-caption-lg text-grey">Адрес</p>
          <p className="text-subtitle font-extrabold text-black">{SHOP.address}</p>
          <p className="text-caption-lg text-dark">{SHOP.city}</p>
          <Link href="/points/" className="text-caption-lg font-semibold text-blue hover:underline">
            Пункты выдачи по городу →
          </Link>
        </div>
      </div>

      <section aria-labelledby="req-h" className="mt-14">
        <h2 id="req-h" className="text-service-lg font-extrabold text-black">
          Реквизиты
        </h2>
        <div className="mt-5 flex flex-col gap-1.5 rounded-container bg-light p-6">
          <p className="text-body font-semibold text-dark">ООО «ВИТАСФЕРА»</p>
          {requisites.map((r) => (
            <p key={r} className="tnum text-caption-lg text-dark">
              {r}
            </p>
          ))}
        </div>
      </section>

      {/* Живая карта Яндекс.Карт (виджет без API-ключа) с точкой на главном адресе. */}
      <div className="mt-12 overflow-hidden rounded-container border border-line">
        <iframe
          title={`TireStock на карте — ${SHOP.address}`}
          src={yandexEmbedUrl(SHOP.address)}
          loading="lazy"
          className="block h-[360px] w-full border-0"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    </main>
  );
}
