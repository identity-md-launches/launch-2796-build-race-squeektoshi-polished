import { useState } from 'react';
import { durationName, formatDistance } from './domain';
import type { Duration } from './domain';
import { BADGES, useProfile } from './profile';
import { Icon } from './Icons';

export function Profile() {
  const { profile, update, storageAvailable } = useProfile();
  const [nickname, setNickname] = useState(profile.nickname);
  const [title, setTitle] = useState(profile.title);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const bests = Object.entries(profile.bests).sort(([a], [b]) => a.localeCompare(b));
  function save(e: React.FormEvent) {
    e.preventDefault();
    const name = nickname.replace(/[\u0000-\u001f\u007f]/g, '').trim();
    if (!name || name.length > 24) { setError('Choose a nickname with 1 to 24 characters.'); document.getElementById('nickname')?.focus(); return; }
    update(p => ({ ...p, nickname: name, title })); setNickname(name); setError(''); setMessage(storageAvailable ? 'Profile saved in this browser.' : 'Profile updated for this session. Browser storage is blocked.');
  }
  return <>
    <div className="page-heading"><div><h1>Your little legacy.</h1><p>All progress is local to this browser.</p></div><a href="#/ghost" className="secondary-button">Race a ghost<Icon name="arrow" /></a></div>
    {!storageAvailable && <p className="feed-notice" role="status"><Icon name="lock" />Browser storage is blocked. You can play, but progress lasts only for this session.</p>}
    <div className="profile-overview"><div className="profile-identity"><span className="profile-avatar"><Icon name="user" size={40} /></span><div><h2><bdi>{profile.nickname}</bdi></h2><p>{profile.title}</p></div></div><dl className="profile-totals"><div><dt>Local points</dt><dd>{profile.points.toLocaleString()}</dd></div><div><dt>Races finished</dt><dd>{profile.races}</dd></div><div><dt>Game meters run</dt><dd>{formatDistance(profile.distance)}</dd></div><div><dt>Race wins</dt><dd>{profile.wins}</dd></div></dl></div>
    <form className="profile-form" onSubmit={save} noValidate><div className="field"><label htmlFor="nickname">Nickname</label><input id="nickname" autoComplete="nickname" maxLength={24} value={nickname} onChange={e => { setNickname(e.target.value); setMessage(''); }} aria-describedby="nickname-error" aria-invalid={!!error} /></div><div className="field"><label htmlFor="profile-title">Unlocked title</label><select id="profile-title" value={title} onChange={e => setTitle(e.target.value)}><option>New whiskers</option>{BADGES.filter(b => profile.badges.includes(b.id)).map(b => <option key={b.id}>{b.title}</option>)}</select></div><button type="submit" className="secondary-button">Save profile<Icon name="check" size={18} /></button><p id="nickname-error" className={error ? 'field-error' : 'field-error sr-only'} role="alert">{error}</p><p className={message ? 'form-message' : 'form-message sr-only'} role="status">{message}</p></form>
    <section className="badge-section"><div className="section-heading"><h2>Earn your whiskers.</h2><span>{profile.badges.length} / {BADGES.length} unlocked locally</span></div><div className="badge-grid">{BADGES.map(b => { const earned = profile.badges.includes(b.id); return <div className={`badge-tile ${earned ? 'earned' : ''}`} key={b.id}><span className="badge-medal"><Icon name={b.icon} size={28} /></span><div><h3>{b.name}</h3><p>{b.description}</p><span className="badge-status"><Icon name={earned ? 'check' : 'lock'} size={14} />{earned ? `Unlocked · ${b.title}` : 'Locked'}</span></div></div>; })}</div></section>
    <section className="personal-bests"><div className="section-heading"><h2>Personal bests</h2><span>Game distance · this browser</span></div>{bests.length ? <div className="table-wrap" role="region" aria-label="Personal bests; scroll for all columns" tabIndex={0}><table><caption className="sr-only">Best distance by mode, recorded ghost and race length</caption><thead><tr><th>Opponent</th><th>Game mode</th><th>Length</th><th>Best distance</th></tr></thead><tbody>{bests.map(([key, distance]) => { const [mode, ghost, duration] = key.split(':'); const name = mode === 'live' ? 'Squeektoshi' : ghost === 'typical' ? 'Daily squeek' : ghost === 'record' ? 'Personal pest' : 'Rocket paws'; return <tr key={key}><th scope="row">{name}</th><td>{mode === 'live' ? 'Live pace' : 'Recorded ghost'}</td><td>{durationName(Number(duration) as Duration)}</td><td>{formatDistance(distance)} m</td></tr>; })}</tbody></table></div> : <div className="empty-state"><Icon name="trophy" size={28} /><p>A little room for a big personal best.</p><a href="#/ghost">Start your first ghost race<Icon name="arrow" size={16} /></a></div>}</section>
  </>;
}
