# Distribution policy and how to actually use the app

## Policy: GRam is never published to an app store

**This app must not be uploaded to the Apple App Store, Google Play, or any other public app
store or marketplace. Not now, not later.**

It is built for personal use and distributed directly to the owner's own devices.

Why this is written down rather than assumed:

1. **The exercise photographs have unresolved provenance.** The dataset's maintainer dedicated
   the JSON to the public domain, but the photographs were evidently collected from a
   third-party fitness site, and two direct enquiries about their licence went unanswered. See
   [THIRD-PARTY-NOTICES.md](../THIRD-PARTY-NOTICES.md). Private use of images you did not
   licence is a very different risk from redistributing them to strangers at scale.
2. **No store means no store obligations.** No review cycles, no privacy nutrition labels, no
   account deletion endpoints, no age ratings, no annual renewal pressure to keep an app alive.
3. **It stays honest about what it is.** A personal tool, with no account, no server, and
   nothing transmitted anywhere.

This decision is structural, not just documentary: `eas.json` has no `submit` configuration and
no store-targeted build profile. Publishing would require deliberately adding them back.

If that decision is ever revisited, the photographs must be replaced first.

---

## Running it on your phone

Three ways, cheapest first.

### 1. Expo Go — free, best for trying it out

Install Expo Go ([iPhone](https://apps.apple.com/app/expo-go/id982107779),
[Android](https://play.google.com/store/apps/details?id=host.exp.exponent)), then on your
computer:

```bash
cd /home/ramin/workspaces/fitram && npx expo start
```

Scan the QR code with the Camera app (iPhone) or from inside Expo Go (Android). Phone and
computer must be on the same Wi-Fi.

**Works on both iPhone and Android, costs nothing, no Apple account.** The catch: your computer
has to be running the dev server. This is for development and demos, not for taking to the gym
on a Tuesday.

> One caveat: Expo Go only runs libraries bundled in the Expo SDK. GRam stays inside that
> boundary today, which is exactly why health-app import is deferred — see
> [ROADMAP.md](ROADMAP.md).

### 2. Android — a real installed app, free, no computer needed afterwards

This is the recommended way to actually use it.

```bash
npx eas login
npx eas build --profile preview --platform android
```

EAS builds it in the cloud and gives you a URL and QR code. Open it on the phone, download the
APK, accept the "install from unknown source" warning once, and it installs like any other app —
own icon, works offline, no dev server, no computer.

Requires a free Expo account. Nothing from Apple or Google is involved.

### 3. iPhone — installed to the home screen, free and permanent ⭐

Apple allows no free, permanent way to install a *native* app on your own iPhone. So GRam
installs as a **home-screen web app** instead.

```bash
npm run build:web     # produces dist/, 3.9 MB of static files
```

Upload `dist/` to any HTTPS host (see [Deploying](#deploying-the-web-app) below), open it in
**Safari**, then Share → **Add to Home Screen**.

This is not a bookmark. It gets its own icon, opens fullscreen with no browser chrome, works
with no network, and keeps its data indefinitely.

Two details that make it real rather than a compromise:

- **Offline is verified, not assumed.** A service worker precaches the app shell and JS bundle at
  install time — not lazily, because the worker registers after the first bundle fetch and a
  lazy cache would leave the very first offline launch blank. Tested by loading the app, killing
  the web server outright, and reloading: it opens with all 879 exercises.
- **Storage survives.** Safari evicts script-writable storage after seven days of not visiting a
  site — but **home-screen web apps are exempt**. This is precisely why "Add to Home Screen"
  matters and why a Safari tab is not equivalent.

What it gives up: native-only capabilities. Apple Health import and background notifications.
GRam uses neither today, and Health import was already deferred for the same reason
([ROADMAP.md](ROADMAP.md)).

#### The paid alternative, for the record

$99/year for an Apple Developer account allows an ad-hoc native build installed directly to
registered devices, still without touching the App Store:

```bash
npx eas device:create
npx eas build --profile device --platform ios
```

That is a *developer account*, not a store submission, so it would not conflict with the policy
above. It buys native capability, not distribution. Not needed for what this app does.

#### Why not AltStore / SideStore

Free sideloading tools re-sign apps with a free Apple ID. That signature **expires every 7 days**
and must be refreshed, they cap you at three sideloaded apps, and initial setup needs a computer.
A workout tracker that stops opening mid-week is worse than a web app that never does.

---

## Deploying the web app

`npm run build:web` produces `dist/` — plain static files, no server-side anything. Two
requirements of the host, and only two:

1. **HTTPS.** Browsers refuse to register a service worker over plain HTTP, so without it the
   app cannot work offline and cannot be meaningfully installed.
2. **SPA rewrites** — unknown paths must serve `index.html`. `public/_redirects` handles this on
   Netlify and Cloudflare Pages; `404.html` covers GitHub Pages. The service worker also falls
   back to the cached shell on any non-OK navigation, so an already-installed app survives a
   host that does neither.

**The app must be served from the root of a hostname**, not a subfolder. Every path in the build
is absolute (`/manifest.json`, `/icons/…`, `/_expo/…`) and the manifest declares
`start_url: "/"`. So `gram.example.com` works; `example.com/gram` does not, and its
`_redirects` rule would swallow the parent site's routes.

### Netlify (current deployment)

```bash
npm run build:web
```

Drag the `dist` folder onto [app.netlify.com/drop](https://app.netlify.com/drop). HTTPS and
`_redirects` need no configuration. Rename the auto-generated site under **Site configuration →
Change site name**.

Verify before installing on a phone:

```bash
U=https://your-site.netlify.app
for p in / /manifest.json /sw.js /icons/icon-192.png /body /profile; do
  printf "%-24s %s\n" "$p" "$(curl -s -o /dev/null -w '%{http_code}  %{content_type}' "$U$p")"
done
```

Expect `200` for all of them. `sw.js` must come back as `application/javascript` and
`manifest.json` as `application/json`; a host serving either as `text/plain` will silently break
installation. `/body` and `/profile` returning the 2.8 KB shell rather than a 404 is what proves
the rewrite works.

### Custom subdomain, with DNS on Cloudflare

Netlify → **Domain management → Add a domain**, then add a CNAME in Cloudflare DNS:

```
gram   CNAME   your-site.netlify.app
```

⚠️ Set that record to **DNS only (grey cloud)**, not proxied (orange cloud). Cloudflare proxying
in front of Netlify prevents Netlify from issuing its certificate and can produce redirect loops.

⚠️ **Moving the app to a different address is a fresh install.** Browser storage is scoped per
origin, so `something.netlify.app` and `gram.example.com` are separate worlds — the home-screen
icon must be re-added and the workouts logged under the old address do not follow. Settle on the
address *before* you start logging real training.

### Cloudflare Pages alternative

**Workers & Pages → Create → Pages → Upload assets** (not *Connect to Git* — `dist/` is generated
and gitignored). Attach the custom domain from inside the project; if the zone is already on
Cloudflare it creates the DNS record and certificate itself, and the grey-cloud caveat above does
not apply.

---

## How updates work without a store

This is where skipping the stores actually *helps*. Two mechanisms:

### Over-the-air, for anything that isn't native code

```bash
npx eas update --branch production --message "Fix rest timer drift"
```

The installed app downloads it in the background and applies it on next launch. No reinstall, no
download prompt, no review queue — and because there is no store, there is no review queue to
skip in the first place. This covers essentially all day-to-day work: screens, logic, fixes,
copy, new features in JS.

Expo's `fingerprint` runtime-version policy means an OTA update is only ever delivered to a
binary whose native code matches. A JS update cannot land on an app missing a native module it
needs.

### A new build, only when native code changes

Adding a native module, bumping the Expo SDK, or changing permissions means a new binary:

```bash
npx eas build --profile preview --platform android   # then reinstall the APK
```

**Installing the new APK over the old one is an upgrade, not a reinstall — all your data stays.**
Two conditions, both handled for you:

- **Same signing key.** Android only grants a new APK access to the old one's data if the
  signature matches. EAS generates and stores your keystore on first build and reuses it
  forever. *Never lose or regenerate that keystore* — a differently-signed APK cannot upgrade
  the installed app; Android will refuse to install it, and the only way through is uninstalling
  first, which erases everything. Back it up: `eas credentials`.
- **Higher `versionCode`.** Android refuses to install an APK whose version code is not greater
  than the installed one. EAS auto-increments this.

On top of that, the app migrates its own stored data forward on first launch — see
[RELEASING.md](RELEASING.md).

### What actually deletes your data

Only these:

- Uninstalling the app
- Android Settings → Apps → GRam → Storage → Clear storage
- Removing an iPhone home-screen web app, which takes its storage container with it

Export a backup first and every one of those is recoverable — see
[QUICKSTART.md](QUICKSTART.md).
- Offloading the app on iOS
- Tapping **Erase all data** in the app's own Profile tab

Normal updates, OTA or APK, never do.
