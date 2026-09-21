import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { dbConfigured } from "@/lib/db";
import { refreshRates } from "@/app/api/cron/fx/route";
import { log, newRef, errorFields } from "@/lib/log";

export const dynamic = "force-dynamic";

/**
 * Fetch rates now, rather than waiting for tonight.
 *
 * The same function the scheduled run calls, so there is one behaviour to
 * reason about: rates set by hand are still left alone, and only currencies an
 * enabled country is quoted in are fetched. What this adds is the ability to
 * see the result immediately after enabling a country, instead of finding out
 * the next morning whether the provider carries its currency.
 */
export async function POST() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const ref = newRef();

  if (!dbConfigured()) {
    return NextResponse.json(
      { error: "Rate storage is not configured.", ref },
      { status: 503 }
    );
  }

  try {
    const result = await refreshRates(ref);
    if (!result.provider && result.stored === 0) {
      /*
        Not an error status: the request worked and the answer is that nothing
        was stored. Whether that is because no country is enabled or because
        no provider answered is what the message says, and in both cases the
        rates already stored are untouched.
      */
      return NextResponse.json({
        success: true,
        ref,
        ...result,
        message:
          "Nothing was fetched — either no country is enabled, or no rate provider answered. Any rates already stored are unchanged.",
      });
    }
    return NextResponse.json({ success: true, ref, ...result });
  } catch (error) {
    log.error("rates.refresh_failed", { ref, ...errorFields(error) });
    return NextResponse.json(
      { error: "Could not refresh rates.", ref },
      { status: 500 }
    );
  }
}
