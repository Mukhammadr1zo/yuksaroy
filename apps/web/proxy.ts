import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';

// Next 16 da middleware o'rniga proxy. Ikki vazifa: til prefiksi va /dashboard uchun kirish tekshiruvi.
const intl = createIntlMiddleware(routing);

/** Til prefiksini olib tashlab, ichki yo'lni qaytaradi: /ru/dashboard → /dashboard */
function stripLocale(pathname: string) {
  for (const l of routing.locales) {
    if (pathname === `/${l}`) return '/';
    if (pathname.startsWith(`/${l}/`)) return pathname.slice(l.length + 1);
  }
  return pathname;
}

export function proxy(req: NextRequest) {
  const path = stripLocale(req.nextUrl.pathname);
  const guarded = path.startsWith('/dashboard');
  if (guarded && !(req.cookies.has('ys_access') || req.cookies.has('ys_refresh'))) {
    const to = new URL('/login', req.url);
    to.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(to);
  }
  return intl(req);
}

export const config = {
  // API, statik fayllar va Next ichki yo'llari tegilmaydi
  // Nuqtali yo'llar (fayllar) tashlab ketiladi. Backslash o'rniga [.] : qochish xatosi bo'lmasin.
  matcher: ['/((?!api|_next|_vercel|.*[.].*).*)'],
};
