// Telegram Bot — Cloudflare Worker (webhook mode)
// State stored in KV; auto-close runs on Cron trigger every minute.

const TG = 'https://api.telegram.org';

// ─── Telegram API helper ──────────────────────────────────────────────────────
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

// ─── KV helpers ───────────────────────────────────────────────────────────────
async function getGroups(KV)              { return (await KV.get('groups', 'json')) || {}; }
async function saveGroups(KV, groups)     { await KV.put('groups', JSON.stringify(groups)); }
async function getSession(KV, pid)        { return await KV.get(`sess:${pid}`, 'json'); }
async function setSession(KV, pid, data)  { await KV.put(`sess:${pid}`, JSON.stringify(data), { expirationTtl: 3600 }); }
async function delSession(KV, pid)        { await KV.delete(`sess:${pid}`); }
async function getTimer(KV, gid)          { return await KV.get(`timer:${gid}`, 'json'); }
async function setTimer(KV, gid, data)    { await KV.put(`timer:${gid}`, JSON.stringify(data)); }
async function delTimer(KV, gid)          { await KV.delete(`timer:${gid}`); }
async function getWaiting(KV, pid)        { return await KV.get(`wait:${pid}`, 'json'); }
async function setWaiting(KV, pid, data)  { await KV.put(`wait:${pid}`, JSON.stringify(data), { expirationTtl: 300 }); }
async function delWaiting(KV, pid)        { await KV.delete(`wait:${pid}`); }

// ─── Permissions ──────────────────────────────────────────────────────────────
const OPEN_PERMS  = { can_send_messages: true,  can_send_polls: true,  can_send_other_messages: true,  can_add_web_page_previews: true,  can_change_info: false, can_invite_users: true,  can_pin_messages: false };
const CLOSE_PERMS = { can_send_messages: false, can_send_polls: false, can_send_other_messages: false, can_add_web_page_previews: false, can_change_info: false, can_invite_users: false, can_pin_messages: false };

async function openGroup(gid, token)  { await tg('setChatPermissions', { chat_id: gid, permissions: OPEN_PERMS  }, token); }
async function closeGroup(gid, token) { await tg('setChatPermissions', { chat_id: gid, permissions: CLOSE_PERMS }, token); }

async function isAdmin(gid, uid, token) {
  try {
    const m = await tg('getChatMember', { chat_id: gid, user_id: uid }, token);
    return ['administrator', 'creator'].includes(m.status);
  } catch { return false; }
}

// ─── Formatting ───────────────────────────────────────────────────────────────
function formatDuration(m) {
  if (m < 60) return `${m} នាទី`;
  const h = Math.floor(m / 60), r = m % 60;
  return r > 0 ? `${h} ម៉ោង ${r} នាទី` : `${h} ម៉ោង`;
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('km-KH', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Phnom_Penh',
  });
}

// ─── Keyboards ────────────────────────────────────────────────────────────────
function groupListKeyboard(groups) {
  const rows = Object.values(groups).map(g => ([
    { text: `👥 ${g.title}`, callback_data: `sel_${g.id}` },
  ]));
  return { inline_keyboard: rows };
}

const controlKeyboard = { inline_keyboard: [
  [{ text: '🔓 បើក Group', callback_data: 'menu_open' }, { text: '🔒 បិទ Group', callback_data: 'action_close' }],
  [{ text: '« ជ្រើស Group ផ្សេង', callback_data: 'back_groups' }],
]};

const durationKeyboard = { inline_keyboard: [
  [{ text: '5 នាទី', callback_data: 'open_5' }, { text: '10 នាទី', callback_data: 'open_10' }, { text: '15 នាទី', callback_data: 'open_15' }],
  [{ text: '30 នាទី', callback_data: 'open_30' }, { text: '1 ម៉ោង', callback_data: 'open_60' }, { text: '2 ម៉ោង', callback_data: 'open_120' }],
  [{ text: '⌨️ កំណត់ផ្ទាល់ខ្លួន', callback_data: 'open_custom' }],
  [{ text: '« ត្រឡប់', callback_data: 'back_control' }],
]};

