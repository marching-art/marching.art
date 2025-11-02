/*
  marching.art - React Frontend Framework (v1.6)
  - UPGRADE: Implements a realtime `onSnapshot` listener for the user profile.
  - UPGRADE: Simplifies and secures the auth flow to prioritize the
    `__initial_auth_token` and remove the anonymous fallback.
*/
import React, { useState, useEffect, createContext, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  signInWithCustomToken,
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot // <-- IMPORT REALTIME LISTENER
} from 'firebase/firestore'; 
import {
  Home,
  BarChart,
  Users,
  Calendar,
  Award,
  BookOpen,
  LogOut,
  Menu,
  X,
  Plus,
  Loader2,
  Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- 1. FIREBASE CONFIG ---
let firebaseConfig;
try {
  if (typeof __firebase_config !== 'undefined' && __firebase_config) {
    firebaseConfig = JSON.parse(__firebase_config);
  } else {
    console.warn("Using fallback Firebase config. __firebase_config not found.");
    firebaseConfig = {
      apiKey: "AIzaSyA4Qhjpp2MVwo0h0t2dNtznSIDMjlKQ5JE",
      authDomain: "marching-art.firebaseapp.com",
      projectId: "marching-art",
      storageBucket: "marching-art.firebasestorage.app",
      messagingSenderId: "278086562126",
      appId: "1:278086562126:web:f7737ee897774c3d9a6e1f",
      measurementId: "G-H0KE8GJS7M"
    };
  }
} catch (e) {
  console.error("Firebase config is not valid JSON:", e);
  firebaseConfig = {}; 
}

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- 2. FIREBASE & AUTH CONTEXT ---
let app;
let auth;
let db;

if (firebaseConfig.apiKey) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} else {
  console.error("Firebase is not initialized. Check your config.");
}

const FirebaseContext = createContext(null);
const useFirebase = () => useContext(FirebaseContext);

// --- 3. REUSABLE COMPONENT LIBRARY (Semantic Black & Gold Theme) ---

const LogoIcon = ({ className }) => (
  <img 
    src="/logo192.png" 
    alt="marching.art logo" 
    className={className} 
  />
);

