"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";

export type NavItem = { label: string; href: string };

// Пункт навигации с необязательной выпадающей панелью (Figma → «Header - Dropdown_open»).
// A11y по чеклисту: Enter/Space открывают, Escape закрывает, aria-expanded/haspopup,
// hover-мостик к панели (padding-обёртка без разрыва). Анимация — opacity+translateY,
// отключается при prefers-reduced-motion.
export function NavDropdown({
  label,
  href,
  items,
}: {
  label: string;
  href: string;
  items?: NavItem[];
}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuId = useId();

  if (!items || items.length === 0) {
    return (
      <Link
        href={href}
        className="flex min-h-touch items-center text-nav text-black transition-colors duration-150 hover:text-blue"
      >
        {label}
      </Link>
    );
  }

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => {
        cancelClose();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      <Link
        href={href}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen(false)}
        className="flex min-h-touch items-center gap-1 text-nav text-black transition-colors duration-150 hover:text-blue aria-expanded:text-blue"
      >
        {label}
        <img
          src="/icons/chevron-down.svg"
          alt=""
          width={14}
          height={14}
          className={
            "size-3.5 transition-transform duration-200 ease-out motion-reduce:transition-none " +
            (open ? "-rotate-180" : "")
          }
        />
      </Link>

      {/* Обёртка с pt-3 — hover-мостик от пункта к панели без разрыва. */}
      <div
        className={
          "absolute left-1/2 top-full z-50 -translate-x-1/2 pt-3 transition duration-200 ease-out " +
          "motion-reduce:transition-none " +
          (open
            ? "visible translate-y-0 opacity-100"
            : "invisible -translate-y-1 opacity-0")
        }
      >
        <ul
          id={menuId}
          role="menu"
          aria-label={label}
          className="w-62 rounded-card-lg border border-line bg-white p-2 shadow-dropdown"
        >
          {items.map((item) => (
            <li key={item.label} role="none">
              <Link
                href={item.href}
                role="menuitem"
                tabIndex={open ? 0 : -1}
                onClick={() => setOpen(false)}
                className="flex min-h-touch items-center rounded-field px-4 py-2.5 text-field text-dark transition-colors duration-150 hover:bg-light hover:text-black focus-visible:bg-light"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
