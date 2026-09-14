/**
 * A WhatsApp link that cannot be a phone number.
 *
 * The site used to store `wa.me/<number>`, which carries the number in the URL
 * itself. Routing it through a redirect kept it out of the markup but handed it
 * to anyone who followed the link, and it was in the shipped defaults besides —
 * in a public repository.
 *
 * A username or a Business short link identifies the account without naming the
 * number, so it is safe to put straight in an href. This refuses anything with
 * a phone number in it rather than trusting whoever fills the field to know the
 * difference: the rule belongs in the code, not in someone's memory.
 */

const HOSTS = ["wa.me", "whatsapp.com", "api.whatsapp.com"];

/** Seven or more digits in a row is a phone number, wherever it appears. */
const LOOKS_LIKE_A_NUMBER = /\d{7,}/;

/** A bare handle: letters, digits, dots, dashes and underscores. */
const HANDLE = /^[a-z0-9._-]{3,60}$/i;

/**
 * Normalises what was typed, or returns "".
 *
 * Accepts a full https link on WhatsApp's own hosts, or a bare handle which
 * becomes one. Returns "" for a link carrying a phone number, for any other
 * host, and for anything unparseable — all of which mean the same thing to
 * every caller: no WhatsApp link.
 */
export function safeWhatsappLink(value: unknown): string {
  if (typeof value !== "string") return "";
  const raw = value.trim();
  if (!raw) return "";

  // A handle on its own is the easiest thing to paste, and the safest.
  if (!raw.includes("/") && !raw.includes(":")) {
    const handle = raw.replace(/^@/, "");
    if (!HANDLE.test(handle) || LOOKS_LIKE_A_NUMBER.test(handle)) return "";
    return `https://wa.me/${handle}`;
  }

  // Parsed here rather than through safeExternalUrl: validation.ts imports this
  // module for the schema, and importing it back would be a cycle.
  let url: string;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:") return "";
    if (!HOSTS.some((h) => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`))) {
      return "";
    }
    url = parsed.toString();
  } catch {
    return "";
  }
  // The number can hide in the path (wa.me/919...) or a query (?phone=919...).
  if (LOOKS_LIKE_A_NUMBER.test(url)) return "";
  return url;
}

/** Why a value was refused, for the dashboard to show. */
export function whatsappLinkProblem(value: string): string {
  const raw = value.trim();
  if (!raw) return "";
  if (safeWhatsappLink(raw)) return "";
  if (LOOKS_LIKE_A_NUMBER.test(raw)) {
    return "That contains a phone number. Use your WhatsApp username or a Business short link (wa.me/message/…) so the number stays private.";
  }
  return "Use a WhatsApp username, or a link on wa.me.";
}
