<h1 align="center">MR Muavia MD BOT</h1>

<p align="center">
  <img src="public/logo.jpg" alt="MR Muavia MD BOT logo" />
</p>

<p align="center">
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&style=for-the-badge" alt="Node.js 20 or newer" /></a>
  <a href="https://github.com/WhiskeySockets/Baileys"><img src="https://img.shields.io/badge/WhatsApp-Baileys-25D366?logo=whatsapp&style=for-the-badge" alt="WhatsApp via Baileys" /></a>
</p>

<p align="center">A multi-session WhatsApp bot with a browser-based pairing dashboard, optional Telegram pairing-code delivery and modular chat commands.</p>

## About

MR Muavia MD BOT connects WhatsApp sessions through [Baileys](https://github.com/WhiskeySockets/Baileys). It includes a web interface for pairing and session status, plus commands for group administration, protections, media, utilities, AI and Islamic features.

The server runs with Node.js and can use local files for session state or PostgreSQL for WhatsApp authentication state. `render.yaml` provides a Render service configuration.

## Features

- Pair WhatsApp numbers through the web dashboard; optionally deliver pairing codes through Telegram.
- Run multiple WhatsApp sessions in one Node.js process.
- Use group-management commands, including participant and group settings tools.
- Enable per-session settings for features such as anti-link, anti-delete, auto-reply and custom command prefixes.
- Use utility, media-download, AI and Islamic command modules.
- View pairing and session status through the browser dashboard and its status endpoints.

## Requirements

- Node.js 20 or newer, as specified in `package.json`.
- npm.
- A WhatsApp account to link.

## Quick Start

From the repository directory:

```bash
npm install
cp .env.example .env
npm start
```

Open `http://localhost:3000` in a browser. The default port is `3000`; set `PORT` in `.env` to use another port.

1. Enter the WhatsApp number to link, including the country code and without a `+` sign.
2. Request a pairing code in the dashboard.
3. On that WhatsApp account, open **Settings → Linked Devices → Link with phone number** and enter the code.

The dashboard is also served at `/connect` and `/dashboard`.

### Optional Telegram Pairing

Set `TELEGRAM_BOT_TOKEN` in `.env` to enable pairing-code delivery through a Telegram bot. Start a chat with that bot, send `/start`, then send the WhatsApp number to pair. Without the token, dashboard pairing remains available.

## Configuration

Copy `.env.example` to `.env`. It documents the available settings and their defaults. Common settings:

| Variable                                                                            | Purpose                                                                                                                                                                  |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `BOT_NAME`, `OWNER_NAME`, `OWNER_NUMBER`, `OWNER_DISPLAY_NUMBER`, `WELCOME_MESSAGE` | Bot and owner details used by the bot.                                                                                                                                   |
| `LOGO_URL`, `CHANNEL_URL`                                                           | Branding image and WhatsApp Channel invite URL.                                                                                                                          |
| `PORT`                                                                              | HTTP server port; defaults to `3000`.                                                                                                                                    |
| `APP_URL`                                                                           | URL used by the periodic self-ping; defaults to the local server URL.                                                                                                    |
| `TELEGRAM_BOT_TOKEN`                                                                | Optional Telegram pairing-code delivery.                                                                                                                                 |
| `OPENAI_API_KEY`, `AI_BASE_URL`                                                     | Optional OpenAI-compatible AI configuration.                                                                                                                             |
| `TENOR_API_KEY`                                                                     | Required to use `.emojimix`.                                                                                                                                             |
| `DATABASE_URL`                                                                      | Optional PostgreSQL connection string for persistent WhatsApp auth state and dashboard tokens. Not listed in `.env.example`; set it directly in your host's environment. |

Other optional integrations and defaults are listed in `.env.example`, including movie, YouTube, Giphy and downloader settings.

## Commands

Commands use `.` by default. The owner can change the prefix for a WhatsApp session with `.setprefix <character>`. Use `.menu` in WhatsApp for the command menu; it reflects the available sections and omits restricted entries when the requester lacks the required permissions.

Examples from the command modules:

| Area                    | Example commands                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------- |
| General and utility     | `.menu`, `.ping`, `.calc`, `.wiki`, `.define`, `.qr`, `.translate`                 |
| Group management        | `.groupinfo`, `.kick`, `.promote`, `.demote`, `.tagall`, `.setname`                |
| Protection and settings | `.antilink`, `.antidelete`, `.anticall`, `.autoreply`, `.autoreacts`, `.setprefix` |
| Media and downloads     | `.song`, `.video`, `.tiktok`, `.facebook`, `.insta`, `.gdrive`                     |
| AI and other features   | `.ai`, `.aichat`, `.aiimage`, `.islamic`, `.channelstatus`                         |

Available commands and exact argument formats are defined by the modules in [`commands/`](commands/).

## Dashboard and Endpoints

| Path                          | Purpose                                          |
| ----------------------------- | ------------------------------------------------ |
| `/`, `/connect`, `/dashboard` | Serve the browser dashboard.                     |
| `/api/health`                 | Process liveness and uptime.                     |
| `/api/status`                 | Aggregate session counts and runtime status.     |
| `/api/config`                 | Public branding configuration for the dashboard. |

The dashboard uses Socket.IO for pairing and live session updates.

## Data and Deployment

- Without `DATABASE_URL`, Baileys authentication state is stored under `auth_info/<session>/`.
- With `DATABASE_URL`, WhatsApp authentication state and dashboard ownership tokens are stored in PostgreSQL. The auth module creates its tables when needed.
- Bot settings are written to `data/bot_data.json`; this data is not moved into PostgreSQL by `DATABASE_URL`.
- The anti-delete message buffer is held in memory and is cleared when the process stops.

The included [`render.yaml`](render.yaml) configures a Render web service and expects `DATABASE_URL`, `OWNER_NUMBER`, `OWNER_DISPLAY_NUMBER`, `APP_URL` and `COBALT_INSTANCES` to be configured in the host. On an ephemeral filesystem, local files such as `data/bot_data.json` do not provide durable settings storage; the PostgreSQL adapter in this project is for auth state and dashboard tokens.

Other included process configurations:

- `Procfile` starts the app with `node index.js`.
- `ecosystem.config.js` provides a PM2 app definition.

## Project Structure

| Path                         | Purpose                                                                    |
| ---------------------------- | -------------------------------------------------------------------------- |
| [`index.js`](index.js)       | Express server, dashboard routes, WhatsApp sessions and command dispatch. |
| [`commands/`](commands/)     | WhatsApp command modules.                                                  |
| [`lib/`](lib/)               | Authentication storage and shared helpers.                                 |
| [`public/`](public/)         | Static public assets, including the bot logo.                              |
| [`settings.js`](settings.js) | Environment-backed branding defaults.                                      |
| [`index.html`](index.html)   | Browser dashboard interface.                                               |

## Privacy and Responsible Use

Use the bot only with accounts and groups where you have permission. Follow WhatsApp's terms and applicable privacy laws. Keep `.env`, Telegram tokens, database credentials and local session files private. The dashboard supports session-specific ownership tokens; do not expose deployment secrets or session data.

## Troubleshooting

- **The app does not start:** confirm Node.js 20 or newer is installed, then run `npm install` and `npm start` from the project directory.
- **Telegram pairing is unavailable:** set `TELEGRAM_BOT_TOKEN`; pairing through the web dashboard does not require it.
- **`.emojimix` reports it is not configured:** set `TENOR_API_KEY` in `.env`.
- **A linked session is not restored:** check that its local `auth_info/` directory is retained or that `DATABASE_URL` points to a reachable PostgreSQL database when using database-backed auth.