// ─── Screen builders ──────────────────────────────────────────────────────────
async function showGroupList(pid, msgId, KV, token) {
  const groups = await getGroups(KV);
  const count  = Object.keys(groups).length;
  const text   = count
    ? '👥 *ជ្រើស Group ដែលចង់គ្រប់គ្រង:*'
    : '⚠️ Bot មិនទាន់ត្រូវបានបន្ថែមទៅ Group ណាមួយទេ។\n\nសូម Add bot ចូល Group ហើយ តែងតាំងជា Admin មុន។';
  const opts = { parse_mode: 'Markdown', reply_markup: count ? groupListKeyboard(groups) : undefined };

  if (msgId) await tg('editMessageText', { chat_id: pid, message_id: msgId, ...opts, text }, token);
  else        await tg('sendMessage',     { chat_id: pid, ...opts, text }, token);
}

async function showControl(pid, msgId, gid, KV, token) {
  const groups = await getGroups(KV);
  const g      = groups[gid];
  const timer  = await getTimer(KV, gid);
  const status = timer ? `🟢 កំពុងបើក (បិទ ${formatTime(timer.closeAt)})` : '🔴 បានបិទ';
  await tg('editMessageText', {
    chat_id: pid, message_id: msgId, parse_mode: 'Markdown',
    text: `⚙️ *ការគ្រប់គ្រង Group*\n\n👥 Group: *${g.title}*\nស្ថានភាព: ${status}`,
    reply_markup: controlKeyboard,
  }, token);
}

// ─── Activate open ────────────────────────────────────────────────────────────
async function activateOpen(pid, msgId, gid, minutes, KV, token) {
  // Cancel existing timer if any
  await delTimer(KV, gid);

  await openGroup(gid, token);

  const closeAt = Date.now() + minutes * 60 * 1000;
  const groups  = await getGroups(KV);
  const title   = groups[gid]?.title || gid;

  await setTimer(KV, gid, { closeAt, adminPrivateChatId: pid, menuMessageId: msgId, groupTitle: title });

  await tg('editMessageText', {
    chat_id: pid, message_id: msgId, parse_mode: 'Markdown',
    text:
      `✅ *Group បានបើករួចហើយ!*\n\n` +
      `👥 Group: *${title}*\n` +
      `⏱ រយៈពេល: *${formatDuration(minutes)}*\n` +
      `🕐 នឹងបិទដោយស្វ័យប្រវត្តិ នៅម៉ោង *${formatTime(closeAt)}*`,
    reply_markup: { inline_keyboard: [
      [{ text: '🔒 បិទភ្លាមៗ', callback_data: 'action_close' }],
      [{ text: '« ជ្រើស Group ផ្សេង', callback_data: 'back_groups' }],
    ]},
  }, token);
}

// ─── Cron: auto-close expired groups ─────────────────────────────────────────
async function runAutoClose(KV, token) {
  const now  = Date.now();
  const list = await KV.list({ prefix: 'timer:' });

  for (const key of list.keys) {
    const timer = await KV.get(key.name, 'json');
    if (!timer || timer.closeAt > now) continue;

    const gid = key.name.slice(6); // strip "timer:"
    await delTimer(KV, gid);

    try { await closeGroup(gid, token); } catch (e) { console.error('cron close:', e.message); }

    try {
      await tg('sendMessage', {
        chat_id: timer.adminPrivateChatId,
        parse_mode: 'Markdown',
        text: `🔒 *${timer.groupTitle}* បានបិទហើយ!\nអរគុណសម្រាប់ការចូលរួម។`,
        reply_markup: controlKeyboard,
      }, token);
    } catch (e) { console.error('cron notify:', e.message); }
  }
}

// ─── Handle /start ────────────────────────────────────────────────────────────
async function handleStart(msg, KV, token) {
  if (msg.chat.type !== 'private') return;
  await delSession(KV, msg.chat.id);
  await showGroupList(msg.chat.id, null, KV, token);
}

