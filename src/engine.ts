import type { Duration, GhostKind, RaceMode } from './domain';

export interface RaceResult {
  id: string;
  mode: RaceMode;
  ghost: GhostKind;
  duration: Duration;
  playerDistance: number;
  opponentDistance: number;
  perfectTaps: number;
  maxCombo: number;
  taps: number;
  won: boolean;
  points: number;
  finishedAt: string;
  opponentLabel: string;
  cached: boolean;
}

/** Simulation time is explicit, so checks never need to wait out a ten-minute race. */
export class RaceEngine {
  elapsed = 0;
  playerDistance = 0;
  opponentDistance = 0;
  playerSpeed = 0;
  opponentSpeed: number;
  stamina = 100;
  taps = 0;
  perfectTaps = 0;
  combo = 0;
  maxCombo = 0;
  lastTap = -10;
  lastQuality = 0;
  feedback = 'Find a steady beat';
  finished = false;
  readonly duration: Duration;
  constructor(duration: Duration, initialOpponentSpeed: number) {
    this.duration = duration;
    this.opponentSpeed = initialOpponentSpeed;
  }
  tap(): 'perfect' | 'steady' | 'fast' | 'slow' {
    const interval = this.elapsed - this.lastTap;
    // Ignore duplicate device events in the same frame, including keyboard auto-repeat.
    if (interval < 0.075 || this.finished) return 'fast';
    const first = this.taps === 0;
    const quality = first ? 0.65 : Math.max(0.06, 1 - Math.abs(interval - 0.5) / 0.34);
    const fast = interval < 0.32;
    const perfect = !first && quality >= 0.82;
    this.lastQuality = quality;
    this.lastTap = this.elapsed;
    this.taps++;
    this.stamina = Math.max(0, this.stamina - (fast ? 12 : perfect ? 0.9 : 2.8));
    this.combo = perfect ? this.combo + 1 : 0;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    if (perfect) this.perfectTaps++;
    this.feedback = fast ? 'Too fast · save your stamina' : perfect ? `Perfect rhythm · ${this.combo} streak` : quality > 0.45 ? 'Steady · keep the beat' : 'A little slower. Breathe.';
    return fast ? 'fast' : perfect ? 'perfect' : quality > 0.45 ? 'steady' : 'slow';
  }
  step(seconds: number, targetOpponentSpeed: number): void {
    if (this.finished || !Number.isFinite(seconds) || seconds <= 0) return;
    // Substeps make simulation stable after dropped frames and deterministic in tests.
    let remaining = Math.min(seconds, this.duration - this.elapsed);
    while (remaining > 0.000001) {
      const dt = Math.min(remaining, 1 / 60);
      this.elapsed += dt;
      this.stamina = Math.min(100, this.stamina + dt * 4.6);
      const age = this.elapsed - this.lastTap;
      const cadence = age < 0.7 ? 1 : Math.exp(-(age - 0.7) * 4);
      const target = this.taps > 0 ? 1.95 * this.lastQuality * cadence * (0.3 + this.stamina / 100 * 0.7) : 0;
      this.playerSpeed += (target - this.playerSpeed) * (1 - Math.exp(-dt * 7));
      this.opponentSpeed += (Math.max(0, targetOpponentSpeed) - this.opponentSpeed) * (1 - Math.exp(-dt / 1.2));
      this.playerDistance += this.playerSpeed * dt;
      this.opponentDistance += this.opponentSpeed * dt;
      remaining -= dt;
    }
    if (this.elapsed >= this.duration - 0.00001) { this.elapsed = this.duration; this.finished = true; }
  }
  result(input: Pick<RaceResult, 'id' | 'mode' | 'ghost' | 'opponentLabel' | 'cached'>): RaceResult {
    const won = this.playerDistance > this.opponentDistance;
    return { ...input, duration: this.duration, playerDistance: this.playerDistance, opponentDistance: this.opponentDistance, perfectTaps: this.perfectTaps, maxCombo: this.maxCombo, taps: this.taps, won,
      points: 50 + Math.floor(this.playerDistance) + this.perfectTaps * 2 + (won ? 100 : 0) + (this.duration === 600 ? 150 : 0), finishedAt: new Date().toISOString() };
  }
}
