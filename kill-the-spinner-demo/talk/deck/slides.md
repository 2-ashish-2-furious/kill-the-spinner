---
theme: default
title: 'Local-First: Kill the Spinner'
info: |
  A 25-minute talk. We took one of the seven local-first ideals — "No spinners" —
  and shipped it. This is what it bought and what it cost.
class: text-left
canvasWidth: 1100
transition: fade
mdc: true
lineNumbers: false
drawings:
  persist: false
fonts:
  provider: none
---

<div class="title-wrap">

# Kill the <span class="kill">Spinner</span>

<div class="title-mark">
  <svg viewBox="0 0 200 200" aria-hidden="true">
    <circle class="ring-track" cx="100" cy="100" r="74" />
    <g class="spin">
      <path class="ring-arc" d="M100 26 a74 74 0 0 1 74 74" />
    </g>
    <line class="ring-kill" x1="36" y1="164" x2="164" y2="36" pathLength="100" />
    <line class="ring-kill alt" x1="36" y1="36" x2="164" y2="164" pathLength="100" />
  </svg>
</div>

</div>

<!--
[0:00–0:30] ACT 1 — THE HOOK

Hands up if you shipped a loading spinner this week. Keep it up if you also wrote a
cache-invalidation call to go with it.

I'm going to show you two versions of the same internal tool before I explain anything.
Same data, same database, same feature set. Watch the top-left corner of the screen —
that's where the spinner lives.

Resist the urge to set up the problem for three minutes. The demo IS the problem statement.
-->

---
layout: center
class: text-center
---

<div class="demo-marker" style="color:var(--dim)">Before</div>

<div class="flow">
  <div class="flow-dot"></div>
  <div class="chip">mount<span class="tag">component</span></div>
  <div class="arrow">→</div>
  <div class="chip wait w1">fetch<span class="tag">wait</span></div>
  <div class="arrow">→</div>
  <div class="chip wait w2">spinner<span class="tag">wait</span></div>
  <div class="arrow">→</div>
  <div class="chip">render<span class="tag">finally</span></div>
  <div class="arrow">→</div>
  <div class="chip wait w3">edit<span class="tag">wait</span></div>
</div>

<div class="loopback">
  <svg viewBox="0 0 800 60" preserveAspectRatio="none" aria-hidden="true">
    <path class="path" d="M770 4 L770 40 L30 40 L30 12" />
    <polygon class="head" points="30,2 24,14 36,14" />
  </svg>
</div>

<div class="loop-label" style="color:var(--danger)">invalidate &amp; refetch — on every edit</div>

<!--
[0:30–1:15] S2 — THE BEFORE

ROUTE: sidebar → "S2 · before (spinners)", then pick the demo project.

Live or recorded. Open the grid (spinner). Apply a filter (spinner). Edit a cell
(spinner, row jumps). Navigate away and back (spinner).

SCRIPT: "Nothing here is broken. This is a competent app, built the way we all build
them. Count the waits."

You NEED this baseline. "Instant" is not impressive in isolation — it's only impressive
as a contrast. Don't skip it to save time.
-->

---
layout: center
class: text-center
---

<div class="demo-marker" style="color:var(--good)">After</div>

<div class="flow">
  <div class="flow-dot calm"></div>
  <div class="chip">mount<span class="tag">component</span></div>
  <div class="arrow">→</div>
  <div class="chip gone">fetch<span class="tag">gone</span></div>
  <div class="arrow">→</div>
  <div class="chip gone">spinner<span class="tag">gone</span></div>
  <div class="arrow">→</div>
  <div class="chip instant">render<span class="tag">instant</span></div>
  <div class="arrow">→</div>
  <div class="chip instant">edit<span class="tag">instant</span></div>
</div>

<div class="loopback calm">
  <svg viewBox="0 0 800 60" preserveAspectRatio="none" aria-hidden="true">
    <path class="path" d="M770 4 L770 40 L30 40 L30 12" />
    <polygon class="head" points="30,2 24,14 36,14" />
  </svg>
</div>

<div class="loop-label" style="color:var(--good)">sync in the background — off the interaction path</div>

<!--
[1:15–3:30] S3 — THE AFTER — ** BEAT 1 **

ROUTE: sidebar → "S3 · after (500k, on-demand)". Keep the counter panel visible —
"Rows in local replica" and "Subset requests" are your narration for wall 2 later.

"Laptops down for two minutes, this one only works if you watch it."

BEATS IN ORDER:
1. Same app, rebuilt. Open the grid — ALREADY POPULATED. Filter, sort, navigate —
   instant, no spinner anywhere.
2. Second browser window side by side. Type in the left → appears in the right
   immediately. LET THE SILENCE SIT.
3. Open the Network panel. Filter, sort, navigate again → ZERO REQUESTS. Tap the
   empty panel.
4. Throttle to Slow 3G. Add a record → still instant.
   "The network is still slow. The UI just stopped waiting for it."

CLOSE THE ACT: "No spinner, no loading skeleton, no refetch after the edit. Now let me
show you how little code that took, and then be honest with you about what it cost."

If short on time, cut beats 3 and 4. Never cut 1 and 2.
-->

---

## One of these needs a <span class="kill">spinner</span>

<div class="shot-pair">

  <div class="shot-col">
    <img src="/img/before-read.png" alt="the before read path: setIsLoading around an awaited fetch" />
    <div class="shot-cap bad">
      <div class="cap-head">three moving parts</div>
      <ul>
        <li>a flag flipped on, then off</li>
        <li>a round-trip in between</li>
        <li>a spinner branch in render</li>
      </ul>
    </div>
  </div>

  <div class="shot-col">
    <img src="/img/after-read.png" alt="the after read path: a live query, no loading state" />
    <div class="shot-cap good">
      <div class="cap-head">one</div>
      <ul>
        <li>a query over the local replica</li>
        <li>paging state, not loading state</li>
      </ul>
      <div class="cap-note">Nothing to wait for,<br>so nothing to show.</div>
    </div>
  </div>

</div>

<!--
[3:30–5:00] S4 — THE CODE DELTA

