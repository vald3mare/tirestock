import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/blocks/Breadcrumbs";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { WheelCard } from "@/components/blocks/WheelCard";
import { WheelFilterSidebar } from "@/components/blocks/WheelFilterSidebar";
import { listWheels, getWheelFacets, type WheelFilters, type WheelFacets } from "@/lib/api/client";
import { CITIES } from "@/lib/city";
import { formatNumber } from "@/lib/format";
import { getCity } from "@/lib/get-city";
import { metadataFor } from "@/lib/seo";

// Каталог дисков (/wheels/ 1:1 со старым сайтом, SEO). Отдельный от шин тип товара.
// Фильтры и пагинация — в URL query. Данные — из синка фида дисков SelectTyres.

type SearchParams = { [key: string]: string | string[] | undefined };

function parseFilters(sp: SearchParams): WheelFilters {
  const num = (v: SearchParams[string]) => {
    const n = parseFloat(typeof v === "string" ? v : "");
    return Number.isNaN(n) ? undefined : n;
  };
  const str = (v: SearchParams[string]) => (typeof v === "string" && v ? v : undefined);
  return {
    diameter: num(sp.diameter),
    width: num(sp.width),
    pcd: str(sp.pcd),
    type: str(sp.type),
    brand: str(sp.brand),
    price_min: num(sp.price_min),
    price_max: num(sp.price_max),
    sort: str(sp.sort) as WheelFilters["sort"],
    page: num(sp.page),
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const city = await getCity();
  return metadataFor("/wheels", {
    title: `Диски — купить в ${CITIES[city].loc} | TireStock`,
    description: `Каталог литых, кованых и штампованных дисков: подбор по диаметру, сверловке и вылету, наличие в ${CITIES[city].loc}, доставка по России.`,
  });
}

const EMPTY_FACETS: WheelFacets = { brands: [], diameters: [], widths: [], pcds: [], types: [] };

export default async function WheelsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const city = await getCity();
  const filters = { ...parseFilters(sp), city };
  const [{ items, total, page, per_page }, facets] = await Promise.all([
    listWheels(filters),
    getWheelFacets(city).catch(() => EMPTY_FACETS),
  ]);

  const nextPageParams = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string") nextPageParams.set(k, v);
  nextPageParams.set("page", String(page + 1));
  const hasMore = page * per_page < total;

  return (
    <main id="main" className="mx-auto max-w-content px-4 pb-20">
      <Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: "Диски" }]} />

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-baseline sm:justify-between">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="text-h2 text-black lg:text-h1">Диски</h1>
          <p className="tnum text-body font-medium text-grey">{formatNumber(total)} товаров</p>
        </div>
      </div>

      <div className="mt-8 flex flex-col-reverse items-stretch gap-6 lg:flex-row lg:items-start lg:gap-4">
        <div className="flex-1">
          {items.length === 0 ? (
            <div className="flex flex-col items-start gap-4 rounded-container bg-light p-10">
              <p className="text-h2 text-black">Ничего не найдено</p>
              <p className="text-body text-grey">Измените параметры фильтра или сбросьте его.</p>
              <Link href="/wheels/" className="text-nav text-blue hover:underline">Сбросить фильтр →</Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
              {items.map((w) => (
                <WheelCard key={w.slug} wheel={w} />
              ))}
            </div>
          )}
          {hasMore && (
            <div className="mt-8 flex justify-center">
              <ButtonLink href={`/wheels/?${nextPageParams}`} variant="secondary" className="tnum">
                Показать ещё
              </ButtonLink>
            </div>
          )}
        </div>

        <WheelFilterSidebar total={total} facets={facets} />
      </div>
    </main>
  );
}
