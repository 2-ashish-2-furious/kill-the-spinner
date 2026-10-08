# Local-First: Kill the Spinner

**Format:** 25-minute slot — 21:00 of content + ~4:00 Q&A
**Audience:** Web engineers building data-heavy internal tools. No distributed-systems background assumed.
**Tone:** Practical architecture walkthrough with honest tradeoffs. Not a rewrite-everything pitch, not a vendor pitch.

---

## Thesis

We read the Ink & Switch local-first paper and **took exactly one of its seven ideals** — "No spinners" — and shipped it. We did not build a local-first application. We built a normal server-authoritative app whose reads come from a live local replica.

That scoping *is* the talk. It's honest, it's achievable inside a sprint, and it's the version of local-first that most internal tools should actually want. The closing act explains why the other six ideals are still hard — using the postmortems of the teams who tried hardest.

**Narrative spine:** show the result → explain the mechanism → name the source of the idea → declare what we deliberately did *not* take → the bill we paid → why the full set is still out of reach.

---

## Structure at a glance

| Act | Time | Job |
|---|---|---|
| 1. The Hook | 0:00–3:30 | Before/after demo. No theory yet. |
| 2. What Just Happened | 3:30–6:00 | The code delta and the one-line mechanism |
| 3. Where The Idea Came From | 6:00–9:30 | The paper, the seven ideals, **"we took one"** |
| 4. The Pattern, Not The Products | 9:30–12:30 | Three replaceable roles |
| 5. What It Cost Us | 12:30–16:30 | The four walls — the substance |
| 6. Why All Seven Is Hard | 16:30–21:00 | Offline demo + two postmortems + close |

**Engagement engine — four beats:**

