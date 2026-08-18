import Link from "next/link";
import { requireUser } from "@/lib/admin-session";
import { adminPages, type AdminPage } from "@/lib/api/admin";
import { deletePageAction } from "@/app/admin/actions";

// Раздел «Страницы» (Figma 100:604): список контентных страниц витрины.
// Замок у URL = проиндексирована/системная (адрес залочен, удаление недоступно).

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("ru-RU");
}

function StatusBadge({ published }: { published: boolean }) {
  return published ? (
    <span className="rounded-full bg-green-soft px-2.5 py-1 text-legal font-medium text-green">
      Опубликована
    </span>
  ) : (
    <span className="rounded-full bg-light px-2.5 py-1 text-legal font-medium text-grey">
      Черновик
    </span>
  );
}

function ChangedBy({ page }: { page: AdminPage }) {
  if (page.system && !page.updated_by) return <>системная</>;
  return (
    <>
      {fmtDate(page.updated_at)}
      {page.updated_by ? ` · ${page.updated_by}` : ""}
    </>
  );
}

export default async function AdminPagesPage() {
  const { token } = await requireUser();
  const { items, total, published, drafts } = await adminPages(token);

  return (
    <main id="main" className="mx-auto max-w-content">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-h2 text-black">Страницы</h1>
          <p className="tnum text-caption-lg text-grey">
            {total} страниц · {published} опубликовано · {drafts} черновик
          </p>
        </div>
        <Link
          href="/admin/pages/new"
          className="inline-flex min-h-touch items-center rounded-field bg-blue px-5 py-2.5 text-nav font-semibold text-white transition-colors hover:bg-blue-hover active:scale-[0.98]"
        >
          + Добавить страницу
        </Link>
      </header>

      <div className="mt-6 overflow-x-auto rounded-card-lg border border-line bg-white">
        <table className="w-full min-w-[760px] text-left">
          <thead>
            <tr className="border-b border-line text-caption text-grey">
              <th className="px-4 py-4 font-medium">Название</th>
              <th className="px-4 py-4 font-medium">URL</th>
              <th className="px-4 py-4 font-medium">Статус</th>
              <th className="px-4 py-4 font-medium">Изменена</th>
              <th className="px-4 py-4" />
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} className="border-b border-line last:border-0 text-caption-lg text-dark">
                <td className="px-4 py-4 font-medium">{p.title}</td>
                <td className="px-4 py-4">
                  <span className="inline-flex items-center gap-1.5 text-grey">
                    <span className="tnum">{p.slug}</span>
                    {p.locked && (
                      <img src="/icons/lock.svg" alt="URL залочен" width={14} height={14} className="size-3.5" />
                    )}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <StatusBadge published={p.published} />
                </td>
                <td className="px-4 py-4 text-grey">
                  <ChangedBy page={p} />
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center justify-end gap-4">
                    <Link
                      href={`/admin/pages/${p.id}`}
                      className="text-caption-lg font-semibold text-blue hover:underline"
                    >
                      Редактировать
                    </Link>
                    {p.deletable && (
                      <form action={deletePageAction}>
                        <input type="hidden" name="id" value={p.id} />
                        <button
                          type="submit"
                          className="cursor-pointer text-caption-lg text-grey hover:text-red"
                        >
                          Удалить
                        </button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 max-w-180 text-caption text-grey">
        Замок у URL: страница проиндексирована поисковиками — адрес заблокирован, удаление недоступно
        (можно снять с публикации). Новые страницы (без индекса) можно свободно переименовывать и
        удалять до публикации.
      </p>
    </main>
  );
}
