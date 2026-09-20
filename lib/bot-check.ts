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
 * Three modes, because two were not enough and the missing one mattered:
 *
 *   off      no client, no check, nothing logged. The default.
 *   observe  client mounted, verdicts recorded, nothing blocked.
 *   enforce  client mounted, verdicts acted on.
 *
 * The client and enforcement used to be the same switch, which made the stated
 * plan — "watch the logs, then enforce" — impossible to carry out. BotID
 * classifies from a signal the client-side script collects, so with the script
 * unmounted every submission is a bot: production logged `isBot: true` against a
 * real intake, alongside Vercel's own "Possible misconfiguration" warning. The
 * only evidence available said enforce, and enforcing on that evidence would
 * have started turning real people away.
 *
 * So `observe` mounts the script without acting on anything. That is the state
 * to sit in until the logs are boring. And `off` does not call the classifier at
 * all, rather than recording a verdict that means nothing.
 */

export type BotIdMode = "off" | "observe" | "enforce";

/**
 * BOTID_MODE decides. BOTID_ENFORCE=true is still honoured as enforce, so a
 * deployment already carrying it does not quietly lose its protection.
 */
export function botIdMode(): BotIdMode {
  const mode = process.env.BOTID_MODE?.trim().toLowerCase();
  if (mode === "observe" || mode === "enforce" || mode === "off") return mode;
  if (process.env.BOTID_ENFORCE === "true") return "enforce";
  return "off";
}

/** True when the page should mount the client-side challenge. */
export function botIdClientMounted(): boolean {
  return botIdMode() !== "off";
}

export async function isLikelyBot(ref: string): Promise<boolean> {
  const mode = botIdMode();

  // Without the client there is no signal to classify, so the answer would be
  // "bot" every time. Not asking is more honest than recording that.
  if (mode === "off") return false;

  let verdict: boolean;
  try {
    verdict = (await checkBotId()).isBot;
  } catch (error) {
    // If this fires in production, BotID is misconfigured and protecting
    // nothing — most often the project's OIDC option is off.
    log.warn("botid.unavailable", { ref, ...errorFields(error) });
    return false;
  }

  log.info("botid.checked", { ref, isBot: verdict, mode });

  if (verdict && mode !== "enforce") {
    log.warn("botid.flagged_not_enforced", { ref });
    return false;
  }
  return verdict;
}
