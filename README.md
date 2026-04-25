# devBOT

Production-oriented **remote AI developer assistant** for your Mac (iMac worker + MacBook/Telegram control). All bot-owned files, tasks, clones, **logs**, and **reports** live under a single **workspace directory** (default `~/devbot-workspace`). Shell execution is **allowlisted** and **cwd-checked** so commands cannot run outside that workspace.

## Control platform architecture

Three intended layers:

1. **iMac (worker)** — runs devBOT, holds `WORKSPACE_PATH`, executes **policy-approved** actions, writes logs/reports.
2. **MacBook (full control)** — Screen Sharing + SSH + local IDEs; use for deep edits and reviews (see `docs/REMOTE_ACCESS.md`).
3. **iPhone / Telegram (quick control)** — structured slash commands, approvals, monitoring; **no raw shell strings** from chat.

Core subsystems:

| Path | Responsibility |
| --- | --- |
| `src/modules/developer-control/` | Action model, policy gate, DEV approval queue, Telegram bridge, adapters (IDE/browser/git/dev). |
| `src/modules/system/` | Workspace path guard, URL sanitization for Brave, `spawn(..., { shell:false })` runner with cwd checks. |
| `src/modules/mac-assistant/` | Thin macOS launch helpers built on the same validated paths. |
| `src/modules/telegram/` | Parsing + routing + legacy task pipeline integration. |
| `src/execution/` + `src/approvals/` | Agent pipeline + FIFO gates for `/run` task workflows. |

**Non-goals (by design):** lock-screen bypass, unrestricted remote shell, execution outside `WORKSPACE_PATH`.

## Quick start (macOS)

```bash
cd /path/to/dispatcher
cp .env.example .env
# Edit .env — set at least WORKSPACE_PATH (optional), TELEGRAM_* or WHATSAPP_* if you use chat control.
# If DRY_RUN is unset, it defaults to true (safe). Set DRY_RUN=false on trusted workers only.

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
| `npm run bot:bots` | Telegram + WhatsApp in one process (each channel skipped if env missing) |
| `npm run bot:resident` | Resident mode + heartbeat log (launch-at-login friendly) |
| `npm run doctor` | Health check: Node, `.env`, workspace tasks, bot env |
| `npm run init-templates -- --target <dir>` | Copy per-project template files into an app repo |
| `npm run bot:run -- <taskId>` | Dry-run a task JSON from `WORKSPACE_PATH/tasks/<id>.json` |
| `npm test` | Vitest |

### CLI

```text
devBOT run --task <path/to/task.json> [--dry-run] [--approve-checksum <sha256>]
devBOT run-id <taskId>
devBOT execute-proposal --proposal <file> --approve-checksum <sha256>
devBOT telegram
devBOT whatsapp
devBOT bots
devBOT resident
devBOT doctor
devBOT init-templates [--target <dir>] [--force]
```

For a **repeatable checklist** on every client project, see `docs/PROJECT_PLAYBOOK.md`.

For **Screen Sharing / SSH / VPN** guidance, see `docs/REMOTE_ACCESS.md`.

## Workspace (`WORKSPACE_PATH`)

- Default: **`~/devbot-workspace`** (override with `WORKSPACE_PATH` in `.env`).
- Layout: `tasks/`, `projects/`, `logs/`, `reports/`, `proposals/`, `.devbot/` (state + task memory).
- On first boot from the repo checkout, sample tasks + fixtures are **seeded** into the workspace so paths stay **inside** the workspace.
- **Invariant:** `run` / `execute-proposal` / Telegram pipelines resolve `projectRoot`, `cwd` for shell steps, and output paths through `WorkspaceManager.assertPathInWorkspace`.

## Telegram

Requires `TELEGRAM_BOT_TOKEN`. If `TELEGRAM_CHAT_ID` is empty or `0`, the listener runs in **bootstrap mode**: it replies with your chat id and keeps **commands disabled** until you set a real `TELEGRAM_CHAT_ID` and restart. After that, only that chat is accepted. Wrong chat id now gets a Telegram error message (not silent).

```bash
npm run bot:start
```

### Commands

| Command | Behaviour |
| --- | --- |
| `/start` | `devBOT ready 🚀` |
| `/help` | Short command cheat-sheet |
| `/tasks` | Lists tasks in `workspace/tasks` |
| `/run <taskId>` | Starts **agent pipeline** (approvals + logs + agent report) |
| `/approve <taskId>` | Approves the **next** queued gate for that task (or `create:<name>` for `/create`, or `DEV-…` developer action) |
| `/reject <taskId>` | Rejects pending approvals + kill runner (or `DEV-…` developer action) |
| `/status` | Last action + active pipeline phases |
| `/logs <taskId>` | Tail of `logs/<taskId>.log` |
| `/report <taskId>` | Latest `reports/<taskId>-agent.md` |
| `/kill <taskId>` | AbortController + reject approvals |
| `/workspace` | Lists `projects/` |
| `/health` | Hostname, memory, uptime, workspace path |
| `/create <name> <type>` | Scaffold under `projects/` (`node-api`, `nextjs`, `laravel`, `saas-template`) — requires `/approve create:<name>` first |
| `/open cursor|vscode|terminal|finder|brave|safari` | macOS `open` for IDE/Finder/browser (optional project folder name) |
| `/open settings|activity|mail|music|…` | Built-in Apple apps by **bundle path** (locale-safe); list in `src/modules/developer-control/adapters/macBundles.ts` |
| `/open localhost <port>` / `/open youtube` / `/open github` | Brave opens sanitized localhost / presets |
| `/browser open …` | `youtube`, `github`, `localhost <port>`, `url <https://…>` (host allowlist + localhost) |
| `/projects` | Lists `projects/` |
| `/open-project <name>` | Sets active project + reveals Finder |
| `/pwd` | Prints workspace root |
| `/tree <project>` / `/files <project>` | Shallow tree / top-level listing (workspace only) |
| `/dev …` | Structured developer ops (`inspect`, `install`, `build`, `test`, `lint`, `git …`, `file …`, `artisan …`) |
| `/ask <instruction>` | Natural language request mapped to one safe structured command (clarifies if ambiguous) |
| `/ports` / `/processes` | Snapshot listeners / processes (read-only argv) |
| `/kill-port <port>` | **Requires approval** (`/approve DEV-…`) — SIGTERM listeners on that TCP port |
| `/system create-folder <name>` | Creates `~/Desktop/<name>` (sanitized; no `..`); logs under workspace `logs/system-create-folder.log`. Exists → `Folder already exists ⚠️`; created → `Folder <name> created on Desktop ✅` |
| `/system create-folder-in-desktop <name>` | Creates under `~/Desktop/<name>` (approval-aware) |
| `/system create-folder-in-future-projects <name>` | Creates under allowlisted `~/Desktop/future-projects` or `~/Desktop/Future Project` |

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

