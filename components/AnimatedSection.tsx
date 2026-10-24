import Reveal from "./Reveal";

interface Props {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

/**
 * A block that rises 40px and fades in as it scrolls into view.
 *
 * CSS now (see Reveal), with the same distance, duration, easing and trigger
 * point it had as a framer-motion component, and visible in the server HTML
 * rather than waiting at opacity 0 for JavaScript.
 */
export default function AnimatedSection({ children, className = "", delay = 0 }: Props) {
  return (
    <Reveal
      y={40}
      duration={0.7}
      ease="out"
      delay={delay}
      margin="-80px"
      className={className}
    >
      {children}
    </Reveal>
  );
}
