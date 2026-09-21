import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { dbConfigured } from "@/lib/db";
import { allRates, saveRate, deleteRate, rateProblem } from "@/lib/fx-store";
import { log, errorFields } from "@/lib/log";

export const dynamic = "force-dynamic";

/**
 * The rates the practice quotes converted prices with.
 *
 * There is no feed. These are set here, which is why the endpoint exists at
 * all — and it means a currency is shown to visitors only once someone has
 * decided what it should say.
 */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  if (!dbConfigured()) {
    return NextResponse.json(
      { error: "Rate storage is not configured." },
      { status: 503 }
    );
  }

  return NextResponse.json({ rates: await allRates() });
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Upper-cased here rather than demanded of whoever is typing: "usd" is not a
  // mistake worth an error message.
  const currency =
    typeof body.currency === "string" ? body.currency.trim().toUpperCase() : "";
  const perRupee =
    typeof body.perRupee === "number"
      ? body.perRupee
      : Number(String(body.perRupee ?? "").trim());

  const problem = rateProblem(currency, perRupee);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  try {
    await saveRate(currency, perRupee, "manual");
  } catch (error) {
    log.error("rates.save_failed", { currency, ...errorFields(error) });
    return NextResponse.json(
      { error: "Could not save that rate." },
      { status: 500 }
    );
  }

  log.info("rates.saved", { currency });
  return NextResponse.json({ rates: await allRates() });
}

/** Removes a rate, so that currency goes back to being quoted in rupees. */
export async function DELETE(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const currency = (new URL(req.url).searchParams.get("currency") ?? "")
    .trim()
    .toUpperCase();
  if (!currency) {
    return NextResponse.json({ error: "Missing currency" }, { status: 400 });
  }

  try {
    const removed = await deleteRate(currency);
    if (!removed) {
      return NextResponse.json(
        { error: "No rate for that currency" },
        { status: 404 }
      );
    }
  } catch (error) {
    log.error("rates.delete_failed", { currency, ...errorFields(error) });
    return NextResponse.json(
      { error: "Could not remove that rate." },
      { status: 500 }
    );
  }

  log.info("rates.deleted", { currency });
  return NextResponse.json({ rates: await allRates() });
}
