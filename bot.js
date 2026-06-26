const { TelegramBot } = require('node-telegram-bot-api');

const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN) {
  console.error('Error: BOT_TOKEN environment variable is not set. Exiting.');
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

// Track auto-close timers per chat
const openTimers = {};

// Check if user is admin in the chat
async function isAdmin(chatId, userId) {
  try {
    const member = await bot.getChatMember(chatId, userId);
    return ['administrator', 'creator'].includes(member.status);
  } catch {
    return false;
  }
}

// Open group: allow members to send messages
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

// Close group: restrict members from sending messages
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

// Format duration for display
function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} នាទី`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} ម៉ោង ${m} នាទី` : `${h} ម៉ោង`;
}

// Main control keyboard
function mainKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '🔓 បើក Group', callback_data: 'menu_open' },
        { text: '🔒 បិទ Group', callback_data: 'action_close' },
      ],
    ],
  };
}

// Duration selection keyboard
function durationKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '5 នាទី',   callback_data: 'open_5'   },
        { text: '10 នាទី',  callback_data: 'open_10'  },
        { text: '15 នាទី',  callback_data: 'open_15'  },
      ],
      [
        { text: '30 នាទី',  callback_data: 'open_30'  },
        { text: '1 ម៉ោង',   callback_data: 'open_60'  },
        { text: '2 ម៉ោង',   callback_data: 'open_120' },
      ],
      [
        { text: '« ត្រឡប់', callback_data: 'menu_back' },
      ],
    ],
  };
}

// Send or update main menu
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

// /start → show main menu
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  await sendMainMenu(chatId);
});

// Handle all inline button presses
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const userId = query.from.id;
  const data = query.data;

  // Always acknowledge the callback
  await bot.answerCallbackQuery(query.id);

  // Admin check for group chats
  if (query.message.chat.type !== 'private') {
    const admin = await isAdmin(chatId, userId);
    if (!admin) {
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
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: durationKeyboard(),
      }
    );
    return;
  }

  // Go back to main menu
  if (data === 'menu_back') {
    await sendMainMenu(chatId, messageId);
    return;
  }

  // Open group for selected duration
  if (data.startsWith('open_')) {
    const minutes = parseInt(data.split('_')[1]);

    // Cancel any existing timer
    if (openTimers[chatId]) {
      clearTimeout(openTimers[chatId]);
      delete openTimers[chatId];
    }

    try {
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
            inline_keyboard: [
              [{ text: '🔒 បិទភ្លាមៗ', callback_data: 'action_close' }],
            ],
          },
        }
      );

      // Auto-close after duration
      openTimers[chatId] = setTimeout(async () => {
        try {
          await closeGroup(chatId);
          await bot.sendMessage(
            chatId,
            '🔒 *Group បានបិទហើយ!*\nអរគុណសម្រាប់ការចូលរួម។',
            {
              parse_mode: 'Markdown',
              reply_markup: mainKeyboard(),
            }
          );
        } catch (err) {
          console.error('Auto-close error:', err.message);
        }
        delete openTimers[chatId];
      }, minutes * 60 * 1000);

    } catch (err) {
      console.error('Open group error:', err.message);
      await bot.editMessageText(
        '❌ មិនអាចបើក Group បានទេ។\nសូមពិនិត្យថា bot មានសិទ្ធិ *Admin* និង *Restrict Members*។',
        {
          chat_id: chatId,
          message_id: messageId,
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

    try {
      await closeGroup(chatId);
      await bot.editMessageText(
        '🔒 *Group បានបិទហើយ!*\nសមាជិកមិនអាចផ្ញើសារបានទេឥឡូវនេះ។',
        {
          chat_id: chatId,
          message_id: messageId,
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
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: '« ត្រឡប់', callback_data: 'menu_back' }]] },
        }
      );
    }
    return;
  }
});

// Handle polling errors gracefully
bot.on('polling_error', (err) => {
  console.error('Polling error:', err.message);
});

console.log('Bot is running...');
