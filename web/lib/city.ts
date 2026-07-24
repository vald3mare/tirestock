export type City = "spb" | "msk";
export const CITY_COOKIE = "city";
export const DEFAULT_CITY: City = "spb";

// Метаданные городов для шапки/футера. Адрес/телефон МСК — плейсхолдер до данных
// от Виталия (TODO: уточнить реальный адрес и телефон Москвы).
// Клиент-safe: НЕ импортировать сюда "next/headers" — этот модуль тянут
// и клиентские компоненты (CitySwitcher). Серверное чтение куки — lib/get-city.ts.
export const CITIES: Record<City, { label: string; address: string; phone: string; phoneHref: string }> = {
  spb: {
    label: "Санкт-Петербург",
    address: "Зотовский пр. 11, стр. 1",
    phone: "+7 (812) 614-64-42",
    phoneHref: "tel:+78126146442",
  },
  msk: {
    label: "Москва",
    address: "уточняется",
    phone: "+7 (812) 614-64-42",
    phoneHref: "tel:+78126146442",
  },
};

export function isCity(v: string | undefined): v is City {
  return v === "spb" || v === "msk";
}
