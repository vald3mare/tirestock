import Link from "next/link";
import type { Product } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { SeasonBadge } from "@/components/ui/SeasonBadge";
import { formatPrice } from "@/lib/format";

// ProductCard (264): фото-зона 232×172 (белый фон, contain, центр) + бейдж сезона,
// наличие (зелёная точка + 13 grey), название 16 SemiBold clamp-2 (резерв 45px),
// типоразмер 14 grey, цена 22 XB tabular-nums + «/ шт.», CTA на всю ширину.
// Тупой компонент: данные только пропсами.
// TODO: состояние «нет в наличии» (серый бейдж, disabled CTA) — дизайн в работе.

const PLACEHOLDER = "/images/tire-placeholder.png";

export function ProductCard({ product, imageSrc }: { product: Product; imageSrc?: string }) {
  // Фото из SelectTyres (product.image_url); плейсхолдер — если пусто или явно передан.
  const src = imageSrc ?? product.image_url ?? PLACEHOLDER;
  return (
    <article className="flex w-full flex-col gap-2.5 rounded-card-lg border border-line bg-white p-3 sm:p-4">
      {/* Дубль ссылки с названием ниже — прячем от табуляции и скринридера */}
      <Link
        href={`/catalog/${product.slug}`}
        tabIndex={-1}
        aria-hidden="true"
        className="relative block aspect-[58/43] w-full overflow-hidden rounded-card border border-line bg-white"
      >
        <img
          src={src || PLACEHOLDER}
          alt=""
          loading="lazy"
          className="absolute inset-0 size-full object-contain p-3"
        />
        <span className="absolute left-2 top-2">
          <SeasonBadge season={product.season} spikes={product.spikes} />
        </span>
      </Link>

      <p className="flex items-center gap-1.5 text-caption text-grey">
        <span className="size-2 rounded-full bg-green" aria-hidden="true" />В наличии ·{" "}
        <span className="tnum">{product.stock}</span> шт.
      </p>

      <Link
        href={`/catalog/${product.slug}`}
        className="line-clamp-2 min-h-card-title text-card-title text-dark hover:text-blue"
      >
        {product.brand} {product.model}
      </Link>

      <p className="text-caption-lg text-grey">{product.size_label}</p>

      <p className="flex items-baseline gap-1.5">
        <span className="tnum text-price text-black">{formatPrice(product.price)}</span>
        <span className="text-caption-lg text-grey">/ шт.</span>
      </p>

      {/* TODO: корзина — добавление с дефолтным количеством 4 (шины покупают комплектами) */}
      <Button size="sm" className="w-full">
        В корзину
      </Button>
    </article>
  );
}
