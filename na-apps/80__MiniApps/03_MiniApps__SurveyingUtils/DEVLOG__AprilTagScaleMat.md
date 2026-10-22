=================================================
APRILTAG 36h11 SCALE MAT - RealityScan Calibration Sheet
=================================================

DEVELOPMENT LOG

----------------------------------------------------------------
1.0.0 - 20-Oct-2026 |  Mini App Port
  - Ported from a single-file Gemini prototype (inline CSS and JS) into the
    Mini App structure under 03_MiniApps__SurveyingUtils.
  - ES modules with AppConfig JSON as the single source of paper sizes,
    limits, warning text and titles.
  - The SVG preview and the jsPDF export now share one set-out
    (Layout) and one overlay placement function, so the screen and the PDF
    cannot drift apart.
  - Added an ID range warning: the built-in code table holds IDs 0 to 127,
    and IDs beyond it used to repeat the last code silently.
  - Behaviour otherwise unchanged from the prototype.


=================================================
FILE STRUCTURE
=================================================

    03_MiniApps__SurveyingUtils/
    |
    +-- MiniApp__SurveyingUtils__AprilTagScaleMat__Main__.html       Page shell
    +-- MiniApp__SurveyingUtils__AprilTagScaleMat__Style__.css       Styling and print rules
    +-- MiniApp__SurveyingUtils__AprilTagScaleMat__AppConfig__.json  Config and UI text
    +-- DEVLOG__AprilTagScaleMat.md                                  This file
    |
    +-- 01__AppModules/
          +-- ...__Main__.js        Controller - config load, events, bootstrap
          +-- ...__Settings__.js    Sidebar form to a clamped settings object
          +-- ...__Layout__.js      Tag set-out, CL/CL schedule, overlay placement
          +-- ...__TagCodes__.js    36h11 codeword table and 8x8 decoder
          +-- ...__SvgOverlays__.js Turntable, dimension lines, plaque, scale rule
          +-- ...__SvgTags__.js     Perimeter tag markup
          +-- ...__Preview__.js     Paints the SVG, warnings and schedule
          +-- ...__PdfExport__.js   1:1 vector PDF via jsPDF


=================================================
RELEASE CHECKLIST
=================================================

  - Set every ?v= in the HTML (stylesheet, import map, module script) and
    NaMiniApp__Version in the AppConfig to the new version.
  - Add the card to MiniApp__Index&Launcher__AppData__Config__.json.


=================================================
NOTES
=================================================

  - jsPDF 2.5.1 loads from cdnjs as a classic script (window.jspdf). Offline
    use needs the library vendored locally.
  - Marker family is AprilTag 36h11: 8x8 cells including a 1-cell black
    border, with a 1-cell white quiet zone either side. The black square size
    in the form is the 8-cell width.
  - The codeword table was ported unchanged. It has not been re-checked
    against the AprilRobotics reference in this port.
