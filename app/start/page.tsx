import type { Metadata } from "next";
import { getContent, toPublicContent } from "@/lib/content";
import { getPublishedPosts } from "@/lib/blog";
import StartPage from "@/components/StartPage";

export const revalidate = 60;

/**
 * Deliberately not indexed.
 *
 * This is a doorway for people arriving from a bio link, and its content is a
 * condensed copy of the homepage. Left indexable it would compete with the
 * homepage for the practice's own name while offering a reader less — which is
 * the definition of a thin doorway page. Links are still followed, so the pages
 * it points at keep the benefit. It is also kept out of the sitemap.
 */
export const metadata: Metadata = {
  title: "Start here — Samvriti.Space",
  description:
    "Book a session, read the writing, or send a message — everything in one place.",
  robots: { index: false, follow: true },
};

export default async function Start() {
  const [content, posts] = await Promise.all([
    getContent(),
    getPublishedPosts().catch(() => []),
  ]);

  return (
    <StartPage
      content={toPublicContent(content)}
      latestPost={posts[0] ?? null}
    />
  );
}
