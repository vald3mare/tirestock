"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Stepper } from "@/components/ui/Stepper";
import { formatPrice } from "@/lib/format";
import { addToCart } from "@/app/(storefront)/cart/actions";

// Блок покупки на странице товара: степпер (дефолт 4 — шины покупают
// комплектами) + живая сумма комплекта + CTA. Кнопка — обычная form-кнопка:
// состав корзины пишется в куку server action'ом, клиентского стейта корзины нет.
export function AddToCart({ slug, price, stock }: { slug: string; price: number; stock: number }) {
  const [qty, setQty] = useState(4);

  return (
    <form action={addToCart} className="flex flex-col gap-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="qty" value={qty} />
      <div className="flex items-center gap-4">
        <Stepper defaultValue={4} min={1} max={stock} onChange={setQty} />
        <p className="tnum text-body font-semibold text-dark">
          Комплект {qty} шт. — {formatPrice(price * qty)}
        </p>
      </div>
      <Button type="submit" className="w-full" disabled={stock < 1}>
        {stock < 1 ? "Нет в наличии" : "В корзину"}
      </Button>
    </form>
  );
}
