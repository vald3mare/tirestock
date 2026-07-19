"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Chip } from "@/components/ui/Chip";
import { Dropdown } from "@/components/ui/Dropdown";
import { Field } from "@/components/ui/Field";
import { SeasonBadge } from "@/components/ui/SeasonBadge";
import { Stepper } from "@/components/ui/Stepper";
import { Tab } from "@/components/ui/Tab";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="text-h2 text-black">{title}</h2>
      <div className="mt-6 flex flex-wrap items-start gap-4">{children}</div>
    </section>
  );
}

const widths = ["175", "185", "195", "205", "215", "225", "235"].map((v) => ({
  value: v,
  label: v,
}));

export function UiDemo() {
  const [width, setWidth] = useState<string>();
  const [tab, setTab] = useState(0);
  const [chip, setChip] = useState(0);

  return (
    <main id="main" className="mx-auto max-w-content px-4 pb-20">
      <header className="pt-10">
        <h1 className="text-h1 text-black">UI-кит</h1>
        <p className="mt-2 text-subtitle text-grey">
          Служебная страница: сверка компонентов с Figma. Не индексируется.
        </p>
      </header>

      <Section title="Button">
        <Button>В корзину</Button>
        <Button variant="secondary">Подробнее</Button>
        <Button disabled>В корзину</Button>
        <Button variant="secondary" disabled>
          Подробнее
        </Button>
        <Button className="tnum">Показать 340 шин →</Button>
      </Section>

      <Section title="Field / Dropdown">
        <div className="w-col">
          <Field label="Поиск по каталогу" placeholder="Например: Nokian Hakkapeliitta 10 или артикул…" />
        </div>
        <div className="w-col">
          <Dropdown
            label="Ширина"
            placeholder="Например: 205…"
            options={widths}
            value={width}
            onChange={setWidth}
          />
        </div>
        <div className="w-col">
          <Field label="Поле (disabled)" placeholder="Недоступно…" disabled />
        </div>
      </Section>

      <Section title="Tab">
        <div className="flex gap-2 rounded-container bg-light p-2" role="tablist">
          {["По размеру", "По авто", "Поиск по каталогу"].map((t, i) => (
            <Tab key={t} active={tab === i} onClick={() => setTab(i)}>
              {t}
            </Tab>
          ))}
        </div>
      </Section>

      <Section title="Chip">
        {["205/55 R16", "195/65 R15", "225/45 R17", "Зимние шипованные"].map((c, i) => (
          <Chip key={c} active={chip === i} onClick={() => setChip(i)}>
            {c}
          </Chip>
        ))}
      </Section>

      <Section title="Badge / Season">
        <SeasonBadge season="summer" />
        <SeasonBadge season="winter" spikes />
        <SeasonBadge season="winter" />
        <SeasonBadge season="allseason" />
      </Section>

      <Section title="Checkbox">
        <div className="flex flex-col">
          <Checkbox label="Шипы" defaultChecked />
          <Checkbox label="RunFlat" />
          <Checkbox label="Недоступно" disabled />
        </div>
      </Section>

      <Section title="Stepper">
        <Stepper />
        <Stepper defaultValue={1} />
        <Stepper defaultValue={4} disabled />
        <p className="w-full text-caption text-grey">Дефолт — 4: шины покупают комплектами.</p>
      </Section>

      <Section title="Цены (tabular-nums)">
        <div className="flex flex-col">
          <span className="tnum text-price text-black">12 490 ₽ / шт.</span>
          <span className="tnum text-price text-black">9 890 ₽ / шт.</span>
          <span className="tnum text-price-xl text-black">49 960 ₽</span>
        </div>
      </Section>

      <Section title="Типографика">
        <div className="flex w-full flex-col gap-3">
          <span className="text-h1 text-black">H1 42 ExtraBold — Шины в наличии</span>
          <span className="text-h2 text-black">H2 28 ExtraBold — Подбор по размеру</span>
          <span className="text-subtitle text-grey">Subtitle 20 Medium — подзаголовок hero</span>
          <span className="text-card-title text-dark">Card title 16 SemiBold — название товара в карточке</span>
          <span className="text-nav text-dark">Nav/Button 16 SemiBold</span>
          <span className="text-field text-dark">Field 16 Medium</span>
          <span className="text-body text-dark">Body 15 Medium — описания</span>
          <span className="text-caption text-grey">Caption 13 Medium — подписи, наличие</span>
          <span className="text-legal text-grey">Legal 12 Medium — дисклеймер</span>
        </div>
      </Section>

      <Section title="Палитра">
        {(
          [
            ["blue", "bg-blue", "#2F5FD0"],
            ["blue-hover", "bg-blue-hover", "≈ −8%"],
            ["dark", "bg-dark", "#3F3F3F"],
            ["grey", "bg-grey", "#717171"],
            ["light", "bg-light", "#F4F6F8"],
            ["line", "bg-line", "#E3E7EC"],
            ["green", "bg-green", "#34C759"],
            ["sun", "bg-sun", "#E8A13B"],
          ] as const
        ).map(([name, cls, hex]) => (
          <div key={name} className="flex flex-col items-center gap-1">
            <span className={`size-16 rounded-card border border-line ${cls}`} />
            <span className="text-caption text-dark">{name}</span>
            <span className="text-legal text-grey">{hex}</span>
          </div>
        ))}
      </Section>

      <Section title="Наличие">
        <span className="flex items-center gap-1.5 text-caption text-grey">
          <span className="size-2 rounded-full bg-green" />В наличии: 16 шт.
        </span>
      </Section>
    </main>
  );
}
