export type DiffId = "easy" | "normal" | "hard" | "insane";

export const BOUNDS = {
  rows: { min: 6, max: 12 },
  cols: { min: 6, max: 12 },
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

const RAW: Record<DiffId, Omit<Rules, "id">> = {
  easy: { rows: 6, cols: 7, colors: 5, spawn: 2, start: 4, line: 4, hints: 5 },
  normal: { rows: 8, cols: 9, colors: 6, spawn: 3, start: 5, line: 5, hints: 3 },
  hard: { rows: 9, cols: 10, colors: 7, spawn: 4, start: 6, line: 5, hints: 2 },
  insane: { rows: 11, cols: 12, colors: 7, spawn: 5, start: 7, line: 5, hints: 1 },
};

export const DIFFS: DiffId[] = ["easy", "normal", "hard", "insane"];

export const RULES: Record<DiffId, Rules> = {
  easy: clampRules("easy", RAW.easy),
  normal: clampRules("normal", RAW.normal),
  hard: clampRules("hard", RAW.hard),
  insane: clampRules("insane", RAW.insane),
};

export function parseDiff(id: string | undefined): DiffId {
  return DIFFS.includes(id as DiffId) ? (id as DiffId) : "normal";
}
