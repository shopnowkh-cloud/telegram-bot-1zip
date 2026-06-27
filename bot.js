const { TelegramBot } = require('node-telegram-bot-api');
const fs = require('fs');

const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN) {
  console.error('Error: BOT_TOKEN environment variable is not set. Exiting.');
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

// ─── Persistence ───────────────────────────────────────────────────────────────
const GROUPS_FILE   = './groups.json';
const SETTINGS_FILE = './settings.json';

function loadGroups()   { try { return JSON.parse(fs.readFileSync(GROUPS_FILE,   'utf8')); } catch { return {}; } }
function saveGroups(d)  { fs.writeFileSync(GROUPS_FILE,   JSON.stringify(d, null, 2)); }
function loadSettings() { try { return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')); } catch { return {}; } }
function saveSettings(d){ fs.writeFileSync(SETTINGS_FILE, JSON.stringify(d, null, 2)); }

let groups   = loadGroups();
let settings = loadSettings();

function getGroupSettings(groupId) {
  const key = String(groupId);
  if (!settings[key]) {
    settings[key] = {
      welcomeEnabled: false,
      welcomeText: '👋 សូមស្វាគមន៍ {name} ចូលក្រុម *{group}*! 🎉',
      autoNotify: {
        openEnabled:  true,
        openText:  '🔓 Group ឥឡូវបើករួចហើយ! សូមស្វាគមន៍ 🎉',
        closeEnabled: true,
        closeText: '🔒 Group បានបិទហើយ! អរគុណសម្រាប់ការចូលរួម 🙏',
      },
      antiSpam: {
        enabled:       false,
        maxMessages:   5,
        windowSeconds: 10,
        noLinks:       false,
        noForwards:    false,
      },
      schedule: {
        openTime:  null,
        closeTime: null,
      },
    };
    saveSettings(settings);
  }
  return settings[key];
}

// ─── In-memory state ───────────────────────────────────────────────────────────
const sessions        = {};  // sessions[privateChatId]       = { groupId, targetUserId?, targetUserName? }
const openTimers      = {};  // openTimers[groupId]           = { timerId, adminId }
const waitingForInput = {};  // waitingForInput[privateChatId]= { type, groupId, menuMessageId }
const spamTracker     = {};  // spamTracker[groupId][userId]  = [timestamps]

// ─── Group permission helpers ──────────────────────────────────────────────────
async function openGroup(groupId) {
  await bot.setChatPermissions(groupId, {
    can_send_messages:         true,
    can_send_polls:            true,
    can_send_other_messages:   true,
    can_add_web_page_previews: true,
    can_change_info:           false,
    can_invite_users:          true,
    can_pin_messages:          false,
  });
}

async function closeGroup(groupId) {
  await bot.setChatPermissions(groupId, {
    can_send_messages:         false,
    can_send_polls:            false,
    can_send_other_messages:   false,
    can_add_web_page_previews: false,
    can_change_info:           false,
    can_invite_users:          false,
    can_pin_messages:          false,
  });
}

async function isAdmin(groupId, userId) {
  try {
    const m = await bot.getChatMember(groupId, userId);
    return ['administrator', 'creator'].includes(m.status);
  } catch { return false; }
}

function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} នាទី`;
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return m > 0 ? `${h} ម៉ោង ${m} នាទី` : `${h} ម៉ោង`;
}

function getCurrentTimeKH() {
  return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Phnom_Penh' });
}

function getCloseTimeStr(minutes) {
  const closeAt = new Date(Date.now() + minutes * 60 * 1000);
  return closeAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Phnom_Penh' });
}

// ─── TTS: Voice maps ───────────────────────────────────────────────────────────
const MALE_VOICES = {
  'af':'af-ZA-WillemNeural','am':'am-ET-AmehaNeural','ar':'ar-SA-HamedNeural',
  'az':'az-AZ-BabakNeural','bg':'bg-BG-BorislavNeural','bn':'bn-BD-PradeepNeural',
  'bs':'bs-BA-GoranNeural','ca':'ca-ES-EnricNeural','cs':'cs-CZ-AntoninNeural',
  'cy':'cy-GB-AledNeural','da':'da-DK-JeppeNeural','de':'de-DE-FlorianMultilingualNeural',
  'el':'el-GR-NestorasNeural','en':'en-US-AndrewMultilingualNeural','es':'es-ES-AlvaroNeural',
  'et':'et-EE-KertNeural','fa':'fa-IR-FaridNeural','fi':'fi-FI-HarriNeural',
  'fil':'fil-PH-AngeloNeural','fr':'fr-FR-RemyMultilingualNeural','ga':'ga-IE-ColmNeural',
  'gl':'gl-ES-RoiNeural','gu':'gu-IN-NiranjanNeural','he':'he-IL-AvriNeural',
  'hi':'hi-IN-MadhurNeural','hr':'hr-HR-SreckoNeural','hu':'hu-HU-TamasNeural',
  'id':'id-ID-ArdiNeural','is':'is-IS-GunnarNeural','it':'it-IT-GiuseppeMultilingualNeural',
  'ja':'ja-JP-KeitaNeural','jv':'jv-ID-DimasNeural','ka':'ka-GE-GiorgiNeural',
  'kk':'kk-KZ-DauletNeural','km':'km-KH-PisethNeural','kn':'kn-IN-GaganNeural',
  'ko':'ko-KR-HyunsuMultilingualNeural','lo':'lo-LA-ChanthavongNeural','lt':'lt-LT-LeonasNeural',
  'lv':'lv-LV-NilsNeural','mk':'mk-MK-AleksandarNeural','ml':'ml-IN-MidhunNeural',
  'mn':'mn-MN-BataaNeural','mr':'mr-IN-ManoharNeural','ms':'ms-MY-OsmanNeural',
  'mt':'mt-MT-JosephNeural','my':'my-MM-ThihaNeural','nb':'nb-NO-FinnNeural',
  'ne':'ne-NP-SagarNeural','nl':'nl-NL-MaartenNeural','pl':'pl-PL-MarekNeural',
  'ps':'ps-AF-GulNawazNeural','pt':'pt-BR-AntonioNeural','ro':'ro-RO-EmilNeural',
  'ru':'ru-RU-DmitryNeural','si':'si-LK-SameeraNeural','sk':'sk-SK-LukasNeural',
  'sl':'sl-SI-RokNeural','so':'so-SO-MuuseNeural','sq':'sq-AL-IlirNeural',
  'sr':'sr-RS-NicholasNeural','su':'su-ID-JajangNeural','sv':'sv-SE-MattiasNeural',
  'sw':'sw-KE-RafikiNeural','ta':'ta-IN-ValluvarNeural','te':'te-IN-MohanNeural',
  'th':'th-TH-NiwatNeural','tr':'tr-TR-AhmetNeural','uk':'uk-UA-OstapNeural',
  'ur':'ur-IN-SalmanNeural','uz':'uz-UZ-SardorNeural','vi':'vi-VN-NamMinhNeural',
  'zh-CN':'zh-CN-YunyangNeural','zh-TW':'zh-TW-YunJheNeural','zu':'zu-ZA-ThembaNeural',
};

const FEMALE_VOICES = {
  'af':'af-ZA-AdriNeural','am':'am-ET-MekdesNeural','ar':'ar-SA-ZariyahNeural',
  'az':'az-AZ-BanuNeural','bg':'bg-BG-KalinaNeural','bn':'bn-BD-NabanitaNeural',
  'bs':'bs-BA-VesnaNeural','ca':'ca-ES-JoanaNeural','cs':'cs-CZ-VlastaNeural',
  'cy':'cy-GB-NiaNeural','da':'da-DK-ChristelNeural','de':'de-DE-SeraphinaMultilingualNeural',
  'el':'el-GR-AthinaNeural','en':'en-US-AvaMultilingualNeural','es':'es-ES-XimenaNeural',
  'et':'et-EE-AnuNeural','fa':'fa-IR-DilaraNeural','fi':'fi-FI-NooraNeural',
  'fil':'fil-PH-BlessicaNeural','fr':'fr-FR-VivienneMultilingualNeural','ga':'ga-IE-OrlaNeural',
  'gl':'gl-ES-SabelaNeural','gu':'gu-IN-DhwaniNeural','he':'he-IL-HilaNeural',
  'hi':'hi-IN-SwaraNeural','hr':'hr-HR-GabrijelaNeural','hu':'hu-HU-NoemiNeural',
  'id':'id-ID-GadisNeural','is':'is-IS-GudrunNeural','it':'it-IT-IsabellaNeural',
  'ja':'ja-JP-NanamiNeural','jv':'jv-ID-SitiNeural','ka':'ka-GE-EkaNeural',
  'kk':'kk-KZ-AigulNeural','km':'km-KH-SreymomNeural','kn':'kn-IN-SapnaNeural',
  'ko':'ko-KR-SunHiNeural','lo':'lo-LA-KeomanyNeural','lt':'lt-LT-OnaNeural',
  'lv':'lv-LV-EveritaNeural','mk':'mk-MK-MarijaNeural','ml':'ml-IN-SobhanaNeural',
  'mn':'mn-MN-YesuiNeural','mr':'mr-IN-AarohiNeural','ms':'ms-MY-YasminNeural',
  'mt':'mt-MT-GraceNeural','my':'my-MM-NilarNeural','nb':'nb-NO-PernilleNeural',
  'ne':'ne-NP-HemkalaNeural','nl':'nl-NL-ColetteNeural','pl':'pl-PL-ZofiaNeural',
  'ps':'ps-AF-LatifaNeural','pt':'pt-BR-ThalitaMultilingualNeural','ro':'ro-RO-AlinaNeural',
  'ru':'ru-RU-SvetlanaNeural','si':'si-LK-ThiliniNeural','sk':'sk-SK-ViktoriaNeural',
  'sl':'sl-SI-PetraNeural','so':'so-SO-UbaxNeural','sq':'sq-AL-AnilaNeural',
  'sr':'sr-RS-SophieNeural','su':'su-ID-TutiNeural','sv':'sv-SE-SofieNeural',
  'sw':'sw-KE-ZuriNeural','ta':'ta-IN-PallaviNeural','te':'te-IN-ShrutiNeural',
  'th':'th-TH-PremwadeeNeural','tr':'tr-TR-EmelNeural','uk':'uk-UA-PolinaNeural',
  'ur':'ur-IN-GulNeural','uz':'uz-UZ-MadinaNeural','vi':'vi-VN-HoaiMyNeural',
  'zh-CN':'zh-CN-XiaoxiaoNeural','zh-TW':'zh-TW-HsiaoChenNeural','zu':'zu-ZA-ThandoNeural',
};

const SPEED_RATES  = { 'x0.5': '-50%', 'x1': '+0%', 'x1.5': '+50%', 'x2': '+100%' };
const SPEED_LABELS = { 'x0.5': '🐢 x0.5', 'x1': '▶️ x1', 'x1.5': '⚡ x1.5', 'x2': '🚀 x2' };

const GOOGLE_TTS_SPEED = { 'x0.5': '0.7', 'x1': '1', 'x1.5': '1.3', 'x2': '1.5' };

// ─── TTS: Language detection ───────────────────────────────────────────────────
const SCRIPT_MAP = [
  [/[\u1780-\u17FF]/, 'km'],
  [/[\u0E00-\u0E7F]/, 'th'],
  [/[\u0E80-\u0EFF]/, 'lo'],
  [/[\u1000-\u109F]/, 'my'],
  [/[\u1200-\u137F]/, 'am'],
  [/[\u10A0-\u10FF]/, 'ka'],
  [/[\u0590-\u05FF]/, 'he'],
  [/[\u0900-\u097F]/, 'hi'],
  [/[\u0980-\u09FF]/, 'bn'],
  [/[\u0A80-\u0AFF]/, 'gu'],
  [/[\u0B80-\u0BFF]/, 'ta'],
  [/[\u0C00-\u0C7F]/, 'te'],
  [/[\u0C80-\u0CFF]/, 'kn'],
  [/[\u0D00-\u0D7F]/, 'ml'],
  [/[\u0D80-\u0DFF]/, 'si'],
  [/[\u0600-\u06FF]/, 'ar'],
  [/[\u3040-\u30FF]/, 'ja'],
  [/[\uAC00-\uD7AF]/, 'ko'],
  [/[\u4E00-\u9FFF\u3400-\u4DBF]/, 'zh-CN'],
  [/[\u0400-\u04FF]/, 'ru'],
];

function detectLang(text) {
  for (const [pattern, lang] of SCRIPT_MAP) {
    if (pattern.test(text)) return lang;
  }
  return 'en';
}

function getVoice(lang, gender) {
  const map = gender === 'male' ? MALE_VOICES : FEMALE_VOICES;
  return map[lang] || map['en'];
}

function stripUnspeakable(text) {
  return text
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/[\u2600-\u27FF\u2B00-\u2BFF\uFE00-\uFEFF]/g, '')
    .replace(/[\uD800-\uDFFF]/g, '')
    .trim();
}

// ─── TTS: Google TTS synthesis (no API key required) ──────────────────────────
const GOOGLE_TTS_LANG = {
  km: 'km', en: 'en', th: 'th', zh: 'zh-CN', ja: 'ja', ko: 'ko',
  vi: 'vi', fr: 'fr', de: 'de', es: 'es', ru: 'ru', ar: 'ar',
  hi: 'hi', pt: 'pt', it: 'it', id: 'id', ms: 'ms', tr: 'tr',
  pl: 'pl', nl: 'nl', sv: 'sv', da: 'da', fi: 'fi', no: 'no',
  uk: 'uk', cs: 'cs', ro: 'ro', hu: 'hu', el: 'el', he: 'he',
  bn: 'bn', ur: 'ur', fa: 'fa', ta: 'ta', te: 'te', ml: 'ml',
  my: 'my', lo: 'lo', si: 'si', mn: 'mn', 'zh-CN': 'zh-CN', 'zh-TW': 'zh-TW',
};

async function synthesizeTTS(text, lang, speed = 'x1') {
  const cleanText = stripUnspeakable(text);
  if (!cleanText) throw new Error('No speakable text');

  const gLang  = GOOGLE_TTS_LANG[lang] || 'en';
  const gSpeed = GOOGLE_TTS_SPEED[speed] || '1';

  const MAX = 180;
  const parts = [];
  let remaining = cleanText;
  while (remaining.length > 0) {
    if (remaining.length <= MAX) { parts.push(remaining); break; }
    let cut = remaining.lastIndexOf(' ', MAX);
    if (cut <= 0) cut = MAX;
    parts.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }

  const buffers = [];
  for (const part of parts) {
    const url = `https://translate.google.com/translate_tts` +
      `?ie=UTF-8&q=${encodeURIComponent(part)}&tl=${gLang}&ttsspeed=${gSpeed}&client=tw-ob`;
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://translate.google.com/',
        'Accept': 'audio/mpeg,audio/*;q=0.9,*/*;q=0.8',
      },
    });
    if (!resp.ok) throw new Error(`Google TTS HTTP ${resp.status} for lang=${gLang}`);
    buffers.push(Buffer.from(await resp.arrayBuffer()));
  }

  if (buffers.length === 1) return buffers[0];
  return Buffer.concat(buffers);
}

