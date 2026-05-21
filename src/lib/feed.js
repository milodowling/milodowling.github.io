// ADC-IMPLEMENTS: <section-feature-feed-03>
//
// Generic feed loader. Reads markdown files in lexicographic filename order
// from a section's `src/pages/<section>/feed/` directory (or wherever the
// section chose to root its feed — the loader takes a path) and returns the
// entries as an ordered list.
//
// Locked semantics (per <section-feature-feed-03>):
//   - Order: filename ascending (lexicographic). Sections that want
//     chronological ordering prefix filenames with ISO dates or zero-padded
//     sequence numbers.
//   - Payload shape: { slug, frontmatter, body } per entry.
//   - The shell does NOT constrain the markdown payload beyond "valid markdown
//     with optional frontmatter."
//
// Authoring contract (signature):
//   loadFeed(section: string) → Array<{ slug, frontmatter, body }>
//
// Slug derivation: the markdown file's stem (filename minus `.md`).
//
// Frontmatter parsing: tolerant of files with no frontmatter at all (returns
// `frontmatter: {}`), files with empty frontmatter blocks, and files with
// arbitrary frontmatter key/value pairs. Per the contract's "no payload
// constraint" clause, the loader does NOT validate frontmatter shape.
//
// Fail-not-fallback: the loader throws if the section directory doesn't exist
// or contains no markdown files — a silent empty return would mask
// authoring/configuration errors. Sections that legitimately have empty feeds
// in some build configuration should branch at the call site, not rely on
// the loader to swallow the case.
//
// File-system location convention: the loader looks under
// `src/pages/<section>/feed/` by default. The path is project-root-relative
// and computed via Node's `process.cwd()`; tests that exercise the loader
// chdir or pass an absolute path via the `root` option.

import fs from "node:fs";
import path from "node:path";

/**
 * Parse a YAML-ish frontmatter block. Tolerant: handles missing frontmatter,
 * empty frontmatter, and basic `key: value` pairs (strings, numbers, booleans).
 * Arrays and nested objects are NOT parsed — the contract says the shell does
 * not constrain the payload, and a tolerant parser is the cheapest way to
 * deliver that promise. Sections that need richer frontmatter parse it
 * themselves at the call site.
 *
 * @param {string} src - Full file contents.
 * @returns {{frontmatter: object, body: string}}
 */
function parseFrontmatter(src) {
  // Match optional BOM + leading `---\n` ... `\n---` block.
  const m = src.match(/^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) {
    return { frontmatter: {}, body: src.replace(/^﻿/, "") };
  }
  const [, fmBlock, body] = m;
  const frontmatter = {};
  for (const rawLine of fmBlock.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    if (line.startsWith("#")) continue;
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim();
    let val = line.slice(colon + 1).trim();
    // Strip surrounding single or double quotes.
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    } else if (val === "true") {
      val = true;
    } else if (val === "false") {
      val = false;
    } else if (val !== "" && !Number.isNaN(Number(val))) {
      val = Number(val);
    }
    frontmatter[key] = val;
  }
  return { frontmatter, body };
}

/**
 * Load a section's markdown feed.
 *
 * @param {string} section - Section slug (e.g. "synth", "test-feed").
 * @param {object} [options]
 * @param {string} [options.root] - Project root (defaults to process.cwd()).
 *   Tests pass an absolute path here to exercise the loader against a
 *   synthetic feed directory under a temp tree.
 * @returns {Array<{slug: string, frontmatter: object, body: string}>}
 *   In lexicographic order by filename. Throws if the feed directory is
 *   missing or empty.
 */
export function loadFeed(section, options) {
  if (typeof section !== "string" || section.length === 0) {
    throw new Error(
      `loadFeed(): section must be a non-empty string, got ${JSON.stringify(section)}`,
    );
  }
  const root = options && typeof options.root === "string"
    ? options.root
    : process.cwd();
  const feedDir = path.join(root, "src", "pages", section, "feed");
  if (!fs.existsSync(feedDir)) {
    throw new Error(`loadFeed("${section}"): feed directory does not exist: ${feedDir}`);
  }
  const all = fs.readdirSync(feedDir);
  const mdFiles = all.filter((name) => name.endsWith(".md")).sort();
  if (mdFiles.length === 0) {
    throw new Error(`loadFeed("${section}"): feed directory contains no markdown files: ${feedDir}`);
  }
  return mdFiles.map((filename) => {
    const slug = filename.replace(/\.md$/, "");
    const src = fs.readFileSync(path.join(feedDir, filename), "utf8");
    const { frontmatter, body } = parseFrontmatter(src);
    return { slug, frontmatter, body };
  });
}
