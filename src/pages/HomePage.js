import React, { useRef, useEffect } from 'react';

// Card components (no changes needed here)
const FeatureCard = ({ title, children, accentText }) => (
    <div className="relative bg-surface/80 dark:bg-surface-dark/80 backdrop-blur-sm p-6 rounded-theme border-theme border-accent overflow-hidden shadow-theme">
        <span className="absolute -bottom-4 -right-2 text-[8rem] font-black text-accent dark:text-accent-dark/10 select-none opacity-50">
            {accentText}
        </span>
        <div className="relative">
            <h3 className="text-2xl font-bold text-primary dark:text-primary-dark mb-2">{title}</h3>
            <p className="text-text-secondary dark:text-text-secondary-dark leading-relaxed">{children}</p>
        </div>
    </div>
);

const CommunityCard = () => (
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
);


const HomePage = ({ onSignUpClick }) => {
    const videoRef = useRef(null);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.playbackRate = 0.5;
        }
    }, []);

    return (
        // --- THIS IS THE CHANGED LINE ---
        <div className="absolute inset-0">
            {/* The video is now the base layer (z-0) */}
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

            {/* The overlay sits on top of the video (z-10) */}
            <div className="absolute inset-0 w-full h-full bg-background dark:bg-background-dark opacity-80 z-10"></div>

            {/* The content sits on top of everything (z-20) and is scrollable */}
            <div className="relative z-20 h-full overflow-y-auto text-center p-6 md:p-8">
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
                
                <div className="py-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
                    <FeatureCard title="Live Scoring" accentText="LIVE">
                        Scores are updated during the 10-week DCI season, culminating at Finals. Your fantasy points reflect real-world performance.
                    </FeatureCard>
                    <FeatureCard title="Off-Season Fun" accentText="365">
                        The competition never stops. During the off-season, we use a mix of historical scores to keep the game exciting year-round.
                    </FeatureCard>
                    <FeatureCard title="Build Your Legacy" accentText="YOU">
                        Create your manager profile, design a unique uniform, and track your history to show off your championship titles.
                    </FeatureCard>
                    <CommunityCard />
                </div>
            </div>
        </div>
    );
};

export default HomePage;