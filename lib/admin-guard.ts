import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";

/**
 * One place every admin route checks. Duplicating the comparison across routes
 * is how a route eventually ships without it.
 *
 * Returns a 401 response when the caller has no valid session, or `null` when
 * the request may proceed.
 */
export function requireAdmin(): NextResponse | null {
  if (isAuthenticated()) return null;
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
