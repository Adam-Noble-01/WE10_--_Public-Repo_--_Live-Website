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
