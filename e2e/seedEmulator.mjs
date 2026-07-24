#!/usr/bin/env node
// Seed the Firestore EMULATOR with the minimum season data the guest-preview
// draft flow needs (e2e/guest-draft.spec.ts): a current season doc and its
// corps-values pool. Uses the emulator's REST API with the `Bearer owner`
// admin bypass — no SDK dependency, and it can never touch production
// (FIRESTORE_EMULATOR_HOST-style port targeting only).
//
// Usage (emulator must be running):
//   node e2e/seedEmulator.mjs [projectId] [host]
// Defaults: demo-e2e, localhost:8080 (the port src/config expects).

const PROJECT = process.argv[2] || 'demo-e2e';
const HOST = process.argv[3] || 'localhost:8080';
const BASE = `http://${HOST}/v1/projects/${PROJECT}/databases/(default)/documents`;

/** Encode a JS value as a Firestore REST typed value. */
function encodeValue(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === 'string') return { stringValue: value };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } };
  if (typeof value === 'object') return { mapValue: { fields: encodeFields(value) } };
  throw new Error(`Cannot encode value: ${value}`);
}

function encodeFields(obj) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, encodeValue(v)]));
}

async function setDoc(path, data) {
  const res = await fetch(`${BASE}/${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ fields: encodeFields(data) }),
  });
  if (!res.ok) {
    throw new Error(`Seeding ${path} failed: ${res.status} ${await res.text()}`);
  }
  console.log(`seeded ${path}`);
}

const SEASON_UID = 'e2e-offseason';

// Start 21 days ago → currentDay ≈ 21, comfortably mid-season (no spring
// training on off-seasons, so calendar day == competition day).
const startDate = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000);
startDate.setUTCHours(0, 0, 0, 0);

// A dozen draftable corps at ≤50 points (the guest/onboarding availability
// filter). Eight of them must fit the 90-point SoundSport budget TOGETHER
// (cheapest eight sum to 68 here) so the spec's greedy cheapest-pick
// strategy can always complete a full draft; the pricier four exercise the
// over-budget disabled state.
const corpsValues = [
  ['Blue Stars', 2017, 45],
  ['The Academy', 2019, 42],
  ['Mandarins', 2022, 40],
  ['Colts', 2018, 36],
  ['Spirit of Atlanta', 2019, 12],
  ['Boston Crusaders', 2016, 11],
  ['Blue Knights', 2019, 10],
  ['Pacific Crest', 2018, 9],
  ['Madison Scouts', 2015, 8],
  ['Troopers', 2017, 7],
  ['Jersey Surf', 2014, 6],
  ['Seattle Cascades', 2013, 5],
].map(([corpsName, sourceYear, points]) => ({ corpsName, sourceYear, points }));

await setDoc('game-settings/season', {
  seasonUid: SEASON_UID,
  name: 'E2E Off-Season',
  status: 'off-season',
  seasonType: 'offSeason',
  seasonYear: new Date().getFullYear(),
  totalWeeks: 7,
  dataDocId: SEASON_UID,
  registrationOpen: true,
  schedule: {
    startDate,
    endDate: new Date(startDate.getTime() + 49 * 24 * 60 * 60 * 1000),
  },
});

await setDoc(`dci-data/${SEASON_UID}`, { corpsValues });

console.log('Emulator seed complete.');
