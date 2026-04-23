import fs from "node:fs/promises";
import path from "node:path";

export interface WorkspaceManagerOptions {
  /** Resolved absolute path; projects & clones go here instead of `root/projects`. */
  projectsDir?: string;
}

/**
 * Tasks, logs, reports stay under {@link root}. Projects default to `root/projects` or an optional override.
 */
export class WorkspaceManager {
  private readonly _projectsDir: string;

  constructor(
    public readonly root: string,
    opts?: WorkspaceManagerOptions,
  ) {
    const override = opts?.projectsDir?.trim();
    this._projectsDir =
      override && override.length > 0 ? path.resolve(override) : path.join(this.root, "projects");
  }

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
    return this._projectsDir;
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
   * Throws if `absoluteTarget` is not under workspace {@link root} nor under {@link projectsDir}.
   */
  assertPathInWorkspace(absoluteTarget: string): void {
    const target = path.resolve(absoluteTarget);
    if (this.pathIsUnder(this.root, target)) return;
    if (this.pathIsUnder(this.projectsDir(), target)) return;
    throw new Error(
      `Path outside workspace/projects: ${target}\nWorkspace: ${path.resolve(this.root)}\nProjects: ${path.resolve(this.projectsDir())}`,
    );
  }

  private pathIsUnder(rootDir: string, target: string): boolean {
    const root = path.resolve(rootDir);
    const rel = path.relative(root, target);
    return !rel.startsWith("..") && !path.isAbsolute(rel);
  }

  assertOptionalPathInWorkspace(absoluteTarget: string | undefined): void {
    if (!absoluteTarget) return;
    this.assertPathInWorkspace(absoluteTarget);
  }
}
