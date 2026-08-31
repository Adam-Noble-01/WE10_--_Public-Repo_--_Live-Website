// =============================================================================
// TRUEVISION3D - PLAN ANNOTATIONS - DATA AND CONFIG
// =============================================================================
//
// FILE       : Na__PlanAnnotations__Data__.js
// NAMESPACE  : Na__PlanAnno
// MODULE     : Plan Annotations - Data and Config
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Own what an annotation IS - its schema, its defaults and its config
// CREATED    : 31-Aug-2026
//
// DESCRIPTION:
// - An annotation is a text label pinned to a world X/Z position at a floor
//   plan's own cut height. Position is stored in millimetres, not pixels, so
//   a label stays exactly over the room it names however the plan is panned,
//   zoomed or re-opened on another screen.
// - Text size is likewise stored in real millimetres, so labels scale with the
//   drawing the way CAD text does rather than floating at a fixed pixel size.
// - Annotations belong to a floor plan, not to the project. Every plan cut
//   carries its own independent markup, which is why the array lives inside
//   the plan record rather than in a shared pool.
// - Font weight is restricted to the three Open Sans faces the app already
//   loads (300 / 400 / 600). Any other weight would silently synthesise and
//   look wrong, so it is coerced back to the nearest allowed value on read.
// - Pure data and config. No DOM, no Three.js.
//
// INTEGRATION:
// - Na__PlanAnnotations__Overlay__ reads through here to draw the DOM layer.
// - Na__PlanAnnotations__Editor__ mutates through here.
// - Storage is handed to Na__FloorPlan__ProjectJson__Data__ which nests the
//   array inside the floor plan record.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 31-Aug-2026 - Version 1.0.0
// - Initial implementation for the Floor Plan Builder. Text only; dimensions
//   are deliberately out of scope for this version.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Config Location and Block Keys
    // ------------------------------------------------------------
    const Na__PlanAnno__ConfigUrl     = new URL('./Na__PlanAnnotations__AppConfig__.json', import.meta.url);
    const Na__PlanAnno__TEXT_BLOCK    = 'PlanAnnotations__Text__Config';
    const Na__PlanAnno__LAYER_BLOCK   = 'PlanAnnotations__Layer__Config';
    const Na__PlanAnno__INTER_BLOCK   = 'PlanAnnotations__Interaction__Config';
    const Na__PlanAnno__KEYS_BLOCK    = 'PlanAnnotations__Hotkeys__Config';
    const Na__PlanAnno__LABELS_BLOCK  = 'PlanAnnotations__Labels__Config';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Annotation Record Field Names
    // ------------------------------------------------------------
    const Na__PlanAnno__F_ID     = 'Annotation__Id';
    const Na__PlanAnno__F_TEXT   = 'Annotation__Text';
    const Na__PlanAnno__F_POS_X  = 'Annotation__PosXMm';
    const Na__PlanAnno__F_POS_Z  = 'Annotation__PosZMm';
    const Na__PlanAnno__F_SIZE   = 'Annotation__SizeMm';
    const Na__PlanAnno__F_WEIGHT = 'Annotation__FontWeight';
    const Na__PlanAnno__F_COLOR  = 'Annotation__Color';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Id Formatting
    // ------------------------------------------------------------
    const Na__PlanAnno__ID_PREFIX  = 'Anno_';
    const Na__PlanAnno__ID_PADDING = 3;                                          // <-- Anno_001
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Fallback Values (mirror the shipped JSON exactly)
    // ------------------------------------------------------------
    const Na__PlanAnno__FALLBACKS = Object.freeze({
        defaultText     : 'Room Name',
        defaultSizeMm   : 300,
        minSizeMm       : 50,
        maxSizeMm       : 2000,
        sizeStepMm      : 25,
        defaultWeight   : 400,
        allowedWeights  : [300, 400, 600],
        defaultColor    : '#323232',
        fontFamily      : "'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        maxCharacters   : 120,
        planeOffsetMm   : 50,
        minRenderedPx   : 5,
        maxRenderedPx   : 400,
        fadeMs          : 220,
        dragThresholdPx : 3,
        copyKey         : 'c',
        pasteKey        : 'v',
        undoKey         : 'z',
        redoKey         : 'y',
        deleteKeys      : ['Delete', 'Backspace'],
        undoDepth       : 50,
        pasteOffsetMm   : 300
    });
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Parsed Config and Fetch Promise
    // ------------------------------------------------------------
    let Na__PlanAnno__Config      = null;
    let Na__PlanAnno__LoadPromise = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Config Access
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Read One Config Value With a Fallback
    // ------------------------------------------------------------
    function Na__PlanAnno__Val(blockKey, valueKey, fallback) {
        if (!Na__PlanAnno__Config) return fallback;
        const block = Na__PlanAnno__Config[blockKey];
        if (!block || typeof block !== 'object') return fallback;
        const value = block[valueKey];
        return (value === undefined || value === null) ? fallback : value;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read a Numeric Config Value With a Fallback
    // ------------------------------------------------------------
    function Na__PlanAnno__Num(blockKey, valueKey, fallback) {
        const value = Na__PlanAnno__Val(blockKey, valueKey, fallback);
        return Number.isFinite(value) ? value : fallback;
    }
    // ------------------------------------------------------------


    // FUNCTION | Load the Config Exactly Once
    // ------------------------------------------------------------
    function Na__PlanAnno__Load() {
        if (!Na__PlanAnno__LoadPromise) {
            Na__PlanAnno__LoadPromise = (async () => {
                try {
                    const response = await fetch(Na__PlanAnno__ConfigUrl);
                    if (!response.ok) {
                        console.warn('[TrueVision3D] Plan annotations config fetch failed (' + response.status + ') - using built-in defaults.');
                        return false;
                    }
                    Na__PlanAnno__Config = await response.json();
                    return Na__PlanAnno__IsEnabled();
                } catch (error) {
                    console.warn('[TrueVision3D] Plan annotations config unreadable - using built-in defaults.', error);
                    return false;
                }
            })();
        }
        return Na__PlanAnno__LoadPromise;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is the Annotation Layer Switched On?
    // ------------------------------------------------------------
    function Na__PlanAnno__IsEnabled() {
        if (!Na__PlanAnno__Config) return false;
        return Na__PlanAnno__Config.PlanAnnotations__Enabled === true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Text Defaults and Limits
    // ------------------------------------------------------------
    function Na__PlanAnno__GetTextSetup() {
        const weights = Na__PlanAnno__Val(Na__PlanAnno__TEXT_BLOCK, 'PlanAnnotations__Text__AllowedFontWeights', Na__PlanAnno__FALLBACKS.allowedWeights);
        return {
            defaultText   : Na__PlanAnno__Val(Na__PlanAnno__TEXT_BLOCK, 'PlanAnnotations__Text__DefaultText',       Na__PlanAnno__FALLBACKS.defaultText),
            defaultSizeMm : Na__PlanAnno__Num(Na__PlanAnno__TEXT_BLOCK, 'PlanAnnotations__Text__DefaultSizeMm',     Na__PlanAnno__FALLBACKS.defaultSizeMm),
            minSizeMm     : Na__PlanAnno__Num(Na__PlanAnno__TEXT_BLOCK, 'PlanAnnotations__Text__MinSizeMm',         Na__PlanAnno__FALLBACKS.minSizeMm),
            maxSizeMm     : Na__PlanAnno__Num(Na__PlanAnno__TEXT_BLOCK, 'PlanAnnotations__Text__MaxSizeMm',         Na__PlanAnno__FALLBACKS.maxSizeMm),
            sizeStepMm    : Na__PlanAnno__Num(Na__PlanAnno__TEXT_BLOCK, 'PlanAnnotations__Text__SizeStepMm',        Na__PlanAnno__FALLBACKS.sizeStepMm),
            defaultWeight : Na__PlanAnno__Num(Na__PlanAnno__TEXT_BLOCK, 'PlanAnnotations__Text__DefaultFontWeight', Na__PlanAnno__FALLBACKS.defaultWeight),
            allowedWeights: Array.isArray(weights) ? weights : Na__PlanAnno__FALLBACKS.allowedWeights,
            weightLabels  : Na__PlanAnno__Val(Na__PlanAnno__TEXT_BLOCK, 'PlanAnnotations__Text__FontWeightLabels', {}),
            defaultColor  : Na__PlanAnno__Val(Na__PlanAnno__TEXT_BLOCK, 'PlanAnnotations__Text__DefaultColor',      Na__PlanAnno__FALLBACKS.defaultColor),
            fontFamily    : Na__PlanAnno__Val(Na__PlanAnno__TEXT_BLOCK, 'PlanAnnotations__Text__FontFamily',        Na__PlanAnno__FALLBACKS.fontFamily),
            maxCharacters : Na__PlanAnno__Num(Na__PlanAnno__TEXT_BLOCK, 'PlanAnnotations__Text__MaxCharacters',     Na__PlanAnno__FALLBACKS.maxCharacters)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Overlay Layer Setup
    // ------------------------------------------------------------
    function Na__PlanAnno__GetLayerSetup() {
        return {
            planeOffsetMm : Na__PlanAnno__Num(Na__PlanAnno__LAYER_BLOCK, 'PlanAnnotations__Layer__PlaneOffsetBelowCameraMm', Na__PlanAnno__FALLBACKS.planeOffsetMm),
            minRenderedPx : Na__PlanAnno__Num(Na__PlanAnno__LAYER_BLOCK, 'PlanAnnotations__Layer__MinRenderedPx',            Na__PlanAnno__FALLBACKS.minRenderedPx),
            maxRenderedPx : Na__PlanAnno__Num(Na__PlanAnno__LAYER_BLOCK, 'PlanAnnotations__Layer__MaxRenderedPx',            Na__PlanAnno__FALLBACKS.maxRenderedPx),
            fadeMs        : Na__PlanAnno__Num(Na__PlanAnno__LAYER_BLOCK, 'PlanAnnotations__Layer__FadeMs',                   Na__PlanAnno__FALLBACKS.fadeMs)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Interaction Setup
    // ------------------------------------------------------------
    function Na__PlanAnno__GetInteractionSetup() {
        return {
            dragThresholdPx     : Na__PlanAnno__Num(Na__PlanAnno__INTER_BLOCK, 'PlanAnnotations__Interaction__DragThresholdPx', Na__PlanAnno__FALLBACKS.dragThresholdPx),
            doubleClickToEdit   : Na__PlanAnno__Val(Na__PlanAnno__INTER_BLOCK, 'PlanAnnotations__Interaction__DoubleClickToEdit',  true) !== false,
            selectOnPlace       : Na__PlanAnno__Val(Na__PlanAnno__INTER_BLOCK, 'PlanAnnotations__Interaction__SelectOnPlace',      true) !== false,
            deleteEmptyOnCommit : Na__PlanAnno__Val(Na__PlanAnno__INTER_BLOCK, 'PlanAnnotations__Interaction__DeleteEmptyOnCommit', true) !== false
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Keyboard Shortcut Setup
    // ------------------------------------------------------------
    // Key values are compared case-insensitively against KeyboardEvent.key, so
    // Ctrl+C and Ctrl+Shift+C both reach the copy binding rather than one of
    // them silently doing nothing.
    // ------------------------------------------------------------
    function Na__PlanAnno__GetHotkeySetup() {
        const deleteKeys = Na__PlanAnno__Val(Na__PlanAnno__KEYS_BLOCK, 'PlanAnnotations__Hotkeys__DeleteKeys', Na__PlanAnno__FALLBACKS.deleteKeys);
        return {
            enabled          : Na__PlanAnno__Val(Na__PlanAnno__KEYS_BLOCK, 'PlanAnnotations__Hotkeys__Enabled', true) !== false,
            copyKey          : String(Na__PlanAnno__Val(Na__PlanAnno__KEYS_BLOCK, 'PlanAnnotations__Hotkeys__CopyKey',  Na__PlanAnno__FALLBACKS.copyKey)).toLowerCase(),
            pasteKey         : String(Na__PlanAnno__Val(Na__PlanAnno__KEYS_BLOCK, 'PlanAnnotations__Hotkeys__PasteKey', Na__PlanAnno__FALLBACKS.pasteKey)).toLowerCase(),
            undoKey          : String(Na__PlanAnno__Val(Na__PlanAnno__KEYS_BLOCK, 'PlanAnnotations__Hotkeys__UndoKey',  Na__PlanAnno__FALLBACKS.undoKey)).toLowerCase(),
            redoKey          : String(Na__PlanAnno__Val(Na__PlanAnno__KEYS_BLOCK, 'PlanAnnotations__Hotkeys__RedoKey',  Na__PlanAnno__FALLBACKS.redoKey)).toLowerCase(),
            deleteKeys       : (Array.isArray(deleteKeys) ? deleteKeys : Na__PlanAnno__FALLBACKS.deleteKeys).map((k) => String(k).toLowerCase()),
            undoDepth        : Math.max(1, Na__PlanAnno__Num(Na__PlanAnno__KEYS_BLOCK, 'PlanAnnotations__Hotkeys__UndoDepth', Na__PlanAnno__FALLBACKS.undoDepth)),
            pasteOffsetMm    : Na__PlanAnno__Num(Na__PlanAnno__KEYS_BLOCK, 'PlanAnnotations__Hotkeys__PasteOffsetMm', Na__PlanAnno__FALLBACKS.pasteOffsetMm),
            cascadeRepeats   : Na__PlanAnno__Val(Na__PlanAnno__KEYS_BLOCK, 'PlanAnnotations__Hotkeys__PasteOffsetsEachRepeat', true) !== false
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get One Toolbar Label by Key Suffix
    // ------------------------------------------------------------
    function Na__PlanAnno__GetLabel(keySuffix, fallback) {
        const value = Na__PlanAnno__Val(Na__PlanAnno__LABELS_BLOCK, 'PlanAnnotations__Labels__' + keySuffix, fallback);
        return (typeof value === 'string') ? value : fallback;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Annotation Schema
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Coerce a Font Weight to an Allowed Open Sans Face
    // ------------------------------------------------------------
    // The app loads exactly three faces. Anything else would be synthesised
    // by the browser and read as a different typeface, so snap to the nearest
    // real weight rather than trusting the stored number.
    // ------------------------------------------------------------
    function Na__PlanAnno__CoerceWeight(weight) {
        const setup   = Na__PlanAnno__GetTextSetup();
        const allowed = setup.allowedWeights;
        if (allowed.indexOf(weight) !== -1) return weight;

        if (!Number.isFinite(weight)) return setup.defaultWeight;

        let nearest = allowed[0];
        let bestGap = Math.abs(weight - nearest);
        for (let i = 1; i < allowed.length; i++) {
            const gap = Math.abs(weight - allowed[i]);
            if (gap < bestGap) {
                bestGap = gap;
                nearest = allowed[i];
            }
        }
        return nearest;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is This a Structurally Valid Annotation?
    // ------------------------------------------------------------
    function Na__PlanAnno__IsValid(annotation) {
        if (!annotation || typeof annotation !== 'object') return false;
        if (!annotation[Na__PlanAnno__F_ID]) return false;
        return Number.isFinite(annotation[Na__PlanAnno__F_POS_X])
            && Number.isFinite(annotation[Na__PlanAnno__F_POS_Z]);
    }
    // ------------------------------------------------------------


    // FUNCTION | Fill In Missing Fields and Clamp Out-of-Range Ones
    // ------------------------------------------------------------
    function Na__PlanAnno__Normalise(annotation) {
        const setup = Na__PlanAnno__GetTextSetup();

        if (typeof annotation[Na__PlanAnno__F_TEXT] !== 'string') {
            annotation[Na__PlanAnno__F_TEXT] = setup.defaultText;
        }
        if (!Number.isFinite(annotation[Na__PlanAnno__F_SIZE])) {
            annotation[Na__PlanAnno__F_SIZE] = setup.defaultSizeMm;
        }
        annotation[Na__PlanAnno__F_SIZE] = Math.min(setup.maxSizeMm,
            Math.max(setup.minSizeMm, annotation[Na__PlanAnno__F_SIZE]));

        annotation[Na__PlanAnno__F_WEIGHT] = Na__PlanAnno__CoerceWeight(annotation[Na__PlanAnno__F_WEIGHT]);

        if (typeof annotation[Na__PlanAnno__F_COLOR] !== 'string') {
            annotation[Na__PlanAnno__F_COLOR] = setup.defaultColor;
        }
        return annotation;
    }
    // ------------------------------------------------------------


    // FUNCTION | Read a Plan's Annotations, Validated and Normalised
    // ------------------------------------------------------------
    // Returns the LIVE objects, so editing one edits the data that will save.
    // ------------------------------------------------------------
    function Na__PlanAnno__ReadAll(annotationArray) {
        if (!Array.isArray(annotationArray)) return [];
        return annotationArray
            .filter(Na__PlanAnno__IsValid)
            .map(Na__PlanAnno__Normalise);
    }
    // ------------------------------------------------------------


    // FUNCTION | Allocate the Next Free Annotation Id Within One Plan
    // ------------------------------------------------------------
    function Na__PlanAnno__NextId(annotationArray) {
        let highest = 0;
        if (Array.isArray(annotationArray)) {
            for (let i = 0; i < annotationArray.length; i++) {
                const id = annotationArray[i] && annotationArray[i][Na__PlanAnno__F_ID];
                if (typeof id !== 'string' || !id.startsWith(Na__PlanAnno__ID_PREFIX)) continue;
                const parsed = parseInt(id.slice(Na__PlanAnno__ID_PREFIX.length), 10);
                if (Number.isFinite(parsed) && parsed > highest) highest = parsed;
            }
        }
        return Na__PlanAnno__ID_PREFIX + String(highest + 1).padStart(Na__PlanAnno__ID_PADDING, '0');
    }
    // ------------------------------------------------------------


    // FUNCTION | Build and Append a New Annotation
    // ------------------------------------------------------------
    function Na__PlanAnno__Create(annotationArray, posXMm, posZMm, options) {
        if (!Array.isArray(annotationArray)) return null;

        const setup = Na__PlanAnno__GetTextSetup();
        const opts  = options || {};

        const annotation = {};
        annotation[Na__PlanAnno__F_ID]     = Na__PlanAnno__NextId(annotationArray);
        annotation[Na__PlanAnno__F_TEXT]   = (typeof opts.text === 'string') ? opts.text : setup.defaultText;
        annotation[Na__PlanAnno__F_POS_X]  = Math.round(posXMm);
        annotation[Na__PlanAnno__F_POS_Z]  = Math.round(posZMm);
        annotation[Na__PlanAnno__F_SIZE]   = Number.isFinite(opts.sizeMm) ? opts.sizeMm : setup.defaultSizeMm;
        annotation[Na__PlanAnno__F_WEIGHT] = Na__PlanAnno__CoerceWeight(opts.fontWeight);
        annotation[Na__PlanAnno__F_COLOR]  = (typeof opts.color === 'string') ? opts.color : setup.defaultColor;

        annotationArray.push(annotation);
        return annotation;
    }
    // ------------------------------------------------------------


    // FUNCTION | Remove One Annotation by Id
    // ------------------------------------------------------------
    function Na__PlanAnno__Delete(annotationArray, annotationId) {
        if (!Array.isArray(annotationArray)) return false;
        for (let i = 0; i < annotationArray.length; i++) {
            if (annotationArray[i] && annotationArray[i][Na__PlanAnno__F_ID] === annotationId) {
                annotationArray.splice(i, 1);
                return true;
            }
        }
        return false;
    }
    // ------------------------------------------------------------


    // FUNCTION | Find One Annotation by Id
    // ------------------------------------------------------------
    function Na__PlanAnno__FindById(annotationArray, annotationId) {
        if (!Array.isArray(annotationArray)) return null;
        for (let i = 0; i < annotationArray.length; i++) {
            if (annotationArray[i] && annotationArray[i][Na__PlanAnno__F_ID] === annotationId) {
                return annotationArray[i];
            }
        }
        return null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Move One Annotation to a New World Position
    // ------------------------------------------------------------
    function Na__PlanAnno__SetPosition(annotation, posXMm, posZMm) {
        if (!annotation) return false;
        if (Number.isFinite(posXMm)) annotation[Na__PlanAnno__F_POS_X] = Math.round(posXMm);
        if (Number.isFinite(posZMm)) annotation[Na__PlanAnno__F_POS_Z] = Math.round(posZMm);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Update One Annotation's Text, Size, Weight or Colour
    // ------------------------------------------------------------
    function Na__PlanAnno__Update(annotation, changes) {
        if (!annotation || !changes) return false;
        const setup = Na__PlanAnno__GetTextSetup();

        if (typeof changes.text === 'string') {
            annotation[Na__PlanAnno__F_TEXT] = changes.text.slice(0, setup.maxCharacters);
        }
        if (Number.isFinite(changes.sizeMm)) {
            annotation[Na__PlanAnno__F_SIZE] = Math.min(setup.maxSizeMm, Math.max(setup.minSizeMm, changes.sizeMm));
        }
        if (changes.fontWeight !== undefined) {
            annotation[Na__PlanAnno__F_WEIGHT] = Na__PlanAnno__CoerceWeight(changes.fontWeight);
        }
        if (typeof changes.color === 'string') {
            annotation[Na__PlanAnno__F_COLOR] = changes.color;
        }
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Read One Annotation's Fields as a Plain Object
    // ------------------------------------------------------------
    function Na__PlanAnno__Read(annotation) {
        if (!annotation) return null;
        return {
            id         : annotation[Na__PlanAnno__F_ID],
            text       : annotation[Na__PlanAnno__F_TEXT],
            posXMm     : annotation[Na__PlanAnno__F_POS_X],
            posZMm     : annotation[Na__PlanAnno__F_POS_Z],
            sizeMm     : annotation[Na__PlanAnno__F_SIZE],
            fontWeight : annotation[Na__PlanAnno__F_WEIGHT],
            color      : annotation[Na__PlanAnno__F_COLOR]
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Plan Annotation Data and Config API
    // ------------------------------------------------------------
    export {
        Na__PlanAnno__Load,
        Na__PlanAnno__IsEnabled,
        Na__PlanAnno__GetTextSetup,
        Na__PlanAnno__GetLayerSetup,
        Na__PlanAnno__GetInteractionSetup,
        Na__PlanAnno__GetHotkeySetup,
        Na__PlanAnno__GetLabel,
        Na__PlanAnno__ReadAll,
        Na__PlanAnno__Read,
        Na__PlanAnno__Create,
        Na__PlanAnno__Delete,
        Na__PlanAnno__FindById,
        Na__PlanAnno__SetPosition,
        Na__PlanAnno__Update,
        Na__PlanAnno__CoerceWeight
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
