import { NextResponse, type NextRequest } from "next/server";
import { CITY_COOKIE, isCity } from "@/lib/city";

// Ставит куку выбранного города на год. Клиентский переключатель дёргает POST,
// затем делает router.refresh() — серверные страницы перечитывают куку.
export async function POST(req: NextRequest) {
  const city = req.nextUrl.searchParams.get("city") ?? "";
  if (!isCity(city)) {
    return NextResponse.json({ error: "bad city" }, { status: 400 });
  }
  const res = new NextResponse(null, { status: 204 });
  res.cookies.set(CITY_COOKIE, city, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return res;
}
