import { SITE_NAME, SITE_URL, absoluteUrl } from "@/lib/site";
import { AUTHOR, AUTHOR_URL } from "@/lib/author";
import { publicContent, toPublicContent, type PublicSiteContent } from "@/lib/content";
import { getCachedPublishedPosts } from "@/lib/blog";
import { publicPosts } from "@/lib/posts-public";
import { isNextSignal } from "@/lib/next-signals";
import type { BlogPost } from "@/lib/blog-format";

/**
 * /llms.txt and /llms-full.txt: the site, described for a language model.
 *
 * The format is llmstxt.org's: an H1 with the name, a blockquote summary, plain
 * markdown detail, then H2 sections that are lists of links, the last of them
 * "Optional" for what an agent can skip. Nothing here is typed for the purpose.
 * The practice, the author and the posts are read from the same content, AUTHOR
 * and post rows the pages render, so this cannot describe a site that no longer
 * exists. It is built from public content only, which never carries the phone
 * number, and the crisis numbers are in it because an answer engine relaying
 * this practice should relay those too.
 *
 * The builders are pure, so they can be tested without a route or a database;
 * llmsSource is what the two routes hand them.
 */

type Post = Pick<
  BlogPost,
  "slug" | "title" | "excerpt" | "content" | "publishedAt" | "updatedAt" | "tags"
>;

export const LLMS_PATH = "/llms.txt";
export const LLMS_FULL_PATH = "/llms-full.txt";

