// =============================================================================
// TRUEVISION3D - PUBLISHED DOCUMENTS - POINT CLOUD STRENGTH
// =============================================================================
//
// FILE       : Na__PubDoc__PointCloud__.js
// NAMESPACE  : Na__PubPc
// MODULE     : Published Documents - Point Cloud Strength
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Hold how strongly a reader is shown a drawing's point clouds, and turn that one level into every viewport's opacity
// SCHEMA REF : na-project-portal/26-Projects/AA00__ExampleProjectStructure/
//              30__TrueVision__AppContent/06__Layout__PublishedDocuments
//              ^ The readable schema. CHANGE A KEY HERE, CHANGE IT THERE.
// CREATED    : 19-Oct-2026
//
// DESCRIPTION:
// - ONE LEVEL PER DRAWING, EVERY POINT CLOUD ON IT IN TANDEM. Adam: "All of
//   them are moved up and down in tandem per page with the user's slider, so
//   the user can see what the bare model looks like or they can see what the
//   full opaque viewport point cloud looks like." A drawing's point clouds
//   can each have their own opacity, so the level is not an opacity: it is a
//   position on one track whose ends are none (the bare drawing) and full
//   (every point cloud opaque), and whose HOME is the drawing as issued.
// - HOME IS THE DRAWING AS ISSUED. It sits at the mean of the drawing's own
//   opacities, as a whole percentage, and at home every viewport shows its
//   own opacity exactly. Below home each one fades in proportion towards
//   none; above it each one rises in proportion towards full. With equal
//   opacities, as on most drawings, the level IS the opacity on screen.
// - A POST EFFECT ON SCREEN, AND NOTHING ELSE. The level only moves the
//   opacity of the published point cloud pictures (Na__PubDoc__Viewports__
//   paints them with their own opacity in data-na-pc-base). It is never
//   saved, never sent and never printed: the PDF was baked at publish with
//   the drawing's own opacities, and the stylesheet puts them back for a
//   printed page. It is held for the session, per drawing, so a reader
//   coming back to a drawing finds it as they left it.
//
// INTEGRATION:
// - Na__PubDoc__Document__ registers each published drawing's point clouds
//   as it builds it and hands the painter OpacityFor; the web viewer's dock
//   (80__Feature__WebViewer) reads Summary and moves the level.
// - No imports. A leaf, so it can be tested with nothing loaded.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Oct-2026 - Version 1.0.0
// - Created for the client's point cloud slider (TrueVision3D v2.176.0).
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    const Na__PubPc__CLASS     = 'na-pubdoc__viewport-pointcloud';               // <-- Every published point cloud picture carries it
    const Na__PubPc__BASE_ATTR = 'data-na-pc-base';                              // <-- ...and its viewport's own opacity
    const Na__PubPc__Pages     = new Map();                                      // <-- documentId -> { Count, Home, Level, Key }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Numbers
