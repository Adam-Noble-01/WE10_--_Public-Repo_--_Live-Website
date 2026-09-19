# Noble Architecture Studio - Local Shell

The single local entry point for the whole Noble Architecture app ecosystem.
Open one window, land on the project gallery, travel into any project's Admin,
PlanVision or TrueVision content, and come back out - without touching a URL.

**This is localhost only.** The live website serves the very same application
files untouched, because it never runs the local Flask server that adds any of
this. Nothing in this folder is referenced by the public site.

---

## Starting it

| I want to | Run |
| --- | --- |
| Open the app (normal use) | `Launch__ProjectVision__StudioApp__.bat` |
| Open straight into one project | `Launch__ProjectVision__StudioApp__.bat PS01` |
| Have the server running from login | Shortcut `Start__ProjectVision__WindowsStartUp__Silent__8090__.bat` into `shell:startup` |
| Develop, with the request log visible | `ProjectVision__LocalServer__Main__.bat` |

The launcher starts the server itself when the server is not already answering,
so it works whether or not the silent startup server is up. It never starts a
second server on the same port.

Both launchers share one definition of "already running", in
`ProjectVision__StudioApp__Launch__.ps1`. The startup `.bat` calls that script
with `-ServerOnly`, which starts the server and opens no window.

### Installing it as a real PWA

With the server running, open `http://localhost:8090/` in Edge, then
**Settings and more (…) → Apps → Install this site as an app**. It installs as
*Noble Architecture Studio* and appears in the Start Menu. The manifest scopes
the app to `/`, so every local app stays inside that window.

Installing is optional: the launcher already opens a chromeless Edge
application window, which looks and behaves the same.

---

## When it will not start

**`localhost:8090` shows HTTP 501.** That is not this app. `WsToastNotification.exe`
holds `0.0.0.0:8090` permanently on this machine and answers 501 whenever the
Flask server is down. Flask binds `127.0.0.1:8090` alongside it and the more
specific bind wins for `localhost`, so the two coexist - but a 501 means our
server is not running. Start it and refresh.

This is also why neither launcher tests whether the port is in use: that test is
always true here and would stop the server from ever starting. They ask
`/api/health` for our own service name instead.

**Nothing happened when I ran the startup `.bat`.** Check
`na-apps/ProjectVision__LocalServer__Startup__.log`. No log at all means the
server never started; a traceback in it means it started and failed.

**A route I just added answers 405.** The server does not reload its routes
unless it was started with `--debug`. The silent startup server can be days old
and has no window to remind you it is there - look for `pythonw.exe` in Task
Manager, end it, and run the launcher again.

---

## What is in here

```
02__ProjectVision__StudioShell__AppCode/
├── NaStudioShell__AppShell__.html                       The shell page, served at /
├── 02__Src__AppModules/
│   ├── NaStudioShell__AppShell__Controls__.js           Bar behaviour
│   └── NaStudioShell__HostedPageBridge__.js             Injected into every served page
├── 03__Style__AppStylesheets/
│   └── NaStudioShell__AppShell__Stylesheet__.css        Bar and frame styling
└── 05__AppData/
    └── NaStudioShell__Pwa__Manifest__.webmanifest       Installability, scoped to /
```

| File | Role |
| --- | --- |
| `NaStudioShell__AppShell__.html` | Application bar above a full-bleed frame |
| `NaStudioShell__AppShell__Controls__.js` | History, breadcrumb, sub-app pills, project switcher |
| `NaStudioShell__HostedPageBridge__.js` | Shortcut forwarding in the frame; return pill outside it |
| `NaStudioShell__AppShell__Stylesheet__.css` | Bar and frame styling |
| `NaStudioShell__Pwa__Manifest__.webmanifest` | Installability, scoped to the whole local server |

The server publishes this folder at `/__na-studio/`, keeping the numbered paths,
so the stylesheet is at
`/__na-studio/03__Style__AppStylesheets/NaStudioShell__AppShell__Stylesheet__.css`.

The project gallery itself is not in this folder. It is the existing
`na-apps/ProjectVision__LocalServer__DevLanding__.html`, served at `/gallery`
and loaded into the frame. The Project Admin dev server on port 8081 serves the
same page at its own root, without the shell.

---

## Keyboard

| Key | Does |
| --- | --- |
| `Alt` + `←` / `→` | Back / Forward through the pages actually visited |
| `Alt` + `Home` | Back to the project gallery |
| `Ctrl` + `K` | Project switcher - jumps to the **same** sub-app in another project |

These work from inside a sub-app too: the bridge forwards exactly these four
chords to the bar and leaves every other key to the application's own hotkey
manager.

---

## How the sub-apps get a navigation bar

They are not modified. `ProjectVision__LocalServer__Main__.py` appends one
`<script>` tag to each HTML response it serves. Consequences worth knowing:

- Any new sub-app is covered with no further work.
- The public site cannot regress, because the injection lives in a server the
  public site does not have.
- `?studio=off` on any URL serves that page exactly as the live site does -
  useful when checking whether the shell is involved in a problem.

Inside the frame the bridge does nothing but forward shortcuts. Opened directly
in a browser tab, it draws a small "Open in Studio" pill in the bottom-right
that deep-links that exact page back into the shell.

---

## Design notes

**Why a frame rather than a bar floating over each app.** TrueVision and
PlanVision size themselves with `100vh`. A bar that overlays them would cover
their toolbars, and a bar that pushed the page down would leave them 42px too
tall. Inside the frame, `100vh` resolves against the frame, so the sub-apps lay
out exactly as they do standalone. Measured: a 950px window gives the frame
908px, and the sub-app agrees.

**Why Back and Forward need no history stack.** A navigation inside a
same-origin frame pushes an entry onto the top-level session history, so
`window.history.back()` steps the frame back through the pages visited. The
address hash is kept in step with `replaceState`, which updates the current
entry rather than adding a second one beside the frame's.

**Why there is no service worker.** A worker is not required for installability
in current Edge or Chrome, and local app code is edited constantly. A caching
worker is the known cause of a browser running yesterday's module. The shell
page, the gallery, everything under `/__na-studio/` and every injected HTML page
are served `Cache-Control: no-store`.
