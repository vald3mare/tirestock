import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/blocks/Breadcrumbs";
import { listContentByPrefix, type ContentPage } from "@/lib/api/client";
import { metadataFor } from "@/lib/seo";

// Раздел «Новости» (URL /news/ 1:1 со старым сайтом, SEO). Листинг опубликованных
// страниц под /news/ (админ добавляет статьи как контентные страницы /news/<slug>/,
// они рендерятся catch-all). Свежие сверху.

export function generateMetadata(): Promise<Metadata> {
  return metadataFor("/news", {
    title: "Новости — TireStock, шины и диски в Санкт-Петербурге",
    description: "Новости шинного рынка, ассортимента и акций TireStock.",
  });
}

const dt = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "long", year: "numeric" });

// Короткий анонс из тела статьи (первый абзац, до ~180 символов).
function excerpt(p: ContentPage): string {
  if (p.meta_description?.trim()) return p.meta_description.trim();
  const first = p.body.split(/\n+/).map((s) => s.trim()).find(Boolean) ?? "";
  return first.length > 180 ? first.slice(0, 180).trimEnd() + "…" : first;
}

export default async function NewsPage() {
  const items = await listContentByPrefix("/news/")
    .then((r) => r.items)
    .catch(() => [] as ContentPage[]);

  return (
    <main id="main" className="mx-auto max-w-content px-4 pb-20">
      <Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: "Новости" }]} />
      <h1 className="mt-6 text-h2 text-black lg:text-h1">Новости</h1>

      {items.length === 0 ? (
        <p className="mt-8 rounded-container bg-light p-10 text-body text-grey">
          Пока нет опубликованных новостей. Загляните позже.
        </p>
      ) : (
        <div className="mt-8 flex flex-col gap-4">
          {items.map((p) => (
            <article
              key={p.slug}
              className="rounded-card-lg border border-line bg-white p-6 transition-colors hover:border-grey"
            >
              <Link href={p.slug} className="group flex flex-col gap-2">
                <h2 className="text-service text-dark group-hover:text-blue">{p.title}</h2>
                {p.updated_at && (
                  <time className="text-caption text-grey">{dt.format(new Date(p.updated_at))}</time>
                )}
                <p className="text-body text-grey">{excerpt(p)}</p>
                <span className="mt-1 text-caption-lg font-semibold text-blue">Читать →</span>
              </Link>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
