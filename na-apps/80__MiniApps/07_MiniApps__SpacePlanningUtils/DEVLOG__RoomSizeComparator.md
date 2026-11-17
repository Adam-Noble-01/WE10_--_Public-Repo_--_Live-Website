=================================================
ROOM SIZE COMPARATOR - Typical UK Room Areas, To Scale
=================================================

DEVELOPMENT LOG

----------------------------------------------------------------
1.0.0 - 16-Nov-2026 |  First Release
  - New category folder 07_MiniApps__SpacePlanningUtils; card 11 on the Mini
    Apps launcher.
  - Type a room's area, or its length and width, in m² or ft². The m² / ft²
    switch flips everything (inputs, drawing, tables, chart) without losing
    the value: sizes are stored in metres and only shown in the chosen unit.
    Imperial lengths take feet and inches (12'6"); metric lengths of 100 or
    more, or ending "mm", are read as millimetres (3600 = 3.6 m). A number that
    only makes sense in the other unit gets a "Did you mean ... ft²?" hint.
  - Compare: the room type's five bands (Min, Small, Medium, Large, O/S) drawn
    to scale as nested boxes from a shared corner, on a grid with a scale bar;
    your room on top as an orange outline with architectural dimension lines;
    a furniture piece for scale (double bed, bath, 7 ft pool table, the 1500 mm
    wheelchair turning circle...). Band labels that would collide are dropped
    rather than overlapped (the table beside it has every figure).
  - Beside it: a verdict ("About Medium", "Below minimum" with the reason),
    how far from the bands either side, % of a typical (Medium) room, a
    one-line band strip, and the band table with your room slotted in by size.
  - All Rooms: every room type on one scale, its bands as dots, your area as a
    line through them all, and its band for each room type. Click a row to
    compare it. Search and sort by typical size.
  - Data & Sources: method, what was cleaned, every figure with what changed
    from the sheet, evidence rating, and numbered sources per room. Copies to
    the clipboard as a table that pastes straight into Google Sheets.
  - Save image: the drawing as a 2× PNG with a title strip, for client emails.
    Copy link: the address keeps room, size and units, so a link reopens the
    same comparison. Units, last room and the furniture switch are remembered
    on the device (localStorage, optional).
  - Colours: the five bands are an ordinal one-hue blue ramp, validated with
    the dataviz palette validator (--ordinal, white surface: monotone, adjacent
    dL >= 0.06, light end 2.11:1). Your room is orange (3.2:1 on white). Text
    never wears a data colour.

----------------------------------------------------------------
DATA - 16-Nov-2026 |  Clean-Up And Validation Of The Sheet
  - Source: the room size Google Sheet pasted 16-Nov-2026 (sheet log:
    18-Jul-2023, bedroom with fitted wardrobes added). 56 rows, 55 with figures.
  - Cleaned: blank rows and columns and the Updates footer removed; the
    Bedroom Suite and Granny Annex headings became groups; every room put in
    one of 11 groups. Units were not stated: square metres.
  - Merged 4 duplicate pairs (the other name kept as an alias): Walk-in Closet
    into Walk-in Wardrobe, Mudroom into Boot Room, Study/Office + Home Office
    into Study / Home Office, Home Theater into Home Cinema. Atrium kept but
    left out of comparisons: no figures in the sheet, none published.
  - Checked by research agents against published sources (UK first), then a
    link check of every URL: dead pages removed, redirects updated.
    Result: 181 sources (133 UK, 118 read in full, the rest seen in search
    results), 254 citations, 3-7 per room (median 5). Every comparable room
    has 4 or more except Library (3: no more published figures found).
    Evidence ratings: High 3, Medium 32, Low 16. Link check 16-Nov-2026: 170
    load, 11 refuse automated requests (403/429) but open in a browser, 0 dead.
  - Values changed only where a UK standard sets a higher floor or the room is
    sized by equipment that several makers document; everywhere else the
    sheet stands, with notes. The sheet's values are kept beside each change
    (NaRoom__OriginalAreas, NaRoom__MergedRows).
      Bedroom, Guest Room, Nursery   Min 7 -> 7.5     (NDSS single bedroom)
      Bedroom with Fitted Wardrobes  Min 6 -> 7.5     (NDSS counts the wardrobe in the area)
      Principal Suite Bedroom        Min 9 -> 11.5    (NDSS double)
      Annexe Bedroom                 Min 9 -> 11.5    (NDSS double)
      Annexe Accessible Bathroom     3/4/5/7/10 -> 5/6/7/8/10   (1500 mm turning circle; M4(3) examples 5.4-6.8 m²)
      Home Sauna                     4/6/8/10/15 -> 1.5/2.5/4/6/8  (cabins sized by bathers)
      Home Cinema                    9/12/16/20/25 -> 11/14/20/28/36  (seat rows, THX room sizes)
      Billiards Room                 10/12/15/18/25 -> 13/19/23/28/33  (table + cue swing, 3 UK makers)
      Sunroom / Conservatory         Medium 10 -> 12, Large 12 -> 16, O/S 15 -> 20  (UK supplier sizes)
      Greenhouse                     5/8/10/12/15 -> 3/5/8/11/15  (sizes sold: 6x8 ft most popular)

----------------------------------------------------------------
TESTS
  - 04__Testing/MiniApp__SpacePlanningUtils__RoomSizeComparator__Logic__Test__.mjs
    (node, no browser): unit parsing and formatting, round trips, area
    classification, data integrity, and that every one of the 56 sheet rows
    appears exactly once with its original values.
      node "na-apps/80__MiniApps/07_MiniApps__SpacePlanningUtils/04__Testing/MiniApp__SpacePlanningUtils__RoomSizeComparator__Logic__Test__.mjs"


=================================================
FILE STRUCTURE
=================================================

    07_MiniApps__SpacePlanningUtils/
    |
    +-- MiniApp__SpacePlanningUtils__RoomSizeComparator__Main__.html       Page shell
    +-- MiniApp__SpacePlanningUtils__RoomSizeComparator__Style__.css       Styles (on AD02_30)
    +-- MiniApp__SpacePlanningUtils__RoomSizeComparator__AppConfig__.json  Config, colours, UI text
    +-- DEVLOG__RoomSizeComparator.md                                      This file
    |
    +-- 01__AppModules/
    |     +-- ...__Main__.js          Controller - config, state, events, bootstrap
    |     +-- ...__Units__.js         m² / ft² maths, parsing, formatting
    |     +-- ...__RoomData__.js      Data load, groups, sources, classify an area
    |     +-- ...__PlanDrawing__.js   To-scale SVG drawing, PNG export
    |     +-- ...__CompareView__.js   Verdict, band strip, band table, notes
    |     +-- ...__AllRoomsView__.js  Every room type on one scale
    |     +-- ...__DataView__.js      Figures, changes, sources, copy for Sheets
    |     +-- ...__UrlState__.js      Shareable link, remembered preferences
    |
    +-- 02__AppData/
    |     +-- RoomSizeComparator__RoomSizeData__UK__.json   Rooms, bands, sources
    |
    +-- 04__Testing/
          +-- ...__Logic__Test__.mjs  Node tests


=================================================
RELEASE CHECKLIST
=================================================

  - Set every ?v= in the HTML (stylesheet, import map, module script) and
    NaMiniApp__Version in the AppConfig to the new version.
  - Run the node tests.
  - Data changes: edit 02__AppData/...__RoomSizeData__UK__.json; keep areas
    rising strictly; record the sheet value in NaRoom__OriginalAreas and set
    NaRoom__Status to "Adjusted" when a figure moves.


=================================================
NOTES
=================================================

  - Band boxes are drawn at each room type's typical plan shape
    (NaRoom__Aspect, long side ÷ short side); only their areas come from the
    data. Your room uses its own length and width when given.
  - Sources marked "Search result" were seen in search results but not read in
    full; "Read in full" pages were opened. Eleven publishers block automated
    checks (403/429) but load in a browser.
  - Ideas not built: open-plan kitchen / living / dining, WC / cloakroom,
    entrance hall and garage rows (common UK rooms missing from the sheet);
    whole-suite and whole-annexe totals.
