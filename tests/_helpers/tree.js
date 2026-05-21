// Source-tree mutation helpers used by tests that:
//
//   - Drop a synthetic section under `src/pages/<test-section>/`
//   - Add a manifest entry
//   - Build
//   - Inspect dist/
//   - Restore the tree to its prior state
//
// Each helper is paired (write/remove). The corresponding test wraps its
// mutations in try/finally so a failure mid-test still cleans up. This is
// NOT a defensive guard — the cleanup is a side-effect requirement, and the
// assertions inside the try block fail loudly on contract violation.

import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./build.js";

const MANIFEST = path.join(ROOT, "src", "sections.config.js");
const PAGES = path.join(ROOT, "src", "pages");

/**
 * Read the manifest file's source. Used by tests that need to verify
 * before/after content (e.g., the modularity test asserts the manifest
 * mutation is exactly one added line).
 *
 * @returns {string}
 */
export function readManifestSource() {
  return fs.readFileSync(MANIFEST, "utf8");
}

/**
 * Write a new manifest source (replacing the whole file). Caller is
 * responsible for snapshotting the original and restoring it.
 *
 * @param {string} src
 */
export function writeManifestSource(src) {
  fs.writeFileSync(MANIFEST, src);
}

/**
 * Insert a section entry into the manifest just before the closing `];`.
 * Returns the patched source. Pure — does not write to disk.
 *
 * @param {string} src - Current manifest source.
 * @param {{slug: string, label: string, enabled?: boolean}} entry
 * @returns {string}
 */
export function patchManifestWithEntry(src, entry) {
  const enabled = entry.enabled === undefined ? true : entry.enabled;
  const line =
    `  { slug: "${entry.slug}", label: "${entry.label}", enabled: ${enabled} },\n`;
  const closeIdx = src.lastIndexOf("];");
  if (closeIdx < 0) {
    throw new Error(`patchManifestWithEntry: could not find closing "];" in manifest`);
  }
  return src.slice(0, closeIdx) + line + src.slice(closeIdx);
}

/**
 * Replace the manifest's section array wholesale with the given entries.
 * Used by the manifest-order test which validates that arbitrary orderings
 * (including `enabled: false` entries) drive nav correctly.
 *
 * @param {Array<{slug: string, label: string, enabled: boolean}>} entries
 * @returns {string} - The new manifest source.
 */
export function buildManifestSource(entries) {
  const body = entries
    .map(
      (e) =>
        `  { slug: "${e.slug}", label: "${e.label}", enabled: ${e.enabled} },`,
    )
    .join("\n");
  return `// Test-managed manifest. Replaced wholesale by tests under tests/.\nconst sections = [\n${body}\n];\n\nexport default sections;\n`;
}

/**
 * Write a synthetic Astro page under `src/pages/<slug>/index.astro` with the
 * given component body. Used by federation and modularity tests.
 *
 * @param {string} slug
 * @param {string} body - Full file content (including frontmatter delimiters
 *   if any).
 */
export function writeSyntheticPage(slug, body) {
  const dir = path.join(PAGES, slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.astro"), body);
}

/**
 * Remove a synthetic page directory created by `writeSyntheticPage`. Safe to
 * call even if the directory is already gone (the test passes `rm -rf`-style
 * semantics).
 *
 * @param {string} slug
 */
export function removeSyntheticPage(slug) {
  const dir = path.join(PAGES, slug);
  fs.rmSync(dir, { recursive: true, force: true });
}

/**
 * Write a portfolio entry markdown file. Used by the portfolio-add-entry
 * TestScenario.
 *
 * @param {string} slug - Filename stem (no `.md`).
 * @param {string} contents - Full markdown source.
 */
export function writePortfolioEntry(slug, contents) {
  const dir = path.join(ROOT, "src", "content", "portfolio");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${slug}.md`), contents);
}

/**
 * Remove a portfolio entry markdown file. No-op if absent.
 *
 * @param {string} slug
 */
export function removePortfolioEntry(slug) {
  const file = path.join(ROOT, "src", "content", "portfolio", `${slug}.md`);
  fs.rmSync(file, { force: true });
}
