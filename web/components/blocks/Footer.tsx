// Footer: 4 колонки 264 (бренд / контакты / часы двух отделов / ссылки)
// + нижняя строка: дисклеймер-оферта 12px + копирайт. tel:/mailto: обязательны.

import Link from "next/link";
import { CallbackModal } from "@/components/blocks/CallbackModal";
import { SHOP } from "@/lib/shop";

// Оплата/Доставка/Гарантия/Контакты — статические роуты по URL старого сайта
// (SEO 1:1); О магазине/Отзывы/Пункты выдачи — контентные страницы (catch-all).
const links: { label: string; href: string }[] = [
  { label: "О магазине", href: "/about/" },
  { label: "Отзывы", href: "/reviews/" },
  { label: "Оплата", href: "/payment/" },
  { label: "Доставка", href: "/delivery/" },
  { label: "Гарантия", href: "/warranty/" },
  { label: "Пункты выдачи", href: "/points/" },
  { label: "Диски", href: "/wheels/" },
  { label: "Контакты", href: "/contacts/" },
  { label: "Новости", href: "/news/" },
  { label: "Партнёрам", href: "/partnership/" },
];

// SEO-посадочные каталога: сезон, ходовые радиусы, топ-бренды. Ведут на
// фильтрованный каталог с уникальными мета (см. lib/catalog-seo.ts).
const seoLinks: { label: string; href: string }[] = [
  { label: "Летние шины", href: "/catalog/?season=summer" },
  { label: "Зимние шины", href: "/catalog/?season=winter" },
  { label: "Всесезонные шины", href: "/catalog/?season=allseason" },
  { label: "Шины R15", href: "/catalog/?diameter=15" },
  { label: "Шины R16", href: "/catalog/?diameter=16" },
  { label: "Шины R17", href: "/catalog/?diameter=17" },
  { label: "Шины R18", href: "/catalog/?diameter=18" },
  { label: "Летние шины R17", href: "/catalog/?season=summer&diameter=17" },
  { label: "Зимние шины R16", href: "/catalog/?season=winter&diameter=16" },
  { label: "Шины Michelin", href: "/catalog/?brand=Michelin" },
  { label: "Шины Nokian Tyres", href: "/catalog/?brand=Nokian+Tyres" },
  { label: "Шины Cordiant", href: "/catalog/?brand=Cordiant" },
];

export function Footer() {
  return (
    <footer className="border-t border-line bg-white">
      <div className="mx-auto grid max-w-content grid-cols-1 gap-8 px-4 pb-10 pt-12 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
        <div className="flex flex-col gap-2.5">
          <p className="text-subtitle font-extrabold text-dark">TIRESTOCK</p>
          <p className="max-w-55 text-caption text-grey">
            Шины и диски по низким ценам в Санкт-Петербурге
          </p>
        </div>
        <div className="flex flex-col gap-2.5">
          <p className="text-body font-semibold text-dark">Контакты</p>
          <p className="text-caption-lg text-grey">Спб, {SHOP.address}</p>
          <a href="tel:+78126146442" className="text-body font-semibold text-dark hover:text-blue">
            +7 (812) 614-64-42
          </a>
          <a href="mailto:info@tirestock.ru" className="text-caption-lg text-grey hover:text-blue">
            info@tirestock.ru
          </a>
          {/* Заявка уходит в tradesk (раздел «Обратный звонок») через outbox. */}
          <CallbackModal className="text-left" />
          <Link href="/status/" className="text-caption-lg font-semibold text-blue hover:underline">
            Что с моим заказом?
          </Link>
        </div>
        <div className="flex flex-col gap-2.5">
          <p className="text-body font-semibold text-dark">Часы работы</p>
          <p className="text-caption text-grey">Отдел продаж</p>
          <p className="text-caption-lg text-dark">Пн–Пт 9:00–21:00 · Сб–Вс 9:00–20:00</p>
          <p className="text-caption text-grey">Отдел доставки</p>
          <p className="text-caption-lg text-dark">Пн–Вс 9:00–21:00</p>
        </div>
        <div className="flex flex-col gap-2.5">
          <p className="text-body font-semibold text-dark">Покупателям</p>
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-caption-lg text-grey hover:text-blue">
              {l.label}
            </Link>
          ))}
        </div>
      </div>

      {/* SEO-перелинковка (рекомендация сеошника #4): ссылки на посадочные каталога
          по сезону/размеру/бренду — с уникальными мета. */}
      <div className="border-t border-line">
        <nav aria-label="Популярные запросы" className="mx-auto max-w-content px-4 py-6">
          <p className="text-caption font-semibold text-dark">Популярные запросы</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
            {seoLinks.map((l) => (
              <Link key={l.href} href={l.href} className="text-caption text-grey hover:text-blue">
                {l.label}
              </Link>
            ))}
          </div>
        </nav>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-content flex-col justify-between gap-2 px-4 pb-6 pt-5 text-legal text-grey sm:flex-row sm:items-center sm:gap-4">
          <p className="max-w-175">
            Сайт носит информационный характер и ни при каких условиях не является публичной
            офертой, определяемой положениями ст. 437 (2) ГК РФ.
          </p>
          <p className="whitespace-nowrap">TireStock.ru © 2026</p>
        </div>
      </div>
    </footer>
  );
}
