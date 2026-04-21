# Remote access on macOS (legitimate, post-login)

devBOT is **not** a lock-screen bypass and does **not** replace macOS authentication. Use these patterns **after** you are allowed to use the machine (logged in session, Screen Sharing session, or SSH session).

## iMac as worker

1. **Screen Sharing (VNC)** — System Settings → General → Sharing → Screen Sharing. Use from MacBook on the same LAN/VPN.
2. **Remote Login (SSH)** — Sharing → Remote Login. Prefer **key-based auth**, firewall rules, and a non-default port if exposed.
3. **Tailscale / ZeroTier (optional)** — mesh VPN so MacBook/iPhone reach the iMac without public port forwarding.

## Control surfaces

| Surface | Role |
| --- | --- |
| **Telegram (iPhone)** | Short commands, approvals (`/approve DEV-…`), `/status`, `/logs`, `/run` tasks. |
| **MacBook** | Full Xcode/terminal access + SSH + Screen Sharing for deep work. |
| **devBOT on iMac** | Policy-gated actions inside `WORKSPACE_PATH` only; logs + reports under workspace. |

## devBOT boundaries

- No unrestricted shell from chat.
- No execution outside `WORKSPACE_PATH`.
- Risky actions (install, git commit, kill port, …) require **explicit approval** (or `AUTO_APPROVE=true` on trusted solo machines only).

## Suggested workflow

1. Put repos under `~/devbot-workspace/projects/…`.
2. Run `npm run bot:start` or `npm run bot:bots` on the iMac (keep process supervised).
3. From iPhone: `/tasks`, `/run SHOP-901`, `/approve …`.
4. From MacBook: SSH `git pull`, edit in Cursor, merge — or drive the same `/dev …` commands via Telegram for quick ops.

This document describes **normal** macOS remote administration features only.
