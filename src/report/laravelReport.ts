import type { CommandResult } from "../types/commands.js";
import type { ProjectProfile } from "../types/project.js";
import type { TaskSpec } from "../types/task.js";

export function formatLaravelChangeReport(input: {
  task: TaskSpec;
  profile: ProjectProfile;
  planMarkdown: string;
  results?: CommandResult[];
}): string {
  const layout = input.profile.laravel;
  const header = [
    `# AI Dev Bot — project change report`,
    ``,
    `- **Generated**: ${new Date().toISOString()}`,
    `- **Task**: ${input.task.id} — ${input.task.title}`,
    `- **Project root**: \`${input.profile.root}\``,
    `- **Detected flavor**: ${input.profile.flavor}`,
    layout ? `- **laravel/framework**: ${layout.laravelFrameworkVersion ?? "unknown"}` : "",
    ``,
  ]
    .filter(Boolean)
    .join("\n");

  const inventory = layout
    ? [
        `## Structural inventory`,
        ``,
        `| Area | Count |`,
        `| --- | ---: |`,
        `| Route files | ${layout.routeFiles.length} |`,
        `| Controllers | ${layout.controllerFiles.length} |`,
        `| Models | ${layout.modelFiles.length} |`,
        `| Migrations | ${layout.migrationFiles.length} |`,
        `| Blade views | ${layout.bladeFiles.length} |`,
        `| Config files | ${layout.configFiles.length} |`,
        `| Policies | ${layout.policyFiles.length} |`,
        `| Middleware | ${layout.middlewareFiles.length} |`,
        `| Service providers | ${layout.serviceProviderFiles.length} |`,
        ``,
      ].join("\n")
    : "";

  const cmdSection =
    input.results && input.results.length > 0
      ? [
          `## Command execution`,
          ``,
          ...input.results.map((r) => {
            const status =
              r.exitCode === 0 ? "OK" : r.exitCode === null ? "ERROR (spawn failed)" : `EXIT ${r.exitCode}`;
            return [
              `### ${r.label}`,
              `- **argv**: \`${r.argv.join(" ")}\``,
              `- **status**: ${status}`,
              `- **durationMs**: ${r.durationMs}`,
              ``,
              "```text",
              (r.stdout + r.stderr).trim() || "(no output)",
              "```",
              ``,
            ].join("\n");
          }),
        ].join("\n")
      : [
          `## Command execution`,
          ``,
          `_No commands were executed. Use \`--approve-checksum\` after a dry-run to run the allowlisted inspect suite._`,
          ``,
        ].join("\n");

  return [header, inventory, `## Implementation plan`, ``, input.planMarkdown.trim(), ``, cmdSection].join("\n");
}
