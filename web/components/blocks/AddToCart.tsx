"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { CallbackModal } from "@/components/blocks/CallbackModal";
import { Stepper } from "@/components/ui/Stepper";
import { formatPrice } from "@/lib/format";
import { addToCart } from "@/app/(storefront)/cart/actions";

// Блок покупки на странице товара: степпер (дефолт 4 — шины покупают
// комплектами) + живая сумма комплекта + CTA. Кнопка — обычная form-кнопка:
// состав корзины пишется в куку server action'ом, клиентского стейта корзины нет.
// «Купить в 1 клик» — заявка в tradesk через outbox (переиспользуем CallbackModal);
// комментарий с товаром и ТЕКУЩИМ количеством (поле монтируется при открытии модалки).
export function AddToCart({
  slug,
  price,
  stock,
  name,
  sizeLabel,
}: {
  slug: string;
  price: number;
  stock: number;
  name: string;
  sizeLabel: string;
}) {
  const [qty, setQty] = useState(4);

  return (
    // CallbackModal НЕ внутри <form> (у него своя форма — вложенные формы невалидны).
    <div className="flex flex-col gap-4">
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
      <CallbackModal
        variant="button"
        triggerLabel="Купить в 1 клик"
        title="Купить в 1 клик"
        description={`Оставьте телефон — менеджер перезвонит, подтвердит наличие и оформит заказ на «${name}».`}
        defaultComment={`Купить в 1 клик: ${name}, ${sizeLabel}. Количество: ${qty} шт. Цена ${formatPrice(price)}/шт.`}
        submitLabel="Оформить заказ"
      />
    </div>
  );
}
