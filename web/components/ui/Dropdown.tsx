"use client";

import { useEffect, useId, useRef, useState } from "react";

export type DropdownOption = { value: string; label: string };

type Props = {
  options: DropdownOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder: string; // с примером и «…»: «Например: 205…»
  label?: string;
  disabled?: boolean;
};

// Field/Dropdown: white, бордер line, radius 10, px20 py14 (выс. 52),
// плейсхолдер grey, шеврон 16. Панель: тень dropdown + бордер line.
// Клавиатура: Enter/Escape; aria-expanded; hover-мостик к панели (pt-1 на обёртке панели).
export function Dropdown({ options, value, onChange, placeholder, label, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onOutside);
    return () => document.removeEventListener("pointerdown", onOutside);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      {label && <span className="mb-1.5 block text-caption text-grey">{label}</span>}
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
        className={
          "flex min-h-touch w-full items-center justify-between gap-2 rounded-field border border-line " +
          "bg-white px-5 py-3.5 text-field hover:border-grey " +
          "disabled:cursor-not-allowed disabled:bg-light " +
          (selected ? "font-semibold text-dark" : "text-grey")
        }
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <svg
          className={`size-4 shrink-0 text-grey transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        // pt-1 — hover-мостик: курсор не проваливается между кнопкой и панелью
        <div className="absolute left-0 right-0 top-full z-10 pt-1">
          <ul
            id={listboxId}
            role="listbox"
            className="animate-dropdown max-h-72 origin-top overflow-auto rounded-field border border-line bg-white py-2 shadow-dropdown"
          >
            {options.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={o.value === value}
                  className={
                    "block w-full px-5 py-2.5 text-left text-field hover:bg-light " +
                    (o.value === value ? "font-semibold text-blue" : "text-dark")
                  }
                  onClick={() => {
                    onChange?.(o.value);
                    setOpen(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setOpen(false);
                  }}
                >
                  {o.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
