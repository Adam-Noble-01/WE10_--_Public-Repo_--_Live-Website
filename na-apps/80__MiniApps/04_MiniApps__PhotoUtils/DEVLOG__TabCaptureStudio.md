=================================================
TAB CAPTURE STUDIO - Framed Image Capture From A Browser Tab
=================================================

DEVELOPMENT LOG

----------------------------------------------------------------
1.0.1 - 12-Nov-2026 |  Images Saved At 5%
  - Fix: Output size read a <select>'s min / max properties, which do not
    exist, so Scale became NaN, was saved as null, and the worker clamped it
    to its 5% floor (5406 px frames saved 270 px wide). The form now reads
    the min / max attributes; saved settings of the wrong type fall back to
    the default; the worker treats a bad Scale as 100%.
  - Fix: the width / height max constraint made Chrome upscale the tab to
    fit it (a 3828 px wide tab came in at 7656 px). Capture now asks for
    resizeMode "none", the tab's own pixel size.
  - The source label reads "Shared browser tab" instead of Chrome's
    internal web-contents-media-stream id.

----------------------------------------------------------------
1.0.0 - 12-Nov-2026 |  First Build
  - Shares one browser tab (getDisplayMedia, tab preferred, this app's own
    tab hidden from the picker, "Share this tab instead" allowed) at native
    resolution (max 7680 x 4320 constraint, no upscaling).
  - Live view with a capture frame: move, resize from eight handles, draw a
    new one, arrow key nudges, aspect lock (free, lock current, 1:1, 4:3,
    3:2, 16:9, 21:9), X / Y / W / H in source pixels, Whole tab, Centre 80%
    and Centre frame presets, thirds grid, output size 100 / 75 / 50 / 25%.
  - Modes:
      Timed      every N seconds; optionally skips images whose view has
                 not changed since the last one.
      On change  captures when the framed view differs from the last saved
                 image by a set percent of pixels (per pixel tolerance), and
                 by default waits until the view has been still for a set
                 time (tiles loaded), with a give up time and a minimum gap.
      Manual     Capture now only.
    The first image is taken straight away in Timed and On change.
  - Live meters: change since the last image (with the trigger mark) and
    movement, plus Reset reference.
  - Floating control window (Document Picture-in-Picture): REC / paused /
    countdown state, timer, count, live view of the framed region or the
    frame editor, change meter or next image countdown, last thumbnail,
    flash on capture, Pause / Resume, Capture now, Stop and save. Space
    captures and P pauses while it has focus.
  - Output: JPEG (default 95%), PNG or WebP; set name prefix; start delay;
    stop after N images or N minutes; optional shutter click.
  - Saving: a zip downloads as soon as the run stops (CaptureLog.csv and
    CaptureSettings.json included), split into parts under 1.9 GB; or each
    image is written to a chosen folder as it is captured (subfolder per
    set by default). Click a filmstrip image to leave it out of the zip.


=================================================
FILE STRUCTURE
=================================================

    04_MiniApps__PhotoUtils/
    |
    +-- MiniApp__PhotoUtils__TabCaptureStudio__Main__.html       Page shell
    +-- MiniApp__PhotoUtils__TabCaptureStudio__Style__.css       Page and floating window styles
    +-- MiniApp__PhotoUtils__TabCaptureStudio__AppConfig__.json  Defaults, limits, UI text
    +-- DEVLOG__TabCaptureStudio.md                              This file
    |
    +-- 01__AppModules/
          +-- ...__TabCaptureStudio__Main__.js          Controller: settings, sharing, run control, saving
          +-- ...__TabCaptureStudio__Worker__.js        Frame reader, change analysis, triggers, encoder, CRC32
          +-- ...__TabCaptureStudio__RegionEditor__.js  Live view and capture frame editor
          +-- ...__TabCaptureStudio__Overlay__.js       Floating control window
          +-- ...__TabCaptureStudio__ZipWriter__.js     Stored zip from Blob parts


=================================================
RELEASE CHECKLIST
=================================================

  - Set every ?v= in the HTML (stylesheet, import map, module script) and
    NaMiniApp__Version in the AppConfig to the new version. The worker URL
    is built from NaMiniApp__Version (import maps do not reach workers).
  - The launcher card is MiniApp__TabCaptureStudio_10 in
    MiniApp__Index&Launcher__AppData__Config__.json.


=================================================
NOTES
=================================================

  - Edge or Chrome 116+ on a desktop. Needs getDisplayMedia,
    MediaStreamTrackProcessor, OffscreenCanvas and module workers; the
    floating window needs Document Picture-in-Picture.
  - Frames are read and judged in the worker. While you work in the
    captured tab this page is hidden and its timers are throttled; the
    worker's are not, so timing holds in the background.
  - Change percent: the framed view is scaled to 160 px wide greyscale;
    a pixel counts as changed when it differs by more than the tolerance
    (percent of full brightness). Movement uses the same test between
    consecutive checks; under 0.5% counts as still.
  - Tab capture holds only the tab's pixels: the floating window never
    shows in the images. The mouse pointer does when it is over the frame.
    Chrome hides it about two seconds after it stops moving, so a Still
    for of about 2500 ms, keyboard orbiting or the Maps rotate buttons
    keep it out.
  - Changing the frame mid-run changes the image size from that image on.
  - Zip mode keeps images as Blobs (the browser can page them to disk);
    folder mode lets each Blob go once written, for very long runs.
  - Not yet run in a browser at the time of this entry.
