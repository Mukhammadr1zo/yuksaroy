/**
 * Surat qatori: xizmat profili va bozor so'rovi sahifalarida.
 *
 * Sarlavhasiz: suratlar o'zi tushunarli. Bosilganda asl o'lchamda ochiladi, chunki
 * yukning yoki guvohnomaning tafsiloti kichik kartada ko'rinmaydi.
 * Hook yo'q, shuning uchun server sahifadan ham, mijoz komponentidan ham chaqiriladi.
 *
 * `alt` chaqiruvchidan keladi (hook yo'qligi uchun shu yerda tarjima olinmaydi): har surat
 * havola, havolaning nomi esa shu matndan tuziladi. Alt bo'sh bo'lsa havola nomsiz qolar,
 * ekran o'quvchi esa uni manzil bilan o'qib berardi.
 */
export function PhotoStrip({ photos, alt }: { photos: string[] | undefined; alt: string }) {
  if (!photos?.length) return null;
  const n = photos.length;
  return (
    <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
      {photos.map((url, i) => (
        <li key={url} className="aspect-[4/3] overflow-hidden rounded-xl border border-line bg-sand">
          <a href={url} target="_blank" rel="noopener" className="block h-full w-full outline-none focus-visible:ring-2 focus-visible:ring-teal/40">
            {/* Bir nechta surat bo'lsa tartib raqami ham: aks holda hamma havola bir xil nomda bo'lardi */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={n > 1 ? `${alt} (${i + 1}/${n})` : alt} loading="lazy" decoding="async" className="h-full w-full object-cover" />
          </a>
        </li>
      ))}
    </ul>
  );
}
