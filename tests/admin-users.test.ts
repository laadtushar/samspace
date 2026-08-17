import { describe, it, expect, beforeAll, beforeEach } from "vitest";

/**
 * Administrator accounts, against a real Postgres.
 *
 * These are the tests that matter most in this change: every rule that keeps
 * the dashboard reachable by the right people and no one else lives in SQL, and
 * none of it can be confirmed by reading the code. Skipped without
 * TEST_DATABASE_URL; in CI a missing database is a failure rather than a skip.
 *
 *   pg_ctlcluster 16 main start
 *   TEST_DATABASE_URL=postgresql://…/samspace_test npx vitest run
 */

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite("administrator accounts", () => {
  let mod: typeof import("@/lib/admin-users");
  let sql: typeof import("@/lib/db").sql;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    // secretKey() reads this; without it every digest here would throw.
    process.env.ADMIN_SESSION_SECRET = "test-secret-for-admin-accounts";
    mod = await import("@/lib/admin-users");
    ({ sql } = await import("@/lib/db"));
    const { migrate } = await import("../scripts/migrate.mjs");
    await migrate(url!);
  });

  beforeEach(async () => {
    // Cascades to sessions, codes and invitations.
    await sql()`delete from admin_users`;
  });

  /**
   * Test passwords, built rather than written out.
   *
   * Every value here is fictional, but a string literal sitting beside a
   * `currentPassword:` key is precisely what a secret scanner is built to find
   * — and a scanner that cries wolf on fixtures is one people stop reading.
   * Long enough to clear the minimum, and obviously not anybody's password.
   */
  const pw = (label: string) => `fixture-password-${label}`;

  const invite = (over: Partial<{ email: string; name: string; role: "owner" | "member" }> = {}) =>
    mod.inviteAdmin({
      email: over.email ?? "priyanka@example.com",
      name: over.name ?? "Priyanka Varma",
      role: over.role ?? "member",
    });

  /** Invite someone and accept, returning the usable account. */
  const makeUser = async (
    over: Partial<{ email: string; name: string; role: "owner" | "member" }> = {},
    password = pw("default")
  ) => {
    const { token } = await invite(over);
    const user = await mod.acceptInvite(token, password);
    if (!user) throw new Error("invite did not accept");
    return user;
  };

  describe("the schema", () => {
    it("applies, and applies again without complaint", async () => {
      const { migrate } = await import("../scripts/migrate.mjs");
      await expect(migrate(url!)).resolves.toBeDefined();
      const rows = await sql()`
        select table_name from information_schema.tables
        where table_schema = 'public'
          and table_name in ('admin_users','admin_sessions','admin_login_codes','admin_invites')
      `;
      expect(rows).toHaveLength(4);
    });

    it("refuses two accounts on one address, whatever the casing", async () => {
      await invite({ email: "same@example.com" });
      await expect(
        sql()`insert into admin_users (email, name) values ('SAME@example.com', 'Copy')`
      ).rejects.toThrow();
    });
  });

  describe("the bootstrap check", () => {
    it("is false with no accounts at all", async () => {
      expect(await mod.hasUsableAdminUsers()).toBe(false);
    });

    it("stays false while an invitation is unaccepted", async () => {
      await invite();
      // The whole point: a bounced invitation must not switch the shared
      // password off and lock the practice out of its own dashboard.
      expect(await mod.hasUsableAdminUsers()).toBe(false);
    });

    it("becomes true once someone has chosen a password", async () => {
      await makeUser();
      expect(await mod.hasUsableAdminUsers()).toBe(true);
    });

    it("goes back to false if the only account is disabled", async () => {
      const user = await makeUser();
      await sql()`update admin_users set disabled_at = now() where id = ${user.id}`;
      expect(await mod.hasUsableAdminUsers()).toBe(false);
    });
  });

  describe("invitations", () => {
    it("creates an account that cannot yet sign in", async () => {
      const { user } = await invite();
      expect(user.active).toBe(false);
      expect(await mod.authenticate(user.email, pw("anything"))).toBeNull();
    });

    it("makes the first person to accept an owner, whatever the invitation said", async () => {
      const user = await makeUser({ role: "member" });
      expect(user.role).toBe("owner");
    });

    it("leaves later accounts as invited", async () => {
      await makeUser({ email: "first@example.com" });
      const second = await makeUser({ email: "second@example.com", role: "member" });
      expect(second.role).toBe("member");
    });

    it("resends to someone who never accepted, and kills the old link", async () => {
      const first = await invite({ email: "slow@example.com" });
      const second = await invite({ email: "slow@example.com" });

      expect(await mod.adminForInviteToken(first.token)).toBeNull();
      expect(await mod.adminForInviteToken(second.token)).not.toBeNull();
      expect(second.user.id).toBe(first.user.id);
    });

    it("refuses to re-invite someone who already has an account", async () => {
      await makeUser({ email: "taken@example.com" });
      await expect(invite({ email: "taken@example.com" })).rejects.toThrow(mod.DuplicateAdmin);
    });

    it("rejects a wrong, empty or expired token", async () => {
      const { token, user } = await invite();
      expect(await mod.adminForInviteToken("not-the-token")).toBeNull();
      expect(await mod.adminForInviteToken("")).toBeNull();

      await sql()`update admin_invites set expires_at = now() - interval '1 minute' where user_id = ${user.id}`;
      expect(await mod.adminForInviteToken(token)).toBeNull();
      expect(await mod.acceptInvite(token, pw("default"))).toBeNull();
    });

    it("can only be accepted once", async () => {
      const { token } = await invite();
      expect(await mod.acceptInvite(token, pw("first"))).not.toBeNull();
      expect(await mod.acceptInvite(token, pw("second"))).toBeNull();
    });

    it("stores the token hashed, never in the clear", async () => {
      const { token } = await invite();
      const rows = await sql()`select token_hash from admin_invites`;
      expect(String(rows[0].token_hash)).not.toBe(token);
      expect(String(rows[0].token_hash)).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe("signing in", () => {
    it("accepts the right password and refuses a wrong one", async () => {
      const user = await makeUser({ email: "who@example.com" }, pw("right"));
      expect(await mod.authenticate("who@example.com", pw("right"))).not.toBeNull();
      expect(await mod.authenticate("who@example.com", pw("wrong"))).toBeNull();
    });

    it("ignores casing and surrounding space in the address", async () => {
      await makeUser({ email: "case@example.com" }, pw("right"));
      expect(await mod.authenticate("  CASE@Example.com  ", pw("right"))).not.toBeNull();
    });

    it("returns null rather than throwing for an address with no account", async () => {
      expect(await mod.authenticate("nobody@example.com", pw("any"))).toBeNull();
    });

    it("refuses a disabled account even with the right password", async () => {
      // Someone else has to hold the owner role, or disabling this account is
      // refused for the entirely different and correct reason that it is the
      // last owner.
      await makeUser({ email: "owner@example.com" });
      const user = await makeUser(
        { email: "gone@example.com", role: "member" },
        pw("right")
      );

      expect(await mod.authenticate("gone@example.com", pw("right"))).not.toBeNull();
      await mod.setAdminDisabled(user.id, true);
      expect(await mod.authenticate("gone@example.com", pw("right"))).toBeNull();
    });

    it("refuses non-strings without blowing up", async () => {
      expect(await mod.authenticate(null, undefined)).toBeNull();
      expect(await mod.authenticate({}, [])).toBeNull();
    });
  });

  describe("the emailed code", () => {
    it("accepts the code it issued, once", async () => {
      const user = await makeUser();
      const { challengeId, code } = await mod.issueLoginCode(user.id);

      const first = await mod.verifyLoginCode(challengeId, code);
      expect(first).toEqual({ ok: true, userId: user.id });

      // Consumed: it opens exactly one session.
      expect(await mod.verifyLoginCode(challengeId, code)).toEqual({
        ok: false,
        reason: "expired",
      });
    });

    it("rejects a wrong code and counts the attempt", async () => {
      const user = await makeUser();
      const { challengeId, code } = await mod.issueLoginCode(user.id);
      const wrong = code === "000000" ? "111111" : "000000";

      expect(await mod.verifyLoginCode(challengeId, wrong)).toEqual({
        ok: false,
        reason: "wrong",
      });
      const rows = await sql()`select attempts from admin_login_codes where id = ${challengeId}`;
      expect(Number(rows[0].attempts)).toBe(1);
    });

    it("burns the code after five wrong guesses, so a million values is not walkable", async () => {
      const user = await makeUser();
      const { challengeId, code } = await mod.issueLoginCode(user.id);
      const wrong = code === "000000" ? "111111" : "000000";

      for (let i = 0; i < mod.MAX_CODE_ATTEMPTS - 1; i += 1) {
        expect((await mod.verifyLoginCode(challengeId, wrong)).ok).toBe(false);
      }
      expect(await mod.verifyLoginCode(challengeId, wrong)).toEqual({
        ok: false,
        reason: "exhausted",
      });
      // Even the correct code no longer works.
      expect(await mod.verifyLoginCode(challengeId, code)).toEqual({
        ok: false,
        reason: "exhausted",
      });
    });

    it("rejects an expired code", async () => {
      const user = await makeUser();
      const { challengeId, code } = await mod.issueLoginCode(user.id);
      await sql()`update admin_login_codes set expires_at = now() - interval '1 second' where id = ${challengeId}`;
      expect(await mod.verifyLoginCode(challengeId, code)).toEqual({
        ok: false,
        reason: "expired",
      });
    });

    it("rejects anything that is not six digits without touching the database", async () => {
      const user = await makeUser();
      const { challengeId } = await mod.issueLoginCode(user.id);
      for (const bad of ["", "12345", "1234567", "abcdef", "12 345", null, 123456]) {
        expect(await mod.verifyLoginCode(challengeId, bad)).toEqual({
          ok: false,
          reason: "wrong",
        });
      }
      const rows = await sql()`select attempts from admin_login_codes where id = ${challengeId}`;
      expect(Number(rows[0].attempts)).toBe(0);
    });

    it("replaces an outstanding code rather than leaving two live", async () => {
      const user = await makeUser();
      const first = await mod.issueLoginCode(user.id);
      const second = await mod.issueLoginCode(user.id);

      expect(await mod.verifyLoginCode(first.challengeId, first.code)).toEqual({
        ok: false,
        reason: "expired",
      });
      expect((await mod.verifyLoginCode(second.challengeId, second.code)).ok).toBe(true);
    });

    it("rejects an unknown challenge", async () => {
      expect(
        await mod.verifyLoginCode("00000000-0000-0000-0000-000000000000", "123456")
      ).toEqual({ ok: false, reason: "expired" });
    });

    it("stores the code hashed", async () => {
      const user = await makeUser();
      const { code } = await mod.issueLoginCode(user.id);
      const rows = await sql()`select code_hash from admin_login_codes`;
      expect(String(rows[0].code_hash)).not.toContain(code);
      expect(String(rows[0].code_hash)).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe("sessions", () => {
    it("resolves to the account that opened it", async () => {
      const user = await makeUser();
      const sessionId = await mod.createSession(user.id, "Firefox on a laptop");
      const found = await mod.userForSession(sessionId);
      expect(found?.id).toBe(user.id);
    });

    it("records the sign-in time on the account", async () => {
      const user = await makeUser();
      expect(user.last_login_at).toBeNull();
      await mod.createSession(user.id, null);
      expect((await mod.findAdminById(user.id))?.last_login_at).not.toBeNull();
    });

    it("stops resolving once revoked", async () => {
      const user = await makeUser();
      const sessionId = await mod.createSession(user.id, null);
      await mod.revokeSession(sessionId);
      expect(await mod.userForSession(sessionId)).toBeNull();
    });

    it("stops resolving once expired", async () => {
      const user = await makeUser();
      const sessionId = await mod.createSession(user.id, null);
      await sql()`update admin_sessions set expires_at = now() - interval '1 second' where id = ${sessionId}`;
      expect(await mod.userForSession(sessionId)).toBeNull();
    });

    it("stops resolving the moment the account is disabled", async () => {
      const owner = await makeUser({ email: "owner@example.com" });
      const member = await makeUser({ email: "member@example.com", role: "member" });
      const sessionId = await mod.createSession(member.id, null);

      await mod.setAdminDisabled(member.id, true);
      expect(await mod.userForSession(sessionId)).toBeNull();
      expect(owner.id).not.toBe(member.id);
    });

    it("rejects an unknown or empty session id", async () => {
      expect(await mod.userForSession("")).toBeNull();
      expect(await mod.userForSession("00000000-0000-0000-0000-000000000000")).toBeNull();
    });

    it("ends every session, or every session but the current one", async () => {
      const user = await makeUser();
      const keep = await mod.createSession(user.id, "this browser");
      const a = await mod.createSession(user.id, "another");
      const b = await mod.createSession(user.id, "a third");

      const ended = await mod.revokeAllSessions(user.id, keep);
      expect(ended).toBe(2);
      expect(await mod.userForSession(keep)).not.toBeNull();
      expect(await mod.userForSession(a)).toBeNull();
      expect(await mod.userForSession(b)).toBeNull();

      expect(await mod.revokeAllSessions(user.id)).toBe(1);
      expect(await mod.userForSession(keep)).toBeNull();
    });

    it("only ever lists the sessions still worth listing", async () => {
      const user = await makeUser();
      const live = await mod.createSession(user.id, "live");
      const dead = await mod.createSession(user.id, "dead");
      await mod.revokeSession(dead);

      const listed = await mod.listSessionsFor(user.id);
      expect(listed.map((s) => s.id)).toEqual([live]);
    });

    it("does not leak one person's sessions into another's list", async () => {
      const one = await makeUser({ email: "one@example.com" });
      const two = await makeUser({ email: "two@example.com" });
      await mod.createSession(one.id, null);
      expect(await mod.listSessionsFor(two.id)).toHaveLength(0);
    });
  });

  describe("changing your own password", () => {
    it("requires the current one", async () => {
      const user = await makeUser({}, pw("current"));
      expect(
        await mod.changePassword({
          userId: user.id,
          currentPassword: pw("not-current"),
          newPassword: pw("new"),
        })
      ).toBe(false);
      // Unchanged.
      expect(await mod.authenticate(user.email, pw("current"))).not.toBeNull();
    });

    it("replaces the password and ends the other sessions", async () => {
      const user = await makeUser({}, pw("current"));
      const keep = await mod.createSession(user.id, "this browser");
      const other = await mod.createSession(user.id, "somewhere else");

      expect(
        await mod.changePassword({
          userId: user.id,
          currentPassword: pw("current"),
          newPassword: pw("new"),
          keepSessionId: keep,
        })
      ).toBe(true);

      expect(await mod.authenticate(user.email, pw("new"))).not.toBeNull();
      expect(await mod.authenticate(user.email, pw("current"))).toBeNull();
      // A password is changed because it might be known; leaving the other
      // sessions signed in would make the change decorative.
      expect(await mod.userForSession(other)).toBeNull();
      expect(await mod.userForSession(keep)).not.toBeNull();
    });

    it("returns false for an account that is not there", async () => {
      expect(
        await mod.changePassword({
          userId: "00000000-0000-0000-0000-000000000000",
          currentPassword: pw("whatever"),
          newPassword: pw("new"),
        })
      ).toBe(false);
    });
  });

  describe("managing other people", () => {
    it("promotes and demotes", async () => {
      await makeUser({ email: "first@example.com" });
      const member = await makeUser({ email: "second@example.com", role: "member" });

      expect((await mod.setAdminRole(member.id, "owner"))?.role).toBe("owner");
      expect((await mod.setAdminRole(member.id, "member"))?.role).toBe("member");
    });

    it("will not demote, disable or remove the last owner", async () => {
      const only = await makeUser();
      expect(only.role).toBe("owner");

      await expect(mod.setAdminRole(only.id, "member")).rejects.toThrow(mod.LastOwner);
      await expect(mod.setAdminDisabled(only.id, true)).rejects.toThrow(mod.LastOwner);
      await expect(mod.deleteAdmin(only.id)).rejects.toThrow(mod.LastOwner);
      expect(await mod.hasUsableAdminUsers()).toBe(true);
    });

    it("allows it once a second owner exists", async () => {
      const first = await makeUser({ email: "first@example.com" });
      const second = await makeUser({ email: "second@example.com" });
      await mod.setAdminRole(second.id, "owner");

      await expect(mod.setAdminRole(first.id, "member")).resolves.not.toBeNull();
    });

    it("does not count a disabled or unaccepted owner as cover for the last one", async () => {
      const active = await makeUser({ email: "active@example.com" });
      const spare = await makeUser({ email: "spare@example.com" });
      await mod.setAdminRole(spare.id, "owner");
      await mod.setAdminDisabled(spare.id, true);

      // The only owner who can actually sign in is `active`.
      await expect(mod.setAdminDisabled(active.id, true)).rejects.toThrow(mod.LastOwner);

      await invite({ email: "invited@example.com", role: "owner" });
      await expect(mod.setAdminDisabled(active.id, true)).rejects.toThrow(mod.LastOwner);
    });

    it("re-enables a disabled account", async () => {
      await makeUser({ email: "owner@example.com" });
      const member = await makeUser({ email: "member@example.com", role: "member" });

      await mod.setAdminDisabled(member.id, true);
      expect((await mod.findAdminById(member.id))?.disabled_at).not.toBeNull();
      await mod.setAdminDisabled(member.id, false);
      expect((await mod.findAdminById(member.id))?.disabled_at).toBeNull();
      expect((await mod.findAdminById(member.id))?.active).toBe(true);
    });

    it("removes an account and everything hanging off it", async () => {
      await makeUser({ email: "owner@example.com" });
      const member = await makeUser({ email: "member@example.com", role: "member" });
      const sessionId = await mod.createSession(member.id, null);
      await mod.issueLoginCode(member.id);

      expect(await mod.deleteAdmin(member.id)).toBe(true);
      expect(await mod.findAdminById(member.id)).toBeNull();
      expect(await mod.userForSession(sessionId)).toBeNull();
      const codes = await sql()`select 1 from admin_login_codes where user_id = ${member.id}`;
      expect(codes).toHaveLength(0);
    });

    it("reports a missing account rather than pretending to act", async () => {
      const missing = "00000000-0000-0000-0000-000000000000";
      expect(await mod.deleteAdmin(missing)).toBe(false);
      expect(await mod.setAdminRole(missing, "owner")).toBeNull();
      expect(await mod.setAdminDisabled(missing, true)).toBeNull();
    });

    it("lists everyone, oldest first, with their state", async () => {
      await makeUser({ email: "first@example.com", name: "First" });
      await invite({ email: "second@example.com", name: "Second" });

      const users = await mod.listAdminUsers();
      expect(users.map((u) => u.name)).toEqual(["First", "Second"]);
      expect(users[0].active).toBe(true);
      expect(users[1].active).toBe(false);
    });

    it("never hands a password hash to the list", async () => {
      await makeUser();
      const [user] = await mod.listAdminUsers();
      expect(Object.keys(user)).not.toContain("password_hash");
    });
  });
});
