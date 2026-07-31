import { Bot, webhookCallback } from 'grammy';
import { createClient } from '@supabase/supabase-js';

const token = process.env.TELEGRAM_BOT_TOKEN;
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!token) throw new Error('TELEGRAM_BOT_TOKEN is missing');

const bot = new Bot(token);
const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

// Код обработки команд /start и генерации OTP
bot.command('start', async (ctx) => {
  // Ваша логика сгенерировать код и отправить пользователю
  await ctx.reply('Ваш код для входа: ...');
});

export default webhookCallback(bot, 'std/http');