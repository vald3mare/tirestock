import Link from "next/link";
import { ButtonLink } from "@/components/ui/ButtonLink";

// Header = topbar (light: адрес слева; часы, телефон справа) + основная строка
// (лого, нав с шевронами у Шины/Диски/Сервис, корзина). Основная строка sticky
// (запрос сеошника): topbar схлопывается при скролле, строка остаётся.
// TODO: выпадающие панели у Шины/Диски/Сервис (демо дропдауна в Figma) — при вёрстке каталога.

const nav = [
  { label: "Главная", href: "/", chevron: false },
  { label: "Шины", href: "/catalog", chevron: true },
  { label: "Диски", href: "#", chevron: true },
  { label: "Сервис", href: "#", chevron: true },
  { label: "Пункты выдачи", href: "#", chevron: false },
];

export function Header() {
  return (
    <header className="border-b border-line bg-white">
      <div className="bg-light">
        <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2">
          <p className="flex items-center gap-2 text-caption-lg text-grey">
            <img src="/icons/pin.svg" alt="" width={16} height={16} className="size-4" />
            Санкт-Петербург, Зотовский пр. 11, стр. 1
            <img src="/icons/chevron-down-sm.svg" alt="" width={16} height={16} className="size-4" />
          </p>
          <div className="flex items-center gap-8">
            <p className="hidden items-center gap-2 text-caption-lg text-grey md:flex">
              <img src="/icons/clock.svg" alt="" width={16} height={16} className="size-4" />
              Пн–Пт 9:00–21:00 · Сб–Вс 9:00–20:00
            </p>
            <a
              href="tel:+78126146442"
              className="flex items-center gap-2 text-caption-lg font-semibold text-dark"
            >
              <img src="/icons/phone.svg" alt="" width={16} height={16} className="size-4" />
              +7 (812) 614-64-42
            </a>
          </div>
        </div>
      </div>

      <div className="sticky top-0 z-40 border-b border-line bg-white">
        <div className="mx-auto flex max-w-content items-center justify-between gap-4 px-4 py-4">
          <Link href="/" className="flex min-h-touch items-center" aria-label="TireStock — на главную">
            <img src="/images/logo.png" alt="TireStock" width={94} height={56} className="h-14 w-auto" />
          </Link>
          {/* TODO: мобильное меню-бургер — макета нет; на <lg нав скрыт */}
          <nav className="hidden items-center gap-8 lg:flex" aria-label="Основная навигация">
            {nav.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="flex min-h-touch items-center gap-1 text-nav text-black hover:text-blue"
              >
                {item.label}
                {item.chevron && <img src="/icons/chevron-down.svg" alt="" width={14} height={14} className="size-3.5" />}
              </Link>
            ))}
          </nav>
          <ButtonLink href="/cart" className="px-8 py-3">
            Корзина
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}
