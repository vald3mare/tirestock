import Link from "next/link";

// Сервис и услуги — bento: featured 544×296 («Хранение» — приоритет бизнеса)
// + 4 карточки 264×140. Белые карточки с бордером, radius 16.

const services = [
  { icon: "/icons/service-mount.svg", title: "Шиномонтаж" },
  { icon: "/icons/service-repair.svg", title: "Ремонт колёс" },
  { icon: "/icons/service-paint.svg", title: "Покраска дисков" },
  { icon: "/icons/service-moto.svg", title: "Мотошиномонтаж" },
];

export function ServicesSection() {
  return (
    <section aria-labelledby="services-h" className="flex flex-col gap-8">
      <h2 id="services-h" className="text-h2 text-black">
        Сервис и услуги
      </h2>
      <div className="flex flex-col gap-4 lg:flex-row">
        <Link
          href="/services/storage"
          className="flex min-h-56 w-full flex-col justify-between gap-6 rounded-card-lg border border-line bg-white p-6 transition-colors hover:border-grey lg:h-74 lg:w-136"
        >
          <img src="/icons/service-storage.svg" alt="" width={44} height={44} className="size-11" />
          <div className="flex flex-col gap-2">
            <p className="text-service-lg text-dark">Хранение шин и колёс</p>
            <p className="max-w-124 text-caption-lg text-grey">
              Собственный тёплый склад в Санкт-Петербурге. Примем колёса в день обращения,
              вернём к сезону.
            </p>
            <p className="text-nav text-blue">Узнать условия →</p>
          </div>
        </Link>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {services.map((s) => (
            <li key={s.title}>
              <Link
                href="#"
                className="flex min-h-touch w-full flex-col justify-between gap-4 rounded-card-lg border border-line bg-white p-6 transition-colors hover:border-grey lg:h-35 lg:w-col"
              >
                <img src={s.icon} alt="" width={28} height={28} className="size-7" />
                <p className="text-service text-dark">{s.title}</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
