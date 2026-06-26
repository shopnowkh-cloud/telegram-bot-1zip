const TelegramBot = require('node-telegram-bot-api');

// Replace with your bot token from @BotFather
const TOKEN = process.env.BOT_TOKEN;

const bot = new TelegramBot(TOKEN, { polling: true });

// Listen for /start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'សួស្តី');
});

console.log('Bot is running...');