const MainLayout = ({ children }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState('Hub');
  const { user, userProfile } = useFirebase();

  const MyCorpsIcon = () => (
    <Shield className="h-6 w-6 sm:h-5 sm:w-5" />
  );

  const navItems = [
    { name: 'Hub', icon: Home, page: 'Hub' },
    { name: 'My Corps', icon: MyCorpsIcon, page: 'Dashboard' },
    { name: 'Scores', icon: BarChart, page: 'Scores' },
    { name: 'Leagues', icon: Users, page: 'Leagues' },
    { name: 'Schedule', icon: Calendar, page: 'Schedule' },
    { name: 'Leaderboard', icon: Award, page: 'Leaderboard' },
    { name: 'How to Play', icon: BookOpen, page: 'HowToPlay' },
  ];

  const NavLink = ({ item, isMobile = false }) => (
    <button
      onClick={() => {
        setCurrentPage(item.page);
        if (isMobile) setMobileMenuOpen(false);
      }}
      className={`
        flex ${isMobile ? 'items-center px-3 py-3 w-full' : 'flex-col items-center p-2 sm:flex-row sm:p-0 sm:items-start sm:w-full sm:px-3 sm:py-2'}
        rounded-lg transition-colors duration-150 group
        ${currentPage === item.page
          ? 'text-white bg-primary'
          : 'text-text-secondary hover:text-text-primary hover:bg-surface-dark'
        }
      `}
    >
      <item.icon />
      <span className={`
        ${isMobile ? 'ml-4 font-medium' : 'mt-1 text-xs font-medium sm:mt-0 sm:ml-3'}
      `}>
        {item.name}
      </span>
    </button>
  );

  const ProfileDropdown = () => {
    const { auth } = useFirebase();
    return (
      <div
        className="flex items-center gap-3 p-3 transition-colors duration-150 cursor-pointer rounded-lg hover:bg-surface-dark"
        onClick={() => setCurrentPage('Profile')}
      >
        <img
          className="h-10 w-10 rounded-full bg-surface-dark object-cover"
          src={userProfile?.avatarUrl || `https://api.dicebear.com/8.x/bottts/svg?seed=${user?.uid || 'default'}`}
          alt="Profile"
        />
        <div className="hidden sm:block flex-1">
          <p className="text-sm font-semibold text-white truncate">{userProfile?.username || 'New Director'}</p>
          <p className="text-xs text-text-secondary">View Profile</p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (auth) signOut(auth);
          }}
          className="hidden sm:block text-text-secondary hover:text-text-primary"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    );
  };

  return (
    <div className="flex h-screen w-full bg-background text-text-primary font-inter">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-56 lg:w-64 flex-shrink-0 bg-surface border-r border-secondary/30">
        <div className="flex flex-col h-full p-4">
          
          <div 
            onClick={() => setCurrentPage('Hub')} 
            className="flex items-center space-x-3 cursor-pointer group px-2"
          >
            <div className="relative">
              <LogoIcon className="h-10 w-10 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12" />
              <div className="absolute inset-0 blur-xl bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
            <span className="text-2xl font-bold tracking-tight">
              <span className="text-text-primary">marching</span>
              <span className="gradient-text">.art</span>
            </span>
          </div>
          
          <nav className="mt-8 flex-1 space-y-2">
            {navItems.map((item) => <NavLink key={item.name} item={item} />)}
          </nav>
          <div className="mt-auto">
            {user && <ProfileDropdown />}
          </div>
        </div>
      </aside>

      {/* Mobile Menu (Overlay) */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed inset-0 z-50 flex flex-col bg-surface p-4 md:hidden"
          >
            <div className="flex items-center justify-between">
              
              <div 
                onClick={() => {
                  setCurrentPage('Hub');
                  setMobileMenuOpen(false);
                }} 
                className="flex items-center space-x-3 cursor-pointer group"
              >
                <div className="relative">
                  <LogoIcon className="h-10 w-10 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12" />
                  <div className="absolute inset-0 blur-xl bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
                <span className="text-2xl font-bold tracking-tight">
                  <span className="text-text-primary">marching</span>
                  <span className="gradient-text">.art</span>
                </span>
              </div>

              <button
                onClick={() => setMobileMenuOpen(false)}
                className="text-text-secondary hover:text-text-primary"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <nav className="mt-8 flex-1 space-y-2">
              {navItems.map((item) => (
                <NavLink key={item.name} item={item} isMobile />
              ))}
            </nav>
            <div className="mt-auto">
              {user && (
                <button
                  onClick={() => {
                    if (auth) signOut(auth);
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center px-3 py-3 w-full rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-dark"
                >
                  <LogOut className="h-6 w-6" />
                  <span className="ml-4 font-medium">Log Out</span>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Top Bar */}
        <header className="md:hidden flex items-center justify-between p-4 bg-surface border-b border-secondary/30">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="text-text-secondary hover:text-text-primary"
          >
            <Menu className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-bold text-white">{currentPage}</h1>
          <div className="w-8">
            {user && (
              <img
                className="h-8 w-8 rounded-full bg-surface-dark object-cover"
                src={userProfile?.avatarUrl || `https://api.dicebear.com/8.x/bottts/svg?seed=${user.uid}`}
                alt="Profile"
                onClick={() => setCurrentPage('Profile')}
              />
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPage}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="p-4 sm:p-6 lg:p-8"
            >
              {/* This is our "Page Router". */}
              {(() => {
                switch (currentPage) {
                  case 'Hub':
                    return <PageHubFeed />;
                  case 'Dashboard':
                    return <PageDashboard />;
                  case 'Scores':
                    return <PageScores />;
                  case 'Leagues':
                    return <PageLeagues />;
                  case 'Schedule':
                    return <PageSchedule />;
                  case 'Leaderboard':
                    return <PageLeaderboard />;
                  case 'HowToPlay':
                    return <PageHowToPlay />;
                  case 'Profile':
                    return <PageProfile />;
                  default:
                    return <PageHubFeed />;
                }
              })()}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Mobile Bottom Nav */}
        <nav className="md:hidden flex items-center justify-around p-2 bg-surface border-t border-secondary/30">
          {navItems.slice(0, 5).map((item) => ( // Show first 5 items
            <NavLink key={item.name} item={item} />
          ))}
        </nav>
      </div>
    </div>
  );
};

// ... (Card, Button, TextInput, Modal components remain unchanged) ...
/**
 * Card: A styled content container.
 * THEME: Card surface and border
 */
const Card = ({ children, className = '' }) => (
  <div
    className={`bg-surface border border-secondary/30 rounded-lg ${className}`}
  >
    {children}
  </div>
);

/**
 * Button: A set of styled buttons.
 * THEME: Using semantic colors from tailwind.config.js
 */
const Button = ({
  children,
  onClick,
  variant = 'primary',
  className = '',
  isLoading = false,
  icon: Icon
}) => {
  const baseStyle = "flex items-center justify-center px-4 py-2.5 rounded-lg font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50";

  const variants = {
    primary: 'bg-primary text-on-primary hover:bg-primary-dark focus:ring-primary',
    secondary: 'bg-secondary text-on-secondary hover:bg-secondary-dark focus:ring-secondary',
    danger: 'bg-red-600 text-white hover:bg-red-500 focus:ring-red-500',
    ghost: 'bg-transparent text-text-secondary hover:text-text-primary hover:bg-surface-dark'
  };

  return (
    <motion.button
      whileHover={{ scale: isLoading ? 1 : 1.05 }}
      whileTap={{ scale: isLoading ? 1 : 0.95 }}
      onClick={onClick}
      disabled={isLoading}
      className={`${baseStyle} ${variants[variant]} ${className}`}
    >
      {isLoading ? (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ loop: Infinity, duration: 1, ease: 'linear' }}
        >
          <Loader2 className="h-5 w-5" />
        </motion.div>
      ) : (
        <>
          {Icon && <Icon className="h-5 w-5 mr-2" />}
          {children}
        </>
      )}
    </motion.button>
  );
};

/**
 * TextInput: A styled text input field.
 * THEME: Using semantic colors
 */
const TextInput = ({ label, id, type = 'text', placeholder, ...props }) => (
  <div className="w-full">
    {/* THEME: Label text */}
    <label htmlFor={id} className="block text-sm font-medium text-text-primary mb-1">
      {label}
    </label>
    <input
      id={id}
      type={type}
      placeholder={placeholder}
      className="block w-full bg-surface-dark border-secondary/50 border rounded-lg px-3 py-2 text-white placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
      {...props}
    />
  </div>
);

/**
 * Modal: A pop-up container.
 * THEME: Using semantic colors
 */
const Modal = ({ children, isOpen, onClose }) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="bg-surface rounded-lg shadow-glow-sm w-full max-w-md border border-secondary/30"
          onClick={(e) => e.stopPropagation()} // Prevent closing on content click
        >
          {children}
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);


