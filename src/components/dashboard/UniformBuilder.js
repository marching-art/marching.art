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
  Info,
  Unlock,
  ChevronRight,
  Coins
} from 'lucide-react';

// Default uniform configuration
const DEFAULT_UNIFORM = {
  jacket: {
    baseColor: '#000080',
    trim1Color: '#FFD700',
    trim2Color: '#FFFFFF',
    buttonColor: '#FFD700',
    frontStyle: 'doubleBreasted',
    shoulderStyle: 'classic',
    collarStyle: 'standard',
    epaulets: false,
    gauntlets: false,
    overlay: false,
    piping: false,
    sash: false,
    braiding: false,
    capelets: false
  },
  pants: {
    baseColor: '#000000',
    stripeColor: '#FFD700',
    stripeWidth: 'medium',
    stripeStyle: 'single',
    style: 'straight'
  },
  shako: {
    baseColor: '#000080',
    plumeColor: '#FFFFFF',
    plumeStyle: 'standard',
    chinStrap: '#FFD700',
    badgeColor: '#FFD700',
    badgeStyle: 'shield',
    chinStrapColor: '#000000'
  },
  accessories: {
    gloves: '#FFFFFF',
    shoes: '#000000',
    plume: 'standard',
    gauntlets: { enabled: false, color: '#FFFFFF' },
    epaulets: { enabled: false, color: '#FFD700', fringe: true },
    sash: { enabled: false, color: '#DC143C', style: 'diagonal' },
    capelets: { enabled: false, color: '#000080' },
    overlay: { enabled: false, color: '#FFD700', style: 'classic' }
  },
  lighting: {
    enabled: false,
    color: '#FFFFFF',
    mode: 'static',
    pattern: 'pulse'
  }
};

// Feature unlock requirements
const FEATURE_REQUIREMENTS = {
  gauntlets: { xp: 500, corpsCoin: 50, name: 'Gauntlets', description: 'Add ornamental gauntlets to jacket sleeves' },
  epaulets: { xp: 750, corpsCoin: 100, name: 'Epaulets', description: 'Shoulder decorations with fringe options' },
  overlay: { xp: 1000, corpsCoin: 150, name: 'Jacket Overlay', description: 'Add decorative overlay to jacket front' },
  piping: { xp: 1200, corpsCoin: 180, name: 'Piping Details', description: 'Decorative piping along seams' },
  sash: { xp: 1500, corpsCoin: 220, name: 'Ceremonial Sash', description: 'Diagonal or horizontal ceremonial sash' },
  braiding: { xp: 1800, corpsCoin: 250, name: 'Braiding', description: 'Ornamental braided cord details' },
  capelets: { xp: 2500, corpsCoin: 400, name: 'Capelets', description: 'Short decorative shoulder capes' },
  premiumFabric: { xp: 3000, corpsCoin: 500, name: 'Premium Fabrics', description: 'Metallic and specialty fabric options' },
  metallic: { xp: 2000, corpsCoin: 300, name: 'Metallic Accents', description: 'Add metallic finishes to trim' },
  textureRibbed: { xp: 2500, corpsCoin: 400, name: 'Ribbed Texture', description: 'Textured fabric patterns' },
  embroidery: { xp: 3500, corpsCoin: 600, name: 'Custom Embroidery', description: 'Add embroidered designs' },
  appliques: { xp: 4000, corpsCoin: 750, name: 'Appliqués', description: 'Decorative fabric applications' },
  ledLighting: { xp: 5000, corpsCoin: 1000, name: 'LED Lighting', description: 'Programmable LED accent lighting' }
};

