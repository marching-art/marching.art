// pages/TradingCenterPage.js - Complete Enhanced Trading Center
import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, orderBy, limit, getDocs, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../firebase';
import { useUserStore } from '../store/userStore';
import { motion, AnimatePresence } from 'framer-motion';
import { getAllUserCorps, CORPS_CLASSES } from '../utils/profileCompatibility';
import { DCI_HALL_OF_FAME_STAFF, calculateStaffMultiplier } from '../data/dciHallOfFameStaff';
import Icon from '../components/ui/Icon';
import toast from 'react-hot-toast';

const CAPTIONS = ['GE1', 'GE2', 'VP', 'VA', 'CG', 'B', 'MA', 'P'];

const TradingCenterPage = () => {
    const { user, loggedInProfile, updateUserExperience } = useUserStore();
    const [activeTab, setActiveTab] = useState('staff-market');
    const [selectedCorpsClass, setSelectedCorpsClass] = useState('worldClass');
    const [selectedCaption, setSelectedCaption] = useState('GE1');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('value_high');
    const [isLoading, setIsLoading] = useState(true);
    
    // Trading state
    const [staffTradeProposals, setStaffTradeProposals] = useState([]);
    const [myStaffTrades, setMyStaffTrades] = useState([]);
    const [corpsTradeProposals, setCorpsTradeProposals] = useState([]);
    const [myCorpsTrades, setMyCorpsTrades] = useState([]);
    const [tradeHistory, setTradeHistory] = useState([]);
    
    // Market state
    const [marketplaceOffers, setMarketplaceOffers] = useState([]);

    const userCorps = useMemo(() => getAllUserCorps(loggedInProfile), [loggedInProfile]);
    const currentStaffLineup = userCorps[selectedCorpsClass]?.staffLineup || {};

    const tabs = [
        { 
            id: 'staff-market', 
            label: 'Staff Market', 
            icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 715.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 919.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0z',
            description: 'Browse and hire DCI Hall of Fame staff'
        },
        { 
            id: 'staff-trades', 
            label: 'Staff Trades', 
            icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
            description: 'Trade staff with other directors'
        },
        { 
            id: 'corps-market', 
            label: 'Corps Market', 
            icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.1 5M7 13v6a2 2 0 002 2h6M9 19h10a2 2 0 002-2V9a2 2 0 00-2-2H9a2 2 0 00-2 2v10z',
            description: 'Buy and sell corps performers'
        },
        { 
            id: 'trade-history', 
            label: 'Trade History', 
            icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
            description: 'View your trading history'
        }
    ];

    useEffect(() => {
        if (!user) return;

        const fetchTradingData = async () => {
            setIsLoading(true);
            try {
                await Promise.all([
                    fetchStaffTradeProposals(),
                    fetchCorpsTradeProposals(),
                    fetchTradeHistory(),
                    fetchMarketplaceOffers()
                ]);
            } catch (error) {
                console.error('Error fetching trading data:', error);
                toast.error('Failed to load trading data');
            } finally {
                setIsLoading(false);
            }
        };

        fetchTradingData();

        // Set up real-time listeners
        const unsubscribeStaffTrades = setupStaffTradeListener();
        const unsubscribeCorpsTrades = setupCorpsTradeListener();

        return () => {
            unsubscribeStaffTrades();
            unsubscribeCorpsTrades();
        };
    }, [user]);

    const setupStaffTradeListener = () => {
        const proposalsRef = collection(db, 'staff-trade-proposals');
        const proposalsQuery = query(
            proposalsRef,
            where('participants', 'array-contains', user.uid),
            orderBy('createdAt', 'desc')
        );

        return onSnapshot(proposalsQuery, (snapshot) => {
            const proposals = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            setStaffTradeProposals(proposals.filter(p => p.targetUserId === user.uid && p.status === 'pending'));
            setMyStaffTrades(proposals.filter(p => p.fromUserId === user.uid));
        });
    };

    const setupCorpsTradeListener = () => {
        const proposalsRef = collection(db, 'trade-proposals');
        const proposalsQuery = query(
            proposalsRef,
            where('participants', 'array-contains', user.uid),
            orderBy('createdAt', 'desc')
        );

        return onSnapshot(proposalsQuery, (snapshot) => {
            const proposals = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            setCorpsTradeProposals(proposals.filter(p => p.toUserId === user.uid && p.status === 'pending'));
            setMyCorpsTrades(proposals.filter(p => p.fromUserId === user.uid));
        });
    };

    const fetchStaffTradeProposals = async () => {
        // Implementation for fetching staff trade proposals
    };

    const fetchCorpsTradeProposals = async () => {
        // Implementation for fetching corps trade proposals
    };

    const fetchTradeHistory = async () => {
        try {
            const historyRef = collection(db, 'trade-history');
            const historyQuery = query(
                historyRef,
                where('participants', 'array-contains', user.uid),
                orderBy('completedAt', 'desc'),
                limit(50)
            );

            const snapshot = await getDocs(historyQuery);
            const history = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            setTradeHistory(history);
        } catch (error) {
            console.error('Error fetching trade history:', error);
        }
    };

    const fetchMarketplaceOffers = async () => {
        try {
            const offersRef = collection(db, 'marketplace-offers');
            const offersQuery = query(
                offersRef,
                where('status', '==', 'active'),
                orderBy('createdAt', 'desc'),
                limit(100)
            );

            const snapshot = await getDocs(offersQuery);
            const offers = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            setMarketplaceOffers(offers);
        } catch (error) {
            console.error('Error fetching marketplace offers:', error);
        }
    };

    const handleStaffSelection = async (caption, staffId) => {
        if (!user || !loggedInProfile) return;

        try {
            const functions = getFunctions();
            const updateStaffLineup = httpsCallable(functions, 'updateStaffLineup');
            
            const result = await updateStaffLineup({ 
                corpsClass: selectedCorpsClass, 
                caption, 
                staffId 
            });

            if (result.data.success) {
                toast.success('Staff assigned successfully!');
                await updateUserExperience(10, 'Staff assignment');
            }
        } catch (error) {
            console.error('Error assigning staff:', error);
            toast.error('Failed to assign staff member');
        }
    };

    const handleStaffTradeResponse = async (tradeId, action) => {
        try {
            const functions = getFunctions();
            const respondToStaffTrade = httpsCallable(functions, 'respondToStaffTrade');
            
            const result = await respondToStaffTrade({ tradeId, action });

            if (result.data.success) {
                toast.success(`Staff trade ${action}ed successfully!`);
                if (action === 'accept') {
                    await updateUserExperience(50, 'Staff trade completed');
                }
            }
        } catch (error) {
            console.error('Error responding to staff trade:', error);
            toast.error(`Failed to ${action} trade`);
        }
    };

    const filteredStaff = useMemo(() => {
        let staff = DCI_HALL_OF_FAME_STAFF[selectedCaption] || [];
        
        if (searchTerm) {
            staff = staff.filter(s => 
                s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.specialty.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.era.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        return staff.sort((a, b) => {
            switch (sortBy) {
                case 'value_high':
                    return b.currentValue - a.currentValue;
                case 'value_low':
                    return a.currentValue - b.currentValue;
                case 'name':
                    return a.name.localeCompare(b.name);
                case 'era':
                    return b.hallOfFameYear - a.hallOfFameYear;
                default:
                    return 0;
            }
        });
    }, [selectedCaption, searchTerm, sortBy]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary dark:border-primary-dark mx-auto"></div>
                    <p className="mt-4 text-text-secondary dark:text-text-secondary-dark">Loading trading center...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background dark:bg-background-dark">
            <div className="container mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl sm:text-4xl font-bold text-text-primary dark:text-text-primary-dark mb-2">
                        Trading Center
                    </h1>
                    <p className="text-text-secondary dark:text-text-secondary-dark">
                        Recruit legendary staff and optimize your corps lineup
                    </p>
                </div>

                {/* Navigation Tabs */}
                <div className="mb-8">
                    <div className="flex flex-wrap gap-2">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-4 py-3 rounded-theme font-medium transition-all ${
                                    activeTab === tab.id
                                        ? 'bg-primary text-on-primary'
                                        : 'bg-surface dark:bg-surface-dark text-text-secondary dark:text-text-secondary-dark hover:text-primary dark:hover:text-primary-dark border border-accent dark:border-accent-dark'
                                }`}
                            >
                                <Icon path={tab.icon} className="w-4 h-4" />
                                <div className="text-left">
                                    <div className="font-semibold">{tab.label}</div>
                                    <div className="text-xs opacity-75">{tab.description}</div>
                                </div>
                                {(tab.id === 'staff-trades' && staffTradeProposals.length > 0) && (
                                    <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                                        {staffTradeProposals.length}
                                    </span>
                                )}
                                {(tab.id === 'corps-market' && corpsTradeProposals.length > 0) && (
                                    <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                                        {corpsTradeProposals.length}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                    >
                        {activeTab === 'staff-market' && (
                            <StaffMarketView 
                                selectedCorpsClass={selectedCorpsClass}
                                setSelectedCorpsClass={setSelectedCorpsClass}
                                selectedCaption={selectedCaption}
                                setSelectedCaption={setSelectedCaption}
                                searchTerm={searchTerm}
                                setSearchTerm={setSearchTerm}
                                sortBy={sortBy}
                                setSortBy={setSortBy}
                                filteredStaff={filteredStaff}
                                currentStaffLineup={currentStaffLineup}
                                onStaffSelect={handleStaffSelection}
                            />
                        )}

                        {activeTab === 'staff-trades' && (
                            <StaffTradesView 
                                proposals={staffTradeProposals}
                                myTrades={myStaffTrades}
                                onAccept={(tradeId) => handleStaffTradeResponse(tradeId, 'accept')}
                                onReject={(tradeId) => handleStaffTradeResponse(tradeId, 'reject')}
                            />
                        )}

                        {activeTab === 'corps-market' && (
                            <CorpsMarketView 
                                offers={marketplaceOffers}
                                proposals={corpsTradeProposals}
                                myTrades={myCorpsTrades}
                            />
                        )}

                        {activeTab === 'trade-history' && (
                            <TradeHistoryView history={tradeHistory} />
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
};

// Staff Market View Component
const StaffMarketView = ({ 
    selectedCorpsClass, 
    setSelectedCorpsClass, 
    selectedCaption, 
    setSelectedCaption,
    searchTerm,
    setSearchTerm,
    sortBy,
    setSortBy,
    filteredStaff,
    currentStaffLineup,
    onStaffSelect 
}) => {
    return (
        <div className="space-y-6">
            {/* Filters */}
            <div className="bg-surface dark:bg-surface-dark rounded-theme p-6 border border-accent dark:border-accent-dark">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                            Corps Class
                        </label>
                        <select
                            value={selectedCorpsClass}
                            onChange={(e) => setSelectedCorpsClass(e.target.value)}
                            className="w-full bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-theme p-2 text-text-primary dark:text-text-primary-dark"
                        >
                            {Object.entries(CORPS_CLASSES).map(([key, classData]) => (
                                <option key={key} value={key}>{classData.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                            Caption
                        </label>
                        <select
                            value={selectedCaption}
                            onChange={(e) => setSelectedCaption(e.target.value)}
                            className="w-full bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-theme p-2 text-text-primary dark:text-text-primary-dark"
                        >
                            {CAPTIONS.map(caption => (
                                <option key={caption} value={caption}>{caption}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                            Search
                        </label>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search staff..."
                            className="w-full bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-theme p-2 text-text-primary dark:text-text-primary-dark"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                            Sort By
                        </label>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="w-full bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-theme p-2 text-text-primary dark:text-text-primary-dark"
                        >
                            <option value="value_high">Value: High to Low</option>
                            <option value="value_low">Value: Low to High</option>
                            <option value="name">Name A-Z</option>
                            <option value="era">Most Recent HOF</option>
                        </select>
                    </div>

                    <div className="flex items-end">
                        <div className="w-full text-center p-2 bg-primary/10 rounded-theme">
                            <div className="text-xs text-text-secondary dark:text-text-secondary-dark">Current Staff</div>
                            <div className="font-bold text-primary dark:text-primary-dark">
                                {currentStaffLineup[selectedCaption] ? 'Assigned' : 'Empty'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Staff Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredStaff.map((staff) => (
                    <StaffCard 
                        key={staff.id}
                        staff={staff}
                        isSelected={currentStaffLineup[selectedCaption] === staff.id}
                        onSelect={() => onStaffSelect(selectedCaption, staff.id)}
                    />
                ))}
            </div>

            {filteredStaff.length === 0 && (
                <div className="text-center py-12">
                    <div className="text-6xl mb-4">🔍</div>
                    <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-2">
                        No staff found
                    </h3>
                    <p className="text-text-secondary dark:text-text-secondary-dark">
                        Try adjusting your search filters.
                    </p>
                </div>
            )}
        </div>
    );
};

// Staff Card Component
const StaffCard = ({ staff, isSelected, onSelect }) => {
    const multiplier = calculateStaffMultiplier(staff);
    const bonusPercent = ((multiplier - 1) * 100).toFixed(1);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -4 }}
            className={`bg-surface dark:bg-surface-dark rounded-theme p-6 border-2 transition-all cursor-pointer shadow-theme hover:shadow-lg ${
                isSelected 
                    ? 'border-primary bg-primary/10' 
                    : 'border-accent dark:border-accent-dark hover:border-primary'
            }`}
            onClick={onSelect}
        >
            <div className="space-y-4">
                {/* Header */}
                <div className="flex justify-between items-start">
                    <div className="flex-1">
                        <h3 className="font-bold text-text-primary dark:text-text-primary-dark text-lg leading-tight">
                            {staff.name}
                        </h3>
                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                            {staff.specialty}
                        </p>
                    </div>
                    <div className="text-right">
                        <div className="text-xs text-text-secondary dark:text-text-secondary-dark">HOF</div>
                        <div className="font-bold text-primary dark:text-primary-dark">
                            {staff.hallOfFameYear}
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-background dark:bg-background-dark rounded-theme">
                        <div className="text-lg font-bold text-text-primary dark:text-text-primary-dark">
                            {staff.currentValue}
                        </div>
                        <div className="text-xs text-text-secondary dark:text-text-secondary-dark">
                            Value
                        </div>
                    </div>
                    
                    <div className="text-center p-3 bg-background dark:bg-background-dark rounded-theme">
                        <div className={`text-lg font-bold ${
                            bonusPercent >= 0 ? 'text-green-500' : 'text-red-500'
                        }`}>
                            {bonusPercent >= 0 ? '+' : ''}{bonusPercent}%
                        </div>
                        <div className="text-xs text-text-secondary dark:text-text-secondary-dark">
                            Bonus
                        </div>
                    </div>
                </div>

                {/* Details */}
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-text-secondary dark:text-text-secondary-dark">Era:</span>
                        <span className="text-text-primary dark:text-text-primary-dark">{staff.era}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-text-secondary dark:text-text-secondary-dark">Corps:</span>
                        <span className="text-text-primary dark:text-text-primary-dark text-right">
                            {Array.isArray(staff.corps) ? staff.corps.join(', ') : staff.corps}
                        </span>
                    </div>
                </div>

                {/* Bio */}
                <div className="pt-2 border-t border-accent dark:border-accent-dark">
                    <p className="text-xs text-text-secondary dark:text-text-secondary-dark leading-relaxed">
                        {staff.bio}
                    </p>
                </div>

                {/* Action */}
                {isSelected ? (
                    <div className="bg-primary text-on-primary p-3 rounded-theme text-center text-sm font-semibold">
                        Currently Assigned
                    </div>
                ) : (
                    <div className="text-center p-3 border-2 border-dashed border-accent dark:border-accent-dark rounded-theme text-sm text-text-secondary dark:text-text-secondary-dark hover:border-primary hover:text-primary transition-colors">
                        Click to Assign
                    </div>
                )}
            </div>
        </motion.div>
    );
};

// Staff Trades View Component
const StaffTradesView = ({ proposals, myTrades, onAccept, onReject }) => {
    const [activeSubTab, setActiveSubTab] = useState('incoming');

    const subTabs = [
        { id: 'incoming', label: 'Incoming Proposals', count: proposals.length },
        { id: 'outgoing', label: 'My Proposals', count: myTrades.length }
    ];

    return (
        <div className="space-y-6">
            {/* Sub Navigation */}
            <div className="flex gap-2">
                {subTabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveSubTab(tab.id)}
                        className={`px-4 py-2 rounded-theme font-medium transition-all ${
                            activeSubTab === tab.id
                                ? 'bg-primary text-on-primary'
                                : 'bg-surface dark:bg-surface-dark border border-accent dark:border-accent-dark'
                        }`}
                    >
                        {tab.label}
                        {tab.count > 0 && (
                            <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-1">
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Content */}
            {activeSubTab === 'incoming' && (
                <div className="space-y-4">
                    {proposals.length === 0 ? (
                        <EmptyState 
                            icon="📨"
                            title="No pending proposals"
                            description="Staff trade proposals from other directors will appear here."
                        />
                    ) : (
                        proposals.map((proposal) => (
                            <StaffTradeProposalCard
                                key={proposal.id}
                                proposal={proposal}
                                onAccept={() => onAccept(proposal.id)}
                                onReject={() => onReject(proposal.id)}
                            />
                        ))
                    )}
                </div>
            )}

            {activeSubTab === 'outgoing' && (
                <div className="space-y-4">
                    {myTrades.length === 0 ? (
                        <EmptyState 
                            icon="📤"
                            title="No outgoing proposals"
                            description="Your staff trade proposals will appear here."
                        />
                    ) : (
                        myTrades.map((trade) => (
                            <MyStaffTradeCard key={trade.id} trade={trade} />
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

// Staff Trade Proposal Card Component
const StaffTradeProposalCard = ({ proposal, onAccept, onReject }) => {
    return (
        <div className="bg-surface dark:bg-surface-dark rounded-theme p-6 border border-accent dark:border-accent-dark shadow-theme">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="font-bold text-text-primary dark:text-text-primary-dark">
                        Staff Trade from {proposal.fromUser?.username || 'Unknown'}
                    </h3>
                    <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                        {new Date(proposal.createdAt).toLocaleDateString()}
                    </p>
                </div>
                <span className="px-3 py-1 bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 rounded-theme text-sm font-semibold">
                    Pending
                </span>
            </div>

            {proposal.message && (
                <div className="mb-4 p-3 bg-background dark:bg-background-dark rounded-theme">
                    <p className="text-sm text-text-primary dark:text-text-primary-dark italic">
                        "{proposal.message}"
                    </p>
                </div>
            )}

            <div className="flex gap-4 mb-6">
                <button
                    onClick={onAccept}
                    className="flex-1 bg-green-500 text-white py-3 rounded-theme font-semibold hover:bg-green-600 transition-colors"
                >
                    Accept Trade
                </button>
                <button
                    onClick={onReject}
                    className="flex-1 bg-red-500 text-white py-3 rounded-theme font-semibold hover:bg-red-600 transition-colors"
                >
                    Reject Trade
                </button>
            </div>
        </div>
    );
};

// My Staff Trade Card Component
const MyStaffTradeCard = ({ trade }) => {
    const getStatusColor = (status) => {
        switch (status) {
            case 'pending': return 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400';
            case 'accepted': return 'bg-green-500/20 text-green-600 dark:text-green-400';
            case 'rejected': return 'bg-red-500/20 text-red-600 dark:text-red-400';
            default: return 'bg-gray-500/20 text-gray-600 dark:text-gray-400';
        }
    };

    return (
        <div className="bg-surface dark:bg-surface-dark rounded-theme p-4 border border-accent dark:border-accent-dark">
            <div className="flex justify-between items-start">
                <div>
                    <h4 className="font-semibold text-text-primary dark:text-text-primary-dark">
                        Trade with {trade.targetUser?.username || 'Unknown'}
                    </h4>
                    <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                        Sent {new Date(trade.createdAt).toLocaleDateString()}
                    </p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(trade.status)}`}>
                    {trade.status}
                </span>
            </div>
        </div>
    );
};

// Corps Market View Component
const CorpsMarketView = ({ offers, proposals, myTrades }) => {
    return (
        <div className="text-center py-12">
            <div className="text-6xl mb-4">🏗️</div>
            <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-2">
                Corps Trading Coming Soon!
            </h3>
            <p className="text-text-secondary dark:text-text-secondary-dark">
                Corps marketplace and trading features are under development.
            </p>
        </div>
    );
};

// Trade History View Component
const TradeHistoryView = ({ history }) => {
    if (history.length === 0) {
        return (
            <EmptyState 
                icon="📜"
                title="No trade history"
                description="Your completed trades will appear here."
            />
        );
    }

    return (
        <div className="space-y-4">
            {history.map((trade) => (
                <TradeHistoryCard key={trade.id} trade={trade} />
            ))}
        </div>
    );
};

// Trade History Card Component
const TradeHistoryCard = ({ trade }) => {
    return (
        <div className="bg-surface dark:bg-surface-dark rounded-theme p-4 border border-accent dark:border-accent-dark">
            <div className="flex justify-between items-start">
                <div>
                    <h4 className="font-semibold text-text-primary dark:text-text-primary-dark">
                        {trade.type === 'staff' ? 'Staff Trade' : 'Corps Trade'} with {trade.otherUser?.username}
                    </h4>
                    <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                        Completed {new Date(trade.completedAt).toLocaleDateString()}
                    </p>
                </div>
                <span className="px-2 py-1 bg-green-500/20 text-green-600 dark:text-green-400 rounded text-xs font-semibold">
                    Completed
                </span>
            </div>
            {trade.summary && (
                <p className="text-sm text-text-secondary dark:text-text-secondary-dark mt-2">
                    {trade.summary}
                </p>
            )}
        </div>
    );
};

// Empty State Component
const EmptyState = ({ icon, title, description }) => (
    <div className="text-center py-12">
        <div className="text-6xl mb-4">{icon}</div>
        <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-2">
            {title}
        </h3>
        <p className="text-text-secondary dark:text-text-secondary-dark">
            {description}
        </p>
    </div>
);

export default TradingCenterPage;