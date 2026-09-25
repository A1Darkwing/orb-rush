export const PALETTE = [
  { fill: "#22d3ee", glow: "#67e8f9", name: "cyan" },
  { fill: "#e879f9", glow: "#f0abfc", name: "magenta" },
  { fill: "#a3e635", glow: "#d9f99d", name: "lime" },
  { fill: "#facc15", glow: "#fde047", name: "gold" },
  { fill: "#fb923c", glow: "#fdba74", name: "orange" },
  { fill: "#a78bfa", glow: "#c4b5fd", name: "violet" },
  { fill: "#fb7185", glow: "#fda4af", name: "rose" },
] as const;

export type Cell = {
  color: number | null;
  next: number | null;
};

export type Pos = { r: number; c: number };

const DIRS: Pos[] = [
  { r: 0, c: 1 },
  { r: 1, c: 0 },
  { r: 1, c: 1 },
  { r: 1, c: -1 },
];

export function rowsOf(board: Cell[][]): number {
  return board.length;
}

export function colsOf(board: Cell[][]): number {
  return board[0]?.length ?? 0;
}

export function inBounds(board: Cell[][], r: number, c: number): boolean {
  return r >= 0 && c >= 0 && r < rowsOf(board) && c < colsOf(board);
}

export function emptyBoard(rows: number, cols: number): Cell[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ color: null, next: null })),
  );
}

export function cloneBoard(board: Cell[][]): Cell[][] {
  return board.map((row) => row.map((cell) => ({ ...cell })));
}

export function emptyCells(board: Cell[][], ignoreNext = false): Pos[] {
  const out: Pos[] = [];
  for (let r = 0; r < rowsOf(board); r++) {
    for (let c = 0; c < colsOf(board); c++) {
      const cell = board[r][c];
      if (cell.color !== null) continue;
      if (!ignoreNext && cell.next !== null) continue;
      out.push({ r, c });
    }
  }
  return out;
}

export function randColor(colors: number): number {
  return Math.floor(Math.random() * colors);
}

export function placeRandom(board: Cell[][], count: number, asNext: boolean, colors: number): Pos[] {
  const spots = emptyCells(board, asNext);
  const placed: Pos[] = [];
  for (let i = 0; i < count && spots.length; i++) {
    const idx = Math.floor(Math.random() * spots.length);
    const pos = spots.splice(idx, 1)[0];
    const color = randColor(colors);
    if (asNext) board[pos.r][pos.c].next = color;
    else board[pos.r][pos.c].color = color;
    placed.push(pos);
  }
  return placed;
}

export function growNext(board: Cell[][]): Pos[] {
  const grown: Pos[] = [];
  for (let r = 0; r < rowsOf(board); r++) {
    for (let c = 0; c < colsOf(board); c++) {
      const cell = board[r][c];
      if (cell.next === null || cell.color !== null) continue;
      cell.color = cell.next;
      cell.next = null;
      grown.push({ r, c });
    }
  }
  return grown;
}

export function walkable(board: Cell[][], r: number, c: number): boolean {
  return inBounds(board, r, c) && board[r][c].color === null;
}

export function findPath(board: Cell[][], from: Pos, to: Pos): Pos[] | null {
  if (!walkable(board, to.r, to.c) && !(to.r === from.r && to.c === from.c)) return null;
  const key = (p: Pos) => `${p.r},${p.c}`;
  const q: Pos[] = [from];
  const prev = new Map<string, Pos | null>([[key(from), null]]);
  const steps = [
    { r: -1, c: 0 },
    { r: 1, c: 0 },
    { r: 0, c: -1 },
    { r: 0, c: 1 },
  ];

  while (q.length) {
    const cur = q.shift()!;
    if (cur.r === to.r && cur.c === to.c) {
      const path: Pos[] = [];
      let node: Pos | null = cur;
      while (node) {
        path.push(node);
        node = prev.get(key(node)) ?? null;
      }
      return path.reverse();
    }
    for (const s of steps) {
      const n = { r: cur.r + s.r, c: cur.c + s.c };
      if (prev.has(key(n))) continue;
      if (!inBounds(board, n.r, n.c)) continue;
      if (board[n.r][n.c].color !== null) continue;
      prev.set(key(n), cur);
      q.push(n);
    }
  }
  return null;
}

