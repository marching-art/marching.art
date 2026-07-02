// useProfile - React Query hook for profile data
// Used for viewing OTHER users' profiles (e.g. /profile/:username).
// The CURRENT user's profile has a single source of truth: the realtime
// useProfileStore listener. Do not add parallel current-user reads here.

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import * as profileApi from '../api/profile';

/**
 * Hook to fetch and cache a user's profile
 */
export function useProfile(uid: string | undefined) {
  return useQuery({
    queryKey: queryKeys.profile(uid || ''),
    queryFn: () => profileApi.getProfile(uid!),
    enabled: !!uid,
    staleTime: 2 * 60 * 1000, // Profile data stays fresh for 2 minutes
  });
}
