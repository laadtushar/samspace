"use client";

/**
 * Follow links.
 *
 * Deliberately plain anchors rather than an embedded feed. Instagram's own
 * embed needs a third-party script that reports every visitor to Meta, and on a
 * site where someone is reading about their own mental health that is not a
 * reasonable thing to add for decoration. A link costs nobody anything until
 * they choose to click it.
 *
 * The marks are inline SVG because lucide-react no longer ships brand icons.
 * They are drawn in the same outline weight as the rest of the site's icons.
 *
 * `rel="me"` asserts that these profiles and this site are the same person,
 * which is what search engines read to connect them.
 */

function InstagramMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-[18px] h-[18px]"
      aria-hidden="true"
    >
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function LinkedInMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-[18px] h-[18px]"
      aria-hidden="true"
    >
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4V9h4v1.2" />
      <rect x="2" y="9" width="4" height="12" rx="1" />
      <circle cx="4" cy="4.5" r="2" />
    </svg>
  );
}

export default function SocialLinks({
  instagram,
  linkedin,
  tone = "dark",
  className = "",
}: {
  instagram?: string;
  linkedin?: string;
  /** "dark" sits on the forest footer and contact band; "light" on cream. */
  tone?: "dark" | "light";
  className?: string;
}) {
  const links = [
    { href: instagram, label: "Instagram", Mark: InstagramMark },
    { href: linkedin, label: "LinkedIn", Mark: LinkedInMark },
  ].filter((l): l is { href: string; label: string; Mark: () => JSX.Element } =>
    Boolean(l.href)
  );

  if (links.length === 0) return null;

  const styles =
    tone === "dark"
      ? "border-cream/15 text-cream/50 hover:text-cream/90 hover:border-cream/35"
      : "border-sage/25 text-forest/50 hover:text-clay hover:border-clay/40";

  return (
    <div className={`flex items-center justify-center gap-3 ${className}`}>
      {links.map(({ href, label, Mark }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="me noopener noreferrer"
          aria-label={`${label} — opens in a new tab`}
          title={label}
          className={`w-10 h-10 rounded-full border flex items-center justify-center transition-colors duration-200 ${styles}`}
        >
          <Mark />
        </a>
      ))}
    </div>
  );
}
