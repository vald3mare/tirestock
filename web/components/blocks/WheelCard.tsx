import Image from "next/image";
import Link from "next/link";
import type { Wheel } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { CallbackModal } from "@/components/blocks/CallbackModal";
import { addToCart } from "@/app/(storefront)/cart/actions";
import { formatPrice } from "@/lib/format";

// WheelCard — карточка диска (зеркалит ProductCard, но со своими атрибутами:
// размер обода, сверловка PCD, вылет ET). Диски покупают комплектами → дефолт 4 шт.

const PLACEHOLDER = "/images/tire-placeholder.png";

// Краткий размер диска: «6.5×16 5×112 ET50».
export function wheelSize(w: Wheel): string {
  const parts = [`${w.width}×${w.diameter}`];
  if (w.pcd) parts.push(w.pcd);
  if (w.et) parts.push(`ET${w.et}`);
  return parts.join(" ");
}

export function WheelCard({ wheel }: { wheel: Wheel }) {
  const src = wheel.image_url || PLACEHOLDER;
  const inStock = wheel.stock > 0;
  return (
    <article className="flex w-full flex-col gap-2.5 rounded-card-lg border border-line bg-white p-3 sm:p-4">
      <Link
        href={`/wheels/${wheel.slug}`}
        tabIndex={-1}
        aria-hidden="true"
        className="relative block aspect-[58/43] w-full overflow-hidden rounded-card border border-line bg-white p-3 transition-transform duration-200 ease-out hover:scale-[1.02] motion-reduce:transition-none motion-reduce:hover:scale-100"
      >
        <div className="relative size-full">
          <Image
            src={src || PLACEHOLDER}
            alt=""
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 264px"
            className="object-contain"
          />
        </div>
        {wheel.wheel_type && (
          <span className="absolute left-2 top-2 inline-flex items-center rounded-badge bg-light px-2 py-1 text-legal font-medium text-grey">
            {wheel.wheel_type}
          </span>
        )}
      </Link>

      {inStock ? (
        <p className="flex items-center gap-1.5 text-caption text-grey">
          <span className="size-2 rounded-full bg-green" aria-hidden="true" />В наличии ·{" "}
          <span className="tnum">{wheel.stock}</span> шт.
        </p>
      ) : (
        <p className="flex items-center gap-1.5 text-caption text-grey">
          <span className="size-2 rounded-full bg-grey" aria-hidden="true" />
          Нет в наличии
        </p>
      )}

      <Link
        href={`/wheels/${wheel.slug}`}
        className="line-clamp-2 min-h-card-title text-card-title text-dark hover:text-blue"
      >
        {wheel.brand} {wheel.model}
      </Link>

      <p className="text-caption-lg text-grey">{wheelSize(wheel)}</p>

      <p className="flex items-baseline gap-1.5">
        <span className="tnum text-price text-black">{formatPrice(wheel.price)}</span>
        <span className="text-caption-lg text-grey">/ шт.</span>
      </p>

      {inStock ? (
        <form action={addToCart}>
          <input type="hidden" name="slug" value={wheel.slug} />
          <input type="hidden" name="qty" value={4} />
          <Button type="submit" size="sm" className="w-full">
            В корзину
          </Button>
        </form>
      ) : (
        <CallbackModal
          variant="button"
          triggerLabel="Уточнить при наличии"
          title="Уточнить наличие"
          description={`Оставьте телефон — сообщим, когда диск «${wheel.brand} ${wheel.model}» появится.`}
          defaultComment={`Диск ${wheel.name} (${wheel.code})`}
          submitLabel="Уточнить"
        />
      )}
    </article>
  );
}
