/**
 * Booking providers.
 *
 * The site started with Calendly hardwired into four places: the schema's host
 * allowlist, the intake form's "is scheduling on" check, the query parameters
 * that make a booking page embeddable, and the postMessage that says a slot was
 * taken. Adding a second provider by editing all four is how one of them ends
 * up disagreeing with the others — a link the dashboard calls valid that the
 * form then refuses to show.
 *
 * So each provider is described once, here, and everything else reads from this
 * list. A third one is a new entry and nothing else.
 */

export interface SchedulingProvider {
  id: string;
  /** What to call it in the dashboard. */
  name: string;
  /** Hosts that belong to this provider; subdomains are matched too. */
  hosts: string[];
  /** An example link, shown while setting it up. */
  example: string;
  /**
   * Turns a booking link into one that can be framed.
   *
   * Mutates and returns the URL it is given, which is always a copy made by the
   * caller — a provider must never rewrite the stored link itself.
   */
  toEmbedUrl(url: URL, parentHostname: string): URL;
  /** Whether a message from this provider's frame means a slot was booked. */
  isBookingConfirmation(data: unknown): boolean;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

export const SCHEDULING_PROVIDERS: SchedulingProvider[] = [
  {
    id: "calendly",
    name: "Calendly",
    hosts: ["calendly.com"],
    example: "https://calendly.com/your-name/therapy-session",
    toEmbedUrl(url, parentHostname) {
      // Calendly refuses to frame for a domain it was not told about.
      url.searchParams.set("embed_domain", parentHostname);
      url.searchParams.set("embed_type", "Inline");
      url.searchParams.set("hide_gdpr_banner", "1");
      return url;
    },
    isBookingConfirmation(data) {
      return record(data)?.event === "calendly.event_scheduled";
    },
  },
  {
    id: "calid",
    name: "Cal ID",
    hosts: ["cal.id"],
    example: "https://cal.id/your-name/therapy-session",
    toEmbedUrl(url) {
      // Cal's booking page only behaves as an embed — and only emits the events
      // below — when it is told it is being embedded.
      url.searchParams.set("embed", "inline");
      url.searchParams.set("embedType", "inline");
      url.searchParams.set("layout", "month_view");
      return url;
    },
    isBookingConfirmation(data) {
      const message = record(data);
      if (!message || message.originator !== "CAL") return false;
      // bookingSuccessfulV2 supersedes bookingSuccessful; older deployments
      // still send the original, so both count.
      return (
        typeof message.type === "string" &&
        message.type.startsWith("bookingSuccessful")
      );
    },
  },
];

/** Every host any provider accepts — the allowlist the schema validates against. */
export const SCHEDULING_HOSTS: string[] = SCHEDULING_PROVIDERS.flatMap(
  (p) => p.hosts
);

function hostMatches(hostname: string, host: string): boolean {
  return hostname === host || hostname.endsWith(`.${host}`);
}

/**
 * Which provider a link belongs to, or null.
 *
 * Null covers every reason a link cannot be used — blank, unparseable, http,
 * or a host nobody here recognises — because each of those means the same thing
 * to every caller: no scheduling step.
 */
export function providerFor(link: unknown): SchedulingProvider | null {
  if (typeof link !== "string" || link.trim() === "") return null;
  let url: URL;
  try {
    url = new URL(link.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  return (
    SCHEDULING_PROVIDERS.find((p) =>
      p.hosts.some((h) => hostMatches(url.hostname, h))
    ) ?? null
  );
}

/** The framed form of a booking link, or "" if it cannot be framed. */
export function embedUrlFor(link: string, parentHostname: string): string {
  const provider = providerFor(link);
  if (!provider) return "";
  try {
    return provider.toEmbedUrl(new URL(link.trim()), parentHostname).toString();
  } catch {
    return "";
  }
}

/**
 * Whether a postMessage says the person just booked.
 *
 * The origin is checked against the provider the configured link belongs to, so
 * a frame from one provider cannot mark a booking made through another — and no
 * other site can mark one at all.
 */
export function isBookingConfirmation(
  link: string,
  origin: string,
  data: unknown
): boolean {
  const provider = providerFor(link);
  if (!provider) return false;

  let originHost: string;
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:") return false;
    originHost = url.hostname;
  } catch {
    return false;
  }
  if (!provider.hosts.some((h) => hostMatches(originHost, h))) return false;

  return provider.isBookingConfirmation(data);
}
