#!/usr/bin/env node
/**
 * Builds the installable web app.
 *
 *   npm run build:web
 *
 * Runs `expo export` and then stamps the service worker's cache name with a fresh build id, so
 * a deploy actually replaces the previous cache instead of serving a stale bundle forever.
 * Output lands in dist/ and is a plain static site - upload it anywhere that serves HTTPS.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'dist');

const version = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')).version;
const buildId = `${version}-${Date.now().toString(36)}`;

if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });

process.stdout.write(`Building GRam ${version} for the web...\n`);
execFileSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', 'dist'], {
  cwd: ROOT,
  stdio: 'inherit',
});

const swPath = resolve(OUT, 'sw.js');
if (!existsSync(swPath)) {
  process.stderr.write('sw.js missing from the export - is public/ still being copied?\n');
  process.exit(1);
}

/** Every file the app needs to boot, as absolute URL paths. */
function collectAssets(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectAssets(full));
    } else {
      out.push('/' + relative(OUT, full).split('\\').join('/'));
    }
  }
  return out;
}

// The JS bundle and the fonts are what make the app boot; without them an offline launch is a
// blank screen. Metadata and the icons already in SHELL are excluded to keep the list honest.
const precache = collectAssets(OUT).filter(
  (p) =>
    (p.startsWith('/_expo/') || p.startsWith('/assets/')) &&
    !p.endsWith('.map') &&
    p !== '/metadata.json',
);

const sw = readFileSync(swPath, 'utf8');
for (const placeholder of ['__BUILD_ID__', '__PRECACHE__']) {
  if (!sw.includes(placeholder)) {
    process.stderr.write(`sw.js has no ${placeholder} placeholder to stamp.\n`);
    process.exit(1);
  }
}
writeFileSync(
  swPath,
  sw.replace('__BUILD_ID__', buildId).replace('__PRECACHE__', JSON.stringify(precache)),
);

const html = readFileSync(resolve(OUT, 'index.html'), 'utf8');
// 'gram-feedback' is the hidden form Netlify parses out of the DEPLOYED html. If an export ever
// stops carrying it, every feedback submission 404s - invisibly from the user's side, and
// discoverable only by someone noticing that nobody has written in for a month.
for (const required of [
  'manifest.json',
  'apple-mobile-web-app-capable',
  'serviceWorker',
  'gram-feedback',
]) {
  if (!html.includes(required)) {
    process.stderr.write(`index.html is missing "${required}" - the PWA template was not used.\n`);
    process.exit(1);
  }
}

// A build whose bundle is not precached would look fine and fail the first time it is opened
// without a signal, which is exactly when it matters.
if (!precache.some((p) => p.startsWith('/_expo/static/js/web/') && p.endsWith('.js'))) {
  process.stderr.write('No JS bundle in the precache list - offline launch would be blank.\n');
  process.exit(1);
}

// GitHub Pages ignores _redirects but serves 404.html for unknown paths. A verbatim copy of the
// shell there makes deep links work on hosts with no rewrite support at all.
writeFileSync(resolve(OUT, '404.html'), html);

if (!existsSync(resolve(OUT, '_redirects'))) {
  process.stderr.write('_redirects missing - deep links would 404 on Netlify/Cloudflare.\n');
  process.exit(1);
}

process.stdout.write(
  `\nBuilt ${buildId} into dist/\n` +
    `Precached ${precache.length} files for offline use.\n` +
    `Upload the contents of dist/ to any HTTPS host.\n`,
);
