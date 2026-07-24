"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import type { NavItem } from "@/components/blocks/NavDropdown";

export type MobileNavItem = { label: string; href: string; items?: NavItem[] };

type Props = {
  nav: MobileNavItem[];
  phone: string;
  phoneHref: string;
  cityLabel: string;
  address: string;
  hours: string;
};

// Мобильное меню-бургер (Figma «Mobile — Burger menu», 99:764). Полноэкранная
// панель с аккордеоном по разделам с подпунктами. Виден только < lg (десктоп
// использует NavDropdown). Данные нава — те же, что в Header.
export function MobileMenu({ nav, phone, phoneHref, cityLabel, address, hours }: Props) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>("Шины"); // как на макете
  const panelId = useId();

  // Escape закрывает; пока открыто — блокируем прокрутку body.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-label="Открыть меню"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(true)}
        className="flex min-h-touch min-w-touch items-center justify-center"
      >
        <img src="/icons/burger.svg" alt="" width={24} height={24} className="size-6" />
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-modal="true"
          aria-label="Меню"
          className="animate-dropdown fixed inset-0 z-50 flex flex-col overflow-y-auto bg-white"
        >
          {/* Шапка панели */}
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
            <button
              type="button"
              aria-label="Закрыть меню"
              onClick={() => setOpen(false)}
              className="flex min-h-touch min-w-touch items-center justify-center"
            >
              <img src="/icons/close.svg" alt="" width={24} height={24} className="size-6" />
            </button>
            <Link
              href="/"
              onClick={() => setOpen(false)}
              className="text-nav font-extrabold text-dark"
              aria-label="TireStock — на главную"
            >
              TIRESTOCK
            </Link>
            <div className="flex items-center gap-1">
              <a
                href={phoneHref}
                aria-label="Позвонить"
                className="flex min-h-touch min-w-touch items-center justify-center"
              >
                <img src="/icons/phone.svg" alt="" width={22} height={22} className="size-[22px]" />
              </a>
              <Link
                href="/cart"
                onClick={() => setOpen(false)}
                aria-label="Корзина"
                className="flex min-h-touch min-w-touch items-center justify-center"
              >
                <img src="/icons/cart.svg" alt="" width={22} height={22} className="size-[22px]" />
              </Link>
            </div>
          </div>

          {/* Пункты меню */}
          <nav className="flex flex-col p-4" aria-label="Мобильная навигация">
            {nav.map((item) => {
              const hasChildren = item.items && item.items.length > 0;
              if (!hasChildren) {
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex min-h-touch items-center px-2 py-3.5 text-[17px] font-semibold text-dark"
                  >
                    {item.label}
                  </Link>
                );
              }
              const isOpen = expanded === item.label;
              return (
                <div key={item.label} className="flex flex-col">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setExpanded(isOpen ? null : item.label)}
                    className={
                      "flex min-h-touch items-center justify-between px-2 py-3.5 text-[17px] font-semibold " +
                      (isOpen ? "text-blue" : "text-dark")
                    }
                  >
                    {item.label}
                    <img
                      src="/icons/chevron-down-sm.svg"
                      alt=""
                      width={18}
                      height={18}
                      className={`size-[18px] transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {isOpen &&
                    item.items!.map((sub) => (
                      <Link
                        key={sub.label}
                        href={sub.href}
                        onClick={() => setOpen(false)}
                        className="flex min-h-touch items-center px-6 py-2.5 text-[15px] font-medium text-grey"
                      >
                        {sub.label}
                      </Link>
                    ))}
                </div>
              );
            })}

            <div className="my-2 h-px w-full bg-line" />

            <a
              href={phoneHref}
              className="flex min-h-touch items-center justify-center gap-2 rounded-field bg-blue px-6 py-3.5 text-nav font-semibold text-white active:scale-[0.98]"
            >
              <img src="/icons/phone-white.svg" alt="" width={18} height={18} className="size-[18px]" />
              {phone}
            </a>

            <div className="flex flex-col gap-1.5 px-2 py-3.5">
              <p className="flex items-center gap-2 text-caption-lg text-grey">
                <img src="/icons/pin.svg" alt="" width={16} height={16} className="size-4" />
                {cityLabel}, {address}
              </p>
              <p className="flex items-center gap-2 text-caption-lg text-grey">
                <img src="/icons/clock.svg" alt="" width={16} height={16} className="size-4" />
                {hours}
              </p>
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}
