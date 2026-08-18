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
  const res = adminGate(req);
  if (!isIndexable()) {
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return res;
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
