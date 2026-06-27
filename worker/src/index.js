import MINI_APP_HTML from './miniapp.html';

const TG = 'https://api.telegram.org';

// ─── Telegram API ──────────────────────────────────────────────────────────────
async function tg(method, body, token) {
  const r = await fetch(`${TG}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await r.json();
  if (!json.ok) throw new Error(`TG ${method}: ${json.description}`);
  return json.result;
}

// ─── KV helpers ────────────────────────────────────────────────────────────────
const getGroups   = async (KV)           => (await KV.get('groups', 'json')) || {};
const saveGroups  = async (KV, d)        => KV.put('groups', JSON.stringify(d));
const getSession  = async (KV, pid)      => (await KV.get(`sess:${pid}`, 'json')) || {};
const setSession  = async (KV, pid, d)   => KV.put(`sess:${pid}`, JSON.stringify(d), { expirationTtl: 3600 });
const delSession  = async (KV, pid)      => KV.delete(`sess:${pid}`);
const getWaiting  = async (KV, pid)      => KV.get(`wait:${pid}`, 'json');
const setWaiting  = async (KV, pid, d)   => KV.put(`wait:${pid}`, JSON.stringify(d), { expirationTtl: 300 });
const delWaiting  = async (KV, pid)      => KV.delete(`wait:${pid}`);
const getTimer    = async (KV, gid)      => KV.get(`timer:${gid}`, 'json');
const setTimer    = async (KV, gid, d)   => KV.put(`timer:${gid}`, JSON.stringify(d));
const delTimer    = async (KV, gid)      => KV.delete(`timer:${gid}`);

async function getSettings(KV, gid) {
  let s = await KV.get(`settings:${gid}`, 'json');
  if (!s) {
    s = {
      welcomeEnabled: false,
      welcomeText: '👋 សូមស្វាគមន៍ {name} ចូលក្រុម *{group}*! 🎉',
      autoNotify: {
        openEnabled:  true,
        openText:  '🔓 Group ឥឡូវបើករួចហើយ! សូមស្វាគមន៍ 🎉',
        closeEnabled: true,
        closeText: '🔒 Group បានបិទហើយ! អរគុណសម្រាប់ការចូលរួម 🙏',
      },
      antiSpam: { enabled: false, maxMessages: 5, windowSeconds: 10, noLinks: false, noForwards: false },
      schedule:  { openTime: null, closeTime: null },
    };
    await KV.put(`settings:${gid}`, JSON.stringify(s));
  }
  return s;
}
const saveSettings = async (KV, gid, s) => KV.put(`settings:${gid}`, JSON.stringify(s));

// ─── Permissions ───────────────────────────────────────────────────────────────
const OPEN_PERMS  = { can_send_messages: true,  can_send_polls: true,  can_send_other_messages: true,  can_add_web_page_previews: true,  can_change_info: false, can_invite_users: true,  can_pin_messages: false };
const CLOSE_PERMS = { can_send_messages: false, can_send_polls: false, can_send_other_messages: false, can_add_web_page_previews: false, can_change_info: false, can_invite_users: false, can_pin_messages: false };

const openGroup  = (gid, token) => tg('setChatPermissions', { chat_id: gid, permissions: OPEN_PERMS  }, token);
const closeGroup = (gid, token) => tg('setChatPermissions', { chat_id: gid, permissions: CLOSE_PERMS }, token);

async function isAdmin(gid, uid, token) {
  try {
    const m = await tg('getChatMember', { chat_id: gid, user_id: uid }, token);
    return ['administrator', 'creator'].includes(m.status);
  } catch { return false; }
}

// ─── Formatting ────────────────────────────────────────────────────────────────
function formatDuration(m) {
  if (m < 60) return `${m} នាទី`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} ម៉ោង ${r} នាទី` : `${h} ម៉ោង`;
}
function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Phnom_Penh' });
}
function currentHHMM() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Phnom_Penh' }));
  return `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
}

// ─── Keyboards ─────────────────────────────────────────────────────────────────
function groupListKeyboard(groups) {
  return { inline_keyboard: Object.values(groups).map(g => [{ text: `👥 ${g.title}`, callback_data: `sel_${g.id}` }]) };
}

function mainMenuKeyboard(hasTimer) {
  const openBtn = hasTimer
    ? { text: '🔒 បិទ Group',  callback_data: 'action_close' }
    : { text: '🔓 បើក Group',  callback_data: 'menu_open'   };
  return { inline_keyboard: [
    [openBtn, { text: '📊 ស្ថិតិ', callback_data: 'action_stats' }],
    [{ text: '📢 Broadcast', callback_data: 'action_broadcast' }, { text: '📌 Pin/Unpin', callback_data: 'menu_pin' }],
    [{ text: '🚫 គ្រប់គ្រងសមាជិក', callback_data: 'menu_members' }],
    [{ text: '⏰ Schedule', callback_data: 'menu_schedule' }, { text: '⚙️ Settings', callback_data: 'menu_settings' }],
    [{ text: '« ជ្រើស Group ផ្សេង', callback_data: 'back_groups' }],
  ]};
}

const durationKeyboard = { inline_keyboard: [
  [{ text: '5 នាទី', callback_data: 'open_5' }, { text: '10 នាទី', callback_data: 'open_10' }, { text: '15 នាទី', callback_data: 'open_15' }],
  [{ text: '30 នាទី', callback_data: 'open_30' }, { text: '1 ម៉ោង', callback_data: 'open_60' }, { text: '2 ម៉ោង', callback_data: 'open_120' }],
  [{ text: '⌨️ កំណត់ផ្ទាល់ខ្លួន', callback_data: 'open_custom' }],
  [{ text: '« ត្រឡប់', callback_data: 'back_control' }],
]};

const membersKeyboard = { inline_keyboard: [
  [{ text: '🚫 Kick', callback_data: 'member_kick' }, { text: '⛔ Ban', callback_data: 'member_ban' }],
  [{ text: '🔇 Mute', callback_data: 'member_mute' }, { text: '🔊 Unmute', callback_data: 'member_unmute' }],
  [{ text: '« ត្រឡប់', callback_data: 'back_control' }],
]};

const pinKeyboard = { inline_keyboard: [
  [{ text: '📌 Pin (វាយ Message ID)', callback_data: 'pin_request' }],
  [{ text: '📍 Unpin សារចុងក្រោយ', callback_data: 'pin_unpin' }],
  [{ text: '« ត្រឡប់', callback_data: 'back_control' }],
]};

function scheduleKeyboard(s) {
  return { inline_keyboard: [
    [{ text: `🔓 ម៉ោងបើក: ${s.schedule.openTime  || '—'}`, callback_data: 'schedule_set_open'  }],
    [{ text: `🔒 ម៉ោងបិទ: ${s.schedule.closeTime || '—'}`, callback_data: 'schedule_set_close' }],
    [{ text: '🗑 លុប Schedule', callback_data: 'schedule_clear' }],
    [{ text: '« ត្រឡប់', callback_data: 'back_control' }],
  ]};
}

function settingsKeyboard(s) {
  const notifyOn = s.autoNotify.openEnabled || s.autoNotify.closeEnabled;
  return { inline_keyboard: [
    [{ text: `👋 Welcome: ${s.welcomeEnabled ? '✅ ON' : '❌ OFF'}`, callback_data: 'settings_welcome_toggle' }],
    [{ text: '✏️ កែ Welcome Text', callback_data: 'settings_welcome_text' }],
    [{ text: `🔔 Auto-Notify: ${notifyOn ? '✅ ON' : '❌ OFF'}`, callback_data: 'menu_notify' }],
    [{ text: `🤖 Anti-Spam: ${s.antiSpam.enabled ? '✅ ON' : '❌ OFF'}`, callback_data: 'menu_antispam' }],
    [{ text: '« ត្រឡប់', callback_data: 'back_control' }],
  ]};
}

function notifyKeyboard(s) {
  return { inline_keyboard: [
    [{ text: `🔓 ជូនដំណឹងពេលបើក: ${s.autoNotify.openEnabled  ? '✅' : '❌'}`, callback_data: 'notify_toggle_open'  }],
    [{ text: '✏️ កែ Open Text',  callback_data: 'notify_edit_open'  }],
    [{ text: `🔒 ជូនដំណឹងពេលបិទ: ${s.autoNotify.closeEnabled ? '✅' : '❌'}`, callback_data: 'notify_toggle_close' }],
    [{ text: '✏️ កែ Close Text', callback_data: 'notify_edit_close' }],
    [{ text: '« ត្រឡប់', callback_data: 'menu_settings' }],
  ]};
}

function antiSpamKeyboard(s) {
  const a = s.antiSpam;
  return { inline_keyboard: [
    [{ text: `🤖 Anti-Spam: ${a.enabled ? '✅ ON' : '❌ OFF'}`, callback_data: 'antispam_toggle' }],
    [{ text: `🔗 Block Links: ${a.noLinks ? '✅' : '❌'}`,      callback_data: 'antispam_toggle_links' }],
    [{ text: `↪️ Block Forwards: ${a.noForwards ? '✅' : '❌'}`, callback_data: 'antispam_toggle_forwards' }],
    [{ text: `📨 ដែនកំណត់: ${a.maxMessages} msg/${a.windowSeconds}s`, callback_data: 'antispam_cycle_limit' }],
    [{ text: '« ត្រឡប់', callback_data: 'menu_settings' }],
  ]};
}

function memberActionKeyboard(name, id) {
  return { inline_keyboard: [
    [{ text: '🚫 Kick', callback_data: 'do_kick' }, { text: '⛔ Ban', callback_data: 'do_ban' }],
    [{ text: '🔇 Mute 1ម៉ោង', callback_data: 'do_mute_60' }, { text: '🔇 Mute 24ម៉ោង', callback_data: 'do_mute_1440' }],
    [{ text: '🔊 Unmute', callback_data: 'do_unmute' }],
    [{ text: '« ត្រឡប់', callback_data: 'menu_members' }],
  ]};
}

// ─── Screen builders ───────────────────────────────────────────────────────────
async function showGroupList(pid, msgId, KV, token) {
  const groups = await getGroups(KV);
  const count  = Object.keys(groups).length;
  const text   = count
    ? '👥 *ជ្រើស Group ដែលចង់គ្រប់គ្រង:*'
    : '⚠️ Bot មិនទាន់ត្រូវបានបន្ថែមទៅ Group ណាមួយទេ។\n\nសូម Add bot ចូល Group ហើយ តែងតាំងជា Admin មុន។';
  const opts = { parse_mode: 'Markdown', ...(count ? { reply_markup: groupListKeyboard(groups) } : {}) };
  if (msgId) await tg('editMessageText', { chat_id: pid, message_id: msgId, text, ...opts }, token);
  else        await tg('sendMessage',     { chat_id: pid, text, ...opts }, token);
}

async function showDashboard(pid, msgId, gid, KV, token) {
  const groups = await getGroups(KV);
  const g      = groups[gid];
  const timer  = await getTimer(KV, gid);
  const s      = await getSettings(KV, gid);
  const status = timer ? `🟢 កំពុងបើក (បិទ ${formatTime(timer.closeAt)})` : '🔴 បានបិទ';
  const notifyOn = s.autoNotify.openEnabled || s.autoNotify.closeEnabled;
  const text = `🎛 *Dashboard — ${g.title}*\n\n` +
    `📍 ស្ថានភាព: ${status}\n` +
    `👋 Welcome: ${s.welcomeEnabled ? 'ON' : 'OFF'}   🤖 Anti-Spam: ${s.antiSpam.enabled ? 'ON' : 'OFF'}\n` +
    `🔔 Auto-Notify: ${notifyOn ? 'ON' : 'OFF'}   ⏰ Schedule: ${(s.schedule.openTime || s.schedule.closeTime) ? 'ON' : 'OFF'}`;
  await tg('editMessageText', { chat_id: pid, message_id: msgId, parse_mode: 'Markdown', text, reply_markup: mainMenuKeyboard(!!timer) }, token);
}

// ─── Open group with timer ─────────────────────────────────────────────────────
async function activateOpen(pid, msgId, gid, minutes, KV, token) {
  await delTimer(KV, gid);
  await openGroup(gid, token);

  const closeAt = Date.now() + minutes * 60000;
  const groups  = await getGroups(KV);
  const title   = groups[gid]?.title || String(gid);
  const s       = await getSettings(KV, gid);

  await setTimer(KV, gid, { closeAt, adminChatId: pid, menuMessageId: msgId, groupTitle: title });

  if (s.autoNotify.openEnabled) {
    try { await tg('sendMessage', { chat_id: gid, text: s.autoNotify.openText }, token); } catch {}
  }

  await tg('editMessageText', {
    chat_id: pid, message_id: msgId, parse_mode: 'Markdown',
    text: `✅ *Group បើករួចហើយ!*\n\n👥 Group: *${title}*\n⏱ រយៈពេល: *${formatDuration(minutes)}*\n🕐 នឹងបិទ នៅម៉ោង *${formatTime(closeAt)}*`,
    reply_markup: { inline_keyboard: [
      [{ text: '🔒 បិទភ្លាមៗ',       callback_data: 'action_close'  }],
      [{ text: '« ត្រឡប់ Dashboard', callback_data: 'back_control' }],
    ]},
  }, token);
}

// ─── Cron: auto-close expired + schedule ──────────────────────────────────────
async function runCron(KV, token) {
  const now   = Date.now();
  const hhmm  = currentHHMM();

  // Auto-close expired timers
  const timerList = await KV.list({ prefix: 'timer:' });
  for (const key of timerList.keys) {
    const timer = await KV.get(key.name, 'json');
    if (!timer || timer.closeAt > now) continue;
    const gid = key.name.slice(6);
    await delTimer(KV, gid);
    const s = await getSettings(KV, gid);
    try { await closeGroup(gid, token); } catch {}
    if (s.autoNotify.closeEnabled) {
      try { await tg('sendMessage', { chat_id: Number(gid), text: s.autoNotify.closeText }, token); } catch {}
    }
    if (timer.adminChatId) {
      try {
        await tg('sendMessage', {
          chat_id: timer.adminChatId, parse_mode: 'Markdown',
          text: `🔒 *${timer.groupTitle}* បានបិទដោយស្វ័យប្រវត្តិ!`,
        }, token);
      } catch {}
    }
  }

  // Schedule open/close
  const groups = await getGroups(KV);
  for (const gid of Object.keys(groups)) {
    const s = await getSettings(KV, gid);
    const lastRunKey = `sched_last:${gid}`;
    const lastRun = await KV.get(lastRunKey);

    if (s.schedule.openTime === hhmm && lastRun !== `open:${hhmm}`) {
      await KV.put(lastRunKey, `open:${hhmm}`, { expirationTtl: 120 });
      try {
        await openGroup(gid, token);
        if (s.autoNotify.openEnabled) await tg('sendMessage', { chat_id: Number(gid), text: s.autoNotify.openText }, token);
      } catch {}
    }

    if (s.schedule.closeTime === hhmm && lastRun !== `close:${hhmm}`) {
      await KV.put(lastRunKey, `close:${hhmm}`, { expirationTtl: 120 });
      try {
        await delTimer(KV, gid);
        await closeGroup(gid, token);
        if (s.autoNotify.closeEnabled) await tg('sendMessage', { chat_id: Number(gid), text: s.autoNotify.closeText }, token);
      } catch {}
    }
  }
}

// ─── Handle my_chat_member ────────────────────────────────────────────────────
async function handleMyChatMember(update, KV) {
  const chat   = update.chat;
  const status = update.new_chat_member.status;
  if (!['group', 'supergroup'].includes(chat.type)) return;
  const groups = await getGroups(KV);
  if (['member', 'administrator'].includes(status)) groups[chat.id] = { id: chat.id, title: chat.title };
  else if (['left', 'kicked'].includes(status))      delete groups[chat.id];
  await saveGroups(KV, groups);
}

// ─── Handle group messages (auto-register + welcome + anti-spam) ──────────────
async function handleGroupMessage(msg, KV, token) {
  const chat = msg.chat;
  if (!['group', 'supergroup'].includes(chat.type)) return;
  const gid = chat.id;

  // Auto-register
  const groups = await getGroups(KV);
  if (!groups[gid] || groups[gid].title !== chat.title) {
    groups[gid] = { id: gid, title: chat.title };
    await saveGroups(KV, groups);
  }

  const s = await getSettings(KV, String(gid));

  // Welcome new members
  if (msg.new_chat_members) {
    if (s.welcomeEnabled) {
      for (const member of msg.new_chat_members) {
        if (member.is_bot) continue;
        const name = member.first_name + (member.last_name ? ` ${member.last_name}` : '');
        const text = s.welcomeText
          .replace('{name}',  `[${name}](tg://user?id=${member.id})`)
          .replace('{group}', chat.title || '');
        try { await tg('sendMessage', { chat_id: gid, text, parse_mode: 'Markdown' }, token); } catch {}
      }
    }
    return;
  }

  // Anti-spam
  if (!s.antiSpam.enabled || !msg.from || msg.from.is_bot) return;
  const uid = msg.from.id;

  // Skip admins
  const adminCheck = await isAdmin(gid, uid, token);
  if (adminCheck) return;

  let shouldDelete = false;
  let reason = '';

  if (s.antiSpam.noLinks && msg.text && /(https?:\/\/|t\.me\/|@\w{5,})/i.test(msg.text)) {
    shouldDelete = true; reason = '🔗 Link';
  }
  if (!shouldDelete && s.antiSpam.noForwards && (msg.forward_date || msg.forward_from || msg.forward_from_chat)) {
    shouldDelete = true; reason = '↪️ Forward';
  }

  if (!shouldDelete) {
    const spamKey = `spam:${gid}:${uid}`;
    const raw  = await KV.get(spamKey, 'json') || [];
    const now  = Date.now();
    const win  = s.antiSpam.windowSeconds * 1000;
    const recent = raw.filter(t => now - t < win);
    recent.push(now);
    await KV.put(spamKey, JSON.stringify(recent), { expirationTtl: s.antiSpam.windowSeconds + 5 });
    if (recent.length > s.antiSpam.maxMessages) { shouldDelete = true; reason = '📨 Spam'; }
  }

  if (shouldDelete) {
    try {
      await tg('deleteMessage', { chat_id: gid, message_id: msg.message_id }, token);
      const warn = await tg('sendMessage', {
        chat_id: gid, parse_mode: 'Markdown',
        text: `⚠️ សារត្រូវបានលុប (${reason}) — [${msg.from.first_name}](tg://user?id=${uid})`,
      }, token);
      // Schedule warn deletion via KV flag (cron will clean up - or just leave it)
    } catch {}
  }
}