## Mac control scope (important)

devBOT is **not** a unconstrained “remote admin” of macOS (no arbitrary shell, no `sudo`, no writing outside policy). That keeps your Telegram token from becoming full machine access if it leaks.

What you *do* get for day-to-day **iMac remote dev**:

- **Workspace** (`WORKSPACE_PATH`): tasks, clones, logs, reports, allowlisted dev commands.
- **`/open`**: Cursor, VS Code, Terminal, Finder, Brave/Safari, plus **built-in Apple apps** by bundle path (e.g. `/open settings`, `/open activity`, `/open mail`, `/open xcode` — see `src/modules/developer-control/adapters/macBundles.ts`).
- **Browser sandbox**: `/browser open …` with URL rules.
- **Desktop folders**: `/system create-folder …` (with approvals as configured).
- **Telegram/WhatsApp**: same command set; **`npm run bot:resident`** for always-on on the iMac.

**Pour aller plus loin (hors bot, volontairement)** : **Partage d’écran** ou **SSH** depuis le MacBook, **Raccourcis macOS** pour une action OS ponctuelle, **Tailscale** pour le réseau — voir `docs/REMOTE_ACCESS.md`.

To extend safely in-repo: add projects under `workspace/projects/`, vetted `extraAllowedCommands`, keep `DRY_RUN=true` until stable.

## Security

- **Path sandbox:** anything the executor runs must have `cwd` under `WORKSPACE_PATH`.
- **Argv denylist:** blocks patterns like `sudo`, `rm -rf /`, etc. (`src/security/dangerousArgv.ts`), in addition to Laravel/Node allowlists.
- **GitHub:** use a fine-scoped PAT; never commit `.env`.

## GitHub automation (optional)

Env: `GITHUB_TOKEN`, `GITHUB_REPO` (`owner/repo`). Helpers live in `src/integrations/github/githubOps.ts` (branch `bot/<task>/<slug>`, commit message `[devBOT] <title>`, push, optional PR). Wire this into your own flow when you clone into `workspace/projects/…`.

