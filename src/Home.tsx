import { useEffect, useRef, useState } from 'react';
import { useData } from './DataProvider';
import { DurationPicker, FeedNotice, GhostPicker, PaceSource } from './components';
import type { Settings } from './components';
import { formatDistance, formatTime } from './domain';
import type { RaceMode } from './domain';
import { Icon } from './Icons';
import { BADGES, bestKey, useProfile } from './profile';
import { Scene } from './Scene';

export function Home({ settings, setSettings, begin }: { settings: Settings; setSettings: (settings: Settings) => void; begin: (mode: RaceMode) => void }) {
  const data = useData();
  const { profile } = useProfile();
  const [mode, setMode] = useState<'ghost' | 'live' | 'predict'>(data.running ? 'live' : 'ghost');
  const wasRunning = useRef(false);
  useEffect(() => { if (data.running && !wasRunning.current) setMode(m => m === 'predict' ? m : 'live'); wasRunning.current = data.running; }, [data.running]);
  const pace = data.ghost(settings.ghost);
  const best = profile.bests[bestKey(mode === 'live' ? 'live' : 'ghost', settings.ghost, settings.duration)];
  const wheel = data.fresh ? data.status?.measurement : null;
  return <>
    <section className="home-intro"><h1>Tiny paws.<br className="phone-break" /> Big race.</h1><p>A rhythm race against Squeekchain’s real hamster.</p></section>
    <section className="arcade" aria-label="Choose and start a game">
      <div className="wheel-stage">
        <div className="stage-top"><span className={`wheel-state ${data.running ? 'running' : ''}`}><Icon name={data.running ? 'bolt' : 'moon'} size={18} />{data.running ? 'Squeektoshi is running' : data.fresh ? 'Squeektoshi is resting' : 'Squeektoshi’s wheel'}</span><span className="feed-label"><span className={`status-dot ${data.fresh ? 'connected' : ''}`} />{data.fresh ? 'Live wheel' : 'Awaiting feed'}</span></div>
        <Scene running={data.running} rpm={wheel ? wheel.rpmMilli / 1000 : 0} />
        <div className="stage-bottom"><span>{data.running ? 'The tiniest rival. The real deal.' : data.fresh ? 'Dreaming of the next personal best.' : 'A little patience. A lot of paws.'}</span></div>
        <dl className="telemetry" aria-label="Live wheel measurements"><div><dt>Wheel pace</dt><dd>{wheel ? (wheel.speedMmPerSecond / 1000).toFixed(2) : '—'}<small> m/s</small></dd></div><div><dt>Total turns</dt><dd>{wheel ? Number(wheel.cumulativeWorkUnits).toLocaleString() : '—'}</dd></div><div><dt>Wheel rpm</dt><dd>{wheel ? (wheel.rpmMilli / 1000).toFixed(1) : '—'}</dd></div><div><dt>Round</dt><dd>{data.fresh && data.round ? `#${data.round.currentRound}` : '—'}</dd></div></dl>
      </div>
      <div className="game-console">
        <div className="mode-picker" role="group" aria-label="Game mode"><button type="button" aria-pressed={mode === 'ghost'} onClick={() => setMode('ghost')}><Icon name="ghost" size={18} />Ghost</button><button type="button" aria-pressed={mode === 'live'} onClick={() => setMode('live')}><Icon name="bolt" size={18} />Live</button><button type="button" aria-pressed={mode === 'predict'} onClick={() => setMode('predict')}><Icon name="target" size={18} />Predict</button></div>
        {mode === 'predict' ? <div className="predict-preview"><Icon name="target" size={32} /><h2>Got a hamster hunch?</h2><p>Guess the wheel turns before the next ten-minute round. Win local points for getting close.</p><a href="#/predict" className="primary-button">Make a prediction<Icon name="arrow" /></a><p className="control-hint">No stakes. Just bragging rights.</p></div> : <>
          <div className="console-heading"><h2>{mode === 'ghost' ? 'Chase a little legend.' : 'Paws against paws.'}</h2><p>{mode === 'ghost' ? 'Race a pace from the real wheel.' : data.running ? 'You versus the hamster, right now.' : 'A recorded ghost is ready while the wheel rests.'}</p></div>
          {mode === 'ghost' ? <><GhostPicker value={settings.ghost} onChange={ghost => setSettings({ ...settings, ghost })} /><PaceSource pace={pace} compact /></> : <div className="live-info"><Icon name={data.running ? 'bolt' : 'moon'} size={24} /><span>{data.running ? 'Live pace follows the real wheel.' : data.fresh ? 'Squeektoshi is resting. Live Race opens when the wheel moves.' : 'The wheel feed is unavailable. Try a recorded ghost.'}</span></div>}
          <DurationPicker value={settings.duration} onChange={duration => setSettings({ ...settings, duration })} />
          {mode === 'live' && !data.running ? <button type="button" className="primary-button" onClick={() => { setMode('ghost'); begin('ghost'); }}>Race a recorded ghost<Icon name="arrow" /></button> : <button type="button" className="primary-button" onClick={() => begin(mode)}>{mode === 'ghost' ? 'Race the ghost' : 'Start live race'}<Icon name="arrow" /></button>}
          <p className="control-hint"><kbd>Space</kbd> or arrow keys · Big tap button on mobile</p>
          <div className="console-best"><Icon name="trophy" size={18} /><span>{best != null ? <>Local best <strong>{formatDistance(best)} m</strong></> : 'Your first finish awaits.'}</span></div>
        </>}
      </div>
    </section>
    <FeedNotice />
    <div className="under-track"><span><Icon name="heart" size={16} />No wallet needed to race.</span><a href="#/how-to-play">Learn the rhythm<Icon name="arrow" size={16} /></a></div>
    <section className="side-quests" aria-label="More ways to play"><a href="#/predict" className="quest"><div className="quest-icon"><Icon name="target" size={26} /></div><div><h2>A hunch for the next round?</h2><p>{data.fresh && data.round ? <>Next round opens in <span className="tabular">{formatTime(data.round.remaining)}</span>. Call the turns.</> : 'Call the turns to start an accuracy streak.'}</p></div><Icon name="arrow" /></a><a href="#/profile" className="quest"><div className="badge-preview" aria-hidden="true">{BADGES.slice(0, 3).map(b => <span key={b.id} className={profile.badges.includes(b.id) ? 'earned' : ''}><Icon name={b.icon} size={22} /></span>)}</div><div><h2>Earn your whiskers.</h2><p>{profile.badges.length ? `${profile.badges.length} of ${BADGES.length} local badges unlocked.` : 'Unlock titles as your race record grows.'}</p></div><Icon name="arrow" /></a></section>
    <section className="rhythm-explainer" aria-label="Game essentials"><div><span className="step-marker">01</span><h2>Find your rhythm</h2><p>Steady taps build speed. Settle into a half-second beat.</p></div><div><span className="step-marker">02</span><h2>Save your stamina</h2><p>Mashing tires you out. Leave a little room between your paws.</p></div><div><span className="step-marker">03</span><h2>Chase your best</h2><p>Beat recorded ghosts, unlock titles, then meet the live hamster.</p></div></section>
  </>;
}