// ─── TTS: Preferences storage ─────────────────────────────────────────────────
const TTS_PREFS_FILE = './tts_prefs.json';
function loadTTSPrefs()  { try { return JSON.parse(fs.readFileSync(TTS_PREFS_FILE, 'utf8')); } catch { return {}; } }
function saveTTSPrefs(d) { fs.writeFileSync(TTS_PREFS_FILE, JSON.stringify(d, null, 2)); }
let ttsPrefs = loadTTSPrefs();

function getTTSPref(uid) {
  return ttsPrefs[String(uid)] || { gender: 'female', speed: 'x1' };
}
function setTTSPref(uid, pref) {
  ttsPrefs[String(uid)] = pref;
  saveTTSPrefs(ttsPrefs);
}

// ─── TTS: In-memory cache (file_id) ───────────────────────────────────────────
const ttsCache = new Map();

// ─── TTS: Voice keyboard ───────────────────────────────────────────────────────
function buildVoiceKeyboard(gender, speed) {
  const gRow = [
    { text: `${gender === 'female' ? '✅ ' : ''}👩 ស្រី`,  callback_data: 'voice:female' },
    { text: `${gender === 'male'   ? '✅ ' : ''}👨 ប្រុស`, callback_data: 'voice:male'   },
  ];
  const sRow = Object.keys(SPEED_RATES).map(s => ({
    text: (s === speed ? '✅ ' : '') + SPEED_LABELS[s],
    callback_data: `set_speed:${s}`,
  }));
  return { inline_keyboard: [gRow, sRow] };
}

