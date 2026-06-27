var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
import MINI_APP_HTML from "./62d77f93ab3967d26267fc54faab819d82a3a93b-miniapp.html";
var TG = "https://api.telegram.org";
var ADMIN_ID = 5002402843;
async function tg(method, body, token) {
  const r = await fetch(`${TG}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await r.json();
  if (!data.ok)
    throw new Error(`TG ${method}: ${data.description}`);
  return data.result;
}
__name(tg, "tg");
var getGroups = /* @__PURE__ */ __name(async (KV) => await KV.get("groups", "json") || {}, "getGroups");
var saveGroups = /* @__PURE__ */ __name(async (KV, d) => KV.put("groups", JSON.stringify(d)), "saveGroups");
var getSession = /* @__PURE__ */ __name(async (KV, pid) => await KV.get(`sess:${pid}`, "json") || {}, "getSession");
var setSession = /* @__PURE__ */ __name(async (KV, pid, d) => KV.put(`sess:${pid}`, JSON.stringify(d), { expirationTtl: 3600 }), "setSession");
var delSession = /* @__PURE__ */ __name(async (KV, pid) => KV.delete(`sess:${pid}`), "delSession");
var getWaiting = /* @__PURE__ */ __name(async (KV, pid) => KV.get(`wait:${pid}`, "json"), "getWaiting");
var setWaiting = /* @__PURE__ */ __name(async (KV, pid, d) => KV.put(`wait:${pid}`, JSON.stringify(d), { expirationTtl: 300 }), "setWaiting");
var delWaiting = /* @__PURE__ */ __name(async (KV, pid) => KV.delete(`wait:${pid}`), "delWaiting");
var getTimer = /* @__PURE__ */ __name(async (KV, gid) => KV.get(`timer:${gid}`, "json"), "getTimer");
var setTimer = /* @__PURE__ */ __name(async (KV, gid, d) => KV.put(`timer:${gid}`, JSON.stringify(d)), "setTimer");
var delTimer = /* @__PURE__ */ __name(async (KV, gid) => KV.delete(`timer:${gid}`), "delTimer");
async function getSettings(KV, gid) {
  let s = await KV.get(`settings:${gid}`, "json");
  if (!s) {
    s = {
      welcomeEnabled: false,
      welcomeText: "\u{1F44B} \u179F\u17BC\u1798\u179F\u17D2\u179C\u17B6\u1782\u1798\u1793\u17CD {name} \u1785\u17BC\u179B\u1780\u17D2\u179A\u17BB\u1798 *{group}*! \u{1F389}",
      autoNotify: {
        openEnabled: true,
        openText: "\u{1F513} Group \u17A5\u17A1\u17BC\u179C\u1794\u17BE\u1780\u179A\u17BD\u1785\u17A0\u17BE\u1799! \u179F\u17BC\u1798\u179F\u17D2\u179C\u17B6\u1782\u1798\u1793\u17CD \u{1F389}",
        closeEnabled: true,
        closeText: "\u{1F512} Group \u1794\u17B6\u1793\u1794\u17B7\u1791\u17A0\u17BE\u1799! \u17A2\u179A\u1782\u17BB\u178E\u179F\u1798\u17D2\u179A\u17B6\u1794\u17CB\u1780\u17B6\u179A\u1785\u17BC\u179B\u179A\u17BD\u1798 \u{1F64F}"
      },
      antiSpam: { enabled: false, maxMessages: 5, windowSeconds: 10, noLinks: false, noForwards: false },
      schedule: { openTime: null, closeTime: null }
    };
    await KV.put(`settings:${gid}`, JSON.stringify(s));
  }
  return s;
}
__name(getSettings, "getSettings");
var saveSettings = /* @__PURE__ */ __name(async (KV, gid, s) => KV.put(`settings:${gid}`, JSON.stringify(s)), "saveSettings");
async function getTTSPref(KV, uid) {
  return await KV.get(`tts:pref:${uid}`, "json") || { gender: "female", speed: "x1" };
}
__name(getTTSPref, "getTTSPref");
async function setTTSPref(KV, uid, pref) {
  await KV.put(`tts:pref:${uid}`, JSON.stringify(pref), { expirationTtl: 365 * 86400 });
}
__name(setTTSPref, "setTTSPref");
async function getTTSCache(KV, key) {
  return KV.get(`tts:cache:${key}`);
}
__name(getTTSCache, "getTTSCache");
async function setTTSCache(KV, key, fileId) {
  await KV.put(`tts:cache:${key}`, fileId, { expirationTtl: 7 * 86400 });
}
__name(setTTSCache, "setTTSCache");
var OPEN_PERMS = { can_send_messages: true, can_send_polls: true, can_send_other_messages: true, can_add_web_page_previews: true, can_change_info: false, can_invite_users: true, can_pin_messages: false };
var CLOSE_PERMS = { can_send_messages: false, can_send_polls: false, can_send_other_messages: false, can_add_web_page_previews: false, can_change_info: false, can_invite_users: false, can_pin_messages: false };
var openGroup = /* @__PURE__ */ __name((gid, token) => tg("setChatPermissions", { chat_id: gid, permissions: OPEN_PERMS }, token), "openGroup");
var closeGroup = /* @__PURE__ */ __name((gid, token) => tg("setChatPermissions", { chat_id: gid, permissions: CLOSE_PERMS }, token), "closeGroup");
async function isAdmin(gid, uid, token) {
  try {
    const m = await tg("getChatMember", { chat_id: gid, user_id: uid }, token);
    return ["administrator", "creator"].includes(m.status);
  } catch {
    return false;
  }
}
__name(isAdmin, "isAdmin");
function formatDuration(m) {
  if (m < 60)
    return `${m} \u1793\u17B6\u1791\u17B8`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} \u1798\u17C9\u17C4\u1784 ${r} \u1793\u17B6\u1791\u17B8` : `${h} \u1798\u17C9\u17C4\u1784`;
}
__name(formatDuration, "formatDuration");
function formatTime(ts) {
  return new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Phnom_Penh" });
}
__name(formatTime, "formatTime");
function currentHHMM() {
  const now = new Date((/* @__PURE__ */ new Date()).toLocaleString("en-US", { timeZone: "Asia/Phnom_Penh" }));
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}
__name(currentHHMM, "currentHHMM");
var MALE_VOICES = {
  "af": "af-ZA-WillemNeural",
  "am": "am-ET-AmehaNeural",
  "ar": "ar-SA-HamedNeural",
  "az": "az-AZ-BabakNeural",
  "bg": "bg-BG-BorislavNeural",
  "bn": "bn-BD-PradeepNeural",
  "bs": "bs-BA-GoranNeural",
  "ca": "ca-ES-EnricNeural",
  "cs": "cs-CZ-AntoninNeural",
  "cy": "cy-GB-AledNeural",
  "da": "da-DK-JeppeNeural",
  "de": "de-DE-FlorianMultilingualNeural",
  "el": "el-GR-NestorasNeural",
  "en": "en-US-AndrewMultilingualNeural",
  "es": "es-ES-AlvaroNeural",
  "et": "et-EE-KertNeural",
  "fa": "fa-IR-FaridNeural",
  "fi": "fi-FI-HarriNeural",
  "fil": "fil-PH-AngeloNeural",
  "fr": "fr-FR-RemyMultilingualNeural",
  "ga": "ga-IE-ColmNeural",
  "gl": "gl-ES-RoiNeural",
  "gu": "gu-IN-NiranjanNeural",
  "he": "he-IL-AvriNeural",
  "hi": "hi-IN-MadhurNeural",
  "hr": "hr-HR-SreckoNeural",
  "hu": "hu-HU-TamasNeural",
  "id": "id-ID-ArdiNeural",
  "is": "is-IS-GunnarNeural",
  "it": "it-IT-GiuseppeMultilingualNeural",
  "ja": "ja-JP-KeitaNeural",
  "jv": "jv-ID-DimasNeural",
  "ka": "ka-GE-GiorgiNeural",
  "kk": "kk-KZ-DauletNeural",
  "km": "km-KH-PisethNeural",
  "kn": "kn-IN-GaganNeural",
  "ko": "ko-KR-HyunsuMultilingualNeural",
  "lo": "lo-LA-ChanthavongNeural",
  "lt": "lt-LT-LeonasNeural",
  "lv": "lv-LV-NilsNeural",
  "mk": "mk-MK-AleksandarNeural",
  "ml": "ml-IN-MidhunNeural",
  "mn": "mn-MN-BataaNeural",
  "mr": "mr-IN-ManoharNeural",
  "ms": "ms-MY-OsmanNeural",
  "mt": "mt-MT-JosephNeural",
  "my": "my-MM-ThihaNeural",
  "nb": "nb-NO-FinnNeural",
  "ne": "ne-NP-SagarNeural",
  "nl": "nl-NL-MaartenNeural",
  "pl": "pl-PL-MarekNeural",
  "ps": "ps-AF-GulNawazNeural",
  "pt": "pt-BR-AntonioNeural",
  "ro": "ro-RO-EmilNeural",
  "ru": "ru-RU-DmitryNeural",
  "si": "si-LK-SameeraNeural",
  "sk": "sk-SK-LukasNeural",
  "sl": "sl-SI-RokNeural",
  "so": "so-SO-MuuseNeural",
  "sq": "sq-AL-IlirNeural",
  "sr": "sr-RS-NicholasNeural",
  "su": "su-ID-JajangNeural",
  "sv": "sv-SE-MattiasNeural",
  "sw": "sw-KE-RafikiNeural",
  "ta": "ta-IN-ValluvarNeural",
  "te": "te-IN-MohanNeural",
  "th": "th-TH-NiwatNeural",
  "tr": "tr-TR-AhmetNeural",
  "uk": "uk-UA-OstapNeural",
  "ur": "ur-IN-SalmanNeural",
  "uz": "uz-UZ-SardorNeural",
  "vi": "vi-VN-NamMinhNeural",
  "zh-CN": "zh-CN-YunyangNeural",
  "zh-TW": "zh-TW-YunJheNeural",
  "zu": "zu-ZA-ThembaNeural"
};
var FEMALE_VOICES = {
  "af": "af-ZA-AdriNeural",
  "am": "am-ET-MekdesNeural",
  "ar": "ar-SA-ZariyahNeural",
  "az": "az-AZ-BanuNeural",
  "bg": "bg-BG-KalinaNeural",
  "bn": "bn-BD-NabanitaNeural",
  "bs": "bs-BA-VesnaNeural",
  "ca": "ca-ES-JoanaNeural",
  "cs": "cs-CZ-VlastaNeural",
  "cy": "cy-GB-NiaNeural",
  "da": "da-DK-ChristelNeural",
  "de": "de-DE-SeraphinaMultilingualNeural",
  "el": "el-GR-AthinaNeural",
  "en": "en-US-AvaMultilingualNeural",
  "es": "es-ES-XimenaNeural",
  "et": "et-EE-AnuNeural",
  "fa": "fa-IR-DilaraNeural",
  "fi": "fi-FI-NooraNeural",
  "fil": "fil-PH-BlessicaNeural",
  "fr": "fr-FR-VivienneMultilingualNeural",
  "ga": "ga-IE-OrlaNeural",
  "gl": "gl-ES-SabelaNeural",
  "gu": "gu-IN-DhwaniNeural",
  "he": "he-IL-HilaNeural",
  "hi": "hi-IN-SwaraNeural",
  "hr": "hr-HR-GabrijelaNeural",
  "hu": "hu-HU-NoemiNeural",
  "id": "id-ID-GadisNeural",
  "is": "is-IS-GudrunNeural",
  "it": "it-IT-IsabellaNeural",
  "ja": "ja-JP-NanamiNeural",
  "jv": "jv-ID-SitiNeural",
  "ka": "ka-GE-EkaNeural",
  "kk": "kk-KZ-AigulNeural",
  "km": "km-KH-SreymomNeural",
  "kn": "kn-IN-SapnaNeural",
  "ko": "ko-KR-SunHiNeural",
  "lo": "lo-LA-KeomanyNeural",
  "lt": "lt-LT-OnaNeural",
  "lv": "lv-LV-EveritaNeural",
  "mk": "mk-MK-MarijaNeural",
  "ml": "ml-IN-SobhanaNeural",
  "mn": "mn-MN-YesuiNeural",
  "mr": "mr-IN-AarohiNeural",
  "ms": "ms-MY-YasminNeural",
  "mt": "mt-MT-GraceNeural",
  "my": "my-MM-NilarNeural",
  "nb": "nb-NO-PernilleNeural",
  "ne": "ne-NP-HemkalaNeural",
  "nl": "nl-NL-ColetteNeural",
  "pl": "pl-PL-ZofiaNeural",
  "ps": "ps-AF-LatifaNeural",
  "pt": "pt-BR-ThalitaMultilingualNeural",
  "ro": "ro-RO-AlinaNeural",
  "ru": "ru-RU-SvetlanaNeural",
  "si": "si-LK-ThiliniNeural",
  "sk": "sk-SK-ViktoriaNeural",
  "sl": "sl-SI-PetraNeural",
  "so": "so-SO-UbaxNeural",
  "sq": "sq-AL-AnilaNeural",
  "sr": "sr-RS-SophieNeural",
  "su": "su-ID-TutiNeural",
  "sv": "sv-SE-SofieNeural",
  "sw": "sw-KE-ZuriNeural",
  "ta": "ta-IN-PallaviNeural",
  "te": "te-IN-ShrutiNeural",
  "th": "th-TH-PremwadeeNeural",
  "tr": "tr-TR-EmelNeural",
  "uk": "uk-UA-PolinaNeural",
  "ur": "ur-IN-GulNeural",
  "uz": "uz-UZ-MadinaNeural",
  "vi": "vi-VN-HoaiMyNeural",
  "zh-CN": "zh-CN-XiaoxiaoNeural",
  "zh-TW": "zh-TW-HsiaoChenNeural",
  "zu": "zu-ZA-ThandoNeural"
};
var SPEED_RATES = { "x0.5": "-50%", "x1": "+0%", "x1.5": "+50%", "x2": "+100%" };
var SPEED_LABELS = { "x0.5": "\u{1F422} x0.5", "x1": "\u25B6\uFE0F x1", "x1.5": "\u26A1 x1.5", "x2": "\u{1F680} x2" };
var SCRIPT_MAP = [
  [/[\u1780-\u17FF]/, "km"],
  [/[\u0E00-\u0E7F]/, "th"],
  [/[\u0E80-\u0EFF]/, "lo"],
  [/[\u1000-\u109F]/, "my"],
  [/[\u1200-\u137F]/, "am"],
  [/[\u10A0-\u10FF]/, "ka"],
  [/[\u0590-\u05FF]/, "he"],
  [/[\u0900-\u097F]/, "hi"],
  [/[\u0980-\u09FF]/, "bn"],
  [/[\u0A80-\u0AFF]/, "gu"],
  [/[\u0B80-\u0BFF]/, "ta"],
  [/[\u0C00-\u0C7F]/, "te"],
  [/[\u0C80-\u0CFF]/, "kn"],
  [/[\u0D00-\u0D7F]/, "ml"],
  [/[\u0D80-\u0DFF]/, "si"],
  [/[\u0600-\u06FF]/, "ar"],
  [/[\u3040-\u30FF]/, "ja"],
  [/[\uAC00-\uD7AF]/, "ko"],
  [/[\u4E00-\u9FFF\u3400-\u4DBF]/, "zh-CN"],
  [/[\u0400-\u04FF]/, "ru"]
];
function detectLang(text) {
  for (const [pattern, lang] of SCRIPT_MAP) {
    if (pattern.test(text))
      return lang;
  }
  return "en";
}
__name(detectLang, "detectLang");
function getVoice(lang, gender) {
  const map = gender === "male" ? MALE_VOICES : FEMALE_VOICES;
  return map[lang] || map["en"];
}
__name(getVoice, "getVoice");
function stripUnspeakable(text) {
  return text.replace(/[\u{1F000}-\u{1FFFF}]/gu, "").replace(/[\u2600-\u27FF\u2B00-\u2BFF\uFE00-\uFEFF]/g, "").replace(/[\uD800-\uDFFF]/g, "").trim();
}
__name(stripUnspeakable, "stripUnspeakable");
var GOOGLE_TTS_LANG = {
  km: "km",
  en: "en",
  th: "th",
  zh: "zh-CN",
  ja: "ja",
  ko: "ko",
  vi: "vi",
  fr: "fr",
  de: "de",
  es: "es",
  ru: "ru",
  ar: "ar",
  hi: "hi",
  pt: "pt",
  it: "it",
  id: "id",
  ms: "ms",
  tr: "tr",
  pl: "pl",
  nl: "nl",
  sv: "sv",
  da: "da",
  fi: "fi",
  no: "no",
  uk: "uk",
  cs: "cs",
  ro: "ro",
  hu: "hu",
  el: "el",
  he: "he",
  bn: "bn",
  ur: "ur",
  fa: "fa",
  ta: "ta",
  te: "te",
  ml: "ml",
  my: "my",
  lo: "lo",
  si: "si",
  mn: "mn"
};
var GOOGLE_TTS_SPEED = {
  slow: "0.7",
  x1: "1",
  fast: "1.3",
  x15: "1.5"
};
async function synthesizeTTS(text, lang, speed = "x1") {
  const cleanText = stripUnspeakable(text);
  if (!cleanText)
    throw new Error("No speakable text");
  const gLang = GOOGLE_TTS_LANG[lang] || "en";
  const gSpeed = GOOGLE_TTS_SPEED[speed] || "1";
  const MAX = 180;
  const parts = [];
  let remaining = cleanText;
  while (remaining.length > 0) {
    if (remaining.length <= MAX) {
      parts.push(remaining);
      break;
    }
    let cut = remaining.lastIndexOf(" ", MAX);
    if (cut <= 0)
      cut = MAX;
    parts.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  const buffers = [];
  for (const part of parts) {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(part)}&tl=${gLang}&ttsspeed=${gSpeed}&client=tw-ob`;
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://translate.google.com/",
        "Accept": "audio/mpeg,audio/*;q=0.9,*/*;q=0.8"
      }
    });
    if (!resp.ok)
      throw new Error(`Google TTS HTTP ${resp.status} for lang=${gLang}`);
    buffers.push(new Uint8Array(await resp.arrayBuffer()));
  }
  if (buffers.length === 1)
    return buffers[0];
  const total = buffers.reduce((s, c) => s + c.byteLength, 0);
  const merged = new Uint8Array(total);
  let off = 0;
  for (const c of buffers) {
    merged.set(c, off);
    off += c.byteLength;
  }
  return merged;
}
__name(synthesizeTTS, "synthesizeTTS");
async function sendVoice(chatId, audioOrFileId, token, extra = {}) {
  if (typeof audioOrFileId === "string") {
    return tg("sendVoice", { chat_id: chatId, voice: audioOrFileId, ...extra }, token);
  }
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("voice", new Blob([audioOrFileId], { type: "audio/mpeg" }), "voice.mp3");
  for (const [k, v] of Object.entries(extra)) {
    form.append(k, typeof v === "object" ? JSON.stringify(v) : String(v));
  }
  const r = await fetch(`${TG}/bot${token}/sendVoice`, { method: "POST", body: form });
  const data = await r.json();
  if (!data.ok)
    throw new Error(`sendVoice: ${data.description}`);
  return data.result;
}
__name(sendVoice, "sendVoice");
function buildVoiceKeyboard(gender, speed) {
  const gRow = [
    { text: `${gender === "female" ? "\u2705 " : ""}\u{1F469} \u179F\u17D2\u179A\u17B8`, callback_data: "voice:female" },
    { text: `${gender === "male" ? "\u2705 " : ""}\u{1F468} \u1794\u17D2\u179A\u17BB\u179F`, callback_data: "voice:male" }
  ];
  const sRow = Object.keys(SPEED_RATES).map((s) => ({
    text: (s === speed ? "\u2705 " : "") + SPEED_LABELS[s],
    callback_data: `set_speed:${s}`
  }));
  return { inline_keyboard: [gRow, sRow] };
}
__name(buildVoiceKeyboard, "buildVoiceKeyboard");
async function handleTTS(msg, KV, token) {
  const text = msg.text?.trim();
  if (!text || text.length < 1)
    return;
  if (/^\s*$/.test(stripUnspeakable(text)))
    return;
  const uid = msg.from?.id || msg.chat.id;
  const pref = await getTTSPref(KV, uid);
  const gender = pref.gender || "female";
  const speed = pref.speed || "x1";
  const rate = SPEED_RATES[speed] || "+0%";
  const lang = detectLang(text);
  const voice = getVoice(lang, gender);
  const rawKey = `${voice}:${speed}:${text}`;
  const keyBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawKey));
  const cacheKey = Array.from(new Uint8Array(keyBuf)).slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");
  const keyboard = buildVoiceKeyboard(gender, speed);
  tg("sendChatAction", { chat_id: msg.chat.id, action: "record_voice" }, token).catch(() => {
  });
  try {
    const cached = await getTTSCache(KV, cacheKey);
    if (cached) {
      await sendVoice(msg.chat.id, cached, token, {
        caption: "\u{1F508} Text to Voice Bot",
        reply_to_message_id: msg.message_id,
        reply_markup: keyboard
      });
      return;
    }
    const audioBytes = await synthesizeTTS(text, lang, speed);
    const result = await sendVoice(msg.chat.id, audioBytes, token, {
      caption: "\u{1F508} Text to Voice Bot",
      reply_to_message_id: msg.message_id,
      reply_markup: keyboard
    });
    const fileId = result?.voice?.file_id;
    if (fileId)
      await setTTSCache(KV, cacheKey, fileId).catch(() => {
      });
  } catch (err) {
    console.error("TTS error:", err.message);
    await tg("sendMessage", {
      chat_id: msg.chat.id,
      text: "\u26A0\uFE0F \u1798\u17B6\u1793\u1794\u1789\u17D2\u17A0\u17B6\u1780\u17D2\u1793\u17BB\u1784\u1780\u17B6\u179A\u1794\u1784\u17D2\u1780\u17BE\u178F\u179F\u17C6\u17A1\u17C1\u1784\u17D4 \u179F\u17BC\u1798\u1796\u17D2\u1799\u17B6\u1799\u17B6\u1798\u1798\u17D2\u178F\u1784\u1791\u17C0\u178F\u17D4",
      reply_to_message_id: msg.message_id
    }, token).catch(() => {
    });
  }
}
__name(handleTTS, "handleTTS");
function groupListKeyboard(groups) {
  return { inline_keyboard: Object.values(groups).map((g) => [{ text: `\u{1F465} ${g.title}`, callback_data: `sel_${g.id}` }]) };
}
__name(groupListKeyboard, "groupListKeyboard");
function mainMenuKeyboard(hasTimer) {
  const openBtn = hasTimer ? { text: "\u{1F512} \u1794\u17B7\u1791 Group", callback_data: "action_close" } : { text: "\u{1F513} \u1794\u17BE\u1780 Group", callback_data: "menu_open" };
  return { inline_keyboard: [
    [openBtn, { text: "\u{1F4CA} \u179F\u17D2\u1790\u17B7\u178F\u17B7", callback_data: "action_stats" }],
    [{ text: "\u{1F4E2} Broadcast", callback_data: "action_broadcast" }, { text: "\u{1F4CC} Pin/Unpin", callback_data: "menu_pin" }],
    [{ text: "\u{1F6AB} \u1782\u17D2\u179A\u1794\u17CB\u1782\u17D2\u179A\u1784\u179F\u1798\u17B6\u1787\u17B7\u1780", callback_data: "menu_members" }],
    [{ text: "\u23F0 Schedule", callback_data: "menu_schedule" }, { text: "\u2699\uFE0F Settings", callback_data: "menu_settings" }],
    [{ text: "\xAB \u1787\u17D2\u179A\u17BE\u179F Group \u1795\u17D2\u179F\u17C1\u1784", callback_data: "back_groups" }]
  ] };
}
__name(mainMenuKeyboard, "mainMenuKeyboard");
var durationKeyboard = { inline_keyboard: [
  [{ text: "5 \u1793\u17B6\u1791\u17B8", callback_data: "open_5" }, { text: "10 \u1793\u17B6\u1791\u17B8", callback_data: "open_10" }, { text: "15 \u1793\u17B6\u1791\u17B8", callback_data: "open_15" }],
  [{ text: "30 \u1793\u17B6\u1791\u17B8", callback_data: "open_30" }, { text: "1 \u1798\u17C9\u17C4\u1784", callback_data: "open_60" }, { text: "2 \u1798\u17C9\u17C4\u1784", callback_data: "open_120" }],
  [{ text: "\u2328\uFE0F \u1780\u17C6\u178E\u178F\u17CB\u1795\u17D2\u1791\u17B6\u179B\u17CB\u1781\u17D2\u179B\u17BD\u1793", callback_data: "open_custom" }],
  [{ text: "\xAB \u178F\u17D2\u179A\u17A1\u1794\u17CB", callback_data: "back_control" }]
] };
var membersKeyboard = { inline_keyboard: [
  [{ text: "\u{1F6AB} Kick", callback_data: "member_kick" }, { text: "\u26D4 Ban", callback_data: "member_ban" }],
  [{ text: "\u{1F507} Mute", callback_data: "member_mute" }, { text: "\u{1F50A} Unmute", callback_data: "member_unmute" }],
  [{ text: "\xAB \u178F\u17D2\u179A\u17A1\u1794\u17CB", callback_data: "back_control" }]
] };
var pinKeyboard = { inline_keyboard: [
  [{ text: "\u{1F4CC} Pin (\u179C\u17B6\u1799 Message ID)", callback_data: "pin_request" }],
  [{ text: "\u{1F4CD} Unpin \u179F\u17B6\u179A\u1785\u17BB\u1784\u1780\u17D2\u179A\u17C4\u1799", callback_data: "pin_unpin" }],
  [{ text: "\xAB \u178F\u17D2\u179A\u17A1\u1794\u17CB", callback_data: "back_control" }]
] };
function scheduleKeyboard(s) {
  return { inline_keyboard: [
    [{ text: `\u{1F513} \u1798\u17C9\u17C4\u1784\u1794\u17BE\u1780: ${s.schedule.openTime || "\u2014"}`, callback_data: "schedule_set_open" }],
    [{ text: `\u{1F512} \u1798\u17C9\u17C4\u1784\u1794\u17B7\u1791: ${s.schedule.closeTime || "\u2014"}`, callback_data: "schedule_set_close" }],
    [{ text: "\u{1F5D1} \u179B\u17BB\u1794 Schedule", callback_data: "schedule_clear" }],
    [{ text: "\xAB \u178F\u17D2\u179A\u17A1\u1794\u17CB", callback_data: "back_control" }]
  ] };
}
__name(scheduleKeyboard, "scheduleKeyboard");
function settingsKeyboard(s) {
  const notifyOn = s.autoNotify.openEnabled || s.autoNotify.closeEnabled;
  return { inline_keyboard: [
    [{ text: `\u{1F44B} Welcome: ${s.welcomeEnabled ? "\u2705 ON" : "\u274C OFF"}`, callback_data: "settings_welcome_toggle" }],
    [{ text: "\u270F\uFE0F \u1780\u17C2 Welcome Text", callback_data: "settings_welcome_text" }],
    [{ text: `\u{1F514} Auto-Notify: ${notifyOn ? "\u2705 ON" : "\u274C OFF"}`, callback_data: "menu_notify" }],
    [{ text: `\u{1F916} Anti-Spam: ${s.antiSpam.enabled ? "\u2705 ON" : "\u274C OFF"}`, callback_data: "menu_antispam" }],
    [{ text: "\xAB \u178F\u17D2\u179A\u17A1\u1794\u17CB", callback_data: "back_control" }]
  ] };
}
__name(settingsKeyboard, "settingsKeyboard");
function notifyKeyboard(s) {
  return { inline_keyboard: [
    [{ text: `\u{1F513} \u1787\u17BC\u1793\u178A\u17C6\u178E\u17B9\u1784\u1796\u17C1\u179B\u1794\u17BE\u1780: ${s.autoNotify.openEnabled ? "\u2705" : "\u274C"}`, callback_data: "notify_toggle_open" }],
    [{ text: "\u270F\uFE0F \u1780\u17C2 Open Text", callback_data: "notify_edit_open" }],
    [{ text: `\u{1F512} \u1787\u17BC\u1793\u178A\u17C6\u178E\u17B9\u1784\u1796\u17C1\u179B\u1794\u17B7\u1791: ${s.autoNotify.closeEnabled ? "\u2705" : "\u274C"}`, callback_data: "notify_toggle_close" }],
    [{ text: "\u270F\uFE0F \u1780\u17C2 Close Text", callback_data: "notify_edit_close" }],
    [{ text: "\xAB \u178F\u17D2\u179A\u17A1\u1794\u17CB", callback_data: "menu_settings" }]
  ] };
}
__name(notifyKeyboard, "notifyKeyboard");
function antiSpamKeyboard(s) {
  const a = s.antiSpam;
  return { inline_keyboard: [
    [{ text: `\u{1F916} Anti-Spam: ${a.enabled ? "\u2705 ON" : "\u274C OFF"}`, callback_data: "antispam_toggle" }],
    [{ text: `\u{1F517} Block Links: ${a.noLinks ? "\u2705" : "\u274C"}`, callback_data: "antispam_toggle_links" }],
    [{ text: `\u21AA\uFE0F Block Forwards: ${a.noForwards ? "\u2705" : "\u274C"}`, callback_data: "antispam_toggle_forwards" }],
    [{ text: `\u{1F4E8} \u178A\u17C2\u1793\u1780\u17C6\u178E\u178F\u17CB: ${a.maxMessages} msg/${a.windowSeconds}s`, callback_data: "antispam_cycle_limit" }],
    [{ text: "\xAB \u178F\u17D2\u179A\u17A1\u1794\u17CB", callback_data: "menu_settings" }]
  ] };
}
__name(antiSpamKeyboard, "antiSpamKeyboard");
function memberActionKeyboard() {
  return { inline_keyboard: [
    [{ text: "\u{1F6AB} Kick", callback_data: "do_kick" }, { text: "\u26D4 Ban", callback_data: "do_ban" }],
    [{ text: "\u{1F507} Mute 1\u1798\u17C9\u17C4\u1784", callback_data: "do_mute_60" }, { text: "\u{1F507} Mute 24\u1798\u17C9\u17C4\u1784", callback_data: "do_mute_1440" }],
    [{ text: "\u{1F50A} Unmute", callback_data: "do_unmute" }],
    [{ text: "\xAB \u178F\u17D2\u179A\u17A1\u1794\u17CB", callback_data: "menu_members" }]
  ] };
}
__name(memberActionKeyboard, "memberActionKeyboard");
async function showGroupList(pid, msgId, KV, token) {
  const groups = await getGroups(KV);
  const count = Object.keys(groups).length;
  const text = count ? "\u{1F465} *\u1787\u17D2\u179A\u17BE\u179F Group \u178A\u17C2\u179B\u1785\u1784\u17CB\u1782\u17D2\u179A\u1794\u17CB\u1782\u17D2\u179A\u1784:*" : "\u26A0\uFE0F Bot \u1798\u17B7\u1793\u1791\u17B6\u1793\u17CB\u178F\u17D2\u179A\u17BC\u179C\u1794\u17B6\u1793\u1794\u1793\u17D2\u1790\u17C2\u1798\u1791\u17C5 Group \u178E\u17B6\u1798\u17BD\u1799\u1791\u17C1\u17D4\n\n\u179F\u17BC\u1798 Add bot \u1785\u17BC\u179B Group \u17A0\u17BE\u1799 \u178F\u17C2\u1784\u178F\u17B6\u17C6\u1784\u1787\u17B6 Admin \u1798\u17BB\u1793\u17D4";
  const opts = { parse_mode: "Markdown", ...count ? { reply_markup: groupListKeyboard(groups) } : {} };
  if (msgId)
    await tg("editMessageText", { chat_id: pid, message_id: msgId, text, ...opts }, token);
  else
    await tg("sendMessage", { chat_id: pid, text, ...opts }, token);
}
__name(showGroupList, "showGroupList");
async function showDashboard(pid, msgId, gid, KV, token) {
  const groups = await getGroups(KV);
  const g = groups[gid];
  const timer = await getTimer(KV, gid);
  const s = await getSettings(KV, gid);
  const status = timer ? `\u{1F7E2} \u1780\u17C6\u1796\u17BB\u1784\u1794\u17BE\u1780 (\u1794\u17B7\u1791 ${formatTime(timer.closeAt)})` : "\u{1F534} \u1794\u17B6\u1793\u1794\u17B7\u1791";
  const notifyOn = s.autoNotify.openEnabled || s.autoNotify.closeEnabled;
  const text = `\u{1F39B} *Dashboard \u2014 ${g.title}*

\u{1F4CD} \u179F\u17D2\u1790\u17B6\u1793\u1797\u17B6\u1796: ${status}
\u{1F44B} Welcome: ${s.welcomeEnabled ? "ON" : "OFF"}   \u{1F916} Anti-Spam: ${s.antiSpam.enabled ? "ON" : "OFF"}
\u{1F514} Auto-Notify: ${notifyOn ? "ON" : "OFF"}   \u23F0 Schedule: ${s.schedule.openTime || s.schedule.closeTime ? "ON" : "OFF"}`;
  await tg("editMessageText", { chat_id: pid, message_id: msgId, parse_mode: "Markdown", text, reply_markup: mainMenuKeyboard(!!timer) }, token);
}
__name(showDashboard, "showDashboard");
async function activateOpen(pid, msgId, gid, minutes, KV, token) {
  await delTimer(KV, gid);
  await openGroup(gid, token);
  const closeAt = Date.now() + minutes * 6e4;
  const groups = await getGroups(KV);
  const title = groups[gid]?.title || String(gid);
  const s = await getSettings(KV, gid);
  await setTimer(KV, gid, { closeAt, adminChatId: pid, menuMessageId: msgId, groupTitle: title });
  if (s.autoNotify.openEnabled) {
    try {
      await tg("sendMessage", { chat_id: gid, text: s.autoNotify.openText }, token);
    } catch {
    }
  }
  await tg("editMessageText", {
    chat_id: pid,
    message_id: msgId,
    parse_mode: "Markdown",
    text: `\u2705 *Group \u1794\u17BE\u1780\u179A\u17BD\u1785\u17A0\u17BE\u1799!*

\u{1F465} Group: *${title}*
\u23F1 \u179A\u1799\u17C8\u1796\u17C1\u179B: *${formatDuration(minutes)}*
\u{1F550} \u1793\u17B9\u1784\u1794\u17B7\u1791 \u1793\u17C5\u1798\u17C9\u17C4\u1784 *${formatTime(closeAt)}*`,
    reply_markup: { inline_keyboard: [
      [{ text: "\u{1F512} \u1794\u17B7\u1791\u1797\u17D2\u179B\u17B6\u1798\u17D7", callback_data: "action_close" }],
      [{ text: "\xAB \u178F\u17D2\u179A\u17A1\u1794\u17CB Dashboard", callback_data: "back_control" }]
    ] }
  }, token);
}
__name(activateOpen, "activateOpen");
async function runCron(KV, token) {
  const now = Date.now();
  const hhmm = currentHHMM();
  const timerList = await KV.list({ prefix: "timer:" });
  for (const key of timerList.keys) {
    const timer = await KV.get(key.name, "json");
    if (!timer || timer.closeAt > now)
      continue;
    const gid = key.name.slice(6);
    await delTimer(KV, gid);
    const s = await getSettings(KV, gid);
    try {
      await closeGroup(gid, token);
    } catch {
    }
    if (s.autoNotify.closeEnabled) {
      try {
        await tg("sendMessage", { chat_id: Number(gid), text: s.autoNotify.closeText }, token);
      } catch {
      }
    }
    if (timer.adminChatId) {
      try {
        await tg("sendMessage", {
          chat_id: timer.adminChatId,
          parse_mode: "Markdown",
          text: `\u{1F512} *${timer.groupTitle}* \u1794\u17B6\u1793\u1794\u17B7\u1791\u178A\u17C4\u1799\u179F\u17D2\u179C\u17D0\u1799\u1794\u17D2\u179A\u179C\u178F\u17D2\u178F\u17B7!`
        }, token);
      } catch {
      }
    }
  }
  const groups = await getGroups(KV);
  for (const gid of Object.keys(groups)) {
    const s = await getSettings(KV, gid);
    const lastRunKey = `sched_last:${gid}`;
    const lastRun = await KV.get(lastRunKey);
    if (s.schedule.openTime === hhmm && lastRun !== `open:${hhmm}`) {
      await KV.put(lastRunKey, `open:${hhmm}`, { expirationTtl: 120 });
      try {
        await openGroup(gid, token);
        if (s.autoNotify.openEnabled)
          await tg("sendMessage", { chat_id: Number(gid), text: s.autoNotify.openText }, token);
      } catch {
      }
    }
    if (s.schedule.closeTime === hhmm && lastRun !== `close:${hhmm}`) {
      await KV.put(lastRunKey, `close:${hhmm}`, { expirationTtl: 120 });
      try {
        await delTimer(KV, gid);
        await closeGroup(gid, token);
        if (s.autoNotify.closeEnabled)
          await tg("sendMessage", { chat_id: Number(gid), text: s.autoNotify.closeText }, token);
      } catch {
      }
    }
  }
}
__name(runCron, "runCron");
async function handleMyChatMember(update, KV) {
  const chat = update.chat;
  const status = update.new_chat_member.status;
  if (!["group", "supergroup"].includes(chat.type))
    return;
  const groups = await getGroups(KV);
  if (["member", "administrator"].includes(status))
    groups[chat.id] = { id: chat.id, title: chat.title };
  else if (["left", "kicked"].includes(status))
    delete groups[chat.id];
  await saveGroups(KV, groups);
}
__name(handleMyChatMember, "handleMyChatMember");
async function handleGroupMessage(msg, KV, token) {
  const chat = msg.chat;
  if (!["group", "supergroup"].includes(chat.type))
    return;
  const gid = chat.id;
  const groups = await getGroups(KV);
  if (!groups[gid] || groups[gid].title !== chat.title) {
    groups[gid] = { id: gid, title: chat.title };
    await saveGroups(KV, groups);
  }
  const s = await getSettings(KV, String(gid));
  if (msg.new_chat_members) {
    if (s.welcomeEnabled) {
      for (const member of msg.new_chat_members) {
        if (member.is_bot)
          continue;
        const name = member.first_name + (member.last_name ? ` ${member.last_name}` : "");
        const text = s.welcomeText.replace("{name}", `[${name}](tg://user?id=${member.id})`).replace("{group}", chat.title || "");
        try {
          await tg("sendMessage", { chat_id: gid, text, parse_mode: "Markdown" }, token);
        } catch {
        }
      }
    }
    return;
  }
  if (!s.antiSpam.enabled || !msg.from || msg.from.is_bot)
    return;
  const uid = msg.from.id;
  const adminCheck = await isAdmin(gid, uid, token);
  if (adminCheck)
    return;
  let shouldDelete = false, reason = "";
  if (s.antiSpam.noLinks && msg.text && /(https?:\/\/|t\.me\/|@\w{5,})/i.test(msg.text)) {
    shouldDelete = true;
    reason = "\u{1F517} Link";
  }
  if (!shouldDelete && s.antiSpam.noForwards && (msg.forward_date || msg.forward_from || msg.forward_from_chat)) {
    shouldDelete = true;
    reason = "\u21AA\uFE0F Forward";
  }
  if (!shouldDelete) {
    const spamKey = `spam:${gid}:${uid}`;
    const raw = await KV.get(spamKey, "json") || [];
    const now = Date.now();
    const win = s.antiSpam.windowSeconds * 1e3;
    const recent = raw.filter((t) => now - t < win);
    recent.push(now);
    await KV.put(spamKey, JSON.stringify(recent), { expirationTtl: s.antiSpam.windowSeconds + 5 });
    if (recent.length > s.antiSpam.maxMessages) {
      shouldDelete = true;
      reason = "\u{1F4E8} Spam";
    }
  }
  if (shouldDelete) {
    try {
      await tg("deleteMessage", { chat_id: gid, message_id: msg.message_id }, token);
      await tg("sendMessage", {
        chat_id: gid,
        parse_mode: "Markdown",
        text: `\u26A0\uFE0F \u179F\u17B6\u179A\u178F\u17D2\u179A\u17BC\u179C\u1794\u17B6\u1793\u179B\u17BB\u1794 (${reason}) \u2014 [${msg.from.first_name}](tg://user?id=${uid})`
      }, token);
    } catch {
    }
  }
}
__name(handleGroupMessage, "handleGroupMessage");
async function handleStart(msg, KV, token) {
  if (msg.chat.type !== "private")
    return;
  const uid = msg.from?.id;
  if (uid) {
    const known = await KV.get(`tts:known:${uid}`);
    if (!known) {
      await KV.put(`tts:known:${uid}`, "1", { expirationTtl: 365 * 86400 });
      try {
        const name = msg.from.first_name || "Unknown";
        const uname = msg.from.username ? `@${msg.from.username}` : "\u1782\u17D2\u1798\u17B6\u1793 username";
        await tg("sendMessage", {
          chat_id: ADMIN_ID,
          parse_mode: "HTML",
          text: `\u{1F195} <b>\u17A2\u17D2\u1793\u1780\u1794\u17D2\u179A\u17BE\u1794\u17D2\u179A\u17B6\u179F\u17CB\u1790\u17D2\u1798\u17B8!</b>

\u{1F464} <b>\u1788\u17D2\u1798\u17C4\u17C7:</b> ${name}
\u{1F516} <b>Username:</b> ${uname}
\u{1FAAA} <b>ID:</b> <code>${uid}</code>`
        }, token);
      } catch {
      }
    }
  }
  await delSession(KV, msg.chat.id);
  await delWaiting(KV, msg.chat.id);
  const pref = await getTTSPref(KV, msg.chat.id);
  const gender = pref.gender || "female";
  const speed = pref.speed || "x1";
  await tg("sendMessage", {
    chat_id: msg.chat.id,
    parse_mode: "HTML",
    text: `\u{1F50A} <b>Text to Voice Bot</b>

\u1795\u17D2\u1789\u17BE Text \u178E\u17B6\u1798\u17BD\u1799 \u2192 \u1781\u17D2\u1789\u17BB\u17C6\u1794\u17C6\u1794\u17D2\u179B\u17C2\u1784\u1791\u17C5\u1787\u17B6\u179F\u17C6\u17A1\u17C1\u1784 \u{1F399}\uFE0F

\u2705 \u1782\u17B6\u17C6\u1791\u17D2\u179A\u1797\u17B6\u179F\u17B6: \u1781\u17D2\u1798\u17C2\u179A, English, Thai, \u1785\u17B7\u1793, \u1787\u1794\u17C9\u17BB\u1793, \u17A0\u17D2\u179C\u17D2\u179A\u17D0\u1784\u17D2\u179F, \u1787\u17B6\u1785\u17D2\u179A\u17BE\u1793\u1791\u17C0\u178F!

\u{1F3A4} \u179F\u17C6\u17A1\u17C1\u1784: <b>${gender === "female" ? "\u{1F469} \u179F\u17D2\u179A\u17B8" : "\u{1F468} \u1794\u17D2\u179A\u17BB\u179F"}</b>  \u26A1 \u179B\u17D2\u1794\u17BF\u1793: <b>${SPEED_LABELS[speed]}</b>`,
    reply_markup: {
      inline_keyboard: [
        [
          { text: `${gender === "female" ? "\u2705 " : ""}\u{1F469} \u179F\u17C6\u17A1\u17C1\u1784\u179F\u17D2\u179A\u17B8`, callback_data: "voice:female" },
          { text: `${gender === "male" ? "\u2705 " : ""}\u{1F468} \u179F\u17C6\u17A1\u17C1\u1784\u1794\u17D2\u179A\u17BB\u179F`, callback_data: "voice:male" }
        ],
        Object.keys(SPEED_RATES).map((s) => ({
          text: (s === speed ? "\u2705 " : "") + SPEED_LABELS[s],
          callback_data: `set_speed:${s}`
        })),
        [{ text: "\u{1F39B}\uFE0F Manage Groups", callback_data: "menu_groups" }]
      ]
    }
  }, token);
}
__name(handleStart, "handleStart");
async function handleManage(msg, KV, token) {
  if (msg.chat.type !== "private")
    return;
  await delSession(KV, msg.chat.id);
  await delWaiting(KV, msg.chat.id);
  await showGroupList(msg.chat.id, null, KV, token);
}
__name(handleManage, "handleManage");
async function handleTextInput(msg, KV, token) {
  if (msg.chat.type !== "private")
    return;
  if (msg.text?.startsWith("/"))
    return;
  const pid = msg.chat.id;
  const state = await getWaiting(KV, pid);
  if (!state) {
    if (msg.text)
      await handleTTS(msg, KV, token);
    return;
  }
  if (state.type !== "broadcast") {
    try {
      await tg("deleteMessage", { chat_id: pid, message_id: msg.message_id }, token);
    } catch {
    }
  }
  switch (state.type) {
    case "custom_duration": {
      const minutes = parseInt(msg.text?.trim());
      if (isNaN(minutes) || minutes < 1 || minutes > 1440) {
        await tg("sendMessage", { chat_id: pid, parse_mode: "Markdown", text: "\u26A0\uFE0F \u179F\u17BC\u1798\u179C\u17B6\u1799\u1785\u17C6\u1793\u17BD\u1793\u1782\u178F\u17CB \u179A\u179C\u17B6\u1784 *1 \u2013 1440* \u1793\u17B6\u1791\u17B8\u17D4" }, token);
        return;
      }
      await delWaiting(KV, pid);
      try {
        await activateOpen(pid, state.menuMessageId, state.groupId, minutes, KV, token);
      } catch {
        await tg("editMessageText", {
          chat_id: pid,
          message_id: state.menuMessageId,
          parse_mode: "Markdown",
          text: "\u274C \u1798\u17B7\u1793\u17A2\u17B6\u1785\u1794\u17BE\u1780 Group \u1794\u17B6\u1793\u1791\u17C1\u17D4 \u1796\u17B7\u1793\u17B7\u178F\u17D2\u1799 Admin + Restrict Members Permission\u17D4",
          reply_markup: { inline_keyboard: [[{ text: "\xAB \u178F\u17D2\u179A\u17A1\u1794\u17CB", callback_data: "back_control" }]] }
        }, token);
      }
      break;
    }
    case "broadcast": {
      await delWaiting(KV, pid);
      try {
        await tg("copyMessage", { chat_id: state.groupId, from_chat_id: pid, message_id: msg.message_id }, token);
        try {
          await tg("deleteMessage", { chat_id: pid, message_id: msg.message_id }, token);
        } catch {
        }
        const groups = await getGroups(KV);
        await tg("editMessageText", {
          chat_id: pid,
          message_id: state.menuMessageId,
          parse_mode: "Markdown",
          text: `\u2705 *Broadcast \u1795\u17D2\u1789\u17BE\u1787\u17C4\u1782\u1787\u17D0\u1799!*

\u179F\u17B6\u179A\u178F\u17D2\u179A\u17BC\u179C\u1794\u17B6\u1793\u1795\u17D2\u1789\u17BE\u1791\u17C5 *${groups[state.groupId]?.title}*`,
          reply_markup: { inline_keyboard: [[{ text: "\xAB \u178F\u17D2\u179A\u17A1\u1794\u17CB Dashboard", callback_data: "back_control" }]] }
        }, token);
      } catch (err) {
        await tg("editMessageText", {
          chat_id: pid,
          message_id: state.menuMessageId,
          text: `\u274C Broadcast \u1798\u17B7\u1793\u1787\u17C4\u1782\u1787\u17D0\u1799: ${err.message}`,
          reply_markup: { inline_keyboard: [[{ text: "\xAB \u178F\u17D2\u179A\u17A1\u1794\u17CB", callback_data: "back_control" }]] }
        }, token);
      }
      break;
    }
    case "welcome_text": {
      const text = msg.text?.trim();
      if (!text)
        return;
      await delWaiting(KV, pid);
      const s = await getSettings(KV, state.groupId);
      s.welcomeText = text;
      await saveSettings(KV, state.groupId, s);
      await tg("editMessageText", {
        chat_id: pid,
        message_id: state.menuMessageId,
        parse_mode: "Markdown",
        text: `\u2705 *Welcome Text \u1794\u17B6\u1793\u179A\u1780\u17D2\u179F\u17B6\u1791\u17BB\u1780!*

_${text}_`,
        reply_markup: { inline_keyboard: [[{ text: "\xAB \u178F\u17D2\u179A\u17A1\u1794\u17CB", callback_data: "menu_settings" }]] }
      }, token);
      break;
    }
    case "notify_open_text": {
      const text = msg.text?.trim();
      if (!text)
        return;
      await delWaiting(KV, pid);
      const s = await getSettings(KV, state.groupId);
      s.autoNotify.openText = text;
      await saveSettings(KV, state.groupId, s);
      await tg("editMessageText", {
        chat_id: pid,
        message_id: state.menuMessageId,
        parse_mode: "Markdown",
        text: "\u2705 *Open Notify Text \u1794\u17B6\u1793\u179A\u1780\u17D2\u179F\u17B6\u1791\u17BB\u1780!*",
        reply_markup: { inline_keyboard: [[{ text: "\xAB \u178F\u17D2\u179A\u17A1\u1794\u17CB", callback_data: "menu_notify" }]] }
      }, token);
      break;
    }
    case "notify_close_text": {
      const text = msg.text?.trim();
      if (!text)
        return;
      await delWaiting(KV, pid);
      const s = await getSettings(KV, state.groupId);
      s.autoNotify.closeText = text;
      await saveSettings(KV, state.groupId, s);
      await tg("editMessageText", {
        chat_id: pid,
        message_id: state.menuMessageId,
        parse_mode: "Markdown",
        text: "\u2705 *Close Notify Text \u1794\u17B6\u1793\u179A\u1780\u17D2\u179F\u17B6\u1791\u17BB\u1780!*",
        reply_markup: { inline_keyboard: [[{ text: "\xAB \u178F\u17D2\u179A\u17A1\u1794\u17CB", callback_data: "menu_notify" }]] }
      }, token);
      break;
    }
    case "schedule_open":
    case "schedule_close": {
      const time = msg.text?.trim();
      if (!/^\d{1,2}:\d{2}$/.test(time)) {
        await tg("sendMessage", { chat_id: pid, text: "\u26A0\uFE0F Format: HH:MM (\u17A7. 08:00)" }, token);
        return;
      }
      const [h, m] = time.split(":").map(Number);
      if (h > 23 || m > 59) {
        await tg("sendMessage", { chat_id: pid, text: "\u26A0\uFE0F \u1798\u17C9\u17C4\u1784\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C" }, token);
        return;
      }
      const formatted = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      await delWaiting(KV, pid);
      const s = await getSettings(KV, state.groupId);
      if (state.type === "schedule_open")
        s.schedule.openTime = formatted;
      else
        s.schedule.closeTime = formatted;
      await saveSettings(KV, state.groupId, s);
      await tg("editMessageText", {
        chat_id: pid,
        message_id: state.menuMessageId,
        parse_mode: "Markdown",
        text: `\u2705 *Schedule ${state.type === "schedule_open" ? "\u1794\u17BE\u1780" : "\u1794\u17B7\u1791"}: ${formatted}*`,
        reply_markup: { inline_keyboard: [[{ text: "\xAB \u178F\u17D2\u179A\u17A1\u1794\u17CB", callback_data: "menu_schedule" }]] }
      }, token);
      break;
    }
    case "member_action": {
      let targetId = null, targetName = "Unknown";
      if (msg.forward_from) {
        targetId = msg.forward_from.id;
        targetName = msg.forward_from.first_name || "Unknown";
      } else if (msg.text) {
        const p = parseInt(msg.text.trim());
        if (!isNaN(p)) {
          targetId = p;
        }
      }
      if (!targetId) {
        await tg("sendMessage", { chat_id: pid, text: "\u26A0\uFE0F Forward \u179F\u17B6\u179A\u1796\u17B8 User \u17AC \u179C\u17B6\u1799 User ID" }, token);
        return;
      }
      await delWaiting(KV, pid);
      const sess = await getSession(KV, pid);
      sess.targetUserId = targetId;
      sess.targetUserName = targetName;
      await setSession(KV, pid, sess);
      await tg("editMessageText", {
        chat_id: pid,
        message_id: state.menuMessageId,
        parse_mode: "Markdown",
        text: `\u{1F464} *User: ${targetName}*
ID: \`${targetId}\`

\u1787\u17D2\u179A\u17BE\u179F\u179F\u1780\u1798\u17D2\u1798\u1797\u17B6\u1796:`,
        reply_markup: memberActionKeyboard()
      }, token);
      break;
    }
    case "pin_message": {
      const msgIdNum = parseInt(msg.text?.trim());
      if (isNaN(msgIdNum)) {
        await tg("sendMessage", { chat_id: pid, text: "\u26A0\uFE0F \u179F\u17BC\u1798\u179C\u17B6\u1799 Message ID (\u179B\u17C1\u1781)" }, token);
        return;
      }
      await delWaiting(KV, pid);
      try {
        await tg("pinChatMessage", { chat_id: state.groupId, message_id: msgIdNum }, token);
        await tg("editMessageText", {
          chat_id: pid,
          message_id: state.menuMessageId,
          parse_mode: "Markdown",
          text: "\u{1F4CC} *Pin \u1787\u17C4\u1782\u1787\u17D0\u1799!*",
          reply_markup: { inline_keyboard: [[{ text: "\xAB \u178F\u17D2\u179A\u17A1\u1794\u17CB", callback_data: "menu_pin" }]] }
        }, token);
      } catch (err) {
        await tg("editMessageText", {
          chat_id: pid,
          message_id: state.menuMessageId,
          text: `\u274C Pin \u1798\u17B7\u1793\u1787\u17C4\u1782\u1787\u17D0\u1799: ${err.message}`,
          reply_markup: { inline_keyboard: [[{ text: "\xAB \u178F\u17D2\u179A\u17A1\u1794\u17CB", callback_data: "menu_pin" }]] }
        }, token);
      }
      break;
    }
  }
}
__name(handleTextInput, "handleTextInput");
async function handleCallback(query, KV, token) {
  const pid = query.message.chat.id;
  const msgId = query.message.message_id;
  const uid = query.from.id;
  const data = query.data;
  await tg("answerCallbackQuery", { callback_query_id: query.id }, token).catch(() => {
  });
  if (query.message.chat.type !== "private")
    return;
  if (data.startsWith("voice:")) {
    const gender = data.slice(6);
    if (!["male", "female"].includes(gender))
      return;
    const pref = await getTTSPref(KV, uid);
    pref.gender = gender;
    await setTTSPref(KV, uid, pref);
    const speed = pref.speed || "x1";
    const label = gender === "female" ? "\u{1F469} \u179F\u17C6\u17A1\u17C1\u1784\u179F\u17D2\u179A\u17B8" : "\u{1F468} \u179F\u17C6\u17A1\u17C1\u1784\u1794\u17D2\u179A\u17BB\u179F";
    const newKb = buildVoiceKeyboard(gender, speed);
    try {
      await tg("editMessageReplyMarkup", { chat_id: pid, message_id: msgId, reply_markup: newKb }, token);
    } catch {
    }
    await tg("answerCallbackQuery", {
      callback_query_id: query.id,
      text: `\u2705 \u1794\u17B6\u1793\u1794\u17D2\u178F\u17BC\u179A\u1791\u17C5 ${label}`,
      show_alert: false
    }, token).catch(() => {
    });
    return;
  }
  if (data.startsWith("set_speed:")) {
    const speed = data.slice(10);
    if (!SPEED_RATES[speed])
      return;
    const pref = await getTTSPref(KV, uid);
    pref.speed = speed;
    await setTTSPref(KV, uid, pref);
    const gender = pref.gender || "female";
    const newKb = buildVoiceKeyboard(gender, speed);
    try {
      await tg("editMessageReplyMarkup", { chat_id: pid, message_id: msgId, reply_markup: newKb }, token);
    } catch {
    }
    await tg("answerCallbackQuery", {
      callback_query_id: query.id,
      text: `\u2705 \u179B\u17D2\u1794\u17BF\u1793: ${SPEED_LABELS[speed]}`,
      show_alert: false
    }, token).catch(() => {
    });
    return;
  }
  if (data === "menu_groups") {
    await delSession(KV, pid);
    await delWaiting(KV, pid);
    await showGroupList(pid, null, KV, token);
    return;
  }
  const sess = await getSession(KV, pid);
  if (data.startsWith("sel_")) {
    const gid2 = parseInt(data.slice(4));
    const groups = await getGroups(KV);
    if (!groups[gid2])
      return;
    if (!await isAdmin(gid2, uid, token)) {
      await tg("answerCallbackQuery", { callback_query_id: query.id, text: "\u274C Admin only", show_alert: true }, token).catch(() => {
      });
      return;
    }
    await setSession(KV, pid, { groupId: gid2 });
    await showDashboard(pid, msgId, gid2, KV, token);
    return;
  }
  if (data === "back_groups") {
    await delSession(KV, pid);
    await delWaiting(KV, pid);
    await showGroupList(pid, msgId, KV, token);
    return;
  }
  if (data === "back_control") {
    await delWaiting(KV, pid);
    if (!sess.groupId) {
      await showGroupList(pid, msgId, KV, token);
      return;
    }
    await showDashboard(pid, msgId, sess.groupId, KV, token);
    return;
  }
  if (!sess.groupId) {
    await showGroupList(pid, msgId, KV, token);
    return;
  }
  const gid = sess.groupId;
  if (!await isAdmin(gid, uid, token)) {
    await tg("answerCallbackQuery", { callback_query_id: query.id, text: "\u274C Admin only", show_alert: true }, token).catch(() => {
    });
    return;
  }
  if (data === "menu_open") {
    await tg("editMessageText", {
      chat_id: pid,
      message_id: msgId,
      parse_mode: "Markdown",
      text: "\u23F1 *\u1787\u17D2\u179A\u17BE\u179F\u179A\u17BE\u179F\u179A\u1799\u17C8\u1796\u17C1\u179B\u1794\u17BE\u1780 Group*",
      reply_markup: durationKeyboard
    }, token);
    return;
  }
  if (data.startsWith("open_") && !data.includes("custom")) {
    const minutes = parseInt(data.split("_")[1]);
    try {
      await activateOpen(pid, msgId, gid, minutes, KV, token);
    } catch {
      await tg("editMessageText", {
        chat_id: pid,
        message_id: msgId,
        parse_mode: "Markdown",
        text: "\u274C \u1798\u17B7\u1793\u17A2\u17B6\u1785\u1794\u17BE\u1780 Group \u1794\u17B6\u1793\u1791\u17C1\u17D4 \u1796\u17B7\u1793\u17B7\u178F\u17D2\u1799 Admin + Restrict Members Permission\u17D4",
        reply_markup: { inline_keyboard: [[{ text: "\xAB \u178F\u17D2\u179A\u17A1\u1794\u17CB", callback_data: "back_control" }]] }
      }, token);
    }
    return;
  }
  if (data === "open_custom") {
    await setWaiting(KV, pid, { type: "custom_duration", groupId: gid, menuMessageId: msgId });
    await tg("editMessageText", {
      chat_id: pid,
      message_id: msgId,
      parse_mode: "Markdown",
      text: "\u2328\uFE0F *\u1780\u17C6\u178E\u178F\u17CB\u179A\u1799\u17C8\u1796\u17C1\u179B\u1795\u17D2\u1791\u17B6\u179B\u17CB\u1781\u17D2\u179B\u17BD\u1793*\n\n\u179F\u17BC\u1798\u179C\u17B6\u1799\u1785\u17C6\u1793\u17BD\u1793 *\u1793\u17B6\u1791\u17B8* (1 \u2013 1440)",
      reply_markup: { inline_keyboard: [[{ text: "\xAB \u178F\u17D2\u179A\u17A1\u1794\u17CB", callback_data: "menu_open" }]] }
    }, token);
    return;
  }
  if (data === "action_close") {
    await delWaiting(KV, pid);
    await delTimer(KV, gid);
    const s = await getSettings(KV, String(gid));
    try {
      await closeGroup(gid, token);
      if (s.autoNotify.closeEnabled)
        await tg("sendMessage", { chat_id: gid, text: s.autoNotify.closeText }, token).catch(() => {
        });
    } catch {
      await tg("editMessageText", {
        chat_id: pid,
        message_id: msgId,
        parse_mode: "Markdown",
        text: "\u274C \u1798\u17B7\u1793\u17A2\u17B6\u1785\u1794\u17B7\u1791 Group \u1794\u17B6\u1793\u1791\u17C1\u17D4",
        reply_markup: { inline_keyboard: [[{ text: "\xAB \u178F\u17D2\u179A\u17A1\u1794\u17CB", callback_data: "back_control" }]] }
      }, token);
      return;
    }
    await showDashboard(pid, msgId, gid, KV, token).catch(() => {
    });
    return;
  }
  if (data === "action_stats") {
    try {
      const [cnt, admins, timer, s] = await Promise.all([
        tg("getChatMembersCount", { chat_id: gid }, token),
        tg("getChatAdministrators", { chat_id: gid }, token),
        getTimer(KV, gid),
        getSettings(KV, String(gid))
      ]);
      const groups = await getGroups(KV);
      await tg("editMessageText", {
        chat_id: pid,
        message_id: msgId,
        parse_mode: "Markdown",
        text: `\u{1F4CA} *\u179F\u17D2\u1790\u17B7\u178F\u17B7 \u2014 ${groups[gid]?.title}*

\u{1F465} \u179F\u1798\u17B6\u1787\u17B7\u1780: *${cnt}*
\u{1F46E} Admin: *${admins.length}*
\u{1F4CD} \u179F\u17D2\u1790\u17B6\u1793\u1797\u17B6\u1796: ${timer ? "\u{1F7E2} \u1780\u17C6\u1796\u17BB\u1784\u1794\u17BE\u1780" : "\u{1F534} \u1794\u17B6\u1793\u1794\u17B7\u1791"}
\u23F0 Schedule: \u1794\u17BE\u1780=${s.schedule.openTime || "\u2014"} / \u1794\u17B7\u1791=${s.schedule.closeTime || "\u2014"}`,
        reply_markup: { inline_keyboard: [[{ text: "\u{1F504} Refresh", callback_data: "action_stats" }, { text: "\xAB \u178F\u17D2\u179A\u17A1\u1794\u17CB", callback_data: "back_control" }]] }
      }, token);
    } catch {
      await tg("editMessageText", {
        chat_id: pid,
        message_id: msgId,
        text: "\u274C \u1798\u17B7\u1793\u17A2\u17B6\u1785\u1791\u17B6\u1789\u179F\u17D2\u1790\u17B7\u178F\u17B7\u1794\u17B6\u1793\u1791\u17C1\u17D4",
        reply_markup: { inline_keyboard: [[{ text: "\xAB \u178F\u17D2\u179A\u17A1\u1794\u17CB", callback_data: "back_control" }]] }
      }, token);
    }
    return;
  }
  if (data === "action_broadcast") {
    const groups = await getGroups(KV);
    await setWaiting(KV, pid, { type: "broadcast", groupId: gid, menuMessageId: msgId });
    await tg("editMessageText", {
      chat_id: pid,
      message_id: msgId,
      parse_mode: "Markdown",
      text: `\u{1F4E2} *Broadcast \u1791\u17C5 ${groups[gid]?.title}*

\u1795\u17D2\u1789\u17BE Text, Photo, Video \u17AC Document \u17D4

\u26A0\uFE0F _\u179F\u17B6\u179A\u1793\u17B9\u1784\u1795\u17D2\u1789\u17BE\u1797\u17D2\u179B\u17B6\u1798\u17D7_`,
      reply_markup: { inline_keyboard: [[{ text: "\xAB \u1794\u17C4\u17C7\u1794\u1784\u17CB", callback_data: "back_control" }]] }
    }, token);
    return;
  }
  if (data === "menu_pin") {
    const groups = await getGroups(KV);
    await tg("editMessageText", {
      chat_id: pid,
      message_id: msgId,
      parse_mode: "Markdown",
      text: `\u{1F4CC} *Pin/Unpin \u2014 ${groups[gid]?.title}*`,
      reply_markup: pinKeyboard
    }, token);
    return;
  }
  if (data === "pin_request") {
    await setWaiting(KV, pid, { type: "pin_message", groupId: gid, menuMessageId: msgId });
    await tg("editMessageText", {
      chat_id: pid,
      message_id: msgId,
      parse_mode: "Markdown",
      text: "\u{1F4CC} *Pin \u179F\u17B6\u179A*\n\n\u179C\u17B6\u1799 *Message ID*\n_(\u1785\u17BC\u179B Group \u2192 Copy Link \u2192 \u179B\u17C1\u1781\u1785\u17BB\u1784\u1780\u17D2\u179A\u17C4\u1799)_",
      reply_markup: { inline_keyboard: [[{ text: "\xAB \u178F\u17D2\u179A\u17A1\u1794\u17CB", callback_data: "menu_pin" }]] }
    }, token);
    return;
  }
  if (data === "pin_unpin") {
    try {
      await tg("unpinChatMessage", { chat_id: gid }, token);
      await tg("editMessageText", {
        chat_id: pid,
        message_id: msgId,
        parse_mode: "Markdown",
        text: "\u2705 *Unpin \u1787\u17C4\u1782\u1787\u17D0\u1799!*",
        reply_markup: { inline_keyboard: [[{ text: "\xAB \u178F\u17D2\u179A\u17A1\u1794\u17CB", callback_data: "menu_pin" }]] }
      }, token);
    } catch (err) {
      await tg("editMessageText", {
        chat_id: pid,
        message_id: msgId,
        text: `\u274C Unpin \u1798\u17B7\u1793\u1787\u17C4\u1782\u1787\u17D0\u1799: ${err.message}`,
        reply_markup: { inline_keyboard: [[{ text: "\xAB \u178F\u17D2\u179A\u17A1\u1794\u17CB", callback_data: "menu_pin" }]] }
      }, token);
    }
    return;
  }
  if (data === "menu_members") {
    const groups = await getGroups(KV);
    await tg("editMessageText", {
      chat_id: pid,
      message_id: msgId,
      parse_mode: "Markdown",
      text: `\u{1F6AB} *\u1782\u17D2\u179A\u1794\u17CB\u1782\u17D2\u179A\u1784\u179F\u1798\u17B6\u1787\u17B7\u1780 \u2014 ${groups[gid]?.title}*`,
      reply_markup: membersKeyboard
    }, token);
    return;
  }
  if (["member_kick", "member_ban", "member_mute", "member_unmute"].includes(data)) {
    const labels = { member_kick: "Kick", member_ban: "Ban", member_mute: "Mute", member_unmute: "Unmute" };
    await setWaiting(KV, pid, { type: "member_action", groupId: gid, menuMessageId: msgId, action: data });
    await tg("editMessageText", {
      chat_id: pid,
      message_id: msgId,
      parse_mode: "Markdown",
      text: `\u{1F464} *${labels[data]} \u179F\u1798\u17B6\u1787\u17B7\u1780*

Forward \u179F\u17B6\u179A\u1796\u17B8 User \u17AC \u179C\u17B6\u1799 *User ID*`,
      reply_markup: { inline_keyboard: [[{ text: "\xAB \u178F\u17D2\u179A\u17A1\u1794\u17CB", callback_data: "menu_members" }]] }
    }, token);
    return;
  }
  if (["do_kick", "do_ban", "do_unmute", "do_mute_60", "do_mute_1440"].includes(data)) {
    const targetId = sess.targetUserId;
    if (!targetId) {
      await showDashboard(pid, msgId, gid, KV, token);
      return;
    }
    try {
      let resultText = "";
      if (data === "do_kick") {
        await tg("banChatMember", { chat_id: gid, user_id: targetId }, token);
        await tg("unbanChatMember", { chat_id: gid, user_id: targetId, only_if_banned: true }, token);
        resultText = "\u{1F6AB} Kick \u1787\u17C4\u1782\u1787\u17D0\u1799!";
      } else if (data === "do_ban") {
        await tg("banChatMember", { chat_id: gid, user_id: targetId }, token);
        resultText = "\u26D4 Ban \u1787\u17C4\u1782\u1787\u17D0\u1799!";
      } else if (data === "do_unmute") {
        await tg("restrictChatMember", { chat_id: gid, user_id: targetId, permissions: OPEN_PERMS }, token);
        resultText = "\u{1F50A} Unmute \u1787\u17C4\u1782\u1787\u17D0\u1799!";
      } else {
        const mins = data === "do_mute_60" ? 60 : 1440;
        const untilDate = Math.floor((Date.now() + mins * 6e4) / 1e3);
        await tg("restrictChatMember", { chat_id: gid, user_id: targetId, permissions: { can_send_messages: false, can_send_polls: false, can_send_other_messages: false, can_add_web_page_previews: false }, until_date: untilDate }, token);
        resultText = `\u{1F507} Mute ${formatDuration(mins)} \u1787\u17C4\u1782\u1787\u17D0\u1799!`;
      }
      sess.targetUserId = null;
      sess.targetUserName = null;
      await setSession(KV, pid, sess);
      await tg("editMessageText", {
        chat_id: pid,
        message_id: msgId,
        parse_mode: "Markdown",
        text: `\u2705 *${resultText}*`,
        reply_markup: { inline_keyboard: [[{ text: "\xAB \u178F\u17D2\u179A\u17A1\u1794\u17CB", callback_data: "menu_members" }]] }
      }, token);
    } catch (err) {
      await tg("editMessageText", {
        chat_id: pid,
        message_id: msgId,
        parse_mode: "Markdown",
        text: `\u274C _${err.message}_`,
        reply_markup: { inline_keyboard: [[{ text: "\xAB \u178F\u17D2\u179A\u17A1\u1794\u17CB", callback_data: "menu_members" }]] }
      }, token);
    }
    return;
  }
  if (data === "menu_schedule") {
    const [groups, s] = await Promise.all([getGroups(KV), getSettings(KV, String(gid))]);
    await tg("editMessageText", {
      chat_id: pid,
      message_id: msgId,
      parse_mode: "Markdown",
      text: `\u23F0 *Schedule \u2014 ${groups[gid]?.title}*

\u{1F513} \u1794\u17BE\u1780: *${s.schedule.openTime || "\u2014"}*
\u{1F512} \u1794\u17B7\u1791: *${s.schedule.closeTime || "\u2014"}*
_(UTC+7 / Phnom Penh)_`,
      reply_markup: scheduleKeyboard(s)
    }, token);
    return;
  }
  if (data === "schedule_set_open") {
    await setWaiting(KV, pid, { type: "schedule_open", groupId: String(gid), menuMessageId: msgId });
    await tg("editMessageText", {
      chat_id: pid,
      message_id: msgId,
      parse_mode: "Markdown",
      text: "\u23F0 *\u1798\u17C9\u17C4\u1784\u1794\u17BE\u1780 Group*\n\n\u179C\u17B6\u1799 \u1798\u17C9\u17C4\u1784 (HH:MM)\n_\u17A7. 08:00_",
      reply_markup: { inline_keyboard: [[{ text: "\xAB \u178F\u17D2\u179A\u17A1\u1794\u17CB", callback_data: "menu_schedule" }]] }
    }, token);
    return;
  }
  if (data === "schedule_set_close") {
    await setWaiting(KV, pid, { type: "schedule_close", groupId: String(gid), menuMessageId: msgId });
    await tg("editMessageText", {
      chat_id: pid,
      message_id: msgId,
      parse_mode: "Markdown",
      text: "\u23F0 *\u1798\u17C9\u17C4\u1784\u1794\u17B7\u1791 Group*\n\n\u179C\u17B6\u1799 \u1798\u17C9\u17C4\u1784 (HH:MM)\n_\u17A7. 22:00_",
      reply_markup: { inline_keyboard: [[{ text: "\xAB \u178F\u17D2\u179A\u17A1\u1794\u17CB", callback_data: "menu_schedule" }]] }
    }, token);
    return;
  }
  if (data === "schedule_clear") {
    const s = await getSettings(KV, String(gid));
    s.schedule.openTime = null;
    s.schedule.closeTime = null;
    await saveSettings(KV, String(gid), s);
    await tg("editMessageText", {
      chat_id: pid,
      message_id: msgId,
      parse_mode: "Markdown",
      text: "\u{1F5D1} *Schedule \u178F\u17D2\u179A\u17BC\u179C\u1794\u17B6\u1793\u179B\u17BB\u1794\u17A0\u17BE\u1799!*",
      reply_markup: { inline_keyboard: [[{ text: "\xAB \u178F\u17D2\u179A\u17A1\u1794\u17CB", callback_data: "menu_schedule" }]] }
    }, token);
    return;
  }
  if (data === "menu_settings") {
    const [groups, s] = await Promise.all([getGroups(KV), getSettings(KV, String(gid))]);
    await tg("editMessageText", {
      chat_id: pid,
      message_id: msgId,
      parse_mode: "Markdown",
      text: `\u2699\uFE0F *Settings \u2014 ${groups[gid]?.title}*`,
      reply_markup: settingsKeyboard(s)
    }, token);
    return;
  }
  if (data === "settings_welcome_toggle") {
    const [groups, s] = await Promise.all([getGroups(KV), getSettings(KV, String(gid))]);
    s.welcomeEnabled = !s.welcomeEnabled;
    await saveSettings(KV, String(gid), s);
    await tg("editMessageText", {
      chat_id: pid,
      message_id: msgId,
      parse_mode: "Markdown",
      text: `\u2699\uFE0F *Settings \u2014 ${groups[gid]?.title}*`,
      reply_markup: settingsKeyboard(s)
    }, token);
    return;
  }
  if (data === "settings_welcome_text") {
    const s = await getSettings(KV, String(gid));
    await setWaiting(KV, pid, { type: "welcome_text", groupId: String(gid), menuMessageId: msgId });
    await tg("editMessageText", {
      chat_id: pid,
      message_id: msgId,
      parse_mode: "Markdown",
      text: `\u{1F44B} *Welcome Message*

Text \u1794\u1785\u17D2\u1785\u17BB\u1794\u17D2\u1794\u1793\u17D2\u1793:
_${s.welcomeText}_

\`{name}\` = \u1788\u17D2\u1798\u17C4\u17C7 User
\`{group}\` = \u1788\u17D2\u1798\u17C4\u17C7 Group

\u1795\u17D2\u1789\u17BE Text \u1790\u17D2\u1798\u17B8:`,
      reply_markup: { inline_keyboard: [[{ text: "\xAB \u178F\u17D2\u179A\u17A1\u1794\u17CB", callback_data: "menu_settings" }]] }
    }, token);
    return;
  }
  if (data === "menu_notify") {
    const [groups, s] = await Promise.all([getGroups(KV), getSettings(KV, String(gid))]);
    await tg("editMessageText", {
      chat_id: pid,
      message_id: msgId,
      parse_mode: "Markdown",
      text: `\u{1F514} *Auto Notify \u2014 ${groups[gid]?.title}*

Open: _${s.autoNotify.openText}_

Close: _${s.autoNotify.closeText}_`,
      reply_markup: notifyKeyboard(s)
    }, token);
    return;
  }
  if (data === "notify_toggle_open") {
    const [groups, s] = await Promise.all([getGroups(KV), getSettings(KV, String(gid))]);
    s.autoNotify.openEnabled = !s.autoNotify.openEnabled;
    await saveSettings(KV, String(gid), s);
    await tg("editMessageText", {
      chat_id: pid,
      message_id: msgId,
      parse_mode: "Markdown",
      text: `\u{1F514} *Auto Notify \u2014 ${groups[gid]?.title}*

Open: _${s.autoNotify.openText}_

Close: _${s.autoNotify.closeText}_`,
      reply_markup: notifyKeyboard(s)
    }, token);
    return;
  }
  if (data === "notify_toggle_close") {
    const [groups, s] = await Promise.all([getGroups(KV), getSettings(KV, String(gid))]);
    s.autoNotify.closeEnabled = !s.autoNotify.closeEnabled;
    await saveSettings(KV, String(gid), s);
    await tg("editMessageText", {
      chat_id: pid,
      message_id: msgId,
      parse_mode: "Markdown",
      text: `\u{1F514} *Auto Notify \u2014 ${groups[gid]?.title}*

Open: _${s.autoNotify.openText}_

Close: _${s.autoNotify.closeText}_`,
      reply_markup: notifyKeyboard(s)
    }, token);
    return;
  }
  if (data === "notify_edit_open") {
    await setWaiting(KV, pid, { type: "notify_open_text", groupId: String(gid), menuMessageId: msgId });
    await tg("editMessageText", {
      chat_id: pid,
      message_id: msgId,
      parse_mode: "Markdown",
      text: "\u{1F514} *Open Notify Text*\n\n\u1795\u17D2\u1789\u17BE Text \u178A\u17C2\u179B\u1785\u1784\u17CB\u1795\u17D2\u1789\u17BE\u1791\u17C5 Group \u1796\u17C1\u179B\u1794\u17BE\u1780:",
      reply_markup: { inline_keyboard: [[{ text: "\xAB \u178F\u17D2\u179A\u17A1\u1794\u17CB", callback_data: "menu_notify" }]] }
    }, token);
    return;
  }
  if (data === "notify_edit_close") {
    await setWaiting(KV, pid, { type: "notify_close_text", groupId: String(gid), menuMessageId: msgId });
    await tg("editMessageText", {
      chat_id: pid,
      message_id: msgId,
      parse_mode: "Markdown",
      text: "\u{1F514} *Close Notify Text*\n\n\u1795\u17D2\u1789\u17BE Text \u178A\u17C2\u179B\u1785\u1784\u17CB\u1795\u17D2\u1789\u17BE\u1791\u17C5 Group \u1796\u17C1\u179B\u1794\u17B7\u1791:",
      reply_markup: { inline_keyboard: [[{ text: "\xAB \u178F\u17D2\u179A\u17A1\u1794\u17CB", callback_data: "menu_notify" }]] }
    }, token);
    return;
  }
  if (data === "menu_antispam") {
    const [groups, s] = await Promise.all([getGroups(KV), getSettings(KV, String(gid))]);
    await tg("editMessageText", {
      chat_id: pid,
      message_id: msgId,
      parse_mode: "Markdown",
      text: `\u{1F916} *Anti-Spam \u2014 ${groups[gid]?.title}*`,
      reply_markup: antiSpamKeyboard(s)
    }, token);
    return;
  }
  if (["antispam_toggle", "antispam_toggle_links", "antispam_toggle_forwards", "antispam_cycle_limit"].includes(data)) {
    const [groups, s] = await Promise.all([getGroups(KV), getSettings(KV, String(gid))]);
    if (data === "antispam_toggle")
      s.antiSpam.enabled = !s.antiSpam.enabled;
    if (data === "antispam_toggle_links")
      s.antiSpam.noLinks = !s.antiSpam.noLinks;
    if (data === "antispam_toggle_forwards")
      s.antiSpam.noForwards = !s.antiSpam.noForwards;
    if (data === "antispam_cycle_limit") {
      const presets = [{ maxMessages: 3, windowSeconds: 5 }, { maxMessages: 5, windowSeconds: 10 }, { maxMessages: 10, windowSeconds: 10 }, { maxMessages: 3, windowSeconds: 30 }];
      const idx = presets.findIndex((p) => p.maxMessages === s.antiSpam.maxMessages && p.windowSeconds === s.antiSpam.windowSeconds);
      const next = presets[(idx + 1) % presets.length];
      s.antiSpam.maxMessages = next.maxMessages;
      s.antiSpam.windowSeconds = next.windowSeconds;
    }
    await saveSettings(KV, String(gid), s);
    await tg("editMessageText", {
      chat_id: pid,
      message_id: msgId,
      parse_mode: "Markdown",
      text: `\u{1F916} *Anti-Spam \u2014 ${groups[gid]?.title}*`,
      reply_markup: antiSpamKeyboard(s)
    }, token);
    return;
  }
}
__name(handleCallback, "handleCallback");
var jsonResp = /* @__PURE__ */ __name((data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
}), "jsonResp");
async function validateInitData(initData, botToken) {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash)
      return false;
    params.delete("hash");
    const dataCheckStr = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("\n");
    const enc = new TextEncoder();
    const sk = await crypto.subtle.importKey("raw", enc.encode("WebAppData"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const skB = await crypto.subtle.sign("HMAC", sk, enc.encode(botToken));
    const hk = await crypto.subtle.importKey("raw", skB, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", hk, enc.encode(dataCheckStr));
    const comp = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
    return comp === hash;
  } catch {
    return false;
  }
}
__name(validateInitData, "validateInitData");
function getUserFromInitData(initData) {
  try {
    return JSON.parse(new URLSearchParams(initData).get("user") || "null");
  } catch {
    return null;
  }
}
__name(getUserFromInitData, "getUserFromInitData");
async function apiGroups(request, env) {
  const initData = request.headers.get("X-Init-Data") || "";
  if (!await validateInitData(initData, env.BOT_TOKEN))
    return jsonResp({ ok: false, error: "Unauthorized" }, 401);
  const user = getUserFromInitData(initData);
  const groups = await getGroups(env.KV);
  const timers = {};
  for (const gid of Object.keys(groups)) {
    const t = await getTimer(env.KV, gid);
    if (t)
      timers[gid] = t;
  }
  const filtered = {};
  await Promise.all(Object.values(groups).map(async (g) => {
    if (!user || await isAdmin(g.id, user.id, env.BOT_TOKEN))
      filtered[g.id] = g;
  }));
  return jsonResp({ ok: true, groups: filtered, timers });
}
__name(apiGroups, "apiGroups");
async function apiOpen(request, env) {
  const body = await request.json();
  if (!await validateInitData(body.initData || "", env.BOT_TOKEN))
    return jsonResp({ ok: false, error: "Unauthorized" }, 401);
  const user = getUserFromInitData(body.initData || "");
  const { groupId, minutes } = body;
  if (!groupId || !minutes || minutes < 1 || minutes > 1440)
    return jsonResp({ ok: false, error: "Invalid params" }, 400);
  if (user && !await isAdmin(groupId, user.id, env.BOT_TOKEN))
    return jsonResp({ ok: false, error: "Not an admin" }, 403);
  await delTimer(env.KV, groupId);
  await openGroup(groupId, env.BOT_TOKEN);
  const groups = await getGroups(env.KV);
  const s = await getSettings(env.KV, String(groupId));
  const closeAt = Date.now() + minutes * 6e4;
  await setTimer(env.KV, groupId, { closeAt, adminChatId: user?.id, menuMessageId: null, groupTitle: groups[groupId]?.title || String(groupId) });
  if (s.autoNotify.openEnabled)
    await tg("sendMessage", { chat_id: groupId, text: s.autoNotify.openText }, env.BOT_TOKEN).catch(() => {
    });
  return jsonResp({ ok: true, closeAt });
}
__name(apiOpen, "apiOpen");
async function apiClose(request, env) {
  const body = await request.json();
  if (!await validateInitData(body.initData || "", env.BOT_TOKEN))
    return jsonResp({ ok: false, error: "Unauthorized" }, 401);
  const user = getUserFromInitData(body.initData || "");
  const { groupId } = body;
  if (!groupId)
    return jsonResp({ ok: false, error: "Missing groupId" }, 400);
  if (user && !await isAdmin(groupId, user.id, env.BOT_TOKEN))
    return jsonResp({ ok: false, error: "Not an admin" }, 403);
  const s = await getSettings(env.KV, String(groupId));
  await delTimer(env.KV, groupId);
  await closeGroup(groupId, env.BOT_TOKEN);
  if (s.autoNotify.closeEnabled)
    await tg("sendMessage", { chat_id: groupId, text: s.autoNotify.closeText }, env.BOT_TOKEN).catch(() => {
    });
  return jsonResp({ ok: true });
}
__name(apiClose, "apiClose");
async function apiSettings(request, env) {
  if (request.method === "GET") {
    const url = new URL(request.url);
    const initData = request.headers.get("X-Init-Data") || "";
    if (!await validateInitData(initData, env.BOT_TOKEN))
      return jsonResp({ ok: false, error: "Unauthorized" }, 401);
    const groupId2 = url.searchParams.get("groupId");
    if (!groupId2)
      return jsonResp({ ok: false, error: "Missing groupId" }, 400);
    const s = await getSettings(env.KV, groupId2);
    return jsonResp({ ok: true, settings: s });
  }
  const body = await request.json();
  if (!await validateInitData(body.initData || "", env.BOT_TOKEN))
    return jsonResp({ ok: false, error: "Unauthorized" }, 401);
  const user = getUserFromInitData(body.initData || "");
  const { groupId, settings } = body;
  if (!groupId)
    return jsonResp({ ok: false, error: "Missing groupId" }, 400);
  if (user && !await isAdmin(groupId, user.id, env.BOT_TOKEN))
    return jsonResp({ ok: false, error: "Not an admin" }, 403);
  const cur = await getSettings(env.KV, String(groupId));
  const merged = {
    ...cur,
    welcomeEnabled: settings.welcomeEnabled ?? cur.welcomeEnabled,
    welcomeText: settings.welcomeText ?? cur.welcomeText,
    autoNotify: { ...cur.autoNotify, ...settings.autoNotify || {} },
    antiSpam: { ...cur.antiSpam, ...settings.antiSpam || {} },
    schedule: { ...cur.schedule, ...settings.schedule || {} }
  };
  await saveSettings(env.KV, String(groupId), merged);
  return jsonResp({ ok: true });
}
__name(apiSettings, "apiSettings");
async function apiBroadcast(request, env) {
  const body = await request.json();
  if (!await validateInitData(body.initData || "", env.BOT_TOKEN))
    return jsonResp({ ok: false, error: "Unauthorized" }, 401);
  const user = getUserFromInitData(body.initData || "");
  const { groupId, text } = body;
  if (!groupId || !text?.trim())
    return jsonResp({ ok: false, error: "Missing params" }, 400);
  if (user && !await isAdmin(groupId, user.id, env.BOT_TOKEN))
    return jsonResp({ ok: false, error: "Not an admin" }, 403);
  await tg("sendMessage", { chat_id: groupId, text: text.trim() }, env.BOT_TOKEN);
  return jsonResp({ ok: true });
}
__name(apiBroadcast, "apiBroadcast");
async function apiStats(request, env) {
  const url = new URL(request.url);
  const initData = request.headers.get("X-Init-Data") || "";
  if (!await validateInitData(initData, env.BOT_TOKEN))
    return jsonResp({ ok: false, error: "Unauthorized" }, 401);
  const groupId = url.searchParams.get("groupId");
  if (!groupId)
    return jsonResp({ ok: false, error: "Missing groupId" }, 400);
  try {
    const [count, timer, s] = await Promise.all([
      tg("getChatMemberCount", { chat_id: Number(groupId) }, env.BOT_TOKEN),
      getTimer(env.KV, groupId),
      getSettings(env.KV, groupId)
    ]);
    return jsonResp({ ok: true, stats: {
      memberCount: count,
      isOpen: !!timer,
      closeAt: timer?.closeAt || null,
      welcomeEnabled: s.welcomeEnabled,
      antiSpamEnabled: s.antiSpam.enabled,
      notifyEnabled: s.autoNotify.openEnabled || s.autoNotify.closeEnabled,
      scheduleEnabled: !!(s.schedule.openTime || s.schedule.closeTime),
      scheduleOpen: s.schedule.openTime,
      scheduleClose: s.schedule.closeTime
    } });
  } catch (e) {
    return jsonResp({ ok: false, error: e.message }, 500);
  }
}
__name(apiStats, "apiStats");
async function apiModerate(request, env) {
  const body = await request.json();
  if (!await validateInitData(body.initData || "", env.BOT_TOKEN))
    return jsonResp({ ok: false, error: "Unauthorized" }, 401);
  const user = getUserFromInitData(body.initData || "");
  const { groupId, userId, action, minutes } = body;
  if (!groupId || !userId || !action)
    return jsonResp({ ok: false, error: "Missing params" }, 400);
  if (user && !await isAdmin(groupId, user.id, env.BOT_TOKEN))
    return jsonResp({ ok: false, error: "Not an admin" }, 403);
  const uid = Number(userId);
  if (action === "kick") {
    await tg("banChatMember", { chat_id: Number(groupId), user_id: uid }, env.BOT_TOKEN);
    await tg("unbanChatMember", { chat_id: Number(groupId), user_id: uid, only_if_banned: true }, env.BOT_TOKEN);
  } else if (action === "ban") {
    await tg("banChatMember", { chat_id: Number(groupId), user_id: uid }, env.BOT_TOKEN);
  } else if (action === "mute") {
    const until = Math.floor((Date.now() + (minutes || 60) * 6e4) / 1e3);
    await tg("restrictChatMember", { chat_id: Number(groupId), user_id: uid, permissions: { can_send_messages: false, can_send_polls: false, can_send_other_messages: false, can_add_web_page_previews: false }, until_date: until }, env.BOT_TOKEN);
  } else if (action === "unban") {
    await tg("unbanChatMember", { chat_id: Number(groupId), user_id: uid }, env.BOT_TOKEN);
  }
  return jsonResp({ ok: true });
}
__name(apiModerate, "apiModerate");
var src_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;
    if (method === "OPTIONS")
      return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST" } });
    if (method === "GET" && url.pathname === "/")
      return new Response(MINI_APP_HTML, { headers: { "Content-Type": "text/html;charset=UTF-8" } });
    if (method === "GET" && url.pathname === "/test-tts") {
      const text = url.searchParams.get("text") || "\u179F\u17BD\u179F\u17D2\u178A\u17B8! \u1781\u17D2\u1789\u17BB\u17C6\u1782\u17BA\u1787\u17B6\u179F\u17C6\u17A1\u17C1\u1784\u1794\u17C6\u1794\u17D2\u179B\u17C2\u1784\u17A2\u1780\u17D2\u179F\u179A\u17D4";
      const lang = url.searchParams.get("lang") || "km";
      const speed = url.searchParams.get("speed") || "x1";
      try {
        const audio = await synthesizeTTS(text, lang, speed);
        return new Response(audio, {
          headers: { "Content-Type": "audio/mpeg", "Content-Disposition": "inline; filename=test.mp3" }
        });
      } catch (e) {
        return new Response(JSON.stringify({ ok: false, error: e.message }, null, 2), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }
    if (method === "GET" && url.pathname === "/test") {
      const log = [];
      try {
        const me = await tg("getMe", {}, env.BOT_TOKEN);
        log.push({ step: "getMe", ok: true, bot: me.username });
      } catch (e) {
        log.push({ step: "getMe", ok: false, error: e.message });
      }
      try {
        const kv = await env.KV.get("groups", "json");
        log.push({ step: "KV", ok: true, groups: Object.keys(kv || {}).length });
      } catch (e) {
        log.push({ step: "KV", ok: false, error: e.message });
      }
      try {
        const info = await tg("getWebhookInfo", {}, env.BOT_TOKEN);
        log.push({ step: "webhook", ok: true, url: info.url, pending: info.pending_update_count, last_error: info.last_error_message });
      } catch (e) {
        log.push({ step: "webhook", ok: false, error: e.message });
      }
      return new Response(JSON.stringify({ ok: true, log }, null, 2), {
        headers: { "Content-Type": "application/json" }
      });
    }
    if (method === "GET" && url.pathname === "/setup") {
      const workerUrl = `${url.protocol}//${url.host}/webhook`;
      try {
        await tg("deleteWebhook", { drop_pending_updates: true }, env.BOT_TOKEN);
        const result = await tg("setWebhook", {
          url: workerUrl,
          allowed_updates: ["message", "callback_query", "my_chat_member"]
        }, env.BOT_TOKEN);
        const info = await tg("getWebhookInfo", {}, env.BOT_TOKEN);
        return new Response(JSON.stringify({ ok: true, webhook: workerUrl, info }, null, 2), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ ok: false, error: err.message }, null, 2), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }
    if (method === "GET" && url.pathname === "/api/groups")
      return apiGroups(request, env);
    if (method === "POST" && url.pathname === "/api/open")
      return apiOpen(request, env);
    if (method === "POST" && url.pathname === "/api/close")
      return apiClose(request, env);
    if ((method === "GET" || method === "POST") && url.pathname === "/api/settings")
      return apiSettings(request, env);
    if (method === "POST" && url.pathname === "/api/broadcast")
      return apiBroadcast(request, env);
    if (method === "GET" && url.pathname === "/api/stats")
      return apiStats(request, env);
    if (method === "POST" && url.pathname === "/api/moderate")
      return apiModerate(request, env);
    if (method === "POST" && url.pathname === "/webhook") {
      const update = await request.json();
      const token = env.BOT_TOKEN;
      const KV = env.KV;
      try {
        if (update.my_chat_member) {
          await handleMyChatMember(update.my_chat_member, KV);
        } else if (update.callback_query) {
          await handleCallback(update.callback_query, KV, token);
        } else if (update.message) {
          const msg = update.message;
          if (["group", "supergroup"].includes(msg.chat?.type)) {
            await handleGroupMessage(msg, KV, token);
          } else if (msg.chat?.type === "private") {
            if (msg.text?.startsWith("/start"))
              await handleStart(msg, KV, token);
            else if (msg.text?.startsWith("/manage"))
              await handleManage(msg, KV, token);
            else
              await handleTextInput(msg, KV, token);
          }
        }
      } catch (err) {
        console.error("Webhook error:", err.message, err.stack);
      }
      return new Response("OK");
    }
    return new Response("Not Found", { status: 404 });
  },
  async scheduled(event, env) {
    await runCron(env.KV, env.BOT_TOKEN);
  }
};
export {
  src_default as default
};
//# sourceMappingURL=index.js.map