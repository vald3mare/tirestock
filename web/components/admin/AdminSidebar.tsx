"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/admin/actions";

type NavItem = { href?: string; label: string; soon?: boolean };

// Заказы/Товары — Фаза 1. Остальные разделы из макета — Фаза 2 (помечены «скоро»).
const nav: NavItem[] = [
  { href: "/admin/orders", label: "Заказы" },
  { href: "/admin/products", label: "Товары" },
  { href: "/admin/pages", label: "Страницы" },
  { href: "/admin/benefits", label: "Преимущества" },
  { href: "/admin/pickups", label: "Пункты выдачи" },
  { href: "/admin/seo", label: "SEO-мета" },
];

export function AdminSidebar({ userName }: { userName: string }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col bg-sidebar px-4 py-6 text-white">
      <p className="px-2 text-nav font-extrabold tracking-wide">TIRESTOCK</p>

      <nav className="mt-8 flex flex-col gap-1" aria-label="Разделы админки">
        {nav.map((item) => {
          if (item.soon || !item.href) {
            return (
              <span
                key={item.label}
                className="flex items-center justify-between rounded-field px-4 py-2.5 text-nav text-sidebar-text/60"
                title="Скоро"
              >
                {item.label}
                <span className="text-legal text-sidebar-text/60">скоро</span>
              </span>
            );
          }
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.label}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={
                "flex min-h-touch items-center rounded-field px-4 py-2.5 text-nav transition-colors " +
                (active
                  ? "bg-blue text-white"
                  : "text-sidebar-text hover:bg-sidebar-hover hover:text-white")
              }
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto px-2 pt-6">
        <p className="text-nav font-semibold text-white">{userName}</p>
        <form action={logoutAction}>
          <button
            type="submit"
            className="mt-1 cursor-pointer text-caption text-sidebar-text hover:text-white"
          >
            Выйти
          </button>
        </form>
      </div>
    </aside>
  );
}
