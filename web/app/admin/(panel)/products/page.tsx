import Link from "next/link";
import { requireUser } from "@/lib/admin-session";
import { adminProducts } from "@/lib/api/admin";
import { formatNumber, formatPrice } from "@/lib/format";
import { OverrideToggles } from "@/components/admin/OverrideToggles";

// Товары: read-модель из SelectTyres (цена/остаток менять НЕЛЬЗЯ — истина там).
// Здесь только наши оверрайды: скрыть товар и бейдж «Хит». Поиск + фильтр
// наличия — в URL (?q=, ?stock=in|out). Распроданные синк не удаляет (обнуляет
// остаток), поэтому вкладка «Нет в наличии» позволяет их найти.

const stockTabs = [
  { key: "", label: "Все" },
  { key: "in", label: "В наличии" },
  { key: "out", label: "Нет в наличии" },
] as const;

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; stock?: string }>;
}) {
  const { token } = await requireUser();
  const { q = "", stock = "" } = await searchParams;
  const active = stock === "in" || stock === "out" ? stock : "";
  const { items } = await adminProducts(token, q, active || undefined);

  return (
    <main id="main" className="mx-auto max-w-content">
      <header>
        <h1 className="text-h2 text-black">Товары</h1>
        <div className="mt-3 flex items-start gap-2.5 rounded-card border border-line bg-light px-4 py-3">
          <span aria-hidden="true" className="mt-0.5 text-body">ℹ️</span>
          <p className="max-w-180 text-caption-lg text-grey">
            Данные товаров — название, цена, остаток — приходят из SelectTyres и обновляются
            автоматически, <span className="font-semibold text-dark">редактировать их здесь нельзя</span>.
            Управлять можно только показом на витрине: скрыть товар из каталога или отметить «Хит».
          </p>
        </div>
      </header>

      <form method="get" className="mt-6 max-w-100">
        {active && <input type="hidden" name="stock" value={active} />}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Поиск по названию или артикулу…"
          aria-label="Поиск товара"
          className="w-full rounded-field border border-line bg-white px-5 py-3.5 text-field text-dark placeholder:text-grey hover:border-grey"
        />
      </form>

      {/* Вкладки наличия. Сохраняют текущий поиск (q). */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {stockTabs.map((t) => {
          const isActive = active === t.key;
          const params = new URLSearchParams();
          if (q) params.set("q", q);
          if (t.key) params.set("stock", t.key);
          return (
            <Link
              key={t.key || "all"}
              href={`/admin/products${params.size > 0 ? `?${params}` : ""}`}
              aria-current={isActive ? "page" : undefined}
              className={
                "inline-flex min-h-touch items-center rounded-field px-4 py-2 text-caption-lg font-semibold transition-colors " +
                (isActive
                  ? "bg-blue text-white"
                  : "border border-line bg-white text-dark hover:border-grey")
              }
            >
              {t.label}
            </Link>
          );
        })}
        <span className="tnum ml-1 text-caption text-grey">
          {formatNumber(items.length)}
          {items.length >= 1000 ? "+" : ""} товаров
        </span>
      </div>

      <div className="mt-6 overflow-x-auto rounded-card-lg border border-line bg-white">
        <table className="w-full min-w-[720px] text-left">
          <thead>
            <tr className="border-b border-line text-caption text-grey">
              <th className="px-4 py-4 font-medium">Название</th>
              <th className="px-4 py-4 font-medium">Цена</th>
              <th className="px-4 py-4 font-medium">Остаток</th>
              <th className="px-4 py-4 font-medium">Показ на витрине</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-body text-grey">
                  {q ? "Ничего не найдено." : "Товаров нет."}
                </td>
              </tr>
            ) : (
              items.map((p) => (
                <tr key={p.slug} className="border-b border-line last:border-0 text-caption-lg text-dark">
                  <td className="px-4 py-4">{p.name}</td>
                  <td className="tnum px-4 py-4">{formatPrice(p.price)}</td>
                  <td className="tnum px-4 py-4 text-grey">{formatNumber(p.stock)} шт.</td>
                  <td className="px-4 py-4">
                    <OverrideToggles slug={p.slug} hidden={p.hidden} badgeHit={p.badge_hit} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
