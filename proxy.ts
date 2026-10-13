import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "./lib/config";

// El navegador pide el manifest sin cookies: tiene que ser público
const ACTIVITY_COOKIE = "seen";

const PUBLIC_PATHS = ["/login", "/auth", "/unavailable", "/manifest.webmanifest"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url: supabaseUrl, key: supabaseKey } = supabaseConfig();

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Refresca la sesión. No meter código entre createServerClient y getClaims.
  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = !!data?.claims;
  const { pathname, search } = request.nextUrl;

  if (!isLoggedIn && !PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return redirectKeepingCookies(url, response);
  }

  if (isLoggedIn && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return redirectKeepingCookies(url, response);
  }

  // Actividad para el panel de admin: una vez al día por navegador (la cookie evita repetir la consulta)
  if (isLoggedIn) {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
    if (request.cookies.get(ACTIVITY_COOKIE)?.value !== today) {
      const { error } = await supabase.rpc("touch_activity");
      if (!error)
        response.cookies.set(ACTIVITY_COOKIE, today, { path: "/", maxAge: 60 * 60 * 24 * 2, sameSite: "lax" });
    }
  }

  return response;
}

function redirectKeepingCookies(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
