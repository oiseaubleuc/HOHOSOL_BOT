# devBOT

Production-oriented **remote AI developer assistant** for your Mac (iMac worker + MacBook/Telegram control). All bot-owned files, tasks, clones, **logs**, and **reports** live under a single **workspace directory** (default `~/devbot-workspace`). Shell execution is **allowlisted** and **cwd-checked** so commands cannot run outside that workspace.

## Quick start (macOS)

```bash
cd /path/to/dispatcher
cp .env.example .env
# Edit .env — set at least WORKSPACE_PATH (optional), TELEGRAM_* or WHATSAPP_* if you use chat control.

npm install
npm run typecheck
npm test
npm run build
```

### Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev -- …` | Run CLI via TypeScript (`node --import tsx/esm`) |
| `npm run build` | Emit `dist/` |
| `npm run start -- …` | `node dist/cli.js …` |
| `npm run bot:start` | Telegram long-poll listener |
| `npm run bot:whatsapp` | WhatsApp listener (`whatsapp-web.js`) |
| `npm run bot:run -- <taskId>` | Dry-run a task JSON from `WORKSPACE_PATH/tasks/<id>.json` |
| `npm test` | Vitest |

### CLI

```text
devBOT run --task <path/to/task.json> [--dry-run] [--approve-checksum <sha256>]
devBOT run-id <taskId>
devBOT execute-proposal --proposal <file> --approve-checksum <sha256>
devBOT telegram
devBOT whatsapp
```

## Workspace (`WORKSPACE_PATH`)

- Default: **`~/devbot-workspace`** (override with `WORKSPACE_PATH` in `.env`).
- Layout: `tasks/`, `projects/`, `logs/`, `reports/`, `proposals/`, `.devbot/` (state + task memory).
- On first boot from the repo checkout, sample tasks + fixtures are **seeded** into the workspace so paths stay **inside** the workspace.
- **Invariant:** `run` / `execute-proposal` / Telegram pipelines resolve `projectRoot`, `cwd` for shell steps, and output paths through `WorkspaceManager.assertPathInWorkspace`.

## Telegram

Requires `TELEGRAM_BOT_TOKEN`. If `TELEGRAM_CHAT_ID` is empty, the listener runs in **bootstrap mode**: it replies with your chat id and keeps **commands disabled** until you set `TELEGRAM_CHAT_ID` and restart. After that, only that chat is accepted.

```bash
npm run bot:start
```

### Commands

| Command | Behaviour |
| --- | --- |
| `/start` | `devBOT ready 🚀` |
| `/tasks` | Lists tasks in `workspace/tasks` |
| `/run <taskId>` | Starts **agent pipeline** (approvals + logs + agent report) |
| `/approve <taskId>` | Approves the **next** queued gate for that task (or `create:<name>` for `/create`) |
| `/reject <taskId>` | Rejects pending approvals + kill runner |
| `/status` | Last action + active pipeline phases |
| `/logs <taskId>` | Tail of `logs/<taskId>.log` |
| `/report <taskId>` | Latest `reports/<taskId>-agent.md` |
| `/kill <taskId>` | AbortController + reject approvals |
| `/workspace` | Lists `projects/` |
| `/health` | Hostname, memory, uptime, workspace path |
| `/create <name> <type>` | Scaffold under `projects/` (`node-api`, `nextjs`, `laravel`, `saas-template`) — requires `/approve create:<name>` first |

### Agent pipeline (Telegram `/run`)

1. Wait approval → dry-run (`proposal` + `reports/*-dry-run.md`).
2. Wait approval → execute allowlisted inspect commands (unless `DRY_RUN=true`).
3. On failure, optional **OpenAI** coaching (`OPENAI_API_KEY`) + memory + **`reports/<id>-agent.md`**.

Set `AUTO_APPROVE=true` only on trusted machines to skip Telegram gates.

## WhatsApp

Requires `WHATSAPP_ALLOWED_CHAT` (full jid, for example `31612345678@c.us`).

```bash
npm run bot:whatsapp
```

On first start you get a QR in terminal. Scan it once with WhatsApp linked devices.

### Commands

WhatsApp reuses the same command set as Telegram (`/start`, `/tasks`, `/run`, `/approve`, etc.).

## Security

- **Path sandbox:** anything the executor runs must have `cwd` under `WORKSPACE_PATH`.
- **Argv denylist:** blocks patterns like `sudo`, `rm -rf /`, etc. (`src/security/dangerousArgv.ts`), in addition to Laravel/Node allowlists.
- **GitHub:** use a fine-scoped PAT; never commit `.env`.

## GitHub automation (optional)

Env: `GITHUB_TOKEN`, `GITHUB_REPO` (`owner/repo`). Helpers live in `src/integrations/github/githubOps.ts` (branch `bot/<task>/<slug>`, commit message `[devBOT] <title>`, push, optional PR). Wire this into your own flow when you clone into `workspace/projects/…`.

## Environment variables

See **`.env.example`** for:

- `WORKSPACE_PATH`, `DRY_RUN`, `AUTO_APPROVE`
- `OPENAI_API_KEY`
- `TELEGRAM_*`, `WHATSAPP_*`, `GITHUB_*`

## Layout (src)

- `src/workspace/` — root path, bootstrap, init singleton
- `src/execution/` — agent pipeline + approvals integration
- `src/approvals/` — `ApprovalBus` (FIFO gates)
- `src/state/` — in-memory running task registry
- `src/integrations/github/` — git + PR helpers
- `src/logging/`, `src/reports/`, `src/memory/`, `src/ai/`
- `src/modules/telegram/` — polling + command dispatch
- `src/modules/whatsapp/` — WhatsApp listener (reuses command dispatch)
- `src/projects/` — `/create` scaffolds
- `src/services/taskRunWorkflow.ts` — shared Laravel/Node inspect flow

## Notes

- **Web dashboard** is not included; the Telegram + CLI surface is designed so you can add HTTP later.
- **Full code generation** is stubbed via reports + optional OpenAI coaching; plug your model or Cursor-style worker where `runTaskWorkflow` ends.
- `npm run bot:run -- <taskId>` currently performs a **workspace dry-run** for that id; use `run` with `--approve-checksum` for execute, or Telegram `/run` + `/approve`.
# HOHOSOL_BOT
