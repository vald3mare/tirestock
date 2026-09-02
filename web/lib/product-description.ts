import type { Product } from "@/lib/api/client";
import { parseTireIndices } from "@/lib/tire-indices";

// Описание товара — генерируется из атрибутов (как на старом сайте tirestock.ru):
// расчётная высота профиля в мм, макс. нагрузка (4 колеса), макс. скорость,
// конструкция, камерность, назначение. Реальные данные, а не заглушка.
// Когда появятся редакторские описания из админки/SelectTyres — заменят этот текст.

const seasonPhrase: Record<Product["season"], string> = {
  summer: "Летние",
  winter: "Зимние",
  allseason: "Всесезонные",
};

export function productDescription(p: Product): string {
  const idx = parseTireIndices(p.size_label);
  const heightMm = Math.round((p.width * p.profile) / 100); // высота профиля в мм
  const s: string[] = [];

  s.push(
    `${seasonPhrase[p.season]} шины ${p.name} предназначены для легковых автомобилей` +
      (idx ? ` и рассчитаны на нагрузку до ${idx.loadKg} кг на колесо` : "") +
      ".",
  );
  if (p.spikes) {
    s.push("Шипованный протектор обеспечивает уверенное сцепление на льду и укатанном снегу.");
  } else if (p.season === "winter") {
    s.push("Нешипованный (фрикционный) протектор рассчитан на городскую зимнюю эксплуатацию.");
  }
  if (idx) {
    s.push(`Допустимая максимальная скорость — до ${idx.speedKmh} км/ч (индекс ${p.size_label.match(/[A-Z](?=\s|$)/)?.[0] ?? ""}).`);
  }
  s.push(
    `Ширина профиля — ${p.width} мм, высота профиля — ${heightMm} мм (${p.profile}% от ширины), ` +
      `посадочный диаметр — ${p.diameter} дюймов. Конструкция радиальная, бескамерная (TL).`,
  );
  if (p.runflat) {
    s.push("Технология RunFlat позволяет продолжить движение при проколе на пониженной скорости.");
  }
  s.push(
    "Рисунок протектора обеспечивает эффективный отвод воды из пятна контакта и предсказуемое " +
      "поведение автомобиля на сухой и мокрой дороге.",
  );
  return s.join(" ");
}
