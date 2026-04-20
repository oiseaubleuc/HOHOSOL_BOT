import type { NodeLayout } from "../types/project.js";
import type { TaskSpec } from "../types/task.js";
import type { CommandStep } from "../types/commands.js";

export function nodeDiscoveryMarkdown(task: TaskSpec, layout: NodeLayout): string {
  const entries = layout.entryHints.map((e) => `- \`${e}\``).join("\n") || "- _(no common entry files detected)_";
  return [
    `# Node.js project plan`,
    ``,
    `## Task`,
    `- **ID**: ${task.id}`,
    `- **Title**: ${task.title}`,
    ``,
    `## Detected layout`,
    `- **package.json**: \`${layout.packageJsonPath}\``,
    `- **Lockfile**: ${layout.lockfile}`,
    ``,
    `## Entry hints`,
    entries,
    ``,
    `## Suggested workflow`,
    `- Keep changes scoped to a single package workspace when using monorepos.`,
    `- Prefer \`npm test\` / \`pnpm test\` after edits (allowlisted in executor for Node flavor).`,
    `- Add or update tests beside the module under test.`,
    ``,
    `## Task description`,
    task.description.trim(),
    ``,
  ].join("\n");
}

export function defaultNodeInspectSteps(projectRoot: string, layout: NodeLayout): CommandStep[] {
  const argv =
    layout.lockfile === "pnpm"
      ? ["pnpm", "test"]
      : layout.lockfile === "yarn"
        ? ["yarn", "test"]
        : ["npm", "test"];
  return [{ label: "Run package test script", cwd: projectRoot, argv }];
}
