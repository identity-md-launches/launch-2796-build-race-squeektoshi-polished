import { useEffect, useRef, useState } from 'react';
import { useData } from './DataProvider';
import { FeedNotice } from './components';
import { formatTime, numberOf } from './domain';
import { Icon } from './Icons';
import { useProfile } from './profile';
import type { Prediction } from './predictor';

export function Predict() {
  const data = useData(), { profile, update } = useProfile();
  const typical = numberOf(data.stats7.rounds.medianActiveWork);
  const [guess, setGuess] = useState(String(typical ?? ''));
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const round = data.round;
  const current = profile.predictions.find(p => p.installationId === data.status?.installationId && p.round === round?.nextRound);
  const priorRound = useRef<number | null>(null);
  useEffect(() => {
    if (round && priorRound.current !== round.nextRound) {
      setGuess(String(current?.turns ?? typical ?? '')); setMessage(''); setError(''); priorRound.current = round.nextRound;
    }
  }, [round, current, typical]);
  const canPredict = data.fresh && data.settlementsOnline && !!round && data.status?.installationId === data.settlements?.installationId;
  const sliderMax = Math.ceil(Math.max(1000, (numberOf(data.stats7.rounds.mostActiveWork) ?? 0) * 2) / 100) * 100;
  const value = numberOf(guess);
  function save(e: React.FormEvent) {
    e.preventDefault(); setMessage('');
    if (!round || !canPredict || !data.status) { setError('A fresh wheel feed and round schedule are needed. Retry the feed.'); return; }
    const now = data.getNow();
    if (now >= round.startsAt) { setError('That round has started. Wait for the next round to appear.'); return; }
    if (value === null || !Number.isInteger(value) || value > 1000000) { setError('Enter a whole number from 0 to 1,000,000 wheel turns.'); input.current?.focus(); return; }
    const saved: Prediction = { id: current?.id ?? crypto.randomUUID(), installationId: data.status.installationId, round: round.nextRound, turns: value, startsAt: round.startsAt, endsAt: round.endsAt, savedAt: now, state: 'pending' };
    update(p => {
      const found = p.predictions.find(x => x.id === saved.id);
      if (found && (found.state !== 'pending' || data.getNow() >= found.startsAt)) return p;
      return { ...p, predictionCount: p.predictionCount + (found ? 0 : 1), predictions: [...p.predictions.filter(x => x.id !== saved.id), saved] };
    });
    setError(''); setMessage(`Prediction saved for round #${round.nextRound}. You can edit it until the round starts.`);
  }
  const pending = profile.predictions.filter(p => p.state === 'pending').sort((a, b) => b.round - a.round);
  const history = profile.predictions.filter(p => p.state !== 'pending').sort((a, b) => b.endsAt - a.endsAt).slice(0, 20);
  return <>
    <div className="page-heading"><div><h1>Call the next round.</h1><p>A little instinct. A lot of wheel turns.</p></div><a href="#/how-to-play" className="text-button">How scoring works<Icon name="help" size={18} /></a></div>
    <FeedNotice />
    <div className="predict-layout"><section className="prediction-form-section"><div className="round-banner"><Icon name="clock" size={24} /><div><strong>{canPredict && round ? `Round #${round.nextRound}` : 'Waiting for a round schedule'}</strong><span>{canPredict && round ? <>Starts in <b className="tabular">{formatTime(round.remaining)}</b> · ten-minute round</> : 'Predictions open with a fresh API connection.'}</span></div><span className={`status-dot ${canPredict ? 'connected' : ''}`} /></div><form onSubmit={save} noValidate><label className="guess-label" htmlFor="turns-number">Your prediction in wheel turns</label><div className="guess-input"><input ref={input} type="number" inputMode="numeric" id="turns-number" min="0" max="1000000" step="1" value={guess} onChange={e => { setGuess(e.target.value); setError(''); }} aria-describedby="prediction-hint prediction-error" aria-invalid={!!error} /><Icon name="wheel" size={32} /></div><label className="sr-only" htmlFor="turns-slider">Adjust predicted wheel turns</label><input id="turns-slider" className="turns-slider" type="range" min="0" max={sliderMax} step="1" value={Math.min(value ?? 0, sliderMax)} onChange={e => { setGuess(e.target.value); setError(''); }} /><div className="slider-labels" aria-hidden="true"><span>0 turns</span><span>{sliderMax.toLocaleString()} turns</span></div><p id="prediction-hint" className="prediction-hint"><Icon name="ghost" size={18} /><span>{typical !== null ? <>7-day typical active round: <strong>{typical.toLocaleString()} turns</strong>. {data.cached7 ? 'Cached recording' : 'Recorded median'}; resting rounds can be zero.</> : 'The API has no typical-round value available.'}</span></p><p id="prediction-error" className="field-error" role="alert">{error}</p><button type="submit" className="primary-button" disabled={!canPredict}>{current ? 'Update prediction' : 'Save prediction'}<Icon name="target" /></button><p className="control-hint">Locks at round start. Local game points only.</p><p className="form-message" role="status">{message}</p></form></section><aside className="prediction-rules"><Icon name="target" size={32} /><h2>Close counts.<br /> Exact feels better.</h2><p>Each wheel turn is one work unit, about 0.88 meters. Predict turns for the full round, including rest.</p><dl className="scoring-list"><div><dt>Within 2 turns or 1%</dt><dd>500 pts</dd></div><div><dt>Within 5%</dt><dd>250 pts</dd></div><div><dt>Within 10%</dt><dd>150 pts</dd></div><div><dt>Within 20%</dt><dd>75 pts</dd></div><div><dt>Every other verified guess</dt><dd>10 pts</dd></div></dl><p className="source-note">Exact-band or ≤10% guesses build a streak: +25 points per streak step, up to +125.</p><div className="streak-display"><Icon name="bolt" /><strong>{profile.predictionStreak}</strong><span>local accuracy streak</span></div></aside></div>
    <section className="prediction-history"><div className="section-heading"><h2>Your calls</h2><button type="button" className="secondary-button" onClick={data.refresh} disabled={data.refreshing}><Icon name="retry" size={18} />{data.refreshing ? 'Checking…' : 'Check results'}</button></div><p className="section-description">Stored in this browser. Resolved from safe settlements, with the last 20 completed calls kept here.</p>{pending.length > 0 && <div className="pending-predictions">{pending.map(p => <div className="pending-call" key={p.id}><Icon name={data.now >= p.startsAt ? 'lock' : 'clock'} /><div><strong>Round #{p.round} · {p.turns.toLocaleString()} turns</strong><span>{data.now < p.startsAt ? 'Saved · editable before the round starts' : data.now < p.endsAt ? 'Locked · round in progress' : 'Locked · waiting for verified settlement'}</span></div></div>)}</div>}{history.length ? <div className="table-wrap" role="region" aria-label="Prediction history; scroll for all columns" tabIndex={0}><table><caption className="sr-only">Last twenty completed predictions</caption><thead><tr><th>Round</th><th>Your turns</th><th>Real turns</th><th>Result</th><th>Local points</th></tr></thead><tbody>{history.map(p => <tr key={p.id}><th scope="row">#{p.round}</th><td>{p.turns.toLocaleString()}</td><td>{p.actual != null ? p.actual.toLocaleString() : '—'}</td><td>{p.state === 'unverified' ? 'Could not verify' : <>{p.tier}<small>{p.errorPercent?.toFixed(1)}% error</small></>}</td><td>{p.points != null ? `+${p.points}` : 'No score'}</td></tr>)}</tbody></table></div> : !pending.length ? <div className="empty-state"><Icon name="target" size={28} /><p>Your next hunch belongs here.</p><span>Save a prediction above before the next round begins.</span></div> : null}<p className="source-note">If exact data is unavailable two hours after the round ends, the call is marked “Could not verify” without changing your streak. Later visits retry verification if evidence becomes available.</p></section>
  </>;
}
