#!/usr/bin/env node
/**
 * Generates src/lib/qrMatrix.ts - the share QR code, as a grid of modules committed to the repo.
 *
 *   npm run build:qr
 *
 * WHY THE CODE IS GENERATED AND NOT DRAWN AT RUNTIME
 * The app shares exactly one link and that link is a constant. Encoding it on every render, or
 * pulling in a QR library to do it, buys nothing: the answer is the same 29x29 grid every time.
 * The published npm option costs three transitive dependencies (a QR library, prop-types, and a
 * TextEncoder polyfill) and several kilobytes of bundle, for a value that could have been a
 * string literal. So it is a string literal, and this script is what writes it.
 *
 * WHAT IT SUPPORTS
 * Byte mode, error-correction level M, versions 1 to 3, which is one error-correction block and
 * up to 44 bytes of payload. That covers any share URL and leaves out the interleaving that
 * multi-block versions need. Anything longer throws rather than encoding something wrong.
 *
 * Level M recovers from about 15% damage. L would give a sparser, easier-to-scan grid, but a
 * code that gets photographed off a phone screen at an angle wants the margin.
 *
 * The output is checked against the `qrencode` binary in scripts/__tests__ terms by hand:
 *
 *   qrencode -l M -m 0 -t ASCII 'https://grambygram.netlify.app'
 *
 * and by src/lib/__tests__/qrMatrix.test.ts, which re-derives the structural invariants
 * (finder patterns, timing patterns, size) from the committed grid.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'src/lib/qrMatrix.ts');

/** The link, read from the app so this file cannot drift from what the rest of the app uses. */
function appUrl() {
  const source = readFileSync(resolve(ROOT, 'src/lib/appLink.ts'), 'utf8');
  const match = source.match(/export const APP_URL = '([^']+)'/);
  if (match === null) throw new Error('src/lib/appLink.ts no longer declares APP_URL');
  return match[1];
}

// ---------------------------------------------------------------------------
// GF(256), the field Reed-Solomon works in. Primitive polynomial 0x11d, per the QR spec.
// ---------------------------------------------------------------------------

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}

const mul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

