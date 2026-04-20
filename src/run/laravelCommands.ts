import type { CommandStep } from "../types/commands.js";

export function defaultLaravelInspectSteps(projectRoot: string): CommandStep[] {
  return [
    {
      label: "List registered routes",
      cwd: projectRoot,
      argv: ["php", "artisan", "route:list"],
    },
    {
      label: "Run automated tests",
      cwd: projectRoot,
      argv: ["php", "artisan", "test"],
    },
    {
      label: "Show pending migrations (pretend)",
      cwd: projectRoot,
      argv: ["php", "artisan", "migrate", "--pretend"],
    },
  ];
}
