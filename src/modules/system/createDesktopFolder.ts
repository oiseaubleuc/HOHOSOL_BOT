import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { pathExists } from "../../fs/async.js";
import type { WorkspaceManager } from "../../workspace/workspaceManager.js";

const SAFE_SEGMENT = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;

/**
 * Normalizes user input: trim, collapse whitespace to single underscores, strip disallowed chars.
 */
export function sanitizeDesktopFolderName(raw: string): string {
  if (raw.includes("/") || raw.includes("\\")) {
    throw new Error("Invalid folder name: slashes are not allowed.");
  }
  if (raw.includes("..")) {
    throw new Error("Invalid folder name: path traversal is not allowed.");
  }
  const collapsed = raw
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]+/g, "")
    .replace(/^[._-]+/, "");
  if (!collapsed) {
    throw new Error("Folder name is empty or invalid after sanitization.");
  }
  if (!SAFE_SEGMENT.test(collapsed)) {
    throw new Error("Folder name must be 1–128 chars: letters, digits, `.`, `_`, `-` only.");
  }
  if (collapsed.includes("..")) {
    throw new Error("Folder name cannot contain `..`.");
  }
  return collapsed;
}

function desktopRoot(): string {
  return path.resolve(os.homedir(), "Desktop");
}

/**
 * Resolves `~/Desktop/<folderName>` and ensures the result stays under the Desktop directory.
 */
export function resolveDesktopFolderPath(folderName: string): string {
  const desktop = desktopRoot();
  const target = path.resolve(desktop, folderName);
  const rel = path.relative(desktop, target);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("Refusing path outside ~/Desktop.");
  }
  return target;
}

export function resolveFolderInsideBase(baseDir: string, folderName: string): string {
  const base = path.resolve(baseDir);
  const target = path.resolve(base, folderName);
  const rel = path.relative(base, target);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("Refusing path outside approved base directory.");
  }
  return target;
}

const SYSTEM_LOG = "system-create-folder.log";

async function appendSystemLog(ws: WorkspaceManager, line: string): Promise<void> {
  await ws.ensureLayout();
  const p = path.join(ws.logsDir(), SYSTEM_LOG);
  await fs.appendFile(p, line, "utf8");
}

export type CreateDesktopFolderResult =
  | { ok: true; status: "created"; target: string; message: string }
  | { ok: true; status: "exists"; target: string; message: string }
  | { ok: false; message: string; target?: string };

/**
 * Creates a single folder on the macOS user Desktop (English `Desktop` under home).
 * Logs every attempt under workspace `logs/system-create-folder.log`.
 */
export async function createDesktopFolder(ws: WorkspaceManager, rawFolderName: string): Promise<CreateDesktopFolderResult> {
  return createFolderInApprovedBase(ws, desktopRoot(), rawFolderName, "create-folder");
}

export async function createDesktopFolderInBase(
  ws: WorkspaceManager,
  baseDir: string,
  rawFolderName: string,
): Promise<CreateDesktopFolderResult> {
  return createFolderInApprovedBase(ws, baseDir, rawFolderName, "create-folder-in-base");
}

async function createFolderInApprovedBase(
  ws: WorkspaceManager,
  baseDir: string,
  rawFolderName: string,
  action: string,
): Promise<CreateDesktopFolderResult> {
  const ts = new Date().toISOString();
  let target: string | undefined;
  try {
    const name = sanitizeDesktopFolderName(rawFolderName);
    target = resolveFolderInsideBase(baseDir, name);

    if (await pathExists(target)) {
      const st = await fs.stat(target);
      if (st.isDirectory()) {
        await appendSystemLog(ws, `${ts}\t${action}\t${target}\texists\n`);
        return { ok: true, status: "exists", target, message: "Folder already exists ⚠️" };
      }
      await appendSystemLog(ws, `${ts}\t${action}\t${target}\tpath-not-directory\n`);
      return {
        ok: false,
        target,
        message: "Error: that path exists but is not a folder (refusing to overwrite).",
      };
    }

    await fs.mkdir(target, { recursive: false });
    const message = `Folder ${name} created on Desktop ✅`;
    await appendSystemLog(ws, `${ts}\t${action}\t${target}\tcreated\n`);
    return { ok: true, status: "created", target, message };
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    await appendSystemLog(ws, `${ts}\t${action}\t${target ?? "n/a"}\terror\t${m}\n`).catch(() => undefined);
    return { ok: false, message: `Error: ${m}`, target };
  }
}
