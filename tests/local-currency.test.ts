import { describe, it, expect, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { localCurrencyEnabled } from "@/lib/local-currency";

/**
 * The switch that decides whether a visitor abroad is shown their own currency.
 *
 * It ships off. This is the first piece of the multi-currency work that changes
 * what a visitor sees, and a price is not a thing to turn on by accident — so
 * the default is the behaviour the site already had, and enabling it takes a
 * deliberate act on a deployment.
 */

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const set = (value: string | undefined) => {
  if (value === undefined) delete process.env.LOCAL_CURRENCY;
  else process.env.LOCAL_CURRENCY = value;
};

afterEach(() => set(undefined));

describe("the rollout switch", () => {
  it("is off when nothing says otherwise", () => {
    set(undefined);
    expect(localCurrencyEnabled()).toBe(false);
  });

  it("is off for anything that is not an explicit on", () => {
    /*
      Including the values someone might reasonably expect to work. "true" and
      "1" are deliberately not accepted: guessing at intent here would turn a
      visitor-facing price change on for a deployment that did not ask for one,
      and the cost of being wrong is asymmetric.
    */
    for (const value of ["", "off", "false", "0", "no", "true", "1", "yes", "enabled"]) {
      set(value);
      expect(localCurrencyEnabled(), `LOCAL_CURRENCY=${value}`).toBe(false);
    }
  });

  it("is on for an explicit on, whatever the casing or spacing", () => {
    for (const value of ["on", "ON", " On "]) {
      set(value);
      expect(localCurrencyEnabled(), `LOCAL_CURRENCY=${value}`).toBe(true);
    }
  });
});

describe("how the switch reaches the page", () => {
  it("is read on the server and passed down, not inlined into the bundle", () => {
    /*
      A NEXT_PUBLIC variable would be baked into every visitor's JavaScript and
      could not be changed without a rebuild. app/page.tsx is a server
      component, so it reads the value and hands down a boolean.
    */
    expect(read("lib/local-currency.ts")).not.toContain("process.env.NEXT_PUBLIC");
    expect(read("app/page.tsx")).toContain("localCurrency={localCurrencyEnabled()}");
  });

  it("defaults to off at every step it passes through", () => {
    // A component rendered without the prop must behave as it did before this
    // existed, not pick up a converted price by omission.
    expect(read("components/HomePage.tsx")).toContain("localCurrency = false");
    expect(read("components/Services.tsx")).toContain("localCurrency = false");
  });
});

describe("the price a page renders", () => {
  afterEach(() => vi.restoreAllMocks());

  it("keeps the rupee figure in the server-rendered markup", () => {
    /*
      The part that must not regress. Every public page is ISR — one stored copy
      of the HTML for everyone — so the figure in it has to be the one that is
      true for everyone, and that is rupees. It is also what a crawler indexes
      and what the structured data quotes.

      Price renders `rupees` on the server and only ever swaps after hydration,
      which is why the conversion lives in an effect rather than in the body.
    */
    const source = read("components/Price.tsx");
    expect(source).toContain('"use client"');
    // The fetch moved into the shared hook, so that is where the rule is
    // enforced: it happens in an effect, never during render.
    const hook = read("lib/use-pricing.ts");
    expect(hook).toContain('"use client"');
    expect(hook).toContain("useEffect");
    const beforeEffect = hook.slice(0, hook.indexOf("useEffect"));
    expect(beforeEffect).not.toContain("await fetch");
    expect(source).not.toContain('fetch("/api/pricing")');
  });

  it("does not ask at all when the switch is off", () => {
    expect(read("lib/use-pricing.ts")).toContain("if (!enabled) return;");
  });

  it("asks once for the whole page, however many prices are on it", () => {
    /*
      Five places quote a price now — the services card, the FAQ answer, the
      intake form's assurances and its slider. A hook that fetched per
      component would make five identical requests on every load.
    */
    const hook = read("lib/use-pricing.ts");
    expect(hook).toContain("let inFlight");
    expect(hook).toContain("if (inFlight) return inFlight");
  });

  it("ignores a response for a page the visitor has already left", () => {
    /*
      This used to abort the request, which was right when Price owned it and
      is wrong now that it is shared: aborting because one component unmounted
      would cancel the read the other four are still waiting on. So the request
      runs to completion and the result is dropped instead.
    */
    const hook = read("lib/use-pricing.ts");
    expect(hook).toContain("if (live) setView(result)");
    expect(hook).toContain("live = false");
  });

  it("says a converted figure is not what will be billed", () => {
    // Every session settles in rupees. A converted price that does not say so
    // is a number someone will reasonably expect to be charged.
    expect(read("components/Price.tsx")).toContain("{note}");
  });
});
