/**
 * Surat qatori: xizmat profili va bozor so'rovi sahifalarida.
 *
 * Sarlavhasiz: suratlar o'zi tushunarli. Bosilganda asl o'lchamda ochiladi, chunki
 * yukning yoki guvohnomaning tafsiloti kichik kartada ko'rinmaydi.
 * Hook yo'q, shuning uchun server sahifadan ham, mijoz komponentidan ham chaqiriladi.
 */
export function PhotoStrip({ photos }: { photos: string[] | undefined }) {
  if (!photos?.length) return null;
  return (
    <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
      {photos.map((url) => (
        <li key={url} className="aspect-[4/3] overflow-hidden rounded-xl border border-line bg-sand">
          <a href={url} target="_blank" rel="noopener" className="block h-full w-full outline-none focus-visible:ring-2 focus-visible:ring-teal/40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
          </a>
        </li>
      ))}
    </ul>
  );
}
