// Опции фильтров каталога — единый источник для SearchWidget (hero)
// и FilterSidebar (каталог). Значения соответствуют параметрам API 1:1.
import type { Season } from "@/lib/api/client";

export type Option = { value: string; label: string };

export const widthOptions: Option[] = toOptions([
  "165", "175", "185", "195", "205", "215", "225", "235", "245", "255",
]);

export const profileOptions: Option[] = toOptions([
  "35", "40", "45", "50", "55", "60", "65", "70", "75",
]);

export const diameterOptions: Option[] = toOptions([
  "13", "14", "15", "16", "17", "18", "19", "20",
]);

export const seasonOptions: { value: Season; label: string }[] = [
  { value: "summer", label: "Лето" },
  { value: "winter", label: "Зима" },
  { value: "allseason", label: "Всесезонные" },
];

// Бренды — из DESIGN_SYSTEM.md «Контентные данные»
export const brandOptions: Option[] = toOptions([
  "BFGoodrich", "Bridgestone", "Continental", "Cooper", "Dunlop", "Gislaved",
  "GoodYear", "Hankook", "Kumho", "Maxxis", "Michelin", "Nokian", "Pirelli",
  "TOYO", "Yokohama",
]);

// Чипы «Популярно:» в hero-поиске
export const popularSizes = ["205/55 R16", "195/65 R15", "225/45 R17", "215/60 R16"];

// Популярные размеры из данных (топ по наличию) → лейблы для чипов hero.
// Фолбэк на статику popularSizes, если фасеты пусты (пустой каталог / ошибка).
export function popularSizesFromFacets(
  sizes: { label: string }[] | undefined | null,
): string[] {
  return sizes && sizes.length ? sizes.map((s) => s.label) : popularSizes;
}

// «205/55 R16» → { width, profile, diameter }
export function parseTireSize(size: string): { width: string; profile: string; diameter: string } | null {
  const m = size.match(/^(\d+)\/(\d+) R(\d+)$/);
  return m ? { width: m[1], profile: m[2], diameter: m[3] } : null;
}

function toOptions(values: string[]): Option[] {
  return values.map((v) => ({ value: v, label: v }));
}

// Набор опций сайдбара. Собирается из фасетов каталога (реальные значения СПб)
// с фолбэком на статику выше, если фасет пуст (пустой каталог / ошибка API).
export type FilterOptions = {
  widths: Option[];
  profiles: Option[];
  diameters: Option[];
  brands: Option[];
};

export const staticFilterOptions: FilterOptions = {
  widths: widthOptions,
  profiles: profileOptions,
  diameters: diameterOptions,
  brands: brandOptions,
};

// Фасеты (brands: string[], widths/profiles/diameters: number[]) → опции.
// Пустой массив фасета → фолбэк на соответствующую статику.
export function optionsFromFacets(f: {
  brands: string[];
  widths: number[];
  profiles: number[];
  diameters: number[];
}): FilterOptions {
  const nums = (xs: number[], fb: Option[]) =>
    xs.length ? toOptions(xs.map(String)) : fb;
  return {
    widths: nums(f.widths, widthOptions),
    profiles: nums(f.profiles, profileOptions),
    diameters: nums(f.diameters, diameterOptions),
    brands: f.brands.length ? toOptions(f.brands) : brandOptions,
  };
}
