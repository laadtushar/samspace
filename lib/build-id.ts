/**
 * Something that changes when the code does.
 *
 * Cached reads are keyed by a constant, which means an entry written by one
 * deployment is still served by the next. That is fine while only the stored
 * values change — but the moment a deployment adds a field to site content, the
 * cache goes on serving an object shaped by the old code, and the new field is
 * simply missing from the live site until the hour runs out.
 *
 * That is not hypothetical: the intake form's copy was added, deployed, and did
 * not appear, because a cache entry written before it existed was still warm.
 *
 * Including this in the cache key scopes every entry to the build that wrote
 * it. A deployment starts with a cold cache and pays one read per cached
 * function — against a free tier of ten thousand, that is not a cost worth
 * weighing against serving the wrong shape.
 */
export const BUILD_ID =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.VERCEL_DEPLOYMENT_ID ||
  // Local and test runs have neither, and want a stable key so repeated runs
  // in one process share a cache rather than growing one entry per call.
  "dev";
