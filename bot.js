const { TelegramBot } = require('node-telegram-bot-api');
const fs = require('fs');
const { spawn } = require('child_process');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN) {
  console.error('Error: BOT_TOKEN environment variable is not set. Exiting.');
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

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

// ─── TTS: Convert WEBM/Opus → OGG/Opus via ffmpeg (in-memory) ─────────────────
function webmToOgg(webmBuffer) {
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', [
      '-i', 'pipe:0',
      '-c:a', 'libopus',
      '-b:a', '48k',
      '-f', 'ogg',
      'pipe:1',
    ]);
    const chunks = [];
    ff.stdout.on('data', c => chunks.push(c));
    ff.stdout.on('end', () => resolve(Buffer.concat(chunks)));
    ff.stderr.on('data', () => {});
    ff.on('error', reject);
    ff.stdin.write(webmBuffer);
    ff.stdin.end();
  });
}

// ─── TTS: Microsoft Edge Neural TTS → OGG/Opus voice message ──────────────────
async function synthesizeTTS(text, voiceName, speed = 'x1') {
  const cleanText = stripUnspeakable(text);
  if (!cleanText) throw new Error('No speakable text');

  const rate = SPEED_RATES[speed] || '+0%';

  const tts = new MsEdgeTTS();
  await tts.setMetadata(voiceName, OUTPUT_FORMAT.WEBM_24KHZ_16BIT_MONO_OPUS);

  const { audioStream } = await tts.toStream(cleanText, { rate });

  const webmChunks = [];
  await new Promise((resolve, reject) => {
    audioStream.on('data', chunk => webmChunks.push(chunk));
    audioStream.on('end', resolve);
    audioStream.on('error', reject);
  });

  return webmToOgg(Buffer.concat(webmChunks));
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

// ─── TTS: In-memory file_id cache ─────────────────────────────────────────────
const ttsCache = new Map();

// ─── TTS: Voice keyboard ───────────────────────────────────────────────────────
function buildVoiceKeyboard(gender, speed) {
  return {
    inline_keyboard: [
      [
        { text: `${gender === 'female' ? '✅ ' : ''}👩 ស្រី`,  callback_data: 'voice:female' },
        { text: `${gender === 'male'   ? '✅ ' : ''}👨 ប្រុស`, callback_data: 'voice:male'   },
      ],
      Object.keys(SPEED_RATES).map(s => ({
        text: (s === speed ? '✅ ' : '') + SPEED_LABELS[s],
        callback_data: `set_speed:${s}`,
      })),
    ],
  };
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
  const voice  = getVoice(lang, gender);
  const cacheKey = `${voice}:${speed}:${text}`;
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

    const audioBuffer = await synthesizeTTS(text, voice, speed);
    const result = await bot.sendVoice(
      msg.chat.id,
      audioBuffer,
      {
        caption: '🔈 Text to Voice Bot',
        reply_to_message_id: msg.message_id,
        reply_markup: keyboard,
      },
      {
        filename: 'voice.ogg',
        contentType: 'audio/ogg',
      }
    );

    const fileId = result?.voice?.file_id;
    if (fileId) ttsCache.set(cacheKey, fileId);

  } catch (err) {
    console.error('TTS error:', err.message);
    await bot.sendMessage(msg.chat.id, '⚠️ មានបញ្ហាក្នុងការបង្កើតសំឡេង។ សូមព្យាយាមម្តងទៀត។', {
      reply_to_message_id: msg.message_id,
    }).catch(() => {});
  }
}

// ─── Message handler ──────────────────────────────────────────────────────────
bot.on('message', async (msg) => {
  if (!msg.text) return;

  if (msg.text === '/start') {
    await bot.sendMessage(msg.chat.id,
      '🔈 *Text to Voice Bot*\n\n' +
      'វាយ text ណាមួយ ហើយខ្ញុំនឹង reply ជា voice message!\n\n' +
      '🌍 *ភាសា auto-detect:*\n' +
      'ខ្មែរ • English • ไทย • 中文 • 日本語 • 한국어\n' +
      'العربية • हिन्दी • Русский • Français • និងច្រើនទៀត\n\n' +
      '⚙️ *ការកំណត់:*\n' +
      '👩 ស្រី / 👨 ប្រុស — ជ្រើស gender នៅក្រោម voice message\n' +
      '🐢▶️⚡🚀 — ជ្រើស speed',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  if (msg.text.startsWith('/')) return;

  await handleTTS(msg);
});

// ─── Callback query handler ───────────────────────────────────────────────────
bot.on('callback_query', async (query) => {
  const chatId  = query.message.chat.id;
  const msgId   = query.message.message_id;
  const userId  = query.from.id;
  const data    = query.data;

  await bot.answerCallbackQuery(query.id).catch(() => {});

  if (data === 'voice:female' || data === 'voice:male') {
    const gender = data === 'voice:female' ? 'female' : 'male';
    const pref   = getTTSPref(userId);
    pref.gender  = gender;
    setTTSPref(userId, pref);
    await bot.editMessageReplyMarkup(buildVoiceKeyboard(pref.gender, pref.speed), {
      chat_id: chatId, message_id: msgId,
    }).catch(() => {});
    return;
  }

  if (data.startsWith('set_speed:')) {
    const speed = data.split(':')[1];
    if (!SPEED_RATES[speed]) return;
    const pref = getTTSPref(userId);
    pref.speed = speed;
    setTTSPref(userId, pref);
    await bot.editMessageReplyMarkup(buildVoiceKeyboard(pref.gender, pref.speed), {
      chat_id: chatId, message_id: msgId,
    }).catch(() => {});
    return;
  }
});

// ─── Polling error handler ────────────────────────────────────────────────────
bot.on('polling_error', (err) => {
  console.error('Polling error:', err.message);
});

console.log('✅ TTS Bot is running!');
