# CLAUDE.md — thefindablecandidate-site

Guidance for Claude Code in the **marketing site** repository. `README.md` carries setup and the working loop; this file carries what must not be re-derived, re-litigated or quietly softened between sessions.

The authenticated application is a separate repository — see *Related repositories*. No CV, customer result or private data ever lives here.

---

## Current state — 18 Aug 2026

| Item | State |
|---|---|
| Deploys | **From Git**, linked to Netlify. Drop is retired. Rollback is Deploys → previous deploy → Publish |
| Build gate | Passing. `node scripts/preflight.mjs` exits zero |
| **F-LEGAL** | **Passing.** The privacy and terms pages carry no unanswered markers — D-01…D-12 were settled before those pages went live |
| Product | The Findability Check, S$49, live. Add-on roles S$29 each, orderable only after the first Check is delivered (ADR-032) |
| Free tier | Unlock Your Findability |
| Brand | The system in `site/brand.css` is authoritative — see below |

---

## The build gate outranks the deploy

`scripts/preflight.mjs` is the Netlify build command. A non-zero exit means no deploy. That is the entire reason this repository exists.

| ID | Enforces | Why |
|---|---|---|
| **F-01** | Five pages and `_redirects` present | A missing page deploys a 404 over something that worked |
| **F-03** | Every `_redirects` rule is status **200** | A 30x rewrites the URL, so every lead reports `source: direct` and the link scheme stops measuring anything |
| **F-08** | No `localStorage` / `sessionStorage` | — |
| **F-09** | No external subresources — no web fonts, CDN, analytics library or iframes | Privacy, speed, and why there is no cookie banner |
| **F-10** | Font weights 400 / 500 / 700 only | 600 and 800 are synthesised on many machines and smear |
| **F-13** | Stripe links identical between the checklist and `/file` | Otherwise the two paths quote different prices |
| **F-LEGAL** | No unanswered `[OPERATOR DECISION REQUIRED]` / `[You supply]` block in privacy or terms | Publishing with amber markers visible is worse than having no page |
| **F-PH** | No `[LINK]` placeholder, no empty `CONFIG.webhook` | An empty webhook means capture silently does nothing |
| **W-07** | Warns when `CONFIG.beacon` is true | Stays false until the capture workflow branches on `event === "abandoned"` |

**Never weaken a check to get a deploy out.** Not temporarily, not with a comment promising to restore it. If the gate fails, the gate is working. Adding a check is welcome; removing or narrowing one is an operator decision, recorded.

**Two notes from experience.** `.gitkeep` files and the mount can make Git report every file as modified — that is `core.fileMode`, not a real diff; `git config core.fileMode false` settles it. And the pages sit under a Windows path, so a crashed Git process leaves `.git/*.lock` files that only Windows can delete.

---

## Brand — `site/brand.css` is the system

One stylesheet carries it: both display faces embedded as base64, the token set, and a mapping layer over the classes the pages already use. Link it from every page immediately **after** the page's own `</style>`:

```html
<link rel="stylesheet" href="/brand.css">
```

It stays same-origin and font-embedded precisely so F-09 keeps passing. Never replace it with a hosted font or a CDN stylesheet.

### Three faces, one job each

| Face | Role | Never |
|---|---|---|
| **Depot** (400) | Identity — wordmark, section markers, eyebrows | Headlines, body, anything under 13px, more than four words |
| **Neue Jothama Medium Oblique** (500) | Voice — h1, h2, h3, display numbers | Body copy, FAQ answers, form fields, captions |
| **System sans** | Clarity — body, UI, buttons, forms, all data | Headings |

Depot is unicase, so case is decorative in it. Numerals are always the system sans with `tabular-nums` — the oblique is for words, and aligned columns matter more than expressive digits in a document people check.

### Colour, and the rule that cannot bend

```
--navy:#0F2740   --navy-deep:#0A1B2C   --ink:#152232   --ink-soft:#5A6B7D
--paper:#FBFAF7  --surface:#FFFFFF     --rule:#E4E1DA
--teal:#0E7C74   --teal-soft:#E3F1EF   --amber:#B4761F  --amber-soft:#FBEEDC
```

**Teal marks a FOUND state. Amber marks a MISS. Neither is ever decorative.** They carry meaning in the report figures — *returned* against *not returned* — and the site must speak the same language or the figures stop meaning anything the moment a customer sees both.

Two consequences that have already bitten:

- **The order panel is navy with a teal button.** It used to be amber. An amber buy panel makes the loudest element on the page contradict the colour language every figure depends on.
- **Site amber `#E8B33C` is not a mark colour.** It measures 1.9:1 against white and fails as a dot, bar or rule. `#B4761F` at 3.8:1 is the mark; the light amber is a background fill only.

**Every status carries a word beside the colour** — "Not returned", "Returned" — so figures survive colourblindness, greyscale printing and a screenshot compressed by a messaging app.

