// useProfile - React Query hook for profile data
// Provides cached, reactive profile data with automatic background updates

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import * as profileApi from '../api/profile';
import type { UserProfile, CorpsData, CorpsClass, DeepPartial } from '../types';

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

/**
 * Hook to fetch a specific corps
 */
export function useCorps(uid: string | undefined, corpsClass: CorpsClass | undefined) {
  return useQuery({
    queryKey: queryKeys.corps(uid || '', corpsClass || ''),
    queryFn: () => profileApi.getCorps(uid!, corpsClass!),
    enabled: !!uid && !!corpsClass,
  });
}

/**
 * Hook to update a user's profile
 */
export function useUpdateProfile(uid: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (updates: DeepPartial<UserProfile>) =>
      profileApi.updateProfile(uid, updates),
    onSuccess: () => {
      // Invalidate and refetch profile data
      queryClient.invalidateQueries({ queryKey: queryKeys.profile(uid) });
    },
  });
}

/**
 * Hook to update a specific corps
 */
export function useUpdateCorps(uid: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      corpsClass,
      updates,
    }: {
      corpsClass: CorpsClass;
      updates: Partial<CorpsData>;
    }) => profileApi.updateCorps(uid, corpsClass, updates),
    onSuccess: (_, { corpsClass }) => {
      // Invalidate both the corps and profile queries
      queryClient.invalidateQueries({ queryKey: queryKeys.corps(uid, corpsClass) });
      queryClient.invalidateQueries({ queryKey: queryKeys.profile(uid) });
    },
  });
}

/**
 * Hook to add XP to a user
 */
export function useAddXp(uid: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (amount: number) => profileApi.addXp(uid, amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile(uid) });
    },
  });
}

/**
 * Hook to update CorpsCoin
 */
export function useUpdateCorpsCoin(uid: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (amount: number) => profileApi.updateCorpsCoin(uid, amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile(uid) });
    },
  });
}
