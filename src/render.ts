import { Art, LevelId, drawCover } from "./art";
import { PALETTE } from "./board";

export type BtnKind = "primary" | "ghost" | "danger";

function srcSize(img: CanvasImageSource): { w: number; h: number } {
  if ("naturalWidth" in img && (img as HTMLImageElement).naturalWidth) {
    return { w: (img as HTMLImageElement).naturalWidth, h: (img as HTMLImageElement).naturalHeight };
  }
  const c = img as HTMLCanvasElement;
  return { w: c.width, h: c.height };
}

export function drawNine(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const { w: iw, h: ih } = srcSize(img);
  if (!iw || !ih) return;
  const cap = Math.floor(Math.min(iw, ih) * 0.36);
  if (w < cap * 2 || h < cap * 2) {
    ctx.drawImage(img, x, y, w, h);
    return;
  }
  const mw = iw - cap * 2;
  const mh = ih - cap * 2;
  const dw = w - cap * 2;
  const dh = h - cap * 2;
  ctx.drawImage(img, 0, 0, cap, cap, x, y, cap, cap);
  ctx.drawImage(img, iw - cap, 0, cap, cap, x + w - cap, y, cap, cap);
  ctx.drawImage(img, 0, ih - cap, cap, cap, x, y + h - cap, cap, cap);
  ctx.drawImage(img, iw - cap, ih - cap, cap, cap, x + w - cap, y + h - cap, cap, cap);
  ctx.drawImage(img, cap, 0, mw, cap, x + cap, y, dw, cap);
  ctx.drawImage(img, cap, ih - cap, mw, cap, x + cap, y + h - cap, dw, cap);
  ctx.drawImage(img, 0, cap, cap, mh, x, y + cap, cap, dh);
  ctx.drawImage(img, iw - cap, cap, cap, mh, x + w - cap, y + cap, cap, dh);
  ctx.drawImage(img, cap, cap, mw, mh, x + cap, y + cap, dw, dh);
}

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
  kind: BtnKind = "ghost",
  art: Art | null = null,
): void {
  const skin = art?.btns[kind];
  const ink = kind === "ghost" ? "#5a1d7a" : kind === "danger" ? "#fffdf8" : "#2a1460";
  ctx.save();
  if (skin) {
    if (kind === "primary") {
      ctx.shadowColor = "#7ef9ff";
      ctx.shadowBlur = 10;
    }
    drawNine(ctx, skin, x, y, w, h);
    ctx.shadowBlur = 0;
  } else {
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
    } else {
      ctx.fillStyle = "rgba(255,252,245,0.88)";
    }
    roundRect(ctx, x, y, w, h, 24);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 3;
    ctx.strokeStyle = kind === "primary" ? "#fffdf8" : "rgba(255,255,255,0.85)";
    ctx.stroke();
  }
  drawLabel(ctx, label, x + w / 2, y + h / 2, Math.min(18, h * 0.38), ink, "center");
  ctx.restore();
}

const LEVEL_INK: Record<LevelId, { title: string; sub: string; best: string }> = {
  easy: { title: "#14532d", sub: "#166534", best: "#854d0e" },
  normal: { title: "#0c4a6e", sub: "#075985", best: "#854d0e" },
  hard: { title: "#7c2d12", sub: "#9a3412", best: "#7c2d12" },
  insane: { title: "#fffdf8", sub: "#ffe4f3", best: "#fff7ad" },
};

