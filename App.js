import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, onSnapshot } from 'firebase/firestore';

// --- Firebase Configuration ---
// These global variables are provided by the environment.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'marching-art';
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

// --- Helper Components ---

const Icon = ({ path, className = "w-6 h-6" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
);

const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 border-2 border-green-500 rounded-md shadow-lg w-full max-w-md p-6 relative text-gray-800 dark:text-green-300">
                <button onClick={onClose} className="absolute top-3 right-3 text-gray-500 dark:text-green-400 hover:text-gray-800 dark:hover:text-green-200 transition-colors">
                    <Icon path="M6 18L18 6M6 6l12 12" />
                </button>
                <h2 className="text-2xl font-bold mb-4 text-green-600 dark:text-green-400 tracking-wider">{title}</h2>
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
            await setDoc(userDocRef, {
                username: username,
                email: user.email,
                createdAt: new Date(),
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
                className="w-full bg-gray-100 dark:bg-gray-900 border border-gray-400 dark:border-green-500 rounded p-2 mb-4 text-gray-800 dark:text-green-300 placeholder-gray-500 dark:placeholder-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full bg-gray-100 dark:bg-gray-900 border border-gray-400 dark:border-green-500 rounded p-2 mb-4 text-gray-800 dark:text-green-300 placeholder-gray-500 dark:placeholder-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full bg-gray-100 dark:bg-gray-900 border border-gray-400 dark:border-green-500 rounded p-2 mb-4 text-gray-800 dark:text-green-300 placeholder-gray-500 dark:placeholder-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <button type="submit" className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded border-b-4 border-green-800 hover:border-green-700 transition-all">
                Sign Up
            </button>
            <p className="text-center mt-4 text-sm text-gray-600 dark:text-gray-400">
                Already have an account?{' '}
                <button type="button" onClick={switchToLogin} className="text-green-600 dark:text-green-400 hover:underline">Log In</button>
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
                className="w-full bg-gray-100 dark:bg-gray-900 border border-gray-400 dark:border-green-500 rounded p-2 mb-4 text-gray-800 dark:text-green-300 placeholder-gray-500 dark:placeholder-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full bg-gray-100 dark:bg-gray-900 border border-gray-400 dark:border-green-500 rounded p-2 mb-4 text-gray-800 dark:text-green-300 placeholder-gray-500 dark:placeholder-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <button type="submit" className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded border-b-4 border-green-800 hover:border-green-700 transition-all">
                Log In
            </button>
            <p className="text-center mt-4 text-sm text-gray-600 dark:text-gray-400">
                Don't have an account?{' '}
                <button type="button" onClick={switchToSignUp} className="text-green-600 dark:text-green-400 hover:underline">Sign Up</button>
            </p>
        </form>
    );
};


// --- Page Components ---

const Header = ({ isLoggedIn, onLoginClick, onSignUpClick, onLogout, setPage, profile, theme, toggleTheme }) => {
    return (
        <header className="bg-gray-100 dark:bg-gray-900 border-b-4 border-green-500 p-4 flex justify-between items-center shadow-md">
            <div className="text-xl md:text-3xl font-bold text-green-700 dark:text-green-400 tracking-wider cursor-pointer" onClick={() => setPage('home')}>
                marching.art
            </div>
            <div className="flex items-center space-x-2 md:space-x-4">
                <nav className="flex items-center space-x-2 md:space-x-4">
                    {isLoggedIn ? (
                        <>
                            <span className="text-gray-700 dark:text-green-300 hidden sm:block">Welcome, {profile?.username || ''}</span>
                            <button onClick={() => setPage('profile')} className="text-gray-700 dark:text-green-300 hover:text-black dark:hover:text-white transition-colors">Profile</button>
                            <button onClick={onLogout} className="bg-gray-300 dark:bg-green-700 hover:bg-gray-400 dark:hover:bg-green-600 text-gray-800 dark:text-white font-bold py-2 px-3 rounded border-b-2 border-gray-400 dark:border-green-800 transition-all text-sm">
                                Logout
                            </button>
                        </>
                    ) : (
                        <>
                            <button onClick={onLoginClick} className="text-gray-700 dark:text-green-300 hover:text-black dark:hover:text-white transition-colors">Log In</button>
                            <button onClick={onSignUpClick} className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-3 rounded border-b-4 border-green-800 hover:border-green-700 transition-all text-sm">
                                Sign Up
                            </button>
                        </>
                    )}
                </nav>
                 <button onClick={toggleTheme} className="p-2 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-green-300 focus:outline-none focus:ring-2 focus:ring-green-500">
                    {theme === 'light' ? <Icon path="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" /> : <Icon path="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M12 21a9 9 0 110-18 9 9 0 010 18z" />}
                </button>
            </div>
        </header>
    );
};

const HomePage = ({ onSignUpClick }) => {
    return (
        <div className="text-center p-8">
            <h1 className="text-4xl md:text-5xl font-bold text-green-800 dark:text-green-300 mb-4 tracking-wider">Your Field of Dreams Awaits</h1>
            <p className="text-lg text-gray-700 dark:text-green-200 mb-8 max-w-2xl mx-auto">
                Assemble your ultimate drum corps lineup. Compete against friends. Follow the season's scores and rise to the top. This is where fantasy meets the field.
            </p>
            <button onClick={onSignUpClick} className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-8 rounded-md text-xl transition-all border-b-4 border-green-700 hover:border-green-800 transform hover:translate-y-px">
                Join a League Today!
            </button>
            
            <div className="mt-16 grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-md border-2 border-green-500 shadow-md">
                    <h3 className="text-2xl font-bold text-green-700 dark:text-green-400 mb-2">Live Scoring</h3>
                    <p className="text-gray-600 dark:text-green-300">Scores are updated during the 10-week DCI season, culminating at Finals. Your fantasy points reflect real-world performance.</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-md border-2 border-green-500 shadow-md">
                    <h3 className="text-2xl font-bold text-green-700 dark:text-green-400 mb-2">Off-Season Fun</h3>
                    <p className="text-gray-600 dark:text-green-300">The competition never stops. During the off-season, we use a mix of historical scores to keep the game exciting year-round.</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-md border-2 border-green-500 shadow-md">
                    <h3 className="text-2xl font-bold text-green-700 dark:text-green-400 mb-2">Create Your Profile</h3>
                    <p className="text-gray-600 dark:text-green-300">Build your manager profile, track your history, and show off your championship titles to the world.</p>
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
            <h1 className="text-4xl font-bold text-green-800 dark:text-green-300 mb-6">Manager Dashboard</h1>
            <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-md border-2 border-green-500 shadow-lg">
                    <h2 className="text-2xl font-bold text-green-700 dark:text-green-400 mb-4">My Team: "The Phantom Regiment"</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b-2 border-green-600 dark:border-green-700">
                                    <th className="p-2 text-gray-800 dark:text-green-200">Corps</th>
                                    <th className="p-2 text-gray-800 dark:text-green-200">Last Score</th>
                                    <th className="p-2 text-gray-800 dark:text-green-200">Change</th>
                                    <th className="p-2 text-gray-800 dark:text-green-200">Fantasy Points</th>
                                </tr>
                            </thead>
                            <tbody>
                                {corps.map((c) => (
                                    <tr key={c.name} className="border-b border-gray-200 dark:border-gray-700">
                                        <td className="p-2 font-semibold text-gray-900 dark:text-green-200">{c.name}</td>
                                        <td className={`p-2 ${c.change.startsWith('+') ? 'text-green-600' : c.change.startsWith('-') ? 'text-red-600' : 'text-gray-700 dark:text-gray-400'}`}>{c.score.toFixed(3)}</td>
                                        <td className={`p-2 ${c.change.startsWith('+') ? 'text-green-600' : c.change.startsWith('-') ? 'text-red-600' : 'text-gray-700 dark:text-gray-400'}`}>{c.change}</td>
                                        <td className="p-2 text-gray-800 dark:text-green-300">{(c.score * 10).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-md border-2 border-green-500 shadow-lg">
                    <h2 className="text-2xl font-bold text-green-700 dark:text-green-400 mb-4">League: "World Class Champions"</h2>
                    <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-green-300">
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

const ProfilePage = ({ profile, userId }) => {
    if (!profile) {
        return <div className="p-8 text-center text-gray-600 dark:text-green-300">Loading profile...</div>;
    }
    return (
        <div className="p-4 md:p-8 max-w-2xl mx-auto">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-md border-2 border-green-500 shadow-lg">
                <h1 className="text-3xl font-bold text-green-800 dark:text-green-300 mb-6">My Profile</h1>
                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-bold text-green-600 dark:text-green-500 tracking-wider">USERNAME</label>
                        <p className="text-xl text-gray-900 dark:text-green-200">{profile.username}</p>
                    </div>
                    <div>
                        <label className="text-sm font-bold text-green-600 dark:text-green-500 tracking-wider">EMAIL</label>
                        <p className="text-xl text-gray-900 dark:text-green-200">{profile.email}</p>
                    </div>
                    <div>
                        <label className="text-sm font-bold text-green-600 dark:text-green-500 tracking-wider">MEMBER SINCE</label>
                        <p className="text-xl text-gray-900 dark:text-green-200">{profile.createdAt?.toDate().toLocaleDateString()}</p>
                    </div>
                    <div>
                        <label className="text-sm font-bold text-green-600 dark:text-green-500 tracking-wider">USER ID</label>
                        <p className="text-xs text-gray-500 dark:text-green-400 break-all">{userId}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

const Footer = () => {
    return (
        <footer className="bg-gray-100 dark:bg-gray-900 border-t-2 border-green-600 dark:border-green-700 p-4 text-center text-gray-600 dark:text-green-500 mt-auto">
            <p>&copy; {new Date().getFullYear()} marching.art. All Rights Reserved.</p>
        </footer>
    );
};

// --- Main App Component ---

export default function App() {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
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
        const authCheck = async () => {
            try {
                // This handles the case where the app is run in an environment that provides a token.
                // For regular users, this will not run.
                if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                    await signInWithCustomToken(auth, __initial_auth_token);
                }
            } catch (error) {
                console.error("Authentication Error:", error);
            }
        };
        authCheck();
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
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
                // Protect the dashboard route
                return isLoggedIn ? <DashboardPage profile={profile} /> : <HomePage onSignUpClick={openSignUpModal} />;
            case 'profile': 
                // Protect the profile route
                return isLoggedIn ? <ProfilePage profile={profile} userId={user?.uid} /> : <HomePage onSignUpClick={openSignUpModal} />;
            case 'home': 
            default: 
                return <HomePage onSignUpClick={openSignUpModal} />;
        }
    };

    if (loading) {
        return (
            <div className="bg-white dark:bg-gray-900 min-h-screen flex items-center justify-center text-green-600 dark:text-green-400 text-2xl font-sans">
                Loading System...
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-900 text-gray-800 dark:text-green-200 min-h-screen flex flex-col font-sans">
            <Header
                isLoggedIn={isLoggedIn}
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
