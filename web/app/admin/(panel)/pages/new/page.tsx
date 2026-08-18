import Link from "next/link";
import { requireUser } from "@/lib/admin-session";
import { createPageAction } from "@/app/admin/actions";

// Новая контентная страница — черновик. Полный контент/SEO редактируются после
// создания в редакторе. URL можно менять до публикации.

const fieldCls =
  "w-full rounded-field border border-line bg-white px-5 py-3.5 text-field text-dark placeholder:text-grey hover:border-grey focus-visible:border-blue";

const errors: Record<string, string> = {
  empty: "Заполните название и URL.",
  slug: "URL должен начинаться с /.",
  taken: "Страница с таким URL уже есть.",
};

export default async function AdminNewPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireUser();
  const { error } = await searchParams;

  return (
    <main id="main" className="mx-auto max-w-content">
      <nav className="text-caption text-grey" aria-label="Хлебные крошки">
        <Link href="/admin/pages" className="hover:text-dark">
          Страницы
        </Link>{" "}
        / Новая страница
      </nav>
      <h1 className="mt-2 text-h2 text-black">Новая страница</h1>

      <form
        action={createPageAction}
        className="mt-8 max-w-140 rounded-card-lg border border-line bg-white p-6"
      >
        {error && (
          <p className="mb-4 rounded-field bg-red-soft px-4 py-2.5 text-caption-lg text-red">
            {errors[error] ?? "Не удалось создать страницу."}
          </p>
        )}

        <label className="block">
          <span className="mb-1.5 block text-caption text-grey">Название страницы</span>
          <input name="title" required placeholder="Например: Доставка…" className={fieldCls} />
        </label>

        <label className="mt-5 block">
          <span className="mb-1.5 block text-caption text-grey">URL</span>
          <input name="slug" required placeholder="/dostavka/" className={`${fieldCls} tnum`} />
          <p className="mt-1.5 text-legal text-grey">
            Начинается со слэша. Пока черновик — URL можно менять; после публикации закрепится.
          </p>
        </label>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="submit"
            className="inline-flex min-h-touch items-center rounded-field bg-blue px-6 py-3 text-nav font-semibold text-white transition-colors hover:bg-blue-hover active:scale-[0.98]"
          >
            Создать
          </button>
          <Link
            href="/admin/pages"
            className="inline-flex min-h-touch items-center rounded-field border border-line bg-white px-6 py-3 text-nav font-semibold text-dark hover:border-grey"
          >
            Отмена
          </Link>
        </div>
      </form>
    </main>
  );
}
