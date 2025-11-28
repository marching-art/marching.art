// AwardsTab - Caption awards and special recognitions for league members
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Award, Star, Eye, Music, Flame, Sparkles, AlertCircle } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
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
          const recapsRef = doc(db, `fantasy_recaps/${seasonData.seasonUid}`);
          const recapsDoc = await getDoc(recapsRef);

          if (recapsDoc.exists()) {
            const recaps = recapsDoc.data().recaps || [];
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
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-8 text-center"
      >
        <p className="text-cream-500/60">Loading awards...</p>
      </motion.div>
    );
  }

  const awardCards = [
    {
      id: 'highScore',
      title: 'High Score Award',
      subtitle: 'Highest single-show score',
      icon: Sparkles,
      color: 'gold',
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
    gold: 'from-yellow-500/20 to-yellow-600/10 border-yellow-500/30',
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
    green: 'from-green-500/20 to-green-600/10 border-green-500/30',
    orange: 'from-orange-500/20 to-orange-600/10 border-orange-500/30'
  };

  const iconColorClasses = {
    gold: 'text-yellow-500',
    purple: 'text-purple-500',
    blue: 'text-blue-500',
    green: 'text-green-500',
    orange: 'text-orange-500'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-4"
    >
      <div className="card p-6">
        <h2 className="text-xl md:text-2xl font-bold text-cream-100 mb-6 flex items-center gap-2">
          <Award className="w-5 h-5 md:w-6 md:h-6 text-gold-500" />
          Season Awards
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {awardCards.map(award => {
            const Icon = award.icon;
            return (
              <div
                key={award.id}
                className={`p-4 rounded-xl border bg-gradient-to-br ${colorClasses[award.color]}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg bg-charcoal-900/50 ${iconColorClasses[award.color]}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-cream-100">{award.title}</h4>
                    <p className="text-xs text-cream-500/60 mb-2">{award.subtitle}</p>

                    {award.leader ? (
                      <div className="mt-2">
                        <p className="font-semibold text-cream-100 truncate">
                          {getDirectorName(award.leader)}
                        </p>
                        <p className={`text-lg font-bold ${iconColorClasses[award.color]}`}>
                          {award.value}{award.valueSuffix || ' pts'}
                        </p>
                        {award.extra && (
                          <p className="text-xs text-cream-500/60 truncate">{award.extra}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-cream-500/40 mt-2">No data yet</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Info about awards */}
      <div className="card p-4 bg-charcoal-900/50">
        <p className="text-sm text-cream-500/60 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            Awards are calculated from all shows attended by league members this season.
            Final awards will be presented at the end of the season.
          </span>
        </p>
      </div>
    </motion.div>
  );
};

export default AwardsTab;