// ─── Handle /start ────────────────────────────────────────────────────────────
async function handleStart(msg, KV, token) {
  if (msg.chat.type !== 'private') return;
  await delSession(KV, msg.chat.id);
  await delWaiting(KV, msg.chat.id);
  await showGroupList(msg.chat.id, null, KV, token);
}

// ─── Handle private text input ────────────────────────────────────────────────
async function handleTextInput(msg, KV, token) {
  if (msg.chat.type !== 'private') return;
  if (!msg.text && !msg.photo && !msg.video && !msg.document && !msg.forward_from && !msg.forward_from_chat && !msg.forward_date) return;
  if (msg.text?.startsWith('/')) return;

  const pid   = msg.chat.id;
  const state = await getWaiting(KV, pid);
  if (!state) return;

  // Don't delete for broadcast
  if (state.type !== 'broadcast') {
    try { await tg('deleteMessage', { chat_id: pid, message_id: msg.message_id }, token); } catch {}
  }

  switch (state.type) {
    case 'custom_duration': {
      const minutes = parseInt(msg.text?.trim());
      if (isNaN(minutes) || minutes < 1 || minutes > 1440) {
        const w = await tg('sendMessage', { chat_id: pid, parse_mode: 'Markdown', text: '⚠️ សូមវាយចំនួនគត់ រវាង *1 – 1440* នាទី។' }, token);
        return;
      }
      await delWaiting(KV, pid);
      try {
        await activateOpen(pid, state.menuMessageId, state.groupId, minutes, KV, token);
      } catch (err) {
        await tg('editMessageText', {
          chat_id: pid, message_id: state.menuMessageId, parse_mode: 'Markdown',
          text: '❌ មិនអាចបើក Group បានទេ។ ពិនិត្យ Admin + Restrict Members Permission។',
          reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'back_control' }]] },
        }, token);
      }
      break;
    }

    case 'broadcast': {
      await delWaiting(KV, pid);
      try {
        await tg('copyMessage', { chat_id: state.groupId, from_chat_id: pid, message_id: msg.message_id }, token);
        try { await tg('deleteMessage', { chat_id: pid, message_id: msg.message_id }, token); } catch {}
        const groups = await getGroups(KV);
        await tg('editMessageText', {
          chat_id: pid, message_id: state.menuMessageId, parse_mode: 'Markdown',
          text: `✅ *Broadcast ផ្ញើជោគជ័យ!*\n\nសារត្រូវបានផ្ញើទៅ *${groups[state.groupId]?.title}*`,
          reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់ Dashboard', callback_data: 'back_control' }]] },
        }, token);
      } catch (err) {
        await tg('editMessageText', {
          chat_id: pid, message_id: state.menuMessageId,
          text: `❌ Broadcast មិនជោគជ័យ: ${err.message}`,
          reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'back_control' }]] },
        }, token);
      }
      break;
    }

    case 'welcome_text': {
      const text = msg.text?.trim();
      if (!text) return;
      await delWaiting(KV, pid);
      const s = await getSettings(KV, state.groupId);
      s.welcomeText = text;
      await saveSettings(KV, state.groupId, s);
      await tg('editMessageText', {
        chat_id: pid, message_id: state.menuMessageId, parse_mode: 'Markdown',
        text: `✅ *Welcome Text បានរក្សាទុក!*\n\n_${text}_`,
        reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'menu_settings' }]] },
      }, token);
      break;
    }

    case 'notify_open_text': {
      const text = msg.text?.trim();
      if (!text) return;
      await delWaiting(KV, pid);
      const s = await getSettings(KV, state.groupId);
      s.autoNotify.openText = text;
      await saveSettings(KV, state.groupId, s);
      await tg('editMessageText', {
        chat_id: pid, message_id: state.menuMessageId, parse_mode: 'Markdown',
        text: '✅ *Open Notify Text បានរក្សាទុក!*',
        reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'menu_notify' }]] },
      }, token);
      break;
    }

    case 'notify_close_text': {
      const text = msg.text?.trim();
      if (!text) return;
      await delWaiting(KV, pid);
      const s = await getSettings(KV, state.groupId);
      s.autoNotify.closeText = text;
      await saveSettings(KV, state.groupId, s);
      await tg('editMessageText', {
        chat_id: pid, message_id: state.menuMessageId, parse_mode: 'Markdown',
        text: '✅ *Close Notify Text បានរក្សាទុក!*',
        reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'menu_notify' }]] },
      }, token);
      break;
    }

    case 'schedule_open':
    case 'schedule_close': {
      const time = msg.text?.trim();
      if (!/^\d{1,2}:\d{2}$/.test(time)) {
        await tg('sendMessage', { chat_id: pid, text: '⚠️ Format: HH:MM (ឧ. 08:00)' }, token);
        return;
      }
      const [h, m] = time.split(':').map(Number);
      if (h > 23 || m > 59) { await tg('sendMessage', { chat_id: pid, text: '⚠️ ម៉ោងមិនត្រឹមត្រូវ' }, token); return; }
      const formatted = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
      await delWaiting(KV, pid);
      const s = await getSettings(KV, state.groupId);
      if (state.type === 'schedule_open') s.schedule.openTime  = formatted;
      else                                 s.schedule.closeTime = formatted;
      await saveSettings(KV, state.groupId, s);
      await tg('editMessageText', {
        chat_id: pid, message_id: state.menuMessageId, parse_mode: 'Markdown',
        text: `✅ *Schedule ${state.type === 'schedule_open' ? 'បើក' : 'បិទ'}: ${formatted}*`,
        reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'menu_schedule' }]] },
      }, token);
      break;
    }

    case 'member_action': {
      let targetId = null, targetName = 'Unknown';
      if (msg.forward_from) { targetId = msg.forward_from.id; targetName = msg.forward_from.first_name || 'Unknown'; }
      else if (msg.text) { const p = parseInt(msg.text.trim()); if (!isNaN(p)) { targetId = p; } }
      if (!targetId) {
        await tg('sendMessage', { chat_id: pid, text: '⚠️ Forward សារពី User ឬ វាយ User ID' }, token);
        return;
      }
      await delWaiting(KV, pid);
      const sess = await getSession(KV, pid);
      sess.targetUserId   = targetId;
      sess.targetUserName = targetName;
      await setSession(KV, pid, sess);
      await tg('editMessageText', {
        chat_id: pid, message_id: state.menuMessageId, parse_mode: 'Markdown',
        text: `👤 *User: ${targetName}*\nID: \`${targetId}\`\n\nជ្រើសសកម្មភាព:`,
        reply_markup: memberActionKeyboard(targetName, targetId),
      }, token);
      break;
    }

    case 'pin_message': {
      const msgIdNum = parseInt(msg.text?.trim());
      if (isNaN(msgIdNum)) {
        await tg('sendMessage', { chat_id: pid, text: '⚠️ សូមវាយ Message ID (លេខ)' }, token);
        return;
      }
      await delWaiting(KV, pid);
      try {
        await tg('pinChatMessage', { chat_id: state.groupId, message_id: msgIdNum }, token);
        await tg('editMessageText', {
          chat_id: pid, message_id: state.menuMessageId, parse_mode: 'Markdown',
          text: '📌 *Pin ជោគជ័យ!*',
          reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'menu_pin' }]] },
        }, token);
      } catch (err) {
        await tg('editMessageText', {
          chat_id: pid, message_id: state.menuMessageId,
          text: `❌ Pin មិនជោគជ័យ: ${err.message}`,
          reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'menu_pin' }]] },
        }, token);
      }
      break;
    }
  }
}

