import Link from "next/link";
import type { AdminBenefit } from "@/lib/api/admin";

// Форма оффера «Преимущества» — общая для создания и правки. action и submitLabel
// приходят от страницы; при правке передаётся benefit (заполняет поля + hidden id).

const fieldCls =
  "w-full rounded-field border border-line bg-white px-5 py-3.5 text-field text-dark placeholder:text-grey hover:border-grey focus-visible:border-blue";

// Иконки из public/icons — подсказка для поля пути (можно указать любой свой путь).
const iconHints = [
  "/icons/benefit-mount.svg",
  "/icons/benefit-storage.svg",
  "/icons/benefit-paint.svg",
  "/icons/benefit-delivery.svg",
];

export function BenefitForm({
  action,
  submitLabel,
  benefit,
  error,
}: {
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  benefit?: AdminBenefit;
  error?: string;
}) {
  return (
    <form
      action={action}
      className="mt-8 max-w-140 rounded-card-lg border border-line bg-white p-6"
    >
      {benefit && <input type="hidden" name="id" value={benefit.id} />}

      {error === "empty" && (
        <p className="mb-4 rounded-field bg-red-soft px-4 py-2.5 text-caption-lg text-red">
          Заполните заголовок оффера.
        </p>
      )}

      <label className="block">
        <span className="mb-1.5 block text-caption text-grey">Заголовок</span>
        <input
          name="title"
          required
          defaultValue={benefit?.title}
          placeholder="Например: −15% на шиномонтаж…"
          className={fieldCls}
        />
      </label>

      <label className="mt-5 block">
        <span className="mb-1.5 block text-caption text-grey">Подпись</span>
        <input
          name="note"
          defaultValue={benefit?.note}
          placeholder="Например: при покупке шин…"
          className={fieldCls}
        />
      </label>

      <label className="mt-5 block">
        <span className="mb-1.5 block text-caption text-grey">Иконка (путь)</span>
        <input
          name="icon"
          defaultValue={benefit?.icon}
          placeholder="/icons/benefit-mount.svg"
          list="benefit-icons"
          className={`${fieldCls} tnum`}
        />
        <datalist id="benefit-icons">
          {iconHints.map((i) => (
            <option key={i} value={i} />
          ))}
        </datalist>
        <p className="mt-1.5 text-legal text-grey">
          Путь к svg в /public/icons. Готовые: benefit-mount, -storage, -paint, -delivery.
        </p>
      </label>

      <label className="mt-5 block">
        <span className="mb-1.5 block text-caption text-grey">Ссылка (куда ведёт)</span>
        <input
          name="href"
          defaultValue={benefit?.href}
          placeholder="/mounting/"
          list="benefit-hrefs"
          className={`${fieldCls} tnum`}
        />
        <datalist id="benefit-hrefs">
          <option value="/mounting/" />
          <option value="/services/storage" />
          <option value="/delivery/" />
        </datalist>
        <p className="mt-1.5 text-legal text-grey">
          Страница услуги. Пусто — оффер не кликабельный.
        </p>
      </label>

      <label className="mt-5 block max-w-40">
        <span className="mb-1.5 block text-caption text-grey">Порядок</span>
        <input
          name="sort_order"
          type="number"
          inputMode="numeric"
          defaultValue={benefit?.sort_order ?? 0}
          className={`${fieldCls} tnum`}
        />
        <p className="mt-1.5 text-legal text-grey">Меньше — левее в строке.</p>
      </label>

      <label className="mt-5 flex items-center gap-2.5">
        <input
          name="published"
          type="checkbox"
          defaultChecked={benefit ? benefit.published : true}
          className="size-4.5 accent-blue"
        />
        <span className="text-caption-lg text-dark">Показывать на сайте</span>
      </label>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="submit"
          className="inline-flex min-h-touch items-center rounded-field bg-blue px-6 py-3 text-nav font-semibold text-white transition-colors hover:bg-blue-hover active:scale-[0.98]"
        >
          {submitLabel}
        </button>
        <Link
          href="/admin/benefits"
          className="inline-flex min-h-touch items-center rounded-field border border-line bg-white px-6 py-3 text-nav font-semibold text-dark hover:border-grey"
        >
          Отмена
        </Link>
      </div>
    </form>
  );
}
