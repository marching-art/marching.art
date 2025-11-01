import React, { useRef, useEffect } from 'react';
import ParticleBackground from '../components/ui/ParticleBackground';

const FeatureCard = ({ title, children, accentText, delay = 0 }) => (
    <div 
        className="card-elevated p-8 hover:scale-102 group relative overflow-hidden"
        style={{ animationDelay: `${delay}s` }}
    >
        {/* Accent text watermark */}
        <span className="absolute -bottom-6 -right-4 text-[10rem] font-black text-accent/5 dark:text-accent-dark/5 select-none transition-all duration-500 group-hover:scale-110 group-hover:rotate-6">
            {accentText}
        </span>
        
        {/* Gradient overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-accent/0 group-hover:from-primary/5 group-hover:to-accent/10 transition-all duration-500 pointer-events-none" />
        
        <div className="relative z-10">
            <div className="flex items-center mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-2xl font-bold text-white shadow-glow">
                    {accentText[0]}
                </div>
                <h3 className="text-2xl font-bold ml-4 gradient-text">
                    {title}
                </h3>
            </div>
            <p className="text-text-secondary dark:text-text-secondary-dark leading-relaxed">
                {children}
            </p>
        </div>
        
        {/* Shimmer effect on hover */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
            <div className="shimmer" />
        </div>
    </div>
);

const CommunityCard = ({ delay = 0 }) => (
    <div 
        className="card-elevated p-8 hover:scale-102 group relative overflow-hidden bg-gradient-to-br from-surface to-surface dark:from-surface-dark dark:to-surface-dark"
        style={{ animationDelay: `${delay}s` }}
    >
        <span className="absolute -bottom-6 -right-4 text-[10rem] font-black text-accent/5 dark:text-accent-dark/5 select-none transition-all duration-500 group-hover:scale-110 group-hover:rotate-6">
            💬
        </span>
        
        <div className="absolute inset-0 bg-gradient-to-br from-secondary/0 to-accent/0 group-hover:from-secondary/10 group-hover:to-accent/10 transition-all duration-500 pointer-events-none" />
        
        <div className="relative z-10">
            <div className="flex items-center mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-secondary to-accent flex items-center justify-center text-2xl shadow-glow-accent">
                    💬
                </div>
                <h3 className="text-2xl font-bold ml-4 gradient-text">
                    Join the Community
                </h3>
            </div>
            <p className="text-text-secondary dark:text-text-secondary-dark leading-relaxed mb-6">
                Chat with other fans, discuss scores, and get help on our official Discord server.
            </p>
            <a 
                href="https://discord.gg/YvFRJ97A5H" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="btn-fantasy bg-secondary dark:bg-secondary-dark hover:shadow-glow-accent text-on-secondary font-bold py-3 px-6 rounded-xl inline-flex items-center space-x-2 relative z-10"
            >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
                <span>Join Discord</span>
            </a>
        </div>
    </div>
);

const HomePage = ({ onSignUpClick }) => {
    const videoRef = useRef(null);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.playbackRate = 0.5;
        }
    }, []);

    return (
        <div className="relative min-h-screen overflow-hidden">
            {/* Particle Background */}
            <ParticleBackground density={40} color="rgba(247, 148, 29, 0.3)" />
            
            {/* Video Background */}
            <video
                ref={videoRef}
                autoPlay
                loop
                muted
                playsInline
                className="absolute inset-0 w-full h-full object-cover z-0"
            >
                <source src="/montage.mp4" type="video/mp4" />
                Your browser does not support the video tag.
            </video>

            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-background/90 via-background/85 to-background/90 dark:from-background-dark/90 dark:via-background-dark/85 dark:to-background-dark/90 z-10" />
            
            {/* Radial gradient for depth */}
            <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-background/50 dark:to-background-dark/50 z-10" />

            {/* Content */}
            <div className="relative z-20 min-h-screen overflow-y-auto">
                {/* Hero Section */}
                <div className="container mx-auto px-6 py-24 md:py-40 text-center">
                    {/* Animated Badge */}
                    <div className="inline-flex items-center space-x-2 bg-primary/10 dark:bg-primary-dark/10 border border-primary/30 dark:border-primary-dark/30 rounded-full px-6 py-2 mb-8 animate-fade-in backdrop-blur-sm">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                        </span>
                        <span className="text-sm font-semibold text-primary dark:text-primary-dark">
                            Season Active • Join Now
                        </span>
                    </div>

                    {/* Main Headline */}
                    <h1 className="text-6xl md:text-8xl font-extrabold mb-8 animate-fade-in">
                        <span className="gradient-text">
                            Your Field of
                        </span>
                        <br />
                        <span className="text-text-primary dark:text-text-primary-dark">
                            Dreams Awaits
                        </span>
                    </h1>
                    
                    {/* Subheadline */}
                    <p className="text-xl md:text-2xl text-text-secondary dark:text-text-secondary-dark max-w-4xl mx-auto mb-12 leading-relaxed animate-fade-in" style={{ animationDelay: '0.2s' }}>
                        Assemble your ultimate drum corps lineup from legends of the past. 
                        <br className="hidden md:block" />
                        Compete against friends and rise to the top of the leaderboard.
                    </p>
                    
                    {/* CTA Button */}
                    <button 
                        onClick={onSignUpClick} 
                        className="btn-fantasy bg-gradient-to-r from-primary to-accent dark:from-primary-dark dark:to-accent-dark text-on-primary font-bold py-5 px-12 rounded-2xl text-xl shadow-glow hover:shadow-glow-lg hover:scale-105 animate-fade-in transition-all duration-300 relative overflow-hidden group"
                        style={{ animationDelay: '0.4s' }}
                    >
                        <span className="relative z-10 flex items-center space-x-3">
                            <span>Start Your Corps Today</span>
                            <svg className="w-6 h-6 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                        </span>
                    </button>

                    {/* Trust Indicators */}
                    <div className="flex flex-wrap justify-center items-center gap-8 mt-16 text-text-secondary dark:text-text-secondary-dark animate-fade-in" style={{ animationDelay: '0.6s' }}>
                        <div className="flex items-center space-x-2">
                            <svg className="w-5 h-5 text-primary dark:text-primary-dark" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            <span className="font-semibold">Free to Play</span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <svg className="w-5 h-5 text-primary dark:text-primary-dark" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                            </svg>
                            <span className="font-semibold">Real-Time Scoring</span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <svg className="w-5 h-5 text-primary dark:text-primary-dark" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                            </svg>
                            <span className="font-semibold">Active Community</span>
                        </div>
                    </div>
                </div>

                {/* Features Section */}
                <div className="container mx-auto px-6 pb-24">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto stagger-children">
                        <FeatureCard title="Live Scoring" accentText="LIVE" delay={0}>
                            Scores update during the 10-week DCI season, culminating at Finals. Your fantasy points reflect real-world performance.
                        </FeatureCard>
                        <FeatureCard title="Off-Season Fun" accentText="365" delay={0.1}>
                            The competition never stops. During the off-season, we use historical scores to keep the game exciting year-round.
                        </FeatureCard>
                        <FeatureCard title="Build Your Legacy" accentText="YOU" delay={0.2}>
                            Create your manager profile, design a unique uniform, and track your history to show off your championship titles.
                        </FeatureCard>
                        <CommunityCard delay={0.3} />
                    </div>
                </div>

                {/* Stats Section */}
                <div className="container mx-auto px-6 pb-24">
                    <div className="max-w-5xl mx-auto glass rounded-3xl p-12 text-center">
                        <h2 className="text-4xl font-bold gradient-text mb-12">
                            Join Thousands of Fantasy Managers
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div className="animate-fade-in">
                                <div className="text-5xl font-bold text-primary dark:text-primary-dark mb-2">
                                    1000+
                                </div>
                                <div className="text-text-secondary dark:text-text-secondary-dark">
                                    Active Players
                                </div>
                            </div>
                            <div className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
                                <div className="text-5xl font-bold text-primary dark:text-primary-dark mb-2">
                                    500+
                                </div>
                                <div className="text-text-secondary dark:text-text-secondary-dark">
                                    Active Leagues
                                </div>
                            </div>
                            <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
                                <div className="text-5xl font-bold text-primary dark:text-primary-dark mb-2">
                                    24/7
                                </div>
                                <div className="text-text-secondary dark:text-text-secondary-dark">
                                    Community Support
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HomePage;
