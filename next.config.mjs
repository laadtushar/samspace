import { withBotId } from "botid/next/config";

/** @type {import('next').NextConfig} */

// Applied to every response. Without these the admin dashboard — which renders
// mental-health records — can be framed by any site, and the browser is left to
// guess content types and leak full referrer URLs.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // The intake form embeds Calendly, so the site itself allows that one
        // frame source; nothing may frame us in return.
        source: "/:path*",
        headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }],
      },
      {
        // Nothing in the dashboard should ever be framed or indexed.
        source: "/admin/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "Cache-Control", value: "no-store, max-age=0" },
        ],
      },
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
    ];
  },
  /*
    No remotePatterns. Blog images are stored in Postgres and served from
    /media on this origin, which next/image optimises without being told about
    a host — one fewer place for an image to come from, and nothing to keep in
    step with a storage provider.
  */
};

// withBotId adds the proxy rewrites BotID needs to classify traffic.
export default withBotId(nextConfig);
