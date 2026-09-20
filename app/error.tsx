"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * What a render failure looks like.
 *
 * There was no error boundary, so anything unhandled produced Next's default
 * page — a stack trace in development and a bare "Application error" in
 * production, with no way onward.
 *
 * This is a client component with no content read and no data fetch, on purpose:
 * it renders when something has already gone wrong, and anything it depends on
 * is another thing that can fail while it is trying to say so. The contact
 * details are the one thing worth reaching for here, and they are the thing most
 * likely to be unavailable — so it points at the routes instead of the values.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The digest is what ties this to a server log line. Without it a report of
    // "it broke" cannot be matched to anything.
    console.error("render failed", { digest: error.digest, message: error.message });
  }, [error]);

  return (
    <main className="bg-cream min-h-screen flex items-center">
      <div className="max-w-2xl mx-auto px-6 py-28 text-center">
        <h1 className="font-serif text-4xl sm:text-5xl text-forest mb-5">
          Something went wrong at our end
        </h1>
        <p className="font-sans text-base text-forest/65 leading-relaxed mb-10">
          Not something you did. Trying again usually works — and if it doesn&apos;t,
          the contact form is still the fastest way to reach Priyanka.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="font-sans text-sm font-medium bg-clay text-cream px-6 py-3 rounded-full hover:bg-clay-light transition-colors"
          >
            Try again
          </button>
          <Link
            href="/#contact"
            className="font-sans text-sm font-medium text-forest/80 hover:text-forest px-6 py-3 rounded-full border border-sage/40 hover:border-sage/70 transition-colors"
          >
            Send a message
          </Link>
        </div>

        {error.digest && (
          <p className="font-sans text-xs text-forest/35 mt-10">
            Reference: <code>{error.digest}</code>
          </p>
        )}
      </div>
    </main>
  );
}
