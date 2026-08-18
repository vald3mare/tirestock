import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Breadcrumbs } from "@/components/blocks/Breadcrumbs";
import { ApiError, getContentPage, type ContentPage } from "@/lib/api/client";

// Catch-all витрины: рендерит опубликованную контентную страницу по её URL
// (Оплата, Доставка, Пункты выдачи, …). Специфичные роуты (/catalog, /cart,
// /services/*) матчатся раньше и сюда не попадают. no-store в getContentPage →
// правки из админки видны на сайте сразу.

type Params = { slug: string[] };

const loadPage = cache(async (path: string): Promise<ContentPage | null> => {
  try {
    return await getContentPage(path);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
});

function pathFrom(slug: string[]): string {
  return "/" + slug.map((s) => decodeURIComponent(s)).join("/");
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const page = await loadPage(pathFrom((await params).slug));
  if (!page) return { title: "Страница не найдена | TireStock" };
  return {
    title: page.meta_title || `${page.title} | TireStock`,
    description: page.meta_description || undefined,
  };
}

export default async function ContentPageView({ params }: { params: Promise<Params> }) {
  const page = await loadPage(pathFrom((await params).slug));
  if (!page) notFound();

  const paragraphs = page.body.split(/\n+/).map((s) => s.trim()).filter(Boolean);

  return (
    <main id="main" className="mx-auto max-w-content px-4 pb-20">
      <Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: page.title }]} />

      <article className="mt-8 max-w-180">
        <h1 className="text-h1 text-black">{page.title}</h1>
        <div className="mt-6 flex flex-col gap-4">
          {paragraphs.length > 0 ? (
            paragraphs.map((p, i) => (
              <p key={i} className="text-body text-dark">
                {p}
              </p>
            ))
          ) : (
            <p className="text-body text-grey">Содержимое страницы скоро появится.</p>
          )}
        </div>
      </article>
    </main>
  );
}
