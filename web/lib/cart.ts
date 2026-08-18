import { cookies } from "next/headers";

// Корзина живёт в куке: сервер читает её при рендере, клиентского стейта нет
// (конвенция проекта — server-first). В куке храним ТОЛЬКО slug и количество:
// цена и наличие берутся из каталога при каждом рендере, иначе корзина покажет
// вчерашнюю цену. Кука httpOnly не нужна — данные не секретные, но и клиентский
// JS её не читает: все изменения идут через server actions.

export const CART_COOKIE = "cart";
export const CART_MAX_ITEMS = 30;

export type CartLine = { slug: string; qty: number };

const COOKIE_OPTS = {
  path: "/",
  maxAge: 60 * 60 * 24 * 30, // 30 дней — сезонный подбор шин растягивается на недели
  sameSite: "lax" as const,
};

function parse(raw: string | undefined): CartLine[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .filter(
        (l): l is CartLine =>
          typeof l === "object" &&
          l !== null &&
          typeof (l as CartLine).slug === "string" &&
          Number.isFinite((l as CartLine).qty),
      )
      .map((l) => ({ slug: l.slug, qty: Math.max(1, Math.min(999, Math.trunc(l.qty))) }))
      .slice(0, CART_MAX_ITEMS);
  } catch {
    return [];
  }
}

/** Читает корзину из куки (серверный рендер и server actions). */
export async function readCart(): Promise<CartLine[]> {
  return parse((await cookies()).get(CART_COOKIE)?.value);
}

/** Пишет корзину в куку. Пустая корзина — кука удаляется. */
export async function writeCart(lines: CartLine[]): Promise<void> {
  const store = await cookies();
  if (lines.length === 0) {
    store.delete(CART_COOKIE);
    return;
  }
  store.set(CART_COOKIE, JSON.stringify(lines.slice(0, CART_MAX_ITEMS)), COOKIE_OPTS);
}

/** Суммарное количество штук — для счётчика на кнопке «Корзина». */
export function cartCount(lines: CartLine[]): number {
  return lines.reduce((n, l) => n + l.qty, 0);
}
