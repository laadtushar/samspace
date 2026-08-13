import { sql, dbConfigured } from "@/lib/db";
import type { IntakeSubmission } from "@/lib/content";

/**
 * Client and submission records.
 *
 * A submission is what someone wrote on one day and is never edited. A client
 * is who they are now — status, agreed rate, contact details that change.
 * Keeping them apart means correcting a phone number does not rewrite history,
 * and a second enquiry from the same person does not create a second client.
 */

export interface ClientRow {
  id: string;
  name: string;
  email: string;
  whatsapp: string | null;
  gender: string | null;
  age: number | null;
  education: string | null;
  preferred_language: string | null;
  status: "enquiry" | "active" | "paused" | "ended";
  agreed_rate: string | null;
  student_rate: boolean;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  submission_count?: number;
}

export const CLIENT_STATUSES = ["enquiry", "active", "paused", "ended"] as const;

/** Age arrives from the form as a string; the column is an integer. */
function ageToInt(age: string): number | null {
  const n = parseInt(age, 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Records a submission and attaches it to a client, creating one if this email
 * is new. Returns the client id.
 *
 * Matching on lowercased email is what stops a returning enquirer becoming a
 * duplicate record. Their details are refreshed from the newer submission,
 * since the more recent answer is the more likely one to be current — but
 * status and agreed rate are left alone, because those are decisions the
 * practitioner made rather than anything a form can know.
 */
export async function recordSubmission(
  submission: IntakeSubmission
): Promise<string> {
  const db = sql();
  const email = submission.email.trim();

  const existing = (await db`
    select id from clients where lower(email) = lower(${email}) limit 1
  `) as { id: string }[];

  let clientId: string;

  if (existing.length > 0) {
    clientId = existing[0].id;
    await db`
      update clients set
        name               = ${submission.name},
        whatsapp           = ${submission.whatsapp || null},
        gender             = ${submission.gender || null},
        age                = ${ageToInt(submission.age)},
        education          = ${submission.education || null},
        preferred_language = ${submission.preferredLanguage || null},
        updated_at         = now()
      where id = ${clientId}
    `;
  } else {
    const created = (await db`
      insert into clients (
        name, email, whatsapp, gender, age, education, preferred_language,
        student_rate
      ) values (
        ${submission.name}, ${email}, ${submission.whatsapp || null},
        ${submission.gender || null}, ${ageToInt(submission.age)},
        ${submission.education || null}, ${submission.preferredLanguage || null},
        ${submission.studentConfirmed ?? false}
      )
      returning id
    `) as { id: string }[];
    clientId = created[0].id;
  }

  await db`
    insert into submissions (
      id, client_id, name, email, whatsapp, gender, age, education,
      preferred_language, concerns, sliding_scale, student_confirmed,
      scheduling, created_at
    ) values (
      ${submission.id}, ${clientId}, ${submission.name}, ${email},
      ${submission.whatsapp || null}, ${submission.gender || null},
      ${submission.age || null}, ${submission.education || null},
      ${submission.preferredLanguage || null}, ${submission.concerns || null},
      ${submission.slidingScale || null}, ${submission.studentConfirmed ?? false},
      ${submission.scheduling || null}, ${submission.timestamp}
    )
    on conflict (id) do nothing
  `;

  return clientId;
}

/**
 * Everyone the practice knows, newest enquiry first, with a count of how many
 * times they have been in touch. A second or third submission from the same
 * person is a signal worth seeing at a glance.
 */
export async function listClients(): Promise<ClientRow[]> {
  if (!dbConfigured()) return [];
  return (await sql()`
    select c.*, count(s.id)::int as submission_count
    from clients c
    left join submissions s on s.client_id = c.id
    group by c.id
    order by c.created_at desc
    limit 500
  `) as unknown as ClientRow[];
}

export interface SubmissionRow {
  id: string;
  concerns: string | null;
  sliding_scale: string | null;
  student_confirmed: boolean;
  scheduling: string | null;
  created_at: string;
}

/** What one person has written, most recent first. */
export async function clientSubmissions(
  clientId: string
): Promise<SubmissionRow[]> {
  if (!dbConfigured()) return [];
  return (await sql()`
    select id, concerns, sliding_scale, student_confirmed, scheduling, created_at
    from submissions
    where client_id = ${clientId}
    order by created_at desc
  `) as unknown as SubmissionRow[];
}

/**
 * Updates the fields a practitioner owns. Deliberately narrow: name, email and
 * the rest come from what the person submitted, and are refreshed from their
 * next submission — editing them here would be silently undone.
 *
 * Passing undefined leaves a field alone, so clearing a note takes an empty
 * string rather than an omission.
 */
export async function updateClient(
  id: string,
  fields: { status?: string; agreed_rate?: string; admin_note?: string }
): Promise<ClientRow | null> {
  if (fields.status && !CLIENT_STATUSES.includes(fields.status as never)) {
    throw new Error(`Unknown status: ${fields.status}`);
  }

  const rows = (await sql()`
    update clients set
      status      = coalesce(${fields.status ?? null}, status),
      agreed_rate = coalesce(${fields.agreed_rate ?? null}, agreed_rate),
      admin_note  = coalesce(${fields.admin_note ?? null}, admin_note),
      updated_at  = now()
    where id = ${id}
    returning *
  `) as unknown as ClientRow[];

  return rows[0] ?? null;
}

// ─── Sessions ──────────────────────────────────────

export const SESSION_STATUSES = [
  "scheduled",
  "completed",
  "cancelled",
  "no_show",
] as const;

export interface SessionRow {
  id: string;
  client_id: string;
  client_name?: string;
  starts_at: string;
  ends_at: string;
  status: (typeof SESSION_STATUSES)[number];
  rate_amount: number | null;
  paid: boolean;
  google_event_id: string | null;
  note: string | null;
}

/**
 * Raised when a booking would overlap one that already exists. Its own type so
 * the API can answer with the clash instead of a generic failure — "you already
 * have Asha then" is actionable; "could not book" is not.
 */
export class SessionClash extends Error {
  constructor(
    readonly clientName: string,
    readonly startsAt: string
  ) {
    super(`Overlaps an existing session with ${clientName}`);
    this.name = "SessionClash";
  }
}

/** Default length, matching what the site tells people a session is. */
export const SESSION_MINUTES = 50;

export async function createSession(input: {
  clientId: string;
  startsAt: string;
  minutes?: number;
  rateAmount?: number | null;
  note?: string | null;
}): Promise<SessionRow> {
  const start = new Date(input.startsAt);
  if (Number.isNaN(start.getTime())) {
    throw new Error("That is not a valid date and time");
  }
  // The end is derived rather than asked for: a session has a known length,
  // and two fields that can disagree is one more thing to get wrong.
  const end = new Date(
    start.getTime() + (input.minutes ?? SESSION_MINUTES) * 60_000
  );

  /*
    There is one practitioner, so two sessions at overlapping times is not a
    thing to record — it is a mistake to catch. Cancelled sessions are excluded,
    since a cancelled slot is exactly the one you would want to rebook.

    Overlap is "starts before the other ends, and ends after it starts", which
    also catches a session wholly inside another.
  */
  const clash = (await sql()`
    select s.id, s.starts_at, c.name as client_name
    from sessions s
    join clients c on c.id = s.client_id
    where s.status <> 'cancelled'
      and s.starts_at < ${end.toISOString()}
      and s.ends_at   > ${start.toISOString()}
    limit 1
  `) as unknown as { client_name: string; starts_at: string }[];

  if (clash.length > 0) {
    throw new SessionClash(clash[0].client_name, clash[0].starts_at);
  }

  const rows = (await sql()`
    insert into sessions (client_id, starts_at, ends_at, rate_amount, note)
    values (
      ${input.clientId}, ${start.toISOString()}, ${end.toISOString()},
      ${input.rateAmount ?? null}, ${input.note ?? null}
    )
    returning *
  `) as unknown as SessionRow[];

  return rows[0];
}

/**
 * Sessions around now — everything still to come, plus a short tail of recent
 * ones, so an attendance or a payment can be recorded after the fact instead of
 * vanishing the moment the session is over.
 */
export async function listSessions(): Promise<SessionRow[]> {
  if (!dbConfigured()) return [];
  return (await sql()`
    select s.*, c.name as client_name
    from sessions s
    join clients c on c.id = s.client_id
    where s.starts_at > now() - interval '30 days'
    order by s.starts_at asc
    limit 500
  `) as unknown as SessionRow[];
}

export async function clientSessions(clientId: string): Promise<SessionRow[]> {
  if (!dbConfigured()) return [];
  return (await sql()`
    select * from sessions where client_id = ${clientId}
    order by starts_at desc
  `) as unknown as SessionRow[];
}

export async function updateSession(
  id: string,
  fields: {
    status?: string;
    paid?: boolean;
    rate_amount?: number | null;
    note?: string;
  }
): Promise<SessionRow | null> {
  if (fields.status && !SESSION_STATUSES.includes(fields.status as never)) {
    throw new Error(`Unknown status: ${fields.status}`);
  }

  const rows = (await sql()`
    update sessions set
      status      = coalesce(${fields.status ?? null}, status),
      paid        = coalesce(${fields.paid ?? null}, paid),
      rate_amount = coalesce(${fields.rate_amount ?? null}, rate_amount),
      note        = coalesce(${fields.note ?? null}, note),
      updated_at  = now()
    where id = ${id}
    returning *
  `) as unknown as SessionRow[];

  return rows[0] ?? null;
}

export async function deleteSession(id: string): Promise<boolean> {
  const rows = (await sql()`
    delete from sessions where id = ${id} returning id
  `) as unknown as { id: string }[];
  return rows.length > 0;
}

/**
 * Every submission, newest first, in the shape the dashboard already renders.
 *
 * This exists so the submissions view can read the database rather than blob
 * storage. Two places holding the same records is two places to disagree, and
 * the one that new writes go to should be the one the screen shows.
 */
export interface DashboardSubmission {
  id: string;
  timestamp: string;
  name: string;
  email: string;
  gender: string;
  age: string;
  whatsapp: string;
  education: string;
  preferredLanguage: string;
  concerns: string;
  slidingScale: string;
  studentConfirmed: boolean;
  scheduling: string;
  clientId: string | null;
}

export async function listSubmissionsForDashboard(): Promise<
  DashboardSubmission[]
> {
  if (!dbConfigured()) return [];
  const rows = (await sql()`
    select id, client_id, name, email, gender, age, whatsapp, education,
           preferred_language, concerns, sliding_scale, student_confirmed,
           scheduling, created_at
    from submissions
    order by created_at desc
    limit 1000
  `) as unknown as Record<string, unknown>[];

  return rows.map((r) => ({
    id: String(r.id),
    timestamp: new Date(r.created_at as string).toISOString(),
    name: (r.name as string) ?? "",
    email: (r.email as string) ?? "",
    gender: (r.gender as string) ?? "",
    age: r.age == null ? "" : String(r.age),
    whatsapp: (r.whatsapp as string) ?? "",
    education: (r.education as string) ?? "",
    preferredLanguage: (r.preferred_language as string) ?? "",
    concerns: (r.concerns as string) ?? "",
    slidingScale: (r.sliding_scale as string) ?? "",
    studentConfirmed: Boolean(r.student_confirmed),
    scheduling: (r.scheduling as string) ?? "",
    clientId: r.client_id ? String(r.client_id) : null,
  }));
}

/** Removes a submission from the database. */
export async function deleteSubmissionRow(id: string): Promise<boolean> {
  const rows = (await sql()`
    delete from submissions where id = ${id} returning id
  `) as unknown as { id: string }[];
  return rows.length > 0;
}
