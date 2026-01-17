// AwardsTab - Caption awards and special recognitions for league members (Stadium HUD)
import React, { useState, useEffect } from 'react';
import { m } from 'framer-motion';
import { Award, Star, Eye, Music, Flame, Sparkles, AlertCircle } from 'lucide-react';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase';

const AwardsTab = ({ league }) => {
  const [awards, setAwards] = useState(null);
  const [memberProfiles, setMemberProfiles] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAwards = async () => {
      if (!league?.members?.length) return;
      setLoading(true);

      try {
        // Fetch member profiles
        const profiles = {};
        await Promise.all(league.members.map(async (uid) => {
          const profileRef = doc(db, `artifacts/marching-art/users/${uid}/profile/data`);
          const profileDoc = await getDoc(profileRef);
          if (profileDoc.exists()) {
            profiles[uid] = profileDoc.data();
          }
        }));
        setMemberProfiles(profiles);

        // Fetch season and recaps
        const seasonRef = doc(db, 'game-settings/season');
        const seasonDoc = await getDoc(seasonRef);

        if (seasonDoc.exists()) {
          const seasonData = seasonDoc.data();
          // Try new subcollection format first, fallback to legacy single-document format
          const recapsCollectionRef = collection(db, 'fantasy_recaps', seasonData.seasonUid, 'days');
          const recapsSnapshot = await getDocs(recapsCollectionRef);

          let recaps = [];
          if (!recapsSnapshot.empty) {
            recaps = recapsSnapshot.docs.map(d => d.data());
          } else {
            // Fallback to legacy single-document format
            const legacyDocRef = doc(db, 'fantasy_recaps', seasonData.seasonUid);
            const legacyDoc = await getDoc(legacyDocRef);
            if (legacyDoc.exists()) {
              recaps = legacyDoc.data().recaps || [];
            }
          }

          if (recaps.length > 0) {
            const memberUids = new Set(league.members);

            // Calculate award leaders
            const leaderboards = {
              highScore: { uid: null, score: 0, eventName: '' },
              totalGE: {},
              totalVisual: {},
              totalMusic: {},
              totalScore: {},
              showsAttended: {}
            };

            recaps.forEach(dayRecap => {
              dayRecap.shows?.forEach(show => {
                show.results?.forEach(result => {
                  if (!memberUids.has(result.uid)) return;

                  // High score (single show)
                  if ((result.totalScore || 0) > leaderboards.highScore.score) {
                    leaderboards.highScore = {
                      uid: result.uid,
                      score: result.totalScore,
                      eventName: show.eventName
                    };
                  }

                  // Cumulative scores
                  if (!leaderboards.totalGE[result.uid]) {
                    leaderboards.totalGE[result.uid] = 0;
                    leaderboards.totalVisual[result.uid] = 0;
                    leaderboards.totalMusic[result.uid] = 0;
                    leaderboards.totalScore[result.uid] = 0;
                    leaderboards.showsAttended[result.uid] = 0;
                  }

                  leaderboards.totalGE[result.uid] += result.geScore || 0;
                  leaderboards.totalVisual[result.uid] += result.visualScore || 0;
                  leaderboards.totalMusic[result.uid] += result.musicScore || 0;
                  leaderboards.totalScore[result.uid] += result.totalScore || 0;
                  leaderboards.showsAttended[result.uid] += 1;
                });
              });
            });

            // Find leaders for each category
            const findLeader = (obj) => {
              const entries = Object.entries(obj);
              if (entries.length === 0) return null;
              entries.sort((a, b) => b[1] - a[1]);
              return { uid: entries[0][0], score: entries[0][1] };
            };

            setAwards({
              highScore: leaderboards.highScore,
              geLeader: findLeader(leaderboards.totalGE),
              visualLeader: findLeader(leaderboards.totalVisual),
              musicLeader: findLeader(leaderboards.totalMusic),
              ironman: findLeader(leaderboards.showsAttended)
            });
          }
        }
      } catch (error) {
        console.error('Error fetching awards:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAwards();
  }, [league]);

  const getDirectorName = (uid) => {
    if (!uid) return '—';
    const profile = memberProfiles[uid];
    return profile?.displayName || profile?.username || `Director ${uid.slice(0, 6)}`;
  };

  if (loading) {
    return (
      <m.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-black/40 backdrop-blur-md border border-white/10 rounded-sm p-8 text-center"
      >
        <p className="text-yellow-50/60">Loading awards...</p>
      </m.div>
    );
  }

  const awardCards = [
    {
      id: 'highScore',
      title: 'High Score Award',
      subtitle: 'Highest single-show score',
      icon: Sparkles,
      color: 'yellow',
      leader: awards?.highScore?.uid,
      value: awards?.highScore?.score?.toFixed(1),
      extra: awards?.highScore?.eventName
    },
    {
      id: 'ge',
      title: 'GE Excellence',
      subtitle: 'General Effect leader',
      icon: Star,
      color: 'purple',
      leader: awards?.geLeader?.uid,
      value: awards?.geLeader?.score?.toFixed(1)
    },
    {
      id: 'visual',
      title: 'Visual Excellence',
      subtitle: 'Visual caption leader',
      icon: Eye,
      color: 'blue',
      leader: awards?.visualLeader?.uid,
      value: awards?.visualLeader?.score?.toFixed(1)
    },
    {
      id: 'music',
      title: 'Music Excellence',
      subtitle: 'Music caption leader',
      icon: Music,
      color: 'green',
      leader: awards?.musicLeader?.uid,
      value: awards?.musicLeader?.score?.toFixed(1)
    },
    {
      id: 'ironman',
      title: 'Iron Director',
      subtitle: 'Most shows attended',
      icon: Flame,
      color: 'orange',
      leader: awards?.ironman?.uid,
      value: awards?.ironman?.score,
      valueSuffix: ' shows'
    }
  ];

  const colorClasses = {
    yellow: { border: 'border-yellow-500/30', bg: 'from-yellow-500/20 to-yellow-600/10', text: 'text-yellow-400', glow: 'drop-shadow-[0_0_6px_rgba(234,179,8,0.5)]' },
    purple: { border: 'border-purple-500/30', bg: 'from-purple-500/20 to-purple-600/10', text: 'text-purple-400', glow: 'drop-shadow-[0_0_6px_rgba(168,85,247,0.5)]' },
    blue: { border: 'border-blue-500/30', bg: 'from-blue-500/20 to-blue-600/10', text: 'text-blue-400', glow: 'drop-shadow-[0_0_6px_rgba(59,130,246,0.5)]' },
    green: { border: 'border-green-500/30', bg: 'from-green-500/20 to-green-600/10', text: 'text-green-400', glow: 'drop-shadow-[0_0_6px_rgba(74,222,128,0.5)]' },
    orange: { border: 'border-orange-500/30', bg: 'from-orange-500/20 to-orange-600/10', text: 'text-orange-400', glow: 'drop-shadow-[0_0_6px_rgba(251,146,60,0.5)]' }
  };

  return (
    <m.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-4"
    >
      <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-sm p-6">
        <h2 className="text-xl md:text-2xl font-display font-bold text-yellow-50 mb-6 flex items-center gap-2">
          <Award className="w-5 h-5 md:w-6 md:h-6 text-yellow-400 drop-shadow-[0_0_6px_rgba(234,179,8,0.5)]" />
          Season Awards
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {awardCards.map(award => {
            const Icon = award.icon;
            const colors = colorClasses[award.color];
            return (
              <div
                key={award.id}
                className={`p-4 rounded-sm border bg-gradient-to-br ${colors.bg} ${colors.border} shadow-[0_0_15px_rgba(0,0,0,0.2)]`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-sm bg-black/30 ${colors.text}`}>
                    <Icon className={`w-5 h-5 ${colors.glow}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-display font-bold text-yellow-50">{award.title}</h4>
                    <p className="text-xs text-yellow-50/70 mb-2">{award.subtitle}</p>

                    {award.leader ? (
                      <div className="mt-2">
                        <p className="font-display font-semibold text-yellow-50 truncate">
                          {getDirectorName(award.leader)}
                        </p>
                        <p className={`text-lg font-display font-bold ${colors.text} ${colors.glow}`}>
                          {award.value}{award.valueSuffix || ' pts'}
                        </p>
                        {award.extra && (
                          <p className="text-xs text-yellow-50/40 truncate">{award.extra}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-yellow-50/30 mt-2">No data yet</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Info about awards */}
      <div className="bg-black/30 backdrop-blur-sm border border-white/5 rounded-sm p-4">
        <p className="text-sm text-yellow-50/70 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-yellow-400/50" />
          <span>
            Awards are calculated from all shows attended by league members this season.
            Final awards will be presented at the end of the season.
          </span>
        </p>
      </div>
    </m.div>
  );
};

export default AwardsTab;