SCRIPT: "Two things are gone: the loading branch and the invalidation. They're gone for
the same reason — there's no cache to be stale, because there's a replica that's already
correct."

Keep this framework-neutral out loud. Don't name libraries yet — this should be
recognisable to React Query, SWR, Redux and hand-rolled useEffect users alike.

OPTIONAL 90-SECOND BEAT (Appendix B5): this is also the code you want your agents
writing. An agent writing imperative fetches produces "fetch spaghetti" — plausible
components each making uncoordinated requests. Declarative bindings look almost
identical but let the system own transfer, placement and retention. For a 2026
internal-tools audience this may be the most persuasive argument in the talk, and
it's about code quality rather than UX — so it reaches people who don't think the
spinner is a real problem.
-->

---

## The same trick, <span class="hl">one layer down</span>

<div class="shift">
  <div class="dom">ui</div>
  <div class="was">jQuery, manual DOM updates</div>
  <div class="arr">→</div>
  <div class="now">declarative UI</div>

  <div class="dom">data</div>
  <div class="was">imperative fetching</div>
  <div class="arr">→</div>
  <div class="now here">declarative data bindings</div>
</div>

<div class="paths">

  <div class="path read">
    <div class="path-label">read</div>
    <div class="track">
      <span class="pdot read-dot"></span>
      <span class="node">database</span>
      <span class="ar">→</span>
      <span class="node">sync engine</span>
      <span class="ar">→</span>
      <span class="node">local replica</span>
      <span class="ar">→</span>
      <span class="node">live query</span>
      <span class="ar">→</span>
      <span class="node ui">UI</span>
    </div>
  </div>

  <div class="path write">
    <div class="path-label">write <span class="qual">(optimistic)</span></div>
    <div class="track">
      <span class="pdot write-dot"></span>
      <span class="node ui">UI</span>
      <span class="ar">→</span>
      <span class="node">local replica</span>
      <span class="ar">→</span>
      <span class="node">your own API</span>
      <span class="ar">→</span>
      <span class="node">database</span>
      <span class="ar ret">↷</span>
      <span class="node ghost">confirmed back down the read path</span>
    </div>
  </div>

</div>

<div class="pull" style="font-size:2rem; max-width:none; margin-top:1.6rem">
Reads and writes take <span class="accent">different routes</span>.
</div>

<!--
[5:00–6:00] S5 — THE MECHANISM

SCRIPT: "Reads come from memory in the browser, kept live by a sync engine. Writes apply
locally straight away, then travel to the server on a SEPARATE path, and get confirmed
asynchronously. Reads and writes take different routes — remember that, it's why the last
act of this talk exists."

The jQuery analogy is from James Arthur's talk: "It is kind of like React, but for data
loading instead of just UI." This audience will feel it immediately.

Also from that source, if you want it: "local-first application code talks directly to a
local store interface" — the cleanest one-line definition of the architectural sense.
-->

---

## Where we got the <span class="hl">idea</span>

<div class="paper-row">

  <div class="paper-stack">
    <div class="sheet title">
      <img src="/img/paper-title.png" alt="title page of the Local-First Software essay" />
    </div>
    <div class="sheet quote">
      <img src="/img/paper-primary-copy.png" alt="the primary-copy sentence, highlighted on page 2" />
    </div>
  </div>

  <div class="paper-side">
    <div class="provenance">the whole idea is one swap</div>
    <div class="swap">
      <div class="who dim">cloud apps</div>
      <div class="what dim"><strong>server</strong> is primary · the client is a cache</div>
      <div class="who">local-first</div>
      <div class="what"><strong>your device</strong> is primary · the server is backup</div>
    </div>
    <div class="consequence">
      <div class="pull" style="font-size:1.7rem; max-width:30ch">
        So the client stops being a frontend. It becomes a
        <span class="hl">node in a distributed system</span>.
      </div>
      <ul class="prov-list" style="margin-top:1rem">
        <li><strong>Git, not SVN</strong> — every device holds a replica and commits locally</li>
        <li>So conflicts, consistency and partition tolerance are <strong>now yours</strong></li>
      </ul>
      <div class="cite" style="margin-top:1rem">
        framing: Durgesh Pawar, “The Architecture of Local-First Web Development”, 2026
      </div>
    </div>
  </div>

</div>

<!--
[6:00–7:00] S6 — THE PAPER

SCRIPT for the swap: "Refuse to swap those roles and you are writing a cloud app —
however fast it feels." That sentence is the test the audience will apply to your own
app two slides from now, so land it deliberately.

SCRIPT: "This is where we got the idea. It's a 2019 research essay, and it's excellent —
read it this week. It defines local-first software around one architectural commitment:
the copy on your device is the PRIMARY copy. Not a cache. Primary."

Second quote if there's room: the essay names itself for prioritising "the use of local
storage (the disk built into your computer) and local networks" over remote datacentres.

⚠ ACCURACY FLAG: the author list is commonly cited as Kleppmann, Wiggins, van Hardenberg
and McGranaghan — VERIFY the order and spelling from the essay page before crediting
them on this slide. It is currently cited by title/org/date/URL only, which is safe.
-->

---

## What a <span class="hl">full</span> local-first app strives for

<div class="subline">
  Seven ideals. <span class="hl-good">Feeling fast</span> is the cheap one —
  <span class="kill">owning your data</span> is not.
</div>

<div class="ideal-groups">
  <div class="ig">
    <div class="ig-head feel">how it feels</div>
    <div class="chips feel">
      <div class="ichip"><span class="num">1</span>No spinners: your work at your fingertips</div>
      <div class="ichip"><span class="num">2</span>Your work is not trapped on one device</div>
      <div class="ichip"><span class="num">4</span>Seamless collaboration with your colleagues</div>
    </div>
  </div>
  <div class="ig">
    <div class="ig-head own">who owns the data</div>
    <div class="chips own">
      <div class="ichip"><span class="num">3</span>The network is optional</div>
      <div class="ichip"><span class="num">5</span>The Long Now</div>
      <div class="ichip"><span class="num">6</span>Security and privacy by default</div>
      <div class="ichip"><span class="num">7</span>You retain ultimate ownership and control</div>
    </div>
  </div>
