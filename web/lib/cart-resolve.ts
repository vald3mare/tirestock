import { ApiError, getProductBySlug, getWheelBySlug } from "@/lib/api/client";
import { seasonLabel } from "@/lib/format";
import { wheelSize } from "@/components/blocks/WheelCard";

// Позиция корзины в едином виде — корзина хранит только slug, а товар может быть
// шиной ИЛИ диском (разные каталоги). Резолвер по slug пробует шину, затем диск.
export type CartItem = {
  slug: string;
  code: string;
  name: string;
  title: string; // «Бренд Модель»
  subtitle: string; // типоразмер + сезон (шина) / размер обода (диск)
  price: number;
  stock: number;
  image_url: string;
  kind: "tire" | "wheel";
};

// resolveCartItem: null, если товар не найден ни в шинах, ни в дисках (снят/закончился).
export async function resolveCartItem(slug: string, city: string): Promise<CartItem | null> {
  try {
    const p = await getProductBySlug(slug, city);
    return {
      slug: p.slug, code: p.code ?? "", name: p.name,
      title: `${p.brand} ${p.model}`,
      subtitle: `${p.size_label} · ${seasonLabel[p.season]}`,
      price: p.price, stock: p.stock, image_url: p.image_url ?? "", kind: "tire",
    };
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 404) throw e;
  }
  try {
    const w = await getWheelBySlug(slug, city);
    return {
      slug: w.slug, code: w.code, name: w.name,
      title: `${w.brand} ${w.model}`,
      subtitle: wheelSize(w),
      price: w.price, stock: w.stock, image_url: w.image_url, kind: "wheel",
    };
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}
