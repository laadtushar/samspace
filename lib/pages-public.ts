import { fillDeep, rateValues, type TokenDoc } from "@/lib/tokens";
import type { Page } from "@/lib/page-format";

/**
 * Pages on their way to a reader, with tokens filled in.
 *
 * The same resolution posts get (lib/posts-public.ts), from the same
 * functions, so {{rate.range}} means exactly the same thing on a page as in a
 * post. Pages also understand {{session.length}}: a landing page says how long
 * a session runs, and that is a dashboard setting — typing it into the page
 * would be the drift the hero, the session card and the FAQ already went
 * through before it became one field.
 *
 * Kept to pages for now rather than added to every post: posts resolve through
 * publicPosts(), which every public route calls with the rates alone, and a
 * token the editor offers but the archive leaves as braces is worse than one
 * that is not offered.
 */

/** Tokens a page can use on top of the rate tokens. */
export const PAGE_TOKENS: TokenDoc[] = [
  { token: "{{session.length}}", describes: "How long a session runs, e.g. 45–50 minutes" },
];

/** The lookup a page resolves against. */
export function pageValues(content: {
  slidingScale: readonly string[];
  sessionLength?: string;
}): Record<string, string> {
  const values = rateValues(content.slidingScale);
  // Left unresolved when blank, like any token with nothing behind it: visible
  // braces are a mistake someone can see, an empty gap is not.
  const length = content.sessionLength?.trim();
  if (length) values["session.length"] = length;
  return values;
}

/** One page, ready for a reader. The dashboard keeps reading it unresolved. */
export function publicPage<T extends Pick<Page, "title">>(
  page: T,
  content: { slidingScale: readonly string[]; sessionLength?: string }
): T {
  return fillDeep(page, pageValues(content));
}