</div>

<!--
[7:00–8:00] S7 — SEVEN IDEALS

SCRIPT: "Ideal number one is literally called 'No spinners.' I stole the title of this
talk from a 2019 research paper."

Reliable laugh, and it signals you read the source rather than the launch blogs.

Read them out in the essay's own words — the exact titles are on the slide.
-->

---

## We took <span class="hl-good">one</span>.

<div class="subline">
  Same seven. This is where we actually landed.
</div>

<div class="ideal-groups">
  <div class="ig">
    <div class="ig-head feel">how it feels</div>
    <div class="chips feel">
      <div class="ichip auto-keep"><span class="num">1</span>No spinners: your work at your fingertips</div>
      <div class="ichip auto-drop d6"><span class="num">2</span>Your work is not trapped on one device</div>
      <div class="ichip auto-drop d5"><span class="num">4</span>Seamless collaboration with your colleagues</div>
    </div>
  </div>
  <div class="ig">
    <div class="ig-head own">who owns the data</div>
    <div class="chips own">
      <div class="ichip auto-drop d1"><span class="num">3</span>The network is optional</div>
      <div class="ichip auto-drop d2"><span class="num">5</span>The Long Now</div>
      <div class="ichip auto-drop d3"><span class="num">6</span>Security and privacy by default</div>
      <div class="ichip auto-drop d4"><span class="num">7</span>You retain ultimate ownership and control</div>
    </div>
  </div>
</div>

<div class="verdict auto-reveal">
  <div class="swap">
    <div class="who dim">cloud apps</div>
    <div class="what dim"><strong>server</strong> is primary · the client is a cache</div>
    <div class="who ours">our app</div>
    <div class="what"><strong>server</strong> is primary · the client is a <em>fast</em> cache</div>
  </div>
  <div class="pull" style="font-size:1.7rem; max-width:none; margin-top:1.2rem">
    We never made the swap. We just stopped making the
    <span class="hl-good">user wait for it</span>.
  </div>
</div>

<!--
[8:00–9:30] S8 — WE TOOK ONE — ** BEAT 2 ** — THE HONEST CENTRE

SCRIPT: "Here's the part I want to be very clear about, because a lot of talks with
'local-first' in the title are not.

We did not build a local-first application. We took ideal number one and left the other
six on the table — deliberately. Our data still lives on a server, the server is still
the source of truth, and if that server goes away our users have nothing. By the paper's
own definition, what I just demoed IS NOT local-first software. It's a normal
client-server app that reads from a live replica.

And that was the right call for an internal tool. We wanted the feel of ideal one; we did
not want to take on ideals three through seven, which — as I'll show you at the end — is
a DRAMATICALLY larger project than it looks."

WHY THIS SLIDE MATTERS: it inoculates you against the only real attack on this talk, it
makes the scope credible, and it turns Act 6 into a payoff instead of a confession.

If your submitted abstract promised offline, own it here: "the abstract for this talk
promised you offline; let me tell you what I found when I actually tested that."

Note ideal 2 is also arguably met — data lives in Postgres and syncs to any client.
NEVER CUT THIS SLIDE.
-->

---

## The pattern is <span class="hl">three slots</span>

<div class="subline">
  Two of them are new decisions. The third is the API you <span class="hl-good">already shipped</span>.
</div>

<div class="slots">
  <div class="slot read">
    <div class="slot-head">
      <span class="slot-n">slot 1</span>
      <span class="slot-tag read">read path</span>
    </div>
    <div class="slot-name">Sync engine</div>
    <div class="slot-job">Streams a filtered subset of server data down to the client — and keeps it live.</div>
    <div class="slot-where"><span class="k">runs</span> server + wire protocol</div>
  </div>
  <div class="slot read">
    <div class="slot-head">
      <span class="slot-n">slot 2</span>
      <span class="slot-tag read">read path</span>
    </div>
    <div class="slot-name">Local store + query</div>
    <div class="slot-job">Holds the replica, answers queries reactively, owns optimistic state.</div>
    <div class="slot-where"><span class="k">runs</span> the browser</div>
  </div>
  <div class="slot write keep">
    <div class="slot-head">
      <span class="slot-n">slot 3</span>
      <span class="slot-tag write">write path</span>
    </div>
    <div class="slot-name">Write path</div>
    <div class="slot-job">Takes a local write to the server and confirms it back.</div>
    <div class="slot-where"><span class="k">runs</span> your existing API</div>
    <div class="slot-badge">nothing to choose</div>
  </div>
</div>

<div class="pull" style="font-size:1.9rem; max-width:none; margin-top:1.9rem">
The boxes are replaceable. The <span class="hl">shape</span> isn't.
</div>

<!--
[9:30–11:00] S9 — THREE REPLACEABLE ROLES

SCRIPT: "This is the pattern. Three roles. We happened to fill them with a particular set
of libraries, but the important thing is that they're three SEPARATE decisions, and the
third one is usually your existing API — you don't replace it."

WHY THIS SLIDE EXISTS: it is what stops the talk becoming a product walkthrough. The
audience should leave needing three pieces, not two package names.

DO NOT NAME LIBRARIES HERE — that is deliberate, and it is why the slide has no "we used"
row. Say "we filled these with a particular set of libraries" and move on; the next slide
names them in one sentence, against the alternatives, which is the honest place for it.
If someone shouts the question, answer it in four words and advance.

Q&A BACKUP — "why not build it myself with websockets?" You'd be building the sync engine,
which is the hard part. Electric's own postmortem identifies the sync component as where
complexity concentrates and the piece hardest to build yourself. Their framing of
WebSocket-vs-HTTP is that adopting websockets spends an "innovation token": HTTP requests
are stateless, deployable, observable, debuggable and cacheable; websockets hold
server-side state and complicate scaling.
-->

---

<div class="eyebrow" style="color:var(--danger)">what it cost</div>

## Then we hit <span class="kill">four walls</span>

<div class="subline">
  Every one is a cost you didn't have with fetch-and-spinner.
  <strong>Three of the four are invisible in a demo.</strong>
