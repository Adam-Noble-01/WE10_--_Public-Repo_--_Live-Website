# TrueVision 3D — PWA Installability

**One installable app per project.**

TrueVision serves every client from one codebase and picks the project out of
the URL query string:

```
/na-apps/30__TrueVision__CoreAppCode/Index.html?project=RB05&project-folder=RB05__WestFarm&year=26
```

A single static `.webmanifest` would install **one generic app for everybody**,
launching at a project-less URL. That is not what we want. Each client should
install *their* scheme, with *their* name on the icon, opening straight into
*their* model.

So the manifest is built at runtime, per project, and injected as a `data:` URL.

---

## How the per-project identity works

`TrueVision__Pwa__ProjectContext__.js` reads the query string and derives:

| Field | Example |
|---|---|
| `projectKey` | `26-RB05__WestFarm` |
| `displayName` | `West Farm` |
| `shortName` | `West Farm` |
| `launchQuery` | `?project=RB05&project-folder=RB05__WestFarm&year=26` |

`TrueVision__Pwa__Manifest__Builder__.js` then stamps those into a manifest:

```json
{
  "id":         "https://www.noble-architecture.com/na-apps/30__TrueVision__CoreAppCode/Index.html?project=RB05&project-folder=RB05__WestFarm&year=26",
  "start_url":  "…same URL…",
  "name":       "West Farm - TrueVision 3D",
  "short_name": "West Farm",
  "scope":      "https://www.noble-architecture.com/na-apps/30__TrueVision__CoreAppCode/"
}
```

Because `id` differs per project, browsers treat each project as a **separate
installed app**. Two projects can sit side by side on one iPad without
overwriting each other.

### Two rules that are easy to break

1. **Every URL in the manifest must be absolute.** A `data:` URL carries no
   base, so relative paths cannot resolve. `TrueVision__Pwa__Url__Constructor__.js`
   is the only place absolute URLs are built — keep it that way.
2. **The manifest scripts must stay blocking, in `<head>`.** They inject the
   manifest link before the browser evaluates installability. Move them to the
   body or add `defer` and the browser may read the generic fallback instead.

### The readable name

Derived **synchronously** from the project folder (`RB05__WestFarm` →
`West Farm`) so it is in place before the installability check. The loading
sequence later calls `setProjectDataName()` with `projectName` from
`TrueVision__ProjectData__.json` if it carries something better, and the
manifest is rebuilt.

### iOS

Safari bookmarks the page the client is standing on, so a client installing
from their own project link gets their own project either way. The injected
`apple-mobile-web-app-title` carries the per-project home-screen label.

---

## When the prompt appears

Sequenced deliberately around TrueVision's other UI:

1. Wait for `na-app-scene-ready` (or a 45 s safety timeout).
2. Wait a further 6 s settle delay.
3. Refuse to render while the **Better in Full Screen** card or the **User
   Guide** is open — poll until they close. Waiting on another modal does not
   consume the retry budget.
4. The Chromium bar measures the bottom of the viewport and sits clear of the
   Presentation Mode carousel and the navigation toolbar, re-measuring when
   either changes.

### Dismissal policy — different by environment, on purpose

| | Behaviour |
|---|---|
| **Live site** | The offer returns on **every fresh visit**. Clients rarely install the first time they are asked; the second visit is when it lands. `Not Now` only silences it for that page load. |
| **Localhost** | Dismissing stores a **one week** suppression, so development reloads are not interrupted — but it resurfaces often enough to confirm it still works. |

An actual install always wins: once installed for a project, that project never
offers again. State is namespaced per project, so declining on one project does
not silence another.

`Tools & Settings → Install App` always shows the prompt, whatever the
suppression state says.

---

## Platform routing

| Platform | Handler | What the client sees |
|---|---|---|
| Chrome / Edge / Opera / Samsung (desktop + Android) | `Chromium` | Compact bottom bar, one tap, real `beforeinstallprompt` |
| iPhone / iPad Safari | `IosSafari` | Instruction card; Share button located correctly per device |
| macOS Safari | `MacSafari` | File → Add to Dock |
| iOS Chrome / Edge / Firefox | `IosNonSafari` | "Only Safari can install", with Copy Link |
| Firefox Android, anything unclassified | `GenericManual` | Browser-menu instructions |
| Firefox desktop | `GenericManual` | Told plainly it cannot install |
| Already installed | `InstalledStandalone` | Nothing |

---

## Service worker

`Na__Pwa__ServiceWorker__.js` lives at the **app root**, not in this folder.

> GitHub Pages cannot send a `Service-Worker-Allowed` header, so the script's
> location **is** its scope. **Do not move it** — moving it silently narrows the
> scope and breaks install on every Chromium browser.

It is a stub that `importScripts()` the real logic from this folder.

**Cache buckets**

| Bucket | Strategy | Why |
|---|---|---|
| `tv-shell-*` | stale-while-revalidate | Fast second visit, background refresh |
| `tv-data-*` | network-first, `cache:'no-store'` | A stale disk-cached `ProjectData` must never be written back as fresh |
| `tv-models-*` | network-first + 4 s grace, LRU 80 | Fresh when fast, cached when slow or offline |
| `tv-vendor-*` | cache-first | esm.sh URLs are version-pinned and immutable |

The full module graph is **deliberately not precached** — around a hundred
modules that move constantly would make a hand-maintained list wrong within a
week. Only the boot-critical handful is precached.

**Bump `PWA_SW_VERSION_TOKEN`** in `TrueVision__Pwa__ServiceWorker__Logic__.js`
whenever shell JS or CSS changes in a way that must reach clients immediately.
The activate step then evicts every older bucket.

---

## Console helpers

```js
TrueVision__Pwa__ResetInstallPrompt()   // clear the localhost week-long snooze
TrueVision__Pwa__ClearCache()           // wipe caches + workers, reload
TrueVision__Pwa__PurgeApp()             // the above, plus local/session storage
TrueVision__Pwa__Manifest.getLastBuilt()          // inspect the built manifest
TrueVision__Pwa__InstallController.getActiveDescriptor()   // platform detection
TrueVision__Pwa__InstallController.requestShow()           // force the prompt
```

---

## File map

| File | Role |
|---|---|
| `TrueVision__Pwa__Url__Constructor__.js` | Every absolute URL, one place |
| `TrueVision__Pwa__ProjectContext__.js` | URL query → project identity |
| `TrueVision__Pwa__Manifest__Builder__.js` | Builds + injects the per-project manifest |
| `TrueVision__Pwa__Manifest__Fallback__.webmanifest` | Static safety net |
| `TrueVision__Pwa__PlatformDetector__.js` | Device / OS / browser classification |
| `TrueVision__Pwa__SessionState__.js` | Suppression policy and storage |
| `TrueVision__Pwa__PromptUi__.js` | The card and bar, Noble Architecture style |
| `TrueVision__Pwa__Handler__*.js` | Per-platform install routes |
| `TrueVision__Pwa__InstallController__.js` | Picks the handler, governs timing |
| `TrueVision__Pwa__ServiceWorker__Registrar__.js` | Registration + update reload |
| `TrueVision__Pwa__ServiceWorker__Logic__.js` | Caching brain |

Styles live in
`03__Style__AppStylesheets/Na__UiFeature__Styles__PwaInstallability__.css`.
