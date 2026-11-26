import { useEffect, useState } from 'react';
import { gloraxPlanProjects, type GloraxPlanManifest } from '../../../../packages/domain/gloraxPlans';

export function useGloraxPlans(projectId: string, planOpen: boolean) {
  const [loaded, setLoaded] = useState<{ projectId: string; plans: GloraxPlanManifest }>();
  const [applied, setApplied] = useState<typeof loaded>();

  useEffect(() => {
    if (!gloraxPlanProjects.some(id => id === projectId)) return;
    const controller = new AbortController();
    void fetch('/api/v1/public/catalog/' + encodeURIComponent(projectId) + '/glorax-plans', {
      signal: controller.signal,
    }).then(async response => {
      if (!response.ok) return;
      const plans: GloraxPlanManifest = await response.json();
      if (!controller.signal.aborted) setLoaded({ projectId, plans });
    }).catch(() => {
      // The catalog can still display the developer's original images.
    });
    return () => controller.abort();
  }, [projectId]);

  useEffect(() => {
    if (!planOpen) setApplied(loaded);
  }, [loaded, planOpen]);

  return applied?.projectId === projectId ? applied.plans : undefined;
}
