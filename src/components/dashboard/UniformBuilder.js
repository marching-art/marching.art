import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebaseConfig';
import toast from 'react-hot-toast';
import LoadingScreen from '../common/LoadingScreen';
import { 
  Palette, 
  Lock, 
  Coins,
  Star,
  Save,
  Loader2,
  Info,
  Target,
  Check,
  ShoppingCart,
  Shirt,
  Footprints,
  Crown,
  Sparkles
} from 'lucide-react';

const FEATURE_REQUIREMENTS = {
  gauntlets: { xp: 500, corpsCoin: 50 },
  epaulets: { xp: 750, corpsCoin: 100 },
  overlay: { xp: 1000, corpsCoin: 150 },
  piping: { xp: 1200, corpsCoin: 180 },
  sash: { xp: 1500, corpsCoin: 220 },
  braiding: { xp: 1800, corpsCoin: 250 },
  capelets: { xp: 2500, corpsCoin: 400 },
  premiumFabric: { xp: 3000, corpsCoin: 500 },
  metallic: { xp: 2000, corpsCoin: 300 },
  textureRibbed: { xp: 2500, corpsCoin: 400 },
  embroidery: { xp: 3500, corpsCoin: 600 },
  appliques: { xp: 4000, corpsCoin: 750 },
  ledLighting: { xp: 5000, corpsCoin: 1000 }
};

const DEFAULT_UNIFORM = {
  jacket: {
    baseColor: '#8B4513',
    trim1Color: '#F7941D',
    trim2Color: '#FFFFFF',
    buttonColor: '#FFD700',
    frontStyle: 'doubleBreasted'
  },
  pants: {
    baseColor: '#000000',
    stripeColor: '#F7941D',
    style: 'straight'
  },
  shako: {
    baseColor: '#8B4513',
    plumeColor: '#F7941D',
    badgeColor: '#FFD700'
  },
  accessories: {
    gauntlets: { enabled: false, color: '#FFFFFF' },
    epaulets: { enabled: false, color: '#FFD700' },
    sash: { enabled: false, color: '#F7941D' },
    capelets: { enabled: false, color: '#8B4513' },
    overlay: { enabled: false, color: '#000000' }
  },
  lighting: {
    enabled: false,
    color: '#00FFFF'
  }
};

