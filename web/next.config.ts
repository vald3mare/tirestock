import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    // Фото товаров из SelectTyres: сервер оптимизирует (webp + ресайз) и кэширует,
    // браузер грузит лёгкую версию нужного размера.
    remotePatterns: [{ protocol: "https", hostname: "lk.selectyre.ru" }],
  },
};

export default nextConfig;
