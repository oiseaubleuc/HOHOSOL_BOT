import process from "node:process";
import fs from "node:fs/promises";
import path from "node:path";
import { loadRuntimeConfig } from "../config/runtimeConfig.js";
import { startBothBotListeners } from "./startBots.js";

/**
 * Starts bot listeners and writes periodic heartbeat to workspace logs.
 * Intended for launch-at-login (post-login) usage.
 */
export async function startResidentMode(cwd = process.cwd()): Promise<void> {
  const cfg = loadRuntimeConfig(cwd);
  const heartbeatFile = path.join(cfg.workspacePath, "logs", "resident-heartbeat.log");
  await fs.mkdir(path.dirname(heartbeatFile), { recursive: true });
  const pid = process.pid;
  await fs.appendFile(heartbeatFile, `${new Date().toISOString()}\tresident-start\tpid=${pid}\n`, "utf8");

  const timer = setInterval(() => {
    void fs.appendFile(
      heartbeatFile,
      `${new Date().toISOString()}\theartbeat\tpid=${pid}\tuptime=${Math.round(process.uptime())}s\n`,
      "utf8",
    );
  }, 60000);

  const stop = async () => {
    clearInterval(timer);
    await fs.appendFile(heartbeatFile, `${new Date().toISOString()}\tresident-stop\tpid=${pid}\n`, "utf8").catch(() => undefined);
  };
  process.on("SIGINT", () => void stop());
  process.on("SIGTERM", () => void stop());

  await startBothBotListeners(cwd);
}

