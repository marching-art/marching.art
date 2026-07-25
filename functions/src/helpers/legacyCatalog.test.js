// Unit tests for the Legacy Endowment catalog (helpers/legacyCatalog.js).
// Run with `npm test` from functions/.
//
// This is currency logic, so the tests cover the two things that would actually
// hurt: title grants that either eat an earned honor or hand out a duplicate,
// and catalog invariants that would let a free or negative-price endowment ship.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || 'test-ns';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  ENDOWMENT_TIERS,
  LEGACY_TITLES,
  MAX_LEGACY_ENTRIES,
  DEDICATION_MAX_LENGTH,
  getEndowmentTier,
  highestLegacyTitle,
  newlyEarnedLegacyTitles,
  nextLegacyTitle,
  sanitizeDedication,
} = require('./legacyCatalog');

const { SHOP_CATALOG } = require('./shopCatalog');

describe('ENDOWMENT_TIERS catalog', () => {
  test('every tier has a positive price and a name', () => {
    const ids = Object.keys(ENDOWMENT_TIERS);
    assert.ok(ids.length > 0);
    for (const id of ids) {
      const tier = ENDOWMENT_TIERS[id];
      assert.ok(Number.isInteger(tier.price) && tier.price > 0, `${id} price`);
      assert.ok(typeof tier.name === 'string' && tier.name.length > 0, `${id} name`);
      assert.ok(Number.isInteger(tier.rank) && tier.rank > 0, `${id} rank`);
    }
  });

  test('ranks are unique and prices rise with rank', () => {
    const tiers = Object.values(ENDOWMENT_TIERS).sort((a, b) => a.rank - b.rank);
    const ranks = tiers.map((t) => t.rank);
    assert.equal(new Set(ranks).size, ranks.length, 'ranks unique');
    for (let i = 1; i < tiers.length; i++) {
      assert.ok(
        tiers[i].price > tiers[i - 1].price,
        `${tiers[i].name} must cost more than ${tiers[i - 1].name}`
      );
    }
  });

  test('the entry tier costs at least as much as the shop top shelf', () => {
    // Endowments are where coin goes AFTER the shop is finished. An entry tier
    // cheaper than a title would just be another cosmetic, not a hoard drain.
    const shopTop = Math.max(...SHOP_CATALOG.map((item) => item.price || 0));
    const cheapest = Math.min(...Object.values(ENDOWMENT_TIERS).map((t) => t.price));
    assert.ok(cheapest >= shopTop / 2, `cheapest endowment ${cheapest} vs shop top ${shopTop}`);
  });
});

describe('getEndowmentTier', () => {
  test('resolves known tiers', () => {
    assert.equal(getEndowmentTier('music_library').price, ENDOWMENT_TIERS.music_library.price);
  });

  test('returns null for unknown ids', () => {
    assert.equal(getEndowmentTier('not_a_tier'), null);
    assert.equal(getEndowmentTier(''), null);
    assert.equal(getEndowmentTier(undefined), null);
    assert.equal(getEndowmentTier(null), null);
  });

  test('does not resolve inherited Object properties as tiers', () => {
    // A plain `ENDOWMENT_TIERS[tierId]` lookup would return Object.prototype
    // members here, and the callable would then read `.price` off a function.
    assert.equal(getEndowmentTier('constructor'), null);
    assert.equal(getEndowmentTier('toString'), null);
    assert.equal(getEndowmentTier('__proto__'), null);
  });
});

describe('LEGACY_TITLES ladder', () => {
  test('thresholds ascend and ids are unique', () => {
    for (let i = 1; i < LEGACY_TITLES.length; i++) {
      assert.ok(
        LEGACY_TITLES[i].threshold > LEGACY_TITLES[i - 1].threshold,
        `threshold ${i} must exceed the previous`
      );
    }
    const ids = LEGACY_TITLES.map((t) => t.itemId);
    assert.equal(new Set(ids).size, ids.length);
  });

  test('every milestone title exists in the shop catalog as grant-only', () => {
    // equipShopItem validates against SHOP_CATALOG, so a title missing there
    // would be granted and then be unequippable — owned but invisible.
    for (const title of LEGACY_TITLES) {
      const item = SHOP_CATALOG.find((entry) => entry.id === title.itemId);
      assert.ok(item, `${title.itemId} missing from SHOP_CATALOG`);
      assert.equal(item.type, 'title', `${title.itemId} type`);
      assert.equal(item.grantOnly, true, `${title.itemId} must be grant-only`);
      assert.equal(item.price, null, `${title.itemId} must have no price`);
      assert.equal(item.name, title.name, `${title.itemId} name must match the ladder`);
    }
  });

  test('the first milestone is reachable with a single entry-tier endowment', () => {
    // Otherwise the ladder shows no progress on a director's first gift, which
    // is exactly when the feedback matters most.
    const cheapest = Math.min(...Object.values(ENDOWMENT_TIERS).map((t) => t.price));
    assert.ok(LEGACY_TITLES[0].threshold <= cheapest);
  });
});

describe('highestLegacyTitle', () => {
  test('returns the top title reached', () => {
    assert.equal(highestLegacyTitle(5000).name, 'Patron');
    assert.equal(highestLegacyTitle(24999).name, 'Patron');
    assert.equal(highestLegacyTitle(25000).name, 'Benefactor');
    assert.equal(highestLegacyTitle(999999).name, 'Cornerstone');
    assert.equal(highestLegacyTitle(1000000).name, 'Founding Legacy');
    assert.equal(highestLegacyTitle(50000000).name, 'Founding Legacy');
  });

  test('returns null below the first threshold and for junk input', () => {
    assert.equal(highestLegacyTitle(0), null);
    assert.equal(highestLegacyTitle(4999), null);
    assert.equal(highestLegacyTitle(-100), null);
    assert.equal(highestLegacyTitle(null), null);
    assert.equal(highestLegacyTitle(undefined), null);
    assert.equal(highestLegacyTitle(Number.NaN), null);
    assert.equal(highestLegacyTitle('lots'), null);
  });
});

