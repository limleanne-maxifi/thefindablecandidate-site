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
