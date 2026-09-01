#!/usr/bin/env node
/**
 * Preflight — the invariants from the project CLAUDE.md, enforced as a build gate.
 *
 * Runs as the Netlify build command and in CI. A FAIL exits non-zero, which
 * fails the deploy. That is the point of this repository: under Netlify Drop
 * nothing could stop a bad bundle reaching the domain.
 *
 * No dependencies. Node 18+.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SITE = "site";
const fails = [];
const warns = [];
const notes = [];

const fail = (id, msg) => fails.push(`${id}  ${msg}`);
const warn = (id, msg) => warns.push(`${id}  ${msg}`);

/* ---------------------------------------------------------------- helpers */
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}
const read = (p) => readFileSync(p, "utf8");
const htmlFiles = () =>
  existsSync(SITE) ? walk(SITE).filter((f) => f.endsWith(".html")) : [];

/* ------------------------------------------------- 1 · required files ---- */
const REQUIRED = [
  "site/index.html",
  "site/file/index.html",
  "site/intake/index.html",
  "site/privacy/index.html",
  "site/terms/index.html",
  "site/start/index.html",
  "site/welcome/index.html",
  "site/_redirects",
];
for (const f of REQUIRED) {
  if (!existsSync(f)) {
    fail("F-01", `missing required file: ${f} — run scripts/pull-live.sh or copy it in`);
  }
}
if (fails.length) report(); // nothing else is meaningful without the pages

/* --------------------------------------- 2 · invariant 3: rewrites are 200 */
{
  const lines = read("site/_redirects")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  for (const line of lines) {
    const status = line.split(/\s+/)[2];
    if (!status) {
      warn("W-03", `_redirects rule has no explicit status (defaults to 301): "${line}"`);
    } else if (status !== "200") {
      fail(
        "F-03",
        `_redirects uses status ${status}, must be 200 (invariant 3 — a 30x rewrites the URL and every lead reports source: direct): "${line}"`
      );
    }
  }
  notes.push(`${lines.length} rewrite rules, all checked`);
}

/* ------------------------------------ 3 · invariant 8: no browser storage */
for (const f of htmlFiles()) {
  const src = read(f);
  if (/\b(localStorage|sessionStorage)\b/.test(src)) {
    fail("F-08", `${relative(".", f)} uses browser storage — invariant 8 forbids it everywhere`);
  }
}

/* ------------------------- 8a · campaign landing-route contracts -------- */
{
  const requiredLinks = {
    "site/start/index.html": ["/brand.css", "/checklist?s=start", "/privacy"],
    "site/welcome/index.html": ["/brand.css", "/playbook", "/file", "/privacy"],
    "site/index.html": ["/welcome"],
  };
  for (const [file, hrefs] of Object.entries(requiredLinks)) {
    const src = read(file);
    for (const href of hrefs) {
      if (!src.includes(href)) {
        fail("F-LP", `${relative(".", file)} is missing required route link: ${href}`);
      }
    }
  }
  notes.push("/start and /welcome route contracts checked");
}

