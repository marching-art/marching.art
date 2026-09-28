/**
 * Hometown search — any real US or Canadian town, not just tour-map cities.
 *
 * Backed by src/data/placeIndex.json (functions/src/scripts/buildPlaceIndex.js,
 * GeoNames cities500): the ~500 tour-map cities that host shows, then ~22k
 * other towns, largest first. The server resolves the same label through the
 * same data (helpers/podium/venues.js `venueFor`: tour map first, then the
 * place index), so anything this picker offers is accepted at registration.
 *
 * The data file is ~250 KB gzipped, so it's DYNAMICALLY imported the first time
 * a director opens the hometown box — it never lands in the main bundle.
 */

export interface HomePlace {
  city: string;
  region: string;
  /** Canonical "City, ST" — the exact string sent to the server. */
  label: string;
  lat: number;
  lng: number;
  /** The tour-map venueId when this city hosts shows; null for other towns. */
  venueId: string | null;
  /** Folded "city" used for matching (lowercase, no accents/periods, St/Mt/Ft). */
  key: string;
}

interface PlaceIndexData {
  tour: Array<Array<string | number>>;
  towns: string;
}

// Region code -> full name, so "canton, ohio" and "canton ohio" narrow by state.
const REGION_NAMES: Record<string, string> = {
  AL: 'alabama', AK: 'alaska', AZ: 'arizona', AR: 'arkansas', CA: 'california',
  CO: 'colorado', CT: 'connecticut', DE: 'delaware', FL: 'florida', GA: 'georgia',
  HI: 'hawaii', ID: 'idaho', IL: 'illinois', IN: 'indiana', IA: 'iowa',
  KS: 'kansas', KY: 'kentucky', LA: 'louisiana', ME: 'maine', MD: 'maryland',
  MA: 'massachusetts', MI: 'michigan', MN: 'minnesota', MS: 'mississippi',
  MO: 'missouri', MT: 'montana', NE: 'nebraska', NV: 'nevada', NH: 'new hampshire',
  NJ: 'new jersey', NM: 'new mexico', NY: 'new york', NC: 'north carolina',
  ND: 'north dakota', OH: 'ohio', OK: 'oklahoma', OR: 'oregon', PA: 'pennsylvania',
  RI: 'rhode island', SC: 'south carolina', SD: 'south dakota', TN: 'tennessee',
  TX: 'texas', UT: 'utah', VT: 'vermont', VA: 'virginia', WA: 'washington',
  WV: 'west virginia', WI: 'wisconsin', WY: 'wyoming', DC: 'district of columbia',
  AB: 'alberta', BC: 'british columbia', MB: 'manitoba', NB: 'new brunswick',
  NL: 'newfoundland and labrador', NS: 'nova scotia', ON: 'ontario',
  PE: 'prince edward island', QC: 'quebec', SK: 'saskatchewan',
}; // prettier-ignore

/**
 * Fold text for matching: lowercase, strip accents and punctuation, and collapse
 * the Saint/St, Sainte/Ste, Mount/Mt, Fort/Ft spellings to one form, so
 * "St. Marys", "Saint Marys" and "st marys" all compare equal.
 */
export function foldPlaceText(text: string): string {
  return String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\bsaint\b/g, 'st')
    .replace(/\bsainte\b/g, 'ste')
    .replace(/\bmount\b/g, 'mt')
    .replace(/\bfort\b/g, 'ft')
    .replace(/\s+/g, ' ')
    .trim();
}

function makePlace(
  city: string,
  region: string,
  lat: number,
  lng: number,
  venueId: string | null
): HomePlace {
  return { city, region, label: `${city}, ${region}`, lat, lng, venueId, key: foldPlaceText(city) };
}

/** Decode the committed artifact into search rows (tour-map cities first). */
export function parsePlaceIndex(data: PlaceIndexData): HomePlace[] {
  const places: HomePlace[] = [];
  for (const [city, region, lat, lng, venueId] of data.tour) {
    places.push(makePlace(String(city), String(region), Number(lat), Number(lng), String(venueId)));
  }
  for (const row of data.towns ? data.towns.split(';') : []) {
    const [city, region, lat, lng] = row.split('|');
    if (!city || !region) continue;
    places.push(makePlace(city, region, Number(lat) / 100, Number(lng) / 100, null));
  }
  return places;
}

let loading: Promise<HomePlace[]> | null = null;

/** Load (once) and decode the place index. Rejections reset so a retry works. */
export function loadPlaces(): Promise<HomePlace[]> {
  if (!loading) {
    loading = import('../data/placeIndex.json')
      .then((mod) => parsePlaceIndex((mod.default ?? mod) as PlaceIndexData))
      .catch((err) => {
        loading = null;
        throw err;
      });
  }
  return loading;
}

/** Does a folded region query name this region (code, or a state-name prefix)? */
function regionMatches(region: string, regionQuery: string): boolean {
  if (!regionQuery) return true;
  if (region.toLowerCase() === regionQuery) return true;
  const name = REGION_NAMES[region];
  return Boolean(name && regionQuery.length >= 3 && name.startsWith(regionQuery));
}

