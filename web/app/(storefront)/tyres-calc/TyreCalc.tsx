"use client";

import { useState } from "react";
import { Dropdown, type DropdownOption } from "@/components/ui/Dropdown";

// Интерактив шинного калькулятора (Figma → «Инфо — Шинный калькулятор», 125:1088).
// Диаметр колеса = посадочный диаметр (дюймы → мм) + 2 × высота профиля.
// Порог допустимой замены — 3% изменения внешнего диаметра.

const widths: DropdownOption[] = [];
for (let w = 125; w <= 355; w += 10) widths.push({ value: String(w), label: String(w) });

const profiles: DropdownOption[] = [];
for (let p = 25; p <= 85; p += 5) profiles.push({ value: String(p), label: String(p) });

const rims: DropdownOption[] = [];
for (let r = 12; r <= 24; r += 1) rims.push({ value: String(r), label: `R${r}` });

type Size = { w: string; p: string; r: string };

function diameterMm({ w, p, r }: Size): number {
  return Number(r) * 25.4 + 2 * (Number(w) * Number(p)) / 100;
}

const fmt = (n: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(n);

function SizeForm({
  title,
  size,
  onChange,
}: {
  title: string;
  size: Size;
  onChange: (s: Size) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-4 rounded-card-lg border border-line bg-white p-6">
      <legend className="float-left text-subtitle font-semibold text-dark">{title}</legend>
      <div className="grid grid-cols-3 gap-3 pt-4">
        <Dropdown
          label="Ширина, мм"
          options={widths}
          value={size.w}
          onChange={(w) => onChange({ ...size, w })}
          placeholder="Например: 205…"
        />
        <Dropdown
          label="Профиль, %"
          options={profiles}
          value={size.p}
          onChange={(p) => onChange({ ...size, p })}
          placeholder="Например: 55…"
        />
        <Dropdown
          label="Диаметр"
          options={rims}
          value={size.r}
          onChange={(r) => onChange({ ...size, r })}
          placeholder="Например: R16…"
        />
      </div>
    </fieldset>
  );
}

export function TyreCalc() {
  const [current, setCurrent] = useState<Size>({ w: "205", p: "55", r: "16" });
  const [next, setNext] = useState<Size>({ w: "225", p: "45", r: "17" });

  const d1 = diameterMm(current);
  const d2 = diameterMm(next);
  const diffMm = d2 - d1;
  const diffPct = (diffMm / d1) * 100;
  const clearanceMm = diffMm / 2;
  const speedo = 60 * (d1 / d2); // показания спидометра при реальных 60 км/ч
  const ok = Math.abs(diffPct) <= 3;

  const label = (s: Size) => `${s.w}/${s.p} R${s.r}`;

  const rows: [string, string][] = [
    ["Диаметр колеса", `${fmt(d1)} мм → ${fmt(d2)} мм (${diffPct >= 0 ? "+" : ""}${fmt(diffPct)}%)`],
    ["Клиренс", `${clearanceMm >= 0 ? "+" : ""}${fmt(clearanceMm)} мм`],
    ["Ширина профиля", `${current.w} мм → ${next.w} мм`],
    [
      "Спидометр",
      Math.abs(diffPct) < 0.05
        ? "показания не изменятся"
        : diffPct > 0
          ? `занижает: покажет ${fmt(speedo)} км/ч при реальных 60 км/ч`
          : `завышает: покажет ${fmt(speedo)} км/ч при реальных 60 км/ч`,
    ],
  ];

  return (
    <div className="mt-10">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SizeForm title="Текущий размер" size={current} onChange={setCurrent} />
        <SizeForm title="Новый размер" size={next} onChange={setNext} />
      </div>

      <section aria-live="polite" className="mt-8 rounded-container bg-light p-6">
        <h2 className="text-subtitle font-semibold text-dark">Результат сравнения</h2>
        <p className="tnum mt-1 text-caption-lg text-grey">
          {label(current)} → {label(next)}
        </p>
        <dl className="mt-4 flex flex-col divide-y divide-line">
          {rows.map(([k, v]) => (
            <div key={k} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-2.5">
              <dt className="text-caption-lg text-grey">{k}</dt>
              <dd className="tnum text-caption-lg font-semibold text-dark">{v}</dd>
            </div>
          ))}
        </dl>
        <p className={`mt-4 text-body font-semibold ${ok ? "text-[#178B4A]" : "text-[#C2402A]"}`}>
          {ok
            ? "✓ Замена допустима — изменение диаметра не превышает 3%"
            : "✗ Не рекомендуем — изменение диаметра больше 3%, возможны ошибки спидометра и задевание арок"}
        </p>
      </section>
    </div>
  );
}
