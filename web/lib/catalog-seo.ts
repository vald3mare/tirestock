import type { ProductFilters } from "@/lib/api/client";

// SEO-мета фильтрованного каталога (рекомендация сеошника): для востребованных
// комбинаций фильтров генерим уникальные H1/Title/Description и решаем, индексировать
// ли страницу. Цель — посадочные вроде «Шины R15», «Летние шины R17», «Шины Michelin»
// с чистыми мета-тегами, без дублей от каждой возможной комбинации фильтров.

const seasonAdj: Record<string, string> = {
  summer: "Летние",
  winter: "Зимние",
  allseason: "Всесезонные",
};
const seasonGen: Record<string, string> = {
  summer: "летних",
  winter: "зимних",
  allseason: "всесезонных",
};

// Типоразмер из фильтров: «195/65 R15» | «R15» | «195/65» | «» .
function sizeLabel(f: ProductFilters): string {
  const { width, profile, diameter } = f;
  if (width && profile && diameter) return `${width}/${profile} R${diameter}`;
  if (diameter) return `R${diameter}`;
  if (width && profile) return `${width}/${profile}`;
  if (width) return `${width} мм`;
  return "";
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export type CatalogSeo = {
  h1: string; // видимый заголовок (без количества товаров)
  title: string; // <title>
  description: string;
  indexable: boolean; // индексировать ли страницу (иначе noindex,follow)
  canonicalPath: string; // канонический URL (дедуп вариантов)
};

// noise-фильтры — не создают отдельную SEO-посадочную (цена/шипы/RunFlat/сортировка/
// текстовый поиск/страница пагинации). При их наличии страница noindex + canonical
// на чистую версию.
function hasNoise(f: ProductFilters): boolean {
  return Boolean(
    f.price_min || f.price_max || f.spikes || f.runflat || f.sort || f.q ||
      (f.page && f.page > 1),
  );
}

// Чистый ли набор размеров: пусто / только диаметр / полный 195/65 R15.
// Частичные (только ширина/профиль) — тонкие, не индексируем.
function cleanSize(f: ProductFilters): boolean {
  const has = (v?: number) => v !== undefined;
  if (!has(f.width) && !has(f.profile) && !has(f.diameter)) return true;
  if (has(f.diameter) && !has(f.width) && !has(f.profile)) return true;
  if (has(f.width) && has(f.profile) && has(f.diameter)) return true;
  return false;
}

// Канонический путь: /catalog + только SEO-параметры в фиксированном порядке
// (дедуп вариантов порядка и отсечение noise). trailingSlash добавит Next.
function canonical(f: ProductFilters, city: string): string {
  const p = new URLSearchParams();
  if (f.diameter) p.set("diameter", String(f.diameter));
  if (f.width) p.set("width", String(f.width));
  if (f.profile) p.set("profile", String(f.profile));
  if (f.season) p.set("season", f.season);
  if (f.brand) p.set("brand", f.brand);
  if (city && city !== "spb") p.set("city", city);
  return `/catalog${p.size ? `?${p}` : ""}`;
}

// cityLoc — предложный падеж для Title («в Санкт-Петербурге» / «в Москве»).
export function catalogSeo(f: ProductFilters, cityLoc: string, city: string): CatalogSeo {
  const size = sizeLabel(f);
  const brand = f.brand?.trim();
  const season = f.season;

  // Субъект: «[Летние] шины [Michelin] [R15]» → капитализируем.
  const core = brand ? `шины ${brand}` : "шины";
  const subject = cap(
    [season ? seasonAdj[season] : "", core, size].filter(Boolean).join(" "),
  );

  // Родительный для Description: «летних шин Michelin R15».
  const descCore = [
    season ? seasonGen[season] : "",
    "шин",
    brand ?? "",
    size,
  ]
    .filter(Boolean)
    .join(" ");

  // H1 — богатый, как просил сеошник: «Шины R15 — купить в Санкт-Петербурге»
  // (без «| TireStock» — бренд в H1 не нужен; количество товаров НЕ в H1).
  const h1 = `${subject} — купить в ${cityLoc}`;
  const title = `${subject} — купить в ${cityLoc} | TireStock`;
  const description = `Каталог ${descCore}: подбор по размеру и сезону, наличие на складе в ${cityLoc}, доставка по России.`;

  const indexable = !hasNoise(f) && cleanSize(f);

  return { h1, title, description, indexable, canonicalPath: canonical(f, city) };
}
