// Unit tests for the award idempotency ledger (helpers/awardLedger.js).
// Run with `npm test`.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || 'test-ns';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  LEDGER_FIELD,
  showAwardToken,
  weeklyXpToken,
  weeklyWinToken,
  matchupRecordToken,
  hasAwardToken,
  awardTokenWrite,
} = require('./awardLedger');

describe('awardLedger tokens', () => {
  test('tokens are stable, season-scoped, and distinct per kind', () => {
    assert.equal(showAwardToken('s1', 7), 's1:show:d7');
    assert.equal(weeklyXpToken('s1', 2), 's1:weeklyXp:w2');
    assert.equal(weeklyWinToken('s1', 2, 'lgA', 'worldClass'), 's1:win:w2:lgA:worldClass');
    assert.equal(
      matchupRecordToken('s1', 2, 'lgA', 'worldClass', 'uidX'),
      's1:rec:w2:lgA:worldClass:uidX'
    );
    // Distinct seasons never collide.
    assert.notEqual(showAwardToken('s1', 7), showAwardToken('s2', 7));
    // Win bonus and record write for the same matchup use different tokens, so
    // each survives independently if the other's write is lost mid-commit.
    assert.notEqual(
      weeklyWinToken('s1', 2, 'lgA', 'worldClass'),
      matchupRecordToken('s1', 2, 'lgA', 'worldClass', 'uidWinner')
    );
  });
});

describe('hasAwardToken', () => {
  const token = showAwardToken('s1', 3);

  test('true only when the ledger array contains the token', () => {
    assert.equal(hasAwardToken({ [LEDGER_FIELD]: [token] }, token), true);
    assert.equal(hasAwardToken({ [LEDGER_FIELD]: ['other'] }, token), false);
  });

  test('safe on missing / non-array / null profile data', () => {
    assert.equal(hasAwardToken({}, token), false);
    assert.equal(hasAwardToken({ [LEDGER_FIELD]: null }, token), false);
    assert.equal(hasAwardToken({ [LEDGER_FIELD]: 'nope' }, token), false);
    assert.equal(hasAwardToken(null, token), false);
    assert.equal(hasAwardToken(undefined, token), false);
  });
});

describe('awardTokenWrite', () => {
  test('produces an arrayUnion fragment on the ledger field', () => {
    const frag = awardTokenWrite('tok');
    assert.ok(Object.prototype.hasOwnProperty.call(frag, LEDGER_FIELD));
    // arrayUnion returns a FieldValue sentinel — assert it is one, not a plain
    // array, so the token merges into (never replaces) the existing ledger.
    const sentinel = frag[LEDGER_FIELD];
    assert.ok(sentinel && typeof sentinel === 'object');
    assert.ok(!Array.isArray(sentinel));
  });
});