const UniformBuilder = ({ userProfile }) => {
  const { currentUser } = useAuth();
  const [uniformConfig, setUniformConfig] = useState(DEFAULT_UNIFORM);
  const [unlockStatus, setUnlockStatus] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [activeTab, setActiveTab] = useState('jacket');
  const [viewMode, setViewMode] = useState('3d');
  const [previewRotation, setPreviewRotation] = useState(0);

  // User stats
  const userXP = userProfile?.xp || 0;
  const userCorpsCoin = userProfile?.corpsCoin || 0;

  // Initialize uniform from user profile or defaults
  useEffect(() => {
    if (userProfile?.uniform) {
      // Deep merge with defaults to ensure all properties exist
      const mergedUniform = {
        jacket: { ...DEFAULT_UNIFORM.jacket, ...(userProfile.uniform.jacket || {}) },
        pants: { ...DEFAULT_UNIFORM.pants, ...(userProfile.uniform.pants || {}) },
        shako: { ...DEFAULT_UNIFORM.shako, ...(userProfile.uniform.shako || {}) },
        accessories: { 
          ...DEFAULT_UNIFORM.accessories, 
          ...(userProfile.uniform.accessories || {}),
          gauntlets: { ...DEFAULT_UNIFORM.accessories.gauntlets, ...(userProfile.uniform.accessories?.gauntlets || {}) },
          epaulets: { ...DEFAULT_UNIFORM.accessories.epaulets, ...(userProfile.uniform.accessories?.epaulets || {}) },
          sash: { ...DEFAULT_UNIFORM.accessories.sash, ...(userProfile.uniform.accessories?.sash || {}) },
          capelets: { ...DEFAULT_UNIFORM.accessories.capelets, ...(userProfile.uniform.accessories?.capelets || {}) },
          overlay: { ...DEFAULT_UNIFORM.accessories.overlay, ...(userProfile.uniform.accessories?.overlay || {}) }
        },
        lighting: { ...DEFAULT_UNIFORM.lighting, ...(userProfile.uniform.lighting || {}) }
      };
      setUniformConfig(mergedUniform);
    } else {
      setUniformConfig(DEFAULT_UNIFORM);
    }
  }, [userProfile]);

  // Fetch unlock status for premium features
  useEffect(() => {
    fetchUnlockStatus();
  }, [userProfile?.xp, userProfile?.corpsCoin]);

  const fetchUnlockStatus = async () => {
    try {
      setIsLoadingStatus(true);
      const getUnlockStatus = httpsCallable(functions, 'getUnlockStatus');
      const result = await getUnlockStatus();
      
      if (result.data.success) {
        setUnlockStatus(result.data.unlockStatus || {});
      }
    } catch (error) {
      console.error('Error fetching unlock status:', error);
      // Set default unlock status on error
      const defaultStatus = {};
      Object.keys(FEATURE_REQUIREMENTS).forEach(key => {
        defaultStatus[key] = {
          unlocked: false,
          canPurchase: false,
          requirement: FEATURE_REQUIREMENTS[key]
        };
      });
      setUnlockStatus(defaultStatus);
    } finally {
      setIsLoadingStatus(false);
    }
  };

  const isUnlocked = (feature) => {
    return unlockStatus[feature]?.unlocked || false;
  };

  const canPurchaseWithCoin = (feature) => {
    return unlockStatus[feature]?.canPurchase || false;
  };

  const handleColorChange = (section, property, color) => {
    setUniformConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [property]: color
      }
    }));
  };

  const handleAccessoryToggle = (accessory) => {
    setUniformConfig(prev => ({
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

  const handleAccessoryColorChange = (accessory, color) => {
    setUniformConfig(prev => ({
      ...prev,
      accessories: {
        ...prev.accessories,
        [accessory]: {
          ...prev.accessories[accessory],
          color: color
        }
      }
    }));
  };

  const handleFeatureToggle = async (section, feature) => {
    const status = unlockStatus[feature];
    
    if (!status?.unlocked && status?.canPurchase) {
      // Show purchase confirmation
      const confirmPurchase = window.confirm(
        `Purchase ${FEATURE_REQUIREMENTS[feature].name} for ${FEATURE_REQUIREMENTS[feature].corpsCoin} CorpsCoins?`
      );
      
      if (!confirmPurchase) return;
      
      try {
        const purchaseFeature = httpsCallable(functions, 'purchaseFeature');
        const result = await purchaseFeature({ feature });
        
        if (result.data.success) {
          toast.success(`${FEATURE_REQUIREMENTS[feature].name} unlocked!`);
          await fetchUnlockStatus();
          // Enable the feature after purchase
          if (section === 'accessories') {
            handleAccessoryToggle(feature);
          } else {
            setUniformConfig(prev => ({
              ...prev,
              [section]: {
                ...prev[section],
                [feature]: true
              }
            }));
          }
        }
      } catch (error) {
        toast.error('Failed to purchase feature');
      }
      return;
    }
    
    if (!status?.unlocked) {
      toast.error(`${FEATURE_REQUIREMENTS[feature].name} is locked. Earn ${FEATURE_REQUIREMENTS[feature].xp} XP to unlock!`);
      return;
    }
    
    // Toggle the feature
    if (section === 'accessories') {
      handleAccessoryToggle(feature);
    } else {
      setUniformConfig(prev => ({
        ...prev,
        [section]: {
          ...prev[section],
          [feature]: !prev[section][feature]
        }
      }));
    }
  };

  const saveUniform = async () => {
    try {
      setIsSaving(true);
      const updateUniform = httpsCallable(functions, 'updateUniform');
      const result = await updateUniform({ uniform: uniformConfig });
      
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
      setUniformConfig(DEFAULT_UNIFORM);
      toast.success('Uniform reset to default');
    }
  };

  const renderColorPicker = (label, section, property, disabled = false) => {
    const value = uniformConfig[section]?.[property] || '#000000';
    
    return (
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-secondary dark:text-text-secondary-dark">
          {label}
        </span>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={value}
            onChange={(e) => handleColorChange(section, property, e.target.value)}
            disabled={disabled}
            className="w-10 h-10 rounded cursor-pointer disabled:opacity-50"
          />
          <input
            type="text"
            value={value}
            onChange={(e) => handleColorChange(section, property, e.target.value)}
            disabled={disabled}
            className="w-20 px-2 py-1 text-xs bg-background dark:bg-background-dark rounded border border-accent dark:border-accent-dark disabled:opacity-50"
          />
        </div>
      </div>
    );
  };

  const renderFeatureToggle = (label, section, feature) => {
    const isEnabled = section === 'accessories' 
      ? uniformConfig.accessories?.[feature]?.enabled 
      : uniformConfig[section]?.[feature];
    const status = unlockStatus[feature] || { unlocked: false };
    const requirement = FEATURE_REQUIREMENTS[feature];
    
    return (
      <div className="flex items-center justify-between p-3 bg-background dark:bg-background-dark rounded-theme">
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleFeatureToggle(section, feature)}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              isEnabled 
                ? 'bg-primary dark:bg-primary-dark' 
                : 'bg-accent dark:bg-accent-dark'
            } ${!status.unlocked && 'opacity-50'}`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
              isEnabled ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
          
          <div>
            <span className={`text-sm font-medium ${
              !status.unlocked && 'text-text-secondary dark:text-text-secondary-dark'
            }`}>
              {label}
            </span>
            <p className="text-xs text-text-secondary dark:text-text-secondary-dark">
              {requirement.description}
            </p>
            
            {!status.unlocked && (
              <div className="flex items-center gap-2 mt-1">
                {status.canPurchase ? (
                  <span className="text-xs text-primary dark:text-primary-dark flex items-center gap-1">
                    <Coins className="w-3 h-3" />
                    {requirement.corpsCoin} CorpsCoins
                  </span>
                ) : (
                  <span className="text-xs text-text-secondary dark:text-text-secondary-dark flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    {requirement.xp} XP Required
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        
        {status.unlocked && (
          <Unlock className="w-4 h-4 text-green-500" />
        )}
      </div>
    );
  };

  const renderUniformPreview = () => {
    return (
      <div className="bg-surface dark:bg-surface-dark rounded-theme p-6 h-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-text-primary dark:text-text-primary-dark">
            Uniform Preview
          </h3>
          <div className="flex gap-2">
            {['3d', 'flat', 'technical'].map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 rounded text-sm capitalize ${
                  viewMode === mode 
                    ? 'bg-primary dark:bg-primary-dark text-white' 
                    : 'bg-background dark:bg-background-dark'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
        
        {/* SVG Uniform Preview */}
        <div className="relative bg-gradient-to-b from-blue-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-theme p-4">
          <svg viewBox="0 0 300 500" className="w-full h-full max-h-[400px]">
            <defs>
              <linearGradient id="jacketGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={uniformConfig.jacket.baseColor} stopOpacity="1" />
                <stop offset="50%" stopColor={uniformConfig.jacket.baseColor} stopOpacity="0.9" />
                <stop offset="100%" stopColor={uniformConfig.jacket.baseColor} stopOpacity="0.8" />
              </linearGradient>
              <filter id="shadow">
                <feDropShadow dx="2" dy="4" stdDeviation="3" floodOpacity="0.3"/>
              </filter>
            </defs>

            {/* Pants */}
            <g id="pants">
              <path
                d="M100 280 L100 480 L130 480 L130 380 L150 380 L170 380 L170 480 L200 480 L200 280 Z"
                fill={uniformConfig.pants.baseColor}
                filter="url(#shadow)"
              />
              {/* Stripes */}
              {uniformConfig.pants.stripeStyle !== 'none' && (
                <>
                  <rect x="108" y="280" width={uniformConfig.pants.stripeWidth === 'wide' ? '8' : '4'} height="200" fill={uniformConfig.pants.stripeColor} />
                  <rect x="184" y="280" width={uniformConfig.pants.stripeWidth === 'wide' ? '8' : '4'} height="200" fill={uniformConfig.pants.stripeColor} />
                  {uniformConfig.pants.stripeStyle === 'double' && (
                    <>
                      <rect x="118" y="280" width="2" height="200" fill={uniformConfig.pants.stripeColor} />
                      <rect x="180" y="280" width="2" height="200" fill={uniformConfig.pants.stripeColor} />
                    </>
                  )}
                </>
              )}
            </g>

            {/* Jacket Body */}
            <g id="jacket">
              <path
                d="M80 100 L80 280 Q80 290 90 290 L210 290 Q220 290 220 280 L220 100 Q220 90 210 90 L90 90 Q80 90 80 100"
                fill="url(#jacketGradient)"
                filter="url(#shadow)"
              />
              
              {/* Trim Lines */}
              <path
                d="M80 100 L80 280 M220 100 L220 280"
                stroke={uniformConfig.jacket.trim1Color}
                strokeWidth="4"
                fill="none"
              />
              
              {/* Collar */}
              <path
                d="M90 90 Q150 80 210 90"
                fill={uniformConfig.jacket.trim2Color}
                stroke={uniformConfig.jacket.trim1Color}
                strokeWidth="2"
              />
              
              {/* Buttons */}
              {uniformConfig.jacket.frontStyle === 'doubleBreasted' && (
                <>
                  <circle cx="110" cy="140" r="4" fill={uniformConfig.jacket.buttonColor} />
                  <circle cx="110" cy="170" r="4" fill={uniformConfig.jacket.buttonColor} />
                  <circle cx="110" cy="200" r="4" fill={uniformConfig.jacket.buttonColor} />
                  <circle cx="110" cy="230" r="4" fill={uniformConfig.jacket.buttonColor} />
                  <circle cx="190" cy="140" r="4" fill={uniformConfig.jacket.buttonColor} />
                  <circle cx="190" cy="170" r="4" fill={uniformConfig.jacket.buttonColor} />
                  <circle cx="190" cy="200" r="4" fill={uniformConfig.jacket.buttonColor} />
                  <circle cx="190" cy="230" r="4" fill={uniformConfig.jacket.buttonColor} />
                </>
              )}
              
              {/* Epaulets */}
              {uniformConfig.accessories?.epaulets?.enabled && (
                <>
                  <rect x="75" y="85" width="30" height="15" fill={uniformConfig.accessories.epaulets.color} rx="2" />
                  <rect x="195" y="85" width="30" height="15" fill={uniformConfig.accessories.epaulets.color} rx="2" />
                  {uniformConfig.accessories.epaulets.fringe && (
                    <>
                      <path d="M75 100 L75 110 M80 100 L80 110 M85 100 L85 110 M90 100 L90 110 M95 100 L95 110 M100 100 L100 110 M105 100 L105 110" stroke={uniformConfig.accessories.epaulets.color} strokeWidth="1" />
                      <path d="M195 100 L195 110 M200 100 L200 110 M205 100 L205 110 M210 100 L210 110 M215 100 L215 110 M220 100 L220 110 M225 100 L225 110" stroke={uniformConfig.accessories.epaulets.color} strokeWidth="1" />
                    </>
                  )}
                </>
              )}
              
              {/* Gauntlets */}
              {uniformConfig.accessories?.gauntlets?.enabled && (
                <>
                  <rect x="70" y="250" width="40" height="20" fill={uniformConfig.accessories.gauntlets.color} rx="3" />
                  <rect x="190" y="250" width="40" height="20" fill={uniformConfig.accessories.gauntlets.color} rx="3" />
                </>
              )}
              
              {/* Sash */}
              {uniformConfig.accessories?.sash?.enabled && (
                <path
                  d={uniformConfig.accessories.sash.style === 'diagonal' 
                    ? "M80 120 L220 240 L220 260 L80 140 Z"
                    : "M80 180 L220 180 L220 200 L80 200 Z"
                  }
                  fill={uniformConfig.accessories.sash.color}
                  opacity="0.9"
                />
              )}
              
              {/* Overlay */}
              {uniformConfig.accessories?.overlay?.enabled && (
                <path
                  d="M100 110 L100 250 L130 250 L130 110 Z M170 110 L170 250 L200 250 L200 110 Z"
                  fill={uniformConfig.accessories.overlay.color}
                  opacity="0.5"
                />
              )}
              
              {/* Capelets */}
              {uniformConfig.accessories?.capelets?.enabled && (
                <>
                  <path
                    d="M60 90 Q60 130 80 140 L80 90 Z"
                    fill={uniformConfig.accessories.capelets.color}
                    opacity="0.8"
                  />
                  <path
                    d="M220 90 L220 140 Q240 130 240 90 Z"
                    fill={uniformConfig.accessories.capelets.color}
                    opacity="0.8"
                  />
                </>
              )}
            </g>

            {/* Shako */}
            <g id="shako">
              <ellipse cx="150" cy="45" rx="40" ry="15" fill={uniformConfig.shako.baseColor} />
              <rect x="110" y="20" width="80" height="30" fill={uniformConfig.shako.baseColor} rx="5" />
              
              {/* Chin Strap */}
              <path
                d="M110 45 Q100 60 110 75 M190 45 Q200 60 190 75"
                stroke={uniformConfig.shako.chinStrapColor}
                strokeWidth="2"
                fill="none"
              />
              
              {/* Badge */}
              {uniformConfig.shako.badgeStyle === 'shield' && (
                <path
                  d="M140 25 L160 25 L160 35 L150 40 L140 35 Z"
                  fill={uniformConfig.shako.badgeColor}
                  stroke={uniformConfig.shako.trim1Color || '#000'}
                  strokeWidth="1"
                />
              )}
              {uniformConfig.shako.badgeStyle === 'star' && (
                <path
                  d="M150 20 L153 30 L163 30 L155 35 L158 45 L150 38 L142 45 L145 35 L137 30 L147 30 Z"
                  fill={uniformConfig.shako.badgeColor}
                />
              )}
              {uniformConfig.shako.badgeStyle === 'eagle' && (
                <g transform="translate(140, 25)">
                  <path d="M10 0 Q5 5 0 5 Q5 10 10 15 Q15 10 20 5 Q15 5 10 0" fill={uniformConfig.shako.badgeColor} />
                </g>
              )}
              
              {/* Plume */}
              <g transform={`translate(150, 10) ${uniformConfig.shako.plumeStyle === 'tall' ? 'scale(1, 1.5)' : ''}`}>
                <ellipse cx="0" cy="0" rx="8" ry="20" fill={uniformConfig.shako.plumeColor} opacity="0.9" />
                {uniformConfig.shako.plumeStyle === 'double' && (
                  <>
                    <ellipse cx="-5" cy="0" rx="6" ry="18" fill={uniformConfig.shako.plumeColor} opacity="0.7" />
                    <ellipse cx="5" cy="0" rx="6" ry="18" fill={uniformConfig.shako.plumeColor} opacity="0.7" />
                  </>
                )}
              </g>
            </g>

            {/* LED Lights */}
            {uniformConfig.lighting?.enabled && (
              <g id="led-lights">
                {[100, 140, 180, 220, 260].map((y, i) => (
                  <circle key={`left-${i}`} cx="85" cy={y} r="3" fill={uniformConfig.lighting.color}>
                    <animate 
                      attributeName="opacity" 
                      values={uniformConfig.lighting.mode === 'pulse' ? "0.3;1;0.3" : "1"} 
                      dur="2s" 
                      repeatCount="indefinite" 
                    />
                  </circle>
                ))}
                {[100, 140, 180, 220, 260].map((y, i) => (
                  <circle key={`right-${i}`} cx="215" cy={y} r="3" fill={uniformConfig.lighting.color}>
                    <animate 
                      attributeName="opacity" 
                      values={uniformConfig.lighting.mode === 'pulse' ? "0.3;1;0.3" : "1"} 
                      dur="2s" 
                      begin="1s"
                      repeatCount="indefinite" 
                    />
                  </circle>
                ))}
              </g>
            )}

            {/* Corps Name */}
            <text x="150" y="320" textAnchor="middle" fill="#FFFFFF" fontSize="14" fontWeight="bold">
              {userProfile?.corps?.corpsName || 'Your Corps Name'}
            </text>
            <text x="150" y="340" textAnchor="middle" fill="#CCCCCC" fontSize="10">
              {userProfile?.corps?.corpsClass || 'Class'} • {userProfile?.corps?.location || 'Location'}
            </text>
          </svg>
          
          {/* Rotation Controls */}
          <div className="flex justify-center gap-2 mt-4">
            <button
              onClick={() => setPreviewRotation(prev => prev - 45)}
              className="px-3 py-1 bg-background dark:bg-background-dark rounded text-sm"
            >
              ← Rotate
            </button>
            <button
              onClick={() => setPreviewRotation(0)}
              className="px-3 py-1 bg-background dark:bg-background-dark rounded text-sm"
            >
              Front
            </button>
            <button
              onClick={() => setPreviewRotation(prev => prev + 45)}
              className="px-3 py-1 bg-background dark:bg-background-dark rounded text-sm"
            >
              Rotate →
            </button>
          </div>
        </div>
        
        <div className="mt-4 p-3 bg-background dark:bg-background-dark rounded-theme">
          <div className="flex items-center gap-2 text-xs text-text-secondary dark:text-text-secondary-dark">
            <Info className="w-3 h-3" />
            <span>Your uniform design is displayed on leaderboards and in competitions!</span>
          </div>
        </div>
      </div>
    );
  };

  const renderJacketTab = () => (
    <div className="space-y-4">
      <h3 className="font-medium text-text-primary dark:text-text-primary-dark mb-3">
        Base Colors
      </h3>
      <div className="space-y-3">
        {renderColorPicker('Base Color', 'jacket', 'baseColor')}
        {renderColorPicker('Primary Trim', 'jacket', 'trim1Color')}
        {renderColorPicker('Secondary Trim', 'jacket', 'trim2Color')}
        {renderColorPicker('Buttons', 'jacket', 'buttonColor')}
      </div>
      
      <h3 className="font-medium text-text-primary dark:text-text-primary-dark mb-3 mt-6">
        Style Options
      </h3>
      <div className="space-y-3">
        <div>
          <label className="text-sm text-text-secondary dark:text-text-secondary-dark">Front Style</label>
          <select
            value={uniformConfig.jacket?.frontStyle || 'doubleBreasted'}
            onChange={(e) => handleColorChange('jacket', 'frontStyle', e.target.value)}
            className="w-full mt-1 px-3 py-2 bg-background dark:bg-background-dark rounded-theme border border-accent dark:border-accent-dark"
          >
            <option value="doubleBreasted">Double Breasted</option>
            <option value="singleBreasted">Single Breasted</option>
            <option value="asymmetric">Asymmetric</option>
            <option value="zippered">Zippered</option>
          </select>
        </div>
        
        <div>
          <label className="text-sm text-text-secondary dark:text-text-secondary-dark">Collar Style</label>
          <select
            value={uniformConfig.jacket?.collarStyle || 'standard'}
            onChange={(e) => handleColorChange('jacket', 'collarStyle', e.target.value)}
            className="w-full mt-1 px-3 py-2 bg-background dark:bg-background-dark rounded-theme border border-accent dark:border-accent-dark"
          >
            <option value="standard">Standard</option>
            <option value="high">High Collar</option>
            <option value="napoleon">Napoleon</option>
            <option value="mandarin">Mandarin</option>
          </select>
        </div>
        
        <div>
          <label className="text-sm text-text-secondary dark:text-text-secondary-dark">Shoulder Style</label>
          <select
            value={uniformConfig.jacket?.shoulderStyle || 'classic'}
            onChange={(e) => handleColorChange('jacket', 'shoulderStyle', e.target.value)}
            className="w-full mt-1 px-3 py-2 bg-background dark:bg-background-dark rounded-theme border border-accent dark:border-accent-dark"
          >
            <option value="classic">Classic</option>
            <option value="padded">Padded</option>
            <option value="structured">Structured</option>
            <option value="natural">Natural</option>
          </select>
        </div>
      </div>
      
      <h3 className="font-medium text-text-primary dark:text-text-primary-dark mb-3 mt-6">
        Premium Features
      </h3>
      <div className="space-y-2">
        {renderFeatureToggle('Epaulets', 'accessories', 'epaulets')}
        {uniformConfig.accessories?.epaulets?.enabled && (
          <div className="ml-14 space-y-2">
            {renderColorPicker('Epaulet Color', 'accessories.epaulets', 'color')}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={uniformConfig.accessories?.epaulets?.fringe || false}
                onChange={(e) => setUniformConfig(prev => ({
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
              <label className="text-sm text-text-secondary dark:text-text-secondary-dark">Add Fringe</label>
            </div>
          </div>
        )}
        
        {renderFeatureToggle('Gauntlets', 'accessories', 'gauntlets')}
        {uniformConfig.accessories?.gauntlets?.enabled && (
          <div className="ml-14">
            {renderColorPicker('Gauntlet Color', 'accessories.gauntlets', 'color')}
          </div>
        )}
        
        {renderFeatureToggle('Overlay', 'accessories', 'overlay')}
        {uniformConfig.accessories?.overlay?.enabled && (
          <div className="ml-14">
            {renderColorPicker('Overlay Color', 'accessories.overlay', 'color')}
          </div>
        )}
        
        {renderFeatureToggle('Piping', 'jacket', 'piping')}
        {renderFeatureToggle('Braiding', 'jacket', 'braiding')}
        
        {renderFeatureToggle('Sash', 'accessories', 'sash')}
        {uniformConfig.accessories?.sash?.enabled && (
          <div className="ml-14 space-y-2">
            {renderColorPicker('Sash Color', 'accessories.sash', 'color')}
            <select
              value={uniformConfig.accessories?.sash?.style || 'diagonal'}
              onChange={(e) => setUniformConfig(prev => ({
                ...prev,
                accessories: {
                  ...prev.accessories,
                  sash: {
                    ...prev.accessories.sash,
                    style: e.target.value
                  }
                }
              }))}
              className="w-full px-3 py-2 bg-background dark:bg-background-dark rounded-theme border border-accent dark:border-accent-dark"
            >
              <option value="diagonal">Diagonal</option>
              <option value="horizontal">Horizontal</option>
            </select>
          </div>
        )}
        
        {renderFeatureToggle('Capelets', 'accessories', 'capelets')}
        {uniformConfig.accessories?.capelets?.enabled && (
          <div className="ml-14">
            {renderColorPicker('Capelet Color', 'accessories.capelets', 'color')}
          </div>
        )}
      </div>
    </div>
  );

  const renderPantsTab = () => (
    <div className="space-y-4">
      <h3 className="font-medium text-text-primary dark:text-text-primary-dark mb-3">
        Colors
      </h3>
      <div className="space-y-3">
        {renderColorPicker('Base Color', 'pants', 'baseColor')}
        {renderColorPicker('Stripe Color', 'pants', 'stripeColor')}
      </div>
      
      <h3 className="font-medium text-text-primary dark:text-text-primary-dark mb-3 mt-6">
        Style
      </h3>
      <div className="space-y-3">
        <div>
          <label className="text-sm text-text-secondary dark:text-text-secondary-dark">Pant Style</label>
          <select
            value={uniformConfig.pants?.style || 'straight'}
            onChange={(e) => handleColorChange('pants', 'style', e.target.value)}
            className="w-full mt-1 px-3 py-2 bg-background dark:bg-background-dark rounded-theme border border-accent dark:border-accent-dark"
          >
            <option value="straight">Straight</option>
            <option value="tapered">Tapered</option>
            <option value="boot-cut">Boot Cut</option>
            <option value="bibbers">Bibbers</option>
          </select>
        </div>
        
        <div>
          <label className="text-sm text-text-secondary dark:text-text-secondary-dark">Stripe Style</label>
          <select
            value={uniformConfig.pants?.stripeStyle || 'single'}
            onChange={(e) => handleColorChange('pants', 'stripeStyle', e.target.value)}
            className="w-full mt-1 px-3 py-2 bg-background dark:bg-background-dark rounded-theme border border-accent dark:border-accent-dark"
          >
            <option value="none">No Stripe</option>
            <option value="single">Single Stripe</option>
            <option value="double">Double Stripe</option>
            <option value="triple">Triple Stripe</option>
          </select>
        </div>
        
        {uniformConfig.pants?.stripeStyle !== 'none' && (
          <div>
            <label className="text-sm text-text-secondary dark:text-text-secondary-dark">Stripe Width</label>
            <select
              value={uniformConfig.pants?.stripeWidth || 'medium'}
              onChange={(e) => handleColorChange('pants', 'stripeWidth', e.target.value)}
              className="w-full mt-1 px-3 py-2 bg-background dark:bg-background-dark rounded-theme border border-accent dark:border-accent-dark"
            >
              <option value="thin">Thin</option>
              <option value="medium">Medium</option>
              <option value="wide">Wide</option>
              <option value="extra-wide">Extra Wide</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );

  const renderShakoTab = () => (
    <div className="space-y-4">
      <h3 className="font-medium text-text-primary dark:text-text-primary-dark mb-3">
        Colors
      </h3>
      <div className="space-y-3">
        {renderColorPicker('Base Color', 'shako', 'baseColor')}
        {renderColorPicker('Plume Color', 'shako', 'plumeColor')}
        {renderColorPicker('Chin Strap', 'shako', 'chinStrapColor')}
        {renderColorPicker('Badge Color', 'shako', 'badgeColor')}
      </div>
      
      <h3 className="font-medium text-text-primary dark:text-text-primary-dark mb-3 mt-6">
        Style Options
      </h3>
      <div className="space-y-3">
        <div>
          <label className="text-sm text-text-secondary dark:text-text-secondary-dark">Badge Style</label>
          <select
            value={uniformConfig.shako?.badgeStyle || 'shield'}
            onChange={(e) => handleColorChange('shako', 'badgeStyle', e.target.value)}
            className="w-full mt-1 px-3 py-2 bg-background dark:bg-background-dark rounded-theme border border-accent dark:border-accent-dark"
          >
            <option value="shield">Shield</option>
            <option value="star">Star</option>
            <option value="eagle">Eagle</option>
            <option value="crest">Corps Crest</option>
            <option value="custom">Custom Design</option>
            <option value="none">No Badge</option>
          </select>
        </div>
        
        <div>
          <label className="text-sm text-text-secondary dark:text-text-secondary-dark">Plume Style</label>
          <select
            value={uniformConfig.shako?.plumeStyle || 'standard'}
            onChange={(e) => handleColorChange('shako', 'plumeStyle', e.target.value)}
            className="w-full mt-1 px-3 py-2 bg-background dark:bg-background-dark rounded-theme border border-accent dark:border-accent-dark"
          >
            <option value="standard">Standard</option>
            <option value="tall">Tall Plume</option>
            <option value="double">Double Plume</option>
            <option value="feathered">Feathered</option>
            <option value="cascade">Cascade</option>
          </select>
        </div>
      </div>
    </div>
  );

  const renderAccessoriesTab = () => (
    <div className="space-y-4">
      <h3 className="font-medium text-text-primary dark:text-text-primary-dark mb-3">
        Basic Accessories
      </h3>
      <div className="space-y-3">
        {renderColorPicker('Gloves', 'accessories', 'gloves')}
        {renderColorPicker('Shoes', 'accessories', 'shoes')}
      </div>
      
      <h3 className="font-medium text-text-primary dark:text-text-primary-dark mb-3 mt-6">
        LED Lighting System
      </h3>
      {renderFeatureToggle('LED Lighting', 'lighting', 'ledLighting')}
      {uniformConfig.lighting?.enabled && (
        <div className="space-y-3 ml-14">
          {renderColorPicker('LED Color', 'lighting', 'color')}
          <div>
            <label className="text-sm text-text-secondary dark:text-text-secondary-dark">Light Mode</label>
            <select
              value={uniformConfig.lighting?.mode || 'static'}
              onChange={(e) => handleColorChange('lighting', 'mode', e.target.value)}
              className="w-full mt-1 px-3 py-2 bg-background dark:bg-background-dark rounded-theme border border-accent dark:border-accent-dark"
            >
              <option value="static">Static</option>
              <option value="pulse">Pulse</option>
              <option value="chase">Chase</option>
              <option value="rainbow">Rainbow</option>
              <option value="music-sync">Music Sync</option>
            </select>
          </div>
        </div>
      )}
      
      <h3 className="font-medium text-text-primary dark:text-text-primary-dark mb-3 mt-6">
        Special Effects
      </h3>
      <div className="space-y-2">
        {renderFeatureToggle('Premium Fabrics', 'accessories', 'premiumFabric')}
        {renderFeatureToggle('Metallic Accents', 'accessories', 'metallic')}
        {renderFeatureToggle('Ribbed Texture', 'accessories', 'textureRibbed')}
        {renderFeatureToggle('Custom Embroidery', 'accessories', 'embroidery')}
        {renderFeatureToggle('Appliqués', 'accessories', 'appliques')}
      </div>
    </div>
  );

  if (isLoadingStatus) {
    return (
      <div className="bg-surface dark:bg-surface-dark rounded-theme p-8 text-center">
        <Sparkles className="w-8 h-8 animate-spin mx-auto mb-4 text-primary dark:text-primary-dark" />
        <p className="text-text-secondary dark:text-text-secondary-dark">Loading uniform builder...</p>
      </div>
    );
  }

  return (
    <div className="bg-surface dark:bg-surface-dark rounded-theme p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-1">
            Uniform Designer
          </h2>
          <p className="text-text-secondary dark:text-text-secondary-dark text-sm">
            Create your corps' unique visual identity
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={resetToDefault}
            className="btn btn-secondary flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Reset
          </button>
          <button
            onClick={saveUniform}
            disabled={isSaving}
            className="btn btn-primary flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save Uniform'}
          </button>
        </div>
      </div>
      
      {/* User Stats Bar */}
      <div className="bg-background dark:bg-background-dark rounded-theme p-3 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-500" />
            <span className="text-sm">
              <span className="font-medium">{userXP.toLocaleString()}</span> XP
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-yellow-500" />
            <span className="text-sm">
              <span className="font-medium">{userCorpsCoin.toLocaleString()}</span> CorpsCoins
            </span>
          </div>
        </div>
        <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
          {Object.values(unlockStatus).filter(s => s.unlocked).length} / {Object.keys(FEATURE_REQUIREMENTS).length} Features Unlocked
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Editor Panel */}
        <div>
          {/* Tab Navigation */}
          <div className="flex gap-2 mb-4 overflow-x-auto">
            {[
              { id: 'jacket', label: 'Jacket', icon: Shirt },
              { id: 'pants', label: 'Pants', icon: ChevronRight },
              { id: 'shako', label: 'Shako', icon: Star },
              { id: 'accessories', label: 'Accessories', icon: Sparkles }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-theme whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'bg-primary dark:bg-primary-dark text-white'
                    : 'bg-background dark:bg-background-dark text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
          
          {/* Tab Content */}
          <div className="bg-background dark:bg-background-dark rounded-theme p-4 max-h-[600px] overflow-y-auto">
            {activeTab === 'jacket' && renderJacketTab()}
            {activeTab === 'pants' && renderPantsTab()}
            {activeTab === 'shako' && renderShakoTab()}
            {activeTab === 'accessories' && renderAccessoriesTab()}
          </div>
        </div>
        
        {/* Preview Panel */}
        <div>
          {renderUniformPreview()}
        </div>
      </div>
    </div>
  );
};

export default UniformBuilder;