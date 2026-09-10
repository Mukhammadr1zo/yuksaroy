// Til ichidagi 404: notFound() chaqirilganda (o'chirilgan e'lon, eski slug) Next ning inglizcha
// standart sahifasi o'rniga o'z mazmunimiz chiqadi. Layout [locale] dan meros: html lang to'g'ri.
import { NotFoundBody } from '@/components/site/NotFoundBody';

export default function LocaleNotFound() {
  return <NotFoundBody />;
}
