import { publicContent } from "@/lib/content";
import { publicPost } from "@/lib/posts-public";
import { publicPage } from "@/lib/pages-public";
import type { PreviewTarget } from "@/lib/preview";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PostArticle from "@/components/PostArticle";
import PageArticle from "@/components/PageArticle";
import PreviewBanner from "@/components/PreviewBanner";

/**
 * A draft rendered the way it will be once published, with the banner on top.
 *
 * Tokens are filled by the same functions the live routes use, so a preview
 * shows the figure {{rate.range}} will become rather than the braces — which is
 * the thing a reviewer most needs to check.
 */
export default async function PreviewDocument({
  target,
  mode,
  expiresAt,
}: {
  target: PreviewTarget;
  mode: "admin" | "link";
  expiresAt?: string;
}) {
  const content = await publicContent();
  const status = target.kind === "page" ? target.page.status : target.post.status;

  return (
    <>
      <Navbar />
      <main className="bg-cream min-h-screen">
        {target.kind === "page" ? (
          <PageArticle page={publicPage(target.page, content)} />
        ) : (
          <PostArticle post={publicPost(target.post, content.slidingScale)} />
        )}
      </main>
      <Footer
        instagram={content.social?.instagram}
        linkedin={content.social?.linkedin}
      />
      {/* Room for the banner, so it never sits over the last of the footer. */}
      <div aria-hidden className="h-20 bg-forest-deep" />
      <PreviewBanner mode={mode} status={status} expiresAt={expiresAt} />
    </>
  );
}
