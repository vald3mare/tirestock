import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { CallbackModal } from "@/components/blocks/CallbackModal";
import { addToCart } from "@/app/(storefront)/cart/actions";
import { SeasonBadge } from "@/components/ui/SeasonBadge";
import { formatPrice } from "@/lib/format";
import { inquiryComment } from "@/lib/inquiry";

// ProductCard (264): фото-зона 232×172 (белый фон, contain, центр) + бейдж сезона,
// наличие (зелёная точка + 13 grey), название 16 SemiBold clamp-2 (резерв 45px),
// типоразмер 14 grey, цена 22 XB tabular-nums + «/ шт.», CTA на всю ширину.
// Тупой компонент: данные только пропсами.
// Оверрайды админки: badge_hit → синий пилл «Хит» (скрытые товары в каталог
// вообще не попадают — фильтруется в SQL). Состояние «нет в наличии» (stock<1):
// серый бейдж вместо зелёного, CTA отключён.

const PLACEHOLDER = "/images/tire-placeholder.png";

export function ProductCard({ product, imageSrc }: { product: Product; imageSrc?: string }) {
  // Фото из SelectTyres (product.image_url); плейсхолдер — если пусто или явно передан.
  const src = imageSrc ?? product.image_url ?? PLACEHOLDER;
  const inStock = product.stock > 0;
  return (
    <article className="flex w-full flex-col gap-2.5 rounded-card-lg border border-line bg-white p-3 sm:p-4">
      {/* Дубль ссылки с названием ниже — прячем от табуляции и скринридера */}
      <Link
        href={`/catalog/${product.slug}`}
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
        <span className="absolute left-2 top-2">
          <SeasonBadge season={product.season} spikes={product.spikes} />
        </span>
        {product.badge_hit && (
          <span className="absolute right-2 top-2 inline-flex items-center rounded-badge bg-blue px-2 py-1 text-legal font-semibold text-white">
            Хит
          </span>
        )}
      </Link>

      {inStock ? (
        <p className="flex items-center gap-1.5 text-caption text-grey">
          <span className="size-2 rounded-full bg-green" aria-hidden="true" />В наличии ·{" "}
          <span className="tnum">{product.stock}</span> шт.
        </p>
      ) : (
        <p className="flex items-center gap-1.5 text-caption text-grey">
          <span className="size-2 rounded-full bg-grey" aria-hidden="true" />
          Нет в наличии
        </p>
      )}

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

      {/* Дефолт 4 шт. — шины покупают комплектами; количество меняется в корзине.
          Нет в наличии — вместо заказа предлагаем уточнить наличие: заявка с
          товаром уходит в tradesk (обратный звонок), менеджер сообщит о поступлении. */}
      {inStock ? (
        <form action={addToCart}>
          <input type="hidden" name="slug" value={product.slug} />
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
          description={`Оставьте телефон — сообщим, когда «${product.brand} ${product.model}» появится, и подскажем аналоги.`}
          defaultComment={inquiryComment(product)}
          submitLabel="Уточнить"
        />
      )}
    </article>
  );
}
