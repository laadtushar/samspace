import { getPublishedPosts } from "@/lib/blog";
import { SITE_URL, SITE_NAME } from "@/lib/site";

export const revalidate = 3600;

/** Escapes text for XML character data. */
function xml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const posts = await getPublishedPosts();
  const updated = posts[0]?.publishedAt || new Date().toISOString();

  const items = posts
    .map(
      (post) => `    <item>
      <title>${xml(post.title)}</title>
      <link>${SITE_URL}/blog/${xml(post.slug)}</link>
      <guid isPermaLink="true">${SITE_URL}/blog/${xml(post.slug)}</guid>
      <description>${xml(post.excerpt)}</description>
      <pubDate>${new Date(post.publishedAt || post.updatedAt).toUTCString()}</pubDate>
${post.tags.map((tag) => `      <category>${xml(tag)}</category>`).join("\n")}
    </item>`
    )
    .join("\n");

  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xml(SITE_NAME)} — Writing</title>
    <link>${SITE_URL}/blog</link>
    <description>Notes from a counselling psychologist on anxiety, academic stress, self-esteem and boundaries.</description>
    <language>en-IN</language>
    <lastBuildDate>${new Date(updated).toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/blog/rss.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

  return new Response(feed, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600",
    },
  });
}
