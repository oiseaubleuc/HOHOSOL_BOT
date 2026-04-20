import type { TaskRunWorkflowResult } from "../services/taskRunWorkflow.js";

export function buildAgentMarkdownReport(input: {
  taskId: string;
  title: string;
  phases: string[];
  dryRunResult?: TaskRunWorkflowResult;
  executeResult?: TaskRunWorkflowResult;
  coachNote?: string;
  reasoning: string[];
}): string {
  const lines = [
    `# devBOT agent report — ${input.taskId}`,
    ``,
    `- **Title**: ${input.title}`,
    `- **Generated**: ${new Date().toISOString()}`,
    ``,
    `## Reasoning / decisions`,
    ...input.reasoning.map((r) => `- ${r}`),
    ``,
    `## Phases touched`,
    ...input.phases.map((p) => `- ${p}`),
    ``,
  ];

  if (input.dryRunResult) {
    lines.push(`## Dry-run`, ``, `- **status**: ${input.dryRunResult.status}`, "");
  }
  if (input.executeResult) {
    lines.push(
      `## Execution`,
      ``,
      `- **status**: ${input.executeResult.status}`,
      `- **commandFailed**: ${String(input.executeResult.commandFailed ?? false)}`,
      "",
    );
  }
  if (input.coachNote) {
    lines.push(`## AI suggestions (OpenAI)`, ``, input.coachNote, ``);
  }
  lines.push(`## Next steps`, ``, `- Review reports under workspace/reports`, `- Re-run with AUTO_APPROVE=true only on trusted machines`, ``);
  return lines.join("\n");
}
