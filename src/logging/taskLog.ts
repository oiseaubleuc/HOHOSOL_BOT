import fs from "node:fs/promises";

export class TaskLog {
  constructor(private readonly filePath: string) {}

  async line(level: string, message: string, meta?: Record<string, unknown>): Promise<void> {
    const ts = new Date().toISOString();
    const extra = meta ? ` ${JSON.stringify(meta)}` : "";
    const row = `${ts} [${level}] ${message}${extra}\n`;
    await fs.appendFile(this.filePath, row, "utf8");
  }
}
