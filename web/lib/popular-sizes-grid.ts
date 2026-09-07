// Популярные типоразмеры шин для блока-сетки на главной (перелинковка на
// SEO-посадочные /catalog/?width=&profile=&diameter=). Как на старом сайте
// tirestock.ru — курируемый список ходовых размеров рынка РФ, R13–R22.
// Каждый ведёт на фильтрованный каталог с уникальной метой (lib/catalog-seo.ts).

export type TireSize = { width: number; profile: number; diameter: number };

export const popularSizeGrid: TireSize[] = [
  // R13–R14
  { width: 175, profile: 70, diameter: 13 }, { width: 185, profile: 70, diameter: 13 },
  { width: 175, profile: 65, diameter: 14 }, { width: 185, profile: 60, diameter: 14 },
  { width: 185, profile: 65, diameter: 14 }, { width: 195, profile: 65, diameter: 14 },
  // R15
  { width: 185, profile: 55, diameter: 15 }, { width: 185, profile: 60, diameter: 15 },
  { width: 185, profile: 65, diameter: 15 }, { width: 195, profile: 55, diameter: 15 },
  { width: 195, profile: 60, diameter: 15 }, { width: 195, profile: 65, diameter: 15 },
  { width: 205, profile: 60, diameter: 15 }, { width: 205, profile: 65, diameter: 15 },
  { width: 205, profile: 70, diameter: 15 }, { width: 215, profile: 65, diameter: 15 },
  { width: 215, profile: 70, diameter: 15 }, { width: 215, profile: 75, diameter: 15 },
  // R16
  { width: 185, profile: 55, diameter: 16 }, { width: 195, profile: 55, diameter: 16 },
  { width: 205, profile: 55, diameter: 16 }, { width: 205, profile: 60, diameter: 16 },
  { width: 205, profile: 65, diameter: 16 }, { width: 215, profile: 55, diameter: 16 },
  { width: 215, profile: 60, diameter: 16 }, { width: 215, profile: 65, diameter: 16 },
  { width: 215, profile: 70, diameter: 16 }, { width: 225, profile: 55, diameter: 16 },
  { width: 225, profile: 60, diameter: 16 }, { width: 225, profile: 70, diameter: 16 },
  { width: 235, profile: 60, diameter: 16 }, { width: 235, profile: 70, diameter: 16 },
  // R17
  { width: 205, profile: 50, diameter: 17 }, { width: 215, profile: 55, diameter: 17 },
  { width: 215, profile: 60, diameter: 17 }, { width: 225, profile: 45, diameter: 17 },
  { width: 225, profile: 50, diameter: 17 }, { width: 225, profile: 55, diameter: 17 },
  { width: 225, profile: 60, diameter: 17 }, { width: 225, profile: 65, diameter: 17 },
  { width: 235, profile: 45, diameter: 17 }, { width: 235, profile: 55, diameter: 17 },
  { width: 235, profile: 65, diameter: 17 }, { width: 245, profile: 45, diameter: 17 },
  { width: 245, profile: 65, diameter: 17 }, { width: 265, profile: 65, diameter: 17 },
  { width: 265, profile: 70, diameter: 17 },
  // R18
  { width: 225, profile: 40, diameter: 18 }, { width: 225, profile: 45, diameter: 18 },
  { width: 225, profile: 55, diameter: 18 }, { width: 225, profile: 60, diameter: 18 },
  { width: 235, profile: 45, diameter: 18 }, { width: 235, profile: 50, diameter: 18 },
  { width: 235, profile: 55, diameter: 18 }, { width: 235, profile: 60, diameter: 18 },
  { width: 235, profile: 65, diameter: 18 }, { width: 245, profile: 40, diameter: 18 },
  { width: 245, profile: 45, diameter: 18 }, { width: 245, profile: 60, diameter: 18 },
  { width: 255, profile: 55, diameter: 18 }, { width: 265, profile: 60, diameter: 18 },
  // R19–R20
  { width: 235, profile: 55, diameter: 19 }, { width: 245, profile: 45, diameter: 19 },
  { width: 255, profile: 50, diameter: 19 }, { width: 255, profile: 55, diameter: 19 },
  { width: 275, profile: 40, diameter: 19 }, { width: 245, profile: 40, diameter: 20 },
  { width: 265, profile: 50, diameter: 20 }, { width: 275, profile: 45, diameter: 20 },
  { width: 275, profile: 50, diameter: 20 }, { width: 285, profile: 50, diameter: 20 },
];

export const sizeLabel = (s: TireSize) => `${s.width}/${s.profile} R${s.diameter}`;
export const sizeHref = (s: TireSize) =>
  `/catalog/?width=${s.width}&profile=${s.profile}&diameter=${s.diameter}`;
