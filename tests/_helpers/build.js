// Shared build helper used by Vitest tests that mutate `src/` and then need
// to inspect the resulting `dist/`. Centralizes:
//
//   - Calling `astro build` synchronously
//   - Resolving project paths
//   - Reading built HTML for a given route
//
// Tests using this helper run serially (vitest.config.js sets
// `fileParallelism: false` and a single fork) because they all mutate the
// shared source tree under `src/`.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, "..", "..");
export const DIST = path.join(ROOT, "dist");

/**
 * Run `astro build` and throw on non-zero exit. Output is buffered so the
 * vitest reporter stays clean; on failure, the stderr is included in the
 * thrown error.
 */
export function astroBuild() {
  const npxBin = process.platform === "win32" ? "npx.cmd" : "npx";
  execFileSync(npxBin, ["astro", "build"], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env },
    maxBuffer: 64 * 1024 * 1024,
  });
}

/**
 * Read a built HTML file for a given route.
 *
 * Routes:
 *   - "/"                       → dist/index.html
 *   - "/portfolio/"             → dist/portfolio/index.html
 *   - "/portfolio/foo/"         → dist/portfolio/foo/index.html
 *
 * @param {string} route
 * @returns {string}
 */
export function readBuiltHtml(route) {
  const rel = route.replace(/^\/+/, "").replace(/\/+$/, "");
  const file = rel === ""
    ? path.join(DIST, "index.html")
    : path.join(DIST, rel, "index.html");
  return fs.readFileSync(file, "utf8");
}

/**
 * Check whether a built HTML route exists.
 *
 * @param {string} route
 * @returns {boolean}
 */
export function builtHtmlExists(route) {
  const rel = route.replace(/^\/+/, "").replace(/\/+$/, "");
  const file = rel === ""
    ? path.join(DIST, "index.html")
    : path.join(DIST, rel, "index.html");
  return fs.existsSync(file);
}

/**
 * Extract all `<style>` block contents from an HTML document, concatenated
 * with newlines. Used by federation tests to inspect CSS that the build
 * inlined into a particular route.
 *
 * @param {string} html
 * @returns {string}
 */
export function extractStyles(html) {
  const out = [];
  const re = /<style[^>]*>([\s\S]*?)<\/style>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    out.push(m[1]);
  }
  return out.join("\n");
}
