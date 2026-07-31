import { Bot, webhookCallback } from 'grammy';
import { createClient } from '@supabase/supabase-js';

const token = process.env.TELEGRAM_BOT_TOKEN;
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!token) throw new Error('TELEGRAM_BOT_TOKEN is missing');

const bot = new Bot(token);
const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

// Обработка команды /start
bot.command('start', async (ctx) => {
  const chatId = ctx.chat.id;
  const username = ctx.from?.username || '';
  const firstName = ctx.from?.first_name || '';
  const lastName = ctx.from?.last_name || '';
  
  // Параметр из ссылки (например: t.me/bot?start=TOKEN_ИЛИ_PHONE)
  const startToken = ctx.match || null;

  // 1. Генерируем 6-значный OTP-код
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    // 2. Записываем точно в колонки таблицы telegram_login_requests
    const { error } = await supabase.from('telegram_login_requests').upsert(
      {
        chat_id: chatId,
        code_hash: otpCode, // Поле кода в вашей базе
        telegram_username: username,
        telegram_first_name: firstName,
        telegram_last_name: lastName,
        start_token: startToken,
      },
      { onConflict: 'chat_id' }
    );

    if (error) {
      console.error('Supabase error:', error);
      await ctx.reply('⚠️ Произошла ошибка базы данных. Попробуйте ещё раз.');
      return;
    }

    // 3. Отправляем код пользователю
    await ctx.reply(
      `🔑 Ваш одноразовый код для входа на сайт:\n\n` +
      `\`${otpCode}\`\n\n` +
      `_Скопируйте его и введите на странице авторизации._`,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    console.error('Webhook error:', err);
    await ctx.reply('⚠️ Не удалось сгенерировать код.');
  }
});

// Обработка обычных текстовых сообщений
bot.on('message:text', async (ctx) => {
  await ctx.reply('Чтобы получить код для входа, нажмите /start');
});

export default webhookCallback(bot, 'std/http');