// =============================================================================
// CORPS VALUES HOOK
// =============================================================================
// Shared React Query wrapper for the season's corpsValues array
// (dci-data/{seasonUid}). One cache entry — keyed by queryKeys.corpsValues —
// serves every consumer (Landing scores, Dashboard, Guest demo, Onboarding,
// Caption selection) instead of each call site re-fetching the doc manually.

import { useQuery } from '@tanstack/react-query';
import type { DocumentData } from 'firebase/firestore';
import { getCorpsValues } from '../api/season';
import { queryKeys } from '../lib/queryClient';

/**
 * Fetch (and cache) the corpsValues array for a season's dci-data doc.
 * Disabled until a seasonUid is available. The data is season-static, so a
 * long staleTime keeps repeat opens free.
 */
export function useCorpsValues(seasonUid: string | null | undefined) {
  return useQuery<DocumentData[]>({
    queryKey: queryKeys.corpsValues(seasonUid ?? ''),
    queryFn: () => getCorpsValues(seasonUid ?? ''),
    enabled: !!seasonUid,
    staleTime: 10 * 60 * 1000,
  });
}

export default useCorpsValues;
