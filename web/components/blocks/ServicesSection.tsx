import Link from "next/link";

// Сервис и услуги. Пока одна услуга — шиномонтаж (хранение временно убрано
// 14.09.2026 по правке заказчика, вернём когда он запустит свой шиномонтаж;
// покраска дисков/ремонт колёс/мотошиномонтаж убраны 17.08.2026).
// featured-карточка radius 16, hover-бордер.

const services = [
  {
    icon: "/icons/service-mount.svg",
    title: "Шиномонтаж",
    text: "Монтаж и балансировка на оборудовании Hofmann. Скидка 15% при покупке шин у нас.",
    href: "/mounting/",
    cta: "Подробнее →",
  },
];

export function ServicesSection() {
  return (
    <section aria-labelledby="services-h" className="flex flex-col gap-8">
      <h2 id="services-h" className="text-h2 text-black">
        Сервис и услуги
      </h2>
      <div className="flex flex-col gap-4 lg:flex-row">
        {services.map((s) => (
          <Link
            key={s.title}
            href={s.href}
            className="flex min-h-56 flex-1 flex-col justify-between gap-6 rounded-card-lg border border-line bg-white p-6 transition-colors hover:border-grey lg:h-74"
          >
            <img src={s.icon} alt="" width={44} height={44} className="size-11" />
            <div className="flex flex-col gap-2">
              <p className="text-service-lg text-dark">{s.title}</p>
              <p className="max-w-124 text-caption-lg text-grey">{s.text}</p>
              <p className="text-nav text-blue">{s.cta}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
