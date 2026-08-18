"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

// Сортировка каталога. Значение живёт в URL (?sort=), как и фильтры — конвенция
// проекта: состояние списка в query params, товар = отдельный URL. Меняя сортировку,
// сбрасываем пагинацию на первую страницу.
const OPTIONS = [
  { value: "", label: "Сначала популярные" },
  { value: "price_asc", label: "Сначала дешёвые" },
  { value: "price_desc", label: "Сначала дорогие" },
  { value: "name", label: "По названию" },
] as const;

export function SortSelect({ value }: { value: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  return (
    <label className="relative flex items-center" aria-busy={pending}>
      <span className="sr-only">Сортировка</span>
      <select
        value={value}
        onChange={(e) => {
          const next = new URLSearchParams(params);
          if (e.target.value) next.set("sort", e.target.value);
          else next.delete("sort");
          next.delete("page");
          startTransition(() => router.push(`/catalog?${next}`, { scroll: false }));
        }}
        className="min-h-touch cursor-pointer appearance-none rounded-field border border-line bg-white py-3.5 pl-5 pr-10 text-field text-dark hover:border-grey focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-4 text-grey" aria-hidden="true">
        ▾
      </span>
    </label>
  );
}