// ─── TTS: Main handler ────────────────────────────────────────────────────────
async function handleTTS(msg) {
  const text = msg.text?.trim();
  if (!text || text.length < 1) return;
  if (/^\s*$/.test(stripUnspeakable(text))) return;

  const uid    = msg.from?.id || msg.chat.id;
  const pref   = getTTSPref(uid);
  const gender = pref.gender || 'female';
  const speed  = pref.speed  || 'x1';
  const lang   = detectLang(text);
  const cacheKey = `${lang}:${gender}:${speed}:${text}`;
  const keyboard = buildVoiceKeyboard(gender, speed);

  bot.sendChatAction(msg.chat.id, 'record_voice').catch(() => {});

  try {
    const cached = ttsCache.get(cacheKey);
    if (cached) {
      await bot.sendVoice(msg.chat.id, cached, {
        caption: '🔈 Text to Voice Bot',
        reply_to_message_id: msg.message_id,
        reply_markup: keyboard,
      });
      return;
    }

    const audioBuffer = await synthesizeTTS(text, lang, speed);
    const result = await bot.sendVoice(msg.chat.id, audioBuffer, {
      caption: '🔈 Text to Voice Bot',
      reply_to_message_id: msg.message_id,
      reply_markup: keyboard,
    });

    const fileId = result?.voice?.file_id;
    if (fileId) ttsCache.set(cacheKey, fileId);

  } catch (err) {
    console.error('TTS error:', err.message);
    await bot.sendMessage(msg.chat.id, '⚠️ មានបញ្ហាក្នុងការបង្កើតសំឡេង។ សូមព្យាយាមម្តងទៀត។', {
      reply_to_message_id: msg.message_id,
    }).catch(() => {});
  }
}

// ─── Keyboards ─────────────────────────────────────────────────────────────────

function groupListKeyboard() {
  const rows = Object.values(groups).map(g => ([
    { text: `👥 ${g.title}`, callback_data: `sel_${g.id}` },
  ]));
  return { inline_keyboard: rows };
}

function mainMenuKeyboard(groupId) {
  const hasTimer = !!openTimers[groupId];
  const s = getGroupSettings(groupId);
  const openBtn  = hasTimer
    ? { text: '🔒 បិទ Group',  callback_data: 'action_close' }
    : { text: '🔓 បើក Group',  callback_data: 'menu_open'   };

  return {
    inline_keyboard: [
      [openBtn, { text: '📊 ស្ថិតិ', callback_data: 'action_stats' }],
      [{ text: '📢 Broadcast', callback_data: 'action_broadcast' }, { text: '📌 Pin/Unpin', callback_data: 'menu_pin' }],
      [{ text: '🚫 គ្រប់គ្រងសមាជិក', callback_data: 'menu_members' }],
      [{ text: '⏰ Schedule', callback_data: 'menu_schedule' }, { text: '⚙️ Settings', callback_data: 'menu_settings' }],
      [{ text: '« ជ្រើស Group ផ្សេង', callback_data: 'back_groups' }],
    ],
  };
}

function durationKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '5 នាទី',  callback_data: 'open_5'   }, { text: '10 នាទី', callback_data: 'open_10'  }, { text: '15 នាទី', callback_data: 'open_15'  }],
      [{ text: '30 នាទី', callback_data: 'open_30'  }, { text: '1 ម៉ោង',  callback_data: 'open_60'  }, { text: '2 ម៉ោង',  callback_data: 'open_120' }],
      [{ text: '⌨️ កំណត់ផ្ទាល់ខ្លួន', callback_data: 'open_custom' }],
      [{ text: '« ត្រឡប់',             callback_data: 'back_control' }],
    ],
  };
}

function membersMenuKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '🚫 Kick សមាជិក',  callback_data: 'member_kick'   }, { text: '⛔ Ban សមាជិក',   callback_data: 'member_ban'    }],
      [{ text: '🔇 Mute សមាជិក',  callback_data: 'member_mute'   }, { text: '🔊 Unmute សមាជិក', callback_data: 'member_unmute' }],
      [{ text: '« ត្រឡប់', callback_data: 'back_control' }],
    ],
  };
}

function scheduleMenuKeyboard(groupId) {
  const sc = getGroupSettings(groupId).schedule;
  return {
    inline_keyboard: [
      [{ text: `🔓 ម៉ោងបើក:  ${sc.openTime  || '—'}`, callback_data: 'schedule_set_open'  }],
      [{ text: `🔒 ម៉ោងបិទ: ${sc.closeTime || '—'}`, callback_data: 'schedule_set_close' }],
      [{ text: '🗑 លុប Schedule ទាំងអស់', callback_data: 'schedule_clear' }],
      [{ text: '« ត្រឡប់', callback_data: 'back_control' }],
    ],
  };
}

function settingsMenuKeyboard(groupId) {
  const s = getGroupSettings(groupId);
  const notifyOn = s.autoNotify.openEnabled || s.autoNotify.closeEnabled;
  return {
    inline_keyboard: [
      [{ text: `👋 Welcome: ${s.welcomeEnabled ? '✅ ON' : '❌ OFF'}`, callback_data: 'settings_welcome_toggle' }],
      [{ text: '✏️ កែ Welcome Text',                                   callback_data: 'settings_welcome_text'   }],
      [{ text: `🔔 Auto-Notify: ${notifyOn ? '✅ ON' : '❌ OFF'}`,     callback_data: 'menu_notify'             }],
      [{ text: `🤖 Anti-Spam: ${s.antiSpam.enabled ? '✅ ON' : '❌ OFF'}`, callback_data: 'menu_antispam'       }],
      [{ text: '« ត្រឡប់', callback_data: 'back_control' }],
    ],
  };
}

