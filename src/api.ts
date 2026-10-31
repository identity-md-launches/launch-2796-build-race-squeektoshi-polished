import { API_BASE, isObject, numberOf } from './domain';
import type { ApiRecord, EventsData, MeasurementStats, Settlement, SettlementsData, WheelEvent, WheelStatus } from './domain';

const object = (v: unknown): Record<string, unknown> => { if (!isObject(v)) throw new Error('Unexpected API response'); return v; };
const text = (v: unknown): string => { if (typeof v !== 'string') throw new Error('Missing API text'); return v; };
const numeric = (v: unknown): number => { const n = numberOf(v); if (n === null) throw new Error('Missing API number'); return n; };
const counter = (v: unknown): string => String(numeric(v));
const nullableCounter = (v: unknown): string | null => v == null ? null : counter(v);
const date = (v: unknown): string => { const s = text(v); if (!Number.isFinite(Date.parse(s))) throw new Error('Invalid API timestamp'); return s; };
function record(v: unknown): ApiRecord | null {
  if (v == null) return null;
  const o = object(v);
  if (o.value == null) return null;
  return { value: counter(o.value), occurredAt: date(o.occurredAt), coverage: text(o.coverage) };
}
export function parseStatus(v: unknown): WheelStatus {
  const o = object(v), m = object(o.measurement), b = object(o.builder);
  const a = isObject(b.anchor) ? b.anchor : null;
  return { installationId: text(o.installationId), generatedAt: date(o.generatedAt), measurement: {
    freshness: text(m.freshness), observedAt: date(m.observedAt), staleAfterSeconds: numeric(m.staleAfterSeconds), counterEpoch: text(m.counterEpoch),
    cumulativeWorkUnits: counter(m.cumulativeWorkUnits), coreStatus: text(m.coreStatus), rpmMilli: numeric(m.rpmMilli), speedMmPerSecond: numeric(m.speedMmPerSecond),
  }, builder: { anchor: a ? { settledThroughRound: counter(a.settledThroughRound), cumulativeWork: counter(a.cumulativeWork), blockHeight: counter(a.blockHeight) } : null } };
}
export function parseStats(v: unknown): MeasurementStats {
  const o = object(v), w = object(o.window), a = object(o.activity), c = object(a.coverage), s = object(a.summary), r = object(o.rounds), records = object(o.records);
  return { installationId: text(o.installationId), generatedAt: date(o.generatedAt), range: text(o.range), window: { roundSeconds: numeric(w.roundSeconds) },
    activity: { coverage: { coverageBps: numeric(c.coverageBps), complete: c.complete === true }, summary: { observedWorkUnits: counter(s.observedWorkUnits), mostActiveDate: s.mostActiveDate == null ? null : text(s.mostActiveDate), mostActiveDateWorkUnits: counter(s.mostActiveDateWorkUnits) } },
    rounds: { medianActiveWork: nullableCounter(r.medianActiveWork), averageActiveWorkMilli: nullableCounter(r.averageActiveWorkMilli), mostActiveWork: nullableCounter(r.mostActiveWork), activeCount: numeric(r.activeCount), observedCount: numeric(r.observedCount), missingCount: numeric(r.missingCount) },
    records: { peakObservedSpeedMmPerSecond: record(records.peakObservedSpeedMmPerSecond), mostWorkUtcDay: record(records.mostWorkUtcDay) } };
}
function settlement(v: unknown): Settlement {
  const o = object(v);
  return { previousSettledThroughRound: counter(o.previousSettledThroughRound), settledThroughRound: counter(o.settledThroughRound), workAdded: counter(o.workAdded), cumulativeWork: counter(o.cumulativeWork), confirmationStatus: text(o.confirmationStatus), completedBlockCount: o.completedBlockCount == null ? undefined : counter(o.completedBlockCount), blockTimestamp: o.blockTimestamp == null ? undefined : date(o.blockTimestamp) };
}
export function parseSettlements(v: unknown): SettlementsData {
  const o = object(v), s = object(o.summary), m = isObject(o.mining) ? o.mining : null, n = m && isObject(m.nextRound) ? m.nextRound : null;
  if (o.status !== 'available' || !Array.isArray(o.recentSettlements)) throw new Error('Settlement data unavailable');
  return { installationId: text(o.installationId), generatedAt: date(o.generatedAt), status: 'available', summary: { settlementCount: counter(s.settlementCount), completedBlockCount: counter(s.completedBlockCount), workAdded: counter(s.workAdded) }, recentSettlements: o.recentSettlements.map(settlement), mining: { nextRound: n ? { round: counter(n.round), startsAt: date(n.startsAt), endsAt: date(n.endsAt) } : null } };
}
export function parseEvents(v: unknown): EventsData {
  const o = object(v);
  if (o.status !== 'available' || !Array.isArray(o.events)) throw new Error('Events unavailable');
  const events: WheelEvent[] = o.events.map(v => {
    const e = object(v), source = object(e.source);
    return { id: text(e.id), type: text(e.type), occurredAt: date(e.occurredAt), source: { confirmationStatus: text(source.confirmationStatus) }, payload: object(e.payload) };
  });
  return { installationId: text(o.installationId), generatedAt: date(o.generatedAt), status: 'available', events };
}
export async function readEndpoint<T>(path: string, parse: (v: unknown) => T, signal?: AbortSignal): Promise<T> {
  const timeout = new AbortController();
  const abort = () => timeout.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 9000);
  try {
    const response = await fetch(`${API_BASE}/${path}`, { signal: timeout.signal, cache: 'no-store', mode: 'cors' });
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    return parse(await response.json());
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