// -----------------------------------------------------------------------------

    // FUNCTION | A Value Between 0 and 1 (fallback when it is not a number)
    // ------------------------------------------------------------
    function Na__PubPc__Unit(value, fallback) {
        const number = Number(value);
        if (!Number.isFinite(number)) return (fallback === undefined) ? 1 : fallback;
        return Math.max(0, Math.min(1, number));
    }
    // ------------------------------------------------------------


    // FUNCTION | A Level as a Whole Percentage, 0 to 100
    // ------------------------------------------------------------
    function Na__PubPc__Percent(level) {
        return Math.round(Na__PubPc__Unit(level, 0) * 100);
    }
    // ------------------------------------------------------------


    // FUNCTION | One Viewport's Opacity at a Level, Given Its Own Opacity and the Drawing's Home
    // ------------------------------------------------------------
    // At home: its own opacity, exactly. Below: in proportion towards none.
    // Above: in proportion towards full. 0 is always none and 1 always full.
    // ------------------------------------------------------------
    function Na__PubPc__Mix(base, level, home) {
        const b = Na__PubPc__Unit(base, 1);
        const l = Na__PubPc__Unit(level, b);
        const h = Na__PubPc__Unit(home, b);
        if (l === h) return b;
        if (l < h) return h > 0 ? b * (l / h) : 0;
        return h < 1 ? b + ((1 - b) * ((l - h) / (1 - h))) : 1;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | One Drawing's Level
// -----------------------------------------------------------------------------

    // FUNCTION | Record a Published Drawing's Point Clouds (its viewports' own opacities)
    // ------------------------------------------------------------
    // Called as the drawing is built. A level the reader set this session is
    // kept while the drawing is the same one; a re-published drawing with
    // other point clouds starts again at its new home. Returns Summary.
    // ------------------------------------------------------------
    function Na__PubPc__Register(documentId, bases) {
        const list = (Array.isArray(bases) ? bases : []).map((one) => Na__PubPc__Unit(one, 1));
        if (!documentId) return null;
        if (list.length === 0) { Na__PubPc__Pages.delete(documentId); return null; }
        const home = Math.round((list.reduce((sum, one) => sum + one, 0) / list.length) * 100) / 100;
        const key  = list.join(',');
        const held = Na__PubPc__Pages.get(documentId);
        if (!held || held.Key !== key) {
            Na__PubPc__Pages.set(documentId, { Count : list.length, Home : home, Level : home, Key : key });
        }
        return Na__PubPc__Summary(documentId);
    }
    // ------------------------------------------------------------


    // FUNCTION | A Drawing's Point Clouds as the Dock Shows Them (null when it has none)
    // ------------------------------------------------------------
    // { Count, Home, Level, HomePercent, LevelPercent, AtHome }
    // ------------------------------------------------------------
    function Na__PubPc__Summary(documentId) {
        const held = Na__PubPc__Pages.get(documentId);
        if (!held) return null;
        return {
            Count        : held.Count,
            Home         : held.Home,
            Level        : held.Level,
            HomePercent  : Na__PubPc__Percent(held.Home),
            LevelPercent : Na__PubPc__Percent(held.Level),
            AtHome       : held.Level === held.Home
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Opacity a Point Cloud Picture of a Drawing Is Shown At Now
    // ------------------------------------------------------------
    function Na__PubPc__OpacityFor(documentId, base) {
        const held = Na__PubPc__Pages.get(documentId);
        return held ? Na__PubPc__Mix(base, held.Level, held.Home) : Na__PubPc__Unit(base, 1);
    }
    // ------------------------------------------------------------


    // FUNCTION | Move a Drawing's Level (0 to 1, kept to whole percentages); returns Summary
    // ------------------------------------------------------------
    function Na__PubPc__SetLevel(documentId, level) {
        const held = Na__PubPc__Pages.get(documentId);
        if (!held) return null;
        const number = Number(level);
        if (Number.isFinite(number)) held.Level = Math.round(Na__PubPc__Unit(number, held.Level) * 100) / 100;
        return Na__PubPc__Summary(documentId);
    }
    // ------------------------------------------------------------


    // FUNCTION | Put a Drawing Back as Issued; returns Summary
    // ------------------------------------------------------------
    function Na__PubPc__Reset(documentId) {
        const held = Na__PubPc__Pages.get(documentId);
        if (!held) return null;
        held.Level = held.Home;
        return Na__PubPc__Summary(documentId);
    }
    // ------------------------------------------------------------


    // FUNCTION | Show Every Point Cloud Picture Inside an Element at Its Drawing's Level Now
    // ------------------------------------------------------------
    // A handful of style writes, so it runs on every movement of the slider.
    // Returns how many pictures it set.
    // ------------------------------------------------------------
    function Na__PubPc__Apply(container, documentId) {
        if (!container || typeof container.querySelectorAll !== 'function') return 0;
        let count = 0;
        container.querySelectorAll('.' + Na__PubPc__CLASS).forEach((element) => {
            const base = Number(element.getAttribute(Na__PubPc__BASE_ATTR));
            const opacity = Na__PubPc__OpacityFor(documentId, Number.isFinite(base) ? base : 1);
            element.style.opacity = String(Math.round(opacity * 10000) / 10000);
            count += 1;
        });
        return count;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    export {
        Na__PubPc__CLASS,
        Na__PubPc__BASE_ATTR,
        Na__PubPc__Unit,
        Na__PubPc__Percent,
        Na__PubPc__Mix,
        Na__PubPc__Register,
        Na__PubPc__Summary,
        Na__PubPc__OpacityFor,
        Na__PubPc__SetLevel,
        Na__PubPc__Reset,
        Na__PubPc__Apply
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
