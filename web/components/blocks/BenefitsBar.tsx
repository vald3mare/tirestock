import { listBenefits, type Benefit } from "@/lib/api/client";

// Преимущества (реальные офферы старого сайта, DESIGN_SYSTEM.md → Контентные данные):
// 4 карточки light bg radius 12, иконка 24 + заголовок 15 SB + подпись 13 grey.
// Контент редактируется в админке (раздел «Преимущества») → грузим по API.
// Фолбэк на статику — если API недоступен, строка не пропадает.

const fallbackBenefits: Pick<Benefit, "icon" | "title" | "note">[] = [
  { icon: "/icons/benefit-mount.svg", title: "−15% на шиномонтаж", note: "при покупке шин" },
  { icon: "/icons/benefit-storage.svg", title: "−30% на хранение", note: "при покупке от 4 шин" },
  { icon: "/icons/benefit-paint.svg", title: "−10% на покраску дисков", note: "при покупке шин" },
  { icon: "/icons/benefit-delivery.svg", title: "Доставка в регионы РФ", note: "расчёт на странице товара" },
];

export async function BenefitsBar() {
  const benefits = await listBenefits()
    .then((r) => (r.items.length ? r.items : fallbackBenefits))
    .catch(() => fallbackBenefits);

  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
      {benefits.map((b, i) => (
        <li key={i} className="flex items-center gap-3 rounded-card bg-light px-4 py-3.5">
          <img src={b.icon} alt="" width={24} height={24} className="size-6 shrink-0" />
          <div className="min-w-0">
            <p className="truncate text-body font-semibold text-dark">{b.title}</p>
            <p className="truncate text-caption text-grey">{b.note}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
