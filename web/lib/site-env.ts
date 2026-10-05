// Гейт индексации. SEO — священная корова: новый сайт крутится на ДВУХ доменах —
// боевом (tirestock.ru) и тестовом (tirestock.website). Индексировать можно ТОЛЬКО
// боевой; тест обязан быть noindex, иначе дубли утянут выдачу.
//
// Правила:
//   1) Глобальный fail-safe: индексация разрешена только при SITE_INDEXABLE=true.
//      Любое другое значение / отсутствие → сайт закрыт (ошибка конфига прячет сайт).
//   2) Если задан SITE_PRIMARY_HOST (боевой домен) — индексируем лишь запросы на
//      этот хост (и www.<host>). Прочие хосты (tirestock.website, IP, preview) —
//      noindex, даже когда SITE_INDEXABLE=true. Хост берём из запроса.
//   3) SITE_PRIMARY_HOST не задан → индексируем на всех хостах (обратная совместимость).
export function isIndexable(host?: string | null): boolean {
  if (process.env.SITE_INDEXABLE !== "true") return false;
  const primary = process.env.SITE_PRIMARY_HOST?.trim().toLowerCase();
  if (!primary) return true;
  const h = (host ?? "").toLowerCase().replace(/:\d+$/, "");
  return h === primary || h === `www.${primary}`;
}
