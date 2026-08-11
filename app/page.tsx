import { getContent, toPublicContent } from "@/lib/content";
import { SITE_URL, serializeJsonLd } from "@/lib/site";
import HomePage from "@/components/HomePage";

export const revalidate = 60;

export default async function Home() {
  const content = await getContent();

  /*
    The FAQ structured data is built here rather than in the root layout, for
    two reasons. It has to describe the questions actually on the page — the
    layout used the hardcoded defaults, so the moment a question was edited in
    the dashboard the markup and the visible page disagreed, which is the exact
    mismatch Google treats as a violation. And it belongs only to the page that
    carries the FAQ; emitted from the layout it also appeared on the blog, which
    has none.
  */
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${SITE_URL}#faq`,
    mainEntity: content.faq.items
      .filter((item) => item.question.trim() && item.answer.trim())
      .map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
  };

  return (
    <>
      {faqJsonLd.mainEntity.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqJsonLd) }}
        />
      )}
      <HomePage content={toPublicContent(content)} />
    </>
  );
}
