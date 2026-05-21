// ADC-IMPLEMENTS: <portfolio-helper-r2-02>
//
// Resolve a Cloudflare R2 object key to a public URL string.
//
// Locked signature (per contracts/ADC_004_PORTFOLIO_SECTION.md):
//   r2(key: string) -> string
//
// The base URL lives in the R2_PUBLIC_BASE env var (see .env.example) and is
// baked into the static build via astro.config.mjs vite.define. Entries
// reference R2 keys only; the helper never hard-codes a bucket URL.
//
// Authoring conventions:
//   - In Astro/JSX templates: <img src={r2("portfolio/2026/hero.jpg")} />
//   - In markdown frontmatter: `thumb: "r2:portfolio/2026/thumb.jpg"`
//       The `r2:` prefix is resolved by the portfolio entry/index pages
//       (Phase 3 work — see <portfolio-feature-content-01>).
//
// Forward-extension path (out of scope for v1): a future ADC pass may extend
// the helper with a `r2.image(key)` component variant. v1 ships string-only.

const BASE = import.meta.env.R2_PUBLIC_BASE;

/**
 * Resolve an R2 key to a public URL string.
 *
 * @param {string} key - R2 object key (e.g. "portfolio/2026/hero.jpg").
 * @returns {string} Public URL.
 */
export function r2(key) {
  // Fail-not-fallback: the helper rejects empty/non-string keys explicitly.
  // A silently-empty URL would mask authoring mistakes downstream.
  if (typeof key !== "string" || key.length === 0) {
    throw new Error(
      `r2(): key must be a non-empty string, got ${JSON.stringify(key)}`,
    );
  }
  if (typeof BASE !== "string" || BASE.length === 0) {
    throw new Error(
      "r2(): R2_PUBLIC_BASE is not configured. See .env.example.",
    );
  }
  // Strip leading slash on key, trailing slash on base, then join.
  const cleanBase = BASE.replace(/\/+$/, "");
  const cleanKey = key.replace(/^\/+/, "");
  return `${cleanBase}/${cleanKey}`;
}

/**
 * Resolve a value that may be either:
 *   - a plain URL (returned as-is), or
 *   - an `r2:`-prefixed key (resolved via r2()).
 *
 * Used by the portfolio content layer to resolve frontmatter media references
 * authored with the `r2:` prefix. See <portfolio-feature-content-01>.
 *
 * @param {string} value - Either a URL or "r2:<key>".
 * @returns {string} Resolved URL.
 */
export function resolveMediaRef(value) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(
      `resolveMediaRef(): value must be a non-empty string, got ${JSON.stringify(value)}`,
    );
  }
  if (value.startsWith("r2:")) {
    return r2(value.slice("r2:".length));
  }
  return value;
}
