import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { getCachedPublishedPosts } from "@/lib/blog";
import { contentUpdatedAt } from "@/lib/content";
import { AUTHOR } from "@/lib/author";

/** The last time the shipped homepage copy changed in code. */
const HOME_LAST_EDITED = "2026-09-14";

export const revalidate = 3600;

/** The later of two dates, ignoring a missing one. */
function latest(a: Date, b: Date | null): Date {
  return b && b > a ? b : a;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // lastmod is the one sitemap field Google uses, and only while it stays
  // accurate, so each entry carries a date tied to a real edit rather than a
  // build timestamp. The homepage and the author page read the dashboard's
  // copy, so they move when it is saved there; HOME_LAST_EDITED covers changes
  // to the shipped copy in code. changefreq and priority are kept for engines
  // that read them; Google ignores both.
  const [posts, copySaved] = await Promise.all([
    getCachedPublishedPosts().catch(() => []),
    contentUpdatedAt(),
  ]);
  const pagesEdited = latest(new Date(HOME_LAST_EDITED), copySaved);
  const newestPost = posts[0]?.updatedAt;

  return [
    {
      url: SITE_URL,
      lastModified: pagesEdited,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      // The author page: who is behind every post, and her credentials.
      url: `${SITE_URL}${AUTHOR.path}`,
      lastModified: pagesEdited,
      changeFrequency: "yearly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/blog`,
      lastModified: newestPost ? new Date(newestPost) : new Date(HOME_LAST_EDITED),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...posts.map((post) => ({
      url: `${SITE_URL}/blog/${post.slug}`,
      lastModified: new Date(post.updatedAt || post.publishedAt),
      changeFrequency: "yearly" as const,
      priority: 0.7,
    })),
  ];
}
