/**
 * Renders the GitHub activity card as a static SVG pair (light + dark).
 *
 * Self-hosted on purpose: the public third-party stats services this card used to
 * point at go down without warning, and a README image that 503s is worse than
 * no image at all. Everything here is committed output, so the card always renders.
 *
 * Usage: GITHUB_TOKEN=<token> node .github/scripts/generate-stats.mjs <login>
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const LOGIN = process.argv[2] ?? 'XING-76';
const TOKEN = process.env.GITHUB_TOKEN;
const OUT_DIR = resolve(process.cwd(), 'assets');

if (!TOKEN) {
  console.error('GITHUB_TOKEN is required');
  process.exit(1);
}

/* Palette. Structure colours track the brand mark; the accent is the mark's core
   blue, stepped one notch lighter on dark so it keeps contrast against the canvas. */
const THEMES = {
  light: {
    bg: '#ffffff',
    border: '#e3e6ea',
    fg: '#22262b',
    muted: '#6b7280',
    track: '#eceef1',
    accent: '#0f62fe',
    scale: ['#0f62fe', '#3d4249', '#6b7280', '#9aa1a9', '#c8ced4'],
  },
  dark: {
    bg: '#12161b',
    border: '#272c33',
    fg: '#f4f4f2',
    muted: '#8b939e',
    track: '#22272e',
    accent: '#4589ff',
    scale: ['#4589ff', '#c2c8d0', '#8b939e', '#5f6874', '#3a424c'],
  },
};

const QUERY = `
query($login: String!) {
  user(login: $login) {
    followers { totalCount }
    pullRequests(states: [OPEN, MERGED, CLOSED]) { totalCount }
    contributionsCollection {
      totalCommitContributions
      restrictedContributionsCount
      totalRepositoriesWithContributedCommits
    }
    repositories(first: 100, ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC) {
      totalCount
      nodes {
        stargazerCount
        languages(first: 12, orderBy: { field: SIZE, direction: DESC }) {
          edges { size node { name } }
        }
      }
    }
  }
}`;

async function fetchStats() {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'profile-stats-card',
    },
    body: JSON.stringify({ query: QUERY, variables: { login: LOGIN } }),
  });

  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);

  const body = await res.json();
  if (body.errors) throw new Error(JSON.stringify(body.errors));

  const user = body.data.user;
  const repos = user.repositories.nodes;

  const bytesByLanguage = new Map();
  for (const repo of repos) {
    for (const { size, node } of repo.languages.edges) {
      bytesByLanguage.set(node.name, (bytesByLanguage.get(node.name) ?? 0) + size);
    }
  }

  const totalBytes = [...bytesByLanguage.values()].reduce((a, b) => a + b, 0);
  const languages = [...bytesByLanguage.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, size]) => ({ name, share: totalBytes ? size / totalBytes : 0 }));

  const contributions = user.contributionsCollection;

  return {
    repos: user.repositories.totalCount,
    contributedTo: contributions.totalRepositoriesWithContributedCommits,
    commits:
      contributions.totalCommitContributions + contributions.restrictedContributionsCount,
    pullRequests: user.pullRequests.totalCount,
    languages,
  };
}

const escape = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const FONT =
  '-apple-system,BlinkMacSystemFont,&quot;Segoe UI&quot;,Helvetica,Arial,sans-serif';

const W = 840;
const H = 221;
const PAD = 32;

function renderStat({ value, label, x, anchor, theme, highlight }) {
  return `
    <text x="${x}" y="59" text-anchor="${anchor}" fill="${highlight ? theme.accent : theme.fg}" font-size="38" font-weight="600" letter-spacing="-1">${escape(value)}</text>
    <text x="${x}" y="85" text-anchor="${anchor}" fill="${theme.muted}" font-size="12.5" letter-spacing="0.4">${escape(label)}</text>`;
}

function renderLanguageBar(languages, theme) {
  const barX = PAD;
  const barY = 149;
  const barW = W - PAD * 2;
  const gap = 3;
  const total = languages.reduce((sum, l) => sum + l.share, 0) || 1;

  let cursor = barX;
  const segments = languages
    .map((lang, i) => {
      const width = Math.max(
        6,
        ((barW - gap * (languages.length - 1)) * lang.share) / total,
      );
      const rect = `<rect x="${cursor.toFixed(1)}" y="${barY}" width="${width.toFixed(1)}" height="10" rx="5" fill="${theme.scale[i]}"/>`;
      cursor += width + gap;
      return rect;
    })
    .join('');

  let legendX = PAD;
  const legend = languages
    .map((lang, i) => {
      const label = `${lang.name} ${(lang.share * 100).toFixed(1)}%`;
      const item = `
      <rect x="${legendX}" y="${barY + 34}" width="9" height="9" rx="3" fill="${theme.scale[i]}"/>
      <text x="${legendX + 16}" y="${barY + 42}" fill="${theme.muted}" font-size="12.5">${escape(label)}</text>`;
      legendX += 26 + label.length * 6.9;
      return item;
    })
    .join('');

  return `<rect x="${barX}" y="${barY}" width="${barW}" height="10" rx="5" fill="${theme.track}"/>${segments}${legend}`;
}

function renderCard(stats, theme) {
  /* The last column is right-aligned to the padding so the row spans the full card
     instead of trailing off with dead space on the right. */
  const columns = [
    { x: PAD, anchor: 'start' },
    { x: 300, anchor: 'start' },
    { x: 560, anchor: 'start' },
    { x: W - PAD, anchor: 'end' },
  ];
  const items = [
    { value: stats.commits.toLocaleString('en-US'), label: 'Commits (past year)', highlight: true },
    { value: stats.repos.toLocaleString('en-US'), label: 'Public repositories' },
    { value: stats.contributedTo.toLocaleString('en-US'), label: 'Repos contributed to' },
    { value: stats.pullRequests.toLocaleString('en-US'), label: 'Pull requests' },
  ];

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="GitHub activity for ${escape(LOGIN)}" font-family="${FONT}">
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="14" fill="${theme.bg}" stroke="${theme.border}"/>
  ${items.map((item, i) => renderStat({ ...item, ...columns[i], theme })).join('')}
  <line x1="${PAD}" y1="115" x2="${W - PAD}" y2="115" stroke="${theme.border}"/>
  <text x="${PAD}" y="137" fill="${theme.muted}" font-size="11.5" font-weight="600" letter-spacing="1.6">TOP LANGUAGES</text>
  ${renderLanguageBar(stats.languages, theme)}
</svg>
`;
}

const stats = await fetchStats();
await mkdir(OUT_DIR, { recursive: true });

for (const [name, theme] of Object.entries(THEMES)) {
  const file = resolve(OUT_DIR, `stats-${name}.svg`);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, renderCard(stats, theme), 'utf8');
  console.log(`wrote ${file}`);
}
