import Link from "next/link";
import { listBenefits, type Benefit } from "@/lib/api/client";

// Преимущества (реальные офферы старого сайта, DESIGN_SYSTEM.md → Контентные данные):
// 4 карточки light bg radius 12, иконка 24 + заголовок 15 SB + подпись 13 grey.
// Контент редактируется в админке (раздел «Преимущества») → грузим по API.
// Кликабельны, если задан href (ведут на страницу сервиса). Фолбэк на статику.

const fallbackBenefits: Pick<Benefit, "icon" | "title" | "note" | "href">[] = [
  { icon: "/icons/benefit-mount.svg", title: "−15% на шиномонтаж", note: "при покупке шин", href: "/mounting/" },
  { icon: "/icons/benefit-storage.svg", title: "−30% на хранение", note: "при покупке от 4 шин", href: "/services/storage" },
  { icon: "/icons/benefit-delivery.svg", title: "Доставка в регионы РФ", note: "расчёт на странице товара", href: "/delivery/" },
];

function Inner({ b }: { b: Pick<Benefit, "icon" | "title" | "note"> }) {
  return (
    <>
      <img src={b.icon} alt="" width={24} height={24} className="size-6 shrink-0" />
      <div className="min-w-0">
        <p className="truncate text-body font-semibold text-dark">{b.title}</p>
        <p className="truncate text-caption text-grey">{b.note}</p>
      </div>
    </>
  );
}

export async function BenefitsBar() {
  const benefits = await listBenefits()
    .then((r) => (r.items.length ? r.items : fallbackBenefits))
    .catch(() => fallbackBenefits);

  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
      {benefits.map((b, i) => {
        const href = "href" in b ? b.href : "";
        const base = "flex items-center gap-3 rounded-card bg-light px-4 py-3.5";
        return (
          <li key={i}>
            {href ? (
              <Link
                href={href}
                className={`${base} min-h-touch transition-colors hover:bg-line/60`}
              >
                <Inner b={b} />
              </Link>
            ) : (
              <div className={base}>
                <Inner b={b} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
