"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Dropdown } from "@/components/ui/Dropdown";
import { Field } from "@/components/ui/Field";
import { Tab } from "@/components/ui/Tab";
import {
  diameterOptions,
  parseTireSize,
  popularSizes,
  profileOptions,
  seasonOptions,
  widthOptions,
} from "@/lib/catalog-options";

// Поиск в hero = фильтр каталога (один компонент, два контекста).
// Выбранные параметры уходят в каталог через URL query params.
// Три режима: по размеру / по авто / по каталогу (текст).
// TODO: живое число «Показать N шин» — при вёрстке каталога;
// TODO: таб «По авто» — база подбора SelectTyres ещё в разведке (ARCHITECTURE.md).

const TABS = ["По размеру", "По авто", "Поиск по каталогу"] as const;

export function SearchWidget() {
  const router = useRouter();
  const [tab, setTab] = useState(0);
  const [width, setWidth] = useState<string>();
  const [profile, setProfile] = useState<string>();
  const [diameter, setDiameter] = useState<string>();
  const [season, setSeason] = useState<string>();
  const [query, setQuery] = useState("");

  const submit = () => {
    const params = new URLSearchParams();
    if (tab === 0) {
      if (width) params.set("width", width);
      if (profile) params.set("profile", profile);
      if (diameter) params.set("diameter", diameter);
      if (season) params.set("season", season);
    } else if (tab === 2 && query.trim()) {
      params.set("q", query.trim());
    }
    router.push(`/catalog${params.size > 0 ? `?${params}` : ""}`);
  };

  const applyPopularSize = (size: string) => {
    const parsed = parseTireSize(size);
    if (!parsed) return;
    setTab(0);
    setWidth(parsed.width);
    setProfile(parsed.profile);
    setDiameter(parsed.diameter);
  };

  return (
    <section
      aria-label="Подбор шин"
      className="flex flex-col gap-5 rounded-container bg-light p-5 lg:gap-6 lg:p-10"
    >
      <div className="flex flex-wrap gap-2" role="tablist">
        {TABS.map((t, i) => (
          <Tab key={t} active={tab === i} onClick={() => setTab(i)}>
            {t}
          </Tab>
        ))}
      </div>

      {tab === 0 && (
        <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:flex">
          <div className="flex-1">
            <Dropdown placeholder="Ширина" options={widthOptions} value={width} onChange={setWidth} />
          </div>
          <div className="flex-1">
            <Dropdown placeholder="Профиль" options={profileOptions} value={profile} onChange={setProfile} />
          </div>
          <div className="flex-1">
            <Dropdown placeholder="Диаметр" options={diameterOptions} value={diameter} onChange={setDiameter} />
          </div>
          <div className="flex-1">
            <Dropdown placeholder="Сезон" options={seasonOptions} value={season} onChange={setSeason} />
          </div>
          <Button onClick={submit} className="sm:col-span-2 lg:w-auto">Подобрать</Button>
        </div>
      )}

      {tab === 1 && (
        <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:flex">
          <div className="flex-1">
            <Dropdown placeholder="Марка" options={[]} disabled />
          </div>
          <div className="flex-1">
            <Dropdown placeholder="Модель" options={[]} disabled />
          </div>
          <div className="flex-1">
            <Dropdown placeholder="Год" options={[]} disabled />
          </div>
          <div className="flex-1">
            <Dropdown placeholder="Модификация" options={[]} disabled />
          </div>
          <Button disabled className="sm:col-span-2 lg:w-auto">Подобрать</Button>
        </div>
      )}

      {tab === 2 && (
        <form
          className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-start"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex-1">
            <Field
              placeholder="Например: Nokian Hakkapeliitta 10 или артикул…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Button type="submit">Подобрать</Button>
        </form>
      )}

      {tab === 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-caption-lg text-grey">Популярно:</span>
          {popularSizes.map((s) => (
            <Chip key={s} onClick={() => applyPopularSize(s)} className="border-transparent">
              {s}
            </Chip>
          ))}
        </div>
      )}
      {tab === 1 && (
        <p className="text-caption-lg text-grey">
          Подбор по автомобилю скоро заработает — пока воспользуйтесь поиском по размеру.
        </p>
      )}
    </section>
  );
}
