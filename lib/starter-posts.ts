/**
 * Posts that ship with the site.
 *
 * These are written by the practitioner and kept in the repository so they are
 * reviewable in a diff and cannot be lost with a storage account. They are not
 * a second live source for the blog: an owner imports them once from the Blog
 * tab, after which they are ordinary posts, edited in the dashboard like any
 * other. The import never overwrites a slug that already exists, so pressing
 * the button twice cannot undo an edit.
 *
 * Each carries its own SEO title and description rather than falling back to
 * the heading, because the phrase someone types into Google is rarely the
 * phrase that makes a good headline, and the two want different things.
 */

export interface StarterPost {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  coverImage: string;
  coverAlt: string;
  tags: string[];
  seoTitle: string;
  seoDescription: string;
}

const CRISIS_NOTE = `---

*If you're in immediate distress or having thoughts of self-harm, please reach out for emergency support: iCall 9152987821, or Vandrevala Foundation 1860-2662-345 (24/7). This post is educational and isn't a substitute for individual care.*`;

export const STARTER_POSTS: StarterPost[] = [
  {
    slug: "do-i-need-therapy-or-overreacting",
    title: "Do I Need Therapy, or Am I Overreacting?",
    seoTitle: "Do I Need Therapy or Am I Overreacting? | Samvriti.Space",
    seoDescription:
      "Wondering if what you're going through is 'bad enough' for therapy? A counselling psychologist explains why that's usually the wrong question to be asking.",
    excerpt:
      "If you've been waiting for a reason that feels legitimate enough, the waiting itself is usually the answer. Why \"is this bad enough\" is the wrong measure, and what to ask instead.",
    coverImage: "/blog/do-i-need-therapy-or-overreacting.svg",
    coverAlt:
      "A small question mark held inside widening circles, drawn in muted greens and clay",
    tags: ["Starting therapy", "Self-doubt", "Young adults"],
    content: `"I don't want to waste your time with something so small." I hear a version of this in almost every first session. Usually from someone who's been sitting on the decision to reach out for months, sometimes years, waiting for their reason to feel legitimate enough.

If you've typed some version of "do I need therapy or am I overreacting" into Google, there's a decent chance you already know the honest answer. The searching itself is usually a sign that something's been sitting with you long enough to go looking for permission. The question is really asking something else: *is this allowed to matter?*

## Why "bad enough" is the wrong measure

A lot of people have an internal bar for therapy that looks something like: a diagnosable condition, a major life event, or a breakdown that's impossible to ignore. Anything short of that gets filed under "manageable," even when it isn't being managed particularly well.

That bar isn't really about severity. It's usually inherited, from a family that treated emotional struggle as something to push through quietly, from comparing your problems to someone else's and deciding yours don't measure up, or from a culture that's more comfortable with physical symptoms than emotional ones. None of that makes the bar accurate. It just makes it familiar.

Therapy doesn't require a crisis to be useful. Most of what brings people into a first session is closer to "this has been getting in the way for a while" than "something has gone catastrophically wrong." Persistent low mood that hasn't tipped into anything dramatic. A relationship pattern that keeps repeating. Difficulty concentrating that's been quietly costing you at work or in your studies. None of these need to escalate before they're worth addressing.

## A more useful question than "is this bad enough"

Instead of measuring severity, it helps to ask: **has this been taking up more space than it should, for longer than it should?**

A few ways that shows up:

You've been managing something the same way for months, and it isn't actually improving, just becoming more familiar. Familiarity can feel like coping, even when nothing has really changed.

You've mentioned it to friends or family more than once, in that half-joking way people use when something's bothering them but they're not ready to say so directly.

You're spending real energy keeping it contained, at work, in relationships, in how you show up day to day, and that effort is quietly costing you elsewhere.

You've thought about therapy before, more than once, and talked yourself out of it each time using some version of "it's not that serious."

If any of that sounds familiar, that's usually enough of an answer. Nothing here requires a diagnosis or a specific label to count.

## The comparison trap

A specific version of "am I overreacting" comes from comparing your situation to someone else's. *My friend's family situation is so much worse than mine, so I have no right to be struggling with this.* *Other people have real problems, mine is just stress.*

This comparison rarely holds up, mostly because it isn't actually possible to weigh two different people's internal experiences against each other with any accuracy. What's manageable for one person given their history, temperament, and current circumstances might be genuinely overwhelming for someone else facing something that looks smaller from the outside. The size of the external event and the size of its impact on you aren't the same measurement, and treating them as interchangeable is how a lot of people talk themselves out of getting support they'd actually benefit from.

## What therapy is actually for

Therapy isn't only for the moments when things fall apart. A good amount of the work that happens in session is preventive and exploratory: understanding a pattern before it gets worse, building self-awareness, working through something that's uncomfortable but not (yet) unmanageable, or simply having a space that's entirely about you, without needing to manage anyone else's reaction to what you share.

That last part matters more than people expect, especially if you're used to being the one who holds things together for everyone else. A space where you don't have to do that, even once a week, is its own kind of relief.

## If you're still not sure

You don't need certainty before booking a first session. A first session is often part of how that certainty gets built, not something you need to arrive with already sorted out. It's also not a commitment to years of sessions. Plenty of people come with one specific thing on their mind, work through it over a handful of sessions, and stop when it feels resolved. There isn't a minimum threshold of seriousness required to start, and there isn't a minimum number of sessions you're obligated to continue for.

If the hesitation you're sitting with looks more like a loop you can't put down, it may be worth reading [overthinking versus anxiety](/blog/overthinking-vs-anxiety) as well, since the two often travel together.

If you've been going back and forth on this, that back-and-forth is usually the clearest signal available. I work with young adults navigating exactly this kind of "is this worth bringing up" hesitation, using an approach drawn from CBT, humanistic therapy, and trauma-informed care, shaped around what you bring rather than a fixed idea of what counts. Sessions run on a sliding scale (₹500–₹1000), so cost doesn't have to be part of the hesitation either. [You can read more or book a session here.](/?intake=true)

${CRISIS_NOTE}`,
  },

  {
    slug: "overthinking-vs-anxiety",
    title: "Overthinking vs. Anxiety: How to Tell the Difference",
    seoTitle: "Overthinking vs Anxiety: How to Tell the Difference",
    seoDescription:
      "Overthinking and anxiety feel similar but aren't the same thing. A counselling psychologist explains how to tell which you're facing, and what actually helps.",
    excerpt:
      "Overthinking is a pattern of thinking. Anxiety is a state. Telling them apart matters, because using the right strategy on the wrong one can cost you months.",
    coverImage: "/blog/overthinking-vs-anxiety.svg",
    coverAlt:
      "A tight closed loop beside a wide open wave, labelled 'a loop' and 'a state'",
    tags: ["Anxiety", "Overthinking", "Young adults"],
    content: `You replay the same conversation four times before falling asleep. You draft and redraft a text that should've taken ten seconds. You know the decision you're stuck on isn't actually that big a deal, and you still can't put it down.

Is that overthinking? Or is it anxiety?

Most people use the two words interchangeably, which is fine most of the time. Language doesn't need to be clinical to be useful. But when the loop won't stop, or it starts costing you sleep or a relationship or your work, it's worth figuring out which one you're actually dealing with. They don't respond to the same things, and I've seen a lot of people spend months trying to fix one with tools meant for the other.

## The short version

Overthinking is a pattern of thinking. You're going over something too many times, from too many angles, usually after the fact or right before a decision. It's exhausting, but it has a shape to it: a start, and eventually, an end.

Anxiety is more of a state. A background hum of unease or alertness that doesn't need a trigger to keep running. A lot of the time, overthinking is just something anxiety does. It's not the thing itself.

So overthinking can be a symptom of anxiety. But you can overthink without being particularly anxious, and you can be anxious without much "thinking" involved at all. Some people barely narrate their anxiety in words. It just shows up as a tight chest or a churning stomach, no story attached.

## How they actually feel different

Overthinking is usually about something specific. A decision. A conversation that maybe landed wrong. Once that thing resolves (the message gets sent, the decision gets made), the loop tends to loosen, even if it takes a while.

Anxiety often isn't about anything in particular. You can wake up with it before you've had a single thought. It shows up on days that are objectively fine. It's less "I keep thinking about X" and more "something feels off and I can't say what."

There's also a physical difference worth noticing. Overthinking is mostly a head thing: *did I say the wrong thing in that meeting, should I have replied differently, what if this job is a mistake.* Anxiety tends to live in the body first: a tight chest, shallow breathing you only notice once someone points it out, restlessness with nowhere to go.

And here's the part that trips people up the most. Overthinking can usually be reasoned with. You talk it through, weigh the options, get someone else's take, and eventually land somewhere. Anxiety doesn't work that way. You can already *know* the flight is statistically safe. You can already *know* your friend probably isn't upset with you. Knowing doesn't turn it off, because anxiety was never really a logic problem to begin with.

## Why the distinction matters

If you treat anxiety like it's overthinking, you end up trying to think your way out of something that isn't asking for more thinking, and you usually just get more of it, plus the frustration that none of it's working.

If you treat overthinking like it's anxiety, you might reach for breathing exercises or grounding techniques when what you actually need is to make the decision, get the missing information, or have the conversation you've been avoiding.

Neither is a wrong thing to try. But knowing which one you're facing can save you months of using the wrong strategy on the right problem.

## A rough way to check

Ask yourself: if the specific thing resolved right now, would the unease go with it?

If getting the answer, sending the message, or making the call would genuinely quiet things down, that's probably overthinking. If the unease would still be sitting there, just looking for something new to attach to by tomorrow, that's closer to anxiety.

This isn't a diagnostic test. It's just a way to start noticing your own pattern, which is usually the first real step before anything shifts.

## What tends to help

For overthinking, it helps to name the actual decision underneath the loop, out loud or on paper, since vague unease is much harder to sit with than a problem with an actual shape. A time boundary helps too: *I'll give this until Sunday, then I decide with what I have.* And sometimes the loop just needs a second voice to interrupt it, even someone who isn't going to solve it for you.

For anxiety, the body usually needs attention before the thoughts do. It's hard to reason with a nervous system that's still switched on. It also helps to notice whether it's constant or comes in waves, and what tends to come before it. If it's persistent or getting in the way of daily life, that's usually a sign it needs more than a single technique. It needs an ongoing, proper look at what's keeping it going, which is something worth doing with a professional rather than alone.

## If this sounds familiar

Most people I work with are somewhere in between: some overthinking, some anxiety, each one feeding the other. That's normal, and you don't need to have it sorted out or diagnosed before you bring it up with someone.

When this pattern shows up specifically in a relationship, it often has a particular shape — that's covered in [signs of an anxious attachment style](/blog/anxious-attachment-style-relationships). And if you're still weighing whether any of this is worth raising at all, [that question has its own answer](/blog/do-i-need-therapy-or-overreacting).

If this has been sitting with you for a while, or you're genuinely not sure which of these fits what you're going through, that's a reasonable thing to bring to a session. I work with young adults on exactly this kind of overthinking-anxiety overlap, drawing from CBT, humanistic therapy, and trauma-informed care, shaped around what you're actually bringing, not a fixed script.

Sessions run on a sliding scale (₹500–₹1000), so cost shouldn't be the reason this stays unaddressed. [You can read more or book a session here.](/?intake=true)

${CRISIS_NOTE}`,
  },

  {
    slug: "anxious-attachment-style-relationships",
    title: "Signs of an Anxious Attachment Style in Relationships",
    seoTitle: "Signs of an Anxious Attachment Style in Relationships",
    seoDescription:
      "Needing constant reassurance, reading too much into silence, spiralling over a short reply. A counselling psychologist on the signs, and what helps.",
    excerpt:
      "Reassurance that doesn't hold, spirals over a shorter reply than usual, difficulty trusting a good thing. What anxious attachment looks like from the inside, and why logic doesn't touch it.",
    coverImage: "/blog/anxious-attachment-style-relationships.svg",
    coverAlt:
      "Two circles joined by a thread that keeps pulling taut and slack, one with a reaching halo",
    tags: ["Relationships", "Attachment", "Anxiety"],
    content: `You send a message and it's left on read. Ten minutes pass, and you've already gone through three explanations for why they're not replying, and at least one of them involves the relationship ending. Twenty minutes in, you've drafted and deleted a follow-up text four times. By the time they finally reply with "sorry, was in a meeting," the relief is almost as intense as the anxiety was.

If this sounds familiar, you might be recognising something we talked about in an [earlier post on overthinking versus anxiety](/blog/overthinking-vs-anxiety), except this version shows up specifically in romantic relationships. There's a name for it: anxious attachment.

## What attachment style actually means

Attachment theory, originally developed to describe how infants bond with caregivers, turns out to describe adult romantic relationships fairly well too. The basic idea is that early relationships teach us what to expect from closeness: whether it's reliable, whether it disappears when we need it most, whether we have to work to keep it. Those early expectations don't disappear in adulthood. They show up as a pattern in how we relate to partners.

There are a few recognised styles, but anxious attachment is one of the most common ones that brings people into therapy, mostly because it's exhausting to live with and hard to explain to a partner who doesn't experience relationships the same way.

## What anxious attachment actually looks like

**A need for reassurance that doesn't stay satisfied for long.** Your partner tells you they love you, and it helps, for a while. But the same worry comes back within a day or two, needing to be answered again. It's not that the reassurance doesn't work. It's that it doesn't hold.

**Reading a lot into small changes.** A shorter reply than usual. A slightly different tone. Taking longer than normal to respond. For someone with a more secure attachment style, these barely register. For someone with anxious attachment, they can trigger a spiral that takes hours to settle.

**Difficulty trusting good things when they happen.** Even in a relationship that's going well, there's often a background worry that it's about to change, or that you're somehow about to lose it, without anything concrete pointing to that.

**Taking on more emotional responsibility than your share.** A tendency to over-apologise, over-explain, or manage a partner's mood, sometimes even for things that aren't yours to manage, because keeping the relationship stable feels like it depends on you specifically.

**Difficulty being alone with uncertainty.** Not knowing where you stand, even briefly, can feel unbearable in a way that pushes you toward checking in, seeking clarity, or needing an answer sooner than the situation actually calls for.

None of this is about being "too much" or "too needy," even though it can feel that way from the inside, and even though a partner with a different attachment style might describe it that way. It's a pattern that made sense at some point, usually early on, as a way of trying to stay connected to something that felt inconsistent or uncertain.

## Why it doesn't respond to logic

This is the part that often confuses people the most, including the person experiencing it. You can know, with complete clarity, that your partner loves you and isn't going anywhere. The anxiety doesn't seem to care. It responds to a felt sense of closeness rather than to facts, which means reasoning with it directly rarely gets very far. This is similar to what we described in the overthinking-versus-anxiety piece: this isn't a thinking problem you can out-argue. It's closer to a nervous system pattern that needs to be worked with differently.

## What tends to help

**Naming the pattern out loud, to yourself first.** Being able to say "this is my attachment anxiety talking" rather than treating every worry as fresh evidence makes it easier to pause before reacting.

**Building a gap between the urge to check in and actually doing it.** Not suppressing the urge, just noticing it, and giving it a few minutes before acting on it. Often the intensity passes faster than expected once it's not immediately fed.

**Communicating the pattern to a partner, when the relationship is safe enough for that.** Something like "I notice I get anxious when replies take a while, it's not really about you" can shift how a partner responds to your anxiety, from confusion or frustration to something closer to teamwork.

**Understanding where the pattern came from.** This is usually the slower, deeper work, and it's where a lot of the actual change happens. Anxious attachment rarely starts in adulthood. It tends to trace back to earlier relationships where closeness felt unreliable, and untangling that history is often what allows the pattern to actually loosen, rather than just being managed session to session.

## If this sounds like you

Attachment style isn't a fixed sentence. It's a pattern that developed for a reason, and patterns that developed can shift with the right kind of work, usually a combination of understanding where it came from and practising new responses in real relationships as they come up.

If you've recognised yourself in this, especially if it's been affecting how safe your relationships feel, that's worth bringing to a session. I work with young adults on attachment patterns and relationship anxiety, drawing from CBT, humanistic therapy, and trauma-informed care, since attachment work often benefits from looking at both present-day patterns and where they started. Sessions run on a sliding scale (₹500–₹1000). [You can read more or book a session here.](/?intake=true)

${CRISIS_NOTE}`,
  },

  {
    slug: "boundaries-with-indian-parents",
    title: "How to Set a Boundary with Indian Parents Without a Fight",
    seoTitle: "Setting Boundaries with Indian Parents Without a Fight",
    seoDescription:
      "Setting boundaries with Indian parents doesn't have to mean conflict or guilt. A counselling psychologist walks through how to do it, with a practical example.",
    excerpt:
      "Most boundary advice is written for a culture where family involvement is the exception, not the default. Here's an approach built for an Indian household, with a worked example.",
    coverImage: "/blog/boundaries-with-indian-parents.svg",
    coverAlt:
      "An archway with a warm light on either side, captioned 'a door, not a wall'",
    tags: ["Family", "Boundaries", "Indian families"],
    content: `"I just want them to stop asking when I'm getting married" is one of the most common things I hear in session, closely followed by "I want to visit less often without them thinking something's wrong." Underneath both is the same question: how do you set a boundary with Indian parents without it turning into a fight, a guilt trip, or three days of silence?

Here's the thing most advice on boundaries gets wrong for an Indian household. It's usually written for a culture where individual autonomy is the default assumption, and family involvement is the exception. In most Indian families, it's the other way around. Your parents' involvement in your decisions, your time, your choices, isn't overstepping by their definition. It's what a close family is supposed to look like. So a boundary that sounds like "this is my life, stay out of it" doesn't just fail, it often lands as a rejection of the relationship itself, not just a request about behaviour.

That doesn't mean boundaries aren't possible. It means the framing has to change.

## What a boundary actually is

A boundary isn't a wall. It's not "you don't get to have an opinion." It's a clear statement of what you need, paired with what you're willing to do to protect it, regardless of whether the other person agrees. You're not asking permission. You're informing, and then following through.

The mistake a lot of people make is treating a boundary like a negotiation that needs the other person's buy-in before it counts. It doesn't. A parent doesn't have to agree that you need your evenings to yourself for that boundary to be real. They just have to eventually learn that your evenings aren't available, because you consistently make it true.

## A common scenario

Take something almost every working adult living at home, or even living separately, will recognise: a parent calling multiple times during work hours, and if the call goes unanswered, a follow-up call with a tone that makes clear it wasn't really a question about your wellbeing, it was about not being reachable.

The instinct most people reach for first is a direct, blunt request: "Please don't call me so much at work, I can't focus." This often backfires. It tends to get heard as *you don't want to talk to me anymore*, which can lead to hurt feelings, a few days of being brought up repeatedly, and sometimes even more calls for a while, driven by anxiety rather than habit.

A more effective approach usually has less to do with the request itself and more to do with how it's delivered and how consistently it's held afterward.

**Start by separating the actual need from any accusation buried in how you'd normally phrase it.** The real need is often simple: fewer interruptions during specific hours. Not distance from the relationship.

**Reframe it around reassurance instead of restriction.** Something like: "I get anxious in meetings if my phone keeps buzzing, because I worry it's something urgent. Can we do a check-in call at lunch and another in the evening, so you know I'll always talk to you at those times?" This offers something instead of only taking something away, which tends to matter more than the actual content of the request.

**Then hold it.** The first few times the calls come outside the agreed windows, don't pick up. A short text instead: "In a meeting, will call at lunch like we said." No lengthy explanation, no apology, no re-litigating it every time. In most cases, the pattern shifts within a few weeks, mostly because the new routine keeps proving itself reliable.

## What makes this work

A few things, and they apply well beyond phone calls:

Framing the request around a shared goal, like a parent's peace of mind, rather than around your independence, is usually a much easier idea for Indian parents to accept, even when the practical outcome is identical.

Offering structure instead of plain refusal changes the message entirely. "Not now, but definitely at this time" lands very differently from "stop calling me."

Not re-explaining it every single time matters more than people expect. The first conversation does the explaining. After that, consistency does the work, not repeated justification. Re-explaining a boundary every time you hold it quietly signals that it's still up for debate.

And the boundary doesn't need a parent's approval to be real. It has to be held whether or not they initially like it. That's usually the actual test of whether something is a boundary, or just a request you're hoping gets a yes.

## Where this gets harder

Not every boundary is about phone calls. Some are about marriage timelines, career choices, money, or how much of your personal life you disclose, and those carry far more weight and history behind them. The same approach (find the shared goal, offer structure instead of refusal, hold it without over-explaining) still applies, but the emotional cost of holding it can be much higher, and the guilt that follows can sit for a lot longer than a few weeks.

If holding the line leaves you replaying the conversation for days afterwards, that loop is worth understanding on its own terms — [overthinking versus anxiety](/blog/overthinking-vs-anxiety) covers why it doesn't respond to being reasoned with.

If you're in the middle of that kind of boundary right now, and the guilt or the pushback is bigger than you expected, that's worth working through with someone rather than white-knuckling it alone. A lot of what makes these conversations hard isn't the script, it's everything underneath it: old patterns, old fears about disappointing your parents, and sometimes grief about a relationship that isn't quite what you wish it were.

I work with young adults on exactly this kind of family dynamic, using an approach drawn from CBT, humanistic therapy, and trauma-informed care, shaped around your specific family rather than a generic script. Sessions run on a sliding scale (₹500–₹1000). [You can read more or book a session here.](/?intake=true)

${CRISIS_NOTE}`,
  },
];
