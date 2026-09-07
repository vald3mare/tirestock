"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { Field } from "@/components/ui/Field";
import type { WheelFacets } from "@/lib/api/client";
import { formatNumber } from "@/lib/format";

// Фильтр каталога дисков: диаметр / ширина / сверловка / тип / производитель / цена.
// Параметры ↔ URL query (имена = API 1:1). Опции — из фасетов дисков (в наличии).

type Opt = { value: string; label: string };
const opts = (xs: (string | number)[], fmt?: (x: string) => string): Opt[] =>
  xs.map((x) => ({ value: String(x), label: fmt ? fmt(String(x)) : String(x) }));

export function WheelFilterSidebar({ total, facets }: { total: number; facets: WheelFacets }) {
  const router = useRouter();
  const sp = useSearchParams();

  const [diameter, setDiameter] = useState(sp.get("diameter") ?? undefined);
  const [width, setWidth] = useState(sp.get("width") ?? undefined);
  const [pcd, setPcd] = useState(sp.get("pcd") ?? undefined);
  const [type, setType] = useState(sp.get("type") ?? undefined);
  const [brand, setBrand] = useState(sp.get("brand") ?? undefined);
  const [priceMin, setPriceMin] = useState(sp.get("price_min") ?? "");
  const [priceMax, setPriceMax] = useState(sp.get("price_max") ?? "");

  const apply = () => {
    const p = new URLSearchParams();
    if (diameter) p.set("diameter", diameter);
    if (width) p.set("width", width);
    if (pcd) p.set("pcd", pcd);
    if (type) p.set("type", type);
    if (brand) p.set("brand", brand);
    if (priceMin.trim()) p.set("price_min", priceMin.trim());
    if (priceMax.trim()) p.set("price_max", priceMax.trim());
    router.push(`/wheels/${p.size > 0 ? `?${p}` : ""}`);
  };
  const reset = () => {
    setDiameter(undefined);
    setWidth(undefined);
    setPcd(undefined);
    setType(undefined);
    setBrand(undefined);
    setPriceMin("");
    setPriceMax("");
    router.push("/wheels/");
  };

  return (
    <aside aria-label="Фильтр дисков" className="w-full shrink-0 lg:w-col">
      <div className="flex flex-col gap-3 rounded-container bg-light p-6">
        <p className="text-service text-dark">Фильтр</p>
        <Dropdown placeholder="Диаметр" options={opts(facets.diameters, (d) => `R${d}`)} value={diameter} onChange={setDiameter} />
        <Dropdown placeholder="Ширина, дюймы" options={opts(facets.widths)} value={width} onChange={setWidth} />
        <Dropdown placeholder="Сверловка (PCD)" options={opts(facets.pcds)} value={pcd} onChange={setPcd} />
        <Dropdown placeholder="Тип" options={opts(facets.types)} value={type} onChange={setType} />
        <Dropdown placeholder="Производитель" options={opts(facets.brands)} value={brand} onChange={setBrand} />
        <p className="mt-1 text-caption-lg text-grey">Цена, ₽</p>
        <div className="flex gap-2">
          <Field placeholder="от 2 000…" inputMode="numeric" value={priceMin}
            onChange={(e) => setPriceMin(e.target.value.replace(/\D/g, ""))} aria-label="Цена от" />
          <Field placeholder="до 25 000…" inputMode="numeric" value={priceMax}
            onChange={(e) => setPriceMax(e.target.value.replace(/\D/g, ""))} aria-label="Цена до" />
        </div>
        <Button onClick={apply} className="tnum w-full px-5">
          Показать {formatNumber(total)} →
        </Button>
        <Button variant="secondary" className="w-full px-5" onClick={reset}>
          Сбросить
        </Button>
      </div>
    </aside>
  );
}
