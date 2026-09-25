export type PackId = "usd1" | "usd2" | "usd5";

export type CoinPack = {
  id: PackId;
  usd: 1 | 2 | 5;
  cents: number;
  coins: number;
};

export const COIN_PACKS: Record<PackId, CoinPack> = {
  usd1: { id: "usd1", usd: 1, cents: 100, coins: 150 },
  usd2: { id: "usd2", usd: 2, cents: 200, coins: 350 },
  usd5: { id: "usd5", usd: 5, cents: 500, coins: 900 },
};

export const PACK_IDS: PackId[] = ["usd1", "usd2", "usd5"];

export function isPackId(value: string | undefined): value is PackId {
  return value === "usd1" || value === "usd2" || value === "usd5";
}
