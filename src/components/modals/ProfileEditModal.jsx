// =============================================================================
// PROFILE EDIT MODAL
// =============================================================================
// Edit director-level profile (bio, specialties, socials) and per-ensemble
// identity (mission, history, motto) — all preserved across seasons.

import React, { useState, useMemo } from 'react';
import { X, User, Music, Link as LinkIcon, MapPin } from 'lucide-react';
import Portal from '../Portal';
import { useEscapeKey } from '../../hooks/useEscapeKey';

const CLASS_LABELS = {
  world: 'World Class',
  open: 'Open Class',
  aClass: 'Class A',
  soundSport: 'SoundSport',
};

const CLASS_ORDER = ['world', 'open', 'aClass', 'soundSport'];

const SPECIALTY_OPTIONS = [
  'General Effect',
  'Visual',
  'Music',
  'Brass',
  'Percussion',
  'Color Guard',
  'Drill Design',
  'Show Design',
  'Teaching',
];

const TabButton = ({ active, onClick, icon: Icon, label }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex-1 min-w-0 py-2.5 px-2 text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 ${
      active
        ? 'text-white border-b-2 border-[#0057B8]'
        : 'text-gray-500 hover:text-gray-300 border-b-2 border-transparent'
    }`}
  >
    <Icon className="w-3.5 h-3.5" />
    <span className="truncate">{label}</span>
  </button>
);

const Field = ({ label, hint, children, count }) => (
  <div>
    <div className="flex items-center justify-between mb-1">
      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">
        {label}
      </label>
      {count != null && (
        <span className="text-[10px] text-gray-600 font-data tabular-nums">{count}</span>
      )}
    </div>
    {children}
    {hint && <p className="text-[10px] text-gray-600 mt-1">{hint}</p>}
  </div>
);

const TextInput = (props) => (
  <input
    {...props}
    className="w-full h-10 px-3 bg-[#0a0a0a] border border-[#333] rounded-sm text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0057B8]"
  />
);

const TextArea = ({ rows = 3, ...props }) => (
  <textarea
    rows={rows}
    {...props}
    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#333] rounded-sm text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0057B8] resize-none"
  />
);

const ProfileEditModal = ({ profile, onClose, onSave }) => {
  useEscapeKey(onClose);

  const availableCorps = useMemo(() => {
    if (!profile?.corps) return [];
    return CLASS_ORDER
      .filter((cls) => profile.corps[cls]?.corpsName)
      .map((cls) => ({ classKey: cls, ...profile.corps[cls] }));
  }, [profile?.corps]);

  const [activeTab, setActiveTab] = useState('director');
  const [activeEnsembleClass, setActiveEnsembleClass] = useState(
    availableCorps[0]?.classKey || null
  );
  const [saving, setSaving] = useState(false);

  // Director-level state
  const [director, setDirector] = useState({
    displayName: profile?.displayName || '',
    location: profile?.location || '',
    bio: profile?.directorInfo?.bio || '',
    yearsDirecting: profile?.directorInfo?.yearsDirecting || '',
    specialties: profile?.directorInfo?.specialties || [],
    credentials: profile?.directorInfo?.credentials || '',
    acceptingLeagueInvites: profile?.directorInfo?.acceptingLeagueInvites ?? true,
  });

  const [socials, setSocials] = useState({
    website: profile?.directorInfo?.socialLinks?.website || '',
    twitter: profile?.directorInfo?.socialLinks?.twitter || '',
    instagram: profile?.directorInfo?.socialLinks?.instagram || '',
    youtube: profile?.directorInfo?.socialLinks?.youtube || '',
    tiktok: profile?.directorInfo?.socialLinks?.tiktok || '',
    facebook: profile?.directorInfo?.socialLinks?.facebook || '',
    discord: profile?.directorInfo?.socialLinks?.discord || '',
  });

  // Ensemble-level state (per corps)
  const initialEnsembles = useMemo(() => {
    const out = {};
    availableCorps.forEach((corps) => {
      const info = corps.ensembleInfo || {};
      out[corps.classKey] = {
        tagline: info.tagline || '',
        mission: info.mission || '',
        history: info.history || '',
        foundedYear: info.foundedYear || '',
        homeVenue: info.homeVenue || '',
        motto: info.motto || '',
        notableShows: (info.notableShows || []).join('\n'),
      };
    });
    return out;
  }, [availableCorps]);

  const [ensembles, setEnsembles] = useState(initialEnsembles);

  const updateEnsembleField = (classKey, field, value) => {
    setEnsembles((prev) => ({
      ...prev,
      [classKey]: { ...prev[classKey], [field]: value },
    }));
  };

  const toggleSpecialty = (specialty) => {
    setDirector((prev) => ({
      ...prev,
      specialties: prev.specialties.includes(specialty)
        ? prev.specialties.filter((s) => s !== specialty)
        : [...prev.specialties, specialty],
    }));
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    setSaving(true);
    try {
      // Build directorInfo, stripping empty strings
      const trimmedSocials = Object.fromEntries(
        Object.entries(socials)
          .map(([k, v]) => [k, (v || '').trim()])
          .filter(([, v]) => v)
      );

      const directorInfo = {
        bio: director.bio.trim(),
        yearsDirecting: director.yearsDirecting === ''
          ? null
          : Number(director.yearsDirecting) || 0,
        specialties: director.specialties,
        credentials: director.credentials.trim(),
        acceptingLeagueInvites: !!director.acceptingLeagueInvites,
        socialLinks: trimmedSocials,
      };

      // Build ensembleInfo payloads per corps
      const ensemblePayloads = {};
      Object.entries(ensembles).forEach(([classKey, data]) => {
        ensemblePayloads[classKey] = {
          tagline: data.tagline.trim(),
          mission: data.mission.trim(),
          history: data.history.trim(),
          foundedYear: data.foundedYear === ''
            ? null
            : Number(data.foundedYear) || null,
          homeVenue: data.homeVenue.trim(),
          motto: data.motto.trim(),
          notableShows: data.notableShows
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 20),
        };
      });

      await onSave({
        displayName: director.displayName.trim(),
        location: director.location.trim(),
        directorInfo,
        ensembleInfo: ensemblePayloads,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const currentEnsemble = activeEnsembleClass ? ensembles[activeEnsembleClass] : null;

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100] bg-black/80 flex items-end sm:items-center justify-center p-0 sm:p-4"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title-edit-profile"
      >
        <div
          className="w-full sm:max-w-lg bg-[#1a1a1a] border-t sm:border border-[#333] rounded-t-xl sm:rounded-sm max-h-[92vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Drag handle - mobile only */}
          <div className="sm:hidden flex justify-center py-2">
            <div className="w-8 h-1 bg-gray-600 rounded-full" />
          </div>

          <div className="flex items-center justify-between px-4 py-3 border-b border-[#333] bg-[#222]">
            <h2
              id="modal-title-edit-profile"
              className="text-xs font-bold uppercase tracking-wider text-gray-300"
            >
              Edit Profile
            </h2>
            <button
              onClick={onClose}
              className="p-1 text-gray-500 hover:text-white"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex border-b border-[#333] shrink-0 overflow-x-auto">
            <TabButton
              active={activeTab === 'director'}
              onClick={() => setActiveTab('director')}
              icon={User}
              label="Director"
            />
            <TabButton
              active={activeTab === 'social'}
              onClick={() => setActiveTab('social')}
              icon={LinkIcon}
              label="Social"
            />
            <TabButton
              active={activeTab === 'ensemble'}
              onClick={() => setActiveTab('ensemble')}
              icon={Music}
              label="Ensembles"
            />
          </div>

          <form onSubmit={handleSave} className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto scroll-momentum p-4 space-y-4">
              {activeTab === 'director' && (
                <>
                  <Field label="Display Name">
                    <TextInput
                      type="text"
                      value={director.displayName}
                      onChange={(e) =>
                        setDirector({ ...director, displayName: e.target.value })
                      }
                      maxLength={50}
                      placeholder="Your name"
                    />
                  </Field>

                  <Field label="Location" hint="Helps other directors find you">
                    <TextInput
                      type="text"
                      value={director.location}
                      onChange={(e) =>
                        setDirector({ ...director, location: e.target.value })
                      }
                      maxLength={80}
                      placeholder="City, State"
                    />
                  </Field>

                  <Field
                    label="Bio / Directing Philosophy"
                    count={`${director.bio.length}/500`}
                    hint="A short intro for other directors who visit your profile"
                  >
                    <TextArea
                      rows={4}
                      value={director.bio}
                      onChange={(e) =>
                        setDirector({ ...director, bio: e.target.value.slice(0, 500) })
                      }
                      placeholder="Tell the community about your approach to directing, what you value, and what you're trying to build..."
                    />
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Years Directing">
                      <TextInput
                        type="number"
                        min="0"
                        max="80"
                        value={director.yearsDirecting}
                        onChange={(e) =>
                          setDirector({ ...director, yearsDirecting: e.target.value })
                        }
                        placeholder="0"
                      />
                    </Field>
                    <Field label="Accepting Invites" hint="Leagues can invite you">
                      <button
                        type="button"
                        onClick={() =>
                          setDirector((p) => ({
                            ...p,
                            acceptingLeagueInvites: !p.acceptingLeagueInvites,
                          }))
                        }
                        className={`w-full h-10 px-3 border text-sm font-bold uppercase tracking-wider ${
                          director.acceptingLeagueInvites
                            ? 'bg-[#0057B8]/15 border-[#0057B8]/40 text-[#0057B8]'
                            : 'bg-[#0a0a0a] border-[#333] text-gray-500'
                        }`}
                      >
                        {director.acceptingLeagueInvites ? 'Open' : 'Closed'}
                      </button>
                    </Field>
                  </div>

                  <Field label="Specialties" hint="Select all that apply">
                    <div className="flex flex-wrap gap-1.5">
                      {SPECIALTY_OPTIONS.map((s) => {
                        const active = director.specialties.includes(s);
                        return (
                          <button
                            type="button"
                            key={s}
                            onClick={() => toggleSpecialty(s)}
                            className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border ${
                              active
                                ? 'bg-[#0057B8]/15 border-[#0057B8]/40 text-[#0057B8]'
                                : 'bg-[#0a0a0a] border-[#333] text-gray-500 hover:text-gray-300'
                            }`}
                          >
                            {s}
                          </button>
                        );
                      })}
                    </div>
                  </Field>

                  <Field
                    label="Credentials / Background"
                    count={`${director.credentials.length}/300`}
                  >
                    <TextArea
                      rows={2}
                      value={director.credentials}
                      onChange={(e) =>
                        setDirector({
                          ...director,
                          credentials: e.target.value.slice(0, 300),
                        })
                      }
                      placeholder="Education, marching experience, certifications..."
                    />
                  </Field>
                </>
              )}

              {activeTab === 'social' && (
                <>
                  <p className="text-[11px] text-gray-500">
                    Only fields you fill in will be shown publicly on your profile.
                  </p>
                  <Field label="Website">
                    <TextInput
                      type="url"
                      value={socials.website}
                      onChange={(e) => setSocials({ ...socials, website: e.target.value })}
                      placeholder="https://..."
                    />
                  </Field>
                  <Field label="Twitter / X">
                    <TextInput
                      type="text"
                      value={socials.twitter}
                      onChange={(e) => setSocials({ ...socials, twitter: e.target.value })}
                      placeholder="@handle or URL"
                    />
                  </Field>
                  <Field label="Instagram">
                    <TextInput
                      type="text"
                      value={socials.instagram}
                      onChange={(e) =>
                        setSocials({ ...socials, instagram: e.target.value })
                      }
                      placeholder="@handle or URL"
                    />
                  </Field>
                  <Field label="YouTube">
                    <TextInput
                      type="text"
                      value={socials.youtube}
                      onChange={(e) => setSocials({ ...socials, youtube: e.target.value })}
                      placeholder="Channel URL"
                    />
                  </Field>
                  <Field label="TikTok">
                    <TextInput
                      type="text"
                      value={socials.tiktok}
                      onChange={(e) => setSocials({ ...socials, tiktok: e.target.value })}
                      placeholder="@handle or URL"
                    />
                  </Field>
                  <Field label="Facebook">
                    <TextInput
                      type="text"
                      value={socials.facebook}
                      onChange={(e) =>
                        setSocials({ ...socials, facebook: e.target.value })
                      }
                      placeholder="Page URL"
                    />
                  </Field>
                  <Field label="Discord">
                    <TextInput
                      type="text"
                      value={socials.discord}
                      onChange={(e) => setSocials({ ...socials, discord: e.target.value })}
                      placeholder="Username or invite link"
                    />
                  </Field>
                </>
              )}

              {activeTab === 'ensemble' && (
                <>
                  {availableCorps.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-8">
                      You don&apos;t have any active ensembles yet. Register a corps on your
                      dashboard to add ensemble details.
                    </p>
                  ) : (
                    <>
                      <div className="flex gap-1.5 flex-wrap">
                        {availableCorps.map((corps) => (
                          <button
                            type="button"
                            key={corps.classKey}
                            onClick={() => setActiveEnsembleClass(corps.classKey)}
                            className={`px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider border ${
                              activeEnsembleClass === corps.classKey
                                ? 'bg-[#0057B8]/15 border-[#0057B8]/40 text-[#0057B8]'
                                : 'bg-[#0a0a0a] border-[#333] text-gray-500 hover:text-gray-300'
                            }`}
                          >
                            {corps.corpsName}
                            <span className="ml-1.5 opacity-60">
                              {CLASS_LABELS[corps.classKey]}
                            </span>
                          </button>
                        ))}
                      </div>

                      {currentEnsemble && (
                        <div className="space-y-4 pt-2 border-t border-[#333]">
                          <Field label="Tagline" count={`${currentEnsemble.tagline.length}/80`}>
                            <TextInput
                              type="text"
                              value={currentEnsemble.tagline}
                              onChange={(e) =>
                                updateEnsembleField(
                                  activeEnsembleClass,
                                  'tagline',
                                  e.target.value.slice(0, 80)
                                )
                              }
                              placeholder="A one-liner about your ensemble"
                            />
                          </Field>

                          <Field
                            label="Mission / Purpose"
                            count={`${currentEnsemble.mission.length}/500`}
                            hint="What is this ensemble trying to achieve?"
                          >
                            <TextArea
                              rows={3}
                              value={currentEnsemble.mission}
                              onChange={(e) =>
                                updateEnsembleField(
                                  activeEnsembleClass,
                                  'mission',
                                  e.target.value.slice(0, 500)
                                )
                              }
                              placeholder="Describe your ensemble's identity, goals, and artistic direction..."
                            />
                          </Field>

                          <Field
                            label="History"
                            count={`${currentEnsemble.history.length}/1000`}
                            hint="Where did this ensemble come from? What's the story?"
                          >
                            <TextArea
                              rows={5}
                              value={currentEnsemble.history}
                              onChange={(e) =>
                                updateEnsembleField(
                                  activeEnsembleClass,
                                  'history',
                                  e.target.value.slice(0, 1000)
                                )
                              }
                              placeholder="Share the backstory, founding moment, key seasons, and milestones..."
                            />
                          </Field>

                          <div className="grid grid-cols-2 gap-3">
                            <Field label="Founded">
                              <TextInput
                                type="number"
                                min="1900"
                                max="2100"
                                value={currentEnsemble.foundedYear}
                                onChange={(e) =>
                                  updateEnsembleField(
                                    activeEnsembleClass,
                                    'foundedYear',
                                    e.target.value
                                  )
                                }
                                placeholder="Year"
                              />
                            </Field>
                            <Field label="Home Venue">
                              <TextInput
                                type="text"
                                value={currentEnsemble.homeVenue}
                                onChange={(e) =>
                                  updateEnsembleField(
                                    activeEnsembleClass,
                                    'homeVenue',
                                    e.target.value.slice(0, 80)
                                  )
                                }
                                placeholder="Stadium / field"
                              />
                            </Field>
                          </div>

                          <Field label="Motto" count={`${currentEnsemble.motto.length}/80`}>
                            <TextInput
                              type="text"
                              value={currentEnsemble.motto}
                              onChange={(e) =>
                                updateEnsembleField(
                                  activeEnsembleClass,
                                  'motto',
                                  e.target.value.slice(0, 80)
                                )
                              }
                              placeholder='e.g. "Strength in Unity"'
                            />
                          </Field>

                          <Field
                            label="Notable Shows"
                            hint="One show per line — e.g. 'Metamorphosis (2024)'"
                          >
                            <TextArea
                              rows={4}
                              value={currentEnsemble.notableShows}
                              onChange={(e) =>
                                updateEnsembleField(
                                  activeEnsembleClass,
                                  'notableShows',
                                  e.target.value
                                )
                              }
                              placeholder={'Metamorphosis (2024)\nRebirth (2023)'}
                            />
                          </Field>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>

            <div className="px-4 py-3 border-t border-[#333] bg-[#111] flex justify-end gap-2 shrink-0 safe-area-bottom">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="h-9 px-4 border border-[#333] text-gray-400 text-sm font-bold uppercase tracking-wider hover:border-[#444] hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="h-9 px-4 bg-[#0057B8] text-white text-sm font-bold uppercase tracking-wider hover:bg-[#0066d6] disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );
};

export default ProfileEditModal;
