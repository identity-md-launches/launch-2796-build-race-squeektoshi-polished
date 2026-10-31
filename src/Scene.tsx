import { useEffect, useRef, useState } from 'react';
import { paintScene } from './art';
import type { SceneState } from './art';
import type { RaceEngine } from './engine';

export function Scene({ variant = 'home', running = false, rpm = 0, ghost = false, engine, active = false }: { variant?: 'home' | 'race'; running?: boolean; rpm?: number; ghost?: boolean; engine?: RaceEngine; active?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const props = useRef({ variant, running, rpm, ghost, engine, active });
  props.current = { variant, running, rpm, ghost, engine, active };
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(media.matches);
    const change = () => setReducedMotion(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext('2d', { alpha: false });
    if (!c || !ctx) return;
    let w = 0, h = 0, frame = 0, angle = 0, smoothRpm = props.current.rpm, previous = performance.now(), lastDraw = 0;
    const resize = () => { const r = c.getBoundingClientRect(); w = r.width; h = r.height; const dpr = Math.min(devicePixelRatio || 1, 2); c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    const observer = new ResizeObserver(resize); observer.observe(c); resize();
    const render = (now: number) => {
      const dt = Math.min((now - previous) / 1000, 0.05); previous = now;
      const p = props.current;
      smoothRpm += (p.rpm - smoothRpm) * (1 - Math.exp(-dt / 1.2));
      if (!reducedMotion) angle += smoothRpm / 60 * Math.PI * 2 * dt;
      if (!reducedMotion || now - lastDraw > 200 || lastDraw === 0) {
        const e = p.engine;
        const state: SceneState = { variant: p.variant, pose: p.running ? 'run' : 'sleep', rpm: p.rpm, playerSpeed: e?.playerSpeed ?? 0, opponentSpeed: e?.opponentSpeed ?? 0, playerDistance: e?.playerDistance ?? 0, opponentDistance: e?.opponentDistance ?? 0, active: p.active, ghost: p.ghost, reducedMotion, elapsed: e?.elapsed ?? 0 };
        paintScene(ctx, w, h, state, now / 1000, angle); lastDraw = now;
      }
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [reducedMotion]);
  return <canvas ref={canvas} className="scene-canvas" aria-hidden="true" />;
}