</div>

<div class="walls-preview">
  <div class="wp">
    <div class="wp-n">1</div>
    <div class="wp-b">
      <div class="wp-t">Authorization</div>
      <div class="wp-d">The sync filter becomes the security perimeter.</div>
    </div>
  </div>
  <div class="wp">
    <div class="wp-n">2</div>
    <div class="wp-b">
      <div class="wp-t">Data loading</div>
      <div class="wp-d">It's a design decision again — the thing sync promised to take away.</div>
    </div>
  </div>
  <div class="wp">
    <div class="wp-n">3</div>
    <div class="wp-b">
      <div class="wp-t">Conflicts</div>
      <div class="wp-d">Two people edit one field. One of them silently loses.</div>
    </div>
  </div>
  <div class="wp">
    <div class="wp-n">4</div>
    <div class="wp-b">
      <div class="wp-t">Migrations</div>
      <div class="wp-d">Your schema reaches browsers you don't control.</div>
    </div>
  </div>
</div>

<div class="pull" style="font-size:1.9rem; max-width:none; margin-top:1.8rem">
Everything so far was the <span class="hl-good">benefit</span>.
This is the <span class="kill">bill</span>.
</div>

<!--
[11:00–11:30] S10 — ACT 5 OPENER: THE FOUR WALLS

This slide replaced the old product-landscape table, which now lives past the references
slide as a Q&A backup. Do not walk through it in the main flow.

WHY THIS SLIDE EXISTS: the next four slides are the most valuable in the talk — they come
from your build, not from anyone's docs. Without a map, four consecutive problem slides
read as a list of complaints. With a map, each one reads as progress, and the audience
knows the act has a bottom.

SCRIPT: "So that's what we bought. Now let me tell you what it cost — because I don't
think the honest version of this talk exists without this part.

Four walls. We hit all four. Every one of them is a cost we did not have back when we
were writing fetch-and-spinner. And I want you to notice something before we start:
three of the four are completely invisible in the demo I just showed you. The app looked
finished. It wasn't."

DELIVERY: read the four names, not the descriptions — the descriptions are there for
people photographing the slide. Should take 30 seconds.

DO NOT apologise here, and don't soften it. The credibility you built on slide 8 by
admitting you only took one ideal is what makes this act land instead of sounding like
buyer's remorse.
-->
---

<div class="eyebrow" style="color:var(--danger)">wall 1 of 4</div>

## Authorization becomes a sync boundary

<div class="wall-split">
  <div class="wall-shot">
    <img src="/img/wall1-authz.png" alt="the shape endpoint: project resolved from the session, then the where clause that bounds the sync" />
  </div>
  <div class="wall-side">
    <div class="blast-head">blast radius</div>
    <div class="blast">
      <div class="br">
        <div class="bw">get an <strong>endpoint</strong> wrong</div>
        <div class="bc">you leak <em>one response</em></div>
      </div>
      <div class="br bad">
        <div class="bw">get a <strong>sync filter</strong> wrong</div>
        <div class="bc">you replicate <em>a table</em></div>
      </div>
    </div>
    <div class="blast-head" style="margin-top:1.6rem">the rule — any engine</div>
    <div class="guards">
      <div class="g">The filter is derived <strong>server-side</strong>, from the session.</div>
      <div class="g">The client may <strong>narrow</strong> the subset. Never <strong>widen</strong> it.</div>
      <div class="g">Can't resolve the boundary? Match <strong>nothing</strong>.</div>
    </div>
  </div>
</div>

<!--
[12:30–14:00] S11 — WALL 1 — AUTHORIZATION

THE BIG ONE. This act is the most valuable in the talk because it's the part only you can
give — it comes from your build, not anyone's docs.

SCRIPT: "You're no longer authorizing ENDPOINTS, you're authorizing SUBSETS OF TABLES,
and the filter has to live on the server where the client can't touch it. Get an endpoint
wrong and you leak one response. Get a sync filter wrong and you replicate a table into
somebody's browser."

WALK THE SCREENSHOT IN THREE BEATS, in this order — the marks are already on the lines:
  1. SERVER-SIDE (line 48) — the project comes from session.user.id. The client cannot
     ask for a different one.
  2. FAIL CLOSED (line 60) — no project resolved? where=false. An empty grid, never an
     unfiltered table. This is the line to dwell on.
  3. THE PERIMETER (line 62) — and only then the filter itself.

The 401 for unauthenticated requests is at lines 32-38, above the crop. It's ordinary
endpoint auth, not the wall — mention it only if asked.

CONCRETE EXAMPLE WORTH SHOWING: a shape with no filter at all, syncing every user row to
every logged-in client. Easy to write, invisible in the UI, and now sitting in devtools
for anyone to read.

Electric explicitly declined to solve this for you: "A sync engine may provide some hooks
and options but should not prescribe a solution."

VERIFIED CLAIM you can make on stage — we tested it, and the mechanism is TWO things,
which is what the right-hand column now says:

  1. `table` and `where` are NOT in Electric's ELECTRIC_PROTOCOL_QUERY_PARAMS allowlist,
     so a client that appends `table=users&where=true` has those params DROPPED by the
     proxy. The server then sets both itself (demo-issues.ts:56, 60, 62).
  2. `subset__*` params ARE forwarded — they have to be, that's how on-demand paging
     works — but Electric ANDs them INSIDE the server's where clause. So
     `subset__where=project_id <> 8` returns ZERO rows.

Net: the client can NARROW, never WIDEN. Don't compress this to "the proxy whitelists
params" — that's only half of it, and the subset half is the interesting half.

The full allowlist, if anyone presses: live, live_sse, handle, offset, cursor,
expired_handle, log, subset__where, subset__limit, subset__offset, subset__order_by,
subset__params, subset__where_expr, subset__order_by_expr, cache-buster.

⚠ ONE CAVEAT when we tested this: `subset__limit` is rejected without `subset__order_by`.
An early run of the attack looked like it was blocked when it had actually failed
validation. If you re-run the demo live, include `subset__order_by=id asc`.

NEVER CUT THIS SLIDE.
-->

---

