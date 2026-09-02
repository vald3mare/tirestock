import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { cache } from "react";
import { AddToCart } from "@/components/blocks/AddToCart";
import { Breadcrumbs } from "@/components/blocks/Breadcrumbs";
import { CallbackModal } from "@/components/blocks/CallbackModal";
import { ProductCard } from "@/components/blocks/ProductCard";
import { SeasonBadge } from "@/components/ui/SeasonBadge";
import { ApiError, getProductBySlug, listProducts, type Product } from "@/lib/api/client";
import { inquiryComment } from "@/lib/inquiry";
import { CITIES } from "@/lib/city";
import { getCity } from "@/lib/get-city";
import { SHOP } from "@/lib/shop";
import { formatNumber, formatPrice, seasonLabel } from "@/lib/format";
import { parseTireIndices } from "@/lib/tire-indices";

// Страница товара (Figma → «Товар», 36:188). Товар = отдельный URL.
// Фото 544×440 + инфо-колонка 528; характеристики и описание шириной 720.
// TODO: SEO-мета и описания из админки; фото из SelectTyres (пока плейсхолдер).

type Params = { slug: string };

// React.cache: generateMetadata и страница делят один запрос к api в рамках
// одного рендера (иначе товар грузился бы дважды). Ключ кэша — (slug, city):
// мультигород, у товара разная цена/наличие по городам; нет оффера → 404.
const loadProduct = cache(async (slug: string, city: string): Promise<Product | null> => {
  try {
    return await getProductBySlug(slug, city);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
});

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const city = await getCity();
  const product = await loadProduct((await params).slug, city);
  if (!product) return { title: "Товар не найден | TireStock" };
  const loc = CITIES[city].loc;
  return {
    title: `${product.name} — купить в ${loc} | TireStock`,
    description: `${seasonLabel[product.season]} шины ${product.name}: в наличии ${product.stock} шт., цена ${formatPrice(product.price)}/шт. Доставка по ${loc} и России.`,
  };
}

export default async function ProductPage({ params }: { params: Promise<Params> }) {
  const city = await getCity();
  const product = await loadProduct((await params).slug, city);
  if (!product) notFound();

  const related = (await listProducts({ season: product.season, per_page: 5, city })).items
    .filter((p) => p.slug !== product.slug)
    .slice(0, 4);

  const indices = parseTireIndices(product.size_label);
  const specs: [string, string][] = [
    ["Производитель", product.brand],
    ["Модель", product.model],
    ["Сезонность", seasonLabel[product.season]],
    ["Ширина профиля", `${product.width} мм`],
    ["Высота профиля", `${product.profile}%`],
    ["Диаметр", `R${product.diameter}`],
    ...(indices
      ? ([
          ["Индекс нагрузки", indices.load],
          ["Индекс скорости", indices.speed],
        ] as [string, string][])
      : []),
    ["Шипы", product.spikes ? "Да" : "Нет"],
    ["RunFlat", product.runflat ? "Да" : "Нет"],
  ];

  return (
    <main id="main" className="mx-auto max-w-content px-4 pb-20">
      <Breadcrumbs
        items={[
          { label: "Главная", href: "/" },
          { label: "Шины", href: "/catalog" },
          { label: product.name },
        ]}
      />

      <div className="mt-8 flex flex-col items-stretch gap-6 lg:flex-row lg:items-start lg:gap-8">
        <div className="relative aspect-[136/110] w-full shrink-0 rounded-card-lg border border-line bg-white p-10 lg:h-110 lg:w-136">
          <div className="relative size-full">
            <Image
              src={product.image_url || "/images/tire-placeholder.png"}
              alt={product.name}
              fill
              sizes="(max-width: 1024px) 100vw, 544px"
              priority
              className="object-contain"
            />
          </div>
          <span className="absolute left-4 top-4">
            <SeasonBadge season={product.season} spikes={product.spikes} />
          </span>
          {product.badge_hit && (
            <span className="absolute right-4 top-4 inline-flex items-center rounded-badge bg-blue px-2.5 py-1 text-caption font-semibold text-white">
              Хит
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-4">
          <h1 className="text-service-lg font-extrabold text-black lg:text-h2">{product.name}</h1>
          <p className="text-field text-grey">
            {product.size_label} · {seasonLabel[product.season]}
          </p>
          {product.stock > 0 ? (
            <p className="flex items-center gap-1.5 text-caption-lg text-grey">
              <span className="size-2 rounded-full bg-green" aria-hidden="true" />В наличии ·{" "}
              <span className="tnum">{formatNumber(product.stock)}</span> шт.
            </p>
          ) : (
            <p className="flex items-center gap-1.5 text-caption-lg text-grey">
              <span className="size-2 rounded-full bg-grey" aria-hidden="true" />
              Нет в наличии
            </p>
          )}
          <p className="flex items-baseline gap-2">
            <span className="tnum text-price-xl text-black">{formatPrice(product.price)}</span>
            <span className="text-field text-grey">/ шт.</span>
          </p>

          {product.stock > 0 ? (
            <AddToCart slug={product.slug} price={product.price} stock={product.stock} />
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

          <div className="flex flex-col gap-2 rounded-card bg-light px-4 py-3.5">
            <p className="text-caption-lg font-semibold text-dark">Доставка и самовывоз</p>
            <p className="text-caption text-grey">
              Доставка по {SHOP.city} — 500 ₽, бесплатно от 30 000 ₽. До пункта выдачи
              ПЭК — бесплатно.
            </p>
            <p className="text-caption text-grey">Самовывоз со склада — сегодня</p>
          </div>
        </div>
      </div>

      <section aria-labelledby="specs-h" className="mt-16 max-w-180">
        <h2 id="specs-h" className="text-h2 text-black">
          Характеристики
        </h2>
        <dl className="mt-2">
          {specs.map(([label, value]) => (
            <div key={label} className="flex items-baseline border-b border-line py-3">
              <dt className="w-1/2 shrink-0 text-body text-grey sm:w-col">{label}</dt>
              <dd className="pl-4 text-body text-dark">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="desc-h" className="mt-12 max-w-180">
        <h2 id="desc-h" className="text-h2 text-black">
          Описание
        </h2>
        {/* TODO: реальные описания придут из админки/SelectTyres */}
        <p className="mt-4 text-body text-dark">
          {seasonLabel[product.season]} шины {product.name} предназначены для легковых
          автомобилей. Размер {product.size_label}
          {product.spikes ? ", шипованные" : ""}
          {product.runflat ? ", с технологией RunFlat" : ""}. Рисунок протектора обеспечивает
          эффективный отвод воды из пятна контакта и уверенное сцепление с дорогой.
        </p>
      </section>

      {related.length > 0 && (
        <section aria-labelledby="related-h" className="mt-16">
          <h2 id="related-h" className="text-h2 text-black">
            Похожие товары
          </h2>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
