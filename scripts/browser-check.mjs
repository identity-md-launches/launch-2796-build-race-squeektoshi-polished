import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { chromium, webkit } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

// A bounded foreground preview; no service or backend is installed or left running.
const root = resolve('dist'), out = resolve('test/scratch/browser-check'), prefix = '/ipfs/check-cid/nested/race/';
await mkdir(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain' };
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (!path.startsWith(prefix)) { res.writeHead(404).end(); return; }
    const file = resolve(root, decodeURIComponent(path.slice(prefix.length)) || 'index.html');
    if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    res.setHeader('Content-Type', mime[extname(file)] ?? 'application/octet-stream'); res.end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}${prefix}`;
const results = [], limitations = [], activeBrowsers = [];
const fixture = async name => JSON.parse(await readFile(resolve(`tests/fixtures/${name}.json`), 'utf8'));
const statusFixture = await fixture('status'), settlementFixture = await fixture('settlements'), eventsFixture = await fixture('events');
const snapshot = JSON.parse(await readFile(resolve('src/data/hamster-snapshot.json'), 'utf8'));
function track(page, allowApiFailure = false) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', e => { if (e.type() === 'error' && !(allowApiFailure && /Failed to load resource|net::ERR_FAILED/.test(e.text()))) errors.push(e.text()); });
  page.on('response', r => { if (r.url().startsWith(base) && r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  return errors;
}
async function noOverflow(page) { assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1), false, 'page must reflow without horizontal scroll'); }
async function mockApi(page, state) {
  await page.route('https://api.squeekchain.com/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const now = await page.evaluate(() => Date.now());
    if (path.endsWith('/status')) {
      state.polls.push(now);
      if (state.failStatus || state.offline) return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
      const status = structuredClone(statusFixture);
      status.generatedAt = new Date(now).toISOString(); status.measurement.observedAt = status.generatedAt;
      // Synthetic RUNNING state for interaction coverage, using the captured record's real speed/rpm.
      status.measurement.speedMmPerSecond = state.running ? Number(snapshot.stats30.records.peakObservedSpeedMmPerSecond.value) : 0;
      status.measurement.rpmMilli = state.running ? 111256 : 0;
      status.measurement.coreStatus = state.running ? 'RUNNING' : 'IDLE';
      return route.fulfill({ json: status });
    }
    if (state.offline) return route.fulfill({ status: 503, json: {} });
    if (path.endsWith('/measurement/stats')) return route.fulfill({ json: new URL(route.request().url()).searchParams.get('range') === '7d' ? snapshot.stats7 : snapshot.stats30 });
    if (path.endsWith('/settlements')) return route.fulfill({ json: settlementFixture });
    const events = structuredClone(eventsFixture);
    if (state.proof) {
      const event = structuredClone(events.events.find(e => e.type === 'system.settlement_completed'));
      event.id = `synthetic-check-round-${state.proof.round}`;
      event.occurredAt = new Date(now).toISOString();
      event.payload = { previousSettledThroughRound: String(state.proof.round - 1), settledThroughRound: String(state.proof.round), workAdded: String(state.proof.work), cumulativeWork: String(58518 + state.proof.work), completedBlockCount: '0' };
      events.events.unshift(event);
    }
    return route.fulfill({ json: events });
  });
}
const freshState = (extra = {}) => ({ offline: false, running: false, failStatus: false, polls: [], proof: null, ...extra });
const storageProfile = page => page.evaluate(() => JSON.parse(localStorage.getItem('race-squeektoshi.profile.v1')));
async function recordedRace(browser, name) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  if (name === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const page = await context.newPage(), errors = track(page, true), state = freshState({ offline: true });
  await page.clock.install({ time: new Date(statusFixture.generatedAt) });
  await mockApi(page, state); await page.goto(base, { waitUntil: 'networkidle' });
  await page.getByText('Wheel offline.', { exact: false }).waitFor();
  // Freeze wall time between automation commands; advance only the intended beat interval.
  // This keeps slower software-rendered WebKit actions from changing the input cadence.
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 1000));
  assert.match(await page.locator('.source-note').first().innerText(), /Cached recording/);
  const start = page.getByRole('button', { name: 'Race the ghost', exact: true });
  assert.ok((await start.boundingBox()).y + (await start.boundingBox()).height <= 844, 'main action must fit the first phone screen, including offline state');
  await page.screenshot({ path: resolve(out, `${name}-offline-390.png`) });
  await start.focus(); assert.equal(await start.evaluate(el => parseFloat(getComputedStyle(el).outlineWidth) >= 2), true);
  await start.press('Enter'); await page.clock.runFor(3100);
  const tap = page.getByRole('button', { name: 'Tap to run', exact: false });
  await tap.waitFor({ state: 'visible' });
  for (let i = 0; i < 8; i++) { if (i < 4) await page.keyboard.press('Space'); else await tap.tap(); await page.clock.runFor(500); }
  assert.match(await page.locator('.rhythm-feedback').innerText(), /Perfect rhythm/);
  await page.screenshot({ path: resolve(out, `${name}-race-390.png`) });
  const scrollBeforeHold = await page.evaluate(() => scrollY);
  await page.keyboard.down('Space'); await page.clock.runFor(500);
  const perfectBeforeRepeat = await page.locator('.rhythm-stats strong').first().innerText();
  await page.keyboard.down('Space'); await page.clock.runFor(100); await page.keyboard.up('Space');
  assert.equal(await page.locator('.rhythm-stats strong').first().innerText(), perfectBeforeRepeat);
  assert.equal(await page.evaluate(() => scrollY), scrollBeforeHold, 'holding the run key must not scroll the game');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const before = await page.locator('.race-scoreboard').innerText(); await page.clock.runFor(5000);
  assert.equal(await page.locator('.race-scoreboard').innerText(), before);
  await page.getByRole('button', { name: 'Resume race' }).click();
  for (let i = 0; i < 53; i++) { await page.keyboard.press('Space'); await page.clock.runFor(500); }
  await page.getByRole('heading', { name: 'Paws ahead!' }).waitFor();
  let stored = await storageProfile(page); assert.equal(stored.races, 1); assert.ok(stored.points > 100); assert.ok(stored.bests['ghost:typical:30'] > 40);
  assert.ok(stored.badges.includes('first')); assert.ok(stored.badges.includes('rhythm'));
  if (name === 'chromium') {
    await page.getByRole('button', { name: 'Share result' }).click();
    await page.getByText('Copied. Ready to post on X.').waitFor();
    assert.ok((await page.evaluate(() => navigator.clipboard.readText())).includes(`${base}#/`));
    await page.evaluate(() => { Object.defineProperty(navigator.clipboard, 'writeText', { value: () => Promise.reject(new DOMException('Denied', 'NotAllowedError')) }); });
    await page.getByRole('button', { name: 'Share result' }).click();
    await page.getByText('Select and copy the result below to share.').waitFor();
    const fallback = page.getByLabel('Result for X', { exact: true });
    assert.ok((await fallback.inputValue()).includes(`${base}#/`));
    await fallback.focus(); assert.equal(await fallback.evaluate(el => el.selectionEnd - el.selectionStart === el.value.length), true);
  }
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: resolve(out, `${name}-result-390.png`), fullPage: true });
  await page.getByRole('link', { name: 'See local profile' }).click();
  await page.getByLabel('Nickname', { exact: true }).fill(''); await page.getByRole('button', { name: 'Save profile' }).click();
  await page.getByText('Choose a nickname with 1 to 24 characters.').waitFor();
  await page.getByLabel('Nickname', { exact: true }).fill('Tap captain');
  await page.getByLabel('Unlocked title').selectOption({ label: 'Tiny contender' });
  await page.getByRole('button', { name: 'Save profile' }).click(); await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.getByLabel('Nickname', { exact: true }).inputValue(), 'Tap captain');
  assert.equal(await page.getByLabel('Unlocked title').inputValue(), 'Tiny contender');
  stored = await storageProfile(page); assert.equal(stored.races, 1);
  assert.deepEqual(errors, []); await noOverflow(page);
  await context.close(); results.push({ check: `${name}: offline ghost, keyboard/touch cadence, pause/resume, finish, profile persistence${name === 'chromium' ? ', clipboard copy and denied fallback' : ''}`, passed: true });
}
try {
  const browser = await chromium.launch({ headless: true }); activeBrowsers.push(browser);
  const realContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await realContext.newPage(), realErrors = track(page);
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.locator('.wheel-state').waitFor(); await page.screenshot({ path: resolve(out, 'home-390.png') });
  const button = await page.locator('.game-console > .primary-button').boundingBox(); assert.ok(button && button.y + button.height <= 844);
  const liveRequests = await page.evaluate(() => performance.getEntriesByType('resource').filter(e => e.name.includes('api.squeekchain.com')).map(e => e.name));
  assert.ok(liveRequests.some(u => u.endsWith('/v1/status'))); assert.ok(liveRequests.some(u => u.includes('range=7d'))); assert.ok(liveRequests.some(u => u.includes('range=30d')));
  await page.getByRole('button', { name: 'Turn sound on', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Mute sound', exact: true }).getAttribute('aria-pressed'), 'true');
  await page.getByRole('button', { name: 'Mute sound', exact: true }).click();
  await page.getByRole('button', { name: 'Predict', exact: true }).click();
  await page.getByRole('link', { name: 'Make a prediction', exact: false }).click();
  await page.getByRole('heading', { name: 'Call the next round.' }).waitFor();
  await page.getByRole('link', { name: 'Race Squeektoshi home' }).click();
  await page.getByRole('button', { name: 'Ghost', exact: true }).click();
  await page.getByLabel('Choose your ghost', { exact: true }).selectOption('peak');
  assert.equal(await page.getByLabel('Choose your ghost', { exact: true }).inputValue(), 'peak');
  await page.getByRole('button', { name: /^60 sec/ }).click();
  assert.equal(await page.getByRole('button', { name: /^60 sec/ }).getAttribute('aria-pressed'), 'true');
  await page.getByRole('button', { name: /^10 min/ }).click();
  await page.goto(`${base}#/ghost`, { waitUntil: 'networkidle' });
  assert.match(await page.locator('.race-scoreboard').innerText(), /10:00/);
  await page.getByRole('button', { name: /^30 sec/ }).click();
  await page.getByLabel('Choose your ghost', { exact: true }).selectOption('typical');
  results.push({ check: 'sound opt-in/mute, Home predictor action, ghost selection, 60/600-second settings and full-round setup', passed: true });
  const axe = [];
  for (const width of [320, 390, 800, 1440]) {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
    for (const path of ['/', '/race', '/ghost', '/predict', '/profile', '/how-to-play']) {
      await page.goto(`${base}#${path}`, { waitUntil: 'networkidle' }); await noOverflow(page);
      if (width === 390 || width === 1440) {
        const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
        axe.push({ width, path, violations: audit.violations.map(v => ({ id: v.id, impact: v.impact, targets: v.nodes.map(n => n.target) })) });
      }
      if ((width === 390 || width === 1440) && ['/', '/predict', '/profile'].includes(path)) await page.screenshot({ path: resolve(out, `${path === '/' ? 'home' : path.slice(1)}-${width}.png`), fullPage: path !== '/' });
    }
  }
  await writeFile(resolve(out, 'axe.json'), JSON.stringify(axe, null, 2));
  assert.deepEqual(axe.filter(a => a.violations.length), [], 'WCAG automated audits must have no violations');
  assert.deepEqual(realErrors, []); await realContext.close();
  results.push({ check: 'real API, all six hash routes at 320/390/800/1440, nested subpath, local assets/console, 12 axe scans', passed: true });
  console.log('Passed real API, route/reflow and automated accessibility checks.');
  await recordedRace(browser, 'chromium');
  console.log('Passed recorded ghost and profile flow.');

  const live = await browser.newPage({ viewport: { width: 1440, height: 900 } }), liveState = freshState(), liveErrors = track(live, true);
  await live.clock.install({ time: new Date(statusFixture.generatedAt) }); await mockApi(live, liveState);
  await live.goto(base, { waitUntil: 'networkidle' }); await live.getByText('Squeektoshi is resting', { exact: true }).waitFor();
  liveState.running = true; await live.clock.runFor(15100); await live.getByText('Squeektoshi is running', { exact: true }).waitFor();
  const pollsBeforeRace = liveState.polls.length;
  await live.getByRole('button', { name: 'Start live race', exact: true }).click(); await live.clock.runFor(3100);
  await live.getByRole('button', { name: 'Tap to run', exact: false }).waitFor();
  for (let i = 0; i < 12; i++) { await live.keyboard.press('ArrowRight'); await live.clock.runFor(500); }
  assert.ok(liveState.polls.length >= pollsBeforeRace + 2, 'status must fetch immediately and poll within the active race interval');
  liveState.failStatus = true; await live.clock.runFor(5500); await live.getByRole('heading', { name: 'Live race interrupted.' }).waitFor();
  await live.screenshot({ path: resolve(out, 'live-interrupted-1440.png') });
  liveState.failStatus = false;
  await live.getByRole('button', { name: 'Retry feed', exact: true }).click();
  await live.getByRole('button', { name: 'Restart live race', exact: true }).click();
  await live.clock.runFor(3100);
  for (let i = 0; i < 61; i++) { await live.keyboard.press('ArrowRight'); await live.clock.runFor(500); }
  await live.getByRole('heading', { name: 'Paws ahead!' }).waitFor();
  assert.equal((await storageProfile(live)).liveFinishes, 1);
  assert.ok((await storageProfile(live)).badges.includes('live'));
  assert.deepEqual(liveErrors, []); await live.close();
  results.push({ check: 'resting→running switches Home to Live; arrow-key race; live poll, signal-loss interruption, recovery and complete live finish', passed: true });

  const predictionPage = await browser.newPage({ viewport: { width: 390, height: 844 } }), predictionState = freshState(), predictionErrors = track(predictionPage);
  await predictionPage.clock.install({ time: new Date(statusFixture.generatedAt) }); await mockApi(predictionPage, predictionState);
  await predictionPage.goto(`${base}#/predict`, { waitUntil: 'networkidle' });
  const save = predictionPage.getByRole('button', { name: 'Save prediction', exact: true }); await save.waitFor();
  await predictionPage.getByLabel('Your prediction in wheel turns', { exact: true }).fill('-1'); await save.click();
  await predictionPage.getByText('Enter a whole number from 0 to 1,000,000 wheel turns.').waitFor();
  await predictionPage.getByLabel('Adjust predicted wheel turns').focus();
  await predictionPage.getByLabel('Adjust predicted wheel turns').press('Home');
  await predictionPage.getByLabel('Adjust predicted wheel turns').press('ArrowRight');
  assert.equal(await predictionPage.getByLabel('Your prediction in wheel turns', { exact: true }).inputValue(), '1');
  await predictionPage.getByLabel('Your prediction in wheel turns', { exact: true }).fill('500'); await save.click();
  await predictionPage.getByText('Saved · editable before the round starts', { exact: true }).waitFor();
  await predictionPage.getByLabel('Your prediction in wheel turns', { exact: true }).fill('501'); await predictionPage.getByRole('button', { name: 'Update prediction' }).click();
  const pending = (await storageProfile(predictionPage)).predictions[0]; assert.equal(pending.turns, 501);
  const untilStart = pending.startsAt - await predictionPage.evaluate(() => Date.now()); await predictionPage.clock.runFor(untilStart + 1100);
  await predictionPage.getByText('Locked · round in progress', { exact: true }).waitFor();
  assert.equal((await storageProfile(predictionPage)).predictions[0].turns, 501);
  await predictionPage.clock.runFor(600000); predictionState.proof = { round: pending.round, work: 500 };
  await predictionPage.reload({ waitUntil: 'networkidle' });
  await predictionPage.getByRole('cell', { name: '500', exact: true }).waitFor();
  assert.equal((await storageProfile(predictionPage)).predictions.find(p => p.id === pending.id).state, 'resolved');
  const points = (await storageProfile(predictionPage)).points;
  await predictionPage.getByRole('button', { name: 'Check results', exact: true }).click();
  await predictionPage.getByRole('button', { name: 'Check results', exact: true }).waitFor();
  await predictionPage.reload({ waitUntil: 'networkidle' }); assert.equal((await storageProfile(predictionPage)).points, points);
  assert.equal((await storageProfile(predictionPage)).predictionStreak, 1);
  assert.deepEqual(predictionErrors, []); await predictionPage.close();
  results.push({ check: 'predictor slider/number validation, edit, exact boundary lock, safe synthetic settlement resolution and next-visit idempotency', passed: true });

  const blocked = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const blockedErrors = track(blocked, true), blockedState = freshState({ offline: true });
  await blocked.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } }); });
  await mockApi(blocked, blockedState); await blocked.goto(base, { waitUntil: 'networkidle' });
  await blocked.getByText('Storage is blocked. Progress stays for this session only.').waitFor();
  assert.equal(await blocked.evaluate(() => document.getAnimations().filter(a => a.playState === 'running' && a.effect?.getTiming().iterations === Infinity).length), 0);
  const first = await blocked.locator('canvas').screenshot(); await blocked.waitForTimeout(150); const second = await blocked.locator('canvas').screenshot(); assert.equal(first.equals(second), true, 'reduced-motion canvas stays still');
  await blocked.getByRole('button', { name: 'Race the ghost', exact: true }).click();
  await blocked.getByRole('button', { name: 'Tap to run', exact: false }).waitFor();
  assert.deepEqual(blockedErrors, []); await blocked.close(); results.push({ check: 'blocked localStorage, offline play and static reduced-motion art', passed: true });
  let safari;
  try { safari = await webkit.launch({ headless: true }); }
  catch (e) { limitations.push(`WebKit unavailable on this host: ${e.message.split('\n').filter(Boolean).slice(0, 5).join(' ')}`); }
  if (safari) { activeBrowsers.push(safari); await recordedRace(safari, 'webkit'); }
} catch (e) {
  results.push({ check: 'browser validation', passed: false, error: e.stack }); process.exitCode = 1;
} finally {
  for (const browser of activeBrowsers) await browser.close();
  await new Promise(done => server.close(done));
  await writeFile(resolve(out, 'results.json'), JSON.stringify({ results, limitations }, null, 2));
  console.log(JSON.stringify({ results, limitations }, null, 2));
}