<div class="eyebrow" style="color:var(--danger)">wall 2 of 4</div>

## Data loading is a design decision again

<div class="wall-split">
  <div class="wall-shot">
    <img src="/img/wall2-syncmode.png" alt="the collection config line that chooses how much to sync and when" />
    <div class="shot-under">
      Not the naive wall. It isn't a row limit — modern engines page far past memory.
      The wall is that <strong>you</strong> are choosing again.
    </div>
  </div>
  <div class="wall-side">
    <div class="blast-head">blast radius</div>
    <div class="blast">
      <div class="br">
        <div class="bw">get one <strong>component's</strong> fetch wrong</div>
        <div class="bc">one <em>slow screen</em></div>
      </div>
      <div class="br bad">
        <div class="bw">get one <strong>collection's</strong> sync wrong</div>
        <div class="bc">every screen that <em>reads it</em></div>
      </div>
    </div>
    <div class="blast-head" style="margin-top:1.6rem">the rule — any engine</div>
    <div class="guards">
      <div class="g">Choose per collection: <strong>everything up front</strong>, only <strong>what a query asks for</strong>, or both.</div>
      <div class="g">Wrong choice shows up as a slow first paint — or a <strong>stall mid-scroll</strong>.</div>
      <div class="g">Sync doesn't delete data loading. It moves it out of components and into <strong>configuration</strong>.</div>
    </div>
  </div>
</div>

<!--
[14:00–15:00] S12 — WALL 2 — DATA LOADING

⚠ DO NOT PRESENT THE OLD VERSION OF THIS WALL. The naive framing — "only works for small
datasets" / "~10k rows" / "bounded working sets" — is OUT OF DATE. Query-driven sync
changes the ceiling substantially.

SCRIPT: "The naive version of this wall is 'it only works for small datasets.' That was
true and it's now mostly wrong. With on-demand, the predicates from your live queries get
pushed down to the collection, and it syncs matching subsets at runtime. The shape you
defined server-side becomes the OUTER BOUNDARY of what could ever sync; the subsets are
ANDed inside it. That gives you pagination and infinite scroll over datasets far larger
than memory.

So the real wall isn't row count, it's that DATA LOADING IS A DESIGN DECISION AGAIN — the
thing sync promised to take away. You're now choosing per collection whether it's eager,
on-demand or progressive, and getting it wrong shows up as either a slow first paint or a
stall mid-scroll. That's a better problem than the one you had, but it isn't zero."

SAY THIS: "Sync doesn't delete data loading. It moves it from your components into your
collection configuration, which is a much better place for it — but you still have to
think."

All three modes verified present in the installed @tanstack/electric-db-collection.
Electric's own demo of this pattern runs a Linear clone over 500,000 issues.
-->

---

<div class="eyebrow" style="color:var(--danger)">wall 3 of 4</div>

## Conflicts: last-write-wins

<div class="wall-split">
  <div class="wall-shot">
    <img src="/img/wall3-lww.png" alt="the update mutation: the write lands with no version or compare-and-swap guard" />
    <div class="shot-under">
      What <strong>isn't</strong> here is the point. No version, no compare-and-swap,
      no <code>updated_at</code> guard. The write just lands.
    </div>
  </div>
  <div class="wall-side">
    <div class="blast-head">blast radius</div>
    <div class="blast">
      <div class="br">
        <div class="bw">two people edit <strong>different fields</strong></div>
        <div class="bc">both <em>survive</em></div>
      </div>
      <div class="br bad">
        <div class="bw">two people edit <strong>the same field</strong></div>
        <div class="bc">one <em>silently loses</em></div>
      </div>
    </div>
    <div class="blast-head" style="margin-top:1.6rem">the rule — any engine</div>
    <div class="guards">
      <div class="g">Granularity is <strong>whatever your mutation writes</strong> — here, per field.</div>
      <div class="g">Ask per field: is <strong>silent overwrite</strong> acceptable here?</div>
      <div class="g">Not either/or — one field can take a <strong>CRDT</strong> while the rest stay last-write-wins.</div>
    </div>
  </div>
</div>

<!--
[15:00–16:00] S13 — WALL 3 — CONFLICTS

⚠ CORRECTION — DO NOT SAY "ROW-LEVEL". The mutation does `.set(input.data)` where
`input.data` carries only the fields that changed, so the UPDATE touches only those
columns. Conflict granularity here is PER FIELD, not per row: two people editing
different fields of the same record BOTH survive. The screenshot is the evidence.

SCRIPT: "Because the server owns the primary copy, conflict resolution is last-write-wins
at whatever granularity your mutation writes — for us, per field. Two people edit
different fields, both survive. Two people edit the same field, one silently loses. There's no CRDT in
this architecture to save you — that's the other family. So the question for your domain
is: IS SILENT OVERWRITE ACCEPTABLE HERE? For a status field on an internal ticket,
usually yes. For anything a human typed at length, no."

IMPORTANT NUANCE — don't present the two families as mutually exclusive. You can compose
them: the write you send to the server can be a logical operation applied to a CRDT
structure stored IN Postgres (pg_crdt), and there are Yjs and Automerge integrations for
exactly this.

SAY THIS: "You pick per-field, not per-app. Most of our data is last-write-wins and
that's correct. If we add a collaborative description field tomorrow, that field gets a
CRDT and nothing else changes."
-->

---

<div class="eyebrow" style="color:var(--danger)">wall 4 of 4</div>

## Migrations reach browsers you don't control

