import type { CorpsClass } from './corps';
import type { LeagueSettings } from './league';

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

export interface ApiResponse<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  hasMore: boolean;
  lastDoc?: unknown;
  total?: number;
}

// =============================================================================
// FORM DATA TYPES
// =============================================================================

export interface CorpsRegistrationData {
  name: string;
  location: string;
  description?: string;
  class: CorpsClass;
}

export interface LeagueCreationData {
  name: string;
  description: string;
  isPublic: boolean;
  maxMembers: number;
  settings: LeagueSettings;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

// Helper type for Firestore documents
export type WithId<T> = T & { id: string };

// Helper for partial updates
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
