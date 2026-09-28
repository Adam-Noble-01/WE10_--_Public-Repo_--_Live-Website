// =============================================================================
// TRUEVISION3D - PRESENTATION MODE - DEV MENU SCENE LIGHTING ROWS
// =============================================================================
//
// FILE       : Na__PresentationMode__DevMenu__SceneLightingRows__.js
// NAMESPACE  : Na__PmLight
// MODULE     : PresentationMode - Dev Menu Scene Lighting Rows
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The Lighting subsection of a scene row's Advanced fold: turn the
//              sun, set its height and strength, the fill light and the shadows,
//              watch it live, then save it to the scene
// CREATED    : 28-Sep-2026
//
// DESCRIPTION:
// - Four sliders and a checkbox. Rotation (0 to 360 degrees, 0 being the
//   default direction), Height, Sun and Ambient each have a number box beside
//   the slider for an exact value; Shadows is a tick. A slider across a panel
//   this narrow moves the sun two or three degrees a pixel, which is right for
//   finding a light and wrong for matching one, hence the boxes.
// - EVERY CHANGE LIGHTS THE VIEWPORT AT ONCE. That is the preview. It also
//   writes the working copy of the scene exactly as a save would: only the
//   settings that differ from the default, and no block at all when nothing
//   does (Na__SceneLighting__BuildBlock).
// - NOTHING IS WRITTEN TO THE PROJECT UNTIL SAVE LIGHTING. Update Scene and
//   Save All To Project carry the working copy too, as they always have for
//   the other in-row settings. The status line says which state the row is
//   in: the default, the scene's own saved lighting, or changes not saved yet.
//   Save Lighting is only live while there is something to save.
// - Use Default puts every control back to the default, and a double-click on
//   one slider puts back that one setting. Both are changes like any other, so
//   they show at once and wait for Save Lighting.
// - While a floor plan or elevation owns the viewport the preview is held
//   back, because a drawing is always lit by the default; the controls still
//   edit the working copy and the status line says why nothing moved.
// - Purely presentational, like the scene row it sits in. The save is
//   handed back through onSave, which the scene editor answers with its one
//   commit-and-write path, so this module never touches R2.
// - Not built for a floor plan or elevation card, or when per-scene lighting
//   is switched off in the app config (Scene__PerSceneLighting__Enabled).
//
// INTEGRATION:
// - Consumed only by Na__PresentationMode__DevMenu__SceneEditor.js, whose
//   scene row builder appends the subsection to the end of the Advanced fold.
// - Reads and lights through Na__Scene__PerSceneLighting__.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 21__System__PresentationMode/Na__PresentationMode__DevMenu__SceneLightingRows__.js 1.0.0 (v2.71.0)
// - Ported on     : 28-Sep-2026 for TrueVision3D v2.161.0
// - Parity        : verbatim
// - Divergences   : Header; the drawing view broker is in folder 40 here, not 42.
// - Back-port     : n/a (this IS the port).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 28-Sep-2026 - Version 1.0.0
// - Ported from ValeVision3D v2.71.0, where it was written the same day.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Per-Scene Lighting
    // @delegate: ../06__Scene__LightingEffects/Na__Scene__PerSceneLighting__.js
    // ------------------------------------------------------------
    import {
        Na__SceneLighting__SCENE_KEY,
        Na__SceneLighting__IsEnabled,
        Na__SceneLighting__GetDefaults,
        Na__SceneLighting__GetLimits,
        Na__SceneLighting__Resolve,
        Na__SceneLighting__ResolveScene,
        Na__SceneLighting__BuildBlock,
        Na__SceneLighting__Apply
    } from '../06__Scene__LightingEffects/Na__Scene__PerSceneLighting__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Drawing View Broker (is a 2D drawing on screen?)
    // @delegate: ../40__System__DrawingViewCore/Na__DrawView__ActiveView__.js
    // ------------------------------------------------------------
    import { Na__DrawView__IsActive } from '../40__System__DrawingViewCore/Na__DrawView__ActiveView__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Four Slider Settings
    // ------------------------------------------------------------
    // min and max are functions of the slider ranges the lighting module read
    // from the app config (Scene__PerSceneLighting), so the config is the one
    // place a range is set. Rotation runs to 360 so a whole turn is one drag;
    // 360 is stored as 0, the default direction.
    // ------------------------------------------------------------
    const Na__PmLight__SLIDERS = [
        {
            key       : 'rotationDeg',
            label     : 'Rotation',
            min       : () => 0,
            max       : () => 360,
            step      : 1,
            inputStep : 1,
            decimals  : 0,
            suffix    : '°',
            title     : 'Turns the sun round the model, clockwise seen from above. 0 is the default direction. '
                      + 'Double-click the slider to return it to the default.'
        },
        {
            key       : 'heightDeg',
            label     : 'Height',
            min       : (limits) => limits.heightMinDeg,
            max       : (limits) => limits.heightMaxDeg,
            step      : 1,
            inputStep : 1,
            decimals  : 0,
            suffix    : '°',
            title     : 'The sun\'s angle above the horizon. Lower lights the walls more strongly and lengthens the '
                      + 'shadows; 90 is straight overhead. Double-click the slider to return it to the default.'
        },
        {
            key       : 'directionalIntensity',
            label     : 'Sun',
            min       : () => 0,
            max       : (limits) => limits.directionalMax,
            step      : 0.05,
            inputStep : 0.01,
            decimals  : 2,
            suffix    : '',
            title     : 'The sun\'s strength: how much brighter the faces turned towards it are than the rest. '
                      + 'Double-click the slider to return it to the default.'
        },
        {
            key       : 'ambientIntensity',
            label     : 'Ambient',
            min       : () => 0,
            max       : (limits) => limits.ambientMax,
            step      : 0.05,
            inputStep : 0.01,
            decimals  : 2,
            suffix    : '',
            title     : 'The even fill light every face receives. Raise it to lift a view that is too dark overall. '
                      + 'Double-click the slider to return it to the default.'
        }
    ];
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Status Line Wording
    // ------------------------------------------------------------
    const Na__PmLight__STATUS__DEFAULT = 'Default lighting. Move a control to preview a change.';
    const Na__PmLight__STATUS__SAVED   = 'This scene has its own lighting, saved.';
    const Na__PmLight__STATUS__PENDING = 'Changes not saved yet. Save Lighting keeps them for this scene.';
    const Na__PmLight__STATUS__DRAWING = 'A drawing is on screen, so the viewport keeps the default lighting. Return to a 3D view to preview.';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Value as Its Number Box Shows It
    // ------------------------------------------------------------
    function Na__PmLight__Format(field, value) {
        return (field.decimals === 0) ? String(Math.round(value)) : Number(value).toFixed(field.decimals);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Compare Two Blocks by What They Would Save
    // ------------------------------------------------------------
    // BuildBlock writes its keys in a fixed order, so the JSON is a fair key.
    // The empty string stands for "no block", the default.
    // ------------------------------------------------------------
    function Na__PmLight__Token(block) {
        return block ? JSON.stringify(block) : '';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build One Slider Row With Its Number Box
    // ------------------------------------------------------------
    // Returns { row, set(value) }. onChange(value) fires for a drag, an arrow
    // key or a typed value; onReset() for a double-click on the slider.
    // ------------------------------------------------------------
    function Na__PmLight__BuildSliderRow(field, limits, initialValue, onChange, onReset) {
        const min = field.min(limits);
        const max = field.max(limits);

        const row = document.createElement('div');
        row.className = 'na-pm-dev__slider-row na-pm-dev__slider-row--lighting';
        row.title     = field.title;

        const label = document.createElement('label');
        label.className   = 'na-pm-dev__label';
        label.textContent = field.label;
        row.appendChild(label);

        const slider = document.createElement('input');
        slider.type      = 'range';
        slider.className = 'na-pm-dev__slider';
        slider.min       = String(min);
        slider.max       = String(max);
        slider.step      = String(field.step);
        slider.value     = String(initialValue);
        slider.setAttribute('aria-label', field.label);
        row.appendChild(slider);

        const wrap = document.createElement('span');
        wrap.className = 'na-pm-dev__inline-field';

        const input = document.createElement('input');
        input.type      = 'number';
        input.className = 'na-pm-dev__input na-pm-dev__input--tiny na-pm-dev__input--lighting';
        input.min       = String(min);
        input.max       = String(max);
        input.step      = String(field.inputStep);
        input.value     = Na__PmLight__Format(field, initialValue);
        input.setAttribute('aria-label', field.label + ' value');
        wrap.appendChild(input);

        if (field.suffix) {
            const suffix = document.createElement('span');
            suffix.className   = 'na-pm-dev__inline-suffix';
            suffix.textContent = field.suffix;
            wrap.appendChild(suffix);
        }
        row.appendChild(wrap);


        // DRAG | The box follows the slider, the viewport follows both
        // ------------------------------------
        slider.addEventListener('input', () => {
            const value = parseFloat(slider.value);
            input.value = Na__PmLight__Format(field, value);
            onChange(value);
        });

        slider.addEventListener('dblclick', () => onReset());


        // TYPED | Clamped to the slider's own range, junk put back
        // ------------------------------------
        input.addEventListener('change', () => {
            const typed = parseFloat(input.value);
            if (!Number.isFinite(typed)) {
                input.value = Na__PmLight__Format(field, parseFloat(slider.value));   // <-- Reject junk, show the slider's value again
                return;
            }
            const value = Math.min(max, Math.max(min, typed));
            slider.value = String(value);
            input.value  = Na__PmLight__Format(field, value);
            onChange(value);
        });

        return {
            row : row,
            set : (value) => {
                slider.value = String(value);
                input.value  = Na__PmLight__Format(field, value);
            }
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Shadows Checkbox Row
    // ------------------------------------------------------------
    // The same checkbox row the Layout Editor Only flag uses, so the Advanced
    // fold reads as one list. Returns { row, set(on) }.
    // ------------------------------------------------------------
    function Na__PmLight__BuildShadowsRow(initialOn, onChange) {
        const row = document.createElement('div');
        row.className = 'na-pm-dev__row na-pm-dev__row--checkbox';

        const label = document.createElement('label');
        label.className = 'na-pm-dev__checkbox-label';
        label.title     = 'Whether the sun casts shadows in this scene. Switching them off fades them out; '
                        + 'the sun still shades the faces.';

        const checkbox = document.createElement('input');
        checkbox.type      = 'checkbox';
        checkbox.className = 'na-pm-dev__checkbox';
        checkbox.checked   = initialOn;

        const text = document.createElement('span');
        text.className   = 'na-pm-dev__checkbox-text';
        text.textContent = 'Sun casts shadows';

        checkbox.addEventListener('change', () => onChange(checkbox.checked === true));

        label.appendChild(checkbox);
        label.appendChild(text);
        row.appendChild(label);

        return {
            row : row,
            set : (on) => { checkbox.checked = on === true; }
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Lighting Subsection Builder
// -----------------------------------------------------------------------------

    // FUNCTION | Build a Scene's Lighting Subsection
    // ------------------------------------------------------------
    // scene is the editor's WORKING copy of the scene record; this subsection
    // writes PresentationMode__Scene__Lighting on it directly, as the other
    // in-row fields do. onSave() asks the editor to commit and write it.
    // Returns the subsection element, or null when there is nothing to build.
    // ------------------------------------------------------------
    function Na__PresentationMode__DevMenu__BuildSceneLightingSection(scene, onSave) {
        if (!scene || typeof scene !== 'object') return null;
        if (scene.PresentationMode__Scene__FloorPlanId || scene.PresentationMode__Scene__ElevationId) return null;  // <-- A drawing is lit by the default
        if (!Na__SceneLighting__IsEnabled()) return null;                   // <-- Switched off in the app config, or no lights registered

        const defaults = Na__SceneLighting__GetDefaults();
        const limits   = Na__SceneLighting__GetLimits();
        let   values   = Na__SceneLighting__ResolveScene(scene);
        if (!defaults || !limits || !values) return null;

        // WHAT IS SAVED | The stored block, normalised the way a save would write it
        const savedToken = Na__PmLight__Token(Na__SceneLighting__BuildBlock(values));

        const section = document.createElement('div');
        section.className = 'na-pm-dev__lighting';

        const title = document.createElement('div');
        title.className   = 'na-pm-dev__lighting-title';
        title.textContent = 'Lighting';
        section.appendChild(title);

        const status = document.createElement('p');
        status.className = 'na-pm-dev__lighting-status';
        status.setAttribute('aria-live', 'polite');

        const actions = document.createElement('div');
        actions.className = 'na-pm-dev__lighting-actions';

        const defaultBtn = document.createElement('button');
        defaultBtn.type        = 'button';
        defaultBtn.className   = 'na-pm-dev__btn';
        defaultBtn.textContent = 'Use Default';
        defaultBtn.title       = 'Put every lighting control back to the default. Save Lighting keeps the change.';

        const saveBtn = document.createElement('button');
        saveBtn.type        = 'button';
        saveBtn.className   = 'na-pm-dev__btn na-pm-dev__btn--primary';
        saveBtn.textContent = 'Save Lighting';
        saveBtn.title       = 'Save this scene\'s lighting to the project. Update Scene also saves it, and refreshes the thumbnail.';


        // SUB FUNCTION | Show Which State the Row Is In
        // ------------------------------------
        const refresh = () => {
            const block     = Na__SceneLighting__BuildBlock(values);
            const isPending = Na__PmLight__Token(block) !== savedToken;
            const isDefault = block === null;

            if (isPending && Na__DrawView__IsActive()) {
                status.textContent = Na__PmLight__STATUS__DRAWING;
            } else if (isPending) {
                status.textContent = Na__PmLight__STATUS__PENDING;
            } else {
                status.textContent = isDefault ? Na__PmLight__STATUS__DEFAULT : Na__PmLight__STATUS__SAVED;
            }
            status.classList.toggle('is-pending', isPending);

            saveBtn.disabled    = !isPending;                                // <-- Only live while there is something to save
            defaultBtn.disabled = isDefault;
        };


        // SUB FUNCTION | A Control Moved: Working Copy, Then the Live Preview
        // ------------------------------------
        // The lights are set from the block RESOLVED, not from the raw control
        // values, so a setting left at the default is lit at exactly the
        // default rather than at the slider's rounding of it.
        // ------------------------------------
        const change = (nextValues) => {
            values = nextValues;

            const block = Na__SceneLighting__BuildBlock(values);
            if (block) {
                scene[Na__SceneLighting__SCENE_KEY] = block;
            } else {
                delete scene[Na__SceneLighting__SCENE_KEY];                  // <-- At the default: no block, so it keeps following the default
            }

            if (!Na__DrawView__IsActive()) {
                Na__SceneLighting__Apply(Na__SceneLighting__Resolve(block)); // <-- The preview; asks the render loop for a frame itself
            }
            refresh();
        };


        // THE FOUR SLIDERS
        // ------------------------------------
        const setters = {};
        Na__PmLight__SLIDERS.forEach((field) => {
            const control = Na__PmLight__BuildSliderRow(
                field,
                limits,
                values[field.key],
                (value) => change({ ...values, [field.key] : value }),
                () => {
                    control.set(defaults[field.key]);                        // <-- Double-click: this one setting back to the default
                    change({ ...values, [field.key] : defaults[field.key] });
                }
            );
            setters[field.key] = control.set;
            section.appendChild(control.row);
        });


        // SHADOWS
        // ------------------------------------
        const shadows = Na__PmLight__BuildShadowsRow(values.shadowIntensity >= 0.5, (on) => {
            change({ ...values, shadowIntensity : on ? 1 : 0 });
        });
        section.appendChild(shadows.row);


        // STATUS AND ACTIONS
        // ------------------------------------
        defaultBtn.addEventListener('click', () => {
            if (defaultBtn.disabled) return;
            Na__PmLight__SLIDERS.forEach((field) => setters[field.key](defaults[field.key]));
            shadows.set(defaults.shadowIntensity >= 0.5);
            change({ ...defaults });
        });

        saveBtn.addEventListener('click', () => {
            if (saveBtn.disabled) return;
            saveBtn.disabled = true;                                         // <-- One press, one save; the editor rebuilds this row after it
            if (typeof onSave === 'function') onSave();
        });

        actions.appendChild(defaultBtn);
        actions.appendChild(saveBtn);
        section.appendChild(status);
        section.appendChild(actions);

        refresh();
        return section;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Scene Lighting Rows API
    // ------------------------------------------------------------
    export {
        Na__PresentationMode__DevMenu__BuildSceneLightingSection
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
