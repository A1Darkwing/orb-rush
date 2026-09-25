export type Art = {
  bg: HTMLImageElement;
  logo: HTMLCanvasElement;
  cell: HTMLCanvasElement;
  cellAlt: HTMLCanvasElement;
  boom: HTMLCanvasElement;
  arrow: HTMLCanvasElement;
  orbs: HTMLCanvasElement[];
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(src));
    img.src = src;
  });
}

function keyGreen(img: HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    if (g > 90 && g > r + 25 && g > b + 25) {
      const t = Math.min(1, (g - Math.max(r, b) - 25) / 70);
      px[i + 3] = Math.round(px[i + 3] * (1 - t));
    }
  }
  ctx.putImageData(data, 0, 0);
  return c;
}

function keyPurple(img: HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    if (r < 90 && g < 60 && b < 130) px[i + 3] = 0;
  }
  ctx.putImageData(data, 0, 0);
  return trimCanvas(c);
}

function trimCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = src.getContext("2d")!;
  const { width, height } = src;
  const img = ctx.getImageData(0, 0, width, height);
  let x0 = width;
  let y0 = height;
  let x1 = 0;
  let y1 = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (img.data[(y * width + x) * 4 + 3] > 20) {
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 <= x0 || y1 <= y0) return src;
  const pad = 6;
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(width - 1, x1 + pad);
  y1 = Math.min(height - 1, y1 + pad);
  const out = document.createElement("canvas");
  out.width = x1 - x0 + 1;
  out.height = y1 - y0 + 1;
  out.getContext("2d")!.drawImage(src, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

function sliceOrbs(sheet: HTMLCanvasElement, want: number): HTMLCanvasElement[] {
  const ctx = sheet.getContext("2d")!;
  const { width, height } = sheet;
  const img = ctx.getImageData(0, 0, width, height);
  const cols: number[] = [];
  for (let x = 0; x < width; x++) {
    let n = 0;
    for (let y = 0; y < height; y++) {
      if (img.data[(y * width + x) * 4 + 3] > 24) n++;
    }
    cols.push(n);
  }
  const spans: { x0: number; x1: number }[] = [];
  let start = -1;
  for (let x = 0; x < width; x++) {
    if (cols[x] > 8 && start < 0) start = x;
    if ((cols[x] <= 8 || x === width - 1) && start >= 0) {
      spans.push({ x0: start, x1: x });
      start = -1;
    }
  }
  spans.sort((a, b) => b.x1 - b.x0 - (a.x1 - a.x0));
  const picked = spans
    .slice(0, Math.max(want, spans.length))
    .sort((a, b) => a.x0 - b.x0)
    .slice(0, want);

  return picked.map((s) => {
    const pad = 6;
    const x = Math.max(0, s.x0 - pad);
    const w = Math.min(width - x, s.x1 - s.x0 + pad * 2);
    const out = document.createElement("canvas");
    out.width = w;
    out.height = height;
    out.getContext("2d")!.drawImage(sheet, x, 0, w, height, 0, 0, w, height);
    return trimCanvas(out);
  });
}

export async function loadArt(): Promise<Art | null> {
  try {
    const [bg, logo, cellImg, cellAltImg, boomImg, arrowImg, orbsImg] = await Promise.all([
      loadImage("./art/bg.jpg"),
      loadImage("./art/logo.png"),
      loadImage("./art/cell.png"),
      loadImage("./art/cell-alt.png"),
      loadImage("./art/boom.png"),
      loadImage("./art/arrow.png"),
      loadImage("./art/orbs.png"),
    ]);
    const orbs = sliceOrbs(keyGreen(orbsImg), 7);
    return {
      bg,
      logo: keyPurple(logo),
      cell: trimCanvas(keyGreen(cellImg)),
      cellAlt: trimCanvas(keyGreen(cellAltImg)),
      boom: keyGreen(boomImg),
      arrow: trimCanvas(keyGreen(arrowImg)),
      orbs,
    };
  } catch {
    return null;
  }
}

export function drawCover(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const iw = "naturalWidth" in img && img.naturalWidth ? img.naturalWidth : (img as HTMLCanvasElement).width;
  const ih = "naturalHeight" in img && img.naturalHeight ? img.naturalHeight : (img as HTMLCanvasElement).height;
  if (!iw || !ih) return;
  const scale = Math.max(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

export function drawContain(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const iw = "naturalWidth" in img && img.naturalWidth ? img.naturalWidth : (img as HTMLCanvasElement).width;
  const ih = "naturalHeight" in img && img.naturalHeight ? img.naturalHeight : (img as HTMLCanvasElement).height;
  if (!iw || !ih) return;
  const scale = Math.min(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}
