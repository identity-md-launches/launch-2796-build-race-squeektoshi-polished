import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useData } from './DataProvider';
import { isObject, numberOf } from './domain';
import type { GhostKind } from './domain';
import type { RaceResult } from './engine';
import { predictionScore, settlementEvidence, verifyRound } from './predictor';
import type { Prediction } from './predictor';

export const STORAGE_KEY = 'race-squeektoshi.profile.v1';
export interface Profile {
  version: 1;
  nickname: string;
  title: string;
  points: number;
  races: number;
  wins: number;
  distance: number;
  bests: Record<string, number>;
  maxCombo: number;
  liveFinishes: number;
  fullFinishes: number;
  ghostWins: GhostKind[];
  processedRaces: string[];
  badges: string[];
  predictionStreak: number;
  predictionCount: number;
  accuratePredictions: number;
  maxPredictionStreak: number;
  predictions: Prediction[];
}
export const emptyProfile = (): Profile => ({ version: 1, nickname: 'Pocket runner', title: 'New whiskers', points: 0, races: 0, wins: 0, distance: 0, bests: {}, maxCombo: 0, liveFinishes: 0, fullFinishes: 0, ghostWins: [], processedRaces: [], badges: [], predictionStreak: 0, predictionCount: 0, accuratePredictions: 0, maxPredictionStreak: 0, predictions: [] });
export interface Badge { id: string; name: string; title: string; description: string; icon: string; earned: (p: Profile) => boolean }
export const BADGES: Badge[] = [
  { id: 'first', name: 'First squeek', title: 'Tiny contender', description: 'Finish your first race.', icon: 'flag', earned: p => p.races >= 1 },
  { id: 'winner', name: 'Paws ahead', title: 'Pace chaser', description: 'Win a race against any ghost or live pace.', icon: 'trophy', earned: p => p.wins >= 1 },
  { id: 'five', name: 'Wheel regular', title: 'Wheel regular', description: 'Finish five races.', icon: 'wheel', earned: p => p.races >= 5 },
  { id: 'ten', name: 'Habit hamster', title: 'Track legend', description: 'Finish ten races.', icon: 'spark', earned: p => p.races >= 10 },
  { id: 'distance', name: 'Long whiskers', title: 'Kilometer kid', description: 'Run a total of 1,000 game meters.', icon: 'route', earned: p => p.distance >= 1000 },
  { id: 'rhythm', name: 'In the pocket', title: 'Rhythm rodent', description: 'Land twenty perfect taps in a row.', icon: 'music', earned: p => p.maxCombo >= 20 },
  { id: 'round', name: 'Full wheel', title: 'Endurance paws', description: 'Finish a ten-minute full-round race.', icon: 'clock', earned: p => p.fullFinishes >= 1 },
  { id: 'ghosts', name: 'Ghost hunter', title: 'Ghost hunter', description: 'Beat all three recorded ghosts.', icon: 'ghost', earned: p => p.ghostWins.length >= 3 },
  { id: 'live', name: 'Real company', title: 'Live wire', description: 'Finish a race against the live wheel.', icon: 'bolt', earned: p => p.liveFinishes >= 1 },
  { id: 'predict', name: 'Hunch bunch', title: 'Wheel whisperer', description: 'Save your first round prediction.', icon: 'target', earned: p => p.predictionCount >= 1 },
  { id: 'accurate', name: 'Sharp whiskers', title: 'Sharp whiskers', description: 'Resolve a prediction within ten percent or the exact band.', icon: 'eye', earned: p => p.accuratePredictions >= 1 },
  { id: 'streak', name: 'Three for turns', title: 'Hamster oracle', description: 'Reach a three-prediction accuracy streak.', icon: 'star', earned: p => p.maxPredictionStreak >= 3 },
];
export function unlockBadges(p: Profile): Profile {
  const badges = BADGES.filter(b => p.badges.includes(b.id) || b.earned(p)).map(b => b.id);
  return { ...p, badges };
}
function validPrediction(v: unknown): v is Prediction {
  if (!isObject(v) || typeof v.id !== 'string' || typeof v.installationId !== 'string' || !['pending', 'resolved', 'unverified'].includes(String(v.state))) return false;
  if (![v.round, v.turns, v.startsAt, v.endsAt, v.savedAt].every(n => typeof n === 'number' && numberOf(n) !== null)) return false;
  if (!Number.isInteger(v.round) || !Number.isInteger(v.turns) || Number(v.endsAt) - Number(v.startsAt) !== 600000 || Number(v.savedAt) >= Number(v.startsAt)) return false;
  if (v.state === 'resolved' && ![v.actual, v.points, v.errorPercent].every(n => typeof n === 'number' && numberOf(n) !== null)) return false;
  return true;
}
export function parseProfile(v: unknown): Profile {
  const p = emptyProfile();
  if (!isObject(v) || v.version !== 1) return p;
  if (typeof v.nickname === 'string') p.nickname = v.nickname.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 24) || p.nickname;
  const numericKeys = ['points', 'races', 'wins', 'distance', 'maxCombo', 'liveFinishes', 'fullFinishes', 'predictionStreak', 'predictionCount', 'accuratePredictions', 'maxPredictionStreak'] as const;
  for (const k of numericKeys) if (typeof v[k] === 'number' && numberOf(v[k]) !== null) p[k] = v[k];
  if (isObject(v.bests)) for (const [key, n] of Object.entries(v.bests)) if (/^(live|ghost):(typical|record|peak|live):(30|60|600)$/.test(key) && typeof n === 'number' && numberOf(n) !== null) p.bests[key] = n;
  if (Array.isArray(v.badges)) p.badges = v.badges.filter((x): x is string => typeof x === 'string' && BADGES.some(b => b.id === x));
  if (Array.isArray(v.processedRaces)) p.processedRaces = v.processedRaces.filter((x): x is string => typeof x === 'string').slice(-100);
  if (Array.isArray(v.ghostWins)) p.ghostWins = [...new Set(v.ghostWins.filter((x): x is GhostKind => x === 'typical' || x === 'record' || x === 'peak'))];
  if (Array.isArray(v.predictions)) p.predictions = v.predictions.filter(validPrediction).slice(-60);
  if (typeof v.title === 'string' && (v.title === 'New whiskers' || BADGES.some(b => b.title === v.title && p.badges.includes(b.id)))) p.title = v.title;
  return unlockBadges(p);
}
interface StorageLike { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void }
export function readProfile(storage?: StorageLike): Profile {
  try { const raw = (storage ?? window.localStorage).getItem(STORAGE_KEY); return raw ? parseProfile(JSON.parse(raw)) : emptyProfile(); }
  catch { return emptyProfile(); }
}
export function writeProfile(p: Profile, storage?: StorageLike): boolean {
  try { (storage ?? window.localStorage).setItem(STORAGE_KEY, JSON.stringify(p)); return true; }
  catch { return false; }
}
export const bestKey = (mode: 'ghost' | 'live', ghost: GhostKind, duration: number): string => `${mode}:${mode === 'live' ? 'live' : ghost}:${duration}`;
export function recordRace(p: Profile, r: RaceResult): Profile {
  if (p.processedRaces.includes(r.id)) return p;
  const key = bestKey(r.mode, r.ghost, r.duration);
  return unlockBadges({ ...p, points: p.points + r.points, races: p.races + 1, wins: p.wins + (r.won ? 1 : 0), distance: p.distance + r.playerDistance, maxCombo: Math.max(p.maxCombo, r.maxCombo), liveFinishes: p.liveFinishes + (r.mode === 'live' ? 1 : 0), fullFinishes: p.fullFinishes + (r.duration === 600 ? 1 : 0), bests: { ...p.bests, [key]: Math.max(p.bests[key] ?? 0, r.playerDistance) }, ghostWins: r.won && r.mode === 'ghost' ? [...new Set([...p.ghostWins, r.ghost])] : p.ghostWins, processedRaces: [...p.processedRaces.slice(-99), r.id] });
}
export function reconcilePredictions(p: Profile, settlements: SettlementsDataInput, events: EventsDataInput, now: number): Profile {
  let next = p;
  const updates = new Map<string, Prediction>();
  for (const prediction of [...p.predictions].sort((a, b) => a.round - b.round)) {
    if (prediction.state === 'resolved' || now < prediction.endsAt) continue;
    const evidence = settlementEvidence(settlements, events, prediction.installationId);
    const verified = verifyRound(prediction.round, evidence);
    if (verified) {
      const score = predictionScore(prediction.turns, verified.work, next.predictionStreak);
      updates.set(prediction.id, { ...prediction, state: 'resolved', actual: verified.work, points: score.points, errorPercent: score.errorPercent, tier: score.tier, method: verified.method });
      next = { ...next, points: next.points + score.points, predictionStreak: score.streak, accuratePredictions: next.accuratePredictions + (score.streak > 0 ? 1 : 0), maxPredictionStreak: Math.max(next.maxPredictionStreak, score.streak) };
    } else if (now > prediction.endsAt + 2 * 3600000 && prediction.state !== 'unverified') {
      updates.set(prediction.id, { ...prediction, state: 'unverified' });
    }
  }
  if (!updates.size) return p;
  const all = p.predictions.map(x => updates.get(x.id) ?? x);
  const completed = all.filter(x => x.state !== 'pending').sort((a, b) => a.endsAt - b.endsAt).slice(-20);
  next = { ...next, predictions: [...completed, ...all.filter(x => x.state === 'pending')] };
  return unlockBadges(next);
}
type SettlementsDataInput = Parameters<typeof settlementEvidence>[0];
type EventsDataInput = Parameters<typeof settlementEvidence>[1];
interface ProfileContextValue { profile: Profile; storageAvailable: boolean; update: (change: (p: Profile) => Profile) => void; finishRace: (r: RaceResult) => void }
const ProfileContext = createContext<ProfileContextValue | null>(null);
export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState(readProfile);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const { settlements, settlementsOnline, events, eventsOnline, now } = useData();
  useEffect(() => { setStorageAvailable(writeProfile(profile)); }, [profile]);
  useEffect(() => {
    setProfile(p => reconcilePredictions(p, settlementsOnline ? settlements : null, eventsOnline ? events : null, now));
  }, [settlements, settlementsOnline, events, eventsOnline, now]);
  const update = useCallback((change: (p: Profile) => Profile) => setProfile(p => unlockBadges(change(p))), []);
  const finishRace = useCallback((r: RaceResult) => setProfile(p => recordRace(p, r)), []);
  return <ProfileContext.Provider value={{ profile, storageAvailable, update, finishRace }}>{children}</ProfileContext.Provider>;
}
export function useProfile(): ProfileContextValue { const c = useContext(ProfileContext); if (!c) throw new Error('ProfileProvider missing'); return c; }