function notifyMenuKeyboard(groupId) {
  const n = getGroupSettings(groupId).autoNotify;
  return {
    inline_keyboard: [
      [{ text: `🔓 ជូនដំណឹងពេលបើក: ${n.openEnabled  ? '✅' : '❌'}`, callback_data: 'notify_toggle_open'  }],
      [{ text: '✏️ កែ Open Text',                                       callback_data: 'notify_edit_open'     }],
      [{ text: `🔒 ជូនដំណឹងពេលបិទ: ${n.closeEnabled ? '✅' : '❌'}`, callback_data: 'notify_toggle_close' }],
      [{ text: '✏️ កែ Close Text',                                      callback_data: 'notify_edit_close'    }],
      [{ text: '« ត្រឡប់', callback_data: 'menu_settings' }],
    ],
  };
}

function antiSpamMenuKeyboard(groupId) {
  const a = getGroupSettings(groupId).antiSpam;
  return {
    inline_keyboard: [
      [{ text: `🤖 Anti-Spam: ${a.enabled ? '✅ ON' : '❌ OFF'}`,          callback_data: 'antispam_toggle'          }],
      [{ text: `🔗 Block Links: ${a.noLinks ? '✅' : '❌'}`,               callback_data: 'antispam_toggle_links'    }],
      [{ text: `↪️ Block Forwards: ${a.noForwards ? '✅' : '❌'}`,         callback_data: 'antispam_toggle_forwards' }],
      [{ text: `📨 ដែនកំណត់: ${a.maxMessages} msg/${a.windowSeconds}s`, callback_data: 'antispam_cycle_limit'    }],
      [{ text: '« ត្រឡប់', callback_data: 'menu_settings' }],
    ],
  };
}

// ─── Screen renderers ──────────────────────────────────────────────────────────

async function showGroupList(chatId, messageId = null) {
  const count = Object.keys(groups).length;
  const text  = count
    ? '👥 *ជ្រើស Group ដែលចង់គ្រប់គ្រង:*'
    : '⚠️ Bot មិនទាន់ត្រូវបានបន្ថែមទៅ Group ណាមួយទេ។\n\nសូម Add bot ចូល Group ហើយ តែងតាំងជា Admin មុន។';
  const opts = { parse_mode: 'Markdown', reply_markup: count ? groupListKeyboard() : undefined };
  if (messageId) await bot.editMessageText(text, { chat_id: chatId, message_id: messageId, ...opts });
  else           await bot.sendMessage(chatId, text, opts);
}

async function showDashboard(chatId, messageId, groupId) {
  const g      = groups[groupId];
  const timer  = openTimers[groupId];
  const status = timer ? '🟢 កំពុងបើក' : '🔴 បានបិទ';
  const s      = getGroupSettings(groupId);

  let text = `🎛 *Dashboard — ${g.title}*\n\n`;
  text += `📍 ស្ថានភាព: ${status}\n`;
  text += `👋 Welcome: ${s.welcomeEnabled ? 'ON' : 'OFF'}   `;
  text += `🤖 Anti-Spam: ${s.antiSpam.enabled ? 'ON' : 'OFF'}\n`;
  text += `🔔 Auto-Notify: ${(s.autoNotify.openEnabled || s.autoNotify.closeEnabled) ? 'ON' : 'OFF'}   `;
  text += `⏰ Schedule: ${(s.schedule.openTime || s.schedule.closeTime) ? 'ON' : 'OFF'}\n`;
  text += `🕐 ម៉ោង: *${getCurrentTimeKH()}*`;

  await bot.editMessageText(text, {
    chat_id: chatId, message_id: messageId,
    parse_mode: 'Markdown',
    reply_markup: mainMenuKeyboard(groupId),
  });
}

async function showDurationPicker(chatId, messageId) {
  await bot.editMessageText(
    '⏱ *ជ្រើសរើសរយៈពេលបើក Group*\n\nGroup នឹងបិទដោយស្វ័យប្រវត្តិ បន្ទាប់ពីរយៈពេលដែលបានជ្រើស។',
    { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', reply_markup: durationKeyboard() }
  );
}

// ─── Activate open ─────────────────────────────────────────────────────────────

async function activateOpen(chatId, messageId, groupId, minutes) {
  if (openTimers[groupId]) {
    clearTimeout(openTimers[groupId].timerId);
    delete openTimers[groupId];
  }

  await openGroup(groupId);

  const g       = groups[groupId];
  const s       = getGroupSettings(groupId);
  const timeStr = getCloseTimeStr(minutes);

  if (s.autoNotify.openEnabled) {
    try { await bot.sendMessage(groupId, s.autoNotify.openText); } catch {}
  }

  await bot.editMessageText(
    `✅ *Group បើករួចហើយ!*\n\n👥 Group: *${g.title}*\n⏱ រយៈពេល: *${formatDuration(minutes)}*\n🕐 នឹងបិទ នៅម៉ោង *${timeStr}*`,
    {
      chat_id: chatId, message_id: messageId, parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔒 បិទភ្លាមៗ',        callback_data: 'action_close'  }],
          [{ text: '« ត្រឡប់ Dashboard', callback_data: 'back_control' }],
        ],
      },
    }
  );

  const timerId = setTimeout(async () => {
    try {
      await closeGroup(groupId);
      if (s.autoNotify.closeEnabled) {
        try { await bot.sendMessage(groupId, s.autoNotify.closeText); } catch {}
      }
      await bot.sendMessage(chatId, `🔒 *${g.title}* បានបិទដោយស្វ័យប្រវត្តិ!`, { parse_mode: 'Markdown' });
    } catch (err) { console.error('Auto-close error:', err.message); }
    delete openTimers[groupId];
  }, minutes * 60 * 1000);

  openTimers[groupId] = { timerId, adminId: chatId };
}

// ─── Schedule checker (every minute) ──────────────────────────────────────────
setInterval(async () => {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Phnom_Penh' }));
  const hhmm = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  for (const groupId of Object.keys(groups)) {
    const s = getGroupSettings(groupId);

    if (s.schedule.openTime === hhmm && !openTimers[groupId]) {
      try {
        await openGroup(groupId);
        if (s.autoNotify.openEnabled) await bot.sendMessage(groupId, s.autoNotify.openText);
        console.log(`[Schedule] Opened: ${groups[groupId].title}`);
      } catch (err) { console.error('Schedule open error:', err.message); }
    }

    if (s.schedule.closeTime === hhmm) {
      try {
        if (openTimers[groupId]) { clearTimeout(openTimers[groupId].timerId); delete openTimers[groupId]; }
        await closeGroup(groupId);
        if (s.autoNotify.closeEnabled) await bot.sendMessage(groupId, s.autoNotify.closeText);
        console.log(`[Schedule] Closed: ${groups[groupId].title}`);
      } catch (err) { console.error('Schedule close error:', err.message); }
    }
  }
}, 60 * 1000);

// ─── Track when bot is added/removed from groups ───────────────────────────────
bot.on('my_chat_member', (update) => {
  const chat   = update.chat;
  const status = update.new_chat_member.status;
  if (['group', 'supergroup'].includes(chat.type)) {
    if (['member', 'administrator'].includes(status)) {
      groups[chat.id] = { id: chat.id, title: chat.title };
      saveGroups(groups);
      console.log(`Added to group: ${chat.title}`);
    } else if (['left', 'kicked'].includes(status)) {
      delete groups[chat.id];
      saveGroups(groups);
      console.log(`Removed from group: ${chat.title}`);
    }
  }
});

