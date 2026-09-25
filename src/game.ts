import { Art, drawContain } from "./art";
import { Sfx } from "./audio";
import {
  Cell,
  PALETTE,
  Pos,
  clearCells,
  colsOf,
  emptyBoard,
  findHint,
  findLines,
  findPath,
  growNext,
  hotCells,
  lineScore,
  occupiedCount,
  placeRandom,
  previewClear,
  reachable,
  rowsOf,
} from "./board";
import { DIFFS, DiffId, RULES, Rules, parseDiff, rulesFor } from "./difficulty";
import { Copy } from "./i18n";
import { Fx } from "./particles";
import {
  AD_REWARD_COINS,
  Account,
  persistSave,
  resolveAccount,
  resolvePlatform,
  submitBestScore,
  watchRewardedAd,
} from "./platform";
import { claimCheckout, startCheckout, stripeEnabled } from "./stripe";
import { COIN_PACKS, PACK_IDS, PackId } from "./store";
import {
  drawBackdrop,
  drawButton,
  drawChip,
  drawLabel,
  drawLevelCard,
  drawMoveTrail,
  drawOrb,
  drawShopCard,
  hit,
  roundRect,
} from "./render";
import { THEME_IDS, THEME_PRICE, ThemeId, defaultOwned, normalizeOwned, parseTheme } from "./themes";

type Screen = "menu" | "diff" | "how" | "shop" | "play";
type Anim =
  | { kind: "move"; path: Pos[]; color: number; t: number }
  | { kind: "clear"; cells: Pos[]; t: number }
  | { kind: "grow"; cells: Pos[]; t: number };

type SaveData = {
  bestScore?: number;
  seenHow: boolean;
  difficulty?: string;
  best?: Partial<Record<DiffId, number>>;
  coins?: number;
  theme?: string;
  owned?: string[];
  buyerId?: string;
  claimed?: string[];
};

export class OrbRush {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private api = resolvePlatform();
  private copy: Copy;
  private sfx = new Sfx();
  private fx = new Fx();

  private screen: Screen = "menu";
  private paused = false;
  private running = false;
  private raf = 0;
  private pump = 0;
  private last = 0;
  private time = 0;
  private toast = "";
  private toastLife = 0;

  private rules: Rules = RULES.normal;
  private board: Cell[][] = emptyBoard(RULES.normal.rows, RULES.normal.cols);
  private score = 0;
  private best = 0;
  private bestBy: Record<DiffId, number> = { easy: 0, normal: 0, hard: 0, insane: 0 };
  private combo = 0;
  private selected: Pos | null = null;
  private reach = new Set<string>();
  private anim: Anim | null = null;
  private over = false;
  private newBest = false;
  private spawnAfterClear = false;
  private hintsLeft = 3;
  private seenHow = false;
  private hover: Pos | null = null;
  private dpr = 1;
  private layout = { board: { x: 0, y: 0, cell: 40 } };
  private art: Art | null = null;
  private packs: Partial<Record<ThemeId, Art>> = {};
  private account: Account = { youtube: false, id: "guest" };
  private coins = 200;
  private theme: ThemeId = "candy";
  private owned: ThemeId[] = defaultOwned();
  private buyerId = "";
  private claimed: string[] = [];
  private paying = false;
  private adBusy = false;

