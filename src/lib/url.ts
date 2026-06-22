export function buildSelectedUrl(projectId: string): string {
  return `/?selected=${encodeURIComponent(projectId)}`;
}

export function buildCloseUrl(): string {
  return "/";
}
