import React, { useState } from 'react';
import { useUserStore } from '../store/userStore';

const HowToPlayPage = () => {
    const { loggedInProfile, isLoadingAuth } = useUserStore();
    const [activeSection, setActiveSection] = useState('basics');

    const sections = [
        { id: 'basics', title: 'Game Basics', icon: '🎯' },
        { id: 'corps', title: 'Creating Corps', icon: '🎺' },
        { id: 'scoring', title: 'Scoring System', icon: '📊' },
        { id: 'seasons', title: 'Seasons & Events', icon: '📅' },
        { id: 'leagues', title: 'Fantasy Leagues', icon: '🏆' },
        { id: 'strategy', title: 'Strategy Tips', icon: '💡' }
    ];

    const renderSectionContent = () => {
        switch (activeSection) {
            case 'basics':
                return (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-3">
                                Welcome to marching.art Fantasy
                            </h3>
                            <p className="text-text-secondary dark:text-text-secondary-dark mb-4">
                                marching.art is a fantasy sports game based on drum corps competitions. Create your ideal corps 
                                by selecting performers from different real-world drum corps, then compete against other managers 
                                as your fantasy corps performs at virtual competitions.
                            </p>
                            <div className="bg-primary/10 dark:bg-primary-dark/10 border border-primary/20 dark:border-primary-dark/20 rounded-theme p-4">
                                <h4 className="font-bold text-primary dark:text-primary-dark mb-2">Key Concepts:</h4>
                                <ul className="space-y-2 text-sm text-text-secondary dark:text-text-secondary-dark">
                                    <li>• Build fantasy corps using real drum corps performers</li>
                                    <li>• Compete in automated competitions based on historical data</li>
                                    <li>• Manage multiple corps across different competitive classes</li>
                                    <li>• Join leagues to compete directly with friends</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                );
                
            case 'corps':
                return (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-3">
                                Building Your Fantasy Corps
                            </h3>
                            <p className="text-text-secondary dark:text-text-secondary-dark mb-4">
                                Each fantasy corps requires performers in 8 different caption categories. You'll select 
                                real drum corps to fill each position, staying within your point budget.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-surface dark:bg-surface-dark border border-accent dark:border-accent-dark rounded-theme p-4">
                                <h4 className="font-bold text-text-primary dark:text-text-primary-dark mb-3">Caption Categories</h4>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-text-secondary dark:text-text-secondary-dark">GE1 & GE2:</span>
                                        <span className="text-text-primary dark:text-text-primary-dark">General Effect</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-text-secondary dark:text-text-secondary-dark">VP & VA:</span>
                                        <span className="text-text-primary dark:text-text-primary-dark">Visual Performance & Analysis</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-text-secondary dark:text-text-secondary-dark">CG:</span>
                                        <span className="text-text-primary dark:text-text-primary-dark">Color Guard</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-text-secondary dark:text-text-secondary-dark">B, MA, P:</span>
                                        <span className="text-text-primary dark:text-text-primary-dark">Music (Brass, Analysis, Percussion)</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-surface dark:bg-surface-dark border border-accent dark:border-accent-dark rounded-theme p-4">
                                <h4 className="font-bold text-text-primary dark:text-text-primary-dark mb-3">Corps Classes</h4>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                                        <div>
                                            <p className="font-semibold text-text-primary dark:text-text-primary-dark">World Class (150 pts)</p>
                                            <p className="text-xs text-text-secondary dark:text-text-secondary-dark">Elite competition tier</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                                        <div>
                                            <p className="font-semibold text-text-primary dark:text-text-primary-dark">Open Class (120 pts)</p>
                                            <p className="text-xs text-text-secondary dark:text-text-secondary-dark">Competitive tier</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                        <div>
                                            <p className="font-semibold text-text-primary dark:text-text-primary-dark">A Class (60 pts)</p>
                                            <p className="text-xs text-text-secondary dark:text-text-secondary-dark">Budget-friendly option</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'scoring':
                return (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-3">
                                How Scoring Works
                            </h3>
                            <p className="text-text-secondary dark:text-text-secondary-dark mb-4">
                                Your fantasy corps earn points based on the historical performance of the real drum corps 
                                you've selected. The game uses advanced algorithms to simulate realistic competition results.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div className="bg-surface dark:bg-surface-dark border border-accent dark:border-accent-dark rounded-theme p-4">
                                    <h4 className="font-bold text-text-primary dark:text-text-primary-dark mb-2">Score Calculation</h4>
                                    <div className="text-sm text-text-secondary dark:text-text-secondary-dark space-y-2">
                                        <p>• Each caption contributes to your total score</p>
                                        <p>• GE1 + GE2 = General Effect score</p>
                                        <p>• (VP + VA + CG) ÷ 2 = Visual score</p>
                                        <p>• (B + MA + P) ÷ 2 = Music score</p>
                                        <p>• <strong>Total = GE + Visual + Music</strong></p>
                                    </div>
                                </div>

                                <div className="bg-surface dark:bg-surface-dark border border-accent dark:border-accent-dark rounded-theme p-4">
                                    <h4 className="font-bold text-text-primary dark:text-text-primary-dark mb-2">Historical Data</h4>
                                    <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                        Scores are based on real DCI competition results, with algorithms that account for 
                                        performance trends, venue effects, and seasonal progression.
                                    </p>
                                </div>
                            </div>

                            <div className="bg-primary/10 dark:bg-primary-dark/10 border border-primary/20 dark:border-primary-dark/20 rounded-theme p-4">
                                <h4 className="font-bold text-primary dark:text-primary-dark mb-3">Season Scoring</h4>
                                <div className="text-sm text-text-secondary dark:text-text-secondary-dark space-y-2">
                                    <p>• Your season score is your most recent competition result</p>
                                    <p>• Scores generally improve throughout the season</p>
                                    <p>• Championship events have higher stakes</p>
                                    <p>• Not all corps perform at every show</p>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'seasons':
                return (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-3">
                                Seasons & Competition Events
                            </h3>
                            <p className="text-text-secondary dark:text-text-secondary-dark mb-4">
                                marching.art features two types of competitive seasons, each with different formats and schedules.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-surface dark:bg-surface-dark border border-accent dark:border-accent-dark rounded-theme p-4">
                                <h4 className="font-bold text-text-primary dark:text-text-primary-dark mb-3">Live Seasons (Summer)</h4>
                                <div className="text-sm text-text-secondary dark:text-text-secondary-dark space-y-2">
                                    <p>• 10-week season following real DCI schedule</p>
                                    <p>• Select up to 4 shows per week</p>
                                    <p>• Real-time scoring when available</p>
                                    <p>• Culminates in DCI World Championships</p>
                                    <p>• Higher stakes and more competitive</p>
                                </div>
                            </div>

                            <div className="bg-surface dark:bg-surface-dark border border-accent dark:border-accent-dark rounded-theme p-4">
                                <h4 className="font-bold text-text-primary dark:text-text-primary-dark mb-3">Off-Seasons (Year-round)</h4>
                                <div className="text-sm text-text-secondary dark:text-text-secondary-dark space-y-2">
                                    <p>• 7-week themed seasons</p>
                                    <p>• Simulated competitions with historical data</p>
                                    <p>• More frequent lineup changes allowed</p>
                                    <p>• Great for learning and experimenting</p>
                                    <p>• Themed around different eras or concepts</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-accent/10 dark:bg-accent-dark/10 border border-accent/20 dark:border-accent-dark/20 rounded-theme p-4">
                            <h4 className="font-bold text-text-primary dark:text-text-primary-dark mb-2">Championship Progression</h4>
                            <p className="text-sm text-text-secondary dark:text-text-secondary-dark mb-3">
                                Both season types feature championship events where only the top-performing corps advance:
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                                <div className="text-center">
                                    <p className="font-bold text-text-primary dark:text-text-primary-dark">Prelims</p>
                                    <p className="text-text-secondary dark:text-text-secondary-dark">All corps compete</p>
                                </div>
                                <div className="text-center">
                                    <p className="font-bold text-text-primary dark:text-text-primary-dark">Semifinals</p>
                                    <p className="text-text-secondary dark:text-text-secondary-dark">Top 25 advance</p>
                                </div>
                                <div className="text-center">
                                    <p className="font-bold text-text-primary dark:text-text-primary-dark">Finals</p>
                                    <p className="text-text-secondary dark:text-text-secondary-dark">Top 12 compete</p>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'leagues':
                return (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-3">
                                Fantasy Leagues
                            </h3>
                            <p className="text-text-secondary dark:text-text-secondary-dark mb-4">
                                Create or join private leagues to compete directly with friends. Leagues add head-to-head 
                                matchups and champion recognition to the fantasy experience.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div className="bg-surface dark:bg-surface-dark border border-accent dark:border-accent-dark rounded-theme p-4">
                                    <h4 className="font-bold text-text-primary dark:text-text-primary-dark mb-2">Creating a League</h4>
                                    <div className="text-sm text-text-secondary dark:text-text-secondary-dark space-y-1">
                                        <p>• Any user can create a league</p>
                                        <p>• Share invite code with friends</p>
                                        <p>• League creator becomes admin</p>
                                        <p>• No limit on member count</p>
                                    </div>
                                </div>

                                <div className="bg-surface dark:bg-surface-dark border border-accent dark:border-accent-dark rounded-theme p-4">
                                    <h4 className="font-bold text-text-primary dark:text-text-primary-dark mb-2">Weekly Matchups</h4>
                                    <div className="text-sm text-text-secondary dark:text-text-secondary-dark space-y-1">
                                        <p>• Automated weekly pairings</p>
                                        <p>• Head-to-head score comparisons</p>
                                        <p>• Win/loss records tracked</p>
                                        <p>• Class-specific matchups</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-theme p-4">
                                <h4 className="font-bold text-green-800 dark:text-green-200 mb-2">League Benefits</h4>
                                <div className="text-sm text-green-700 dark:text-green-300 space-y-2">
                                    <p>• Private leaderboards for your group</p>
                                    <p>• Season champion recognition</p>
                                    <p>• Weekly matchup excitement</p>
                                    <p>• Achievement badges for winners</p>
                                    <p>• Bragging rights among friends</p>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'strategy':
                return (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-3">
                                Strategy & Tips
                            </h3>
                            <p className="text-text-secondary dark:text-text-secondary-dark mb-4">
                                Maximize your fantasy performance with these strategic insights and best practices.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div className="bg-surface dark:bg-surface-dark border border-accent dark:border-accent-dark rounded-theme p-4">
                                    <h4 className="font-bold text-text-primary dark:text-text-primary-dark mb-2">Lineup Building</h4>
                                    <div className="text-sm text-text-secondary dark:text-text-secondary-dark space-y-1">
                                        <p>• Balance high-point and reliable corps</p>
                                        <p>• Consider seasonal performance trends</p>
                                        <p>• Don't always pick the obvious choices</p>
                                        <p>• Leave room for mid-season trades</p>
                                    </div>
                                </div>

                                <div className="bg-surface dark:bg-surface-dark border border-accent dark:border-accent-dark rounded-theme p-4">
                                    <h4 className="font-bold text-text-primary dark:text-text-primary-dark mb-2">Trade Management</h4>
                                    <div className="text-sm text-text-secondary dark:text-text-secondary-dark space-y-1">
                                        <p>• Save trades for when they matter most</p>
                                        <p>• Week 1 often has unlimited trades</p>
                                        <p>• Monitor corps performance trends</p>
                                        <p>• Don't waste trades on minimal gains</p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="bg-surface dark:bg-surface-dark border border-accent dark:border-accent-dark rounded-theme p-4">
                                    <h4 className="font-bold text-text-primary dark:text-text-primary-dark mb-2">Show Selection</h4>
                                    <div className="text-sm text-text-secondary dark:text-text-secondary-dark space-y-1">
                                        <p>• Not all shows score the same</p>
                                        <p>• Championship events are automatic</p>
                                        <p>• Regional events may split competition</p>
                                        <p>• Check who else is attending</p>
                                    </div>
                                </div>

                                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-theme p-4">
                                    <h4 className="font-bold text-yellow-800 dark:text-yellow-200 mb-2">Pro Tips</h4>
                                    <div className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                                        <p>• Study the statistics page for insights</p>
                                        <p>• Create multiple corps in different classes</p>
                                        <p>• Join leagues for extra competition</p>
                                        <p>• Experiment during off-seasons</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            default:
                return <div>Section not found</div>;
        }
    };

    return (
        <div className="min-h-screen bg-background dark:bg-background-dark">
            <div className="container mx-auto px-4 py-8">
                <div className="space-y-8">
                    {/* Page Header */}
                    <div className="text-center">
                        <h1 className="text-3xl sm:text-4xl font-bold text-primary dark:text-primary-dark">
                            How to Play
                        </h1>
                        <p className="text-text-secondary dark:text-text-secondary-dark mt-2">
                            Complete guide to marching.art fantasy drum corps
                        </p>
                    </div>

                    {/* Quick Start */}
                    {!loggedInProfile && (
                        <div className="bg-primary/10 dark:bg-primary-dark/10 border border-primary/20 dark:border-primary-dark/20 rounded-theme p-6 text-center">
                            <h3 className="text-xl font-bold text-primary dark:text-primary-dark mb-2">
                                Ready to Start Playing?
                            </h3>
                            <p className="text-text-secondary dark:text-text-secondary-dark mb-4">
                                Create your account and build your first fantasy corps in minutes.
                            </p>
                            <button className="bg-primary hover:opacity-90 text-on-primary font-bold py-3 px-6 rounded-theme">
                                Sign Up Now
                            </button>
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                        {/* Navigation */}
                        <div className="lg:col-span-1">
                            <div className="bg-surface dark:bg-surface-dark p-4 rounded-theme border border-accent dark:border-accent-dark shadow-theme sticky top-8">
                                <h3 className="font-bold text-text-primary dark:text-text-primary-dark mb-4">
                                    Guide Sections
                                </h3>
                                <nav className="space-y-2">
                                    {sections.map(section => (
                                        <button
                                            key={section.id}
                                            onClick={() => setActiveSection(section.id)}
                                            className={`w-full text-left p-3 rounded-theme transition-all ${
                                                activeSection === section.id
                                                    ? 'bg-primary text-on-primary shadow-lg'
                                                    : 'text-text-primary dark:text-text-primary-dark hover:bg-accent dark:hover:bg-accent-dark/20'
                                            }`}
                                        >
                                            <span className="mr-3">{section.icon}</span>
                                            {section.title}
                                        </button>
                                    ))}
                                </nav>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="lg:col-span-3">
                            <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
                                {renderSectionContent()}
                            </div>
                        </div>
                    </div>

                    {/* Footer CTA */}
                    <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme text-center">
                        <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-2">
                            Still Have Questions?
                        </h3>
                        <p className="text-text-secondary dark:text-text-secondary-dark mb-4">
                            Join our Discord community for live help, strategy discussions, and game updates.
                        </p>
                        <a 
                            href="https://discord.gg/YvFRJ97A5H" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-block bg-secondary hover:opacity-90 text-on-secondary font-bold py-3 px-6 rounded-theme"
                        >
                            Join Discord Community
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HowToPlayPage;