// Типизированный клиент админского API. Серверный (токен сессии — из httpOnly-куки,
// уходит в Go заголовком Authorization: Bearer). Данные ходят только через этот модуль
// (CONVENTIONS.md → Next.js-2). Контракт — api/openapi.yaml (раздел admin).

import { ApiError } from "./client";

const API_URL = process.env.API_URL ?? "http://localhost:8080";

export type AdminUser = { id: number; username: string; display_name: string };

export type DeliveryStatus = "pending" | "delivered" | "failed";

export type AdminOrderRow = {
  id: number;
  customer_name: string;
  phone: string;
  total: number;
  created_at: string;
  delivery_status: DeliveryStatus;
  attempts: number;
  last_error: string;
};

export type AdminOrderStats = { today: number; queued: number; failed: number };
export type AdminOrdersPage = { items: AdminOrderRow[]; stats: AdminOrderStats };

export type AdminProduct = {
  slug: string;
  name: string;
  price: number;
  stock: number;
  hidden: boolean;
  badge_hit: boolean;
};

type ErrorShape = { error?: { code?: string; message?: string } };

async function request<T>(path: string, token: string | null, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (init?.headers) Object.assign(headers, init.headers);
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/api/v1${path}`, { ...init, headers, cache: "no-store" });
  if (!res.ok) {
    let code = "unknown";
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as ErrorShape;
      code = body.error?.code ?? code;
      message = body.error?.message ?? message;
    } catch {
      // тело не JSON
    }
    throw new ApiError(res.status, code, message);
  }
  return (await res.json()) as T;
}

export type LoginResult = { token: string; expires_at: string; user: AdminUser };

export function adminLogin(username: string, password: string): Promise<LoginResult> {
  return request("/admin/login", null, {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function adminMe(token: string): Promise<AdminUser> {
  return request("/admin/me", token);
}

export function adminLogout(token: string): Promise<{ status: string }> {
  return request("/admin/logout", token, { method: "POST" });
}

export function adminOrders(
  token: string,
  opts: { status?: string; page?: number } = {},
): Promise<AdminOrdersPage> {
  const qs = new URLSearchParams();
  if (opts.status) qs.set("status", opts.status);
  if (opts.page) qs.set("page", String(opts.page));
  const query = qs.size > 0 ? `?${qs}` : "";
  return request(`/admin/orders${query}`, token);
}

export function adminRetryOrder(token: string, id: number): Promise<{ status: string }> {
  return request(`/admin/orders/${id}/retry`, token, { method: "POST" });
}

export function adminProducts(token: string, q?: string): Promise<{ items: AdminProduct[] }> {
  const query = q ? `?q=${encodeURIComponent(q)}` : "";
  return request(`/admin/products${query}`, token);
}

export function adminSetOverride(
  token: string,
  slug: string,
  patch: { hidden: boolean; badge_hit: boolean },
): Promise<{ status: string }> {
  return request(`/admin/products/${encodeURIComponent(slug)}/override`, token, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}
