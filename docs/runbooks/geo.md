# Joy bazasi: tashriflar va Telegram xabarlarida shahar

Tashrif va kirishlarda mamlakat, viloyat va shahar `GeoLite2-City.mmdb` faylidan olinadi. Fayl serverda `/opt/yuksaroy/geo/` ichida turadi va konteynerga faqat o'qish uchun ulanadi (`deploy/compose.prod.yml`).

## Nega hammasi "ZZ" edi

Konteyner fayl yo'lini ko'rardi, lekin serverda fayl yo'q edi (MaxMind kaliti hech qachon qo'yilmagan). Shuning uchun har tashrif mamlakati "ZZ" bo'lib yozildi va Telegram xabarida "joylashuv aniqlanmadi" chiqadi.

Endi kalit kerak emas: bepul DB-IP City Lite bazasi (CC BY 4.0, oyiga bir yangilanadi) ishlatiladi. Fayl nomi eskisi bilan bir xil, shuning uchun `compose` va `.env` o'zgarmaydi.

## Nima o'zi bo'ladi

- Keyingi deploy `deploy/geo-update.sh --if-missing` ni ishga tushiradi: fayl yo'q yoki 40 kundan eski bo'lsa yuklaydi. Yuklab bo'lmasa deploy yiqilmaydi.
- API faylni soatiga bir tekshiradi va yangisini qayta ishga tushirmasdan oladi.

## Egasining bir martalik qadami: oylik yangilash

Serverda (root):

```bash
cp /opt/yuksaroy/deploy/systemd/yuksaroy-geo.{service,timer} /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now yuksaroy-geo.timer
```

Hozir darhol bir marta yuklash uchun: `systemctl start yuksaroy-geo.service`.

## Tekshirish

```bash
ls -la /opt/yuksaroy/geo                      # GeoLite2-City.mmdb, 20 MB dan katta
journalctl -u yuksaroy-geo.service -n 20      # "yangilandi" qatori
systemctl list-timers yuksaroy-geo.timer      # keyingi ishga tushish sanasi
```

Keyin /admin/visits da mamlakatlar "ZZ" emas, Telegramdagi xabarda esa shahar va viloyat ko'rinadi (eski tashriflar o'zgarmaydi, ular "ZZ" bo'lib yozilgan).

## Muallif ko'rsatish (CC BY 4.0)

Litsenziya havola talab qiladi: `IP Geolocation by DB-IP`, https://db-ip.com. U /admin/visits sahifasida ko'rsatiladi.

## Xotira

DB-IP City Lite taxminan 120-130 MB: `maxmind` faylni to'liq xotiraga o'qiydi, shuning uchun API jarayoni shuncha kattalashadi (soatlik yangilanishda qisqa vaqt ikki nusxa, ~260 MB gacha). Birinchi yuklashdan oldin `docker stats` bilan api konteynerida bo'sh joy borligini tekshiring; tor bo'lsa compose da `mem_limit` bering yoki kichikroq DB-IP Country Lite ni oling (shahar yo'qoladi, viloyat qoladi).
Birinchi yuklashdan keyin: skript fayl rejimi (exec biti) git da yo'q, shuning uchun birlik `/bin/bash` orqali ishga tushadi.
