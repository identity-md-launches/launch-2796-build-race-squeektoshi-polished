import { createContext, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';
type Sound = 'tap' | 'perfect' | 'fast' | 'start' | 'finish';
interface SoundValue { muted: boolean; toggle: () => void; play: (sound: Sound) => void }
const SoundContext = createContext<SoundValue>({ muted: true, toggle: () => {}, play: () => {} });
export function SoundProvider({ children }: { children: ReactNode }) {
  const [muted, setMuted] = useState(true);
  const context = useRef<AudioContext | null>(null);
  const enabled = useRef(false);
  const play = (sound: Sound) => {
    if (!enabled.current) return;
    try {
      const ctx = context.current ?? new AudioContext(); context.current = ctx;
      if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
      const frequencies: Record<Sound, number[]> = { tap: [260], perfect: [540, 810], fast: [130], start: [330, 440, 660], finish: [440, 550, 660, 880] };
      frequencies[sound].forEach((frequency, i) => {
        const osc = ctx.createOscillator(), gain = ctx.createGain(), at = ctx.currentTime + i * 0.09;
        osc.type = 'square'; osc.frequency.value = frequency; gain.gain.setValueAtTime(0.025, at); gain.gain.exponentialRampToValueAtTime(0.001, at + 0.075); osc.connect(gain); gain.connect(ctx.destination); osc.start(at); osc.stop(at + 0.08);
      });
    } catch { /* Audio is optional; denied audio never blocks a race. */ }
  };
  const toggle = () => { enabled.current = !enabled.current; setMuted(!enabled.current); if (enabled.current) play('tap'); };
  return <SoundContext.Provider value={{ muted, toggle, play }}>{children}</SoundContext.Provider>;
}
export const useSound = () => useContext(SoundContext);