  constructor(canvas: HTMLCanvasElement, copy: Copy, art: Art | null = null) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    this.ctx = ctx;
    this.copy = copy;
    this.art = art;
    this.account = resolveAccount(this.api);
  }

  setThemePacks(packs: Partial<Record<ThemeId, Art>>): void {
    this.packs = packs;
    this.applyTheme(this.theme);
  }

  setCopy(copy: Copy): void {
    this.copy = copy;
  }

  setAudioEnabled(on: boolean): void {
    this.sfx.setEnabled(on);
  }

  async boot(saveRaw: string): Promise<void> {
    this.readSave(saveRaw);
    if (!this.buyerId) this.buyerId = crypto.randomUUID();
    this.resize();
    window.addEventListener("resize", () => this.resize());
    this.bindInput();
    this.api.game.gameReady();
    this.startLoop();
    await this.claimStripeReturn();
  }

  tap(x: number, y: number): void {
    this.onTap(x, y);
  }

  debugState(): { screen: Screen; paused: boolean; score: number; over: boolean } {
    return { screen: this.screen, paused: this.paused, score: this.score, over: this.over };
  }

  debugBoard(): { colors: (number | null)[][]; next: (number | null)[][]; layout: { x: number; y: number; cell: number } } {
    return {
      colors: this.board.map((row) => row.map((c) => c.color)),
      next: this.board.map((row) => row.map((c) => c.next)),
      layout: this.layout.board,
    };
  }

  debugFlush(seconds = 2): void {
    const steps = 24;
    for (let i = 0; i < steps; i++) this.update(seconds / steps);
    this.draw();
  }

  debugFill(): void {
    for (let r = 0; r < rowsOf(this.board); r++) {
      for (let c = 0; c < colsOf(this.board); c++) {
        if (this.board[r][c].color === null) this.board[r][c].color = (r + c) % this.rules.colors;
        this.board[r][c].next = null;
      }
    }
    this.checkOver();
    this.draw();
  }

  debugSeedScore(): void {
    this.board = emptyBoard(this.rules.rows, this.rules.cols);
    const color = 3 % this.rules.colors;
    const row = Math.min(4, this.rules.rows - 1);
    for (let c = 0; c < Math.min(this.rules.line - 1, this.rules.cols - 1); c++) {
      this.board[row][c].color = color;
    }
    this.board[0][this.rules.cols - 1].color = color;
    this.board[Math.min(2, this.rules.rows - 1)][Math.min(2, this.rules.cols - 1)].color = 0;
    placeRandom(this.board, this.rules.spawn, true, this.rules.colors);
    this.selected = null;
    this.reach.clear();
    this.anim = null;
    this.over = false;
  }

  pause(): void {
    this.paused = true;
    this.sfx.setEnabled(false);
    cancelAnimationFrame(this.raf);
    this.running = false;
  }

  resume(): void {
    this.paused = false;
    this.sfx.setEnabled(this.platformAudio());
    this.startLoop();
  }

  private platformAudio(): boolean {
    try {
      return this.api.system.isAudioEnabled();
    } catch {
      return true;
    }
  }

  private readSave(raw: string): void {
    if (!raw) return;
    try {
      const data = JSON.parse(raw) as SaveData;
      this.seenHow = Boolean(data.seenHow);
      this.rules = this.viewportRules(parseDiff(data.difficulty));
      for (const id of DIFFS) {
        this.bestBy[id] = Math.max(0, Math.floor(data.best?.[id] || 0));
      }
      if (!data.best && data.bestScore) this.bestBy.normal = Math.max(0, Math.floor(data.bestScore));
      this.best = this.bestBy[this.rules.id];
      this.coins = Math.max(0, Math.floor(data.coins ?? this.coins));
      this.owned = normalizeOwned(data.owned);
      this.theme = this.owned.includes(parseTheme(data.theme)) ? parseTheme(data.theme) : "candy";
      this.buyerId = data.buyerId || this.buyerId;
      this.claimed = Array.isArray(data.claimed) ? data.claimed.filter((id) => typeof id === "string") : [];
      this.applyTheme(this.theme);
    } catch {
      this.api.health.logWarning();
    }
  }

  private applyTheme(id: ThemeId): void {
    if (!this.owned.includes(id)) return;
    this.theme = id;
    this.art = this.packs[id] ?? this.packs.candy ?? this.art;
  }

  private themeName(id: ThemeId): string {
    if (id === "soccer") return this.copy.themeSoccer;
    if (id === "egg") return this.copy.themeEgg;
    return this.copy.themeCandy;
  }

  private themeHint(id: ThemeId): string {
    if (id === "soccer") return this.copy.themeSoccerHint;
    if (id === "egg") return this.copy.themeEggHint;
    return this.copy.themeCandyHint;
  }

  private grantCoins(amount: number): void {
    if (amount <= 0) return;
    this.coins += amount;
  }

  private async claimStripeReturn(): Promise<void> {
    if (!stripeEnabled(this.api)) return;
    const q = new URLSearchParams(location.search);
    if (q.get("stripe") === "cancel") {
      this.showToast(this.copy.stripeCancel);
      this.clearStripeQuery();
      return;
    }
    const sessionId = q.get("session_id");
    if (!sessionId) return;
    if (this.claimed.includes(sessionId)) {
      this.clearStripeQuery();
      return;
    }
    try {
      const coins = await claimCheckout(sessionId, this.buyerId);
      this.grantCoins(coins);
      this.claimed = [...this.claimed, sessionId].slice(-40);
      this.screen = "shop";
      this.showToast(`${this.copy.stripeOk} +${coins}`);
      this.sfx.winFanfare();
      void this.writeSave();
    } catch {
      this.showToast(this.copy.stripeFail);
    }
    this.clearStripeQuery();
  }

  private clearStripeQuery(): void {
    const url = new URL(location.href);
    url.searchParams.delete("session_id");
    url.searchParams.delete("stripe");
    history.replaceState({}, "", url.pathname + url.search + url.hash);
  }

  private async buyPack(id: PackId): Promise<void> {
    if (!stripeEnabled(this.api)) {
      this.showToast(this.copy.stripeOff);
      this.sfx.deny();
      return;
    }
    if (this.paying) return;
    this.paying = true;
    try {
      const url = await startCheckout(id, this.buyerId);
      location.href = url;
    } catch {
      this.showToast(this.copy.stripeFail);
      this.sfx.deny();
    } finally {
      this.paying = false;
    }
  }

  private async watchAd(): Promise<void> {
    if (this.adBusy) {
      this.showToast(this.copy.adBusy);
      return;
    }
    this.adBusy = true;
    try {
      const earned = await watchRewardedAd(this.api);
      if (!earned) {
        this.showToast(this.copy.adNo);
        this.sfx.deny();
        return;
      }
      this.grantCoins(AD_REWARD_COINS);
      this.showToast(`${this.copy.stripeOk} +${AD_REWARD_COINS}`);
      this.sfx.winFanfare();
      void this.writeSave();
    } finally {
      this.adBusy = false;
    }
  }

  private adCard(W: number, H: number): { x: number; y: number; w: number; h: number } {
    const w = Math.min(320, W - 48);
    return { x: (W - w) / 2, y: H * 0.168, w, h: 48 };
  }

  private packCards(W: number, H: number): { id: PackId; x: number; y: number; w: number; h: number }[] {
    if (!stripeEnabled(this.api)) return [];
    const gap = 10;
    const w = Math.min(128, (W - 48 - gap * 2) / 3);
    const h = 44;
    const x0 = (W - (w * 3 + gap * 2)) / 2;
    const y = H * 0.168 + 56;
    return PACK_IDS.map((id, i) => ({ id, x: x0 + i * (w + gap), y, w, h }));
  }

  private buyOrEquip(id: ThemeId): void {
    if (this.owned.includes(id)) {
      this.applyTheme(id);
      void this.writeSave();
      this.sfx.select();
      return;
    }
    const price = THEME_PRICE[id];
    if (this.coins < price) {
      this.sfx.deny();
      this.showToast(this.copy.notEnough);
      return;
    }
    this.coins -= price;
    this.owned = normalizeOwned([...this.owned, id]);
    this.applyTheme(id);
    void this.writeSave();
    this.sfx.winFanfare();
  }

  private async writeSave(): Promise<void> {
    const data: SaveData = {
      bestScore: Math.max(...DIFFS.map((id) => this.bestBy[id])),
      seenHow: this.seenHow,
      difficulty: this.rules.id,
      best: { ...this.bestBy },
      coins: this.coins,
      theme: this.theme,
      owned: this.owned,
      buyerId: this.buyerId,
      claimed: this.claimed,
    };
    await persistSave(this.api, JSON.stringify(data));
    await submitBestScore(this.api, this.best);
  }

  private startLoop(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const tick = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(0.033, (now - this.last) / 1000);
      this.last = now;
      this.update(dt);
      this.draw();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
    if (!this.pump) {
      this.pump = window.setInterval(() => {
        if (!this.running || this.paused) return;
        if (performance.now() - this.last < 80) return;
        const now = performance.now();
        const dt = Math.min(0.033, (now - this.last) / 1000);
        this.last = now;
        this.update(dt);
        this.draw();
      }, 50);
    }
  }

  private resize(): void {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  private bindInput(): void {
    const point = (e: PointerEvent | MouseEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      const sx = rect.width / (this.canvas.width / this.dpr);
      const sy = rect.height / (this.canvas.height / this.dpr);
      return { x: (e.clientX - rect.left) / sx, y: (e.clientY - rect.top) / sy };
    };
    this.canvas.addEventListener("pointerdown", (e) => {
      this.sfx.unlock();
      this.onTap(point(e).x, point(e).y);
    });
    this.canvas.addEventListener("pointermove", (e) => {
      this.onHover(point(e).x, point(e).y);
    });
  }

  private playArea(W = this.canvas.width / this.dpr || window.innerWidth, H = this.canvas.height / this.dpr || window.innerHeight): {
    w: number;
    h: number;
  } {
    const chrome = this.playChrome(W, H);
    const frame = chrome.compact ? 16 : 20;
    return {
      w: Math.max(160, W - chrome.pad * 2 - frame),
      h: Math.max(160, chrome.availBot - chrome.availTop - frame),
    };
  }

  private viewportRules(id: DiffId): Rules {
    const area = this.playArea();
    return rulesFor(id, area.w, area.h);
  }

  private playChrome(W: number, H: number) {
    const tall = H / Math.max(1, W) >= 1.2;
    const compact = tall || H < 700;
    const pad = compact ? 12 : 16;
    const top = compact ? 10 : 14;
    const chipH = compact ? 46 : 58;
    const nextH = compact ? 28 : 40;
    const btnH = compact ? 44 : 52;
    const nextY = top + chipH + 8;
    return {
      tall,
      compact,
      pad,
      top,
      chipH,
      nextY,
      nextH,
      btnH,
      availTop: nextY + nextH,
      availBot: H - pad - btnH - 10,
    };
  }

  private pickDiff(id: DiffId): void {
    this.rules = this.viewportRules(id);
    this.best = this.bestBy[id];
    void this.writeSave();
    this.newRun();
  }

  private newRun(): void {
    this.rules = this.viewportRules(this.rules.id);
    this.board = emptyBoard(this.rules.rows, this.rules.cols);
    placeRandom(this.board, this.rules.start, false, this.rules.colors);
    placeRandom(this.board, this.rules.spawn, true, this.rules.colors);
    this.score = 0;
    this.combo = 0;
    this.selected = null;
    this.reach.clear();
    this.anim = null;
    this.over = false;
    this.newBest = false;
    this.spawnAfterClear = false;
    this.hintsLeft = this.rules.hints;
    this.screen = "play";
  }

  private showToast(text: string): void {
    this.toast = text;
    this.toastLife = 1.3;
  }

  private comboWord(): string {
    if (this.combo >= 6) return this.copy.legendary;
    if (this.combo >= 5) return this.copy.insane;
    if (this.combo >= 4) return this.copy.super;
    if (this.combo >= 3) return this.copy.great;
    return this.copy.nice;
  }

  private boomLine(cells: Pos[], color: number): void {
    const pal = PALETTE[color] ?? PALETTE[3];
    const mid = cells[Math.floor(cells.length / 2)];
    const center = this.cellCenter(mid.r, mid.c);
    this.fx.explode(center.x, center.y, pal.glow, true);
    cells.forEach((p, i) => {
      const c = this.cellCenter(p.r, p.c);
      this.fx.explode(c.x, c.y, pal.fill, false);
      this.sfx.pop(i);
    });
    this.fx.float(center.x, center.y - 10, "BOOM!", "#fff7ad", 28);
  }

  private applyClears(cells: Pos[]): number {
    if (!cells.length) return 0;
    this.combo += 1;
    const gained = lineScore(cells.length, this.combo, this.rules.line);
    this.score += gained;
    const mid = cells[Math.floor(cells.length / 2)];
    const { x, y } = this.cellCenter(mid.r, mid.c);
    const coins = Math.max(1, Math.floor(gained / 15));
    this.grantCoins(coins);
    this.fx.float(x, y, `+${gained}`, "#fff7ad", 26);
    this.fx.float(x + 34, y + 16, `+${coins}`, "#ffe566", 14);
    this.fx.float(x, y - 28, this.comboWord(), PALETTE[Math.min(this.combo, this.rules.colors - 1)].glow, 22);
    clearCells(this.board, cells);
    if (this.score > this.best) {
      this.best = this.score;
      this.bestBy[this.rules.id] = this.best;
      this.newBest = true;
      void this.writeSave();
    }
    try {
      navigator.vibrate?.(this.combo >= 3 ? 28 : 14);
    } catch {
      /* ignore */
    }
    return gained;
  }

  private finishMove(scored: boolean): void {
    if (!scored) {
      this.combo = 0;
      const grown = growNext(this.board);
      const extra = Math.max(0, this.rules.spawn - grown.length);
      if (extra) grown.push(...placeRandom(this.board, extra, false, this.rules.colors));
      const afterGrow = findLines(this.board, this.rules.line);
      if (afterGrow.length) {
        this.spawnAfterClear = true;
        this.boomLine(afterGrow, this.board[afterGrow[0].r][afterGrow[0].c].color ?? 3);
        this.anim = { kind: "clear", cells: afterGrow, t: 0 };
        return;
      }
      this.anim = { kind: "grow", cells: grown, t: 0 };
      placeRandom(this.board, this.rules.spawn, true, this.rules.colors);
    } else {
      this.sfx.combo(this.combo);
      if (this.spawnAfterClear) {
        this.spawnAfterClear = false;
        placeRandom(this.board, this.rules.spawn, true, this.rules.colors);
      }
    }
    this.checkOver();
  }

  // End when every cell has an orb. Previews do not count.
  private checkOver(): void {
    if (this.over) return;
    if (occupiedCount(this.board) < this.rules.rows * this.rules.cols) return;
    this.over = true;
    this.grantCoins(Math.floor(this.score / 25));
    this.sfx.gameOver();
    if (this.newBest) this.sfx.winFanfare();
    void this.writeSave();
  }

  private tryMove(to: Pos): void {
    if (!this.selected || this.anim || this.over) return;
    const from = this.selected;
    if (from.r === to.r && from.c === to.c) {
      this.selected = null;
      this.reach.clear();
      return;
    }
    const path = findPath(this.board, from, to);
    if (!path || path.length < 2) {
      this.sfx.deny();
      this.showToast(this.copy.noMove);
      this.fx.punch(4, 0.08);
      return;
    }
    const color = this.board[from.r][from.c].color;
    if (color === null) return;
    this.board[from.r][from.c].color = null;
    this.selected = null;
    this.reach.clear();
    this.anim = { kind: "move", path, color, t: 0 };
    this.sfx.move();
  }

  private onTap(x: number, y: number): void {
    if (this.paused) return;
    const W = this.canvas.width / this.dpr;
    const H = this.canvas.height / this.dpr;
    const { pad, btnH } = this.playChrome(W, H);

    if (this.screen === "menu") {
      const bw = Math.min(320, W - 48);
      const bx = (W - bw) / 2;
      if (hit(x, y, bx, H * 0.54, bw, 54)) {
        this.screen = this.seenHow ? "diff" : "how";
        this.sfx.select();
      } else if (hit(x, y, bx, H * 0.54 + 62, bw, 48)) {
        this.screen = "shop";
        this.sfx.select();
      } else if (hit(x, y, bx, H * 0.54 + 118, bw, 48)) {
        this.screen = "how";
        this.sfx.select();
      }
      return;
    }

    if (this.screen === "shop") {
      const ad = this.adCard(W, H);
      if (hit(x, y, ad.x, ad.y, ad.w, ad.h)) {
        void this.watchAd();
        return;
      }
      for (const pack of this.packCards(W, H)) {
        if (hit(x, y, pack.x, pack.y, pack.w, pack.h)) {
          void this.buyPack(pack.id);
          return;
        }
      }
      for (const card of this.shopCards(W, H)) {
        const bw = 108;
        const bh = 40;
        const bx = card.x + card.w - bw - 14;
        const by = card.y + card.h / 2 - bh / 2;
        if (hit(x, y, card.x, card.y, card.w, card.h) || hit(x, y, bx, by, bw, bh)) {
          this.buyOrEquip(card.id);
          return;
        }
      }
      const bw = Math.min(280, W - 48);
      if (hit(x, y, (W - bw) / 2, H * 0.88, bw, 48)) {
        this.screen = "menu";
        this.sfx.select();
      }
      return;
    }

    if (this.screen === "diff") {
      const cards = this.diffCards(W, H);
      for (const card of cards) {
        if (hit(x, y, card.x, card.y, card.w, card.h)) {
          this.pickDiff(card.id);
          this.sfx.select();
          return;
        }
      }
      const bw = Math.min(280, W - 48);
      if (hit(x, y, (W - bw) / 2, H * 0.88, bw, 48)) {
        this.screen = "menu";
        this.sfx.select();
      }
      return;
    }

    if (this.screen === "how") {
      const bw = Math.min(320, W - 48);
      if (hit(x, y, (W - bw) / 2, H * 0.78, bw, 54)) {
        this.seenHow = true;
        void this.writeSave();
        this.screen = "diff";
        this.sfx.select();
      }
      return;
    }

    if (this.over) {
      const bw = Math.min(280, W - 48);
      const bx = (W - bw) / 2;
      if (hit(x, y, bx, H * 0.62, bw, 52)) {
        this.newRun();
        this.sfx.select();
      } else if (hit(x, y, bx, H * 0.62 + 62, bw, 46)) {
        this.screen = "menu";
        this.sfx.select();
      }
      return;
    }

    const btnY = H - pad - btnH;
    const gap = 10;
    const bw = (W - pad * 2 - gap * 2) / 3;
    if (hit(x, y, pad, btnY, bw, btnH)) {
      this.useHint();
      return;
    }
    if (hit(x, y, pad + bw + gap, btnY, bw, btnH)) {
      this.newRun();
      this.sfx.select();
      return;
    }
    if (hit(x, y, pad + (bw + gap) * 2, btnY, bw, btnH)) {
      this.screen = "menu";
      this.sfx.select();
      return;
    }

    if (this.anim) return;
    const cell = this.cellAt(x, y);
    if (!cell) return;
    const here = this.board[cell.r][cell.c];
    if (here.color !== null) {
      if (this.selected?.r === cell.r && this.selected?.c === cell.c) {
        this.selected = null;
        this.reach.clear();
        this.sfx.select();
        return;
      }
      this.selected = cell;
      this.reach = reachable(this.board, cell);
      this.sfx.select();
      return;
    }
    if (this.selected) this.tryMove(cell);
  }

  private useHint(): void {
    if (this.anim || this.over) return;
    if (this.hintsLeft <= 0) {
      this.showToast(this.copy.noHint);
      this.sfx.deny();
      return;
    }
    const move = findHint(this.board, this.rules.line);
    if (!move) {
      this.showToast(this.copy.noHint);
      this.sfx.deny();
      return;
    }
    this.hintsLeft -= 1;
    this.selected = move.from;
    this.reach = reachable(this.board, move.from);
    this.hover = move.to;
    this.sfx.select();
    const a = this.cellCenter(move.from.r, move.from.c);
    const b = this.cellCenter(move.to.r, move.to.c);
    this.fx.float((a.x + b.x) / 2, (a.y + b.y) / 2, this.copy.hint, "#67e8f9", 16);
  }

  private onHover(x: number, y: number): void {
    this.hover = this.cellAt(x, y);
  }

  private cellAt(x: number, y: number): Pos | null {
    const { x: bx, y: by, cell } = this.layout.board;
    const c = Math.floor((x - bx) / cell);
    const r = Math.floor((y - by) / cell);
    if (r < 0 || c < 0 || r >= this.rules.rows || c >= this.rules.cols) return null;
    return { r, c };
  }

  private cellCenter(r: number, c: number): { x: number; y: number } {
    const { x, y, cell } = this.layout.board;
    return { x: x + c * cell + cell / 2, y: y + r * cell + cell / 2 };
  }

  private update(dt: number): void {
    this.time += dt;
    this.toastLife = Math.max(0, this.toastLife - dt);
    this.fx.update(dt);
    if (this.screen === "play" && !this.over && Math.random() < dt * 8) {
      const heat = hotCells(this.board, this.rules.line);
      for (const key of heat.keys()) {
        if (Math.random() > 0.35) continue;
        const [r, c] = key.split(",").map(Number);
        const p = this.cellCenter(r, c);
        this.fx.spark(p.x, p.y, "#ffe566");
      }
    }
    if (!this.anim) return;

    if (this.anim.kind === "move") {
      this.anim.t += dt * 3.4;
      const path = this.anim.path;
      const i = Math.min(path.length - 1, Math.floor(this.anim.t * (path.length - 1)));
      const p = path[i];
      const c = this.cellCenter(p.r, p.c);
      this.fx.trail(c.x, c.y, PALETTE[this.anim.color].glow);
      if (this.anim.t >= 1) {
        const dest = path[path.length - 1];
        this.board[dest.r][dest.c].color = this.anim.color;
        this.board[dest.r][dest.c].next = null;
        const lines = findLines(this.board, this.rules.line);
        if (lines.length) {
          this.boomLine(lines, this.anim.color);
          this.anim = { kind: "clear", cells: lines, t: 0 };
        } else {
          this.anim = null;
          this.finishMove(false);
        }
      }
    } else if (this.anim.kind === "clear") {
      this.anim.t += dt * 1.8;
      if (this.anim.t >= 1) {
        const scored = this.applyClears(this.anim.cells) > 0;
        this.anim = null;
        this.finishMove(scored);
      }
    } else if (this.anim.kind === "grow") {
      this.anim.t += dt * 3.2;
      if (this.anim.t >= 1) {
        const extra = findLines(this.board, this.rules.line);
        if (extra.length) {
          this.boomLine(extra, this.board[extra[0].r][extra[0].c].color ?? 3);
          this.anim = { kind: "clear", cells: extra, t: 0 };
        } else {
          this.anim = null;
        }
        this.checkOver();
      }
    }
  }

  private draw(): void {
    const ctx = this.ctx;
    const W = this.canvas.width / this.dpr;
    const H = this.canvas.height / this.dpr;
    ctx.clearRect(0, 0, W, H);
    drawBackdrop(ctx, W, H, this.time, this.art);

    ctx.save();
    if (this.fx.shake > 0) {
      ctx.translate((Math.random() - 0.5) * this.fx.shake, (Math.random() - 0.5) * this.fx.shake);
    }

    if (this.screen === "menu") this.drawMenu(W, H);
    else if (this.screen === "diff") this.drawDiff(W, H);
    else if (this.screen === "how") this.drawHow(W, H);
    else if (this.screen === "shop") this.drawShop(W, H);
    else this.drawPlay(W, H);

    this.fx.draw(ctx, this.art);
    ctx.restore();

    if (this.fx.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.fx.flash * 0.18})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (this.paused) {
      ctx.fillStyle = "rgba(4,6,16,0.62)";
      ctx.fillRect(0, 0, W, H);
      drawLabel(ctx, this.copy.pause, W / 2, H / 2, 36, "#f8fafc", "center");
    }
  }

  private drawMenu(W: number, H: number): void {
    const ctx = this.ctx;
    if (this.art) {
      drawContain(ctx, this.art.logo, W * 0.08, H * 0.08, W * 0.84, H * 0.28);
    } else {
      drawLabel(ctx, this.copy.title, W / 2, H * 0.22, Math.min(52, W * 0.13), "#fff7ad", "center");
    }
    this.drawAccountBar(W);
    drawLabel(ctx, this.copy.tagline, W / 2, H * 0.36, 15, "#fffdf8", "center", "700");
    drawLabel(
      ctx,
      `${this.copy.best}: ${Math.max(...DIFFS.map((id) => this.bestBy[id]))}   ·   ${this.copy.coins} ${this.coins}`,
      W / 2,
      H * 0.41,
      18,
      "#ffe566",
      "center",
    );

    const demo = [0, 2, 4, 1, 6];
    demo.forEach((color, i) => {
      drawOrb(ctx, W / 2 + (i - 2) * 44, H * 0.475, 16, color, {
        pulse: Math.sin(this.time * 3 + i),
        art: this.art,
      });
    });

    const bw = Math.min(320, W - 48);
    const bx = (W - bw) / 2;
    drawButton(ctx, bx, H * 0.54, bw, 54, this.copy.play, "primary", this.art);
    drawButton(ctx, bx, H * 0.54 + 62, bw, 48, this.copy.shop, "ghost", this.art);
    drawButton(ctx, bx, H * 0.54 + 118, bw, 48, this.copy.how, "ghost", this.art);
  }

  private drawAccountBar(W: number): void {
    const yt = this.account.youtube;
    const label = yt ? this.copy.accountYt : this.copy.accountGuest;
    const hint = yt ? this.copy.accountYtHint : this.copy.accountGuestHint;
    drawChip(this.ctx, 16, 12, Math.min(168, W * 0.42), 48, label, hint, yt ? "#1aa6c8" : "#6b2d86");
    drawChip(this.ctx, W - 16 - 120, 12, 120, 48, this.copy.coins, String(this.coins), "#e2a400");
  }

  private shopCards(W: number, H: number): { id: ThemeId; x: number; y: number; w: number; h: number }[] {
    const gap = 12;
    const w = Math.min(440, W - 36);
    const h = Math.min(112, H * 0.17);
    const x = (W - w) / 2;
    const y0 = stripeEnabled(this.api) ? H * 0.33 : H * 0.26;
    return THEME_IDS.map((id, i) => ({ id, x, y: y0 + i * (h + gap), w, h }));
  }

  private drawShop(W: number, H: number): void {
    this.drawAccountBar(W);
    drawLabel(this.ctx, this.copy.shopTitle, W / 2, H * 0.125, 24, "#fff7ad", "center");
    drawLabel(this.ctx, this.copy.adHint, W / 2, H * 0.15, 13, "#fffdf8", "center", "600");
    const ad = this.adCard(W, H);
    drawButton(this.ctx, ad.x, ad.y, ad.w, ad.h, this.copy.watchAd, "primary", this.art);
    if (stripeEnabled(this.api)) {
      for (const pack of this.packCards(W, H)) {
        const info = COIN_PACKS[pack.id];
        drawButton(
          this.ctx,
          pack.x,
          pack.y,
          pack.w,
          pack.h,
          `$${info.usd} · ${info.coins}`,
          "primary",
          this.art,
        );
      }
    }
    for (const card of this.shopCards(W, H)) {
      const owned = this.owned.includes(card.id);
      const equipped = this.theme === card.id;
      const pack = this.packs[card.id] ?? this.art;
      drawShopCard(this.ctx, card.x, card.y, card.w, card.h, equipped);
      [0, 2, 4].forEach((color, i) => {
        drawOrb(this.ctx, card.x + 36 + i * 28, card.y + card.h * 0.38, 13, color, {
          pulse: Math.sin(this.time * 4 + i),
          art: pack,
        });
      });
      drawLabel(this.ctx, this.themeName(card.id), card.x + 16, card.y + card.h * 0.68, 16, "#4a1b6b");
      drawLabel(this.ctx, this.themeHint(card.id), card.x + 16, card.y + card.h * 0.86, 11, "#6b2d86", "left", "700");
      const bw = 108;
      const bh = 40;
      const bx = card.x + card.w - bw - 14;
      const by = card.y + card.h / 2 - bh / 2;
      const label = equipped
        ? this.copy.equipped
        : owned
          ? this.copy.equip
          : `${this.copy.buy} ${THEME_PRICE[card.id]}`;
      drawButton(this.ctx, bx, by, bw, bh, label, equipped ? "primary" : owned ? "ghost" : "danger", this.art);
    }
    const bw = Math.min(280, W - 48);
    drawButton(this.ctx, (W - bw) / 2, H * 0.88, bw, 48, this.copy.back, "ghost", this.art);
  }

  private diffName(id: DiffId): string {
    if (id === "easy") return this.copy.diffEasy;
    if (id === "normal") return this.copy.diffNormal;
    if (id === "hard") return this.copy.diffHard;
    return this.copy.diffInsane;
  }

  private diffCards(W: number, H: number): { id: DiffId; x: number; y: number; w: number; h: number }[] {
    const gap = 16;
    const w = Math.min(300, (W - 48 - gap) / 2);
    const h = Math.min(124, H * 0.2);
    const x0 = (W - w * 2 - gap) / 2;
    const y0 = H * 0.28;
    return DIFFS.map((id, i) => ({
      id,
      x: x0 + (i % 2) * (w + gap),
      y: y0 + Math.floor(i / 2) * (h + gap),
      w,
      h,
    }));
  }

  private drawDiff(W: number, H: number): void {
    drawLabel(this.ctx, this.copy.diffTitle, W / 2, H * 0.13, 28, "#fff7ad", "center");
    drawLabel(this.ctx, this.copy.diffHint, W / 2, H * 0.19, 14, "#fffdf8", "center", "600");
    for (const card of this.diffCards(W, H)) {
      const rules = this.viewportRules(card.id);
      drawLevelCard(
        this.ctx,
        card.x,
        card.y,
        card.w,
        card.h,
        card.id,
        this.diffName(card.id),
        `${rules.rows}×${rules.cols}  ·  ${this.copy.next} ${rules.spawn}  ·  ${rules.line}+`,
        `${this.copy.best} ${this.bestBy[card.id]}`,
        this.rules.id === card.id,
        this.art,
      );
    }
    const bw = Math.min(280, W - 48);
    drawButton(this.ctx, (W - bw) / 2, H * 0.88, bw, 48, this.copy.back, "ghost", this.art);
  }

  private drawHow(W: number, H: number): void {
    const ctx = this.ctx;
    drawLabel(ctx, this.copy.howTitle, W / 2, H * 0.16, 28, "#fff7ad", "center");
    const steps = [this.copy.how1, this.copy.how2, this.copy.how3];
    steps.forEach((text, i) => {
      const y = H * 0.28 + i * 86;
      ctx.fillStyle = "rgba(255,252,245,0.86)";
      roundRect(ctx, 24, y, W - 48, 72, 22);
      ctx.fill();
      drawOrb(ctx, 64, y + 36, 18, [0, 2, 4][i], { pulse: Math.sin(this.time * 4 + i), art: this.art });
      drawLabel(ctx, text, 96, y + 36, 16, "#4a1b6b", "left", "700");
    });
    drawLabel(ctx, this.copy.howTip, W / 2, H * 0.7, 14, "#fffdf8", "center", "700");
    const bw = Math.min(320, W - 48);
    drawButton(ctx, (W - bw) / 2, H * 0.78, bw, 54, this.copy.gotIt, "primary", this.art);
  }

  private drawPlay(W: number, H: number): void {
    const ctx = this.ctx;
    const { tall, compact, pad, top, chipH, nextY, btnH, availTop, availBot } = this.playChrome(W, H);
    const chipW = (W - pad * 2 - 16) / 3;
    drawChip(ctx, pad, top, chipW, chipH, this.copy.score, String(this.score), "#1aa6c8");
    drawChip(ctx, pad + chipW + 8, top, chipW, chipH, this.copy.combo, this.combo ? `x${this.combo}` : "-", "#d946a6");
    drawChip(ctx, pad + (chipW + 8) * 2, top, chipW, chipH, this.copy.best, String(this.best), "#e2a400");

    drawLabel(ctx, this.copy.next, pad + 4, nextY + 14, 12, "rgba(255,255,255,0.5)");
    const upcoming = this.nextColors();
    upcoming.forEach((color, i) => {
      drawOrb(ctx, pad + 64 + i * (compact ? 28 : 34), nextY + 14, compact ? 10 : 12, color, {
        ghost: true,
        pulse: Math.sin(this.time * 4 + i),
        art: this.art,
      });
    });
    const meta = tall
      ? `${this.rules.rows}×${this.rules.cols} · ${this.coins} ${this.copy.coins}`
      : `${this.diffName(this.rules.id)} ${this.rules.rows}×${this.rules.cols}  ·  ${this.copy.coins} ${this.coins}`;
    drawLabel(ctx, meta, W - pad, nextY + 14, tall ? 12 : 13, "#fff7ad", "right", "700");

    const rows = this.rules.rows;
    const cols = this.rules.cols;
    const cell = Math.min((W - pad * 2) / cols, (availBot - availTop) / rows);
    const gridW = cell * cols;
    const gridH = cell * rows;
    const bx = (W - gridW) / 2;
    const by = availTop + (availBot - availTop - gridH) / 2;
    this.layout.board = { x: bx, y: by, cell };

    ctx.save();
    ctx.fillStyle = "rgba(42, 18, 80, 0.55)";
    roundRect(ctx, bx - 10, by - 10, gridW + 20, gridH + 20, 22);
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = "#7ef9ff";
    ctx.shadowColor = "#fff7ad";
    ctx.shadowBlur = 10;
    roundRect(ctx, bx - 8, by - 8, gridW + 16, gridH + 16, 20);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#fffdf8";
    roundRect(ctx, bx - 4, by - 4, gridW + 8, gridH + 8, 16);
    ctx.stroke();
    ctx.restore();

    const heat = hotCells(this.board, this.rules.line);
    let preview: Pos[] = [];
    const target =
      this.selected && this.hover && this.reach.has(`${this.hover.r},${this.hover.c}`) ? this.hover : null;
    if (this.selected && target) {
      preview = previewClear(this.board, this.selected, target, this.rules.line);
    }
    const previewSet = new Set(preview.map((p) => `${p.r},${p.c}`));

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = bx + c * cell;
        const y = by + r * cell;
        const key = `${r},${c}`;
        const aboutToPop = previewSet.has(key);
        const isTarget = target?.r === r && target?.c === c;
        const isPicked = this.selected?.r === r && this.selected?.c === c;
        const hop = isPicked || isTarget ? Math.abs(Math.sin(this.time * 12)) : 0;
        const inset = cell * 0.06;
        const tile = this.art ? ((r + c) % 2 === 0 ? this.art.cell : this.art.cellAlt) : null;
        ctx.save();
        ctx.translate(x + cell / 2, y + cell / 2 - hop * cell * 0.1);
        ctx.scale(1 + hop * 0.08, 1 - hop * 0.06);
        if (tile) {
          ctx.drawImage(tile, -cell / 2 + inset, -cell / 2 + inset, cell - inset * 2, cell - inset * 2);
        } else {
          ctx.fillStyle = (r + c) % 2 === 0 ? "#151c38" : "#0d1328";
          roundRect(ctx, -cell / 2 + inset, -cell / 2 + inset, cell - inset * 2, cell - inset * 2, 10);
          ctx.fill();
        }
        if (this.reach.has(key) || aboutToPop || heat.has(key)) {
          ctx.fillStyle = aboutToPop
            ? `rgba(255, 90, 120, ${0.38 + hop * 0.2})`
            : this.reach.has(key)
              ? "rgba(126,240,255,0.28)"
              : "rgba(255,229,102,0.26)";
          roundRect(ctx, -cell / 2 + inset, -cell / 2 + inset, cell - inset * 2, cell - inset * 2, 10);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    if (this.selected) {
      const pathEnd = this.hover && this.reach.has(`${this.hover.r},${this.hover.c}`) ? this.hover : null;
      if (pathEnd) {
        const path = findPath(this.board, this.selected, pathEnd);
        if (path) this.drawTrail(path.map((p) => this.cellCenter(p.r, p.c)));
      }
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cellData = this.board[r][c];
        const center = this.cellCenter(r, c);
        if (cellData.next !== null && cellData.color === null) {
          drawOrb(ctx, center.x, center.y, cell * 0.2, cellData.next, { ghost: true, art: this.art });
        }
        if (cellData.color !== null) {
          const clearing = this.anim?.kind === "clear" && this.anim.cells.some((p) => p.r === r && p.c === c);
          const growing = this.anim?.kind === "grow" && this.anim.cells.some((p) => p.r === r && p.c === c);
          const scale = clearing ? 1 - this.anim!.t : growing ? 0.42 + 0.58 * this.anim!.t : 1;
          const selected = this.selected?.r === r && this.selected?.c === c;
          const aboutToPop = previewSet.has(`${r},${c}`);
          const hop = selected ? 0.35 + Math.abs(Math.sin(this.time * 11)) : 0;
          drawOrb(ctx, center.x, center.y, cell * 0.36 * Math.max(0.05, scale), cellData.color, {
            selected: false,
            hot: aboutToPop || (heat.get(`${r},${c}`) ?? 0) >= 4,
            hop,
            pulse: aboutToPop ? 0.8 + Math.sin(this.time * 14) * 0.4 : Math.sin(this.time * 2 + r + c) * 0.2,
            art: this.art,
          });
        }
      }
    }

    if (this.anim?.kind === "move") {
      const path = this.anim.path;
      const u = this.anim.t * (path.length - 1);
      const i = Math.min(path.length - 2, Math.floor(u));
      const f = u - i;
      const a = this.cellCenter(path[i].r, path[i].c);
      const b = this.cellCenter(path[i + 1].r, path[i + 1].c);
      const x = a.x + (b.x - a.x) * f;
      const y = a.y + (b.y - a.y) * f;
      const remain = [{ x, y }, ...path.slice(i + 1).map((p) => this.cellCenter(p.r, p.c))];
      this.drawTrail(remain);
      const hop = Math.abs(Math.sin(this.anim.t * Math.PI * Math.max(2, path.length)));
      drawOrb(ctx, x, y, cell * 0.36, this.anim.color, {
        selected: true,
        hop,
        art: this.art,
      });
    }

    const gap = 10;
    const bw = (W - pad * 2 - gap * 2) / 3;
    const btnY = H - pad - btnH;
    drawButton(ctx, pad, btnY, bw, btnH, `${this.copy.hint} ${this.hintsLeft}`, "ghost", this.art);
    drawButton(ctx, pad + bw + gap, btnY, bw, btnH, this.copy.newGame, "ghost", this.art);
    drawButton(ctx, pad + (bw + gap) * 2, btnY, bw, btnH, this.copy.menu, "danger", this.art);

    if (preview.length) {
      drawLabel(ctx, this.copy.almost, W / 2, by - 16, 18, "#ff4d6d", "center");
      if (Math.random() < 0.25) {
        const p = preview[Math.floor(Math.random() * preview.length)];
        const c = this.cellCenter(p.r, p.c);
        this.fx.spark(c.x, c.y, "#ff4d6d");
      }
    }

    if (this.toastLife > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.toastLife * 2);
      drawLabel(ctx, this.toast, W / 2, by - 18, 15, "#fda4af", "center");
      ctx.restore();
    }

    if (this.over) this.drawOver(W, H);
  }

  private drawTrail(pts: { x: number; y: number }[]): void {
    drawMoveTrail(this.ctx, pts, this.time, this.layout.board.cell, this.art?.arrow ?? null);
  }

  private drawOver(W: number, H: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(4,6,16,0.72)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(255,252,245,0.94)";
    roundRect(ctx, 28, H * 0.28, W - 56, H * 0.48, 28);
    ctx.fill();
    drawLabel(ctx, this.copy.gameOver, W / 2, H * 0.36, 30, "#4a1b6b", "center");
    if (this.newBest) drawLabel(ctx, this.copy.newBest, W / 2, H * 0.43, 18, "#e2a400", "center");
    drawLabel(ctx, `${this.copy.finalScore}: ${this.score}`, W / 2, H * 0.5, 20, "#1aa6c8", "center");
    const bw = Math.min(280, W - 48);
    const bx = (W - bw) / 2;
    drawButton(ctx, bx, H * 0.62, bw, 52, this.copy.again, "primary", this.art);
    drawButton(ctx, bx, H * 0.62 + 62, bw, 46, this.copy.menu, "ghost", this.art);
  }

  private nextColors(): number[] {
    const colors: number[] = [];
    for (const row of this.board) {
      for (const cell of row) {
        if (cell.next !== null) colors.push(cell.next);
      }
    }
    return colors;
  }
}
