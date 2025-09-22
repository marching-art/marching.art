import React, { useState, useEffect, useMemo, useCallback, useRef, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useParams, Navigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

// FIREBASE & ZUSTAND (State Management)
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// --- MOCK DATA & CONFIG (Replace with your actual data files) ---

const DCI_HALL_OF_FAME_STAFF = { GE1: [], GE2: [], VP: [], VA: [], CG: [], B: [], MA: [], P: [] };
const CORPS_CLASSES = {
    worldClass: { name: 'World Class', pointCap: 150, color: 'bg-yellow-500' },
    openClass: { name: 'Open Class', pointCap: 120, color: 'bg-blue-500' },
    aClass: { name: 'A Class', pointCap: 60, color: 'bg-green-500' }
};

// --- 1. FIREBASE SETUP ---
const firebaseConfig = {
    apiKey: "AIzaSyA4Qhjpp2MVwo0h0t2dNtznSIDMjlKQ5JE",
    authDomain: "marching-art.firebaseapp.com",
    projectId: "marching-art",
    storageBucket: "marching-art.firebasestorage.app",
    messagingSenderId: "278086562126",
    appId: "1:278086562126:web:f7737ee897774c3d9a6e1f",
    measurementId: "G-H0KE8GJS7M"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);
const dataNamespace = process.env.REACT_APP_DATA_NAMESPACE || 'prod';

// --- 2. API CALLS ---
const api = {
    createUserProfile: (data) => httpsCallable(functions, 'createUserProfile')(data),
    checkUsername: (data) => httpsCallable(functions, 'checkUsername')(data),
};

// --- 3. ZUSTAND USER STORE (STATE MANAGEMENT) ---
const useUserStore = create(
    persist(
        (set, get) => ({
            user: null,
            loggedInProfile: null,
            isLoadingAuth: true,
            initializeUser: async (firebaseUser) => {
                if (!firebaseUser) {
                    set({ user: null, loggedInProfile: null, isLoadingAuth: false });
                    return;
                }
                set({ user: firebaseUser, isLoadingAuth: true });
                try {
                    const profileRef = doc(db, `artifacts/${dataNamespace}/users/${firebaseUser.uid}/profile/data`);
                    const profileSnap = await getDoc(profileRef);
                    if (profileSnap.exists()) {
                        set({ loggedInProfile: { userId: firebaseUser.uid, ...profileSnap.data() } });
                    } else {
                        // User is authenticated but has no profile - this triggers onboarding
                        set({ loggedInProfile: null });
                    }
                } catch (error) {
                    console.error("Error fetching user profile:", error);
                    set({ loggedInProfile: null });
                } finally {
                    set({ isLoadingAuth: false });
                }
            },
            setProfile: (profile) => set({ loggedInProfile: profile }),
            clearUser: () => set({ user: null, loggedInProfile: null }),
        }),
        {
            name: 'user-auth-store',
            storage: createJSONStorage(() => localStorage),
        }
    )
);

// --- 4. AUTHENTICATION CONTEXT ---
const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const { initializeUser, clearUser } = useUserStore();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                initializeUser(user);
            } else {
                clearUser();
                initializeUser(null);
            }
        });
        return () => unsubscribe();
    }, [initializeUser, clearUser]);

    const value = {
        signup: (email, password) => createUserWithEmailAndPassword(auth, email, password),
        login: (email, password) => signInWithEmailAndPassword(auth, email, password),
        logout: () => signOut(auth),
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// --- 5. UI COMPONENTS ---

const LoadingScreen = ({ message = 'Loading...' }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-80 backdrop-blur-sm">
        <div className="text-center text-white">
            <div className="w-12 h-12 mx-auto mb-4 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
            <p className="text-lg font-semibold">{message}</p>
        </div>
    </div>
);

const OnboardingFlow = ({ onComplete }) => {
    const { user } = useUserStore();
    const setProfile = useUserStore((state) => state.setProfile);
    const [username, setUsername] = useState('');
    const [isChecking, setIsChecking] = useState(false);
    const [isAvailable, setIsAvailable] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (username.length >= 3) {
            const delayDebounce = setTimeout(async () => {
                setIsChecking(true);
                try {
                    const result = await api.checkUsername({ username });
                    setIsAvailable(result.data.success);
                } catch (error) {
                    setIsAvailable(false);
                }
                setIsChecking(false);
            }, 500);
            return () => clearTimeout(delayDebounce);
        } else {
            setIsAvailable(null);
        }
    }, [username]);

    const handleComplete = async () => {
        if (!isAvailable || username.length < 3) {
            toast.error("Please choose an available username.");
            return;
        }
        setIsLoading(true);
        try {
            await api.createUserProfile({ username });
            // Manually fetch the new profile to update the store
            const profileRef = doc(db, `artifacts/${dataNamespace}/users/${user.uid}/profile/data`);
            const profileSnap = await getDoc(profileRef);
            if (profileSnap.exists()) {
                setProfile({ userId: user.uid, ...profileSnap.data() });
                toast.success(`Welcome, ${username}! Your profile is ready.`);
                onComplete();
            } else {
                throw new Error("Profile was not created successfully.");
            }
        } catch (error) {
            toast.error(error.message || "Failed to create profile.");
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-gray-900">Welcome to marching.art!</h1>
                    <p className="mt-2 text-gray-600">Let's create your director profile.</p>
                </div>
                <div>
                    <label htmlFor="username" className="block text-sm font-medium text-gray-700">Username</label>
                    <input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                        className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Choose a unique username"
                    />
                    <div className="h-5 mt-1 text-sm">
                        {isChecking && <p className="text-gray-500">Checking availability...</p>}
                        {isAvailable === true && <p className="text-green-600">Username is available!</p>}
                        {isAvailable === false && <p className="text-red-600">Username is taken.</p>}
                    </div>
                </div>
                <button
                    onClick={handleComplete}
                    disabled={isLoading || !isAvailable}
                    className="w-full py-3 px-4 text-white bg-indigo-600 rounded-md font-semibold hover:bg-indigo-700 disabled:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                    {isLoading ? 'Creating Profile...' : 'Complete Setup'}
                </button>
            </div>
        </div>
    );
};


