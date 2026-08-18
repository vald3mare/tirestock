import { requireUser } from "@/lib/admin-session";
import { adminSeoList, type AdminSeoMeta } from "@/lib/api/admin";
import { updateSeoAction } from "@/app/admin/actions";

// Раздел «SEO-мета»: title/description статических маршрутов витрины
// (главная, каталог) + дефолт-шаблон. Применяется через generateMetadata.
// Контентные страницы редактируют свою мету в разделе «Страницы».

const fieldCls =
  "w-full rounded-field border border-line bg-white px-4 py-3 text-field text-dark placeholder:text-grey hover:border-grey focus-visible:border-blue";

function SeoCard({ meta }: { meta: AdminSeoMeta }) {
  const titleLen = meta.title.length;
  const descLen = meta.description.length;
  return (
    <form
      action={updateSeoAction}
      className="rounded-card-lg border border-line bg-white p-6"
    >
      <input type="hidden" name="route" value={meta.route} />

      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-body font-semibold text-black">{meta.label}</h2>
        <span className="tnum text-caption text-grey">
          {meta.is_default ? "применяется, если у страницы пусто" : meta.route}
        </span>
      </div>

      <label className="mt-4 block">
        <span className="mb-1.5 flex items-baseline justify-between text-caption text-grey">
          <span>Title</span>
          <span className={`tnum ${titleLen > 60 ? "text-red" : ""}`}>{titleLen}/60</span>
        </span>
        <input
          name="title"
          defaultValue={meta.title}
          placeholder="Заголовок вкладки и выдачи…"
          className={fieldCls}
        />
      </label>

      <label className="mt-4 block">
        <span className="mb-1.5 flex items-baseline justify-between text-caption text-grey">
          <span>Description</span>
          <span className={`tnum ${descLen > 160 ? "text-red" : ""}`}>{descLen}/160</span>
        </span>
        <textarea
          name="description"
          defaultValue={meta.description}
          rows={2}
          placeholder="Описание для поисковой выдачи…"
          className={`${fieldCls} resize-y`}
        />
      </label>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-legal text-grey">
          {meta.updated_by ? `изменено: ${meta.updated_by}` : ""}
        </span>
        <button
          type="submit"
          className="inline-flex min-h-touch items-center rounded-field bg-blue px-5 py-2.5 text-nav font-semibold text-white transition-colors hover:bg-blue-hover active:scale-[0.98]"
        >
          Сохранить
        </button>
      </div>
    </form>
  );
}

export default async function AdminSeoPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const { token } = await requireUser();
  const { saved } = await searchParams;
  const { items } = await adminSeoList(token);

  return (
    <main id="main" className="mx-auto max-w-content">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-h2 text-black">SEO-мета</h1>
          <p className="text-caption-lg text-grey">
            заголовки и описания страниц для поиска
          </p>
        </div>
        {saved && (
          <span className="rounded-full bg-green-soft px-3 py-1 text-legal font-medium text-green">
            Сохранено
          </span>
        )}
      </header>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {items.map((m) => (
          <SeoCard key={m.route} meta={m} />
        ))}
      </div>

      <p className="mt-6 max-w-180 text-caption text-grey">
        «По умолчанию (шаблон)» подставляется в страницы, у которых поле пустое.
        Рекомендации: Title до 60 символов, Description до 160 — иначе поиск обрежет.
        Мета контентных страниц (Доставка, Гарантия и т. п.) редактируется в разделе
        «Страницы».
      </p>
    </main>
  );
}
