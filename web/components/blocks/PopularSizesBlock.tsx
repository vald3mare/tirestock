import Link from "next/link";
import { popularSizeGrid, sizeHref, sizeLabel } from "@/lib/popular-sizes-grid";

// Блок «Популярные размеры» на главной (был на старом сайте, здесь отсутствовал).
// Сетка ходовых типоразмеров — перелинковка на SEO-посадочные каталога.
export function PopularSizesBlock() {
  return (
    <section aria-labelledby="sizes-h" className="flex flex-col gap-6">
      <h2 id="sizes-h" className="text-h2 text-black">Популярные размеры</h2>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-6">
        {popularSizeGrid.map((s) => (
          <Link
            key={sizeLabel(s)}
            href={sizeHref(s)}
            className="tnum text-caption-lg text-grey hover:text-blue"
          >
            {sizeLabel(s)}
          </Link>
        ))}
      </div>
    </section>
  );
}
