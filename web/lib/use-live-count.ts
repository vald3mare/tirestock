"use client";

import { useEffect, useState } from "react";

// Живой счётчик товаров под выбранные (но ещё не применённые) фильтры.
// Дебаунс 300мс + отмена гонок. null → «загрузка/ошибка» (показываем фолбэк).
export function useLiveCount(params: Record<string, string | undefined>): number | null {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) qs.set(k, v);
  }
  const key = qs.toString();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/catalog-count/?${key}`);
        const data = (await res.json()) as { total: number | null };
        if (!cancelled) setCount(data.total);
      } catch {
        if (!cancelled) setCount(null);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [key]);

  return count;
}
