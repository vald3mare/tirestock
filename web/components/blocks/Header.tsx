import Link from "next/link";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { NavDropdown, type NavItem } from "@/components/blocks/NavDropdown";
import { MobileMenu } from "@/components/blocks/MobileMenu";
import { CitySwitcher } from "@/components/blocks/CitySwitcher";
import { CITIES } from "@/lib/city";
import { getCity } from "@/lib/get-city";

// Header = topbar (light: адрес слева; часы, телефон справа) + основная строка
// (лого, нав с дропдаунами у Шины/Диски/Сервис, корзина). Основная строка sticky
// (запрос сеошника): topbar схлопывается при скролле, строка остаётся.

const nav: { label: string; href: string; items?: NavItem[] }[] = [
  { label: "Главная", href: "/" },
  {
    label: "Шины",
    href: "/catalog",
    items: [
      { label: "Легковые шины", href: "/catalog" },
      { label: "Мотошины", href: "/catalog?category=moto" },
      { label: "Подбор по авто", href: "/catalog" },
      { label: "Шинный калькулятор", href: "#" },
    ],
  },
  {
    label: "Диски",
    href: "#",
    items: [
      { label: "Литые диски", href: "#" },
      { label: "Штампованные диски", href: "#" },
      { label: "Подбор по авто", href: "#" },
    ],
  },
  {
    label: "Сервис",
    href: "#",
    items: [
      { label: "Хранение шин и колёс", href: "/services/storage" },
      { label: "Шиномонтаж", href: "#" },
    ],
  },
  { label: "Пункты выдачи", href: "/points/" },
];

export async function Header() {
  const city = await getCity();
  return (
    <header className="border-b border-line bg-white">
      <div className="bg-light">
        <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2">
          <CitySwitcher city={city} />
          <div className="flex items-center gap-8">
            <p className="hidden items-center gap-2 text-caption-lg text-grey md:flex">
              <img src="/icons/clock.svg" alt="" width={16} height={16} className="size-4" />
              Пн–Пт 9:00–21:00 · Сб–Вс 9:00–20:00
            </p>
            <a
              href={CITIES[city].phoneHref}
              className="flex items-center gap-2 text-caption-lg font-semibold text-dark"
            >
              <img src="/icons/phone.svg" alt="" width={16} height={16} className="size-4" />
              {CITIES[city].phone}
            </a>
          </div>
        </div>
      </div>

      <div className="sticky top-0 z-40 border-b border-line bg-white">
        <div className="mx-auto flex max-w-content items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-2">
            <MobileMenu
              nav={nav}
              phone={CITIES[city].phone}
              phoneHref={CITIES[city].phoneHref}
              cityLabel={CITIES[city].label}
              address={CITIES[city].address}
              hours="Пн–Пт 9:00–21:00 · Сб–Вс 9:00–20:00"
            />
            <Link href="/" className="flex min-h-touch items-center" aria-label="TireStock — на главную">
              <img src="/images/logo.png" alt="TireStock" width={94} height={56} className="h-14 w-auto" />
            </Link>
          </div>
          <nav className="hidden items-center gap-8 lg:flex" aria-label="Основная навигация">
            {nav.map((item) => (
              <NavDropdown key={item.label} label={item.label} href={item.href} items={item.items} />
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
