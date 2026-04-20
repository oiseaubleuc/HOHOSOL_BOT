# AI Dev Bot (MVP)

Laravel-first local assistant: scans the repo layout, generates an implementation plan, writes an **approval-gated** command proposal (checksum), and optionally runs a small **allowlisted** inspect suite (`php artisan route:list`, `php artisan test`, `php artisan migrate --pretend`). Node.js projects are detected for layout + `npm|pnpm|yarn test` only.

## Requirements (macOS)

- **Node.js 20+** — install with [nvm](https://github.com/nvm-sh/nvm) or the official pkg:

  ```bash
  brew install node@22
  ```

  Ensure `node -v` prints v20 or newer.

- **PHP + Composer** — only needed if you use **execute** (real Artisan). Install via Homebrew:

  ```bash
  brew install php composer
  php -v
  ```

- A **real Laravel app** for command execution (the bundled `samples/fixtures/sample-laravel` is a **stub** for scans and dry-runs only).

## Telegram notifications (optional)

The CLI emits **console** messages for every lifecycle event. When `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are set (via environment or a `.env` file in the **current working directory**), it also sends the same events to Telegram.

### Exact setup

1. In Telegram, open a chat with [@BotFather](https://t.me/BotFather), run `/newbot`, and copy the **HTTP API token** (looks like `123456:ABC...`).
2. Start a chat with your new bot (press **Start**) so the bot can message you.
3. Discover your **numeric chat id**:
   - Send any message to the bot, then open  
     `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`  
     in a browser and find `"chat":{"id": ... }` for your user, **or**
   - Use [@userinfobot](https://t.me/userinfobot) and copy your **Id** (often a positive integer; groups use negative ids).
4. In the repo root (or wherever you run `npm run start` from), copy the example env file and fill in the values:

   ```bash
   cp .env.example .env
   ```

   Edit `.env`:

   ```env
   TELEGRAM_BOT_TOKEN=paste_token_here
   TELEGRAM_CHAT_ID=paste_chat_id_here
   ```

5. Run the CLI from that directory so `dotenv` loads `.env` (the tool loads it automatically on first notifier use):

   ```bash
   npm run start -- run --task samples/tasks/laravel-invoice-pdf.json --dry-run
   ```

You should receive messages for **task started**, **approval required** (dry-run or missing checksum), **task completed** (after successful approved execution), and **task failed** (errors or non-zero command exits).

If Telegram is misconfigured, the bot **still completes** its work; failures to call the Telegram API are logged to stderr only.

To add **Slack** later, implement the same `Notifier` interface (see `src/modules/notifications/types.ts`) and append it in `createDefaultNotifier()` in `src/modules/notifications/index.ts` alongside `TelegramNotifier`.

## Local setup (macOS)

```bash
cd /path/to/dispatcher
npm install
npm run typecheck
npm test
npm run build
```

### Run in development (TypeScript)

`npm run dev` uses `node --import tsx/esm` (avoids some restricted environments where the `tsx` binary cannot open its IPC pipe).

```bash
npm run dev -- run --task samples/tasks/laravel-invoice-pdf.json --dry-run \
  --report-out reports/demo.md \
  --proposal-out proposals/demo.proposal.json
```

The CLI prints a **checksum**. To execute the proposal (runs subprocesses on your machine):

```bash
npm run start -- run --task samples/tasks/laravel-invoice-pdf.json \
  --approve-checksum PASTE_SHA256_HERE \
  --proposal-out proposals/demo.proposal.json \
  --report-out reports/demo-executed.md
```

Or execute a saved proposal file:

```bash
npm run start -- execute-proposal --proposal proposals/demo.proposal.json --approve-checksum PASTE_SHA256_HERE
```

### Global CLI (optional)

After `npm run build`:

```bash
npm link
ai-dev-bot run --task samples/tasks/laravel-invoice-pdf.json --dry-run
```

## Flags

| Flag | Meaning |
| --- | --- |
| `--dry-run` | Write plan + proposal + report; **never** runs shell commands. |
| `--approve-checksum <sha256>` | Required to run allowlisted commands; must match the proposal file. |
| `--report-out <file.md>` | Default: `reports/last-report.md` under the current working directory. |
| `--proposal-out <file.json>` | Default: `proposals/last.proposal.json`. |

## Task JSON

Place tasks anywhere; `projectRoot` is resolved relative to the task file.

See `samples/tasks/*.json`.

## Optional repo config

At the **client project root**, add `ai-dev-bot.config.json`:

```json
{
  "extraAllowedCommands": ["php|artisan|config:clear"]
}
```

Signatures use `|` between argv segments. Extra tails must look like safe flags or tokens (see `src/run/allowlist.ts`).

## Layout

- `src/cli.ts` — entrypoint
- `src/modules/notifications/` — `Notifier` abstraction, console + Telegram
- `src/detect/` — Laravel + Node detection
- `src/plan/` — Laravel-aware plans + Node fallback
- `src/run/` — proposals, allowlist, executor
- `src/report/` — Markdown report builder
- `samples/` — fixtures, tasks, example report

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | `node --import tsx/esm src/cli.ts` (pass CLI args after `--`) |
| `npm run build` | Emit `dist/` (Common tooling for CI) |
| `npm run start` | `node dist/cli.js` |
| `npm test` | Vitest unit tests |
| `npm run typecheck` | `tsc --noEmit` |
