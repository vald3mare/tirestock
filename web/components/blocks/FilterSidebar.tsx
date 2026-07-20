"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Dropdown } from "@/components/ui/Dropdown";
import { Field } from "@/components/ui/Field";
import {
  brandOptions,
  diameterOptions,
  profileOptions,
  seasonOptions,
  widthOptions,
} from "@/lib/catalog-options";
import { formatNumber } from "@/lib/format";
import { useLiveCount } from "@/lib/use-live-count";

// Фильтр каталога = тот же набор, что в hero-поиске, вертикально в сайдбаре 264
// + Производитель, цена от/до, чекбоксы Шипы/RunFlat. Параметры ↔ URL query
// (имена совпадают с API 1:1). total приходит с сервера.
// TODO: живое число на кнопке до применения фильтра (нужен клиентский счётчик).

export function FilterSidebar({ total }: { total: number }) {
  const router = useRouter();
  const sp = useSearchParams();

  const [width, setWidth] = useState(sp.get("width") ?? undefined);
  const [profile, setProfile] = useState(sp.get("profile") ?? undefined);
  const [diameter, setDiameter] = useState(sp.get("diameter") ?? undefined);
  const [season, setSeason] = useState(sp.get("season") ?? undefined);
  const [brand, setBrand] = useState(sp.get("brand") ?? undefined);
  const [priceMin, setPriceMin] = useState(sp.get("price_min") ?? "");
  const [priceMax, setPriceMax] = useState(sp.get("price_max") ?? "");
  const [spikes, setSpikes] = useState(sp.get("spikes") === "true");
  const [runflat, setRunflat] = useState(sp.get("runflat") === "true");

  // Живое число под выбранные (ещё не применённые) фильтры; фолбэк — total сервера.
  const live = useLiveCount({
    q: sp.get("q") ?? undefined,
    width,
    profile,
    diameter,
    season,
    brand,
    price_min: priceMin.trim() || undefined,
    price_max: priceMax.trim() || undefined,
    spikes: spikes ? "true" : undefined,
    runflat: runflat ? "true" : undefined,
  });

  const apply = () => {
    const params = new URLSearchParams();
    if (width) params.set("width", width);
    if (profile) params.set("profile", profile);
    if (diameter) params.set("diameter", diameter);
    if (season) params.set("season", season);
    if (brand) params.set("brand", brand);
    if (priceMin.trim()) params.set("price_min", priceMin.trim());
    if (priceMax.trim()) params.set("price_max", priceMax.trim());
    if (spikes) params.set("spikes", "true");
    if (runflat) params.set("runflat", "true");
    router.push(`/catalog${params.size > 0 ? `?${params}` : ""}`);
  };

  return (
    <aside aria-label="Фильтр каталога" className="w-full shrink-0 lg:w-col">
      <div className="flex flex-col gap-3 rounded-container bg-light p-6">
        <p className="text-service text-dark">Фильтр</p>
        <Dropdown placeholder="Ширина" options={widthOptions} value={width} onChange={setWidth} />
        <Dropdown placeholder="Профиль" options={profileOptions} value={profile} onChange={setProfile} />
        <Dropdown placeholder="Диаметр" options={diameterOptions} value={diameter} onChange={setDiameter} />
        <Dropdown placeholder="Сезон" options={seasonOptions} value={season} onChange={setSeason} />
        <Dropdown placeholder="Производитель" options={brandOptions} value={brand} onChange={setBrand} />
        <p className="mt-1 text-caption-lg text-grey">Цена, ₽</p>
        <div className="flex gap-2">
          <Field
            placeholder="от 2 000…"
            inputMode="numeric"
            value={priceMin}
            onChange={(e) => setPriceMin(e.target.value.replace(/\D/g, ""))}
            aria-label="Цена от, рублей"
          />
          <Field
            placeholder="до 25 000…"
            inputMode="numeric"
            value={priceMax}
            onChange={(e) => setPriceMax(e.target.value.replace(/\D/g, ""))}
            aria-label="Цена до, рублей"
          />
        </div>
        <Checkbox label="Шипы" checked={spikes} onChange={(e) => setSpikes(e.target.checked)} />
        <Checkbox label="RunFlat" checked={runflat} onChange={(e) => setRunflat(e.target.checked)} />
        <Button onClick={apply} className="tnum w-full px-5">
          Показать {formatNumber(live ?? total)} шин →
        </Button>
        <Button variant="secondary" className="w-full px-5" onClick={() => router.push("/catalog")}>
          Сбросить
        </Button>
      </div>
    </aside>
  );
}
