# Brand artwork

Drop the source images here, then run:

```bash
npm run build:icons
```

| File | Used for |
|---|---|
| `icon-source.png` | app icon — home screen, favicon, Android adaptive icon |
| `logo-source.png` | splash screen (optional; falls back to the icon) |
| `hero.png` | banner at the top of README.md (used as-is, not processed) |

Everything downstream is generated, so never hand-edit `public/icons/`, `assets/icon.png`,
`assets/favicon.png`, `assets/logo.png` or the `assets/android-icon-*` files.

## What the script does to them

It auto-crops each image to its actual artwork before resizing. Exported logos usually arrive
sitting on a background tile, sometimes with a stray flourish in a corner — both would be baked
into the home-screen icon, which the OS then rounds off again, giving you a tile inside a tile.
Trimming to the real bounding box removes the tile *and* anything floating in the corners.

Useful flags when the crop needs a nudge:

```bash
npm run build:icons -- --inset=12     # more margin around the artwork (default 8%)
npm run build:icons -- --no-trim      # artwork already tightly cropped
```

Icons are flattened onto `#0B1220`, because iOS renders transparency in an app icon as black.
The Android adaptive foreground and the splash logo deliberately keep their transparency.
