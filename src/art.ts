export type HamsterPose = 'run' | 'idle' | 'sleep';
const C = { ink: '#744a2a', fur: '#dc9848', gold: '#ffd17d', cream: '#ffedc1', ear: '#d98670', eye: '#22251b', mint: '#b4d7c5' };
export function drawHamster(ctx: CanvasRenderingContext2D, x: number, floor: number, scale: number, pose: HamsterPose, time: number, player = false, ghost = false): void {
  ctx.save();
  const stride = pose === 'run' ? Math.floor(time * 9) % 2 : 0;
  const bob = pose === 'run' ? stride : pose === 'sleep' ? Math.floor(time * 0.7) % 2 * 0.5 : Math.floor(time * 0.5) % 2 * 0.3;
  ctx.translate(Math.round(x - 17 * scale), Math.round(floor - (25 + bob) * scale));
  ctx.scale(scale, scale);
  if (ghost) ctx.globalAlpha *= 0.76;
  const r = (x: number, y: number, w: number, h: number, color: string) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
  // Original stepped silhouette, ears, belly and paws. All geometry uses a one-pixel grid.
  r(2, 15, 4, 5, C.ear); r(1, 15, 2, 3, C.ink);
  r(8, 7, 15, 2, C.ink); r(5, 9, 23, 3, C.ink); r(3, 12, 28, 8, C.ink); r(5, 20, 24, 3, C.ink);
  r(18, 2, 6, 7, C.ink); r(26, 4, 5, 7, C.ink); r(17, 6, 14, 14, C.ink); r(29, 12, 5, 7, C.ink);
  r(19, 3, 4, 5, C.fur); r(20, 4, 2, 3, C.ear); r(27, 5, 3, 5, C.fur); r(28, 6, 2, 3, C.ear);
  r(9, 9, 12, 2, C.fur); r(6, 11, 21, 3, C.fur); r(5, 14, 24, 6, C.fur); r(7, 20, 20, 2, C.fur);
  r(11, 10, 11, 3, C.gold); r(7, 13, 21, 6, C.gold); r(10, 19, 14, 2, C.gold);
  r(19, 7, 10, 8, C.gold); r(18, 9, 12, 9, C.gold); r(28, 13, 4, 5, C.gold);
  r(13, 16, 11, 5, C.cream); r(18, 14, 8, 7, C.cream); r(25, 14, 6, 4, C.cream);
  r(23, 14, 3, 2, C.ear); r(32, 13, 2, 2, C.eye);
  if (pose === 'sleep') { r(26, 11, 3, 1, C.eye); r(29, 10, 1, 1, C.eye); }
  else { r(27, 10, 2, 3, C.eye); r(27, 10, 1, 1, C.cream); }
  if (player) { r(18, 17, 11, 2, C.mint); r(16, 17, 3, 5, '#7ca78d'); r(14, 20, 4, 2, C.mint); }
  if (pose === 'run') {
    r(stride ? 5 : 10, 22, 6, 2, C.ink); r(stride ? 24 : 20, 22, 7, 2, C.ink);
    r(stride ? 5 : 10, 22, 5, 1, C.cream); r(stride ? 25 : 20, 22, 6, 1, C.cream);
  } else { r(8, 22, 6, 2, C.ink); r(23, 22, 6, 2, C.ink); r(8, 22, 5, 1, C.cream); r(24, 22, 5, 1, C.cream); }
  ctx.restore();
}
function pixelLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, pixel = 3): void {
  const steps = Math.ceil(Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) / pixel);
  for (let i = 0; i <= steps; i++) { const t = steps ? i / steps : 0; ctx.fillRect(Math.round((x1 + (x2 - x1) * t) / pixel) * pixel, Math.round((y1 + (y2 - y1) * t) / pixel) * pixel, pixel, pixel); }
}
export function drawWheel(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, angle: number, alpha = 1): void {
  ctx.save(); ctx.globalAlpha *= alpha;
  ctx.fillStyle = '#795e2c';
  const p = radius > 100 ? 3 : 2;
  pixelLine(ctx, x, y, x - radius * 0.48, y + radius + 11, p);
  pixelLine(ctx, x, y, x + radius * 0.48, y + radius + 11, p);
  ctx.fillRect(x - radius * 0.65, y + radius + 10, radius * 1.3, p * 2);
  for (let a = 0; a < Math.PI * 2; a += 0.018) {
    ctx.fillStyle = '#a77e36'; ctx.fillRect(Math.round((x + Math.cos(a) * radius) / p) * p, Math.round((y + Math.sin(a) * radius) / p) * p, p, p);
    ctx.fillStyle = '#604d28'; ctx.fillRect(Math.round((x + Math.cos(a) * (radius - 9)) / p) * p, Math.round((y + Math.sin(a) * (radius - 9)) / p) * p, p, p);
  }
  ctx.fillStyle = '#6c562b';
  for (let i = 0; i < 8; i++) { const a = angle + i * Math.PI / 4; pixelLine(ctx, x, y, x + Math.cos(a) * (radius - 10), y + Math.sin(a) * (radius - 10), p); }
  for (let i = 0; i < 24; i++) {
    const a = angle + i * Math.PI / 12;
    ctx.fillStyle = i % 3 === 0 ? '#ffd16b' : '#bf923e';
    ctx.fillRect(Math.round((x + Math.cos(a) * (radius - 4)) / p) * p, Math.round((y + Math.sin(a) * (radius - 4)) / p) * p, p * 1.5, p * 1.5);
  }
  ctx.fillStyle = '#e8b352'; ctx.fillRect(x - 5, y - 5, 10, 10); ctx.fillStyle = '#473f26'; ctx.fillRect(x - 2, y - 2, 4, 4);
  ctx.restore();
}
function star(ctx: CanvasRenderingContext2D, x: number, y: number, big = false): void {
  ctx.fillRect(x, y, 2, 2);
  if (big) { ctx.fillRect(x - 3, y, 8, 2); ctx.fillRect(x, y - 3, 2, 8); }
}
function background(ctx: CanvasRenderingContext2D, w: number, h: number, motion: number): void {
  ctx.fillStyle = '#131710'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#20271a';
  for (let x = 8; x < w; x += 8) for (let y = 8; y < h; y += 8) ctx.fillRect(x, y, 1, 1);
  ctx.fillStyle = '#68623b';
  const stars = [[0.08, 0.21], [0.18, 0.37], [0.31, 0.16], [0.61, 0.21], [0.7, 0.42], [0.83, 0.16], [0.92, 0.34], [0.43, 0.32]];
  stars.forEach(([x, y], i) => star(ctx, Math.floor(w * x), Math.floor(h * y), i % 3 === 0));
  const mx = Math.floor(w * 0.84), my = Math.floor(h * 0.2);
  ctx.fillStyle = '#bca86b'; ctx.fillRect(mx, my, 14, 20); ctx.fillRect(mx - 4, my + 4, 22, 12);
  ctx.fillStyle = '#131710'; ctx.fillRect(mx + 6, my - 1, 12, 12); ctx.fillRect(mx + 10, my + 8, 10, 6);
  const floor = Math.floor(h * 0.86);
  ctx.fillStyle = '#202919';
  ctx.beginPath(); ctx.moveTo(0, floor); ctx.lineTo(0, floor - 18); ctx.lineTo(w * 0.11, floor - 18); ctx.lineTo(w * 0.11, floor - 31); ctx.lineTo(w * 0.2, floor - 31); ctx.lineTo(w * 0.2, floor - 43); ctx.lineTo(w * 0.34, floor - 43); ctx.lineTo(w * 0.34, floor - 25); ctx.lineTo(w * 0.47, floor - 25); ctx.lineTo(w * 0.47, floor - 35); ctx.lineTo(w * 0.65, floor - 35); ctx.lineTo(w * 0.65, floor - 15); ctx.lineTo(w, floor - 15); ctx.lineTo(w, floor); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#39412a'; ctx.fillRect(0, floor, w, 2);
  ctx.fillStyle = '#1a2015'; ctx.fillRect(0, floor + 2, w, h - floor);
  ctx.fillStyle = '#515335';
  for (let x = -24; x < w + 24; x += 36) ctx.fillRect(x - motion % 36, floor + 16, 10, 2);
  // A tiny trackside sprout is part of the artwork, not a control.
  ctx.fillStyle = '#858052'; const sx = w * 0.12; ctx.fillRect(sx, floor - 18, 3, 18); ctx.fillRect(sx - 8, floor - 15, 8, 3); ctx.fillRect(sx - 10, floor - 20, 3, 6); ctx.fillRect(sx + 3, floor - 10, 7, 3); ctx.fillRect(sx + 8, floor - 15, 3, 6);
}
export interface SceneState { variant: 'home' | 'race'; pose: HamsterPose; rpm: number; playerSpeed: number; opponentSpeed: number; playerDistance: number; opponentDistance: number; active: boolean; ghost: boolean; reducedMotion: boolean; elapsed: number }
export function paintScene(ctx: CanvasRenderingContext2D, w: number, h: number, state: SceneState, time: number, wheelAngle: number): void {
  ctx.imageSmoothingEnabled = false;
  const t = state.reducedMotion ? 0 : time;
  background(ctx, w, h, state.active && !state.reducedMotion ? state.playerDistance * 14 : 0);
  if (state.variant === 'home') {
    const radius = Math.min(h * 0.335, w * 0.29);
    const x = Math.floor(w * 0.51), floor = Math.floor(h * 0.86) - 12;
    drawWheel(ctx, x, floor - radius, radius, state.reducedMotion ? 0 : wheelAngle);
    const scale = Math.max(1.6, radius / 36);
    drawHamster(ctx, x + radius * 0.12, floor - 2, scale, state.pose, t, false, false);
    if (state.pose === 'sleep') {
      const zz = state.reducedMotion ? 0 : Math.floor(t * 0.6) % 3;
      ctx.fillStyle = '#bbae7e';
      for (let i = 0; i < 2; i++) {
        const zx = x + radius * (0.62 + i * 0.18), zy = floor - radius * (0.65 + i * 0.3) - zz * 2;
        ctx.fillRect(zx, zy, 8, 2); pixelLine(ctx, zx + 6, zy + 2, zx, zy + 8, 2); ctx.fillRect(zx, zy + 8, 8, 2);
      }
    }
    // Start line and corner markers anchor the scene in an arcade racetrack.
    ctx.fillStyle = '#a77e36'; ctx.fillRect(w * 0.77, floor + 9, 4, 11); ctx.fillRect(w * 0.77 - 3, floor + 14, 10, 3);
  } else {
    const floor1 = Math.floor(h * 0.51), floor2 = Math.floor(h * 0.84);
    const radius = Math.min(h * 0.25, w * 0.16);
    drawWheel(ctx, w * 0.77, h * 0.41, radius, state.reducedMotion ? 0 : wheelAngle, 0.3);
    ctx.fillStyle = '#39412a'; ctx.fillRect(0, floor1 + 5, w, 2); ctx.fillRect(0, floor2 + 5, w, 2);
    ctx.fillStyle = '#605a35';
    const scroll = state.reducedMotion ? 0 : state.playerDistance * 18;
    for (let x = -32; x < w + 32; x += 44) { ctx.fillRect(x - scroll % 44, floor1 + 14, 14, 2); ctx.fillRect(x - scroll % 44, floor2 + 14, 14, 2); }
    const max = Math.max(state.playerDistance, state.opponentDistance, 1);
    const gap = Math.min(w * 0.45, Math.abs(state.playerDistance - state.opponentDistance) * 5);
    const leaderX = Math.min(w * 0.7, w * 0.32 + max * 0.05);
    const px = state.playerDistance >= state.opponentDistance ? leaderX : leaderX - gap;
    const ox = state.opponentDistance >= state.playerDistance ? leaderX : leaderX - gap;
    const scale = Math.max(1.7, Math.min(3.1, h / 94));
    drawHamster(ctx, Math.max(34, px), floor1, scale, state.active && state.playerSpeed > 0.12 ? 'run' : 'idle', t * Math.max(0.6, state.playerSpeed), true);
    drawHamster(ctx, Math.max(34, ox), floor2, scale, state.opponentSpeed > 0.04 ? 'run' : 'sleep', t * Math.max(0.6, state.opponentSpeed), false, state.ghost);
    if (state.ghost) { ctx.fillStyle = '#c8bb88'; star(ctx, ox + 34 * scale / 2 + 9, floor2 - 20 * scale, true); }
  }
}
