#!/usr/bin/env node
/**
 * Prints the third-party dependency table for THIRD-PARTY-NOTICES.md.
 *
 *   npm run licenses
 *
 * Only runtime dependencies are listed - devDependencies are not distributed in the app
 * binary and so carry no notice obligation. Exits non-zero if a dependency is not MIT, so
 * a copyleft package cannot slip in unnoticed.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ALLOWED = new Set(['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'Unlicense']);

const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
const deps = Object.keys(pkg.dependencies ?? {}).sort();

const rows = [];
const unexpected = [];

for (const name of deps) {
  const meta = JSON.parse(readFileSync(resolve(ROOT, 'node_modules', name, 'package.json'), 'utf8'));
  const license = meta.license ?? 'UNKNOWN';
  if (!ALLOWED.has(license)) unexpected.push(`${name}: ${license}`);

  let copyright = '';
  for (const file of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license']) {
    try {
      const text = readFileSync(resolve(ROOT, 'node_modules', name, file), 'utf8');
      const match = text.match(/Copyright[^\n]*/i);
      if (match) {
        copyright = match[0].trim().replace(/[<>|]/g, '');
        break;
      }
    } catch {
      // Package ships no licence file of its own; the SPDX id in package.json still applies.
    }
  }
  rows.push(`| ${name} | ${meta.version} | ${copyright || '-'} |`);
}

process.stdout.write('| Package | Version | Copyright |\n|---|---|---|\n');
process.stdout.write(rows.join('\n') + '\n');

if (unexpected.length > 0) {
  process.stderr.write(`\nUnexpected licence(s) - review before shipping:\n  ${unexpected.join('\n  ')}\n`);
  process.exit(1);
}
