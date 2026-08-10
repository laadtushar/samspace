/**
 * Sliding-window rate limiter.
 *
 * The public form endpoints send mail from a DKIM-signed domain to an
 * address the caller supplies. Unthrottled, that is an open relay: someone can
 * script it into a spam cannon, get the domain blacklisted, and bury real
 * client enquiries under the noise.
 *
 * State lives in the instance's memory, so on serverless the limit applies per
 * warm instance rather than globally. That is a real reduction in abuse rate,
 * not a hard ceiling — configure Vercel Firewall rate limiting on /api/* for
 * that, or swap this module's store for Upstash Redis if traffic warrants it.
 */

type Hit = { timestamps: number[] };

const buckets = new Map<string, Hit>();

/** Drops buckets nothing has touched inside the window, so memory stays bounded. */
function prune(now: number, windowMs: number) {
  for (const [key, hit] of buckets) {
    if (hit.timestamps.every((t) => now - t > windowMs)) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the caller may retry. Zero when allowed. */
  retryAfter: number;
}

export function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number }
): RateLimitResult {
  const now = Date.now();
  if (buckets.size > 5000) prune(now, windowMs);

  const hit = buckets.get(key) ?? { timestamps: [] };
  hit.timestamps = hit.timestamps.filter((t) => now - t < windowMs);

  if (hit.timestamps.length >= limit) {
    buckets.set(key, hit);
    const oldest = Math.min(...hit.timestamps);
    return {
      allowed: false,
      retryAfter: Math.ceil((windowMs - (now - oldest)) / 1000),
    };
  }

  hit.timestamps.push(now);
  buckets.set(key, hit);
  return { allowed: true, retryAfter: 0 };
}

/**
 * Best-effort client identity. `x-forwarded-for` is set by Vercel's proxy and
 * cannot be spoofed past it; the fallback only matters in local development.
 */
export function clientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Rejects cross-origin form posts. Browsers set Origin on same-origin POSTs
 * too, so a request that claims a different origin is not one of our forms.
 */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // non-browser callers (curl, health checks)
  const host = req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