/* -------------------------------- 4 · invariant 9: no external subresources */
const EXTERNAL_SUBRESOURCE = [
  /<script[^>]+src\s*=\s*["'](?:https?:)?\/\//i,
  /<link[^>]+href\s*=\s*["'](?:https?:)?\/\/(?![^"']*rel=["']canonical)/i,
  /@import\s+url\(\s*["']?(?:https?:)?\/\//i,
  /<iframe[^>]+src\s*=\s*["'](?:https?:)?\/\//i,
];
for (const f of htmlFiles()) {
  const src = read(f);
  for (const re of EXTERNAL_SUBRESOURCE) {
    const m = src.match(re);
    if (m) {
      fail(
        "F-09",
        `${relative(".", f)} loads an external subresource — invariant 9 (no web fonts, no CDN, no analytics library): ${m[0].slice(0, 90)}`
      );
      break;
    }
  }
}

/* ----------------------------------- 5 · invariant 10: font weights 400/500/700 */
for (const f of htmlFiles()) {
  const src = read(f);
  const bad = [...src.matchAll(/font-weight\s*:\s*(\d{3})/gi)]
    .map((m) => m[1])
    .filter((w) => !["400", "500", "700"].includes(w));
  if (bad.length) {
    fail(
      "F-10",
      `${relative(".", f)} uses font-weight ${[...new Set(bad)].join(", ")} — only 400/500/700 exist in the system stack; the rest are synthesised and smear (invariant 10)`
    );
  }
}

/* ------------------------- 6 · invariant 13: Stripe links in sync across files */
{
  const stripeIn = (f) =>
    new Set([...read(f).matchAll(/https:\/\/buy\.stripe\.com\/[A-Za-z0-9]+/g)].map((m) => m[0]));
  const onChecklist = stripeIn("site/index.html");
  const onFile = stripeIn("site/file/index.html");
  const only = (a, b) => [...a].filter((x) => !b.has(x));
  if (onChecklist.size === 0) warn("W-13", "no Stripe link found in site/index.html");
  if (onFile.size === 0) warn("W-13", "no Stripe link found in site/file/index.html");
  const driftA = only(onChecklist, onFile);
  const driftB = only(onFile, onChecklist);
  if (driftA.length || driftB.length) {
    fail(
      "F-13",
      `Stripe links differ between the checklist and /file (invariant 13 — the two paths would quote different prices). Only on checklist: ${driftA.join(", ") || "none"}. Only on /file: ${driftB.join(", ") || "none"}`
    );
  } else if (onChecklist.size) {
    notes.push(`Stripe links in sync (${onChecklist.size} link${onChecklist.size > 1 ? "s" : ""})`);
  }
}

/* ------------------- 7 · legal stop condition: unfilled operator decisions */
for (const f of ["site/privacy/index.html", "site/terms/index.html"]) {
  const src = read(f);
  const markers = [
    ["[OPERATOR DECISION REQUIRED]", /\[OPERATOR DECISION REQUIRED\]/i],
    ["[You supply]", /\[You supply\]/i],
    ["[TO BE CONFIRMED]", /\[TO BE CONFIRMED\]/i],
  ];
  for (const [label, re] of markers) {
    if (re.test(src)) {
      fail(
        "F-LEGAL",
        `${relative(".", f)} still carries an unanswered operator decision — found "${label}". The register's stop condition stands: publishing with amber blocks visible is worse than having no page. Answer D-01..D-12 first.`
      );
      break;
    }
  }
}

/* ----------------------------------------- 8 · placeholders and dead config */
for (const f of htmlFiles()) {
  const src = read(f);
  if (/\[LINK\]/.test(src)) fail("F-PH", `${relative(".", f)} contains an unreplaced [LINK] placeholder`);
  const emptyWebhook = src.match(/webhook\s*:\s*["']\s*["']/);
  if (emptyWebhook) fail("F-PH", `${relative(".", f)} has an empty CONFIG.webhook — capture would silently do nothing`);
  if (/beacon\s*:\s*true/.test(src)) {
    warn(
      "W-07",
      `${relative(".", f)} has CONFIG.beacon = true. Invariant 7: this stays false until WF-A branches on event === "abandoned", or partial rows hit the beehiiv upsert with an empty email. Confirm the branch exists.`
    );
  }
}

/* ------------------------------------------------ 9 · informational: prices */
{
  const prices = new Set();
  for (const f of htmlFiles()) {
    for (const m of read(f).matchAll(/S\$\s?\d+(?:\.\d{2})?/g)) prices.add(m[0]);
  }
  if (prices.size) notes.push(`prices present across the bundle: ${[...prices].sort().join(" · ")}`);
}

/* ------------------------ 10 · rewrite targets exist in the bundle ------- */
{
  const rules = read("site/_redirects")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  let resolved = 0;
  for (const rule of rules) {
    const parts = rule.split(/\s+/);
    const from = parts[0];
    const to = parts[1];
    if (!to || !to.startsWith("/") || to.startsWith("//")) continue;
    if (to.includes("*") || to.includes(":")) continue;
    const base = join(SITE, to.replace(/^\//, ""));
    const found = to.endsWith("/")
      ? existsSync(join(base, "index.html"))
      : existsSync(base) || existsSync(join(base, "index.html"));
    if (!found) {
      fail(
        "F-04",
        "_redirects sends " + from + " to " + to + ", which does not exist under " + SITE +
          "/ — the rule would 404 at a URL that is already printed and spoken"
      );
    }
    resolved++;
  }
  notes.push(resolved + " rewrite targets resolved in the bundle");
}

/* ----------------------- 11 · netlify.toml structural sanity ------------- */
{
  const TOML = "netlify.toml";
  if (!existsSync(TOML)) {
    fail("F-TOML", "netlify.toml is missing — Netlify would deploy with no publish dir, no build gate and no security headers");
  } else {
    const raw = read(TOML);

    const publish = raw.match(/^[ \t]*publish[ \t]*=[ \t]*"([^"]*)"/m);
    if (!publish) {
      fail("F-TOML", "netlify.toml has no [build] publish key");
    } else if (publish[1].replace(/\/$/, "") !== SITE) {
      fail("F-TOML", 'netlify.toml publishes "' + publish[1] + '" but this preflight checks "' + SITE + '/" — one of the two is wrong');
    }

    const command = raw.match(/^[ \t]*command[ \t]*=[ \t]*"([^"]*)"/m);
    if (!command) {
      fail("F-TOML", "netlify.toml has no [build] command — nothing would gate the deploy");
    } else if (!/preflight\.mjs/.test(command[1])) {
      fail("F-TOML", 'netlify.toml build command is "' + command[1] + '" — it no longer runs this preflight, so every check above is unenforced on deploy');
    }

    const blocks = [];
    let cur = null;
    raw.split("\n").forEach((l, i) => {
      const t = l.trim();
      if (!t || t.startsWith("#")) return;
      if (t === "[[headers]]") {
        cur = { line: i + 1, path: null, values: false, keys: 0 };
        blocks.push(cur);
        return;
      }
      if (t === "[headers.values]") {
        if (cur) cur.values = true;
        return;
      }
      if (t.startsWith("[")) {
        cur = null;
        return;
      }
      if (!cur) return;
      const p = t.match(/^for[ \t]*=[ \t]*"([^"]*)"/);
      if (p) cur.path = p[1];
      else if (cur.values && t.includes("=")) cur.keys++;
    });

    for (const b of blocks) {
      const at = "netlify.toml:" + b.line + " ";
      if (!b.path) fail("F-TOML", at + '[[headers]] block has no quoted for = "..." path');
      if (!b.values) fail("F-TOML", at + "[[headers]] block has no [headers.values]");
      else if (!b.keys) fail("F-TOML", at + "[[headers]] block sets no headers");
      if (b.path && b.path.endsWith(".html")) {
        warn(
          "W-TOML",
          at + 'for = "' + b.path + '" matches on the request path, but the pages are served at directory URLs (/, /file/, /privacy/) which do not end in .html — this block may match nothing. Confirm with: curl -sI https://thefindablecandidate.com/file/'
        );
      }
    }
    notes.push(blocks.length + " [[headers]] blocks parsed");
  }
}

report();

/* ----------------------------------------------------------------- output */
function report() {
  const line = "─".repeat(64);
  console.log(line);
  console.log("The Findable Candidate — deploy preflight");
  console.log(line);
  for (const n of notes) console.log(`  ·  ${n}`);
  if (warns.length) {
    console.log("\nWARNINGS (deploy continues — read them):");
    for (const w of warns) console.log(`  !  ${w}`);
  }
  if (fails.length) {
    console.log("\nFAILURES (deploy blocked):");
    for (const f of fails) console.log(`  ✗  ${f}`);
    console.log(`\n${line}`);
    console.log(`${fails.length} failure(s). Nothing deploys until these are fixed.`);
    process.exit(1);
  }
  console.log(`\n${line}`);
  console.log("All invariants pass. Safe to deploy.");
  process.exit(0);
}
