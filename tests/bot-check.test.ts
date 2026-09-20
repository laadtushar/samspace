import { describe, it, expect, afterAll, vi } from "vitest";

/**
 * Which state BotID is in, and in particular that "off" is the state a
 * deployment with nothing configured lands in.
 *
 * The mode decides two things at once — whether the client-side script is on the
 * page, and whether a verdict is acted on. They used to be the same switch, and
 * because the classifier has nothing to go on without the script, that meant the
 * only observation available was a false positive on every submission. Enforcing
 * on it would have turned real people away from a therapist's contact form.
 *
 * The module reads the environment when called rather than at import, so these
 * need no module reset — but the suite shares a process, so the environment is
 * put back.
 */
const KEYS = ["BOTID_MODE", "BOTID_ENFORCE"];
const original = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

const withEnv = (env: Record<string, string | undefined>) => {
  for (const key of KEYS) delete process.env[key];
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) process.env[key] = value;
  }
};

afterAll(() => {
  for (const key of KEYS) {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key];
  }
  vi.resetModules();
});

describe("which state BotID is in", () => {
  it("is off when nothing is configured", async () => {
    const { botIdMode, botIdClientMounted } = await import("@/lib/bot-check");
    withEnv({});
    expect(botIdMode()).toBe("off");
    expect(botIdClientMounted()).toBe(false);
  });

  it("mounts the client to observe, without acting on a verdict", async () => {
    const { botIdMode, botIdClientMounted } = await import("@/lib/bot-check");
    withEnv({ BOTID_MODE: "observe" });
    expect(botIdMode()).toBe("observe");
    // The whole point: the script is on the page while nothing is blocked.
    expect(botIdClientMounted()).toBe(true);
  });

  it("mounts the client when enforcing, never enforces without it", async () => {
    const { botIdMode, botIdClientMounted } = await import("@/lib/bot-check");
    for (const env of [{ BOTID_MODE: "enforce" }, { BOTID_ENFORCE: "true" }]) {
      withEnv(env);
      expect(botIdMode(), JSON.stringify(env)).toBe("enforce");
      expect(botIdClientMounted(), JSON.stringify(env)).toBe(true);
    }
  });

  it("reads the mode case- and space-insensitively", async () => {
    const { botIdMode } = await import("@/lib/bot-check");
    withEnv({ BOTID_MODE: " Enforce " });
    expect(botIdMode()).toBe("enforce");
  });

  it("falls back to off rather than guessing at a value it does not know", async () => {
    const { botIdMode } = await import("@/lib/bot-check");
    for (const value of ["true", "yes", "1", "on", "strict", ""]) {
      withEnv({ BOTID_MODE: value });
      expect(botIdMode(), value).toBe("off");
    }
  });

  it("classifies nothing while off, so no verdict is recorded", async () => {
    const { isLikelyBot } = await import("@/lib/bot-check");
    withEnv({});
    // Would throw off Vercel if it reached the classifier at all.
    await expect(isLikelyBot("test-ref")).resolves.toBe(false);
  });
});
