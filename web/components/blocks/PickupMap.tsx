"use client";

import { useEffect, useRef } from "react";
import { POINT_COORDS } from "@/lib/pickup-points";

// Карта пунктов выдачи на ЯНДЕКС.КАРТАХ (ymaps 2.1) — как на старом сайте
// tirestock.ru/points/: все пункты пинами, клик по пину → балун с адресом и
// (в оформлении заказа) кнопкой «Выбрать», которая отмечает пункт в списке.
// Ключ НЕ нужен — старый сайт грузит тот же загрузчик без apikey.
// Координаты — POINT_COORDS по slug (сняты с Яндекс-карты старого сайта).
//
// onSelect задан → режим выбора (корзина): в балуне кнопка «Выбрать».
// onSelect нет → режим просмотра (страница «Пункты выдачи»): балун только инфо.

declare global {
  interface Window {
    // ymaps типизируем как any — официальных типов v2.1 в проекте нет.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ymaps?: any;
  }
}

export type MapPoint = {
  slug: string;
  address: string;
  metro?: string;
  hours?: string;
  badge?: string;
  note?: string;
};

// Одноразовая загрузка ymaps (скрипт добавляется один раз на все карты страницы).
let ymapsPromise: Promise<unknown> | null = null;
function loadYmaps(): Promise<unknown> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  const ready = (y: unknown) => new Promise((res) => (y as { ready: (cb: () => void) => void }).ready(() => res(y)));
  if (window.ymaps?.ready) return ready(window.ymaps);
  if (!ymapsPromise) {
    ymapsPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://api-maps.yandex.ru/2.1/?lang=ru_RU";
      s.async = true;
      s.onload = () => resolve(window.ymaps);
      s.onerror = () => reject(new Error("ymaps load failed"));
      document.head.appendChild(s);
    });
  }
  return ymapsPromise.then(ready);
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

export function PickupMap({
  points,
  selected = "",
  onSelect,
  heightClass = "h-[70vh]",
}: {
  points: MapPoint[];
  selected?: string; // адрес выбранного пункта
  onSelect?: (address: string) => void;
  heightClass?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const placemarksRef = useRef<Map<string, any>>(new Map());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    let destroyed = false;
    const container = containerRef.current;
    if (!container) return;

    // Делегированный клик по кнопке «Выбрать» в балуне (балун рендерится внутри
    // контейнера карты) — надёжнее, чем onclick внутри HTML балуна.
    const onClick = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement)?.closest<HTMLElement>(".ys-pick");
      if (btn?.dataset.addr) {
        onSelectRef.current?.(btn.dataset.addr);
      }
    };
    container.addEventListener("click", onClick);

    loadYmaps()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((ymaps: any) => {
        if (destroyed || !containerRef.current) return;

        const withCoords = points
          .map((p) => ({ p, ll: POINT_COORDS[p.slug] }))
          .filter((x): x is { p: MapPoint; ll: [number, number] } => Boolean(x.ll));

        const map = new ymaps.Map(
          containerRef.current,
          { center: [59.94, 30.31], zoom: 10, controls: ["zoomControl", "geolocationControl"] },
          { suppressMapOpenBlock: true, yandexMapDisablePoiInteractivity: true },
        );
        mapRef.current = map;

        const collection = new ymaps.GeoObjectCollection();
        for (const { p, ll } of withCoords) {
          const meta = [p.metro, p.hours && `Время работы: ${esc(p.hours)}`].filter(Boolean).join("<br/>");
          const body =
            `<div style="max-width:220px">Адрес: <b>${esc(p.address)}</b>` +
            (meta ? `<br/>${meta}` : "") +
            (p.badge ? `<br/><span style="color:#2f5fd0;font-weight:600">${esc(p.badge)}</span>` : "") +
            (p.note ? `<br/><span style="color:#e5484d;font-weight:600">${esc(p.note)}</span>` : "") +
            (onSelectRef.current
              ? `<br/><button type="button" class="ys-pick" data-addr="${esc(p.address)}" ` +
                `style="margin-top:8px;padding:7px 16px;border:0;border-radius:10px;background:#2f5fd0;` +
                `color:#fff;font-weight:600;cursor:pointer">Выбрать</button>`
              : "") +
            `</div>`;

          const pm = new ymaps.Placemark(
            ll,
            { balloonContentHeader: "TireStock", balloonContentBody: body, hintContent: p.address },
            { preset: p.address === selected ? "islands#redDotIcon" : "islands#blueDotIcon" },
          );
          collection.add(pm);
          placemarksRef.current.set(p.address, pm);
        }
        map.geoObjects.add(collection);

        // Показать все точки в кадре.
        if (withCoords.length > 1) {
          map.setBounds(collection.getBounds(), { checkZoomRange: true, zoomMargin: 40 });
        } else if (withCoords.length === 1) {
          map.setCenter(withCoords[0].ll, 14);
        }
      })
      .catch(() => {
        // ymaps не загрузился (нет сети/блокировка) — контейнер останется пустым;
        // выбор пунктов доступен списком-радио под картой (в корзине).
      });

    return () => {
      destroyed = true;
      container.removeEventListener("click", onClick);
      mapRef.current?.destroy?.();
      mapRef.current = null;
      placemarksRef.current.clear();
    };
    // Пересобираем карту при смене списка (город/данные). selected — отдельным эффектом.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points]);

  // Подсветить выбранный пин и открыть его балун (без пересоздания карты).
  useEffect(() => {
    for (const [address, pm] of placemarksRef.current) {
      pm.options?.set?.("preset", address === selected ? "islands#redDotIcon" : "islands#blueDotIcon");
    }
    if (selected) {
      placemarksRef.current.get(selected)?.balloon?.open?.();
    }
  }, [selected]);

  return <div ref={containerRef} className={`w-full ${heightClass}`} aria-label="Карта пунктов выдачи" />;
}
