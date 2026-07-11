// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";

// ADC-IMPLEMENTS: <shell-impl-stack-01>
// Astro + React islands. Static-by-default; engine slot is the only React
// island in Phase 1. R2 base URL flows in via env at build time; see
// <portfolio-helper-r2-02> in src/lib/r2.js.
//
// The D&D tabletop tool is a plain static asset at public/dnd-tabletop/
// (served verbatim at /dnd-tabletop/) — see <dnd-feature-tool-route-01> in
// contracts/ADC_006_DND_TABLETOP.md. No build integration required.

export default defineConfig({
  site: "https://milodowling.com",
  output: "static",
  integrations: [react()],
  vite: {
    define: {
      // R2 public base URL — see <portfolio-helper-r2-02>.
      //
      // The canonical production base is `https://media.milodowling.com` per
      // the contract. Tests and alternate deployments override via the
      // `R2_PUBLIC_BASE` env var (see .env.example). The string is baked
      // into the static build at build time.
      //
      // Fail-not-fallback at runtime: `src/lib/r2.js` throws if the baked
      // value is empty, so a misconfigured build cannot silently ship with
      // broken media URLs.
      "import.meta.env.R2_PUBLIC_BASE": JSON.stringify(
        process.env.R2_PUBLIC_BASE || "https://media.milodowling.com",
      ),
    },
  },
});
