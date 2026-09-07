import Link from "next/link";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { NavDropdown, type NavItem } from "@/components/blocks/NavDropdown";
import { CallbackModal } from "@/components/blocks/CallbackModal";
import { MobileMenu } from "@/components/blocks/MobileMenu";
import { CitySwitcher } from "@/components/blocks/CitySwitcher";
import { SHOP } from "@/lib/shop";
import { CITIES } from "@/lib/city";
import { getCity } from "@/lib/get-city";
import { cartCount, readCart } from "@/lib/cart";

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
      { label: "Шинный калькулятор", href: "/tyres-calc/" },
    ],
  },
  {
    label: "Диски",
    href: "/wheels/",
    items: [
      { label: "Все диски", href: "/wheels/" },
      { label: "Литые", href: "/wheels/?type=Литой" },
      { label: "Кованые", href: "/wheels/?type=Кованый" },
      { label: "Штампованные", href: "/wheels/?type=Штампованный" },
    ],
  },
  {
    label: "Сервис",
    href: "/mounting/",
    items: [
      { label: "Хранение шин и колёс", href: "/services/storage" },
      { label: "Шиномонтаж", href: "/mounting/" },
    ],
  },
  { label: "Пункты выдачи", href: "/points/" },
  { label: "Контакты", href: "/contacts/" },
];

export async function Header() {
  // Счётчик на кнопке корзины: состав лежит в куке, читаем на сервере.
  const cartQty = cartCount(await readCart());
  const city = await getCity();
  const cityMeta = CITIES[city];
  return (
    <header className="border-b border-line bg-white">
      <div className="bg-light">
        <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2">
          <div className="flex items-center gap-3">
            <CitySwitcher city={city} />
            <p className="hidden items-center gap-2 text-caption-lg text-grey sm:flex">
              <img src="/icons/pin.svg" alt="" width={16} height={16} className="size-4" />
              {cityMeta.address}
            </p>
          </div>
          <div className="flex items-center gap-8">
            <p className="hidden items-center gap-2 text-caption-lg text-grey md:flex">
              <img src="/icons/clock.svg" alt="" width={16} height={16} className="size-4" />
              {SHOP.hours}
            </p>
            <a
              href={cityMeta.phoneHref}
              className="flex items-center gap-2 text-caption-lg font-semibold text-dark"
            >
              <img src="/icons/phone.svg" alt="" width={16} height={16} className="size-4" />
              {cityMeta.phone}
            </a>
            <CallbackModal className="hidden sm:block" />
          </div>
        </div>
      </div>

      <div className="sticky top-0 z-40 border-b border-line bg-white">
        <div className="mx-auto flex max-w-content items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-2">
            <MobileMenu
              nav={nav}
              phone={cityMeta.phone}
              phoneHref={cityMeta.phoneHref}
              cityLabel={cityMeta.label}
              address={cityMeta.address}
              hours={SHOP.hours}
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
            {cartQty > 0 && <span className="tnum ml-2 font-extrabold">{cartQty}</span>}
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}