// --- 4. PLACEHOLDER PAGE COMPONENTS ---

const PageHubFeed = () => (
  <div>
    <h1 className="text-3xl font-bold text-white mb-6">Hub</h1>
    <Card className="p-6">
      <h2 className="text-xl font-semibold text-white mb-2">Welcome to the Hub</h2>
      <p className="text-text-secondary mb-4">
        This will be the central feed for all game activity, including scores,
        AI-generated recaps, league chat, and marketplace listings.
      </p>
      <Button variant="primary" icon={Plus}>Create Post (Demo)</Button>
    </Card>
  </div>
);

const PageDashboard = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const { userProfile } = useFirebase(); // Get real-time profile data

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-6">My Corps Dashboard</h1>
      <Card className="p-6 mb-6">
        <h2 className="text-xl font-semibold text-white mb-2">Welcome, {userProfile?.username || 'Director'}!</h2>
        <p className="text-text-secondary">
          Your CorpsCoin: <span className="text-primary font-bold">{userProfile?.corpsCoin || 0}</span>
        </p>
         <p className="text-text-secondary">
          Your XP: <span className="text-accent font-bold">{userProfile?.xp || 0}</span>
        </p>
      </Card>

      <Card className="p-6">
        <h2 className="text-xl font-semibold text-white mb-2">Corps Registration</h2>
        <p className="text-text-secondary mb-4">
          You haven't registered a corps for this season.
        </p>
        <Button variant="primary" onClick={() => setModalOpen(true)}>
          Register Your Corps
        </Button>
      </Card>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)}>
        <div className="p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Register New Corps</h2>
          <form className="space-y-4">
            <TextInput id="corpsName" label="Corps Name" placeholder="e.g., The Vanguard" />
            <TextInput id="showConcept" label="Show Concept (500 chars)" placeholder="A story of..." />
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button type="button" variant="primary" onClick={() => { /* save logic */ setModalOpen(false); }}>
                Save
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
};
const PageScores = () => <div><h1 className="text-3xl font-bold text-white">Scores</h1><p className="text-text-secondary">Score recaps will appear here.</p></div>;
const PageLeagues = () => <div><h1 className="text-3xl font-bold text-white">Leagues</h1><p className="text-text-secondary">League creation and chat will be here.</p></div>;
const PageSchedule = () => <div><h1 className="text-3xl font-bold text-white">Season Schedule</h1><p className="text-text-secondary">The full tour schedule will be browsable here.</p></div>;
const PageLeaderboard = () => <div><h1 className="text-3xl font-bold text-white">Leaderboard</h1><p className="text-text-secondary">The global leaderboard will be here.</p></div>;
const PageHowToPlay = () => <div><h1 className="text-3xl font-bold text-white">How to Play</h1><p className="text-text-secondary">The game guide will be here.</p></div>;
const PageProfile = () => <div><h1 className="text-3xl font-bold text-white">My Profile</h1><p className="text-text-secondary">User profiles, achievements, and stats.</p></div>;

