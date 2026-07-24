import { cookies } from "next/headers";
import { CITY_COOKIE, DEFAULT_CITY, isCity, type City } from "@/lib/city";

// Серверное чтение выбранного города из куки. Отдельный файл от lib/city.ts,
// т.к. "next/headers" ломает сборку клиентских компонентов (CitySwitcher),
// которым нужны только клиент-safe данные (CITIES/City/isCity) из lib/city.ts.
export async function getCity(): Promise<City> {
  const store = await cookies();
  const v = store.get(CITY_COOKIE)?.value;
  return isCity(v) ? v : DEFAULT_CITY;
}