| Time | Beat |
|---|---|
| 1:15 | The app is instant (visceral, before any explanation) |
| 8:00 | "We took one ideal out of seven, on purpose" (subverts the title's implied promise) |
| 17:00 | An offline write silently vanishes (tension) |
| 18:00 | The team best equipped to build the full ideal deleted their own implementation (authority flip) |

---

## Slide-by-slide

### Act 1 — The Hook (0:00–3:30)

#### S1 · Title + 20 seconds of orientation (0:00–0:30)

**On screen:** `Local-First: Kill the Spinner`

**Script:** I'm going to show you two versions of the same internal tool before I explain anything. Same data, same database, same feature set. Watch the top-left corner of the screen — that's where the spinner lives.

**Why this is short:** resist the urge to set up the problem for three minutes. The demo *is* the problem statement.

---

#### S2 · The before (0:30–1:15)

**On screen:** Live or recorded — the fetch-and-spinner version. Open the grid (spinner). Apply a filter (spinner). Edit a cell (spinner, row jumps). Navigate away and back (spinner).

**Script:** Nothing here is broken. This is a competent app, built the way we all build them. Count the waits.

**Note:** You need this baseline. "Instant" is not impressive in isolation — it's only impressive as a contrast.

---

#### S3 · The after (1:15–3:30) — **BEAT 1**

**No slides.** *"Laptops down for two minutes, this one only works if you watch it."*

Beats, in order:

1. Same app, rebuilt. Open the grid — **already populated.** Filter, sort, navigate — instant, no spinner anywhere.
2. Second browser window side by side. Type in the left → appears in the right immediately. **Let the silence sit.**
3. Open the Network panel. Filter, sort, navigate again → **zero requests.** Tap the empty panel.
4. Throttle to Slow 3G. Add a record → still instant. *"The network is still slow. The UI just stopped waiting for it."*

**Script to close the act:** No spinner, no loading skeleton, no refetch after the edit. Now let me show you how little code that took, and then be honest with you about what it cost.

---

### Act 2 — What Just Happened (3:30–6:00)

#### S4 · The code delta (3:30–5:00)

**On screen:** Before and after, side by side. Framework-neutral labels — no library names yet.

```
BEFORE                          AFTER
fetch on mount              →   read from local replica
isLoading branch            →   (deleted)
render                          render
mutate + await              →   write locally, sync in background
invalidate + refetch        →   (deleted)
```

**Script:** Two things are gone: the loading branch and the invalidation. They're gone for the same reason — there's no cache to be stale, because there's a replica that's already correct.

---

#### S5 · The mechanism in one sentence (5:00–6:00)

**On screen:** A diagram, five boxes:
`database → sync engine → local replica in browser → live query → UI`
plus a separate return arrow: `UI → write path → database`

**Script:** Reads come from memory in the browser, kept live by a sync engine. Writes apply locally straight away, then travel to the server on a *separate* path, and get confirmed asynchronously. Reads and writes take different routes — remember that, it's why the last act of this talk exists.

---

### Act 3 — Where The Idea Came From (6:00–9:30)

#### S6 · The paper (6:00–7:00)

**On screen:**
> "Local-first software: You own your data, in spite of the cloud"
> Ink & Switch, April 2019
> https://www.inkandswitch.com/essay/local-first/

Plus the definitional quote:

> "we treat the copy of the data on your local device — your laptop, tablet, or phone — as the primary copy."

**Script:** This is where we got the idea. It's a 2019 research essay, and it's excellent — read it this week. It defines local-first software around one architectural commitment: the copy on your device is the *primary* copy. Not a cache. Primary.

---

#### S7 · Seven ideals (7:00–8:00)

**On screen:** All seven, in the essay's own words:

1. "No spinners: your work at your fingertips"
2. "Your work is not trapped on one device"
3. "The network is optional"
4. "Seamless collaboration with your colleagues"
5. "The Long Now"
6. "Security and privacy by default"
7. "You retain ultimate ownership and control"

**Script:** Ideal number one is literally called "No spinners." I stole the title of this talk from a 2019 research paper.

**Engagement:** Reliable laugh, and it signals you read the source rather than the launch blogs.

---

#### S8 · We took one. (8:00–9:30) — **BEAT 2** — *the honest centre of the talk*

**On screen:** The seven ideals again. Ideal #1 highlighted. The other six greyed out.

**Script:** Here's the part I want to be very clear about, because a lot of talks with "local-first" in the title are not.

We did not build a local-first application. We took ideal number one and left the other six on the table — deliberately. Our data still lives on a server, the server is still the source of truth, and if that server goes away our users have nothing. By the paper's own definition, what I just demoed **is not local-first software.** It's a normal client-server app that reads from a live replica.

And that was the right call for an internal tool. We wanted the feel of ideal one; we did not want to take on ideals three through seven, which — as I'll show you at the end — is a *dramatically* larger project than it looks.

**Why this slide matters:** it inoculates you against the only real attack on this talk, it makes the scope credible, and it sets up Act 6 as a payoff instead of a confession.

---

### Act 4 — The Pattern, Not The Products (9:30–12:30)

#### S9 · Three replaceable roles (9:30–11:00)

**On screen:**

| Role | What it does | Where it runs |
|---|---|---|
| **Sync engine** | Streams a filtered subset of server data to clients and keeps it live | Server + wire protocol |
| **Local store + query layer** | Holds the replica in memory, answers queries reactively, manages optimistic state | Browser |
| **Write path** | Takes local writes to the server and confirms them | Your existing API |

**Script:** This is the pattern. Three roles. We happened to fill them with a particular set of libraries, but the important thing is that they're three *separate* decisions, and the third one is usually your existing API — you don't replace it.

**Why this slide exists:** it's what stops the talk becoming a product walkthrough. The audience should leave needing three pieces, not two package names.

---

#### S10 · What else fits each slot (11:00–12:30)

**On screen:**

| Role | Options |
|---|---|
| Sync engine | ElectricSQL, Zero (Rocicorp), PowerSync, Replicache |
| Local store + query | TanStack DB, LiveStore, TinyBase, PGlite |
| Write path | Whatever you already have — REST, tRPC, GraphQL |

Then a second row, set apart:

> **Different family entirely:** Automerge, Yjs, Loro, Liveblocks — these make the *client* replica primary and merge with CRDTs. That's the road to the other six ideals, and it's Act 6.

**Script:** Name what we used, in one sentence, and move on. *"We used ElectricSQL for the sync engine and TanStack DB for the local store, on top of the tRPC API we already had. Any row in this table would have taught the same lesson."*

**⚠️ Verify this slide before presenting** — see Accuracy Flags.

---

### Act 5 — What It Cost Us (12:30–16:30) — *the substance*

> This act is the most valuable in the talk because it's the part only you can give — it comes from your build, not from anyone's docs. Use real war stories. If you haven't personally hit one of these four, say so plainly: *"we hit the first two; the other two are well documented and we're expecting them."*

#### S11 · Wall 1 — Authorization becomes a sync boundary (12:30–14:00)

**On screen:** The shape/subscription definition with its filter clause highlighted in red.

**Script:** This is the big one. You're no longer authorizing *endpoints*, you're authorizing *subsets of tables*, and the filter has to live on the server where the client can't touch it. Get an endpoint wrong and you leak one response. Get a sync filter wrong and you replicate a table into somebody's browser.

Concrete example worth showing: a shape with no filter at all, syncing every user row to every logged-in client. Easy to write, invisible in the UI, and now sitting in devtools for anyone to read.

Support with Electric's own position on this — they explicitly declined to solve it for you: *"A sync engine may provide some hooks and options but should not prescribe a solution."*

---

#### S12 · Wall 2 — Data loading becomes your job again (14:00–15:00)

> **Corrected — do not present the old version of this wall.** The naive framing ("only works for small datasets") is out of date. Query-driven sync changes the ceiling substantially. See Appendix B.

**On screen:** The three sync modes, verified present in this codebase's installed `@tanstack/electric-db-collection`:

| Mode | Behaviour |
|---|---|
| `eager` *(default)* | Syncs everything on preload; ready when complete |
| `on-demand` | Syncs incremental snapshots **as the collection is queried**; ready after the first snapshot |
| `progressive` | Full sync in the background, with incremental snapshots giving a fast path to what queries need first |

**Script:** The naive version of this wall is "it only works for small datasets." That was true and it's now mostly wrong. With `on-demand`, the predicates from your live queries get pushed down to the collection, and it syncs matching subsets at runtime. The shape you defined server-side becomes the **outer boundary** of what *could* ever sync; the subsets are ANDed inside it. That gives you pagination and infinite scroll over datasets far larger than memory.

So the real wall isn't row count, it's that **data loading is a design decision again** — the thing sync promised to take away. You're now choosing per collection whether it's eager, on-demand, or progressive, and getting it wrong shows up as either a slow first paint or a stall mid-scroll. That's a better problem than the one you had, but it isn't zero.

**Say this:** *"Sync doesn't delete data loading. It moves it from your components into your collection configuration, which is a much better place for it — but you still have to think."*

---

#### S13 · Wall 3 — Conflicts (15:00–16:00)

**On screen:** Two users, same field, two values, one survivor.

**Script:** Because the server owns the primary copy, conflict resolution is row-level last-write-wins. Two people edit the same field, one silently loses. There's no CRDT in this architecture to save you — that's the other family. So the question for your domain is: *is silent overwrite acceptable here?* For a status field on an internal ticket, usually yes. For anything a human typed at length, no.

---

#### S14 · Wall 4 — Schema migrations (16:00–16:30)

**On screen:** A migration rippling out to N browsers running yesterday's bundle.

**Script:** Your schema changes now propagate to live replicas in browsers you don't control, running whatever version of the app they loaded this morning. Additive changes are fine. Renames and type changes need the same care you'd give a mobile app release.

---

### Act 6 — Why All Seven Is Hard (16:30–21:00)

#### S15 · Live: watch ideal #3 fail (16:30–17:30) — **BEAT 3**

**No slides.** Back to the demo app.

1. Devtools → Offline.
2. Add a record. It appears. **Wait.** It vanishes.
3. Reload while still offline → blank page.

**Script:** That's not a bug, that's the architecture, and it's the clearest possible illustration of what "we only took ideal one" means. The server owns the primary copy, so my local write was only ever *tentative* — it needed a confirmation that never arrived, so it rolled back. And the reload failed because there is no durable local copy to boot from.

Ideal three is "the network is optional." For us the network is not optional. It's just no longer *in front of the user*.

---

#### S16 · The most expensive experiment in this space (17:30–19:00) — **BEAT 4**

**On screen:** Timeline, then quotes.

`v0.9 · 2024-01-24` → `v0.10 · 2024-04-10` → `v0.11 · 2024-05-14` → **pivot 2024-07-17** → `BETA · 2024-12-10` → `1.0 GA · 2025-03-17`

Source on slide: James Arthur, *"A new approach to building Electric"*, 2024-07-17 — https://electric.ax/blog/2024/07/17/electric-next

**Script:** So why didn't we just build the full seven? Because in 2024 a team of distributed-systems researchers did exactly that — bidirectional sync into an embedded client database, with finality of local writes as a core guarantee, which is essentially the paper's architecture. Eleven months later they deleted it and started over. Their postmortem is unusually candid:

> "Coming from a research background, we wanted the system to be optimal" — and so "we often picked the more complex solution from the design space."

> "The complexity of the stack has provided a wide surface for bugs."

> A system that "demos well, with magic sync APIs but that never actually scales out reliably."

> **"Electric Next is a sync engine, not a local-first software platform."**

And on the new sequencing:

> "start with read-path only" … "This explicitly reduces the capability of the system in the short term."

> "Electric Next embraces tentativity."

**Script to land it:** They reclassified themselves *out* of the category. Finality of local writes went from headline differentiator to, in their words, "no longer a key tenet of the system design." That's not a company failing — that's the strongest available evidence about how expensive ideals three through seven actually are.

---

#### S17 · And the other camp paid too (19:00–19:45)

**On screen:** Ink & Switch's own prototype findings.

**Script:** For symmetry, because otherwise I'm just doing a different vendor's marketing. The paper's authors built their own CRDT stack — Automerge, and three prototype apps — and reported honestly: merging worked reliably and paired beautifully with reactive UI code. *And* retained edit history bloated storage and performance, and network transport remained unresolved.

Both camps arrived at the same conclusion from opposite directions: **the ownership ideals are where the cost lives.** Which is why we took the one that was cheap.

---

#### S18 · Decision rule + close (19:45–21:00)

**On screen:**

**Kill the spinner when:** the data a user needs can be expressed as a query predicate · multiple users on shared data · read-heavy · latency is a real user complaint

**Keep fetching when:** the access pattern is scan-everything (analytics, aggregates over all rows) · report-shaped or one-shot · single user, single session · you can't own the authorization model

**Go all the way to CRDTs when:** offline is a hard requirement · concurrent edits to the same field are normal · users must own data independently of your service

**Script:** You don't have to pick a side in a research debate. Take ideal one, ship it, and know exactly which six you left behind and why.

**Final slide:** screenshot of an official starter template for one of these engines rendering a `Loading projects...` spinner on cold boot.

**Closing line:** This is an official starter for one of the tools I showed you, and on cold boot it shows a spinner — because with no durable local copy, there's nothing to boot from. We killed the spinner in the ninety-nine percent of interactions that happen after load. That was worth doing. The other six ideals are still waiting, and now you know what they cost.

**Note:** don't name the project on that slide. Same joke, no vendor.

---

## Demo build notes

### The before/after pair

- Keep **both versions of the same app** runnable. The contrast in S2→S3 is your strongest 45 seconds; don't fake it with slides.
- Local database + local sync engine, never a cloud endpoint. Conference wifi will humiliate you.
- Pre-seed data. An empty grid demos nothing.
- Editor font ≥18pt, browser zoom ≥150%, notifications off, clean browser profile.

### The offline rollback (S15)

- Rehearse this specifically. The record must stay visible long enough for the audience to *register* it before it disappears. If it vanishes in 200ms nobody sees the point — consider adding an artificial delay to the failure path for the demo build, and say that you did.

### Both

- **Record everything as video and embed it.** Present live if the room cooperates, cut to tape at the first sign of trouble.

### Optional, if you have prep time

A 30-second CRDT contrast in S17 — two `Y.Doc` instances in a single HTML file, both "offline," both edited, then merged losslessly — makes the final act land much harder because the audience *sees* the alternative rather than hearing about it. Implement the partition as a boolean that queues updates instead of applying them: no server, no build step, nothing that can fail on stage.

---

## Quote bank

All quotes below were checked against the live sources during preparation. Attribution required on-slide for every one.

### Ink & Switch essay

**Source:** *"Local-first software: You own your data, in spite of the cloud"*, Ink & Switch, April 2019 — https://www.inkandswitch.com/essay/local-first/

| Quote | Slide |
|---|---|
| "we treat the copy of the data on your local device — your laptop, tablet, or phone — as the primary copy." | S6 |
| the term reflects prioritizing "the use of local storage (the disk built into your computer) and local networks" | S6 |
| "No spinners: your work at your fingertips" | S7, S8 |
| "Your work is not trapped on one device" | S7 |
| "The network is optional" | S7, S15 |
| "Seamless collaboration with your colleagues" | S7 |
| "The Long Now" | S7 |
| "Security and privacy by default" | S7 |
| "You retain ultimate ownership and control" | S7 |
| CRDTs are "multi-user from the ground up" | S17 |
| servers persist as "cloud peers" "rather than as sources of truth" | S8 or S17 |

Also from the essay, for S17: the prototype findings — merging reliable and a good fit for reactive UI programming, but retained history bloats storage and performance, and network transport unresolved. Built on Automerge and Hypermerge, with the Trellis, Pixelpusher and PushPin prototypes.

Optional for S8: the essay's comparison table scores Firebase/CloudKit/Realm as ✗ on longevity, privacy and user control — a useful way to show that "fast cloud app with live sync" is a known, named category that isn't local-first.

### Electric's pivot announcement

**Source:** James Arthur, *"A new approach to building Electric"*, 2024-07-17 — https://electric.ax/blog/2024/07/17/electric-next

| Quote | Slide |
|---|---|
| **"Electric Next is a sync engine, not a local-first software platform."** | S16 — headline |
| "Coming from a research background, we wanted the system to be optimal" | S16 |
| "we often picked the more complex solution from the design space" | S16 |
| "These decisions not only made Electric more complex to use but also more complex to develop." | S16 |
| "The complexity of the stack has provided a wide surface for bugs." | S16 |
| "demos well, with magic sync APIs but that never actually scales out reliably" | S16 |
| "start with read-path only" | S16 |
| "This explicitly reduces the capability of the system in the short term." | S16 |
| "Electric Next embraces tentativity." | S16 |
| "A sync engine may provide some hooks and options but should not prescribe a solution." | S11 |

Supporting material from the same post: it cites Gall's law — "A complex system that works is invariably found to have evolved from a simple system that worked" — and *Worse is Better*: "there is a point where less functionality ('worse') is a preferable option ('better')." Also that websockets were dropped for HTTP because they "are also more stateful and harder to cache," and that the old codebase is frozen — "we are not supporting the old system."

### Electric × TanStack DB announcement

**Source:** *"Super fast apps on sync with TanStack DB"*, Electric, 2025-07-29 — https://electric.ax/blog/2025/07/29/super-fast-apps-on-sync-with-tanstack-db

| Quote | Slide |
|---|---|
| "Eliminating stale data, loading spinners and manual data wiring." | S4 — near-perfect caption for the code delta |
| "local-first application code talks directly to a local store interface." | S5 |
| Tanner Linsley: "I think ideally every developer would love to be able to interact with their APIs as if they were local-first." | S1 or S9 |
| a shape is "a filtered view on a database table" | S11 |
| "The next frontier, with much bigger gains, across UX, DX and AX lies in local-first, sync engine architecture." | S10 |

Scale figures from this post if anyone asks in Q&A: a cited 80Gbps / one-million-client benchmark, and Trigger.dev at roughly 20k writes/sec.

### Version timeline (S16)

From https://electric.ax/blog

| Date | Event |
|---|---|
| 2024-01-24 | ElectricSQL v0.9 released |
| 2024-04-10 | v0.10, shape filtering |
| 2024-05-14 | v0.11, Postgres in the client — last of the pre-pivot line |
| **2024-07-17** | **"A new approach to building Electric"** — the pivot |
| 2024-12-10 | Electric BETA release |
| 2025-03-17 | Electric 1.0 released |
| 2025-07-29 | TanStack DB integration announced |

---

## Resources & further reading

### Primary — verified during preparation

- **Ink & Switch**, *Local-first software: You own your data, in spite of the cloud*, April 2019 — https://www.inkandswitch.com/essay/local-first/
- **James Arthur / Electric**, *A new approach to building Electric*, 2024-07-17 — https://electric.ax/blog/2024/07/17/electric-next — the richest source of honest tradeoff quotes in this space.
- **Electric**, *Super fast apps on sync with TanStack DB*, 2025-07-29 — https://electric.ax/blog/2025/07/29/super-fast-apps-on-sync-with-tanstack-db
- **Electric**, architecture summary — https://electric.ax/AGENTS.md — concise statement of the current model: read-path sync only, writes through your own API, mandatory transaction-id handshake.
- **Electric blog index** — https://electric.ax/blog

### Research — ⚠️ confirm citation details before putting on a slide

- **Shapiro, Preguiça, Baquero, Zawirski**, *Conflict-free Replicated Data Types*, SSS 2011 — the foundational CRDT paper.
- **Kleppmann & Beresford**, *A Conflict-Free Replicated JSON Datatype*, IEEE TPDS 2017 — basis for Automerge's data model.
- **Kleppmann**, *CRDTs: The Hard Parts* (talk) — best accessible account of where CRDTs get expensive; good Q&A backup for S17.
- **Ink & Switch**, *Peritext* — rich-text CRDT, if formatting conflicts come up in Q&A.

### Engines — ⚠️ verify current positioning before S10

- Sync engines: **ElectricSQL** · **Zero** (Rocicorp) · **PowerSync** · **Replicache**
- Local store / query: **TanStack DB** · **LiveStore** · **TinyBase** · **PGlite**
- CRDT family: **Automerge** · **Yjs** · **Loro** · **Liveblocks** · **Jazz**
- Community: **localfirstweb.dev** and the Local-First Conf talks for current state of the field.

---

## Accuracy flags

Check each before presenting — this audience will include people who have read the same sources.

1. **The essay's author list.** Commonly cited as Kleppmann, Wiggins, van Hardenberg and McGranaghan. Confirm order and spelling from the essay page before crediting on S6.

2. **The pivot post never says "CRDT" or "SQLite."** It refers generally to syncing "into embedded databases in the client." The old line *was* CRDT-based, but source that from the v0.x docs rather than this post. **Safe phrasing, directly supportable:** *"bidirectional sync into an embedded client database, with finality of local writes."*

3. **S10's landscape.** Positioning moves fast in this space. Re-check each entry — particularly whether any server-authoritative engine has since shipped durable offline support, which would undercut S15.

4. **Research citations.** Verify venue, year and authors. A wrong citation in a talk that leans on rigor costs more than an omitted one.

5. **Your own war stories in Act 5.** Only claim walls you actually hit. "We hit two of these, the other two are documented and we expect them" is a stronger line than implying four battle scars.

---

## Submitted-abstract reconciliation

Your accepted abstract promises two things this structure de-emphasises:

- *"Go offline and the app keeps working; come back online and it reconciles automatically"* — the demo does **not** do this, and S8/S15 now openly say so. If the CFP still allows edits, replace with something like: *"And offline — the thing everyone assumes local-first gives you for free — turns out to be a separate and much larger commitment. I'll show you live exactly where that line sits."* Turns the gap into a hook.
- *"the engines making it real today and the CRDT ideas underneath them"* — CRDTs are **not** underneath the stack you're demoing; they're the other family. Suggested replacement: *"why these engines split into two families that disagree about something fundamental: who owns the primary copy of your data."*

If the abstract is locked, cover the gap verbally at S8 — *"the abstract for this talk promised you offline; let me tell you what I found when I actually tested that"* — which is a genuinely good moment and makes the honesty feel deliberate rather than corrective.

---

## If you're running long

Cut in this order:

1. **S14** (migrations) — fold into one sentence on S13. Saves 30s.
2. **S17** compressed to a single sentence inside S16. Saves 45s. *Don't cut entirely* — it's what keeps the ending balanced rather than anti-CRDT.
3. **S2** (the before) trimmed to two spinner beats instead of four. Saves 20s.
4. **S3 beats 3 and 4** (empty network panel, 3G throttle) — keep 1 and 2. Saves 40s.

**Never cut:** S3 beats 1–2 (the demo), **S8 (we took one)**, S11 (authorization), S15 (offline rollback), S16's headline quote. Those five carry the whole argument.

---
---

# Appendix — Q&A preparation

Answers are grounded in the cited sources and in this codebase. Where the honest answer is "that's a real weakness," it says so — conceding a limitation cleanly costs you nothing and buys you the room.

**Three rules for this Q&A:**
1. If you don't know, say "I don't know, I'd have to test that." This talk's whole credibility rests on the S8 admission; hedging in Q&A undoes it.
2. Route anything about ideals 3–7 back to S8: *"that's one of the six we didn't take, and here's why."*
3. Have the numbers ready. Vague answers about scale and volume are where this architecture loses skeptics.

---

## A. Security & authorization

*Expect the most questions here, and the hardest ones. This is the area where the architecture genuinely shifts risk rather than removing it.*

---

**Q1. You're replicating chunks of my database into browsers. How is that not a data leak waiting to happen?**

The perimeter moves from "which endpoint" to "which rows and columns," and it has to live on the server.

- Shape definitions must be built server-side, in a proxy you control. Electric's own guidance is explicit: define shapes in the server/proxy, with **no client-defined tables or WHERE clauses**.
- In this codebase every sync route builds the filter itself and never trusts the client — the proxy helper only forwards Electric protocol parameters, so a client cannot inject a table name or widen a predicate.
- The failure mode is worse than a normal API bug, and that's the honest part: get an endpoint wrong and you leak one response; get a shape filter wrong and you replicate a table.

**Say this:** *"It's the same authorization problem you already have, but the blast radius of a mistake is bigger and the mistake is invisible in the UI. That's why it's wall number one and not a footnote."*

---

**Q2. Can I do column-level security, or is it all-or-nothing per table?**

Both are available. A shape is a single table plus an optional `where` clause and an optional `columns` list — so you can project away columns the client shouldn't receive (salary, internal notes, PII) as well as filter rows. Constraint to know: shapes are **single-table only**, so anything needing a join for its authorization decision has to be denormalized, resolved in the filter, or kept off the sync path entirely.

---

**Q2b. If live queries in the client now drive what gets synced, hasn't the client taken control of the query? Isn't that the injection risk you just said to avoid?**

*A sharp question, and the answer is genuinely reassuring — worth rehearsing because it lands well.*

No, because the two operate at different levels. The **shape you define server-side remains the outer boundary**, and runtime subsets are ANDed *inside* it. The client can only ever **narrow**, never widen. A malicious predicate gets you a smaller result set, not somebody else's rows.

**Say this:** *"The server declares the ceiling once, the client picks windows underneath it. That's the right split — authorization stays where you can audit it, and data loading moves to where the UI actually knows what it needs."*

Two things to still get right: your outer shape must be correctly scoped, because everything below inherits it; and if you're reflecting client predicates into a query-collection fetch, that's your own endpoint and your own parameter validation applies as usual.

---

**Q3. Is the sync service itself exposed to the internet?**

This is the single biggest footgun in the whole architecture, so answer it directly: **Electric's HTTP API is public by default.** It must sit behind your own authenticating proxy, and the source credentials must never reach the browser.

Concretely, in this codebase: each sync route validates the session first and returns 401 before any proxying happens, and the Electric source ID and secret are read from server-side environment variables inside the proxy layer — they're never serialized to the client.

Worth showing on the slide or saying out loud: the local dev setup in this starter runs Electric with `ELECTRIC_INSECURE: true`, carrying its own comment that it is *"Not suitable for production."* That's a good, humble example — the default developer experience is the insecure one, and you have to opt into safety.

---

**Q4. What happens when I revoke a user's access? Does an open stream keep feeding them data?**

The HTTP-based design helps here, and it's a deliberate part of the pivot. Because sync is long-polling over HTTP rather than a stateful websocket, **every poll cycle is a fresh HTTP request through your proxy**, so your session check runs again and a revoked user's next cycle fails. Revocation takes effect within roughly one poll interval rather than requiring you to hunt down and kill a socket.

Electric replaced the websocket protocol for exactly this class of reason — websockets "are also more stateful and harder to cache" — and the new API "minimises state, making the sync engine more reliable and easier to scale out," which let auth move out to HTTP proxies and CDNs.

**⚠️ Important correction to the naive version of this answer.** Long polling here is *not* a fixed-interval poll — the client holds the connection open and it returns the instant data arrives, then reconnects. That means re-authentication happens **on reconnect, which happens after a batch of changes** — so on a *quiet* stream with no writes, the connection can stay open and no re-auth occurs for as long as the connection lives.

Practical consequence: revocation latency is bounded by change traffic, not by a timer. If you need hard revocation guarantees, enforce a maximum connection lifetime at your proxy rather than relying on natural reconnects. Electric also offers an SSE mode for high-frequency streams, which reconnects on a longer cycle (on the order of minutes) — so that mode *widens* the window rather than narrowing it.

**Don't assert a number you haven't measured.** "Bounded by reconnect, and we cap connection lifetime at the proxy" is the answer that will satisfy a security reviewer.

---

**Q5. You mentioned CDN caching. Can one user's rows get served to another user?**

Yes, if you misconfigure it — and this is a real risk worth naming rather than waving away. Shape responses are cacheable HTTP, which is where the scale story comes from, but that means cache keys must account for identity. This codebase sets `vary: cookie` on every proxied response and strips content-encoding and content-length headers so the response isn't mangled in transit.

**Say this:** *"Cacheability is the feature and the risk in the same sentence. If you take one operational note from this talk, it's to test cross-user cache isolation explicitly, in staging, with two real sessions."*

---

**Q6. Can a compromised client write whatever it wants?**

No, and this is the part of the architecture that is genuinely *safer* than people expect — because **writes don't go through the sync engine at all.** They go through your existing API, with your existing authorization.

In this codebase the mutation handlers re-check ownership in SQL on every update and delete, not just at the shape boundary, and return `NOT_FOUND` if the row isn't the caller's. A client can *ask* for anything; the server still decides.

Follow-up you'll get — *"but the optimistic update showed the change instantly, doesn't that mean it happened?"* No. Optimistic state is local to that one browser. Other clients only ever see what Postgres actually accepted. A rejected write rolls back on the originating client and is never visible to anyone else.

---

**Q7. Is the replicated data encrypted at rest in the browser?**

No — and in this configuration there's nothing at rest to encrypt. The replica is **in memory only**: no `localStorage`, no IndexedDB, no persistence layer anywhere in this codebase. Reload the tab and it re-syncs from scratch.

That's an accidental privacy benefit worth naming: on a shared or kiosk machine, closing the tab leaves nothing behind. The moment you add durable local persistence to get closer to ideal three, you inherit a real at-rest encryption problem — which is one more reason the ownership ideals cost more than they look.

The one thing that *does* persist is the auth session cookie, exactly as in any conventional app.

---

**Q8. What about the paper's ideal six — "security and privacy by default"? Doesn't your architecture fail that?**

Yes. Fail it outright, and say so. The server holds everything in plaintext, is the source of truth, and can read every row. There's no end-to-end encryption anywhere in what you demoed.

Route it to S8: that's ideal six, it's one of the six you didn't take, and getting it requires client-authoritative architecture where the server is a relay that can't read the payload — the CRDT family, not this one. The paper's own comparison table scores conventional realtime-cloud stacks as failing on privacy, longevity and user control; you're in that category and you should own it.

---

## B. Compliance & data governance

---

**Q9. GDPR — if I delete a user's data, is it also gone from every browser that synced it?**

Deletions propagate down the sync stream like any other change, so connected clients drop the rows. And because nothing is persisted locally, a client that simply closes the tab retains nothing.

Be careful with the general version of this claim: it's true *for this configuration*. Add durable local persistence and you've created copies of personal data on devices you don't control, with no reliable way to reach a client that never reconnects. That's a compliance conversation, not a technical one, and it's worth having before you turn persistence on.

---

**Q10. Data residency — does syncing to browsers move data across borders?**

It moves data to wherever your users are, over CDN infrastructure if you use it. If you have residency constraints, the CDN edge configuration and the shape filters both become compliance surfaces. No different in kind from serving API responses, but the volume is larger and the caching is more aggressive, so it's worth explicitly reviewing rather than assuming your existing API posture carries over.

---

**Q11. Audit logging — can I still tell who read what?**

Reads are now poll cycles against shapes, not discrete business-level queries, so "user X viewed record Y" gets harder to reconstruct. You know a user subscribed to a filtered set; you don't know which rows they looked at. If read-auditing is a hard requirement in your domain, that's a genuine argument for keeping those tables on a conventional fetch path — and a good example of the mix-and-match point from S12.

---

## C. Scale, cost, and limits

---

**Q12. How many rows can I actually sync? What's the ceiling?**

*Answer updated — the old "bounded working sets only" answer undersells current capability.*

The ceiling is much higher than people assume, because you don't have to sync the whole table. Three modes are available: `eager` (everything up front), `on-demand` (subsets synced as your live queries ask for them), and `progressive` (full sync in the background, with fast-path snapshots for what's needed first).