// --- 5. LOGIN/AUTH COMPONENT ---
const AuthScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { auth } = useFirebase();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!auth) {
      setError("Auth service is not available.");
      return;
    }
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message.replace('Firebase: ', ''));
      } else {
        setError('An unknown error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background font-inter">
      <Card className="w-full max-w-sm p-8 shadow-glow-sm">
        <div className="flex justify-center mb-6">
          <img src="/logo512.png" alt="marching.art logo" className="h-16 w-16" />
        </div>
        <h2 className="text-2xl font-bold text-center text-white mb-6">
          {isLogin ? 'Welcome Back' : 'Create Account'}
        </h2>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <TextInput
            id="email"
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="director@marching.art"
            autoComplete="email"
          />
          <TextInput
            id="password"
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete={isLogin ? "current-password" : "new-password"}
          />

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            isLoading={loading}
          >
            {isLogin ? 'Log In' : 'Sign Up'}
          </Button>
        </form>

        <p className="text-sm text-center text-text-secondary mt-6">
          {isLogin ? "Don't have an account?" : "Already have an account?"}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="font-medium text-primary hover:text-primary-dark ml-1"
          >
            {isLogin ? 'Sign Up' : 'Log In'}
          </button>
        </p>
      </Card>
    </div>
  );
};

// --- 6. MAIN APP & AUTH WRAPPER ---
// This is the root component. It listens for auth changes
// and shows either the AuthScreen or the MainLayout.

