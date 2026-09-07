import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/admin-cookie";
import { isIndexable } from "@/lib/site-env";

// Два дела на каждый запрос:
// 1) Гейт индексации: пока сайт не на боевом домене (SITE_INDEXABLE≠true) —
//    вешаем X-Robots-Tag: noindex на ВСЕ ответы. Это сильнее robots.txt: Google
//    убирает из индекса уже обойдённые страницы даже без чтения robots.txt.
// 2) Дешёвый гард /admin/*: проверяет лишь наличие куки сессии (валидность — на
//    серверных страницах через requireUser). Без куки → на логин; с кукой на
//    логине → в админку.
export function middleware(req: NextRequest) {
  // 0) 301-редиректы старых SEO-URL старого сайта (структура URL наследуется 1:1
  //    или 301 — правило проекта). Проверяем ДО остального.
  const legacy = legacyRedirect(req);
  if (legacy) {
    if (!isIndexable()) legacy.headers.set("X-Robots-Tag", "noindex, nofollow");
    return legacy;
  }
  const res = adminGate(req);
  if (!isIndexable()) {
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return res;
}

// legacyRedirect: 301 со старых индексированных URL (tirestock.ru) на новые.
// Старый сайт: каталог /tyres/, диски /wheels/, SEO-поиски /tyres/search-*.
// null — не легаси-URL (идём дальше).
function legacyRedirect(req: NextRequest): NextResponse | null {
  const p = req.nextUrl.pathname.replace(/\/+$/, "") || "/";
  const to = (dest: string) => {
    const url = req.nextUrl.clone();
    const [path, query] = dest.split("?");
    url.pathname = path;
    url.search = query ? "?" + query : "";
    return NextResponse.redirect(url, 301);
  };
  const brand = (s: string) => encodeURIComponent(s.replace(/-/g, " "));

  // Услуги, которых больше нет (покраска/ремонт дисков, мотошиномонтаж) → шиномонтаж.
  if (p === "/disk-repair" || p === "/disk-painting" || p === "/motomounting") return to("/mounting/");

  // Диски: подбор по авто (скрыт) → каталог дисков; старые SEO-поиски дисков.
  if (p === "/wheels/auto") return to("/wheels/");
  let m = p.match(/^\/wheels\/search-r(\d{2})$/);
  if (m) return to(`/wheels/?diameter=${m[1]}`);
  m = p.match(/^\/wheels\/search-(.+)$/);
  if (m) return to(`/wheels/?brand=${brand(m[1])}`);

  // Шины: старый каталог и подбор по авто → новый каталог.
  if (p === "/tyres" || p === "/tyres/auto") return to("/catalog/");
  // Сезонные посадочные.
  if (p === "/tyres/search-summer") return to("/catalog/?season=summer");
  if (p === "/tyres/search-winter") return to("/catalog/?season=winter");
  if (p === "/tyres/search-winter-spike") return to("/catalog/?season=winter&spikes=true");
  if (p === "/tyres/search-winter-no_spike") return to("/catalog/?season=winter");
  // Радиус + сезон: /tyres/search-r15-summer/.
  m = p.match(/^\/tyres\/search-r(\d{2})-(summer|winter|allseason)$/);
  if (m) return to(`/catalog/?diameter=${m[1]}&season=${m[2]}`);
  // Только радиус: /tyres/search-r15/.
  m = p.match(/^\/tyres\/search-r(\d{2})$/);
  if (m) return to(`/catalog/?diameter=${m[1]}`);
  // Бренд: /tyres/search-bridgestone/.
  m = p.match(/^\/tyres\/search-(.+)$/);
  if (m) return to(`/catalog/?brand=${brand(m[1])}`);
  // Прочие старые товарные URL /tyres/<slug>/ — в каталог (не отдаём 404).
  if (p.startsWith("/tyres/")) return to("/catalog/");

  return null;
}

function adminGate(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }
  const hasSession = req.cookies.has(SESSION_COOKIE);
  const isLogin = pathname === "/admin/login";

  if (!hasSession && !isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    return NextResponse.redirect(url);
  }
  if (hasSession && isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

// Все маршруты, кроме статики Next и файлов с расширением (шрифты, картинки,
// robots.txt рендерится роутом app/robots.ts и матчер его не трогает).
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