<div class="wall-split">
  <div class="wall-shot">
    <div class="pull" style="font-size:2.1rem; max-width:26ch; margin-top:0.6rem">
      Your schema change now propagates to live replicas running
      <span class="hl">yesterday's bundle</span>.
    </div>
    <div class="shot-under" style="margin-top:1.6rem">
      You can't see this one in the code. It shows up the day you rename a column —
      when a replica in someone's browser is still <strong>projecting the old
      one</strong>, and you can't make them reload.
    </div>
  </div>
  <div class="wall-side">
    <div class="blast-head">blast radius</div>
    <div class="blast">
      <div class="br">
        <div class="bw"><strong>add</strong> a column</div>
        <div class="bc">old clients <em>ignore it</em></div>
      </div>
      <div class="br bad">
        <div class="bw"><strong>rename or drop</strong> one</div>
        <div class="bc">live replicas <em>break</em></div>
      </div>
    </div>
    <div class="blast-head" style="margin-top:1.6rem">the rule — any engine</div>
    <div class="guards">
      <div class="g">You don't control the client version. Treat it like a <strong>mobile release</strong>.</div>
      <div class="g"><strong>Additive is safe.</strong> Renames, type changes and removals are not.</div>
      <div class="g">Expand and contract: add, dual-write, migrate readers, <strong>then</strong> drop.</div>
    </div>
  </div>
</div>

<!--
[16:00–16:30] S14 — WALL 4 — MIGRATIONS

SCRIPT: "Your schema changes now propagate to live replicas in browsers you don't
control, running whatever version of the app they loaded this morning. Additive changes
are fine. Renames and type changes need the same care you'd give a mobile app release."

This is the first slide to cut if you're running long — fold it into one sentence on the
conflicts slide.

Every one of these four walls is a cost you didn't have with fetch-and-spinner. Three of
them are invisible in a demo.
-->

---
layout: center
class: text-center
---

<div class="demo-marker" style="color:var(--danger)">Offline</div>

<div class="flow">
  <div class="flow-dot doomed"></div>
  <div class="chip">offline<span class="tag">devtools</span></div>
  <div class="arrow">→</div>
  <div class="chip instant">write<span class="tag">local</span></div>
  <div class="arrow">→</div>
  <div class="chip instant">appears<span class="tag">optimistic</span></div>
  <div class="arrow">→</div>
  <div class="chip fail f1">vanishes<span class="tag">rolled back</span></div>
  <div class="arrow">→</div>
  <div class="chip fail f2">reload<span class="tag">blank page</span></div>
</div>

<div class="loopback">
  <svg viewBox="0 0 800 60" preserveAspectRatio="none" aria-hidden="true">
    <!-- starts under "vanishes", where the undo actually happens -->
    <path class="path" d="M540 4 L540 40 L30 40 L30 12" />
    <polygon class="head" points="30,2 24,14 36,14" />
  </svg>
</div>

<div class="loop-label" style="color:var(--danger)">the confirmation never arrived — so the write was undone</div>

<div class="pull" style="font-size:2.1rem; max-width:40ch; margin:2.2rem auto 0">
Ideal three is “the network is optional.”<br>
For us it isn't. It's just no longer <span class="hl">in front of the user</span>.
</div>

<!--
[16:30–17:30] S15 — LIVE: WATCH IDEAL #3 FAIL — ** BEAT 3 **

BEATS:
1. Devtools → Offline.
2. Add a record. It appears. WAIT. It vanishes.
3. Reload while still offline → blank page.

SCRIPT: "That's not a bug, that's the architecture, and it's the clearest possible
illustration of what 'we only took ideal one' means. The server owns the primary copy, so
my local write was only ever TENTATIVE — it needed a confirmation that never arrived, so
it rolled back. And the reload failed because there is no durable local copy to boot from.

Ideal three is 'the network is optional.' For us the network is not optional. It's just no
longer IN FRONT OF THE USER."

SETUP: run the dev server with DEMO_SLOW_ROLLBACK=true so the optimistic row holds ~2s
before rolling back. Tune with DEMO_ROLLBACK_DELAY_MS=3000 if 2s reads too fast from the
back of the room. Rehearse this specifically — if it vanishes in 200ms nobody sees it.

⚠ WORDING — say "in the configuration we shipped", NOT that the architecture forbids
persistence. PGlite is Postgres in the browser with a sync adapter, so durable local
state IS buyable in this ecosystem. What durable reads still don't give you is offline
WRITES — those need a queue that survives reload plus retry and reconciliation. So:
persistence is buyable, ideal three is still a project. This protects you from a
knowledgeable heckle.

NEVER CUT THIS SLIDE.
-->

---

## They already ran the <span class="hl">experiment</span>

<div class="subline">
  A team of distributed-systems researchers built the full version. Then they
  <span class="kill">deleted it</span> and started over.
</div>

<div class="evidence-split">
  <div class="qstack">
    <div class="q lead">
      “Electric Next is a sync engine, <strong>not a local-first software
      platform</strong>.”
    </div>
    <div class="q">
      “Coming from a research background, we wanted the system to be optimal” — and so
      “we often picked the <strong>more complex solution</strong> from the design space.”
    </div>
    <div class="q">
      “These decisions not only made Electric more complex to <strong>use</strong> but
      also more complex to <strong>develop</strong>.”
    </div>
    <div class="q">
      “Electric Next embraces <strong>tentativity</strong>.”
      <span class="qnote">— the word for the row you just watched vanish</span>
    </div>
    <div class="cite" style="margin-top:1rem">
      James Arthur, “A new approach to building Electric”<br>
      electric.ax/blog/2024/07/17/electric-next
    </div>
  </div>
  <div class="wall-side">
    <div class="blast-head">the reclassification</div>
    <div class="swap">
      <div class="who dim">before</div>
      <div class="what dim">a <strong>local-first platform</strong> · finality of local writes</div>
      <div class="who ours">after</div>
      <div class="what">a <strong>sync engine</strong> · read-path first, writes tentative</div>
    </div>
    <div class="blast-head" style="margin-top:1.7rem">why this is the strongest evidence</div>
    <div class="guards">
      <div class="g">That team includes <strong>the inventors of CRDTs</strong>. They still put write-path sync out of scope.<span class="gsrc">same author, later conference talk</span></div>
      <div class="g">Finality of local writes went from headline feature to <strong>“no longer a key tenet”</strong>.</div>
      <div class="g">Not a company failing — the best available estimate of what ideals <strong>three to seven</strong> cost.</div>
    </div>
  </div>
</div>

<!--
[17:30–19:00] S16 — THE MOST EXPENSIVE EXPERIMENT — ** BEAT 4 **

