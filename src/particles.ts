import { Art } from "./art";

export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  spin: number;
  kind: "dot" | "star" | "shard";
};

export type Floater = {
  x: number;
  y: number;
  text: string;
  life: number;
  max: number;
  color: string;
  size: number;
};

export type Boom = {
  x: number;
  y: number;
  t: number;
  size: number;
};

export class Fx {
  particles: Particle[] = [];
  floaters: Floater[] = [];
  booms: Boom[] = [];
  rings: { x: number; y: number; t: number; color: string }[] = [];
  shake = 0;
  flash = 0;

  burst(x: number, y: number, color: string, count = 16): void {
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const sp = 80 + Math.random() * 260;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 1,
        max: 0.45 + Math.random() * 0.4,
        size: 3 + Math.random() * 6,
        color,
        spin: (Math.random() - 0.5) * 12,
        kind: i % 3 === 0 ? "star" : i % 3 === 1 ? "shard" : "dot",
      });
    }
  }

  explode(x: number, y: number, color: string, mega = false): void {
    this.booms.push({ x, y, t: 0, size: mega ? 160 : 92 });
    this.rings.push({ x, y, t: 0, color });
    this.burst(x, y, color, mega ? 36 : 22);
    this.burst(x, y, "#fff7ad", mega ? 18 : 10);
    this.punch(mega ? 16 : 9, mega ? 0.42 : 0.22);
  }

  spark(x: number, y: number, color: string): void {
    this.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 40,
      vy: -30 - Math.random() * 50,
      life: 1,
      max: 0.35,
      size: 3,
      color,
      spin: 4,
      kind: "star",
    });
  }

  trail(x: number, y: number, color: string): void {
    this.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 20,
      vy: (Math.random() - 0.5) * 20,
      life: 1,
      max: 0.25,
      size: 4,
      color,
      spin: 0,
      kind: "dot",
    });
  }

  float(x: number, y: number, text: string, color: string, size = 22): void {
    this.floaters.push({ x, y, text, life: 1, max: 0.95, color, size });
  }

  punch(amount = 8, flash = 0.18): void {
    this.shake = Math.max(this.shake, amount);
    this.flash = Math.max(this.flash, flash);
  }

  update(dt: number): void {
    this.shake = Math.max(0, this.shake - dt * 28);
    this.flash = Math.max(0, this.flash - dt * 1.2);
    this.particles = this.particles.filter((p) => {
      p.life -= dt / p.max;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 90 * dt;
      return p.life > 0;
    });
    this.floaters = this.floaters.filter((f) => {
      f.life -= dt / f.max;
      f.y -= 48 * dt;
      return f.life > 0;
    });
    this.booms = this.booms.filter((b) => {
      b.t += dt * 1.7;
      return b.t < 1;
    });
    this.rings = this.rings.filter((r) => {
      r.t += dt * 2.2;
      return r.t < 1;
    });
  }

  draw(ctx: CanvasRenderingContext2D, art: Art | null): void {
    for (const r of this.rings) {
      ctx.save();
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = (1 - r.t) * 0.7;
      ctx.lineWidth = 8 * (1 - r.t);
      ctx.beginPath();
      ctx.arc(r.x, r.y, 18 + r.t * 90, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life) * 0.95;
      ctx.fillStyle = p.color;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.spin * (1 - p.life));
      const s = p.size * (0.45 + p.life);
      if (p.kind === "star") {
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
          const r = i % 2 === 0 ? s : s * 0.4;
          const x = Math.cos(a) * r;
          const y = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
      } else if (p.kind === "shard") {
        ctx.fillRect(-s * 0.35, -s, s * 0.7, s * 2);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, s, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();

    if (art) {
      for (const b of this.booms) {
        const scale = 0.35 + b.t * 1.15;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - b.t);
        ctx.translate(b.x, b.y);
        ctx.rotate(b.t * 0.6);
        ctx.drawImage(art.boom, -b.size * scale * 0.5, -b.size * scale * 0.5, b.size * scale, b.size * scale);
        ctx.restore();
      }
    }

    for (const f of this.floaters) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.fillStyle = f.color;
      ctx.font = `800 ${f.size}px "Trebuchet MS", Arial, sans-serif`;
      ctx.textAlign = "center";
      ctx.letterSpacing = "0.04em";
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }
  }
}
