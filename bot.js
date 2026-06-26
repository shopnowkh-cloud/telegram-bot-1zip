const { TelegramBot } = require('node-telegram-bot-api');

const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN) {
  console.error('Error: BOT_TOKEN environment variable is not set. Exiting.');
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

// Track auto-close timers per chat: chatId → timeoutId
const openTimers = {};

// Track chats waiting for custom duration input: chatId → { userId, menuMessageId }
const waitingForInput = {};

// ─── Helpers ────────────────────────────────────────────────────────────────

async function isAdmin(chatId, userId) {
  try {
    const member = await bot.getChatMember(chatId, userId);
    return ['administrator', 'creator'].includes(member.status);
  } catch {
    return false;
  }
}

async function openGroup(chatId) {
  await bot.setChatPermissions(chatId, {
    can_send_messages: true,
    can_send_polls: true,
    can_send_other_messages: true,
    can_add_web_page_previews: true,
    can_change_info: false,
    can_invite_users: true,
    can_pin_messages: false,
  });
}

async function closeGroup(chatId) {
  await bot.setChatPermissions(chatId, {
    can_send_messages: false,
    can_send_polls: false,
    can_send_other_messages: false,
    can_add_web_page_previews: false,
    can_change_info: false,
    can_invite_users: false,
    can_pin_messages: false,
  });
}

function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} នាទី`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} ម៉ោង ${m} នាទី` : `${h} ម៉ោង`;
}

// ─── Keyboards ───────────────────────────────────────────────────────────────

function mainKeyboard() {
  return {
    inline_keyboard: [[
      { text: '🔓 បើក Group', callback_data: 'menu_open' },
      { text: '🔒 បិទ Group',  callback_data: 'action_close' },
    ]],
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
      [
        { text: '⌨️ កំណត់ផ្ទាល់ខ្លួន', callback_data: 'open_custom' },
      ],
      [
        { text: '« ត្រឡប់', callback_data: 'menu_back' },
      ],
    ],
  };
}

// ─── Open group and update menu message ──────────────────────────────────────

async function activateOpen(chatId, messageId, minutes) {
  // Cancel any existing timer
  if (openTimers[chatId]) {
    clearTimeout(openTimers[chatId]);
    delete openTimers[chatId];
  }

  await openGroup(chatId);

  const closeAt = new Date(Date.now() + minutes * 60 * 1000);
  const timeStr = closeAt.toLocaleTimeString('km-KH', { hour: '2-digit', minute: '2-digit' });

  await bot.editMessageText(
    `✅ *Group បានបើករួចហើយ!*\n\n` +
    `⏱ រយៈពេល: *${formatDuration(minutes)}*\n` +
    `🕐 នឹងបិទដោយស្វ័យប្រវត្តិ នៅម៉ោង *${timeStr}*`,
    {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '🔒 បិទភ្លាមៗ', callback_data: 'action_close' },
        ]],
      },
    }
  );

  openTimers[chatId] = setTimeout(async () => {
    try {
      await closeGroup(chatId);
      await bot.sendMessage(chatId, '🔒 *Group បានបិទហើយ!*\nអរគុណសម្រាប់ការចូលរួម។', {
        parse_mode: 'Markdown',
        reply_markup: mainKeyboard(),
      });
    } catch (err) {
      console.error('Auto-close error:', err.message);
    }
    delete openTimers[chatId];
  }, minutes * 60 * 1000);
}

// ─── Main menu ───────────────────────────────────────────────────────────────

async function sendMainMenu(chatId, messageId = null) {
  const text =
    '⚙️ *ការគ្រប់គ្រង Group*\n\n' +
    '🔓 *បើក Group* — ឱ្យសមាជិកផ្ញើសារបាន\n' +
    '🔒 *បិទ Group* — ហាមសមាជិកផ្ញើសារ';

  if (messageId) {
    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: mainKeyboard(),
    });
  } else {
    await bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup: mainKeyboard(),
    });
  }
}

// ─── /start ──────────────────────────────────────────────────────────────────

bot.onText(/\/start/, async (msg) => {
  await sendMainMenu(msg.chat.id);
});

// ─── Inline button handler ────────────────────────────────────────────────────

