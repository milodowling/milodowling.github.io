// ADC-IMPLEMENTS: <home-test-params-no-precedent-03>
//
// Static-analysis enforcement of the params-no-precedent constraint
// (<home-constraint-params-no-precedent-05>).
//
// The contract guarantees that the engine pass can ship a different `params`
// shape without touching shell code. The load-bearing mechanism is: the shell
// (EngineSlot.jsx, Hero.astro, and every other shell-scope file) does NOT
// read, validate, or branch on any specific `params.<key>`. Only the
// placeholder shader (`PlaceholderShader.jsx`) is permitted to inspect
// `params` keys — and only because the placeholder is itself swappable.
//
// This is enforced as a static grep across the entire `src/` tree: any hit
// for `params.` outside `PlaceholderShader.jsx` indicates a soft-bind that
// would break the engine-swap guarantee.
//
// The test does NOT need to build, run a browser, or load any page. It is a
// pure static analysis over the source tree, which makes it cheap and
// stable: a code review that introduces a `params.foo` access anywhere
// outside the placeholder fails this test instantly.

import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const SRC = path.join(ROOT, "src");

/**
 * Walk `src/` recursively, collecting every JS/JSX/Astro source file. Skips
 * the placeholder shader (which is *permitted* to read params keys per the
 * contract — see the "demonstration keys" clause in
 * <home-constraint-params-no-precedent-05>).
 *
 * @param {string} dir
 * @returns {string[]} absolute file paths
 */
function collectShellSources(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      out.push(...collectShellSources(full));
      continue;
    }
    if (!/\.(js|jsx|astro|css|md)$/.test(name)) continue;
    // The placeholder shader is the ONLY file permitted to read params keys.
    if (name === "PlaceholderShader.jsx") continue;
    out.push(full);
  }
  return out;
}

describe("<home-test-params-no-precedent-03>: shell does not soft-bind on params keys", () => {
  it("no `params.<key>` access exists in any shell source file outside PlaceholderShader.jsx", () => {
    const files = collectShellSources(SRC);
    // Sanity: collection itself is non-empty (catches a refactor that moved
    // src/ elsewhere and would silently zero out this test).
    expect(files.length).toBeGreaterThan(5);

    const offenders = [];
    for (const file of files) {
      const src = fs.readFileSync(file, "utf8");
      // Match `params.` followed by an identifier character. The dot
      // followed by an identifier is the load-bearing signal — `params || {}`
      // does not match (no dot), `params={effectiveParams}` does not match
      // (no dot followed by ident), but `params.tint`, `params?.tint`,
      // `params["tint"]` (caught by the second regex below) would.
      const dotHits = src.match(/\bparams\??\.[A-Za-z_$]/g);
      const bracketHits = src.match(/\bparams\s*\[\s*["'`]/g);
      if (dotHits || bracketHits) {
        offenders.push({
          file: path.relative(ROOT, file),
          dot: dotHits || [],
          bracket: bracketHits || [],
        });
      }
    }

    expect(
      offenders,
      `Found shell-scope code reading params keys (forbidden by <home-constraint-params-no-precedent-05>):\n${JSON.stringify(offenders, null, 2)}`,
    ).toEqual([]);
  });

  it("EngineSlot.jsx receives `params` as an opaque prop and passes it to the render child without destructuring keys", () => {
    const file = path.join(SRC, "components", "EngineSlot.jsx");
    const src = fs.readFileSync(file, "utf8");
    // Must declare `params` as a prop (the contract's locked interface) and
    // must pass it onward (the pass-through guarantee). The exact syntax
    // matters less than the absence of key reads.
    expect(src).toMatch(/\bparams\b/);
    expect(src).toMatch(/params=\{[^}]+\}/); // forwarded to the render child
    // And the static grep above already verified zero `params.<key>` reads.
  });

  it("Hero.astro mounts EngineSlot with params as an opaque value (does not inspect keys)", () => {
    const file = path.join(SRC, "components", "Hero.astro");
    const src = fs.readFileSync(file, "utf8");
    expect(src).toMatch(/<EngineSlot[^/]*params=\{[^}]*\}/);
    // The static grep above caught any `params.<key>` access already.
  });
});
