export type ProjectFlavor = "laravel" | "node" | "unknown";

export interface LaravelLayout {
  artisanPath: string;
  composerJsonPath: string;
  laravelFrameworkVersion?: string;
  phpAppRoot: string;
  routeFiles: string[];
  controllerFiles: string[];
  modelFiles: string[];
  migrationFiles: string[];
  bladeFiles: string[];
  configFiles: string[];
  policyFiles: string[];
  middlewareFiles: string[];
  serviceProviderFiles: string[];
}

export interface NodeLayout {
  packageJsonPath: string;
  lockfile?: "npm" | "pnpm" | "yarn" | "none";
  entryHints: string[];
}

export interface ProjectProfile {
  root: string;
  flavor: ProjectFlavor;
  laravel?: LaravelLayout;
  node?: NodeLayout;
}

export interface BotConfig {
  /**
   * Extra argv prefixes parsed from `ai-dev-bot.config.json` signatures like `php|artisan|config:clear`.
   */
  extraAllowedPrefixes?: string[][];
}
