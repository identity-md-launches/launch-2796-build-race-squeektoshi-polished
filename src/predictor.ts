import { numberOf } from './domain';
import type { EventsData, Settlement, SettlementsData } from './domain';

export interface Prediction {
  id: string;
  installationId: string;
  round: number;
  turns: number;
  startsAt: number;
  endsAt: number;
  savedAt: number;
  state: 'pending' | 'resolved' | 'unverified';
  actual?: number;
  points?: number;
  errorPercent?: number;
  tier?: string;
  method?: string;
}
export interface VerifiedWork { work: number; method: string }
export function settlementEvidence(settlements: SettlementsData | null, events: EventsData | null, installationId: string): Settlement[] {
  const records = settlements?.installationId === installationId ? [...settlements.recentSettlements] : [];
  if (events?.installationId === installationId) {
    for (const e of events.events) {
      if (e.type !== 'system.settlement_completed') continue;
      const p = e.payload;
      if ([p.previousSettledThroughRound, p.settledThroughRound, p.workAdded, p.cumulativeWork].some(v => numberOf(v) === null)) continue;
      records.push({ previousSettledThroughRound: String(p.previousSettledThroughRound), settledThroughRound: String(p.settledThroughRound), workAdded: String(p.workAdded), cumulativeWork: String(p.cumulativeWork), confirmationStatus: e.source.confirmationStatus });
    }
  }
  return records.filter(s => s.confirmationStatus === 'safe' || s.confirmationStatus === 'finalized');
}
export function verifyRound(round: number, records: Settlement[]): VerifiedWork | null {
  records = records.filter(r => r.confirmationStatus === 'safe' || r.confirmationStatus === 'finalized');
  const candidates: VerifiedWork[] = [];
  for (const r of records) {
    const previous = numberOf(r.previousSettledThroughRound), through = numberOf(r.settledThroughRound), work = numberOf(r.workAdded);
    if (previous === null || through === null || work === null || through <= previous) continue;
    if (previous === round - 1 && through === round) candidates.push({ work, method: 'safe single-round settlement workAdded' });
    else if (previous < round && through >= round && work === 0) candidates.push({ work: 0, method: 'safe zero-work settlement covering this round' });
  }
  const before = records.filter(r => numberOf(r.settledThroughRound) === round - 1).map(r => numberOf(r.cumulativeWork)).filter((n): n is number => n !== null);
  const after = records.filter(r => numberOf(r.settledThroughRound) === round).map(r => numberOf(r.cumulativeWork)).filter((n): n is number => n !== null);
  for (const a of before) for (const b of after) if (b >= a) candidates.push({ work: b - a, method: 'difference of safe cumulativeWork at consecutive round boundaries' });
  // Contradictory evidence must never produce a score.
  if (!candidates.length || candidates.some(c => c.work !== candidates[0].work)) return null;
  return candidates[0];
}
export function predictionScore(estimate: number, actual: number, streak: number) {
  const difference = Math.abs(estimate - actual);
  const errorPercent = actual === 0 ? (estimate === 0 ? 0 : 100) : difference / actual * 100;
  const exact = difference <= Math.max(2, actual * 0.01);
  const accurate = exact || errorPercent <= 10;
  const nextStreak = accurate ? streak + 1 : 0;
  const base = exact ? 500 : errorPercent <= 5 ? 250 : errorPercent <= 10 ? 150 : errorPercent <= 20 ? 75 : 10;
  return { points: base + (accurate ? Math.min(nextStreak, 5) * 25 : 0), errorPercent, streak: nextStreak, tier: exact ? 'Exact band' : errorPercent <= 5 ? 'Sharp whiskers' : errorPercent <= 10 ? 'Close call' : errorPercent <= 20 ? 'Warm trail' : 'Keep guessing' };
}
