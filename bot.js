const { TelegramBot } = require('node-telegram-bot-api');
const fs = require('fs');

const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN) {
  console.error('Error: BOT_TOKEN environment variable is not set. Exiting.');
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

// ─── Persistence: groups the bot is a member of ───────────────────────────────
const GROUPS_FILE = './groups.json';

function loadGroups() {
  try { return JSON.parse(fs.readFileSync(GROUPS_FILE, 'utf8')); } catch { return {}; }
}
function saveGroups(groups) {
  fs.writeFileSync(GROUPS_FILE, JSON.stringify(groups, null, 2));
}

let groups = loadGroups(); // { [groupId]: { id, title } }

// ─── In-memory session state ──────────────────────────────────────────────────
// sessions[privateChatId]     = { groupId }          ← which group is selected
// openTimers[groupId]         = { timerId, adminId, menuMessageId }
// waitingForInput[privateChatId] = { groupId, menuMessageId }
const sessions       = {};
const openTimers     = {};
const waitingForInput = {};

// ─── Group open/close helpers ─────────────────────────────────────────────────
async function openGroup(groupId) {
  await bot.setChatPermissions(groupId, {
    can_send_messages:       true,
    can_send_polls:          true,
    can_send_other_messages: true,
    can_add_web_page_previews: true,
    can_change_info:         false,
    can_invite_users:        true,
    can_pin_messages:        false,
  });
}

async function closeGroup(groupId) {
  await bot.setChatPermissions(groupId, {
    can_send_messages:       false,
    can_send_polls:          false,
    can_send_other_messages: false,
    can_add_web_page_previews: false,
    can_change_info:         false,
    can_invite_users:        false,
    can_pin_messages:        false,
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

// ─── Keyboards ────────────────────────────────────────────────────────────────

function groupListKeyboard() {
  const rows = Object.values(groups).map(g => ([
    { text: `👥 ${g.title}`, callback_data: `sel_${g.id}` },
  ]));
  return { inline_keyboard: rows };
}

function groupControlKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '🔓 បើក Group', callback_data: 'menu_open'     },
        { text: '🔒 បិទ Group',  callback_data: 'action_close'  },
      ],
      [{ text: '« ជ្រើស Group ផ្សេង', callback_data: 'back_groups' }],
    ],
  };
}

function durationKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '5 នាទី',  callback_data: 'open_5'   },
        { text: '10 នាទី', callback_data: 'open_10'  },
        { text: '15 នាទី', callback_data: 'open_15'  },
      ],
      [
        { text: '30 នាទី', callback_data: 'open_30'  },
        { text: '1 ម៉ោង',  callback_data: 'open_60'  },
        { text: '2 ម៉ោង',  callback_data: 'open_120' },
      ],
      [{ text: '⌨️ កំណត់ផ្ទាល់ខ្លួន', callback_data: 'open_custom' }],
      [{ text: '« ត្រឡប់',            callback_data: 'back_control' }],
    ],
  };
}

// ─── Screen renderers ─────────────────────────────────────────────────────────

async function showGroupList(privateChatId, messageId = null) {
  const count = Object.keys(groups).length;
  const text  = count
    ? '👥 *ជ្រើស Group ដែលចង់គ្រប់គ្រង:*'
    : '⚠️ Bot មិនទាន់ត្រូវបានបន្ថែមទៅ Group ណាមួយទេ។\n\nសូម Add bot ចូល Group ហើយ តែងតាំងជា Admin មុន។';

  const opts = {
    parse_mode: 'Markdown',
    reply_markup: count ? groupListKeyboard() : undefined,
  };

  if (messageId) {
    await bot.editMessageText(text, { chat_id: privateChatId, message_id: messageId, ...opts });
  } else {
    await bot.sendMessage(privateChatId, text, opts);
  }
}

async function showGroupControl(privateChatId, messageId, groupId) {
  const g       = groups[groupId];
  const hasTimer = !!openTimers[groupId];
  const status  = hasTimer ? '🟢 កំពុងបើក' : '🔴 បានបិទ';

  await bot.editMessageText(
    `⚙️ *ការគ្រប់គ្រង Group*\n\n👥 Group: *${g.title}*\nស្ថានភាព: ${status}`,
    {
      chat_id: privateChatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: groupControlKeyboard(),
    }
  );
}

