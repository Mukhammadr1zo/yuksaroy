import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/** Link va navigatsiya shu yerdan olinadi: til prefiksi avtomatik qo'shiladi. */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
