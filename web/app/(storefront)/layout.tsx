import { Footer } from "@/components/blocks/Footer";
import { Header } from "@/components/blocks/Header";

// Каркас витрины: скип-ссылка + шапка + футер. Админка (/admin) сюда не входит —
// у неё свой каркас с тёмным сайдбаром (см. app/admin).
export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-field focus:bg-blue focus:px-5 focus:py-2.5 focus:text-nav focus:text-white"
      >
        Перейти к содержимому
      </a>
      <Header />
      {children}
      <Footer />
    </>
  );
}