async function showDurationPicker(privateChatId, messageId) {
  await bot.editMessageText(
    '⏱ *ជ្រើសរើសរយៈពេល*\n\nGroup នឹងបិទដោយស្វ័យប្រវត្តិ បន្ទាប់ពីរយៈពេលដែលបានជ្រើស។',
    {
      chat_id: privateChatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: durationKeyboard(),
    }
  );
}

// ─── Activate open (called from private chat, acts on groupId) ────────────────

async function activateOpen(privateChatId, messageId, groupId, minutes) {
  if (openTimers[groupId]) {
    clearTimeout(openTimers[groupId].timerId);
    delete openTimers[groupId];
  }

  await openGroup(groupId);

  const closeAt = new Date(Date.now() + minutes * 60 * 1000);
  const timeStr = closeAt.toLocaleTimeString('km-KH', { hour: '2-digit', minute: '2-digit' });
  const g = groups[groupId];

  await bot.editMessageText(
    `✅ *Group បានបើករួចហើយ!*\n\n` +
    `👥 Group: *${g.title}*\n` +
    `⏱ រយៈពេល: *${formatDuration(minutes)}*\n` +
    `🕐 នឹងបិទដោយស្វ័យប្រវត្តិ នៅម៉ោង *${timeStr}*`,
    {
      chat_id: privateChatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔒 បិទភ្លាមៗ',             callback_data: 'action_close' }],
          [{ text: '« ជ្រើស Group ផ្សេង', callback_data: 'back_groups'  }],
        ],
      },
    }
  );

  const timerId = setTimeout(async () => {
    try {
      await closeGroup(groupId);
      await bot.sendMessage(
        privateChatId,
        `🔒 *${g.title}* បានបិទហើយ!\nអរគុណសម្រាប់ការចូលរួម។`,
        { parse_mode: 'Markdown', reply_markup: groupControlKeyboard() }
      );
    } catch (err) {
      console.error('Auto-close error:', err.message);
    }
    delete openTimers[groupId];
  }, minutes * 60 * 1000);

  openTimers[groupId] = { timerId, adminId: privateChatId, menuMessageId: messageId };
}

// ─── Track when bot is added/removed from groups ──────────────────────────────

bot.on('my_chat_member', (update) => {
  const chat   = update.chat;
  const status = update.new_chat_member.status;

  if (['group', 'supergroup'].includes(chat.type)) {
    if (['member', 'administrator'].includes(status)) {
      groups[chat.id] = { id: chat.id, title: chat.title };
      saveGroups(groups);
      console.log(`Added to group: ${chat.title} (${chat.id})`);
    } else if (['left', 'kicked'].includes(status)) {
      delete groups[chat.id];
      saveGroups(groups);
      console.log(`Removed from group: ${chat.title} (${chat.id})`);
    }
  }
});

// ─── /start (private chat only) ───────────────────────────────────────────────

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  if (msg.chat.type !== 'private') return;
  delete sessions[chatId];
  await showGroupList(chatId);
});

// ─── Inline button handler ────────────────────────────────────────────────────

