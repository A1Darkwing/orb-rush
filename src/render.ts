import { Art, drawCover } from "./art";
import { PALETTE } from "./board";

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

export function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  art: Art | null,
): void {
  if (art) {
    drawCover(ctx, art.bg, 0, 0, w, h);
    ctx.fillStyle = "rgba(20, 8, 40, 0.18)";
    ctx.fillRect(0, 0, w, h);
  } else {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#3b1d6e");
    g.addColorStop(0.5, "#1a6b8a");
    g.addColorStop(1, "#e07a3a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  ctx.save();
  ctx.globalAlpha = 0.45;
  for (let i = 0; i < 36; i++) {
    const x = ((i * 97 + t * 18) % (w + 40)) - 20;
    const y = ((i * 53 + Math.sin(t * 0.4 + i) * 22) % (h + 40)) - 20;
    ctx.fillStyle = i % 3 === 0 ? "#fff7ad" : i % 3 === 1 ? "#ff9ecf" : "#7ef0ff";
    ctx.beginPath();
    ctx.arc(x, y, i % 5 === 0 ? 2.4 : 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawOrb(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: number,
  opts: {
    pulse?: number;
    selected?: boolean;
    ghost?: boolean;
    art?: Art | null;
    hot?: boolean;
    hop?: number;
  } = {},
): void {
  const pal = PALETTE[color] ?? PALETTE[0];
  const pulse = opts.pulse ?? 0;
  const hop = Math.max(0, opts.hop ?? 0);
  const r = radius * (1 + pulse * 0.08);
  const sprite = opts.art?.orbs[color];
  const hopY = hop * r * 0.85;
  const drawX = x;
  const drawY = y - hopY;

  ctx.save();
  ctx.globalAlpha = opts.ghost ? 0.35 : 0.28;
  ctx.fillStyle = "#2a1450";
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.62, r * (0.55 + hop * 0.25), r * (0.18 - hop * 0.06), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  if (opts.ghost) ctx.globalAlpha = 0.78;
  if (opts.hot) {
    ctx.shadowColor = "#ffe566";
    ctx.shadowBlur = r * 2.2;
  } else {
    ctx.shadowColor = pal.glow;
    ctx.shadowBlur = r * (opts.selected ? 1.6 : 0.8);
  }
  ctx.translate(drawX, drawY);
  ctx.scale(1 + hop * 0.08, 1 - hop * 0.12);
  if (sprite) {
    const size = r * 2.15;
    ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    const body = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
    body.addColorStop(0, "#ffffff");
    body.addColorStop(0.22, pal.glow);
    body.addColorStop(0.72, pal.fill);
    body.addColorStop(1, "#0b1020");
    ctx.fillStyle = body;
    ctx.fill();
  }
  ctx.restore();
}

export function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
  align: CanvasTextAlign = "left",
  weight = "800",
): void {
  ctx.save();
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px "Trebuchet MS", Arial, sans-serif`;
  ctx.letterSpacing = "0.04em";
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
  ctx.restore();
}

export function drawButton(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  kind: "primary" | "ghost" | "danger" = "ghost",
  _art: Art | null = null,
): void {
  ctx.save();
  if (kind === "primary") {
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, "#7ef9ff");
    g.addColorStop(0.55, "#5ad7ff");
    g.addColorStop(1, "#ff8ad1");
    ctx.fillStyle = g;
    ctx.shadowColor = "#fff7ad";
    ctx.shadowBlur = 12;
  } else if (kind === "danger") {
    ctx.fillStyle = "rgba(255, 90, 130, 0.88)";
    ctx.strokeStyle = "#fffdf8";
  } else {
    ctx.fillStyle = "rgba(255,252,245,0.88)";
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
  }
  roundRect(ctx, x, y, w, h, 24);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 3;
  ctx.strokeStyle = kind === "primary" ? "#fffdf8" : "rgba(255,255,255,0.85)";
  ctx.stroke();
  drawLabel(
    ctx,
    label,
    x + w / 2,
    y + h / 2,
    Math.min(18, h * 0.38),
    kind === "ghost" ? "#5a1d7a" : kind === "danger" ? "#fffdf8" : "#3b1466",
    "center",
  );
  ctx.restore();
}

export function drawChip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  value: string,
  accent: string,
): void {
  ctx.save();
  ctx.fillStyle = "rgba(255, 252, 245, 0.82)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
  roundRect(ctx, x, y, w, h, 18);
  ctx.fill();
  ctx.stroke();
  drawLabel(ctx, title, x + 12, y + h * 0.32, 11, "rgba(80, 30, 90, 0.7)");
  drawLabel(ctx, value, x + 12, y + h * 0.68, 22, accent);
  ctx.restore();
}

export function hit(
  px: number,
  py: number,
  x: number,
  y: number,
  w: number,
  h: number,
): boolean {
  return px >= x && py >= y && px <= x + w && py <= y + h;
}
