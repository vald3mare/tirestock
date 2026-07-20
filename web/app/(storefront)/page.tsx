import Link from "next/link";
import { BenefitsBar } from "@/components/blocks/BenefitsBar";
import { ProductCard } from "@/components/blocks/ProductCard";
import { SearchWidget } from "@/components/blocks/SearchWidget";
import { ServicesSection } from "@/components/blocks/ServicesSection";
import { listProducts, type Product } from "@/lib/api/client";

// Главная (Figma → Desktop, 1:2). Server Component: данные через lib/api.
// Ритм по макету: hero-текст ↑80, виджет ↑36, преимущества ↑24, секции через 80.
export default async function Home() {
  let products: Product[] = [];
  try {
    products = (await listProducts({ per_page: 8 })).items;
  } catch {
    // api недоступен — секция «Популярные товары» просто скрывается
  }

  return (
    <main id="main" className="mx-auto flex max-w-content flex-col gap-12 px-4 pb-20 lg:gap-20">
      <section aria-label="Подбор шин" className="pt-10 lg:pt-20">
        <div className="flex flex-col items-center gap-4 text-center">
          <h1 className="flex flex-wrap items-center justify-center gap-3 text-h2 text-black lg:gap-4 lg:text-h1">
            Подберем шины за
            <span className="rounded-field bg-blue px-4 py-1.5 text-white lg:px-6 lg:py-2">
              30 секунд
            </span>
          </h1>
          <p className="text-field text-grey lg:text-subtitle">
            По размеру, по авто или поиск по каталогу
          </p>
        </div>
        <div className="mt-9">
          <SearchWidget />
        </div>
        <div className="mt-6">
          <BenefitsBar />
        </div>
      </section>

      <ServicesSection />

      {products.length > 0 && (
        <section aria-labelledby="popular-h" className="flex flex-col gap-6 lg:gap-8">
          <div className="flex items-center justify-between gap-4">
            <h2 id="popular-h" className="text-h2 text-black">
              Популярные товары
            </h2>
            <Link href="/catalog" className="shrink-0 text-nav text-blue hover:underline">
              Весь каталог →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {products.map((p) => (
              // TODO: изображения товаров придут из SelectTyres; пока плейсхолдер
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
