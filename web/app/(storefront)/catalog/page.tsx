import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/blocks/Breadcrumbs";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { FilterSidebar } from "@/components/blocks/FilterSidebar";
import { ProductCard } from "@/components/blocks/ProductCard";
import { SortSelect } from "@/components/blocks/SortSelect";
import { getCatalogFacets, listProducts, type ProductFilters, type Season } from "@/lib/api/client";
import { optionsFromFacets, staticFilterOptions } from "@/lib/catalog-options";
import { catalogSeo } from "@/lib/catalog-seo";
import { CITIES } from "@/lib/city";
import { formatNumber } from "@/lib/format";
import { getCity } from "@/lib/get-city";
import { metadataFor } from "@/lib/seo";

// Каталог шин (Figma → «Каталог», 20:417). Server Component:
// фильтры и пагинация живут в URL query params (searchParams), имена = API 1:1.
// SEO-мета из админки (раздел «SEO-мета»), фолбэк — значения ниже.
// TODO: сверить URL со старым сайтом (SEO — священная корова).

type SearchParams = { [key: string]: string | string[] | undefined };

// Есть ли активный фильтр (кроме города/страницы) — тогда это SEO-посадочная.
function hasActiveFilter(f: ProductFilters): boolean {
  return Boolean(
    f.q || f.width || f.profile || f.diameter || f.season || f.brand ||
      f.price_min || f.price_max || f.spikes || f.runflat,
  );
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const f = parseFilters(sp);
  const city = await getCity();

  // Базовый каталог (без фильтров) — мета из админки (раздел «SEO-мета»).
  // Фолбэк перенесён со старого сайта tirestock.ru/tyres/ (правка сеошника #2).
  if (!hasActiveFilter(f)) {
    return metadataFor("/catalog", {
      title: `Шины купить дёшево в ${CITIES[city].loc}, цены на резину`,
      description: `Шины по низким ценам в ${CITIES[city].loc}. Большой ассортимент резины, доставка по России.`,
    });
  }
  // Фильтрованная страница — генерим уникальные мета + canonical/robots.
  const seo = catalogSeo(f, CITIES[city].loc, city);
  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical: seo.canonicalPath },
    // Индексируем только чистые востребованные комбинации; остальное — noindex,follow.
    robots: seo.indexable ? undefined : { index: false, follow: true },
  };
}

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

  // Заголовок H1: для фильтрованной страницы — сгенерированный («Шины R15»),
  // для текстового поиска — «Поиск: …», иначе «Шины». Количество товаров — НЕ в H1
  // (рекомендация сеошника), а отдельным элементом ниже.
  const pageH1 = filters.q
    ? `Поиск: ${filters.q}`
    : catalogSeo(filters, CITIES[city].loc, city).h1;

  return (
    <main id="main" className="mx-auto max-w-content px-4 pb-20">
      <Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: "Шины" }]} />

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="text-h2 text-black lg:text-h1">{pageH1}</h1>
          {/* Количество — отдельно от H1 (SEO): не часть заголовка. */}
          <p className="tnum text-body font-medium text-grey">{formatNumber(total)} товаров</p>
        </div>
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

      {/* SEO-текст внизу каталога (был на старом сайте, здесь отсутствовал).
          На фильтрованных страницах не выводим (чтобы не плодить одинаковый текст). */}
      {!hasActiveFilter(filters) && (
        <section className="mt-16 max-w-content text-body text-grey">
          <h2 className="text-h2 text-black">Купить шины в {CITIES[city].loc}</h2>
          <div className="mt-4 flex flex-col gap-3">
            <p>
              В каталоге TireStock — легковые шины ведущих производителей: подбор по
              размеру (ширина, профиль, диаметр), сезону (летние, зимние шипованные и
              нешипованные, всесезонные) и марке. Цены и наличие обновляются автоматически
              со склада — вы видите актуальные остатки в {CITIES[city].loc}.
            </p>
            <p>
              Уточните типоразмер на боковине покрышки (например, 195/65 R15) или
              воспользуйтесь фильтром слева — счётчик покажет число подходящих моделей.
              Шины продаются комплектами, в карточке по умолчанию 4 штуки.
            </p>
            <p>
              Забрать заказ можно в пункте выдачи или заказать доставку курьером по городу
              и транспортной компанией в регионы. Бесплатный шиномонтаж при покупке
              комплекта — уточняйте у менеджера.
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
