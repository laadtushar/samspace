/**
 * "[To confirm: …]" placeholders: facts still waiting for the practitioner.
 *
 * Its own module because both kinds of writing use it. Pages (lib/page-format.ts)
 * and posts (lib/validation.ts) refuse to publish while one is left, and
 * page-format already imports validation for SLUG_PATTERN — keeping these here
 * means neither has to import the other back.
 */

/**
 * A fact still waiting for the practitioner, written into a draft.
 *
 * Square brackets so it is unmistakable on the page, bold so it cannot be read
 * past, and one fixed form so it can be found by machine: the API refuses to
 * publish a page or post that still contains one. A guess about payment or
 * confidentiality that looks finished is exactly what must not go live.
 */
export function toConfirm(what: string): string {
  return `**[To confirm: ${what}]**`;
}

/** Finds every [To confirm: …] placeholder, bold or not. */
export const PLACEHOLDER_PATTERN = /\[To confirm:[^\]]*\]/gi;

/** The placeholders still in a piece of text, as written. */
export function unconfirmedPlaceholders(text: string): string[] {
  return text.match(PLACEHOLDER_PATTERN) ?? [];
}

/** The message a publish is refused with, the same for pages and posts. */
export function placeholderRefusal(kind: "page" | "post"): string {
  return `This ${kind} still has [To confirm: …] placeholders. Replace them before publishing.`;
}
