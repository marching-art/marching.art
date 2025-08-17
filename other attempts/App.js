import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    signOut, 
    onAuthStateChanged,
    signInAnonymously,
    signInWithCustomToken
} from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, onSnapshot, query, where, updateDoc, writeBatch, getDocs, deleteDoc, orderBy, limit, increment, arrayUnion } from 'firebase/firestore';

// --- Configuration & Constants ---
const ADMIN_EMAIL = "admin@marching.art";
const CAPTIONS = {
    "General Effect 1": { weight: 20, group: 'ge' },
    "General Effect 2": { weight: 20, group: 'ge' },
    "Visual Proficiency": { weight: 20, group: 'visual' },
    "Visual Analysis": { weight: 20, group: 'visual' },
    "Color Guard": { weight: 20, group: 'visual' },
    "Music Brass": { weight: 20, group: 'music' },
    "Music Analysis": { weight: 20, group: 'music' },
    "Music Percussion": { weight: 20, group: 'music' },
};
const CAPTION_NAMES = Object.keys(CAPTIONS);
const YEARS = Array.from({length: 13}, (_, i) => 2025 - i);
const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DISCORD_INVITE_LINK = "https://discord.gg/YvFRJ97A5H";

const firebaseConfig = {
  apiKey: "AIzaSyA4Qhjpp2MVwo0h0t2dNtznSIDMjlKQ5JE",
  authDomain: "marching-art.firebaseapp.com",
  projectId: "marching-art",
  storageBucket: "marching-art.firebasestorage.app",
  messagingSenderId: "278086562126",
  appId: "1:278086562126:web:f7737ee897774c3d9a6e1f",
  measurementId: "G-H0KE8GJS7M"
};

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- Icon Components ---
const LogoIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 100 100" className="h-8 w-8 text-white"><path d="M20 80 L35 20 L50 50 L65 20 L80 80" stroke="#4ade80" strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" /><circle cx="50" cy="50" r="6" fill="white" /></svg>);
const ShieldIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-5 w-5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>);
const LogOutIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-5 w-5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>);
const ArrowLeftIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-5 w-5"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>);
const TrophyIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-5 w-5"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>);
const PlusCircleIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 mr-2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>);
const ChatIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-5 w-5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>);
const HelpIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-5 w-5"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>);
const CalendarIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-5 w-5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>);
const EditIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 ml-2 cursor-pointer hover:text-yellow-300"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>);
const ArchiveIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-5 w-5"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg>);


// --- Main Application Component ---
export default function App() {
    const [auth, setAuth] = useState(null);
    const [db, setDb] = useState(null);
    const [user, setUser] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [view, setView] = useState('dashboard');
    const [selectedSeasonId, setSelectedSeasonId] = useState(null);

    useEffect(() => {
        const firebaseConfig = getFirebaseConfig();
        if (Object.keys(firebaseConfig).length > 0) {
            const app = initializeApp(firebaseConfig);
            const authInstance = getAuth(app);
            const dbInstance = getFirestore(app);
            setAuth(authInstance);
            setDb(dbInstance);

            const unsubscribe = onAuthStateChanged(authInstance, async (currentUser) => {
                if (currentUser) {
                    setUser(currentUser);
                    setIsAdmin(!currentUser.isAnonymous);
                    if (!currentUser.isAnonymous) {
                        const userDocRef = doc(dbInstance, `artifacts/${appId}/users/${currentUser.uid}/profile/main`);
                        const userDocSnap = await getDoc(userDocRef);
                        if (!userDocSnap.exists()) {
                            await setDoc(userDocRef, { email: currentUser.email, fantasyCorpsName: "My First Corps", createdAt: new Date() });
                        }
                    }
                } else { setUser(null); setIsAdmin(false); }
                setIsLoading(false);
            });
            
            const initialSignIn = async () => {
                try {
                    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                        await signInWithCustomToken(authInstance, __initial_auth_token);
                    } else { await signInAnonymously(authInstance); }
                } catch (err) { setError("Could not authenticate your session."); setIsLoading(false); }
            };
            
            initialSignIn();
            return () => unsubscribe();
        } else { setError("Firebase configuration is missing."); setIsLoading(false); }
    }, []);
    
    const handleViewChange = (newView, seasonId = null) => {
        setSelectedSeasonId(seasonId);
        setView(newView);
    };

    if (isLoading) return <LoadingScreen />;
    if (error) return <ErrorScreen message={error} />;
    
    if (!user || user.isAnonymous) {
        if (view === 'howToPlay') {
            return <HowToPlayScreen setView={setView} />;
        }
        return <AnonymousUserScreen setView={setView} />;
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-8 flex flex-col items-center">
            <div className="w-full max-w-5xl">
                <Header handleLogout={() => signOut(auth)} isAdmin={isAdmin} setView={setView} currentView={view} />
                <main className="bg-gray-800 p-6 rounded-xl shadow-2xl mt-4">
                    {view === 'dashboard' && <Dashboard user={user} db={db} onViewChange={handleViewChange} />}
                    {view === 'admin' && isAdmin && <AdminPanel db={db} />}
                    {view === 'drafting' && <DraftingScreen user={user} db={db} seasonId={selectedSeasonId} setView={setView} />}
                    {view === 'standings' && <StandingsScreen user={user} db={db} seasonId={selectedSeasonId} setView={setView} />}
                    {view === 'howToPlay' && <HowToPlayScreen setView={setView} />}
                    {view === 'schedule' && <ScheduleScreen user={user} db={db} seasonId={selectedSeasonId} setView={setView} />}
                    {view === 'archives' && <ArchivesScreen db={db} />}
                </main>
            </div>
        </div>
    );
}