export default function App() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authMethod, setAuthMethod] = useState(null); // 'token' or 'email'

  // This effect handles all authentication and profile listening.
  useEffect(() => {
    if (!auth || !db) {
      setIsLoading(false);
      console.error("Firebase Auth/DB is not initialized.");
      return;
    }

    let profileUnsubscribe = () => {}; // Function to detach the snapshot listener

    const authUnsubscribe = onAuthStateChanged(auth, async (user) => {
      // First, clean up any existing profile listener
      profileUnsubscribe();

      if (user) {
        // User is signed in.
        setUser(user);
        
        // This is the CORRECT, SECURE PATH from your guidelines.
        const userDocRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data');

        // *** NEW REALTIME LISTENER ***
        // Listen for real-time changes to the user's profile.
        profileUnsubscribe = onSnapshot(userDocRef, 
          async (docSnap) => {
            if (docSnap.exists()) {
              // Profile exists, update our React state
              setUserProfile(docSnap.data());
            } else {
              // First-time sign-in for this user, create their profile.
              const newProfile = {
                username: user.email ? user.email.split('@')[0] : 'New Director',
                email: user.email || null,
                uid: user.uid,
                createdAt: new Date(),
                xp: 0,
                corpsCoin: 0,
              };
              try {
                await setDoc(userDocRef, newProfile, { merge: true });
                setUserProfile(newProfile); // Set state after creation
              } catch (e) {
                console.error("Error creating user profile:", e);
              }
            }
          },
          (error) => {
            console.error("Error listening to user profile:", error);
          }
        );
        
        // Set the auth method
        if (user.isAnonymous) {
           // This case should no longer happen with the new logic
           console.warn("Anonymous user detected, but flow should prevent this.");
           setAuthMethod('email'); // Fallback to email
        } else if (!user.email) {
          setAuthMethod('token'); // Logged in via custom token
        } else {
          setAuthMethod('email'); // Logged in via email/pass
        }

      } else {
        // No user is signed in.
        setUser(null);
        setUserProfile(null);

        // Check for the custom token provided by the environment.
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          try {
            await signInWithCustomToken(auth, __initial_auth_token);
            setAuthMethod('token');
            // The onAuthStateChanged listener will fire again with the new user.
            return;
          } catch (e) {
            console.error("Custom token sign-in failed:", e);
            // If token fails, fall back to email auth screen
            setAuthMethod('email');
          }
        } else {
          // No custom token. Show the email/pass AuthScreen
          // This is the fallback for local development.
          setAuthMethod('email');
        }
      }
      setIsLoading(false);
    });

    // Cleanup both listeners on component unmount
    return () => {
      authUnsubscribe();
      profileUnsubscribe();
    };
  }, []); // Empty dependency array ensures this runs only once

  const authContextValue = {
    auth,
    db,
    user,
    userProfile, // This is now a real-time state
    appId,
  };

  // Show a global spinner while auth is resolving
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-12 w-12 text-primary animate-spin" />
      </div>
    );
  }

  // If Firebase didn't initialize, show an error.
  if (!auth || !db) {
     return (
      <div className="flex items-center justify-center min-h-screen bg-background text-text-primary p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-500 mb-4">Firebase Configuration Error</h1>
          <p className="text-text-secondary">Could not initialize Firebase. Please check your `__firebase_config` variable.</p>
        </div>
      </div>
    );
  }

  return (
    <FirebaseContext.Provider value={authContextValue}>
      <AnimatePresence>
        {/*
          This logic is now simpler:
          - If 'user' object exists (from token OR email), show MainLayout.
          - If 'user' is null AND authMethod is 'email', show AuthScreen (dev fallback).
        */}
        {user ? <MainLayout /> : (authMethod === 'email' ? <AuthScreen /> : <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-12 w-12 text-primary animate-spin" />
      </div>) }
      </AnimatePresence>
    </FirebaseContext.Provider>
  );
}

