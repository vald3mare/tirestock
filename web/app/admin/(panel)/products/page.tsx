import { requireUser } from "@/lib/admin-session";
import { adminProducts } from "@/lib/api/admin";
import { formatNumber, formatPrice } from "@/lib/format";
import { OverrideToggles } from "@/components/admin/OverrideToggles";

// Товары: read-модель из SelectTyres (цена/остаток менять НЕЛЬЗЯ — истина там).
// Здесь только наши оверрайды: скрыть товар и бейдж «Хит». Поиск — в URL (?q=).

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { token } = await requireUser();
  const { q = "" } = await searchParams;
  const { items } = await adminProducts(token, q);

  return (
    <main id="main" className="mx-auto max-w-content">
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="text-h2 text-black">Товары</h1>
        <p className="text-caption-lg text-grey">
          источник: SelectTyres · цены и остатки обновляются автоматически, менять их здесь нельзя
        </p>
      </header>

      <form method="get" className="mt-6 max-w-100">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Поиск по названию или артикулу…"
          aria-label="Поиск товара"
          className="w-full rounded-field border border-line bg-white px-5 py-3.5 text-field text-dark placeholder:text-grey hover:border-grey"
        />
      </form>

      <div className="mt-6 overflow-x-auto rounded-card-lg border border-line bg-white">
        <table className="w-full min-w-[720px] text-left">
          <thead>
            <tr className="border-b border-line text-caption text-grey">
              <th className="px-4 py-4 font-medium">Название</th>
              <th className="px-4 py-4 font-medium">Цена</th>
              <th className="px-4 py-4 font-medium">Остаток</th>
              <th className="px-4 py-4 font-medium">Оверрайды</th>
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
