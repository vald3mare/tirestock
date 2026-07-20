"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  adminLogin,
  adminLogout,
  adminRetryOrder,
  adminSetOverride,
} from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import {
  clearSessionCookie,
  getSessionToken,
  setSessionCookie,
} from "@/lib/admin-session";

export async function loginAction(formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!username || !password) redirect("/admin/login?error=empty");

  try {
    const res = await adminLogin(username, password);
    await setSessionCookie(res.token, res.expires_at);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 400)) {
      redirect("/admin/login?error=1");
    }
    throw err;
  }
  redirect("/admin");
}

export async function logoutAction() {
  const token = await getSessionToken();
  if (token) {
    try {
      await adminLogout(token);
    } catch {
      // сессия уже недействительна — всё равно чистим куку
    }
  }
  await clearSessionCookie();
  redirect("/admin/login");
}

export async function retryOrderAction(formData: FormData) {
  const id = Number(formData.get("id"));
  const token = await getSessionToken();
  if (token && Number.isFinite(id)) {
    await adminRetryOrder(token, id);
    revalidatePath("/admin");
  }
}

export async function setOverrideAction(
  slug: string,
  patch: { hidden: boolean; badge_hit: boolean },
) {
  const token = await getSessionToken();
  if (!token) return;
  await adminSetOverride(token, slug, patch);
  revalidatePath("/admin/products");
}
