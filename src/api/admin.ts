// Admin API - Firestore access for the admin panel
// Backs src/pages/Admin.jsx and the components in src/components/Admin/.
//
// NOTE: These functions intentionally do NOT use withErrorHandling — the admin
// components have their own try/catch + toast handling that depends on the
// original Firestore error messages, so errors must propagate unchanged.

import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  setDoc,
  DocumentData,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db, paths } from './client';
import { queryClient, queryKeys } from '../lib/queryClient';
import {
  getCorpsValues as getCorpsValuesRef,
  getDciDataDoc as getDciDataDocRef,
  getHistoricalScoresForYear as getHistoricalScoresForYearRef,
  getHistoricalScoresMap as getHistoricalScoresMapRef,
  getSeasonRecaps,
} from './season';

// Non-namespaced Firestore paths used only by the admin panel (not in `paths`).
// - dci-data/{docId}: per-season corps point values (corpsValues array)
// - historical_scores/{year}: scraped DCI scores for a calendar year

// =============================================================================
// SEASON SETTINGS
// =============================================================================

/**
 * Get the active season settings doc (game-settings/season).
 * Returns the raw document data, or null if the doc does not exist.
 */
export async function getSeasonSettings(): Promise<DocumentData | null> {
  const seasonDoc = await getDoc(doc(db, paths.season()));
  return seasonDoc.exists() ? seasonDoc.data() : null;
}

// =============================================================================
// USER STATS / PROFILES
// =============================================================================

export interface AdminOverviewStats {
  totalUsers: number;
  activeUsers: number;
  totalCorps: number;
}

// The full-database profile scan is the most expensive read the client can
// issue (one billed read per registered user, growing forever). Every admin
// stats/listing function derives from the same scan, so it runs through a
// single shared react-query entry: opening the overview and the Users tab in
// one admin session costs one scan, not four.
const ADMIN_PROFILE_SCAN_KEY = ['admin', 'profileScan'] as const;
const ADMIN_PRIVATE_SCAN_KEY = ['admin', 'privateScan'] as const;
const ADMIN_SCAN_STALE_MS = 5 * 60 * 1000;

function getProfileScan(): Promise<QueryDocumentSnapshot<DocumentData>[]> {
  return queryClient.fetchQuery({
    queryKey: ADMIN_PROFILE_SCAN_KEY,
    queryFn: async () => {
      const snapshot = await getDocs(collectionGroup(db, 'profile'));
      // Only keep profile docs from the marching-art users collection
      return snapshot.docs.filter((d) => d.ref.path.includes(paths.users()));
    },
    staleTime: ADMIN_SCAN_STALE_MS,
  });
}

function getPrivateScan(): Promise<QueryDocumentSnapshot<DocumentData>[]> {
  return queryClient.fetchQuery({
    queryKey: ADMIN_PRIVATE_SCAN_KEY,
    queryFn: async () => {
      const snapshot = await getDocs(collectionGroup(db, 'private')).catch(() => ({
        docs: [] as QueryDocumentSnapshot<DocumentData>[],
      }));
      return snapshot.docs.filter((d) => d.ref.path.includes(paths.users()));
    },
    staleTime: ADMIN_SCAN_STALE_MS,
  });
}

/**
 * Resolve a profile's last-login Date from either lastLogin (Timestamp) or
 * engagement.lastLogin (Timestamp on the backend, ISO string from the client).
 */
function resolveLastLogin(data: DocumentData): Date | null {
  if (data.lastLogin?.toDate) {
    return data.lastLogin.toDate();
  }
  if (data.engagement?.lastLogin) {
    const el = data.engagement.lastLogin;
    return el.toDate ? el.toDate() : new Date(el);
  }
  return null;
}

function isActiveWithinDays(lastLoginDate: Date | null, days: number): boolean {
  if (!lastLoginDate) return false;
  return (Date.now() - lastLoginDate.getTime()) / (1000 * 60 * 60 * 24) <= days;
}

/**
 * Compute the admin overview telemetry (total users, active in last 7 days,
 * total corps) from the shared profile scan. Admin-only per Firestore rules.
 */
export async function getAdminOverviewStats(): Promise<AdminOverviewStats> {
  const profileDocs = await getProfileScan();

  let totalUsers = 0;
  let activeCount = 0,
    corpsCount = 0;

  for (const profileDoc of profileDocs) {
    totalUsers++;
    const data = profileDoc.data();
    if (isActiveWithinDays(resolveLastLogin(data), 7)) activeCount++;
    if (data.corps) corpsCount += Object.keys(data.corps).length;
  }

  return { totalUsers, activeUsers: activeCount, totalCorps: corpsCount };
}

export interface UserEngagementStats {
  totalUsers: number;
  activeUsers: number;
  avgLoginStreak: number;
  totalCorps: number;
  totalLogins: number;
}

/**
 * Compute user engagement telemetry (totals, 7-day actives, average login
 * streak, corps count, total logins) from the shared profile scan.
 * Admin-only per Firestore rules.
 */
export async function getUserEngagementStats(): Promise<UserEngagementStats> {
  const profileDocs = await getProfileScan();

  let totalUsers = 0;
  let activeCount = 0,
    corpsCount = 0,
    totalStreaks = 0,
    streakCount = 0,
    loginSum = 0;

  for (const profileDoc of profileDocs) {
    totalUsers++;
    const data = profileDoc.data();

    if (isActiveWithinDays(resolveLastLogin(data), 7)) activeCount++;

    // Engagement stats
    if (data.engagement) {
      if (data.engagement.loginStreak > 0) {
        totalStreaks += data.engagement.loginStreak;
        streakCount++;
      }
      loginSum += data.engagement.totalLogins || 0;
    }

    if (data.corps) corpsCount += Object.keys(data.corps).length;
  }

  const avgStreak = streakCount > 0 ? Math.round((totalStreaks / streakCount) * 10) / 10 : 0;
  return {
    totalUsers,
    activeUsers: activeCount,
    avgLoginStreak: avgStreak,
    totalCorps: corpsCount,
    totalLogins: loginSum,
  };
}

