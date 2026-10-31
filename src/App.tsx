import { useEffect, useRef, useState } from 'react';
import type { Settings } from './components';
import type { RaceMode, Route } from './domain';
import { Home } from './Home';
import { HowToPlay } from './HowToPlay';
import { HamsterMark, Icon } from './Icons';
import { Predict } from './Predict';
import { Profile } from './ProfilePage';
import { useProfile } from './profile';
import { Race } from './Race';
import { useSound } from './sound';

const routes: Route[] = ['/', '/race', '/ghost', '/predict', '/profile', '/how-to-play'];
function getRoute(): Route { const path = location.hash.slice(1); return routes.includes(path as Route) ? path as Route : '/'; }
export function App() {
  const [route, setRoute] = useState(getRoute);
  const [settings, setSettings] = useState<Settings>({ duration: 30, ghost: 'typical' });
  const [launch, setLaunch] = useState<RaceMode | null>(null);
  const { muted, toggle } = useSound();
  const { storageAvailable } = useProfile();
  const main = useRef<HTMLElement>(null), first = useRef(true);
  useEffect(() => { const change = () => setRoute(getRoute()); addEventListener('hashchange', change); return () => removeEventListener('hashchange', change); }, []);
  useEffect(() => {
    if (route !== '/race' && route !== '/ghost') setLaunch(null);
    if (first.current) { first.current = false; return; }
    window.scrollTo({ top: 0, behavior: 'instant' }); main.current?.focus({ preventScroll: true });
  }, [route]);
  const begin = (mode: RaceMode) => { setLaunch(mode); location.hash = mode === 'live' ? '/race' : '/ghost'; };
  const returnHome = () => setLaunch(null);
  return <div className="app-shell"><a className="skip-link" href="#main-content" onClick={e => { e.preventDefault(); main.current?.focus(); }}>Skip to game</a><header className="site-header"><a className="brand" href="#/" onClick={returnHome} aria-label="Race Squeektoshi home"><HamsterMark /><span><small>Race</small><span>Squeektoshi</span></span></a><nav className="desktop-nav" aria-label="Main navigation"><a href="#/" onClick={returnHome} aria-current={route === '/' || route === '/race' || route === '/ghost' ? 'page' : undefined}>The racetrack</a><a href="#/predict" aria-current={route === '/predict' ? 'page' : undefined}>Round predictor</a><a href="#/profile" aria-current={route === '/profile' ? 'page' : undefined}>Local profile</a></nav><div className="header-tools"><a href="#/how-to-play" className="icon-button" aria-label="How to play" aria-current={route === '/how-to-play' ? 'page' : undefined}><Icon name="help" /></a><button type="button" className="icon-button" aria-label={muted ? 'Turn sound on' : 'Mute sound'} aria-pressed={!muted} onClick={toggle}><Icon name={muted ? 'muted' : 'speaker'} /></button><a href="#/profile" className="icon-button mobile-profile" aria-label="Local profile"><Icon name="user" /></a></div></header><main id="main-content" ref={main} tabIndex={-1} className="main-content">{!storageAvailable && route !== '/profile' && <p className="storage-note" role="status">Storage is blocked. Progress stays for this session only.</p>}{route === '/' ? <Home settings={settings} setSettings={setSettings} begin={begin} /> : route === '/race' || route === '/ghost' ? <Race key={route} mode={route === '/race' ? 'live' : 'ghost'} settings={settings} setSettings={setSettings} autoStart={launch === (route === '/race' ? 'live' : 'ghost')} /> : route === '/predict' ? <Predict /> : route === '/profile' ? <Profile /> : <HowToPlay />}</main><footer className="site-footer"><a className="footer-brand" href="#/" onClick={returnHome}><HamsterMark />Made for the love of the wheel.</a><p>Fan-made game for Squeekchain. Sepolia testnet; SQK has no monetary value.</p><a href="#/how-to-play">Rules &amp; data<Icon name="arrow" size={14} /></a></footer></div>;
}
