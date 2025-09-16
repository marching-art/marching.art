import React from 'react';

// A new sub-component for the feature cards to keep the main component clean.
const FeatureCard = ({ title, children, accentText }) => (
    // UPDATED: The card is a self-contained unit with theme variables.
    // The accent text in the background adds a huge visual impact.
    <div className="relative bg-surface dark:bg-surface-dark p-6 rounded-theme border-theme border-accent overflow-hidden">
        <span className="absolute -bottom-4 -right-2 text-[8rem] font-black text-accent/10 dark:text-accent/20 select-none">
            {accentText}
        </span>
        <div className="relative">
            <h3 className="text-2xl font-bold text-primary dark:text-primary-dark mb-2">{title}</h3>
            <p className="text-text-secondary">{children}</p>
        </div>
    </div>
);


const HomePage = ({ onSignUpClick }) => {
    return (
        // Add a subtle grid background to evoke the 'field'
        <div className="relative bg-background dark:bg-background-dark bg-[linear-gradient(to_right,rgb(var(--color-accent)/0.1)_1px,transparent_1px),linear-gradient(to_bottom,rgb(var(--color-accent)/0.1)_1px,transparent_1px)] bg-[size:4rem_4rem]">
            <div className="text-center p-4 md:p-8">
                {/* --- HERO SECTION --- */}
                {/* This section is designed for maximum impact on first load. */}
                <div className="py-16 md:py-24">
                    {/* WOW FACTOR: KINETIC TYPOGRAPHY
                        This headline is designed to be animated. Using a library like Framer Motion,
                        each word could slide or fade in sequentially, mimicking a drill formation.
                    */}
                    <h1 className="text-5xl md:text-7xl font-black uppercase text-text-primary tracking-tighter">
                        Your Field of Dreams Awaits
                    </h1>
                    
                    {/* UPDATED: The subtitle uses a monospace font for a more 'insider', technical feel. */}
                    <p className="font-mono text-lg text-text-secondary mt-4 mb-8 max-w-2xl mx-auto">
                        Assemble your ultimate drum corps lineup. Compete against friends. Follow the season's scores and rise to the top. This is where fantasy meets the field.
                    </p>
                    
                    {/* UPDATED: The primary Call to Action. 
                        It uses the secondary color to be the most visually important element on the page.
                        The hover effect is a scale transform, making it feel more interactive and satisfying to click.
                    */}
                    <button 
                        onClick={onSignUpClick} 
                        className="bg-secondary hover:bg-secondary/80 text-on-secondary font-bold py-4 px-10 rounded-theme text-xl transition-transform duration-150 ease-in-out transform hover:scale-105"
                    >
                        Join a League Today!
                    </button>
                </div>
                
                {/* --- FEATURES SECTION --- */}
                {/* WOW FACTOR: THE SCROLL AS A CANVAS
                    This grid is designed for scroll-based animations. Each FeatureCard can
                    slide or fade into view as the user scrolls down the page.
                */}
                <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
                    <FeatureCard title="Live Scoring" accentText="LIVE">
                        Scores are updated during the 10-week DCI season, culminating at Finals. Your fantasy points reflect real-world performance.
                    </FeatureCard>
                    <FeatureCard title="Off-Season Fun" accentText="365">
                        The competition never stops. During the off-season, we use a mix of historical scores to keep the game exciting year-round.
                    </FeatureCard>
                    <FeatureCard title="Create Your Profile" accentText="YOU">
                        Build your manager profile, track your history, and show off your championship titles to the world.
                    </FeatureCard>
                    
                    {/* UPDATED: This card now has a clear Call to Action button. */}
                    <div className="relative bg-surface dark:bg-surface-dark p-6 rounded-theme border-theme border-primary overflow-hidden">
                         <span className="absolute -bottom-4 -right-2 text-[8rem] font-black text-primary/10 dark:text-primary/20 select-none">
                            CHAT
                        </span>
                        <div className="relative">
                            <h3 className="text-2xl font-bold text-primary dark:text-primary-dark mb-2">Join the Community</h3>
                            <p className="text-text-secondary mb-4">Chat with other fans, discuss scores, and get help on our official Discord server.</p>
                            <a 
                                href="https://discord.gg/YvFRJ97A5H" 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="bg-primary hover:bg-primary/80 text-on-primary font-bold py-2 px-4 rounded-theme inline-block transition-all"
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