interface TextRevealProps {
  text: string;
  className?: string;
  splitBy?: "word" | "character";
  delay?: number;
  staggerDelay?: number;
}

/**
 * A heading whose words rise out of a blur one after another.
 *
 * Pure markup: RevealObserver marks the wrapper when it scrolls into view and
 * the .reveal-words rules in motion.css play each word, each one
 * `staggerDelay` behind the last — the same 20px rise, 8px blur, 0.6s and
 * curve as the framer-motion version. The words are visible in the server HTML;
 * they are only hidden once the observer is running and about to reveal them.
 */
export default function TextReveal({
  text,
  className = "",
  splitBy = "word",
  delay = 0,
  staggerDelay = 0.04,
}: TextRevealProps) {
  const parts = splitBy === "word" ? text.split(" ") : text.split("");

  /*
    Each piece keeps the space that followed it, and the spaces are real text
    nodes rather than margins. That matters more than it looks: the previous
    version spaced the words with CSS, so the heading extracted as
    "Aspacetofeelseen" — and the workaround was a second, screen-reader-only
    copy of the whole string. Anything reading the page therefore saw every
    heading twice. One correctly-spaced copy serves both readers and crawlers.
  */
  return (
    <span className={`inline reveal-words ${className}`} data-reveal-margin="-60px">
      {parts.map((part, i) => (
        <span
          key={i}
          className="inline-block"
          // A plain longhand, not a custom property: a custom property on
          // every word made the page's first style pass measurably slower.
          style={{ animationDelay: `${+(delay + i * staggerDelay).toFixed(3)}s` }}
        >
          {part}
          {splitBy === "word" && i < parts.length - 1 ? " " : ""}
        </span>
      ))}
    </span>
  );
}