export function drawLevelCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  id: LevelId,
  title: string,
  stats: string,
  best: string,
  picked: boolean,
  art: Art | null,
): void {
  const skin = art?.levels[id];
  const ink = LEVEL_INK[id];
  ctx.save();
  if (picked) {
    ctx.shadowColor = "#fff7ad";
    ctx.shadowBlur = 16;
  }
  if (skin) drawNine(ctx, skin, x, y, w, h);
  else {
    ctx.fillStyle = picked ? "rgba(255,247,173,0.92)" : "rgba(255,252,245,0.88)";
    roundRect(ctx, x, y, w, h, 20);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  if (picked) {
    ctx.strokeStyle = "#fff7ad";
    ctx.lineWidth = 3;
    roundRect(ctx, x + 4, y + 4, w - 8, h - 8, 16);
    ctx.stroke();
  }
  drawLabel(ctx, title, x + w / 2, y + h * 0.3, Math.min(22, h * 0.28), ink.title, "center");
  drawLabel(ctx, stats, x + w / 2, y + h * 0.55, Math.min(13, h * 0.16), ink.sub, "center", "700");
  drawLabel(ctx, best, x + w / 2, y + h * 0.76, Math.min(12, h * 0.14), ink.best, "center", "700");
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

export type TrailPt = { x: number; y: number };

export function polylineLength(pts: TrailPt[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  return len;
}

export function samplePolyline(
  pts: TrailPt[],
  dist: number,
): { x: number; y: number; ang: number } | null {
  if (pts.length < 2) return null;
  let left = Math.max(0, dist);
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x;
    const dy = pts[i].y - pts[i - 1].y;
    const seg = Math.hypot(dx, dy);
    if (left <= seg || i === pts.length - 1) {
      const t = seg ? Math.min(1, left / seg) : 0;
      return { x: pts[i - 1].x + dx * t, y: pts[i - 1].y + dy * t, ang: Math.atan2(dy, dx) };
    }
    left -= seg;
  }
  return null;
}

function strokePoly(ctx: CanvasRenderingContext2D, pts: TrailPt[]): void {
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();
}

function drawChevron(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  ang: number,
  size: number,
  color: string,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(size * 0.58, 0);
  ctx.lineTo(-size * 0.42, size * 0.44);
  ctx.lineTo(-size * 0.16, 0);
  ctx.lineTo(-size * 0.42, -size * 0.44);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawArrowSprite(
  ctx: CanvasRenderingContext2D,
  arrow: CanvasImageSource,
  x: number,
  y: number,
  ang: number,
  size: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.drawImage(arrow, -size * 0.42, -size / 2, size, size);
  ctx.restore();
}

export function drawMoveTrail(
  ctx: CanvasRenderingContext2D,
  pts: TrailPt[],
  t: number,
  cell: number,
  arrow: CanvasImageSource | null,
): void {
  if (pts.length < 2) return;
  const total = polylineLength(pts);
  if (total < 8) return;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.strokeStyle = "rgba(126, 249, 255, 0.2)";
  ctx.lineWidth = cell * 0.46;
  ctx.shadowColor = "#7ef9ff";
  ctx.shadowBlur = 12;
  strokePoly(ctx, pts);

  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255, 138, 209, 0.5)";
  ctx.lineWidth = cell * 0.16;
  strokePoly(ctx, pts);

  ctx.strokeStyle = "rgba(255, 247, 173, 0.9)";
  ctx.lineWidth = Math.max(2, cell * 0.055);
  ctx.setLineDash([cell * 0.2, cell * 0.16]);
  ctx.lineDashOffset = -t * cell * 1.8;
  strokePoly(ctx, pts);
  ctx.setLineDash([]);

  const gap = cell * 0.7;
  const head = (t * cell * 2.4) % gap;
  for (let d = head; d < total - cell * 0.18; d += gap) {
    const s = samplePolyline(pts, d);
    if (!s) continue;
    ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t * 11 + d * 0.1);
    if (arrow) drawArrowSprite(ctx, arrow, s.x, s.y, s.ang, cell * 0.52);
    else drawChevron(ctx, s.x, s.y, s.ang, cell * 0.28, "#7ef9ff");
  }

  for (let i = 0; i < 6; i++) {
    const s = samplePolyline(pts, (t * cell * 3.4 + (i * total) / 6) % total);
    if (!s) continue;
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = i % 2 ? "#fff7ad" : "#ff9ecf";
    ctx.beginPath();
    ctx.arc(s.x, s.y, 1.6 + (i % 3) * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }

  const dest = samplePolyline(pts, total);
  if (dest) {
    const hop = Math.abs(Math.sin(t * 9));
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = "#fff7ad";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(dest.x, dest.y, cell * (0.26 + hop * 0.08), 0, Math.PI * 2);
    ctx.stroke();
    if (arrow) drawArrowSprite(ctx, arrow, dest.x, dest.y, dest.ang, cell * (0.78 + hop * 0.1));
    else drawChevron(ctx, dest.x, dest.y, dest.ang, cell * 0.4, "#fff7ad");
  }
  ctx.restore();
}
