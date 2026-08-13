import { neon } from "@neondatabase/serverless";

/**
 * Postgres access.
 *
 * Neon's serverless driver speaks HTTP rather than holding a TCP connection,
 * which is what makes it usable from functions that start and stop constantly —
 * a pooled TCP client would exhaust connections under any real traffic.
 *
 * The connection string comes from the Vercel integration, which sets
 * DATABASE_URL. The other names are accepted because different integrations
 * spell it differently, and a mismatch would present as "the database is
 * missing" rather than "the variable has another name".
 */

function connectionString(): string | undefined {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    undefined
  );
}

/**
 * Whether a database is configured at all.
 *
 * Callers use this to keep working without one — local development, a fresh
 * clone, CI. What must never happen is a write silently going nowhere, so
 * writers check this and fail loudly rather than pretending to succeed.
 */
export function dbConfigured(): boolean {
  return Boolean(connectionString());
}

let client: ReturnType<typeof neon> | null = null;

export function sql() {
  const url = connectionString();
  if (!url) {
    throw new Error(
      "No database configured — set DATABASE_URL (the Vercel Neon integration sets this)."
    );
  }
  // One client per lambda instance. The driver is stateless over HTTP, so
  // reusing it costs nothing and avoids re-parsing the URL on every query.
  if (!client) client = neon(url);
  return client;
}
