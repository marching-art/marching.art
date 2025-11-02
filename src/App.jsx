/*
  marching.art - React Frontend Framework (v2.1)
  - FIX: Corrects react-firebase-hooks import paths.
    - `useAuthState` is from 'react-firebase-hooks/auth'
    - `useDocumentData` is from 'react-firebase-hooks/firestore'
*/
import React, { useState, useEffect, createContext, useContext } from 'react';
import ReactDOM from 'react-dom/client';
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  Outlet,
  Navigate,
  useLocation
} from "react-router-dom";

// Firebase
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithCustomToken,
  signInAnonymously,
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword
} from "firebase/auth";
import { getFirestore, doc, onSnapshot, setDoc } from "firebase/firestore";
// Corrected imports:
import { useAuthState } from 'react-firebase-hooks/auth';
import { useDocumentData } from 'react-firebase-hooks/firestore';

// Icons
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
  Shield,
  LogIn,
  Library,
  Settings
} from 'lucide-react';

// Animation
import { motion, AnimatePresence } from 'framer-motion';

// --- 1. FIREBASE CONFIG ---
let firebaseConfig;
try {
  if (typeof __firebase_config !== 'undefined' && __firebase_config) {
    firebaseConfig = JSON.parse(__firebase_config);
  } else if (process.env.REACT_APP_API_KEY) {
    console.warn("Using .env.local Firebase config for development.");
    firebaseConfig = {
      apiKey: process.env.REACT_APP_API_KEY,
      authDomain: process.env.REACT_APP_AUTH_DOMAIN,
      projectId: process.env.REACT_APP_PROJECT_ID,
      storageBucket: process.env.REACT_APP_STORAGE_BUCKET,
      messagingSenderId: process.env.REACT_APP_MESSAGING_SENDER_ID,
      appId: process.env.REACT_APP_APP_ID,
      measurementId: process.env.REACT_APP_MEASUREMENT_ID
    };
  } else {
    console.error("Firebase config not found. Check .env.local or __firebase_config variable.");
    firebaseConfig = {};
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

try {
  if (firebaseConfig.apiKey) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } else {
    console.error("Firebase is not initialized. Check your config.");
  }
} catch (e) {
  console.error("Error initializing Firebase:", e);
}

const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [user, loading, error] = useAuthState(auth);
  const [profile, profileLoading, profileError] = useDocumentData(
    (auth && user && db) ? doc(db, `artifacts/${appId}/users/${user.uid}/profile/data`) : null
  );

  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    if (!auth) {
      console.error("Firebase Auth is not initialized.");
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // User is signed in.
      } else {
        // User is signed out.
        try {
          if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(auth, __initial_auth_token);
          } else {
            await signInAnonymously(auth);
          }
        } catch (authError) {
          console.error("Anonymous sign-in failed:", authError);
        }
      }
      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  const authContextValue = {
    user,
    profile,
    userId: user ? user.uid : null,
    isAdmin: profile ? profile.isAdmin === true : false,
    isLoading: loading || profileLoading || !isAuthReady,
    authError: error || profileError,
  };

  return (
    <AuthContext.Provider value={authContextValue}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => useContext(AuthContext);

// --- 3. REUSABLE UI COMPONENTS ---
const Button = React.forwardRef(({
  children,
  onClick,
  variant = 'primary',
  className = '',
  icon: Icon,
  ...props
}, ref) => {
  const baseStyle = "relative flex items-center justify-center px-5 py-2.5 rounded-lg font-semibold shadow-sm transition-all duration-300 ease-smooth disabled:opacity-50";
  const variantStyles = {
    primary: "bg-primary text-on-primary hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary/50",
    secondary: "bg-surface text-text-primary hover:bg-surface/80 border border-primary/20",
    danger: "bg-red-600 text-white hover:bg-red-700",
  };
  return (
    <motion.button
      ref={ref}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`${baseStyle} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {Icon && <Icon className="w-5 h-5 mr-2" />}
      {children}
    </motion.button>
  );
});

const Card = ({ children, className = '' }) => {
  return (
    <div className={`bg-surface rounded-xl shadow-lg border border-primary/10 overflow-hidden ${className}`}>
      {children}
    </div>
  );
};

const Modal = ({ children, isOpen, onClose }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 15, stiffness: 300 }}
            className="bg-background rounded-xl shadow-2xl border border-primary/20 w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const TextInput = ({ label, value, onChange, type = 'text', placeholder = '' }) => (
  <div className="w-full">
    <label className="block text-sm font-medium text-text-secondary mb-1">
      {label}
    </label>
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full px-4 py-2 rounded-lg bg-surface border border-primary/20 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all duration-300"
    />
  </div>
);

// --- 4. LAYOUT COMPONENTS ---
const Logo = () => (
  <Link to="/" className="flex items-center space-x-3 cursor-pointer group">
    <div className="relative">
      <img
        src="/logo192.png"
        alt="marching.art logo"
        className="h-10 w-10 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12"
      />
      <div className="absolute inset-0 blur-xl bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    </div>
    <span className="text-2xl font-bold tracking-tight">
      <span className="text-text-primary transition-colors">marching</span>
      <span className="gradient-text">.art</span>
    </span>
  </Link>
);

const MyCorpsIcon = ({ isActive }) => <Shield className={`w-6 h-6 ${isActive ? 'text-primary' : 'text-text-secondary'}`} />;
const HubIcon = ({ isActive }) => <Home className={`w-6 h-6 ${isActive ? 'text-primary' : 'text-text-secondary'}`} />;
const LeaguesIcon = ({ isActive }) => <Users className={`w-6 h-6 ${isActive ? 'text-primary' : 'text-text-secondary'}`} />;
const ScoresIcon = ({ isActive }) => <BarChart className={`w-6 h-6 ${isActive ? 'text-primary' : 'text-text-secondary'}`} />;
const ScheduleIcon = ({ isActive }) => <Calendar className={`w-6 h-6 ${isActive ? 'text-primary' : 'text-text-secondary'}`} />;
const ChampionsIcon = ({ isActive }) => <Award className={`w-6 h-6 ${isActive ? 'text-primary' : 'text-text-secondary'}`} />;
const GuideIcon = ({ isActive }) => <BookOpen className={`w-6 h-6 ${isActive ? 'text-primary' : 'text-text-secondary'}`} />;
const AdminIcon = ({ isActive }) => <Library className={`w-6 h-6 ${isActive ? 'text-primary' : 'text-text-secondary'}`} />;

const NavLink = ({ to, text, IconComponent }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link
      to={to}
      className={`
        flex items-center space-x-3 px-3 py-2.5 rounded-lg
        transition-all duration-200 ease-smooth
        ${isActive
          ? 'bg-surface text-text-primary shadow-sm'
          : 'text-text-secondary hover:bg-surface/50 hover:text-text-primary'
        }
      `}
    >
      <IconComponent isActive={isActive} />
      <span className="font-semibold">{text}</span>
    </Link>
  );
};

const Sidebar = () => {
  const { isAdmin } = useAuth();
  return (
    <div className="hidden lg:flex lg:flex-col w-64 h-screen p-4 bg-background border-r border-primary/10">
      <div className="mb-8">
        <Logo />
      </div>
      <nav className="flex-1 flex flex-col space-y-2">
        <NavLink to="/" text="Hub" IconComponent={HubIcon} />
        <NavLink to="/dashboard" text="My Corps" IconComponent={MyCorpsIcon} />
        <NavLink to="/leagues" text="Leagues" IconComponent={LeaguesIcon} />
        <NavLink to="/scores" text="Scores" IconComponent={ScoresIcon} />
        <NavLink to="/schedule" text="Schedule" IconComponent={ScheduleIcon} />
        <NavLink to="/champions" text="Champions" IconComponent={ChampionsIcon} />
        <NavLink to="/guide" text="Guide" IconComponent={GuideIcon} />
        {isAdmin && (
          <NavLink to="/admin" text="Admin" IconComponent={AdminIcon} />
        )}
      </nav>
      <div className="mt-auto">
        <Button
          variant="secondary"
          icon={LogOut}
          className="w-full"
          onClick={() => signOut(auth)}
        >
          Sign Out
        </Button>
      </div>
    </div>
  );
};

const MobileNav = () => {
  const location = useLocation();
  const getIconClass = (path) =>
    location.pathname === path ? "text-primary" : "text-text-secondary group-hover:text-primary";
  
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface border-t border-primary/10 shadow-lg flex items-center justify-around z-40">
      <Link to="/" className="flex flex-col items-center group">
        <Home className={getIconClass("/")} />
        <span className="text-xs">Hub</span>
      </Link>
      <Link to="/dashboard" className="flex flex-col items-center group">
        <Shield className={getIconClass("/dashboard")} />
        <span className="text-xs">My Corps</span>
      </Link>
      <Link to="/leagues" className="flex flex-col items-center group">
        <Users className={getIconClass("/leagues")} />
        <span className="text-xs">Leagues</span>
      </Link>
      <Link to="/scores" className="flex flex-col items-center group">
        <BarChart className={getIconClass("/scores")} />
        <span className="text-xs">Scores</span>
      </Link>
      <button className="flex flex-col items-center group">
        <Menu className="text-text-secondary group-hover:text-primary" />
        <span className="text-xs">More</span>
      </button>
    </div>
  );
};

const MainLayout = () => {
  return (
    <div className="flex h-screen bg-background text-text-primary">
      <Sidebar />
      <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={useLocation().pathname}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
      <MobileNav />
    </div>
  );
};

// --- 5. PAGE COMPONENTS ---
const PageDashboard = () => (
  <div className="p-4 lg:p-8">
    <h1 className="text-3xl font-bold mb-6">My Corps Dashboard</h1>
    <Card className="max-w-md">
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-2">Welcome, Director!</h2>
        <p className="text-text-secondary mb-4">
          This is where you will manage your corps, staff, and show.
        </p>
        <Button variant="primary" icon={Plus}>
          Register a New Corps
        </Button>
      </div>
    </Card>
  </div>
);

const PageHub = () => (
  <div className="p-4 lg:p-8">
    <h1 className="text-3xl font-bold mb-6">Hub</h1>
    <Card>
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-2">Central Feed</h2>
        <p className="text-text-secondary">
          AI-generated recaps, community news, and updates will appear here.
        </p>
      </div>
    </Card>
  </div>
);

const PageLeagues = () => (
  <div className="p-4 lg:p-8">
    <h1 className="text-3xl font-bold mb-6">Leagues</h1>
    <Card>
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-2">Your Leagues</h2>
        <p className="text-text-secondary">
          League management, chat, and leaderboards will be here.
        </p>
      </div>
    </Card>
  </div>
);

const PageScores = () => (
  <div className="p-4 lg:p-8">
    <h1 className="text-3xl font-bold mb-6">Scores</h1>
    <Card>
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-2">Scores & Recaps</h2>
        <p className="text-text-secondary">
          Browse all live and off-season scores.
        </p>
      </div>
    </Card>
  </div>
);

const PageSchedule = () => (
  <div className="p-4 lg:p-8">
    <h1 className="text-3xl font-bold mb-6">Schedule</h1>
    <Card>
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-2">Season Schedule</h2>
        <p className="text-text-secondary">
          View all upcoming events for both seasons.
        </p>
      </div>
    </Card>
  </div>
);

const PageChampions = () => (
  <div className="p-4 lg:p-8">
    <h1 className="text-3xl font-bold mb-6">Hall of Champions</h1>
    <Card>
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-2">Past Winners</h2>
        <p className="text-text-secondary">
          A showcase of all previous season champions.
        </foo>
      </div>
    </Card>
  </div>
);

const PageGuide = () => (
  <div className="p-4 lg:p-8">
    <h1 className="text-3xl font-bold mb-6">Guide</h1>
    <Card>
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-2">How to Play</h2>
        <p className="text-text-secondary">
          The official rulebook and guide to marching.art.
        </p>
      </div>
    </Card>
  </div>
);

const PageAdmin = () => (
  <div className="p-4 lg:p-8">
    <h1 className="text-3xl font-bold mb-6">Admin Panel</h1>
    <Card>
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-2">Site Management</h2>
        <p className="text-text-secondary">
          Admin-only tools for managing the game.
        </p>
      </div>
    </Card>
  </div>
);

const PageLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError('Failed to sign in. Check your email and password.');
      console.error(err);
      setLoading(false);
    }
  };
  
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-sm">
        <div className="p-8">
          <div className="flex justify-center mb-6">
            <Logo />
          </div>
          <h2 className="text-xl font-semibold text-center mb-4">Admin & Dev Login</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <TextInput
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@marching.art"
            />
            <TextInput
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <Button
              type="submit"
              variant="primary"
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                'Sign In'
              )}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
};


// --- 6. ROUTING ---
const ProtectedRoutes = () => {
  const { isLoading, user } = useAuth();
  
  if (isLoading) {
    return <GlobalLoader />;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <MainLayout />;
};

const AppRoutes = () => {
  const { isAdmin } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<PageLogin />} />
      <Route element={<ProtectedRoutes />}>
        <Route path="/" element={<PageHub />} />
        <Route path="/dashboard" element={<PageDashboard />} />
        <Route path="/leagues" element={<PageLeagues />} />
        <Route path="/scores" element={<PageScores />} />
        <Route path="/schedule" element={<PageSchedule />} />
        <Route path="/champions"S" element={<PageChampions />} />
        <Route path="/guide" element={<PageGuide />} />
        {isAdmin && <Route path="/admin" element={<PageAdmin />} />}
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};


// --- 7. GLOBAL LOADER ---
const GlobalLoader = () => (
  <div className="flex items-center justify-center h-screen bg-background">
    <div className="flex flex-col items-center space-y-4">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ ease: "linear", duration: 1, repeat: Infinity }}
      >
        <Loader2 className="w-12 h-12 text-primary" />
      </motion.div>
      <p className="text-text-secondary">Loading Director Profile...</p>
    </div>
  </div>
);

// --- 8. MAIN APP COMPONENT ---
export default function App() {
  if (!auth) {
    return (
      <div className="flex items-center justify-center h-screen bg-background p-4">
        <Card className="max-w-md">
          <div className="p-8 text-center">
            <h1 className="text-2xl font-bold text-red-500 mb-4">Firebase Configuration Error</h1>
            <p className="text-text-secondary">
              Could not initialize Firebase. Check your `.env.local` or `__firebase_config` variable.
            </F>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutesWrapper />
      </BrowserRouter>
    </AuthProvider>
  );
}

const AppRoutesWrapper = () => {
  const { isLoading } = useAuth();
  
  if (isLoading) {
    return <GlobalLoader />;
  }

  return <AppRoutes />;
}

