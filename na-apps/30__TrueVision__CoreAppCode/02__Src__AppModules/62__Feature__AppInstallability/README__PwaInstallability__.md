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

### Three rules that are easy to break

1. **Every URL in the manifest must be absolute.** A `data:` URL carries no
   base, so relative paths cannot resolve. `TrueVision__Pwa__Url__Constructor__.js`
   is the only place absolute URLs are built — keep it that way.
2. **The manifest scripts must stay blocking, in `<head>`.** They inject the
   manifest link before the browser evaluates installability.
3. **`Index.html` must never carry a static `<link rel="manifest">`.** Safari
   fetches the *first* manifest link it parses and keeps it for the life of the
   page; changing the `href` afterwards does nothing
   ([WebKit bug 229059](https://bugs.webkit.org/show_bug.cgi?id=229059), shipped
   in Safari 15.4). A static fallback link used to sit above the builder
   scripts, so it was the only manifest an iPhone, iPad or Mac ever saw — and
   its project-less `start_url` is what every Home Screen icon launched: an
   empty app. The builder now creates the link itself, with the `href` set
   *before* the element joins the document. If a static link ever comes back,
   the builder says so in the console.

### The readable name

Derived **synchronously** from the project folder (`RB05__WestFarm` →
`West Farm`) so it is in place before the installability check. The loading
sequence later calls `setProjectDataName()` with `projectName` from
`TrueVision__ProjectData__.json` if it carries something better, and the
manifest is rebuilt.

### iOS, iPadOS and Mac Safari

**What the icon opens is decided by the manifest, not by the page.** When a
manifest is present, Add to Home Screen (and Add to Dock) launches its
`start_url`. Safari only bookmarks the page the client is standing on when there
is no manifest at all. Three things follow:

- The per-project `start_url` is the whole install on Apple devices. Rule 3
  above is what guarantees Safari reads the right one.
- `refresh()` — the rebuild after `TrueVision__ProjectData__.json` supplies a
  nicer name — reaches Chromium only. Safari keeps the name derived from the
  project folder at boot. The launch URL is identical in both, so nothing that
  matters is lost. The injected `apple-mobile-web-app-title` carries the
  per-project Home Screen label.
- A Home Screen icon gets **storage of its own**: cookies, `localStorage`,
  caches and the service worker all start empty and stay separate from Safari.
  So every first launch of an icon is a first visit. Nothing the client did in
  Safari is there, and the app must never need it to be.

From iOS / iPadOS 26 every site added to the Home Screen opens as a web app by
default (the sheet has an **Open as Web App** switch, on by default), so there
is no installability test left to pass on Apple devices — only a launch URL to
get right.

#### The static fallback manifest carries no `start_url`, on purpose

A manifest with no `start_url` launches the page it was installed from, query
string and all. The fallback used to say `"../../Index.html"`, which installed
an app that opened on nothing. Chromium will not raise its own install prompt
without a `start_url`, so on the fallback path installing is by the browser
menu only — a rare missing prompt beats an icon that opens an empty app.

#### Icons made before 19-Sep-2026

Any icon added from Safari between v2.9.0 (27-Aug-2026) and the fix stored the
bare `Index.html` and cannot be repaired from here — the URL lives inside the
icon. `TrueVision__Pwa__Handler__InstalledStandalone__.js` spots that launch
(installed, Safari family, no project in the URL) and shows a card explaining
how to remove the icon and add it again. It is the one card allowed to render
inside an installed app (`allowWhenInstalled`).

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
| Already installed | `InstalledStandalone` | Nothing — unless a Safari icon launches with no project, then the "add it again" card |

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

**The update reload is for updates only.** `controllerchange` also fires when
the very first worker claims a page nothing was controlling. That is not an
update — everything on screen came off the network in one go — so the registrar
lets it through without reloading. It matters most on Apple devices, where a
Home Screen icon's own empty storage makes every first launch a first install.

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
