export const METERS_PER_TURN = 0.88;
export const ROUND_SECONDS = 600;
export const API_BASE = 'https://api.squeekchain.com/v1';
export const DURATIONS = [30, 60, 600] as const;
export type Duration = typeof DURATIONS[number];
export type GhostKind = 'typical' | 'record' | 'peak';
export type RaceMode = 'live' | 'ghost';
export type Route = '/' | '/race' | '/ghost' | '/predict' | '/profile' | '/how-to-play';

export interface WheelStatus {
  installationId: string;
  generatedAt: string;
  measurement: {
    freshness: string;
    observedAt: string;
    staleAfterSeconds: number;
    counterEpoch: string;
    cumulativeWorkUnits: string;
    coreStatus: string;
    rpmMilli: number;
    speedMmPerSecond: number;
  };
  builder: { anchor: { settledThroughRound: string; cumulativeWork: string; blockHeight: string } | null };
}
export interface MeasurementStats {
  installationId: string;
  generatedAt: string;
  range: string;
  window: { roundSeconds: number };
  activity: {
    coverage: { coverageBps: number; complete: boolean };
    summary: { observedWorkUnits: string; mostActiveDate: string | null; mostActiveDateWorkUnits: string };
  };
  rounds: {
    medianActiveWork: string | null;
    averageActiveWorkMilli: string | null;
    mostActiveWork: string | null;
    activeCount: number;
    observedCount: number;
    missingCount: number;
  };
  records: {
    peakObservedSpeedMmPerSecond: ApiRecord | null;
    mostWorkUtcDay: ApiRecord | null;
  };
}
export interface ApiRecord { value: string; occurredAt: string; coverage: string }
export interface Settlement {
  previousSettledThroughRound: string;
  settledThroughRound: string;
  workAdded: string;
  cumulativeWork: string;
  confirmationStatus: string;
  completedBlockCount?: string;
  blockTimestamp?: string;
}
export interface SettlementsData {
  installationId: string;
  generatedAt: string;
  status: string;
  summary: { settlementCount: string; completedBlockCount: string; workAdded: string };
  recentSettlements: Settlement[];
  mining: { nextRound: { round: string; startsAt: string; endsAt: string } | null } | null;
}
export interface WheelEvent {
  id: string;
  type: string;
  occurredAt: string;
  source: { kind: string; confirmationStatus: string | null };
  payload: Record<string, unknown>;
}
export interface EventsData { installationId: string; generatedAt: string; status: string; events: WheelEvent[] }
export interface RoundClock { currentRound: number; nextRound: number; startsAt: number; endsAt: number; remaining: number }
export interface GhostPace { kind: GhostKind; name: string; description: string; speed: number; turns: number | null; at: string; cached: boolean }

export const numberOf = (value: unknown): number | null => {
  if ((typeof value !== 'number' && typeof value !== 'string') || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= Number.MAX_SAFE_INTEGER ? n : null;
};
export const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
export function getRoundClock(data: SettlementsData | null, now: number): RoundClock | null {
  const anchor = data?.mining?.nextRound;
  if (!anchor) return null;
  const round = numberOf(anchor.round);
  const start = Date.parse(anchor.startsAt);
  const end = Date.parse(anchor.endsAt);
  if (round === null || !Number.isInteger(round) || !Number.isFinite(start) || end - start !== ROUND_SECONDS * 1000 || now < start) return null;
  const elapsed = Math.floor((now - start) / (ROUND_SECONDS * 1000));
  const nextStart = start + (elapsed + 1) * ROUND_SECONDS * 1000;
  return { currentRound: round + elapsed, nextRound: round + elapsed + 1, startsAt: nextStart, endsAt: nextStart + ROUND_SECONDS * 1000, remaining: Math.max(0, Math.ceil((nextStart - now) / 1000)) };
}
export function getGhost(kind: GhostKind, stats7: MeasurementStats, stats30: MeasurementStats, cached: boolean): GhostPace | null {
  const stats = kind === 'typical' ? stats7 : stats30;
  const turns = numberOf(kind === 'typical' ? stats.rounds.medianActiveWork : stats.rounds.mostActiveWork);
  if (kind === 'peak') {
    const record = stats.records.peakObservedSpeedMmPerSecond;
    const n = numberOf(record?.value);
    if (n === null || !record) return null;
    return { kind, name: 'Rocket paws', description: '30-day recorded peak speed', speed: n / 1000, turns: null, at: record.occurredAt, cached };
  }
  if (turns === null || stats.window.roundSeconds !== ROUND_SECONDS) return null;
  return { kind, name: kind === 'typical' ? 'Daily squeek' : 'Personal pest', description: kind === 'typical' ? '7-day median active round' : '30-day best recorded round', speed: turns * METERS_PER_TURN / ROUND_SECONDS, turns, at: stats.generatedAt, cached };
}
export function isWheelFresh(status: WheelStatus | null, now: number): boolean {
  if (!status || status.measurement.freshness !== 'online') return false;
  const age = now - Date.parse(status.measurement.observedAt);
  return Number.isFinite(age) && age >= -10000 && age < status.measurement.staleAfterSeconds * 1000;
}
export const formatDistance = (n: number): string => n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const formatTime = (s: number): string => `${Math.floor(Math.max(0, s) / 60).toString().padStart(2, '0')}:${Math.floor(Math.max(0, s) % 60).toString().padStart(2, '0')}`;
export const shortDate = (s: string): string => new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
export const durationName = (s: Duration): string => s === 600 ? '10 min' : `${s} sec`;
