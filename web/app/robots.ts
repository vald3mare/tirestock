import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { isIndexable } from "@/lib/site-env";

// /robots.txt. Индексация - по хосту: тестовый домен (tirestock.website) и любой
// не-боевой хост → полный Disallow; боевой (SITE_PRIMARY_HOST=tirestock.ru) - открыт,
// кроме приватных/технических разделов. Читаем хост из заголовков (роут динамический).
export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get("host");
  if (!isIndexable(host)) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", disallow: ["/admin", "/cart", "/dev"] },
  };
}
