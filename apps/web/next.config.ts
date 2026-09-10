import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Monorepo ildizidagi .env bitta manba (API ham shuni o'qiydi); mavjud o'zgaruvchilar ustidan yozilmaydi
const rootEnv = resolve(process.cwd(), '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const API = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

// Eski o'zbekcha yo'llar -> inglizcha (308). Tartib muhim: aniq kabinet yo'llari umumiy /kabinet/:path* dan oldin.
const OLD_ROUTES: [string, string][] = [
  ['/kabinet/buyurtmalar', '/dashboard/orders'],
  ['/kabinet/buyurtma/yangi', '/dashboard/orders/new'],
  ['/kabinet/elonlar/yangi', '/dashboard/listings/new'],
  ['/kabinet/elonlar', '/dashboard/listings'],
  ['/kabinet/tashkilot', '/dashboard/organization'],
  ['/kabinet/shahobchalar', '/dashboard/sidings'],
  ['/kabinet', '/dashboard'],
  ['/kirish', '/login'],
  ['/royxat', '/signup'],
  ['/terminallar', '/terminals'],
  ['/shahobchalar', '/sidings'],
  ['/texnika', '/equipment'],
  ['/avtotransport', '/carriers'],
  ['/kompaniyalar', '/companies'],
  ['/standart', '/standards'],
  ['/hisob', '/quote'],
];

// Ko'chgan sahifalar: aniq yo'lning o'zi yo'naltiriladi, ichki yo'llari tegilmaydi
// (/dashboard/urgent -> band, lekin /dashboard/urgent/:id o'z sahifasida qoladi).
const MOVED: [string, string][] = [
  ['/dashboard/terminal', '/dashboard/orders?tab=incoming'],
  ['/dashboard/urgent', '/dashboard/orders?tab=urgent'],
  ['/dashboard/admin', '/admin'],
  ['/kabinet/sorovlar', '/dashboard/inquiries'],
  ['/kabinet/admin', '/admin'],
  ['/terminal', '/dashboard/orders?tab=incoming'],
];

const config: NextConfig = {
  transpilePackages: ['@yuksaroy/domain'],
  // Konteynerda faqat .next/standalone kerak (node_modules siz kichik obraz)
  output: process.env.NEXT_STANDALONE === '1' ? 'standalone' : undefined,
  outputFileTracingRoot: resolve(process.cwd(), '../..'),
  experimental: { globalNotFound: true },
  // Bir xil origin: brauzer /api/v1/* → NestJS. httpOnly cookie'lar shu tufayli ishlaydi.
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${API}/v1/:path*` }];
  },
  async redirects() {
    // Har bir eski yo'l: prefiksiz (uz) va /:locale bilan, oddiy va ichki (:path*)
    const prefixes = ['', '/:locale(uz|ru|en)'];
    return [
      // MOVED birinchi: aniq yo'llar OLD_ROUTES dagi umumiy /kabinet/:path* dan oldin tekshirilsin.
      // Vaqtinchalik (307): kabinet ichki tuzilishi hali o'zgarishi mumkin, brauzer keshlab qolmasin.
      ...MOVED.flatMap(([from, to]) => prefixes.map((p) => ({ source: `${p}${from}`, destination: `${p}${to}`, permanent: false }))),
      ...OLD_ROUTES.flatMap(([from, to]) =>
        prefixes.flatMap((p) => [
          { source: `${p}${from}`, destination: `${p}${to}`, permanent: true },
          { source: `${p}${from}/:path*`, destination: `${p}${to}/:path*`, permanent: true },
        ]),
      ),
    ];
  },
};

export default createNextIntlPlugin('./i18n/request.ts')(config);
