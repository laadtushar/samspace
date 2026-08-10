import { checkBotId } from "botid/server";

/**
 * Vercel BotID, wrapped so it can only ever remove traffic, never block it by
 * failing.
 *
 * `checkBotId()` throws when the classifier cannot run at all — off Vercel, in
 * local development, or when the project's OIDC option is disabled. Left
 * unwrapped that turns into a 500 on every form submission, which for this site
 * means nobody can reach a therapist.
 *
 * So a broken check fails open. That is safe here because it was never the only
 * defence: the same-origin check and the rate limiter still apply, and both run
 * regardless of environment. A check that runs and says "bot" is still obeyed.
 */
export async function isLikelyBot(): Promise<boolean> {
  try {
    const { isBot } = await checkBotId();
    return isBot;
  } catch (error) {
    // Logged rather than swallowed: if this fires in production it means BotID
    // is misconfigured and is silently protecting nothing.
    console.warn("[botid] check unavailable — allowing request", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return false;
  }
}