/** The degree-n generator polynomial, highest coefficient first. */
function generator(n) {
  let poly = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= mul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

/** The n error-correction codewords for a block of data codewords. */
function errorCorrection(data, n) {
  const gen = generator(n);
  const buf = [...data, ...new Array(n).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const coefficient = buf[i];
    if (coefficient === 0) continue;
    for (let j = 1; j < gen.length; j++) buf[i + j] ^= mul(gen[j], coefficient);
  }
  return buf.slice(data.length);
}

// ---------------------------------------------------------------------------
// Encoding
// ---------------------------------------------------------------------------

/** Data codewords, error-correction codewords, and alignment centres, per version, at level M. */
const VERSIONS = {
  1: { data: 16, ec: 10, align: [] },
  2: { data: 28, ec: 16, align: [6, 18] },
  3: { data: 44, ec: 26, align: [6, 22] },
};

/** The smallest version that holds this many bytes in byte mode. */
function versionFor(byteLength) {
  for (const version of [1, 2, 3]) {
    // Four bits of mode, eight of length, then the payload.
    if (12 + byteLength * 8 <= VERSIONS[version].data * 8) return version;
  }
  throw new Error(`${byteLength} bytes is past the 44 this script encodes; add multi-block support`);
}

/** Mode indicator, length, payload, terminator and padding, as one array of codewords. */
function codewords(bytes, version) {
  const capacity = VERSIONS[version].data;
  const bits = [];
  const push = (value, width) => {
    for (let i = width - 1; i >= 0; i--) bits.push((value >> i) & 1);
  };

  push(0b0100, 4); // byte mode
  push(bytes.length, 8); // versions 1 to 9 use an eight-bit count in byte mode
  for (const byte of bytes) push(byte, 8);

  // Terminator: up to four zero bits, fewer if the capacity runs out first.
  for (let i = 0; i < 4 && bits.length < capacity * 8; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const out = [];
  for (let i = 0; i < bits.length; i += 8) {
    out.push(bits.slice(i, i + 8).reduce((n, bit) => (n << 1) | bit, 0));
  }
  // The two pad codewords the spec names, alternating, until the block is full.
  const PAD = [0xec, 0x11];
  while (out.length < capacity) out.push(PAD[(out.length - bits.length / 8) % 2]);
  return out;
}

// ---------------------------------------------------------------------------
// The grid
// ---------------------------------------------------------------------------

function blankGrid(size) {
  return Array.from({ length: size }, () => new Array(size).fill(0));
}

/** Draws the patterns a scanner uses to find and square up the code. Marks them reserved. */
function drawFunctionPatterns(grid, fixed, version) {
  const size = grid.length;

  const finder = (row, col) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = row + dr;
        const c = col + dc;
        if (r < 0 || c < 0 || r >= size || c >= size) continue;
        const inside = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
        // Rings out from the centre: a 3x3 dark core (0 and 1), a light gap (2), a dark border (3).
        const ring = Math.max(Math.abs(dr - 3), Math.abs(dc - 3));
        grid[r][c] = inside && ring !== 2 ? 1 : 0;
        fixed[r][c] = true;
      }
    }
  };
  finder(0, 0);
  finder(0, size - 7);
  finder(size - 7, 0);

  // Timing: one alternating line each way, joining the finders.
  for (let i = 8; i < size - 8; i++) {
    const dark = i % 2 === 0 ? 1 : 0;
    grid[6][i] = dark;
    fixed[6][i] = true;
    grid[i][6] = dark;
    fixed[i][6] = true;
  }

  // Alignment: 5x5 targets wherever two centres meet, except under a finder.
  const centres = VERSIONS[version].align;
  for (const row of centres) {
    for (const col of centres) {
      const nearFinder =
        (row <= 8 && col <= 8) || (row <= 8 && col >= size - 9) || (row >= size - 9 && col <= 8);
      if (nearFinder) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          grid[row + dr][col + dc] = Math.max(Math.abs(dr), Math.abs(dc)) === 1 ? 0 : 1;
          fixed[row + dr][col + dc] = true;
        }
      }
    }
  }

  // Format information lives in two places; reserve both now and fill them once a mask is picked.
  for (let i = 0; i <= 8; i++) {
    fixed[8][i] = true;
    fixed[i][8] = true;
  }
  for (let i = 0; i < 8; i++) {
    fixed[8][size - 1 - i] = true;
    fixed[size - 1 - i][8] = true;
  }
  // The one module that is always dark, whatever the data says.
  grid[size - 8][8] = 1;
}

/** Lays the codeword bits into the grid, bottom-right upwards in two-column strips. */
function placeData(grid, fixed, bytes) {
  const size = grid.length;
  const bits = [];
  for (const byte of bytes) for (let i = 7; i >= 0; i--) bits.push((byte >> i) & 1);

  let at = 0;
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    // Column six is a timing line, so the strips step over it rather than through it.
    if (right === 6) right = 5;
    for (let step = 0; step < size; step++) {
      const row = upward ? size - 1 - step : step;
      for (const col of [right, right - 1]) {
        if (fixed[row][col]) continue;
        grid[row][col] = at < bits.length ? bits[at] : 0;
        at++;
      }
    }
    upward = !upward;
  }
}

const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function applyMask(grid, fixed, mask) {
  const out = grid.map((row) => [...row]);
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid.length; c++) {
      if (!fixed[r][c] && MASKS[mask](r, c)) out[r][c] ^= 1;
    }
  }
  return out;
}

