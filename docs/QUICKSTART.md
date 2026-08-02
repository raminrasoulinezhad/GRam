# Getting GRam onto your phone

No jargon. Start at the top.

**Short answer if you only read one line:** iPhone → [Option C](#option-c--iphone-free-permanent----this-is-the-one),
free and permanent. Android → [Option B](#option-b--a-real-installed-app-on-android-30-minutes-free-then-no-computer-needed).

---

## First, the two words that matter

**An "app file" (a build).** The thing you install — the same idea as a `.exe` on Windows.
Android calls it an **APK**. iPhone calls it an **IPA**. Making one is called *building*.

**Expo Go.** A free app from the store that can *run* GRam without you building anything. Think
of it like a PDF reader: you don't build a PDF reader for every document — you open the document
inside it. Expo Go opens GRam.

That's it. Everything below is one of those two.

---

## Option A — Expo Go (5 minutes, free, works on both phones)

Best way to see it working today.

**On your phone:** install **Expo Go** from the App Store or Play Store.

**On your computer**, open a terminal and run:

```bash
cd /home/ramin/workspaces/fitram && npx expo start
```

A QR code appears in the terminal.

- **iPhone:** open the Camera app, point it at the QR code, tap the banner.
- **Android:** open Expo Go, tap "Scan QR code".

GRam opens. Make a plan, log a workout — it all works.

**Two things to know:**
- Your phone and computer must be on the same Wi-Fi.
- The terminal must stay running. Close it and the app stops. So this is great for trying it,
  but not for taking to the gym.

---

## Option B — a real installed app on Android (30 minutes, free, then no computer needed)

This gives you GRam as a proper app: its own icon, works offline, no computer involved.

**Why you couldn't just do this already:** building an APK normally needs a large Android
toolchain installed (Java, the Android SDK). This computer doesn't have it. **But you don't need
it** — Expo builds the file on their servers for free and hands you a download link.

**Step 1.** Make a free account at [expo.dev](https://expo.dev).

**Step 2.** Log in from the terminal:

```bash
npx eas login
```

**Step 3.** Ask Expo to build it:

```bash
cd /home/ramin/workspaces/fitram && npx eas build --profile device --platform android
```

It uploads the code, builds in the cloud (~10–20 min), and prints a link and a QR code.

**Step 4.** On your Samsung, open that link and download the APK. Android will warn you it's from
an unknown source — allow it once. It installs.

Done. It's now a normal app on your phone.

---

## Option C — iPhone, free, permanent ⭐ **this is the one**

Apple won't let you install a normal app file on your own iPhone without paying $99/year. So we
go around it: **GRam installs to your iPhone home screen as a web app.**

Before you dismiss that — this is not "just a bookmark". Once installed it:

- has its own icon on your home screen
- opens fullscreen, with no Safari address bar
- **works with no internet at all** (verified — see below)
- keeps your workouts permanently
- updates itself with no action from you

It's free, needs no Apple account, and never expires.

### Step 1 — build it

```bash
cd /home/ramin/workspaces/fitram && npm run build:web
```

That creates a `dist/` folder: 3.9 MB of plain files.

### Step 2 — put `dist/` on the internet

It needs an HTTPS address, because browsers switch offline support off on plain HTTP. Any free
static host works. **Netlify Drop is the quickest:**

1. Go to [app.netlify.com/drop](https://app.netlify.com/drop)
2. Drag the whole `dist` folder onto the page
3. Wait ~20 seconds

You get a URL like `https://sweet-lebkuchen-740b6f.netlify.app`. The silly name is
auto-generated; rename it under **Site configuration → Change site name** if you like.

That's it — HTTPS is automatic and `_redirects` is picked up without any configuration.

#### Check it deployed properly

```bash
U=https://your-site.netlify.app
for p in / /manifest.json /sw.js /body; do
  printf "%-18s %s\n" "$p" "$(curl -s -o /dev/null -w '%{http_code}' "$U$p")"
done
```

All four must be `200`. **`/body` is the one that matters** — if it returns 404, the host is not
applying `_redirects`, and refreshing inside the app would break.

### Step 3 — install it on the iPhone

1. Open that URL in **Safari** (must be Safari, not Chrome)
2. Tap the **Share** button (the square with the arrow)
3. Scroll down, tap **Add to Home Screen**
4. Tap **Add**

Done. GRam is now on your home screen.

### Does it really work offline?

Yes, and I tested it rather than assuming: I loaded the app, **shut the web server down
completely**, reloaded, and the app opened normally with all 873 exercises available. A service
worker stores the whole app on the phone the first time you open it.

### Will my workouts survive?

Yes. Safari normally clears website data after 7 days of not visiting — **but apps added to the
home screen are exempt from that rule.** This is the specific reason step 3 matters: viewing the
site in a Safari tab is not the same thing as installing it.

Your data still lives only on your phone. Nothing is uploaded.

### What you give up

Only the things needing native phone features: Apple Health import, and background
notifications. GRam doesn't use either today.

### If you ever change your mind about paying

$99/year to Apple gets a real native app installed directly, still never touching the App Store:

```bash
npx eas device:create                          # register your iPhone, once
npx eas build --profile device --platform ios
```

That's a *developer account*, not a store listing — it wouldn't conflict with the never-publish
rule. But for this app, the home-screen version does essentially everything, for free.

---

## How you'll get new versions later

**On iPhone (home-screen app):** nothing to do, ever. I rebuild and re-upload `dist/`; next time
you open GRam it fetches the new version and swaps itself over. No reinstalling, no removing
and re-adding the icon.

**On Android (installed APK):** most updates also need nothing from you. I run:

```bash
npx eas update --branch production --message "what changed"
```

Your phone downloads it quietly in the background and applies it next time you open the app.
Only a deep change — like adding Apple Health support — needs a new APK installed over the old
one.

**Will any of this delete my workouts?** No, on either phone. Updating is never a fresh install:
Android keeps the app's data, and the home-screen web app keeps its storage. GRam also updates
the *shape* of that stored data automatically on first launch, so an old save still works with
new code. That upgrade path is tested against real data from an older version, and I ran it
through the actual app to confirm.

**The only things that erase your data:**
- Uninstalling the app
- Android Settings → Apps → GRam → Storage → Clear storage
- Tapping "Erase all data" in the app's Profile tab

---

## One rule for me to never break

The app is signed with a secret key that Expo generates on your first build. Android only lets a
new APK update an existing app if it's signed with the **same** key. If that key is lost, no
future version can update your installed app — it would have to be uninstalled first, which
erases your workouts.

Expo stores it for you. To keep your own copy:

```bash
npx eas credentials
```

---

## Where things are written down

- [DISTRIBUTION.md](DISTRIBUTION.md) — the never-publish policy and the detail behind the above
- [RELEASING.md](RELEASING.md) — how versions and data migrations work
- [ROADMAP.md](ROADMAP.md) — what's planned next
