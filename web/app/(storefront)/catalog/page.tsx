import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/blocks/Breadcrumbs";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { FilterSidebar } from "@/components/blocks/FilterSidebar";
import { ProductCard } from "@/components/blocks/ProductCard";
import { SortSelect } from "@/components/blocks/SortSelect";
import { getCatalogFacets, listProducts, type ProductFilters, type Season } from "@/lib/api/client";
import { optionsFromFacets, staticFilterOptions } from "@/lib/catalog-options";
import { formatNumber } from "@/lib/format";
import { getCity } from "@/lib/get-city";
import { metadataFor } from "@/lib/seo";

// Каталог шин (Figma → «Каталог», 20:417). Server Component:
// фильтры и пагинация живут в URL query params (searchParams), имена = API 1:1.
// SEO-мета из админки (раздел «SEO-мета»), фолбэк — значения ниже.
// TODO: сверить URL со старым сайтом (SEO — священная корова).

export function generateMetadata(): Promise<Metadata> {
  return metadataFor("/catalog", {
    title: "Шины — купить в Санкт-Петербурге | TireStock",
    description:
      "Каталог шин: подбор по размеру и сезону, наличие на складе в СПб, доставка по России.",
  });
}

type SearchParams = { [key: string]: string | string[] | undefined };

function parseFilters(sp: SearchParams): ProductFilters {
  const num = (v: string | string[] | undefined) => {
    const n = parseInt(typeof v === "string" ? v : "", 10);
    return Number.isNaN(n) ? undefined : n;
  };
  const str = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);
  const bool = (v: string | string[] | undefined) => (v === "true" ? true : undefined);

  return {
    q: str(sp.q),
    width: num(sp.width),
    profile: num(sp.profile),
    diameter: num(sp.diameter),
    season: str(sp.season) as Season | undefined,
    brand: str(sp.brand),
    price_min: num(sp.price_min),
    price_max: num(sp.price_max),
    spikes: bool(sp.spikes),
    runflat: bool(sp.runflat),
    sort: str(sp.sort) as ProductFilters["sort"],
    page: num(sp.page),
  };
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const city = await getCity();
  const filters = { ...parseFilters(sp), city };
  const [{ items, total, page, per_page }, filterOptions] = await Promise.all([
    listProducts(filters),
    getCatalogFacets(city)
      .then(optionsFromFacets)
      .catch(() => staticFilterOptions), // фасеты недоступны → статика
  ]);

  const nextPageParams = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") nextPageParams.set(k, v);
  }
  nextPageParams.set("page", String(page + 1));
  const hasMore = page * per_page < total;

  return (
    <main id="main" className="mx-auto max-w-content px-4 pb-20">
      <Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: "Шины" }]} />

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-h2 text-black lg:text-h1">
          {filters.q ? `Поиск: ${filters.q}` : "Шины"}
          <span className="tnum text-body font-medium text-grey">
            {formatNumber(total)} товаров
          </span>
        </h1>
        <SortSelect value={filters.sort ?? ""} />
      </div>

      <div className="mt-8 flex flex-col-reverse items-stretch gap-6 lg:flex-row lg:items-start lg:gap-4">
        <div className="flex-1">
          {items.length === 0 ? (
            // TODO: полноценный empty state поиска — дизайн в работе (см. TODO дизайна)
            <div className="flex flex-col items-start gap-4 rounded-container bg-light p-10">
              <p className="text-h2 text-black">Ничего не найдено</p>
              <p className="text-body text-grey">
                Попробуйте изменить параметры фильтра или сбросить его.
              </p>
              <Link href="/catalog" className="text-nav text-blue hover:underline">
                Сбросить фильтр →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
              {items.map((p) => (
                <ProductCard key={p.slug} product={p} />
              ))}
            </div>
          )}

          {hasMore && (
            <div className="mt-8 flex justify-center">
              <ButtonLink
                href={`/catalog?${nextPageParams}`}
                variant="secondary"
                className="tnum"
              >
                Показать ещё {formatNumber(Math.min(per_page, total - page * per_page))} товара
              </ButtonLink>
            </div>
          )}
        </div>

        <FilterSidebar total={total} options={filterOptions} />
      </div>
    </main>
  );
}
