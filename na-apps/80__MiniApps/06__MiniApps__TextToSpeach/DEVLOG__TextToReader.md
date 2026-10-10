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
          +-- ...__ReadAloud__.js       Speech, voice choice, sentence / word highlights
          +-- ...__ReadMenu__.js        Read view context menu, press and hold


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
