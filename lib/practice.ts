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