const AuthModal = ({ isOpen, onClose, initialView = 'login' }) => {
    const { signup, login } = useAuth();
    const [view, setView] = useState(initialView);
    const [isLoading, setIsLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            if (view === 'signup') {
                if (password !== confirmPassword) throw new Error("Passwords do not match.");
                await signup(email, password);
                toast.success("Account created! Please complete your profile.");
            } else {
                await login(email, password);
                toast.success("Welcome back!");
            }
            onClose();
        } catch (error) {
            toast.error(error.message || "An error occurred.");
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={onClose}>
            <div className="bg-white rounded-lg p-8 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold mb-4">{view === 'login' ? 'Sign In' : 'Create Account'}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                     <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full p-2 border rounded"/>
                     <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full p-2 border rounded"/>
                     {view === 'signup' && <input type="password" placeholder="Confirm Password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required className="w-full p-2 border rounded"/>}
                     <button type="submit" disabled={isLoading} className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600 disabled:bg-gray-400">
                        {isLoading ? 'Loading...' : (view === 'login' ? 'Sign In' : 'Sign Up')}
                     </button>
                </form>
                <button onClick={() => setView(view === 'login' ? 'signup' : 'login')} className="mt-4 text-sm text-blue-500 hover:underline">
                    {view === 'login' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
                </button>
            </div>
        </div>
    );
};

// --- 6. MOCK PAGES & LAYOUT ---

const HomePage = ({ onLoginClick, onSignUpClick }) => (
    <div className="text-center p-8">
        <h1 className="text-4xl font-bold mb-4">Ultimate Fantasy Drum Corps</h1>
        <p className="mb-8">Build your dream corps. Compete. Become a legend.</p>
        <div className="space-x-4">
            <button onClick={onSignUpClick} className="bg-blue-500 text-white px-6 py-2 rounded">Get Started</button>
            <button onClick={onLoginClick} className="bg-gray-200 px-6 py-2 rounded">Sign In</button>
        </div>
    </div>
);

const DashboardPage = () => {
    const { loggedInProfile } = useUserStore();
    return <div className="p-8">Dashboard for {loggedInProfile?.username}</div>;
};

const Header = ({ onLoginClick, onSignUpClick }) => {
    const { user } = useUserStore();
    const { logout } = useAuth();
    return (
        <header className="p-4 bg-gray-100 flex justify-between items-center">
            <Link to="/" className="font-bold text-xl">marching.art</Link>
            <nav>
                {user ? (
                    <button onClick={logout} className="bg-red-500 text-white px-4 py-2 rounded">Logout</button>
                ) : (
                    <div className="space-x-2">
                         <button onClick={onLoginClick} className="px-4 py-2 rounded">Login</button>
                         <button onClick={onSignUpClick} className="bg-blue-500 text-white px-4 py-2 rounded">Sign Up</button>
                    </div>
                )}
            </nav>
        </header>
    );
};

const ProtectedRoute = ({ children }) => {
    const { user, loggedInProfile } = useUserStore();
    if (!user || !loggedInProfile) {
        return <Navigate to="/" replace />;
    }
    return children;
};

// --- 7. MAIN APP COMPONENT & ROUTER ---
const AppContent = () => {
    const { user, loggedInProfile, isLoadingAuth } = useUserStore();
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [authView, setAuthView] = useState('login');

    const handleLoginClick = () => {
        setAuthView('login');
        setShowAuthModal(true);
    };

    const handleSignUpClick = () => {
        setAuthView('signup');
        setShowAuthModal(true);
    };

    if (isLoadingAuth) {
        return <LoadingScreen message="Authenticating..." />;
    }

    // This is the CRITICAL logic check for new users
    if (user && !loggedInProfile) {
        return <OnboardingFlow onComplete={() => console.log("Onboarding complete!")} />;
    }

    return (
        <div className="flex flex-col min-h-screen">
            <Header onLoginClick={handleLoginClick} onSignUpClick={handleSignUpClick} />
            <main className="flex-grow">
                <Routes>
                    <Route path="/" element={<HomePage onLoginClick={handleLoginClick} onSignUpClick={handleSignUpClick} />} />
                    <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
                    {/* Add other protected routes here */}
                </Routes>
            </main>
            <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} initialView={authView} />
        </div>
    );
};

const App = () => {
    return (
        <AuthProvider>
            <BrowserRouter>
                <AppContent />
                <Toaster position="top-center" />
            </BrowserRouter>
        </AuthProvider>
    );
};

export default App;