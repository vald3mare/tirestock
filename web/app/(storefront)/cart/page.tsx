import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/blocks/Breadcrumbs";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { CartQty } from "@/components/blocks/CartQty";
import { CheckoutFulfilment } from "@/components/blocks/CheckoutFulfilment";
import { listPickupPoints } from "@/lib/api/client";
import { resolveCartItem, type CartItem } from "@/lib/cart-resolve";
import { formatNumber, formatPrice, seasonLabel } from "@/lib/format";
import { readCart } from "@/lib/cart";
import { CITIES } from "@/lib/city";
import { getCity } from "@/lib/get-city";
import { fallbackPickupPoints } from "@/lib/pickup-points";
import { removeFromCart, submitOrder, undoRemove } from "./actions";

// Корзина (Figma → «Корзина», 37:261): список позиций 824 + саммари 264.
// Состав живёт в куке (lib/cart.ts), цена и наличие подтягиваются из каталога
// при каждом рендере — корзина не показывает вчерашнюю цену.
// Оформление: имя + телефон → POST /orders → outbox → tradesk (заказ не теряется).

export const metadata: Metadata = {
  title: "Корзина | TireStock",
  robots: { index: false, follow: false },
};

type Line = { item: CartItem; qty: number };

export default async function CartPage({
  searchParams,
}: {
  searchParams: Promise<{ undo?: string; qty?: string; ordered?: string; error?: string }>;
}) {
  const { undo, qty: undoQty, ordered, error } = await searchParams;
  const city = await getCity();
  const cart = await readCart();

  const lines: Line[] = [];
  for (const line of cart) {
    const item = await resolveCartItem(line.slug, city).catch(() => null);
    if (item) lines.push({ item, qty: line.qty }); // товар снят/закончился — не показываем
  }

  // Пункты выдачи города для выбора способа получения (фолбэк на статику СПб).
  const points = await listPickupPoints(city)
    .then((r) => (r.items.length ? r.items : city === "spb" ? fallbackPickupPoints : []))
    .catch(() => (city === "spb" ? fallbackPickupPoints : []));

  const totalQty = lines.reduce((n, l) => n + l.qty, 0);
  const totalSum = lines.reduce((sum, l) => sum + l.item.price * l.qty, 0);

  if (ordered) {
    return (
      <main id="main" className="mx-auto max-w-content px-4 pb-20">
        <Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: "Корзина" }]} />
        <div className="mt-8 flex max-w-160 flex-col items-start gap-4 rounded-container bg-light p-10">
          <h1 className="text-h2 text-black">Заказ №{ordered} принят</h1>
          <p className="text-body text-dark">
            Менеджер перезвонит в рабочее время: подтвердит наличие, согласует доставку
            и способ оплаты.
          </p>
          <Link href="/catalog" className="text-nav text-blue hover:underline">
            Вернуться в каталог →
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main id="main" className="mx-auto max-w-content px-4 pb-20">
      <Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: "Корзина" }]} />

      <h1 className="mt-6 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-h2 text-black lg:text-h1">
        Корзина
        {lines.length > 0 && (
          <span className="tnum text-field text-grey">
            {lines.length} товара · {formatNumber(totalQty)} шт.
          </span>
        )}
      </h1>

      {/* Undo вместо мгновенного удаления и вместо confirm() */}
      {undo && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-card-lg bg-dark px-5 py-4">
          <p className="text-body text-white">Позиция убрана из корзины</p>
          <form action={undoRemove}>
            <input type="hidden" name="slug" value={undo} />
            <input type="hidden" name="qty" value={undoQty ?? "4"} />
            <button type="submit" className="min-h-touch cursor-pointer text-body font-semibold text-white underline">
              Вернуть
            </button>
          </form>
        </div>
      )}

      {lines.length === 0 ? (
        <div className="mt-8 flex flex-col items-start gap-4 rounded-container bg-light p-10">
          <p className="text-h2 text-black">Корзина пуста</p>
          <Link href="/catalog" className="text-nav text-blue hover:underline">
            Перейти в каталог →
          </Link>
        </div>
      ) : (
        <div className="mt-8 flex flex-col items-stretch gap-6 lg:flex-row lg:items-start lg:gap-4">
          <ul className="flex flex-1 flex-col gap-4">
            {lines.map(({ item, qty }) => {
              const href = `${item.kind === "wheel" ? "/wheels" : "/catalog"}/${item.slug}`;
              return (
              <li
                key={item.slug}
                className="flex flex-wrap items-center gap-3 rounded-card-lg border border-line bg-white p-4 sm:gap-4"
              >
                <Link
                  href={href}
                  tabIndex={-1}
                  aria-hidden="true"
                  className="relative block size-20 shrink-0 overflow-hidden rounded-field border border-line bg-white"
                >
                  <img
                    src={item.image_url || "/images/tire-placeholder.png"}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 size-full object-contain p-1.5"
                  />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <Link href={href} className="text-card-title text-dark hover:text-blue">
                    {item.title}
                  </Link>
                  <p className="text-caption text-grey">{item.subtitle}</p>
                  <p className="tnum text-caption text-grey">{formatPrice(item.price)} / шт.</p>
                </div>
                <CartQty slug={item.slug} qty={qty} max={item.stock} />
                <p className="tnum ml-auto text-right text-price text-black lg:ml-0 lg:w-27">
                  {formatPrice(item.price * qty)}
                </p>
                <form action={removeFromCart}>
                  <input type="hidden" name="slug" value={item.slug} />
                  <button
                    type="submit"
                    aria-label={`Убрать ${item.name} из корзины`}
                    className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-field hover:bg-light"
                  >
                    <img src="/icons/close.svg" alt="" width={20} height={20} className="size-5" />
                  </button>
                </form>
              </li>
              );
            })}
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
                <span className="text-caption text-grey">рассчитает менеджер</span>
              </div>
              <div className="h-px w-full bg-line" role="presentation" />
              <div className="flex items-baseline justify-between">
                <span className="text-field font-semibold text-dark">Итого</span>
                <span className="tnum text-price text-black">{formatPrice(totalSum)}</span>
              </div>
              <a href="#checkout" className="mt-1 text-center text-caption-lg font-semibold text-blue hover:underline">
                Заполнить контакты ↓
              </a>
            </div>
          </aside>
        </div>
      )}

      {lines.length > 0 && (
        <section id="checkout" aria-labelledby="checkout-h" className="mt-14 max-w-160">
          <h2 id="checkout-h" className="text-h2 text-black">
            Оформление заказа
          </h2>
          <p className="mt-2 text-body text-grey">
            Оставьте контакты и выберите способ получения — менеджер перезвонит, подтвердит
            наличие и согласует оплату. Онлайн-оплаты на сайте нет.
          </p>
          <form action={submitOrder} className="mt-6 flex flex-col gap-5">
            {/* Ключ идемпотентности рождается вместе с формой: даблклик по одной
                отрисованной форме = один заказ, а повторная покупка тех же шин
                после перезагрузки — уже новый заказ. */}
            <input type="hidden" name="idempotency_key" value={randomUUID()} />
            {/* Город — из переключателя (кука), уходит в комментарий заказа. */}
            <input type="hidden" name="city_label" value={CITIES[city].label} />

            <div className="flex flex-col gap-3">
              <Field name="customer_name" autoComplete="name" required placeholder="Ф.И.О. — например: Иван Петров…" aria-label="Ф.И.О." />
              <Field
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                spellCheck={false}
                required
                placeholder="Телефон — например: +7 (921) 123-45-67…"
                aria-label="Телефон"
              />
              <Field name="email" type="email" autoComplete="email" placeholder="E-mail (необязательно)…" aria-label="E-mail" />
            </div>

            <CheckoutFulfilment points={points} cityLabel={CITIES[city].label} />

            <Field name="comment" placeholder="Комментарий: удобное время, детали…" aria-label="Комментарий" />
            {error && (
              <p className="text-body text-dark">
                {error === "phone"
                  ? "Укажите телефон — без него не сможем перезвонить."
                  : error === "name"
                    ? "Укажите Ф.И.О., чтобы менеджер знал, к кому обращаться."
                    : error === "address"
                      ? "Укажите адрес доставки или выберите пункт самовывоза."
                      : error === "empty"
                        ? "Товары из корзины больше не доступны. Обновите состав."
                        : "Не получилось оформить. Позвоните нам: +7 (812) 614-64-42."}
              </p>
            )}
            <Button type="submit" className="self-start px-10">
              Оформить заказ
            </Button>
          </form>
        </section>
      )}
    </main>
  );
}
