import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync('.env','utf8').split(/\r?\n/).filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim()];}));
const T = env.BOT_TOKEN;
// Mini App manzili: menyu tugmasi faqat https bilan; aks holda buyruqlar menyusi qoladi
const APP_URL = env.TG_APP_URL || `${env.WEB_URL || 'http://localhost:3000'}/tg`;
const post = async (m, body) => {
  const r = await fetch(`https://api.telegram.org/bot${T}/${m}`, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(body) });
  const j = await r.json();
  console.log((j.ok ? 'OK   ' : 'XATO ') + m.padEnd(22), j.ok ? '' : JSON.stringify(j));
  return j.ok;
};

const SHORT = {
  uz: "Yuk logistikasi bozori. Terminal qidiruvi va saytga kirish kodi shu yerda.",
  ru: "Маркетплейс грузовой логистики. Поиск терминалов и код входа здесь.",
  en: "Freight logistics marketplace. Terminal search and your login code here.",
};
const DESC = {
  uz: "Yuk logistikasi bozori: terminal xizmatlari, shahobcha yo'llar, temir yo'l texnikasi va avtotransport. Egalar o'z xizmat va texnikasini e'lon qiladi, siz keraklisini topasiz.\n\nBu bot saytga kirish uchun kerak. Telefon raqamingizni tasdiqlaysiz, kirish kodi shu yerga keladi. Kod 5 daqiqa amal qiladi.\n\nBoshlash uchun pastdagi tugmani bosing.",
  ru: "Маркетплейс грузовой логистики: услуги терминалов, подъездные пути, железнодорожная техника и автотранспорт. Владельцы публикуют свои услуги и технику, а вы находите нужное.\n\nБот нужен для входа на сайт. Вы подтверждаете номер телефона, код входа приходит сюда. Код действует 5 минут.\n\nНажмите кнопку ниже, чтобы начать.",
  en: "A freight logistics marketplace: terminal services, private sidings, rail equipment and road transport. Owners publish their services and equipment, and you find what you need.\n\nThis bot is used to sign in. You confirm your phone number and the login code arrives here. The code is valid for 5 minutes.\n\nPress the button below to start.",
};
const CMDS = {
  uz: [{command:'app',description:'Mini ilovani ochish'},{command:'qidir',description:"Terminal qidirish, masalan: /qidir Andijonda tushirish"},{command:'vagon',description:'Vagon qayerda, masalan: /vagon 24567890'},{command:'start',description:"Boshlash va telefon raqamini tasdiqlash"},{command:'help',description:'Bot nima qiladi'}],
  ru: [{command:'app',description:'Открыть мини-приложение'},{command:'qidir',description:'Поиск терминала, например: /qidir выгрузка в Андижане'},{command:'vagon',description:'Где вагон, например: /vagon 24567890'},{command:'start',description:'Начать и подтвердить номер телефона'},{command:'help',description:'Что умеет бот'}],
  en: [{command:'app',description:'Open the Mini App'},{command:'qidir',description:'Find a terminal, e.g. /qidir unloading in Andijan'},{command:'vagon',description:'Where is my wagon, e.g. /vagon 24567890'},{command:'start',description:'Start and confirm your phone number'},{command:'help',description:'What this bot does'}],
};

await post('setMyName', { name: 'YukSaroy' });
for (const [lang, v] of Object.entries(SHORT)) await post('setMyShortDescription', lang==='uz' ? { short_description: v } : { short_description: v, language_code: lang });
for (const [lang, v] of Object.entries(DESC))  await post('setMyDescription',      lang==='uz' ? { description: v }       : { description: v, language_code: lang });
for (const [lang, v] of Object.entries(CMDS))  await post('setMyCommands',         lang==='uz' ? { commands: v }          : { commands: v, language_code: lang });
await post('setChatMenuButton', { menu_button: APP_URL.startsWith('https://') ? { type: 'web_app', text: 'Ilova', web_app: { url: APP_URL } } : { type: 'commands' } });
