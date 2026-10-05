/**
 * "How did you hear about us?" — the answers the intake form offers.
 *
 * Analytics can say which site sent a visitor, but not that a friend
 * recommended the practice, or that someone found it from a college notice
 * board. Only the person can say that, so the form asks.
 *
 * The key is what is stored; the label is what people read. Keys never change
 * once used, so old submissions keep meaning the same thing; labels can.
 */
export const REFERRAL_SOURCES = [
  { key: "instagram", label: "Instagram" },
  { key: "google", label: "Google search" },
  { key: "friend", label: "A friend or family member" },
  { key: "professional", label: "A doctor or therapist" },
  { key: "college", label: "College or university" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "blog", label: "Her blog" },
  { key: "ai", label: "ChatGPT or another AI" },
  { key: "other", label: "Somewhere else" },
] as const;

export type ReferralKey = (typeof REFERRAL_SOURCES)[number]["key"];

export const REFERRAL_KEYS = REFERRAL_SOURCES.map((s) => s.key) as [
  ReferralKey,
  ...ReferralKey[],
];

/** Longest free-text answer accepted alongside "Somewhere else". */
export const REFERRAL_DETAIL_MAX = 120;

/** The readable label for a stored key; the key itself if it is unknown. */
export function referralLabel(key: string | null | undefined): string {
  if (!key) return "";
  return REFERRAL_SOURCES.find((s) => s.key === key)?.label ?? key;
}

/** One line for the dashboard and the email: label, plus any detail given. */
export function describeReferral(
  key: string | null | undefined,
  detail: string | null | undefined
): string {
  const label = referralLabel(key);
  const extra = detail?.trim();
  if (!label) return extra ?? "";
  return extra ? `${label} — ${extra}` : label;
}
