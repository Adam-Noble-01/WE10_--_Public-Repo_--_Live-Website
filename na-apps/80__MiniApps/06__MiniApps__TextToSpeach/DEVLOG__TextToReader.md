=================================================
TEXT TO READER - WhatsApp, Markdown And CSV
=================================================

DEVELOPMENT LOG

----------------------------------------------------------------
1.0.0 - 19-Sep-2026 |  Mini App Port
  - Ported from sn-apps/SN10_01_-_UTIL_-_Text-To-Reader-App (legacy v1.3.0).
  - Renamed and modularised under 06__MiniApps__TextToSpeach.
  - ES modules with AppConfig JSON as the single source of UI text and settings.
  - Shared utility stylesheet kept for the PAGE / FORM / BTTN furniture.
  - WhatsApp parser, CSV tables, Markdown render and file upload each have
    their own module. Debug console.log calls from the old page were dropped.
  - Old sn-apps copy is left in place until this live Mini App is confirmed.

----------------------------------------------------------------
1.0.1 - 19-Sep-2026 |  Legacy Copy Removed
  - Deleted sn-apps/SN10_01_-_UTIL_-_Text-To-Reader-App after live confirmation.
  - Site data library now points at this Mini App URL.

----------------------------------------------------------------
1.4.0 - 19-Sep-2026 |  Simple / Edit / Read Views
  - Three tabs in the compact header: Simple (original paste-and-render
    layout), Edit (full-page Markdown textarea), Read (article only).
  - Header height roughly halved; footer height cut by 20%.
  - Upload control moved to a square file-icon button at the far right of
    the header, with the version number immediately to its left.
  - Header, tabs, version, upload and footer are aria-hidden so browser
    read-aloud skips chrome and speaks only the rendered article. The
    Read view also hides the footer and all editor chrome.
  - Switching to Read (or loading a file while on Read) re-renders and
    focuses the article.
  - View switching lives in MiniApp__TextToReader__ViewTabs__.js.

