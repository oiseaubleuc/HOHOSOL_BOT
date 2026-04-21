# devBOT control platform — sample report

- **Timestamp:** 2026-04-21T00:00:00Z
- **Workspace:** `~/devbot-workspace`
- **Outcome:** Architecture upgrade applied (developer-control + system layers).

## Summary

Remote control is **action-based**: Telegram (and WhatsApp) dispatch to `developer-control` with policy checks, optional `DEV-*` approvals, and workspace-scoped execution via `modules/system`.

## Next steps

1. Keep `DRY_RUN=true` until flows are trusted.
2. Expand `ai-dev-bot.config.json` allowlists per repo as needed.
3. Use `docs/REMOTE_ACCESS.md` for MacBook ↔ iMac connectivity.
