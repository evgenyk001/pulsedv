export const gloraxPlanProjects = [
  'vdk26-cb9cbbd950af',
  'vdk26-a0a94c503fb3',
  'vdk26-ad75e89a6fbf',
] as const;

export const gloraxPlanSource = /^https:\/\/crmftp\.glorax\.com\/[a-z0-9_-]+\/[a-z0-9_-]+\.png$/i;

export type GloraxPlanManifest = Record<string, { drawing: string; preview?: string }>;
