import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import snapshot from './data/hamster-snapshot.json';
import { parseEvents, parseSettlements, parseStats, parseStatus, readEndpoint } from './api';
import { getGhost, getRoundClock, isWheelFresh } from './domain';
import type { EventsData, GhostKind, GhostPace, MeasurementStats, SettlementsData, WheelStatus } from './domain';

export const cached7: MeasurementStats = snapshot.stats7;
export const cached30: MeasurementStats = snapshot.stats30;
interface DataState {
  status: WheelStatus | null;
  stats7: MeasurementStats;
  stats30: MeasurementStats;
  cached7: boolean;
  cached30: boolean;
  settlements: SettlementsData | null;
  events: EventsData | null;
  settlementsOnline: boolean;
  eventsOnline: boolean;
  connection: 'connecting' | 'online' | 'offline';
}
interface DataContextValue extends DataState {
  now: number;
  fresh: boolean;
  running: boolean;
  round: ReturnType<typeof getRoundClock>;
  ghost: (kind: GhostKind) => GhostPace;
  refresh: () => void;
  refreshing: boolean;
  setRacing: (active: boolean) => void;
  getNow: () => number;
}
const DataContext = createContext<DataContextValue | null>(null);
export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DataState>({ status: null, stats7: cached7, stats30: cached30, cached7: true, cached30: true, settlements: null, events: null, settlementsOnline: false, eventsOnline: false, connection: 'connecting' });
  const [racing, setRacing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const offset = useRef(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now() + offset.current), 1000); return () => clearInterval(t); }, []);
  useEffect(() => {
    let stopped = false, errors = 0;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function poll() {
      try {
        const status = await readEndpoint('status', parseStatus, controller.signal);
        if (stopped) return;
        offset.current = Date.parse(status.generatedAt) - Date.now();
        setNow(Date.now() + offset.current);
        setData(d => ({ ...d, status, connection: 'online' }));
        errors = 0;
      } catch {
        if (stopped) return;
        errors++;
        setData(d => ({ ...d, connection: 'offline' }));
      }
      if (!stopped) timer = setTimeout(() => void poll(), Math.min(120000, (racing ? 5000 : 15000) * 2 ** errors));
    }
    void poll();
    return () => { stopped = true; clearTimeout(timer); controller.abort(); };
  }, [racing, refreshToken]);
  useEffect(() => {
    let stopped = false, ticks = 0, failures = 0;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function load() {
      setRefreshing(true);
      const jobs = [
        readEndpoint('settlements?range=24h', parseSettlements, controller.signal).then(settlements => { if (!stopped) setData(d => ({ ...d, settlements, settlementsOnline: true })); }).catch(() => { if (!stopped) setData(d => ({ ...d, settlementsOnline: false })); throw new Error('Settlements unavailable'); }),
        readEndpoint('events?limit=20', parseEvents, controller.signal).then(events => { if (!stopped) setData(d => ({ ...d, events, eventsOnline: true })); }).catch(() => { if (!stopped) setData(d => ({ ...d, eventsOnline: false })); throw new Error('Events unavailable'); }),
      ];
      if (ticks % 5 === 0) {
        jobs.push(readEndpoint('measurement/stats?range=7d', parseStats, controller.signal).then(stats7 => { if (!stopped) setData(d => ({ ...d, stats7, cached7: false })); }).catch(() => { if (!stopped) setData(d => ({ ...d, cached7: true })); throw new Error('Stats unavailable'); }));
        jobs.push(readEndpoint('measurement/stats?range=30d', parseStats, controller.signal).then(stats30 => { if (!stopped) setData(d => ({ ...d, stats30, cached30: false })); }).catch(() => { if (!stopped) setData(d => ({ ...d, cached30: true })); throw new Error('Stats unavailable'); }));
      }
      const results = await Promise.allSettled(jobs);
      if (stopped) return;
      setRefreshing(false);
      failures = results.every(r => r.status === 'rejected') ? failures + 1 : 0;
      ticks++;
      timer = setTimeout(() => void load(), Math.min(300000, 60000 * 2 ** failures));
    }
    void load();
    return () => { stopped = true; clearTimeout(timer); controller.abort(); };
  }, [refreshToken]);
  const ghost = useCallback((kind: GhostKind): GhostPace => getGhost(kind, data.stats7, data.stats30, kind === 'typical' ? data.cached7 : data.cached30) ?? getGhost(kind, cached7, cached30, true)!, [data.stats7, data.stats30, data.cached7, data.cached30]);
  const fresh = data.connection === 'online' && isWheelFresh(data.status, now);
  const running = fresh && (data.status?.measurement.speedMmPerSecond ?? 0) > 0;
  const value = useMemo<DataContextValue>(() => ({ ...data, now, fresh, running, round: data.settlements && data.status?.installationId === data.settlements.installationId ? getRoundClock(data.settlements, now) : null, ghost, refreshing, refresh: () => setRefreshToken(t => t + 1), setRacing, getNow: () => Date.now() + offset.current }), [data, now, fresh, running, ghost, refreshing]);
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
export function useData(): DataContextValue { const c = useContext(DataContext); if (!c) throw new Error('DataProvider missing'); return c; }