SCRIPT: "So why didn't we just build the full seven? Because in 2024 a team of
distributed-systems researchers did exactly that — bidirectional sync into an embedded
client database, with finality of local writes as a core guarantee, which is essentially
the paper's architecture. Eleven months later they deleted it and started over."

THE QUOTES (all verbatim, same source):
- "Coming from a research background, we wanted the system to be optimal" — and so
  "we often picked the more complex solution from the design space."
- "These decisions not only made Electric more complex to use but also more complex to develop."
- "The complexity of the stack has provided a wide surface for bugs."
- A system that "demos well, with magic sync APIs but that never actually scales out reliably."
- "Electric Next is a sync engine, not a local-first software platform."
- On sequencing: "start with read-path only" … "This explicitly reduces the capability of
  the system in the short term."
- "Electric Next embraces tentativity."

THE STRONGEST POINT — from the founder's later conference talk: the people on that team
include "the inventors of CRDTs", and he calls the rabbit hole "PhD-level deep". They
still put write-path CRDTs out of scope. The people who invented the technology declined
to make it the default.

He also confirms what was abandoned: "Solving write-path sync in the general case is
extremely hard, and we actually tried to do it with an earlier version of the product…
holding on to lots of very complex guarantees like finality of local writes and
REFERENTIAL INTEGRITY."

LAND IT: "They reclassified themselves OUT of the category. Finality of local writes went
from headline differentiator to, in their words, 'no longer a key tenet of the system
design.' That's not a company failing — that's the strongest available evidence about how
expensive ideals three through seven actually are."

Also cites Gall's law and Worse is Better if you have 15 spare seconds.
⚠ The pivot post never says "CRDT" or "SQLite" — it says "embedded databases in the
client". Safe phrasing: "bidirectional sync into an embedded client database, with
finality of local writes."
-->

---

## The other camp <span class="kill">paid too</span>

<div class="subline">
  The paper's own authors built three CRDT apps — and wrote down what it cost.
</div>

<div class="pages3">
  <div class="pg good">
    <div class="pg-tag">what worked</div>
    <img src="/img/page-works.png" alt="page 18 of the paper, with the finding CRDT technology works highlighted" />
    <div class="pg-quote">“CRDT technology <strong>works</strong>.”</div>
  </div>
  <div class="pg bad">
    <div class="pg-tag">what it cost</div>
    <img src="/img/page-history.png" alt="page 19, highlighting that performance suffered because CRDTs store all history" />
    <div class="pg-quote">“CRDTs <strong>store all history</strong>, including character-by-character text edits.”</div>
  </div>
  <div class="pg bad">
    <div class="pg-tag">what stayed open</div>
    <img src="/img/page-network.png" alt="page 20, highlighting that network communication remains an unsolved problem" />
    <div class="pg-quote">“Network communication remains an <strong>unsolved problem</strong>.”</div>
  </div>
</div>

<div class="pages3-foot">
  <div class="pull" style="font-size:1.75rem; max-width:none">
    The merge works. <span class="kill">Keeping every keystroke forever</span> is what makes it work.
  </div>
  <div class="cite" style="margin:0">
    Ink &amp; Switch, <em>Local-First Software</em><br>§4.2.4 Findings · pp. 18–20
  </div>
</div>

<!--
[19:00–19:45] S17 — AND THE OTHER CAMP PAID TOO

SCRIPT: "For symmetry, because otherwise I'm just doing a different vendor's marketing.
The paper's authors built their own CRDT stack — Automerge, and three prototype apps —
and reported honestly: merging worked reliably and paired beautifully with reactive UI
code. AND retained edit history bloated storage and performance, and network transport
remained unresolved.

Both camps arrived at the same conclusion from opposite directions: THE OWNERSHIP IDEALS
ARE WHERE THE COST LIVES. Which is why we took the one that was cheap."

This is what keeps the ending balanced rather than anti-CRDT. If you must save time,
compress to a single sentence inside the previous slide — but DON'T cut it entirely.
-->

---

## Choose your row on <span class="hl">purpose</span>

<div class="subline">
  Three defensible answers. The only wrong one is the row you ended up on
  <span class="kill">by accident</span>.
</div>

<div class="choices">
  <div class="ch keep-fetch">
    <div class="ch-head">
      <span class="ch-n">option 1</span>
      <span class="ch-tag warn">keep fetching</span>
    </div>
    <ul>
      <li>the access pattern is <strong>scan-everything</strong> — analytics, aggregates over all rows</li>
      <li>report-shaped, or one-shot</li>
      <li>single user, single session</li>
      <li>you can't own the authorization model</li>
    </ul>
    <div class="ch-pay"><span class="k">you pay</span> spinners — and that's fine</div>
  </div>
  <div class="ch spinner">
    <div class="ch-head">
      <span class="ch-n">option 2</span>
      <span class="ch-tag good">kill the spinner</span>
    </div>
    <ul>
      <li>the data a user needs can be expressed as a <strong>query predicate</strong></li>
      <li>multiple users on shared data</li>
      <li>read-heavy</li>
      <li>latency is a real user complaint</li>
    </ul>
    <div class="ch-pay"><span class="k">you pay</span> the four walls</div>
  </div>
  <div class="ch crdt">
    <div class="ch-head">
      <span class="ch-n">option 3</span>
      <span class="ch-tag accent">go all the way</span>
    </div>
    <ul>
      <li><strong>offline is a hard requirement</strong></li>
      <li>concurrent edits to the same field are normal</li>
      <li>users must own their data independently of your service</li>
    </ul>
    <div class="ch-pay"><span class="k">you pay</span> storage, transport, and the paper's open questions</div>
  </div>
</div>

<div class="pull" style="font-size:1.7rem; max-width:none; margin-top:1.5rem">
A plain fetch for a report opened twice a month is <span class="hl-good">still correct</span>.
The difference is you'd be <em>choosing</em> it.
</div>

<!--
[19:45–20:45] S18 — THE DECISION RULE

SCRIPT: "You don't have to pick a side in a research debate. Take ideal one, ship it, and
know exactly which six you left behind and why.

A plain fetch for a report someone opens twice a month is still the correct architecture.
The difference is you'd now be choosing it, and you'd know what you're trading."

