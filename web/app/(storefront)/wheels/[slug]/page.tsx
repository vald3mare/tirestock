import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Breadcrumbs } from "@/components/blocks/Breadcrumbs";
import { Button } from "@/components/ui/Button";
import { CallbackModal } from "@/components/blocks/CallbackModal";
import { addToCart } from "@/app/(storefront)/cart/actions";
import { ApiError, getWheelBySlug, type Wheel } from "@/lib/api/client";
import { CITIES } from "@/lib/city";
import { formatPrice } from "@/lib/format";
import { getCity } from "@/lib/get-city";

// Карточка диска. Отдельный тип товара: атрибуты диска (сверловка, вылет, ЦО, цвет).

type Params = { slug: string };

const loadWheel = cache(async (slug: string, city: string): Promise<Wheel | null> => {
  try {
    return await getWheelBySlug(slug, city);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
});

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const city = await getCity();
  const w = await loadWheel((await params).slug, city);
  if (!w) return { title: "Диск не найден | TireStock" };
  return {
    title: `${w.name} — купить в ${CITIES[city].loc} | TireStock`,
    description: `Диск ${w.name}: в наличии ${w.stock} шт., цена ${formatPrice(w.price)}/шт. Доставка по России.`,
  };
}

export default async function WheelPage({ params }: { params: Promise<Params> }) {
  const city = await getCity();
  const w = await loadWheel((await params).slug, city);
  if (!w) notFound();

  const inStock = w.stock > 0;
  const specs: [string, string][] = [
    ["Производитель", w.brand],
    ["Модель", w.model],
    ["Диаметр", `R${w.diameter}`],
    ["Ширина обода", `${w.width}″`],
    ["Сверловка (PCD)", w.pcd || "—"],
    ["Вылет (ET)", w.et ? String(w.et) : "—"],
    ["Ступичное отверстие (DIA)", w.dia ? `${w.dia} мм` : "—"],
    ["Тип", w.wheel_type || "—"],
    ["Цвет", w.color || "—"],
  ];

  return (
    <main id="main" className="mx-auto max-w-content px-4 pb-20">
      <Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: "Диски", href: "/wheels/" }, { label: w.name }]} />

      <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:gap-12">
        <div className="relative aspect-[58/43] w-full max-w-140 shrink-0 overflow-hidden rounded-card-lg border border-line bg-white p-6 lg:w-1/2">
          <div className="relative size-full">
            <Image src={w.image_url || "/images/tire-placeholder.png"} alt={w.name} fill
              sizes="(max-width: 1024px) 100vw, 544px" className="object-contain" />
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-4">
          <h1 className="text-h2 text-black lg:text-h1">{w.brand} {w.model}</h1>
          <p className="text-body text-grey">{w.name}</p>

          {inStock ? (
            <p className="flex items-center gap-1.5 text-caption-lg text-grey">
              <span className="size-2 rounded-full bg-green" aria-hidden="true" />
              В наличии · <span className="tnum">{w.stock}</span> шт.
            </p>
          ) : (
            <p className="flex items-center gap-1.5 text-caption-lg text-grey">
              <span className="size-2 rounded-full bg-grey" aria-hidden="true" />Нет в наличии
            </p>
          )}

          <p className="flex items-baseline gap-2">
            <span className="tnum text-h2 text-black">{formatPrice(w.price)}</span>
            <span className="text-body text-grey">/ шт.</span>
          </p>

          {inStock ? (
            <form action={addToCart} className="max-w-100">
              <input type="hidden" name="slug" value={w.slug} />
              <input type="hidden" name="qty" value={4} />
              <Button type="submit" className="w-full">В корзину · комплект 4 шт.</Button>
            </form>
          ) : (
            <CallbackModal variant="button" triggerLabel="Уточнить при наличии" title="Уточнить наличие"
              description={`Оставьте телефон — сообщим, когда диск «${w.brand} ${w.model}» появится.`}
              defaultComment={`Диск ${w.name} (${w.code})`} submitLabel="Уточнить" />
          )}
        </div>
      </div>

      <section aria-labelledby="specs-h" className="mt-16 max-w-180">
        <h2 id="specs-h" className="text-h2 text-black">Характеристики</h2>
        <dl className="mt-2">
          {specs.map(([label, value]) => (
            <div key={label} className="flex items-baseline border-b border-line py-3">
              <dt className="w-1/2 shrink-0 text-body text-grey sm:w-col">{label}</dt>
              <dd className="pl-4 text-body text-dark">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
