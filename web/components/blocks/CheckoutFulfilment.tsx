"use client";

import { useEffect, useRef, useState } from "react";
import type { PickupPoint } from "@/lib/api/client";
import { Field } from "@/components/ui/Field";
import { yandexEmbedUrl } from "@/lib/pickup-points";

// Способ получения (Figma старого сайта): радио «Доставка курьером» + самовывоз
// из каждого пункта. При доставке — поле адреса (обязательное). Ссылка «на карте»
// открывает модалку с картой Яндекс и всеми пунктами города.
// Выбор кладётся в скрытые поля fulfilment_kind / fulfilment_point / address,
// которые submitOrder складывает в комментарий заказа (tradesk).

const DELIVERY = "delivery";

export function CheckoutFulfilment({
  points,
  cityLabel,
}: {
  points: Pick<PickupPoint, "id" | "address" | "metro" | "hours">[];
  cityLabel: string;
}) {
  // Значение: "delivery" | адрес пункта. По умолчанию — доставка (как на старом).
  const [choice, setChoice] = useState<string>(DELIVERY);
  const [mapOpen, setMapOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMapOpen(false);
    const onPointer = (e: PointerEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) setMapOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      document.body.style.overflow = "";
    };
  }, [mapOpen]);

  const isDelivery = choice === DELIVERY;
  // Центр карты — адрес выбранного пункта (или первого), НЕ текстовый поиск
  // «пункты выдачи шин»: тот показывал бы все точки города, включая конкурентов.
  // Точный адрес нашего пункта = единственная метка на карте.
  const mapAddress = isDelivery ? (points[0]?.address ?? "") : choice;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-service text-dark">Способ получения</h3>
        {points.length > 0 && (
          <button
            type="button"
            onClick={() => setMapOpen(true)}
            aria-haspopup="dialog"
            className="min-h-touch cursor-pointer text-caption-lg font-semibold text-blue hover:underline"
          >
            на карте
          </button>
        )}
      </div>

      {/* Скрытые поля: способ + пункт (для комментария заказа). */}
      <input type="hidden" name="fulfilment_kind" value={isDelivery ? "delivery" : "pickup"} />
      <input type="hidden" name="fulfilment_point" value={isDelivery ? "" : choice} />

      <fieldset className="flex flex-col gap-2.5 rounded-container border border-line p-4">
        <legend className="sr-only">Способ получения</legend>

        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="radio"
            name="fulfilment"
            checked={isDelivery}
            onChange={() => setChoice(DELIVERY)}
            className="mt-1 size-4.5 accent-blue"
          />
          <span className="flex flex-col">
            <span className="text-body font-semibold text-dark">Доставка курьером</span>
            <span className="text-caption text-grey">Доставка на следующий день</span>
          </span>
        </label>

        {isDelivery && (
          <Field
            name="address"
            required
            placeholder="Адрес доставки: улица, дом, квартира…"
            aria-label="Адрес доставки"
            className="ml-7"
          />
        )}

        <div className="my-1 h-px w-full bg-line" role="presentation" />

        <div className="flex max-h-80 flex-col gap-2.5 overflow-y-auto">
          {points.map((p) => (
            <label key={p.id} className="flex cursor-pointer items-start gap-2.5">
              <input
                type="radio"
                name="fulfilment"
                checked={choice === p.address}
                onChange={() => setChoice(p.address)}
                className="mt-1 size-4.5 accent-blue"
              />
              <span className="flex flex-col">
                <span className="text-body font-medium text-dark">Самовывоз {p.address}</span>
                <span className="text-caption text-grey">
                  {[p.metro, p.hours && `Время работы: ${p.hours}`].filter(Boolean).join(" · ")}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {mapOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Пункты выдачи на карте"
            className="relative w-full max-w-4xl overflow-hidden rounded-container bg-white"
          >
            <button
              type="button"
              onClick={() => setMapOpen(false)}
              aria-label="Закрыть"
              className="absolute right-3 top-3 z-10 flex size-10 cursor-pointer items-center justify-center rounded-full bg-white/90 text-subtitle text-grey hover:text-dark"
            >
              ×
            </button>
            <iframe
              title="Пункт выдачи на карте"
              src={yandexEmbedUrl(mapAddress, cityLabel)}
              loading="lazy"
              className="block h-[70vh] w-full border-0"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      )}
    </div>
  );
}
