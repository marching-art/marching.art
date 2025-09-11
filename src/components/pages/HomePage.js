import React from 'react';

const HomePage = ({ onSignUpClick }) => {
    return (
        <div className="text-center p-4 md:p-8">
            <h1 className="text-4xl md:text-5xl font-bold text-brand-primary dark:text-brand-primary-dark mb-4 tracking-wider">Your Field of Dreams Awaits</h1>
            <p className="text-lg text-brand-text-primary dark:text-brand-text-primary-dark mb-8 max-w-2xl mx-auto">
                Assemble your ultimate drum corps lineup. Compete against friends. Follow the season's scores and rise to the top. This is where fantasy meets the field.
            </p>
            <button onClick={onSignUpClick} className="bg-brand-secondary hover:bg-amber-500 text-brand-text-primary font-bold py-3 px-8 rounded-md text-xl transition-all border-b-4 border-amber-600 hover:border-amber-700 transform hover:translate-y-px">
                Join a League Today!
            </button>
            
            <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
                <div className="bg-brand-surface dark:bg-brand-surface-dark p-6 rounded-lg border-2 border-brand-secondary shadow-lg">
                    <h3 className="text-2xl font-bold text-brand-primary dark:text-brand-primary-dark mb-2">Live Scoring</h3>
                    <p className="text-brand-text-secondary dark:text-brand-text-secondary-dark">Scores are updated during the 10-week DCI season, culminating at Finals. Your fantasy points reflect real-world performance.</p>
                </div>
                <div className="bg-brand-surface dark:bg-brand-surface-dark p-6 rounded-lg border-2 border-brand-secondary shadow-lg">
                    <h3 className="text-2xl font-bold text-brand-primary dark:text-brand-primary-dark mb-2">Off-Season Fun</h3>
                    <p className="text-brand-text-secondary dark:text-brand-text-secondary-dark">The competition never stops. During the off-season, we use a mix of historical scores to keep the game exciting year-round.</p>
                </div>
                <div className="bg-brand-surface dark:bg-brand-surface-dark p-6 rounded-lg border-2 border-brand-secondary shadow-lg">
                    <h3 className="text-2xl font-bold text-brand-primary dark:text-brand-primary-dark mb-2">Create Your Profile</h3>
                    <p className="text-brand-text-secondary dark:text-brand-text-secondary-dark">Build your manager profile, track your history, and show off your championship titles to the world.</p>
                </div>
                <div className="bg-brand-surface dark:bg-brand-surface-dark p-6 rounded-lg border-2 border-brand-primary shadow-lg">
                    <h3 className="text-2xl font-bold text-brand-primary dark:text-brand-primary-dark mb-2">Join the Community</h3>
                    <p className="text-brand-text-secondary dark:text-brand-text-secondary-dark mb-4">Chat with other fans, discuss scores, and get help on our official Discord server.</p>
                    <a href="https://discord.gg/YvFRJ97A5H" target="_blank" rel="noopener noreferrer" className="bg-brand-primary hover:bg-blue-800 text-white font-bold py-2 px-4 rounded-md inline-block transition-all border-b-4 border-blue-900 hover:border-blue-800 transform hover:translate-y-px">
                        Join Discord
                    </a>
                </div>
            </div>
        </div>
    );
};
export default HomePage;