/** Format information: level M and the mask, protected by a BCH(15,5) code. */
function drawFormat(grid, mask) {
  const size = grid.length;
  const data = (0b00 << 3) | mask; // 00 is level M
  let remainder = data;
  for (let i = 0; i < 10; i++) remainder = (remainder << 1) ^ (((remainder >> 9) & 1) * 0x537);
  const bits = ((data << 10) | remainder) ^ 0x5412;
  const bit = (i) => (bits >> i) & 1;

  for (let i = 0; i <= 5; i++) grid[i][8] = bit(i);
  grid[7][8] = bit(6);
  grid[8][8] = bit(7);
  grid[8][7] = bit(8);
  for (let i = 9; i < 15; i++) grid[8][14 - i] = bit(i);

  for (let i = 0; i < 8; i++) grid[8][size - 1 - i] = bit(i);
  for (let i = 8; i < 15; i++) grid[size - 15 + i][8] = bit(i);
  grid[size - 8][8] = 1;
}

/**
 * The spec's four penalty rules. The mask with the lowest total wins.
 *
 * They exist to avoid grids a scanner finds hard: long same-colour runs, solid blocks, anything
 * that looks like a finder pattern, and a wildly uneven light/dark balance.
 */
function penalty(grid) {
  const size = grid.length;
  let score = 0;

  const lines = [];
  for (let i = 0; i < size; i++) {
    lines.push(grid[i]);
    lines.push(grid.map((row) => row[i]));
  }

  for (const line of lines) {
    let run = 1;
    for (let i = 1; i < size; i++) {
      if (line[i] === line[i - 1]) {
        run++;
        continue;
      }
      if (run >= 5) score += 3 + (run - 5);
      run = 1;
    }
    if (run >= 5) score += 3 + (run - 5);

    // Rule three looks for the finder pattern's own 1:1:3:1:1 ratio with four light modules
    // beside it. Everything outside the symbol counts as light, so the line is padded before
    // the search; without that, a pattern sitting against the edge is missed and a different
    // mask wins.
    const text = `0000${line.join('')}0000`;
    for (const needle of ['10111010000', '00001011101']) {
      let from = text.indexOf(needle);
      while (from !== -1) {
        score += 40;
        from = text.indexOf(needle, from + 1);
      }
    }
  }

  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = grid[r][c];
      if (v === grid[r][c + 1] && v === grid[r + 1][c] && v === grid[r + 1][c + 1]) score += 3;
    }
  }

  const dark = grid.flat().reduce((n, v) => n + v, 0);
  score += Math.floor(Math.abs((dark * 100) / (size * size) - 50) / 5) * 10;
  return score;
}

function encode(url) {
  const bytes = [...new TextEncoder().encode(url)];
  const version = versionFor(bytes.length);
  const { ec } = VERSIONS[version];
  const data = codewords(bytes, version);
  const all = [...data, ...errorCorrection(data, ec)];

  const size = version * 4 + 17;
  const base = blankGrid(size);
  const fixed = blankGrid(size).map((row) => row.map(() => false));
  drawFunctionPatterns(base, fixed, version);
  placeData(base, fixed, all);

  let best = null;
  for (let mask = 0; mask < 8; mask++) {
    const candidate = applyMask(base, fixed, mask);
    drawFormat(candidate, mask);
    const score = penalty(candidate);
    if (best === null || score < best.score) best = { grid: candidate, score, mask };
  }
  return { ...best, version };
}

const url = appUrl();
const { grid, version, mask } = encode(url);
const rows = grid.map((row) => row.join(''));

writeFileSync(
  OUT,
  `/**
 * GENERATED by scripts/build-qr.mjs. Do not edit by hand.
 *
 * The share link as a QR code: version ${version} (${rows.length}x${rows.length}), byte mode,
 * error-correction level M, mask ${mask}. Run \`npm run build:qr\` after changing APP_URL.
 *
 * '1' is a dark module. There is no quiet zone here; the component draws it, because a quiet
 * zone is a property of how the code is presented and not of the code itself.
 */

/** What this grid decodes to. Compared against APP_URL by a test, so the two cannot drift. */
export const QR_URL = '${url}';

export const QR_MODULES: readonly string[] = [
${rows.map((row) => `  '${row}',`).join('\n')}
];
`,
  'utf8',
);

process.stdout.write(`${OUT}\n  ${url}\n  version ${version}, ${rows.length}x${rows.length}, mask ${mask}\n`);
