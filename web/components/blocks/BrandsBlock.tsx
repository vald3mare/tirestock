import Link from "next/link";

// Блок «Бренды шин» на главной (перелинковка на /catalog/?brand=). Бренды —
// реальные из фасетов каталога (в наличии). Пусто → блок не выводится.
export function BrandsBlock({ brands }: { brands: string[] }) {
  if (!brands.length) return null;
  return (
    <section aria-labelledby="brands-h" className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h2 id="brands-h" className="text-h2 text-black">Бренды шин</h2>
        <Link href="/catalog/" className="shrink-0 text-nav text-blue hover:underline">
          Весь каталог →
        </Link>
      </div>
      <div className="flex flex-wrap gap-2">
        {brands.map((b) => (
          <Link
            key={b}
            href={`/catalog/?brand=${encodeURIComponent(b)}`}
            className="rounded-badge border border-line px-3 py-1.5 text-caption-lg text-dark hover:border-blue hover:text-blue"
          >
            {b}
          </Link>
        ))}
      </div>
    </section>
  );
}
