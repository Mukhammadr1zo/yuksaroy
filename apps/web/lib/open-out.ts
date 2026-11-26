// Mini App ichida sayt sahifasi web view'ni almashtirmasin (TgProvider, tab paneli va Orqaga yo'qolardi): Telegram brauzerida ochiladi.
// Tekshiruv bosilganda: render paytida window yo'q (server), saytda esa Telegram obyekti yo'q va havola odatdagidek ishlaydi.
export const openOut = (locale: string, path: string) => (e: React.MouseEvent) => {
  const w = window.Telegram?.WebApp;
  if (!w?.initData) return;
  e.preventDefault();
  w.openLink(`${window.location.origin}${locale === 'uz' ? '' : `/${locale}`}${path}`);
};
