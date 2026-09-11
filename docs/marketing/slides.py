# -*- coding: utf-8 -*-
"""YukSaroy Telegram karuseli: birinchi reklama. 7 slayd, 1080x1350 (4:5).

Odam YukSaroy nima ekanini bilmaydi, shuning uchun tartib reklama tartibi:
tanish muammo -> nomi va ta'rifi -> nima bor -> qayerga kirish.
Platforma ichki gaplari (e'lon qo'shish, komissiya, bot, til ro'yxati) bu postda yo'q.

Fon tungi navy: saytdagi xarita hero bilan bir tilda. Belgi har slaydda bir marta.
Amber faqat bitta narsani belgilaydi va takrorlanmaydi.
Shrift loyihaning o'zinikidan (Manrope); lotin va kirill bitta faylga birlashtirilgan,
chunki kirill to'plamida tinish belgilari yo'q edi.
"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = 'C:/Users/user/Desktop/yuksaroy'
S = 'C:/Users/user/AppData/Local/Temp/claude/c--Users-user-Desktop-yuksaroy/78e67323-cd98-4531-8135-5427ce383077/scratchpad'
OUT = os.path.join(S, 'carousel')
os.makedirs(OUT, exist_ok=True)

W, H = 1080, 1350
PAD = 88

NAVY = (0, 35, 82)
TEAL = (5, 151, 158)
TEAL_D = (7, 127, 132)
AMBER = (253, 123, 3)
PAPER = (246, 241, 231)
BODY = (222, 230, 242)
MUTED = (143, 179, 217)
RULE = (255, 255, 255, 38)

F = lambda w, size: ImageFont.truetype(os.path.join(S, 'fonts', 'manrope-%s.ttf' % w), size)


def wrap(d, text, font, max_w):
    words, lines, cur = text.split(), [], ''
    for w_ in words:
        t = (cur + ' ' + w_).strip()
        if d.textlength(t, font=font) <= max_w:
            cur = t
        else:
            if cur:
                lines.append(cur)
            cur = w_
    if cur:
        lines.append(cur)
    return lines


def block(d, x, y, text, font, fill, max_w, lh=1.22, after=0):
    for ln in wrap(d, text, font, max_w):
        d.text((x, y), ln, font=font, fill=fill)
        y += int(font.size * lh)
    return y + after


def measure(d, text, font, max_w, lh=1.22, after=0):
    return len(wrap(d, text, font, max_w)) * int(font.size * lh) + after


def base(watermark=True):
    im = Image.new('RGB', (W, H), NAVY)
    d = ImageDraw.Draw(im, 'RGBA')
    for i in range(260):  # yumshoq yorug'lik: yassi to'q fon o'rniga chuqurlik
        d.ellipse([W - 520 - i, -420 - i, W + 320 + i, 420 + i], outline=(5, 151, 158, int(26 * (1 - i / 260.0))))
    if watermark:
        mark = Image.open(os.path.join(ROOT, 'apps/web/public/img/logo-mark.png')).convert('RGBA').resize((430, 430), Image.LANCZOS)
        faded = Image.new('RGBA', mark.size, (0, 0, 0, 0))
        faded.putdata([(r, g, b, int(a * 0.06)) for (r, g, b, a) in mark.getdata()])
        im.paste(faded, (W - 430 - PAD, H - 430 - 210), faded)
    return im, ImageDraw.Draw(im, 'RGBA')


def footer(d):
    d.line([(PAD, H - 148), (W - PAD, H - 148)], fill=RULE, width=2)
    d.text((PAD, H - 118), 'yuksaroy.uz', font=F('600', 34), fill=MUTED)


def logo_row(im, d, y=PAD):
    mark = Image.open(os.path.join(ROOT, 'apps/web/public/img/logo-mark.png')).convert('RGBA')
    plate = Image.new('RGBA', (108, 108), (0, 0, 0, 0))
    ImageDraw.Draw(plate).rounded_rectangle([0, 0, 107, 107], 28, fill=(255, 255, 255, 255))
    m = mark.resize((80, 80), Image.LANCZOS)
    plate.paste(m, (14, 14), m)
    im.paste(plate, (PAD, y), plate)
    f = F('800', 52)
    d.text((PAD + 132, y + 26), 'Yuk', font=f, fill=PAPER)
    d.text((PAD + 132 + d.textlength('Yuk', font=f), y + 26), 'Saroy', font=f, fill=TEAL)


# ---------- 1. Tanish muammo ----------
im, d = base(watermark=False)
logo_row(im, d)
y = 470
y = block(d, PAD, y, u"Terminal. Vagon. Yuk mashinasi.", F('800', 92), PAPER, W - 2 * PAD, 1.1, 34)
d.line([(PAD, y), (PAD + 150, y)], fill=AMBER, width=8)
y += 48
y = block(d, PAD, y, u"Qayerdan qidirasiz?", F('600', 56), TEAL, W - 2 * PAD, 1.2, 26)
block(d, PAD, y, u"\u0413\u0434\u0435 \u0438\u0441\u043a\u0430\u0442\u044c?", F('600', 46), MUTED, W - 2 * PAD, 1.2)
footer(d)
im.save(os.path.join(OUT, '1.jpg'), quality=92)

# ---------- 2. Nomi va ta'rifi ----------
im, d = base(watermark=False)
y = 330
f = F('800', 130)
d.text((PAD, y), 'Yuk', font=f, fill=PAPER)
d.text((PAD + d.textlength('Yuk', font=f), y), 'Saroy', font=f, fill=TEAL)
y += 196
d.line([(PAD, y), (PAD + 150, y)], fill=TEAL, width=8)
y += 48
y = block(d, PAD, y, u"O'zbekistondagi yuk xizmatlari bozori. Terminal, shahobcha yo'l, temir yo'l texnikasi va avtotransport bitta platformada.", F('400', 46), BODY, W - 2 * PAD - 20, 1.36, 44)
block(d, PAD, y, u"\u041c\u0430\u0440\u043a\u0435\u0442\u043f\u043b\u0435\u0439\u0441 \u0433\u0440\u0443\u0437\u043e\u0432\u044b\u0445 \u0443\u0441\u043b\u0443\u0433 \u0423\u0437\u0431\u0435\u043a\u0438\u0441\u0442\u0430\u043d\u0430: \u0442\u0435\u0440\u043c\u0438\u043d\u0430\u043b\u044b, \u043f\u043e\u0434\u044a\u0435\u0437\u0434\u043d\u044b\u0435 \u043f\u0443\u0442\u0438, \u0436\u0435\u043b\u0435\u0437\u043d\u043e\u0434\u043e\u0440\u043e\u0436\u043d\u0430\u044f \u0442\u0435\u0445\u043d\u0438\u043a\u0430 \u0438 \u0430\u0432\u0442\u043e\u0442\u0440\u0430\u043d\u0441\u043f\u043e\u0440\u0442.", F('400', 42), TEAL, W - 2 * PAD - 20, 1.34)
footer(d)
im.save(os.path.join(OUT, '2.jpg'), quality=92)

# ---------- 3-6. To'rt yo'nalish, qidiruvchi ko'zi bilan ----------
CATS = [
    ('01', u"Terminal xizmatlari", u"\u0422\u0435\u0440\u043c\u0438\u043d\u0430\u043b\u044c\u043d\u044b\u0435 \u0443\u0441\u043b\u0443\u0433\u0438",
     [u"Yuklash, tushirish, saqlash", u"Bojxona ombori va SVX", u"Tarif va bugungi bo'sh joylar"], None, None),
    ('02', u"Shahobcha yo'llar", u"\u041f\u043e\u0434\u044a\u0435\u0437\u0434\u043d\u044b\u0435 \u043f\u0443\u0442\u0438",
     [u"Stansiya, uzunlik, sig'im", u"Xaritada joylashuvi", u"Egasi bilan bevosita aloqa"], None, None),
    ('03', u"Temir yo'l texnikasi", u"\u0416\u0435\u043b\u0435\u0437\u043d\u043e\u0434\u043e\u0440\u043e\u0436\u043d\u0430\u044f \u0442\u0435\u0445\u043d\u0438\u043a\u0430",
     [u"Manevr teplovozi, elektrovoz", u"Yarim vagon, platforma, sisterna", u"Ijara va sotuv, narxi bilan"], None, None),
    ('04', u"Avtotransport", u"\u0410\u0432\u0442\u043e\u0442\u0440\u0430\u043d\u0441\u043f\u043e\u0440\u0442",
     [u"Tent, refrijerator, samosval, tral", u"Viloyat va yo'nalish bo'yicha", u"Haydovchi bilan bevosita"], None, None),
]
for i, (no, uz, ru, rows, big, biglab) in enumerate(CATS, start=3):
    im, d = base()
    d.text((PAD, PAD + 6), no, font=F('800', 150), fill=(255, 255, 255, 26))
    d.line([(PAD, 300), (PAD + 110, 300)], fill=TEAL, width=8)
    # Blok chiziq bilan futer orasida markazlashadi: raqamsiz slaydlarda pastda bo'shliq qolardi
    h = measure(d, uz, F('800', 78), W - 2 * PAD, 1.1, 12)
    h += measure(d, ru, F('600', 42), W - 2 * PAD, 1.2, 56)
    for r in rows:
        h += measure(d, r, F('400', 40), W - 2 * PAD - 44, 1.3, 22)
    if big:
        h += 40 + 140 + 46
    y = max(360, 300 + (H - 148 - 300 - h) // 2)
    y = block(d, PAD, y, uz, F('800', 78), PAPER, W - 2 * PAD, 1.1, 12)
    y = block(d, PAD, y, ru, F('600', 42), TEAL, W - 2 * PAD, 1.2, 56)
    for r in rows:
        d.ellipse([PAD + 4, y + 17, PAD + 18, y + 31], fill=TEAL_D)
        y = block(d, PAD + 44, y, r, F('400', 40), BODY, W - 2 * PAD - 44, 1.3, 22)
    if big:
        y += 40
        d.text((PAD, y), big, font=F('800', 118), fill=AMBER)
        d.text((PAD, y + 140), biglab, font=F('600', 34), fill=MUTED)
    footer(d)
    im.save(os.path.join(OUT, '%d.jpg' % i), quality=92)

# ---------- 7. Kirish ----------
im, d = base(watermark=False)
logo_row(im, d)
y = 450
y = block(d, PAD, y, u"Qidirish bepul", F('800', 96), PAPER, W - 2 * PAD, 1.1, 30)
d.line([(PAD, y), (PAD + 150, y)], fill=TEAL, width=8)
y += 48
y = block(d, PAD, y, u"Ro'yxatdan o'tmasdan ko'rishingiz mumkin. Narx va shartlarni obyekt egasining o'zi yozadi.", F('400', 46), BODY, W - 2 * PAD - 20, 1.36, 36)
block(d, PAD, y, u"\u041f\u043e\u0438\u0441\u043a \u0431\u0435\u0441\u043f\u043b\u0430\u0442\u043d\u044b\u0439, \u0431\u0435\u0437 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u0438. \u0426\u0435\u043d\u0443 \u0438 \u0443\u0441\u043b\u043e\u0432\u0438\u044f \u043f\u0438\u0448\u0435\u0442 \u0441\u0430\u043c \u0432\u043b\u0430\u0434\u0435\u043b\u0435\u0446.", F('400', 42), TEAL, W - 2 * PAD - 20, 1.34)
d.rounded_rectangle([PAD, H - 348, PAD + 580, H - 348 + 112], 56, fill=TEAL_D)
d.text((PAD + 58, H - 348 + 30), 'yuksaroy.uz', font=F('800', 48), fill=(255, 255, 255))
footer(d)
im.save(os.path.join(OUT, '7.jpg'), quality=92)

for f in sorted(os.listdir(OUT), key=lambda x: int(x.split('.')[0])):
    print(f, os.path.getsize(os.path.join(OUT, f)) // 1024, 'KB')