---

## The product line — a truth ladder

Each tier upgrades how much of the answer is *observed* rather than *believed* (ADR-026, app repo).

| Tier | Name | Establishes | Price |
|---|---|---|---|
| Free | **Unlock Your Findability** | What you believe about your profile — self-reported, labelled as such | S$0 |
| Paid, this site | **The Findability Check** | What the recruiter's search actually returned — observed | S$49 |
| Paid, the app | **The Opportunity Check** | Whether to apply to five specific roles | S$89 |

Two rules that are easy to lose in a copy edit:

- **Free-tier copy stays conditional** — "you *would* be returned", never "you are". Self-report cannot measure retrieval. Only the paid tier drops the conditional.
- **Each tier prices above the one below.** A change that inverts the ladder is an ADR in the app repo, not an edit here.

Superseded prices: **S$28** (former Candidate File) and **S$9.80** (National Day pre-order). Both are gone, along with the date-branching machinery that served them — a discount link left in page source is a price anyone can still pay.

---

## Voice

Plain UK English. Calm, credible, second person, short sentences. The reader may have been searching for months.

**Banned:** hype, "beat the ATS", outcome promises, hire-probability wording, "AI thinks" phrasing, invented numbers. US spellings are a defect.

**One amendment (ADR-029):** *"unlock"* is permitted in exactly one string — the free tier's name, **Unlock Your Findability**. Banned everywhere else. Do not "correct" the product name.

**Every statistic carries a visible source line.** Usable: application-per-hire and interview-advancement figures from the Ashby Recruiter Productivity Report 2026; Singapore vacancy figures from MOM's Labour Market Report Q1 2026. Not usable without a primary source: any "sourced candidates are N× more likely to be hired" claim.

**Never promise interviews or a job.** The promise is retrievability, measured, with a re-check.

---

## Delivery rules that copy must not contradict

The Findability Check is delivered manually under Methodology v2.1 (ADR-030):

- Searches are run **by a person**, in a seat, at the candidate's request. Nothing is scraped or automated — LinkedIn's User Agreement prohibits automated collection, and an automated version of this product would be indefensible.
- **The search tier is disclosed on every report**, because tiers see different slices of the network.
- A candidate outside that scope is reported as **out of scope, never as absent**. Conflating the two is the single most damaging error this method can make, and no page may imply otherwise.
- **One Check covers one target role.** A second role is a second Check at S$29, after the first is delivered.

---

## What the site may collect

Email address, LinkedIn profile URL, up to three target role titles, seniority, industry, and one line of context.

**Never a CV, an identity document, a customer result, or any private data.** That exclusion is what keeps this repository outside the application's PDPA scope, and it is a boundary, not a default. It is also a selling point: the privacy notice can say the product never asked for a CV.

---

## Capture

Entry paths are rewrites, not redirects: `/check` `/li` `/tt` `/fb` `/ig` `/yt` `/checklist` `/shared` all serve `site/index.html` at status 200, and the page reads `location.pathname` to tag the source. Breaking that is F-03.

---

## Verifying a deploy

On the **real domain**, never a preview URL — CORS is scoped to the apex exactly.

- `/li` keeps its URL and the page reports `source: linkedin`
- the offer block renders after reveal
- a test submission returns `{"ok":true}`
- hard-refresh with a cache-buster; a cached copy makes a good deploy look broken

---

## Working practice

Branch → PR → CI preflight → Netlify deploy preview → merge to `main` → production.

- **Never hand-transcribe a live page into this repo.** Use `scripts/pull-live.sh` or copy the file — re-typing a production page risks silently corrupting the thing currently earning money.
- `npm run serve` emulates the rewrites locally. `npm run preflight` is the same gate Netlify runs; run it before opening a PR.
- **Prices change in one commit with their Stripe link.** A page that advertises one price while the link charges another is a mispriced product, and invariant 13 fails the build if the two pages drift apart.

---

## Related repositories

- **`the-findable-candidate-app`** — `app.thefindablecandidate.com`, the authenticated application behind The Opportunity Check. Next.js on Netlify. Its ADRs govern product, pricing and voice; this repository implements them and never overrides them. Where a decision here would contradict an ADR there, the answer is a new ADR proposed to the operator, never a quiet deviation in a page.

---

## Open items

- **OPEN-11** (app repo) — whether this site has already taken revenue. The validation threshold assumes no customers; if money has changed hands, the answer changes what the kill threshold means.
- **Invariant numbering.** This file describes the preflight's checks by their IDs, which are verifiable in code. The numbered invariants referenced in `README.md` and the migration notes — 3, 6, 7, 8, 9, 10, 12, 13 — live in a document outside this repo. Bring that list in here or record where it lives, so the numbering has one home. Invariant 6 should now read that the site deploys from Git.
