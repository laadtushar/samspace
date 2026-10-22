import { CRISIS_SUPPORT_ABROAD } from "@/lib/starter-posts";
import { toConfirm } from "@/lib/page-format";

/**
 * Pages that ship with the site.
 *
 * The same arrangement as lib/starter-posts.ts: kept in the repository so the
 * wording is reviewable in a diff, and added to the database only when an owner
 * presses the import button in the Pages tab — always as a draft, and never
 * over a page that already exists. Deploying this file writes nothing.
 *
 * Anything the practitioner has not yet confirmed is written as a visible
 * [To confirm: …] placeholder rather than a plausible guess. The dashboard and
 * the API both refuse to publish a page that still contains one, so a guess
 * about payment or confidentiality cannot reach a client by accident.
 *
 * Fees are only ever {{rate.range}} and the session length only ever
 * {{session.length}}, both filled in from the dashboard's settings when the page
 * is shown.
 */

export interface StarterPage {
  slug: string;
  /** The heading on the page. */
  title: string;
  seoTitle: string;
  seoDescription: string;
  content: string;
}

export const STARTER_PAGES: StarterPage[] = [
  {
    slug: "therapy-for-indians-abroad",
    title: "Therapy with someone who already understands home",
    seoTitle: "Indian Therapist Online for Indians Living Abroad",
    seoDescription:
      "Online therapy with an Indian counselling psychologist who understands family pressure, homesickness and life between two cultures. In English or Hindi.",
    content: `You moved for a degree, a job or a partner. Your new life is real, and so is the pull of the one you left. Parents who call every evening, and the guilt when you don't pick up. A family that measures success in ways your new friends don't follow. Festivals that pass without anyone around you noticing.

A therapist abroad can be skilled and kind and still need these things explained. With me you don't start there. I'm a counselling psychologist (M.Sc. Clinical Psychology) working online with young Indians in India and around the world.

## What we often work on

- Homesickness and loneliness after a move
- Family expectations, guilt and [boundaries across distance](/blog/boundaries-with-indian-parents)
- Academic and career pressure, visas and [uncertainty about staying or returning](/blog/study-abroad-reality-indian-students)
- Relationships, including [long-distance ones](/blog/long-distance-relationship-india-abroad) and partners from another culture
- Anxiety, low mood and self-esteem
- Feeling that you belong fully in neither place

## How it works

- Online sessions of {{session.length}}
- In English or Hindi
- Booked online ${toConfirm("how booking shows times to someone in another time zone")}
- Sliding-scale fees, {{rate.range}} ${toConfirm("the currency fees are charged in, and how clients abroad pay")}

[Book a first session](/?intake=true)

## Questions

### Can I see an Indian therapist while living in the US, UK or Canada?

${toConfirm("Priyanka's wording on working with clients who live abroad")}

### Is it confidential?

${toConfirm("Priyanka's wording on confidentiality")}

### What if I'm in crisis?

${CRISIS_SUPPORT_ABROAD}`,
  },
];
