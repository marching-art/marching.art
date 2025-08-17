import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, signInWithCustomToken, getIdTokenResult } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, onSnapshot, updateDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

// --- Firebase Configuration ---
// These global variables are provided by the environment.
// eslint-disable-next-line no-undef
const appId = typeof __app_id !== 'undefined' ? __app_id : 'marching-art';
// eslint-disable-next-line no-undef
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
    apiKey: "AIzaSyA4Qhjpp2MVwo0h0t2dNtznSIDMjlKQ5JE",
    authDomain: "marching-art.firebaseapp.com",
    projectId: "marching-art",
    storageBucket: "marching-art.firebasestorage.app",
    messagingSenderId: "278086562126",
    appId: "1:278086562126:web:f7737ee897774c3d9a6e1f",
    measurementId: "G-H0KE8GJS7M"
};

// --- Initialize Firebase ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);

// --- Helper Components ---

const Icon = ({ path, className = "w-6 h-6" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
);

const LogoIcon = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="-5 -5 65 65" className={className}>
      <g>
        <circle cx="0" cy="0" r="4" fill="#a0a0a0"/>
        <circle cx="25" cy="0" r="4" fill="#a0a0a0"/>
        <circle cx="50" cy="0" r="4" fill="#a0a0a0"/>
        <circle cx="0" cy="25" r="4" fill="#a0a0a0"/>
        <circle cx="25" cy="25" r="4" fill="#a0a0a0"/>
        <circle cx="50" cy="25" r="4" fill="#a0a0a0"/>
        <circle cx="0" cy="50" r="4" fill="#a0a0a0"/>
        <circle cx="25" cy="50" r="4" fill="#a0a0a0"/>
        <circle cx="50" cy="50" r="4" fill="#a0a0a0"/>
        <path d="M 0 0 Q 50 0, 50 50" stroke="#f59e0b" strokeWidth="6" fill="none" strokeLinecap="round"/>
      </g>
    </svg>
);


const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
    if (!isOpen) return null;
    const sizeClasses = {
        md: 'max-w-md',
        lg: 'max-w-3xl',
        xl: 'max-w-5xl'
    };
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
            <div className={`bg-white dark:bg-gray-800 border-2 border-yellow-500 rounded-md shadow-lg w-full ${sizeClasses[size]} p-6 relative text-gray-800 dark:text-yellow-300`}>
                <button onClick={onClose} className="absolute top-3 right-3 text-gray-500 dark:text-yellow-400 hover:text-gray-800 dark:hover:text-yellow-200 transition-colors">
                    <Icon path="M6 18L18 6M6 6l12 12" />
                </button>
                <h2 className="text-2xl font-bold mb-4 text-yellow-600 dark:text-yellow-400 tracking-wider">{title}</h2>
                {children}
            </div>
        </div>
    );
};

// --- Authentication Components ---

