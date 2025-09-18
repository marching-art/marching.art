import React from 'react';
import Icon from '../ui/Icon';

// A map to associate achievement icons with SVG paths
const achievementIcons = {
    trophy: "M16.5 18.5A2.5 2.5 0 0019 16V7a2 2 0 00-2-2h- verduras.5a2.5 2.5 0 00-5 0H9a2 2 0 00-2 2v9a2.5 2.5 0 002.5 2.5h7zM9 7h7v9a.5.5 0 01-.5.5h-6A.5.5 0 019 16V7zm1-1a1 1 0 00-1 1v1h2V7a1 1 0 00-1-1zm5 0a1 1 0 00-1 1v1h2V7a1 1 0 00-1-1z",
    default: "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
};

const AchievementsCase = ({ achievements = [] }) => {
    return (
        <div>
            <h3 className="text-2xl font-bold text-primary dark:text-primary-dark mb-4">Achievements</h3>
            {achievements.length > 0 ? (
                <div className="space-y-4">
                    {achievements.sort((a, b) => b.earnedAt.toDate() - a.earnedAt.toDate()).map(ach => (
                        <div key={ach.id} className="flex items-start gap-4 p-3 bg-background dark:bg-background-dark rounded-theme">
                            <div className="flex-shrink-0 text-yellow-500">
                                <Icon path={achievementIcons[ach.icon] || achievementIcons.default} className="w-10 h-10" />
                            </div>
                            <div>
                                <p className="font-bold text-text-primary dark:text-text-primary-dark">{ach.name}</p>
                                <p className="text-sm text-text-secondary dark:text-text-secondary-dark">{ach.description}</p>
                                <p className="text-xs text-text-secondary/70 dark:text-text-secondary-dark/70 mt-1">
                                    Earned on {ach.earnedAt.toDate().toLocaleDateString()}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-sm text-text-secondary dark:text-text-secondary-dark italic">No achievements have been unlocked yet.</p>
            )}
        </div>
    );
};

export default AchievementsCase;