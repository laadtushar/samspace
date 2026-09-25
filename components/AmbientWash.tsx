/**
 * A slow wash of colour behind the hero.
 *
 * Three blurred fields in the site's own greens and clay drift on long,
 * offset loops. Plain CSS transforms, so it costs the compositor and nothing
 * else — no WebGL, no JavaScript, nothing to download. It stops entirely for
 * anyone whose device asks for reduced motion (globals.css).
 */
export default function AmbientWash() {
  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="ambient-blob ambient-a bg-sage/30" />
      <div className="ambient-blob ambient-b bg-clay/20" />
      <div className="ambient-blob ambient-c bg-forest/10" />
    </div>
  );
}
