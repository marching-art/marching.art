// src/components/Staff/StaffAuctions.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Gavel, DollarSign, Award, Clock, X,
  User, TrendingUp, RefreshCw
} from 'lucide-react';
import { useAuth } from '../../App';
import { getActiveAuctions, bidOnStaff, completeAuction, cancelAuction } from '../../firebase/functions';
import { useDashboardData } from '../../hooks/useDashboardData';
import { CAPTION_OPTIONS, getCaptionColor, getCaptionLabel } from '../../utils/captionUtils';
import toast from 'react-hot-toast';
import Portal from '../Portal';
import { SystemLoader, ConsoleEmptyState } from '../ui/CommandConsole';

const StaffAuctions = () => {
  const { user } = useAuth();
  const { profile } = useDashboardData();
  const corpsCoin = profile?.corpsCoin || 0;

  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [captionFilter, setCaptionFilter] = useState('all');
  const [selectedAuction, setSelectedAuction] = useState(null);
  const [bidAmount, setBidAmount] = useState('');
  const [bidding, setBidding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAuctions = useCallback(async () => {
    try {
      const result = await getActiveAuctions({
        caption: captionFilter === 'all' ? null : captionFilter
      });
      if (result.data.success) {
        setAuctions(result.data.auctions);
      }
    } catch (error) {
      console.error('Error fetching auctions:', error);
      toast.error('Failed to load auctions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [captionFilter]);

  useEffect(() => {
    setLoading(true);
    fetchAuctions();
  }, [fetchAuctions]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAuctions();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchAuctions]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAuctions();
  };

  const handleBid = async () => {
    if (!selectedAuction || !bidAmount) return;

    const amount = parseInt(bidAmount, 10);
    const minBid = selectedAuction.currentBid
      ? selectedAuction.currentBid + 10
      : selectedAuction.startingPrice;

    if (amount < minBid) {
      toast.error(`Minimum bid is ${minBid} CorpsCoin`);
      return;
    }

    if (amount > corpsCoin) {
      toast.error(`Insufficient CorpsCoin. You have ${corpsCoin}`);
      return;
    }

    setBidding(true);
    try {
      const result = await bidOnStaff({
        auctionId: selectedAuction.id,
        bidAmount: amount
      });
      if (result.data.success) {
        toast.success(result.data.message);
        setSelectedAuction(null);
        setBidAmount('');
        fetchAuctions();
      }
    } catch (error) {
      console.error('Error placing bid:', error);
      toast.error(error.message || 'Failed to place bid');
    } finally {
      setBidding(false);
    }
  };

  const handleCompleteAuction = async (auctionId) => {
    try {
      const result = await completeAuction({ auctionId });
      if (result.data.success) {
        toast.success(result.data.message);
        fetchAuctions();
      }
    } catch (error) {
      console.error('Error completing auction:', error);
      toast.error(error.message || 'Failed to complete auction');
    }
  };

  const handleCancelAuction = async (auctionId) => {
    try {
      const result = await cancelAuction({ auctionId });
      if (result.data.success) {
        toast.success(result.data.message);
        fetchAuctions();
      }
    } catch (error) {
      console.error('Error cancelling auction:', error);
      toast.error(error.message || 'Failed to cancel auction');
    }
  };

  const getTimeRemaining = (endsAt) => {
    if (!endsAt) return 'Unknown';
    const end = endsAt.toDate ? endsAt.toDate() : new Date(endsAt);
    const now = new Date();
    const diff = end - now;

    if (diff <= 0) return 'Ended';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const isMyAuction = (auction) => auction.sellerId === user?.uid;
  const isHighestBidder = (auction) => auction.currentBidderId === user?.uid;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-display font-bold text-gradient mb-2">
              Staff Auctions
            </h1>
            <p className="text-cream-300">
              Bid on staff members from other players
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="btn-ghost p-2"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <div className="flex items-center gap-2 px-4 py-2 bg-gold-500/20 border border-gold-500/30 rounded-lg">
              <DollarSign className="w-5 h-5 text-gold-400" />
              <span className="text-gold-400 font-bold">{corpsCoin.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Caption Filter Pills */}
        <div className="flex flex-wrap gap-2">
          {CAPTION_OPTIONS.map(option => (
            <button
              key={option.value}
              onClick={() => setCaptionFilter(option.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                captionFilter === option.value
                  ? option.value === 'all'
                    ? 'bg-gold-500 text-charcoal-900'
                    : `${option.color} text-white`
                  : 'bg-charcoal-700 text-cream-300 hover:bg-charcoal-600'
              }`}
            >
              {option.value === 'all' ? option.label : option.value}
            </button>
          ))}
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between px-2">
        <p className="text-cream-400 text-sm">
          {loading ? 'Loading...' : (
            <>
              <span className="text-cream-100 font-medium">{auctions.length}</span> active auction{auctions.length !== 1 ? 's' : ''}
              {captionFilter !== 'all' && (
                <span> in <span className="font-medium">{getCaptionLabel(captionFilter)}</span></span>
              )}
            </>
          )}
        </p>
        {captionFilter !== 'all' && (
          <button
            onClick={() => setCaptionFilter('all')}
            className="text-sm text-gold-400 hover:text-gold-300 flex items-center gap-1"
          >
            <X className="w-4 h-4" />
            Clear filter
          </button>
        )}
      </div>

      {/* Auctions List */}
      {loading ? (
        <div className="py-12">
          <SystemLoader
            messages={[
              'SCANNING AUCTION FEEDS...',
              'RETRIEVING BID DATA...',
              'SYNCHRONIZING MARKET...',
            ]}
            showProgress={true}
          />
        </div>
      ) : auctions.length === 0 ? (
        <ConsoleEmptyState
          variant="radar"
          title="NO ACTIVE AUCTIONS"
          subtitle="Scanning frequencies... no active bids detected. List your own staff to initiate."
          actionLabel="List Staff"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {auctions.map((auction) => (
            <AuctionCard
              key={auction.id}
              auction={auction}
              onClick={() => setSelectedAuction(auction)}
              getTimeRemaining={getTimeRemaining}
              isMyAuction={isMyAuction(auction)}
              isHighestBidder={isHighestBidder(auction)}
            />
          ))}
        </div>
      )}

      {/* Auction Detail Modal */}
      <AnimatePresence>
        {selectedAuction && (
          <Portal>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-charcoal-800 border border-charcoal-700 rounded-xl p-6 w-full max-w-lg"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-cream-100">Auction Details</h3>
                  <button
                    onClick={() => {
                      setSelectedAuction(null);
                      setBidAmount('');
                    }}
                    className="p-2 text-cream-300 hover:text-cream-100 hover:bg-charcoal-700 rounded transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Staff Info */}
                  <div className="flex items-start gap-4 p-4 bg-charcoal-900/50 rounded-lg">
                    <div className={`w-12 h-12 ${getCaptionColor(selectedAuction.staffCaption)}/20 rounded-lg flex items-center justify-center flex-shrink-0`}>
                      <Award className={`w-6 h-6 ${getCaptionColor(selectedAuction.staffCaption).replace('bg-', 'text-')}`} />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-cream-100 mb-1">{selectedAuction.staffName}</h4>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold text-white ${getCaptionColor(selectedAuction.staffCaption)}`}>
                          {selectedAuction.staffCaption}
                        </span>
                        <span className="text-xs text-cream-400">
                          Value: {selectedAuction.staffValue}
                        </span>
                      </div>
                      <p className="text-sm text-cream-400">
                        Seller: {selectedAuction.sellerUsername}
                      </p>
                    </div>
                  </div>

                  {/* Auction Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-charcoal-900/50 rounded-lg">
                      <p className="text-cream-400 text-sm mb-1">Starting Price</p>
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4 text-cream-400" />
                        <span className="text-xl font-bold text-cream-100">{selectedAuction.startingPrice}</span>
                      </div>
                    </div>

                    <div className="p-4 bg-charcoal-900/50 rounded-lg">
                      <p className="text-cream-400 text-sm mb-1">Current Bid</p>
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4 text-green-400" />
                        <span className="text-xl font-bold text-green-400">
                          {selectedAuction.currentBid || 'No bids'}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 bg-charcoal-900/50 rounded-lg">
                      <p className="text-cream-400 text-sm mb-1">Time Remaining</p>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4 text-orange-400" />
                        <span className="text-xl font-bold text-orange-400">
                          {getTimeRemaining(selectedAuction.endsAt)}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 bg-charcoal-900/50 rounded-lg">
                      <p className="text-cream-400 text-sm mb-1">Total Bids</p>
                      <div className="flex items-center gap-1">
                        <TrendingUp className="w-4 h-4 text-blue-400" />
                        <span className="text-xl font-bold text-blue-400">
                          {selectedAuction.bidHistory?.length || 0}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Highest Bidder */}
                  {selectedAuction.currentBidderName && (
                    <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                      <div className="flex items-center gap-2">
                        <User className="w-5 h-5 text-green-400" />
                        <span className="text-green-400 text-sm">
                          Highest bidder: <span className="font-semibold">{selectedAuction.currentBidderName}</span>
                          {isHighestBidder(selectedAuction) && ' (You!)'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Action Section */}
                  {isMyAuction(selectedAuction) ? (
                    <div className="space-y-3">
                      {getTimeRemaining(selectedAuction.endsAt) === 'Ended' ? (
                        <button
                          onClick={() => handleCompleteAuction(selectedAuction.id)}
                          className="w-full btn-primary"
                        >
                          Complete Auction
                        </button>
                      ) : !selectedAuction.currentBid ? (
                        <button
                          onClick={() => handleCancelAuction(selectedAuction.id)}
                          className="w-full btn-outline text-red-400 border-red-500/30 hover:bg-red-500/10"
                        >
                          Cancel Auction
                        </button>
                      ) : (
                        <p className="text-sm text-cream-400 text-center">
                          Cannot cancel - auction has bids
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm text-cream-400 mb-2 block">
                          Your Bid (min: {selectedAuction.currentBid ? selectedAuction.currentBid + 10 : selectedAuction.startingPrice})
                        </label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cream-400" />
                          <input
                            type="number"
                            value={bidAmount}
                            onChange={(e) => setBidAmount(e.target.value)}
                            placeholder="Enter bid amount"
                            className="w-full pl-10 pr-4 py-2 bg-charcoal-800 border border-charcoal-700 rounded-lg text-cream-100 focus:outline-none focus:border-gold-500"
                            min={selectedAuction.currentBid ? selectedAuction.currentBid + 10 : selectedAuction.startingPrice}
                          />
                        </div>
                      </div>
                      <button
                        onClick={handleBid}
                        disabled={bidding || !bidAmount || getTimeRemaining(selectedAuction.endsAt) === 'Ended'}
                        className="w-full btn-primary disabled:opacity-50"
                      >
                        {bidding ? 'Placing Bid...' : 'Place Bid'}
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-6">
                  <button
                    onClick={() => {
                      setSelectedAuction(null);
                      setBidAmount('');
                    }}
                    className="w-full btn-ghost"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </div>
          </Portal>
        )}
      </AnimatePresence>
    </div>
  );
};

// Auction Card Component
const AuctionCard = ({ auction, onClick, getTimeRemaining, isMyAuction, isHighestBidder }) => {
  const timeRemaining = getTimeRemaining(auction.endsAt);
  const isEnded = timeRemaining === 'Ended';
  const captionColor = getCaptionColor(auction.staffCaption);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className={`glass rounded-xl p-4 cursor-pointer transition-all ${
        isEnded ? 'opacity-60' : 'hover:border-gold-500/50'
      } ${isMyAuction ? 'border-purple-500/30' : ''} ${isHighestBidder ? 'border-green-500/30' : ''}`}
    >
      {/* Status Badge */}
      {(isMyAuction || isHighestBidder) && (
        <div className="flex gap-2 mb-3">
          {isMyAuction && (
            <span className="text-xs px-2 py-1 bg-purple-500/20 text-purple-400 rounded font-semibold">
              Your Auction
            </span>
          )}
          {isHighestBidder && !isMyAuction && (
            <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded font-semibold">
              Highest Bidder
            </span>
          )}
        </div>
      )}

      <div className="flex items-start gap-3 mb-3">
        <div className={`w-10 h-10 ${captionColor}/20 rounded-lg flex items-center justify-center flex-shrink-0`}>
          <Award className={`w-5 h-5 ${captionColor.replace('bg-', 'text-')}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-cream-100 mb-1 truncate text-base">{auction.staffName}</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold text-white ${captionColor}`}>
              {auction.staffCaption}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm mb-2">
        <div className="flex items-center gap-1 text-cream-400">
          <Clock className="w-4 h-4" />
          <span className={isEnded ? 'text-red-400' : timeRemaining.includes('m') && !timeRemaining.includes('h') ? 'text-orange-400' : ''}>
            {timeRemaining}
          </span>
        </div>
        <div className="flex items-center gap-1 text-gold-400">
          <DollarSign className="w-4 h-4" />
          <span className="font-bold">{auction.currentBid || auction.startingPrice}</span>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-cream-500">
        <span>{auction.bidHistory?.length || 0} bids</span>
        <span>by {auction.sellerUsername}</span>
      </div>
    </motion.div>
  );
};

export default StaffAuctions;
