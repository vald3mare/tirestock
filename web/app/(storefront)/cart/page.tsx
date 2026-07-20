import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/blocks/Breadcrumbs";
import { Button } from "@/components/ui/Button";
import { Stepper } from "@/components/ui/Stepper";
import { listProducts, type Product } from "@/lib/api/client";
import { formatNumber, formatPrice, seasonLabel } from "@/lib/format";

// Корзина (Figma → «Корзина», 37:261): список позиций 824 + саммари 264.
// TODO: настоящая корзина — cookie + серверное чтение (конвенция Next-3),
//       пересчёт сумм при изменении количества, удаление с undo-снекбаром,
//       «Оформить заказ» → POST /orders (бэкенд готов). Пока демо-состав
//       из первых двух товаров каталога.

export const metadata: Metadata = {
  title: "Корзина | TireStock",
  robots: { index: false, follow: false },
};

const DEMO_QTY = 4;

export default async function CartPage() {
  let items: Product[] = [];
  try {
    items = (await listProducts({ per_page: 2 })).items;
  } catch {
    // api недоступен — покажем пустую корзину
  }

  const totalQty = items.length * DEMO_QTY;
  const totalSum = items.reduce((sum, p) => sum + p.price * DEMO_QTY, 0);

  return (
    <main id="main" className="mx-auto max-w-content px-4 pb-20">
      <Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: "Корзина" }]} />

      <h1 className="mt-6 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-h2 text-black lg:text-h1">
        Корзина
        {items.length > 0 && (
          <span className="tnum text-field text-grey">
            {items.length} товара · {totalQty} шт.
          </span>
        )}
      </h1>

      {items.length === 0 ? (
        <div className="mt-8 flex flex-col items-start gap-4 rounded-container bg-light p-10">
          <p className="text-h2 text-black">Корзина пуста</p>
          <Link href="/catalog" className="text-nav text-blue hover:underline">
            Перейти в каталог →
          </Link>
        </div>
      ) : (
        <div className="mt-8 flex flex-col items-stretch gap-6 lg:flex-row lg:items-start lg:gap-4">
          <ul className="flex flex-1 flex-col gap-4">
            {items.map((p) => (
              <li
                key={p.slug}
                className="flex flex-wrap items-center gap-3 rounded-card-lg border border-line bg-white p-4 sm:gap-4"
              >
                <Link
                  href={`/catalog/${p.slug}`}
                  tabIndex={-1}
                  aria-hidden="true"
                  className="relative block size-20 shrink-0 overflow-hidden rounded-field border border-line bg-white"
                >
                  <img
                    src="/images/tire-placeholder.png"
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 size-full object-contain p-1.5"
                  />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <Link href={`/catalog/${p.slug}`} className="text-card-title text-dark hover:text-blue">
                    {p.brand} {p.model}
                  </Link>
                  <p className="text-caption text-grey">
                    {p.size_label} · {seasonLabel[p.season]}
                  </p>
                  <p className="tnum text-caption text-grey">{formatPrice(p.price)} / шт.</p>
                </div>
                <Stepper defaultValue={DEMO_QTY} max={p.stock} />
                <p className="tnum ml-auto text-right text-price text-black lg:ml-0 lg:w-27">
                  {formatPrice(p.price * DEMO_QTY)}
                </p>
                {/* TODO: удаление с undo-снекбаром, не мгновенно и не confirm() */}
                <button
                  type="button"
                  aria-label={`Убрать ${p.name} из корзины`}
                  className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-field hover:bg-light"
                >
                  <img src="/icons/close.svg" alt="" width={20} height={20} className="size-5" />
                </button>
              </li>
            ))}
          </ul>

          <aside aria-label="Итог заказа" className="w-full shrink-0 lg:w-col">
            <div className="flex flex-col gap-3 rounded-container bg-light px-5 py-6">
              <p className="text-service text-dark">Ваш заказ</p>
              <div className="flex items-center justify-between text-caption-lg">
                <span className="tnum text-grey">Товары, {formatNumber(totalQty)} шт.</span>
                <span className="tnum font-semibold text-dark">{formatPrice(totalSum)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-caption-lg text-grey">Доставка</span>
                <span className="text-caption text-grey">при оформлении</span>
              </div>
              <div className="h-px w-full bg-line" role="presentation" />
              <div className="flex items-baseline justify-between">
                <span className="text-field font-semibold text-dark">Итого</span>
                <span className="tnum text-price text-black">{formatPrice(totalSum)}</span>
              </div>
              {/* TODO: checkout — макета ещё нет (см. TODO дизайна в DESIGN_SYSTEM.md) */}
              <Button className="w-full px-5">Оформить заказ</Button>
              <p className="text-legal text-grey">
                Оплата при получении, переводом или электронными деньгами
              </p>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
