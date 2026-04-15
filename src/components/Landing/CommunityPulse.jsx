// CommunityPulse - Landing page sidebar widget showing live community activity
// Creates social proof through real-time activity signals.
// Data source (leagues collection) is auth-gated at the Firestore rule
// level, so this widget only renders for authenticated users. We do not
// fabricate activity for unauthenticated visitors — that would create
// misleading social proof.

import React, { memo, useState, useEffect } from 'react';
import { Users, TrendingUp, Award, Activity } from 'lucide-react';
import { db } from '../../firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Cache to avoid re-fetching on every render
let activityCache = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const CommunityPulse = memo(() => {
  const isAuthenticated = !!getAuth().currentUser;
  const [activities, setActivities] = useState(activityCache || []);
  const [loading, setLoading] = useState(isAuthenticated && !activityCache);

  useEffect(() => {
    // The leagues collection requires authentication to list (see
    // firestore.rules). Unauthenticated visitors have no public
    // activity source to read from, so we render nothing rather than
    // show a perpetually-loading placeholder or fabricated activity.
    if (!isAuthenticated) return;

    const fetchActivity = async () => {
      // Use cache if fresh
      if (activityCache && Date.now() - cacheTimestamp < CACHE_TTL) {
        setActivities(activityCache);
        setLoading(false);
        return;
      }

      try {
        // Fetch recent league creations as a proxy for community activity
        const leaguesRef = collection(db, 'artifacts', 'fantasy_drum_corps_v1', 'leagues');
        const q = query(leaguesRef, orderBy('createdAt', 'desc'), limit(5));
        const snapshot = await getDocs(q);

        const items = [];

        snapshot.docs.forEach(doc => {
          const data = doc.data();
          const memberCount = data.members?.length || data.memberCount || 1;
          const createdAt = data.createdAt?.toDate?.() || new Date();
          const hoursAgo = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60));

          items.push({
            id: doc.id,
            type: 'league',
            text: `New league created with ${memberCount} director${memberCount !== 1 ? 's' : ''}`,
            time: hoursAgo < 1 ? 'Just now' : hoursAgo < 24 ? `${hoursAgo}h ago` : `${Math.floor(hoursAgo / 24)}d ago`,
            icon: 'users',
          });
        });

        // Sort by recency and take top 4
        const sorted = items.slice(0, 4);

        activityCache = sorted;
        cacheTimestamp = Date.now();
        setActivities(sorted);
      } catch (error) {
        if (error?.code !== 'permission-denied') {
          console.error('CommunityPulse: Failed to fetch activity', error);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchActivity();
  }, [isAuthenticated]);

  // Do not render for unauthenticated visitors — no public data source
  // exists, and an empty widget would signal a dead platform.
  if (!isAuthenticated) return null;

  // Once we've loaded and there's genuinely no real activity to show,
  // also render nothing rather than a misleading "loading" placeholder.
  if (!loading && activities.length === 0) return null;

  const iconMap = {
    users: <Users className="w-3.5 h-3.5 text-blue-500" />,
    trending: <TrendingUp className="w-3.5 h-3.5 text-green-500" />,
    award: <Award className="w-3.5 h-3.5 text-yellow-500" />,
  };

  return (
    <div className="bg-[#1a1a1a] border border-[#333] rounded-sm overflow-hidden">
      <div className="bg-[#222] px-4 py-3 border-b border-[#333] flex items-center gap-2">
        <Activity className="w-3.5 h-3.5 text-green-500" />
        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
          Community Pulse
        </h3>
        <span className="ml-auto relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
        </span>
      </div>

      {loading ? (
        <div className="p-4 space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-[#333] animate-pulse" />
              <div className="flex-1">
                <div className="w-3/4 h-3 bg-[#333] animate-pulse mb-1" />
                <div className="w-1/3 h-2 bg-[#333] animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="divide-y divide-[#222]">
          {activities.map((activity) => (
            <div key={activity.id} className="px-4 py-2.5 flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-[#222] flex items-center justify-center flex-shrink-0">
                {iconMap[activity.icon] || iconMap.users}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-300 truncate">{activity.text}</p>
                <p className="text-[10px] text-gray-600">{activity.time}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

export default CommunityPulse;