With `on-demand`, live query predicates are pushed down to the collection and it syncs matching subsets at runtime. Electric's own demo of this pattern runs a Linear clone over **500,000 issues** with instant initial load and infinite scroll — the client only ever holds what's been asked for.

So reframe the question: it's not "how many rows are in the table," it's **"can the data this user needs right now be expressed as a query predicate?"** If yes, size stops being the binding constraint. If your access pattern is genuinely "scan everything" — analytics, reporting, aggregate-over-all-rows — then keep it on a conventional fetch, because that's a warehouse query, not an app query.

Honest caveat: this pushes complexity into choosing the right mode per collection, which is wall two on the slide.

---

**Q13. Doesn't this hammer my server? Every client holding an open connection?**

The scale story is the reason the pivot chose HTTP. Because responses are plain cacheable HTTP, fan-out is a CDN problem rather than an application-server problem. Electric cites an 80Gbps / one-million-client benchmark, and Trigger.dev running at roughly 20k writes per second.

Caveat honestly: those are the vendor's own numbers on their own infrastructure, and your shape design determines cache hit rate. Highly personalized shapes cache worse than shared ones.

---

**Q14. What's the actual read latency you're claiming?**

Local queries against the in-memory replica, with incremental recomputation via differential dataflow — the claim is sub-millisecond, comfortably inside a single animation frame. That's the mechanism behind the demo: it isn't a faster network, it's no network on the read path at all.

