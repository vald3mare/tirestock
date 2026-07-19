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
export type ErrorBody = components["schemas"]["ErrorBody"];

// Фильтры каталога = query-параметры URL витрины (имена совпадают 1:1).
export type ProductFilters = {
  width?: number;
  profile?: number;
  diameter?: number;
  season?: Season;
  brand?: string;
  price_min?: number;
  price_max?: number;
  spikes?: boolean;
  runflat?: boolean;
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

export function getProductBySlug(slug: string): Promise<Product> {
  return request(`/products/${encodeURIComponent(slug)}`);
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
