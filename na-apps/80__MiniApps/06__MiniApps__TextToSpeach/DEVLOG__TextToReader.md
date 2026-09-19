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


=================================================
FILE STRUCTURE
=================================================

    06__MiniApps__TextToSpeach/
    |
    +-- MiniApp__TextToReader__Main__.html          Page shell
    +-- MiniApp__TextToReader__Style__.css          App-specific styles
    +-- MiniApp__TextToReader__AppConfig__.json     Config and UI text
    +-- DEVLOG__TextToReader.md                     This file
    |
    +-- 01__AppModules/
          +-- ...__Main__.js            Controller - DOM, events, bootstrap
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
