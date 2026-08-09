import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The notice file has to list every dependency the app ships.
 *
 * MIT requires its copyright notice to travel with the software, so a dependency that is
 * bundled but not listed is a licence breach, not an untidy document. `npm run licenses`
 * generates the table and refuses a non-permissive package - but nothing made anyone run it,
 * and four dependencies were added over four releases without the file being regenerated.
 *
 * This is the thing that makes it impossible to forget: adding a dependency fails the suite
 * until it is written down.
 */

const ROOT = resolve(__dirname, '../..');
const read = (file: string) => readFileSync(resolve(ROOT, file), 'utf8');

const pkg = JSON.parse(read('package.json')) as {
  license: string;
  dependencies: Record<string, string>;
};
const notices = read('THIRD-PARTY-NOTICES.md');

/** Package names from the first column of the markdown table. */
const listed = new Set(
  notices
    .split('\n')
    .filter((line) => line.startsWith('| ') && !line.startsWith('| Package'))
    .map((line) => line.split('|')[1]?.trim())
    .filter(Boolean),
);

describe('third-party notices', () => {
  const deps = Object.keys(pkg.dependencies);

  it.each(deps)('lists %s', (name) => {
    expect([name, listed.has(name)]).toEqual([name, true]);
  });

  it('does not list packages that were removed', () => {
    // A stale row claims a notice obligation the app no longer has, and hides the real list.
    const extra = [...listed].filter((name) => !deps.includes(name));
    expect(extra).toEqual([]);
  });

  it('records the version actually installed', () => {
    // The notice names a specific release. A version that has moved on is a notice for
    // software nobody is shipping.
    for (const name of deps) {
      const installed = (
        JSON.parse(read(`node_modules/${name}/package.json`)) as { version: string }
      ).version;
      expect([name, notices.includes(`| ${name} | ${installed} |`)]).toEqual([name, true]);
    }
  });
});

describe('the project licence', () => {
  it('is Apache 2.0, declared and included in full', () => {
    expect(pkg.license).toBe('Apache-2.0');

    const licence = read('LICENSE');
    expect(licence).toContain('Apache License');
    expect(licence).toContain('Version 2.0, January 2004');
    // The appendix is boilerplate until the copyright line is filled in.
    expect(licence).not.toContain('Copyright [yyyy] [name of copyright owner]');
    expect(licence).toContain('Copyright 2026 The GRam Authors');
  });

  it('ships a NOTICE, which Apache 2.0 section 4(d) requires be carried', () => {
    const notice = read('NOTICE');
    expect(notice).toContain('Apache License, Version 2.0');
    expect(notice).toContain('Copyright 2026 The GRam Authors');
  });

  it('says plainly that the licence does not cover the upstream photographs', () => {
    // The one thing the project cannot license, because it does not hold the rights. Losing
    // this paragraph would turn a careful disclosure into an implied grant.
    expect(read('NOTICE')).toContain('SCOPE OF THIS LICENCE');
    expect(notices).toMatch(/photograph/i);
  });
});

describe('what the README advertises', () => {
  /*
   * The front page states the size of the catalog, and the catalog grows whenever
   * scripts/build-catalog.mjs is rerun. It said 879 for two releases after it became 896 -
   * the third thing this session found quietly out of step with the code it describes.
   *
   * Only the live claim is checked. docs/STUDY.md deliberately keeps 879 where it records a
   * measurement actually performed over the catalog as it stood then; restating that with
   * today's number would falsify the record rather than update it.
   */
  it('quotes the number of exercises the app actually ships', () => {
    // Required lazily: the catalog is a large JSON import and nothing else here needs it.
    const { EXERCISES } = require('@/catalog') as { EXERCISES: unknown[] };
    expect(read('README.md')).toContain(`**${EXERCISES.length} exercises**`);
  });
});
