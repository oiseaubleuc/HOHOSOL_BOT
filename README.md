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
- `src/detect/` — Laravel + Node detection
- `src/plan/` — Laravel-aware plans + Node fallback
- `src/run/` — proposals, allowlist, executor
- `src/report/` — Markdown report builder
- `samples/` — fixtures, tasks, example report

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | `tsx src/cli.ts` (pass CLI args after `--`) |
| `npm run build` | Emit `dist/` (Common tooling for CI) |
| `npm run start` | `node dist/cli.js` |
| `npm test` | Vitest unit tests |
| `npm run typecheck` | `tsc --noEmit` |
