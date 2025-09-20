import React from 'react';
import { Link } from 'react-router-dom';
import Icon from '../ui/Icon';

const ScheduleAuthPrompt = ({ onSignUpClick, onLoginClick }) => {
    return (
        <div className="min-h-screen bg-background dark:bg-background-dark">
            <div className="container mx-auto px-4 py-16">
                <div className="max-w-4xl mx-auto">
                    {/* Hero Section */}
                    <div className="text-center mb-12">
                        <div className="text-6xl mb-6">🗓️</div>
                        <h1 className="text-4xl md:text-5xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
                            Full Schedule Access
                        </h1>
                        <p className="text-xl text-text-secondary dark:text-text-secondary-dark mb-8 max-w-2xl mx-auto">
                            Join marching.art to unlock the complete drum corps schedule experience with advanced features designed for serious fans and directors.
                        </p>
                        
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <button
                                onClick={onSignUpClick}
                                className="bg-primary text-on-primary px-8 py-4 rounded-theme font-bold text-lg hover:bg-primary/90 transition-all shadow-lg"
                            >
                                Start Playing Free
                            </button>
                            <button
                                onClick={onLoginClick}
                                className="bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark px-8 py-4 rounded-theme font-bold text-lg border-2 border-accent dark:border-accent-dark hover:bg-accent/10 transition-all"
                            >
                                Sign In
                            </button>
                        </div>
                    </div>

                    {/* Features Grid */}
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
                        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark">
                            <div className="w-12 h-12 bg-primary/20 rounded-theme flex items-center justify-center mb-4">
                                <Icon path="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" 
                                      className="w-6 h-6 text-primary" />
                            </div>
                            <h3 className="text-lg font-bold text-text-primary dark:text-text-primary-dark mb-2">
                                Live Corps Tracking
                            </h3>
                            <p className="text-text-secondary dark:text-text-secondary-dark">
                                See which corps are attending each show in real-time, track your favorites, and follow your corps' complete schedule.
                            </p>
                        </div>

                        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark">
                            <div className="w-12 h-12 bg-green-500/20 rounded-theme flex items-center justify-center mb-4">
                                <Icon path="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.563.563 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" 
                                      className="w-6 h-6 text-green-500" />
                            </div>
                            <h3 className="text-lg font-bold text-text-primary dark:text-text-primary-dark mb-2">
                                Personal Favorites
                            </h3>
                            <p className="text-text-secondary dark:text-text-secondary-dark">
                                Save your favorite shows, get notifications for important events, and create your personalized competition calendar.
                            </p>
                        </div>

                        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark">
                            <div className="w-12 h-12 bg-blue-500/20 rounded-theme flex items-center justify-center mb-4">
                                <Icon path="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" 
                                      className="w-6 h-6 text-blue-500" />
                            </div>
                            <h3 className="text-lg font-bold text-text-primary dark:text-text-primary-dark mb-2">
                                Advanced Analytics
                            </h3>
                            <p className="text-text-secondary dark:text-text-secondary-dark">
                                Access detailed attendance stats, competition trends, and performance analytics across the entire season.
                            </p>
                        </div>

                        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark">
                            <div className="w-12 h-12 bg-purple-500/20 rounded-theme flex items-center justify-center mb-4">
                                <Icon path="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" 
                                      className="w-6 h-6 text-purple-500" />
                            </div>
                            <h3 className="text-lg font-bold text-text-primary dark:text-text-primary-dark mb-2">
                                Smart Notifications
                            </h3>
                            <p className="text-text-secondary dark:text-text-secondary-dark">
                                Get alerts for your corps' performances, last-minute schedule changes, and important competition updates.
                            </p>
                        </div>

                        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark">
                            <div className="w-12 h-12 bg-orange-500/20 rounded-theme flex items-center justify-center mb-4">
                                <Icon path="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.228a9.014 9.014 0 012.916.52 6.003 6.003 0 01-4.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0A6.772 6.772 0 0112 14.25m0 0a6.772 6.772 0 01-4.478-1.622m0 0a6.726 6.726 0 01-2.748-1.35m0 0A6.003 6.003 0 012.25 9c0-1.357.445-2.611 1.198-3.625m0 0A9.014 9.014 0 015.364 4.85m0 0A9.014 9.014 0 0112 2.25" 
                                      className="w-6 h-6 text-orange-500" />
                            </div>
                            <h3 className="text-lg font-bold text-text-primary dark:text-text-primary-dark mb-2">
                                Fantasy Competition
                            </h3>
                            <p className="text-text-secondary dark:text-text-secondary-dark">
                                Participate in fantasy leagues, predict scores, and compete with other drum corps enthusiasts.
                            </p>
                        </div>

                        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark">
                            <div className="w-12 h-12 bg-red-500/20 rounded-theme flex items-center justify-center mb-4">
                                <Icon path="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" 
                                      className="w-6 h-6 text-red-500" />
                            </div>
                            <h3 className="text-lg font-bold text-text-primary dark:text-text-primary-dark mb-2">
                                Community Features
                            </h3>
                            <p className="text-text-secondary dark:text-text-secondary-dark">
                                Connect with other fans, share your schedule, and join leagues with friends and fellow enthusiasts.
                            </p>
                        </div>
                    </div>

                    {/* Preview Section */}
                    <div className="bg-surface dark:bg-surface-dark p-8 rounded-theme border border-accent dark:border-accent-dark mb-16">
                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
                                What You're Missing
                            </h2>
                            <p className="text-text-secondary dark:text-text-secondary-dark">
                                Here's a preview of the advanced schedule features waiting for you:
                            </p>
                        </div>

                        <div className="grid md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 p-3 bg-background dark:bg-background-dark rounded-theme border border-accent/30 dark:border-accent-dark/30">
                                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                    <span className="text-text-primary dark:text-text-primary-dark font-medium">Real-time attendance tracking</span>
                                </div>
                                <div className="flex items-center gap-3 p-3 bg-background dark:bg-background-dark rounded-theme border border-accent/30 dark:border-accent-dark/30">
                                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                                    <span className="text-text-primary dark:text-text-primary-dark font-medium">Personal corps calendar</span>
                                </div>
                                <div className="flex items-center gap-3 p-3 bg-background dark:bg-background-dark rounded-theme border border-accent/30 dark:border-accent-dark/30">
                                    <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                                    <span className="text-text-primary dark:text-text-primary-dark font-medium">Advanced filtering & search</span>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 p-3 bg-background dark:bg-background-dark rounded-theme border border-accent/30 dark:border-accent-dark/30">
                                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                                    <span className="text-text-primary dark:text-text-primary-dark font-medium">Event favorites & bookmarks</span>
                                </div>
                                <div className="flex items-center gap-3 p-3 bg-background dark:bg-background-dark rounded-theme border border-accent/30 dark:border-accent-dark/30">
                                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                                    <span className="text-text-primary dark:text-text-primary-dark font-medium">Export to calendar apps</span>
                                </div>
                                <div className="flex items-center gap-3 p-3 bg-background dark:bg-background-dark rounded-theme border border-accent/30 dark:border-accent-dark/30">
                                    <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                                    <span className="text-text-primary dark:text-text-primary-dark font-medium">Competition predictions</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Call to Action */}
                    <div className="text-center">
                        <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
                            Ready to Experience the Full Schedule?
                        </h2>
                        <p className="text-text-secondary dark:text-text-secondary-dark mb-8 max-w-2xl mx-auto">
                            Join thousands of drum corps fans who rely on marching.art for the most comprehensive and up-to-date schedule experience. It's completely free to start!
                        </p>
                        
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <button
                                onClick={onSignUpClick}
                                className="bg-primary text-on-primary px-8 py-4 rounded-theme font-bold text-lg hover:bg-primary/90 transition-all shadow-lg flex items-center justify-center gap-2"
                            >
                                <Icon path="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" 
                                      className="w-5 h-5" />
                                Create Free Account
                            </button>
                            <button
                                onClick={onLoginClick}
                                className="bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark px-8 py-4 rounded-theme font-bold text-lg border-2 border-accent dark:border-accent-dark hover:bg-accent/10 transition-all flex items-center justify-center gap-2"
                            >
                                <Icon path="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" 
                                      className="w-5 h-5" />
                                Already Have Account
                            </button>
                        </div>
                    </div>

                    {/* Public Alternative */}
                    <div className="mt-16 text-center">
                        <p className="text-text-secondary dark:text-text-secondary-dark mb-4">
                            Looking for basic schedule information?
                        </p>
                        <Link 
                            to="/scores" 
                            className="text-primary hover:text-primary-dark font-medium underline"
                        >
                            View public scores and results →
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ScheduleAuthPrompt;