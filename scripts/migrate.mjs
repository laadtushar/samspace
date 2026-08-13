#!/usr/bin/env node
/**
 * Applies database migrations at deploy time.
 *
 * This runs as the first step of the build rather than from a button in the
 * dashboard. Schema changes belong to a deployment, not to the person running
 * the practice: that dashboard is used by a therapist, for whom "create tables"
 * is at best meaningless, and putting schema control behind the same shared
 * password as the client list widens what that password can do.
 *
 * A failure here fails the build, which is the correct outcome — code whose
 * schema was never applied should not ship, and Vercel keeps serving the last
 * good deployment in the meantime.
 *
 * With no DATABASE_URL it exits quietly, so local builds, CI and a fresh clone
 * are unaffected.
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import pg from "pg";

const MIGRATIONS_DIR = path.join(process.cwd(), "db", "migrations");

/**
 * Splits a migration into statements.
 *
 * Semicolons inside quoted strings and dollar-quoted bodies are not statement
 * boundaries; treating them as such would cut a function definition in half and
 * apply the fragment to a live database.
 */
export function splitStatements(text) {
  const statements = [];
  let current = "";
  let inSingle = false;
  let inDollar = null;
  let inLineComment = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inLineComment) {
      current += ch;
      if (ch === "\n") inLineComment = false;
      continue;
    }
    if (!inSingle && !inDollar && ch === "-" && next === "-") {
      inLineComment = true;
      current += ch;
      continue;
    }
    if (!inDollar && ch === "'") {
      inSingle = !inSingle;
      current += ch;
      continue;
    }
    if (!inSingle && ch === "$") {
      const tag = /^\$[A-Za-z_]*\$/.exec(text.slice(i));
      if (tag) {
        if (inDollar === null) inDollar = tag[0];
        else if (inDollar === tag[0]) inDollar = null;
        current += tag[0];
        i += tag[0].length - 1;
        continue;
      }
    }
    if (ch === ";" && !inSingle && !inDollar) {
      if (current.trim()) statements.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }

  if (current.trim()) statements.push(current.trim());
  // Drop fragments that are only comments — they are not runnable statements.
  return statements.filter((s) => !/^(--[^\n]*\n?)*$/.test(s));
}

/**
 * Neon's HTTP driver cannot talk to a plain Postgres, so migrations would only
 * ever be runnable against production. Choosing by host means the same runner
 * applies the same files to a local database, which is the only way to find out
 * whether the SQL is correct before it reaches real records.
 */
function connect(connectionString) {
  const isNeon = (() => {
    try {
      return new URL(connectionString).hostname.endsWith(".neon.tech");
    } catch {
      return false;
    }
  })();

  if (isNeon) {
    const sql = neon(connectionString);
    return { sql, end: async () => {} };
  }

  const pool = new pg.Pool({ connectionString });
  const tagged = async (strings, ...values) => {
    const text = strings.reduce(
      (acc, part, i) => acc + part + (i < values.length ? `$${i + 1}` : ""),
      ""
    );
    return (await pool.query(text, values)).rows;
  };
  tagged.query = async (text, params = []) => (await pool.query(text, params)).rows;
  return { sql: tagged, end: () => pool.end() };
}

export async function migrate(connectionString) {
  const { sql, end } = connect(connectionString);
  try {

  await sql`
    create table if not exists _migrations (
      name       text primary key,
      applied_at timestamptz not null default now()
    )
  `;

  const done = new Set(
    (await sql`select name from _migrations`).map((r) => r.name)
  );

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const applied = [];
  for (const file of files) {
    if (done.has(file)) continue;
    const text = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    // The HTTP driver sends one statement per request, so the file is split
    // rather than sent whole.
    for (const statement of splitStatements(text)) {
      await sql.query(statement);
    }
    await sql`insert into _migrations (name) values (${file})`;
    applied.push(file);
    console.log(`  applied ${file}`);
  }
    return { applied, total: files.length };
  } finally {
    await end();
  }
}

// Only runs when invoked directly, so tests can import the splitter.
if (import.meta.url === `file://${process.argv[1]}`) {
  const url =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED;

  if (!url) {
    console.log("migrate: no DATABASE_URL — skipping (expected locally)");
    process.exit(0);
  }

  try {
    const { applied, total } = await migrate(url);
    console.log(
      applied.length
        ? `migrate: applied ${applied.length} of ${total}`
        : `migrate: up to date (${total} migrations)`
    );
  } catch (error) {
    console.error("migrate: FAILED —", error?.message ?? error);
    process.exit(1);
  }
}
