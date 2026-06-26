const { TelegramBot } = require('node-telegram-bot-api');

const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN) {
  console.error('Error: BOT_TOKEN environment variable is not set. Exiting.');
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

// Listen for /start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'សួស្តី');
});

// Handle polling errors gracefully
bot.on('polling_error', (err) => {
  console.error('Polling error:', err.message);
});

console.log('Bot is running...');
