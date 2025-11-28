// LeagueDetailView - Full view of a single league with tabs
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, Crown, ChevronDown, MapPin, Award,
  ArrowLeftRight, MessageSquare, Settings
} from 'lucide-react';
import { collection, query, orderBy, limit as firestoreLimit, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../../firebase';

// Import tab components
import {
  CircuitStandingsTab,
  TourStopsTab,
  AwardsTab,
  TradesTab,
  ChatTab,
  SettingsTab
} from './tabs';

const LeagueDetailView = ({ league, userProfile, onBack, onLeave }) => {
  const [activeTab, setActiveTab] = useState('standings');
  const [standings, setStandings] = useState(null);
  const [trades, setTrades] = useState([]);
  const [messages, setMessages] = useState([]);

  const isCommissioner = league.creatorId === userProfile?.uid;

  useEffect(() => {
    // Load standings
    const standingsRef = doc(db, `artifacts/marching-art/leagues/${league.id}/standings/current`);
    const unsubStandings = onSnapshot(standingsRef, (doc) => {
      if (doc.exists()) {
        setStandings(doc.data());
      }
    });

    // Load trades
    const tradesRef = collection(db, `artifacts/marching-art/leagues/${league.id}/trades`);
    const unsubTrades = onSnapshot(
      query(tradesRef, orderBy('createdAt', 'desc'), firestoreLimit(10)),
      (snapshot) => {
        const tradesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setTrades(tradesData);
      }
    );

    // Load chat messages
    const messagesRef = collection(db, `artifacts/marching-art/leagues/${league.id}/chat`);
    const unsubMessages = onSnapshot(
      query(messagesRef, orderBy('createdAt', 'desc'), firestoreLimit(50)),
      (snapshot) => {
        const messagesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setMessages(messagesData.reverse());
      }
    );

    return () => {
      unsubStandings();
      unsubTrades();
      unsubMessages();
    };
  }, [league.id]);

  const tabs = [
    { id: 'standings', label: 'Circuit Standings', icon: Trophy },
    { id: 'tour', label: 'Tour Stops', icon: MapPin },
    { id: 'awards', label: 'Awards', icon: Award },
    { id: 'trades', label: 'Trades', icon: ArrowLeftRight },
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    ...(isCommissioner ? [{ id: 'settings', label: 'Settings', icon: Settings }] : [])
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-2xl" />
        <div className="relative p-8 glass rounded-2xl">
          <button
            onClick={onBack}
            className="mb-4 text-cream-300 hover:text-cream-100 flex items-center gap-2"
          >
            <ChevronDown className="w-5 h-5 rotate-90" />
            Back to Leagues
          </button>

          <div className="flex flex-col md:flex-row items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-2">
                <h1 className="text-2xl md:text-4xl font-display font-bold text-gradient">
                  {league.name}
                </h1>
                {isCommissioner && (
                  <div className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 bg-gold-500/20 border border-gold-500/50 rounded-full">
                    <Crown className="w-3 h-3 md:w-4 md:h-4 text-gold-500" />
                    <span className="text-xs md:text-sm font-semibold text-gold-500">Commissioner</span>
                  </div>
                )}
              </div>
              <p className="text-sm md:text-base text-cream-300">{league.description}</p>
            </div>

            <div className="flex gap-2 w-full md:w-auto">
              <button
                onClick={onLeave}
                className="btn-ghost text-red-400 hover:bg-red-500/10 flex-1 md:flex-none"
              >
                Leave League
              </button>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mt-4 md:mt-6">
            <div className="p-4 bg-charcoal-900/50 rounded-lg">
              <p className="text-xs text-cream-500/60 mb-1">Directors</p>
              <p className="text-2xl font-bold text-cream-100">
                {league.members?.length || 0}
              </p>
            </div>
            <div className="p-4 bg-charcoal-900/50 rounded-lg">
              <p className="text-xs text-cream-500/60 mb-1">Prize Pool</p>
              <p className="text-2xl font-bold text-gold-500">
                {league.settings?.prizePool || 1000}
              </p>
            </div>
            <div className="p-4 bg-charcoal-900/50 rounded-lg">
              <p className="text-xs text-cream-500/60 mb-1">Finals Spots</p>
              <p className="text-2xl font-bold text-cream-100">
                {league.settings?.finalsSize || 12}
              </p>
            </div>
            <div className="p-4 bg-charcoal-900/50 rounded-lg">
              <p className="text-xs text-cream-500/60 mb-1">Staff Trading</p>
              <p className="text-2xl font-bold text-cream-100">
                {league.settings?.enableStaffTrading ? 'On' : 'Off'}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg transition-all font-semibold whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-gold-500 text-charcoal-900'
                  : 'glass text-cream-300 hover:text-cream-100'
              }`}
            >
              <Icon className="w-5 h-5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'standings' && (
          <CircuitStandingsTab key="standings" league={league} />
        )}
        {activeTab === 'tour' && (
          <TourStopsTab key="tour" league={league} />
        )}
        {activeTab === 'awards' && (
          <AwardsTab key="awards" league={league} />
        )}
        {activeTab === 'trades' && (
          <TradesTab key="trades" league={league} trades={trades} userProfile={userProfile} />
        )}
        {activeTab === 'chat' && (
          <ChatTab key="chat" league={league} messages={messages} userProfile={userProfile} />
        )}
        {activeTab === 'settings' && isCommissioner && (
          <SettingsTab key="settings" league={league} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default LeagueDetailView;
