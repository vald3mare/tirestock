// Сессия админки на стороне Next: токен лежит в httpOnly-куке домена витрины,
// на каждый серверный рендер валидируется в Go через adminMe. Клиентский JS токен
// не видит. Middleware делает лишь дешёвую проверку наличия куки (см. middleware.ts).

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminMe, type AdminUser } from "./api/admin";
import { ApiError } from "./api/client";
import { SESSION_COOKIE } from "./admin-cookie";

export { SESSION_COOKIE };

export async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

export async function setSessionCookie(token: string, expiresAt: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    expires: new Date(expiresAt),
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

// requireUser — гард серверных страниц админки: валидна ли сессия. При провале
// чистит куку и уводит на логин. Возвращает пользователя и токен для доп. запросов.
export async function requireUser(): Promise<{ user: AdminUser; token: string }> {
  const token = await getSessionToken();
  if (!token) redirect("/admin/login");
  try {
    const user = await adminMe(token);
    return { user, token };
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      await clearSessionCookie();
      redirect("/admin/login");
    }
    throw err;
  }
}
