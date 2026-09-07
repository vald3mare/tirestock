// Типизированный клиент API. Типы генерируются из api/openapi.yaml
// командой `npm run gen:api` — руками schema.d.ts не править.
// Все данные ходят ТОЛЬКО через этот модуль (см. CONVENTIONS.md → Next.js-2).

import type { components } from "./schema";

export type Product = components["schemas"]["Product"];
export type ProductList = components["schemas"]["ProductList"];
export type Season = components["schemas"]["Season"];
export type OrderItem = components["schemas"]["OrderItem"];
export type CreateOrderInput = components["schemas"]["CreateOrderInput"];
export type CallbackInput = components["schemas"]["CallbackInput"];
export type RequestInput = components["schemas"]["RequestInput"];
export type CatalogFacets = components["schemas"]["CatalogFacets"];
export type Benefit = components["schemas"]["Benefit"];
export type SeoResolved = components["schemas"]["SeoResolved"];
export type PickupPoint = components["schemas"]["PickupPoint"];
export type OrderStatus = components["schemas"]["OrderStatus"];
export type ErrorBody = components["schemas"]["ErrorBody"];

// Фильтры каталога = query-параметры URL витрины (имена совпадают 1:1).
export type ProductFilters = {
  q?: string;
  width?: number;
  profile?: number;
  diameter?: number;
  season?: Season;
  brand?: string;
  price_min?: number;
  price_max?: number;
  spikes?: boolean;
  runflat?: boolean;
  sort?: "price_asc" | "price_desc" | "name";
  city?: "spb" | "msk";
  page?: number;
  per_page?: number;
};

const API_URL = process.env.API_URL ?? "http://localhost:8080";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    let code = "unknown";
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as ErrorBody;
      code = body.error.code;
      message = body.error.message;
    } catch {
      // тело не JSON — оставляем дефолты
    }
    throw new ApiError(res.status, code, message);
  }
  return (await res.json()) as T;
}

export function getHealth(): Promise<{ status: "ok" }> {
  return request("/health", { cache: "no-store" });
}

export function listProducts(filters: ProductFilters = {}): Promise<ProductList> {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined) qs.set(key, String(value));
  }
  const query = qs.size > 0 ? `?${qs}` : "";
  return request(`/products${query}`);
}

export function getProductBySlug(slug: string, city = "spb"): Promise<Product> {
  return request(`/products/${encodeURIComponent(slug)}?city=${encodeURIComponent(city)}`);
}

// Фасеты каталога — реальные бренды/размеры в наличии города. Строят опции
// сайдбара вместо статики; фолбэк на lib/catalog-options при пустом ответе.
export function getCatalogFacets(city = "spb"): Promise<CatalogFacets> {
  return request(`/catalog/facets?city=${encodeURIComponent(city)}`);
}

// Контентная страница витрины (тексты/SEO из админки). Только опубликованные.
export type ContentPage = {
  slug: string;
  title: string;
  body: string;
  meta_title: string;
  meta_description: string;
  updated_by: string;
  updated_at: string;
};

// no-store: правки в админке применяются на сайте сразу, без кеша.
export function getContentPage(path: string): Promise<ContentPage> {
  return request(`/content?path=${encodeURIComponent(path)}`, { cache: "no-store" });
}

// Список опубликованных страниц под префиксом URL (раздел-листинг, напр. Новости).
export function listContentByPrefix(prefix: string): Promise<{ items: ContentPage[] }> {
  return request(`/content-list?prefix=${encodeURIComponent(prefix)}`, { cache: "no-store" });
}

// Офферы строки «Преимущества» (главная). Контент из админки; no-store —
// правки видны сразу. Фолбэк на статику — на стороне вызывающего компонента.
export function listBenefits(): Promise<{ items: Benefit[] }> {
  return request("/benefits", { cache: "no-store" });
}

// Пункты выдачи города для страницы /points. Контент из админки; no-store —
// правки видны сразу. Фолбэк на статику — на стороне вызывающего компонента.
export function listPickupPoints(city = "spb"): Promise<{ items: PickupPoint[] }> {
  return request(`/pickup-points?city=${encodeURIComponent(city)}`, { cache: "no-store" });
}

// Пункт выдачи по slug — для отдельной страницы /points/<slug>.
export function getPickupPoint(slug: string): Promise<PickupPoint> {
  return request(`/pickup-points/${encodeURIComponent(slug)}`, { cache: "no-store" });
}

// Статус заказа по номеру (обратная интеграция tradesk). Страница /status/.
// no-store — статус живой. found=false, если не найден.
export function getOrderStatus(code: string): Promise<OrderStatus> {
  return request(`/order-status?code=${encodeURIComponent(code)}`, { cache: "no-store" });
}

// Эффективная SEO-мета маршрута для generateMetadata. Мета из админки (раздел
// «SEO-мета»). Ревалидация 300с (не no-store): мета меняется редко, а главная/
// каталог должны остаться ISR, а не рендериться на каждый запрос. Фолбэк — у вызывающего.
export function resolveSeo(path: string): Promise<SeoResolved> {
  return request(`/seo?path=${encodeURIComponent(path)}`, { next: { revalidate: 300 } });
}

export function createOrder(
  input: CreateOrderInput,
  idempotencyKey: string,
): Promise<{ order_id: number }> {
  return request("/orders", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(input),
  });
}

export function createCallback(input: CallbackInput): Promise<{ status: "accepted" }> {
  return request("/callbacks", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// Заявка с формы услуги: в tradesk уходит с типом («Шиномонтаж», «Хранение колёс»…),
// поэтому менеджер сразу видит, на что заявка. Обратный звонок типа не несёт.
export function createServiceRequest(input: RequestInput): Promise<{ status: "accepted" }> {
  return request("/requests", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
