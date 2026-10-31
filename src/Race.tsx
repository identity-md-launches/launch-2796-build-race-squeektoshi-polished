import { useCallback, useEffect, useRef, useState } from 'react';
import { useData } from './DataProvider';
import { DurationPicker, FeedNotice, GhostPicker, PaceSource, ShareResult } from './components';
import type { Settings } from './components';
import { durationName, formatDistance, formatTime } from './domain';
import type { GhostPace, RaceMode } from './domain';
import { RaceEngine } from './engine';
import type { RaceResult } from './engine';
import { Icon } from './Icons';
import { bestKey, useProfile } from './profile';
import { Scene } from './Scene';
import { useSound } from './sound';

type Phase = 'ready' | 'countdown' | 'running' | 'paused' | 'interrupted' | 'finished';
export function Race({ mode, settings, setSettings, autoStart = false }: { mode: RaceMode; settings: Settings; setSettings: (s: Settings) => void; autoStart?: boolean }) {
  const data = useData(), { profile, finishRace } = useProfile(), sound = useSound();
  const [phase, setPhase] = useState<Phase>('ready');
  const [engine, setEngine] = useState(() => new RaceEngine(settings.duration, mode === 'ghost' ? data.ghost(settings.ghost).speed : (data.status?.measurement.speedMmPerSecond ?? 0) / 1000));
  const [recording, setRecording] = useState<GhostPace>(() => data.ghost(settings.ghost));
  const [countdown, setCountdown] = useState(3);
  const [result, setResult] = useState<RaceResult | null>(null);
  const [newBest, setNewBest] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [, redraw] = useState(0);
  const startConsumed = useRef(false), resultHeading = useRef<HTMLHeadingElement>(null), tapButton = useRef<HTMLButtonElement>(null);
  const baselineBest = useRef(0), lastUi = useRef(0), lastAnnouncement = useRef(-1);
  const latest = useRef({ data, sound, phase, profile, finishRace }); latest.current = { data, sound, phase, profile, finishRace };
  const pace = data.ghost(settings.ghost);
  const readyOpponentSpeed = mode === 'ghost' ? pace.speed : data.fresh ? (data.status?.measurement.speedMmPerSecond ?? 0) / 1000 : 0;
  useEffect(() => { if (phase === 'ready') engine.opponentSpeed = readyOpponentSpeed; }, [phase, engine, readyOpponentSpeed]);
  const prepare = useCallback(() => {
    if (mode === 'live' && !latest.current.data.running) return;
    const ghost = latest.current.data.ghost(settings.ghost);
    const opponent = mode === 'ghost' ? ghost.speed : (latest.current.data.status?.measurement.speedMmPerSecond ?? 0) / 1000;
    setEngine(new RaceEngine(settings.duration, opponent)); setRecording(ghost); setResult(null); setCountdown(3); setPhase('countdown');
    baselineBest.current = latest.current.profile.bests[bestKey(mode, settings.ghost, settings.duration)] ?? 0;
    lastUi.current = 0; lastAnnouncement.current = -1;
    latest.current.sound.play('start');
  }, [mode, settings.duration, settings.ghost]);
  useEffect(() => { if (autoStart && !startConsumed.current) { startConsumed.current = true; prepare(); } }, [autoStart, prepare]);
  useEffect(() => { data.setRacing(phase === 'running' || phase === 'countdown' || phase === 'paused'); return () => data.setRacing(false); }, [phase, data.setRacing]);
  useEffect(() => {
    if (phase !== 'countdown') return;
    const deadline = performance.now() + 3000;
    const t = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline - performance.now()) / 1000));
      setCountdown(remaining);
      if (remaining === 0) { clearInterval(t); setPhase('running'); requestAnimationFrame(() => tapButton.current?.focus()); }
    }, 100);
    return () => clearInterval(t);
  }, [phase]);
  useEffect(() => {
    if (phase !== 'running') return;
    let frame = 0, previous = performance.now();
    const update = (now: number) => {
      const delta = Math.min(0.25, (now - previous) / 1000); previous = now;
      const current = latest.current;
      if (mode === 'live' && !current.data.fresh) { setPhase('interrupted'); return; }
      const target = mode === 'ghost' ? recording.speed : (current.data.status?.measurement.speedMmPerSecond ?? 0) / 1000;
      engine.step(delta, target);
      if (now - lastUi.current > 40) { redraw(n => n + 1); lastUi.current = now; }
      const bucket = Math.floor(engine.elapsed / 5);
      if (bucket !== lastAnnouncement.current) { setAnnouncement(`${formatTime(Math.ceil(engine.duration - engine.elapsed))} remaining. You: ${formatDistance(engine.playerDistance)} meters. ${mode === 'ghost' ? 'Recorded ghost' : 'Live pace'}: ${formatDistance(engine.opponentDistance)} meters. Stamina ${Math.round(engine.stamina)} percent.`); lastAnnouncement.current = bucket; }
      if (engine.finished) {
        const r = engine.result({ id: crypto.randomUUID(), mode, ghost: recording.kind, opponentLabel: mode === 'ghost' ? recording.name : 'Squeektoshi', cached: mode === 'ghost' && recording.cached });
        setResult(r); setNewBest(r.playerDistance > baselineBest.current); current.finishRace(r); current.sound.play('finish'); setPhase('finished'); return;
      }
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [phase, mode, recording, engine]);
  useEffect(() => {
    if (phase !== 'running') return;
    const onKey = (e: KeyboardEvent) => {
      if (!['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) || e.altKey || e.metaKey || e.ctrlKey) return;
      const target = e.target as HTMLElement;
      if (target.closest('input, select, textarea, a') || (target.closest('button') && target !== tapButton.current)) return;
      e.preventDefault();
      if (e.repeat) return;
      const quality = engine.tap(); latest.current.sound.play(quality === 'perfect' ? 'perfect' : quality === 'fast' ? 'fast' : 'tap'); redraw(n => n + 1);
    };
    const hidden = () => { if (document.hidden) setPhase(mode === 'ghost' ? 'paused' : 'interrupted'); };
    hidden();
    addEventListener('keydown', onKey); document.addEventListener('visibilitychange', hidden);
    return () => { removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', hidden); };
  }, [phase, engine, mode]);
  useEffect(() => { if (phase === 'finished') resultHeading.current?.focus(); }, [phase]);
  const tap = () => { if (phase !== 'running') return; const quality = engine.tap(); sound.play(quality === 'perfect' ? 'perfect' : quality === 'fast' ? 'fast' : 'tap'); redraw(n => n + 1); };
  const currentRpm = mode === 'ghost' ? recording.speed / 0.88 * 60 : data.fresh ? (data.status?.measurement.rpmMilli ?? 0) / 1000 : 0;
  const busy = phase !== 'ready' && phase !== 'finished';
  return <div className="race-page">
    <div className="page-heading"><div><h1>{mode === 'ghost' ? 'Ghost race' : 'Live race'}</h1><p>{mode === 'ghost' ? 'Recorded paws. Real competition.' : 'The real wheel sets the pace.'}</p></div><a href="#/" className="text-button"><Icon name="close" size={18} />{busy ? 'Leave race' : 'Back to track'}</a></div>
    {mode === 'live' && <FeedNotice />}
    {phase === 'finished' && result ? <section className="result-screen" aria-label="Race result"><div className="result-art"><Icon name={result.won ? 'trophy' : 'flag'} size={48} /><h2 ref={resultHeading} tabIndex={-1}>{result.won ? 'Paws ahead!' : 'A finish worth chasing.'}</h2><p>{newBest ? 'A new personal best. Tiny victory dance.' : 'Every finish makes a faster pair of paws.'}</p><span className="result-points">+{result.points}<small> local points</small></span></div><div className="result-details"><dl className="result-distances"><div><dt>{profile.nickname}</dt><dd>{formatDistance(result.playerDistance)}<small> m</small></dd></div><div><dt>{result.opponentLabel} · {mode === 'ghost' ? 'recorded' : 'live pace'}</dt><dd>{formatDistance(result.opponentDistance)}<small> m</small></dd></div></dl><div className="result-facts"><span>{durationName(result.duration)} race</span><span>{result.perfectTaps} perfect taps</span><span>{result.maxCombo} best rhythm streak</span></div><p className="source-note">{mode === 'live' ? 'Opponent distance is an estimate integrated from real speed samples, polled every five seconds.' : `${result.cached ? 'Cached recording' : 'Recorded performance'} · ${recording.description}. This ghost holds that average or peak pace for your race.`}</p><div className="result-actions"><button type="button" className="primary-button" onClick={prepare} disabled={mode === 'live' && !data.running}>Race again<Icon name="retry" /></button><a className="secondary-button" href="#/profile">See local profile<Icon name="user" /></a></div>{mode === 'live' && !data.running && <p className="control-hint">The wheel is resting or offline. <a href="#/ghost">Race a recorded ghost</a>.</p>}<ShareResult result={result} /></div></section> : <>
      <div className={`race-layout ${phase === 'ready' ? 'setup-layout' : ''}`}>
        <div className="race-arena">
          <div className="race-scoreboard"><div><span>Time left</span><strong>{formatTime(Math.ceil(engine.duration - engine.elapsed))}</strong></div><div className="player-value"><span>You · game distance</span><strong>{formatDistance(engine.playerDistance)}<small> m</small></strong></div><div><span>{mode === 'ghost' ? 'Recorded ghost' : 'Live pace'}</span><strong>{formatDistance(engine.opponentDistance)}<small> m</small></strong></div></div>
          <div className="race-scene"><Scene variant="race" running={data.running} rpm={currentRpm} ghost={mode === 'ghost'} engine={engine} active={phase === 'running'} /><span className="lane-label player-lane"><span className="player-dot" />{profile.nickname}</span><span className="lane-label opponent-lane"><Icon name={mode === 'ghost' ? 'ghost' : 'bolt'} size={14} />{mode === 'ghost' ? (busy ? recording.name : pace.name) : 'Squeektoshi'}</span>{phase === 'countdown' && <div className="countdown-overlay" role="status"><strong>{countdown}</strong><span>Get those paws ready.</span></div>}{(phase === 'paused' || phase === 'interrupted') && <div className="pause-overlay"><Icon name={phase === 'paused' ? 'pause' : 'moon'} size={32} /><h2>{phase === 'paused' ? 'Take a tiny breath.' : 'Live race interrupted.'}</h2><p>{phase === 'paused' ? 'Your ghost race is paused.' : 'The feed was lost or this tab was hidden. Restart with a fresh feed.'}</p>{phase === 'paused' ? <button type="button" className="primary-button" onClick={() => { setPhase('running'); requestAnimationFrame(() => tapButton.current?.focus()); }}>Resume race<Icon name="play" /></button> : <div className="interrupt-actions"><button type="button" className="secondary-button" onClick={prepare} disabled={!data.running}>Restart live race</button><a href="#/ghost" className="primary-button">Race a ghost<Icon name="arrow" /></a></div>}</div>}</div>
          <div className="gap-row"><Icon name="route" size={18} /><span>{phase === 'ready' || phase === 'countdown' ? 'One steady beat. Two determined hamsters.' : Math.abs(engine.playerDistance - engine.opponentDistance) < 0.1 ? 'Whisker to whisker.' : `${engine.playerDistance > engine.opponentDistance ? 'You lead' : 'You trail'} by ${formatDistance(Math.abs(engine.playerDistance - engine.opponentDistance))} m`}</span>{phase === 'running' && mode === 'ghost' && <button type="button" className="text-button" onClick={() => setPhase('paused')}><Icon name="pause" size={16} />Pause</button>}</div>
        </div>
        {phase === 'ready' ? <div className="race-setup"><h2>Set your challenge.</h2>{mode === 'ghost' ? <><GhostPicker value={settings.ghost} onChange={ghost => { setSettings({ ...settings, ghost }); setEngine(new RaceEngine(settings.duration, data.ghost(ghost).speed)); }} /><PaceSource pace={pace} /></> : <p className="live-info">{data.running ? 'Squeektoshi is running. The opponent follows live wheel speed.' : data.fresh ? 'Squeektoshi is resting. Live Race opens when the wheel starts.' : 'Live Race needs a fresh wheel feed.'}</p>}<DurationPicker value={settings.duration} onChange={duration => { setSettings({ ...settings, duration }); setEngine(new RaceEngine(duration, mode === 'ghost' ? pace.speed : (data.status?.measurement.speedMmPerSecond ?? 0) / 1000)); }} /><button type="button" className="primary-button" onClick={prepare} disabled={mode === 'live' && !data.running}>Start {mode === 'ghost' ? 'ghost' : 'live'} race<Icon name="arrow" /></button><p className="control-hint">Tap about twice a second. Mashing drains stamina.</p>{mode === 'live' && !data.running && <a className="secondary-button" href="#/ghost">Race a recorded ghost<Icon name="ghost" /></a>}</div> : <div className="rhythm-controls"><div className="stamina-heading"><label htmlFor="stamina">Stamina</label><strong>{Math.round(engine.stamina)}%</strong></div><progress id="stamina" className={engine.stamina < 25 ? 'tired' : ''} max="100" value={engine.stamina}>{Math.round(engine.stamina)}%</progress><div className="beat-meter" aria-hidden="true"><div className="beat-zone" /><span className="beat-marker" style={{ left: `${engine.elapsed % 0.5 / 0.5 * 100}%` }} />{Array.from({ length: 9 }, (_, i) => <i key={i} />)}</div><p className="rhythm-feedback">{phase === 'countdown' ? 'Wait for the countdown…' : engine.feedback}</p><button ref={tapButton} type="button" className="tap-button" onPointerDown={e => { if (e.button === 0) { e.preventDefault(); tap(); } }} onClick={e => { if (e.detail === 0) tap(); }} disabled={phase !== 'running'}><Icon name="bolt" size={26} /><span>Tap to run</span><small>Find the half-second beat</small></button><p className="control-hint"><kbd>Space</kbd> or arrow keys · Tap as the marker crosses the center</p><div className="rhythm-stats"><span><strong>{engine.perfectTaps}</strong> perfect taps</span><span><strong>{engine.maxCombo}</strong> best streak</span></div></div>}
      </div>
      {mode === 'ghost' && phase !== 'ready' && <PaceSource pace={recording} />}
      {mode === 'live' && <p className="source-note"><span className={`status-dot ${data.fresh ? 'connected' : ''}`} />{data.fresh ? `Live wheel · ${((data.status?.measurement.speedMmPerSecond ?? 0) / 1000).toFixed(2)} m/s · ${data.running ? 'running' : 'resting'} · pace samples every 5 seconds while racing.` : 'No fresh wheel signal. A live race needs the real feed.'}</p>}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</div>
    </>}
  </div>;
}
