=================================================
AI PROMPT LIBRARY - Prompt Storage And Retrieval
=================================================

DEVELOPMENT LOG

----------------------------------------------------------------
1.0.0 - 26-Aug-2026 |  First Build
  - Modular HTML / CSS / JS mini app under 05_MiniApps__AiUtils.
  - Every prompt is a standalone JSON record file, listed in a manifest.
  - Taxonomy, snippet blocks and all UI text held in data files.
  - Double brace token system with a compose form and live preview.
  - Weighted search with inline #keyword, @model and !fav operators.
  - Data store abstraction ready for the Raspberry Pi prompt server.
  - Seeded with three working image generation prompts and five snippets.


=================================================
FILE STRUCTURE
=================================================

    05_MiniApps__AiUtils/
    |
    +-- MiniApp__AiUtils__PromptLibrary__Main__.html        Page shell
    +-- MiniApp__AiUtils__PromptLibrary__Style__.css        Styling
    +-- MiniApp__AiUtils__PromptLibrary__AppConfig__.json   Config and UI text
    +-- DEVLOG__AiPromptLibrary.md                          This file
    |
    +-- 01__AppModules/
    |     +-- ...__Main__.js            Controller - state, events, refresh cycle
    |     +-- ...__DataStore__.js       Loading, overlay, journal, API adapter
    |     +-- ...__SearchEngine__.js    Query parsing, weighting, filtering
    |     +-- ...__PromptCompose__.js   Token parsing, composition, clipboard
    |     +-- ...__UiRender__.js        All DOM construction
    |     +-- ...__PromptEditor__.js    Add and edit modal
    |
    +-- 02__AppData/
          +-- PromptLibrary__TaxonomyIndex__.json    Categories, models, statuses
          +-- PromptLibrary__PromptIndex__.json      Record manifest + schema template
          +-- PromptLibrary__SnippetLibrary__.json   Reusable prompt blocks
          +-- 03__PromptRecords/
                +-- PromptRecord__*.json             One file per prompt


=================================================
ADDING A PROMPT BY HAND
=================================================

  1. Copy the PromptIndex__RecordSchema__Template block out of
     PromptLibrary__PromptIndex__.json into a new file inside
     02__AppData/03__PromptRecords/.

  2. Name the file:
     PromptRecord__<Category>__<SubCategory>__<ShortName>__.json

  3. Write the prompt body as an ARRAY OF LINES, not one long string.
     An empty string produces a blank line. This keeps the data file
     readable and the git diffs sane.

  4. Mark anything that changes job to job with a double brace token,
     for example {{BuildingMaterials}}, and declare it in the
     PromptRecord__Variables array.

  5. Add one entry to PromptIndex__Records pointing at the new file.

  Nothing else needs touching. The category, sub category, model target
  and status values must exist in PromptLibrary__TaxonomyIndex__.json.


=================================================
THE TOKEN SYSTEM
=================================================

  Tokens are written {{TokenName}} - letters, numbers and underscores only.

  A token may appear as many times as needed in one body and is filled from
  a single entry on the compose form. The isolated object whitecard prompt
  uses this - height, width and depth each appear twice, once in the
  specification block and once on a dimension line.

  Every variable carries a default value. Set the default to the proven
  original wording and an untouched form composes the known good prompt
  verbatim - the form only ever costs you time when you want it to.

  Variable__OmitLineIfEmpty drops the whole line from the output when the
  field is left blank. Useful for optional clauses.

  Variable__InputType accepts Text, TextArea, Select, Number or Toggle.

  Scan Body For Tokens in the editor reconciles the declared field list
  against the tokens actually present in the body. Tokens with no
  declaration are added; declarations whose token has gone are kept and
  flagged rather than silently dropped.


=================================================
LOCAL MODE AND THE EXPORT WORKFLOW
=================================================

  With no server answering, the app runs off the static JSON files and holds
  every edit in browser storage under NaAiPromptLibrary__LocalOverlay__v1.

  The status pill reads "Local mode" and counts unsynced changes.

  To get browser edits back into the repo:

    Download JSON      on a single prompt - produces the exact record file,
                       correctly named, ready to drop into 03__PromptRecords/
                       and add to the manifest.

    Export Changes     bundles only the records edited in this browser.

    Export Library     bundles the whole library.

  Import merges a bundle back in. It accepts either an exported bundle or a
  bare array of record objects.


=================================================
PROMPT SERVER API CONTRACT
=================================================

  Point NaMiniApp__ApiBaseUrl at the Pi and set NaMiniApp__ConnectionMode to
  Auto. That is the whole switch-over. ConnectionMode accepts:

    StaticOnly  never contact the server - SHIPS AS THIS, no Pi yet
    Auto        ping the health path on boot, fall back to static files
    ApiOnly     server intended, still falls back if it does not answer

  Endpoints, all relative to NaMiniApp__ApiBaseUrl:

    GET     /health              200 with any JSON body - used as the probe
    GET     /prompts             { "prompts": [ <record>, ... ] } or a bare array
    PUT     /prompts/{id}        body is one <record>; 200 or 204 on success
    DELETE  /prompts/{id}        200 or 204 on success
    GET     /taxonomy            reserved - not yet consumed
    GET     /snippets            reserved - not yet consumed

  <record> is exactly the on-disk record file structure - the four blocks
  PromptRecord__Meta, PromptRecord__Body, PromptRecord__Variables and
  PromptRecord__Usage. The server can store the files verbatim.

  Optional auth: set NaMiniApp__ApiAuthHeader and NaMiniApp__ApiAuthToken
  and the header is attached to every call.

  Requests abort after NaMiniApp__ApiTimeoutMs so a sleeping Pi never hangs
  the interface.

  WRITE JOURNAL
  Every write made while offline is appended to Overlay__PendingOperations
  as { Operation__Type, Operation__RecordId, Operation__Timestamp,
  Operation__Payload }. Repeat edits of one record collapse to a single
  entry. Pressing Sync re-probes the server and replays the journal in
  order, stopping at the first failure and keeping the remainder. If the
  server drops mid session the app silently reverts to local mode rather
  than losing the write.

  CORS
  The Pi must return Access-Control-Allow-Origin for the site origin, and
  allow the PUT and DELETE methods plus the Content-Type header.


=================================================
KEYBOARD SHORTCUTS
=================================================

  Ctrl + K          Jump to search
  Arrow Up / Down   Move through the result list
  Enter             Open the highlighted prompt
  Ctrl + Enter      Copy the composed prompt
  Alt + N           New prompt
  Alt + E           Edit the open prompt
  Alt + F           Toggle favourite
  Escape            Close the editor, then clear the search box

  Search operators:

  #keyword          restrict to prompts carrying that keyword
  @model            restrict to a model target
  !fav              favourites only
  !draft            drafts only
  !archived         include archived prompts
  "exact phrase"    phrase match


=================================================
NOTES
=================================================

  - The app fetches JSON, so it must be served over http. Opening the HTML
    straight off disk will fail on the file:// origin. Use
    SimpleSever__LaunchLocalHost__.ps1 in the parent folder, but pass a port
    other than 8080 on this machine - 8080 is taken by NVIDIA Broadcast.

  - Usage counts and last-used timestamps are held locally only until the
    server exists. They drive the Most Used and Recently Used sort modes.

  - Categories are data. Deleting a category from the taxonomy file removes
    it from the rail. CodeAndAutomation and ResearchAndAnalysis were added
    beyond the three originally asked for - remove them if they are noise.
