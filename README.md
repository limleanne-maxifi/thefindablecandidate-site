# thefindablecandidate-site

The marketing site for **The Findable Candidate** — `thefindablecandidate.com`. Plain static HTML, deployed to Netlify **from Git**.

This repository exists to close **T-20**: deploys were Netlify Drop, which meant no history, no rollback, no review, and a live site that could drift from the working files with nobody able to tell by how much. From the first commit, this repo is the source of truth.

---

## What's here

```
site/                    ← the publish directory, exactly what goes on the domain
  index.html             The Findability Checklist (also served at /check /li /tt /fb /ig /yt /checklist /shared)
  file/index.html        The Candidate File order page
  intake/index.html      Post-purchase intake form
  privacy/index.html     Privacy notice
  terms/index.html       Terms and refunds
  assets/                the LinkedIn Visibility Playbook PDF — served at /playbook (200)
  _redirects             source-path rewrites — status 200 only (invariant 3)
netlify.toml             publish dir, build = preflight, security headers
scripts/preflight.mjs    the invariants, enforced as a build gate
scripts/pull-live.sh     one-time: capture what the domain serves today
.github/workflows/       the same preflight on every push and PR
```

## First-time setup (~20 minutes)

**1 · Populate `site/` with the pages.** Two options — pick one:

```bash
bash scripts/pull-live.sh          # capture what the domain serves right now
```

or copy your working files in by hand, renaming as you go:

| Working file | Goes to |
|---|---|
| `findability-checklist-v2.html` | `site/index.html` |
| `candidate-file-order-page.html` | `site/file/index.html` |
| `candidate-file-intake.html` | `site/intake/index.html` |
| `privacy-page-v2.html` | `site/privacy/index.html` |
| `terms-page-v2.html` | `site/terms/index.html` |

The pull script is the more honest baseline: it records what is *actually live*, drift and all. Diff it against your working copies afterwards and read the difference before committing — that diff is exactly what Drop cost you.

**2 · Run the preflight.**

```bash
node scripts/preflight.mjs
```

Expect the **legal pages to fail** while D-01…D-12 remain open in the decision register. That failure is correct and deliberate — see the stop condition below.

**3 · Push to GitHub**, then in Netlify: **Site configuration → Build & deploy → Link to a Git repository**, choose this repo. Netlify reads `netlify.toml`, so publish directory and build command need no manual entry.

**4 · Deploy once and verify on the real domain** (not a preview URL, per invariant 4 — CORS is scoped to the apex exactly):

- `/li` keeps its URL in the address bar and the page reports `source: linkedin`
- the offer block renders after reveal
- a test submission returns `{"ok":true}`
- hard-refresh (`Ctrl+Shift+R`); a cached copy makes a good deploy look broken
- when checking whether a deploy landed, add a cache-buster (`?cb=1`)

**5 · Stop using Drop.** Once Git deploys are working, drag-and-drop is how the two sources diverge again.

## Working on the site

```bash
npm run serve       # http://localhost:8080, with the /li /tt /fb rewrites emulated
npm run preflight   # the same gate Netlify runs
```

Branch → PR → CI preflight → Netlify deploy preview → merge to `main` → production. Rollback is **Deploys → previous deploy → Publish**, which is the thing Drop never gave you.

---

## The build gate

`scripts/preflight.mjs` is the Netlify build command. If it exits non-zero the deploy does not happen. It enforces:

| Check | Rule |
|---|---|
| **F-01** | all five pages and `_redirects` present |
| **F-03** | every `_redirects` rule uses status **200**, never 301 — a 30x rewrites the URL and every lead reports `source: direct`, destroying the only measurement the link scheme exists for |
| **F-08** | no `localStorage` / `sessionStorage` anywhere |
| **F-09** | no external subresources — no web fonts, no CDN, no analytics library (this is also why there is no cookie banner) |
| **F-10** | font weights 400 / 500 / 700 only; 600 and 800 are synthesised on many machines and smear |
| **F-13** | Stripe links identical between the checklist and `/file`, or the two paths quote different prices |
| **F-LEGAL** | **no unanswered `[OPERATOR DECISION REQUIRED]` / `[You supply]` block in the privacy or terms pages** |
| **F-PH** | no `[LINK]` placeholders, no empty `CONFIG.webhook` |
| **W-07** | warns if `CONFIG.beacon` is `true` — it stays false until WF-A branches on `event === "abandoned"`, or partial rows hit the beehiiv upsert with an empty email |

### The stop condition, stated plainly

Twelve decisions (D-01…D-12 in the decision register) block publication of the privacy and terms pages. Until every one is answered and every amber marker is gone, those pages do not go on the domain. **F-LEGAL** makes that mechanical rather than remembered. Do not "temporarily" delete the check to get a deploy out — publishing with amber blocks visible is worse than having no page.

## Content Security Policy

`netlify.toml` ships CSP in **report-only** mode, built from what the pages actually do: inline styles and scripts (`'unsafe-inline'` — removing it is a rebuild, not a config change), a `data:` URI for the select chevron, and `connect-src` for the n8n capture webhook. Stripe and WhatsApp links are navigations, not fetches, so they need no entry.

Load all five pages with DevTools open, confirm zero violations, then drop the `-Report-Only` suffix to enforce it.

## What this repo is not

The authenticated application (`app.thefindablecandidate.com`, The Opportunity Check) is a **separate repository** — `the-findable-candidate-app`, Next.js. No CV, no customer result, and no private data ever lives here.
