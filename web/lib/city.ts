// Мультигород: Санкт-Петербург + Москва (без 60 поддоменов старого сайта).
// Клиент-safe: НЕ импортировать "next/headers" — модуль тянут и клиентские
// компоненты (CitySwitcher). Серверное чтение куки — lib/get-city.ts.

export type City = "spb" | "msk";
export const CITY_COOKIE = "city";
export const DEFAULT_CITY: City = "spb";

// Метаданные городов для шапки/футера/страниц. loc — предложный падеж
// («купить в …»). Адрес/телефон Москвы — плейсхолдер до данных от владельца.
export const CITIES: Record<City, {
  label: string;
  loc: string;
  address: string;
  phone: string;
  phoneHref: string;
}> = {
  spb: {
    label: "Санкт-Петербург",
    loc: "Санкт-Петербурге",
    address: "Петровская коса",
    phone: "+7 (812) 614-64-42",
    phoneHref: "tel:+78126146442",
  },
  msk: {
    label: "Москва",
    loc: "Москве",
    address: "уточняется",
    phone: "+7 (812) 614-64-42",
    phoneHref: "tel:+78126146442",
  },
};

export const CITY_LIST: City[] = ["spb", "msk"];

export function isCity(v: string | undefined | null): v is City {
  return v === "spb" || v === "msk";
}
