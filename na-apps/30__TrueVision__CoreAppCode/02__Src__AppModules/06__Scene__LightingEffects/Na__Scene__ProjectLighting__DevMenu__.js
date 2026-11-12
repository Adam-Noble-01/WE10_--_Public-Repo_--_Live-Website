// =============================================================================
// TRUEVISION3D - SCENE LIGHTING EFFECTS - PROJECT LIGHTING DEV MENU
// =============================================================================
//
// FILE       : Na__Scene__ProjectLighting__DevMenu__.js
// NAMESPACE  : Na__ProjLightDev
// MODULE     : Scene Lighting Effects - Project Lighting Dev Menu
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Dev Tools > Project Lighting: turn this project's sun, set its
//              height, its strength and the fill light, watch it live, and
//              save it to the project after a confirm
// CREATED    : 12-Nov-2026
//
// DESCRIPTION:
// - THE SAME CONTROLS AS A SCENE'S OWN LIGHTING, so the two read alike:
//   Rotation, Height, Sun and Ambient each a slider with a number box beside
//   it for an exact value, and a Sun casts shadows tick. Rotation is measured
//   from the app's default direction, so 0 is the look every project had
//   before; the line under the controls says where the sun now is, in
//   compass words once North Direction is set.
// - EVERY CHANGE LIGHTS THE VIEWPORT AT ONCE, through the project's layer, so
//   a flight to a scene without lighting of its own shows it too. While a plan
//   or elevation is on screen the preview is held back: a drawing keeps the
//   app default (Adam, 12-Nov-2026: "3D view only"), and the change shows on
//   the way back to 3D.
// - NOTHING IS WRITTEN UNTIL SAVE PROJECT LIGHTING, and Save asks first, in the
//   shared confirm dialog (Adam, 12-Nov-2026, of the ValeVision original:
//   "Ensure you need to confirm a save like with the camera and fog tools").
//   The question says what the press will do: save lighting to a project that
//   has none, overwrite the lighting it has, or clear it back to the app
//   default. The save goes to R2, so it is live the moment it lands.
// - Use App Default puts every control back to the app's lighting, Undo
//   Changes back to what the project has saved, and a double-click on a slider
//   puts that one setting back to the app default. Each is a change like any
//   other, waiting for Save. The status line says which state the section is
//   in, and unsaved changes raise the browser's leave-site question.
// - Authoring only (Na__DevGate__IsAuthoringEnabled), and absent while the app
//   config has project lighting switched off (Scene__ProjectLighting__Enabled).
//   A client never sees the section, only the lighting it saved.
//
// INTEGRATION:
// - Initialised from index.html with the toast.
// - Markup: #naProjectLightingDevItem, #naProjectLightingDevToggle and
//   #naProjectLightingDevPanel, after Navigation Modes in Dev Tools.
// - Styles: the scene Lighting fold's own classes (na-pm-dev__*), in
//   Na__PresentationMode__Styles__SceneCarousel__.css; no stylesheet of its own.
//   The confirm is the shared dialog (#naConfirmDialog), whose markup and
//   styles came across from ValeVision 3D with this port.
// @delegate: ./Na__Scene__ProjectLighting__.js
// @delegate: ./Na__Scene__PerSceneLighting__.js
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 06__Scene__LightingEffects/Na__Scene__ProjectLighting__DevMenu__.js 1.0.0 (v2.98.0)
// - Ported on     : 12-Nov-2026 for TrueVision3D v2.184.0
// - Parity        : diverged
// - Divergences   : Initialize no longer asks whether project lighting is on:
//                   TrueVision builds its lights after Index.html has called
//                   it (the loading sequence awaits the data library first),
//                   so the answer is not known yet. The section shows with
//                   authoring and goes, closed, when the project's 'loaded'
//                   announcement finds project lighting switched off. Header:
//                   where the item sits, and the confirm's wording note
//                   (TrueVision's camera save does not ask).
// - Back-port     : n/a (this IS the port).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 12-Nov-2026 - Version 1.0.0 (TrueVision3D v2.184.0)
// - Ported from ValeVision3D v2.98.0, where it was written the same day. The
//   section is revealed before the lights exist (see the port note): the
//   first headless run found it never appeared here, because Initialize
//   asked about lights TrueVision had not built yet.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The Authoring Gate, the Confirm Dialog and the Project Id
    // ------------------------------------------------------------
    import { Na__DevGate__IsAuthoringEnabled } from '../03__AppUtils/Na__AppUtils__DevGate__.js';
    import { Na__AppUtils__ConfirmDialog__Show } from '../03__AppUtils/Na__AppUtils__ConfirmDialog.js';
    import { Na__AppUtils__GetProjectCodeFromUrl } from '../03__AppUtils/Na__AppUtils__ProjectLoader.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | The Lighting Core and the Project's Record Object
    // ------------------------------------------------------------
    import {
        Na__SceneLighting__IsProjectEnabled,
        Na__SceneLighting__GetAppDefaults,
        Na__SceneLighting__GetProjectValues,
        Na__SceneLighting__GetLimits,
        Na__SceneLighting__SunBearingDeg,
        Na__SceneLighting__ApplyBase
    } from './Na__Scene__PerSceneLighting__.js';
    import {
        Na__ProjLight__CHANGED_EVENT,
        Na__ProjLight__SetWorking,
        Na__ProjLight__Save,
        Na__ProjLight__IsPending,
        Na__ProjLight__HasSaved,
        Na__ProjLight__GetSavedValues,
        Na__ProjLight__IsLoaded,
        Na__ProjLight__IsSaving
    } from './Na__Scene__ProjectLighting__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Is a Drawing on Screen? Where Is North?
    // ------------------------------------------------------------
    import { Na__DrawView__IsActive, Na__DrawView__CHANGED_EVENT } from '../40__System__DrawingViewCore/Na__DrawView__ActiveView__.js';
    import { Na__NorthData__GetBearingDeg, Na__NorthData__CHANGED_EVENT } from '../46__System__NorthDirection/Na__North__ProjectJson__Data__.js';
    import { Na__NorthMath__TrueBearing, Na__NorthMath__CompassWord, Na__NorthMath__HALF_WIDTH_DEG } from '../46__System__NorthDirection/Na__North__Compass__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Markup Ids
    // ------------------------------------------------------------
    const Na__ProjLightDev__ITEM_ID   = 'naProjectLightingDevItem';
    const Na__ProjLightDev__TOGGLE_ID = 'naProjectLightingDevToggle';
    const Na__ProjLightDev__PANEL_ID  = 'naProjectLightingDevPanel';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | The Four Slider Settings
    // ------------------------------------------------------------
    // min and max are functions of the slider ranges the lighting core read
    // from the app config (Scene__PerSceneLighting), the ranges a scene's own
    // sliders use. Rotation runs to 360 so a whole turn is one drag; 360 is
    // stored as 0, the app's default direction.
    // ------------------------------------------------------------
    const Na__ProjLightDev__SLIDERS = [
        {
            key       : 'rotationDeg',
            label     : 'Rotation',
            min       : () => 0,
            max       : () => 360,
            step      : 1,
            inputStep : 1,
            decimals  : 0,
            suffix    : '°',
            title     : 'Turns this project\'s sun round the model, clockwise seen from above, and with it which faces '
                      + 'read lighter and which greyer. 0 is the app\'s default direction. Double-click the slider to return it there.'
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
            title     : 'The sun\'s angle above the horizon. Lower lights the walls more strongly against the roofs; '
                      + '90 is straight overhead. Double-click the slider to return it to the app default.'
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
            title     : 'The sun\'s strength: how much lighter the faces turned towards it are than the faces turned away. '
                      + 'Double-click the slider to return it to the app default.'
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
            title     : 'The even fill light every face receives. Raise it to lift a model that reads too grey overall. '
                      + 'Double-click the slider to return it to the app default.'
        }
    ];
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Wording
    // ------------------------------------------------------------
    const Na__ProjLightDev__INTRO =
        'Lights this project\'s 3D view and every scene without lighting of its own. Plans, elevations and sheets '
        + 'keep the app\'s default lighting.';
    const Na__ProjLightDev__STATUS__DEFAULT = 'The app\'s default lighting. Move a control to preview a change.';
    const Na__ProjLightDev__STATUS__SAVED   = 'This project has its own lighting, saved.';
    const Na__ProjLightDev__STATUS__PENDING = 'Changes not saved yet. Save Project Lighting keeps them for this project.';
    const Na__ProjLightDev__STATUS__DRAWING = 'A drawing is on screen and keeps the app\'s default lighting. The change shows when you return to the 3D view. Not saved yet.';
    const Na__ProjLightDev__STATUS__SAVING  = 'Saving...';
    const Na__ProjLightDev__STATUS__WAITING = 'The project is still loading.';
    const Na__ProjLightDev__STATUS__NONE    = 'No project is open, so there is no project lighting to set.';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Injected References and the Controls on Show
    // ------------------------------------------------------------
    let Na__ProjLightDev__Panel       = null;
    let Na__ProjLightDev__ShowToast   = null;
    let Na__ProjLightDev__Initialized = false;
    let Na__ProjLightDev__Values      = null;    // <-- The values the controls show (the working copy, before stored precision)
    let Na__ProjLightDev__Setters     = null;    // <-- { rotationDeg : set(value), ..., shadows : set(on) } for the controls on show
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Toast, Open State and Small Element Builders
    // ------------------------------------------------------------
    function Na__ProjLightDev__Toast(message, isError) {
        if (typeof Na__ProjLightDev__ShowToast === 'function') Na__ProjLightDev__ShowToast(message, isError === true);
    }
    function Na__ProjLightDev__IsOpen() {
        return !!Na__ProjLightDev__Panel && Na__ProjLightDev__Panel.classList.contains('is-open');
    }
    function Na__ProjLightDev__El(tag, className, text) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (text !== undefined) el.textContent = text;
        return el;
    }
    function Na__ProjLightDev__Button(text, modifierClass, title, onClick) {
        const button = Na__ProjLightDev__El('button', 'na-pm-dev__btn' + (modifierClass ? ' ' + modifierClass : ''), text);
        button.type  = 'button';
        button.title = title;
        button.addEventListener('click', onClick);
        return button;
    }
    function Na__ProjLightDev__Find(name) {
        return Na__ProjLightDev__Panel ? Na__ProjLightDev__Panel.querySelector('[data-na-projlight="' + name + '"]') : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Value as Its Number Box Shows It
    // ------------------------------------------------------------
    function Na__ProjLightDev__Format(field, value) {
        return (field.decimals === 0) ? String(Math.round(value)) : Number(value).toFixed(field.decimals);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Where the Sun Is, in Words
    // ------------------------------------------------------------
    // The sun's model bearing (clockwise from -Z, SketchUp's green axis) made a
    // compass bearing once North Direction is set, so "the South East" means
    // the same here as it does in an elevation's name.
    // ------------------------------------------------------------
    function Na__ProjLightDev__SunText(values) {
        const sunBearing = Na__SceneLighting__SunBearingDeg(values);
        if (sunBearing === null) return '';
        const north = Na__NorthData__GetBearingDeg();
        if (north === null || !Number.isFinite(north)) {
            return 'The sun is at ' + Math.round(sunBearing) % 360 + ' degrees, clockwise from SketchUp\'s green axis. '
                + 'Set North Direction to name it.';
        }
        const trueBearing = Na__NorthMath__TrueBearing(sunBearing, north);
        const word        = Na__NorthMath__CompassWord(trueBearing, Na__NorthMath__HALF_WIDTH_DEG, null);
        return 'The sun is in the ' + word + ', ' + Math.round(trueBearing) % 360 + ' degrees from north.';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build One Slider Row With Its Number Box
    // ------------------------------------------------------------
    // Returns { row, set(value) }. onChange(value) fires for a drag, an arrow
    // key or a typed value; onReset() for a double-click on the slider.
    // ------------------------------------------------------------
    function Na__ProjLightDev__BuildSliderRow(field, limits, initialValue, onChange, onReset) {
        const min = field.min(limits);
        const max = field.max(limits);

        const row = Na__ProjLightDev__El('div', 'na-pm-dev__slider-row na-pm-dev__slider-row--lighting');
        row.title = field.title;
        row.appendChild(Na__ProjLightDev__El('label', 'na-pm-dev__label', field.label));

        const slider = document.createElement('input');
        slider.type      = 'range';
        slider.className = 'na-pm-dev__slider';
        slider.min       = String(min);
        slider.max       = String(max);
        slider.step      = String(field.step);
        slider.value     = String(initialValue);
        slider.setAttribute('aria-label', field.label);
        row.appendChild(slider);

        const wrap  = Na__ProjLightDev__El('span', 'na-pm-dev__inline-field');
        const input = document.createElement('input');
        input.type      = 'number';
        input.className = 'na-pm-dev__input na-pm-dev__input--tiny na-pm-dev__input--lighting';
        input.min       = String(min);
        input.max       = String(max);
        input.step      = String(field.inputStep);
        input.value     = Na__ProjLightDev__Format(field, initialValue);
        input.setAttribute('aria-label', field.label + ' value');
        wrap.appendChild(input);
        if (field.suffix) wrap.appendChild(Na__ProjLightDev__El('span', 'na-pm-dev__inline-suffix', field.suffix));
        row.appendChild(wrap);


        // DRAG | The box follows the slider, the viewport follows both
        // ------------------------------------
        slider.addEventListener('input', () => {
            const value = parseFloat(slider.value);
            input.value = Na__ProjLightDev__Format(field, value);
            onChange(value);
        });
        slider.addEventListener('dblclick', () => onReset());


        // TYPED | Clamped to the slider's own range, junk put back
        // ------------------------------------
        input.addEventListener('change', () => {
            const typed = parseFloat(input.value);
            if (!Number.isFinite(typed)) {
                input.value = Na__ProjLightDev__Format(field, parseFloat(slider.value));
                return;
            }
            const value = Math.min(max, Math.max(min, typed));
            slider.value = String(value);
            input.value  = Na__ProjLightDev__Format(field, value);
            onChange(value);
        });

        return {
            row : row,
            set : (value) => {
                slider.value = String(value);
                input.value  = Na__ProjLightDev__Format(field, value);
            }
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Shadows Checkbox Row
    // ------------------------------------------------------------
    // The same checkbox row a scene's Lighting fold uses. Returns { row, set(on) }.
    // ------------------------------------------------------------
    function Na__ProjLightDev__BuildShadowsRow(initialOn, onChange) {
        const row   = Na__ProjLightDev__El('div', 'na-pm-dev__row na-pm-dev__row--checkbox');
        const label = Na__ProjLightDev__El('label', 'na-pm-dev__checkbox-label');
        label.title = 'Whether this project\'s sun casts shadows. Switching them off fades them out; the sun still '
                    + 'shades the faces.';

        const checkbox = document.createElement('input');
        checkbox.type      = 'checkbox';
        checkbox.className = 'na-pm-dev__checkbox';
        checkbox.checked   = initialOn;
        checkbox.addEventListener('change', () => onChange(checkbox.checked === true));

        label.appendChild(checkbox);
        label.appendChild(Na__ProjLightDev__El('span', 'na-pm-dev__checkbox-text', 'Sun casts shadows'));
        row.appendChild(label);

        return {
            row : row,
            set : (on) => { checkbox.checked = on === true; }
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Changes, Save and the Status Line
// -----------------------------------------------------------------------------

    // FUNCTION | A Control Moved: the Working Copy, Then the Live Preview
    // ------------------------------------------------------------
    // The lights are set from the project's layer as the record module now
    // holds it, not from the raw control values, so the preview is exactly
    // what a save and a reload will show.
    // ------------------------------------------------------------
    function Na__ProjLightDev__Change(nextValues) {
        Na__ProjLightDev__Values = nextValues;
        Na__ProjLight__SetWorking(nextValues);
        if (!Na__DrawView__IsActive()) Na__SceneLighting__ApplyBase();       // <-- The preview; asks the render loop for a frame itself
        Na__ProjLightDev__Refresh();
    }
    // ------------------------------------------------------------


    // FUNCTION | Put Every Control at These Values, as One Change
    // ------------------------------------------------------------
    function Na__ProjLightDev__SetAll(values) {
        if (!values) return;
        if (Na__ProjLightDev__Setters) {
            Na__ProjLightDev__SLIDERS.forEach((field) => Na__ProjLightDev__Setters[field.key](values[field.key]));
            Na__ProjLightDev__Setters.shadows(values.shadowIntensity >= 0.5);
        }
        Na__ProjLightDev__Change({ ...values });
    }
    // ------------------------------------------------------------


    // FUNCTION | Save Project Lighting, After Asking
    // ------------------------------------------------------------
    // Three questions for three different presses, so the button never
    // claims to overwrite something that is not there.
    // ------------------------------------------------------------
    async function Na__ProjLightDev__Save() {
        if (!Na__ProjLight__IsPending() || Na__ProjLight__IsSaving()) return;

        const projectCode = Na__AppUtils__GetProjectCodeFromUrl();
        if (!projectCode) {
            Na__ProjLightDev__Toast('No project loaded, so there is nowhere to save project lighting.', true);
            return;
        }

        const clearing = Na__SceneLighting__GetProjectValues() === null;
        let dialog = null;
        if (clearing) {
            dialog = {
                title        : 'Clear Project Lighting?',
                message      : `This removes the lighting saved in ${projectCode}. Its 3D view goes back to the app's default lighting for everyone who opens it.`,
                confirmLabel : 'Clear'
            };
        } else if (Na__ProjLight__HasSaved()) {
            dialog = {
                title        : 'Overwrite Project Lighting?',
                message      : `This will overwrite the lighting saved in ${projectCode}. Everyone who opens its 3D view, clients included, sees the new lighting.`,
                confirmLabel : 'Overwrite'
            };
        } else {
            dialog = {
                title        : 'Save Project Lighting?',
                message      : `This saves the lighting to ${projectCode}. Everyone who opens its 3D view, clients included, sees it. Plans, elevations and sheets keep the app's default.`,
                confirmLabel : 'Save'
            };
        }

        const confirmed = await Na__AppUtils__ConfirmDialog__Show(Object.assign({ isDestructive : true }, dialog));
        if (!confirmed) return;

        const saving = Na__ProjLight__Save();                               // <-- Sets the saving flag before the refresh below reads it
        Na__ProjLightDev__Refresh();
        const result = await saving;
        if (result.ok) {
            Na__ProjLightDev__Toast(result.cleared ? `Project lighting cleared from ${projectCode}` : `Project lighting saved to ${projectCode}`);
        } else {
            Na__ProjLightDev__Toast(`Project lighting not saved: ${result.error}`, true);
        }
        Na__ProjLightDev__Refresh();
    }
    // ------------------------------------------------------------


    // FUNCTION | The Status Line, the Sun Line and Which Buttons Are Live
    // ------------------------------------------------------------
    function Na__ProjLightDev__Refresh() {
        if (!Na__ProjLightDev__Panel) return;
        const status   = Na__ProjLightDev__Find('status');
        const sunLine  = Na__ProjLightDev__Find('sun');
        const useApp   = Na__ProjLightDev__Find('use-app');
        const undo     = Na__ProjLightDev__Find('undo');
        const save     = Na__ProjLightDev__Find('save');
        const pending  = Na__ProjLight__IsPending();
        const saving   = Na__ProjLight__IsSaving();
        const working  = Na__SceneLighting__GetProjectValues();

        if (status) {
            if (saving)                                   status.textContent = Na__ProjLightDev__STATUS__SAVING;
            else if (pending && Na__DrawView__IsActive()) status.textContent = Na__ProjLightDev__STATUS__DRAWING;
            else if (pending)                             status.textContent = Na__ProjLightDev__STATUS__PENDING;
            else status.textContent = Na__ProjLight__HasSaved() ? Na__ProjLightDev__STATUS__SAVED : Na__ProjLightDev__STATUS__DEFAULT;
            status.classList.toggle('is-pending', pending && !saving);
        }
        if (sunLine) sunLine.textContent = Na__ProjLightDev__SunText(working || Na__SceneLighting__GetAppDefaults());

        if (useApp) useApp.disabled = saving || working === null;           // <-- Already at the app default
        if (undo)   undo.disabled   = saving || !pending;
        if (save)   save.disabled   = saving || !pending;                   // <-- Only live while there is something to save
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Panel Render
// -----------------------------------------------------------------------------

    // FUNCTION | Rebuild the Whole Project Lighting Panel
    // ------------------------------------------------------------
    // From the working copy the record module holds, so a panel shut and opened
    // again shows the unsaved change it was left with.
    // ------------------------------------------------------------
    function Na__ProjLightDev__Render() {
        const panel = Na__ProjLightDev__Panel;
        if (!panel) return;
        panel.innerHTML = '';
        Na__ProjLightDev__Setters = null;

        const appDefaults = Na__SceneLighting__GetAppDefaults();
        const limits      = Na__SceneLighting__GetLimits();
        if (!Na__AppUtils__GetProjectCodeFromUrl()) {
            panel.appendChild(Na__ProjLightDev__El('p', 'na-pm-dev__lighting-status', Na__ProjLightDev__STATUS__NONE));
            return;
        }
        if (!Na__ProjLight__IsLoaded() || !appDefaults || !limits) {
            panel.appendChild(Na__ProjLightDev__El('p', 'na-pm-dev__lighting-status', Na__ProjLightDev__STATUS__WAITING));
            return;                                                           // <-- Rebuilt when the record arrives (the changed event, reason 'loaded')
        }

        Na__ProjLightDev__Values = Na__SceneLighting__GetProjectValues() || appDefaults;
        const values  = Na__ProjLightDev__Values;
        const setters = {};

        panel.appendChild(Na__ProjLightDev__El('p', 'na-pm-dev__lighting-status', Na__ProjLightDev__INTRO));


        // THE FOUR SLIDERS
        // ------------------------------------
        Na__ProjLightDev__SLIDERS.forEach((field) => {
            const control = Na__ProjLightDev__BuildSliderRow(
                field,
                limits,
                values[field.key],
                (value) => Na__ProjLightDev__Change({ ...Na__ProjLightDev__Values, [field.key] : value }),
                () => {
                    control.set(appDefaults[field.key]);                     // <-- Double-click: this one setting back to the app default
                    Na__ProjLightDev__Change({ ...Na__ProjLightDev__Values, [field.key] : appDefaults[field.key] });
                }
            );
            setters[field.key] = control.set;
            panel.appendChild(control.row);
        });


        // SHADOWS
        // ------------------------------------
        const shadows = Na__ProjLightDev__BuildShadowsRow(values.shadowIntensity >= 0.5, (on) => {
            Na__ProjLightDev__Change({ ...Na__ProjLightDev__Values, shadowIntensity : on ? 1 : 0 });
        });
        setters.shadows = shadows.set;
        panel.appendChild(shadows.row);
        Na__ProjLightDev__Setters = setters;


        // WHERE THE SUN IS, AND THE STATE
        // ------------------------------------
        const sunLine = Na__ProjLightDev__El('p', 'na-pm-dev__lighting-status');
        sunLine.setAttribute('data-na-projlight', 'sun');
        panel.appendChild(sunLine);

        const status = Na__ProjLightDev__El('p', 'na-pm-dev__lighting-status');
        status.setAttribute('data-na-projlight', 'status');
        status.setAttribute('aria-live', 'polite');
        panel.appendChild(status);


        // ACTIONS | Two put-backs side by side, the save across the foot
        // ------------------------------------
        const actions = Na__ProjLightDev__El('div', 'na-pm-dev__lighting-actions');
        const useApp  = Na__ProjLightDev__Button('Use App Default', '',
            'Put every control back to the app\'s default lighting. Save Project Lighting keeps the change.',
            () => Na__ProjLightDev__SetAll(appDefaults));
        const undo    = Na__ProjLightDev__Button('Undo Changes', '',
            'Put every control back to the lighting this project has saved.',
            () => Na__ProjLightDev__SetAll(Na__ProjLight__GetSavedValues() || appDefaults));
        const save    = Na__ProjLightDev__Button('Save Project Lighting', 'na-pm-dev__btn--primary na-pm-dev__btn--wide',
            'Save this lighting to the project, after a confirm. Everyone who opens its 3D view sees it, clients included.',
            () => { Na__ProjLightDev__Save(); });
        useApp.setAttribute('data-na-projlight', 'use-app');
        undo.setAttribute('data-na-projlight', 'undo');
        save.setAttribute('data-na-projlight', 'save');
        actions.appendChild(useApp);
        actions.appendChild(undo);
        actions.appendChild(save);
        panel.appendChild(actions);

        Na__ProjLightDev__Refresh();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Initialization
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize the Authoring-Only Project Lighting Section
    // ------------------------------------------------------------
    // context: { showToast }
    // Returns false, leaving the section hidden, when authoring is locked or
    // the markup is absent. THE LIGHTS ARE NOT BUILT YET when Index.html calls
    // this: TrueVision's loading sequence awaits its data library first, so
    // whether the app config switches project lighting off is not known here.
    // The section shows now and goes again as the project loads if it is
    // switched off. A saved project lighting is read and used all the same -
    // see Na__Scene__ProjectLighting__.
    // ------------------------------------------------------------
    function Na__ProjLightDev__Initialize(context) {
        if (Na__ProjLightDev__Initialized) return true;
        if (!Na__DevGate__IsAuthoringEnabled()) return false;

        const menuItem = document.getElementById(Na__ProjLightDev__ITEM_ID);
        const toggle   = document.getElementById(Na__ProjLightDev__TOGGLE_ID);
        const panel    = document.getElementById(Na__ProjLightDev__PANEL_ID);
        if (!menuItem || !toggle || !panel) return false;                     // <-- Markup absent: nothing to mount into

        Na__ProjLightDev__Panel       = panel;
        Na__ProjLightDev__ShowToast   = (context && context.showToast) || null;
        Na__ProjLightDev__Initialized = true;

        menuItem.style.display = '';                                          // <-- Reveal alongside the other dev tools

        toggle.addEventListener('click', () => {
            const isOpen = panel.classList.contains('is-open');
            panel.classList.toggle('is-open', !isOpen);
            toggle.setAttribute('aria-expanded', String(!isOpen));
            if (!isOpen) Na__ProjLightDev__Render();                         // <-- Rebuilt on each open from what is held
        });

        // THE RECORD ARRIVED, OR A SAVE LANDED | A working change is this
        // panel's own and has refreshed it already; rebuilding on it would
        // take the slider out from under a drag. By the time the record
        // arrives the lights exist, so a section the app config switches off
        // goes here, closed.
        window.addEventListener(Na__ProjLight__CHANGED_EVENT, (event) => {
            const reason = event.detail ? event.detail.reason : null;
            if (reason === 'loaded' && !Na__SceneLighting__IsProjectEnabled()) {
                panel.classList.remove('is-open');
                toggle.setAttribute('aria-expanded', 'false');
                menuItem.style.display = 'none';                              // <-- Switched off in the app config: no section at all
                return;
            }
            if (!Na__ProjLightDev__IsOpen()) return;
            if (reason === 'loaded') Na__ProjLightDev__Render();
            else if (reason === 'saved') Na__ProjLightDev__Refresh();
        });

        // A DRAWING CAME OR WENT, OR NORTH MOVED | Only the words change
        window.addEventListener(Na__DrawView__CHANGED_EVENT, () => { if (Na__ProjLightDev__IsOpen()) Na__ProjLightDev__Refresh(); });
        window.addEventListener(Na__NorthData__CHANGED_EVENT, () => { if (Na__ProjLightDev__IsOpen()) Na__ProjLightDev__Refresh(); });

        // NEVER LOSE WORK | The browser's own leave-site question
        window.addEventListener('beforeunload', (event) => {
            if (!Na__ProjLight__IsPending()) return;
            event.preventDefault();
            event.returnValue = '';
        });

        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Project Lighting Dev Menu API
    // ------------------------------------------------------------
    export {
        Na__ProjLightDev__Initialize
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
