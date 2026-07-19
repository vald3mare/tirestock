"use client";

import { useState } from "react";

type Props = {
  defaultValue?: number; // шины покупают комплектами — дефолт 4
  min?: number;
  max?: number;
  value?: number; // если передан — компонент контролируемый
  onChange?: (value: number) => void;
  disabled?: boolean;
};

// Stepper: бордер line, radius 10, ячейки 40–44px, кнопки с aria-label,
// input inputmode=numeric, значение tabular-nums.
// Пока пользователь печатает, поле может быть пустым; значение
// фиксируется (с клампом в [min, max]) на blur или по кнопкам ±.
export function Stepper({
  defaultValue = 4,
  min = 1,
  max = 99,
  value,
  onChange,
  disabled,
}: Props) {
  const isControlled = value !== undefined;
  const [inner, setInner] = useState(defaultValue);
  const [draft, setDraft] = useState<string | null>(null); // текст в поле во время набора
  const current = isControlled ? value : inner;

  const commit = (next: number) => {
    const clamped = Math.min(max, Math.max(min, next));
    if (!isControlled) setInner(clamped);
    onChange?.(clamped);
  };

  const commitDraft = () => {
    if (draft !== null) {
      const n = parseInt(draft, 10);
      commit(Number.isNaN(n) ? current : n);
      setDraft(null);
    }
  };

  const btn =
    "flex size-11 shrink-0 cursor-pointer items-center justify-center text-nav text-dark " +
    "transition-colors hover:bg-light disabled:cursor-not-allowed disabled:text-grey disabled:hover:bg-white";

  return (
    <div className="inline-flex items-stretch overflow-hidden rounded-field border border-line bg-white">
      <button
        type="button"
        aria-label="Уменьшить количество"
        disabled={disabled || current <= min}
        onClick={() => commit(current - 1)}
        className={btn}
      >
        −
      </button>
      <input
        inputMode="numeric"
        pattern="[0-9]*"
        aria-label="Количество, шт."
        value={draft ?? current}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
        onBlur={commitDraft}
        onKeyDown={(e) => {
          if (e.key === "Enter") commitDraft();
        }}
        className="tnum w-11 border-x border-line bg-white text-center text-field text-dark disabled:bg-light"
      />
      <button
        type="button"
        aria-label="Увеличить количество"
        disabled={disabled || current >= max}
        onClick={() => commit(current + 1)}
        className={btn}
      >
        +
      </button>
    </div>
  );
}
