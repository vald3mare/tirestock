"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Stepper } from "@/components/ui/Stepper";
import { formatPrice } from "@/lib/format";

// Блок покупки на странице товара: степпер (дефолт 4 — шины покупают
// комплектами) + живая сумма комплекта + CTA.
// TODO: корзина (cookie + серверное чтение) — кнопка пока без действия.
export function AddToCart({ price, stock }: { price: number; stock: number }) {
  const [qty, setQty] = useState(4);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <Stepper defaultValue={4} min={1} max={stock} onChange={setQty} />
        <p className="tnum text-body font-semibold text-dark">
          Комплект {qty} шт. — {formatPrice(price * qty)}
        </p>
      </div>
      <Button className="w-full">В корзину</Button>
    </div>
  );
}
