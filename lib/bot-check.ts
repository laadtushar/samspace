import { checkBotId } from "botid/server";
import { log, errorFields } from "@/lib/log";

/**
 * Vercel BotID, wrapped so it can only ever remove traffic, never block it by
 * failing.
 *
 * `checkBotId()` throws when the classifier cannot run at all — off Vercel, in
 * local development, or when the project's OIDC option is disabled. Left
 * unwrapped that turns into a 500 on every form submission, which for this site
 * means nobody can reach a therapist.
 *
 * Enforcement is opt-in via BOTID_ENFORCE. Until this deployment has been
 * observed classifying real traffic correctly, a positive result is recorded
 * and allowed through rather than acted on: an unverified control must not be
 * the thing standing between a distressed person and a therapist. The other
 * defences — origin check, schema validation, rate limit — apply either way.
 * Set BOTID_ENFORCE=true once the logs show it behaving.
 */
export async function isLikelyBot(ref: string): Promise<boolean> {
  const enforcing = process.env.BOTID_ENFORCE === "true";

  let verdict: boolean;
  try {
    verdict = (await checkBotId()).isBot;
  } catch (error) {
    // If this fires in production, BotID is misconfigured and protecting
    // nothing — most often the project's OIDC option is off.
    log.warn("botid.unavailable", { ref, ...errorFields(error) });
    return false;
  }

  log.info("botid.checked", { ref, isBot: verdict, enforcing });

  if (verdict && !enforcing) {
    log.warn("botid.flagged_not_enforced", { ref });
    return false;
  }
  return verdict;
}
