import Stripe from "stripe";
import { COIN_PACKS, isPackId } from "../src/store";

export async function POST(req: Request): Promise<Response> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return Response.json({ error: "stripe_unconfigured" }, { status: 503 });

  let body: { sessionId?: string; buyerId?: string } = {};
  try {
    body = (await req.json()) as { sessionId?: string; buyerId?: string };
  } catch {
    return Response.json({ error: "bad_json" }, { status: 400 });
  }

  if (!body.sessionId || !body.buyerId) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const stripe = new Stripe(key);
  try {
    const session = await stripe.checkout.sessions.retrieve(body.sessionId);
    if (session.payment_status !== "paid") {
      return Response.json({ error: "unpaid" }, { status: 402 });
    }
    if (session.client_reference_id && session.client_reference_id !== body.buyerId) {
      return Response.json({ error: "buyer_mismatch" }, { status: 403 });
    }
    const packId = session.metadata?.pack;
    const pack = isPackId(packId) ? COIN_PACKS[packId] : null;
    const coins = pack?.coins ?? Number(session.metadata?.coins || 0);
    if (!coins) return Response.json({ error: "no_coins" }, { status: 400 });
    return Response.json({ coins, sessionId: session.id });
  } catch {
    return Response.json({ error: "stripe_failed" }, { status: 502 });
  }
}
