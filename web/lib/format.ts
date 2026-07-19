// Форматирование чисел/цен — единое место (ru-RU, неразрывные группы).
const fmt = new Intl.NumberFormat("ru-RU");

export function formatPrice(rub: number): string {
  return `${fmt.format(rub)} ₽`;
}

export function formatNumber(n: number): string {
  return fmt.format(n);
}

export const seasonLabel: Record<string, string> = {
  summer: "Летние",
  winter: "Зимние",
  allseason: "Всесезонные",
};
