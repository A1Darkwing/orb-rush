export type DiffId = "easy" | "normal" | "hard" | "insane";

export const BOUNDS = {
  rows: { min: 5, max: 16 },
  cols: { min: 5, max: 16 },
  colors: { min: 5, max: 7 },
  spawn: { min: 2, max: 5 },
  start: { min: 3, max: 8 },
  line: { min: 4, max: 5 },
  hints: { min: 1, max: 5 },
} as const;

export type Rules = {
  id: DiffId;
  rows: number;
  cols: number;
  colors: number;
  spawn: number;
  start: number;
  line: number;
  hints: number;
};

type Tuning = {
  targetCells: number;
  minCell: number;
  colors: number;
  spawn: number;
  start: number;
  line: number;
  hints: number;
};

// Difficulty sets density and tap size. Rows/cols come from the play-area ratio.
const TUNE: Record<DiffId, Tuning> = {
  easy: { targetCells: 42, minCell: 52, colors: 5, spawn: 2, start: 4, line: 4, hints: 5 },
  normal: { targetCells: 72, minCell: 44, colors: 6, spawn: 3, start: 5, line: 5, hints: 3 },
  hard: { targetCells: 96, minCell: 40, colors: 7, spawn: 4, start: 6, line: 5, hints: 2 },
  insane: { targetCells: 128, minCell: 34, colors: 7, spawn: 5, start: 7, line: 5, hints: 1 },
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function clampRules(id: DiffId, raw: Omit<Rules, "id">): Rules {
  const rows = clamp(raw.rows, BOUNDS.rows.min, BOUNDS.rows.max);
  const cols = clamp(raw.cols, BOUNDS.cols.min, BOUNDS.cols.max);
  const colors = clamp(raw.colors, BOUNDS.colors.min, BOUNDS.colors.max);
  const line = clamp(raw.line, BOUNDS.line.min, Math.min(BOUNDS.line.max, rows, cols));
  const spawn = clamp(raw.spawn, BOUNDS.spawn.min, Math.min(BOUNDS.spawn.max, rows * cols - 1));
  const start = clamp(raw.start, BOUNDS.start.min, Math.min(BOUNDS.start.max, rows * cols - spawn));
  const hints = clamp(raw.hints, BOUNDS.hints.min, BOUNDS.hints.max);
  return { id, rows, cols, colors, spawn, start, line, hints };
}

function scoreGrid(rows: number, cols: number, availW: number, availH: number, targetCells: number, minCell: number): number {
  const cell = Math.min(availW / cols, availH / rows);
  const fill = (cols * cell * rows * cell) / Math.max(1, availW * availH);
  const countErr = Math.abs(rows * cols - targetCells) / targetCells;
  const ratioErr = Math.abs(cols / rows - availW / availH) / Math.max(0.2, availW / availH);
  const tiny = cell < minCell ? (minCell - cell) / minCell : 0;
  return countErr * 1.1 + ratioErr * 1.8 + (1 - fill) * 1.2 + tiny * 2.4;
}

/** Pick a square-cell grid that fills the play rect and stays near the difficulty density. */
export function fitGrid(availW: number, availH: number, targetCells: number, minCell: number): { rows: number; cols: number } {
  const w = Math.max(140, availW);
  const h = Math.max(140, availH);
  const colsCap = clamp(Math.floor(w / minCell) || BOUNDS.cols.min, BOUNDS.cols.min, BOUNDS.cols.max);
  const rowsCap = clamp(Math.floor(h / minCell) || BOUNDS.rows.min, BOUNDS.rows.min, BOUNDS.rows.max);

  let best = { rows: BOUNDS.rows.min, cols: BOUNDS.cols.min, s: Number.POSITIVE_INFINITY };
  for (let rows = BOUNDS.rows.min; rows <= rowsCap; rows++) {
    for (let cols = BOUNDS.cols.min; cols <= colsCap; cols++) {
      const s = scoreGrid(rows, cols, w, h, targetCells, minCell);
      if (s < best.s) best = { rows, cols, s };
    }
  }
  return { rows: best.rows, cols: best.cols };
}

export function rulesFor(id: DiffId, availW: number, availH: number): Rules {
  const tune = TUNE[id];
  const { rows, cols } = fitGrid(availW, availH, tune.targetCells, tune.minCell);
  return clampRules(id, { ...tune, rows, cols });
}

export const DIFFS: DiffId[] = ["easy", "normal", "hard", "insane"];

export const RULES: Record<DiffId, Rules> = {
  easy: rulesFor("easy", 366, 686),
  normal: rulesFor("normal", 366, 686),
  hard: rulesFor("hard", 366, 686),
  insane: rulesFor("insane", 366, 686),
};

export function parseDiff(id: string | undefined): DiffId {
  return DIFFS.includes(id as DiffId) ? (id as DiffId) : "normal";
}
