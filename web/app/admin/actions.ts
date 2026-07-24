"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  adminCreatePage,
  adminDeletePage,
  adminLogin,
  adminLogout,
  adminPublishPage,
  adminRenamePage,
  adminRetryOrder,
  adminSetOverride,
  adminUpdatePage,
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

// ── Контентные страницы ─────────────────────────────────────────────────────

export async function createPageAction(formData: FormData) {
  const token = await getSessionToken();
  if (!token) redirect("/admin/login");
  const slug = String(formData.get("slug") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  if (!slug || !title) redirect("/admin/pages/new?error=empty");

  let id: number;
  try {
    const page = await adminCreatePage(token, slug, title);
    id = page.id;
  } catch (err) {
    if (err instanceof ApiError && (err.status === 400 || err.status === 409)) {
      redirect(`/admin/pages/new?error=${err.status === 409 ? "taken" : "slug"}`);
    }
    throw err;
  }
  revalidatePath("/admin/pages");
  redirect(`/admin/pages/${id}`);
}

export async function updatePageAction(formData: FormData) {
  const token = await getSessionToken();
  if (!token) redirect("/admin/login");
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return;

  await adminUpdatePage(token, id, {
    title: String(formData.get("title") ?? "").trim(),
    body: String(formData.get("body") ?? ""),
    meta_title: String(formData.get("meta_title") ?? "").trim(),
    meta_description: String(formData.get("meta_description") ?? "").trim(),
  });
  // Черновик может менять URL — поле slug присутствует только для незалоченных.
  const slug = formData.get("slug");
  if (typeof slug === "string" && slug.trim()) {
    try {
      await adminRenamePage(token, id, slug.trim());
    } catch (err) {
      if (!(err instanceof ApiError)) throw err; // 403/409 — молча (URL остался прежним)
    }
  }
  revalidatePath(`/admin/pages/${id}`);
  revalidatePath("/admin/pages");
}

export async function publishPageAction(formData: FormData) {
  const token = await getSessionToken();
  if (!token) redirect("/admin/login");
  const id = Number(formData.get("id"));
  const published = formData.get("published") === "true";
  if (!Number.isFinite(id)) return;
  await adminPublishPage(token, id, published);
  revalidatePath(`/admin/pages/${id}`);
  revalidatePath("/admin/pages");
}

export async function deletePageAction(formData: FormData) {
  const token = await getSessionToken();
  if (!token) redirect("/admin/login");
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return;
  await adminDeletePage(token, id);
  revalidatePath("/admin/pages");
  redirect("/admin/pages");
}