bot.on('callback_query', async (query) => {
  const privateChatId = query.message.chat.id;
  const msgId         = query.message.message_id;
  const userId        = query.from.id;
  const data          = query.data;

  await bot.answerCallbackQuery(query.id);

  // Only handle in private chat
  if (query.message.chat.type !== 'private') return;

  const session = sessions[privateChatId] || {};

  // ── Select a group ──────────────────────────────────────────────────────────
  if (data.startsWith('sel_')) {
    const groupId = parseInt(data.slice(4));

    if (!groups[groupId]) {
      await bot.answerCallbackQuery(query.id, { text: '⚠️ Group រកមិនឃើញ។', show_alert: true });
      return;
    }
    if (!(await isAdmin(groupId, userId))) {
      await bot.answerCallbackQuery(query.id, {
        text: '❌ អ្នកមិនមែនជា Admin នៃ Group នេះទេ។',
        show_alert: true,
      });
      return;
    }

    sessions[privateChatId] = { groupId };
    await showGroupControl(privateChatId, msgId, groupId);
    return;
  }

  // ── Back to group list ──────────────────────────────────────────────────────
  if (data === 'back_groups') {
    delete sessions[privateChatId];
    delete waitingForInput[privateChatId];
    await showGroupList(privateChatId, msgId);
    return;
  }

  // ── Back to group control ───────────────────────────────────────────────────
  if (data === 'back_control') {
    delete waitingForInput[privateChatId];
    if (!session.groupId) { await showGroupList(privateChatId, msgId); return; }
    await showGroupControl(privateChatId, msgId, session.groupId);
    return;
  }

  // Guard: must have a selected group for everything below
  if (!session.groupId) {
    await showGroupList(privateChatId, msgId);
    return;
  }

  const groupId = session.groupId;

  // Verify still admin
  if (!(await isAdmin(groupId, userId))) {
    await bot.answerCallbackQuery(query.id, {
      text: '❌ អ្នកមិនមែនជា Admin នៃ Group នេះទេ។',
      show_alert: true,
    });
    return;
  }

  // ── Show duration picker ────────────────────────────────────────────────────
  if (data === 'menu_open') {
    await showDurationPicker(privateChatId, msgId);
    return;
  }

  // ── Custom duration ─────────────────────────────────────────────────────────
  if (data === 'open_custom') {
    waitingForInput[privateChatId] = { groupId, menuMessageId: msgId };
    await bot.editMessageText(
      '⌨️ *កំណត់រយៈពេលផ្ទាល់ខ្លួន*\n\n' +
      'សូមវាយចំនួន *នាទី* ដែលចង់បើក Group\n' +
      '_ឧទាហរណ៍: 45 ឬ 90_',
      {
        chat_id: privateChatId,
        message_id: msgId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'menu_open' }]],
        },
      }
    );
    return;
  }

  // ── Preset duration ─────────────────────────────────────────────────────────
  if (data.startsWith('open_')) {
    const minutes = parseInt(data.split('_')[1]);
    try {
      await activateOpen(privateChatId, msgId, groupId, minutes);
    } catch (err) {
      console.error('Open error:', err.message);
      await bot.editMessageText(
        '❌ មិនអាចបើក Group បានទេ។\nសូមពិនិត្យថា bot មានសិទ្ធិ *Admin* និង *Restrict Members*។',
        {
          chat_id: privateChatId,
          message_id: msgId,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'back_control' }]] },
        }
      );
    }
    return;
  }

  // ── Close group ─────────────────────────────────────────────────────────────
  if (data === 'action_close') {
    if (openTimers[groupId]) {
      clearTimeout(openTimers[groupId].timerId);
      delete openTimers[groupId];
    }
    delete waitingForInput[privateChatId];
    try {
      await closeGroup(groupId);
      await showGroupControl(privateChatId, msgId, groupId);
    } catch (err) {
      console.error('Close error:', err.message);
      await bot.editMessageText(
        '❌ មិនអាចបិទ Group បានទេ។\nសូមពិនិត្យថា bot មានសិទ្ធិ *Admin* និង *Restrict Members*។',
        {
          chat_id: privateChatId,
          message_id: msgId,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'back_control' }]] },
        }
      );
    }
    return;
  }
});

// ─── Custom duration text input (private chat) ────────────────────────────────

bot.on('message', async (msg) => {
  if (msg.chat.type !== 'private') return;
  if (!msg.text || msg.text.startsWith('/')) return;

  const privateChatId = msg.chat.id;
  const state = waitingForInput[privateChatId];
  if (!state || msg.from.id !== privateChatId) return;

  // Delete the typed message for a clean UI
  try { await bot.deleteMessage(privateChatId, msg.message_id); } catch {}

  const minutes = parseInt(msg.text.trim());
  if (isNaN(minutes) || minutes <= 0 || minutes > 1440) {
    const warn = await bot.sendMessage(
      privateChatId,
      '⚠️ សូមវាយចំនួនគត់ រវាង *1 – 1440* នាទី។',
      { parse_mode: 'Markdown' }
    );
    setTimeout(() => bot.deleteMessage(privateChatId, warn.message_id).catch(() => {}), 4000);
    return;
  }

  delete waitingForInput[privateChatId];

  try {
    await activateOpen(privateChatId, state.menuMessageId, state.groupId, minutes);
  } catch (err) {
    console.error('Open (custom) error:', err.message);
    await bot.editMessageText(
      '❌ មិនអាចបើក Group បានទេ។\nសូមពិនិត្យថា bot មានសិទ្ធិ *Admin* និង *Restrict Members*។',
      {
        chat_id: privateChatId,
        message_id: state.menuMessageId,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'back_control' }]] },
      }
    );
  }
});

// ─── Polling error handler ────────────────────────────────────────────────────

bot.on('polling_error', (err) => {
  console.error('Polling error:', err.message);
});

console.log('Bot is running...');
