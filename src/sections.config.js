// ADC-IMPLEMENTS: <section-feature-manifest-01>
//
// Section manifest. Source of truth for navigation order, labels, and
// per-section visibility. The shell's nav component (src/components/Nav.astro)
// reads this file and renders one link per `enabled: true` entry.
//
// Field semantics (locked by <section-feature-manifest-01>):
//   - slug    : string, lowercase, URL-safe. Must match the directory name
//               under `src/pages/<slug>/` for the section's pages to resolve.
//   - label   : string, displayed in navigation. Free-form human text.
//   - enabled : boolean. When false, the section is hidden from navigation
//               but its routes remain reachable by direct URL.
//
// The shell does NOT mandate any additional fields. Sections may extend
// entries with section-specific metadata, but the shell's nav code reads only
// the three fields above.
//
// To add a section: see README.md → "Adding a section" (the two-file-touch
// procedure that <shell-test-modularity-02> verifies).
const sections = [
  { slug: "portfolio", label: "Portfolio", enabled: true },
  { slug: "synth", label: "Synth", enabled: true },
  { slug: "dnd", label: "D&D", enabled: true },
  { slug: "tools", label: "Tools", enabled: true },
];

export default sections;
