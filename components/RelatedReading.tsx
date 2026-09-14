"use client";

import Link from "next/link";
import { motion } from "framer-motion";

/**
 * A few posts, offered where someone is already deciding.
 *
 * The list comes from the posts that are actually published rather than from a
 * hardcoded set, for two reasons: a link to an unpublished slug is a 404 on the
 * homepage, and a hardcoded list goes stale the first time a post is renamed or
 * withdrawn. If nothing is published, nothing renders.
 */

export interface PostLink {
  slug: string;
  title: string;
  tags: string[];
}

export default function RelatedReading({
  posts,
  label = "Not sure if this applies to you?",
  className = "",
}: {
  posts: PostLink[];
  label?: string;
  className?: string;
}) {
  if (posts.length === 0) return null;

  return (
    <div className={className}>
      <p className="font-sans text-xs text-forest/45 mb-3">{label}</p>
      <ul className="flex flex-col gap-2">
        {posts.map((post, i) => (
          <motion.li
            key={post.slug}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
          >
            <Link
              href={`/blog/${post.slug}`}
              // Vertical padding so the link is a thumb-sized target rather
              // than a single line of small text.
              className="group inline-flex items-start gap-2 py-2 font-sans text-sm text-forest/70 hover:text-clay transition-colors"
            >
              <span aria-hidden="true" className="text-clay/60 mt-px">
                →
              </span>
              <span className="underline underline-offset-4 decoration-sage/40 group-hover:decoration-clay/60">
                {post.title}
              </span>
            </Link>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