/** One line, since a newline inside a list item ends the item. */
function line(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Link text cannot contain an unescaped bracket without ending the link early. */
function linkText(text: string): string {
  return line(text).replace(/([[\]])/g, "\\$1");
}

function link(text: string, href: string, note?: string): string {
  const item = `- [${linkText(text)}](${absoluteUrl(href)})`;
  return note ? `${item}: ${line(note)}` : item;
}

/** The calendar date of an ISO timestamp, or "" when there is none. */
function day(iso: string): string {
  return iso ? iso.slice(0, 10) : "";
}

function postUrl(post: Pick<Post, "slug">): string {
  return `${SITE_URL}/blog/${post.slug}`;
}

/** "published 2026-09-14, updated 2026-10-01", leaving out whatever is missing. */
function postDates(post: Post): string {
  const published = day(post.publishedAt);
  const updated = day(post.updatedAt);
  return [
    published && `published ${published}`,
    updated && updated !== published && `updated ${updated}`,
  ]
    .filter(Boolean)
    .join(", ");
}

/**
 * Who runs the practice, what it offers and what it costs, and where to go in a
 * crisis — everything above the first H2, shared by both files.
 */
function overview(content: PublicSiteContent): string[] {
  const services = content.services.items.map((item) => {
    const price = item.price ? `${item.price}${item.unit ?? ""}` : "";
    return `- ${[line(item.title), price, item.tags.join(", ")]
      .filter(Boolean)
      .join(" — ")}`;
  });

  const helplines = content.crisis.helplines.map(
    (h) => `- ${line(h.name)}: ${line(h.number)}${h.note ? ` (${line(h.note)})` : ""}`
  );

  return [
    `# ${SITE_NAME}`,
    "",
    `> ${line(content.hero.subtext)} ${AUTHOR.name}, ${AUTHOR.jobTitle}: ${line(AUTHOR.summary)}`,
    "",
    line(content.about.paragraph),
    "",
    `Sessions (${line(content.sessionLength)} each):`,
    ...services,
    ...(content.slidingScale.length > 0
      ? ["", `Sliding scale: ${content.slidingScale.map(line).join(", ")}.`]
      : []),
    "",
    `${line(content.issues.heading)}: ${content.issues.items.map(line).join("; ")}.`,
    "",
    ...(content.contact.email ? [`Email: ${content.contact.email}`, ""] : []),
    line(content.crisis.notice),
    ...helplines,
  ];
}

/** The /llms.txt index: the overview, then links to every page and post. */
export function llmsTxt(content: PublicSiteContent, posts: readonly Post[]): string {
  const social = [
    content.social.instagram && link("Instagram", content.social.instagram),
    content.social.linkedin && link(`${AUTHOR.name} on LinkedIn`, content.social.linkedin),
  ].filter((item): item is string => Boolean(item));

  return [
    ...overview(content),
    "",
    "## Start here",
    "",
    ...content.startPage.links.map((l) => link(l.label, l.href, l.description)),
    link(AUTHOR.name, AUTHOR_URL, `${AUTHOR.jobTitle}. ${AUTHOR.summary}`),
    link(content.faq.heading, "/#faq", content.faq.intro),
    "",
    // An empty section would read as a site with nothing written.
    ...(posts.length > 0
      ? [
          "## Writing",
          "",
          ...posts.map((post) => {
            const dates = postDates(post);
            return link(post.title, postUrl(post), `${post.excerpt}${dates ? ` (${dates})` : ""}`);
          }),
          "",
        ]
      : []),
    "## Optional",
    "",
    link("Full text of the writing and FAQ", LLMS_FULL_PATH),
    link("RSS feed", "/blog/rss.xml"),
    link("Sitemap", "/sitemap.xml"),
    ...social,
    "",
  ].join("\n");
}

/**
 * Demotes markdown headings so a post's own "##" sections sit under its title
 * rather than beside it. Fenced code is left alone.
 */
export function demoteHeadings(markdown: string, by: number): string {
  let fenced = false;
  return markdown
    .split("\n")
    .map((row) => {
      if (/^\s*(```|~~~)/.test(row)) fenced = !fenced;
      if (fenced) return row;
      return row.replace(/^(#{1,6})(?=\s)/, (hashes) =>
        "#".repeat(Math.min(6, hashes.length + by))
      );
    })
    .join("\n");
}

/** The /llms-full.txt companion: the same overview with the FAQ and every post in full. */
export function llmsFullTxt(content: PublicSiteContent, posts: readonly Post[]): string {
  const faq = content.faq.items.flatMap((item) => [
    `### ${line(item.question)}`,
    "",
    item.answer.trim(),
    "",
  ]);

  const firstSession = [
    `## ${line(content.sessionStructure.heading)}`,
    "",
    content.sessionStructure.intro.trim(),
    "",
    ...content.sessionStructure.steps.flatMap((step) => [
      `### ${line(step.title)}`,
      "",
      step.desc.trim(),
      "",
    ]),
  ];

  const mentoring = [
    `## ${line(content.mentoring.heading)}`,
    "",
    content.mentoring.subtext.trim(),
    "",
    `### ${line(content.mentoring.card1Title)}`,
    "",
    ...content.mentoring.card1Items.map((item) => `- ${line(item)}`),
    "",
    `### ${line(content.mentoring.card2Title)}`,
    "",
    ...content.mentoring.card2Items.map((item) => `- ${line(item)}`),
    "",
  ];

  const writing = posts.flatMap((post) => {
    const dates = postDates(post);
    return [
      `### ${line(post.title)}`,
      "",
      `URL: ${postUrl(post)}`,
      `By ${AUTHOR.name}, ${AUTHOR.jobTitle}${dates ? `; ${dates}` : ""}.`,
      ...(post.tags.length > 0 ? [`Topics: ${post.tags.map(line).join(", ")}`] : []),
      "",
      demoteHeadings(post.content.trim(), 2),
      "",
    ];
  });

  return [
    ...overview(content),
    "",
    `## ${line(content.faq.heading)}`,
    "",
    ...faq,
    ...firstSession,
    ...mentoring,
    ...(writing.length > 0 ? ["## Writing", "", ...writing] : []),
  ].join("\n");
}

/**
 * What both routes describe: public content and published posts, with pricing
 * tokens filled, so neither file can quote {{rate.range}} with the braces on.
 *
 * Posts fall back to none, as the sitemap's do. The practice, its prices and
 * the crisis numbers are still worth describing while the database is down;
 * a 500 describes nothing.
 */
export async function llmsSource() {
  const [content, stored] = await Promise.all([
    publicContent(),
    getCachedPublishedPosts().catch((error: unknown) => {
      if (isNextSignal(error)) throw error;
      return [];
    }),
  ]);
  return {
    content: toPublicContent(content),
    posts: publicPosts(stored, content.slidingScale),
  };
}

/**
 * A plain-text answer that stays out of search results.
 *
 * Agents fetch these files directly, so noindex costs them nothing, while a
 * search engine indexing them would be indexing a second copy of pages that
 * already have their own canonical URLs.
 */
export function llmsResponse(body: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600",
      "X-Robots-Tag": "noindex",
    },
  });
}
