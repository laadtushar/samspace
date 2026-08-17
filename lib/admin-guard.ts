import { NextResponse } from "next/server";
import { currentAdmin, type AdminIdentity } from "@/lib/auth";

/**
 * One place every admin route checks. Duplicating the comparison across routes
 * is how a route eventually ships without it.
 *
 * Returns a 401 response when the caller has no valid session, or `null` when
 * the request may proceed.
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  if (await currentAdmin()) return null;
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/**
 * The same check, but hands back who is asking.
 *
 * Routes that record or restrict by person need the identity rather than a
 * yes/no, and fetching it twice would mean two session lookups per request.
 */
export async function adminOrDenied(): Promise<
  { identity: AdminIdentity; denied: null } | { identity: null; denied: NextResponse }
> {
  const identity = await currentAdmin();
  if (!identity) {
    return {
      identity: null,
      denied: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { identity, denied: null };
}

/**
 * Managing other administrators is an owner's job.
 *
 * A member who tries gets 403 rather than 401: they are signed in, and telling
 * them so is not a leak — they can see the dashboard either way.
 */
export async function ownerOrDenied(): Promise<
  { identity: AdminIdentity; denied: null } | { identity: null; denied: NextResponse }
> {
  const result = await adminOrDenied();
  if (result.denied) return result;
  if (result.identity.role !== "owner") {
    return {
      identity: null,
      denied: NextResponse.json(
        { error: "Only an owner can manage administrators." },
        { status: 403 }
      ),
    };
  }
  return result;
}
