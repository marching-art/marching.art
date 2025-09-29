import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebaseConfig';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { 
  Palette, 
  Shirt,
  Save,
  RefreshCw,
  Lock,
  Sparkles,
  Eye,
  Package,
  Award,
  Star,
  Info
} from 'lucide-react';

const UniformBuilder = ({ userProfile }) => {
  const { currentUser } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [activeSection, setActiveSection] = useState('jacket');
  const [viewMode, setViewMode] = useState('3d');

  // User stats
  const userXP = userProfile?.xp || 0;
  const userCorpsCoin = userProfile?.corpsCoin || 0;

  // Unlock requirements for premium features
  const unlockRequirements = {
    gauntlets: { xp: 500, corpsCoin: 50 },
    epaulets: { xp: 750, corpsCoin: 100 },
    overlay: { xp: 1000, corpsCoin: 150 },
    sash: { xp: 1500, corpsCoin: 220 },
    capelets: { xp: 2500, corpsCoin: 400 },
    ledLighting: { xp: 5000, corpsCoin: 1000 }
  };

  // Comprehensive uniform state
  const [uniform, setUniform] = useState({
    jacket: {
      baseColor: '#8B4513',
      trim1Color: '#F7941D',
      trim2Color: '#FFD700',
      buttonColor: '#C0C0C0',
      shoulderStyle: 'classic',
      collarStyle: 'standard',
      frontStyle: 'doubleBreasted',
    },
    pants: {
      baseColor: '#000000',
      stripeColor: '#F7941D',
      stripeWidth: 'medium',
      stripeStyle: 'single',
    },
    shako: {
      baseColor: '#8B4513',
      plumeColor: '#FFFFFF',
      plumeStyle: 'standard',
      badgeColor: '#F7941D',
      chinStrapColor: '#000000',
    },
    accessories: {
      gauntlets: { enabled: false, color: '#FFFFFF' },
      epaulets: { enabled: false, color: '#F7941D', fringe: true },
      sash: { enabled: false, color: '#DC143C', style: 'diagonal' },
      capelets: { enabled: false, color: '#8B4513' },
    },
    lighting: {
      enabled: false,
      color: '#FFFFFF',
      mode: 'static',
    },
  });

  // Load user's saved uniform
  useEffect(() => {
    if (userProfile?.uniform) {
      setUniform(userProfile.uniform);
    }
  }, [userProfile]);

  // Check if feature is unlocked
  const isUnlocked = (featureKey) => {
    if (!unlockRequirements[featureKey]) return true; // Base features always unlocked
    const req = unlockRequirements[featureKey];
    return userXP >= req.xp;
  };

  const canPurchaseWithCoin = (featureKey) => {
    if (!unlockRequirements[featureKey]) return false;
    const req = unlockRequirements[featureKey];
    return userCorpsCoin >= req.corpsCoin;
  };

  const purchaseFeature = async (featureKey) => {
    try {
      const req = unlockRequirements[featureKey];
      const purchaseUniformFeature = httpsCallable(functions, 'uniforms-purchaseFeature');
      const result = await purchaseUniformFeature({ 
        feature: featureKey,
        cost: req.corpsCoin 
      });
      
      if (result.data.success) {
        toast.success(`Unlocked ${featureKey}! 🎨`);
        // Refresh user profile
      } else {
        toast.error(result.data.message || 'Purchase failed');
      }
    } catch (error) {
      console.error('Purchase error:', error);
      toast.error('Failed to purchase feature');
    }
  };

  const updateUniformSection = (section, key, value) => {
    setUniform(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }));
  };

  const toggleAccessory = (accessory) => {
    if (!isUnlocked(accessory) && !canPurchaseWithCoin(accessory)) {
      const req = unlockRequirements[accessory];
      toast.error(`Requires ${req.xp} XP or ${req.corpsCoin} CorpsCoin`);
      return;
    }

    setUniform(prev => ({
      ...prev,
      accessories: {
        ...prev.accessories,
        [accessory]: {
          ...prev.accessories[accessory],
          enabled: !prev.accessories[accessory]?.enabled
        }
      }
    }));
  };

  const saveUniform = async () => {
    setIsSaving(true);
    
    try {
      const updateUniform = httpsCallable(functions, 'uniforms-updateUniform');
      const result = await updateUniform({ uniform });
      
      if (result.data.success) {
        toast.success('Uniform saved successfully! 🎨');
      } else {
        toast.error(result.data.message || 'Failed to save uniform');
      }
    } catch (error) {
      console.error('Error saving uniform:', error);
      toast.error('Failed to save uniform');
    } finally {
      setIsSaving(false);
    }
  };

  const resetToDefault = () => {
    if (window.confirm('Reset uniform to default? This cannot be undone.')) {
      setUniform({
        jacket: {
          baseColor: '#8B4513',
          trim1Color: '#F7941D',
          trim2Color: '#FFD700',
          buttonColor: '#C0C0C0',
          shoulderStyle: 'classic',
          collarStyle: 'standard',
          frontStyle: 'doubleBreasted',
        },
        pants: {
          baseColor: '#000000',
          stripeColor: '#F7941D',
          stripeWidth: 'medium',
          stripeStyle: 'single',
        },
        shako: {
          baseColor: '#8B4513',
          plumeColor: '#FFFFFF',
          plumeStyle: 'standard',
          badgeColor: '#F7941D',
          chinStrapColor: '#000000',
        },
        accessories: {
          gauntlets: { enabled: false, color: '#FFFFFF' },
          epaulets: { enabled: false, color: '#F7941D', fringe: true },
          sash: { enabled: false, color: '#DC143C', style: 'diagonal' },
          capelets: { enabled: false, color: '#8B4513' },
        },
        lighting: {
          enabled: false,
          color: '#FFFFFF',
          mode: 'static',
        },
      });
      toast.success('Uniform reset to default');
    }
  };

  // Feature card component for premium features
  const FeatureCard = ({ featureKey, title, description, premium = false, children }) => {
    const locked = premium && !isUnlocked(featureKey);
    const canPurchase = premium && canPurchaseWithCoin(featureKey);
    const req = unlockRequirements[featureKey];

    return (
      <div className={`bg-background dark:bg-background-dark p-4 rounded-theme border ${
        locked ? 'border-yellow-600 opacity-75' : 'border-accent dark:border-accent-dark'
      }`}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-text-primary dark:text-text-primary-dark">{title}</h4>
              {premium && locked && <Lock className="w-4 h-4 text-yellow-500" />}
              {premium && !locked && <Sparkles className="w-4 h-4 text-yellow-500" />}
            </div>
            <p className="text-xs text-text-secondary dark:text-text-secondary-dark">{description}</p>
          </div>
        </div>

        {locked ? (
          <div className="space-y-2">
            <div className="text-xs text-text-secondary dark:text-text-secondary-dark">
              Unlock at {req.xp} XP (currently {userXP})
            </div>
            {canPurchase && (
              <button
                onClick={() => purchaseFeature(featureKey)}
                className="w-full bg-secondary hover:bg-opacity-80 dark:bg-secondary-dark text-white py-2 px-3 rounded text-sm font-medium transition-colors"
              >
                Unlock with {req.corpsCoin} CorpsCoin
              </button>
            )}
          </div>
        ) : (
          children
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-1">Uniform Designer</h2>
          <p className="text-text-secondary dark:text-text-secondary-dark">
            Create a unique look for your corps
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right text-sm">
            <div className="text-text-secondary dark:text-text-secondary-dark">XP: {userXP}</div>
            <div className="text-text-secondary dark:text-text-secondary-dark">CorpsCoin: {userCorpsCoin}</div>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-purple-900 bg-opacity-30 border border-purple-400 rounded-theme p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold mb-1 text-text-primary dark:text-text-primary-dark">Premium Features:</p>
            <p className="text-text-secondary dark:text-text-secondary-dark">
              Unlock advanced customization options by earning XP through gameplay or purchasing with CorpsCoin. 
              Your uniform design is displayed on leaderboards and in competitions!
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Preview */}
        <div className="space-y-4">
          <div className="bg-surface dark:bg-surface-dark rounded-theme p-6 aspect-square flex items-center justify-center border border-accent dark:border-accent-dark">
            {/* SVG Uniform Preview */}
            <svg viewBox="0 0 300 500" className="w-full h-full">
              <defs>
                <linearGradient id="jacketGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={uniform.jacket.baseColor} stopOpacity="1" />
                  <stop offset="50%" stopColor={uniform.jacket.baseColor} stopOpacity="0.9" />
                  <stop offset="100%" stopColor={uniform.jacket.baseColor} stopOpacity="0.7" />
                </linearGradient>
                <filter id="shadow">
                  <feDropShadow dx="2" dy="4" stdDeviation="3" floodOpacity="0.3"/>
                </filter>
              </defs>

              {/* Pants */}
              <g id="pants">
                <path
                  d="M100 280 L100 480 L130 480 L130 280 Z"
                  fill={uniform.pants.baseColor}
                  filter="url(#shadow)"
                />
                <path
                  d="M170 280 L170 480 L200 480 L200 280 Z"
                  fill={uniform.pants.baseColor}
                  filter="url(#shadow)"
                />
                {/* Stripe */}
                {uniform.pants.stripeStyle !== 'none' && (
                  <>
                    <rect x="125" y="280" width="5" height="200" fill={uniform.pants.stripeColor} />
                    <rect x="170" y="280" width="5" height="200" fill={uniform.pants.stripeColor} />
                  </>
                )}
              </g>

              {/* Jacket Body */}
              <g id="jacket">
                <path
                  d="M80 100 L80 280 Q80 290 90 290 L210 290 Q220 290 220 280 L220 100 Q220 80 210 80 L90 80 Q80 80 80 100"
                  fill="url(#jacketGradient)"
                  stroke={uniform.jacket.trim1Color}
                  strokeWidth="3"
                  filter="url(#shadow)"
                />
                
                {/* Front Closure */}
                <line x1="150" y1="100" x2="150" y2="280" stroke={uniform.jacket.trim2Color} strokeWidth="4" />
                
                {/* Buttons */}
                {[120, 150, 180, 210, 240].map((y, i) => (
                  <circle key={i} cx="150" cy={y} r="5" fill={uniform.jacket.buttonColor} />
                ))}
                
                {/* Collar */}
                <path
                  d="M120 80 L120 60 Q120 40 140 40 L160 40 Q180 40 180 60 L180 80"
                  fill={uniform.jacket.trim1Color}
                  stroke={uniform.jacket.trim2Color}
                  strokeWidth="2"
                />
              </g>

              {/* Epaulets (if enabled) */}
              {uniform.accessories.epaulets?.enabled && (
                <g id="epaulets">
                  <rect x="80" y="80" width="40" height="25" rx="3" 
                    fill={uniform.accessories.epaulets.color} 
                    stroke={uniform.jacket.trim2Color} strokeWidth="1"
                  />
                  <rect x="180" y="80" width="40" height="25" rx="3" 
                    fill={uniform.accessories.epaulets.color} 
                    stroke={uniform.jacket.trim2Color} strokeWidth="1"
                  />
                  {uniform.accessories.epaulets.fringe && (
                    <>
                      {[...Array(8)].map((_, i) => (
                        <line key={i} x1={85 + i * 5} y1="105" x2={85 + i * 5} y2="115" 
                          stroke={uniform.jacket.trim2Color} strokeWidth="1" />
                      ))}
                      {[...Array(8)].map((_, i) => (
                        <line key={i} x1={185 + i * 5} y1="105" x2={185 + i * 5} y2="115" 
                          stroke={uniform.jacket.trim2Color} strokeWidth="1" />
                      ))}
                    </>
                  )}
                </g>
              )}

              {/* Sash (if enabled) */}
              {uniform.accessories.sash?.enabled && (
                <path
                  d="M80 150 L220 220"
                  stroke={uniform.accessories.sash.color}
                  strokeWidth="15"
                  opacity="0.8"
                />
              )}

              {/* Gauntlets (if enabled) */}
              {uniform.accessories.gauntlets?.enabled && (
                <g id="gauntlets">
                  <rect x="70" y="270" width="30" height="15" rx="2" 
                    fill={uniform.accessories.gauntlets.color} 
                    stroke={uniform.jacket.trim1Color} strokeWidth="1"
                  />
                  <rect x="200" y="270" width="30" height="15" rx="2" 
                    fill={uniform.accessories.gauntlets.color} 
                    stroke={uniform.jacket.trim1Color} strokeWidth="1"
                  />
                </g>
              )}

              {/* Capelets (if enabled) */}
              {uniform.accessories.capelets?.enabled && (
                <g id="capelets">
                  <path
                    d="M80 100 Q70 120 80 140 L80 100"
                    fill={uniform.accessories.capelets.color}
                    opacity="0.7"
                  />
                  <path
                    d="M220 100 Q230 120 220 140 L220 100"
                    fill={uniform.accessories.capelets.color}
                    opacity="0.7"
                  />
                </g>
              )}

              {/* Shako */}
              <g id="shako">
                <ellipse cx="150" cy="35" rx="30" ry="10" 
                  fill={uniform.shako.baseColor}
                  stroke={uniform.shako.badgeColor} strokeWidth="2"
                />
                <rect x="120" y="20" width="60" height="20" rx="5"
                  fill={uniform.shako.baseColor}
                  stroke={uniform.shako.badgeColor} strokeWidth="2"
                />
                {/* Plume */}
                <path
                  d="M150 20 Q145 5 150 0 Q155 5 150 20"
                  fill={uniform.shako.plumeColor}
                  opacity="0.8"
                />
                {/* Badge */}
                <circle cx="150" cy="30" r="8" fill={uniform.shako.badgeColor} />
              </g>

              {/* LED Indicators (if enabled) */}
              {uniform.lighting?.enabled && (
                <g id="led-lights">
                  {[100, 140, 180, 220, 260].map((y, i) => (
                    <circle key={i} cx="85" cy={y} r="3" fill={uniform.lighting.color} opacity="0.8">
                      <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" repeatCount="indefinite" />
                    </circle>
                  ))}
                  {[100, 140, 180, 220, 260].map((y, i) => (
                    <circle key={i} cx="215" cy={y} r="3" fill={uniform.lighting.color} opacity="0.8">
                      <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" repeatCount="indefinite" begin="1s" />
                    </circle>
                  ))}
                </g>
              )}

              {/* Corps Name */}
              <text x="150" y="310" textAnchor="middle" fill="#FFFFFF" fontSize="16" fontWeight="bold">
                {userProfile?.corps?.corpsName || 'Corps Name'}
              </text>
            </svg>
          </div>

          {/* View Mode Selector */}
          <div className="grid grid-cols-3 gap-2">
            {['3d', 'flat', 'technical'].map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-2 rounded text-sm font-medium capitalize transition-colors ${
                  viewMode === mode
                    ? 'bg-primary dark:bg-primary-dark text-white'
                    : 'bg-background dark:bg-background-dark text-text-secondary dark:text-text-secondary-dark hover:bg-accent dark:hover:bg-accent-dark'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="space-y-2">
            <button
              onClick={saveUniform}
              disabled={isSaving}
              className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-3 rounded-theme font-bold transition-colors disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save Uniform
                </>
              )}
            </button>
            <button
              onClick={resetToDefault}
              className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white py-2 rounded-theme font-medium transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Reset to Default
            </button>
          </div>
        </div>

        {/* Right Panel - Design Controls */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section Tabs */}
          <div className="bg-surface dark:bg-surface-dark rounded-theme p-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { id: 'jacket', label: 'Jacket', icon: Shirt },
                { id: 'pants', label: 'Pants', icon: Package },
                { id: 'shako', label: 'Shako', icon: Award },
                { id: 'accessories', label: 'Accessories', icon: Star },
              ].map(section => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-theme font-medium transition-colors ${
                      activeSection === section.id
                        ? 'bg-primary dark:bg-primary-dark text-white'
                        : 'bg-background dark:bg-background-dark text-text-secondary dark:text-text-secondary-dark hover:bg-accent dark:hover:bg-accent-dark'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{section.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section Content */}
          <div className="bg-surface dark:bg-surface-dark rounded-theme p-6">
            {activeSection === 'jacket' && (
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-4">Jacket Design</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                      Base Color
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={uniform.jacket.baseColor}
                        onChange={(e) => updateUniformSection('jacket', 'baseColor', e.target.value)}
                        className="w-16 h-10 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={uniform.jacket.baseColor}
                        onChange={(e) => updateUniformSection('jacket', 'baseColor', e.target.value)}
                        className="flex-1 px-3 py-2 bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded text-text-primary dark:text-text-primary-dark"
                        placeholder="#8B4513"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                      Trim 1 Color
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={uniform.jacket.trim1Color}
                        onChange={(e) => updateUniformSection('jacket', 'trim1Color', e.target.value)}
                        className="w-16 h-10 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={uniform.jacket.trim1Color}
                        onChange={(e) => updateUniformSection('jacket', 'trim1Color', e.target.value)}
                        className="flex-1 px-3 py-2 bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded text-text-primary dark:text-text-primary-dark"
                        placeholder="#F7941D"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                      Trim 2 Color
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={uniform.jacket.trim2Color}
                        onChange={(e) => updateUniformSection('jacket', 'trim2Color', e.target.value)}
                        className="w-16 h-10 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={uniform.jacket.trim2Color}
                        onChange={(e) => updateUniformSection('jacket', 'trim2Color', e.target.value)}
                        className="flex-1 px-3 py-2 bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded text-text-primary dark:text-text-primary-dark"
                        placeholder="#FFD700"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                      Button Color
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={uniform.jacket.buttonColor}
                        onChange={(e) => updateUniformSection('jacket', 'buttonColor', e.target.value)}
                        className="w-16 h-10 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={uniform.jacket.buttonColor}
                        onChange={(e) => updateUniformSection('jacket', 'buttonColor', e.target.value)}
                        className="flex-1 px-3 py-2 bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded text-text-primary dark:text-text-primary-dark"
                        placeholder="#C0C0C0"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                    Front Style
                  </label>
                  <select
                    value={uniform.jacket.frontStyle}
                    onChange={(e) => updateUniformSection('jacket', 'frontStyle', e.target.value)}
                    className="w-full px-3 py-2 bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded text-text-primary dark:text-text-primary-dark"
                  >
                    <option value="doubleBreasted">Double Breasted</option>
                    <option value="singleBreasted">Single Breasted</option>
                    <option value="asymmetric">Asymmetric</option>
                    <option value="zippered">Zippered</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                      Collar Style
                    </label>
                    <select
                      value={uniform.jacket.collarStyle}
                      onChange={(e) => updateUniformSection('jacket', 'collarStyle', e.target.value)}
                      className="w-full px-3 py-2 bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded text-text-primary dark:text-text-primary-dark"
                    >
                      <option value="standard">Standard</option>
                      <option value="military">Military</option>
                      <option value="mandarin">Mandarin</option>
                      <option value="notched">Notched</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                      Shoulder Style
                    </label>
                    <select
                      value={uniform.jacket.shoulderStyle}
                      onChange={(e) => updateUniformSection('jacket', 'shoulderStyle', e.target.value)}
                      className="w-full px-3 py-2 bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded text-text-primary dark:text-text-primary-dark"
                    >
                      <option value="classic">Classic</option>
                      <option value="padded">Padded</option>
                      <option value="raglan">Raglan</option>
                      <option value="dropped">Dropped</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'pants' && (
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-4">Pants Design</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                      Base Color
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={uniform.pants.baseColor}
                        onChange={(e) => updateUniformSection('pants', 'baseColor', e.target.value)}
                        className="w-16 h-10 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={uniform.pants.baseColor}
                        onChange={(e) => updateUniformSection('pants', 'baseColor', e.target.value)}
                        className="flex-1 px-3 py-2 bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded text-text-primary dark:text-text-primary-dark"
                        placeholder="#000000"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                      Stripe Color
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={uniform.pants.stripeColor}
                        onChange={(e) => updateUniformSection('pants', 'stripeColor', e.target.value)}
                        className="w-16 h-10 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={uniform.pants.stripeColor}
                        onChange={(e) => updateUniformSection('pants', 'stripeColor', e.target.value)}
                        className="flex-1 px-3 py-2 bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded text-text-primary dark:text-text-primary-dark"
                        placeholder="#F7941D"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                      Stripe Style
                    </label>
                    <select
                      value={uniform.pants.stripeStyle}
                      onChange={(e) => updateUniformSection('pants', 'stripeStyle', e.target.value)}
                      className="w-full px-3 py-2 bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded text-text-primary dark:text-text-primary-dark"
                    >
                      <option value="single">Single Stripe</option>
                      <option value="double">Double Stripe</option>
                      <option value="none">No Stripe</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                      Stripe Width
                    </label>
                    <select
                      value={uniform.pants.stripeWidth}
                      onChange={(e) => updateUniformSection('pants', 'stripeWidth', e.target.value)}
                      className="w-full px-3 py-2 bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded text-text-primary dark:text-text-primary-dark"
                    >
                      <option value="thin">Thin</option>
                      <option value="medium">Medium</option>
                      <option value="wide">Wide</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'shako' && (
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-4">Shako Design</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                      Base Color
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={uniform.shako.baseColor}
                        onChange={(e) => updateUniformSection('shako', 'baseColor', e.target.value)}
                        className="w-16 h-10 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={uniform.shako.baseColor}
                        onChange={(e) => updateUniformSection('shako', 'baseColor', e.target.value)}
                        className="flex-1 px-3 py-2 bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded text-text-primary dark:text-text-primary-dark"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                      Plume Color
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={uniform.shako.plumeColor}
                        onChange={(e) => updateUniformSection('shako', 'plumeColor', e.target.value)}
                        className="w-16 h-10 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={uniform.shako.plumeColor}
                        onChange={(e) => updateUniformSection('shako', 'plumeColor', e.target.value)}
                        className="flex-1 px-3 py-2 bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded text-text-primary dark:text-text-primary-dark"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                      Badge Color
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={uniform.shako.badgeColor}
                        onChange={(e) => updateUniformSection('shako', 'badgeColor', e.target.value)}
                        className="w-16 h-10 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={uniform.shako.badgeColor}
                        onChange={(e) => updateUniformSection('shako', 'badgeColor', e.target.value)}
                        className="flex-1 px-3 py-2 bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded text-text-primary dark:text-text-primary-dark"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                      Plume Style
                    </label>
                    <select
                      value={uniform.shako.plumeStyle}
                      onChange={(e) => updateUniformSection('shako', 'plumeStyle', e.target.value)}
                      className="w-full px-3 py-2 bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded text-text-primary dark:text-text-primary-dark"
                    >
                      <option value="standard">Standard</option>
                      <option value="tall">Tall</option>
                      <option value="short">Short</option>
                      <option value="none">None</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'accessories' && (
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-4">Accessories & Embellishments</h3>
                
                <FeatureCard
                  featureKey="gauntlets"
                  title="Gauntlets"
                  description="Classic white glove extensions"
                  premium={true}
                >
                  <div className="space-y-3">
                    <button
                      onClick={() => toggleAccessory('gauntlets')}
                      className={`w-full py-2 px-4 rounded font-medium transition-colors ${
                        uniform.accessories.gauntlets?.enabled
                          ? 'bg-green-600 text-white'
                          : 'bg-background dark:bg-background-dark text-text-secondary dark:text-text-secondary-dark'
                      }`}
                    >
                      {uniform.accessories.gauntlets?.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                    {uniform.accessories.gauntlets?.enabled && (
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-text-secondary dark:text-text-secondary-dark">Color:</label>
                        <input
                          type="color"
                          value={uniform.accessories.gauntlets?.color || '#FFFFFF'}
                          onChange={(e) => setUniform(prev => ({
                            ...prev,
                            accessories: {
                              ...prev.accessories,
                              gauntlets: {
                                ...prev.accessories.gauntlets,
                                color: e.target.value
                              }
                            }
                          }))}
                          className="w-12 h-12 rounded cursor-pointer"
                        />
                      </div>
                    )}
                  </div>
                </FeatureCard>

                <FeatureCard
                  featureKey="epaulets"
                  title="Epaulets"
                  description="Shoulder decorations with optional fringe"
                  premium={true}
                >
                  <div className="space-y-3">
                    <button
                      onClick={() => toggleAccessory('epaulets')}
                      className={`w-full py-2 px-4 rounded font-medium transition-colors ${
                        uniform.accessories.epaulets?.enabled
                          ? 'bg-green-600 text-white'
                          : 'bg-background dark:bg-background-dark text-text-secondary dark:text-text-secondary-dark'
                      }`}
                    >
                      {uniform.accessories.epaulets?.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                    {uniform.accessories.epaulets?.enabled && (
                      <>
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-text-secondary dark:text-text-secondary-dark">Color:</label>
                          <input
                            type="color"
                            value={uniform.accessories.epaulets?.color || '#F7941D'}
                            onChange={(e) => setUniform(prev => ({
                              ...prev,
                              accessories: {
                                ...prev.accessories,
                                epaulets: {
                                  ...prev.accessories.epaulets,
                                  color: e.target.value
                                }
                              }
                            }))}
                            className="w-12 h-12 rounded cursor-pointer"
                          />
                        </div>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={uniform.accessories.epaulets?.fringe}
                            onChange={(e) => setUniform(prev => ({
                              ...prev,
                              accessories: {
                                ...prev.accessories,
                                epaulets: {
                                  ...prev.accessories.epaulets,
                                  fringe: e.target.checked
                                }
                              }
                            }))}
                            className="w-4 h-4"
                          />
                          <span className="text-sm text-text-primary dark:text-text-primary-dark">Add fringe</span>
                        </label>
                      </>
                    )}
                  </div>
                </FeatureCard>

                <FeatureCard
                  featureKey="sash"
                  title="Sash"
                  description="Diagonal or horizontal sash accent"
                  premium={true}
                >
                  <div className="space-y-3">
                    <button
                      onClick={() => toggleAccessory('sash')}
                      className={`w-full py-2 px-4 rounded font-medium transition-colors ${
                        uniform.accessories.sash?.enabled
                          ? 'bg-green-600 text-white'
                          : 'bg-background dark:bg-background-dark text-text-secondary dark:text-text-secondary-dark'
                      }`}
                    >
                      {uniform.accessories.sash?.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                    {uniform.accessories.sash?.enabled && (
                      <>
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-text-secondary dark:text-text-secondary-dark">Color:</label>
                          <input
                            type="color"
                            value={uniform.accessories.sash?.color || '#DC143C'}
                            onChange={(e) => setUniform(prev => ({
                              ...prev,
                              accessories: {
                                ...prev.accessories,
                                sash: {
                                  ...prev.accessories.sash,
                                  color: e.target.value
                                }
                              }
                            }))}
                            className="w-12 h-12 rounded cursor-pointer"
                          />
                        </div>
                        <select
                          value={uniform.accessories.sash?.style || 'diagonal'}
                          onChange={(e) => setUniform(prev => ({
                            ...prev,
                            accessories: {
                              ...prev.accessories,
                              sash: {
                                ...prev.accessories.sash,
                                style: e.target.value
                              }
                            }
                          }))}
                          className="w-full px-3 py-2 bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded text-text-primary dark:text-text-primary-dark"
                        >
                          <option value="diagonal">Diagonal</option>
                          <option value="horizontal">Horizontal</option>
                          <option value="vertical">Vertical</option>
                        </select>
                      </>
                    )}
                  </div>
                </FeatureCard>

                <FeatureCard
                  featureKey="capelets"
                  title="Shoulder Capelets"
                  description="Dramatic flowing shoulder pieces"
                  premium={true}
                >
                  <div className="space-y-3">
                    <button
                      onClick={() => toggleAccessory('capelets')}
                      className={`w-full py-2 px-4 rounded font-medium transition-colors ${
                        uniform.accessories.capelets?.enabled
                          ? 'bg-green-600 text-white'
                          : 'bg-background dark:bg-background-dark text-text-secondary dark:text-text-secondary-dark'
                      }`}
                    >
                      {uniform.accessories.capelets?.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                    {uniform.accessories.capelets?.enabled && (
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-text-secondary dark:text-text-secondary-dark">Color:</label>
                        <input
                          type="color"
                          value={uniform.accessories.capelets?.color || '#8B4513'}
                          onChange={(e) => setUniform(prev => ({
                            ...prev,
                            accessories: {
                              ...prev.accessories,
                              capelets: {
                                ...prev.accessories.capelets,
                                color: e.target.value
                              }
                            }
                          }))}
                          className="w-12 h-12 rounded cursor-pointer"
                        />
                      </div>
                    )}
                  </div>
                </FeatureCard>

                <FeatureCard
                  featureKey="ledLighting"
                  title="LED Lighting"
                  description="Advanced LED accent lighting system"
                  premium={true}
                >
                  <div className="space-y-3">
                    <button
                      onClick={() => setUniform(prev => ({
                        ...prev,
                        lighting: {
                          ...prev.lighting,
                          enabled: !prev.lighting?.enabled
                        }
                      }))}
                      className={`w-full py-2 px-4 rounded font-medium transition-colors ${
                        uniform.lighting?.enabled
                          ? 'bg-green-600 text-white'
                          : 'bg-background dark:bg-background-dark text-text-secondary dark:text-text-secondary-dark'
                      }`}
                    >
                      {uniform.lighting?.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                    {uniform.lighting?.enabled && (
                      <>
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-text-secondary dark:text-text-secondary-dark">Color:</label>
                          <input
                            type="color"
                            value={uniform.lighting?.color || '#FFFFFF'}
                            onChange={(e) => setUniform(prev => ({
                              ...prev,
                              lighting: {
                                ...prev.lighting,
                                color: e.target.value
                              }
                            }))}
                            className="w-12 h-12 rounded cursor-pointer"
                          />
                        </div>
                        <select
                          value={uniform.lighting?.mode || 'static'}
                          onChange={(e) => setUniform(prev => ({
                            ...prev,
                            lighting: {
                              ...prev.lighting,
                              mode: e.target.value
                            }
                          }))}
                          className="w-full px-3 py-2 bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded text-text-primary dark:text-text-primary-dark"
                        >
                          <option value="static">Static</option>
                          <option value="pulse">Pulse</option>
                          <option value="fade">Fade</option>
                        </select>
                      </>
                    )}
                  </div>
                </FeatureCard>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UniformBuilder;