// ─── Handle group messages (auto-register) ────────────────────────────────────
async function handleGroupMessage(msg, KV) {
  const chat = msg.chat;
  if (!['group', 'supergroup'].includes(chat.type)) return;
  const groups  = await getGroups(KV);
  if (groups[chat.id]?.title === chat.title) return; // no change
  groups[chat.id] = { id: chat.id, title: chat.title };
  await saveGroups(KV, groups);
}

// ─── Handle my_chat_member (bot added/removed) ────────────────────────────────
async function handleMyChatMember(update, KV) {
  const chat   = update.chat;
  const status = update.new_chat_member.status;
  if (!['group', 'supergroup'].includes(chat.type)) return;

  const groups = await getGroups(KV);
  if (['member', 'administrator'].includes(status)) {
    groups[chat.id] = { id: chat.id, title: chat.title };
  } else if (['left', 'kicked'].includes(status)) {
    delete groups[chat.id];
  }
  await saveGroups(KV, groups);
}

// ─── Handle callback_query ────────────────────────────────────────────────────
async function handleCallback(query, KV, token) {
  const pid  = query.message.chat.id;
  const msgId = query.message.message_id;
  const uid  = query.from.id;
  const data = query.data;

  await tg('answerCallbackQuery', { callback_query_id: query.id }, token);

  if (query.message.chat.type !== 'private') return;

  const session = (await getSession(KV, pid)) || {};

  // ── Select group ────────────────────────────────────────────────────────────
  if (data.startsWith('sel_')) {
    const gid = parseInt(data.slice(4));
    const groups = await getGroups(KV);
    if (!groups[gid]) {
      await tg('answerCallbackQuery', { callback_query_id: query.id, text: '⚠️ Group រកមិនឃើញ។', show_alert: true }, token);
      return;
    }
    if (!(await isAdmin(gid, uid, token))) {
      await tg('answerCallbackQuery', { callback_query_id: query.id, text: '❌ អ្នកមិនមែនជា Admin នៃ Group នេះទេ។', show_alert: true }, token);
      return;
    }
    await setSession(KV, pid, { groupId: gid });
    await showControl(pid, msgId, gid, KV, token);
    return;
  }

  // ── Back to group list ──────────────────────────────────────────────────────
  if (data === 'back_groups') {
    await delSession(KV, pid);
    await delWaiting(KV, pid);
    await showGroupList(pid, msgId, KV, token);
    return;
  }

  // ── Back to control ─────────────────────────────────────────────────────────
  if (data === 'back_control') {
    await delWaiting(KV, pid);
    if (!session.groupId) { await showGroupList(pid, msgId, KV, token); return; }
    await showControl(pid, msgId, session.groupId, KV, token);
    return;
  }

  if (!session.groupId) { await showGroupList(pid, msgId, KV, token); return; }
  const gid = session.groupId;

  if (!(await isAdmin(gid, uid, token))) {
    await tg('answerCallbackQuery', { callback_query_id: query.id, text: '❌ អ្នកមិនមែនជា Admin នៃ Group នេះទេ។', show_alert: true }, token);
    return;
  }

  // ── Open menu ───────────────────────────────────────────────────────────────
  if (data === 'menu_open') {
    await tg('editMessageText', {
      chat_id: pid, message_id: msgId, parse_mode: 'Markdown',
      text: '⏱ *ជ្រើសរើសរយៈពេល*\n\nGroup នឹងបិទដោយស្វ័យប្រវត្តិ បន្ទាប់ពីរយៈពេលដែលបានជ្រើស។',
      reply_markup: durationKeyboard,
    }, token);
    return;
  }

  // ── Custom duration ─────────────────────────────────────────────────────────
  if (data === 'open_custom') {
    await setWaiting(KV, pid, { groupId: gid, menuMessageId: msgId });
    await tg('editMessageText', {
      chat_id: pid, message_id: msgId, parse_mode: 'Markdown',
      text: '⌨️ *កំណត់រយៈពេលផ្ទាល់ខ្លួន*\n\nសូមវាយចំនួន *នាទី* ដែលចង់បើក Group\n_ឧទាហរណ៍: 45 ឬ 90_',
      reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'menu_open' }]] },
    }, token);
    return;
  }

  // ── Preset duration ─────────────────────────────────────────────────────────
  if (data.startsWith('open_')) {
    const minutes = parseInt(data.split('_')[1]);
    try {
      await activateOpen(pid, msgId, gid, minutes, KV, token);
    } catch (err) {
      console.error('open error:', err.message);
      await tg('editMessageText', {
        chat_id: pid, message_id: msgId, parse_mode: 'Markdown',
        text: '❌ មិនអាចបើក Group បានទេ។\nសូមពិនិត្យថា bot មានសិទ្ធិ *Admin* និង *Restrict Members*។',
        reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'back_control' }]] },
      }, token);
    }
    return;
  }

  // ── Close group ─────────────────────────────────────────────────────────────
  if (data === 'action_close') {
    await delWaiting(KV, pid);
    await delTimer(KV, gid);

    try {
      await closeGroup(gid, token);
    } catch (err) {
      console.error('close error:', err.message);
      await tg('editMessageText', {
        chat_id: pid, message_id: msgId, parse_mode: 'Markdown',
        text: '❌ មិនអាចបិទ Group បានទេ។\nសូមពិនិត្យថា bot មានសិទ្ធិ *Admin* និង *Restrict Members*។',
        reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'back_control' }]] },
      }, token);
      return;
    }

    try { await showControl(pid, msgId, gid, KV, token); } catch {}
    return;
  }
}

