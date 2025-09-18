import React from 'react';

// A helper component for consistent section styling
const Section = ({ title, children }) => (
    <div className="border-b border-accent dark:border-accent-dark pb-6 mb-6">
        <h2 className="text-3xl font-bold text-primary dark:text-primary-dark mb-3">{title}</h2>
        <div className="space-y-3 text-text-secondary dark:text-text-secondary-dark leading-relaxed">
            {children}
        </div>
    </div>
);

const HowToPlayPage = () => {
    return (
        <div className="max-w-4xl mx-auto p-4 md:p-8">
            <h1 className="text-5xl font-extrabold text-text-primary dark:text-text-primary-dark mb-8 text-center tracking-tight">
                How to Play marching.art
            </h1>

            <div className="bg-surface dark:bg-surface-dark p-6 md:p-8 rounded-theme border-theme border-accent dark:border-accent-dark shadow-theme">
                <Section title="The Objective">
                    <p>
                        Welcome, manager! Your goal is to create, manage, and lead your own fantasy drum corps to victory. You'll assemble a lineup from legends of the past, compete in simulated and live events, and climb the leaderboards to prove you're the ultimate drum corps strategist.
                    </p>
                </Section>

                <Section title="Understanding Seasons">
                    <p>
                        The game is played in seasons, which come in two distinct types:
                    </p>
                    <ul className="list-disc list-inside space-y-2 pl-4">
                        <li>
                            <strong>Live Seasons:</strong> These run concurrently with the real-world DCI summer tour. The scores your corps earn are based on the actual results of DCI competitions. The schedule mirrors the 10-week DCI season, culminating at Finals.
                        </li>
                        <li>
                            <strong>Off-Seasons:</strong> The competition never stops! During the DCI off-season, we run multiple 7-week themed seasons. Scores in these seasons are dynamically simulated using a sophisticated model based on thousands of historical scores, ensuring every season is unique and exciting.
                        </li>
                    </ul>
                </Section>

                <Section title="Managing Your Corps">
                    <p>
                        You aren't limited to just one corps! You can create and manage up to three distinct corps, one in each competitive class:
                    </p>
                    <ul className="list-disc list-inside space-y-2 pl-4">
                        <li><strong>World Class:</strong> The highest tier of competition, with a point cap of 150 for your lineup.</li>
                        <li><strong>Open Class:</strong> A competitive mid-tier with a lineup point cap of 120.</li>
                        <li><strong>A Class:</strong> A great starting point or budget-friendly option, with a lineup point cap of 60.</li>
                    </ul>
                    <p>
                        You'll use the Dashboard to create new corps, edit lineups, and manage show selections for each of your active corps.
                    </p>
                </Section>

                <Section title="Building Your Lineup & Scoring">
                    <p>
                        The heart of your corps is its lineup. For each of the eight major captions (GE1, GE2, VP, VA, CG, Brass, Music Analysis, Percussion), you must select one real-world historical corps. Each historical corps has a point value based on its final placement, and your total lineup must stay under your class's point cap.
                    </p>
                    <p>
                        To score points, you must select up to <strong>four shows per week</strong> for each of your corps to "attend" from the season schedule. Your fantasy score for that show is calculated based on the performance of the historical corps in your lineup.
                    </p>
                </Section>

                <Section title="Trades & Roster Management">
                    <p>
                        You can change your lineup throughout the season by making trades. Each week, you are typically allowed <strong>three trades per corps</strong>. Use them wisely to adapt your strategy! Note: During the first week of any season, trades are unlimited to allow you to perfect your initial roster.
                    </p>
                </Section>
                
                <Section title="Leagues & Community">
                     <p>
                        Compete against the entire marching.art community on the global leaderboards, or create a private league and invite your friends using a unique invite code. You can join the official community, discuss scores, and get help on our Discord server.
                    </p>
                </Section>
            </div>
        </div>
    );
};

export default HowToPlayPage;