NOTE this wording is the CORRECTED version — the criterion is "can the data be expressed
as a query predicate", NOT "bounded working set". The old wording contradicted wall two.
-->

---
layout: center
class: text-center
---

<div class="pull" style="max-width:30ch; margin:0 auto">
An official local-first starter, on cold boot.
</div>

<div class="card" style="max-width:22rem; margin:2rem auto 0; text-align:left">
<div class="mono dim" style="font-size:1rem">Loading projects…</div>
</div>

<div class="note" style="max-width:44ch; margin:2rem auto 0">
No durable local copy — so there is nothing to boot from.
</div>

<!--
[20:45–21:15] S18b — THE CLOSE

SCRIPT: "This is an official starter for one of the tools I showed you, and on cold boot
it shows a spinner — because with no durable local copy, there's nothing to boot from.

Local-first isn't a switch you flip. It's a scorecard with seven rows, nobody scores
seven, and the only real mistake is not choosing your row on purpose."

⚠ Replace the mocked-up box with a REAL SCREENSHOT of the starter's cold-boot spinner —
it lands far better as evidence than as a mockup. The file is at
src/routes/_authenticated/index.tsx line 51 in the starter.

DON'T name the project on this slide. Same joke, no vendor.
-->

---
layout: center
class: text-center
---

<div class="eyebrow" style="justify-content:center">references</div>

<div style="font-size:0.9rem; line-height:1.9; text-align:left; max-width:40rem; margin:0 auto">

**Ink &amp; Switch** — *Local-first software: You own your data, in spite of the cloud* (April 2019)
<span class="cite" style="margin:0">inkandswitch.com/essay/local-first/</span>

**James Arthur / Electric** — *A new approach to building Electric* (2024-07-17)
<span class="cite" style="margin:0">electric.ax/blog/2024/07/17/electric-next</span>

**Electric** — *Super fast apps on sync with TanStack DB* (2025-07-29)
<span class="cite" style="margin:0">electric.ax/blog/2025/07/29/super-fast-apps-on-sync-with-tanstack-db</span>

<div class="note" style="margin-top:1.2rem">
CRDT foundations: Shapiro, Preguiça, Baquero &amp; Zawirski (SSS 2011) ·
Kleppmann &amp; Beresford (IEEE TPDS 2017) · Kleppmann, <em>CRDTs: The Hard Parts</em>
</div>

</div>

<!--
Optional closing slide — leave it up during Q&A so people can photograph it.

⚠ VERIFY venue, year and author lists for the CRDT papers before presenting. A wrong
citation in a talk that leans on rigor costs more than an omitted one.

Q&A: see the Q&A appendix in talk/local-first-kill-the-spinner.md — 33 prepared questions.
The three most likely: (Q3) is the sync service exposed — yes, public by default, must sit
behind your proxy; (Q17) what does this give me over React Query with staleTime — concede
the overlap, then land on deleting invalidation entirely; (Q20) isn't this Firebase with
extra steps — concede the family, differentiate on your own Postgres and your own API.
-->


---


<div class="backup-tag">backup · not in the main flow</div>

## How <span class="hl">we</span> filled them

<div class="fills">
  <div class="fill">
    <span class="fn">slot 1</span>
    <span class="fr">sync engine</span>
    <span class="fa">→</span>
    <span class="fv">ElectricSQL</span>
  </div>
  <div class="fill">
    <span class="fn">slot 2</span>
    <span class="fr">local store + query</span>
    <span class="fa">→</span>
    <span class="fv">TanStack DB</span>
  </div>
  <div class="fill keep">
    <span class="fn">slot 3</span>
    <span class="fr">write path</span>
    <span class="fa">→</span>
    <span class="fv">the tRPC we already had</span>
  </div>
</div>

<div class="alts">
  <div class="alts-head">also filling these slots</div>
  <div class="alt-chips">
    <span class="alt">Convex</span>
    <span class="alt">Ditto</span>
    <span class="alt">Instant</span>
    <span class="alt">Jazz</span>
    <span class="alt">LiveStore</span>
    <span class="alt">PowerSync</span>
    <span class="alt">RxDB</span>
    <span class="alt">Zero</span>
  </div>
</div>

<div class="pull" style="font-size:1.9rem; max-width:none; margin-top:1.7rem">
Any of them would have taught the <span class="hl">same lesson</span>.
</div>

<!--
BACKUP SLIDE — WHAT WE USED. Parked past the references slide, OUTSIDE the main flow.

This is the only slide in the deck that names a product, and it is deliberately not in the
talk. Bring it up in Q&A when someone asks what the stack was, then go back. If nobody
asks, it never gets shown — which is the correct outcome for a talk about a pattern.

To reach it on stage: it is the LAST slide in the deck. Press right from the references
slide, or type its number and hit enter.

IF ASKED: "ElectricSQL for the sync engine, TanStack DB for the local store, on top of the
tRPC API we already had. There are at least eight other things on that bottom row and any
of them would have taught the same lesson."

WHY THE CHARACTERISATIONS WERE CUT: the previous version described all seven alternatives,
in Electric's founder's words. Two problems — nobody retains seven product descriptions,
and characterising a competitor's product in a competitor's language invites a correction
from anyone in the room who ships on it. Bare names are defensible; descriptions are not.
The original table with the founder's characterisations is already in the talk doc under
Appendix A, Q33 ("Why did you pick this over Convex, Instant, Zero, Jazz, PowerSync?") —
which is the right home for it. Read it before you present; don't show it.

DO NOT read the bottom row out loud name by name. Gesture at it. It exists so the audience
sees the category is crowded, not so they memorise it.

Q&A BACKUP — "why this one over X?" Electric's own differentiator claim is that many
alternatives require an opinionated greenfield stack, meaning rewrites and lock-in; we
needed something that sat on the API we already had. Present that as "why it fit OUR
constraints", never as a verdict on the others.

Q&A BACKUP — for anyone who cares about the paper's ideal six, point at Jazz: it does
peer-to-peer end-to-end encryption, which is the ideal-six answer we did not attempt.
-->
