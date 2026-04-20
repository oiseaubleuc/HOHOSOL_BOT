import fs from "node:fs/promises";
import path from "node:path";

/**
 * All bot data and project work must stay under {@link root}.
 */
export class WorkspaceManager {
  constructor(public readonly root: string) {}

  tasksDir(): string {
    return path.join(this.root, "tasks");
  }

  logsDir(): string {
    return path.join(this.root, "logs");
  }

  reportsDir(): string {
    return path.join(this.root, "reports");
  }

  proposalsDir(): string {
    return path.join(this.root, "proposals");
  }

  projectsDir(): string {
    return path.join(this.root, "projects");
  }

  stateDir(): string {
    return path.join(this.root, ".devbot");
  }

  logFile(taskId: string): string {
    const safe = taskId.replace(/[^a-zA-Z0-9._-]+/g, "_");
    return path.join(this.logsDir(), `${safe}.log`);
  }

  reportFile(taskId: string, suffix: string): string {
    const safe = taskId.replace(/[^a-zA-Z0-9._-]+/g, "_");
    return path.join(this.reportsDir(), `${safe}-${suffix}.md`);
  }

  proposalFile(taskId: string): string {
    const safe = taskId.replace(/[^a-zA-Z0-9._-]+/g, "_");
    return path.join(this.proposalsDir(), `${safe}.proposal.json`);
  }

  async ensureLayout(): Promise<void> {
    await fs.mkdir(this.root, { recursive: true });
    await Promise.all([
      fs.mkdir(this.tasksDir(), { recursive: true }),
      fs.mkdir(this.logsDir(), { recursive: true }),
      fs.mkdir(this.reportsDir(), { recursive: true }),
      fs.mkdir(this.proposalsDir(), { recursive: true }),
      fs.mkdir(this.projectsDir(), { recursive: true }),
      fs.mkdir(this.stateDir(), { recursive: true }),
    ]);
  }

  /**
   * Throws if `absoluteTarget` is not inside {@link root} (after normalization).
   */
  assertPathInWorkspace(absoluteTarget: string): void {
    const root = path.resolve(this.root);
    const target = path.resolve(absoluteTarget);
    const rel = path.relative(root, target);
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
      throw new Error(`Path outside workspace: ${target}\nWorkspace root: ${root}`);
    }
  }

  assertOptionalPathInWorkspace(absoluteTarget: string | undefined): void {
    if (!absoluteTarget) return;
    this.assertPathInWorkspace(absoluteTarget);
  }
}
