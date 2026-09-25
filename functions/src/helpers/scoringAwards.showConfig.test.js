// Behavior tests for championshipConfigForShow — how a scheduled show finds
// the championship round it scores under when the stored row does not carry
// the canonical marching.art name (an off-season replaying a 2000s archive
// keeps that year's "Division I ... Semi-Finals" title on the row).
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || 'test-ns';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { buildChampionshipConfig, championshipConfigForShow } = require('./scoringAwards');

describe('championshipConfigForShow', () => {
  const worldConfig = (day) => buildChampionshipConfig(day, new Map(), []);

  test('the exact stored name wins', () => {
    const config = worldConfig(47);
    const hit = championshipConfigForShow(
      config, { eventName: 'marching.art World Championship Prelims' }, 47);
    assert.ok(hit);
    assert.equal(hit.byRound, false);
    assert.equal(hit.key, 'marching.art World Championship Prelims');
    assert.equal(hit.config, config['marching.art World Championship Prelims']);
  });

  test('a World round stored under an archive title resolves by the day it is played', () => {
    // A 2000s replay: the generator kept the archive's own title on the row.
    for (const [day, stored] of [
      [47, 'marching.art Division I World Championship Quarterfinals'],
      [48, 'marching.art Division I World Championship Semi-Finals'],
      [49, 'marching.art Division I World Championship Finals'],
    ]) {
      const config = worldConfig(day);
      const hit = championshipConfigForShow(config, { eventName: stored }, day);
      assert.ok(hit, `day ${day}`);
      assert.equal(hit.byRound, true);
      assert.equal(Object.keys(config).filter((k) => !/SoundSport/.test(k))[0], hit.key);
      assert.deepEqual(hit.config.classFilter, ['worldClass', 'openClass', 'aClass']);
    }
  });

  test('the SoundSport festival on Finals night is never mistaken for the World Finals', () => {
    const config = worldConfig(49);
    const exact = championshipConfigForShow(
      config, { eventName: 'SoundSport International Music & Food Festival' }, 49);
    assert.equal(exact.config.classFilter[0], 'soundSport');
    const renamed = championshipConfigForShow(
      config, { eventName: 'marching.art SoundSport World Championship Festival' }, 49);
    assert.equal(renamed, null);
  });

  test('the fallback only covers the World rounds, never a regular show or an Open/A night', () => {
    assert.equal(championshipConfigForShow(worldConfig(47), { eventName: 'Drums Along the Rockies' }, 47), null);
    // Day 45 is an Open & A night: a mis-named row stays unmatched (and logged), not guessed.
    assert.equal(championshipConfigForShow(
      worldConfig(45), { eventName: 'DCI Open Class World Championship Prelims' }, 45), null);
    // A World-titled show on a non-World day is a regular show.
    assert.equal(championshipConfigForShow(
      { 'Open and A Class Finals': { participants: null, classFilter: ['openClass', 'aClass'] } },
      { eventName: 'DCI World Championship Semifinals' }, 46), null);
    assert.equal(championshipConfigForShow(null, { eventName: 'anything' }, 48), null);
    assert.equal(championshipConfigForShow(worldConfig(48), { eventName: undefined }, 48), null);
  });
});