// ─── Handle callback_query ─────────────────────────────────────────────────────
async function handleCallback(query, KV, token) {
  const pid   = query.message.chat.id;
  const msgId = query.message.message_id;
  const uid   = query.from.id;
  const data  = query.data;

  await tg('answerCallbackQuery', { callback_query_id: query.id }, token).catch(() => {});
  if (query.message.chat.type !== 'private') return;

  const sess = await getSession(KV, pid);

  // ── Select group ─────────────────────────────────────────────────────────────
  if (data.startsWith('sel_')) {
    const gid    = parseInt(data.slice(4));
    const groups = await getGroups(KV);
    if (!groups[gid]) return;
    if (!(await isAdmin(gid, uid, token))) {
      await tg('answerCallbackQuery', { callback_query_id: query.id, text: '❌ Admin only', show_alert: true }, token).catch(() => {});
      return;
    }
    await setSession(KV, pid, { groupId: gid });
    await showDashboard(pid, msgId, gid, KV, token);
    return;
  }

  // ── Navigation ───────────────────────────────────────────────────────────────
  if (data === 'back_groups') {
    await delSession(KV, pid); await delWaiting(KV, pid);
    await showGroupList(pid, msgId, KV, token);
    return;
  }
  if (data === 'back_control') {
    await delWaiting(KV, pid);
    if (!sess.groupId) { await showGroupList(pid, msgId, KV, token); return; }
    await showDashboard(pid, msgId, sess.groupId, KV, token);
    return;
  }

  if (!sess.groupId) { await showGroupList(pid, msgId, KV, token); return; }
  const gid = sess.groupId;

  if (!(await isAdmin(gid, uid, token))) {
    await tg('answerCallbackQuery', { callback_query_id: query.id, text: '❌ Admin only', show_alert: true }, token).catch(() => {});
    return;
  }

  // ── OPEN / CLOSE ──────────────────────────────────────────────────────────────
  if (data === 'menu_open') {
    await tg('editMessageText', { chat_id: pid, message_id: msgId, parse_mode: 'Markdown',
      text: '⏱ *ជ្រើសរើសរយៈពេលបើក Group*', reply_markup: durationKeyboard }, token);
    return;
  }
  if (data.startsWith('open_') && !data.includes('custom')) {
    const minutes = parseInt(data.split('_')[1]);
    try { await activateOpen(pid, msgId, gid, minutes, KV, token); }
    catch (err) {
      await tg('editMessageText', { chat_id: pid, message_id: msgId, parse_mode: 'Markdown',
        text: '❌ មិនអាចបើក Group បានទេ។ ពិនិត្យ Admin + Restrict Members Permission។',
        reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'back_control' }]] } }, token);
    }
    return;
  }
  if (data === 'open_custom') {
    await setWaiting(KV, pid, { type: 'custom_duration', groupId: gid, menuMessageId: msgId });
    await tg('editMessageText', { chat_id: pid, message_id: msgId, parse_mode: 'Markdown',
      text: '⌨️ *កំណត់រយៈពេលផ្ទាល់ខ្លួន*\n\nសូមវាយចំនួន *នាទី* (1 – 1440)',
      reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'menu_open' }]] } }, token);
    return;
  }
  if (data === 'action_close') {
    await delWaiting(KV, pid);
    await delTimer(KV, gid);
    const s = await getSettings(KV, String(gid));
    try {
      await closeGroup(gid, token);
      if (s.autoNotify.closeEnabled) await tg('sendMessage', { chat_id: gid, text: s.autoNotify.closeText }, token).catch(() => {});
    } catch (err) {
      await tg('editMessageText', { chat_id: pid, message_id: msgId, parse_mode: 'Markdown',
        text: '❌ មិនអាចបិទ Group បានទេ។',
        reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'back_control' }]] } }, token);
      return;
    }
    await showDashboard(pid, msgId, gid, KV, token).catch(() => {});
    return;
  }

  // ── STATS ─────────────────────────────────────────────────────────────────────
  if (data === 'action_stats') {
    try {
      const [cnt, admins, timer, s] = await Promise.all([
        tg('getChatMembersCount', { chat_id: gid }, token),
        tg('getChatAdministrators', { chat_id: gid }, token),
        getTimer(KV, gid),
        getSettings(KV, String(gid)),
      ]);
      const groups = await getGroups(KV);
      await tg('editMessageText', {
        chat_id: pid, message_id: msgId, parse_mode: 'Markdown',
        text: `📊 *ស្ថិតិ — ${groups[gid]?.title}*\n\n👥 សមាជិក: *${cnt}*\n👮 Admin: *${admins.length}*\n📍 ស្ថានភាព: ${timer ? '🟢 កំពុងបើក' : '🔴 បានបិទ'}\n⏰ Schedule: បើក=${s.schedule.openTime||'—'} / បិទ=${s.schedule.closeTime||'—'}`,
        reply_markup: { inline_keyboard: [[{ text: '🔄 Refresh', callback_data: 'action_stats' }, { text: '« ត្រឡប់', callback_data: 'back_control' }]] },
      }, token);
    } catch {
      await tg('editMessageText', { chat_id: pid, message_id: msgId,
        text: '❌ មិនអាចទាញស្ថិតិបានទេ។',
        reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'back_control' }]] } }, token);
    }
    return;
  }

  // ── BROADCAST ─────────────────────────────────────────────────────────────────
  if (data === 'action_broadcast') {
    const groups = await getGroups(KV);
    await setWaiting(KV, pid, { type: 'broadcast', groupId: gid, menuMessageId: msgId });
    await tg('editMessageText', { chat_id: pid, message_id: msgId, parse_mode: 'Markdown',
      text: `📢 *Broadcast ទៅ ${groups[gid]?.title}*\n\nផ្ញើ Text, Photo, Video ឬ Document ។\n\n⚠️ _សារនឹងផ្ញើភ្លាមៗ_`,
      reply_markup: { inline_keyboard: [[{ text: '« បោះបង់', callback_data: 'back_control' }]] } }, token);
    return;
  }

  // ── PIN / UNPIN ───────────────────────────────────────────────────────────────
  if (data === 'menu_pin') {
    const groups = await getGroups(KV);
    await tg('editMessageText', { chat_id: pid, message_id: msgId, parse_mode: 'Markdown',
      text: `📌 *Pin/Unpin — ${groups[gid]?.title}*`, reply_markup: pinKeyboard }, token);
    return;
  }
  if (data === 'pin_request') {
    await setWaiting(KV, pid, { type: 'pin_message', groupId: gid, menuMessageId: msgId });
    await tg('editMessageText', { chat_id: pid, message_id: msgId, parse_mode: 'Markdown',
      text: '📌 *Pin សារ*\n\nវាយ *Message ID*\n_(ចូល Group → Copy Link → លេខចុងក្រោយ)_',
      reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'menu_pin' }]] } }, token);
    return;
  }
  if (data === 'pin_unpin') {
    try {
      await tg('unpinChatMessage', { chat_id: gid }, token);
      await tg('editMessageText', { chat_id: pid, message_id: msgId, parse_mode: 'Markdown',
        text: '✅ *Unpin ជោគជ័យ!*',
        reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'menu_pin' }]] } }, token);
    } catch (err) {
      await tg('editMessageText', { chat_id: pid, message_id: msgId,
        text: `❌ Unpin មិនជោគជ័យ: ${err.message}`,
        reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'menu_pin' }]] } }, token);
    }
    return;
  }

  // ── MEMBERS ───────────────────────────────────────────────────────────────────
  if (data === 'menu_members') {
    const groups = await getGroups(KV);
    await tg('editMessageText', { chat_id: pid, message_id: msgId, parse_mode: 'Markdown',
      text: `🚫 *គ្រប់គ្រងសមាជិក — ${groups[gid]?.title}*`, reply_markup: membersKeyboard }, token);
    return;
  }
  if (['member_kick','member_ban','member_mute','member_unmute'].includes(data)) {
    const labels = { member_kick: 'Kick', member_ban: 'Ban', member_mute: 'Mute', member_unmute: 'Unmute' };
    await setWaiting(KV, pid, { type: 'member_action', groupId: gid, menuMessageId: msgId, action: data });
    await tg('editMessageText', { chat_id: pid, message_id: msgId, parse_mode: 'Markdown',
      text: `👤 *${labels[data]} សមាជិក*\n\nForward សារពី User ឬ វាយ *User ID*`,
      reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'menu_members' }]] } }, token);
    return;
  }
  if (['do_kick','do_ban','do_unmute','do_mute_60','do_mute_1440'].includes(data)) {
    const targetId = sess.targetUserId;
    if (!targetId) { await showDashboard(pid, msgId, gid, KV, token); return; }
    try {
      let resultText = '';
      if (data === 'do_kick') {
        await tg('banChatMember',   { chat_id: gid, user_id: targetId }, token);
        await tg('unbanChatMember', { chat_id: gid, user_id: targetId, only_if_banned: true }, token);
        resultText = '🚫 Kick ជោគជ័យ!';
      } else if (data === 'do_ban') {
        await tg('banChatMember', { chat_id: gid, user_id: targetId }, token);
        resultText = '⛔ Ban ជោគជ័យ!';
      } else if (data === 'do_unmute') {
        await tg('restrictChatMember', { chat_id: gid, user_id: targetId, permissions: OPEN_PERMS }, token);
        resultText = '🔊 Unmute ជោគជ័យ!';
      } else {
        const mins = data === 'do_mute_60' ? 60 : 1440;
        const untilDate = Math.floor((Date.now() + mins * 60000) / 1000);
        await tg('restrictChatMember', { chat_id: gid, user_id: targetId, permissions: { can_send_messages: false, can_send_polls: false, can_send_other_messages: false, can_add_web_page_previews: false }, until_date: untilDate }, token);
        resultText = `🔇 Mute ${formatDuration(mins)} ជោគជ័យ!`;
      }
      sess.targetUserId = null; sess.targetUserName = null;
      await setSession(KV, pid, sess);
      await tg('editMessageText', { chat_id: pid, message_id: msgId, parse_mode: 'Markdown',
        text: `✅ *${resultText}*`,
        reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'menu_members' }]] } }, token);
    } catch (err) {
      await tg('editMessageText', { chat_id: pid, message_id: msgId, parse_mode: 'Markdown',
        text: `❌ _${err.message}_`,
        reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'menu_members' }]] } }, token);
    }
    return;
  }

  // ── SCHEDULE ──────────────────────────────────────────────────────────────────
  if (data === 'menu_schedule') {
    const [groups, s] = await Promise.all([getGroups(KV), getSettings(KV, String(gid))]);
    await tg('editMessageText', { chat_id: pid, message_id: msgId, parse_mode: 'Markdown',
      text: `⏰ *Schedule — ${groups[gid]?.title}*\n\n🔓 បើក: *${s.schedule.openTime||'—'}*\n🔒 បិទ: *${s.schedule.closeTime||'—'}*\n_(UTC+7 / Phnom Penh)_`,
      reply_markup: scheduleKeyboard(s) }, token);
    return;
  }
  if (data === 'schedule_set_open') {
    await setWaiting(KV, pid, { type: 'schedule_open', groupId: String(gid), menuMessageId: msgId });
    await tg('editMessageText', { chat_id: pid, message_id: msgId, parse_mode: 'Markdown',
      text: '⏰ *ម៉ោងបើក Group*\n\nVayet ម៉ោង (HH:MM)\n_ឧទាហរណ៍: 08:00_',
      reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'menu_schedule' }]] } }, token);
    return;
  }
  if (data === 'schedule_set_close') {
    await setWaiting(KV, pid, { type: 'schedule_close', groupId: String(gid), menuMessageId: msgId });
    await tg('editMessageText', { chat_id: pid, message_id: msgId, parse_mode: 'Markdown',
      text: '⏰ *ម៉ោងបិទ Group*\n\nVayet ម៉ោង (HH:MM)\n_ឧទាហរណ៍: 22:00_',
      reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'menu_schedule' }]] } }, token);
    return;
  }
  if (data === 'schedule_clear') {
    const s = await getSettings(KV, String(gid));
    s.schedule.openTime = null; s.schedule.closeTime = null;
    await saveSettings(KV, String(gid), s);
    await tg('editMessageText', { chat_id: pid, message_id: msgId, parse_mode: 'Markdown',
      text: '🗑 *Schedule ត្រូវបានលុបហើយ!*',
      reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'menu_schedule' }]] } }, token);
    return;
  }

  // ── SETTINGS ──────────────────────────────────────────────────────────────────
  if (data === 'menu_settings') {
    const [groups, s] = await Promise.all([getGroups(KV), getSettings(KV, String(gid))]);
    await tg('editMessageText', { chat_id: pid, message_id: msgId, parse_mode: 'Markdown',
      text: `⚙️ *Settings — ${groups[gid]?.title}*`, reply_markup: settingsKeyboard(s) }, token);
    return;
  }
  if (data === 'settings_welcome_toggle') {
    const [groups, s] = await Promise.all([getGroups(KV), getSettings(KV, String(gid))]);
    s.welcomeEnabled = !s.welcomeEnabled;
    await saveSettings(KV, String(gid), s);
    await tg('editMessageText', { chat_id: pid, message_id: msgId, parse_mode: 'Markdown',
      text: `⚙️ *Settings — ${groups[gid]?.title}*`, reply_markup: settingsKeyboard(s) }, token);
    return;
  }
  if (data === 'settings_welcome_text') {
    const s = await getSettings(KV, String(gid));
    await setWaiting(KV, pid, { type: 'welcome_text', groupId: String(gid), menuMessageId: msgId });
    await tg('editMessageText', { chat_id: pid, message_id: msgId, parse_mode: 'Markdown',
      text: `👋 *Welcome Message*\n\nText បច្ចុប្បន្ន:\n_${s.welcomeText}_\n\n\`{name}\` = ឈ្មោះ User\n\`{group}\` = ឈ្មោះ Group\n\nផ្ញើ Text ថ្មី:`,
      reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'menu_settings' }]] } }, token);
    return;
  }
  if (data === 'menu_notify') {
    const [groups, s] = await Promise.all([getGroups(KV), getSettings(KV, String(gid))]);
    await tg('editMessageText', { chat_id: pid, message_id: msgId, parse_mode: 'Markdown',
      text: `🔔 *Auto Notify — ${groups[gid]?.title}*\n\nOpen: _${s.autoNotify.openText}_\n\nClose: _${s.autoNotify.closeText}_`,
      reply_markup: notifyKeyboard(s) }, token);
    return;
  }
  if (data === 'notify_toggle_open') {
    const [groups, s] = await Promise.all([getGroups(KV), getSettings(KV, String(gid))]);
    s.autoNotify.openEnabled = !s.autoNotify.openEnabled;
    await saveSettings(KV, String(gid), s);
    await tg('editMessageText', { chat_id: pid, message_id: msgId, parse_mode: 'Markdown',
      text: `🔔 *Auto Notify — ${groups[gid]?.title}*\n\nOpen: _${s.autoNotify.openText}_\n\nClose: _${s.autoNotify.closeText}_`,
      reply_markup: notifyKeyboard(s) }, token);
    return;
  }
  if (data === 'notify_toggle_close') {
    const [groups, s] = await Promise.all([getGroups(KV), getSettings(KV, String(gid))]);
    s.autoNotify.closeEnabled = !s.autoNotify.closeEnabled;
    await saveSettings(KV, String(gid), s);
    await tg('editMessageText', { chat_id: pid, message_id: msgId, parse_mode: 'Markdown',
      text: `🔔 *Auto Notify — ${groups[gid]?.title}*\n\nOpen: _${s.autoNotify.openText}_\n\nClose: _${s.autoNotify.closeText}_`,
      reply_markup: notifyKeyboard(s) }, token);
    return;
  }
  if (data === 'notify_edit_open') {
    await setWaiting(KV, pid, { type: 'notify_open_text', groupId: String(gid), menuMessageId: msgId });
    await tg('editMessageText', { chat_id: pid, message_id: msgId, parse_mode: 'Markdown',
      text: '🔔 *Open Notify Text*\n\nផ្ញើ Text ដែលចង់ផ្ញើទៅ Group ពេលបើក:',
      reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'menu_notify' }]] } }, token);
    return;
  }
  if (data === 'notify_edit_close') {
    await setWaiting(KV, pid, { type: 'notify_close_text', groupId: String(gid), menuMessageId: msgId });
    await tg('editMessageText', { chat_id: pid, message_id: msgId, parse_mode: 'Markdown',
      text: '🔔 *Close Notify Text*\n\nផ្ញើ Text ដែលចង់ផ្ញើទៅ Group ពេលបិទ:',
      reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'menu_notify' }]] } }, token);
    return;
  }
  if (data === 'menu_antispam') {
    const [groups, s] = await Promise.all([getGroups(KV), getSettings(KV, String(gid))]);
    await tg('editMessageText', { chat_id: pid, message_id: msgId, parse_mode: 'Markdown',
      text: `🤖 *Anti-Spam — ${groups[gid]?.title}*`, reply_markup: antiSpamKeyboard(s) }, token);
    return;
  }
  if (['antispam_toggle','antispam_toggle_links','antispam_toggle_forwards','antispam_cycle_limit'].includes(data)) {
    const [groups, s] = await Promise.all([getGroups(KV), getSettings(KV, String(gid))]);
    if (data === 'antispam_toggle')           s.antiSpam.enabled    = !s.antiSpam.enabled;
    if (data === 'antispam_toggle_links')     s.antiSpam.noLinks    = !s.antiSpam.noLinks;
    if (data === 'antispam_toggle_forwards')  s.antiSpam.noForwards = !s.antiSpam.noForwards;
    if (data === 'antispam_cycle_limit') {
      const presets = [{maxMessages:3,windowSeconds:5},{maxMessages:5,windowSeconds:10},{maxMessages:10,windowSeconds:10},{maxMessages:3,windowSeconds:30}];
      const idx  = presets.findIndex(p => p.maxMessages === s.antiSpam.maxMessages && p.windowSeconds === s.antiSpam.windowSeconds);
      const next = presets[(idx + 1) % presets.length];
      s.antiSpam.maxMessages = next.maxMessages; s.antiSpam.windowSeconds = next.windowSeconds;
    }
    await saveSettings(KV, String(gid), s);
    await tg('editMessageText', { chat_id: pid, message_id: msgId, parse_mode: 'Markdown',
      text: `🤖 *Anti-Spam — ${groups[gid]?.title}*`, reply_markup: antiSpamKeyboard(s) }, token);
    return;
  }
}