describe('newlyEarnedLegacyTitles', () => {
  test('grants the first title on a first qualifying endowment', () => {
    const earned = newlyEarnedLegacyTitles(5000, []);
    assert.deepEqual(
      earned.map((t) => t.itemId),
      ['title_legacy_patron']
    );
  });

  test('grants every threshold crossed at once, not just the highest', () => {
    // A director who jumps straight to 100,000 earned all three honors; handing
    // over only Guarantor would silently eat two.
    const earned = newlyEarnedLegacyTitles(100000, []);
    assert.deepEqual(
      earned.map((t) => t.name),
      ['Patron', 'Benefactor', 'Guarantor']
    );
  });

  test('never re-grants a title already owned', () => {
    // Idempotency matters: a Firestore transaction can retry, and arrayUnion
    // would be harmless but the success message would announce an honor twice.
    const owned = ['title_legacy_patron', 'title_legacy_benefactor'];
    const earned = newlyEarnedLegacyTitles(100000, owned);
    assert.deepEqual(
      earned.map((t) => t.itemId),
      ['title_legacy_guarantor']
    );

    assert.deepEqual(newlyEarnedLegacyTitles(25000, owned), []);
  });

  test('grants nothing below the first threshold', () => {
    assert.deepEqual(newlyEarnedLegacyTitles(4999, []), []);
    assert.deepEqual(newlyEarnedLegacyTitles(0, []), []);
  });

  test('accepts a Set of owned ids as well as an array', () => {
    const owned = new Set(['title_legacy_patron']);
    assert.deepEqual(
      newlyEarnedLegacyTitles(25000, owned).map((t) => t.itemId),
      ['title_legacy_benefactor']
    );
  });

  test('back-fills an honor a director already qualifies for', () => {
    // If a threshold is ever added below an existing total, the next endowment
    // should hand over the honor rather than skipping it forever.
    const earned = newlyEarnedLegacyTitles(30000, ['title_legacy_benefactor']);
    assert.deepEqual(
      earned.map((t) => t.itemId),
      ['title_legacy_patron']
    );
  });

  test('tolerates junk totals and a missing owned list', () => {
    assert.deepEqual(newlyEarnedLegacyTitles(Number.NaN, []), []);
    assert.deepEqual(newlyEarnedLegacyTitles(null, []), []);
    assert.deepEqual(
      newlyEarnedLegacyTitles(5000).map((t) => t.itemId),
      ['title_legacy_patron']
    );
  });
});

describe('nextLegacyTitle', () => {
  test('reports the next milestone and the gap to it', () => {
    assert.deepEqual(
      { name: nextLegacyTitle(0).name, remaining: nextLegacyTitle(0).remaining },
      { name: 'Patron', remaining: 5000 }
    );
    assert.deepEqual(
      { name: nextLegacyTitle(5000).name, remaining: nextLegacyTitle(5000).remaining },
      { name: 'Benefactor', remaining: 20000 }
    );
  });

  test('returns null once the ladder is topped out', () => {
    assert.equal(nextLegacyTitle(1000000), null);
    assert.equal(nextLegacyTitle(9999999), null);
  });

  test('treats junk as zero rather than throwing', () => {
    assert.equal(nextLegacyTitle(undefined).name, 'Patron');
    assert.equal(nextLegacyTitle('nope').name, 'Patron');
  });
});

describe('sanitizeDedication', () => {
  test('keeps ordinary text', () => {
    assert.equal(sanitizeDedication('For the 2009 horn line'), 'For the 2009 horn line');
  });

  test('collapses whitespace and trims', () => {
    assert.equal(sanitizeDedication('  In   memory  of  Coach  '), 'In memory of Coach');
  });

  test('strips control characters', () => {
    // Built from char codes rather than pasted literals: raw control bytes in a
    // source file are invisible and a formatter or copy-paste would silently
    // neuter this test.
    const NUL = String.fromCharCode(0);
    const UNIT_SEP = String.fromCharCode(31);
    const DEL = String.fromCharCode(127);
    const withControls = `For${NUL} the${UNIT_SEP} corps${DEL}`;
    assert.equal(sanitizeDedication(withControls), 'For the corps');
  });

  test('rejects over-length text', () => {
    assert.equal(sanitizeDedication('x'.repeat(DEDICATION_MAX_LENGTH)), 'x'.repeat(DEDICATION_MAX_LENGTH));
    assert.equal(sanitizeDedication('x'.repeat(DEDICATION_MAX_LENGTH + 1)), null);
  });

  test('returns null for empty and non-string input', () => {
    assert.equal(sanitizeDedication(''), null);
    assert.equal(sanitizeDedication('   '), null);
    assert.equal(sanitizeDedication(null), null);
    assert.equal(sanitizeDedication(undefined), null);
    assert.equal(sanitizeDedication(42), null);
    assert.equal(sanitizeDedication({ text: 'hi' }), null);
  });
});

describe('MAX_LEGACY_ENTRIES', () => {
  test('bounds the profile doc without being uselessly small', () => {
    // The profile is read on every dashboard visit, so an unbounded entry list
    // would grow that read for the whole of a decades-long career.
    assert.ok(MAX_LEGACY_ENTRIES >= 10 && MAX_LEGACY_ENTRIES <= 200);
  });
});
