import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';

// Next 16 da middleware o'rniga proxy. Ikki vazifa: til prefiksi va yopiq bo'limlar uchun kirish tekshiruvi.
const intl = createIntlMiddleware(routing);

/** Til prefiksini olib tashlab, ichki yo'lni qaytaradi: /ru/dashboard → /dashboard */
function stripLocale(pathname: string) {
  for (const l of routing.locales) {
    if (pathname === `/${l}`) return '/';
    if (pathname.startsWith(`/${l}/`)) return pathname.slice(l.length + 1);
  }
  return pathname;
}

/** Manzildagi til prefiksi: /ru/dashboard -> ru (standart tilda prefiks yo'q). */
function localeOf(pathname: string) {
  return routing.locales.find((l) => l !== routing.defaultLocale && (pathname === `/${l}` || pathname.startsWith(`/${l}/`)));
}

export function proxy(req: NextRequest) {
  const path = stripLocale(req.nextUrl.pathname);

  // Brauzer tili e'tiborga olinmaydi (routing.ts), lekin odamning o'z tanlovi esda qolsin:
  // prefiksiz manzilga kelganda cookie ru/en bo'lsa, o'sha tilga o'tkaziladi.
  if (!localeOf(req.nextUrl.pathname)) {
    const picked = req.cookies.get('NEXT_LOCALE')?.value;
    if (picked && picked !== routing.defaultLocale && (routing.locales as readonly string[]).includes(picked)) {
      const to = new URL(`/${picked}${path === '/' ? '' : path}`, req.url);
      to.search = req.nextUrl.search;
      return NextResponse.redirect(to);
    }
  }

  // /admin - moderatsiya maydoni: mehmonga qobiq ham ko'rinmasin (huquqni sahifa qayta tekshiradi)
  const guarded = path.startsWith('/dashboard') || path.startsWith('/admin');
  if (guarded && !(req.cookies.has('ys_access') || req.cookies.has('ys_refresh'))) {
    // Kirish sahifasi ham o'sha tilda ochilsin (ilgari ruscha havola o'zbekcha formaga tushardi)
    const loc = localeOf(req.nextUrl.pathname);
    const to = new URL(loc ? `/${loc}/login` : '/login', req.url);
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
