import Stripe from "stripe";
import { COIN_PACKS, isPackId } from "../src/store";

export async function POST(req: Request): Promise<Response> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return Response.json({ error: "stripe_unconfigured" }, { status: 503 });

  let body: { pack?: string; buyerId?: string } = {};
  try {
    body = (await req.json()) as { pack?: string; buyerId?: string };
  } catch {
    return Response.json({ error: "bad_json" }, { status: 400 });
  }

  if (!isPackId(body.pack) || !body.buyerId) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const pack = COIN_PACKS[body.pack];
  const origin = req.headers.get("origin") || new URL(req.url).origin;
  const stripe = new Stripe(key);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: pack.cents,
            product_data: { name: `ORB RUSH ${pack.coins} xu` },
          },
        },
      ],
      metadata: { pack: pack.id, buyerId: body.buyerId, coins: String(pack.coins) },
      client_reference_id: body.buyerId,
      success_url: `${origin}/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?stripe=cancel`,
    });
    if (!session.url) return Response.json({ error: "no_url" }, { status: 500 });
    return Response.json({ url: session.url });
  } catch {
    return Response.json({ error: "stripe_failed" }, { status: 502 });
  }
}
