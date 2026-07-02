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

/**
 * Compute the admin overview telemetry (total users, active in last 7 days,
 * total corps) by scanning all user profile docs via a collectionGroup query.
 * Admin-only per Firestore rules.
 */
export async function getAdminOverviewStats(): Promise<AdminOverviewStats> {
  // Use collectionGroup to query all profile documents directly
  const profilesRef = collectionGroup(db, 'profile');
  const snapshot = await getDocs(profilesRef);

  let totalUsers = 0;
  let activeCount = 0, corpsCount = 0;

  for (const profileDoc of snapshot.docs) {
    // Only count profile docs from the marching-art users collection
    if (!profileDoc.ref.path.includes('artifacts/marching-art/users')) continue;

    totalUsers++;
    const data = profileDoc.data();

    // Check activity using lastLogin (Timestamp) or engagement.lastLogin (Timestamp or string)
    let lastLoginDate = null;
    if (data.lastLogin?.toDate) {
      lastLoginDate = data.lastLogin.toDate();
    } else if (data.engagement?.lastLogin) {
      // engagement.lastLogin may be a Firestore Timestamp (backend) or ISO string (client)
      const el = data.engagement.lastLogin;
      lastLoginDate = el.toDate ? el.toDate() : new Date(el);
    }

    if (lastLoginDate) {
      const days = (Date.now() - lastLoginDate.getTime()) / (1000 * 60 * 60 * 24);
      if (days <= 7) activeCount++;
    }

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
 * streak, corps count, total logins) by scanning all user profile docs via a
 * collectionGroup query. Admin-only per Firestore rules.
 */
export async function getUserEngagementStats(): Promise<UserEngagementStats> {
  // Use collectionGroup to query all profile documents directly
  // This is needed because user documents don't exist at the parent level,
  // only the nested profile/data documents exist
  const profilesRef = collectionGroup(db, 'profile');
  const snapshot = await getDocs(profilesRef);

  let totalUsers = 0;
  let activeCount = 0, corpsCount = 0, totalStreaks = 0, streakCount = 0, loginSum = 0;

  for (const profileDoc of snapshot.docs) {
    // Only count profile docs from the marching-art users collection
    if (!profileDoc.ref.path.includes('artifacts/marching-art/users')) continue;

    totalUsers++;
    const data = profileDoc.data();

    // Check activity using lastLogin (Timestamp) or engagement.lastLogin (Timestamp or string)
    let lastLoginDate = null;
    if (data.lastLogin?.toDate) {
      lastLoginDate = data.lastLogin.toDate();
    } else if (data.engagement?.lastLogin) {
      // engagement.lastLogin may be a Firestore Timestamp (backend) or ISO string (client)
      const el = data.engagement.lastLogin;
      lastLoginDate = el.toDate ? el.toDate() : new Date(el);
    }

    if (lastLoginDate) {
      const days = (Date.now() - lastLoginDate.getTime()) / (1000 * 60 * 60 * 24);
      if (days <= 7) activeCount++;
    }

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

  const avgStreak = streakCount > 0 ? Math.round(totalStreaks / streakCount * 10) / 10 : 0;
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
  // Use collectionGroup to query all profile documents directly.
  // Emails live in the owner-private `private/data` doc (never the public
  // profile doc), so fetch those separately and join by uid. This query is
  // admin-only per Firestore rules.
  const profilesRef = collectionGroup(db, 'profile');
  const privateRef = collectionGroup(db, 'private');
  const [snapshot, privateSnapshot] = await Promise.all([
    getDocs(profilesRef),
    getDocs(privateRef).catch(() => ({ docs: [] as QueryDocumentSnapshot<DocumentData>[] })),
  ]);

  const emailByUid: Record<string, string> = {};
  privateSnapshot.docs.forEach(privateDoc => {
    if (!privateDoc.ref.path.includes('artifacts/marching-art/users')) return;
    const uid = privateDoc.ref.path.split('/')[3];
    const email = privateDoc.data()?.email;
    if (uid && email) emailByUid[uid] = email;
  });

  const userList = snapshot.docs
    .filter(profileDoc => profileDoc.ref.path.includes('artifacts/marching-art/users'))
    .map(profileDoc => {
      const data = profileDoc.data();

      // Extract user ID from the doc path
      // Path format: artifacts/marching-art/users/{userId}/profile/data
      const pathParts = profileDoc.ref.path.split('/');
      const uid = pathParts[3];

      // Get last login from either lastLogin (Timestamp) or engagement.lastLogin (Timestamp or string)
      let lastLoginDate = null;
      if (data.lastLogin?.toDate) {
        lastLoginDate = data.lastLogin.toDate();
      } else if (data.engagement?.lastLogin) {
        // engagement.lastLogin may be a Firestore Timestamp (backend) or ISO string (client)
        const el = data.engagement.lastLogin;
        lastLoginDate = el.toDate ? el.toDate() : new Date(el);
      }

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
  return snap.docs.map(d => d.id).sort();
}

/**
 * Get a dci-data season doc's raw data, or null if it does not exist.
 */
export async function getDciDataDoc(docId: string): Promise<DocumentData | null> {
  const snap = await getDoc(doc(db, `dci-data/${docId}`));
  return snap.exists() ? snap.data() : null;
}

/**
 * Get the corpsValues array from a dci-data season doc.
 * Returns [] if the doc or array does not exist.
 */
export async function getCorpsValues(docId: string): Promise<CorpsValue[]> {
  const snap = await getDoc(doc(db, `dci-data/${docId}`));
  return snap.exists() ? (snap.data().corpsValues || []) : [];
}

/**
 * Overwrite the corpsValues array on a dci-data season doc (merge write, so
 * other fields on the doc are preserved).
 */
export async function saveCorpsValues(docId: string, values: CorpsValue[]): Promise<void> {
  await setDoc(
    doc(db, `dci-data/${docId}`),
    { corpsValues: values },
    { merge: true }
  );
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
 * Years with no doc are omitted from the map; each value is the doc's `data`
 * event array (or [] if missing).
 */
export async function getHistoricalScoresMap(
  years: Array<string | number>
): Promise<Record<string, DocumentData[]>> {
  const historicalPromises = years.map(year =>
    getDoc(doc(db, `historical_scores/${year}`))
  );
  const historicalDocs = await Promise.all(historicalPromises);

  const historical: Record<string, DocumentData[]> = {};
  historicalDocs.forEach((docSnap) => {
    if (docSnap.exists()) {
      historical[docSnap.id] = docSnap.data().data || [];
    }
  });
  return historical;
}

/**
 * Fetch the scraped event array for a single year from historical_scores.
 * Returns [] if the doc or array does not exist.
 */
export async function getHistoricalScoresForYear(
  year: string | number
): Promise<DocumentData[]> {
  const scoresDoc = await getDoc(doc(db, `historical_scores/${year}`));
  return scoresDoc.exists() ? (scoresDoc.data().data || []) : [];
}

// =============================================================================
// FANTASY RECAPS
// =============================================================================

/**
 * Get the set of competition days (offSeasonDay) that have been scored into
 * fantasy_recaps for a season.
 */
export async function getScoredRecapDays(seasonUid: string): Promise<Set<number>> {
  const daysSnap = await getDocs(collection(db, paths.fantasyRecapsDays(seasonUid)));
  const days = new Set<number>();
  daysSnap.forEach((d) => {
    const data = d.data();
    if (typeof data.offSeasonDay === 'number') days.add(data.offSeasonDay);
  });
  return days;
}
