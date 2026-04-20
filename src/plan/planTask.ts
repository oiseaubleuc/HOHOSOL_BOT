import type { ProjectProfile } from "../types/project.js";
import type { TaskSpec } from "../types/task.js";
import { laravelImplementationPlanMarkdown } from "./laravelConventions.js";
import { nodeDiscoveryMarkdown } from "./nodePlan.js";

export function buildImplementationPlanMarkdown(task: TaskSpec, profile: ProjectProfile): string {
  if (profile.flavor === "laravel" && profile.laravel) {
    return laravelImplementationPlanMarkdown(task, profile.laravel);
  }
  if (profile.flavor === "node" && profile.node) {
    return nodeDiscoveryMarkdown(task, profile.node);
  }
  return [
    `# Generic project plan`,
    ``,
    `No strong Laravel or Node signature was detected under \`${profile.root}\`.`,
    ``,
    `## Task`,
    `- **ID**: ${task.id}`,
    `- **Title**: ${task.title}`,
    ``,
    `## Next steps`,
    `- Point \`projectRoot\` at the repository root containing \`artisan\` or \`package.json\`.`,
    `- Re-run the bot once the project type is recognized.`,
    ``,
    `## Task description`,
    task.description.trim(),
    ``,
  ].join("\n");
}
