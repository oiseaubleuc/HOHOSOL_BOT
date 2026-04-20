import path from "node:path";
import type { LaravelLayout } from "../types/project.js";
import type { TaskSpec } from "../types/task.js";

export interface SafeModificationSuggestion {
  area: "routes" | "controllers" | "models" | "migrations" | "views" | "config" | "policies" | "middleware" | "providers";
  path: string;
  rationale: string;
}

/**
 * Heuristic mapping from task hints / keywords to Laravel files (read-only suggestions).
 */
export function suggestLaravelTouchPoints(task: TaskSpec, layout: LaravelLayout): SafeModificationSuggestion[] {
  const hay = `${task.title}\n${task.description}`.toLowerCase();
  const out: SafeModificationSuggestion[] = [];

  const pickNearest = (files: string[], predicate: (f: string) => boolean): string | undefined =>
    files.find(predicate);

  if (/(route|endpoint|api|url|404)/.test(hay)) {
    const f = layout.routeFiles[0];
    if (f) out.push({ area: "routes", path: f, rationale: "Routing changes usually start in `routes/*.php`." });
  }
  if (/(controller|http|request|response)/.test(hay)) {
    const hinted = task.fileHints?.map((h) => path.resolve(task.projectRoot, h.path));
    const ctrl =
      hinted?.find((p) => p.includes(`${path.sep}Http${path.sep}Controllers`)) ??
      pickNearest(layout.controllerFiles, () => true);
    if (ctrl)
      out.push({
        area: "controllers",
        path: ctrl,
        rationale: "HTTP orchestration belongs in an invokable controller or FormRequest pair.",
      });
  }
  if (/(model|eloquent|relation|database table)/.test(hay)) {
    const m = pickNearest(layout.modelFiles, () => true);
    if (m) out.push({ area: "models", path: m, rationale: "Domain persistence belongs in Eloquent models under `app/Models` when possible." });
  }
  if (/(migration|schema|column|index)/.test(hay)) {
    const mig = pickNearest(layout.migrationFiles, () => true);
    if (mig)
      out.push({
        area: "migrations",
        path: mig,
        rationale: "Prefer additive migrations; avoid editing shipped migrations that may already run in production.",
      });
  }
  if (/(blade|view|ui|email template)/.test(hay)) {
    const v = pickNearest(layout.bladeFiles, () => true);
    if (v) out.push({ area: "views", path: v, rationale: "Presentation belongs in `resources/views` Blade templates or a dedicated ViewModel." });
  }
  if (/(config|env|feature flag)/.test(hay)) {
    const c = pickNearest(layout.configFiles, (f) => f.endsWith(`${path.sep}app.php`) || f.endsWith(`${path.sep}services.php`));
    if (c) out.push({ area: "config", path: c, rationale: "Configuration should live in `config/*.php`, not hard-coded in controllers." });
  }

  if (/(policy|authorization|can\()/.test(hay)) {
    const p = pickNearest(layout.policyFiles, () => true);
    if (p) out.push({ area: "policies", path: p, rationale: "Authorization belongs in Policies registered with `AuthServiceProvider`." });
  }

  // De-dupe by path
  const seen = new Set<string>();
  return out.filter((s) => {
    if (seen.has(s.path)) return false;
    seen.add(s.path);
    return true;
  });
}

export function laravelImplementationPlanMarkdown(task: TaskSpec, layout: LaravelLayout): string {
  const suggestions = suggestLaravelTouchPoints(task, layout);
  const criteria = task.acceptanceCriteria?.length
    ? task.acceptanceCriteria.map((c) => `- **${c.id}**: ${c.description}`).join("\n")
    : "- _(none specified — add acceptance criteria to the task JSON)_";

  const routes = layout.routeFiles.map((f) => `- \`${f}\``).join("\n") || "- _(none found)_";
  const controllers = layout.controllerFiles.slice(0, 12).map((f) => `- \`${f}\``).join("\n");
  const models = layout.modelFiles.slice(0, 12).map((f) => `- \`${f}\``).join("\n");
  const migrations = layout.migrationFiles.slice(0, 8).map((f) => `- \`${f}\``).join("\n");
  const blades = layout.bladeFiles.slice(0, 8).map((f) => `- \`${f}\``).join("\n");
  const configs = layout.configFiles.slice(0, 8).map((f) => `- \`${f}\``).join("\n");

  const sugMd =
    suggestions.length > 0
      ? suggestions
          .map((s) => `- **${s.area}**: \`${s.path}\` — ${s.rationale}`)
          .join("\n")
      : "- _(no strong keyword match — inspect routes/controllers manually)_";

  return [
    `# Laravel implementation plan`,
    ``,
    `## Task`,
    `- **ID**: ${task.id}`,
    `- **Title**: ${task.title}`,
    `- **Framework**: ${layout.laravelFrameworkVersion ?? "unknown"}`,
    ``,
    `## Acceptance criteria`,
    criteria,
    ``,
    `## Problem statement`,
    task.description.trim(),
    ``,
    `## Repository map (detected)`,
    `### Routes`,
    routes,
    `### Controllers (sample)`,
    controllers || "- _(none found)_",
    `### Models (sample)`,
    models || "- _(none found)_",
    `### Migrations (sample)`,
    migrations || "- _(none found)_",
    `### Blade views (sample)`,
    blades || "- _(none found)_",
    `### Config (sample)`,
    configs || "- _(none found)_",
    ``,
    `## Suggested touch points (convention-safe)`,
    sugMd,
    ``,
    `## Implementation checklist (human-in-the-loop)`,
    `- [ ] Reproduce the bug or missing behaviour locally.`,
    `- [ ] Add or extend a Feature test near \`tests/Feature\` covering the regression.`,
    `- [ ] Implement the smallest change in the suggested layer (route → controller → service → model).`,
    `- [ ] Run \`php artisan test\` and \`php artisan route:list\` after substantive routing work.`,
    `- [ ] If schema changes are required, prefer a **new** migration; avoid rewriting applied migrations.`,
    `- [ ] Open a PR on a dedicated branch \`ai/${task.id}\` for client review.`,
    ``,
  ].join("\n");
}
