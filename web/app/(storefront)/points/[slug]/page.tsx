import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/blocks/Breadcrumbs";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { ApiError, getPickupPoint } from "@/lib/api/client";
import { SHOP } from "@/lib/shop";
import { yandexEmbedUrl, yandexMapsUrl } from "@/lib/pickup-points";

// Отдельная страница пункта выдачи (/points/<slug>). Server Component. Данные из
// админки по API. Карта Яндекс.Карт с точкой на адресе пункта.

async function loadPoint(slug: string) {
  try {
    return await getPickupPoint(slug);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const point = await loadPoint((await params).slug);
  if (!point) return { title: "Пункт выдачи не найден | TireStock" };
  return {
    title: `Пункт выдачи ${point.address} — TireStock`,
    description: `Пункт выдачи заказов TireStock: ${point.address}${point.metro ? `, ${point.metro}` : ""}. Часы работы: ${point.hours}.`,
  };
}

function MetaLine({ icon, alt, text }: { icon: string; alt: string; text: string }) {
  return (
    <span className="flex items-center gap-2 text-body text-dark">
      <img src={icon} alt={alt} width={18} height={18} className="size-4.5 shrink-0 opacity-70" />
      {text}
    </span>
  );
}

export default async function PickupPointPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const point = await loadPoint((await params).slug);
  if (!point) notFound();

  return (
    <main id="main" className="mx-auto max-w-content px-4 pb-20">
      <Breadcrumbs
        items={[
          { label: "Главная", href: "/" },
          { label: "Пункты выдачи", href: "/points" },
          { label: point.address },
        ]}
      />

      <header className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="text-h2 text-black lg:text-h1">{point.address}</h1>
        {point.is_main && (
          <span className="inline-flex items-center rounded-badge bg-blue px-2.5 py-1 text-legal font-semibold text-white">
            основной
          </span>
        )}
      </header>

      <div className="mt-8 flex flex-col gap-8 lg:flex-row">
        <div className="flex flex-col gap-4 lg:w-100">
          {point.metro && <MetaLine icon="/icons/pin.svg" alt="Метро" text={point.metro} />}
          {point.hours && <MetaLine icon="/icons/clock.svg" alt="Часы работы" text={point.hours} />}
          {point.badge && (
            <span className="inline-flex w-fit items-center rounded-badge bg-light px-3 py-2 text-caption-lg font-semibold text-blue">
              {point.badge}
            </span>
          )}
          {point.note && <p className="text-body text-grey">{point.note}</p>}

          <a
            href={SHOP.phoneHref}
            className="mt-2 inline-flex w-fit items-center gap-2 rounded-field border border-line bg-white px-5 py-3 text-body font-semibold text-dark transition-colors hover:border-grey"
          >
            <img src="/icons/phone.svg" alt="" width={16} height={16} className="size-4" />
            {SHOP.phone}
          </a>
          <ButtonLink
            href={yandexMapsUrl(point.address)}
            target="_blank"
            rel="noopener noreferrer"
            variant="secondary"
            className="w-fit"
          >
            Открыть в Яндекс.Картах →
          </ButtonLink>
        </div>

        {/* Карта с точкой на адресе пункта. */}
        <div className="flex-1 overflow-hidden rounded-card-lg border border-line">
          <iframe
            title={`${point.address} на карте`}
            src={yandexEmbedUrl(point.address)}
            loading="lazy"
            className="block h-[420px] w-full border-0"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    </main>
  );
}
