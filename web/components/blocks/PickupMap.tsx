"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LMap, Marker as LMarker } from "leaflet";
import { POINT_COORDS } from "@/lib/pickup-points";

// Интерактивная карта пунктов выдачи в оформлении заказа (правка заказчика B,
// 14.09.2026) — повторяет старый сайт: все точки пинами, клик по пину открывает
// балун с адресом и кнопкой «Выбрать», которая отмечает пункт в списке снизу.
// Движок — Leaflet + OpenStreetMap (без API-ключа). Координаты — POINT_COORDS
// (сняты с Яндекс-карты старого сайта), поэтому пины стоят точно.

export type MapPoint = {
  slug: string;
  address: string;
  metro?: string;
  hours?: string;
  badge?: string;
  note?: string;
};

// SVG-пин (фирменный синий / серый для невыбранного). anchor снизу по центру.
function pinIcon(L: typeof import("leaflet"), active: boolean) {
  const fill = active ? "#2F5FD0" : "#5B6472";
  return L.divIcon({
    className: "",
    html: `<svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 13.4 23.7 14 24.3.6.6 1.4.6 2 0 .6-.6 14-13.8 14-24.3C30 6.7 23.3 0 15 0z" fill="${fill}"/>
      <circle cx="15" cy="15" r="6" fill="#fff"/>
    </svg>`,
    iconSize: [30, 40],
    iconAnchor: [15, 40],
    popupAnchor: [0, -38],
  });
}

export function PickupMap({
  points,
  selected,
  onSelect,
}: {
  points: MapPoint[];
  selected: string; // адрес выбранного пункта ("" — доставка/ничего)
  onSelect: (address: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LMap | null>(null);
  const markersRef = useRef<Map<string, LMarker>>(new Map());
  // onSelect держим в ref, чтобы не переинициализировать карту при каждом рендере.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Инициализация карты один раз (динамический импорт — leaflet трогает window).
  useEffect(() => {
    let cancelled = false;
    let map: LMap | null = null;

    (async () => {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current || mapRef.current) return;

      const withCoords = points
        .map((p) => ({ p, ll: POINT_COORDS[p.slug] }))
        .filter((x): x is { p: MapPoint; ll: [number, number] } => Boolean(x.ll));

      map = L.map(containerRef.current, { scrollWheelZoom: false });
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const bounds: [number, number][] = [];
      for (const { p, ll } of withCoords) {
        const marker = L.marker(ll, { icon: pinIcon(L, p.address === selected), title: p.address }).addTo(map);

        // Балун: адрес, метро/часы, бейдж и кнопка «Выбрать». Собираем DOM-узлом,
        // чтобы повесить обработчик прямо на кнопку (Leaflet принимает HTMLElement).
        const box = document.createElement("div");
        box.className = "flex flex-col gap-1.5 text-dark";
        box.innerHTML = `
          <span class="text-body font-semibold">Самовывоз ${p.address}</span>
          <span class="text-caption text-grey">${[p.metro, p.hours && `Время работы: ${p.hours}`].filter(Boolean).join(" · ")}</span>
          ${p.badge ? `<span class="text-caption font-medium text-blue">${p.badge}</span>` : ""}
          ${p.note ? `<span class="text-caption font-medium text-red">${p.note}</span>` : ""}`;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = "Выбрать";
        btn.className =
          "mt-1 min-h-touch cursor-pointer rounded-field bg-blue px-4 py-1.5 text-caption-lg font-semibold text-white hover:bg-blue-hover";
        btn.addEventListener("click", () => {
          onSelectRef.current(p.address);
          map?.closePopup();
        });
        box.appendChild(btn);

        marker.bindPopup(box, { closeButton: true, minWidth: 200 });
        markersRef.current.set(p.address, marker);
        bounds.push(ll);
      }

      if (bounds.length > 1) map.fitBounds(bounds, { padding: [40, 40] });
      else if (bounds.length === 1) map.setView(bounds[0], 14);
      else map.setView([59.94, 30.31], 10); // фолбэк — центр СПб
    })();

    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
    // points/selected пересобирают карту редко (только при смене города/списка).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points]);

  // Подсветка выбранного пина без пересоздания карты + открыть его балун.
  useEffect(() => {
    (async () => {
      const L = await import("leaflet");
      for (const [address, marker] of markersRef.current) {
        marker.setIcon(pinIcon(L, address === selected));
      }
      const active = selected ? markersRef.current.get(selected) : undefined;
      if (active && mapRef.current) {
        mapRef.current.panTo(active.getLatLng());
        active.openPopup();
      }
    })();
  }, [selected]);

  return <div ref={containerRef} className="h-[70vh] w-full" aria-label="Карта пунктов выдачи" />;
}
