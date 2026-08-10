import type { MetadataRoute } from "next";
import { SITE_URL, IS_PRODUCTION_SITE } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  // Preview and branch deployments must not be indexed, or they compete with
  // production for the same content.
  if (!IS_PRODUCTION_SITE) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
