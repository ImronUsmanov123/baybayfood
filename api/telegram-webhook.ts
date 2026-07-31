import { Bot } from 'grammy';
import { createClient } from '@supabase/supabase-js';

const token = process.env.TELEGRAM_BOT_TOKEN;
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!token) throw new Error('TELEGRAM_BOT_TOKEN is missing');

const bot = new Bot(token);
const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

// 1. Команда /start
bot.command('start', async (ctx) => {
  const chatId = ctx.chat.id;
  const username = ctx.from?.username || '';
  const firstName = ctx.from?.first_name || '';
  const lastName = ctx.from?.last_name || '';

  // Генерируем уникальное значение для полей с UNIQUE-ограничениями в БД, если данные отсутствуют
  const startToken = ctx.match || `none_${chatId}`;
  const phoneValue = `none_${chatId}`;

  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    const { error } = await supabase.from('telegram_login_requests').upsert(
      {
        chat_id: chatId,
        code_hash: otpCode,
        telegram_username: username,
        telegram_first_name: firstName,
        telegram_last_name: lastName,
        start_token: startToken,
        phone: phoneValue,
      },
      { onConflict: 'chat_id' }
    );

    if (error) {
      console.error('Supabase DB Error:', error);
      await ctx.reply('⚠️ Ошибка базы данных: ' + error.message);
      return;
    }

    await ctx.reply(
      `🔑 Ваш одноразовый код для входа на сайт:\n\n` +
      `\`${otpCode}\`\n\n` +
      `_Скопируйте его и введите на странице авторизации._`,
      { parse_mode: 'Markdown' }
    );
  } catch (err: any) {
    console.error('Execution Error:', err);
    await ctx.reply('⚠️ Произошла ошибка: ' + err.message);
  }
});

// 2. Текстовые сообщения
bot.on('message:text', async (ctx) => {
  await ctx.reply('Чтобы получить код для входа, нажмите /start');
});

// 3. Vercel Handler с инициализацией бота
export default async function handler(req: any, res: any) {
  if (req.method === 'POST') {
    try {
      if (!bot.isInited()) {
        await bot.init();
      }

      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      await bot.handleUpdate(body);

      return res.status(200).json({ ok: true });
    } catch (err: any) {
      console.error('Bot Error:', err);
      return res.status(200).json({ ok: false, error: err.message });
    }
  }
  return res.status(200).send('Telegram Webhook Active');
}