// --- Child Components ---
const AnonymousUserScreen = ({ setView }) => (
    <div className="min-h-screen bg-gray-800 flex flex-col justify-center items-center p-4 text-white text-center">
        <div className="max-w-md w-full bg-gray-900 rounded-2xl shadow-2xl p-8">
            <LogoIcon />
            <h1 className="text-3xl font-bold text-white mt-4">marching.art</h1>
            <p className="text-green-300 mt-1 text-lg">The Fantasy League for Drum Corps</p>
            <p className="text-gray-400 mt-4">Draft your ultimate fantasy corps from legends of the past and champions of today. Compete in year-round seasons, manage your roster, and prove you have what it takes to build a champion.</p>
            <div className="mt-6 bg-gray-800 p-4 rounded-lg">
                <p className="font-semibold text-lg">Sign in to the platform to get started!</p>
                <button onClick={() => setView('howToPlay')} className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition">Learn How to Play</button>
            </div>
        </div>
    </div>
);
const LoadingScreen = () => (<div className="flex items-center justify-center min-h-screen bg-gray-900 text-white"><div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-green-400"></div><p className="ml-4 text-lg">Loading The Field...</p></div>);
const ErrorScreen = ({ message }) => (<div className="flex items-center justify-center min-h-screen bg-gray-900 text-white"><div className="bg-red-900 border border-red-600 p-8 rounded-lg text-center"><h2 className="text-2xl font-bold mb-2">An Error Occurred</h2><p>{message}</p></div></div>);

const Header = ({ handleLogout, isAdmin, setView, currentView }) => (
    <header className="flex justify-between items-center pb-4 border-b border-gray-700">
        <div className="flex items-center"><LogoIcon /><h1 className="text-2xl sm:text-3xl font-bold ml-3 text-green-300">marching.art</h1></div>
        <nav className="flex items-center space-x-2 sm:space-x-4">
            <button onClick={() => setView('dashboard')} className={`px-3 py-2 rounded-md text-sm font-medium ${currentView === 'dashboard' ? 'bg-green-700 text-white' : 'text-gray-300 hover:bg-gray-700'}`}>Dashboard</button>
            {isAdmin && <button onClick={() => setView('admin')} className={`flex items-center px-3 py-2 rounded-md text-sm font-medium ${currentView === 'admin' ? 'bg-green-700 text-white' : 'text-gray-300 hover:bg-gray-700'}`}><ShieldIcon /> Admin</button>}
            <button onClick={() => setView('archives')} className={`flex items-center px-3 py-2 rounded-md text-sm font-medium ${currentView === 'archives' ? 'bg-green-700 text-white' : 'text-gray-300 hover:bg-gray-700'}`}><ArchiveIcon /> Archives</button>
            <button onClick={() => setView('howToPlay')} className={`flex items-center px-3 py-2 rounded-md text-sm font-medium ${currentView === 'howToPlay' ? 'bg-green-700 text-white' : 'text-gray-300 hover:bg-gray-700'}`}><HelpIcon /> How to Play</button>
            <a href={DISCORD_INVITE_LINK} target="_blank" rel="noopener noreferrer" className="flex items-center px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700"><ChatIcon /> Community</a>
            <button onClick={handleLogout} className="flex items-center bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition"><LogOutIcon /><span>Logout</span></button>
        </nav>
    </header>
);

const HowToPlayScreen = ({ setView }) => (
    <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-8 flex flex-col items-center">
        <div className="w-full max-w-4xl">
            <header className="flex justify-between items-center mb-8 pb-4 border-b border-gray-700">
                <div className="flex items-center"><LogoIcon /><h1 className="text-2xl sm:text-3xl font-bold ml-3 text-green-300">How to Play</h1></div>
                <button onClick={() => setView('dashboard')} className="flex items-center bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition"><ArrowLeftIcon /> Back</button>
            </header>
            <main className="bg-gray-800 p-6 rounded-xl shadow-2xl prose prose-invert prose-lg max-w-none">
                <h2>Welcome to marching.art!</h2>
                <p>This is your guide to building a champion fantasy drum corps and competing for glory. Here’s how it works:</p>

                <h3>1. The Seasons</h3>
                <p>The game runs year-round with two types of seasons:</p>
                <ul>
                    <li><strong>Live Seasons:</strong> These run concurrently with the real Drum Corps International summer tour. You'll draft currently competing corps, and your fantasy scores will be based on their real-time results from each show.</li>
                    <li><strong>Off-Seasons:</strong> During the rest of the year, we run shorter seasons based on historical DCI data. You'll draft a fantasy corps from a specific historical year (e.g., 2013), and the scores are simulated based on those corps' final placements from that year.</li>
                </ul>

                <h3>2. Drafting Your Corps</h3>
                <p>This is where the strategy begins. For each season, you'll draft a fantasy corps by selecting one real-world corps for each of the 8 scoring captions:</p>
                <ul>
                    {CAPTION_NAMES.map(caption => <li key={caption}>{caption}</li>)}
                </ul>
                <p>Each real-world corps has a point value based on their performance in a previous or historical season. You have a maximum number of points you can spend on your entire roster, so you'll need to balance high-cost champions with high-value underdogs.</p>

                <h3>3. Roster Changes & Strategy</h3>
                <p>Your roster isn't locked in forever! Each season has specific "caption change windows" where you can make a limited number of changes to your lineup. These windows are your chance to adapt your strategy, drop an underperforming pick, or react to surprises in the season.</p>

                <h3>4. Scoring</h3>
                <p>On each show day, a competition is simulated. Your total fantasy score is calculated based on the performance of the corps you've selected for each caption. The scoring is weighted just like in DCI: General Effect is worth 40 points, while Visual and Music are each worth 30 points.</p>
                
                <h3>5. Championships</h3>
                <p>Every season culminates in a multi-day championships week!</p>
                <ul>
                    <li><strong>Prelims:</strong> All participants compete.</li>
                    <li><strong>Semifinals:</strong> Only the top 25 from Prelims advance.</li>
                    <li><strong>Finals:</strong> The top 12 from Semifinals compete to crown the champion!</li>
                </ul>

                <h3>6. The Soundsport Class</h3>
                <p>Joined a season late? No problem! If you join after the initial registration period, you'll be entered as a **Soundsport** ensemble. You can still draft your corps and participate in every show, but your scores will be given as a I, II, or III rating based on where you would have placed among the competitive corps. It's a great way to play along and hone your skills for the next season!</p>
            </main>
        </div>
    </div>
);

const Dashboard = ({ user, db, onViewChange }) => {
    const [seasons, setSeasons] = useState([]);
    const [joinedSeasons, setJoinedSeasons] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [fantasyCorpsName, setFantasyCorpsName] = useState('');
    const [isEditingName, setIsEditingName] = useState(false);
    const [newFantasyCorpsName, setNewFantasyCorpsName] = useState('');
    const [joinError, setJoinError] = useState('');

    useEffect(() => {
        if (!db || !user) return;
        const profileRef = doc(db, `artifacts/${appId}/users/${user.uid}/profile/main`);
        const unsubProfile = onSnapshot(profileRef, (doc) => { 
            if (doc.exists()) {
                const name = doc.data().fantasyCorpsName;
                setFantasyCorpsName(name);
                setNewFantasyCorpsName(name);
            } 
        });
        
        const seasonsQuery = query(collection(db, `artifacts/${appId}/public/data/seasons`));
        const unsubSeasons = onSnapshot(seasonsQuery, (snapshot) => {
            const seasonsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            seasonsData.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
            setSeasons(seasonsData);
            setIsLoading(false);
        });

        const entriesQuery = query(collection(db, `artifacts/${appId}/users/${user.uid}/entries`));
        const unsubEntries = onSnapshot(entriesQuery, (snapshot) => {
            const seasonIds = snapshot.docs.map(doc => doc.id);
            setJoinedSeasons(seasonIds);
        });
        return () => { unsubProfile(); unsubSeasons(); unsubEntries(); };
    }, [db, user]);

    const handleSaveName = async () => {
        if (!newFantasyCorpsName.trim()) return;
        setJoinError('');
        const batch = writeBatch(db);
        const profileRef = doc(db, `artifacts/${appId}/users/${user.uid}/profile/main`);
        batch.update(profileRef, { fantasyCorpsName: newFantasyCorpsName });

        for (const seasonId of joinedSeasons) {
            const participantRef = doc(db, `artifacts/${appId}/public/data/seasons/${seasonId}/participants`, user.uid);
            batch.update(participantRef, { fantasyCorpsName: newFantasyCorpsName });
        }
        await batch.commit();
        setIsEditingName(false);
    };

    const handleJoinSeason = async (seasonId) => {
        if (!db || !user) return;
        setJoinError('');
        
        const participantsQuery = query(collection(db, `artifacts/${appId}/public/data/seasons/${seasonId}/participants`), where("fantasyCorpsName", "==", fantasyCorpsName));
        const querySnapshot = await getDocs(participantsQuery);

        if(!querySnapshot.empty) {
            setJoinError('This corps name is already taken in this season. Please choose a unique name before joining.');
            return;
        }

        const seasonRef = doc(db, `artifacts/${appId}/public/data/seasons`, seasonId);
        const seasonSnap = await getDoc(seasonRef);
        if (!seasonSnap.exists()) return;
        const season = seasonSnap.data();

        const now = new Date();
        const seasonStartDate = new Date(season.startDate);
        const oneDay = 24 * 60 * 60 * 1000;
        const joinStatus = (now < new Date(seasonStartDate.getTime() + oneDay) && season.status === 'pending') ? 'competitive' : 'soundsport';

        const batch = writeBatch(db);
        
        const privateEntryRef = doc(db, `artifacts/${appId}/users/${user.uid}/entries`, seasonId);
        batch.set(privateEntryRef, { joinedAt: new Date(), status: joinStatus, draft: {}, userId: user.uid, fantasyCorpsName: fantasyCorpsName, changes: {}, schedule: [] });

        const publicParticipantRef = doc(db, `artifacts/${appId}/public/data/seasons/${seasonId}/participants`, user.uid);
        batch.set(publicParticipantRef, { userId: user.uid, fantasyCorpsName: fantasyCorpsName, status: joinStatus });

        await batch.commit();
    };

    const availableSeasons = seasons.filter(s => s.status === 'pending' && !joinedSeasons.includes(s.id));
    const mySeasons = seasons.filter(s => joinedSeasons.includes(s.id));

    return (
        <>
            <div className="bg-gray-700 p-4 rounded-lg mb-8">
                <p className="text-lg">Your Fantasy Corps:</p>
                {isEditingName ? (
                    <div className="flex items-center gap-2 mt-2">
                        <input type="text" value={newFantasyCorpsName} onChange={(e) => setNewFantasyCorpsName(e.target.value)} className="w-full bg-gray-800 border-2 border-gray-600 text-white rounded-lg py-2 px-3 focus:outline-none focus:border-green-500" />
                        <button onClick={handleSaveName} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg">Save</button>
                    </div>
                ) : (
                    <div className="flex items-center">
                        <p className="text-3xl font-bold text-yellow-300">{fantasyCorpsName || "..."}</p>
                        <span onClick={() => setIsEditingName(true)}><EditIcon /></span>
                    </div>
                )}
            </div>
            {mySeasons.length > 0 && (<div className="mb-8"><h3 className="text-xl font-semibold text-green-300 mb-3">My Active Seasons</h3><div className="space-y-3">{mySeasons.map(season => (<div key={season.id} className="bg-gray-700 p-4 rounded-lg flex items-center justify-between"><div><p className="font-bold text-lg">{season.name}</p><p className="text-sm text-gray-400">{season.startDate} to {season.endDate}</p></div><div className="flex gap-2"><button onClick={() => onViewChange('schedule', season.id)} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition flex items-center"><CalendarIcon /> My Schedule</button><button onClick={() => onViewChange('drafting', season.id)} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition">Manage Corps</button><button onClick={() => onViewChange('standings', season.id)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition flex items-center"><TrophyIcon />Standings</button></div></div>))}</div></div>)}
            <div>
                <h3 className="text-xl font-semibold text-green-300 mb-3">Available Seasons</h3>
                {joinError && <div className="bg-red-900 border border-red-600 p-3 rounded-lg text-center mb-4"><p>{joinError}</p></div>}
                {isLoading ? <p>Loading...</p> : (availableSeasons.length > 0 ? (<div className="space-y-3">{availableSeasons.map(season => (<div key={season.id} className="bg-gray-700 p-4 rounded-lg flex items-center justify-between"><div><p className="font-bold text-lg">{season.name}</p><p className="text-sm text-gray-400">{season.startDate} to {season.endDate}</p></div><button onClick={() => handleJoinSeason(season.id)} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition">Join Season</button></div>))}</div>) : <p className="text-gray-400">No new seasons available.</p>)}
            </div>
        </>
    );
};

const DraftingScreen = ({ user, db, seasonId, setView }) => {
    const [season, setSeason] = useState(null);
    const [draftableCorps, setDraftableCorps] = useState([]);
    const [draft, setDraft] = useState({});
    const [entry, setEntry] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [totalPoints, setTotalPoints] = useState(0);

    useEffect(() => {
        if (!db || !user || !seasonId) return;
        const seasonRef = doc(db, `artifacts/${appId}/public/data/seasons`, seasonId);
        const unsubSeason = onSnapshot(seasonRef, (doc) => {
            const seasonData = doc.data();
            setSeason(seasonData);
            if (seasonData) {
                let corpsQuery;
                if (seasonData.type === 'Live') { corpsQuery = query(collection(db, `artifacts/${appId}/public/data/liveCorps`)); } 
                else { corpsQuery = query(collection(db, `artifacts/${appId}/public/data/historicalCorps`), where("year", "==", seasonData.historicalYear)); }
                const unsubCorps = onSnapshot(corpsQuery, snapshot => {
                    const corpsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                    corpsData.sort((a,b) => a.name.localeCompare(b.name));
                    setDraftableCorps(corpsData);
                });
                return () => unsubCorps();
            }
        });
        const entryRef = doc(db, `artifacts/${appId}/users/${user.uid}/entries`, seasonId);
        const unsubEntry = onSnapshot(entryRef, doc => { 
            if (doc.exists()) {
                const entryData = doc.data();
                setEntry(entryData);
                setDraft(entryData.draft || {}); 
            }
            setIsLoading(false); 
        });
        return () => { unsubSeason(); unsubEntry(); };
    }, [db, user, seasonId]);

    useEffect(() => {
        const points = Object.values(draft).reduce((acc, corpsId) => {
            const corps = draftableCorps.find(c => c.id === corpsId);
            return acc + (corps ? corps.points : 0);
        }, 0);
        setTotalPoints(points);
    }, [draft, draftableCorps]);

    const getLockStatus = () => {
        if (!season || !entry) return { locked: true, message: "Loading..." };
        const now = new Date();
        
        const changeWindows = season.rules?.changeWindows || [];
        const activeWindow = changeWindows.find(w => {
            const start = new Date(w.startDate + 'T' + w.startTime);
            const end = new Date(w.endDate + 'T' + w.endTime);
            return now >= start && now <= end;
        });

        if (activeWindow) {
            const changesMade = entry.changes?.[activeWindow.name] || 0;
            if (activeWindow.changes === -1) {
                return { locked: false, message: `${activeWindow.name}: Unlimited changes remaining.`, window: activeWindow.name };
            }
            const remaining = activeWindow.changes - changesMade;
            return { locked: remaining <= 0, message: `${activeWindow.name}: ${remaining} of ${activeWindow.changes} changes remaining.`, window: activeWindow.name };
        }
        
        return { locked: true, message: "Roster is locked." };
    };

    const handleDraftChange = async (caption, corpsId) => {
        const lockStatus = getLockStatus();
        if (lockStatus.locked) return;

        const newDraft = { ...draft, [caption]: corpsId };
        setDraft(newDraft);
        const entryRef = doc(db, `artifacts/${appId}/users/${user.uid}/entries`, seasonId);
        
        const updates = { draft: newDraft };
        if (lockStatus.window) {
            const activeWindow = season.rules.changeWindows.find(w => w.name === lockStatus.window);
            if (activeWindow && activeWindow.changes !== -1) {
                updates[`changes.${lockStatus.window}`] = increment(1);
            }
        }
        
        await updateDoc(entryRef, updates);
    };

    if (isLoading) return <LoadingScreen />;
    const lockStatus = getLockStatus();
    const maxPoints = season?.rules?.maxPoints || 150;

    return (
        <div>
            <button onClick={() => setView('dashboard')} className="flex items-center text-green-400 hover:text-green-300 mb-4"><ArrowLeftIcon /> Back to Dashboard</button>
            <h2 className="text-2xl font-bold text-yellow-300 mb-1">Drafting for: {season?.name}</h2>
            {entry?.status === 'soundsport' && <div className="p-3 rounded-lg text-center mb-4 bg-purple-900 text-purple-200"><p className="font-semibold">You have joined this season as a Soundsport ensemble. Your scores will be given as a rating.</p></div>}
            <div className={`p-3 rounded-lg text-center mb-4 ${lockStatus.locked ? 'bg-red-900' : 'bg-green-900'}`}>
                <p className="font-semibold">{lockStatus.message}</p>
            </div>
            <div className="bg-gray-700 p-4 rounded-lg mb-6 flex justify-between items-center"><h3 className="text-lg font-semibold">Your Roster</h3><div className="text-right"><p className="text-gray-400">Total Points Used</p><p className="text-2xl font-bold text-yellow-300">{totalPoints} / {maxPoints}</p></div></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {CAPTION_NAMES.map(caption => (
                    <div key={caption} className="bg-gray-700 p-4 rounded-lg">
                        <label className="block text-gray-300 font-semibold mb-2">{caption}</label>
                        <select disabled={lockStatus.locked} value={draft[caption] || ''} onChange={(e) => handleDraftChange(caption, e.target.value)} className="w-full bg-gray-800 border-2 border-gray-600 text-white rounded-lg py-2 px-3 focus:outline-none focus:border-green-500 disabled:opacity-50 disabled:cursor-not-allowed">
                            <option value="">-- Select a Corps --</option>
                            {draftableCorps.map(corps => (<option key={corps.id} value={corps.id}>{corps.name} ({corps.points} pts)</option>))}
                        </select>
                    </div>
                ))}
            </div>
        </div>
    );
};

const StandingsScreen = ({ user, db, seasonId, setView }) => {
    const [results, setResults] = useState([]);
    const [season, setSeason] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [standingsView, setStandingsView] = useState('regular');

    useEffect(() => {
        if (!db || !seasonId) return;
        const seasonRef = doc(db, `artifacts/${appId}/public/data/seasons`, seasonId);
        const unsubSeason = onSnapshot(seasonRef, (doc) => setSeason(doc.data()));

        const resultsQuery = query(collection(db, `artifacts/${appId}/public/data/seasons/${seasonId}/results`));
        const unsubResults = onSnapshot(resultsQuery, (snapshot) => {
            const resultsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setResults(resultsData);
            setIsLoading(false);
        });

        return () => { unsubSeason(); unsubResults(); };
    }, [db, seasonId]);
    
    const calculateStandings = (resultsToShow) => {
        const standings = resultsToShow.reduce((acc, showResult) => {
            Object.entries(showResult.scores).forEach(([userId, scoreData]) => {
                if(scoreData.status === 'competitive') {
                    if (!acc[userId]) { acc[userId] = { totalScore: 0, fantasyCorpsName: scoreData.fantasyCorpsName }; }
                    acc[userId].totalScore += scoreData.total;
                }
            });
            return acc;
        }, {});
        return Object.entries(standings).sort(([,a], [,b]) => b.totalScore - a.totalScore);
    };
    
    const getSoundsportRatings = (resultsToShow) => {
        const ratings = {};
        resultsToShow.forEach(show => {
            Object.entries(show.scores).forEach(([userId, scoreData]) => {
                if(scoreData.status === 'soundsport') {
                    if(!ratings[userId]) ratings[userId] = { fantasyCorpsName: scoreData.fantasyCorpsName, ratings: {} };
                    ratings[userId].ratings[show.id] = scoreData.rating;
                }
            });
        });
        return Object.values(ratings);
    };

    const regularSeasonResults = results.filter(r => r.id.startsWith('show-'));
    const prelimsResults = results.filter(r => r.id === 'prelims');
    const semifinalsResults = results.filter(r => r.id === 'semifinals');
    const finalsResults = results.filter(r => r.id === 'finals');

    let displayedStandings = [];
    let soundsportRatings = [];
    if (standingsView === 'regular') {
        displayedStandings = calculateStandings(regularSeasonResults);
        soundsportRatings = getSoundsportRatings(regularSeasonResults);
    }
    if (standingsView === 'prelims') displayedStandings = calculateStandings(prelimsResults);
    if (standingsView === 'semifinals') displayedStandings = calculateStandings(semifinalsResults);
    if (standingsView === 'finals') displayedStandings = calculateStandings(finalsResults);

    if (isLoading) return <LoadingScreen />;

    return (
        <div>
            <button onClick={() => setView('dashboard')} className="flex items-center text-green-400 hover:text-green-300 mb-4"><ArrowLeftIcon /> Back to Dashboard</button>
            <h2 className="text-2xl font-bold text-yellow-300 mb-4">Standings for: {season?.name}</h2>
            <div className="flex border-b border-gray-600 mb-4">
                <button onClick={() => setStandingsView('regular')} className={`px-4 py-2 font-medium ${standingsView === 'regular' ? 'border-b-2 border-green-400 text-green-300' : 'text-gray-400'}`}>Regular Season</button>
                {prelimsResults.length > 0 && <button onClick={() => setStandingsView('prelims')} className={`px-4 py-2 font-medium ${standingsView === 'prelims' ? 'border-b-2 border-green-400 text-green-300' : 'text-gray-400'}`}>Prelims</button>}
                {semifinalsResults.length > 0 && <button onClick={() => setStandingsView('semifinals')} className={`px-4 py-2 font-medium ${standingsView === 'semifinals' ? 'border-b-2 border-green-400 text-green-300' : 'text-gray-400'}`}>Semifinals</button>}
                {finalsResults.length > 0 && <button onClick={() => setStandingsView('finals')} className={`px-4 py-2 font-medium ${standingsView === 'finals' ? 'border-b-2 border-green-400 text-green-300' : 'text-gray-400'}`}>Finals</button>}
            </div>
            <div className="bg-gray-700 p-4 rounded-lg">
                <h3 className="text-xl mb-3">Competitive Leaderboard</h3>
                {displayedStandings.length > 0 ? (
                    <ol className="space-y-2">
                        {displayedStandings.map(([userId, data], index) => (
                            <li key={userId} className="flex items-center justify-between bg-gray-800 p-3 rounded-md">
                                <div className="flex items-center"><span className="text-lg font-bold text-yellow-300 w-8">{index + 1}.</span><span>{data.fantasyCorpsName}</span></div>
                                <span className="font-bold text-lg">{data.totalScore.toFixed(3)}</span>
                            </li>
                        ))}
                    </ol>
                ) : <p>No results for this stage yet.</p>}
            </div>

            {soundsportRatings.length > 0 && standingsView === 'regular' && (
                 <div className="bg-gray-700 p-4 rounded-lg mt-6">
                    <h3 className="text-xl mb-3">Soundsport Ratings</h3>
                    <div className="space-y-2">
                        {soundsportRatings.map((data, index) => (
                             <div key={index} className="bg-gray-800 p-3 rounded-md">
                                <p className="font-bold text-lg">{data.fantasyCorpsName}</p>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {Object.entries(data.ratings).map(([showId, rating]) => (
                                        <div key={showId} className="bg-gray-900 rounded-full px-3 py-1 text-sm">
                                            <span className="text-gray-400 mr-2">{showId.substring(5)}:</span>
                                            <span className="font-bold text-yellow-300">Rating {rating}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Admin Panel Components ---
const AdminPanel = ({ db }) => {
    const [adminView, setAdminView] = useState('seasons');
    return (
        <div>
            <h2 className="text-2xl font-semibold mb-4 text-yellow-300">Admin Panel</h2>
            <div className="flex border-b border-gray-600 mb-4 overflow-x-auto">
                <button onClick={() => setAdminView('seasons')} className={`px-4 py-2 text-lg font-medium shrink-0 ${adminView === 'seasons' ? 'border-b-2 border-green-400 text-green-300' : 'text-gray-400'}`}>Manage Seasons</button>
                <button onClick={() => setAdminView('schedules')} className={`px-4 py-2 text-lg font-medium shrink-0 ${adminView === 'schedules' ? 'border-b-2 border-green-400 text-green-300' : 'text-gray-400'}`}>Default Schedules</button>
                <button onClick={() => setAdminView('rules')} className={`px-4 py-2 text-lg font-medium shrink-0 ${adminView === 'rules' ? 'border-b-2 border-green-400 text-green-300' : 'text-gray-400'}`}>Default Rules</button>
                <button onClick={() => setAdminView('liveCorps')} className={`px-4 py-2 text-lg font-medium shrink-0 ${adminView === 'liveCorps' ? 'border-b-2 border-green-400 text-green-300' : 'text-gray-400'}`}>Live Corps</button>
                <button onClick={() => setAdminView('historical')} className={`px-4 py-2 text-lg font-medium shrink-0 ${adminView === 'historical' ? 'border-b-2 border-green-400 text-green-300' : 'text-gray-400'}`}>Historical Data</button>
                <button onClick={() => setAdminView('automation')} className={`px-4 py-2 text-lg font-medium shrink-0 ${adminView === 'automation' ? 'border-b-2 border-green-400 text-green-300' : 'text-gray-400'}`}>Automation</button>
            </div>
            {adminView === 'seasons' && <ManageSeasons db={db} />}
            {adminView === 'historical' && <ManageHistoricalData db={db} />}
            {adminView === 'rules' && <DefaultRules db={db} />}
            {adminView === 'liveCorps' && <ManageLiveCorps db={db} />}
            {adminView === 'automation' && <AutomationPanel db={db} />}
            {adminView === 'schedules' && <DefaultSchedules db={db} />}
        </div>
    );
};

const ManageHistoricalData = ({ db }) => {
    const [year, setYear] = useState(YEARS[0]);
    const [placements, setPlacements] = useState(Array(25).fill(''));
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(true);
    const [message, setMessage] = useState('');
    const [existingDocIds, setExistingDocIds] = useState([]);

    useEffect(() => {
        if (!db || !year) return;
        const fetchData = async () => {
            setIsFetching(true);
            setMessage('');
            const historicalCorpsQuery = query(collection(db, `artifacts/${appId}/public/data/historicalCorps`), where("year", "==", parseInt(year)));
            try {
                const querySnapshot = await getDocs(historicalCorpsQuery);
                const existingCorps = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                const newPlacements = Array(25).fill('');
                const docIds = [];
                
                if (existingCorps.length > 0) {
                    existingCorps.forEach(corps => {
                        if (corps.placement >= 1 && corps.placement <= 25) {
                            const nameWithoutYear = corps.name.replace(/\s\(\d{4}\)$/, '').trim();
                            newPlacements[corps.placement - 1] = nameWithoutYear;
                            docIds.push(corps.id);
                        }
                    });
                }
                setPlacements(newPlacements);
                setExistingDocIds(docIds);

            } catch (error) {
                console.error("Error fetching historical data: ", error);
                setMessage("Failed to load data for this year.");
            } finally {
                setIsFetching(false);
            }
        };
        fetchData();
    }, [db, year]);

    const handlePlacementChange = (index, value) => {
        const newPlacements = [...placements]; newPlacements[index] = value; setPlacements(newPlacements);
    };

    const handleSubmit = async (e) => {
        e.preventDefault(); setIsLoading(true); setMessage('');
        const corpsData = placements.map((name, index) => ({ name: name.trim(), placement: index + 1, points: 25 - index, year: parseInt(year) })).filter(c => c.name !== '');
        if (corpsData.length === 0) { setMessage('Please enter at least one corps name.'); setIsLoading(false); return; }
        try {
            const batch = writeBatch(db);
            const collectionRef = collection(db, `artifacts/${appId}/public/data/historicalCorps`);
            
            if (existingDocIds.length > 0) {
                existingDocIds.forEach(id => { batch.delete(doc(collectionRef, id)); });
            }
            
            const newDocIds = [];
            corpsData.forEach(corps => {
                const docRef = doc(collectionRef);
                batch.set(docRef, { ...corps, name: `${corps.name} (${year})` });
                newDocIds.push(docRef.id);
            });
            
            await batch.commit();
            setExistingDocIds(newDocIds);
            setMessage(`${corpsData.length} corps for ${year} ${existingDocIds.length > 0 ? 'updated' : 'saved'} successfully!`);
        } catch (error) { setMessage('An error occurred while saving.'); console.error(error); } 
        finally { setIsLoading(false); }
    };

    const hasExistingData = existingDocIds.length > 0;

    return (
        <div className="bg-gray-700 p-4 rounded-lg">
            <h3 className="text-xl mb-3">Enter Finals Placements</h3>
            <form onSubmit={handleSubmit}>
                <div className="mb-4"><label htmlFor="year" className="block text-sm font-medium text-gray-300 mb-1">Select Year</label><select id="year" value={year} onChange={e => setYear(e.target.value)} className="w-full md:w-1/3 bg-gray-800 border-2 border-gray-600 text-white rounded-lg py-2 px-3 focus:outline-none focus:border-green-500">{YEARS.map(y => <option key={y} value={y}>{y}</option>)}</select></div>
                {isFetching ? (<div className="flex justify-center items-center h-48"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-400"></div><p className="ml-4">Loading data for {year}...</p></div>) : (<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{placements.map((name, index) => (<div key={index}><label className="block text-sm font-medium text-gray-300 mb-1">{index + 1}{index === 0 ? 'st' : index === 1 ? 'nd' : index === 2 ? 'rd' : 'th'} Place ({25 - index} pts)</label><input type="text" value={name} onChange={e => handlePlacementChange(index, e.target.value)} className="w-full bg-gray-800 border-2 border-gray-600 text-white rounded-lg py-2 px-3 focus:outline-none focus:border-green-500" /></div>))}</div>)}
                <button type="submit" disabled={isLoading || isFetching} className="mt-6 w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition disabled:bg-gray-500">{isLoading ? 'Saving...' : hasExistingData ? `Update ${year} Placements` : `Save ${year} Placements`}</button>
                {message && <p className="text-center mt-4 text-yellow-300">{message}</p>}
            </form>
        </div>
    );
};

const ManageSeasons = ({ db }) => {
    const [seasonsList, setSeasonsList] = useState([]);
    const [message, setMessage] = useState('');
    const [latestResults, setLatestResults] = useState(null);

    useEffect(() => {
        if (!db) return;
        const q = query(collection(db, `artifacts/${appId}/public/data/seasons`));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const seasons = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            seasons.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
            setSeasonsList(seasons);
        });
        return () => unsubscribe();
    }, [db]);
    
    const runScoringEngine = async (season, participants) => {
        const corpsQuery = query(collection(db, `artifacts/${appId}/public/data/historicalCorps`), where("year", "==", season.historicalYear));
        const corpsSnapshot = await getDocs(corpsQuery);
        const historicalCorps = corpsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        const showScores = {};
        for (const participant of participants) {
            const entryRef = doc(db, `artifacts/${appId}/users/${participant.userId}/entries/${season.id}`);
            const entrySnap = await getDoc(entryRef);
            if (!entrySnap.exists()) continue;

            const entry = entrySnap.data();
            let geScore = 0;
            let visualScore = 0;
            let musicScore = 0;
            
            const userDraft = entry.draft || {};
            for (const captionName of CAPTION_NAMES) {
                const corpsId = userDraft[captionName];
                if (corpsId) {
                    const corps = historicalCorps.find(c => c.id === corpsId);
                    if (corps) {
                        const baseScore = (26 - corps.placement) * (CAPTIONS[captionName].weight / 25);
                        const randomFactor = Math.random() * (CAPTIONS[captionName].weight * 0.1);
                        const captionScore = baseScore + randomFactor;
                        
                        if(CAPTIONS[captionName].group === 'ge') geScore += captionScore;
                        if(CAPTIONS[captionName].group === 'visual') visualScore += captionScore;
                        if(CAPTIONS[captionName].group === 'music') musicScore += captionScore;
                    }
                }
            }
            const totalScore = geScore + (visualScore / 2) + (musicScore / 2);
            showScores[entry.userId] = { total: totalScore, fantasyCorpsName: entry.fantasyCorpsName, status: participant.status };
        }
        return showScores;
    };

    const handleRunShow = async (season, stage = 'regular') => {
        setMessage(`Running ${stage} for ${season.name}...`);
        setLatestResults(null);
        
        const participantsQuery = query(collection(db, `artifacts/${appId}/public/data/seasons/${season.id}/participants`));
        const participantsSnapshot = await getDocs(participantsQuery);
        if (participantsSnapshot.empty) { setMessage("No users have joined this season."); setTimeout(() => setMessage(''), 3000); return; }
        
        let participants = participantsSnapshot.docs.map(d => d.data());
        let resultsId = `show-${new Date().toISOString()}`;
        let nextStage = 'championships_prelims';

        if (stage === 'prelims') {
            resultsId = 'prelims';
            nextStage = 'semifinals';
        } else if (stage === 'semifinals') {
            const prelimsRef = doc(db, `artifacts/${appId}/public/data/seasons/${season.id}/results/prelims`);
            const prelimsSnap = await getDoc(prelimsRef);
            if (!prelimsSnap.exists()) { setMessage("Prelims must be run before Semifinals."); return; }
            const top25 = Object.entries(prelimsSnap.data().scores).filter(([,data]) => data.status === 'competitive').sort(([,a],[,b]) => b.total - a.total).slice(0, 25).map(([userId]) => userId);
            participants = participants.filter(p => top25.includes(p.userId));
            resultsId = 'semifinals';
            nextStage = 'finals';
        } else if (stage === 'finals') {
            const semisRef = doc(db, `artifacts/${appId}/public/data/seasons/${season.id}/results/semifinals`);
            const semisSnap = await getDoc(semisRef);
            if (!semisSnap.exists()) { setMessage("Semifinals must be run before Finals."); return; }
            const top12 = Object.entries(semisSnap.data().scores).filter(([,data]) => data.status === 'competitive').sort(([,a],[,b]) => b.total - a.total).slice(0, 12).map(([userId]) => userId);
            participants = participants.filter(p => top12.includes(p.userId));
            resultsId = 'finals';
            nextStage = 'complete';
        }

        const showScores = await runScoringEngine(season, participants);
        
        const competitiveScores = Object.values(showScores).filter(s => s.status === 'competitive').map(s => s.total).sort((a,b) => a - b);
        const topThird = competitiveScores[Math.floor(competitiveScores.length * 2/3)];
        const bottomThird = competitiveScores[Math.floor(competitiveScores.length / 3)];

        for(const userId in showScores) {
            if(showScores[userId].status === 'soundsport') {
                const score = showScores[userId].total;
                if (score >= topThird) showScores[userId].rating = 'I';
                else if (score >= bottomThird) showScores[userId].rating = 'II';
                else showScores[userId].rating = 'III';
            }
        }

        const resultsRef = doc(db, `artifacts/${appId}/public/data/seasons/${season.id}/results`, resultsId);
        await setDoc(resultsRef, { scores: showScores, date: new Date() });

        if (stage !== 'regular') {
            await updateDoc(doc(db, `artifacts/${appId}/public/data/seasons`, season.id), { championshipsStage: nextStage });
        } else {
             await updateDoc(doc(db, `artifacts/${appId}/public/data/seasons`, season.id), { status: 'active' });
        }

        const sortedResults = Object.entries(showScores).filter(([,data])=> data.status === 'competitive').sort(([,a], [,b]) => b.total - a.total);
        setLatestResults({ date: resultsId, scores: sortedResults });
        setMessage(`${stage.charAt(0).toUpperCase() + stage.slice(1)} for ${resultsId.startsWith('show-') ? resultsId.substring(5) : resultsId} complete!`);
    };

    const handleStartChampionships = async (seasonId) => {
        await updateDoc(doc(db, `artifacts/${appId}/public/data/seasons`, seasonId), { championshipsStage: 'prelims' });
    };

    const getNextAction = (season) => {
        const stage = season.championshipsStage || 'regular';
        if (season.status === 'pending') return <button onClick={() => handleRunShow(season)} className="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-2 rounded-lg transition text-sm">Run First Show</button>
        if (stage === 'regular') return <button onClick={() => handleStartChampionships(season.id)} className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-1 px-2 rounded-lg transition text-sm">Start Champs</button>
        if (stage === 'prelims') return <button onClick={() => handleRunShow(season, 'prelims')} className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-1 px-2 rounded-lg transition text-sm">Run Prelims</button>
        if (stage === 'semifinals') return <button onClick={() => handleRunShow(season, 'semifinals')} className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-1 px-2 rounded-lg transition text-sm">Run Semifinals</button>
        if (stage === 'finals') return <button onClick={() => handleRunShow(season, 'finals')} className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-1 px-2 rounded-lg transition text-sm">Run Finals</button>
        if (stage === 'complete') return <span className="text-gray-400">Complete</span>
        return null;
    };

    return (
        <div>
            <AddSeasonForm db={db} />
            {message && <p className="text-center my-4 text-yellow-300">{message}</p>}
            <div>
                <h3 className="text-xl mb-3">Current Seasons List ({seasonsList.length})</h3>
                <div className="bg-gray-700 p-4 rounded-lg max-h-96 overflow-y-auto">
                    {seasonsList.length === 0 ? <p>No seasons have been added yet.</p> : (
                        <ul className="space-y-2">
                            {seasonsList.map(s => (
                                <li key={s.id} className="grid grid-cols-3 items-center bg-gray-800 p-3 rounded-md gap-4">
                                    <span className="font-semibold">{s.name}{s.type === 'Off-Season' && ` (${s.historicalYear})`}</span>
                                    <span className="text-center"><span className={`font-medium px-2 py-1 rounded-full ${s.type === 'Live' ? 'bg-red-600 text-red-100' : 'bg-indigo-600 text-indigo-100'}`}>{s.type}</span></span>
                                    <div className="text-right">{getNextAction(s)}</div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
            {latestResults && (
                <div className="mt-6">
                    <h3 className="text-xl mb-3">Latest Results ({latestResults.date.startsWith('show-') ? latestResults.date.substring(5) : latestResults.date})</h3>
                    <div className="bg-gray-700 p-4 rounded-lg">
                        <ol className="space-y-2">
                            {latestResults.scores.map(([userId, data], index) => (
                                <li key={userId} className="flex items-center justify-between bg-gray-800 p-3 rounded-md">
                                    <div className="flex items-center"><span className="text-lg font-bold text-yellow-300 w-8">{index + 1}.</span><span>{data.fantasyCorpsName}</span></div>
                                    <span className="font-bold text-lg">{data.total.toFixed(3)}</span>
                                </li>
                            ))}
                        </ol>
                    </div>
                </div>
            )}
        </div>
    );
};

const AddSeasonForm = ({ db }) => {
    const [seasonName, setSeasonName] = useState('');
    const [seasonType, setSeasonType] = useState('Off-Season');
    const [historicalYear, setHistoricalYear] = useState(YEARS[0]);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [defaultRules, setDefaultRules] = useState(null);

    useEffect(() => {
        if (!db) return;
        const rulesRef = doc(db, `artifacts/${appId}/public/data/defaultRules/main`);
        const unsub = onSnapshot(rulesRef, (doc) => {
            if (doc.exists()) {
                setDefaultRules(doc.data());
            }
        });
        return () => unsub();
    }, [db]);

    const handleAddSeason = async (e) => {
        e.preventDefault();
        if (!seasonName.trim() || !startDate || !endDate) return;

        let changeWindows = [];
        if (defaultRules) {
            const rulesForType = defaultRules[seasonType === 'Off-Season' ? 'offSeason' : 'liveSeason'];
            if (rulesForType) {
                const seasonStartDate = new Date(startDate + "T00:00:00");
                changeWindows = rulesForType.map(rule => {
                    const windowStartDate = new Date(seasonStartDate);
                    windowStartDate.setDate(seasonStartDate.getDate() + (rule.week - 1) * 7 + rule.startDayOfWeek);
                    const windowEndDate = new Date(seasonStartDate);
                    windowEndDate.setDate(seasonStartDate.getDate() + (rule.week - 1) * 7 + rule.endDayOfWeek);
                    return {
                        name: `Week ${rule.week}`,
                        startDate: `${windowStartDate.toISOString().split('T')[0]}`,
                        startTime: rule.startTime,
                        endDate: `${windowEndDate.toISOString().split('T')[0]}`,
                        endTime: rule.endTime,
                        changes: rule.changes
                    };
                });
            }
        }
        
        const newSeason = { 
            name: seasonName.trim(), 
            type: seasonType, 
            startDate, 
            endDate, 
            status: 'pending', 
            createdAt: new Date(), 
            championshipsStage: 'regular',
            rules: { changeWindows, maxPoints: defaultRules?.maxPoints || 150 } 
        };
        if (seasonType === 'Off-Season') { newSeason.historicalYear = parseInt(historicalYear); }
        await addDoc(collection(db, `artifacts/${appId}/public/data/seasons`), newSeason);
        setSeasonName(''); setStartDate(''); setEndDate('');
    };

    return (
        <div className="bg-gray-700 p-4 rounded-lg mb-6">
            <h3 className="text-xl mb-3">Add New Season</h3>
            <form onSubmit={handleAddSeason}>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div><label htmlFor="seasonName" className="block text-sm font-medium text-gray-300 mb-1">Season Name</label><input type="text" id="seasonName" value={seasonName} onChange={(e) => setSeasonName(e.target.value)} placeholder="e.g., 2024 Off-Season 1" className="w-full bg-gray-800 border-2 border-gray-600 text-white rounded-lg py-2 px-3 focus:outline-none focus:border-green-500" /></div>
                    <div><label htmlFor="seasonType" className="block text-sm font-medium text-gray-300 mb-1">Season Type</label><select id="seasonType" value={seasonType} onChange={(e) => setSeasonType(e.target.value)} className="w-full bg-gray-800 border-2 border-gray-600 text-white rounded-lg py-2 px-3 focus:outline-none focus:border-green-500"><option>Off-Season</option><option>Live</option></select></div>
                    {seasonType === 'Off-Season' && (<div><label htmlFor="historicalYear" className="block text-sm font-medium text-gray-300 mb-1">Historical Year</label><select id="historicalYear" value={historicalYear} onChange={(e) => setHistoricalYear(e.target.value)} className="w-full bg-gray-800 border-2 border-gray-600 text-white rounded-lg py-2 px-3 focus:outline-none focus:border-green-500">{YEARS.map(y => <option key={y} value={y}>{y}</option>)}</select></div>)}
                    <div><label htmlFor="startDate" className="block text-sm font-medium text-gray-300 mb-1">Start Date</label><input type="date" id="startDate" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-gray-800 border-2 border-gray-600 text-white rounded-lg py-2 px-3 focus:outline-none focus:border-green-500" /></div>
                    <div><label htmlFor="endDate" className="block text-sm font-medium text-gray-300 mb-1">End Date</label><input type="date" id="endDate" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-gray-800 border-2 border-gray-600 text-white rounded-lg py-2 px-3 focus:outline-none focus:border-green-500" /></div>
                </div>
                <div className="mt-4"><button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition">Add Season</button></div>
            </form>
        </div>
    );
};

const DefaultRules = ({ db }) => {
    const [offSeasonRules, setOffSeasonRules] = useState([]);
    const [liveSeasonRules, setLiveSeasonRules] = useState([]);
    const [maxPoints, setMaxPoints] = useState(150);
    const [isLoading, setIsLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (!db) return;
        const rulesRef = doc(db, `artifacts/${appId}/public/data/defaultRules/main`);
        const unsub = onSnapshot(rulesRef, (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                setOffSeasonRules(data.offSeason || []);
                setLiveSeasonRules(data.liveSeason || []);
                setMaxPoints(data.maxPoints || 150);
            }
            setIsLoading(false);
        });
        return () => unsub();
    }, [db]);

    const handleRuleChange = (type, index, field, value) => {
        const rules = type === 'offSeason' ? [...offSeasonRules] : [...liveSeasonRules];
        rules[index][field] = value;
        if (type === 'offSeason') setOffSeasonRules(rules);
        else setLiveSeasonRules(rules);
    };

    const handleAddRule = (type) => {
        const newRule = { week: 1, startDayOfWeek: 3, startTime: '08:00', endDayOfWeek: 4, endTime: '23:59', changes: 3 };
        if (type === 'offSeason') setOffSeasonRules([...offSeasonRules, newRule]);
        else setLiveSeasonRules([...liveSeasonRules, newRule]);
    };

    const handleSaveRules = async () => {
        setIsLoading(true);
        setMessage('');
        setError('');

        if (maxPoints < 32 || maxPoints > 192) {
            setError("Max points must be between 32 and 192.");
            setIsLoading(false);
            return;
        }

        const allRules = [...offSeasonRules, ...liveSeasonRules];
        for (const rule of allRules) {
            if (parseInt(rule.endDayOfWeek) < parseInt(rule.startDayOfWeek)) {
                setError(`Error: In Week ${rule.week}, the end day cannot be before the start day.`);
                setIsLoading(false);
                return;
            }
        }

        try {
            const rulesToSave = {
                offSeason: offSeasonRules.map(r => ({...r, name: `Week ${r.week}`})),
                liveSeason: liveSeasonRules.map(r => ({...r, name: `Week ${r.week}`})),
                maxPoints: maxPoints
            };
            const rulesRef = doc(db, `artifacts/${appId}/public/data/defaultRules/main`);
            await setDoc(rulesRef, rulesToSave);
            setMessage("Default rules saved successfully!");
        } catch (error) {
            setMessage("Error saving rules.");
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) return <LoadingScreen />;
    
    const RuleEditor = ({ type, rules, onChange, onAdd, maxWeeks }) => (
        <div className="bg-gray-700 p-4 rounded-lg mb-6">
            <h3 className="text-xl mb-3">Default {type === 'offSeason' ? 'Off-Season' : 'Live Season'} Rules</h3>
            <div className="grid grid-cols-5 gap-2 text-center text-sm font-semibold text-gray-400 mb-2 px-3">
                <label>Week</label>
                <label>Start Day</label>
                <label>Start Time</label>
                <label>End Day</label>
                <label>End Time</label>
                <label># of Changes</label>
            </div>
            {rules.map((rule, index) => (
                 <div key={index} className="grid grid-cols-6 gap-3 bg-gray-800 p-3 rounded-lg mb-2 items-center">
                    <select value={rule.week} onChange={e => onChange(type, index, 'week', parseInt(e.target.value))} className="bg-gray-900 border-2 border-gray-700 text-white rounded-lg py-2 px-3">
                        {[...Array(maxWeeks).keys()].map(i => <option key={i+1} value={i+1}>Week {i+1}</option>)}
                    </select>
                    <select value={rule.startDayOfWeek} onChange={e => onChange(type, index, 'startDayOfWeek', parseInt(e.target.value))} className="bg-gray-900 border-2 border-gray-700 text-white rounded-lg py-2 px-3">
                        {DAYS_OF_WEEK.map((day, i) => <option key={i} value={i}>{day}</option>)}
                    </select>
                    <input type="time" value={rule.startTime} onChange={e => onChange(type, index, 'startTime', e.target.value)} className="bg-gray-900 border-2 border-gray-700 text-white rounded-lg py-2 px-3" />
                    <select value={rule.endDayOfWeek} onChange={e => onChange(type, index, 'endDayOfWeek', parseInt(e.target.value))} className="bg-gray-900 border-2 border-gray-700 text-white rounded-lg py-2 px-3">
                        {DAYS_OF_WEEK.map((day, i) => <option key={i} value={i}>{day}</option>)}
                    </select>
                    <input type="time" value={rule.endTime} onChange={e => onChange(type, index, 'endTime', e.target.value)} className="bg-gray-900 border-2 border-gray-700 text-white rounded-lg py-2 px-3" />
                    <select value={rule.changes} onChange={e => onChange(type, index, 'changes', parseInt(e.target.value))} className="bg-gray-900 border-2 border-gray-700 text-white rounded-lg py-2 px-3">
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                        <option value={3}>3</option>
                        <option value={-1}>Unlimited</option>
                    </select>
                </div>
            ))}
            <button onClick={() => onAdd(type)} className="flex items-center justify-center w-full mt-2 py-2 px-4 border-2 border-dashed border-gray-600 text-gray-400 rounded-lg hover:bg-gray-700 hover:text-white transition"><PlusCircleIcon /> Add Rule</button>
        </div>
    );

    return (
        <div>
            <div className="bg-gray-700 p-4 rounded-lg mb-6">
                <h3 className="text-xl mb-3">General Gameplay Rules</h3>
                <label htmlFor="maxPoints" className="block text-sm font-medium text-gray-300 mb-1">Maximum Draft Points (32-192)</label>
                <input type="number" id="maxPoints" value={maxPoints} onChange={e => setMaxPoints(parseInt(e.target.value))} min="32" max="192" className="w-full md:w-1/3 bg-gray-800 border-2 border-gray-600 text-white rounded-lg py-2 px-3 focus:outline-none focus:border-green-500" />
            </div>
            <RuleEditor type="offSeason" rules={offSeasonRules} onChange={handleRuleChange} onAdd={handleAddRule} maxWeeks={7} />
            <RuleEditor type="liveSeason" rules={liveSeasonRules} onChange={handleRuleChange} onAdd={handleAddRule} maxWeeks={10} />
            <button onClick={handleSaveRules} disabled={isLoading} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition disabled:bg-gray-500">{isLoading ? 'Saving...' : 'Save Default Rules'}</button>
            {message && <p className="text-center mt-4 text-yellow-300">{message}</p>}
            {error && <p className="text-center mt-4 text-red-400">{error}</p>}
        </div>
    );
};

const AutomationPanel = ({ db }) => {
    const [logs, setLogs] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    const runAutomation = async () => {
        setIsLoading(true);
        setLogs([]);
        const addLog = (msg) => setLogs(prev => [...prev, msg]);

        addLog("Starting daily automation simulation...");

        const rulesRef = doc(db, `artifacts/${appId}/public/data/defaultRules/main`);
        const rulesSnap = await getDoc(rulesRef);
        if (!rulesSnap.exists()) {
            addLog("ERROR: Default rules not set. Cannot proceed.");
            setIsLoading(false);
            return;
        }
        const defaultRules = rulesSnap.data();
        addLog("Successfully loaded default rules.");

        const year = new Date().getFullYear();
        let firstSaturday = null;
        let secondSaturday = null;
        for (let i = 1; i <= 14; i++) {
            const date = new Date(year, 7, i); // August
            if (date.getDay() === 6) { // Saturday
                if (!firstSaturday) { firstSaturday = new Date(date); } 
                else { secondSaturday = new Date(date); break; }
            }
        }
        const finalsDate = secondSaturday;
        addLog(`Calculated DCI Finals Date for ${year}: ${finalsDate.toDateString()}`);
        
        const liveSeasonEndDate = new Date(finalsDate);
        const liveSeasonStartDate = new Date(liveSeasonEndDate);
        liveSeasonStartDate.setDate(liveSeasonEndDate.getDate() - (10 * 7 - 1));

        const offSeasons = [];
        let currentEndDate = new Date(liveSeasonStartDate);
        currentEndDate.setDate(currentEndDate.getDate() - 1);
        for(let i = 6; i >= 1; i--) {
            const endDate = new Date(currentEndDate);
            const startDate = new Date(endDate);
            startDate.setDate(endDate.getDate() - (7 * 7 - 1));
            offSeasons.unshift({ name: `${year} Off-Season ${i}`, startDate, endDate, type: 'Off-Season' });
            currentEndDate.setDate(startDate.getDate() - 1);
        }

        const schedule = [{ name: `${year} Live Season`, startDate: liveSeasonStartDate, endDate: liveSeasonEndDate, type: 'Live' }, ...offSeasons];
        addLog(`Calculated ${schedule.length} seasons for the ${year} cycle.`);

        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        for (const season of schedule) {
            const seasonStartStr = season.startDate.toISOString().split('T')[0];
            if (todayStr === seasonStartStr) {
                const seasonsQuery = query(collection(db, `artifacts/${appId}/public/data/seasons`), where("name", "==", season.name));
                const existing = await getDocs(seasonsQuery);
                if (existing.empty) {
                    addLog(`Today is the start date for a new season: ${season.name}. Creating it now...`);
                    // Auto-create season logic here
                } else {
                    addLog(`Season ${season.name} already exists.`);
                }
            }
        }

        addLog("Automation check complete.");
        setIsLoading(false);
    };

    return (
        <div className="bg-gray-700 p-4 rounded-lg">
            <h3 className="text-xl mb-3">Automation Engine</h3>
            <p className="text-gray-400 mb-4">This tool simulates the daily script that will run on the server to automatically create seasons and run shows.</p>
            <button onClick={runAutomation} disabled={isLoading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition disabled:bg-gray-500">
                {isLoading ? 'Running...' : 'Simulate Daily Automation'}
            </button>
            {logs.length > 0 && (
                <div className="mt-6 bg-gray-900 p-4 rounded-lg font-mono text-sm text-gray-300 max-h-96 overflow-y-auto">
                    {logs.map((log, index) => <p key={index} className="whitespace-pre-wrap">{`> ${log}`}</p>)}
                </div>
            )}
        </div>
    );
};

