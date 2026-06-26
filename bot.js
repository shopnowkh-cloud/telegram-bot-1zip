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

// /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId,
    '👋 សួស្តី!\n\n' +
    'ពាក្យបញ្ជា:\n' +
    '🔓 /open [នាទី] — បើក group ឱ្យសមាជិកផ្ញើសារ (ឧ: /open 30)\n' +
    '🔒 /close — បិទ group ភ្លាមៗ\n\n' +
    '⚠️ តម្រូវឱ្យ bot មានសិទ្ធិ Admin'
  );
});

// /open [minutes]
bot.onText(/\/open(?:\s+(\d+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (msg.chat.type === 'private') {
    return bot.sendMessage(chatId, '⚠️ ពាក្យបញ្ជានេះ ប្រើបានតែក្នុង Group ប៉ុណ្ណោះ។');
  }

  if (!(await isAdmin(chatId, userId))) {
    return bot.sendMessage(chatId, '❌ តែ Admin ទេ ដែលអាចប្រើពាក្យបញ្ជានេះ។');
  }

  const minutes = parseInt(match[1]);
  if (!match[1] || isNaN(minutes) || minutes <= 0) {
    return bot.sendMessage(chatId, '⚠️ សូមបញ្ចូលរយៈពេលជាចំនួននាទី។\nឧទាហរណ៍: /open 30');
  }

  // Cancel any existing timer
  if (openTimers[chatId]) {
    clearTimeout(openTimers[chatId]);
    delete openTimers[chatId];
  }

  try {
    await openGroup(chatId);

    const closeAt = new Date(Date.now() + minutes * 60 * 1000);
    const timeStr = closeAt.toLocaleTimeString('km-KH', { hour: '2-digit', minute: '2-digit' });

    await bot.sendMessage(chatId,
      `🔓 Group បានបើកហើយ!\n` +
      `⏱ រយៈពេល: ${formatDuration(minutes)}\n` +
      `🕐 នឹងបិទដោយស្វ័យប្រវត្តិ នៅម៉ោង ${timeStr}`
    );

    // Auto-close after duration
    openTimers[chatId] = setTimeout(async () => {
      try {
        await closeGroup(chatId);
        await bot.sendMessage(chatId, '🔒 Group បានបិទហើយ។ អរគុណសម្រាប់ការចូលរួម!');
      } catch (err) {
        console.error('Auto-close error:', err.message);
      }
      delete openTimers[chatId];
    }, minutes * 60 * 1000);

  } catch (err) {
    console.error('Open group error:', err.message);
    bot.sendMessage(chatId, '❌ មិនអាចបើក Group បានទេ។ សូមពិនិត្យថា bot មានសិទ្ធិ Admin។');
  }
});

// /close
bot.onText(/\/close/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (msg.chat.type === 'private') {
    return bot.sendMessage(chatId, '⚠️ ពាក្យបញ្ជានេះ ប្រើបានតែក្នុង Group ប៉ុណ្ណោះ។');
  }

  if (!(await isAdmin(chatId, userId))) {
    return bot.sendMessage(chatId, '❌ តែ Admin ទេ ដែលអាចប្រើពាក្យបញ្ជានេះ។');
  }

  // Cancel auto-close timer if any
  if (openTimers[chatId]) {
    clearTimeout(openTimers[chatId]);
    delete openTimers[chatId];
  }

  try {
    await closeGroup(chatId);
    await bot.sendMessage(chatId, '🔒 Group បានបិទហើយ។ សមាជិកមិនអាចផ្ញើសារបានទេឥឡូវនេះ។');
  } catch (err) {
    console.error('Close group error:', err.message);
    bot.sendMessage(chatId, '❌ មិនអាចបិទ Group បានទេ។ សូមពិនិត្យថា bot មានសិទ្ធិ Admin។');
  }
});

// Handle polling errors gracefully
bot.on('polling_error', (err) => {
  console.error('Polling error:', err.message);
});

console.log('Bot is running...');