/** Split "canton, oh" / "canton ohio" / "canton" into city + region parts. */
function splitQuery(raw: string): { city: string; region: string } {
  const comma = raw.indexOf(',');
  if (comma >= 0) {
    return {
      city: foldPlaceText(raw.slice(0, comma)),
      region: foldPlaceText(raw.slice(comma + 1)),
    };
  }
  const folded = foldPlaceText(raw);
  const words = folded.split(' ');
  // A trailing region with no comma: "canton oh", "springfield new jersey".
  for (let span = Math.min(4, words.length - 1); span >= 1; span--) {
    const tail = words.slice(-span).join(' ');
    const isCode = span === 1 && tail.length === 2 && tail.toUpperCase() in REGION_NAMES;
    const isName = Object.values(REGION_NAMES).includes(tail);
    if (isCode || isName) return { city: words.slice(0, -span).join(' '), region: tail };
  }
  return { city: folded, region: '' };
}

/**
 * Rank places for a typed query: exact city name, then city prefix, then a word
 * inside the name ("prairie" → Sun Prairie), then any substring. Within a rank
 * the data's order holds — tour-map cities first, then larger towns first — so
 * "springfield" leads with the Springfields people mean.
 */
export function searchPlaces(places: HomePlace[], query: string, limit = 40): HomePlace[] {
  const { city, region } = splitQuery(query);
  if (!city && !region) return places.filter((p) => p.venueId).slice(0, limit);
  const buckets: HomePlace[][] = [[], [], [], []];
  for (const place of places) {
    if (!regionMatches(place.region, region)) continue;
    const key = place.key;
    let rank = -1;
    if (!city || key === city) rank = 0;
    else if (key.startsWith(city)) rank = 1;
    else if (key.includes(` ${city}`)) rank = 2;
    else if (city.length >= 3 && key.includes(city)) rank = 3;
    if (rank < 0) continue;
    buckets[rank].push(place);
    // Exact + prefix matches alone can fill the list — stop scanning early.
    if (buckets[0].length + buckets[1].length >= limit) break;
  }
  return buckets.flat().slice(0, limit);
}

/**
 * The places a fully spelled "City, Region" names exactly ("Brownsburg,
 * Indiana" → Brownsburg, IN), or [] when the text has no region or no exact
 * town. Used to adopt a legacy free-typed hometown without guessing.
 */
export function exactPlaceMatches(places: HomePlace[], query: string): HomePlace[] {
  const { city, region } = splitQuery(query);
  if (!city || !region) return [];
  return places.filter((p) => p.key === city && regionMatches(p.region, region));
}

/** Region code for a folded region query ("oh", "ohio"), or null. */
function regionCodeFor(regionQuery: string): string | null {
  const upper = regionQuery.toUpperCase();
  if (upper.length === 2 && upper in REGION_NAMES) return upper;
  for (const [code, name] of Object.entries(REGION_NAMES)) if (name === regionQuery) return code;
  return null;
}

export type TownResolver = (location: string | null | undefined) => HomePlace | null;

/**
 * An O(1) "City, Region" → place lookup over the whole index, for resolving
 * many schedule locations at once (the Tour Map's stops, the host picker's
 * already-on-the-schedule check). Accepts "City, ST" and "City, State Name";
 * tour-map cities win a name collision since they come first in the data.
 */
export function makeTownResolver(places: HomePlace[]): TownResolver {
  const index = new Map<string, HomePlace>();
  for (const place of places) {
    const key = `${place.key}|${place.region}`;
    if (!index.has(key)) index.set(key, place);
  }
  return (location) => {
    if (!location) return null;
    const { city, region } = splitQuery(location);
    const code = region ? regionCodeFor(region) : null;
    return (city && code && index.get(`${city}|${code}`)) || null;
  };
}

/**
 * A stable identity for "one place": the tour-map venueId when it has one,
 * else the folded label — what the one-show-per-city rule compares.
 */
export function placeIdentity(place: Pick<HomePlace, 'venueId' | 'label'>): string {
  return place.venueId || `town:${foldPlaceText(place.label)}`;
}

/**
 * Great-circle miles between two points and the CorpsCoin move fee at
 * `milesPerCoin` — the client preview of the server's venues.relocationFee.
 * A missing endpoint or the same spot is free.
 */
export function relocationFeeBetween(
  from: { lat: number; lng: number } | null | undefined,
  to: { lat: number; lng: number } | null | undefined,
  milesPerCoin = 2
): { miles: number; fee: number } {
  if (!from || !to || !Number.isFinite(from.lat) || !Number.isFinite(to.lat)) {
    return { miles: 0, fee: 0 };
  }
  const R = 3958.8; // Earth radius, miles
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(to.lat - from.lat);
  const dLng = rad(to.lng - from.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.sin(dLng / 2) ** 2;
  const miles = 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  // Under a mile is the same town (coordinate rounding) — never charge for it.
  if (miles < 1) return { miles: 0, fee: 0 };
  return { miles: Math.round(miles), fee: Math.ceil(miles / (milesPerCoin || 2)) };
}

/**
 * The town nearest a point (a device's GPS fix, say), or null for an empty
 * list. Linear scan with an equirectangular distance — plenty for ranking
 * ~22k towns, and only the order matters here.
 */
export function nearestPlace(places: HomePlace[], lat: number, lng: number): HomePlace | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  let best: HomePlace | null = null;
  let bestDist = Infinity;
  for (const place of places) {
    const dLat = place.lat - lat;
    const dLng = (place.lng - lng) * cosLat;
    const dist = dLat * dLat + dLng * dLng;
    if (dist < bestDist) {
      best = place;
      bestDist = dist;
    }
  }
  return best;
}
