import { NextResponse, type NextRequest } from "next/server";
import { listProducts, type ProductFilters, type Season } from "@/lib/api/client";
import { getCity } from "@/lib/get-city";

// Живой счётчик «Показать N шин»: клиентские фильтр/hero дёргают его при изменении
// выбора (до применения). Серверный роут — чтобы браузер не ходил во внутренний API.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const num = (k: string) => {
    const n = parseInt(sp.get(k) ?? "", 10);
    return Number.isNaN(n) ? undefined : n;
  };
  const str = (k: string) => sp.get(k) || undefined;
  const bool = (k: string) => (sp.get(k) === "true" ? true : undefined);

  // Город берём из куки (сервер), а не из query — клиентский счётчик его не шлёт.
  const city = await getCity();

  const filters: ProductFilters = {
    q: str("q"),
    width: num("width"),
    profile: num("profile"),
    diameter: num("diameter"),
    season: str("season") as Season | undefined,
    brand: str("brand"),
    price_min: num("price_min"),
    price_max: num("price_max"),
    spikes: bool("spikes"),
    runflat: bool("runflat"),
    city,
    per_page: 1,
  };

  try {
    const { total } = await listProducts(filters);
    return NextResponse.json({ total });
  } catch {
    return NextResponse.json({ total: null });
  }
}
