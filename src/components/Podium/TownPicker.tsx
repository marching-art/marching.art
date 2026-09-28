// TownPicker — pick ANY real US or Canadian town, not only the historical show
// cities: a Podium corps' official home (design §5.3) and a director-hosted
// show's host city (§5.10) both use it. Search is local (the place index loads
// lazily on mount), so the typeahead is instant after the first paint; "Use my
// location" snaps to the nearest town. `unavailable` greys out towns that
// can't be picked (a host city already on the schedule) and lists them last.

import { useEffect, useId, useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Check, Loader2, LocateFixed, MapPin } from 'lucide-react';
import {
  exactPlaceMatches,
  loadPlaces,
  nearestPlace,
  searchPlaces,
  type HomePlace,
} from '../../utils/places';

// Cap the rendered dropdown; a real search narrows well below this.
const RESULTS_LIMIT = 40;

export type SelectedHome = Pick<HomePlace, 'city' | 'region' | 'label' | 'lat' | 'lng' | 'venueId'>;

interface TownPickerProps {
  query: string;
  onQueryChange: (query: string) => void;
  selected: SelectedHome | null;
  /** A pick from the list or the device location; null when the text is edited. */
  onSelect: (home: SelectedHome | null) => void;
  label?: string;
  placeholder?: string;
  /** Badge on tour-map cities (null hides it). */
  tourBadge?: string | null;
  /** Why a town can't be picked (shown as its badge), or null when it can. */
  unavailable?: (place: HomePlace) => string | null;
}

export default function TownPicker({
  query,
  onQueryChange,
  selected,
  onSelect,
  label = 'Hometown',
  placeholder = 'Any US or Canadian town (e.g., Brownsburg, IN)',
  tourBadge = 'Show city',
  unavailable,
}: TownPickerProps) {
  const listId = useId();
  const [places, setPlaces] = useState<HomePlace[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    loadPlaces()
      .then((rows) => live && setPlaces(rows))
      .catch(() => live && setLoadError(true));
    return () => {
      live = false;
    };
  }, []);

  // Pickable towns first, unavailable ones after (still listed, so a director
  // sees WHY their town isn't offered).
  const results = useMemo(() => {
    if (!places) return [];
    const rows = searchPlaces(places, query, RESULTS_LIMIT);
    if (!unavailable) return rows;
    return [...rows.filter((p) => !unavailable(p)), ...rows.filter((p) => unavailable(p))];
  }, [places, query, unavailable]);

  // A prefilled home that arrives as text only (a legacy free-typed hometown):
  // once the towns load, adopt it if it names exactly one real town.
  useEffect(() => {
    if (!places || selected || !query.trim()) return;
    const exact = exactPlaceMatches(places, query);
    if (exact.length === 1 && !unavailable?.(exact[0])) {
      onSelect(exact[0]);
      onQueryChange(exact[0].label);
    }
    // Only on load — later edits are the director's own typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places]);

  const pick = (place: HomePlace) => {
    if (unavailable?.(place)) return;
    onSelect(place);
    onQueryChange(place.label);
    setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => Math.max(0, Math.min(results.length - 1, i + step)));
    } else if (e.key === 'Enter' && open && results[active] && !unavailable?.(results[active])) {
      e.preventDefault();
      pick(results[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const canLocate = typeof navigator !== 'undefined' && 'geolocation' in navigator;
  const useMyLocation = () => {
    if (!canLocate) return;
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const rows = places || (await loadPlaces());
          const near = nearestPlace(rows, pos.coords.latitude, pos.coords.longitude);
          if (near && unavailable?.(near)) {
            setLocateError(`${near.label} can't be picked (${unavailable(near)}).`);
          } else if (near) pick(near);
          else setLocateError('No town found near you — search instead.');
        } catch {
          setLocateError('Could not load the town list — search instead.');
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        setLocateError('Location unavailable — search for your town instead.');
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
    );
  };

  const activeId = open && results[active] ? `${listId}-${active}` : undefined;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label
          htmlFor={`${listId}-input`}
          className="block text-[10px] font-bold uppercase tracking-wider text-muted"
        >
          {label}
        </label>
        {canLocate && (
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-interactive hover:underline disabled:opacity-50"
          >
            {locating ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <LocateFixed className="w-3 h-3" />
            )}
            Use my location
          </button>
        )}
      </div>
      <div className="relative">
        <div className="relative">
          <MapPin className="w-3.5 h-3.5 text-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id={`${listId}-input`}
            value={query}
            onChange={(e) => {
              onQueryChange(e.target.value);
              onSelect(null);
              setActive(0);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            // Delay so a click on a result registers before the list closes.
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            autoComplete="off"
            role="combobox"
            aria-expanded={open}
            aria-controls={`${listId}-list`}
            aria-activedescendant={activeId}
            aria-autocomplete="list"
            className="w-full bg-surface-sunken border border-line rounded-none pl-8 pr-8 py-2 text-sm text-white placeholder-muted focus:border-interactive outline-none"
          />
          {selected && (
            <Check className="w-3.5 h-3.5 text-green-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          )}
        </div>
        {open && (
          <div
            id={`${listId}-list`}
            role="listbox"
            className="absolute z-20 mt-1 w-full max-h-52 overflow-y-auto bg-surface-sunken border border-line rounded-none"
          >
            {!places && !loadError ? (
              <div className="px-2 py-1.5 text-[10px] text-muted inline-flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" /> Loading towns…
              </div>
            ) : loadError ? (
              <div className="px-2 py-1.5 text-[10px] text-red-400">
                Couldn&apos;t load the town list — check your connection and reload.
              </div>
            ) : results.length === 0 ? (
              <div className="px-2 py-1.5 text-[10px] text-muted">
                No town by that name — try the nearest larger town, or add the state (e.g.,
                &quot;Springfield, MO&quot;).
              </div>
            ) : (
              results.map((place, index) => {
                const blocked = unavailable?.(place) || null;
                return (
                  <button
                    key={`${place.label}-${index}`}
                    id={`${listId}-${index}`}
                    type="button"
                    role="option"
                    aria-selected={index === active}
                    aria-disabled={Boolean(blocked)}
                    // onMouseDown fires before the input's onBlur, so the pick
                    // lands even though blur closes the list.
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(place);
                    }}
                    onMouseEnter={() => setActive(index)}
                    className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 text-[11px] text-left ${
                      blocked
                        ? 'text-muted cursor-not-allowed'
                        : 'text-secondary hover:bg-surface-card'
                    } ${index === active ? 'bg-surface-card' : ''}`}
                  >
                    <span className="truncate">{place.label}</span>
                    {blocked ? (
                      <span className="shrink-0 text-[9px] uppercase tracking-wider text-muted">
                        {blocked}
                      </span>
                    ) : (
                      place.venueId &&
                      tourBadge && (
                        <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-interactive">
                          {tourBadge}
                        </span>
                      )
                    )}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
      {locateError && <p className="text-[10px] text-red-400 mt-1">{locateError}</p>}
    </div>
  );
}
