import Link from "next/link";
import { requireUser } from "@/lib/admin-session";
import { adminPickupPoints, type AdminPickupPoint } from "@/lib/api/admin";
import { deletePickupAction } from "@/app/admin/actions";

// Раздел «Пункты выдачи»: адрес/метро/часы и бейдж-акция каждого пункта на
// странице /points. Центральный склад — отдельным стилем на витрине.

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("ru-RU");
}

function StatusBadge({ published }: { published: boolean }) {
  return published ? (
    <span className="rounded-full bg-green-soft px-2.5 py-1 text-legal font-medium text-green">На сайте</span>
  ) : (
    <span className="rounded-full bg-light px-2.5 py-1 text-legal font-medium text-grey">Скрыт</span>
  );
}

export default async function AdminPickupsPage() {
  const { token } = await requireUser();
  const { items, total } = await adminPickupPoints(token);
  const published = items.filter((p) => p.published).length;

  return (
    <main id="main" className="mx-auto max-w-content">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-h2 text-black">Пункты выдачи</h1>
          <p className="tnum text-caption-lg text-grey">{total} пунктов · {published} на сайте</p>
        </div>
        <Link
          href="/admin/pickups/new"
          className="inline-flex min-h-touch items-center rounded-field bg-blue px-5 py-2.5 text-nav font-semibold text-white transition-colors hover:bg-blue-hover active:scale-[0.98]"
        >
          + Добавить пункт
        </Link>
      </header>

      {items.length === 0 ? (
        <p className="mt-6 rounded-card-lg border border-line bg-white p-10 text-center text-caption-lg text-grey">
          Пунктов пока нет. Добавьте первый — он появится на странице «Пункты выдачи».
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-card-lg border border-line bg-white">
          <table className="w-full min-w-[820px] text-left">
            <thead>
              <tr className="border-b border-line text-caption text-grey">
                <th className="px-4 py-4 font-medium">Адрес</th>
                <th className="px-4 py-4 font-medium">Метро · Часы</th>
                <th className="px-4 py-4 font-medium">Бейдж</th>
                <th className="tnum px-4 py-4 font-medium">Порядок</th>
                <th className="px-4 py-4 font-medium">Статус</th>
                <th className="px-4 py-4 font-medium">Изменён</th>
                <th className="px-4 py-4" />
              </tr>
            </thead>
            <tbody>
              {items.map((p: AdminPickupPoint) => (
                <tr key={p.id} className="border-b border-line last:border-0 text-caption-lg text-dark">
                  <td className="px-4 py-4">
                    <span className="flex items-center gap-2">
                      <span className="font-medium">{p.address}</span>
                      {p.is_main && (
                        <span className="rounded-badge bg-blue px-2 py-0.5 text-legal font-semibold text-white">основной</span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-grey">
                    {[p.metro, p.hours].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="px-4 py-4">
                    {p.badge ? (
                      <span className="rounded-badge bg-light px-2.5 py-1 text-legal font-semibold text-blue">{p.badge}</span>
                    ) : (
                      <span className="text-grey">—</span>
                    )}
                  </td>
                  <td className="tnum px-4 py-4 text-grey">{p.sort_order}</td>
                  <td className="px-4 py-4"><StatusBadge published={p.published} /></td>
                  <td className="px-4 py-4 text-grey">
                    {fmtDate(p.updated_at)}
                    {p.updated_by ? ` · ${p.updated_by}` : ""}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-end gap-4">
                      <Link href={`/admin/pickups/${p.id}`} className="text-caption-lg font-semibold text-blue hover:underline">
                        Редактировать
                      </Link>
                      <form action={deletePickupAction}>
                        <input type="hidden" name="id" value={p.id} />
                        <button type="submit" className="cursor-pointer text-caption-lg text-grey hover:text-red">
                          Удалить
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 max-w-180 text-caption text-grey">
        «Бейдж» — своя акция у каждого пункта (пусто — бейджа нет). «Центральный склад»
        рендерится на витрине отдельной карточкой с телефоном и полным сервисом.
        Порядок задаёт поле «Порядок».
      </p>
    </main>
  );
}
