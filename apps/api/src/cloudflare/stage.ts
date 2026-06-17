function stageNameForResource(stage: string): string {
  const normalized = stage
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9-]/g, "-")
    .replaceAll(/-+/g, "-")
    .replaceAll(/^-|-$/g, "");

  return normalized === "" ? "dev" : normalized;
}

export { stageNameForResource };