bot.on('callback_query', async (query) => {
  const chatId   = query.message.chat.id;
  const msgId    = query.message.message_id;
  const userId   = query.from.id;
  const data     = query.data;

  await bot.answerCallbackQuery(query.id);

  // Admin guard (groups only)
  if (query.message.chat.type !== 'private') {
    if (!(await isAdmin(chatId, userId))) {
      await bot.answerCallbackQuery(query.id, {
        text: '❌ តែ Admin ទេ ដែលអាចប្រើមុខងារនេះ។',
        show_alert: true,
      });
      return;
    }
  }

  // Show duration picker
  if (data === 'menu_open') {
    await bot.editMessageText(
      '⏱ *ជ្រើសរើសរយៈពេល*\n\nGroup នឹងបិទដោយស្វ័យប្រវត្តិ បន្ទាប់ពីរយៈពេលដែលបានជ្រើស។',
      {
        chat_id: chatId,
        message_id: msgId,
        parse_mode: 'Markdown',
        reply_markup: durationKeyboard(),
      }
    );
    return;
  }

  // Back to main menu
  if (data === 'menu_back') {
    delete waitingForInput[chatId];
    await sendMainMenu(chatId, msgId);
    return;
  }

  // Custom duration: ask admin to type minutes
  if (data === 'open_custom') {
    waitingForInput[chatId] = { userId, menuMessageId: msgId };
    await bot.editMessageText(
      '⌨️ *កំណត់រយៈពេលផ្ទាល់ខ្លួន*\n\n' +
      'សូមវាយចំនួន *នាទី* ដែលចង់បើក Group\n' +
      '_ឧទាហរណ៍: 45 (45 នាទី) ឬ 90 (1 ម៉ោង 30 នាទី)_',
      {
        chat_id: chatId,
        message_id: msgId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '« ត្រឡប់', callback_data: 'menu_open' },
          ]],
        },
      }
    );
    return;
  }

  // Preset duration
  if (data.startsWith('open_')) {
    const minutes = parseInt(data.split('_')[1]);
    try {
      await activateOpen(chatId, msgId, minutes);
    } catch (err) {
      console.error('Open group error:', err.message);
      await bot.editMessageText(
        '❌ មិនអាចបើក Group បានទេ។\nសូមពិនិត្យថា bot មានសិទ្ធិ *Admin* និង *Restrict Members*។',
        {
          chat_id: chatId,
          message_id: msgId,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'menu_back' }]] },
        }
      );
    }
    return;
  }

  // Close group immediately
  if (data === 'action_close') {
    if (openTimers[chatId]) {
      clearTimeout(openTimers[chatId]);
      delete openTimers[chatId];
    }
    delete waitingForInput[chatId];
    try {
      await closeGroup(chatId);
      await bot.editMessageText(
        '🔒 *Group បានបិទហើយ!*\nសមាជិកមិនអាចផ្ញើសារបានទេឥឡូវនេះ។',
        {
          chat_id: chatId,
          message_id: msgId,
          parse_mode: 'Markdown',
          reply_markup: mainKeyboard(),
        }
      );
    } catch (err) {
      console.error('Close group error:', err.message);
      await bot.editMessageText(
        '❌ មិនអាចបិទ Group បានទេ។\nសូមពិនិត្យថា bot មានសិទ្ធិ *Admin* និង *Restrict Members*។',
        {
          chat_id: chatId,
          message_id: msgId,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'menu_back' }]] },
        }
      );
    }
    return;
  }
});

// ─── Custom duration text input handler ──────────────────────────────────────

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const state  = waitingForInput[chatId];

  // Only handle if we're waiting for input from this specific admin
  if (!state || !msg.text || msg.from.id !== state.userId) return;
  // Ignore commands
  if (msg.text.startsWith('/')) return;

  const minutes = parseInt(msg.text.trim());

  // Delete the user's input message for a cleaner chat
  try { await bot.deleteMessage(chatId, msg.message_id); } catch {}

  if (isNaN(minutes) || minutes <= 0 || minutes > 1440) {
    const prompt = await bot.sendMessage(
      chatId,
      '⚠️ សូមវាយចំនួនគត់ រវាង *1 – 1440* នាទី។',
      { parse_mode: 'Markdown' }
    );
    // Auto-delete the warning after 4 seconds
    setTimeout(() => bot.deleteMessage(chatId, prompt.message_id).catch(() => {}), 4000);
    return;
  }

  delete waitingForInput[chatId];

  try {
    await activateOpen(chatId, state.menuMessageId, minutes);
  } catch (err) {
    console.error('Open group (custom) error:', err.message);
    await bot.editMessageText(
      '❌ មិនអាចបើក Group បានទេ។\nសូមពិនិត្យថា bot មានសិទ្ធិ *Admin* និង *Restrict Members*។',
      {
        chat_id: chatId,
        message_id: state.menuMessageId,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'menu_back' }]] },
      }
    );
  }
});

// ─── Polling error handler ────────────────────────────────────────────────────

bot.on('polling_error', (err) => {
  console.error('Polling error:', err.message);
});

console.log('Bot is running...');
