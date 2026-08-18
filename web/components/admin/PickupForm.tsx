import Link from "next/link";
import type { AdminPickupPoint } from "@/lib/api/admin";

// Форма пункта выдачи — общая для создания и правки. action и submitLabel от
// страницы; при правке передаётся point (заполняет поля + hidden id).

const fieldCls =
  "w-full rounded-field border border-line bg-white px-5 py-3.5 text-field text-dark placeholder:text-grey hover:border-grey focus-visible:border-blue";

export function PickupForm({
  action,
  submitLabel,
  point,
  error,
}: {
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  point?: AdminPickupPoint;
  error?: string;
}) {
  return (
    <form action={action} className="mt-8 max-w-140 rounded-card-lg border border-line bg-white p-6">
      {point && <input type="hidden" name="id" value={point.id} />}

      {error === "empty" && (
        <p className="mb-4 rounded-field bg-red-soft px-4 py-2.5 text-caption-lg text-red">
          Укажите адрес пункта.
        </p>
      )}

      <label className="block">
        <span className="mb-1.5 block text-caption text-grey">Адрес</span>
        <input name="address" required defaultValue={point?.address} placeholder="Например: Советский пр., 37А…" className={fieldCls} />
      </label>

      <div className="mt-5 flex flex-col gap-5 sm:flex-row">
        <label className="block flex-1">
          <span className="mb-1.5 block text-caption text-grey">Метро</span>
          <input name="metro" defaultValue={point?.metro} placeholder="Например: м. Рыбацкое…" className={fieldCls} />
        </label>
        <label className="block flex-1">
          <span className="mb-1.5 block text-caption text-grey">Часы работы</span>
          <input name="hours" defaultValue={point?.hours} placeholder="Например: 09:00–21:00 ежедневно…" className={fieldCls} />
        </label>
      </div>

      <label className="mt-5 block">
        <span className="mb-1.5 block text-caption text-grey">Бейдж-акция</span>
        <input name="badge" defaultValue={point?.badge} placeholder="Например: −15% на шиномонтаж…" className={fieldCls} />
        <p className="mt-1.5 text-legal text-grey">Синий бейдж на карточке. Пусто — бейджа не будет. У каждого пункта свой.</p>
      </label>

      <label className="mt-5 block">
        <span className="mb-1.5 block text-caption text-grey">Услуги (для центрального склада)</span>
        <input name="note" defaultValue={point?.note} placeholder="Например: Полный сервис: выдача, шиномонтаж, хранение…" className={fieldCls} />
      </label>

      <label className="mt-5 block max-w-40">
        <span className="mb-1.5 block text-caption text-grey">Порядок</span>
        <input name="sort_order" type="number" inputMode="numeric" defaultValue={point?.sort_order ?? 0} className={`${fieldCls} tnum`} />
        <p className="mt-1.5 text-legal text-grey">Меньше — выше в списке.</p>
      </label>

      <label className="mt-5 flex items-center gap-2.5">
        <input name="is_central" type="checkbox" defaultChecked={point?.is_central ?? false} className="size-4.5 accent-blue" />
        <span className="text-caption-lg text-dark">Центральный склад (телефон, «основной», полный сервис)</span>
      </label>

      <label className="mt-3 flex items-center gap-2.5">
        <input name="published" type="checkbox" defaultChecked={point ? point.published : true} className="size-4.5 accent-blue" />
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
          href="/admin/pickups"
          className="inline-flex min-h-touch items-center rounded-field border border-line bg-white px-6 py-3 text-nav font-semibold text-dark hover:border-grey"
        >
          Отмена
        </Link>
      </div>
    </form>
  );
}
