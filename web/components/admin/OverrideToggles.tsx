"use client";

import { useState, useTransition } from "react";
import { setOverrideAction } from "@/app/admin/actions";

// Управление ПОКАЗОМ товара на витрине (не редактирование данных — цена/остаток/
// название приходят из SelectTyres, только чтение). Два переключателя:
//   «Показывать в каталоге» — позитивная формулировка оверрайда hidden
//     (checked = виден; выключен = скрыт с витрины);
//   «Бейдж «Хит»» — синий пилл на карточке.
// setOverride пишет оба поля разом, поэтому держим общий стейт строки.
// Оптимистично обновляем UI; при ошибке откатываем.
export function OverrideToggles({
  slug,
  hidden: initialHidden,
  badgeHit: initialBadgeHit,
}: {
  slug: string;
  hidden: boolean;
  badgeHit: boolean;
}) {
  const [hidden, setHidden] = useState(initialHidden);
  const [badgeHit, setBadgeHit] = useState(initialBadgeHit);
  const [pending, startTransition] = useTransition();

  function commit(next: { hidden: boolean; badge_hit: boolean }) {
    const prev = { hidden, badge_hit: badgeHit };
    setHidden(next.hidden);
    setBadgeHit(next.badge_hit);
    startTransition(async () => {
      try {
        await setOverrideAction(slug, next);
      } catch {
        setHidden(prev.hidden);
        setBadgeHit(prev.badge_hit);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2.5">
      <Switch
        label="Показывать в каталоге"
        checked={!hidden}
        disabled={pending}
        onToggle={() => commit({ hidden: !hidden, badge_hit: badgeHit })}
      />
      <Switch
        label="Бейдж «Хит»"
        checked={badgeHit}
        disabled={pending}
        onToggle={() => commit({ hidden, badge_hit: !badgeHit })}
      />
    </div>
  );
}

// Тумблер с ВИДИМОЙ подписью — чтобы было ясно, что это настройка показа, а не
// поле данных. Клик по всей строке (label+переключатель).
function Switch({
  label,
  checked,
  disabled,
  onToggle,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onToggle}
      className={
        "group flex items-center gap-2.5 text-left disabled:cursor-not-allowed disabled:opacity-60"
      }
    >
      <span
        className={
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors " +
          (checked ? "bg-blue" : "bg-line")
        }
      >
        <span
          className={
            "inline-block size-5 rounded-full bg-white shadow transition-transform " +
            (checked ? "translate-x-[22px]" : "translate-x-0.5")
          }
        />
      </span>
      <span className="text-caption-lg text-dark whitespace-nowrap">{label}</span>
    </button>
  );
}
