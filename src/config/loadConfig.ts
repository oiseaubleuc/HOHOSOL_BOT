import path from "node:path";
import { readJsonFile, pathExists } from "../fs/async.js";
import type { BotConfig } from "../types/project.js";
import { parseExtraAllowedSignatures } from "../run/allowlist.js";

interface ConfigFileShape {
  extraAllowedCommands?: string[];
}

export async function loadBotConfig(projectRoot: string): Promise<BotConfig> {
  const p = path.join(projectRoot, "ai-dev-bot.config.json");
  if (!(await pathExists(p))) return {};
  const raw = await readJsonFile<ConfigFileShape>(p);
  const extraAllowedPrefixes = raw.extraAllowedCommands?.length
    ? parseExtraAllowedSignatures(raw.extraAllowedCommands)
    : [];
  return { extraAllowedPrefixes };
}