## Environment variables

See **`.env.example`** for:

- `WORKSPACE_PATH`, `DRY_RUN`, `AUTO_APPROVE`, `ASSISTANT_NAME`, `ASSISTANT_GREETING`, `DESKTOP_ALLOWED_PATHS`
- `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`, `OPENROUTER_MODEL` (optional / future)
- `TELEGRAM_*`, `WHATSAPP_*`, `GITHUB_*`

## Resident mode (launch at login)

Run foreground resident mode:

```bash
npm run bot:resident
```

This writes heartbeat lines to `WORKSPACE_PATH/logs/resident-heartbeat.log`.

For login startup on macOS (post-login, no bypass), create a LaunchAgent plist that runs:

```text
node --import tsx/esm /absolute/path/to/dispatcher/src/cli.ts resident
```

Keep this strictly as a normal user LaunchAgent; do not attempt lock-screen bypass automation.

## Layout (src)

- `src/workspace/` — root path, bootstrap, init singleton
- `src/execution/` — agent pipeline + approvals integration
- `src/approvals/` — `ApprovalBus` (FIFO gates)
- `src/state/` — in-memory running task registry
- `src/integrations/github/` — git + PR helpers
- `src/logging/`, `src/reports/`, `src/memory/`, `src/ai/`
- `src/modules/telegram/` — polling + command dispatch
- `src/modules/whatsapp/` — WhatsApp listener (reuses command dispatch)
- `src/modules/developer-control/` — policy + adapters + Telegram bridge
- `src/modules/system/` — path guard + safe runner + URL sanitization
- `src/modules/mac-assistant/` — macOS launch helpers
- `src/commands/` — `doctor`, `init-templates`, `startBots` (`bots`)
- `src/projects/` — `/create` scaffolds
- `src/services/taskRunWorkflow.ts` — shared Laravel/Node inspect flow

## Notes

- **Web dashboard** is not included; the Telegram + CLI surface is designed so you can add HTTP later.
- **Full code generation** is stubbed via reports + optional OpenAI coaching; plug your model or Cursor-style worker where `runTaskWorkflow` ends.
- `npm run bot:run -- <taskId>` currently performs a **workspace dry-run** for that id; use `run` with `--approve-checksum` for execute, or Telegram `/run` + `/approve`.

---

## HOHOBOT Local-First Starter Add-on

# HOHOBOT (OpenJarvis-style starter)

This repository now includes a local-first AI assistant foundation inspired by OpenJarvis, with free/open-source observability via Opik.

## What is implemented

- Local-first engine abstraction with `OllamaEngine`
- Two agent modes:
  - `simple` (single-turn LLM call)
  - `orchestrator` (basic tool routing with `calc:` and `search:` prefixes)
- Tool layer:
  - calculator
  - web search URL helper
- API server:
  - `GET /health`
  - `POST /v1/chat/completions` (OpenAI-style shape)
- CLI:
  - `hobot ask "..." --agent orchestrator`
  - `hobot serve --port 8000`
  - `hobot doctor`
- Opik integration hooks for request tracing

## Quick start

```bash
cd /Users/HOHOSOLUTIONS/Documents/HOHOBOT
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip setuptools wheel
pip install -e .
```

Start Ollama and pull a model:

```bash
# macOS
brew install ollama

# start server (keep this terminal open)
ollama serve

# in a second terminal
ollama pull qwen3:0.6b
```

Ask a question:

```bash
hobot ask "What is the capital of France?"
hobot ask "calc: 12 * 11"
hobot ask "search: local-first ai frameworks"
```

Run API:

```bash
hobot serve --port 8000
curl http://localhost:8000/health
```

## Enable Opik (free/open-source)

Install is already included in dependencies. Enable local self-host mode:

```bash
export HOHOBOT_OPIK_ENABLED=true
export HOHOBOT_OPIK_LOCAL=true
```

Then run:

```bash
hobot ask "Hello with trace"
```

For self-host Opik stack, use their `opik.sh` deployment from the Opik repository and keep `HOHOBOT_OPIK_LOCAL=true`.

## Next recommended upgrades

- Real multi-step tool-calling loop with structured tool schemas
- Memory/RAG index (`sqlite` first, then `faiss`)
- Prompt + model eval harness with Opik experiments
- Scheduled agents (digest/monitor style)
- Frontend chat client
