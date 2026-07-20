import type { Metadata } from "next";
import { UiDemo } from "./ui-demo";

// Служебная страница для сверки UI-кита с Figma. Не индексируется.
export const metadata: Metadata = {
  title: "UI-кит — TireStock (dev)",
  robots: { index: false, follow: false },
};

export default function DevUiPage() {
  return <UiDemo />;
}
