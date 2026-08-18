import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/blocks/Breadcrumbs";
import { TyreCalc } from "./TyreCalc";

// «Шинный калькулятор» (Figma → «Инфо — Шинный калькулятор», 125:1088).
// URL /tyres-calc/ — 1:1 со старым сайтом (SEO). Страница серверная,
// интерактив — только в клиентском TyreCalc.

export const metadata: Metadata = {
  title: "Шинный калькулятор — сравнение размеров шин | TireStock",
  description:
    "Сравните текущий и новый размер шин: изменение внешнего диаметра, клиренса и показаний спидометра. Подскажем, допустима ли замена.",
};

export default function TyresCalcPage() {
  return (
    <main id="main" className="mx-auto max-w-content px-4 pb-20">
      <Breadcrumbs
        items={[{ label: "Главная", href: "/" }, { label: "Шины" }, { label: "Шинный калькулятор" }]}
      />

      <h1 className="mt-6 text-h2 text-black lg:text-h1">Шинный калькулятор</h1>
      <p className="mt-6 max-w-182 text-body text-dark">
        Сравните текущий и новый размер шин: изменение диаметра, клиренса и показаний
        спидометра.
      </p>

      <TyreCalc />
    </main>
  );
}