export function reachable(board: Cell[][], from: Pos): Set<string> {
  const seen = new Set<string>([`${from.r},${from.c}`]);
  const q: Pos[] = [from];
  const steps = [
    { r: -1, c: 0 },
    { r: 1, c: 0 },
    { r: 0, c: -1 },
    { r: 0, c: 1 },
  ];
  while (q.length) {
    const cur = q.shift()!;
    for (const s of steps) {
      const n = { r: cur.r + s.r, c: cur.c + s.c };
      const k = `${n.r},${n.c}`;
      if (seen.has(k) || !walkable(board, n.r, n.c)) continue;
      seen.add(k);
      q.push(n);
    }
  }
  seen.delete(`${from.r},${from.c}`);
  return seen;
}

export function findLines(board: Cell[][], lineLen: number): Pos[] {
  const marked = new Set<string>();
  const mark = (p: Pos) => marked.add(`${p.r},${p.c}`);

  for (let r = 0; r < rowsOf(board); r++) {
    for (let c = 0; c < colsOf(board); c++) {
      const color = board[r][c].color;
      if (color === null) continue;
      for (const d of DIRS) {
        const run: Pos[] = [{ r, c }];
        let nr = r + d.r;
        let nc = c + d.c;
        while (inBounds(board, nr, nc) && board[nr][nc].color === color) {
          run.push({ r: nr, c: nc });
          nr += d.r;
          nc += d.c;
        }
        nr = r - d.r;
        nc = c - d.c;
        while (inBounds(board, nr, nc) && board[nr][nc].color === color) {
          run.unshift({ r: nr, c: nc });
          nr -= d.r;
          nc -= d.c;
        }
        if (run.length >= lineLen) run.forEach(mark);
      }
    }
  }

  const cells: Pos[] = [];
  for (const key of marked) {
    const [r, c] = key.split(",").map(Number);
    cells.push({ r, c });
  }
  return cells;
}

export function clearCells(board: Cell[][], cells: Pos[]): void {
  for (const { r, c } of cells) {
    board[r][c].color = null;
  }
}

export function lineScore(count: number, combo: number, lineLen: number): number {
  const base = count * 20 + Math.max(0, count - lineLen) * 25;
  const mult = 1 + Math.max(0, combo - 1) * 0.35;
  return Math.round(base * mult);
}

export function occupiedCount(board: Cell[][]): number {
  let n = 0;
  for (const row of board) for (const cell of row) if (cell.color !== null) n++;
  return n;
}

export type HintMove = { from: Pos; to: Pos };

export function previewClear(board: Cell[][], from: Pos, to: Pos, lineLen: number): Pos[] {
  const color = board[from.r][from.c].color;
  if (color === null) return [];
  if (!findPath(board, from, to)) return [];
  const sim = cloneBoard(board);
  sim[to.r][to.c].color = color;
  sim[to.r][to.c].next = null;
  sim[from.r][from.c].color = null;
  return findLines(sim, lineLen);
}

export function hotCells(board: Cell[][], lineLen: number): Map<string, number> {
  const heat = new Map<string, number>();
  for (let r = 0; r < rowsOf(board); r++) {
    for (let c = 0; c < colsOf(board); c++) {
      const color = board[r][c].color;
      if (color === null) continue;
      for (const d of DIRS) {
        const run: Pos[] = [{ r, c }];
        let nr = r + d.r;
        let nc = c + d.c;
        while (inBounds(board, nr, nc) && board[nr][nc].color === color) {
          run.push({ r: nr, c: nc });
          nr += d.r;
          nc += d.c;
        }
        nr = r - d.r;
        nc = c - d.c;
        while (inBounds(board, nr, nc) && board[nr][nc].color === color) {
          run.unshift({ r: nr, c: nc });
          nr -= d.r;
          nc -= d.c;
        }
        if (run.length >= lineLen - 1 && run.length < lineLen) {
          for (const p of run) {
            const key = `${p.r},${p.c}`;
            heat.set(key, Math.max(heat.get(key) ?? 0, run.length));
          }
        }
      }
    }
  }
  return heat;
}

export function findHint(board: Cell[][], lineLen: number): HintMove | null {
  const orbs: Pos[] = [];
  for (let r = 0; r < rowsOf(board); r++) {
    for (let c = 0; c < colsOf(board); c++) {
      if (board[r][c].color !== null) orbs.push({ r, c });
    }
  }

  for (const from of orbs) {
    const spots = reachable(board, from);
    for (const key of spots) {
      const [r, c] = key.split(",").map(Number);
      const sim = cloneBoard(board);
      sim[r][c].color = sim[from.r][from.c].color;
      sim[from.r][from.c].color = null;
      if (findLines(sim, lineLen).length >= lineLen) return { from, to: { r, c } };
    }
  }
  return null;
}