---

**Q15. Are writes slower now, with that confirmation handshake?**

*Perceived* latency drops to zero, because the UI updates before the round-trip. *Actual* confirmation is your normal API call plus replication lag before the change comes back down the stream. So end-to-end it's marginally longer than a plain mutation; the user never experiences that, because they aren't waiting on it. The tradeoff is that a failure surfaces *after* the user has moved on, which means your error UX has to handle late rollback — that's real work, and it's easy to skip until it bites.

---

**Q16. My dev environment felt slow when I tried something like this. Why?**

Almost certainly the **HTTP/1.1 six-connection-per-origin limit** — many concurrent shape streams starve each other. The fix is an HTTP/2-capable proxy in front of the sync service. This codebase does exactly that: the dev server runs over HTTPS via a Caddy plugin specifically to get HTTP/2. It's the single most common local-dev complaint and it looks like an engine performance problem when it's a transport limit.

---

## D. "Why not just…" — the skeptic block

*These are the questions most likely to derail you. Have crisp answers.*

---

**Q17. What does this give me that React Query with a long `staleTime` and prefetching doesn't?**

The most important question in the room. Concede the overlap immediately, then draw the line.

For a **single user reading their own data**, aggressive caching and prefetching genuinely gets you most of the way, and if that's your situation you should do that instead — it's less machinery. What it doesn't give you:

