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
  Unlock,
  Sparkles,
  Layers,
  Grid,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Plus,
  Minus,
  Zap,
  Crown,
  Star,
  Award,
  Wand2,
  Gem,
  Package,
  ShoppingCart
} from 'lucide-react';

const UniformBuilder = ({ userProfile }) => {
  const { currentUser } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [activeSection, setActiveSection] = useState('jacket');
  const [viewMode, setViewMode] = useState('3d'); // '3d', 'flat', 'technical'
  const [showGrid, setShowGrid] = useState(false);
  const [zoom, setZoom] = useState(100);

  // User stats
  const userXP = userProfile?.xp || 0;
  const userCorpsCoin = userProfile?.corpsCoin || 0;

  // Comprehensive uniform state
  const [uniform, setUniform] = useState({
    // Base Colors (Always Available - Tier 0)
    jacket: {
      baseColor: '#8B4513',
      trim1Color: '#F7941D',
      trim2Color: '#FFD700',
      buttonColor: '#C0C0C0',
      shoulderStyle: 'classic',
      collarStyle: 'standard',
      frontStyle: 'doubleBreasted',
      sleeveStyle: 'standard',
      tailStyle: 'straight',
    },
    pants: {
      baseColor: '#000000',
      stripeColor: '#F7941D',
      stripeWidth: 'medium',
      stripeStyle: 'single',
      style: 'straight',
    },
    overlay: {
      enabled: false, // Requires 1000 XP
      type: 'sash',
      color: '#DC143C',
      pattern: 'solid',
      position: 'diagonal',
    },
    shako: {
      baseColor: '#8B4513',
      plumeColor: '#FFFFFF',
      plumeStyle: 'standard',
      badgeColor: '#F7941D',
      chinStrapColor: '#000000',
    },
    accessories: {
      gauntlets: {
        enabled: false, // Requires 500 XP
        color: '#FFFFFF',
        style: 'standard',
      },
      epaulets: {
        enabled: false, // Requires 750 XP
        color: '#F7941D',
        style: 'fringed',
        fringe: true,
      },
      sash: {
        enabled: false, // Requires 1500 XP
        color: '#DC143C',
        style: 'diagonal',
      },
      capelets: {
        enabled: false, // Requires 2500 XP
        color: '#8B4513',
        style: 'short',
      },
    },
    // Advanced Features
    materials: {
      jacket: {
        fabric: 'wool', // wool, synthetic, premium (3000 XP or 500 CC)
        finish: 'matte', // matte, satin, metallic (2000 XP or 300 CC)
        texture: 'smooth', // smooth, ribbed, quilted (2500 XP or 400 CC)
      },
      pants: {
        fabric: 'wool',
        finish: 'matte',
      },
    },
    embellishments: {
      braiding: {
        enabled: false, // 1800 XP or 250 CC
        color: '#FFD700',
        style: 'military',
        locations: [],
      },
      piping: {
        enabled: false, // 1200 XP or 180 CC
        color: '#F7941D',
        width: 'thin',
        locations: [],
      },
      embroidery: {
        enabled: false, // 3500 XP or 600 CC
        color: '#FFD700',
        pattern: 'geometric',
        locations: [],
      },
      appliques: {
        enabled: false, // 4000 XP or 750 CC
        style: 'custom',
        locations: [],
      },
    },
    patterns: {
      jacketPattern: 'solid', // solid, gradient, geometric, custom
      pantsPattern: 'solid',
      overlayPattern: 'solid',
    },
    lighting: {
      enabled: false, // 5000 XP or 1000 CC - LED integration
      color: '#FFFFFF',
      mode: 'static', // static, pulse, fade
      locations: [],
    },
  });

  // Load user's saved uniform
  useEffect(() => {
    if (userProfile?.uniform) {
      setUniform(prev => ({
        ...prev,
        ...userProfile.uniform
      }));
    }
  }, [userProfile]);

  // Unlock requirements
  const unlockRequirements = {
    gauntlets: { xp: 500, corpsCoin: 50, name: 'Gauntlets' },
    epaulets: { xp: 750, corpsCoin: 100, name: 'Epaulets' },
    overlay: { xp: 1000, corpsCoin: 150, name: 'Overlay/Sash' },
    piping: { xp: 1200, corpsCoin: 180, name: 'Decorative Piping' },
    sash: { xp: 1500, corpsCoin: 220, name: 'Competition Sash' },
    braiding: { xp: 1800, corpsCoin: 250, name: 'Military Braiding' },
    premiumFabric: { xp: 3000, corpsCoin: 500, name: 'Premium Fabrics' },
    metallic: { xp: 2000, corpsCoin: 300, name: 'Metallic Finishes' },
    capelets: { xp: 2500, corpsCoin: 400, name: 'Shoulder Capelets' },
    textureRibbed: { xp: 2500, corpsCoin: 400, name: 'Textured Materials' },
    embroidery: { xp: 3500, corpsCoin: 600, name: 'Custom Embroidery' },
    appliques: { xp: 4000, corpsCoin: 750, name: 'Designer Appliqués' },
    ledLighting: { xp: 5000, corpsCoin: 1000, name: 'LED Integration' },
  };

  const isUnlocked = (feature) => {
    const req = unlockRequirements[feature];
    if (!req) return true;
    return userXP >= req.xp;
  };

  const canPurchaseWithCoin = (feature) => {
    const req = unlockRequirements[feature];
    if (!req) return false;
    return userCorpsCoin >= req.corpsCoin && userXP < req.xp;
  };

  const purchaseWithCoin = async (feature) => {
    const req = unlockRequirements[feature];
    if (!canPurchaseWithCoin(feature)) {
      toast.error('Insufficient CorpsCoin');
      return;
    }

    try {
      const purchaseFeature = httpsCallable(functions, 'uniforms-purchaseFeature');
      const result = await purchaseFeature({ feature, cost: req.corpsCoin });
      
      if (result.data.success) {
        toast.success(`${req.name} unlocked! 🎨`);
        // Refresh user profile to update corpsCoin balance
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
      const updateUniform = httpsCallable(functions, 'users-updateUniform');
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
    if (confirm('Reset uniform to default? This cannot be undone.')) {
      setUniform({
        jacket: {
          baseColor: '#8B4513',
          trim1Color: '#F7941D',
          trim2Color: '#FFD700',
          buttonColor: '#C0C0C0',
          shoulderStyle: 'classic',
          collarStyle: 'standard',
          frontStyle: 'doubleBreasted',
          sleeveStyle: 'standard',
          tailStyle: 'straight',
        },
        pants: {
          baseColor: '#000000',
          stripeColor: '#F7941D',
          stripeWidth: 'medium',
          stripeStyle: 'single',
          style: 'straight',
        },
        overlay: { enabled: false },
        shako: {
          baseColor: '#8B4513',
          plumeColor: '#FFFFFF',
          plumeStyle: 'standard',
          badgeColor: '#F7941D',
          chinStrapColor: '#000000',
        },
        accessories: {
          gauntlets: { enabled: false },
          epaulets: { enabled: false },
          sash: { enabled: false },
          capelets: { enabled: false },
        },
        materials: {
          jacket: { fabric: 'wool', finish: 'matte', texture: 'smooth' },
          pants: { fabric: 'wool', finish: 'matte' },
        },
        embellishments: {
          braiding: { enabled: false },
          piping: { enabled: false },
          embroidery: { enabled: false },
          appliques: { enabled: false },
        },
        patterns: {
          jacketPattern: 'solid',
          pantsPattern: 'solid',
          overlayPattern: 'solid',
        },
        lighting: { enabled: false },
      });
      toast.info('Reset to default uniform');
    }
  };

  // Legendary preset uniforms inspired by real corps
  const legendaryPresets = [
    {
      name: 'Classic Military',
      icon: '🎖️',
      xpRequired: 0,
      colors: { base: '#8B4513', trim: '#F7941D', accent: '#FFD700' },
      description: 'Traditional military-inspired design'
    },
    {
      name: 'Modern Elite',
      icon: '⚡',
      xpRequired: 1000,
      colors: { base: '#000000', trim: '#0000FF', accent: '#FFD700' },
      description: 'Sleek contemporary aesthetic'
    },
    {
      name: 'Championship Gold',
      icon: '👑',
      xpRequired: 2500,
      colors: { base: '#FFD700', trim: '#000000', accent: '#DC143C' },
      description: 'Bold championship winner look'
    },
    {
      name: 'Vanguard Red',
      icon: '🔴',
      xpRequired: 3000,
      colors: { base: '#DC143C', trim: '#000000', accent: '#FFFFFF' },
      description: 'Iconic bold red uniform'
    },
    {
      name: 'Phantom Legion',
      icon: '💀',
      xpRequired: 3500,
      colors: { base: '#8B0000', trim: '#000000', accent: '#FFD700' },
      description: 'Dark and commanding presence'
    },
    {
      name: 'Future Corps',
      icon: '🚀',
      xpRequired: 5000,
      colors: { base: '#4B0082', trim: '#00FFFF', accent: '#FF00FF' },
      description: 'Cutting-edge futuristic design'
    },
  ];

  const FeatureCard = ({ featureKey, title, description, children, premium = false }) => {
    const unlocked = isUnlocked(featureKey);
    const canPurchase = canPurchaseWithCoin(featureKey);
    const req = unlockRequirements[featureKey];

    return (
      <div className={`bg-background-dark rounded-theme p-4 border-2 ${
        unlocked ? 'border-green-500' : 'border-accent-dark'
      }`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {unlocked ? (
              <Unlock className="w-5 h-5 text-green-400" />
            ) : (
              <Lock className="w-5 h-5 text-red-400" />
            )}
            <h4 className="font-bold text-text-primary-dark">{title}</h4>
            {premium && <Crown className="w-4 h-4 text-yellow-400" />}
          </div>
          {!unlocked && req && (
            <div className="flex items-center gap-2">
              <div className="text-xs text-text-secondary-dark">
                {req.xp} XP
              </div>
              {canPurchase && (
                <button
                  onClick={() => purchaseWithCoin(featureKey)}
                  className="flex items-center gap-1 px-2 py-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-xs font-medium transition-colors"
                >
                  <ShoppingCart className="w-3 h-3" />
                  {req.corpsCoin}
                </button>
              )}
            </div>
          )}
        </div>
        <p className="text-xs text-text-secondary-dark mb-3">{description}</p>
        {unlocked ? (
          <div>{children}</div>
        ) : (
          <div className="text-center py-4 bg-surface-dark rounded border border-accent-dark">
            <Lock className="w-8 h-8 mx-auto text-red-400 mb-2" />
            <p className="text-sm text-text-secondary-dark">
              Requires {req?.xp} XP to unlock
            </p>
            {canPurchase && (
              <button
                onClick={() => purchaseWithCoin(featureKey)}
                className="mt-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded font-medium transition-colors"
              >
                Purchase for {req?.corpsCoin} CorpsCoin
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-dark to-purple-600 rounded-theme p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold mb-2 flex items-center gap-2">
              <Shirt className="w-8 h-8" />
              Professional Uniform Designer
            </h2>
            <p className="text-white text-opacity-90">
              Create legendary uniforms with professional-grade design tools
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm opacity-75">Your Resources</div>
            <div className="flex items-center gap-4 mt-1">
              <div className="flex items-center gap-1">
                <Star className="w-5 h-5" />
                <span className="text-2xl font-bold">{userXP.toLocaleString()}</span>
                <span className="text-sm">XP</span>
              </div>
              <div className="flex items-center gap-1">
                <Gem className="w-5 h-5 text-yellow-300" />
                <span className="text-2xl font-bold">{userCorpsCoin.toLocaleString()}</span>
                <span className="text-sm">CC</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Design Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Preview */}
        <div className="lg:col-span-1 space-y-4">
          {/* View Controls */}
          <div className="bg-surface-dark rounded-theme p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-text-primary-dark">Preview</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowGrid(!showGrid)}
                  className={`p-2 rounded ${showGrid ? 'bg-primary text-white' : 'bg-background-dark text-text-secondary-dark'}`}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button className="p-2 rounded bg-background-dark text-text-secondary-dark">
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Zoom Control */}
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => setZoom(Math.max(50, zoom - 10))}
                className="p-1 bg-background-dark rounded text-text-primary-dark"
              >
                <Minus className="w-4 h-4" />
              </button>
              <div className="flex-1 bg-background-dark rounded px-3 py-1 text-center text-sm text-text-primary-dark">
                {zoom}%
              </div>
              <button
                onClick={() => setZoom(Math.min(200, zoom + 10))}
                className="p-1 bg-background-dark rounded text-text-primary-dark"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* 3D Uniform Preview */}
            <div 
              className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-theme p-6 min-h-[400px] flex items-center justify-center relative overflow-hidden"
              style={{ transform: `scale(${zoom / 100})` }}
            >
              {showGrid && (
                <div className="absolute inset-0" style={{
                  backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
                  backgroundSize: '20px 20px'
                }} />
              )}
              
              {/* Sophisticated SVG Uniform Mockup */}
              <svg viewBox="0 0 300 500" className="w-full h-auto max-h-[500px]">
                <defs>
                  {/* Gradients for realistic shading */}
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
                  <rect x="125" y="280" width="5" height="200" fill={uniform.pants.stripeColor} />
                  <rect x="170" y="280" width="5" height="200" fill={uniform.pants.stripeColor} />
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
            <div className="grid grid-cols-3 gap-2 mt-4">
              {['3d', 'flat', 'technical'].map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-2 rounded text-sm font-medium capitalize transition-colors ${
                    viewMode === mode
                      ? 'bg-primary text-white'
                      : 'bg-background-dark text-text-secondary-dark hover:bg-accent-dark'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-surface-dark rounded-theme p-4 space-y-2">
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
          <div className="bg-surface-dark rounded-theme p-2">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {[
                { id: 'jacket', label: 'Jacket', icon: Shirt },
                { id: 'pants', label: 'Pants', icon: Package },
                { id: 'accessories', label: 'Accessories', icon: Award },
                { id: 'materials', label: 'Materials', icon: Layers },
                { id: 'presets', label: 'Presets', icon: Wand2 },
              ].map(section => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-theme font-medium transition-colors ${
                      activeSection === section.id
                        ? 'bg-primary text-white'
                        : 'bg-background-dark text-text-secondary-dark hover:bg-accent-dark'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden md:inline">{section.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Design Controls Content */}
          <div className="bg-surface-dark rounded-theme p-6">
            {activeSection === 'jacket' && (
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-text-primary-dark mb-4">Jacket Design</h3>
                
                {/* Base Color */}
                <div>
                  <label className="block text-sm font-medium text-text-primary-dark mb-2">
                    Base Color
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={uniform.jacket.baseColor}
                      onChange={(e) => updateUniformSection('jacket', 'baseColor', e.target.value)}
                      className="w-16 h-16 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={uniform.jacket.baseColor}
                      onChange={(e) => updateUniformSection('jacket', 'baseColor', e.target.value)}
                      className="flex-1 px-3 py-2 bg-background-dark border border-accent-dark rounded text-text-primary-dark"
                      placeholder="#HEXCODE"
                    />
                  </div>
                </div>

                {/* Trim Colors */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-primary-dark mb-2">
                      Primary Trim
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={uniform.jacket.trim1Color}
                        onChange={(e) => updateUniformSection('jacket', 'trim1Color', e.target.value)}
                        className="w-12 h-12 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={uniform.jacket.trim1Color}
                        onChange={(e) => updateUniformSection('jacket', 'trim1Color', e.target.value)}
                        className="flex-1 px-2 py-1 bg-background-dark border border-accent-dark rounded text-text-primary-dark text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-primary-dark mb-2">
                      Secondary Trim
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={uniform.jacket.trim2Color}
                        onChange={(e) => updateUniformSection('jacket', 'trim2Color', e.target.value)}
                        className="w-12 h-12 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={uniform.jacket.trim2Color}
                        onChange={(e) => updateUniformSection('jacket', 'trim2Color', e.target.value)}
                        className="flex-1 px-2 py-1 bg-background-dark border border-accent-dark rounded text-text-primary-dark text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Style Options */}
                <div>
                  <label className="block text-sm font-medium text-text-primary-dark mb-2">
                    Front Style
                  </label>
                  <select
                    value={uniform.jacket.frontStyle}
                    onChange={(e) => updateUniformSection('jacket', 'frontStyle', e.target.value)}
                    className="w-full px-3 py-2 bg-background-dark border border-accent-dark rounded text-text-primary-dark"
                  >
                    <option value="doubleBreasted">Double Breasted</option>
                    <option value="singleBreasted">Single Breasted</option>
                    <option value="asymmetric">Asymmetric</option>
                    <option value="zippered">Zippered</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-primary-dark mb-2">
                      Collar Style
                    </label>
                    <select
                      value={uniform.jacket.collarStyle}
                      onChange={(e) => updateUniformSection('jacket', 'collarStyle', e.target.value)}
                      className="w-full px-3 py-2 bg-background-dark border border-accent-dark rounded text-text-primary-dark"
                    >
                      <option value="standard">Standard</option>
                      <option value="military">Military</option>
                      <option value="mandarin">Mandarin</option>
                      <option value="notched">Notched</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-primary-dark mb-2">
                      Shoulder Style
                    </label>
                    <select
                      value={uniform.jacket.shoulderStyle}
                      onChange={(e) => updateUniformSection('jacket', 'shoulderStyle', e.target.value)}
                      className="w-full px-3 py-2 bg-background-dark border border-accent-dark rounded text-text-primary-dark"
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
                <h3 className="text-xl font-bold text-text-primary-dark mb-4">Pants Design</h3>
                
                <div>
                  <label className="block text-sm font-medium text-text-primary-dark mb-2">
                    Base Color
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={uniform.pants.baseColor}
                      onChange={(e) => updateUniformSection('pants', 'baseColor', e.target.value)}
                      className="w-16 h-16 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={uniform.pants.baseColor}
                      onChange={(e) => updateUniformSection('pants', 'baseColor', e.target.value)}
                      className="flex-1 px-3 py-2 bg-background-dark border border-accent-dark rounded text-text-primary-dark"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary-dark mb-2">
                    Stripe Color
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={uniform.pants.stripeColor}
                      onChange={(e) => updateUniformSection('pants', 'stripeColor', e.target.value)}
                      className="w-16 h-16 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={uniform.pants.stripeColor}
                      onChange={(e) => updateUniformSection('pants', 'stripeColor', e.target.value)}
                      className="flex-1 px-3 py-2 bg-background-dark border border-accent-dark rounded text-text-primary-dark"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-primary-dark mb-2">
                      Stripe Style
                    </label>
                    <select
                      value={uniform.pants.stripeStyle}
                      onChange={(e) => updateUniformSection('pants', 'stripeStyle', e.target.value)}
                      className="w-full px-3 py-2 bg-background-dark border border-accent-dark rounded text-text-primary-dark"
                    >
                      <option value="single">Single Stripe</option>
                      <option value="double">Double Stripe</option>
                      <option value="none">No Stripe</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-primary-dark mb-2">
                      Stripe Width
                    </label>
                    <select
                      value={uniform.pants.stripeWidth}
                      onChange={(e) => updateUniformSection('pants', 'stripeWidth', e.target.value)}
                      className="w-full px-3 py-2 bg-background-dark border border-accent-dark rounded text-text-primary-dark"
                    >
                      <option value="thin">Thin</option>
                      <option value="medium">Medium</option>
                      <option value="wide">Wide</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'accessories' && (
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-text-primary-dark mb-4">Accessories & Embellishments</h3>
                
                <FeatureCard
                  featureKey="gauntlets"
                  title="Gauntlets"
                  description="Classic white glove extensions"
                >
                  <div className="space-y-3">
                    <button
                      onClick={() => toggleAccessory('gauntlets')}
                      className={`w-full py-2 px-4 rounded font-medium transition-colors ${
                        uniform.accessories.gauntlets?.enabled
                          ? 'bg-green-600 text-white'
                          : 'bg-background-dark text-text-secondary-dark'
                      }`}
                    >
                      {uniform.accessories.gauntlets?.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                    {uniform.accessories.gauntlets?.enabled && (
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-text-secondary-dark">Color:</label>
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
                >
                  <div className="space-y-3">
                    <button
                      onClick={() => toggleAccessory('epaulets')}
                      className={`w-full py-2 px-4 rounded font-medium transition-colors ${
                        uniform.accessories.epaulets?.enabled
                          ? 'bg-green-600 text-white'
                          : 'bg-background-dark text-text-secondary-dark'
                      }`}
                    >
                      {uniform.accessories.epaulets?.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                    {uniform.accessories.epaulets?.enabled && (
                      <>
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-text-secondary-dark">Color:</label>
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
                        <label className="flex items-center gap-2 text-sm text-text-primary-dark">
                          <input
                            type="checkbox"
                            checked={uniform.accessories.epaulets?.fringe || false}
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
                            className="rounded"
                          />
                          Add Fringe Detail
                        </label>
                      </>
                    )}
                  </div>
                </FeatureCard>

                <FeatureCard
                  featureKey="sash"
                  title="Competition Sash"
                  description="Decorative diagonal or horizontal sash"
                  premium
                >
                  <div className="space-y-3">
                    <button
                      onClick={() => toggleAccessory('sash')}
                      className={`w-full py-2 px-4 rounded font-medium transition-colors ${
                        uniform.accessories.sash?.enabled
                          ? 'bg-green-600 text-white'
                          : 'bg-background-dark text-text-secondary-dark'
                      }`}
                    >
                      {uniform.accessories.sash?.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                    {uniform.accessories.sash?.enabled && (
                      <>
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-text-secondary-dark">Color:</label>
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
                          className="w-full px-3 py-2 bg-background-dark border border-accent-dark rounded text-text-primary-dark"
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
                  premium
                >
                  <div className="space-y-3">
                    <button
                      onClick={() => toggleAccessory('capelets')}
                      className={`w-full py-2 px-4 rounded font-medium transition-colors ${
                        uniform.accessories.capelets?.enabled
                          ? 'bg-green-600 text-white'
                          : 'bg-background-dark text-text-secondary-dark'
                      }`}
                    >
                      {uniform.accessories.capelets?.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>
                </FeatureCard>

                <FeatureCard
                  featureKey="ledLighting"
                  title="LED Integration"
                  description="Cutting-edge illuminated uniform elements"
                  premium
                >
                  <div className="space-y-3">
                    <button
                      onClick={() => setUniform(prev => ({
                        ...prev,
                        lighting: {
                          ...prev.lighting,
                          enabled: !prev.lighting.enabled
                        }
                      }))}
                      className={`w-full py-2 px-4 rounded font-medium transition-colors ${
                        uniform.lighting?.enabled
                          ? 'bg-green-600 text-white'
                          : 'bg-background-dark text-text-secondary-dark'
                      }`}
                    >
                      {uniform.lighting?.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                    {uniform.lighting?.enabled && (
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-text-secondary-dark">LED Color:</label>
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
                    )}
                  </div>
                </FeatureCard>
              </div>
            )}

            {activeSection === 'materials' && (
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-text-primary-dark mb-4">Advanced Materials</h3>
                
                <FeatureCard
                  featureKey="premiumFabric"
                  title="Premium Fabrics"
                  description="High-end materials for superior look and feel"
                  premium
                >
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-text-primary-dark mb-2">
                        Jacket Fabric
                      </label>
                      <select
                        value={uniform.materials.jacket.fabric}
                        onChange={(e) => setUniform(prev => ({
                          ...prev,
                          materials: {
                            ...prev.materials,
                            jacket: {
                              ...prev.materials.jacket,
                              fabric: e.target.value
                            }
                          }
                        }))}
                        className="w-full px-3 py-2 bg-background-dark border border-accent-dark rounded text-text-primary-dark"
                      >
                        <option value="wool">Wool (Standard)</option>
                        <option value="synthetic">Synthetic Performance</option>
                        <option value="premium">Premium Blend</option>
                        <option value="luxe">Luxury Fabric</option>
                      </select>
                    </div>
                  </div>
                </FeatureCard>

                <FeatureCard
                  featureKey="metallic"
                  title="Metallic Finishes"
                  description="Reflective and metallic surface treatments"
                  premium
                >
                  <div>
                    <label className="block text-sm font-medium text-text-primary-dark mb-2">
                      Surface Finish
                    </label>
                    <select
                      value={uniform.materials.jacket.finish}
                      onChange={(e) => setUniform(prev => ({
                        ...prev,
                        materials: {
                          ...prev.materials,
                          jacket: {
                            ...prev.materials.jacket,
                            finish: e.target.value
                          }
                        }
                      }))}
                      className="w-full px-3 py-2 bg-background-dark border border-accent-dark rounded text-text-primary-dark"
                    >
                      <option value="matte">Matte (Standard)</option>
                      <option value="satin">Satin</option>
                      <option value="metallic">Metallic</option>
                      <option value="holographic">Holographic</option>
                    </select>
                  </div>
                </FeatureCard>

                <FeatureCard
                  featureKey="textureRibbed"
                  title="Advanced Textures"
                  description="Unique surface textures and patterns"
                  premium
                >
                  <div>
                    <label className="block text-sm font-medium text-text-primary-dark mb-2">
                      Texture Type
                    </label>
                    <select
                      value={uniform.materials.jacket.texture}
                      onChange={(e) => setUniform(prev => ({
                        ...prev,
                        materials: {
                          ...prev.materials,
                          jacket: {
                            ...prev.materials.jacket,
                            texture: e.target.value
                          }
                        }
                      }))}
                      className="w-full px-3 py-2 bg-background-dark border border-accent-dark rounded text-text-primary-dark"
                    >
                      <option value="smooth">Smooth (Standard)</option>
                      <option value="ribbed">Ribbed</option>
                      <option value="quilted">Quilted</option>
                      <option value="embossed">Embossed</option>
                    </select>
                  </div>
                </FeatureCard>
              </div>
            )}

            {activeSection === 'presets' && (
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-text-primary-dark mb-4">Legendary Presets</h3>
                <p className="text-sm text-text-secondary-dark mb-4">
                  Inspired by championship-winning uniform designs
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {legendaryPresets.map(preset => (
                    <div
                      key={preset.name}
                      className={`bg-background-dark rounded-theme p-4 border-2 ${
                        userXP >= preset.xpRequired
                          ? 'border-green-500 cursor-pointer hover:bg-accent-dark'
                          : 'border-accent-dark opacity-60'
                      }`}
                      onClick={() => {
                        if (userXP >= preset.xpRequired) {
                          updateUniformSection('jacket', 'baseColor', preset.colors.base);
                          updateUniformSection('jacket', 'trim1Color', preset.colors.trim);
                          updateUniformSection('jacket', 'trim2Color', preset.colors.accent);
                          toast.success(`Applied ${preset.name} preset!`);
                        } else {
                          toast.error(`Requires ${preset.xpRequired} XP`);
                        }
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-2xl">{preset.icon}</div>
                        {userXP < preset.xpRequired && (
                          <Lock className="w-5 h-5 text-red-400" />
                        )}
                      </div>
                      <h4 className="font-bold text-text-primary-dark mb-1">{preset.name}</h4>
                      <p className="text-xs text-text-secondary-dark mb-3">{preset.description}</p>
                      <div className="flex gap-2 mb-2">
                        <div className="w-8 h-8 rounded border border-gray-600" style={{ backgroundColor: preset.colors.base }} />
                        <div className="w-8 h-8 rounded border border-gray-600" style={{ backgroundColor: preset.colors.trim }} />
                        <div className="w-8 h-8 rounded border border-gray-600" style={{ backgroundColor: preset.colors.accent }} />
                      </div>
                      {userXP < preset.xpRequired && (
                        <div className="text-xs text-red-400">
                          Requires {preset.xpRequired} XP
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Feature Unlock Progress */}
      <div className="bg-surface-dark rounded-theme p-6">
        <h3 className="text-lg font-bold text-text-primary-dark mb-4">Your Design Journey</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { level: 'Apprentice', minXP: 0, maxXP: 1000, features: 'Basic customization' },
            { level: 'Designer', minXP: 1000, maxXP: 3000, features: 'Advanced accessories' },
            { level: 'Master', minXP: 3000, maxXP: 5000, features: 'Premium materials' },
          ].map(tier => {
            const progress = Math.min(100, Math.max(0, ((userXP - tier.minXP) / (tier.maxXP - tier.minXP)) * 100));
            const isActive = userXP >= tier.minXP && userXP < tier.maxXP;
            const isComplete = userXP >= tier.maxXP;
            
            return (
              <div
                key={tier.level}
                className={`p-4 rounded-theme border-2 ${
                  isComplete ? 'border-green-500 bg-green-900 bg-opacity-20' :
                  isActive ? 'border-primary bg-primary bg-opacity-10' :
                  'border-accent-dark'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-text-primary-dark">{tier.level}</h4>
                  {isComplete && <Check className="w-5 h-5 text-green-400" />}
                </div>
                <p className="text-xs text-text-secondary-dark mb-3">{tier.features}</p>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      isComplete ? 'bg-green-500' : 'bg-primary'
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="text-xs text-text-secondary-dark mt-1">
                  {tier.minXP} - {tier.maxXP} XP
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default UniformBuilder;