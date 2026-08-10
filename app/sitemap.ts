import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { getPublishedPosts } from "@/lib/blog";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // A build timestamp would tell crawlers the content changed on every
  // unrelated redeploy, so each entry carries a date tied to real edits.
  const posts = await getPublishedPosts().catch(() => []);
  const newestPost = posts[0]?.updatedAt;

  return [
    {
      url: SITE_URL,
      lastModified: new Date("2026-08-10"),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/blog`,
      lastModified: newestPost ? new Date(newestPost) : new Date("2026-08-10"),
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
