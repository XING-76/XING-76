/**
 * Renders the header lockup as a static SVG pair (light + dark).
 *
 * Run by hand when the name, role or mark geometry changes — unlike the stats card
 * nothing here goes stale on its own, so no workflow drives it:
 *   node .github/scripts/generate-banner.mjs
 */

import { writeFile } from 'node:fs/promises';

const FONT =
  '-apple-system,BlinkMacSystemFont,&quot;Segoe UI&quot;,Helvetica,Arial,sans-serif';

/* The mark is drawn in a 64-unit box whose visual field spans 9.5..54.5. At 1.5x that
   field is 67.5 units wide, and the -14.25 offset pulls its left edge onto x=0 so the
   mark aligns with the paragraph text below rather than with its own padding. */
const mark = (structure, core) => `<g transform="translate(-14.25 25) scale(1.5)">
    <rect x="9.5" y="9.5" width="13" height="13" rx="4.5" fill="${structure}"/>
    <rect x="41.5" y="9.5" width="13" height="13" rx="4.5" fill="${structure}"/>
    <rect x="9.5" y="41.5" width="13" height="13" rx="4.5" fill="${structure}"/>
    <path d="M50.5 40 L50.5 50.5 L40 50.5" fill="none" stroke="${structure}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="23" y="23" width="18" height="18" rx="6" fill="${core}"/>
  </g>`;

const banner = ({ structure, core, fg, muted }) => `<svg xmlns="http://www.w3.org/2000/svg" width="840" height="130" viewBox="0 0 840 130" role="img" aria-label="Hsin-Ju Hsieh (Jack) — Software Engineer" font-family="${FONT}">
  ${mark(structure, core)}
  <text x="100" y="52" fill="${muted}" font-size="11.5" font-weight="600" letter-spacing="1.6">SOFTWARE ENGINEER</text>
  <text x="100" y="96" fill="${fg}" font-size="34" font-weight="600" letter-spacing="-0.6">Hsin-Ju Hsieh <tspan fill="${muted}" font-weight="400">(Jack)</tspan></text>
</svg>
`;

/* Dark steps the core one notch lighter than the brand's #0f62fe: at this size the core
   sits against the canvas as much as against the structure squares. */
const THEMES = {
  light: { structure: '#22262b', core: '#0f62fe', fg: '#22262b', muted: '#6b7280' },
  dark: { structure: '#f4f4f2', core: '#4589ff', fg: '#f4f4f2', muted: '#8b939e' },
};

for (const [name, theme] of Object.entries(THEMES)) {
  const file = `assets/brand/banner-${name}.svg`;
  await writeFile(file, banner(theme), 'utf8');
  console.log(`wrote ${file}`);
}