// ─── All message handling ──────────────────────────────────────────────────────
bot.on('message', async (msg) => {
  const chatType = msg.chat?.type;

  // ── Auto-register groups ───────────────────────────────────────────────────
  if (['group', 'supergroup'].includes(chatType)) {
    const id = msg.chat.id;
    if (!groups[id] || groups[id].title !== msg.chat.title) {
      groups[id] = { id, title: msg.chat.title };
      saveGroups(groups);
    }
  }

  // ── Welcome new members ────────────────────────────────────────────────────
  if (msg.new_chat_members && ['group', 'supergroup'].includes(chatType)) {
    const s = getGroupSettings(msg.chat.id);
    if (s.welcomeEnabled) {
      for (const member of msg.new_chat_members) {
        if (member.is_bot) continue;
        const name = member.first_name + (member.last_name ? ` ${member.last_name}` : '');
        const text = s.welcomeText
          .replace('{name}',  `[${name}](tg://user?id=${member.id})`)
          .replace('{group}', msg.chat.title || '');
        try { await bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' }); } catch {}
      }
    }
    return;
  }

  // ── Anti-Spam (groups only) ────────────────────────────────────────────────
  if (['group', 'supergroup'].includes(chatType) && !msg.new_chat_members) {
    const groupId = String(msg.chat.id);
    const s       = getGroupSettings(groupId);

    if (s.antiSpam.enabled && msg.from) {
      const userId = msg.from.id;

      // Skip admins/bots
      const isAdminUser = await isAdmin(groupId, userId).catch(() => false);
      if (!isAdminUser && !msg.from.is_bot) {
        let shouldDelete = false;
        let reason = '';

        if (s.antiSpam.noLinks && msg.text) {
          if (/(https?:\/\/|t\.me\/|@\w{5,})/i.test(msg.text)) {
            shouldDelete = true; reason = '🔗 Link';
          }
        }

        if (!shouldDelete && s.antiSpam.noForwards && (msg.forward_date || msg.forward_from || msg.forward_from_chat)) {
          shouldDelete = true; reason = '↪️ Forward';
        }

        if (!shouldDelete) {
          if (!spamTracker[groupId])         spamTracker[groupId] = {};
          if (!spamTracker[groupId][userId]) spamTracker[groupId][userId] = [];
          const now    = Date.now();
          const window = s.antiSpam.windowSeconds * 1000;
          spamTracker[groupId][userId] = spamTracker[groupId][userId].filter(t => now - t < window);
          spamTracker[groupId][userId].push(now);
          if (spamTracker[groupId][userId].length > s.antiSpam.maxMessages) {
            shouldDelete = true; reason = '📨 Spam';
          }
        }

        if (shouldDelete) {
          try {
            await bot.deleteMessage(groupId, msg.message_id);
            const warn = await bot.sendMessage(
              groupId,
              `⚠️ សារត្រូវបានលុប (${reason}) — [${msg.from.first_name}](tg://user?id=${userId})`,
              { parse_mode: 'Markdown' }
            );
            setTimeout(() => bot.deleteMessage(groupId, warn.message_id).catch(() => {}), 5000);
          } catch {}
        }
      }
    }
    return;
  }

  // ── Private chat: /start ───────────────────────────────────────────────────
  if (chatType === 'private' && msg.text && msg.text.startsWith('/start')) {
    delete sessions[msg.chat.id];
    delete waitingForInput[msg.chat.id];
    await showGroupList(msg.chat.id);
    return;
  }

  // ── Private chat: waiting for text input ──────────────────────────────────
  if (chatType !== 'private') return;

  const chatId = msg.chat.id;
  const state  = waitingForInput[chatId];

  // ── No active input state → handle as TTS ────────────────────────────────
  if (!state) {
    if (msg.text && !msg.text.startsWith('/')) {
      await handleTTS(msg);
    }
    return;
  }

  if (msg.text && msg.text.startsWith('/')) return;

  // For broadcast: don't delete — we need the message content
  if (state.type !== 'broadcast') {
    try { await bot.deleteMessage(chatId, msg.message_id); } catch {}
  }

  switch (state.type) {

    // ── Custom duration ──────────────────────────────────────────────────────
    case 'custom_duration': {
      const minutes = parseInt(msg.text?.trim());
      if (isNaN(minutes) || minutes <= 0 || minutes > 1440) {
        const w = await bot.sendMessage(chatId, '⚠️ សូមវាយចំនួនគត់ រវាង *1 – 1440* នាទី។', { parse_mode: 'Markdown' });
        setTimeout(() => bot.deleteMessage(chatId, w.message_id).catch(() => {}), 4000);
        return;
      }
      delete waitingForInput[chatId];
      try {
        await activateOpen(chatId, state.menuMessageId, state.groupId, minutes);
      } catch (err) {
        await bot.editMessageText('❌ មិនអាចបើក Group បានទេ។ ពិនិត្យ Admin + Restrict Members Permission។', {
          chat_id: chatId, message_id: state.menuMessageId, parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'back_control' }]] },
        });
      }
      break;
    }

    // ── Broadcast ────────────────────────────────────────────────────────────
    case 'broadcast': {
      delete waitingForInput[chatId];
      try {
        await bot.copyMessage(state.groupId, chatId, msg.message_id);
        await bot.deleteMessage(chatId, msg.message_id).catch(() => {});
        await bot.editMessageText(
          `✅ *Broadcast ផ្ញើជោគជ័យ!*\n\nសារត្រូវបានផ្ញើទៅ *${groups[state.groupId]?.title}*`,
          {
            chat_id: chatId, message_id: state.menuMessageId, parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់ Dashboard', callback_data: 'back_control' }]] },
          }
        );
      } catch (err) {
        console.error('Broadcast error:', err.message);
        // fallback: try sendMessage for text
        if (msg.text) {
          try {
            await bot.sendMessage(state.groupId, msg.text);
            await bot.deleteMessage(chatId, msg.message_id).catch(() => {});
            await bot.editMessageText(
              `✅ *Broadcast ផ្ញើជោគជ័យ!*\n\nសារត្រូវបានផ្ញើទៅ *${groups[state.groupId]?.title}*`,
              {
                chat_id: chatId, message_id: state.menuMessageId, parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់ Dashboard', callback_data: 'back_control' }]] },
              }
            );
            break;
          } catch {}
        }
        await bot.editMessageText('❌ មិនអាចផ្ញើ Broadcast បានទេ។', {
          chat_id: chatId, message_id: state.menuMessageId,
          reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'back_control' }]] },
        });
      }
      break;
    }

    // ── Welcome text ─────────────────────────────────────────────────────────
    case 'welcome_text': {
      const text = msg.text?.trim();
      if (!text) return;
      delete waitingForInput[chatId];
      const s = getGroupSettings(state.groupId);
      s.welcomeText = text;
      saveSettings(settings);
      await bot.editMessageText(
        `✅ *Welcome Text បានរក្សាទុក!*\n\n_${text}_`,
        {
          chat_id: chatId, message_id: state.menuMessageId, parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'menu_settings' }]] },
        }
      );
      break;
    }

    // ── Notify texts ──────────────────────────────────────────────────────────
    case 'notify_open_text': {
      const text = msg.text?.trim();
      if (!text) return;
      delete waitingForInput[chatId];
      getGroupSettings(state.groupId).autoNotify.openText = text;
      saveSettings(settings);
      await bot.editMessageText('✅ *Open Notify Text បានរក្សាទុក!*', {
        chat_id: chatId, message_id: state.menuMessageId, parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'menu_notify' }]] },
      });
      break;
    }

    case 'notify_close_text': {
      const text = msg.text?.trim();
      if (!text) return;
      delete waitingForInput[chatId];
      getGroupSettings(state.groupId).autoNotify.closeText = text;
      saveSettings(settings);
      await bot.editMessageText('✅ *Close Notify Text បានរក្សាទុក!*', {
        chat_id: chatId, message_id: state.menuMessageId, parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'menu_notify' }]] },
      });
      break;
    }

    // ── Schedule time ─────────────────────────────────────────────────────────
    case 'schedule_open':
    case 'schedule_close': {
      const time = msg.text?.trim();
      if (!/^\d{1,2}:\d{2}$/.test(time)) {
        const w = await bot.sendMessage(chatId, '⚠️ Format: HH:MM (ឧ. 08:00 ឬ 22:30)', { parse_mode: 'Markdown' });
        setTimeout(() => bot.deleteMessage(chatId, w.message_id).catch(() => {}), 4000);
        return;
      }
      const [hStr, mStr] = time.split(':');
      const h = parseInt(hStr), m = parseInt(mStr);
      if (h > 23 || m > 59) {
        const w = await bot.sendMessage(chatId, '⚠️ ម៉ោងមិនត្រឹមត្រូវ (00:00 – 23:59)');
        setTimeout(() => bot.deleteMessage(chatId, w.message_id).catch(() => {}), 4000);
        return;
      }
      const formatted = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
      delete waitingForInput[chatId];
      const sc = getGroupSettings(state.groupId).schedule;
      if (state.type === 'schedule_open')  sc.openTime  = formatted;
      else                                  sc.closeTime = formatted;
      saveSettings(settings);
      const label = state.type === 'schedule_open' ? 'បើក' : 'បិទ';
      await bot.editMessageText(`✅ *Schedule ${label}: ${formatted}*`, {
        chat_id: chatId, message_id: state.menuMessageId, parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'menu_schedule' }]] },
      });
      break;
    }

    // ── Member action: get target user ────────────────────────────────────────
    case 'member_action': {
      let targetId   = null;
      let targetName = 'Unknown';

      if (msg.forward_from) {
        targetId   = msg.forward_from.id;
        targetName = msg.forward_from.first_name || 'Unknown';
      } else if (msg.text) {
        const parsed = parseInt(msg.text.trim().replace('@', ''));
        if (!isNaN(parsed)) { targetId = parsed; }
      }

      if (!targetId) {
        const w = await bot.sendMessage(chatId, '⚠️ សូម Forward សារពី User ហើយ ឬ វាយ User ID ផ្ទាល់។');
        setTimeout(() => bot.deleteMessage(chatId, w.message_id).catch(() => {}), 4000);
        return;
      }

      delete waitingForInput[chatId];
      sessions[chatId] = sessions[chatId] || {};
      sessions[chatId].targetUserId   = targetId;
      sessions[chatId].targetUserName = targetName;

      await bot.editMessageText(
        `👤 *User: ${targetName}*\nID: \`${targetId}\`\n\nជ្រើសសកម្មភាព:`,
        {
          chat_id: chatId, message_id: state.menuMessageId, parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🚫 Kick', callback_data: 'do_kick' }, { text: '⛔ Ban', callback_data: 'do_ban' }],
              [{ text: '🔇 Mute 1ម៉ោង', callback_data: 'do_mute_60' }, { text: '🔇 Mute 24ម៉ោង', callback_data: 'do_mute_1440' }],
              [{ text: '🔊 Unmute', callback_data: 'do_unmute' }],
              [{ text: '« ត្រឡប់', callback_data: 'menu_members' }],
            ],
          },
        }
      );
      break;
    }

    // ── Pin: enter message ID ─────────────────────────────────────────────────
    case 'pin_message': {
      const msgId = parseInt(msg.text?.trim());
      if (isNaN(msgId)) {
        const w = await bot.sendMessage(chatId, '⚠️ សូមវាយ Message ID (លេខ)');
        setTimeout(() => bot.deleteMessage(chatId, w.message_id).catch(() => {}), 4000);
        return;
      }
      delete waitingForInput[chatId];
      try {
        await bot.pinChatMessage(state.groupId, msgId, { disable_notification: false });
        await bot.editMessageText('📌 *Pin ជោគជ័យ!*', {
          chat_id: chatId, message_id: state.menuMessageId, parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'menu_pin' }]] },
        });
      } catch (err) {
        await bot.editMessageText(`❌ Pin មិនជោគជ័យ:\n${err.message}`, {
          chat_id: chatId, message_id: state.menuMessageId,
          reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'menu_pin' }]] },
        });
      }
      break;
    }
  }
});

