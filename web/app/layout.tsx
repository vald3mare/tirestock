import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export const metadata: Metadata = {
  title: "TireStock — шины и диски в Санкт-Петербурге",
  description: "Интернет-магазин шин и дисков: подбор по размеру, шиномонтаж, хранение колёс.",
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
      <body>{children}</body>
    </html>
  );
}
