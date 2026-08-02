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

/**
 * The icon tile within assets/brand/icon-source.png (1435x1435).
 *
 * The artwork is a rounded square with a white outline sitting on a flat grey card. Measured by
 * scanning for where the grey stops: the outline runs x 9-1421 and y 9-1426, so this keeps the
 * outline and drops the card.
 */
const ICON_CROP = '1412x1416+10+10';

/**
 * Fill for the icon's rounded corners once the grey card is cropped away.
 *
 * Cropping to a rounded square leaves grey in the four corners. The OS masks most of it off,
 * but not all, and grey slivers on a teal icon read as a rendering fault. Flood-filling from
 * each corner replaces them; this is the tile's own teal, sampled midway down its gradient so
 * neither the lighter top nor the darker bottom shows a seam.
 */
const ICON_CORNER = '#164A5C';

/*
 * The two splash images are full-bleed gym scenes with the logo composited on. Both carry a
 * decorative four-point sparkle near the bottom-right that reads as a blemish once the image
 * is behind an app. It sits close enough to the edge to crop out, which is cleaner than
 * retouching it - the texture there has a hard equipment edge running through it, so cloning
 * or blurring leaves a worse mark than the sparkle did.
 */
const LOGO_CROP_WIDE = '2530x1536+0+0';
const LOGO_CROP_PORTRAIT = '1536x2410+0+0';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : fallback;
};
const noTrim = args.includes('--no-trim');
/**
 * Explicit crop, WxH+X+Y, applied before anything else.
 *
 * The supplied icon artwork sits on a brushed-metal tile whose gradient defeats --trim: there
 * is no uniform border to detect, so an automatic crop keeps the whole tile. The shield's box
 * was measured by eye once and recorded here so the result is reproducible rather than a
 * one-off command someone has to remember.
 */
const crop = flag('crop', ICON_CROP);
/** Percentage of the canvas left as margin around the artwork. */
const inset = Number(flag('inset', '8'));

function convert(cmd) {
  execFileSync('convert', cmd, { stdio: ['ignore', 'ignore', 'inherit'] });
}

/**
 * Crop arguments for the icon, plus the corner clean-up.
 *
 * Flood-fills transparency inward from each corner of the cropped tile, so the grey left
 * outside the rounded outline goes and whatever the caller flattens onto shows through
 * instead. The fuzz has to be generous because the card carries a soft drop shadow.
 */
function iconCropArgs() {
  if (!crop) return [];
  const [w, h] = crop.split('+')[0].split('x').map(Number);
  const [r, b] = [w - 1, h - 1];
  return [
    '-crop', crop, '+repage',
    '-alpha', 'set', '-fill', 'none', '-fuzz', '30%',
    '-draw', 'matte 0,0 floodfill',
    '-draw', `matte ${r},0 floodfill`,
    '-draw', `matte 0,${b} floodfill`,
    '-draw', `matte ${r},${b} floodfill`,
  ];
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
function normalise(source, out, size, { useCrop = true } = {}) {
  const inner = Math.round(size * (1 - (inset / 100) * 2));
  const cmd = [source];
  if (useCrop && crop) cmd.push(...iconCropArgs());
  else if (!noTrim) cmd.push('-fuzz', '12%', '-trim', '+repage');
  cmd.push(
    '-background', ICON_CORNER,
    '-alpha', 'remove',
    '-background', 'none',
    '-resize', `${inner}x${inner}`,
    '-gravity', 'center',
    '-extent', `${size}x${size}`,
    '-background', ICON_CORNER,
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
  cmd.push(...iconCropArgs());
  cmd.push(
    '-background', ICON_CORNER,
    '-alpha', 'remove',
    '-background', 'none',
    '-resize', `${inner}x${inner}`,
    '-gravity', 'center',
    '-extent', '512x512',
    '-background', ICON_CORNER,
    '-alpha', 'remove',
    '-alpha', 'off',
    resolve(ICONS, 'icon-maskable-512.png'),
  );
  convert(cmd);

  // Android adaptive icons are composited by the OS, so the foreground keeps its transparency.
  const fgCmd = [iconSource];
  fgCmd.push(...iconCropArgs());
  fgCmd.push(
    '-background', 'none',
    '-resize', '300x300',
    '-gravity', 'center',
    '-extent', '512x512',
    resolve(ROOT, 'assets/android-icon-foreground.png'),
  );
  convert(fgCmd);
  convert([
    '-size', '512x512', `xc:${ICON_CORNER}`,
    resolve(ROOT, 'assets/android-icon-background.png'),
  ]);

  // The splash keeps its transparency - it sits on the app's own background.
  // Two splash images: a wide one for a landscape window, a tall one that fills a phone.
  // Displayed full-bleed, so they keep their scene and are only cropped, never padded.
  // JPEG, not PNG: these are photographs, and PNG was costing 2MB each - more than half the
  // entire app download - for an image shown for under two seconds.
  for (const [src, out, box] of [
    [logoSource, 'assets/logo.jpg', LOGO_CROP_WIDE],
    [resolve(BRAND, 'logo-source-cellphone.png'), 'assets/logo-portrait.jpg', LOGO_CROP_PORTRAIT],
  ]) {
    if (!existsSync(src)) continue;
    convert([
      src, '-crop', box, '+repage',
      '-resize', '1200x1200>',
      '-strip', '-interlace', 'Plane', '-sampling-factor', '4:2:0', '-quality', '80',
      resolve(ROOT, out),
    ]);
  }

  process.stdout.write(
    `Icons rebuilt.\n` +
      `  crop: ${crop || '(auto-trim)'}   inset: ${inset}%\n` +
      `Check public/icons/ and assets/, then: npm run build:web\n`,
  );
}

main();