// ─── Handle text input (custom duration) ─────────────────────────────────────
async function handleTextInput(msg, KV, token) {
  if (msg.chat.type !== 'private') return;
  if (!msg.text || msg.text.startsWith('/')) return;

  const pid   = msg.chat.id;
  const state = await getWaiting(KV, pid);
  if (!state || msg.from.id !== pid) return;

  // Delete user's message
  try { await tg('deleteMessage', { chat_id: pid, message_id: msg.message_id }, token); } catch {}

  const minutes = parseInt(msg.text.trim());
  if (isNaN(minutes) || minutes <= 0 || minutes > 1440) {
    const warn = await tg('sendMessage', { chat_id: pid, parse_mode: 'Markdown', text: '⚠️ សូមវាយចំនួនគត់ រវាង *1 – 1440* នាទី។' }, token);
    // Note: no setTimeout in Workers — warn stays; user can just re-type
    return;
  }

  await delWaiting(KV, pid);

  try {
    await activateOpen(pid, state.menuMessageId, state.groupId, minutes, KV, token);
  } catch (err) {
    console.error('open custom error:', err.message);
    await tg('editMessageText', {
      chat_id: pid, message_id: state.menuMessageId, parse_mode: 'Markdown',
      text: '❌ មិនអាចបើក Group បានទេ។\nសូមពិនិត្យថា bot មានសិទ្ធិ *Admin* និង *Restrict Members*។',
      reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'back_control' }]] },
    }, token);
  }
}

// ─── Main entry ───────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return new Response('OK');

    const update = await request.json();
    const token  = env.BOT_TOKEN;
    const KV     = env.KV;

    try {
      if (update.my_chat_member) await handleMyChatMember(update.my_chat_member, KV);
      else if (update.callback_query) await handleCallback(update.callback_query, KV, token);
      else if (update.message) {
        const msg = update.message;
        if (msg.text?.startsWith('/start')) await handleStart(msg, KV, token);
        else {
          await handleGroupMessage(msg, KV);
          await handleTextInput(msg, KV, token);
        }
      }
    } catch (err) {
      console.error('Worker error:', err.message);
    }

    return new Response('OK');
  },

  async scheduled(event, env) {
    await runAutoClose(env.KV, env.BOT_TOKEN);
  },
};
