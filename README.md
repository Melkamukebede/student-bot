# Student Registration Telegram Bot

A Telegram bot built with grammy.js and deployed on Cloudflare Workers.

## Features

- 📝 Collect student information (Name, University, Semester)
- 🎯 Interactive buttons for easy selection
- 💾 Session management for returning users
- ☁️ Serverless deployment on Cloudflare Workers

## Setup

1. Copy `.dev.vars.example` to `.dev.vars` and add your Telegram token
2. Run `npm install`
3. Run `npm run dev` for local development
4. Deploy with `npm run deploy`

## Environment Variables

- `BOT_TOKEN`: Your Telegram bot token from @BotFather
- `BOT_INFO`: Bot metadata (id, username, etc.)

## Deployment

This bot is automatically deployed via Cloudflare Workers connected to GitHub.
