import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/blocks/Breadcrumbs";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { listPickupPoints, type PickupPoint } from "@/lib/api/client";
import { SHOP } from "@/lib/shop";
import { metadataFor } from "@/lib/seo";
import { fallbackPickupPoints, yandexEmbedUrl, yandexMapsUrl } from "@/lib/pickup-points";

// Страница «Пункты выдачи» (Figma «Пункты выдачи» 99:536). Server Component.
// Данные пунктов — из админки (раздел «Пункты выдачи») по API; фолбэк на статику,
// если API недоступен. Карта — виджет Яндекс.Карт (центр — центральный склад).

export function generateMetadata(): Promise<Metadata> {
  return metadataFor("/points", {
    title: "Пункты выдачи — TireStock, шины в Санкт-Петербурге",
    description:
      "Центральный склад и партнёрские пункты выдачи заказов TireStock в Санкт-Петербурге: адреса, метро, часы работы.",
  });
}

// Точка для рендера (форма PickupPoint; фолбэк совместим по полям).
type Point = Pick<PickupPoint, "id" | "address" | "metro" | "hours" | "badge" | "note" | "is_central">;

function MetaLine({ icon, alt, text }: { icon: string; alt: string; text: string }) {
  return (
    <span className="flex items-center gap-1.5 text-caption text-grey">
      <img src={icon} alt={alt} width={14} height={14} className="size-3.5 shrink-0 opacity-70" />
      {text}
    </span>
  );
}

function PointCard({ point }: { point: Point }) {
  return (
    <article className="flex flex-col gap-2 rounded-card-lg border border-line bg-white p-5">
      <h3 className="text-card-title text-dark">{point.address}</h3>
      {point.metro && <MetaLine icon="/icons/pin.svg" alt="Метро" text={point.metro} />}
      {point.hours && <MetaLine icon="/icons/clock.svg" alt="Часы работы" text={point.hours} />}
      {point.badge && (
        <span className="mt-0.5 inline-flex w-fit items-center rounded-badge bg-light px-2.5 py-1.5 text-legal font-semibold text-blue">
          {point.badge}
        </span>
      )}
      <a
        href={yandexMapsUrl(point.address)}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 min-h-touch text-caption-lg font-semibold text-blue hover:underline"
      >
        Подробнее →
      </a>
    </article>
  );
}

export default async function PickupPointsPage() {
  const points: Point[] = await listPickupPoints()
    .then((r) => (r.items.length ? r.items : fallbackPickupPoints))
    .catch(() => fallbackPickupPoints);

  const central = points.find((p) => p.is_central);
  const partners = points.filter((p) => !p.is_central);
  const total = points.length;
  const mapCenter = central?.address ?? SHOP.address;

  return (
    <main id="main" className="mx-auto max-w-content px-4 pb-20">
      <Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: "Пункты выдачи" }]} />

      <header className="mt-6 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="text-h2 text-black lg:text-h1">Пункты выдачи</h1>
        <p className="text-body text-grey">
          {central ? "центральный склад + " : ""}
          {partners.length} пункт{plural(partners.length)} в {SHOP.loc}
        </p>
      </header>

      <p className="mt-6 max-w-180 text-body text-dark">
        Заберите заказ на центральном складе или в удобном партнёрском пункте выдачи. Обязательно
        бронируйте шины заранее — мы привезём их к вашему приезду со склада.
      </p>

      {/* Интерактивная карта Яндекс.Карт (виджет, без API-ключа), центр — склад. */}
      <div className="mt-8 overflow-hidden rounded-card-lg border border-line">
        <iframe
          title="Пункты выдачи TireStock на карте"
          src={yandexEmbedUrl(mapCenter)}
          loading="lazy"
          className="block h-[360px] w-full border-0"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>

      {/* Центральный склад — основной пункт, полный сервис. */}
      {central && (
        <section className="mt-4 flex flex-col gap-4 rounded-card-lg bg-light p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-service text-dark">Центральный склад — {central.address}</h2>
              <span className="inline-flex items-center rounded-badge bg-blue px-2.5 py-1 text-legal font-semibold text-white">
                основной
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
              {central.metro && <MetaLine icon="/icons/pin.svg" alt="Метро" text={central.metro} />}
              {central.hours && <MetaLine icon="/icons/clock.svg" alt="Часы работы" text={central.hours} />}
            </div>
            {central.note && <p className="text-caption-lg text-grey">{central.note}</p>}
          </div>
          <a
            href={SHOP.phoneHref}
            className="inline-flex shrink-0 items-center gap-2 self-start rounded-field border border-line bg-white px-5 py-3 text-body font-semibold text-dark transition-colors hover:border-grey"
          >
            <img src="/icons/phone.svg" alt="" width={16} height={16} className="size-4" />
            {SHOP.phone}
          </a>
        </section>
      )}

      {/* Партнёрские пункты. */}
      {partners.length > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {partners.map((p) => (
            <PointCard key={p.id} point={p} />
          ))}
        </div>
      )}

      <div className="mt-8 flex justify-center">
        <ButtonLink
          href={yandexMapsUrl("пункты выдачи TireStock")}
          target="_blank"
          rel="noopener noreferrer"
          variant="secondary"
        >
          Показать все {total} пункт{plural(total)} на карте
        </ButtonLink>
      </div>
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
