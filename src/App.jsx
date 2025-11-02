/*
  marching.art - React Frontend Framework (v1.4)
  - Integrates the advanced, animated logo with hover effects.
  - Adds a new <LogoIcon /> component for this.
  - Fixes compilation error.
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
  signInAnonymously,
} from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, setLogLevel } from 'firebase/firestore';
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
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- 1. FIREBASE CONFIG ---
// This is your config from the development guidelines.
// It will be parsed from the global variable.
let firebaseConfig;
try {
  // Use the global variable if it exists
  if (typeof __firebase_config !== 'undefined' && __firebase_config) {
    firebaseConfig = JSON.parse(__firebase_config);
  } else {
    // Fallback for local development (same as your doc)
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
  firebaseConfig = {}; // Fallback to empty config
}

// This is the global app ID, essential for all user paths.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- 2. FIREBASE & AUTH CONTEXT ---
let app;
let auth;
let db;

if (firebaseConfig.apiKey) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  // Enable Firestore logging for debugging
  // setLogLevel('debug');
} else {
  console.error("Firebase is not initialized. Check your config.");
}

const FirebaseContext = createContext(null);
const useFirebase = () => useContext(FirebaseContext);

// --- 3. REUSABLE COMPONENT LIBRARY (Semantic Black & Gold Theme) ---

// NEW: LogoIcon component based on your old site's code
const LogoIcon = ({ className }) => (
  <img 
    src="/logo192.png" 
    alt="marching.art logo" 
    className={className} 
  />
);

/**
 * MainLayout: The responsive shell for the entire app.
 * THEME UPDATED: All classes now use semantic names from tailwind.config.js
 */
const MainLayout = ({ children }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // This state will be lifted or replaced by a router
  const [currentPage, setCurrentPage] = useState('Hub');
  const { user, userProfile } = useFirebase();

  // Create a custom icon component for 'My Corps'
  const MyCorpsIcon = () => (
    <img src="/logo192.png" alt="My Corps" className="h-6 w-6 sm:h-5 sm:w-5" />
  );

  const navItems = [
    { name: 'Hub', icon: Home, page: 'Hub' },
    { name: 'My Corps', icon: MyCorpsIcon, page: 'Dashboard' }, // LOGO: Use custom icon
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
          ? 'text-white bg-primary' // THEME: Gold active state
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
            e.stopPropagation(); // Don't trigger the profile click
            signOut(auth);
          }}
          className="hidden sm:block text-text-secondary hover:text-text-primary"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    );
  };

  return (
    // THEME: Main background and text
    <div className="flex h-screen w-full bg-background text-text-primary font-inter">
      {/* Desktop Sidebar */}
      {/* THEME: Card surface and border */}
      <aside className="hidden md:flex md:flex-col md:w-56 lg:w-64 flex-shrink-0 bg-surface border-r border-secondary/30">
        <div className="flex flex-col h-full p-4">
          
          {/* UPDATED: Advanced Logo */}
          <div 
            onClick={() => setCurrentPage('Hub')} 
            className="flex items-center space-x-3 cursor-pointer group px-2"
          >
            <div className="relative">
              <LogoIcon className="h-10 w-10 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12" />
              {/* This uses the 'primary' color from your tailwind.config.js */}
              <div className="absolute inset-0 blur-xl bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
            <span className="text-2xl font-bold tracking-tight">
              {/* This uses 'text-primary' from your tailwind.config.js */}
              <span className="text-text-primary">marching</span>
              <span className="gradient-text">.art</span>
            </span>
          </div>
          
          <nav className="mt-8 flex-1 space-y-2">
            {navItems.map((item) => <NavLink key={item.name} item={item} />)}
          </nav>
          <div className="mt-auto">
            <ProfileDropdown />
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
              
              {/* UPDATED: Advanced Logo (Mobile) */}
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
              <button
                onClick={() => {
                  signOut(auth);
                  setMobileMenuOpen(false);
                }}
                className="flex items-center px-3 py-3 w-full rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-dark"
              >
                <LogOut className="h-6 w-6" />
                <span className="ml-4 font-medium">Log Out</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Top Bar */}
        {/* THEME: Card surface and border */}
        <header className="md:hidden flex items-center justify-between p-4 bg-surface border-b border-secondary/30">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="text-text-secondary hover:text-text-primary"
          >
            <Menu className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-bold text-white">{currentPage}</h1>
          <div className="w-8">
            <img
              className="h-8 w-8 rounded-full bg-surface-dark object-cover"
              src={userProfile?.avatarUrl || `https://api.dicebear.com/8.x/bottts/svg?seed=${user?.uid || 'default'}`}
              alt="Profile"
              onClick={() => setCurrentPage('Profile')}
            />
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
        {/* THEME: Card surface and border */}
        <nav className="md:hidden flex items-center justify-around p-2 bg-surface border-t border-secondary/30">
          {navItems.slice(0, 5).map((item) => ( // Show first 5 items
            <NavLink key={item.name} item={item} />
          ))}
        </nav>
      </div>
    </div>
  );
};

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
// These will now inherit the new theme automatically.

