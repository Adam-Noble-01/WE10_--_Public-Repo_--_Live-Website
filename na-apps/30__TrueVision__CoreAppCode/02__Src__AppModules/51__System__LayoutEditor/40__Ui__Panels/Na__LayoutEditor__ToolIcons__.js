// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - TOOL ICONS
// =============================================================================
//
// FILE       : Na__LayoutEditor__ToolIcons__.js
// NAMESPACE  : Na__LeIcon
// MODULE     : Layout Editor - Tool Icons
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : One door to the Layout Editor's tool icons: the file for a name, and the
//              element that draws it in the button's own colour
// CREATED    : 26-Nov-2026
//
// DESCRIPTION:
// - WHY ICONS. Adam, 26-Nov-2026: "removing text based tooling replacing with svg icons and
//   hover over tooltips ... Aim reduce overwheling cluttler of Layout Editor". The words a
//   button used to show are now its aria-label and the name in its tooltip
//   (Na__LayoutEditor__ToolTip__.js), so nothing that found a button by name is lost.
// - ONE FILE PER ICON, in the house line style (1024 artboard, 64 strokes, round caps), named
//   Icon__LayoutEditor__<Name>__.svg in the app's UiIcons__MenuIcons__LayoutEditor folder.
// - DRAWN AS A CSS MASK over currentColor, never as an <img>: the button's own colour paints
//   the icon, so one file serves idle, hover, lit and disabled, and the stroke colour written
//   in the file never matters (contract section 3).
// - AN ICON NOT YET ON DISK SHOWS ITS SHORT WORD instead (as IdeaSpace's toolbar does), found
//   by a one-off probe of the file per name, so a missing file never leaves a blank button.
// - THE STYLESHEET (Na__LayoutEditor__Styles__ToolIcons__.css, beside this file) is linked on
//   first use, as the Vector Tools panel links its own: nothing else needs to load it.
//
// INTEGRATION:
// - Used by Na__LayoutEditor__Toolbar__.js, Na__LayoutEditor__Panel__VectorTools__.js and
//   Na__LayoutEditor__ToolTip__.js (the (i) beside a panel heading).
// - ValeVision3D has the same file (contract section 4): only the banner and
//   Na__LeIcon__ASSET_FOLDER differ.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 02__Src__AppModules/51__System__LayoutEditor/40__Ui__Panels/Na__LayoutEditor__ToolIcons__.js
// - Source version: 0.0.5 (26-Nov-2026, uncommitted when copied)
// - Divergences   : the banner, the log's app version and the app's asset folder only.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 26-Nov-2026 - Version 0.0.5 (TrueVision3D v2.189.9)
// - The top tabs' five icons join the table (Model3d, Drawings,
//   Specification, DocumentRegister, DesignStatements; DROP 5, contract
//   v0.0.8 to v0.0.10): 61 names.
//
// 26-Nov-2026 - Version 0.0.4 (TrueVision3D v2.189.9)
// - The table takes DROP 4's own names (SitePlan, ParametricScrapbook,
//   SpecificationScrapbook) and TrueVision's two section icons, PointCloud
//   and SceneSync, so both apps' tables list the same 56 names.
//
// 26-Nov-2026 - Version 0.0.3 (TrueVision3D v2.189.9)
// - The section headers' fifteen icons join the table, for PanelHost's
//   SECTION_ICONS (contract v0.0.6).
//
// 26-Nov-2026 - Version 0.0.2 (TrueVision3D v2.189.9)
// - One literal relative path per icon (Na__LeIcon__FILES, 39 names) in place of a
//   folder joined to a name, so IdeaSpace's mirror of TrueVision's twin copies the
//   SVGs too (contract v0.0.3). Url answers '' for a name the table lacks.
//
// 26-Nov-2026 - Version 0.0.1 (TrueVision3D v2.189.9)
// - Initial build: Url, Make, Put and the stylesheet link.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Where the Icons Are: One Literal Path per Icon
    // ------------------------------------------------------------
    // ONE LITERAL STRING PER ICON, never a folder joined to a name (contract
    // v0.0.3, 26-Nov-2026): IdeaSpace mirrors TrueVision's twin of this file
    // read-only, and its sync copies only the assets a reached module names in
    // a './' or '../' string literal (RE_ASSET_STR in
    // Ids__BuildUtil__SyncTrueVisionTools__.py). The folder is the app's own,
    // three folders up from this file (02__Src__AppModules / 51 / 40).
    // TrueVision's twin differs in that folder segment and its banner only.
    // A name not in this table shows its fallback word.
    // ------------------------------------------------------------
    const Na__LeIcon__ASSET_FOLDER = '01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/';
    const Na__LeIcon__FILES        = {
        Select                 : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__Select__.svg', import.meta.url),
        Move                   : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__Move__.svg', import.meta.url),
        Text                   : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__Text__.svg', import.meta.url),
        Leader                 : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__Leader__.svg', import.meta.url),
        Dimension              : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__Dimension__.svg', import.meta.url),
        Rectangle              : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__Rectangle__.svg', import.meta.url),
        Draw                   : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__Draw__.svg', import.meta.url),
        Line                   : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__Line__.svg', import.meta.url),
        Eyedropper             : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__Eyedropper__.svg', import.meta.url),
        Circle                 : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__Circle__.svg', import.meta.url),
        Arc                    : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__Arc__.svg', import.meta.url),
        Image                  : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__Image__.svg', import.meta.url),
        Trim                   : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__Trim__.svg', import.meta.url),
        Extend                 : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__Extend__.svg', import.meta.url),
        Join                   : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__Join__.svg', import.meta.url),
        Split                  : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__Split__.svg', import.meta.url),
        Offset                 : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__Offset__.svg', import.meta.url),
        Fillet                 : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__Fillet__.svg', import.meta.url),
        Chamfer                : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__Chamfer__.svg', import.meta.url),
        Snap                   : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__Snap__.svg', import.meta.url),
        SnapOptions            : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__SnapOptions__.svg', import.meta.url),
        Draft                  : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__Draft__.svg', import.meta.url),
        Grid                   : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__Grid__.svg', import.meta.url),
        GridSnap               : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__GridSnap__.svg', import.meta.url),
        Ortho                  : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__Ortho__.svg', import.meta.url),
        Axes                   : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__Axes__.svg', import.meta.url),
        Raster                 : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__Raster__.svg', import.meta.url),
        VectorQuality          : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__VectorQuality__.svg', import.meta.url),
        SaveSheets             : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__SaveSheets__.svg', import.meta.url),
        DownloadPdf            : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__DownloadPdf__.svg', import.meta.url),
        Share                  : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__Share__.svg', import.meta.url),
        FloorArea              : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__FloorArea__.svg', import.meta.url),
        Union                  : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__Union__.svg', import.meta.url),
        Subtract               : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__Subtract__.svg', import.meta.url),
        BooleanTrim            : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__BooleanTrim__.svg', import.meta.url),
        Intersect              : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__Intersect__.svg', import.meta.url),
        BooleanSplit           : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__BooleanSplit__.svg', import.meta.url),
        OuterShell             : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__OuterShell__.svg', import.meta.url),
        Info                   : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__Info__.svg', import.meta.url),
        // THE SECTION HEADERS' OWN (contract v0.0.6; PointCloud and SceneSync are TrueVision's sections): the rest reuse a tool's icon above.
        Sheet                  : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__Sheet__.svg', import.meta.url),
        Layers                 : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__Layers__.svg', import.meta.url),
        RenderComposites       : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__RenderComposites__.svg', import.meta.url),
        ModelLayers            : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__ModelLayers__.svg', import.meta.url),
        SitePlan               : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__SitePlan__.svg', import.meta.url),
        MarginNotes            : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__MarginNotes__.svg', import.meta.url),
        Viewport               : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__Viewport__.svg', import.meta.url),
        Vectors                : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__Vectors__.svg', import.meta.url),
        VectorTools            : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__VectorTools__.svg', import.meta.url),
        Patterns               : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__Patterns__.svg', import.meta.url),
        ParametricElement      : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__ParametricElement__.svg', import.meta.url),
        Scrapbook              : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__Scrapbook__.svg', import.meta.url),
        ScrapbookCustom        : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__ScrapbookCustom__.svg', import.meta.url),
        ParametricScrapbook    : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__ParametricScrapbook__.svg', import.meta.url),
        SpecificationScrapbook : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__SpecificationScrapbook__.svg', import.meta.url),
        PointCloud             : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__PointCloud__.svg', import.meta.url),
        SceneSync              : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__SceneSync__.svg', import.meta.url),
        // THE TOP TABS' (contract v0.0.8): 3D Model, Drawings (the Tools menu's set square at this weight), Specification, Document Register, Design Statements.
        Model3d                : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__Model3d__.svg', import.meta.url),
        Drawings               : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__Drawings__.svg', import.meta.url),
        Specification          : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__Specification__.svg', import.meta.url),
        DocumentRegister       : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__DocumentRegister__.svg', import.meta.url),
        DesignStatements       : new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__LayoutEditor/Icon__LayoutEditor__DesignStatements__.svg', import.meta.url)
    };
    const Na__LeIcon__STYLES_URL   = new URL('./Na__LayoutEditor__Styles__ToolIcons__.css', import.meta.url);
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | The Stylesheet Link and the Probe of Each File
    // ------------------------------------------------------------
    let Na__LeIcon__StylesAdded = false;
    const Na__LeIcon__Probes    = new Map();                                     // <-- name -> 'loading' | 'ok' | 'missing'
    const Na__LeIcon__Waiting   = new Map();                                     // <-- name -> Set of icon elements to mark when the probe ends
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Link the Stylesheet Once
    // ------------------------------------------------------------
    function Na__LeIcon__AddStyles() {
        if (Na__LeIcon__StylesAdded) return;
        Na__LeIcon__StylesAdded = true;
        const link = document.createElement('link');
        link.rel  = 'stylesheet';
        link.href = Na__LeIcon__STYLES_URL.href;
        link.setAttribute('data-na-le-styles', 'tool-icons');
        document.head.appendChild(link);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Mark an Icon Element Drawn or Missing
    // ------------------------------------------------------------
    function Na__LeIcon__Mark(icon, state) {
        icon.classList.toggle('na-le-icon--missing', state === 'missing');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Probe a File Once, Then Mark Every Icon Waiting on It
    // ------------------------------------------------------------
    // An Image loads an SVG without drawing it anywhere; its error is the only
    // reliable sign a mask's file is absent, because a mask that fails to load
    // simply hides the element.
    // ------------------------------------------------------------
    function Na__LeIcon__Probe(name, icon) {
        const known = Na__LeIcon__Probes.get(name);
        if (known === 'ok' || known === 'missing') { Na__LeIcon__Mark(icon, known); return; }
        if (!Na__LeIcon__Waiting.has(name)) Na__LeIcon__Waiting.set(name, new Set());
        Na__LeIcon__Waiting.get(name).add(icon);
        if (known === 'loading') return;
        Na__LeIcon__Probes.set(name, 'loading');
        const url = Na__LeIcon__Url(name);
        const image = new Image();
        const done  = (state) => {
            Na__LeIcon__Probes.set(name, state);
            const waiting = Na__LeIcon__Waiting.get(name);
            Na__LeIcon__Waiting.delete(name);
            if (waiting) waiting.forEach((one) => Na__LeIcon__Mark(one, state));
        };
        image.onload  = () => done('ok');
        image.onerror = () => done('missing');
        if (!url) { done('missing'); return; }
        image.src = url;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Icons
// -----------------------------------------------------------------------------

    // FUNCTION | The File for an Icon Name
    // ------------------------------------------------------------
    function Na__LeIcon__Url(name) {
        const file = Object.prototype.hasOwnProperty.call(Na__LeIcon__FILES, name) ? Na__LeIcon__FILES[name] : null;
        return file ? file.href : '';                                            // <-- '' for a name the table lacks: Make shows the word
    }
    // ------------------------------------------------------------


    // FUNCTION | An Icon Element: Drawn in currentColor, or Its Short Word Until the File Exists
    // ------------------------------------------------------------
    // fallback : the word shown while the file is missing (the button's old
    // word); only its first few letters are used, so the button keeps its size.
    // ------------------------------------------------------------
    function Na__LeIcon__Make(name, fallback) {
        Na__LeIcon__AddStyles();
        const icon = document.createElement('span');
        icon.className = 'na-le-icon';
        icon.setAttribute('data-na-le-icon', name);
        icon.setAttribute('aria-hidden', 'true');
        icon.setAttribute('data-na-le-icon-fallback', String(fallback || name).slice(0, 4));
        icon.style.setProperty('--na-le-icon-url', 'url("' + Na__LeIcon__Url(name) + '")');
        Na__LeIcon__Probe(name, icon);
        return icon;
    }
    // ------------------------------------------------------------


    // FUNCTION | Put an Icon in a Button in Place of Its Words
    // ------------------------------------------------------------
    // The button's text is cleared and an icon put in, with the icon-button
    // class that squares it up. Called again with the same name it does
    // nothing, so a sync that runs often costs nothing.
    // ------------------------------------------------------------
    function Na__LeIcon__Put(button, name, fallback) {
        if (!button) return null;
        const current = button.querySelector(':scope > .na-le-icon');
        if (current && current.getAttribute('data-na-le-icon') === name) return current;
        while (button.firstChild) button.removeChild(button.firstChild);
        const icon = Na__LeIcon__Make(name, fallback);
        button.appendChild(icon);
        button.classList.add('na-le-icon-button');
        return icon;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Tool Icons API
    // ------------------------------------------------------------
    export {
        Na__LeIcon__ASSET_FOLDER,
        Na__LeIcon__Url,
        Na__LeIcon__Make,
        Na__LeIcon__Put,
        Na__LeIcon__AddStyles
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