- **Cross-client liveness.** Another user's edit appears in your UI without you building a notification path.
- **Deleting invalidation.** With a replica there's no cache-coherence problem to solve, so the entire category of "which queries do I invalidate after this mutation" disappears. That's the DX win, and it's bigger than the latency win.
- **Cross-collection queries.** You can join and aggregate across synced tables locally, which cache-per-endpoint can't do without assembling responses by hand.

**Say this:** *"If your complaint is 'my app feels slow,' caching may be enough. If your complaint is 'my app is slow AND I keep writing invalidation bugs AND users want to see each other's changes,' that's when this earns its complexity."*

---

**Q18. Why not just build this myself with websockets and a store?**

You can, and people do — the honest answer is that you'd be building the sync engine, which is the hard part. Electric's own postmortem identifies the sync component as where the complexity concentrates and the piece that's hardest to build yourself, and their team of distributed-systems researchers still reported that their stack "provided a wide surface for bugs" and that the complexity made it "more complex to develop."

The trap they name explicitly is worth quoting, because it's the trap a homegrown version falls into too: a system that *"demos well, with magic sync APIs but that never actually scales out reliably."*

---

**Q19. Why didn't you use CRDTs?**

Because we didn't need ideals three through seven, and CRDTs are the price of admission for them. Our conflicts are row-level on internal records where last-write-wins is acceptable. Nobody is co-editing prose.

