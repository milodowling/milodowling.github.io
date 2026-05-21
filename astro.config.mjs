// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

// ADC-IMPLEMENTS: <shell-impl-stack-01>
// Astro + React islands on Cloudflare Pages. Static-by-default; engine slot
// is the only React island in Phase 1. R2 base URL flows in via env at build
// time; see <portfolio-helper-r2-02> in src/lib/r2.js.
//
// ADC-IMPLEMENTS: <stubs-feature-dnd-tabletop-passthrough-03>
// The DND preservation passthrough is implemented by the inline integration
// `dndTabletopPassthrough()` below, which copies
// `_preserved-dnd-content/dnd-tabletop/index.html` into the build output at
// `/dnd-tabletop/index.html` and mirrors it for dev. README is NOT published.
//
// DND-PRESERVATION: remove when D&D ADC init pass lands
// (the future D&D ADC pass will redesign the section and may absorb the
// preserved tool. Until then, the file copy and the integration below are
// load-bearing.)

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const preservedRoot = path.join(
  projectRoot,
  "_preserved-dnd-content",
  "dnd-tabletop",
);
const preservedIndex = path.join(preservedRoot, "index.html");

/**
 * Inline Astro integration that copies the preserved /dnd-tabletop/index.html
 * into the build output and into the dev-server's public directory.
 *
 * Implements: <stubs-feature-dnd-tabletop-passthrough-03> and the build-side
 * half of <shell-constraint-url-preservation-04>.
 *
 * DND-PRESERVATION: remove when D&D ADC init pass lands
 */
// ADC-IMPLEMENTS: <stubs-feature-dnd-tabletop-passthrough-03>
function dndTabletopPassthrough() {
  const targetDevDir = path.join(projectRoot, "public", "dnd-tabletop");
  const targetDevFile = path.join(targetDevDir, "index.html");

  function copyToPublic() {
    const source = fs.readFileSync(preservedIndex);
    fs.mkdirSync(targetDevDir, { recursive: true });
    fs.writeFileSync(targetDevFile, source);
  }

  function copyToDist(distRoot) {
    const distDir = path.join(distRoot, "dnd-tabletop");
    const distFile = path.join(distDir, "index.html");
    const source = fs.readFileSync(preservedIndex);
    fs.mkdirSync(distDir, { recursive: true });
    fs.writeFileSync(distFile, source);
  }

  return {
    name: "dnd-tabletop-passthrough",
    hooks: {
      "astro:config:setup": () => {
        // Stage the preserved tool into public/ so dev server serves it at
        // /dnd-tabletop/. Astro's static `public/` directory is the
        // contract-suggested passthrough mechanism.
        copyToPublic();
      },
      "astro:build:done": ({ dir }) => {
        // Belt-and-braces: ensure the file is present in dist/ even if
        // public/ staging was bypassed.
        const distRoot = fileURLToPath(dir);
        copyToDist(distRoot);
      },
    },
  };
}

export default defineConfig({
  site: "https://milodowling.com",
  output: "static",
  integrations: [react(), dndTabletopPassthrough()],
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
