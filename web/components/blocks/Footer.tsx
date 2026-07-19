// Footer: 4 колонки 264 (бренд / контакты / часы двух отделов / ссылки)
// + нижняя строка: дисклеймер-оферта 12px + копирайт. tel:/mailto: обязательны.

const links = ["О магазине", "Отзывы", "Оплата", "Доставка", "Гарантия"];

export function Footer() {
  return (
    <footer className="border-t border-line bg-white">
      <div className="mx-auto grid max-w-content grid-cols-1 gap-8 px-4 pb-10 pt-12 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
        <div className="flex flex-col gap-2.5">
          <p className="text-subtitle font-extrabold text-dark">TIRESTOCK</p>
          <p className="max-w-55 text-caption text-grey">
            Шины и диски по низким ценам в Санкт-Петербурге
          </p>
        </div>
        <div className="flex flex-col gap-2.5">
          <p className="text-body font-semibold text-dark">Контакты</p>
          <p className="text-caption-lg text-grey">Спб, Зотовский пр. 11, стр. 1</p>
          <a href="tel:+78126146442" className="text-body font-semibold text-dark hover:text-blue">
            +7 (812) 614-64-42
          </a>
          <a href="mailto:info@tirestock.ru" className="text-caption-lg text-grey hover:text-blue">
            info@tirestock.ru
          </a>
          <a href="#" className="text-caption-lg font-semibold text-blue hover:underline">
            Что с моим заказом?
          </a>
        </div>
        <div className="flex flex-col gap-2.5">
          <p className="text-body font-semibold text-dark">Часы работы</p>
          <p className="text-caption text-grey">Отдел продаж</p>
          <p className="text-caption-lg text-dark">Пн–Пт 9:00–21:00 · Сб–Вс 9:00–20:00</p>
          <p className="text-caption text-grey">Отдел доставки</p>
          <p className="text-caption-lg text-dark">Пн–Вс 9:00–21:00</p>
        </div>
        <div className="flex flex-col gap-2.5">
          <p className="text-body font-semibold text-dark">Покупателям</p>
          {links.map((l) => (
            <a key={l} href="#" className="text-caption-lg text-grey hover:text-blue">
              {l}
            </a>
          ))}
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-content flex-col justify-between gap-2 px-4 pb-6 pt-5 text-legal text-grey sm:flex-row sm:items-center sm:gap-4">
          <p className="max-w-175">
            Сайт носит информационный характер и ни при каких условиях не является публичной
            офертой, определяемой положениями ст. 437 (2) ГК РФ.
          </p>
          <p className="whitespace-nowrap">TireStock.ru © 2026</p>
        </div>
      </div>
    </footer>
  );
}