const SignUpForm = ({ onSignUpSuccess, switchToLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [error, setError] = useState('');

    const handleSignUp = async (e) => {
        e.preventDefault();
        setError('');
        if (!username.trim()) {
            setError("Please enter a username.");
            return;
        }
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            const userDocRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data');
            // Expanded profile data on creation
            await setDoc(userDocRef, {
                username: username,
                email: user.email,
                createdAt: new Date(),
                lastActive: new Date(),
                bio: `Welcome to my marching.art profile!`,
                uniform: { jacketStyle: "classic", jacketColor1: "#000000", jacketColor2: "#ffffff", plumeStyle: "standard", plumeColor: "#ffffff", hatStyle: "shako", hatColor: "#000000" },
                trophies: { championships: [], regionals: [] },
                seasons: []
            });
            
            onSignUpSuccess();
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <form onSubmit={handleSignUp}>
            {error && <p className="bg-red-100 dark:bg-red-900 border border-red-500 text-red-700 dark:text-red-300 p-2 mb-4 rounded text-sm">{error}</p>}
            <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                className="w-full bg-gray-100 dark:bg-gray-900 border border-gray-400 dark:border-yellow-500 rounded p-2 mb-4 text-gray-800 dark:text-yellow-300 placeholder-gray-500 dark:placeholder-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
            <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full bg-gray-100 dark:bg-gray-900 border border-gray-400 dark:border-yellow-500 rounded p-2 mb-4 text-gray-800 dark:text-yellow-300 placeholder-gray-500 dark:placeholder-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
            <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full bg-gray-100 dark:bg-gray-900 border border-gray-400 dark:border-yellow-500 rounded p-2 mb-4 text-gray-800 dark:text-yellow-300 placeholder-gray-500 dark:placeholder-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
            <button type="submit" className="w-full bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-2 px-4 rounded border-b-4 border-yellow-800 hover:border-yellow-700 transition-all">
                Sign Up
            </button>
            <p className="text-center mt-4 text-sm text-gray-600 dark:text-gray-400">
                Already have an account?{' '}
                <button type="button" onClick={switchToLogin} className="text-yellow-600 dark:text-yellow-400 hover:underline">Log In</button>
            </p>
        </form>
    );
};

const LoginForm = ({ onLoginSuccess, switchToSignUp }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        try {
            await signInWithEmailAndPassword(auth, email, password);
            onLoginSuccess();
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <form onSubmit={handleLogin}>
            {error && <p className="bg-red-100 dark:bg-red-900 border border-red-500 text-red-700 dark:text-red-300 p-2 mb-4 rounded text-sm">{error}</p>}
            <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full bg-gray-100 dark:bg-gray-900 border border-gray-400 dark:border-yellow-500 rounded p-2 mb-4 text-gray-800 dark:text-yellow-300 placeholder-gray-500 dark:placeholder-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
            <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full bg-gray-100 dark:bg-gray-900 border border-gray-400 dark:border-yellow-500 rounded p-2 mb-4 text-gray-800 dark:text-yellow-300 placeholder-gray-500 dark:placeholder-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
            <button type="submit" className="w-full bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-2 px-4 rounded border-b-4 border-yellow-800 hover:border-yellow-700 transition-all">
                Log In
            </button>
            <p className="text-center mt-4 text-sm text-gray-600 dark:text-gray-400">
                Don't have an account?{' '}
                <button type="button" onClick={switchToSignUp} className="text-yellow-600 dark:text-yellow-400 hover:underline">Sign Up</button>
            </p>
        </form>
    );
};


// --- Page Components ---

const Header = ({ isLoggedIn, isAdmin, onLoginClick, onSignUpClick, onLogout, setPage, profile, theme, toggleTheme }) => {
    return (
        <header className="bg-gray-100 dark:bg-black border-b-4 border-yellow-500 p-4 flex justify-between items-center shadow-md">
            <div onClick={() => setPage('home')} className="flex items-center space-x-3 cursor-pointer">
                <LogoIcon className="h-9 w-9" />
                <span className="text-2xl md:text-3xl font-semibold text-gray-800 dark:text-white tracking-wide">
                    marching<span className="text-yellow-600 dark:text-yellow-500 font-bold">.art</span>
                </span>
            </div>
            <div className="flex items-center space-x-2 md:space-x-4">
                <nav className="flex items-center space-x-2 md:space-x-4">
                    {isLoggedIn ? (
                        <>
                            {isAdmin && <button onClick={() => setPage('admin')} className="text-red-500 font-bold hover:underline">Admin</button>}
                            <span className="text-gray-700 dark:text-yellow-300 hidden sm:block">Welcome, {profile?.username || ''}</span>
                            <button onClick={() => setPage('profile')} className="text-gray-700 dark:text-yellow-300 hover:text-black dark:hover:text-white transition-colors">Profile</button>
                            <button onClick={onLogout} className="bg-gray-300 dark:bg-yellow-700 hover:bg-gray-400 dark:hover:bg-yellow-600 text-gray-800 dark:text-white font-bold py-2 px-3 rounded border-b-2 border-gray-400 dark:border-yellow-800 transition-all text-sm">
                                Logout
                            </button>
                        </>
                    ) : (
                        <>
                            <button onClick={onLoginClick} className="text-gray-700 dark:text-yellow-300 hover:text-black dark:hover:text-white transition-colors">Log In</button>
                            <button onClick={onSignUpClick} className="bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-2 px-3 rounded border-b-4 border-yellow-800 hover:border-yellow-700 transition-all text-sm">
                                Sign Up
                            </button>
                        </>
                    )}
                </nav>
                 <button onClick={toggleTheme} className="p-2 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-yellow-300 focus:outline-none focus:ring-2 focus:ring-yellow-500">
                    {theme === 'light' ? <Icon path="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" /> : <Icon path="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M12 21a9 9 0 110-18 9 9 0 010 18z" />}
                </button>
            </div>
        </header>
    );
};

const HomePage = ({ onSignUpClick }) => {
    return (
        <div className="text-center p-8">
            <h1 className="text-4xl md:text-5xl font-bold text-yellow-800 dark:text-yellow-300 mb-4 tracking-wider">Your Field of Dreams Awaits</h1>
            <p className="text-lg text-gray-700 dark:text-yellow-200 mb-8 max-w-2xl mx-auto">
                Assemble your ultimate drum corps lineup. Compete against friends. Follow the season's scores and rise to the top. This is where fantasy meets the field.
            </p>
            <button onClick={onSignUpClick} className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 px-8 rounded-md text-xl transition-all border-b-4 border-yellow-700 hover:border-yellow-800 transform hover:translate-y-px">
                Join a League Today!
            </button>
            
            <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
                <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-md border-2 border-yellow-500 shadow-md">
                    <h3 className="text-2xl font-bold text-yellow-700 dark:text-yellow-400 mb-2">Live Scoring</h3>
                    <p className="text-gray-600 dark:text-gray-300">Scores are updated during the 10-week DCI season, culminating at Finals. Your fantasy points reflect real-world performance.</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-md border-2 border-yellow-500 shadow-md">
                    <h3 className="text-2xl font-bold text-yellow-700 dark:text-yellow-400 mb-2">Off-Season Fun</h3>
                    <p className="text-gray-600 dark:text-gray-300">The competition never stops. During the off-season, we use a mix of historical scores to keep the game exciting year-round.</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-md border-2 border-yellow-500 shadow-md">
                    <h3 className="text-2xl font-bold text-yellow-700 dark:text-yellow-400 mb-2">Create Your Profile</h3>
                    <p className="text-gray-600 dark:text-gray-300">Build your manager profile, track your history, and show off your championship titles to the world.</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-md border-2 border-indigo-500 shadow-md">
                    <h3 className="text-2xl font-bold text-indigo-700 dark:text-indigo-400 mb-2">Join the Community</h3>
                    <p className="text-gray-600 dark:text-gray-300 mb-4">Chat with other fans, discuss scores, and get help on our official Discord server.</p>
                    <a href="https://discord.gg/YvFRJ97A5H" target="_blank" rel="noopener noreferrer" className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded-md inline-block transition-all border-b-4 border-indigo-700 hover:border-indigo-800 transform hover:translate-y-px">
                        Join Discord
                    </a>
                </div>
            </div>
        </div>
    );
};

const DashboardPage = ({ profile }) => {
    const corps = [
        { name: "Blue Devils", score: 98.750, change: "+0.250" },
        { name: "Boston Crusaders", score: 97.500, change: "+0.125" },
        { name: "Bluecoats", score: 97.375, change: "-0.100" },
        { name: "Carolina Crown", score: 96.800, change: "+0.500" },
        { name: "Santa Clara Vanguard", score: 95.500, change: "+0.000" },
    ];

    return (
        <div className="p-4 md:p-8">
            <h1 className="text-4xl font-bold text-yellow-800 dark:text-yellow-300 mb-6">Manager Dashboard</h1>
            <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-md border-2 border-yellow-500 shadow-lg">
                    <h2 className="text-2xl font-bold text-yellow-700 dark:text-yellow-400 mb-4">My Team: "The Phantom Regiment"</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b-2 border-yellow-600 dark:border-yellow-700">
                                    <th className="p-2 text-gray-800 dark:text-yellow-200">Corps</th>
                                    <th className="p-2 text-gray-800 dark:text-yellow-200">Last Score</th>
                                    <th className="p-2 text-gray-800 dark:text-yellow-200">Change</th>
                                    <th className="p-2 text-gray-800 dark:text-yellow-200">Fantasy Points</th>
                                </tr>
                            </thead>
                            <tbody>
                                {corps.map((c) => (
                                    <tr key={c.name} className="border-b border-gray-200 dark:border-gray-700">
                                        <td className="p-2 font-semibold text-gray-900 dark:text-yellow-200">{c.name}</td>
                                        <td className={`p-2 ${c.change.startsWith('+') ? 'text-green-600' : c.change.startsWith('-') ? 'text-red-600' : 'text-gray-700 dark:text-gray-400'}`}>{c.score.toFixed(3)}</td>
                                        <td className={`p-2 ${c.change.startsWith('+') ? 'text-green-600' : c.change.startsWith('-') ? 'text-red-600' : 'text-gray-700 dark:text-gray-400'}`}>{c.change}</td>
                                        <td className="p-2 text-gray-800 dark:text-yellow-300">{(c.score * 10).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-md border-2 border-yellow-500 shadow-lg">
                    <h2 className="text-2xl font-bold text-yellow-700 dark:text-yellow-400 mb-4">League: "World Class Champions"</h2>
                    <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-yellow-300">
                        <li><span className="font-bold text-black dark:text-white">The Phantom Regiment</span> (You) - 1250.75 pts</li>
                        <li><span>Cavaliers Crew</span> - 1245.50 pts</li>
                        <li><span>Crown Joules</span> - 1230.00 pts</li>
                        <li><span>Blue Devils Brigade</span> - 1198.25 pts</li>
                    </ol>
                </div>
            </div>
        </div>
    );
};

// --- Profile Page Components ---

const UniformDisplay = ({ uniform }) => {
    if (!uniform) return <div className="w-48 h-64 bg-gray-200 dark:bg-gray-700 rounded-md"></div>;
    return (
        <div className="w-48 h-64 bg-gray-200 dark:bg-gray-700 rounded-md flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {/* Shako */}
            <div style={{ backgroundColor: uniform.hatColor }} className="w-16 h-10 rounded-t-md absolute top-8"></div>
            {/* Plume */}
            <div style={{ backgroundColor: uniform.plumeColor }} className="w-4 h-12 absolute top-0 left-1/2 -translate-x-1/2 rounded-t-full"></div>
            {/* Jacket */}
            <div style={{ backgroundColor: uniform.jacketColor1 }} className="w-full h-32 absolute top-16">
                <div style={{ backgroundColor: uniform.jacketColor2 }} className="w-1/2 h-full absolute top-0 left-1/2 -translate-x-1/2"></div>
            </div>
        </div>
    );
};

const TrophyIcon = ({ type }) => {
    const colors = {
        gold: "text-yellow-500",
        silver: "text-gray-400",
        bronze: "text-orange-500",
    };
    return <Icon path="M16.5 18.75h-9a9.75 9.75 0 001.05-3.055 9.75 9.75 0 00-1.05-3.055h9a9.75 9.75 0 00-1.05 3.055 9.75 9.75 0 001.05 3.055zM18.75 9.75h.008v.008h-.008V9.75z" className={`w-8 h-8 ${colors[type]}`} />;
};

const TrophyCase = ({ trophies }) => {
    const safeTrophies = trophies || { championships: [], regionals: [] };
    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-md border-2 border-yellow-500 shadow-lg">
            <h3 className="text-2xl font-bold text-yellow-700 dark:text-yellow-400 mb-4">Trophy Case</h3>
            <div className="space-y-4">
                <div>
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200">Championships</h4>
                    <div className="flex space-x-2 mt-2">
                        {safeTrophies.championships.map((t, i) => <TrophyIcon key={`champ-${i}`} type={t} />)}
                    </div>
                </div>
                <div>
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200">Regionals</h4>
                    <div className="flex space-x-2 mt-2">
                        {safeTrophies.regionals.map((t, i) => <TrophyIcon key={`reg-${i}`} type={t} />)}
                    </div>
                </div>
            </div>
        </div>
    );
};

const SeasonArchive = ({ seasons = [] }) => {
    const [seasonType, setSeasonType] = useState('Live');
    const filteredSeasons = seasons.filter(s => s.type === seasonType);
    const [activeSeason, setActiveSeason] = useState(filteredSeasons.length > 0 ? filteredSeasons[0] : null);

    useEffect(() => {
        const newFiltered = seasons.filter(s => s.type === seasonType);
        setActiveSeason(newFiltered.length > 0 ? newFiltered[0] : null);
    }, [seasonType, seasons]);

    return (
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-md border-2 border-yellow-500 shadow-lg">
            <h3 className="text-2xl font-bold text-yellow-700 dark:text-yellow-400 mb-4">Season Archive</h3>
            {/* Season Type Tabs */}
            <div className="flex border-b-2 border-gray-200 dark:border-gray-700 mb-2">
                <button onClick={() => setSeasonType('Live')} className={`py-2 px-4 text-lg font-bold transition-colors ${seasonType === 'Live' ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}>Live Seasons</button>
                <button onClick={() => setSeasonType('Off')} className={`py-2 px-4 text-lg font-bold transition-colors ${seasonType === 'Off' ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}>Off-Seasons</button>
            </div>
            
            {/* Individual Season Tabs */}
            <div className="flex border-b-2 border-gray-200 dark:border-gray-700 mb-4 overflow-x-auto">
                {filteredSeasons.map(season => (
                    <button 
                        key={season.name} 
                        onClick={() => setActiveSeason(season)}
                        className={`py-2 px-4 font-semibold transition-colors whitespace-nowrap ${activeSeason?.name === season.name ? 'border-b-2 border-yellow-500 text-yellow-600 dark:text-yellow-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}
                    >
                        {season.name}
                    </button>
                ))}
            </div>

            {activeSeason ? (
                <div>
                    <h4 className="text-xl font-bold text-gray-800 dark:text-gray-200">{activeSeason.showTitle}</h4>
                    <p className="italic text-gray-600 dark:text-gray-400 mb-4">{activeSeason.repertoire}</p>
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700">
                                <th className="p-2">Event</th>
                                <th className="p-2">Rank</th>
                                <th className="p-2">Score</th>
                            </tr>
                        </thead>
                        <tbody>
                            {activeSeason.events.map((event, i) => (
                                <tr key={i} className="border-b border-gray-100 dark:border-gray-700">
                                    <td className="p-2">{event.eventName}</td>
                                    <td className="p-2">{event.rank}</td>
                                    <td className="p-2">{event.score.toFixed(3)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : <p className="p-2 text-gray-500">No seasons of this type played.</p>}
        </div>
    );
};


const ProfilePage = ({ profile, userId }) => {
    const isOwner = auth.currentUser?.uid === userId;

    const [isEditingBio, setIsEditingBio] = useState(false);
    const [bioText, setBioText] = useState(profile?.bio || '');

    useEffect(() => {
        setBioText(profile?.bio || '');
    }, [profile]);

    const handleSaveBio = async () => {
        if (!userId) return;
        const userDocRef = doc(db, 'artifacts', appId, 'users', userId, 'profile', 'data');
        try {
            await updateDoc(userDocRef, {
                bio: bioText
            });
            setIsEditingBio(false);
        } catch (error) {
            console.error("Error updating bio:", error);
        }
    };

    if (!profile) {
        return <div className="p-8 text-center text-gray-600 dark:text-yellow-300">Loading profile...</div>;
    }

    const timeSince = (date) => {
        if (!date?.toDate) return "a while ago"; // Guard against missing or invalid date
        const seconds = Math.floor((new Date() - date.toDate()) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + " years ago";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + " months ago";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + " days ago";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + " hours ago";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + " minutes ago";
        return "just now";
    };

    return (
        <div className="p-4 md:p-8 space-y-8">
            {/* Profile Header */}
            <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
                <UniformDisplay uniform={profile.uniform} />
                <div className="flex-grow text-center md:text-left">
                    <h1 className="text-4xl md:text-5xl font-bold text-gray-800 dark:text-white">{profile.username}</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        Member since {profile.createdAt?.toDate().toLocaleDateString()}
                    </p>
                    <p className="text-gray-500 dark:text-gray-400">
                        Last active: {timeSince(profile.lastActive)}
                    </p>
                    <div className="mt-4 bg-gray-50 dark:bg-gray-800 p-4 rounded-md border-l-4 border-yellow-500">
                        {isEditingBio ? (
                            <div className="space-y-2">
                                <textarea 
                                    value={bioText}
                                    onChange={(e) => setBioText(e.target.value)}
                                    className="w-full bg-gray-100 dark:bg-gray-900 border border-gray-400 dark:border-yellow-500 rounded p-2 text-gray-800 dark:text-yellow-300"
                                    rows="4"
                                ></textarea>
                                <div className="flex justify-end space-x-2">
                                    <button onClick={() => setIsEditingBio(false)} className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-1 px-3 rounded text-sm">Cancel</button>
                                    <button onClick={handleSaveBio} className="bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-1 px-3 rounded text-sm">Save</button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex justify-between items-start">
                                <p className="text-gray-700 dark:text-gray-300">{profile.bio}</p>
                                {isOwner && (
                                    <button onClick={() => setIsEditingBio(true)} className="ml-4 text-sm text-yellow-600 dark:text-yellow-400 hover:underline flex-shrink-0">Edit</button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid lg:grid-cols-3 gap-8">
                <TrophyCase trophies={profile.trophies} />
                <SeasonArchive seasons={profile.seasons} />
            </div>
        </div>
    );
};

const ScheduleEditor = ({ scheduleId, title, weekCount }) => {
    const [schedule, setSchedule] = useState({ name: title, events: [] });
    const [newEvent, setNewEvent] = useState({ name: '', location: '', week: 1, day: 'Saturday', type: 'Standard' });
    const [isLoading, setIsLoading] = useState(true);
    const [message, setMessage] = useState('');
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    useEffect(() => {
        const docRef = doc(db, 'schedules', scheduleId);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                setSchedule(docSnap.data());
            } else {
                setSchedule({ name: title, events: [] });
            }
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [scheduleId, title]);
    
    const handleEventChange = (field, value) => {
        setNewEvent(prev => ({ ...prev, [field]: value }));
    };

    const handleAddEvent = () => {
        if (!newEvent.name.trim() || !newEvent.location.trim()) return;
        const updatedEvents = [...schedule.events, newEvent];
        updatedEvents.sort((a, b) => {
            if (a.week !== b.week) return a.week - b.week;
            return days.indexOf(a.day) - days.indexOf(b.day);
        });
        setSchedule({ ...schedule, events: updatedEvents });
        setNewEvent({ name: '', location: '', week: 1, day: 'Saturday', type: 'Standard' });
    };

    const handleDeleteEvent = (indexToDelete) => {
        const updatedEvents = schedule.events.filter((_, index) => index !== indexToDelete);
        setSchedule({ ...schedule, events: updatedEvents });
    };

    const handleSave = async () => {
        setMessage('');
        setIsLoading(true);
        try {
            const saveSchedule = httpsCallable(functions, 'saveSchedule');
            const result = await saveSchedule({ scheduleId, scheduleData: schedule });
            setMessage(result.data.message || result.data.error);
        } catch (error) {
            console.error("Error saving schedule:", error);
            setMessage("An error occurred. Check the console for details.");
        }
        setIsLoading(false);
    };

    if (isLoading) {
        return <p className="dark:text-gray-300">Loading schedule...</p>;
    }

    return (
        <div className="space-y-4">
            <h3 className="text-xl font-bold">{title}</h3>
            {/* Event Entry Form */}
            <div className="p-4 border border-gray-300 dark:border-gray-600 rounded-md">
                <h4 className="font-semibold mb-2">Add New Show</h4>
                <div className="flex flex-wrap items-end gap-2">
                    <div className="flex-grow" style={{ flexBasis: 'calc(40% - 0.5rem)' }}><input type="text" placeholder="Event Name" value={newEvent.name} onChange={e => handleEventChange('name', e.target.value)} className="w-full bg-gray-100 dark:bg-gray-900 border border-gray-400 dark:border-yellow-500 rounded p-2 text-gray-800 dark:text-yellow-300"/></div>
                    <div className="flex-grow" style={{ flexBasis: 'calc(20% - 0.5rem)' }}><input type="text" placeholder="Location" value={newEvent.location} onChange={e => handleEventChange('location', e.target.value)} className="w-full bg-gray-100 dark:bg-gray-900 border border-gray-400 dark:border-yellow-500 rounded p-2 text-gray-800 dark:text-yellow-300"/></div>
                    <div className="flex-grow" style={{ flexBasis: 'calc(10% - 0.5rem)' }}><select value={newEvent.week} onChange={e => handleEventChange('week', parseInt(e.target.value))} className="w-full bg-gray-100 dark:bg-gray-900 border border-gray-400 dark:border-yellow-500 rounded p-2 text-gray-800 dark:text-yellow-300">{Array.from({ length: weekCount }, (_, i) => i + 1).map(weekNum => <option key={weekNum} value={weekNum}>Wk {weekNum}</option>)}</select></div>
                    <div className="flex-grow" style={{ flexBasis: 'calc(15% - 0.5rem)' }}><select value={newEvent.day} onChange={e => handleEventChange('day', e.target.value)} className="w-full bg-gray-100 dark:bg-gray-900 border border-gray-400 dark:border-yellow-500 rounded p-2 text-gray-800 dark:text-yellow-300">{days.map(day => <option key={day} value={day}>{day}</option>)}</select></div>
                    <div className="flex-grow" style={{ flexBasis: 'calc(15% - 0.5rem)' }}><select value={newEvent.type} onChange={e => handleEventChange('type', e.target.value)} className="w-full bg-gray-100 dark:bg-gray-900 border border-gray-400 dark:border-yellow-500 rounded p-2 text-gray-800 dark:text-yellow-300"><option value="Standard">Standard</option><option value="Regional">Regional</option></select></div>
                    <button onClick={handleAddEvent} className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded">Add</button>
                </div>
            </div>

            {/* Event List */}
            <div className="space-y-2">
                <h4 className="font-semibold">Scheduled Events</h4>
                {schedule.events.length === 0 ? <p className="text-gray-500">No shows added yet.</p> :
                    <ul className="list-disc list-inside space-y-1">
                        {schedule.events.map((event, index) => (
                            <li key={index} className="flex justify-between items-center p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                                <span>
                                    <strong>Week {event.week}, {event.day}:</strong> {event.name} <em className="text-gray-500">({event.location})</em> - {event.type}
                                </span>
                                <button onClick={() => handleDeleteEvent(index)} className="text-red-500 hover:text-red-700 text-sm font-bold">Delete</button>
                            </li>
                        ))}
                    </ul>
                }
            </div>

            <button onClick={handleSave} disabled={isLoading} className="mt-4 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400">
                {isLoading ? 'Saving...' : 'Save Schedule Template'}
            </button>
            {message && <p className="mt-2 text-sm font-semibold">{message}</p>}
        </div>
    );
};


const AdminPage = () => {
    const [email, setEmail] = useState('');
    const [isLoadingRoles, setIsLoadingRoles] = useState(false);
    const [message, setMessage] = useState('');

    const handleRoleChange = async (makeAdmin) => {
        setMessage('');
        setIsLoadingRoles(true);
        try {
            const setUserRole = httpsCallable(functions, 'setUserRole');
            const result = await setUserRole({ email, makeAdmin });
            setMessage(result.data.message || result.data.error);
        } catch (error) {
            console.error("Error calling function:", error);
            setMessage("An error occurred. Check the console for details.");
        }
        setIsLoadingRoles(false);
    };

    return (
        <div className="p-4 md:p-8 space-y-8">
            <h1 className="text-4xl font-bold text-yellow-800 dark:text-yellow-300 mb-6">Admin Panel</h1>
            
            <div className="bg-white dark:bg-gray-800 p-6 rounded-md border-2 border-yellow-500 shadow-lg">
                <h2 className="text-2xl font-bold text-yellow-700 dark:text-yellow-400 mb-4">Season Schedule Manager</h2>
                <div className="space-y-8">
                    <ScheduleEditor scheduleId="live_season_template" title="Default Live Season Schedule" weekCount={10} />
                    <div className="border-t-2 border-gray-200 dark:border-gray-700 my-8"></div>
                    <ScheduleEditor scheduleId="off_season_template" title="Default Off-Season Schedule" weekCount={7} />
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-md border-2 border-yellow-500 shadow-lg">
                <h2 className="text-2xl font-bold text-yellow-700 dark:text-yellow-400 mb-4">Manage User Roles</h2>
                <div className="space-y-4">
                    <p>Enter a user's email address to grant or revoke admin privileges.</p>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="user@example.com"
                        className="w-full bg-gray-100 dark:bg-gray-900 border border-gray-400 dark:border-yellow-500 rounded p-2 text-gray-800 dark:text-yellow-300 placeholder-gray-500 dark:placeholder-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    />
                    <div className="flex space-x-4">
                        <button onClick={() => handleRoleChange(true)} disabled={isLoadingRoles || !email} className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400">
                            {isLoadingRoles ? 'Working...' : 'Make Admin'}
                        </button>
                        <button onClick={() => handleRoleChange(false)} disabled={isLoadingRoles || !email} className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400">
                            {isLoadingRoles ? 'Working...' : 'Remove Admin'}
                        </button>
                    </div>
                    {message && <p className="mt-4 text-sm font-semibold">{message}</p>}
                </div>
            </div>
        </div>
    );
};


const Footer = () => {
    return (
        <footer className="bg-gray-100 dark:bg-black border-t-2 border-yellow-600 dark:border-yellow-700 p-4 text-center text-gray-600 dark:text-yellow-500 mt-auto">
            <div className="mb-2">
                <a href="https://discord.gg/YvFRJ97A5H" target="_blank" rel="noopener noreferrer" className="text-indigo-500 dark:text-indigo-400 hover:underline font-semibold">
                    Join the Community on Discord
                </a>
            </div>
            <p>&copy; {new Date().getFullYear()} marching.art. All Rights Reserved.</p>
        </footer>
    );
};

// --- Main App Component ---

export default function App() {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState('home');
    const [isLoginModalOpen, setLoginModalOpen] = useState(false);
    const [isSignUpModalOpen, setSignUpModalOpen] = useState(false);
    const [theme, setTheme] = useState('light');

    // --- Theme Management ---
    useEffect(() => {
        const savedTheme = localStorage.getItem('theme') || 'light';
        setTheme(savedTheme);
    }, []);

    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
    };

    // --- Authentication Effect ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                const tokenResult = await getIdTokenResult(currentUser);
                setIsAdmin(!!tokenResult.claims.admin);
            } else {
                setIsAdmin(false);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // --- Profile Data Effect ---
    useEffect(() => {
        let unsubscribe;
        // Only fetch profile if the user is not anonymous
        if (user && !user.isAnonymous) {
            const userDocRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data');
            unsubscribe = onSnapshot(userDocRef, (doc) => {
                setProfile(doc.exists() ? doc.data() : null);
            }, (error) => {
                console.error("Error fetching profile:", error);
            });
        } else {
            setProfile(null);
        }
        return () => { if (unsubscribe) unsubscribe(); };
    }, [user]);

    // --- Page Navigation Logic ---
    useEffect(() => {
        // **FIXED LOGIC**: Only go to dashboard if user exists AND is not anonymous
        if (user && !user.isAnonymous) {
            setPage('dashboard');
        } else {
            setPage('home');
        }
    }, [user]);

    // --- Event Handlers ---
    const handleLogout = async () => {
        try {
            await signOut(auth);
            setProfile(null);
            setIsAdmin(false);
            setPage('home');
        } catch (error) {
            console.error("Error signing out: ", error);
        }
    };

    const openLoginModal = () => { setSignUpModalOpen(false); setLoginModalOpen(true); };
    const openSignUpModal = () => { setLoginModalOpen(false); setSignUpModalOpen(true); };
    const closeModal = () => { setLoginModalOpen(false); setSignUpModalOpen(false); };
    
    // Determine if a real user is logged in
    const isLoggedIn = user && !user.isAnonymous;

    // --- Render Logic ---
    const renderPage = () => {
        switch (page) {
            case 'dashboard': 
                return isLoggedIn ? <DashboardPage profile={profile} /> : <HomePage onSignUpClick={openSignUpModal} />;
            case 'profile': 
                return isLoggedIn ? <ProfilePage profile={profile} userId={user?.uid} /> : <HomePage onSignUpClick={openSignUpModal} />;
            case 'admin':
                return isLoggedIn && isAdmin ? <AdminPage /> : <HomePage onSignUpClick={openSignUpModal} />;
            case 'home': 
            default: 
                return <HomePage onSignUpClick={openSignUpModal} />;
        }
    };

    if (loading) {
        return (
            <div className="bg-white dark:bg-black min-h-screen flex items-center justify-center text-yellow-600 dark:text-yellow-400 text-2xl font-sans">
                Loading System...
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-black text-gray-800 dark:text-yellow-200 min-h-screen flex flex-col font-sans">
            <Header
                isLoggedIn={isLoggedIn}
                isAdmin={isAdmin}
                profile={profile}
                onLoginClick={openLoginModal}
                onSignUpClick={openSignUpModal}
                onLogout={handleLogout}
                setPage={setPage}
                theme={theme}
                toggleTheme={toggleTheme}
            />
            <main className="flex-grow container mx-auto px-4 py-8">
                {renderPage()}
            </main>
            <Footer />
            <Modal isOpen={isLoginModalOpen} onClose={closeModal} title="LOGIN">
                <LoginForm onLoginSuccess={closeModal} switchToSignUp={openSignUpModal} />
            </Modal>
            <Modal isOpen={isSignUpModalOpen} onClose={closeModal} title="CREATE ACCOUNT">
                <SignUpForm onSignUpSuccess={closeModal} switchToLogin={openLoginModal} />
            </Modal>
        </div>
    );
}
