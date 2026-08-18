import Link from "next/link";
import { requireUser } from "@/lib/admin-session";
import { adminBenefits, type AdminBenefit } from "@/lib/api/admin";
import { deleteBenefitAction } from "@/app/admin/actions";

// Раздел «Преимущества»: строка офферов над каталогом на главной (BenefitsBar).
// Контент витрины редактируется тут, а не в коде.

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("ru-RU");
}

function StatusBadge({ published }: { published: boolean }) {
  return published ? (
    <span className="rounded-full bg-green-soft px-2.5 py-1 text-legal font-medium text-green">
      На сайте
    </span>
  ) : (
    <span className="rounded-full bg-light px-2.5 py-1 text-legal font-medium text-grey">
      Скрыт
    </span>
  );
}

export default async function AdminBenefitsPage() {
  const { token } = await requireUser();
  const { items, total } = await adminBenefits(token);
  const published = items.filter((b) => b.published).length;

  return (
    <main id="main" className="mx-auto max-w-content">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-h2 text-black">Преимущества</h1>
          <p className="tnum text-caption-lg text-grey">
            {total} офферов · {published} на сайте
          </p>
        </div>
        <Link
          href="/admin/benefits/new"
          className="inline-flex min-h-touch items-center rounded-field bg-blue px-5 py-2.5 text-nav font-semibold text-white transition-colors hover:bg-blue-hover active:scale-[0.98]"
        >
          + Добавить оффер
        </Link>
      </header>

      {items.length === 0 ? (
        <p className="mt-6 rounded-card-lg border border-line bg-white p-10 text-center text-caption-lg text-grey">
          Пока нет офферов. Добавьте первый — он появится в строке над каталогом.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-card-lg border border-line bg-white">
          <table className="w-full min-w-[680px] text-left">
            <thead>
              <tr className="border-b border-line text-caption text-grey">
                <th className="px-4 py-4 font-medium">Оффер</th>
                <th className="px-4 py-4 font-medium">Подпись</th>
                <th className="tnum px-4 py-4 font-medium">Порядок</th>
                <th className="px-4 py-4 font-medium">Статус</th>
                <th className="px-4 py-4 font-medium">Изменён</th>
                <th className="px-4 py-4" />
              </tr>
            </thead>
            <tbody>
              {items.map((b: AdminBenefit) => (
                <tr
                  key={b.id}
                  className="border-b border-line last:border-0 text-caption-lg text-dark"
                >
                  <td className="px-4 py-4">
                    <span className="flex items-center gap-2.5">
                      {b.icon && (
                        <img src={b.icon} alt="" width={20} height={20} className="size-5 shrink-0" />
                      )}
                      <span className="font-medium">{b.title}</span>
                    </span>
                  </td>
                  <td className="px-4 py-4 text-grey">{b.note || "—"}</td>
                  <td className="tnum px-4 py-4 text-grey">{b.sort_order}</td>
                  <td className="px-4 py-4">
                    <StatusBadge published={b.published} />
                  </td>
                  <td className="px-4 py-4 text-grey">
                    {fmtDate(b.updated_at)}
                    {b.updated_by ? ` · ${b.updated_by}` : ""}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-end gap-4">
                      <Link
                        href={`/admin/benefits/${b.id}`}
                        className="text-caption-lg font-semibold text-blue hover:underline"
                      >
                        Редактировать
                      </Link>
                      <form action={deleteBenefitAction}>
                        <input type="hidden" name="id" value={b.id} />
                        <button
                          type="submit"
                          className="cursor-pointer text-caption-lg text-grey hover:text-red"
                        >
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
        Офферы показываются строкой над каталогом на главной. Порядок задаёт поле «Порядок»
        (меньше — левее). Скрытый оффер не показывается на сайте, но остаётся здесь.
      </p>
    </main>
  );
}
