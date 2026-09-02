"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { CITIES, type City } from "@/lib/city";

// Переключатель города в топбаре (DNS-стиль): один домен, город в куке.
// Enter/Escape, aria-expanded; при выборе — POST /api/city + router.refresh().
export function CitySwitcher({ city }: { city: City }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onOutside);
    return () => document.removeEventListener("pointerdown", onOutside);
  }, [open]);

  async function choose(next: City) {
    setOpen(false);
    if (next === city) return;
    try {
      const res = await fetch(`/api/city?city=${next}`, { method: "POST" });
      if (res.ok) {
        startTransition(() => router.refresh());
      }
    } catch (error) {
      console.error("Failed to switch city:", error);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={pending}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
        className="flex min-h-touch items-center gap-2 text-caption-lg text-grey hover:text-dark"
      >
        <img src="/icons/pin.svg" alt="" width={16} height={16} className="size-4" />
        {CITIES[city].label}, {CITIES[city].address}
        <img src="/icons/chevron-down-sm.svg" alt="" width={16} height={16} className="size-4" />
      </button>
      {open && (
        <ul
          role="listbox"
          className="animate-dropdown absolute left-0 top-full z-50 mt-1 min-w-48 origin-top rounded-field border border-line bg-white py-1 shadow-dropdown"
        >
          {(Object.keys(CITIES) as City[]).map((c) => (
            <li key={c}>
              <button
                type="button"
                role="option"
                aria-selected={c === city}
                onClick={() => choose(c)}
                className={
                  "block min-h-touch w-full px-4 py-2.5 text-left text-field hover:bg-light " +
                  (c === city ? "font-semibold text-blue" : "text-dark")
                }
              >
                {CITIES[c].label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
