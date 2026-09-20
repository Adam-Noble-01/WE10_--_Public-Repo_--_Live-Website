=================================================
CONSOLE IMAGE DOWNLOADER - Clipboard Utility
=================================================

DEVELOPMENT LOG

----------------------------------------------------------------
1.0.0 - 20-Sep-2026 |  First Build
  - Clipboard-only Mini App under 04_MiniApps__PhotoUtils.
  - One button copies a Homeflow carousel image-download snippet
    for pasting into the browser console on a listing page.
  - The page itself does not fetch or save photographs.
  - UI text, steps and notes live in AppConfig JSON.
  - The paste-ready payload is a standalone .js snippet file,
    fetched as text and copied as-is. Do not add a file header
    to that snippet — it would appear in the clipboard.


=================================================
FILE STRUCTURE
=================================================

    04_MiniApps__PhotoUtils/
    |
    +-- MiniApp__PhotoUtils__ConsoleImageDownloader__Main__.html
    +-- MiniApp__PhotoUtils__ConsoleImageDownloader__Style__.css
    +-- MiniApp__PhotoUtils__ConsoleImageDownloader__Main__.js
    +-- MiniApp__PhotoUtils__ConsoleImageDownloader__AppConfig__.json
    +-- MiniApp__PhotoUtils__ConsoleImageDownloader__Snippet__HomeflowCarousel__.js
    +-- DEVLOG__ConsoleImageDownloader.md