const PageHubFeed = () => (
  <div>
    <h1 className="text-3xl font-bold text-white mb-6">Hub</h1>
    <Card className="p-6">
      <h2 className="text-xl font-semibold text-white mb-2">Welcome to the Hub</h2>
      <p className="text-text-secondary mb-4">
        This will be the central feed for all game activity, including scores,
        AI-generated recaps, league chat, and marketplace listings.
      </p>
      {/* THEME: This button is now Gold */}
      <Button variant="primary" icon={Plus}>Create Post (Demo)</Button>
    </Card>
  </div>
);

const PageDashboard = () => {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-6">My Corps Dashboard</h1>
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-white mb-2">Corps Registration</h2>
        <p className="text-text-secondary mb-4">
          You haven't registered a corps for this season.
        </p>
        {/* THEME: This button is now Gold */}
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
              {/* THEME: This button is now Gold */}
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
// This will also adopt the new theme.
// This is a fallback for when __initial_auth_token is NOT present.
const AuthScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { auth } = useFirebase();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!auth) return;
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
        // The onAuthStateChanged listener will handle creating the profile doc
      }
    } catch (err) {
      setError(err.message.replace('Firebase: ', ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background font-inter">
      <Card className="w-full max-w-sm p-8 shadow-glow-sm">
        <div className="flex justify-center mb-6">
          {/* LOGO: Replaced Shield icon with logo512.png */}
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
            onChange={(e) => setEmail(e.taget.value)}
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

          {/* THEME: Button is Gold */}
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
          {/* THEME: Link is Gold */}
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
  const [authMethod, setAuthMethod] = useState(null); // 'token', 'email', 'anon'

  // This effect handles all authentication, including the custom token.
  useEffect(() => {
    if (!auth) {
      setIsLoading(false);
      console.error("Firebase Auth is not initialized.");
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setIsLoading(true);
      if (user) {
        // User is signed in.
        setUser(user);

        // This is the CORRECT, SECURE PATH from your guidelines.
        const userDocRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data');
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          setUserProfile(userDoc.data());
        } else {
          // If no profile, create a basic one
          const newProfile = {
            username: user.email ? user.email.split('@')[0] : (user.isAnonymous ? 'New Director' : 'Director'),
            email: user.email || null,
            uid: user.uid,
            createdAt: new Date(),
            xp: 0,
            corpsCoin: 0,
            // ... any other defaults
          };
          try {
            await setDoc(userDocRef, newProfile, { merge: true });
            setUserProfile(newProfile);
          } catch (e) {
            console.error("Error creating user profile:", e);
          }
        }
        if (user.isAnonymous) {
          setAuthMethod('anon');
        } else if (!user.email) {
          setAuthMethod('token');
        } else {
          setAuthMethod('email');
        }

      } else {
        // No user is signed in.
        setUser(null);
        setUserProfile(null);

        // Check for the custom token provided by the environment.
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          try {
            await signInWithCustomToken(auth, __initial_auth_token);
            // The onAuthStateChanged listener will fire again with the new user.
            return; // Exit early, let the listener handle the new user state
          } catch (e) {
            console.error("Custom token sign-in failed:", e);
            // If token fails, fall back to anonymous
            try { await signInAnonymously(auth); } catch (anonError) { console.error("Anonymous sign-in failed:", anonError); }
          }
        } else {
          // No custom token. If we have a config, we're likely in a dev
          // environment, so show the AuthScreen.
          if (firebaseConfig.apiKey) {
             setAuthMethod('email'); // This will trigger the AuthScreen
          } else {
            // Final fallback
             try { await signInAnonymously(auth); } catch (anonError) { console.error("Anonymous sign-in failed:", anonError); }
          }
        }
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const authContextValue = {
    auth,
    db,
    user,
    userProfile,
    appId, // Pass appId to context so all components can build correct paths
  };

  // Show a global spinner while auth is resolving
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        {/* THEME: Loader is Gold */}
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
          This logic now shows the MainLayout if you are logged in (via token, email, or anon).
          It ONLY shows the AuthScreen if you are NOT logged in AND the auth method
          is explicitly set to 'email' (meaning no token was found).
        */}
        {!user && authMethod === 'email' ? <AuthScreen /> : <MainLayout />}
      </AnimatePresence>
    </FirebaseContext.Provider>
  );
}

