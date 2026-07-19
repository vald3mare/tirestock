import type { Metadata, Viewport } from "next";
import { Footer } from "@/components/blocks/Footer";
import { Header } from "@/components/blocks/Header";
import "@/styles/globals.css";

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export const metadata: Metadata = {
  title: "TireStock — шины и диски в Санкт-Петербурге",
  description: "Интернет-магазин шин и дисков: подбор по размеру и по авто, шиномонтаж, хранение колёс.",
};

const preloadFonts = [
  "manrope-500-cyrillic.woff2",
  "manrope-500-latin.woff2",
  "manrope-600-cyrillic.woff2",
  "manrope-600-latin.woff2",
  "manrope-800-cyrillic.woff2",
  "manrope-800-latin.woff2",
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        {preloadFonts.map((f) => (
          <link
            key={f}
            rel="preload"
            href={`/fonts/${f}`}
            as="font"
            type="font/woff2"
            crossOrigin="anonymous"
          />
        ))}
      </head>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-field focus:bg-blue focus:px-5 focus:py-2.5 focus:text-nav focus:text-white"
        >
          Перейти к содержимому
        </a>
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
