import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/admin-session";
import { adminPage } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { publishPageAction, updatePageAction } from "@/app/admin/actions";

// Редактор контентной страницы (Figma 93:757): контент + SEO-мета + панель
// публикации. URL залочен для проиндексированных/системных страниц.

const fieldCls =
  "w-full rounded-field border border-line bg-white px-5 py-3.5 text-field text-dark placeholder:text-grey hover:border-grey focus-visible:border-blue";

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("ru-RU");
}

export default async function AdminPageEditor({ params }: { params: Promise<{ id: string }> }) {
  const { token } = await requireUser();
  const { id } = await params;
  const pageId = Number(id);
  if (!Number.isFinite(pageId)) notFound();

  let page;
  try {
    page = await adminPage(token, pageId);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  return (
    <main id="main" className="mx-auto max-w-content">
      <nav className="text-caption text-grey" aria-label="Хлебные крошки">
        <Link href="/admin/pages" className="hover:text-dark">
          Страницы
        </Link>{" "}
        / {page.title}
      </nav>
      <h1 className="mt-2 text-h2 text-black">Редактирование: {page.title}</h1>

      <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Форма контента */}
        <form action={updatePageAction} className="flex-1 rounded-card-lg border border-line bg-white p-6">
          <input type="hidden" name="id" value={page.id} />

          <label className="block">
            <span className="mb-1.5 block text-caption text-grey">Заголовок страницы</span>
            <input name="title" defaultValue={page.title} required className={fieldCls} />
          </label>

          <div className="mt-5">
            <span className="mb-1.5 block text-caption text-grey">URL</span>
            {page.locked ? (
              <>
                <div className="flex items-center gap-2 rounded-field border border-line bg-light px-5 py-3.5 text-field text-grey">
                  <span className="tnum">{page.slug}</span>
                  <img src="/icons/lock.svg" alt="" width={14} height={14} className="size-3.5" />
                </div>
                <p className="mt-1.5 text-legal text-grey">
                  URL менять нельзя — страница проиндексирована, изменение обрушит SEO-трафик
                </p>
              </>
            ) : (
              <>
                <input name="slug" defaultValue={page.slug} className={`${fieldCls} tnum`} />
                <p className="mt-1.5 text-legal text-grey">
                  Черновик — URL можно менять до публикации
                </p>
              </>
            )}
          </div>

          <label className="mt-5 block">
            <span className="mb-1.5 block text-caption text-grey">Текст страницы</span>
            <textarea name="body" defaultValue={page.body} rows={6} className={`${fieldCls} resize-y`} />
          </label>

          <p className="mt-8 text-nav font-semibold text-dark">SEO</p>
          <label className="mt-3 block">
            <span className="mb-1.5 block text-caption text-grey">Meta title</span>
            <input name="meta_title" defaultValue={page.meta_title} className={fieldCls} />
          </label>
          <label className="mt-4 block">
            <span className="mb-1.5 block text-caption text-grey">Meta description</span>
            <textarea
              name="meta_description"
              defaultValue={page.meta_description}
              rows={2}
              className={`${fieldCls} resize-y`}
            />
          </label>

          <div className="mt-6 flex items-center gap-3">
            <button
              type="submit"
              className="inline-flex min-h-touch items-center rounded-field bg-blue px-6 py-3 text-nav font-semibold text-white transition-colors hover:bg-blue-hover active:scale-[0.98]"
            >
              Сохранить
            </button>
            <Link
              href="/admin/pages"
              className="inline-flex min-h-touch items-center rounded-field border border-line bg-white px-6 py-3 text-nav font-semibold text-dark hover:border-grey"
            >
              Отмена
            </Link>
          </div>
        </form>

        {/* Панель публикации */}
        <aside className="w-full shrink-0 rounded-card-lg border border-line bg-white p-6 lg:w-72">
          <p className="text-nav font-semibold text-dark">Публикация</p>
          <p className="mt-3 flex items-center gap-2 text-caption-lg text-dark">
            <span
              className={`size-2 rounded-full ${page.published ? "bg-green" : "bg-grey"}`}
              aria-hidden="true"
            />
            {page.published ? "Опубликована" : "Черновик"}
          </p>
          <p className="mt-1 text-caption text-grey">
            Изменена: {fmtDate(page.updated_at)}
            {page.updated_by ? `, ${page.updated_by}` : ""}
          </p>

          <form action={publishPageAction} className="mt-4">
            <input type="hidden" name="id" value={page.id} />
            <input type="hidden" name="published" value={page.published ? "false" : "true"} />
            <button
              type="submit"
              className="w-full cursor-pointer rounded-field border border-line bg-white px-4 py-2.5 text-nav font-semibold text-blue hover:border-grey"
            >
              {page.published ? "Снять с публикации" : "Опубликовать"}
            </button>
          </form>

          {page.published && (
            <Link
              href={page.slug}
              className="mt-3 block text-caption-lg font-semibold text-blue hover:underline"
            >
              Открыть на сайте →
            </Link>
          )}
        </aside>
      </div>
    </main>
  );
}
