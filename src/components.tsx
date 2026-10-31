import { useState } from 'react';
import { useData } from './DataProvider';
import { DURATIONS, durationName, formatDistance, shortDate } from './domain';
import type { Duration, GhostKind, GhostPace } from './domain';
import { Icon } from './Icons';
import type { RaceResult } from './engine';

export interface Settings { duration: Duration; ghost: GhostKind }
export function DurationPicker({ value, onChange }: { value: Duration; onChange: (value: Duration) => void }) {
  return <fieldset className="duration-picker"><legend>Race length</legend><div className="segments">{DURATIONS.map(d => <button type="button" key={d} aria-pressed={d === value} onClick={() => onChange(d)}><span>{durationName(d)}</span><small>{d === 30 ? 'Sprint' : d === 60 ? 'Chase' : 'Full round'}</small></button>)}</div></fieldset>;
}
export function GhostPicker({ value, onChange }: { value: GhostKind; onChange: (v: GhostKind) => void }) {
  return <div className="field"><label htmlFor="ghost-choice">Choose your ghost</label><select id="ghost-choice" value={value} onChange={e => onChange(e.target.value as GhostKind)}><option value="typical">Daily squeek · typical pace</option><option value="record">Personal pest · record round</option><option value="peak">Rocket paws · peak speed</option></select></div>;
}
export function PaceSource({ pace, compact = false }: { pace: GhostPace; compact?: boolean }) {
  return <p className={`source-note ${compact ? 'compact' : ''}`}><Icon name={pace.cached ? 'clock' : 'ghost'} size={16} /><span><strong>{pace.cached ? 'Cached recording' : 'Recorded pace'}</strong> · {pace.speed.toFixed(2)} m/s{!compact && <> · {pace.description.toLowerCase()} · {shortDate(pace.at)} UTC</>}</span></p>;
}
export function FeedNotice({ compact = false }: { compact?: boolean }) {
  const { connection, fresh, refresh, refreshing } = useData();
  if (connection === 'online' && fresh) return null;
  return <div className={`feed-notice ${compact ? 'compact' : ''}`} role="status"><Icon name={connection === 'connecting' ? 'wheel' : 'moon'} size={18} /><span>{connection === 'connecting' ? 'Checking the wheel. Cached Ghost Race is ready.' : 'Wheel offline. Ghost Race still works with cached recordings.'}</span><button type="button" className="text-button" onClick={refresh} disabled={refreshing}>{refreshing ? 'Checking…' : 'Retry feed'}</button></div>;
}
export function ShareResult({ result }: { result: RaceResult }) {
  const [status, setStatus] = useState('');
  const [fallback, setFallback] = useState(false);
  const url = `${location.origin}${location.pathname}#/`;
  const text = `Tiny paws. Big race. I ran ${formatDistance(result.playerDistance)} m in ${result.duration === 600 ? '10 min' : `${result.duration} sec`} on Race Squeektoshi ${result.won ? 'and beat' : 'against'} ${result.mode === 'live' ? 'the live hamster' : 'a recorded hamster ghost'}! ${url} #Squeekchain`;
  async function share() {
    try { await navigator.clipboard.writeText(text); setStatus('Copied. Ready to post on X.'); setFallback(false); }
    catch { setFallback(true); setStatus('Select and copy the result below to share.'); }
  }
  return <div className="share-control"><button type="button" className="secondary-button" onClick={() => void share()}><Icon name="copy" />Share result</button><p className="status-text" role="status">{status}</p>{fallback && <div className="field"><label htmlFor="share-text">Result for X</label><textarea id="share-text" value={text} readOnly onFocus={e => e.currentTarget.select()} rows={4} /></div>}</div>;
}
