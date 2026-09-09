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
  ['/kabinet/sorovlar', '/dashboard/inquiries'],
  ['/kabinet/tashkilot', '/dashboard/organization'],
  ['/kabinet/shahobchalar', '/dashboard/sidings'],
  ['/kabinet/admin', '/dashboard/admin'],
  ['/kabinet', '/dashboard'],
  ['/terminal', '/dashboard/terminal'],
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

const config: NextConfig = {
  transpilePackages: ['@yuksaroy/domain'],
  experimental: { globalNotFound: true },
  // Bir xil origin: brauzer /api/v1/* → NestJS. httpOnly cookie'lar shu tufayli ishlaydi.
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${API}/v1/:path*` }];
  },
  async redirects() {
    // Har bir eski yo'l: prefiksiz (uz) va /:locale bilan, oddiy va ichki (:path*)
    return OLD_ROUTES.flatMap(([from, to]) =>
      ['', '/:locale(uz|ru|en)'].flatMap((p) => [
        { source: `${p}${from}`, destination: `${p}${to}`, permanent: true },
        { source: `${p}${from}/:path*`, destination: `${p}${to}/:path*`, permanent: true },
      ]),
    );
  },
};

export default createNextIntlPlugin('./i18n/request.ts')(config);
