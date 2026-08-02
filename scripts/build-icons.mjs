#!/usr/bin/env node
/**
 * Turns the brand artwork into every icon the app needs.
 *
 *   npm run build:icons
 *
 * Inputs, both optional - whichever is present gets used:
 *   assets/brand/icon-source.png    the app icon artwork
 *   assets/brand/logo-source.png    the splash logo (falls back to the icon)
 *
 * The icon source is auto-cropped to its artwork before anything else. Exported logos usually
 * arrive sitting on a background tile, sometimes with a stray flourish in a corner; both would
 * end up baked into a home-screen icon that the OS then rounds off again. --trim finds the
 * real bounding box, and --inset re-adds breathing room deliberately.
 *
 * Requires ImageMagick (`convert`).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BRAND = resolve(ROOT, 'assets/brand');
const ICONS = resolve(ROOT, 'public/icons');

/** Brand background. Icons must be opaque - iOS renders transparency as black. */
const BG = '#0B1220';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : fallback;
};
const noTrim = args.includes('--no-trim');
/** Percentage of the canvas left as margin around the artwork. */
const inset = Number(flag('inset', '8'));

function convert(cmd) {
  execFileSync('convert', cmd, { stdio: ['ignore', 'ignore', 'inherit'] });
}

function requireTool() {
  try {
    execFileSync('convert', ['-version'], { stdio: 'ignore' });
  } catch {
    process.stderr.write('ImageMagick is required: sudo apt install imagemagick\n');
    process.exit(1);
  }
}

/**
 * Crops to the artwork, squares it up on the brand background, and leaves an even margin.
 * Cropping to a square *before* insetting keeps the artwork centred rather than stretched.
 */
function normalise(source, out, size) {
  const inner = Math.round(size * (1 - inset / 100 * 2));
  const cmd = [source];
  if (!noTrim) cmd.push('-fuzz', '12%', '-trim', '+repage');
  cmd.push(
    '-background', 'none',
    '-resize', `${inner}x${inner}`,
    '-gravity', 'center',
    '-extent', `${size}x${size}`,
    '-background', BG,
    '-alpha', 'remove',
    '-alpha', 'off',
    out,
  );
  convert(cmd);
}

function main() {
  requireTool();
  mkdirSync(ICONS, { recursive: true });

  const iconSource = resolve(BRAND, 'icon-source.png');
  const logoSource = resolve(BRAND, 'logo-source.png');

  if (!existsSync(iconSource)) {
    process.stderr.write(
      `No artwork at assets/brand/icon-source.png\n` +
        `Save the app icon there (and optionally logo-source.png for the splash), then re-run.\n`,
    );
    process.exit(1);
  }

  // Square icons for the manifest, the home screen and the native builds.
  for (const size of [192, 512, 1024]) {
    normalise(iconSource, resolve(ICONS, `icon-${size}.png`), size);
  }
  normalise(iconSource, resolve(ICONS, 'apple-touch-icon.png'), 180);
  normalise(iconSource, resolve(ROOT, 'assets/icon.png'), 1024);
  normalise(iconSource, resolve(ROOT, 'assets/favicon.png'), 48);

  // Maskable icons get cropped to a circle by Android, so the artwork needs a wider margin
  // than the plain variants or the ram loses its horns.
  const maskableInset = Math.max(inset, 20);
  const inner = Math.round(512 * (1 - (maskableInset / 100) * 2));
  const cmd = [iconSource];
  if (!noTrim) cmd.push('-fuzz', '12%', '-trim', '+repage');
  cmd.push(
    '-background', 'none',
    '-resize', `${inner}x${inner}`,
    '-gravity', 'center',
    '-extent', '512x512',
    '-background', BG,
    '-alpha', 'remove',
    '-alpha', 'off',
    resolve(ICONS, 'icon-maskable-512.png'),
  );
  convert(cmd);

  // Android adaptive icons are composited by the OS, so the foreground keeps its transparency.
  const fgCmd = [iconSource];
  if (!noTrim) fgCmd.push('-fuzz', '12%', '-trim', '+repage');
  fgCmd.push(
    '-background', 'none',
    '-resize', '300x300',
    '-gravity', 'center',
    '-extent', '512x512',
    resolve(ROOT, 'assets/android-icon-foreground.png'),
  );
  convert(fgCmd);
  convert(['-size', '512x512', `xc:${BG}`, resolve(ROOT, 'assets/android-icon-background.png')]);

  // The splash keeps its transparency - it sits on the app's own background.
  const splashSource = existsSync(logoSource) ? logoSource : iconSource;
  const splashCmd = [splashSource];
  if (!noTrim) splashCmd.push('-fuzz', '12%', '-trim', '+repage');
  splashCmd.push('-background', 'none', '-resize', '1200x1200', resolve(ROOT, 'assets/logo.png'));
  convert(splashCmd);

  process.stdout.write(
    `Icons rebuilt from ${existsSync(logoSource) ? 'icon-source.png + logo-source.png' : 'icon-source.png'}.\n` +
      `  trim: ${noTrim ? 'off' : 'on'}   inset: ${inset}%\n` +
      `Check public/icons/ and assets/, then: npm run build:web\n`,
  );
}

main();
