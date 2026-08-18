import type { PickupPoint } from "@/lib/api/client";

// Пункты выдачи. Истина — админка (таблица pickup_points, раздел «Пункты выдачи»),
// витрина тянет их по API. Ниже — фолбэк на случай недоступности API: те же
// данные, что в сиде миграции 0013 (главный адрес — Петровская коса).

export const fallbackPickupPoints: Pick<
  PickupPoint,
  "id" | "address" | "metro" | "hours" | "badge" | "note" | "is_central" | "sort_order" | "published"
>[] = [
  { id: 1, address: "Петровская коса", metro: "м. Чкаловская", hours: "Пн–Вс 09:00–21:00", badge: "", note: "Полный сервис: выдача, шиномонтаж, хранение колёс", is_central: true, sort_order: 0, published: true },
  { id: 2, address: "Советский пр., 37А", metro: "м. Рыбацкое", hours: "09:00–21:00 ежедневно", badge: "−15% на шиномонтаж", note: "", is_central: false, sort_order: 10, published: true },
  { id: 3, address: "ул. Новоселов, 49", metro: "м. Ломоносовская", hours: "09:00–21:00 ежедневно", badge: "−15% на шиномонтаж", note: "", is_central: false, sort_order: 20, published: true },
  { id: 4, address: "ул. Уральская, 8", metro: "м. Василеостровская", hours: "10:00–20:00 ежедневно", badge: "−15% на шиномонтаж", note: "", is_central: false, sort_order: 30, published: true },
  { id: 5, address: "ул. Рощинская, 48", metro: "м. Электросила", hours: "10:00–21:00 ежедневно", badge: "−15% на шиномонтаж", note: "", is_central: false, sort_order: 40, published: true },
  { id: 6, address: "ул. Руставели, 25", metro: "м. Гражданский пр.", hours: "09:00–22:00 ежедневно", badge: "−15% на шиномонтаж", note: "", is_central: false, sort_order: 50, published: true },
  { id: 7, address: "Полюстровский пр., 73", metro: "м. Лесная", hours: "09:00–21:00 ежедневно", badge: "−15% на шиномонтаж", note: "", is_central: false, sort_order: 60, published: true },
  { id: 8, address: "Московское шоссе, 16", metro: "м. Звёздная", hours: "09:00–22:00 ежедневно", badge: "−15% на шиномонтаж", note: "", is_central: false, sort_order: 70, published: true },
  { id: 9, address: "ул. Камышовая, 21", metro: "м. Комендантский пр.", hours: "10:00–20:00 ежедневно", badge: "−15% на шиномонтаж", note: "", is_central: false, sort_order: 80, published: true },
];

// Ссылка на пункт в Яндекс.Картах по адресу (СПб). Открывает карту с поиском.
export function yandexMapsUrl(address: string): string {
  return `https://yandex.ru/maps/?text=${encodeURIComponent(`Санкт-Петербург, ${address}`)}`;
}

// URL встраиваемого виджета Яндекс.Карт (iframe) с поиском по адресу — без API-ключа.
// Пока центрируем на центральном складе; мультипин по всем пунктам — когда будут
// координаты от Виталия (карту-конструктор Яндекса).
export function yandexEmbedUrl(query: string): string {
  return `https://yandex.ru/map-widget/v1/?text=${encodeURIComponent(`Санкт-Петербург, ${query}`)}&z=12`;
}
