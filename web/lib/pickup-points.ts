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

// Ссылка на пункт в Яндекс.Картах по адресу. region — город для точного поиска.
export function yandexMapsUrl(address: string, region = "Санкт-Петербург"): string {
  return `https://yandex.ru/maps/?text=${encodeURIComponent(`${region}, ${address}`)}`;
}

// URL встраиваемого виджета Яндекс.Карт (iframe) с поиском по адресу — без API-ключа.
// region — город; мультипин по всем пунктам — когда будут координаты от владельца.
export function yandexEmbedUrl(query: string, region = "Санкт-Петербург"): string {
  return `https://yandex.ru/map-widget/v1/?text=${encodeURIComponent(`${region}, ${query}`)}&z=12`;
}