const UniformBuilder = ({ userProfile, activeCorps }) => {
  const [uniformConfig, setUniformConfig] = useState(DEFAULT_UNIFORM);
  const [unlockStatus, setUnlockStatus] = useState({});
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('jacket');

  useEffect(() => {
    if (activeCorps?.uniforms) {
      const mergedUniform = {
        jacket: { ...DEFAULT_UNIFORM.jacket, ...(activeCorps.uniforms.jacket || {}) },
        pants: { ...DEFAULT_UNIFORM.pants, ...(activeCorps.uniforms.pants || {}) },
        shako: { ...DEFAULT_UNIFORM.shako, ...(activeCorps.uniforms.shako || {}) },
        accessories: { 
          ...DEFAULT_UNIFORM.accessories, 
          ...(activeCorps.uniforms.accessories || {}),
          gauntlets: { ...DEFAULT_UNIFORM.accessories.gauntlets, ...(activeCorps.uniforms.accessories?.gauntlets || {}) },
          epaulets: { ...DEFAULT_UNIFORM.accessories.epaulets, ...(activeCorps.uniforms.accessories?.epaulets || {}) },
          sash: { ...DEFAULT_UNIFORM.accessories.sash, ...(activeCorps.uniforms.accessories?.sash || {}) },
          capelets: { ...DEFAULT_UNIFORM.accessories.capelets, ...(activeCorps.uniforms.accessories?.capelets || {}) },
          overlay: { ...DEFAULT_UNIFORM.accessories.overlay, ...(activeCorps.uniforms.accessories?.overlay || {}) }
        },
        lighting: { ...DEFAULT_UNIFORM.lighting, ...(activeCorps.uniforms.lighting || {}) }
      };
      setUniformConfig(mergedUniform);
    } else {
      setUniformConfig(DEFAULT_UNIFORM);
    }
  }, [activeCorps?.id]);

  useEffect(() => {
    fetchUnlockStatus();
  }, [userProfile?.xp, userProfile?.corpsCoin]);

  const fetchUnlockStatus = async () => {
    try {
      setIsLoadingStatus(true);
      const getUnlockStatus = httpsCallable(functions, 'getUniformUnlockStatus');
      const result = await getUnlockStatus();
      
      if (result.data.success) {
        setUnlockStatus(result.data.unlockStatus || {});
      }
    } catch (error) {
      console.error('Error fetching unlock status:', error);
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

  const handlePurchaseFeature = async (feature) => {
    const requirement = FEATURE_REQUIREMENTS[feature];
    
    if (!window.confirm(`Purchase ${feature} for ${requirement.corpsCoin} CorpsCoin?`)) {
      return;
    }

    try {
      const purchaseFunction = httpsCallable(functions, 'purchaseUniformFeature');
      const result = await purchaseFunction({
        feature: feature,
        cost: requirement.corpsCoin
      });

      if (result.data.success) {
        toast.success(result.data.message);
        await fetchUnlockStatus();
      } else {
        toast.error(result.data.message || 'Purchase failed');
      }
    } catch (error) {
      console.error('Error purchasing feature:', error);
      toast.error(error.message || 'Failed to purchase feature');
    }
  };

  const handleSaveUniform = async () => {
    setIsSaving(true);

    try {
      const updateCorpsFunction = httpsCallable(functions, 'updateCorps');
      const result = await updateCorpsFunction({
        corpsId: activeCorps.id,
        updates: {
          uniforms: uniformConfig
        }
      });

      if (result.data.success) {
        toast.success('Uniform saved successfully!');
      } else {
        toast.error(result.data.message || 'Failed to save uniform');
      }
    } catch (error) {
      console.error('Error saving uniform:', error);
      toast.error(error.message || 'Failed to save uniform');
    } finally {
      setIsSaving(false);
    }
  };

  const updateUniformPart = (section, key, value) => {
    setUniformConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }));
  };

  const updateAccessory = (accessory, key, value) => {
    setUniformConfig(prev => ({
      ...prev,
      accessories: {
        ...prev.accessories,
        [accessory]: {
          ...prev.accessories[accessory],
          [key]: value
        }
      }
    }));
  };

  const FeatureLockBadge = ({ feature }) => {
    const locked = !isUnlocked(feature);
    const canPurchase = canPurchaseWithCoin(feature);
    const requirement = FEATURE_REQUIREMENTS[feature];

    if (!locked) {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-green-500 bg-green-500/10 px-2 py-1 rounded">
          <Check className="w-3 h-3" />
          Unlocked
        </span>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 text-xs text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded">
          <Lock className="w-3 h-3" />
          {requirement.xp} XP
        </span>
        {canPurchase && (
          <button
            onClick={() => handlePurchaseFeature(feature)}
            className="inline-flex items-center gap-1 text-xs text-primary dark:text-primary-dark hover:text-primary-dark dark:hover:text-primary bg-primary/10 dark:bg-primary-dark/10 px-2 py-1 rounded transition-colors"
            title={`Purchase for ${requirement.corpsCoin} CorpsCoin`}
          >
            <ShoppingCart className="w-3 h-3" />
            {requirement.corpsCoin}
          </button>
        )}
      </div>
    );
  };

  const tabs = [
    { id: 'jacket', label: 'Jacket', icon: Shirt },
    { id: 'pants', label: 'Pants', icon: Footprints },
    { id: 'shako', label: 'Shako', icon: Crown },
    { id: 'accessories', label: 'Extras', icon: Sparkles }
  ];

  if (!activeCorps) {
    return (
      <div className="text-center py-12">
        <Target className="w-16 h-16 mx-auto text-text-secondary dark:text-text-secondary-dark mb-4" />
        <h3 className="text-xl font-semibold text-text-primary dark:text-text-primary-dark mb-2">
          No Corps Selected
        </h3>
        <p className="text-text-secondary dark:text-text-secondary-dark">
          Please create or select a corps to design uniforms.
        </p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Compact Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-bold text-text-primary dark:text-text-primary-dark">
            Uniform Designer
          </h2>
          <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
            {activeCorps.corpsName}
          </p>
        </div>

        <button
          onClick={handleSaveUniform}
          disabled={isSaving}
          className="w-full sm:w-auto px-6 py-2 bg-primary dark:bg-primary-dark hover:bg-primary-dark dark:hover:bg-primary text-white rounded-theme font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              Save
            </>
          )}
        </button>
      </div>

      {/* Resource Display */}
      <div className="flex items-center gap-3 text-sm bg-surface dark:bg-surface-dark p-3 rounded-theme border border-accent dark:border-accent-dark">
        <div className="flex items-center gap-1">
          <Star className="w-4 h-4 text-yellow-500" />
          <span className="font-semibold">{userProfile?.xp || 0} XP</span>
        </div>
        <div className="flex items-center gap-1">
          <Coins className="w-4 h-4 text-yellow-500" />
          <span className="font-semibold">{userProfile?.corpsCoin?.toLocaleString() || 0}</span>
        </div>
      </div>

      {/* Compact Preview */}
      <div className="bg-surface dark:bg-surface-dark p-4 rounded-theme border border-accent dark:border-accent-dark">
        <h3 className="font-bold text-text-primary dark:text-text-primary-dark mb-3 text-sm">
          Preview
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <div className="text-xs text-text-secondary dark:text-text-secondary-dark">Jacket</div>
            <div 
              className="w-full h-16 rounded border-2"
              style={{ 
                backgroundColor: uniformConfig.jacket.baseColor,
                borderColor: uniformConfig.jacket.trim1Color
              }}
            />
          </div>
          <div className="space-y-1">
            <div className="text-xs text-text-secondary dark:text-text-secondary-dark">Pants</div>
            <div 
              className="w-full h-16 rounded border-2"
              style={{ 
                backgroundColor: uniformConfig.pants.baseColor,
                borderColor: uniformConfig.pants.stripeColor
              }}
            />
          </div>
          <div className="space-y-1">
            <div className="text-xs text-text-secondary dark:text-text-secondary-dark">Shako</div>
            <div 
              className="w-full h-16 rounded border-2"
              style={{ 
                backgroundColor: uniformConfig.shako.baseColor,
                borderColor: uniformConfig.shako.plumeColor
              }}
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-2 pb-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-theme font-semibold whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-primary dark:bg-primary-dark text-white'
                : 'bg-surface dark:bg-surface-dark text-text-secondary dark:text-text-secondary-dark border border-accent dark:border-accent-dark'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-surface dark:bg-surface-dark rounded-theme border border-accent dark:border-accent-dark p-4 space-y-4">
        {activeTab === 'jacket' && (
          <>
            <h3 className="font-bold text-text-primary dark:text-text-primary-dark">Jacket</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                  Base Color
                </label>
                <input
                  type="color"
                  value={uniformConfig.jacket.baseColor}
                  onChange={(e) => updateUniformPart('jacket', 'baseColor', e.target.value)}
                  className="w-full h-10 rounded border border-accent dark:border-accent-dark cursor-pointer"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                  Trim
                </label>
                <input
                  type="color"
                  value={uniformConfig.jacket.trim1Color}
                  onChange={(e) => updateUniformPart('jacket', 'trim1Color', e.target.value)}
                  className="w-full h-10 rounded border border-accent dark:border-accent-dark cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                  Buttons
                </label>
                <input
                  type="color"
                  value={uniformConfig.jacket.buttonColor}
                  onChange={(e) => updateUniformPart('jacket', 'buttonColor', e.target.value)}
                  className="w-full h-10 rounded border border-accent dark:border-accent-dark cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                  Style
                </label>
                <select
                  value={uniformConfig.jacket.frontStyle}
                  onChange={(e) => updateUniformPart('jacket', 'frontStyle', e.target.value)}
                  className="w-full p-2 bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded text-text-primary dark:text-text-primary-dark"
                >
                  <option value="doubleBreasted">Double</option>
                  <option value="singleBreasted">Single</option>
                  <option value="asymmetric">Asymmetric</option>
                  <option value="zippered">Zippered</option>
                </select>
              </div>
            </div>
          </>
        )}

        {activeTab === 'pants' && (
          <>
            <h3 className="font-bold text-text-primary dark:text-text-primary-dark">Pants</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                  Base Color
                </label>
                <input
                  type="color"
                  value={uniformConfig.pants.baseColor}
                  onChange={(e) => updateUniformPart('pants', 'baseColor', e.target.value)}
                  className="w-full h-10 rounded border border-accent dark:border-accent-dark cursor-pointer"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                  Stripe
                </label>
                <input
                  type="color"
                  value={uniformConfig.pants.stripeColor}
                  onChange={(e) => updateUniformPart('pants', 'stripeColor', e.target.value)}
                  className="w-full h-10 rounded border border-accent dark:border-accent-dark cursor-pointer"
                />
              </div>
            </div>
          </>
        )}

        {activeTab === 'shako' && (
          <>
            <h3 className="font-bold text-text-primary dark:text-text-primary-dark">Shako</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                  Base
                </label>
                <input
                  type="color"
                  value={uniformConfig.shako.baseColor}
                  onChange={(e) => updateUniformPart('shako', 'baseColor', e.target.value)}
                  className="w-full h-10 rounded border border-accent dark:border-accent-dark cursor-pointer"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                  Plume
                </label>
                <input
                  type="color"
                  value={uniformConfig.shako.plumeColor}
                  onChange={(e) => updateUniformPart('shako', 'plumeColor', e.target.value)}
                  className="w-full h-10 rounded border border-accent dark:border-accent-dark cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                  Badge
                </label>
                <input
                  type="color"
                  value={uniformConfig.shako.badgeColor}
                  onChange={(e) => updateUniformPart('shako', 'badgeColor', e.target.value)}
                  className="w-full h-10 rounded border border-accent dark:border-accent-dark cursor-pointer"
                />
              </div>
            </div>
          </>
        )}

        {activeTab === 'accessories' && (
          <>
            <h3 className="font-bold text-text-primary dark:text-text-primary-dark mb-3">
              Premium Accessories
            </h3>

            {isLoadingStatus ? (
              <LoadingScreen fullScreen={false} />
            ) : (
              <div className="space-y-3">
                {Object.entries(uniformConfig.accessories).map(([key, value]) => {
                  const locked = !isUnlocked(key);
                  
                  return (
                    <div key={key} className="p-3 bg-background dark:bg-background-dark rounded-theme border border-accent dark:border-accent-dark">
                      <div className="flex items-center justify-between mb-2">
                        <label className="font-medium text-text-primary dark:text-text-primary-dark capitalize text-sm">
                          {key}
                        </label>
                        <FeatureLockBadge feature={key} />
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={value.enabled}
                          onChange={(e) => updateAccessory(key, 'enabled', e.target.checked)}
                          disabled={locked}
                          className="w-5 h-5 rounded border-accent dark:border-accent-dark"
                        />
                        <input
                          type="color"
                          value={value.color}
                          onChange={(e) => updateAccessory(key, 'color', e.target.value)}
                          disabled={locked || !value.enabled}
                          className="flex-1 h-10 rounded border border-accent dark:border-accent-dark cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      </div>
                    </div>
                  );
                })}

                {/* LED Lighting */}
                <div className="p-3 bg-background dark:bg-background-dark rounded-theme border border-accent dark:border-accent-dark">
                  <div className="flex items-center justify-between mb-2">
                    <label className="font-medium text-text-primary dark:text-text-primary-dark text-sm">
                      LED Lighting
                    </label>
                    <FeatureLockBadge feature="ledLighting" />
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={uniformConfig.lighting.enabled}
                      onChange={(e) => setUniformConfig(prev => ({
                        ...prev,
                        lighting: { ...prev.lighting, enabled: e.target.checked }
                      }))}
                      disabled={!isUnlocked('ledLighting')}
                      className="w-5 h-5 rounded border-accent dark:border-accent-dark"
                    />
                    <input
                      type="color"
                      value={uniformConfig.lighting.color}
                      onChange={(e) => setUniformConfig(prev => ({
                        ...prev,
                        lighting: { ...prev.lighting, color: e.target.value }
                      }))}
                      disabled={!isUnlocked('ledLighting') || !uniformConfig.lighting.enabled}
                      className="flex-1 h-10 rounded border border-accent dark:border-accent-dark cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Info */}
      <div className="bg-primary/5 dark:bg-primary-dark/5 border border-primary dark:border-primary-dark rounded-theme p-3">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-primary dark:text-primary-dark flex-shrink-0 mt-0.5" />
          <p className="text-xs text-text-secondary dark:text-text-secondary-dark">
            Basic colors are free. Premium features unlock with XP or CorpsCoin.
          </p>
        </div>
      </div>
    </div>
  );
};

export default UniformBuilder;