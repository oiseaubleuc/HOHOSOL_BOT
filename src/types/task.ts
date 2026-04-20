export type TaskPriority = "low" | "medium" | "high";

export interface TaskAcceptanceCriterion {
  id: string;
  description: string;
}

export interface TaskFileHint {
  path: string;
  reason?: string;
}

/**
 * Normalized task loaded from JSON (samples or integrations).
 */
export interface TaskSpec {
  id: string;
  title: string;
  description: string;
  projectRoot: string;
  priority?: TaskPriority;
  acceptanceCriteria?: TaskAcceptanceCriterion[];
  fileHints?: TaskFileHint[];
  labels?: string[];
}

export interface RawTaskJson {
  id: string;
  title: string;
  description: string;
  /**
   * Absolute or relative path to the client repo root.
   */
  projectRoot: string;
  priority?: TaskPriority;
  acceptanceCriteria?: TaskAcceptanceCriterion[];
  fileHints?: TaskFileHint[];
  labels?: string[];
}