// ─── Callback query handler ────────────────────────────────────────────────────
bot.on('callback_query', async (query) => {
  const chatId  = query.message.chat.id;
  const msgId   = query.message.message_id;
  const userId  = query.from.id;
  const data    = query.data;

  await bot.answerCallbackQuery(query.id).catch(() => {});

  if (query.message.chat.type !== 'private') return;

  const session = sessions[chatId] || {};

  // ── Select group ─────────────────────────────────────────────────────────────
  if (data.startsWith('sel_')) {
    const groupId = parseInt(data.slice(4));
    if (!groups[groupId]) return;
    if (!(await isAdmin(groupId, userId))) {
      await bot.answerCallbackQuery(query.id, { text: '❌ អ្នកមិនមែនជា Admin នៃ Group នេះទេ។', show_alert: true }).catch(() => {});
      return;
    }
    sessions[chatId] = { groupId };
    await showDashboard(chatId, msgId, groupId);
    return;
  }

  // ── Back to group list ────────────────────────────────────────────────────────
  if (data === 'back_groups') {
    delete sessions[chatId];
    delete waitingForInput[chatId];
    await showGroupList(chatId, msgId);
    return;
  }

  // ── Back to dashboard ─────────────────────────────────────────────────────────
  if (data === 'back_control') {
    delete waitingForInput[chatId];
    if (!session.groupId) { await showGroupList(chatId, msgId); return; }
    await showDashboard(chatId, msgId, session.groupId);
    return;
  }

  // ── TTS: gender & speed preference callbacks ──────────────────────────────
  if (data === 'voice:female' || data === 'voice:male') {
    const gender = data === 'voice:female' ? 'female' : 'male';
    const pref   = getTTSPref(userId);
    pref.gender  = gender;
    setTTSPref(userId, pref);
    try {
      await bot.editMessageReplyMarkup(buildVoiceKeyboard(pref.gender, pref.speed), {
        chat_id: chatId, message_id: msgId,
      });
    } catch {}
    return;
  }

  if (data.startsWith('set_speed:')) {
    const speed = data.split(':')[1];
    if (!SPEED_RATES[speed]) return;
    const pref  = getTTSPref(userId);
    pref.speed  = speed;
    setTTSPref(userId, pref);
    try {
      await bot.editMessageReplyMarkup(buildVoiceKeyboard(pref.gender, pref.speed), {
        chat_id: chatId, message_id: msgId,
      });
    } catch {}
    return;
  }

  // Guard: must have selected group
  if (!session.groupId) { await showGroupList(chatId, msgId); return; }
  const groupId = session.groupId;

  if (!(await isAdmin(groupId, userId))) {
    await bot.answerCallbackQuery(query.id, { text: '❌ Admin only', show_alert: true }).catch(() => {});
    return;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // OPEN / CLOSE
  // ─────────────────────────────────────────────────────────────────────────────

  if (data === 'menu_open') {
    await showDurationPicker(chatId, msgId);
    return;
  }

  if (data.startsWith('open_') && !data.includes('custom')) {
    const minutes = parseInt(data.split('_')[1]);
    try {
      await activateOpen(chatId, msgId, groupId, minutes);
    } catch (err) {
      console.error('Open error:', err.message);
      await bot.editMessageText('❌ មិនអាចបើក Group បានទេ។\nពិនិត្យ Admin + Restrict Members Permission។', {
        chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'back_control' }]] },
      });
    }
    return;
  }

  if (data === 'open_custom') {
    waitingForInput[chatId] = { type: 'custom_duration', groupId, menuMessageId: msgId };
    await bot.editMessageText(
      '⌨️ *កំណត់រយៈពេលផ្ទាល់ខ្លួន*\n\nសូមវាយចំនួន *នាទី* (1 – 1440)\n_ឧទាហរណ៍: 45 ឬ 90_',
      { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'menu_open' }]] } }
    );
    return;
  }

  if (data === 'action_close') {
    if (openTimers[groupId]) { clearTimeout(openTimers[groupId].timerId); delete openTimers[groupId]; }
    delete waitingForInput[chatId];
    try {
      await closeGroup(groupId);
      const s = getGroupSettings(groupId);
      if (s.autoNotify.closeEnabled) {
        try { await bot.sendMessage(groupId, s.autoNotify.closeText); } catch {}
      }
    } catch (err) {
      await bot.editMessageText('❌ មិនអាចបិទ Group បានទេ។\nពិនិត្យ Admin + Restrict Members Permission។', {
        chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'back_control' }]] },
      });
      return;
    }
    try { await showDashboard(chatId, msgId, groupId); } catch {}
    return;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STATS
  // ─────────────────────────────────────────────────────────────────────────────

  if (data === 'action_stats') {
    try {
      const count  = await bot.getChatMembersCount(groupId);
      const admins = await bot.getChatAdministrators(groupId);
      const s      = getGroupSettings(groupId);
      const g      = groups[groupId];
      const timer  = openTimers[groupId];

      await bot.editMessageText(
        `📊 *ស្ថិតិ — ${g.title}*\n\n` +
        `👥 សមាជិកសរុប: *${count}*\n` +
        `👮 Admin: *${admins.length}*\n` +
        `📍 ស្ថានភាព: ${timer ? '🟢 កំពុងបើក' : '🔴 បានបិទ'}\n` +
        `⏰ Schedule: បើក=${s.schedule.openTime || '—'} / បិទ=${s.schedule.closeTime || '—'}\n` +
        `🕐 ម៉ោងឥឡូវ: *${getCurrentTimeKH()}*`,
        {
          chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: '🔄 Refresh', callback_data: 'action_stats' }, { text: '« ត្រឡប់', callback_data: 'back_control' }]] },
        }
      );
    } catch (err) {
      await bot.editMessageText('❌ មិនអាចទាញស្ថិតិ Group បានទេ។', {
        chat_id: chatId, message_id: msgId,
        reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'back_control' }]] },
      });
    }
    return;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // BROADCAST
  // ─────────────────────────────────────────────────────────────────────────────

  if (data === 'action_broadcast') {
    waitingForInput[chatId] = { type: 'broadcast', groupId, menuMessageId: msgId };
    await bot.editMessageText(
      `📢 *Broadcast ទៅ ${groups[groupId]?.title}*\n\n` +
      `សូមផ្ញើ Text, Photo, Video ឬ Document\nដែលចង់ Broadcast ។\n\n` +
      `⚠️ _សារនឹងត្រូវបានផ្ញើទៅ Group ភ្លាមៗ_`,
      {
        chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '« បោះបង់', callback_data: 'back_control' }]] },
      }
    );
    return;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PIN / UNPIN
  // ─────────────────────────────────────────────────────────────────────────────

  if (data === 'menu_pin') {
    await bot.editMessageText(
      `📌 *Pin/Unpin — ${groups[groupId]?.title}*`,
      {
        chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📌 Pin (វាយ Message ID)', callback_data: 'pin_request' }],
            [{ text: '📍 Unpin សារចុងក្រោយ',  callback_data: 'pin_unpin'   }],
            [{ text: '« ត្រឡប់', callback_data: 'back_control' }],
          ],
        },
      }
    );
    return;
  }

  if (data === 'pin_request') {
    waitingForInput[chatId] = { type: 'pin_message', groupId, menuMessageId: msgId };
    await bot.editMessageText(
      '📌 *Pin សារ*\n\nសូមវាយ *Message ID* ដែលចង់ Pin\n\n' +
      '_ចូល Group → ចុចលើសារ → Copy Link → យកលេខចុងក្រោយ_',
      {
        chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'menu_pin' }]] },
      }
    );
    return;
  }

  if (data === 'pin_unpin') {
    try {
      await bot.unpinChatMessage(groupId);
      await bot.editMessageText('✅ *Unpin ជោគជ័យ!*', {
        chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'menu_pin' }]] },
      });
    } catch (err) {
      await bot.editMessageText(`❌ Unpin មិនជោគជ័យ: ${err.message}`, {
        chat_id: chatId, message_id: msgId,
        reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'menu_pin' }]] },
      });
    }
    return;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MEMBERS
  // ─────────────────────────────────────────────────────────────────────────────

  if (data === 'menu_members') {
    await bot.editMessageText(
      `🚫 *គ្រប់គ្រងសមាជិក — ${groups[groupId]?.title}*\n\nជ្រើសសកម្មភាព:`,
      { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: membersMenuKeyboard() }
    );
    return;
  }

  if (['member_kick','member_ban','member_mute','member_unmute'].includes(data)) {
    const labels = { member_kick: 'Kick', member_ban: 'Ban', member_mute: 'Mute', member_unmute: 'Unmute' };
    waitingForInput[chatId] = { type: 'member_action', groupId, menuMessageId: msgId, action: data };
    await bot.editMessageText(
      `👤 *${labels[data]} សមាជិក*\n\n` +
      `▪ *Forward* សារពី User ដែលចង់ ${labels[data]}\n` +
      `▪ ឬ វាយ *User ID* ផ្ទាល់\n\n_ឧទាហរណ៍: 123456789_`,
      {
        chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'menu_members' }]] },
      }
    );
    return;
  }

  if (['do_kick','do_ban','do_unmute','do_mute_60','do_mute_1440'].includes(data)) {
    const targetId = session.targetUserId;
    if (!targetId) { await showDashboard(chatId, msgId, groupId); return; }

    try {
      let resultText = '';
      if (data === 'do_kick') {
        await bot.banChatMember(groupId, targetId);
        await bot.unbanChatMember(groupId, targetId);
        resultText = '🚫 Kick ជោគជ័យ!';
      } else if (data === 'do_ban') {
        await bot.banChatMember(groupId, targetId);
        resultText = '⛔ Ban ជោគជ័យ!';
      } else if (data === 'do_unmute') {
        await bot.restrictChatMember(groupId, targetId, {
          can_send_messages:         true,
          can_send_polls:            true,
          can_send_other_messages:   true,
          can_add_web_page_previews: true,
        });
        resultText = '🔊 Unmute ជោគជ័យ!';
      } else {
        const muteMinutes = data === 'do_mute_60' ? 60 : 1440;
        const untilDate   = Math.floor((Date.now() + muteMinutes * 60 * 1000) / 1000);
        await bot.restrictChatMember(groupId, targetId, {
          can_send_messages:         false,
          can_send_polls:            false,
          can_send_other_messages:   false,
          can_add_web_page_previews: false,
          until_date: untilDate,
        });
        resultText = `🔇 Mute ${formatDuration(muteMinutes)} ជោគជ័យ!`;
      }

      delete sessions[chatId].targetUserId;
      delete sessions[chatId].targetUserName;
      await bot.editMessageText(`✅ *${resultText}*`, {
        chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'menu_members' }]] },
      });
    } catch (err) {
      await bot.editMessageText(`❌ សកម្មភាពមិនជោគជ័យ:\n_${err.message}_`, {
        chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'menu_members' }]] },
      });
    }
    return;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SCHEDULE
  // ─────────────────────────────────────────────────────────────────────────────

  if (data === 'menu_schedule') {
    const s = getGroupSettings(groupId);
    await bot.editMessageText(
      `⏰ *Schedule — ${groups[groupId]?.title}*\n\n` +
      `កំណត់ម៉ោងបើក/បិទ Group ដោយស្វ័យប្រវត្តិ (UTC+7)\n\n` +
      `🔓 បើក: *${s.schedule.openTime  || 'មិនបានកំណត់'}*\n` +
      `🔒 បិទ: *${s.schedule.closeTime || 'មិនបានកំណត់'}*`,
      {
        chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
        reply_markup: scheduleMenuKeyboard(groupId),
      }
    );
    return;
  }

  if (data === 'schedule_set_open') {
    waitingForInput[chatId] = { type: 'schedule_open', groupId, menuMessageId: msgId };
    await bot.editMessageText(
      '⏰ *ម៉ោងបើក Group*\n\nសូមវាយម៉ោង (Format: HH:MM)\n_ឧទាហរណ៍: 08:00 ឬ 13:30_',
      { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'menu_schedule' }]] } }
    );
    return;
  }

  if (data === 'schedule_set_close') {
    waitingForInput[chatId] = { type: 'schedule_close', groupId, menuMessageId: msgId };
    await bot.editMessageText(
      '⏰ *ម៉ោងបិទ Group*\n\nសូមវាយម៉ោង (Format: HH:MM)\n_ឧទាហរណ៍: 22:00 ឬ 18:00_',
      { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'menu_schedule' }]] } }
    );
    return;
  }

  if (data === 'schedule_clear') {
    const sc = getGroupSettings(groupId).schedule;
    sc.openTime = null; sc.closeTime = null;
    saveSettings(settings);
    await bot.editMessageText('🗑 *Schedule ត្រូវបានលុបហើយ!*', {
      chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'menu_schedule' }]] },
    });
    return;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SETTINGS
  // ─────────────────────────────────────────────────────────────────────────────

  if (data === 'menu_settings') {
    await bot.editMessageText(
      `⚙️ *Settings — ${groups[groupId]?.title}*`,
      { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: settingsMenuKeyboard(groupId) }
    );
    return;
  }

  if (data === 'settings_welcome_toggle') {
    const s = getGroupSettings(groupId);
    s.welcomeEnabled = !s.welcomeEnabled;
    saveSettings(settings);
    await bot.editMessageText(
      `⚙️ *Settings — ${groups[groupId]?.title}*`,
      { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: settingsMenuKeyboard(groupId) }
    );
    return;
  }

  if (data === 'settings_welcome_text') {
    const s = getGroupSettings(groupId);
    waitingForInput[chatId] = { type: 'welcome_text', groupId, menuMessageId: msgId };
    await bot.editMessageText(
      `👋 *Welcome Message*\n\nText បច្ចុប្បន្ន:\n_${s.welcomeText}_\n\n` +
      `ប្រើ \`{name}\` → ឈ្មោះ User\nប្រើ \`{group}\` → ឈ្មោះ Group\n\nផ្ញើ Welcome Text ថ្មី:`,
      {
        chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'menu_settings' }]] },
      }
    );
    return;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // AUTO NOTIFY
  // ─────────────────────────────────────────────────────────────────────────────

  if (data === 'menu_notify') {
    const s = getGroupSettings(groupId);
    await bot.editMessageText(
      `🔔 *Auto Notify — ${groups[groupId]?.title}*\n\n` +
      `Open Text: _${s.autoNotify.openText}_\n\n` +
      `Close Text: _${s.autoNotify.closeText}_`,
      { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: notifyMenuKeyboard(groupId) }
    );
    return;
  }

  if (data === 'notify_toggle_open') {
    const n = getGroupSettings(groupId).autoNotify;
    n.openEnabled = !n.openEnabled;
    saveSettings(settings);
    const s = getGroupSettings(groupId);
    await bot.editMessageText(
      `🔔 *Auto Notify — ${groups[groupId]?.title}*\n\nOpen Text: _${s.autoNotify.openText}_\n\nClose Text: _${s.autoNotify.closeText}_`,
      { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: notifyMenuKeyboard(groupId) }
    );
    return;
  }

  if (data === 'notify_toggle_close') {
    const n = getGroupSettings(groupId).autoNotify;
    n.closeEnabled = !n.closeEnabled;
    saveSettings(settings);
    const s = getGroupSettings(groupId);
    await bot.editMessageText(
      `🔔 *Auto Notify — ${groups[groupId]?.title}*\n\nOpen Text: _${s.autoNotify.openText}_\n\nClose Text: _${s.autoNotify.closeText}_`,
      { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: notifyMenuKeyboard(groupId) }
    );
    return;
  }

  if (data === 'notify_edit_open') {
    waitingForInput[chatId] = { type: 'notify_open_text', groupId, menuMessageId: msgId };
    await bot.editMessageText(
      '🔔 *Open Notify Text*\n\nផ្ញើ Text ដែលចង់ផ្ញើទៅ Group ពេលបើក:',
      { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'menu_notify' }]] } }
    );
    return;
  }

  if (data === 'notify_edit_close') {
    waitingForInput[chatId] = { type: 'notify_close_text', groupId, menuMessageId: msgId };
    await bot.editMessageText(
      '🔔 *Close Notify Text*\n\nផ្ញើ Text ដែលចង់ផ្ញើទៅ Group ពេលបិទ:',
      { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'menu_notify' }]] } }
    );
    return;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ANTI-SPAM
  // ─────────────────────────────────────────────────────────────────────────────

  if (data === 'menu_antispam') {
    await bot.editMessageText(
      `🤖 *Anti-Spam — ${groups[groupId]?.title}*`,
      { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: antiSpamMenuKeyboard(groupId) }
    );
    return;
  }

  if (data === 'antispam_toggle') {
    const a = getGroupSettings(groupId).antiSpam;
    a.enabled = !a.enabled;
    saveSettings(settings);
    await bot.editMessageText(
      `🤖 *Anti-Spam — ${groups[groupId]?.title}*`,
      { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: antiSpamMenuKeyboard(groupId) }
    );
    return;
  }

  if (data === 'antispam_toggle_links') {
    const a = getGroupSettings(groupId).antiSpam;
    a.noLinks = !a.noLinks;
    saveSettings(settings);
    await bot.editMessageText(
      `🤖 *Anti-Spam — ${groups[groupId]?.title}*`,
      { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: antiSpamMenuKeyboard(groupId) }
    );
    return;
  }

  if (data === 'antispam_toggle_forwards') {
    const a = getGroupSettings(groupId).antiSpam;
    a.noForwards = !a.noForwards;
    saveSettings(settings);
    await bot.editMessageText(
      `🤖 *Anti-Spam — ${groups[groupId]?.title}*`,
      { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: antiSpamMenuKeyboard(groupId) }
    );
    return;
  }

  if (data === 'antispam_cycle_limit') {
    const a = getGroupSettings(groupId).antiSpam;
    const presets = [
      { maxMessages: 3, windowSeconds: 5  },
      { maxMessages: 5, windowSeconds: 10 },
      { maxMessages: 10, windowSeconds: 10 },
      { maxMessages: 3, windowSeconds: 30 },
    ];
    const idx  = presets.findIndex(p => p.maxMessages === a.maxMessages && p.windowSeconds === a.windowSeconds);
    const next = presets[(idx + 1) % presets.length];
    a.maxMessages   = next.maxMessages;
    a.windowSeconds = next.windowSeconds;
    saveSettings(settings);
    await bot.editMessageText(
      `🤖 *Anti-Spam — ${groups[groupId]?.title}*`,
      { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: antiSpamMenuKeyboard(groupId) }
    );
    return;
  }
});

// ─── Polling error handler ─────────────────────────────────────────────────────
bot.on('polling_error', (err) => {
  console.error('Polling error:', err.message);
});

console.log('✅ Bot is running with full features!');
