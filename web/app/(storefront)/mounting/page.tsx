import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/blocks/Breadcrumbs";
import { PriceTable } from "@/components/blocks/PriceTable";
import { ServiceSignup } from "@/components/blocks/ServiceSignup";
import { buttonClasses } from "@/components/ui/buttonStyles";

// «Шиномонтаж» (Figma → «Инфо — Шиномонтаж», 125:876). URL /mounting/ — 1:1 со
// старым сайтом (SEO). Цены перенесены с tirestock.ru/mounting/ дословно.

export const metadata: Metadata = {
  // Сохранён ключ «сезонная замена шин» из мета старого сайта (правка сеошника #2).
  title: "Шиномонтаж в СПб — цены, сезонная замена шин | TireStock",
  description:
    "Профессиональный шиномонтаж легковых автомобилей и кроссоверов на оборудовании Hofmann. Петровская коса. Выгодные цены, скидка 15% при покупке шин в нашем магазине.",
};

const R = ["R13–R14", "R15", "R16", "R17", "R18", "R19", "R20", "R21", "R22", "R23"];

const cars: string[][] = [
  ["Комплекс, 4 колеса", "3 200", "3 200", "3 600", "4 000", "4 400", "4 800", "5 200", "5 800", "6 400", "6 800"],
  ["Комплекс, 1 колесо", "800", "800", "900", "950", "1 000", "1 100", "1 200", "1 300", "1 400", "1 600"],
  ["Снятие / установка, 1 колесо", "300", "300", "350", "350", "400", "400", "450", "500", "500", "550"],
  ["Монтаж / демонтаж, 1 шина", "200", "200", "200", "250", "250", "300", "300", "350", "350", "400"],
  ["Балансировка, 1 колесо", "300", "300", "350", "350", "400", "400", "450", "500", "500", "550"],
];

const suvs: string[][] = [
  ["Комплекс, 4 колеса", "3 400", "3 400", "3 800", "4 200", "4 600", "5 000", "5 600", "6 000", "6 600", "7 000"],
  ["Комплекс, 1 колесо", "850", "850", "950", "1 050", "1 150", "1 250", "1 400", "1 500", "1 650", "1 750"],
  ["Снятие / установка, 1 колесо", "300", "300", "350", "350", "400", "450", "500", "500", "550", "600"],
  ["Монтаж / демонтаж, 1 шина", "250", "250", "250", "300", "350", "350", "400", "450", "500", "500"],
  ["Балансировка, 1 колесо", "300", "300", "350", "400", "400", "450", "500", "550", "600", "650"],
];

const extra: string[][] = [
  ["Оптимизация 1 колеса", "200 ₽"],
  ["Зачистка посадочного места диска, 2 борта", "100 ₽"],
  ["Промазка герметиком, 2 борта", "100 ₽"],
  ["Техническая чистка колеса", "150 ₽"],
  ["Подкачка", "200 ₽"],
  ["Установка вентиля", "150 ₽"],
  ["Пакет", "50 ₽"],
  ["Хранение 4 колёс (6 мес.)", "от 3 800 ₽"],
];

const tyreRepair: string[][] = [
  ["Ремонт шины жгутом", "от 500 ₽"],
  ["Холодная вулканизация с пластырем", "от 650 ₽"],
  ["Ремонт шины грибком", "от 750 ₽"],
  ["Горячая вулканизация (грыжи, боковые порезы)", "от 1 500 ₽"],
];

export default async function MountingPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const { sent, error } = await searchParams;

  return (
    <main id="main" className="mx-auto max-w-content px-4 pb-20">
      <Breadcrumbs
        items={[{ label: "Главная", href: "/" }, { label: "Сервис" }, { label: "Шиномонтаж" }]}
      />

      <h1 className="mt-6 text-h2 text-black lg:text-h1">Шиномонтаж</h1>
      <p className="mt-6 max-w-182 text-body text-dark">
        Комплексный шиномонтаж на оборудовании Hofmann по адресу Петровская коса.
        Купите шины у нас — получите скидку 15% на шиномонтаж.
      </p>

      <div className="mt-8 flex flex-col gap-4 sm:flex-row">
        <a href="#signup" className={buttonClasses("primary")}>
          Записаться
        </a>
        <a href="tel:+78126146442" className={buttonClasses("secondary", "md", "tnum")}>
          +7 (812) 614-64-42
        </a>
      </div>

      <section aria-labelledby="cars-h" className="mt-14">
        <h2 id="cars-h" className="text-service-lg font-extrabold text-black">
          Легковые автомобили
        </h2>
        <PriceTable
          head={["Услуга, ₽", ...R]}
          rows={cars}
          note="RunFlat и низкий профиль (40 и ниже) — наценка 30%."
        />
      </section>

      <section aria-labelledby="suv-h" className="mt-14">
        <h2 id="suv-h" className="text-service-lg font-extrabold text-black">
          Внедорожники, кроссоверы, минивэны
        </h2>
        <PriceTable
          head={["Услуга, ₽", ...R]}
          rows={suvs}
          note="RunFlat, Off-Road и низкий профиль (40 и ниже) — наценка 30%."
        />
      </section>

      <section aria-labelledby="extra-h" className="mt-14">
        <h2 id="extra-h" className="text-service-lg font-extrabold text-black">
          Дополнительные услуги
        </h2>
        <PriceTable head={["Услуга", "Цена"]} rows={extra} />
      </section>

      <section aria-labelledby="repair-h" className="mt-14">
        <h2 id="repair-h" className="text-service-lg font-extrabold text-black">
          Ремонт шин
        </h2>
        <PriceTable head={["Услуга", "Цена"]} rows={tyreRepair} />
      </section>

      <p className="mt-8 inline-block rounded-card bg-light px-4 py-3 text-body font-semibold text-dark">
        Скидка 15% на шиномонтаж при покупке шин в нашем магазине
      </p>

      <ServiceSignup service="Шиномонтаж" back="/mounting" sent={sent} error={error} />
    </main>
  );
}
