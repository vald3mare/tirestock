import type { PickupPoint } from "@/lib/api/client";

// Пункты выдачи. Истина — админка (таблица pickup_points, раздел «Пункты выдачи»),
// витрина тянет их по API. Ниже — фолбэк на случай недоступности API: те же
// данные, что в сиде миграции 0013 (главный адрес — Петровская коса).

// Фолбэк на случай недоступности API — основные пункты (реальные, миграция 0015).
export const fallbackPickupPoints: Pick<
  PickupPoint,
  "id" | "slug" | "address" | "metro" | "hours" | "badge" | "note" | "is_central" | "is_main" | "city" | "sort_order" | "published"
>[] = [
  { id: 1, slug: "novoselov-49", address: "ул. Новосёлов, 49", metro: "м. Ломоносовская", hours: "09:00–21:00", badge: "−15% на шиномонтаж", note: "", is_central: false, is_main: true, city: "spb", sort_order: 10, published: true },
  { id: 2, slug: "torfyanaya-21", address: "Торфяная дорога, 21", metro: "м. Комендантский проспект", hours: "09:00–21:00", badge: "−15% на шиномонтаж", note: "", is_central: false, is_main: true, city: "spb", sort_order: 20, published: true },
  { id: 3, slug: "polyustrovskiy-73", address: "Полюстровский пр., 73", metro: "м. Лесная", hours: "09:00–21:00", badge: "−15% на шиномонтаж", note: "", is_central: false, is_main: true, city: "spb", sort_order: 30, published: true },
];

// Координаты пунктов выдачи [широта, долгота] по slug — для интерактивной карты
// (Leaflet) в оформлении заказа: все точки пинами, клик по пину → выбор пункта,
// как на старом сайте. Значения сняты с Яндекс-карты старого сайта tirestock.ru/points/
// (точные, поэтому «точка не в том месте» уходит). Slug'и — из миграции 0015.
// Когда пункты станут редактируемыми с координатами в админке — перенести в БД/API.
export const POINT_COORDS: Record<string, [number, number]> = {
  "novoselov-49": [59.885782, 30.474259],
  "torfyanaya-21": [59.997824, 30.256166],
  "malyy-vo-61": [59.939153, 30.245142],
  "moskovskoe-25-1v": [59.822389, 30.358891],
  "moskovskoe-16-7": [59.797932, 30.399941],
  "pulkovskoe-19a": [59.826581, 30.319157],
  "ligovskiy-283": [59.898314, 30.335290],
  "severnyy-32": [60.032731, 30.362832],
  "vyborgskoe-11": [60.045067, 30.315785],
  "polyustrovskiy-73": [59.979576, 30.366953],
  "karbysheva-9b": [59.993189, 30.352039],
  "bugry-yuzhnaya-5": [60.060740, 30.393768],
  "moskovskoe-shosse-16": [59.799251, 30.398495],
  "petrovskaya-kosa-3d": [59.963291, 30.249438],
  "zolnaya-11a": [59.917952, 30.424806],
  "kommuny-14": [59.940575, 30.503926],
  "hasanskaya-17": [59.934483, 30.497543],
  "kultury-61k4": [60.077014, 30.379172],
  "solidarnosti-22a": [59.913650, 30.500104],
  "zelenogorsk-lenina-88": [60.217105, 29.727238],
  // Доп. пункты 14.09.2026 (миграция 0023): шиномонтажи СПб/ЛО + склады Москвы.
  // ЛО-точки геокодированы (Nominatim/OSM), Парнас — с Яндекс-организации владельца.
  "shinomontazh-01-parnas": [60.072277, 30.339708],
  "merkureva-3": [60.073000, 30.344344],
  "shinomontazh-04-agalatovo": [60.221546, 30.279511],
  "charushinskaya-2": [60.011098, 30.478318],
  "shinomontazh-07-korabselki": [60.102403, 30.402746],
  "chaynaya-1-bugry": [60.057353, 30.398329],
  "shosseynaya-1-enkolovo": [60.110700, 30.428227],
  "mihaylovskaya-30": [60.071677, 30.255123],
  "msk-vyazovskiy-4": [55.718901, 37.759264],
  "msk-melitopolskaya-12a": [55.534247, 37.578166],
};

// Ссылка на пункт в Яндекс.Картах по адресу. region — город для точного поиска.
export function yandexMapsUrl(address: string, region = "Санкт-Петербург"): string {
  return `https://yandex.ru/maps/?text=${encodeURIComponent(`${region}, ${address}`)}`;
}

// URL встраиваемого виджета Яндекс.Карт (iframe) с поиском по адресу — без API-ключа.
// Используется на страницах с ОДНОЙ точкой (контакты, /points/<slug>). Для выбора
// пункта в оформлении заказа — интерактивная карта (PickupMap) по POINT_COORDS.
export function yandexEmbedUrl(query: string, region = "Санкт-Петербург"): string {
  return `https://yandex.ru/map-widget/v1/?text=${encodeURIComponent(`${region}, ${query}`)}&z=12`;
}
