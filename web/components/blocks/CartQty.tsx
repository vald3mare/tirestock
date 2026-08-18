"use client";

import { useTransition } from "react";
import { Stepper } from "@/components/ui/Stepper";
import { setCartQty } from "@/app/(storefront)/cart/actions";

// Количество в строке корзины. Степпер клиентский (мгновенная реакция), но
// источник правды — кука на сервере: каждое изменение уходит server action'ом,
// после чего суммы пересчитываются серверным рендером.
export function CartQty({ slug, qty, max }: { slug: string; qty: number; max: number }) {
  const [pending, startTransition] = useTransition();

  return (
    <div aria-busy={pending}>
      <Stepper
        defaultValue={qty}
        min={1}
        max={max}
        onChange={(next) => {
          startTransition(() => {
            const fd = new FormData();
            fd.set("slug", slug);
            fd.set("qty", String(next));
            void setCartQty(fd);
          });
        }}
      />
    </div>
  );
}
