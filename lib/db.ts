import { neon } from "@neondatabase/serverless";
import { Pool } from "pg";

/**
 * Postgres access.
 *
 * Two drivers, chosen by host. Against Neon, the serverless driver speaks HTTP
 * rather than holding a TCP connection, which is what makes it usable from
 * functions that start and stop constantly — a pooled TCP client would exhaust
 * connections under any real traffic. Against anything else, ordinary pg.
 *
 * The second path is not decoration: Neon's HTTP driver cannot talk to a plain
 * Postgres, so without it none of this could be run or tested anywhere except
 * production. It also means the practice is not locked to one provider.
 *
 * The connection string comes from the Vercel integration, which sets
 * DATABASE_URL. The other names are accepted because different integrations
 * spell it differently, and a mismatch would present as "the database is
 * missing" rather than "the variable has another name".
 */

export type Sql = ((
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<Record<string, unknown>[]>) & {
  query(
    text: string,
    params?: unknown[]
  ): Promise<Record<string, unknown>[]>;
};

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

function isNeon(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(".neon.tech");
  } catch {
    return false;
  }
}

/**
 * Wraps a pg Pool in the same shape the Neon driver exposes — a tagged template
 * returning rows, plus .query for text built elsewhere — so callers never need
 * to know which driver is underneath.
 */
function fromPool(pool: Pool): Sql {
  const tagged = (async (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => {
    const text = strings.reduce(
      (acc, part, i) => acc + part + (i < values.length ? `$${i + 1}` : ""),
      ""
    );
    const result = await pool.query(text, values as unknown[]);
    return result.rows;
  }) as Sql;

  tagged.query = async (text: string, params: unknown[] = []) =>
    (await pool.query(text, params)).rows;

  return tagged;
}

let client: Sql | null = null;

export function sql(): Sql {
  const url = connectionString();
  if (!url) {
    throw new Error(
      "No database configured — set DATABASE_URL (the Vercel Neon integration sets this)."
    );
  }
  // One client per process. Both drivers are safe to reuse, and rebuilding
  // either on every call would re-parse the URL and, for pg, open a new pool.
  if (!client) {
    client = isNeon(url) ? (neon(url) as unknown as Sql) : fromPool(new Pool({ connectionString: url }));
  }
  return client;
}

/** Testing seam: forces the next sql() call to reconnect. */
export function resetClient(): void {
  client = null;
}
