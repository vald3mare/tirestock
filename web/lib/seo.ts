import type { Metadata } from "next";
import { resolveSeo } from "@/lib/api/client";

// Строит Next Metadata из редактируемой в админке SEO-меты маршрута.
// Фолбэк (если API недоступен) обязателен — страница не должна остаться без title.
export async function metadataFor(
  path: string,
  fallback: { title: string; description: string },
): Promise<Metadata> {
  try {
    const seo = await resolveSeo(path);
    return {
      title: seo.title || fallback.title,
      description: seo.description || fallback.description,
    };
  } catch {
    return { title: fallback.title, description: fallback.description };
  }
}
