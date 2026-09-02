import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/blocks/Breadcrumbs";
import { listPickupPoints, type PickupPoint } from "@/lib/api/client";
import { CITIES } from "@/lib/city";
import { getCity } from "@/lib/get-city";
import { SHOP } from "@/lib/shop";
import { metadataFor } from "@/lib/seo";
import { fallbackPickupPoints, yandexEmbedUrl } from "@/lib/pickup-points";

// Страница «Пункты выдачи». Server Component. Данные — из админки (раздел «Пункты
// выдачи») по API; фолбэк на статику. Основные адреса (is_main) — крупными
// карточками с телефоном и первыми; остальные — сеткой. Карточка кликабельна →
// отдельная страница пункта /points/<slug>.

export function generateMetadata(): Promise<Metadata> {
  return metadataFor("/points", {
    title: "Пункты выдачи — TireStock, шины в Санкт-Петербурге",
    description:
      "Пункты выдачи заказов TireStock в Санкт-Петербурге: адреса, метро, часы работы, на карте.",
  });
}

type Point = Pick<
  PickupPoint,
  "id" | "slug" | "address" | "metro" | "hours" | "badge" | "is_main"
>;

function MetaLine({ icon, alt, text }: { icon: string; alt: string; text: string }) {
  return (
    <span className="flex items-center gap-1.5 text-caption text-grey">
      <img src={icon} alt={alt} width={14} height={14} className="size-3.5 shrink-0 opacity-70" />
      {text}
    </span>
  );
}

// Обычная карточка пункта — вся кликабельна на страницу пункта.
function PointCard({ point }: { point: Point }) {
  return (
    <article className="flex flex-col rounded-card-lg border border-line bg-white transition-colors hover:border-grey">
      <Link href={`/points/${point.slug}`} className="flex flex-1 flex-col gap-2 p-5">
        <h3 className="text-card-title text-dark">{point.address}</h3>
        {point.metro && <MetaLine icon="/icons/pin.svg" alt="Метро" text={point.metro} />}
        {point.hours && <MetaLine icon="/icons/clock.svg" alt="Часы работы" text={point.hours} />}
        {point.badge && (
          <span className="mt-0.5 inline-flex w-fit items-center rounded-badge bg-light px-2.5 py-1.5 text-legal font-semibold text-blue">
            {point.badge}
          </span>
        )}
        <span className="mt-auto pt-1 text-caption-lg font-semibold text-blue">Подробнее →</span>
      </Link>
    </article>
  );
}

// Основной адрес — крупная карточка с телефоном; вся кликабельна на страницу пункта.
function MainCard({ point }: { point: Point }) {
  return (
    <article className="flex flex-col gap-4 rounded-card-lg bg-light p-6 transition-colors hover:bg-line/50 sm:flex-row sm:items-center sm:justify-between">
      <Link href={`/points/${point.slug}`} className="flex flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-service text-dark">{point.address}</h2>
          <span className="inline-flex items-center rounded-badge bg-blue px-2.5 py-1 text-legal font-semibold text-white">
            основной
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          {point.metro && <MetaLine icon="/icons/pin.svg" alt="Метро" text={point.metro} />}
          {point.hours && <MetaLine icon="/icons/clock.svg" alt="Часы работы" text={point.hours} />}
        </div>
        {point.badge && (
          <span className="mt-0.5 inline-flex w-fit items-center rounded-badge bg-white px-2.5 py-1.5 text-legal font-semibold text-blue">
            {point.badge}
          </span>
        )}
      </Link>
      <a
        href={SHOP.phoneHref}
        className="inline-flex shrink-0 items-center gap-2 self-start rounded-field border border-line bg-white px-5 py-3 text-body font-semibold text-dark transition-colors hover:border-grey"
      >
        <img src="/icons/phone.svg" alt="" width={16} height={16} className="size-4" />
        {SHOP.phone}
      </a>
    </article>
  );
}

export default async function PickupPointsPage() {
  const city = await getCity();
  // Фолбэк только для СПб (у него есть статика); для Москвы пусто → «нет пунктов».
  const points: Point[] = await listPickupPoints(city)
    .then((r) => (r.items.length ? r.items : city === "spb" ? fallbackPickupPoints : []))
    .catch(() => (city === "spb" ? fallbackPickupPoints : []));

  const main = points.filter((p) => p.is_main);
  const rest = points.filter((p) => !p.is_main);
  const total = points.length;
  const mapCenter = main[0]?.address ?? rest[0]?.address ?? CITIES[city].label;
  const cityLoc = CITIES[city].loc;

  return (
    <main id="main" className="mx-auto max-w-content px-4 pb-20">
      <Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: "Пункты выдачи" }]} />

      <header className="mt-6 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="text-h2 text-black lg:text-h1">Пункты выдачи</h1>
        <p className="text-body text-grey">
          {total} пункт{plural(total)} в {cityLoc}
        </p>
      </header>

      {total === 0 ? (
        <p className="mt-8 rounded-card-lg border border-line bg-light p-10 text-center text-body text-grey">
          Пункты выдачи в городе «{CITIES[city].label}» уточняются. Позвоните нам —
          подскажем ближайший: {" "}
          <a href={CITIES[city].phoneHref} className="font-semibold text-blue hover:underline">
            {CITIES[city].phone}
          </a>
          .
        </p>
      ) : (
        <>
          <p className="mt-6 max-w-180 text-body text-dark">
            Заберите заказ в удобном пункте выдачи. Обязательно бронируйте шины заранее —
            мы привезём их к вашему приезду.
          </p>

          {/* Интерактивная карта Яндекс.Карт (виджет, без API-ключа). */}
          <div className="mt-8 overflow-hidden rounded-card-lg border border-line">
            <iframe
              title="Пункты выдачи TireStock на карте"
              src={yandexEmbedUrl(mapCenter, CITIES[city].label)}
              loading="lazy"
              className="block h-[360px] w-full border-0"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </>
      )}

      {main.length > 0 && (
        <div className="mt-4 flex flex-col gap-4">
          {main.map((p) => (
            <MainCard key={p.id} point={p} />
          ))}
        </div>
      )}

      {rest.length > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {rest.map((p) => (
            <PointCard key={p.id} point={p} />
          ))}
        </div>
      )}

    </main>
  );
}

// Русское склонение слова «пункт» по числу (1 пункт, 2–4 пункта, 5+ пунктов).
function plural(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "а";
  return "ов";
}
