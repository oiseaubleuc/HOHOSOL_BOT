import { spawn } from "node:child_process";
import path from "node:path";

export interface GithubRepoRef {
  owner: string;
  repo: string;
}

export function parseGithubRepo(raw: string): GithubRepoRef {
  const s = raw.trim().replace(/^https?:\/\/github\.com\//i, "");
  const [owner, repo] = s.split("/").filter(Boolean);
  if (!owner || !repo) {
    throw new Error(`Invalid GITHUB_REPO "${raw}" — expected owner/repo`);
  }
  return { owner, repo: repo.replace(/\.git$/i, "") };
}

function runGit(cwd: string, args: string[], token?: string): Promise<{ code: number; out: string }> {
  const env = { ...process.env };
  if (token) {
    env.GIT_TERMINAL_PROMPT = "0";
  }
  return new Promise((resolve) => {
    const child = spawn("git", args, { cwd, env, shell: false });
    let out = "";
    child.stdout?.on("data", (d) => {
      out += String(d);
    });
    child.stderr?.on("data", (d) => {
      out += String(d);
    });
    child.on("close", (code) => resolve({ code: code ?? 1, out }));
    child.on("error", (err) => resolve({ code: 1, out: String(err) }));
  });
}

/**
 * Creates `bot/<taskId>/<slug>`, commits all changes, pushes, optionally opens a PR.
 * All paths must already be inside the workspace (caller enforces).
 */
export async function gitBranchCommitPush(input: {
  repoDir: string;
  taskId: string;
  featureSlug: string;
  commitTitle: string;
  token: string;
  repo: GithubRepoRef;
  createPr: boolean;
}): Promise<{ branch: string; prUrl?: string; log: string }> {
  const branch = `bot/${input.taskId}/${input.featureSlug}`.replace(/[^a-zA-Z0-9/_-]+/g, "-").slice(0, 200);
  const remoteUrl = `https://x-access-token:${input.token}@github.com/${input.repo.owner}/${input.repo.repo}.git`;
  const lines: string[] = [];

  const git = async (args: string[]) => {
    const r = await runGit(input.repoDir, args, input.token);
    lines.push(`$ git ${args.join(" ")}\n${r.out}`);
    if (r.code !== 0) {
      throw new Error(`git failed (${args.join(" ")}): exit ${r.code}\n${r.out}`);
    }
  };

  await git(["checkout", "-B", branch]);
  await git(["add", "-A"]);
  const commit = await runGit(input.repoDir, ["commit", "-m", `[devBOT] ${input.commitTitle}`], input.token);
  lines.push(`$ git commit …\n${commit.out}`);
  if (commit.code !== 0) {
    const st = await runGit(input.repoDir, ["status", "--porcelain"], input.token);
    if (!st.out.trim()) {
      lines.push("(nothing to commit — skipping push of empty commit)");
      return { branch, prUrl: undefined, log: lines.join("\n") };
    }
    throw new Error(`git commit failed: ${commit.out}`);
  }
  await git(["push", "-u", remoteUrl, `HEAD:${branch}`]);

  let prUrl: string | undefined;
  if (input.createPr) {
    prUrl = await createPullRequest({
      token: input.token,
      owner: input.repo.owner,
      repo: input.repo.repo,
      title: `[devBOT] ${input.commitTitle}`,
      head: branch,
      base: "main",
    });
  }

  return { branch, prUrl, log: lines.join("\n") };
}

async function createPullRequest(input: {
  token: string;
  owner: string;
  repo: string;
  title: string;
  head: string;
  base: string;
}): Promise<string | undefined> {
  const res = await fetch(`https://api.github.com/repos/${input.owner}/${input.repo}/pulls`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${input.token}`,
      accept: "application/vnd.github+json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      title: input.title,
      head: input.head,
      base: input.base,
    }),
  });
  const json = (await res.json()) as { html_url?: string; message?: string };
  if (!res.ok) {
    throw new Error(`GitHub PR failed: ${res.status} ${json.message ?? JSON.stringify(json)}`);
  }
  return json.html_url;
}

export function slugifyFeature(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "task";
}

export function defaultCloneDir(wsProjects: string, repo: GithubRepoRef): string {
  return path.join(wsProjects, `${repo.repo}-worktree`);
}
