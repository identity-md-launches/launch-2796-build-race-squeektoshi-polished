import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { parseEvents, parseSettlements, parseStats, parseStatus } from '../src/api';
import { getGhost, getRoundClock, isWheelFresh } from '../src/domain';
import type { Settlement } from '../src/domain';
import { RaceEngine } from '../src/engine';
import { emptyProfile, parseProfile, readProfile, reconcilePredictions, recordRace, writeProfile } from '../src/profile';
import { predictionScore, settlementEvidence, verifyRound } from '../src/predictor';
import type { Prediction } from '../src/predictor';
import snapshot from '../src/data/hamster-snapshot.json';

const fixture = (name: string): unknown => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));
const status = parseStatus(fixture('status'));
const settlements = parseSettlements(fixture('settlements'));
const events = parseEvents(fixture('events'));
const evidence = (before: number, through: number, work: number, cumulative = work, confirmation = 'safe'): Settlement => ({ previousSettledThroughRound: String(before), settledThroughRound: String(through), workAdded: String(work), cumulativeWork: String(cumulative), confirmationStatus: confirmation });

test('all four endpoint contracts parse captured public fields; missing/negative measurements fail closed', () => {
  const stats = parseStats(snapshot.stats7);
  assert.equal(stats.rounds.medianActiveWork, snapshot.stats7.rounds.medianActiveWork);
  assert.ok(settlements.recentSettlements.length);
  assert.ok(events.events.length);
  assert.throws(() => parseStatus({ ...status, measurement: { ...status.measurement, speedMmPerSecond: -1 } }));
  assert.throws(() => parseStatus({ measurement: {} }));
});
test('ghost paces are exact unit conversions of the real snapshot, never synthetic targets', () => {
  assert.equal(getGhost('typical', snapshot.stats7, snapshot.stats30, true)?.speed, Number(snapshot.stats7.rounds.medianActiveWork) * 0.88 / 600);
  assert.equal(getGhost('record', snapshot.stats7, snapshot.stats30, true)?.speed, Number(snapshot.stats30.rounds.mostActiveWork) * 0.88 / 600);
  assert.equal(getGhost('peak', snapshot.stats7, snapshot.stats30, true)?.speed, Number(snapshot.stats30.records.peakObservedSpeedMmPerSecond.value) / 1000);
  assert.equal(getGhost('peak', snapshot.stats7, snapshot.stats30, true)?.cached, true);
});
test('round scheduling derives from API anchor, rolls exactly at a boundary, and rejects invalid schedules', () => {
  const anchor = settlements.mining!.nextRound!;
  const start = Date.parse(anchor.startsAt), id = Number(anchor.round);
  assert.equal(getRoundClock(settlements, start)!.nextRound, id + 1);
  assert.equal(getRoundClock(settlements, start + 599999)!.nextRound, id + 1);
  assert.equal(getRoundClock(settlements, start + 600000)!.nextRound, id + 2);
  assert.equal(getRoundClock(settlements, start + 600000)!.remaining, 600);
  assert.equal(getRoundClock(null, start), null);
  assert.equal(getRoundClock({ ...settlements, mining: { nextRound: { ...anchor, endsAt: anchor.startsAt } } }, start), null);
});
test('stale wheel samples and offline freshness cannot enable live races', () => {
  assert.equal(isWheelFresh(status, Date.parse(status.measurement.observedAt) + 1000), true);
  assert.equal(isWheelFresh(status, Date.parse(status.measurement.observedAt) + status.measurement.staleAfterSeconds * 1000), false);
  assert.equal(isWheelFresh({ ...status, measurement: { ...status.measurement, freshness: 'offline' } }, Date.parse(status.measurement.observedAt)), false);
});
function runCadence(interval: number) {
  const game = new RaceEngine(30, 0.75);
  let nextTap = 0;
  while (!game.finished) {
    if (game.elapsed + 0.00001 >= nextTap) { game.tap(); nextTap += interval; }
    game.step(1 / 120, 0.75);
  }
  return game;
}
test('steady rhythm beats mashing, preserves stamina and creates a genuine perfect streak', () => {
  const rhythm = runCadence(0.5), mash = runCadence(0.1);
  assert.ok(rhythm.playerDistance > mash.playerDistance * 2);
  assert.ok(rhythm.stamina > 90);
  assert.ok(mash.stamina < 15);
  assert.ok(rhythm.perfectTaps > 50);
  assert.ok(rhythm.maxCombo > 50);
  assert.ok(rhythm.playerDistance > rhythm.opponentDistance);
});
test('no input cannot move the player; holding/duplicate taps does not add taps', () => {
  const game = new RaceEngine(30, 1);
  game.step(30, 1);
  assert.equal(game.playerDistance, 0); assert.equal(game.elapsed, 30); assert.ok(Math.abs(game.opponentDistance - 30) < 0.00001);
  const duplicate = new RaceEngine(30, 1); duplicate.tap(); duplicate.tap(); assert.equal(duplicate.taps, 1);
});
test('live pace interpolates between measured samples, and a full 600-second game terminates without real-time waiting', () => {
  const game = new RaceEngine(600, 0.5);
  game.step(0.1, 1.5); assert.ok(game.opponentSpeed > 0.5 && game.opponentSpeed < 1.5);
  game.step(599.9, 1.5); assert.equal(game.elapsed, 600); assert.equal(game.finished, true);
  const distance = game.opponentDistance; game.step(5, 100); assert.equal(game.opponentDistance, distance);
});
test('round resolver accepts exact and provable zero work; never divides aggregate work', () => {
  assert.equal(verifyRound(10, [evidence(9, 10, 511)])?.work, 511);
  assert.equal(verifyRound(10, [evidence(8, 12, 0)])?.work, 0);
  assert.equal(verifyRound(10, [evidence(8, 12, 900)]), null);
  assert.equal(verifyRound(10, [evidence(8, 10, 900, 1000), evidence(8, 9, 400, 600)])?.work, 400);
  assert.equal(verifyRound(10, [evidence(9, 10, 500), evidence(9, 10, 600)]), null);
});
test('unconfirmed and other-installation settlements never enter verification evidence', () => {
  const dataset = { ...settlements, recentSettlements: [evidence(9, 10, 500, 500, 'pending')] };
  assert.equal(settlementEvidence(dataset, null, dataset.installationId).length, 0);
  assert.equal(settlementEvidence(settlements, events, 'other-installation').length, 0);
  const actual = events.events.find(e => e.type === 'system.settlement_completed')!;
  assert.equal(verifyRound(Number(actual.payload.settledThroughRound), settlementEvidence(null, events, events.installationId))?.work, Number(actual.payload.workAdded));
});
test('prediction scoring covers exact, zero, tier edges and capped streak bonuses', () => {
  assert.equal(predictionScore(100, 100, 0).points, 525);
  assert.equal(predictionScore(105, 100, 0).points, 275);
  assert.equal(predictionScore(110, 100, 0).points, 175);
  assert.equal(predictionScore(120, 100, 0).points, 75);
  assert.equal(predictionScore(121, 100, 8).streak, 0);
  assert.equal(predictionScore(0, 0, 20).points, 625);
  assert.equal(predictionScore(3, 0, 0).errorPercent, 100);
  assert.equal(predictionScore(2, 0, 0).tier, 'Exact band');
});
const prediction: Prediction = { id: 'test-prediction', installationId: settlements.installationId, round: 10, turns: 500, startsAt: 1000000, endsAt: 1600000, savedAt: 900000, state: 'pending' };
test('saved predictions resolve once across visits; unresolved results stay honest and can later recover', () => {
  const p = { ...emptyProfile(), predictions: [prediction] };
  const exact = { ...settlements, recentSettlements: [evidence(9, 10, 500)] };
  const resolved = reconcilePredictions(p, exact, null, 2000000);
  assert.equal(resolved.predictions[0].actual, 500); assert.equal(resolved.predictions[0].state, 'resolved');
  assert.equal(reconcilePredictions(resolved, exact, null, 3000000).points, resolved.points);
  const unverifiable = reconcilePredictions(p, null, null, prediction.endsAt + 7200001);
  assert.equal(unverifiable.predictions[0].state, 'unverified'); assert.equal(unverifiable.points, 0);
  assert.equal(reconcilePredictions(unverifiable, exact, null, prediction.endsAt + 8000000).predictions[0].state, 'resolved');
});
test('blocked, malformed and hostile storage remains safe; late-saved predictions are rejected', () => {
  const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  assert.equal(readProfile(blocked).nickname, 'Pocket runner'); assert.equal(writeProfile(emptyProfile(), blocked), false);
  assert.equal(readProfile({ ...blocked, getItem: () => '{broken' }).points, 0);
  assert.equal(parseProfile({ version: 1, points: -10, races: '100', nickname: '<b>Paws</b>', predictions: [{ ...prediction, savedAt: prediction.startsAt }] }).predictions.length, 0);
  assert.equal(parseProfile({ version: 1, bests: { '__proto__': 1, 'ghost:typical:30': 40 } }).bests['ghost:typical:30'], 40);
});
test('local race rewards are idempotent and bests are separated by mode/opponent/length', () => {
  const engine = runCadence(0.5);
  const result = engine.result({ id: 'same-finish', mode: 'ghost', ghost: 'typical', cached: true, opponentLabel: 'Daily squeek' });
  const p = recordRace(emptyProfile(), result), repeated = recordRace(p, result);
  assert.equal(p.races, 1); assert.equal(p.points, repeated.points); assert.equal(p.races, repeated.races);
  assert.equal(p.bests['ghost:typical:30'], result.playerDistance); assert.ok(p.badges.includes('first')); assert.ok(p.badges.includes('winner')); assert.ok(p.badges.includes('rhythm'));
});