----------------------------------------------------------------
1.4.1 - 19-Sep-2026 |  A4 Markdown Document Styles
  - Rendered Markdown now uses MiniApp__TextToReader__MarkdownStyle__.css,
    refactored from the Typora A4 document theme (03-na-document-a4-width.css)
    and aligned with AD02_20 / DAS heading, list and table standards.
  - Open Sans Light / Regular / Medium / SemiBold / Bold load from
    NaApps__CommonFonts instead of Google Fonts (Medium 500 is required for
    headings — without it they sat too heavy and looked out of kilter).
  - Read view sits an A4-width (210 mm) white sheet on a very light grey
    (#fafafa) canvas so the page reads as paper with grey margins.

----------------------------------------------------------------
1.4.2 - 19-Sep-2026 |  Tabs By The Content, A4 Edit, Tighter Mobile Read
  - Tabs moved out of the header and placed above the A4 content column so
    they sit next to the editor / paper rather than beside the app title.
  - Edit view uses the same 210 mm paper width and grey side margins as Read.
  - On phone-width screens the A4 paper chrome is dropped for both Edit and
    Read. Read uses smaller type (8.5 pt body) and tighter padding so more
    of the article fits on screen.

----------------------------------------------------------------
1.4.3 - 19-Sep-2026 |  Proper Tabs And Tighter Spacing
  - Tabs are a connected strip: equal-width folders, brand top edge and white
    face on the open tab so the active view is obvious.
  - Cut the 1 rem main-column gap and card margins so Simple no longer wastes
    a grey band between Input, Actions and Output.

----------------------------------------------------------------
1.5.0 - 10-Oct-2026 |  Built-In Read Aloud
  - Read view: right-click (computer) or press and hold (phone) now opens the
    app's own menu instead of the browser's. It has one big Read aloud button,
    opened under the pointer, so right-click then click in place reads. While
    reading, the menu offers Read from here and Stop. Shift + right-click still
    gives the browser's menu; Esc stops reading. Tabs and Simple / Edit keep
    the browser's menu.
  - Speech uses window.speechSynthesis. Edge gives its own Read aloud voices
    ("Microsoft ... Online (Natural)") to it for free, so no paid voice is
    needed. Default: Steffan at 1.5x, the voice and speed set in Adam's Edge
    Read aloud. Voices, speed and timings live in NaMiniApp__ReadAloud in the
    AppConfig. Other browsers use their best voice (iPhone: Apple's en-GB
    voices, Premium / Enhanced first).
  - Reads from the sentence under the pointer to the end of the article, or
    only the selection when the right-click is on selected text.
  - One utterance per paragraph: each new utterance costs 200-400 ms in Edge
    154 (measured 10-Oct-2026). Word boundary events drive a sentence wash and
    a word highlight (CSS Custom Highlight API, so the article DOM is never
    touched), and the page scrolls to follow unless you have just scrolled.
  - Stop leaves the stopped sentence marked grey; Read from here on it carries
    on. Leaving the Read tab, rendering again or Clear stops reading.
  - Phones: Read view text is no longer selectable, so press and hold gives
    Read aloud instead of the selection callout.
  - New modules: MiniApp__TextToReader__ReadAloud__.js (speech, highlights,
    voice choice) and MiniApp__TextToReader__ReadMenu__.js (menu, long press).

----------------------------------------------------------------
1.5.1 - 10-Oct-2026 |  Versioned File URLs (1.5.0 Ran Old Code)
  - Live 1.5.0 still showed Edge's own menu. The new page and config arrived,
    but browsers ran the OLD Main__.js, so the read aloud menu never loaded.
    Cloudflare gives JS and CSS "Cache-Control: max-age=14400" (4 hours),
    while HTML and JSON get 600 (10 minutes). Straight after the deploy its
    edge still served the previous Main__.js, and a browser that fetched it
    keeps it for 4 hours. A hard refresh did not clear it. A fresh Edge eight
    minutes after the deploy got the new file and passed every read aloud
    check on the live site.
  - Fix: every app file now loads by a versioned URL (?v=1.5.1). The page is
    never held for long, so a release's new ?v= is a URL nothing has cached:
      - the two app stylesheet links in the head;
      - the Main__.js script tag;
      - an import map giving each 01__AppModules/*.js its versioned URL, so the
        import lines in the modules never change.
  - RELEASE RULE: with each release, set every ?v= in Main__.html to the new
    version, next to NaMiniApp__Version in the AppConfig.

----------------------------------------------------------------
1.5.2 - 10-Oct-2026 |  Phone List Numbers
  - Phones (768 px and narrower): ordered-list numbers were off screen in
    Read and clipped away in Simple's Output box. The shared utility
    stylesheet pulls lists 1.75 rem left and 0.75 rem right on phones, for
    browser-drawn markers. These lists draw their own numbers 7 mm left of
    each item, so at 390 px "1." sat at -22 px. The pull also added up per
    nesting level: third-level items ran 23 px past the right edge of the
    screen, losing words at line ends.
  - Fix, MarkdownStyle phone block, Simple and Read: no pull. Numbers and
    bullets start on the paragraph text edge; a nested number starts on its
    parent item's text. Columns are in em so they follow the type (Read
    8.5 pt, Simple 11 pt): 1.75 em fits "10.", 2.25 em "1.10", 3 em "1.1.10".
    Bullets use 1.75 em too, so bullet and number text line up.
  - Any width: a numbered list inside a bullet list took the bullet's marker
    style (0.6 em, bullet brown). The bullet rule is now ul > li::before.
    That is the only desktop change; the A4 layout is otherwise untouched.
  - Checked in headless Edge 154 at 320, 360, 390 and 768 px, Simple and
    Read: every number and bullet fully on screen, no list text past the
    paragraph's right edge, at least 3 px from number to text.
  - The stylesheet change was committed and pushed early, inside 05a583f
    (1.5.1). This entry, NaMiniApp__Version and the ?v= tokens are 1.5.2.

----------------------------------------------------------------
1.6.0 - 10-Oct-2026 |  Voice And Speed In The Read Aloud Menu
  - Under Read aloud the menu now has Voice (a dropdown) and Speed (- / +,
    0.1 steps, 0.5x to 3x). Both are remembered on each device (localStorage
    "NaTextToReader__ReadAloud__Prefs"); the AppConfig gives the defaults
    (Steffan, 1.5x). Changing either mid-read restarts the sentence being
    read in the new voice or speed, once, 450 ms after the last tap.
  - Voice list: every English voice the browser offers. Edge on a computer:
    "Microsoft Natural" (46) then "On this device", UK first, then US.
  - Edge on Android gives web pages NO voices: getVoices() stays empty (Adam's
    phone showed no voice line in 1.5.2; reported to Microsoft in 2024). So
    1.5.x read in the phone's default voice and Steffan cannot be offered
    there. The list now offers "Phone voice" by accent (UK, US, Australia,
    Ireland, India), which steers the phone's own speech engine. Lists that
    do arrive later (voiceschanged) replace it. Chrome-style lists (one voice
    per language, en_GB) and Google's per-voice names are handled, online
    ("network") voices first.
  - Placement: Read aloud stays under the mouse pointer; near the bottom of the
    window the menu grows upward (Read aloud last). On a phone it opens above
    the finger with Read aloud nearest the thumb, or below the finger near the
    top. Phone controls are 44 px; the select uses 16 px text so phones do not
    zoom.
  - A menu opened by touch no longer takes focus: lifting the finger focuses
    the article, and the menu now closes when focus leaves it (Tab out).
  - Tested in headless Edge 154: 29 new checks (PC, phone, phone with no
    voices) plus the 37-check suite from 1.5.

----------------------------------------------------------------
1.6.1 - 10-Oct-2026 |  Built-In Read Aloud Removed (Back To Edge's Own)
  - At Adam's request, the app's own read aloud (1.5.0 - 1.6.0) is gone. On
    his Android phone it could not use Steffan: Edge on Android gives web
    pages no voices, so it read in the phone's robot voice, and its press and
    hold menu replaced the browser's. Edge's own Read aloud does have Steffan
    on both his PC and his phone, and works on this page as before.
  - Back to the pre-1.5.0 app: Main__.js, Style__.css, the AppConfig and the
    page are as they were (the browser's own right-click and press and hold
    menus, selectable text on phones). The ReadAloud__ and ReadMenu__ modules
    are deleted.
  - Kept: the phone list numbers (1.5.2), and the versioned file URLs (1.5.1),
    now ?v=1.6.1. They make every browser fetch the restored files rather than
    a 4-hour cached copy of the read aloud code.


=================================================
FILE STRUCTURE
=================================================

    06__MiniApps__TextToSpeach/
    |
    +-- MiniApp__TextToReader__Main__.html          Page shell
    +-- MiniApp__TextToReader__Style__.css          App chrome (header, tabs, views)
    +-- MiniApp__TextToReader__MarkdownStyle__.css  A4 Markdown document styles
    +-- MiniApp__TextToReader__AppConfig__.json     Config and UI text
    +-- DEVLOG__TextToReader.md                     This file
    |
    +-- 01__AppModules/
          +-- ...__Main__.js            Controller - DOM, events, bootstrap
          +-- ...__ViewTabs__.js        Simple / Edit / Read view switching
          +-- ...__WhatsAppParser__.js  Strip WhatsApp prefixes, emit a list
          +-- ...__CsvTable__.js        Detect ```csv``` blocks, build tables
          +-- ...__FileUpload__.js      Load a local .md / .txt file
          +-- ...__MarkdownRender__.js  WhatsApp -> CSV -> Marked.js pipeline


=================================================
LEGACY SOURCE
=================================================

  sn-apps/SN10_01_-_UTIL_-_Text-To-Reader-App/
    SN10_01_01_-_PAGE_-_Text-To-Reader-App.html
    SN10_01_02_-_SCRIPT_-_File-Upload-Handler.js

  Behaviour preserved:
    - WhatsApp `[dd/mm, HH:MM] Name:` prefixes become a Markdown bullet list.
    - Non-WhatsApp text is treated as Markdown.
    - Fenced ```csv``` blocks become HTML tables after Markdown render.
    - Upload replaces the textarea contents; unsupported types report inline.

----------------------------------------------------------------
1.7.0 - 25-Oct-2026 | Phonon Easton Offline PWA
  - On-device Phonon 31m English q8 model, loaded only on demand using
    the official phonon-tts 0.4.0 WebAssembly browser distribution.
  - Easton is the default voice; runtime/model/voice are separate assets.
  - Read tab now includes Prepare & Play, pause, stop, and 1x-3x speed.
    Selected text is prioritised; otherwise the rendered article is read.
  - Each recording is fully synthesised to WAV before playback. There is
    a 12,000-character mobile safety cap and full generation cancellation.
  - PWA manifest and shell service worker allow standalone installation.
    Model and voice are cached independently and their presence is verified
    by the explicit Install offline voice action.
  - The Pages deploy workflow downloads pinned Phonon and Marked packages.
    Compiled binaries are not committed to the website source repository.
    Marked.js is served locally rather than from a CDN for offline startup.
  - Preserved original text conversion, CSS design, Simple/Edit/Read tabs,
    file-upload pipeline and readable article DOM.
  - Performance on Pixel 6 is not yet benchmarked. GitHub Pages alone
    cannot set COOP/COEP isolation headers, so Phonon uses a single CPU
    thread until compatible Cloudflare response headers are deployed.
  - Offline model files remain subject to Android browser storage eviction.

----------------------------------------------------------------
1.7.1 - 25-Oct-2026 | Fix PWA Service Worker Scope And Cached Script
  - Derive the registration scope explicitly from the worker script URL,
    restricting it to 06__MiniApps__TextToSpeach rather than its parent.
  - Share the same registration helper between automatic and explicit install.
  - Bump every HTML import/CSS version token and the service worker cache
    version so previous 1.7.0 browser and Cloudflare caches cannot be reused.
  - Request updateViaCache:none for the worker script's own update checks.

----------------------------------------------------------------
1.7.2 - 27-Oct-2026 | Clean Read Panel And Download Modal
  - Read panel stripped to the controls: no heading, voice/engine label or
    hint text. The status line is empty (and hidden) until there is progress
    or an error to report.
  - "Install offline voice" button replaced by a modal on the Read tab. On
    entering Read the Cache API is checked for the model, config, tokenizer
    and Easton voice files; the modal appears only if any is missing, and is
    not shown on later loads once they are installed. Esc does not close it;
    Download voice installs and verifies, "Not now" returns to Simple
    (later in 1.7.2: stays on Read, as Simple is retired).
  - Prepare & Play is hidden once its audio is rendered, so it cannot be
    pressed again by accident and waste a minute of synthesis. It returns
    when the article text or the selection differs from what was rendered
    (and again after Stop), with a "Text changed" status line.
  - Read-along highlight (new MiniApp__TextToReader__Highlight__.js): the
    sentence being spoken gets a grey band and its current word turns yellow,
    scrolling into view as reading moves on. The article is wrapped into
    sentence/word spans after each render. Speech is now synthesised one
    sentence per request, so sentence timings are exact; Phonon gives no word
    timestamps, so words are spread over each sentence's voiced audio by
    spoken length (letters, longer digits, a pause after commas).
  - Dev server (MiniApp__TextToReader__DevServer__.py) swaps the cache-first
    service worker for one that removes itself, so edits are never hidden
    behind a stale shell cache; --with-sw serves the real worker.
  - Speed dropdown replaced by a speedo button: one tap steps 1.0 / 1.25 /
    1.5 / 2.0 / 2.5x (wrapping back to 1.0x) and the needle swings to the
    new speed with a small overshoot. The dial is one animated SVG,
    01__AppAssets__TextToReader/UiIcons__MenuIcons__ReadAloud/
    Icon__ReadAloud__SpeedDial__.svg, inlined at start-up so its own CSS turns
    the needle from a data-speed attribute; it is in the shell cache. A
    stored 1.75x, 2.25x or 3x snaps to the nearest step. Reduced-motion users
    get a short, plain swing instead of the overshoot.
  - Read panel and voice modal now use the house ReadAloud icons
    (01__AppAssets__TextToReader/UiIcons__MenuIcons__ReadAloud): Prepare &
    Play and Download voice carry their icons beside the text; Play/Pause and
    Stop are square icon buttons with aria-labels. Static icons are CSS masks,
    so they take each button's text colour (white on the dark buttons).
  - Play/Pause is one animated SVG (Icon__ReadAloud__PlayPause__.svg): the
    triangle morphs into the two pause bars, the second bar growing out of the
    play tip (CSS d transition, 0.32 s). Browsers without CSS d support swap
    to the bars without the morph.
  - A speaker icon pulses at the end of the row while audio is playing.
  - All the icons are in the shell cache for offline use.
  - Simple view retired. Read is the first page; Edit is the second tab.
  - One tool bar replaces the tab row and the separate audio panel:
    Read | Edit on the left, then Audio symbol | Speed | Stop | Play/Pause on
    the right. Prepare & Play is an icon-only filled button standing in Play/
    Pause's place until audio exists. Status and progress are a slim row under
    the bar, shown only when they have something to say. The article now starts
    about 100 px from the top of the window instead of about 290 px.
  - Launch modal (new MiniApp__TextToReader__SourceModal__.js) when there is
    no text: two picture buttons, Paste from clipboard and Open Markdown /
    text file (new Icon__ReadAloud__PasteClipboard__.svg and
    Icon__ReadAloud__OpenFile__.svg, house stroke style). The header's file
    icon reopens it. If the browser refuses the clipboard, Edit opens with a
    "paste here" placeholder; an empty clipboard says so in the modal. Text
    restored into the editor by a reload is shown straight away instead.
  - The voice download modal waits until the launch modal closes, and "Not
    now" now leaves you on Read. Both modals size within a phone screen.
  - Removed: Render / Clear buttons and the Simple-only headings, labels and
    config text; DefaultView is now "read".
  - Status moved into the tool bar's empty middle, between the tabs and the
    controls (one line, ellipsis, full text on hover), with the progress bar
    under it. It fades out (0.9 s) three seconds after the last message, and
    never while the progress bar shows work running. On phones it floats
    just under the bar over the paper instead.
  - Read and Edit tabs twice as wide on desktop (169 px); 82 px on phones,
    the widest that still fits the playing controls at 375 px.
  - Word jump (new MiniApp__TextToReader__WordJump__.js): once audio is
    prepared, double-click a word (mouse) or long-press it (touch, 450 ms,
    cancelled if the finger drifts 10 px, i.e. a scroll) to play from the start
    of its sentence. Words show a faint hover cue and no touch callout while
    jumping is possible. Highlight__.js gained PlayFromWord and
    HasHighlightTimeline.
  - Custom right-click menu replaces the browser's (the editor and open modals
    keep the native one): Play From Here, Play / Pause (Prepare & Play before
    audio exists), Play From Start, Read Selection, Copy (selection, else the
    sentence), Stop. Play From Here before audio exists prepares the whole
    article and jumps when that run finishes; a failed or cancelled run drops
    the jump. New Icon__ReadAloud__PlayFromStart__.svg for the menu.

----------------------------------------------------------------
1.8.0 - 27-Oct-2026 | Voice Choice, CDN Models And Multithreading
  - Models now come from cdn.noble-architecture.com (R2), under
    NaApps/Root__MiniApps/NaMiniApp__TextToReader__AppAssets/, not Hugging
    Face: PhononTts__EnglishModel__31mQ8, PhononTts__VoiceLibrary__..., and
    KokoroTts__EnglishModel__82mOnnx. The CDN answers with CORS (*).
  - New MiniApp__TextToReader__SpeechEngines__.js: one interface over Phonon
    (phonon-tts) and Kokoro 82M (kokoro-js). Installing a voice downloads its
    missing files from the CDN into the store each runtime reads first, keyed
    by the URL that runtime asks for, so loading never reaches the Hub.
    Kokoro's runtime hard-codes Hub URLs, hence Hub keys holding CDN bytes.
  - Voice modal is now a chooser (AppConfig NaMiniApp__Models): Easton
    (Phonon, US), Edwin and Maeve (Phonon, UK), Emma and George (Kokoro, UK).
    It still opens by itself on the Read tab while the chosen voice is not on
    the device, and Prepare opens it too. A new voice button in the bar opens
    it any time; its tooltip names the voice and the threads it runs on. Each
    row shows "On this device" or the exact size still to download (a second
    Phonon voice is ~250 KB: the model is shared).
  - Multithreading: the service worker adds COOP same-origin, COEP
    require-corp and CORP same-origin to every same-origin response, which
    makes the page cross-origin isolated (SharedArrayBuffer) without any
    Cloudflare rule. The first visit and a hard reload bypass the worker, so
    the page reloads itself once (per tab) when not isolated.
  - Phonon threads: "auto" (3) on phones; 6 on machines with 12+ cores
    (NaMiniApp__DesktopThreads / NaMiniApp__DesktopMinCores). Measured in
    Edge 155 on the studio PC: 1 thread 2.8x real time, 3: 5.6x, 4: 6.4x,
    6: 8.1x. Kokoro q8 runs on ONNX Runtime's own 4 threads at ~0.7x real
    time, so it is offered as the richer, slower option.
  - The thread workers' script (wasm-bindgen-rayon workerHelpers.js) was
    missing from the shell cache: threads would have failed offline.
  - Kokoro runtime (kokoro.web.js + ONNX Runtime wasm, 22 MB) is published
    to 03__KokoroRuntime by the Pages workflow, like 02__PhononRuntime, and
    is cached with the Kokoro voices, not in the versioned shell.
  - Not offered yet: WebGPU variants. Headless Edge found an adapter but the
    benchmark did not finish, so they are untested.
  - Known: the Claude desktop app's built-in browser cannot start a worker
    from inside a worker (or register this service worker), so a threaded
    Phonon load would hang there. Phonon now falls back to one thread when the
    thread pool shows no progress within 20 s. Test threads in Edge.
  - kokoro-js 1.2.1's stream() never closes the sentence splitter it makes for
    a plain string, so its last sentence waited forever; the engine passes a
    splitter it has already closed.
  - Checked in headless Edge 155, served with no isolation headers (as Pages):
    one automatic reload, then isolated; voice modal waits for the source
    modal; Edwin installs in 2.5 s, 11 s of audio in 1.0 s on 6 threads; Emma
    installs in 3 s, 12 s of audio in 11 s on 4 threads; with the server
    stopped and the CDN and Hugging Face blocked, both read from storage.
    Re-checked after 1.8.1 (pitch).
  - Dev server also fetches 03__KokoroRuntime on first run.

----------------------------------------------------------------
1.8.1 - 27-Oct-2026 | Voice Pitch, Remembered Settings, Activity Log
  - The voice modal gains a Voice pitch dropdown (Lowest / Lower / Normal /
    Higher / Highest) and a -25 to +25 % slider; each follows the other and
    the choice is remembered (NaTextToReader__VoicePitch).
  - Pitch works on prepared audio at once, with no re-prepare: the rendered
    PCM is kept and re-wrapped as a WAV whose header sample rate is scaled by
    the pitch factor. That moves pitch and tempo together, so playbackRate is
    divided by the same factor (pitch preserved) and the speedo still sets the
    real speed. Position and play state carry over; the highlight timeline is
    rescaled to match.
  - Presets and range live in the AppConfig (NaMiniApp__PitchPresets,
    NaMiniApp__PitchRangePercent). Version bumped to 1.8.1 in the HTML, the
    AppConfig and the service worker.

  Remembered settings and slider-only pitch (briefly numbered 1.9.0; Adam
  keeps this release at 1.8.1):
  - New MiniApp__TextToReader__UserConfig__.js keeps one JSON document of
    this user's choices between sessions: voice (NaUserConfig__VoiceModelId),
    speed, pitch, and the last file opened (name, time).
  - Stored twice: localStorage NaTextToReader__UserConfig (read at launch) and
    the Cache Storage cache NaTextToReader__UserConfig as the file
    ./MiniApp__TextToReader__UserConfig__.json, which can be opened in the
    browser. The service worker purges only NaTextToReader__Shell__* caches,
    so the file survives every release. On launch the newer copy wins.
    Tested: with localStorage wiped, a reload restored pitch and speed from
    the cache file.
  - The 1.8.x loose keys (NaTextToReader__ReadAloudModel, __PhononSpeed,
    __VoicePitch) are folded in once and removed.
  - Last folder: where the browser has showOpenFilePicker (Edge, Chrome
    desktop) the file button uses it, starting in the folder of the last
    file opened. That file's handle is kept in IndexedDB
    (NaTextToReader__UserConfig / NaUserConfig__Handles), as a handle cannot
    go in JSON. Phones, Firefox and Safari keep the plain file input, which
    cannot remember a folder.
  - The page asks for persistent storage (navigator.storage.persist) so the
    settings and voices are not evicted. The browser may decline until the
    app is installed or used often.
  - Voice pitch is now the slider alone; the preset dropdown and
    NaMiniApp__PitchPresets are gone.
  Activity log:
  - Tapping the Na logo opens an Activity log dialog (new
    MiniApp__TextToReader__ActivityLog__.js): newest first, each line with
    its time and, for timed jobs, how long it took. Timed: voice downloads,
    engine loads (with the threads they got and why) and speech preparation
    (audio length, voice, threads, sentence count). Also logged: cancelled
    preparations, failures, uncaught errors, rejected promises and every
    console warning or error (e.g. Phonon dropping to one thread).
  - A line at the top says what explains speed: CPU cores, whether threads
    are available (cross-origin isolation), whether the offline worker is
    active, and storage used. Copy puts the whole log on the clipboard;
    Clear empties it. The last 250 lines are kept in localStorage
    (NaTextToReader__ActivityLog), so a failure can be read after a reload.
  - The header logo had pointer-events: none (Style.css), so taps fell
    through it; it now takes taps and shows a pointer. Checked with a real
    touch tap in Edge at 360 px, not a scripted click.

----------------------------------------------------------------
1.9.0 - 27-Oct-2026 | Read In Sections
  - New switch in the voice modal, Read in sections (remembered, NaUserConfig__SectionedReading).
    On, Prepare switches on a pick mode: click a sentence, or select a passage, in the text and the
    document is rendered ten sentences at a time (NaMiniApp__SectionSentences). The chosen section
    plays as soon as it is rendered; the rest render outwards from the one being heard: after, before,
    two after, two before... Measured on Easton: 40 s of audio rendered in 5.4 s; restarting on kept
    sections starts in 23 ms with no engine load. The 12,000 character limit does not apply.
  - Rendered sections are kept as 16-bit PCM in a Blob, keyed by voice + the section's text, so they
    survive leaving Read and returning, and unchanged sections survive an edit. Pitch is applied via
    the WAV header as before. A memory budget (NaMiniApp__SectionCacheMegabytes, 400) lets go of the
    sections farthest from the playhead. Not kept across a page reload.
  - Sections hand over on 'ended' (about 1 ms); double-click or Play From Here on a word in another
    section loads it, or renders it first if needed. Play after the last section starts the document again.
  - Right-click: Prepare & Play This Section (selection's section, else the word's) replaces Read
    Selection while sections are on.
  - Voice modal: voices sit in a nested scrolling list; the sections note hides behind an (i)
    (new Icon__ReadAloud__Info__.svg, 60 weight like the ReadAloud gold standards).
  - New Sections__.js; BuildReadingPlan groups sentence pieces in one pass (was quadratic);
    per-sentence rendering shared as SynthesiseSentences. Version 1.9.0 everywhere.
  - Sectioned reading: the opening section is now 5 sentences (AppConfig
    NaMiniApp__FirstSectionSentences), later ones stay at 10, so reading
    from the top starts after half as much rendering. SplitSections takes
    the first size as an optional third argument.
  - Picking the start is done in the text, as for any word or passage (no list dialog): with sections on,
    Prepare turns on pick mode (pointer on words; Esc or Prepare again cancels); a click starts at that
    sentence, a selection starts at its first sentence, and Prepare with a selection already made starts at once.
  - Paste: the right-click menu opens with Paste (above a rule, before the transport items), and on a
    phone a long-press anywhere on a blank Read view pastes the clipboard and renders it. A refused or
    empty clipboard falls back to Edit or the launch modal.
  - Phones: the floating status no longer sits over the first line of text. It fades after 2 s (was 3), and
    while the other sections render in the background there is no progress bar holding it up (the bar
    shows only when you are waiting on a section). New Full screen button in the header (corner-bracket
    icons, in and out), hidden where the browser has no Fullscreen API (iPhone).

----------------------------------------------------------------
1.9.1 - 27-Oct-2026 | Pick In Text, Paste, Full Screen, Phone Status
  - Release of the 1.9.0 follow-ups above: picking the section start in the text, Paste (menu and
    blank-view long-press), the Full screen button, the 2 s status fade and the (i) voice-modal layout.
    Version 1.9.1 in the HTML (every ?v=), the AppConfig and the service worker.
