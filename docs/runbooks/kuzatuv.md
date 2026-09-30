# Kuzatuv: sayt yiqilsa qanday bilinadi

## Hozirgi holat

Serverdagi ikkala taymer 2026-yil 11-sentabrdan beri ishlab turibdi va tekshirildi: sog'liq tekshiruvi har 5 daqiqada yuradi, zaxira har kuni olinadi, Telegramga xabar berish sozlangan (`BOT_TOKEN` va `ALERT_CHAT_ID` `/opt/yuksaroy/.env` ichida bor).

Lekin unit fayllarining o'zi faqat serverda edi, repoda emas. Ya'ni ularni hech kim ko'rib chiqa olmasdi, o'zgarishi tarixda qolmasdi va server qaytadan qurilsa yo'qolardi. Endi ular `deploy/systemd/` da.

## Ikkita mustaqil tekshiruv

| Qayerda yuradi | Qancha vaqtda | Nimani ushlaydi |
|---|---|---|
| Serverning o'zida, systemd taymer | har 5 daqiqada | ilova yoki konteyner yiqilgani |
| GitHub Actions, `uptime.yml` | soatiga bir marta | serverning o'zi o'lgani |

Serverdagi tekshiruv tez, lekin u serverning ichida turadi: server o'lsa, tarmoq uzilsa yoki disk to'lsa xabar hech qachon kelmaydi. Tashqi tekshiruv sekin, lekin aynan shu holatni ushlaydi.

Tashqi tekshiruv nega soatiga bir marta: yopiq repoda Actions daqiqalari sanaladi va har yugurish kamida bitta daqiqa deb hisoblanadi. Har besh daqiqada yugursa oyiga sakkiz mingdan ortiq daqiqa ketardi va deploy uchun joy qolmasdi.

## Tekshirish

```bash
systemctl list-timers 'yuksaroy-*'          # keyingi yurish vaqti
systemctl start yuksaroy-health.service      # darhol bir marta
journalctl -u yuksaroy-health.service -n 20
ls -lh /var/backups/yuksaroy | tail
```

## Server qaytadan qurilganda o'rnatish

```bash
cd /opt/yuksaroy
cp deploy/systemd/yuksaroy-*.service deploy/systemd/yuksaroy-*.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now yuksaroy-health.timer yuksaroy-backup.timer
```

Xabar kelishi uchun `/opt/yuksaroy/.env` ichida `BOT_TOKEN` va `ALERT_CHAT_ID` bo'lishi kerak. Ular bo'lmasa tekshiruv baribir yuradi, faqat Telegramga yozmaydi va buni jurnalda aytadi.

Repodagi `yuksaroy-health.service` da serverdagi nusxada yo'q bitta qator bor: `Wants=network-online.target`. Sababi faylning o'zida yozilgan. Serverdagi nusxani yangilash shart emas, lekin keyingi `cp` da u o'zi tushadi.

## Zaxira vaqti

`OnCalendar=*-*-* 21:30:00`. Server soati UTC da, ya'ni bu Toshkentda 02:30. Bu yerga 02:00 deb yozib qo'yilsa zaxira Toshkent vaqti bilan ertalab 07:00 da, ish vaqtida olinardi.

Tashqi nusxa uchun `rclone` sozlangan bo'lsa `RCLONE_REMOTE` beriladi. Bitta diskdagi zaxira zaxira emas: disk o'lsa u ham ketadi.

## GitHub tomonida

`Settings > Secrets and variables > Actions > Secrets` ga ikkita sir qo'shiladi, buni loyiha egasi o'zi qiladi:

- `ALERT_BOT_TOKEN` Telegram bot tokeni
- `ALERT_CHAT_ID` xabar keladigan suhbat

Qo'shilmasa tekshiruv yuraveradi va natija Actions jurnalida ko'rinadi. Qo'lda yurgizish: `Actions > Uptime > Run workflow`.

## Uzilish yozuvi

Har safar holat almashganda serverdagi skript bitta qator yozadi:

```
/var/lib/yuksaroy/outages.log
2026-10-02T14:31:09Z yiqildi web=502 api=000
2026-10-02T14:41:12Z tiklandi
```

Bu yozuv shartlardagi "bizning aybimiz bilan ishlamagan kunlar obuna muddatiga qo'shiladi" degan va'dani hisoblash uchun. Undan oldin bunday manba yo'q edi, ya'ni va'dani bajarib bo'lmasdi. Fayl o'sib ketmaydi: qator faqat holat almashganda qo'shiladi.
