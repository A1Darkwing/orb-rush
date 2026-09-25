import { inPlayables } from "./platform";
import { PackId } from "./store";

type YtLike = ReturnType<typeof import("./platform").resolvePlatform>;

export function stripeEnabled(api: YtLike): boolean {
  return !inPlayables(api);
}

export async function startCheckout(pack: PackId, buyerId: string): Promise<string> {
  const res = await fetch("/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pack, buyerId }),
  });
  const data = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !data.url) throw new Error(data.error || "checkout");
  return data.url;
}

export async function claimCheckout(
  sessionId: string,
  buyerId: string,
): Promise<number> {
  const res = await fetch("/api/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, buyerId }),
  });
  const data = (await res.json()) as { coins?: number; error?: string };
  if (!res.ok || !data.coins) throw new Error(data.error || "claim");
  return data.coins;
}
