export class Sfx {
  private ctx: AudioContext | null = null;
  enabled = true;

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) this.ctx?.suspend();
    else void this.ctx?.resume();
  }

  unlock(): void {
    if (!this.enabled) return;
    this.ensure();
    void this.ctx?.resume();
  }

  private ensure(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
    }
    return this.ctx;
  }

  private beep(freq: number, dur: number, type: OscillatorType, gain: number, when = 0): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  select(): void {
    this.beep(520, 0.07, "triangle", 0.08);
  }

  deny(): void {
    this.beep(180, 0.12, "square", 0.05);
  }

  move(): void {
    this.beep(360, 0.08, "sine", 0.05);
    this.beep(540, 0.1, "sine", 0.04, 0.04);
  }

  pop(index: number): void {
    this.beep(420 + index * 70, 0.14, "triangle", 0.09, index * 0.03);
  }

  combo(level: number): void {
    const base = 480 + Math.min(level, 8) * 40;
    this.beep(base, 0.16, "sawtooth", 0.05);
    this.beep(base * 1.25, 0.18, "triangle", 0.05, 0.05);
  }

  gameOver(): void {
    this.beep(320, 0.18, "sine", 0.07);
    this.beep(240, 0.22, "sine", 0.06, 0.12);
    this.beep(160, 0.3, "triangle", 0.05, 0.24);
  }

  winFanfare(): void {
    this.beep(523, 0.12, "triangle", 0.07);
    this.beep(659, 0.12, "triangle", 0.07, 0.1);
    this.beep(784, 0.2, "triangle", 0.08, 0.2);
  }
}
