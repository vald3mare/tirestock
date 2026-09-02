// Стандартные индексы нагрузки/скорости шин (ETRTO) — для строк
// «Индекс нагрузки: 95 (до 690 кг)» на странице товара.
// Извлекаются из типоразмера («205/55 R16 94T» → 94 и T).

const loadKg: Record<number, number> = {
  85: 515, 86: 530, 87: 545, 88: 560, 89: 580, 90: 600,
  91: 615, 92: 630, 93: 650, 94: 670, 95: 690, 96: 710,
  97: 730, 98: 750, 99: 775, 100: 800, 101: 825, 102: 850,
  103: 875, 104: 900, 105: 925, 106: 950, 107: 975, 108: 1000,
};

const speedKmh: Record<string, number> = {
  Q: 160, R: 170, S: 180, T: 190, H: 210, V: 240, W: 270, Y: 300,
};

export type TireIndices = {
  load: string; // «95 (до 690 кг)»
  speed: string; // «V (до 240 км/ч)»
  loadKg: number; // 690 — макс. нагрузка на шину, кг
  speedKmh: number; // 240 — макс. скорость, км/ч
};

// «205/55 R16 94T» / «205/55 R16 91V RunFlat» → индексы; null, если не распознали.
export function parseTireIndices(sizeLabel: string): TireIndices | null {
  const m = sizeLabel.match(/(\d{2,3})([A-Z])(?:\s|$)/);
  if (!m) return null;
  const load = parseInt(m[1], 10);
  const speed = m[2];
  if (!(load in loadKg) || !(speed in speedKmh)) return null;
  return {
    load: `${load} (до ${loadKg[load]} кг)`,
    speed: `${speed} (до ${speedKmh[speed]} км/ч)`,
    loadKg: loadKg[load],
    speedKmh: speedKmh[speed],
  };
}