export interface AdminUserProfile {
  uid: string;
  username: string;
  email: string | null;
  lastLogin: Date | null;
  xpLevel: number;
  xp: number;
  loginStreak: number;
  totalLogins: number;
  corps: string[];
  createdAt: Date | null;
}

/**
 * Get all user profiles (joined with private emails), sorted by last login
 * (most recent first). Admin-only per Firestore rules.
 */
export async function getAllUserProfiles(): Promise<AdminUserProfile[]> {
  // Emails live in the owner-private `private/data` doc (never the public
  // profile doc), so fetch those separately and join by uid. Both scans are
  // admin-only per Firestore rules and read through the shared cache above.
  const [profileDocs, privateDocs] = await Promise.all([getProfileScan(), getPrivateScan()]);

  const emailByUid: Record<string, string> = {};
  privateDocs.forEach((privateDoc) => {
    const uid = privateDoc.ref.path.split('/')[3];
    const email = privateDoc.data()?.email;
    if (uid && email) emailByUid[uid] = email;
  });

  const userList = profileDocs.map((profileDoc) => {
    const data = profileDoc.data();

    // Extract user ID from the doc path
    // Path format: paths.userProfile(userId) = artifacts/{ns}/users/{userId}/profile/data
    const pathParts = profileDoc.ref.path.split('/');
    const uid = pathParts[3];

    const lastLoginDate = resolveLastLogin(data);

    return {
      uid,
      username: data.username || 'Unknown',
      email: emailByUid[uid] || data.email || null,
      lastLogin: lastLoginDate,
      xpLevel: data.xpLevel || 1,
      xp: data.xp || 0,
      loginStreak: data.engagement?.loginStreak || 0,
      totalLogins: data.engagement?.totalLogins || 0,
      corps: data.corps ? Object.keys(data.corps) : [],
      createdAt: data.createdAt?.toDate?.() || null,
    };
  });

  // Sort by last login (most recent first)
  return userList.sort((a, b) => (b.lastLogin?.getTime() || 0) - (a.lastLogin?.getTime() || 0));
}

// =============================================================================
// CORPS POINT VALUES (dci-data)
// =============================================================================

export interface CorpsValue {
  corpsName: string;
  sourceYear: number;
  points: number;
}

/**
 * List the IDs of all dci-data season docs, sorted alphabetically.
 */
export async function listDciDataDocIds(): Promise<string[]> {
  const snap = await getDocs(collection(db, 'dci-data'));
  return snap.docs.map((d) => d.id).sort();
}

/**
 * Get a dci-data season doc's raw data, or null if it does not exist.
 * Delegates to the canonical reference reader in api/season.
 */
export async function getDciDataDoc(docId: string): Promise<DocumentData | null> {
  return getDciDataDocRef(docId);
}

/**
 * Get the corpsValues array from a dci-data season doc.
 * Returns [] if the doc or array does not exist.
 */
export async function getCorpsValues(docId: string): Promise<CorpsValue[]> {
  return (await getCorpsValuesRef(docId)) as CorpsValue[];
}

/**
 * Overwrite the corpsValues array on a dci-data season doc (merge write, so
 * other fields on the doc are preserved).
 */
export async function saveCorpsValues(docId: string, values: CorpsValue[]): Promise<void> {
  await setDoc(doc(db, `dci-data/${docId}`), { corpsValues: values }, { merge: true });
}

/**
 * Create a new dci-data season doc with an empty corpsValues array.
 */
export async function createDciDataDoc(docId: string): Promise<void> {
  await setDoc(doc(db, `dci-data/${docId}`), { corpsValues: [] });
}

// =============================================================================
// HISTORICAL SCORES
// =============================================================================

/**
 * Fetch historical_scores docs for a set of years, keyed by year (doc ID).
 * Delegates to the canonical reference reader in api/season.
 */
export async function getHistoricalScoresMap(
  years: Array<string | number>
): Promise<Record<string, DocumentData[]>> {
  return getHistoricalScoresMapRef(years);
}

/**
 * Fetch the scraped event array for a single year from historical_scores.
 * Delegates to the canonical reference reader in api/season.
 */
export async function getHistoricalScoresForYear(year: string | number): Promise<DocumentData[]> {
  return getHistoricalScoresForYearRef(year);
}

// =============================================================================
// FANTASY RECAPS
// =============================================================================

/**
 * Get the set of competition days (offSeasonDay) that have been scored into
 * fantasy_recaps for a season. Reads through the shared react-query recap
 * archive (same key the Scores page / Dashboard / league views populate), so
 * an admin session usually derives this from an already-downloaded archive
 * instead of re-fetching every (large) day doc.
 */
export async function getScoredRecapDays(seasonUid: string): Promise<Set<number>> {
  const recaps = await queryClient.fetchQuery({
    queryKey: queryKeys.fantasyRecaps(seasonUid),
    queryFn: () => getSeasonRecaps(seasonUid),
    staleTime: 5 * 60 * 1000,
  });
  const days = new Set<number>();
  recaps.forEach((recap) => {
    if (typeof recap.offSeasonDay === 'number') days.add(recap.offSeasonDay);
  });
  return days;
}