Add the symmetry so it doesn't sound dismissive: the paper's own authors built a CRDT stack and reported that merging worked reliably and paired well with reactive UI code, but that retained history bloated storage and performance and network transport remained unresolved. It's a real cost, paid for real capability. If your product is a collaborative editor, pay it. For an internal grid, don't.

**Important nuance — it's not either/or.** Don't present the two families as mutually exclusive, because you can compose them: the write you send to the server can be a logical operation applied to a CRDT structure stored *in* Postgres (`pg_crdt`), and there are Yjs and Automerge integrations for exactly this. So the realistic architecture for a mostly-CRUD app with one collaborative text field is server-authoritative sync everywhere, plus a CRDT for that one field.

**Say this:** *"You pick per-field, not per-app. Most of our data is last-write-wins and that's correct. If we add a collaborative description field tomorrow, that field gets a CRDT and nothing else changes."*

---

**Q20. Isn't this just Firebase with extra steps?**

Architecturally it's in the same family — server-authoritative live sync — and you should concede that rather than fight it. The differences that matter in practice: it's your own Postgres with SQL, your existing ORM and migrations, and your existing API for writes, so you're not adopting a proprietary data model or a proprietary query language, and there's no lock-in on the write path.

Sharp version, if you want it: by the paper's scorecard, Firebase-style realtime cloud fails longevity, privacy and user control — and so does this. Being honest that you're in that category is stronger than pretending you've escaped it.

---

**Q21. Vendor risk — what if this tooling changes direction again?**

The best possible answer is on your own S16 slide, so don't dodge it: this ecosystem **already** had a hard pivot. The old line was frozen, with the maintainers stating plainly *"we are not supporting the old system."*

Mitigation is the S9 three-roles slide: because the write path stays on your own API and the sync engine is a separate, swappable role, the blast radius of an engine change is the sync layer, not your application. Also note the intended migration ergonomics run both ways — you can swap the collection's data source without touching components, which is the same seam you'd use to swap engines or retreat to plain fetching.

---

## E. Operations & developer experience

---

**Q22. What are the database requirements?**

Postgres 14 or later, logical replication enabled, and a user with the REPLICATION role. If you're on MySQL or MongoDB, this specific engine isn't for you — PowerSync covers other backends, and that's a reason the S9/S10 framing matters more than the product names.

---

**Q23. How do you handle schema migrations against live replicas?**

Additive changes are safe. Renames, type changes and column removals need the discipline you'd apply to a mobile app release, because browsers are running whatever bundle they loaded this morning against your new schema. Expand-and-contract works: add the new column, dual-write, migrate readers, then drop. It's wall four for a reason.

---

**Q24. Does this work with SSR? What about SEO?**

Not really, and it's a genuine limitation worth conceding. In this codebase the authenticated routes explicitly disable SSR, because the replica and the session both live client-side. For an internal tool behind a login that costs nothing. For a public, indexable, content-heavy page it's the wrong architecture — use conventional server rendering there and keep this for the app surface.

---

**Q25. How do you test it?**

Two layers, and be honest that this is less mature than testing a fetch-based app. Server-side, your sync routes are ordinary HTTP handlers — assert that they 401 without a session and that the filter is correct, which is your authorization test suite and the most important one you'll write. Client-side, collections can be driven with local-only or mock sources so components can be tested without a live sync engine.

---

**Q26. How do I debug what's actually in the replica?**

Devtools for the store, plus the fact that the wire format is plain HTTP and JSON — you can curl a shape endpoint and read exactly what a client would receive. That's an underrated benefit of the HTTP pivot over an opaque binary socket protocol, and it also makes the security review tractable: you can *see* what you're leaking.

---

**Q27. What's the incremental adoption path for an existing app?**

You don't rewrite. The documented path is roughly: wrap an existing fetch in a collection, switch reads to live queries, move mutations onto collection operations, then swap the collection's data source from your API to the sync engine. Components don't change in that last step, which means you can do the risky part — changing where data comes from — independently of the UI work, one route at a time.

---

## F. Questions to hope for

If nobody asks anything hard, seed one of these yourself — *"the question I usually get is…"*:

- **"Would you do it again?"** Ideal setup for a genuine, specific answer about which of the four walls actually hurt.
- **"What would you sync and what would you leave on fetch?"** Lets you make the mix-and-match point concretely, which is the most actionable thing in the talk.
- **"How long did it take?"** Concrete numbers here are more persuasive than any architecture diagram.

---

## G. If you get cornered

Three escape hatches that are honest rather than evasive:

- *"I don't know — I'd have to measure that. Find me afterwards and I'll tell you what we get."*
- *"That's one of the six ideals we deliberately didn't take, and it's hard for exactly the reasons in that postmortem slide."*
- *"That's a fair criticism and I don't have a good answer for it."* — Use it at least once if it's true. It buys back more credibility than a weak defence ever will.

---
---

# Appendix B — Material from James Arthur's conference talk

**Source:** James Arthur (co-founder/CEO, Electric) — conference talk transcript, venue and date not stated in the copy reviewed. **⚠️ Pin down venue and date before citing on a slide.** Mentions Sync Conf in SF and a track curated by "Dan," which should let you identify it.

This is a first-party source and it changes three things in the deck. Corrections are already applied in place above; this appendix holds the new material.

---

## B1. What this source corrected

| Deck item | Old claim | Corrected |
|---|---|---|
| **S12 / Q12** | "Only works for bounded working sets, ~10k rows" | Query-driven sync via `on-demand` handles 500k+ rows; the wall is now *choosing a sync mode*, not dataset size |
| **Q4** | "Re-auth happens each poll cycle" | Long poll holds open and returns on data arrival — a **quiet stream never re-auths**; cap connection lifetime at the proxy |
| **Q19 / S11** | Two families, pick one | Composable — CRDT structures can live in Postgres (`pg_crdt`, Yjs/Automerge integrations) under server-authoritative sync |