// ─── JSON response helper ──────────────────────────────────────────────────────
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
});

// ─── initData validation ───────────────────────────────────────────────────────
async function validateInitData(initData, botToken) {
  try {
    const params = new URLSearchParams(initData);
    const hash   = params.get('hash');
    if (!hash) return false;
    params.delete('hash');
    const dataCheckStr = [...params.entries()].sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${k}=${v}`).join('\n');
    const enc  = new TextEncoder();
    const sk   = await crypto.subtle.importKey('raw', enc.encode('WebAppData'), { name:'HMAC', hash:'SHA-256' }, false, ['sign']);
    const skB  = await crypto.subtle.sign('HMAC', sk, enc.encode(botToken));
    const hk   = await crypto.subtle.importKey('raw', skB, { name:'HMAC', hash:'SHA-256' }, false, ['sign']);
    const sig  = await crypto.subtle.sign('HMAC', hk, enc.encode(dataCheckStr));
    const comp = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2,'0')).join('');
    return comp === hash;
  } catch { return false; }
}
function getUserFromInitData(initData) {
  try { return JSON.parse(new URLSearchParams(initData).get('user') || 'null'); } catch { return null; }
}

// ─── Mini App API ──────────────────────────────────────────────────────────────
async function apiGroups(request, env) {
  const initData = request.headers.get('X-Init-Data') || '';
  if (!(await validateInitData(initData, env.BOT_TOKEN))) return json({ ok: false, error: 'Unauthorized' }, 401);
  const user   = getUserFromInitData(initData);
  const groups = await getGroups(env.KV);
  const timers = {};
  for (const gid of Object.keys(groups)) {
    const t = await getTimer(env.KV, gid);
    if (t) timers[gid] = t;
  }
  const filtered = {};
  await Promise.all(Object.values(groups).map(async g => {
    if (!user || await isAdmin(g.id, user.id, env.BOT_TOKEN)) filtered[g.id] = g;
  }));
  return json({ ok: true, groups: filtered, timers });
}

async function apiOpen(request, env) {
  const body = await request.json();
  if (!(await validateInitData(body.initData || '', env.BOT_TOKEN))) return json({ ok: false, error: 'Unauthorized' }, 401);
  const user = getUserFromInitData(body.initData || '');
  const { groupId, minutes } = body;
  if (!groupId || !minutes || minutes < 1 || minutes > 1440) return json({ ok: false, error: 'Invalid params' }, 400);
  if (user && !(await isAdmin(groupId, user.id, env.BOT_TOKEN))) return json({ ok: false, error: 'Not an admin' }, 403);
  await delTimer(env.KV, groupId);
  await openGroup(groupId, env.BOT_TOKEN);
  const groups   = await getGroups(env.KV);
  const s        = await getSettings(env.KV, String(groupId));
  const closeAt  = Date.now() + minutes * 60000;
  await setTimer(env.KV, groupId, { closeAt, adminChatId: user?.id, menuMessageId: null, groupTitle: groups[groupId]?.title || String(groupId) });
  if (s.autoNotify.openEnabled) await tg('sendMessage', { chat_id: groupId, text: s.autoNotify.openText }, env.BOT_TOKEN).catch(() => {});
  return json({ ok: true, closeAt });
}

async function apiClose(request, env) {
  const body = await request.json();
  if (!(await validateInitData(body.initData || '', env.BOT_TOKEN))) return json({ ok: false, error: 'Unauthorized' }, 401);
  const user = getUserFromInitData(body.initData || '');
  const { groupId } = body;
  if (!groupId) return json({ ok: false, error: 'Missing groupId' }, 400);
  if (user && !(await isAdmin(groupId, user.id, env.BOT_TOKEN))) return json({ ok: false, error: 'Not an admin' }, 403);
  const s = await getSettings(env.KV, String(groupId));
  await delTimer(env.KV, groupId);
  await closeGroup(groupId, env.BOT_TOKEN);
  if (s.autoNotify.closeEnabled) await tg('sendMessage', { chat_id: groupId, text: s.autoNotify.closeText }, env.BOT_TOKEN).catch(() => {});
  return json({ ok: true });
}

// ─── Main export ───────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url    = new URL(request.url);
    const method = request.method;

    if (method === 'OPTIONS')
      return new Response(null, { headers: { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'*', 'Access-Control-Allow-Methods':'GET,POST' } });

    // Mini App
    if (method === 'GET' && url.pathname === '/')
      return new Response(MINI_APP_HTML, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });

    // Debug: check token presence (never leaks value)
    if (method === 'GET' && url.pathname === '/debug-token') {
      const tok = env.BOT_TOKEN || '';
      return new Response(JSON.stringify({ length: tok.length, first4: tok.slice(0,4), last4: tok.slice(-4) }), { headers: { 'Content-Type': 'application/json' } });
    }

    // One-time webhook setup (call GET /setup to register webhook)
    if (method === 'GET' && url.pathname === '/setup') {
      const workerUrl = `${url.protocol}//${url.host}/webhook`;
      try {
        await tg('deleteWebhook', { drop_pending_updates: true }, env.BOT_TOKEN);
        const result = await tg('setWebhook', {
          url: workerUrl,
          allowed_updates: ['message', 'callback_query', 'my_chat_member'],
        }, env.BOT_TOKEN);
        const info = await tg('getWebhookInfo', {}, env.BOT_TOKEN);
        return new Response(JSON.stringify({ ok: true, webhook: workerUrl, info }, null, 2), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err) {
        return new Response(JSON.stringify({ ok: false, error: err.message }, null, 2), {
          status: 500, headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // API
    if (method === 'GET'  && url.pathname === '/api/groups') return apiGroups(request, env);
    if (method === 'POST' && url.pathname === '/api/open')   return apiOpen(request, env);
    if (method === 'POST' && url.pathname === '/api/close')  return apiClose(request, env);

    // Webhook
    if (method === 'POST' && url.pathname === '/webhook') {
      const update = await request.json();
      const token  = env.BOT_TOKEN;
      const KV     = env.KV;
      try {
        if (update.my_chat_member) {
          await handleMyChatMember(update.my_chat_member, KV);
        } else if (update.callback_query) {
          await handleCallback(update.callback_query, KV, token);
        } else if (update.message) {
          const msg = update.message;
          if (['group','supergroup'].includes(msg.chat?.type)) {
            await handleGroupMessage(msg, KV, token);
          } else if (msg.chat?.type === 'private') {
            if (msg.text?.startsWith('/start')) await handleStart(msg, KV, token);
            else await handleTextInput(msg, KV, token);
          }
        }
      } catch (err) { console.error('Webhook error:', err.message); }
      return new Response('OK');
    }

    return new Response('Not Found', { status: 404 });
  },

  async scheduled(event, env) {
    await runCron(env.KV, env.BOT_TOKEN);
  },
};
