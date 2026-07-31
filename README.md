# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS

## Telegram sign-in (standalone, no Lovable keys)

The Telegram OTP flow talks to `https://api.telegram.org` directly using a bot
token. `LOVABLE_API_KEY` / `TELEGRAM_API_KEY` are optional — they are only used
as a fallback transport when `TELEGRAM_BOT_TOKEN` is empty.

### 1. Configure

```sh
cp .env.example .env
```

Fill in:

| Variable | Required | Notes |
| --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | yes | from [@BotFather](https://t.me/BotFather) |
| `TELEGRAM_BOT_USERNAME` / `VITE_TELEGRAM_BOT_USERNAME` | recommended | used for `t.me/<bot>?start=…` deep links |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | yes | the OTP flow uses the admin client |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | yes | browser client |
| `TELEGRAM_WEBHOOK_SECRET` | optional | derived from the bot token when unset |

### 2. Run with Bun

```sh
bun install
bun run dev          # http://localhost:8080
```

### 3. Let the bot deliver codes locally

Telegram can only push webhooks to a public HTTPS URL, so locally run the
long-polling bridge in a second terminal. It forwards every update into your
local `/api/public/telegram/webhook` with the correct secret header:

```sh
bun run bot:poll
```

Check the connection at any time:

```sh
bun run bot:status   # GET /api/public/telegram/setup
```

### 4. Deploy / public URL

With a public HTTPS origin (deployment or a tunnel such as `ngrok http 8080`),
register the webhook instead of polling:

```sh
APP_ORIGIN=https://your-domain.example bun run bot:setup
# or: curl -X POST "http://localhost:8080/api/public/telegram/setup?origin=https://<tunnel>"
```

To go back to local polling: `curl -X POST "http://localhost:8080/api/public/telegram/setup?mode=delete"`.

### Flow

1. User enters `+998 …` on `/auth` → `requestTelegramOtp`.
2. Known number (already in `telegram_accounts`) → the 6-digit code is sent to
   their chat immediately.
3. Unknown number → the app shows a `t.me/<bot>?start=<token>` deep link; after
   the user taps **Share my phone number**, the webhook stores the account and
   sends the code automatically. The `/auth` page polls and switches to the code
   step on its own.
4. `verifyTelegramLogin` checks the hash and returns a magic-link token hash the
   browser exchanges for a Supabase session.

Missing/invalid Telegram configuration never returns a 500/503: the endpoints
answer 200 with a readable reason, and the sign-in UI surfaces it as an error.
