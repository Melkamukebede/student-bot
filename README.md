# Telegram Test Bot — Cloudflare Workers + GitHub

A minimal Telegram bot deployed as a Cloudflare Worker, with GitHub Actions
handling auto-deploy on every push. Commands included: `/start`, `/help`,
`/echo`, `/time`, plus a plain-text echo fallback.

## What's in this repo

```
telegram-test-bot/
├── src/index.js              Worker code (the bot logic)
├── wrangler.toml              Cloudflare Worker config
├── package.json                Dependencies (grammy, wrangler)
├── .github/workflows/deploy.yml   Auto-deploy on push to main
└── .gitignore
```

## Step 1 — Create the bot on Telegram

1. Open Telegram, message **@BotFather**.
2. Send `/newbot`, give it a name and a username (must end in `bot`).
3. BotFather gives you a token like `123456789:AAExxxxxxxxxxxxxxxxxxxxx`.
   Save this — you'll need it twice.

## Step 2 — Create a Cloudflare account + get credentials

1. Sign up at https://dash.cloudflare.com if you don't have an account.
2. Go to **Workers & Pages** in the dashboard, note your **Account ID**
   (shown on the right side of the Workers overview page).
3. Create an API token: **My Profile → API Tokens → Create Token** →
   use the "Edit Cloudflare Workers" template. Save the token.

## Step 3 — Put the code on GitHub

1. Create a new repo on GitHub (e.g. `telegram-test-bot`).
2. Push these files to it:
   ```bash
   cd telegram-test-bot
   git init
   git add .
   git commit -m "Initial bot setup"
   git branch -M main
   git remote add origin https://github.com/<your-username>/telegram-test-bot.git
   git push -u origin main
   ```

## Step 4 — Add GitHub Secrets

In your GitHub repo: **Settings → Secrets and variables → Actions → New repository secret**

Add these two:
| Secret name | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | the token from Step 2 |
| `CLOUDFLARE_ACCOUNT_ID` | your Cloudflare account ID |

This lets GitHub Actions deploy on your behalf whenever you push.

## Step 5 — Set the bot token as a Cloudflare secret

The bot token should NOT live in GitHub or in the repo — it's a runtime
secret for the Worker itself. Set it once via the Cloudflare dashboard
or locally with Wrangler:

```bash
npm install
npx wrangler login
npx wrangler secret put TELEGRAM_BOT_TOKEN
# paste your BotFather token when prompted
```

(You only need to do this once per environment — it persists on Cloudflare's side.)

## Step 6 — First deploy

Either push to `main` (GitHub Actions deploys automatically), or deploy manually:

```bash
npx wrangler deploy
```

This prints your live Worker URL, something like:
`https://telegram-test-bot.<your-subdomain>.workers.dev`

## Step 7 — Point Telegram at your Worker (set the webhook)

Telegram needs to know where to send updates. Run this once
(replace `<TOKEN>` and `<WORKER_URL>`):

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=<WORKER_URL>"
```

Example:
```bash
curl "https://api.telegram.org/bot123456789:AAExxxx/setWebhook?url=https://telegram-test-bot.yourname.workers.dev"
```

A response with `"ok":true` confirms it worked.

## Step 8 — Test it

Open Telegram, find your bot by its username, and send `/start`.
You should get a reply instantly. Try `/echo hello`, `/time`, or just
type any text.

## Ongoing workflow

From here on: edit `src/index.js` → commit → push to `main` →
GitHub Actions redeploys automatically. No need to touch the webhook
again unless the Worker URL changes.

## Useful checks

- **Confirm webhook is set:**
  `https://api.telegram.org/bot<TOKEN>/getWebhookInfo`
- **View live logs:** `npx wrangler tail`
- **Local dev (polling not supported on Workers, but you can test the fetch handler):**
  `npx wrangler dev`

## Where to go from here

- Add persistent storage: Workers KV for settings, D1 for structured
  data, or R2 if the bot needs to handle file uploads.
- Add a Cron Trigger in `wrangler.toml` for scheduled messages.
- Swap the plain-text fallback for an AI-powered reply using
  Workers AI, if you want a smarter bot.