Verified independently in this repo's installed `@tanstack/electric-db-collection`: `syncMode` accepts `eager` (default), `on-demand`, and `progressive`. The transcript only mentions `on-demand`; `progressive` is real and is often the better default for a mid-sized table, so it's worth knowing about on stage.

---

## B2. Upgrade your demo

**This is the highest-value item in the transcript.** Electric's own demo is "LinearLarge" — a Linear clone over **500,000 issues** that loads instantly, with infinite scroll filling in subsets as you scroll, and filter predicates narrowing to ~25k issues live. The network panel shows the subset requests arriving.

Why this matters for your talk: a todo-list demo invites the objection *"sure, but that's twenty rows."* A large-dataset demo kills that objection before anyone raises it, and it's far more impressive. If you can seed your demo database with a few hundred thousand rows and switch the collection to `on-demand`, do it — it's probably a couple of hours of work for a substantially better S3.

Also steal the **hover preloading** detail: preloading a route's live queries on link hover gives you ~300ms of grace, so the data is already there when the user clicks. Small, concrete, and very demoable.

---

## B3. New questions to prepare

**Q28. Why long polling instead of WebSockets? Isn't that dated?**

The founder was asked this live and argued it as an operational choice, not a technical compromise. HTTP requests are stateless — deployable, observable, debuggable, and cacheable. WebSockets hold server-side state, complicate scaling, and are harder to debug. Adopting them is spending an "innovation token" to get streaming behaviour.

The payoff is specifically CDN-related, and it's the part worth repeating: because a shape subscription is just a URL, **CDN request coalescing** collapses many clients subscribed to the same shape into a single origin request. A whole workspace watching the same data costs the sync service one request.

Two follow-ups you should expect:
- *"Isn't long polling slow?"* No — the connection is held open and returns the instant data arrives. The overhead is the reconnect between batches, which can buffer changes under high write throughput.
- *"So what if I need presence or token streaming?"* There's an SSE mode that eliminates that buffering while staying on HTTP.

Color worth 10 seconds: Electric's other co-founder is Kyle Mathews, from Gatsby, and the CDN data-delivery approach draws on that experience.

---

**Q29. Isn't this a huge dependency? Am I shipping a database to the browser?**

No. TanStack DB is roughly a **20KB JavaScript dependency** — explicitly not a multi-megabyte WASM database. That's what makes incremental, one-route-at-a-time adoption realistic rather than theoretical.

If someone wants the actual in-browser Postgres, that's **PGlite** — a separate project, also from Electric, with its own sync adapter. Which leads to the next question.

---

**Q30. You said there's no persistence. Doesn't PGlite give you durable local state — so couldn't you have had offline?**

Concede this properly, because it's a fair challenge to S15. PGlite is Postgres compiled for the browser with a sync adapter, so **durable local storage is available in this ecosystem** — S15's rollback is a property of *our in-memory configuration*, not a hard ceiling of the family.

What durable reads still don't give you is offline *writes*. Those need a queue that survives reload plus a retry and reconciliation story, and the write path is deliberately left to you. So: persistence is buyable, ideal three is still a project, and the honest phrasing is *"we didn't take it"* rather than *"it's impossible."*

**Adjust S15's script accordingly** — say *"in the configuration we shipped"* rather than implying the architecture forbids it. It's a one-word fix that protects you from a knowledgeable heckle.

---

**Q31. What about referential integrity? If a comment syncs before its post, does the UI break?**

Genuinely interesting answer: mostly it doesn't, and for a slightly surprising reason. A single shape stream is sequential, so there's no race within one subscription. Across multiple shapes, the client store has **no formal concept of referential integrity** — and that turns out to be a feature, because joins live in your live queries. If the comment arrived and the post hasn't, the join simply doesn't match and renders nothing. It resolves itself when both are present.

Where you do need real cross-table integrity, you coordinate explicitly — waiting for the relevant transaction across multiple streams before applying — or use PGlite, whose sync adapter has a multi-shape method for exactly this.

**Say this:** *"The instinct is that you need foreign keys in the client. In practice a join that doesn't match yet behaves correctly on its own, which is a nice example of the architecture being simpler than you expect."*

---

**Q32. We're adding AI agents that write to this database. Does that change the calculus?**

It strengthens the case, and this is worth having ready because it's the most current framing available. An agentic feature is multi-writer by construction — one user plus one agent, often plus sub-agents — and all of them are writing to your data while a human needs to stay in the loop. The alternative to a reactive data plane is polling for changes across every agent and workflow, which doesn't scale in either performance or code complexity.

**Say this:** *"If your roadmap has agents writing to the same tables your users are looking at, you're going to need reactive reads whether or not you care about the spinner."*

---

**Q33. Why did you pick this over Convex, Instant, Zero, Jazz, PowerSync?**

The founder's own framing of the tradeoff is unusually usable, because it's a business argument rather than a benchmark: the alternatives largely require an **opinionated greenfield stack** — they want to be your one true stack, which means rewriting existing systems and accepting lock-in. Electric's pitch is that it works with any Postgres and any HTTP-speaking stack, with writes staying on your own API.

Be even-handed. That's a real differentiator *and* it's the vendor's own positioning, so present it as "why it fit our constraints" rather than as a verdict. Several of these are excellent and better-suited to different problems:

| Project | Characterisation *(per the same source)* |
|---|---|
| Convex | End-to-end reactive database with a reactive programming model |
| Ditto | Mature edge sync engine, offline-focused |
| Instant | Reactive database system |
| LiveStore | Sync engine built on an event-sourced change flow |
| Jazz | Reactive database with peer-to-peer end-to-end encryption |
| PowerSync | Mature Postgres sync engine, syncs into SQLite in the client |
| RxDB | Client database with sync |
| Zero (Rocicorp) | Advanced incremental view maintenance and query-driven sync |

**Note for S10:** replace your invented landscape table with this one. It's from a named primary source, it's more accurate, and Jazz's end-to-end encryption is the single best pointer for anyone in the room who cares about the paper's ideal six.

---

## B4. Quotes and framings worth stealing

*All from the same transcript. Attribute on slide.*

| Material | Use on |
|---|---|
| **"the inventors of CRDTs"** are on Electric's team, and the rabbit hole is "PhD-level deep" — yet they still put write-path CRDTs out of scope | **S16** — this is stronger than anything currently on that slide. The people who invented the technology chose not to make it the default. |
| "Solving write-path sync in the general case is extremely hard, and we actually tried to do it with an earlier version of the product… holding on to lots of very complex guarantees like finality of local writes and referential integrity" | **S16** — first-party confirmation of the pivot narrative, and it adds *referential integrity* to the list of abandoned guarantees |
| The WebSocket-vs-HTTP exchange framed as spending an **"innovation token"** | Q28, and a good framing for wall-four discipline generally |
| "It is kind of like React, but for data loading instead of just UI" — jQuery and manual DOM updates → declarative UI :: imperative fetching → declarative data bindings | **S5** — better than the current mechanism explanation. This audience will feel the jQuery analogy immediately. |
| "why would you fetch when you can sync?" | Closing line candidate — though your spinner-screenshot ending is stronger and more honest |
| Reruns of reactive queries cost 10–20ms each; ten components ≈ 300ms and the app "grinds to a halt" — differential dataflow propagates deltas instead, staying sub-millisecond within one animation frame | Q14 — the concrete mechanism behind the latency claim |
| Benchmark comparing raw JS loops, SQLite with re-run reactive queries, and TanStack DB across multi-join grouped/aggregate queries over thousands of rows | Q14 — if you want a numbers slide |
| Ink & Switch is credited by name as having "defined the local-first software manifesto," and the rollback question is explicitly routed to their thinking on modes of collaboration | **S6/S8** — the vendor pointing at the paper legitimises your whole framing device |

