import React from 'react';

const FeatureCard = ({ title, children, accentText }) => (
    <div className="relative bg-surface/80 dark:bg-surface-dark/80 backdrop-blur-sm p-6 rounded-theme border-theme border-accent overflow-hidden shadow-theme">
        <span className="absolute -bottom-4 -right-2 text-[8rem] font-black text-accent dark:text-accent-dark/10 select-none opacity-50">
            {accentText}
        </span>
        <div className="relative">
            <h3 className="text-2xl font-bold text-primary dark:text-primary-dark mb-2">{title}</h3>
            <p className="text-text-secondary leading-relaxed">{children}</p>
        </div>
    </div>
);


const HomePage = ({ onSignUpClick }) => {
    return (
        <div className="relative bg-background dark:bg-background-dark overflow-hidden min-h-screen">
            {/* --- VIDEO BACKGROUND --- */}
            <video 
                autoPlay 
                loop 
                muted 
                playsInline
                className="absolute top-0 left-0 w-full h-full object-cover -z-20"
            >
                <source src="/montage.mp4" type="video/mp4" />
                Your browser does not support the video tag.
            </video>
            {/* --- OVERLAY --- */}
            <div className="absolute top-0 left-0 w-full h-full bg-background-dark/70 -z-10"></div>

            <div className="text-center p-6 md:p-8">
                {/* --- HERO SECTION --- */}
                <div className="py-20 md:py-32">
                    <h1 className="text-5xl md:text-7xl font-extrabold text-text-primary dark:text-text-primary-dark tracking-tight">
                        Your Field of Dreams Awaits
                    </h1>
                    
                    <p className="text-lg text-text-secondary dark:text-text-secondary-dark mt-6 mb-10 max-w-3xl mx-auto leading-relaxed">
                        Assemble your ultimate drum corps lineup from legends of the past. Compete against friends in a season-long fantasy league and rise to the top of the leaderboard.
                    </p>
                    
                    <button 
                        onClick={onSignUpClick} 
                        className="bg-primary hover:opacity-90 text-on-primary font-bold py-4 px-10 rounded-theme text-lg transition-transform duration-150 ease-in-out transform hover:scale-105 shadow-lg"
                    >
                        Start Your Corps Today
                    </button>
                </div>
                
                {/* --- FEATURES SECTION --- */}
                <div className="py-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
                    {/* Note: Updated FeatureCard background for better readability over video */}
                    <FeatureCard title="Live Scoring" accentText="LIVE">
                        Scores are updated during the 10-week DCI season, culminating at Finals. Your fantasy points reflect real-world performance.
                    </FeatureCard>
                    <FeatureCard title="Off-Season Fun" accentText="365">
                        The competition never stops. During the off-season, we use a mix of historical scores to keep the game exciting year-round.
                    </FeatureCard>
                    <FeatureCard title="Build Your Legacy" accentText="YOU">
                        Create your manager profile, design a unique uniform, and track your history to show off your championship titles.
                    </FeatureCard>
                    
                    <div className="relative bg-surface/80 dark:bg-surface-dark/80 backdrop-blur-sm p-6 rounded-theme border-theme border-accent overflow-hidden shadow-theme">
                         <span className="absolute -bottom-4 -right-2 text-[8rem] font-black text-accent dark:text-accent-dark/10 select-none opacity-50">
                            CHAT
                        </span>
                        <div className="relative text-left">
                            <h3 className="text-2xl font-bold text-primary dark:text-primary-dark mb-2">Join the Community</h3>
                            <p className="text-text-secondary dark:text-text-secondary-dark leading-relaxed mb-4">Chat with other fans, discuss scores, and get help on our official Discord server.</p>
                            <a 
                                href="https://discord.gg/YvFRJ97A5H" 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="bg-secondary dark:bg-secondary-dark hover:opacity-90 text-on-secondary font-bold py-2 px-4 rounded-theme inline-block transition-all text-sm"
                            >
                                Join Discord
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HomePage;