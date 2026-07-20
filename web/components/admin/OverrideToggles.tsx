"use client";

import { useState, useTransition } from "react";
import { setOverrideAction } from "@/app/admin/actions";

// Два оверрайда товара (скрыт / бейдж «Хит»). setOverride пишет оба поля разом,
// поэтому держим общий стейт строки и шлём его целиком при любом переключении.
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
    <div className="flex items-center gap-16">
      <Switch
        label="Скрыт"
        checked={hidden}
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
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors " +
        "disabled:cursor-not-allowed disabled:opacity-60 " +
        (checked ? "bg-blue" : "bg-line")
      }
    >
      <span
        className={
          "inline-block size-5 rounded-full bg-white shadow transition-transform " +
          (checked ? "translate-x-[22px]" : "translate-x-0.5")
        }
      />
    </button>
  );
}
