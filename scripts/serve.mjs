#!/usr/bin/env node
/**
 * Local preview that emulates the Netlify rewrites, so /li behaves locally the
 * way it behaves on the domain — URL preserved, source attribution intact.
 * Reads site/_redirects rather than hardcoding the paths, so the two can't drift.
 */
import http from "node:http";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const PORT = Number(process.env.PORT || 8080);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain",
};

const rewrites = new Map();
for (const raw of readFileSync("site/_redirects", "utf8").split("\n")) {
  const line = raw.trim();
  if (!line || line.startsWith("#")) continue;
  const [from, to, status] = line.split(/\s+/);
  if (status === "200") rewrites.set(from, to);
}

http
  .createServer(async (req, res) => {
    let path = decodeURIComponent(req.url.split("?")[0]);
    if (rewrites.has(path)) path = rewrites.get(path);
    if (path.endsWith("/")) path += "index.html";
    const file = join("site", normalize(path).replace(/^(\.\.[/\\])+/, ""));
    try {
      const body = await readFile(file);
      res.writeHead(200, {
        "Content-Type": TYPES[extname(file)] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(body);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end(`404 — no file at ${file}`);
    }
  })
  .listen(PORT, () => {
    console.log(`site/ served at http://localhost:${PORT}`);
    console.log(`rewrites active: ${[...rewrites.keys()].join(" ") || "none"}`);
  });