**Careful with one of these.** The founder describes the incremental path as running "all the way to a fully local-first architecture that is reactive, consistent, offline-capable." That is a vendor roadmap statement, and it's in tension with what you'll have demoed. Don't quote it as a current capability. If someone else raises it, the honest answer is Q30: persistence is available via PGlite, durable offline *writes* are still yours to build.

---

## B5. Optional new angle — worth 90 seconds if you have them

The transcript makes an argument you don't currently have anywhere: **declarative data bindings produce LLM-generated code that scales, and imperative fetching doesn't.** The claim is that an agent writing component code with inline fetches produces "fetch spaghetti" — plausible-looking components each making uncoordinated network requests, with no control over what fetches what during render. Declarative bindings look almost identical on the surface but let the system own transfer, placement and retention, so the generated code stays maintainable.

For an internal-tools audience in 2026, where most of the code is increasingly agent-written, this may be the most persuasive argument in the whole talk — and it's an argument about *code quality*, not user experience, so it reaches the people who don't believe the spinner is a real problem.

If you use it, the natural home is a short beat right after S4's code delta: *"and here's a second-order effect we didn't anticipate — this is also the code we want our agents writing."*

---
---

# Appendix C — Material from the Smashing Magazine field report

**Source:** Durgesh Pawar, *"The Architecture Of Local-First Web Development"*, Smashing
Magazine, 2026-05-06. A first-person retrospective across three shipped local-first apps
**and two projects where he removed the approach** — which is what makes it useful.

Applied so far: the Git/SVN framing and the node-in-a-distributed-system attribution on
**S6**. Everything below is queued for the slide named against it.

## C1. For S11 — wall 1, authorization

> "The client is not a trust boundary."

His argument: you cannot sync everything and hide it in the UI, because someone will open
DevTools and read the local SQLite file. Enforcement belongs at the **sync layer** (Electric
shapes, PowerSync sync rules) plus server-side validation of inbound writes. Sharper than
the slide's current wording — consider using the quote verbatim.

## C2. For S13 — wall 3, conflicts. **This corrects the slide.**

The slide currently says *row-level* last-write-wins. He argues for **field-level** LWW:
divergent fields both survive, only same-field edits truly conflict, resolved by later
timestamp with **client ID as a deterministic tiebreaker** ("This happens more often than
you'd think"). Reports it covers roughly **95% of conflicts** in production. LWW on a task
title is fine; on a document body it isn't — "that's where CRDTs earn their keep."

Also a CRDT war story worth 15 seconds: a Yjs task list **duplicated items** after two
users reordered it offline and the merge interleaved their orderings — "Technically correct.
Practically confusing." Fixed with a post-merge de-duplication step he calls a hack.

## C3. A wall the deck doesn't have — **semantic conflicts**

Two offline users book the same room at 2 PM for different meetings. Field-level merge
accepts both because they are structurally distinct records: clean merge, actual
double-booking, and the merge function cannot know.

His remedy: server-side domain-invariant validation on write-back that **flags rather than
rejects**. He tried rejecting first and produced client "ghost records" users could not
delete because the server denied their existence — state divergence he calls genuinely hard
to recover from. Instead the violation is stored, synced back, and surfaced as a
non-blocking notification; resolving it is just another ordinary write.

He is candid about the residue: a window where both conflicting records exist (fine for
rooms, unacceptable for inventory), a violation table that grows if ignored, and a parallel
set of business rules maintained outside client logic.

**This is the strongest addition available to Act 5** — it is a failure mode that survives
a correct merge, which is exactly the kind of thing an audience has not thought about.

## C4. For S14 — wall 4, migrations. Gives the slide evidence it lacks.

> "Design your migrations to be additive."

War story: he dropped a column that older clients were still writing to and caused **silent
sync failures for roughly 200 users over a weekend**. Server-side you migrate one database
you control; client-side every user's DB sits at whatever version they last opened the app
at. His runner checks a `_schema_version` table and applies pending migrations
transactionally.

## C5. For S18 — the decision rule

Six weeks wasted on an internal analytics dashboard before a colleague asked why, since the
data was server-generated. **Bad fits:** server-produced data (analytics, feeds, search
results); strong transactional consistency (banking, payments, inventory — eventual
consistency "will lose you money, or worse"); simple CRUD for five people on good office
internet; datasets too large for client devices.

**And the point that matches this talk's whole framing:** it is not binary. His best results
came from applying local-first to *specific features* inside otherwise traditional apps —
offline drafts in a blog editor, collaborative notes inside a REST-based PM tool. He calls
the "spectrum of local-first" real and recommends starting with one feature.

## C6. Numbers, if you want a performance slide

- Reads: 500 tasks in **under 2ms** on an M2, **~8ms** on a mid-range Android
- Initial sync of 5,000 tasks / 200 projects / 50 users: **1.2s** broadband, **3.5s**
  throttled 3G, 4–5s slow mobile
- SQLite WASM bundle: **~400KB gzipped**, lazy-loaded
- Memory: large client databases can crash mobile tabs, with no good fix beyond small
  synced datasets and aggressive pruning

## C7. Quote candidates

| Quote | Use |
|---|---|
| "The client is not a thin view requesting permission to show data." / "The client is a node in a distributed system with its own database." | S6 — already applied as framing |
| "Local-first web development is Git for application data." | S6 — applied |
| "The client is not a trust boundary." | S11 |
| "The web has standards for nearly everything. We don't have one for sync, and I don't see one emerging soon." | S10, on fragmentation |
| "The best architecture is the one your team can debug at 2 AM." — attributed to a developer named Kevin at a Berlin meetup | S18 or the close |

## C8. Two things to know, not to slide

**He says he would avoid ElectricSQL and Zero in production for another 6–12 months**,
citing rough edges in shape management and reconnection when he evaluated Electric in
February 2026, and his own scars from adopting Meteor early. **You are demoing Electric.**
Have an answer ready rather than meeting this cold if someone in the room has read the post.
Reasonable response: this is a talk about an architecture, the engine is one of several
fillable slots (S9), and your own experience is what it is — say what you actually found.

**He argues optimistic-update machinery disappears entirely** in true local-first, because
the local write *is* the state — there is nothing to be optimistic about. Your S5 labels the
write path `WRITE (optimistic)`, which is right for *your* architecture and wrong for his.
That difference is not a problem, it is **evidence for S8**: you kept the server as primary,
so your writes are still tentative. Worth saying out loud — it is the cleanest proof that
you took one ideal and not the swap.

**Also flagged in the post:** a Safari 18 bug where `createSyncAccessHandle()` fails silently
in some iframe contexts, and *Designing Data-Intensive Applications* (Kleppmann) as
prerequisite reading.
