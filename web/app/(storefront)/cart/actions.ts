"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CART_MAX_ITEMS, readCart, writeCart, type CartLine } from "@/lib/cart";
import { createOrder, getProductBySlug } from "@/lib/api/client";

// Все изменения корзины — server actions поверх куки. Клиентского стейта нет,
// после каждого действия страница перерисовывается сервером.

export async function addToCart(formData: FormData) {
  const slug = String(formData.get("slug") ?? "").trim();
  const qty = Math.max(1, Math.trunc(Number(formData.get("qty") ?? 4)));
  if (!slug) return;

  const lines = await readCart();
  const existing = lines.find((l) => l.slug === slug);
  if (existing) {
    existing.qty += qty; // добавили тот же товар ещё раз — суммируем, а не затираем
  } else {
    if (lines.length >= CART_MAX_ITEMS) return;
    lines.push({ slug, qty });
  }
  await writeCart(lines);
  revalidatePath("/cart");
  redirect("/cart");
}

export async function setCartQty(formData: FormData) {
  const slug = String(formData.get("slug") ?? "").trim();
  const qty = Math.trunc(Number(formData.get("qty") ?? 0));
  const lines = await readCart();
  const next: CartLine[] =
    qty < 1
      ? lines.filter((l) => l.slug !== slug)
      : lines.map((l) => (l.slug === slug ? { ...l, qty } : l));
  await writeCart(next);
  revalidatePath("/cart");
}

// Удаление не мгновенное «навсегда»: убираем позицию, но возвращаем её состав
// в query — страница показывает снекбар «Вернуть» (правило: undo вместо confirm).
export async function removeFromCart(formData: FormData) {
  const slug = String(formData.get("slug") ?? "").trim();
  const lines = await readCart();
  const removed = lines.find((l) => l.slug === slug);
  await writeCart(lines.filter((l) => l.slug !== slug));
  revalidatePath("/cart");
  if (removed) {
    redirect(`/cart?undo=${encodeURIComponent(removed.slug)}&qty=${removed.qty}`);
  }
  redirect("/cart");
}

export async function undoRemove(formData: FormData) {
  const slug = String(formData.get("slug") ?? "").trim();
  const qty = Math.max(1, Math.trunc(Number(formData.get("qty") ?? 4)));
  if (slug) {
    const lines = await readCart();
    if (!lines.some((l) => l.slug === slug) && lines.length < CART_MAX_ITEMS) {
      lines.push({ slug, qty });
      await writeCart(lines);
    }
  }
  revalidatePath("/cart");
  redirect("/cart");
}

// Оформление: собираем позиции из каталога (цена и код — с сервера, не с клиента),
// пишем заказ через API. Дальше он живёт в outbox и уезжает в tradesk воркером,
// поэтому заказ не теряется, даже если учётка недоступна.
export async function submitOrder(formData: FormData) {
  const customerName = String(formData.get("customer_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const comment = String(formData.get("comment") ?? "").trim();
  if (!phone) redirect("/cart?error=phone#checkout");
  if (!customerName) redirect("/cart?error=name#checkout");

  const lines = await readCart();
  if (lines.length === 0) redirect("/cart");

  const items = [];
  for (const line of lines) {
    try {
      const p = await getProductBySlug(line.slug);
      items.push({
        slug: p.slug,
        code: p.code,
        name: p.name,
        price: p.price,
        qty: line.qty,
      });
    } catch {
      // товар пропал из каталога (закончился/снят) — пропускаем позицию,
      // остальной заказ должен уйти
    }
  }
  if (items.length === 0) redirect("/cart?error=empty");

  // Ключ идемпотентности защищает от ДАБЛКЛИКА: он рождается вместе с формой
  // (скрытое поле, см. cart/page.tsx), поэтому две отправки одной и той же
  // отрисованной формы дадут один заказ, а новый заказ теми же шинами на тот же
  // телефон — уже другой ключ и, значит, отдельный заказ.
  // НЕ выводить ключ из телефона и состава: клиент вправе повторить покупку.
  const idempotencyKey = String(formData.get("idempotency_key") ?? "").trim() || randomUUID();

  let orderID: number;
  try {
    const res = await createOrder({ customer_name: customerName, phone, comment, items }, idempotencyKey);
    orderID = res.order_id;
  } catch {
    redirect("/cart?error=api#checkout");
  }

  await writeCart([]);
  revalidatePath("/cart");
  redirect(`/cart?ordered=${orderID}`);
}
