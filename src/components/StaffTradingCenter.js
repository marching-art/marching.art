import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, orderBy, limit, getDocs, doc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db, dataNamespace } from '../firebase';
import { useUserStore } from '../store/userStore';
import { motion, AnimatePresence } from 'framer-motion';
import { getAllUserCorps, CORPS_CLASSES } from '../utils/profileCompatibility';
import { DCI_HALL_OF_FAME_STAFF } from '../data/dciHallOfFameStaff';
import Icon from '../ui/Icon';
import toast from 'react-hot-toast';

const CAPTIONS = ['GE1', 'GE2', 'VP', 'VA', 'CG', 'B', 'MA', 'P'];

const StaffTradingCenter = () => {
    const { user, loggedInProfile, updateUserExperience } = useUserStore();
    const [activeTab, setActiveTab] = useState('marketplace');
    const [selectedCorpsClass, setSelectedCorpsClass] = useState('worldClass');
    const [selectedCaption, setSelectedCaption] = useState('GE1');
    const [tradeProposals, setTradeProposals] = useState([]);
    const [myTrades, setMyTrades] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [staffValues, setStaffValues] = useState({});

    const userCorps = useMemo(() => getAllUserCorps(loggedInProfile), [loggedInProfile]);

    const tabs = [
        { id: 'marketplace', label: 'Staff Market', icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.1 5M7 13v6a2 2 0 002 2h6M9 19h10a2 2 0 002-2V9a2 2 0 00-2-2H9a2 2 0 00-2 2v10z' },
        { id: 'lineups', label: 'My Staff', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0z' },
        { id: 'proposals', label: 'Trade Proposals', icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4' },
        { id: 'history', label: 'Trade History', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' }
    ];

    useEffect(() => {
        if (!user) return;

        const fetchStaffData = async () => {
            setIsLoading(true);
            try {
                // Load current staff values
                const staffValuesSnapshot = await getDocs(collection(db, 'staff-database'));
                const values = {};
                staffValuesSnapshot.docs.forEach(doc => {
                    values[doc.id] = doc.data();
                });
                setStaffValues(values);

                await Promise.all([
                    fetchTradeProposals(),
                    fetchMyTrades()
                ]);
            } catch (error) {
                console.error('Error fetching staff data:', error);
                toast.error('Failed to load staff data');
            } finally {
                setIsLoading(false);
            }
        };

        fetchStaffData();
    }, [user]);

    const fetchTradeProposals = async () => {
        if (!user) return;

        const proposalsRef = collection(db, 'staff-trade-proposals');
        const proposalsQuery = query(
            proposalsRef,
            where('toUserId', '==', user.uid),
            where('status', '==', 'pending'),
            orderBy('createdAt', 'desc'),
            limit(20)
        );

        const snapshot = await getDocs(proposalsQuery);
        const proposals = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        setTradeProposals(proposals);
    };

    const fetchMyTrades = async () => {
        if (!user) return;

        const tradesRef = collection(db, 'staff-trade-proposals');
        const tradesQuery = query(
            tradesRef,
            where('fromUserId', '==', user.uid),
            orderBy('createdAt', 'desc'),
            limit(20)
        );

        const snapshot = await getDocs(tradesQuery);
        const trades = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        setMyTrades(trades);
    };

    const getCurrentStaffLineup = (corpsClass) => {
        return userCorps[corpsClass]?.staffLineup || {};
    };

    const getAvailableStaff = (caption) => {
        return DCI_HALL_OF_FAME_STAFF[caption] || [];
    };

    const handleStaffSelection = async (caption, staffId) => {
        if (!user || !loggedInProfile) return;

        try {
            const profileRef = doc(db, `artifacts/${dataNamespace}/users/${user.uid}/profile/data`);
            
            await updateDoc(profileRef, {
                [`corps.${selectedCorpsClass}.staffLineup.${caption}`]: staffId,
                [`corps.${selectedCorpsClass}.staffLineupUpdated`]: new Date(),
                lastActive: new Date()
            });

            // Award XP for staff selection
            await updateUserExperience(10, 'Staff selection');
            toast.success('Staff member assigned successfully!');
            
        } catch (error) {
            console.error('Error assigning staff:', error);
            toast.error('Failed to assign staff member');
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary dark:border-primary-dark mx-auto"></div>
                    <p className="mt-4 text-text-secondary dark:text-text-secondary-dark">Loading staff trading center...</p>
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
                        Staff Trading Center 👨‍🏫
                    </h1>
                    <p className="text-text-secondary dark:text-text-secondary-dark">
                        Recruit legendary DCI Hall of Fame staff to boost your corps performance
                    </p>
                </div>

                {/* Navigation Tabs */}
                <div className="mb-8">
                    <div className="flex flex-wrap gap-2">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-theme font-medium transition-all ${
                                    activeTab === tab.id
                                        ? 'bg-primary text-on-primary'
                                        : 'bg-surface dark:bg-surface-dark text-text-secondary dark:text-text-secondary-dark hover:text-primary dark:hover:text-primary-dark border border-accent dark:border-accent-dark'
                                }`}
                            >
                                <Icon path={tab.icon} className="w-4 h-4" />
                                {tab.label}
                                {tab.id === 'proposals' && tradeProposals.length > 0 && (
                                    <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                                        {tradeProposals.length}
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
                        {activeTab === 'marketplace' && (
                            <StaffMarketplace 
                                selectedCorpsClass={selectedCorpsClass}
                                setSelectedCorpsClass={setSelectedCorpsClass}
                                selectedCaption={selectedCaption}
                                setSelectedCaption={setSelectedCaption}
                                availableStaff={getAvailableStaff(selectedCaption)}
                                currentLineup={getCurrentStaffLineup(selectedCorpsClass)}
                                onStaffSelect={handleStaffSelection}
                                staffValues={staffValues}
                            />
                        )}

                        {activeTab === 'lineups' && (
                            <MyStaffView 
                                userCorps={userCorps}
                                staffValues={staffValues}
                                onStaffSelect={handleStaffSelection}
                            />
                        )}

                        {activeTab === 'proposals' && (
                            <TradeProposalsView 
                                proposals={tradeProposals}
                                onAccept={() => {}} // Implement
                                onReject={() => {}} // Implement
                            />
                        )}

                        {activeTab === 'history' && (
                            <TradeHistoryView />
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
};

// Staff Marketplace Component
const StaffMarketplace = ({ 
    selectedCorpsClass, 
    setSelectedCorpsClass, 
    selectedCaption, 
    setSelectedCaption,
    availableStaff,
    currentLineup,
    onStaffSelect,
    staffValues 
}) => {
    return (
        <div className="space-y-6">
            {/* Filters */}
            <div className="bg-surface dark:bg-surface-dark rounded-theme p-6 border border-accent dark:border-accent-dark">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                </div>
            </div>

            {/* Current Selection */}
            {currentLineup[selectedCaption] && (
                <div className="bg-primary/10 border border-primary rounded-theme p-4">
                    <h3 className="font-bold text-text-primary dark:text-text-primary-dark mb-2">
                        Current {selectedCaption} Staff
                    </h3>
                    <div className="flex items-center justify-between">
                        <span className="text-text-primary dark:text-text-primary-dark">
                            {currentLineup[selectedCaption]}
                        </span>
                        <span className="text-sm text-text-secondary dark:text-text-secondary-dark">
                            Currently assigned
                        </span>
                    </div>
                </div>
            )}

            {/* Available Staff */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {availableStaff.map((staff) => (
                    <StaffCard 
                        key={staff.id}
                        staff={staff}
                        isSelected={currentLineup[selectedCaption] === staff.id}
                        onSelect={() => onStaffSelect(selectedCaption, staff.id)}
                        currentValue={staffValues[staff.id]?.currentValue || staff.baseValue}
                    />
                ))}
            </div>
        </div>
    );
};

// Staff Card Component
const StaffCard = ({ staff, isSelected, onSelect, currentValue }) => {
    const multiplierRange = {
        min: 0.95 + ((currentValue - 50) / 100) * 0.3,
        max: 0.95 + ((currentValue - 50) / 100) * 0.3
    };

    const multiplierPercent = ((multiplierRange.min - 1) * 100).toFixed(1);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`bg-surface dark:bg-surface-dark rounded-theme p-6 border transition-all cursor-pointer hover:shadow-lg ${
                isSelected 
                    ? 'border-primary bg-primary/10' 
                    : 'border-accent dark:border-accent-dark hover:border-primary'
            }`}
            onClick={onSelect}
        >
            <div className="space-y-4">
                <div>
                    <h3 className="font-bold text-text-primary dark:text-text-primary-dark">
                        {staff.name}
                    </h3>
                    <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                        {staff.specialty}
                    </p>
                    <p className="text-xs text-text-secondary dark:text-text-secondary-dark">
                        HOF Class of {staff.hallOfFameYear}
                    </p>
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-text-secondary dark:text-text-secondary-dark">Value:</span>
                        <span className="font-bold text-text-primary dark:text-text-primary-dark">
                            {currentValue}/100
                        </span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-text-secondary dark:text-text-secondary-dark">Multiplier:</span>
                        <span className={`font-bold ${
                            multiplierPercent >= 0 ? 'text-green-500' : 'text-red-500'
                        }`}>
                            {multiplierPercent >= 0 ? '+' : ''}{multiplierPercent}%
                        </span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-text-secondary dark:text-text-secondary-dark">Era:</span>
                        <span className="text-text-primary dark:text-text-primary-dark">{staff.era}</span>
                    </div>
                </div>

                <div className="pt-2 border-t border-accent dark:border-accent-dark">
                    <p className="text-xs text-text-secondary dark:text-text-secondary-dark">
                        {staff.bio}
                    </p>
                </div>

                {isSelected && (
                    <div className="bg-primary text-on-primary p-2 rounded text-center text-sm font-semibold">
                        Currently Assigned
                    </div>
                )}
            </div>
        </motion.div>
    );
};

// My Staff View Component
const MyStaffView = ({ userCorps, staffValues, onStaffSelect }) => {
    return (
        <div className="space-y-6">
            {Object.entries(userCorps).map(([corpsClass, corps]) => {
                const classDetails = CORPS_CLASSES[corpsClass];
                const staffLineup = corps.staffLineup || {};
                
                return (
                    <div key={corpsClass} className="bg-surface dark:bg-surface-dark rounded-theme p-6 border border-accent dark:border-accent-dark">
                        <div className="flex items-center gap-3 mb-4">
                            <span className={`w-4 h-4 rounded-full ${classDetails.color}`}></span>
                            <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark">
                                {corps.corpsName || `${classDetails.name} Corps`}
                            </h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {CAPTIONS.map(caption => {
                                const staffId = staffLineup[caption];
                                const staff = staffId ? getStaffById(staffId) : null;
                                
                                return (
                                    <div key={caption} className="p-4 bg-background dark:bg-background-dark rounded-theme border border-accent dark:border-accent-dark">
                                        <div className="font-semibold text-text-primary dark:text-text-primary-dark mb-2">
                                            {caption}
                                        </div>
                                        {staff ? (
                                            <div>
                                                <div className="font-medium text-text-primary dark:text-text-primary-dark">
                                                    {staff.name}
                                                </div>
                                                <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                                    Value: {staffValues[staffId]?.currentValue || staff.baseValue}/100
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-text-secondary dark:text-text-secondary-dark">
                                                No staff assigned
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

// Helper function to get staff by ID
const getStaffById = (staffId) => {
    for (const caption of CAPTIONS) {
        const staff = DCI_HALL_OF_FAME_STAFF[caption]?.find(s => s.id === staffId);
        if (staff) return staff;
    }
    return null;
};

// Placeholder components for other views
const TradeProposalsView = ({ proposals }) => (
    <div className="text-center py-12">
        <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-2">
            Staff Trade Proposals
        </h3>
        <p className="text-text-secondary dark:text-text-secondary-dark">
            Trade proposal system coming soon!
        </p>
    </div>
);

const TradeHistoryView = () => (
    <div className="text-center py-12">
        <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-2">
            Trade History
        </h3>
        <p className="text-text-secondary dark:text-text-secondary-dark">
            Trade history tracking coming soon!
        </p>
    </div>
);

export default StaffTradingCenter;