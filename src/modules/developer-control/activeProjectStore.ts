let active: string | undefined;

export function getActiveProjectName(): string | undefined {
  return active;
}

export function setActiveProjectName(name: string | undefined): void {
  active = name?.trim() || undefined;
}

export function resetActiveProjectForTests(): void {
  active = undefined;
}
