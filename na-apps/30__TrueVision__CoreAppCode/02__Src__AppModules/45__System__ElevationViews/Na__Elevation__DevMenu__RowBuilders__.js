// =============================================================================
// TRUEVISION3D - ELEVATION VIEWS - DEV MENU ROW BUILDERS
// =============================================================================
//
// FILE       : Na__Elevation__DevMenu__RowBuilders__.js
// NAMESPACE  : Na__ElevRow
// MODULE     : Elevation Views - Dev Menu Row Builders
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Build the DOM for one elevation's row in the Dev menu
// CREATED    : 07-Sep-2026
//
// DESCRIPTION:
// - Purely presentational. Every action is handed back to the editor through
//   the handlers object, so this module holds no state, saves nothing and
//   knows nothing about R2, drafts or the section cut engine.
//
// - A ROW READS TOP TO BOTTOM AS: WHAT IT IS, WHERE IT IS, WHAT TO DO.
//     WHAT IT IS   - its name, and under it a sentence saying which elevation
//                    this is, read off the project's north. The sentence is a
//                    statement, not a control: there used to be four compass
//                    buttons here that set the bearing against the model's own
//                    axis and called it north, and on a project whose north is
//                    anywhere else they lied (PS01's South Elevation showed
//                    "West" pressed).
//     WHERE IT IS  - the plane's controls in the 3D view, elevation or section,
//                    the two sliders that move the plane bodily, and how deep
//                    it has cut. The derived depth is shown live because the
//                    two sliders do not contribute to it equally.
//     WHAT TO DO   - Preview and Annotate to look; Update and Revert to keep or
//                    throw away. Delete is not here: it sits below a rule the
//                    editor draws at the foot of the row.
//   The model bearing itself - a number only needed for a building that is not
//   square to anything - is under Advanced, folded. Aim at face sets it.
//
// - THE NAME NAMES ITSELF. Left alone it follows the direction ("East
//   Elevation"); typed over, it is the author's ("Coach House East
//   Elevation") and the sentence underneath still says which elevation it is.
//   Clearing the box hands it back. @delegate: ./Na__Elevation__AutoName__.js
//
// - Dragging a slider fires the live handler on every input event and the
//   commit handler once on release, which is what lets the editor move the
//   plane and recut cheaply while dragging and exactly on drop.
//
// INTEGRATION:
// - Na__Elevation__DevMenu__Editor__ supplies the handlers and folds the
//   returned row behind its header.
// // @delegate: ../40__System__DrawingViewCore/Na__DrawView__DevRowShell__.js
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 20-Sep-2026 - Version 2.1.0 (Elevation Depth Fog)
// - A Fog block directly under View depth and above Advanced: a subheading,
//   Off / On, then Depth, End and Fall-off on one line and a sentence under
//   them. The block is the fog system's own and is handed this elevation's
//   accessors; an edit goes back through the new onFogChange handler. The row
//   answers refreshFog alongside its other refreshers.
//
// 20-Sep-2026 - Version 2.0.0 (Floor Plans and Elevations menu rebuild)
// - "Viewed from" and its four compass buttons are gone. In their place a
//   compass mark and one sentence, from the project's north, saying which
//   elevation this is - or that north has not been set.
// - The name box auto-populates from the direction and can be typed over;
//   a custom name offers a way back.
// - The bearing field moved under a folded Advanced, renamed Model bearing.
// - Save Thumbnail and Delete left the action row. Actions are Preview,
//   Annotate, a green Update and Revert, from the shared row shell.
// - The plane controls and the card status are handed in by the editor and
//   placed here, so the row has one reading order.
//
// 07-Sep-2026 - Version 1.0.0
// - Initial implementation for the Elevation Drawings build.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Elevation Config and Derived Geometry
    // ------------------------------------------------------------
    // @delegate: ./Na__Elevation__ConfigState__.js
    // @delegate: ./Na__Elevation__ProjectJson__Data__.js
    // ------------------------------------------------------------
    import {
        Na__ElevCfg__GetDirectionSetup,
        Na__ElevCfg__GetPlaneOriginRangeMm,
        Na__ElevCfg__GetViewDepthMaxMm,
        Na__ElevCfg__GetLabel,
        Na__ElevCfg__FormatLabel
    } from './Na__Elevation__ConfigState__.js';
    import {
        Na__ElevData__GetPlaneOriginMm,
        Na__ElevData__SetPlaneOriginMm,
        Na__ElevData__GetPlaneDistanceMm,
        Na__ElevData__GetDepthFog,
        Na__ElevData__SetDepthFog,
        Na__ElevData__IsSection,
        Na__ElevData__MODE_ELEVATION,
        Na__ElevData__MODE_SECTION
    } from './Na__Elevation__ProjectJson__Data__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | The Fog Block of a Drawing's Row
    // ------------------------------------------------------------
    // Built by the fog system and only PLACED here: it is handed this
    // elevation's accessors and knows nothing else about elevations, which is
    // what lets the Floor Plans and Cross Sections rows take the same block.
    // ------------------------------------------------------------
    import { Na__ElevFogRow__Build } from '../49__System__ElevationDepthFog/Na__ElevationDepthFog__DevMenu__Row__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | The Name and the Sentence Under It
    // ------------------------------------------------------------
    import {
        Na__ElevName__IsAuto,
        Na__ElevName__Derive,
        Na__ElevName__Statement
    } from './Na__Elevation__AutoName__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | The Parts Every Drawing Row Is Made Of
    // ------------------------------------------------------------
    import {
        Na__DrawShell__Button,
        Na__DrawShell__Caption,
        Na__DrawShell__BuildCommitActions,
        Na__DrawShell__BuildAdvanced
    } from '../40__System__DrawingViewCore/Na__DrawView__DevRowShell__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Input Bounds
    // ------------------------------------------------------------
    const Na__ElevRow__DEPTH_STEP_MM  = 100;
    const Na__ElevRow__AZIMUTH_MIN    = 0;
    const Na__ElevRow__AZIMUTH_MAX    = 359;
    // ------------------------------------------------------------

    // MODULE CONSTANTS | The Compass Mark (SVG user units)
    // ------------------------------------------------------------
    const Na__ElevRow__SVG_NS        = 'http://www.w3.org/2000/svg';
    const Na__ElevRow__MARK_SIZE     = 34;
    const Na__ElevRow__MARK_RADIUS   = 13;
    const Na__ElevRow__MARK_BUILDING = 8;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Generic Control Builders
// -----------------------------------------------------------------------------

    // FUNCTION | Build a Dev Menu Button
    // ------------------------------------------------------------
    function Na__ElevRow__BuildButton(text, modifierClass, onClick) {
        return Na__DrawShell__Button(text, modifierClass, '', onClick);
    }
    // ------------------------------------------------------------


    // FUNCTION | Build a Labelled Number Input Row
    // ------------------------------------------------------------
    // onChange receives a finite number, or null when the field is cleared.
    // ------------------------------------------------------------
    function Na__ElevRow__BuildNumberRow(labelText, value, min, max, step, placeholder, unitText, onChange) {
        const row = document.createElement('div');
        row.className = 'na-dropdown-menu__panel-row';

        const caption = document.createElement('span');
        caption.className   = 'na-dropdown-menu__value';
        caption.textContent = labelText;

        const input = document.createElement('input');
        input.type      = 'number';
        input.className = 'na-pm-dev__input na-pm-dev__input--short';
        if (Number.isFinite(min))  input.min  = String(min);
        if (Number.isFinite(max))  input.max  = String(max);
        if (Number.isFinite(step)) input.step = String(step);
        input.value       = Number.isFinite(value) ? String(value) : '';
        input.placeholder = placeholder || '';
        input.addEventListener('change', () => {
            onChange(input.value === '' ? null : parseFloat(input.value));
        });

        const unit = document.createElement('span');
        unit.className   = 'na-dropdown-menu__value';
        unit.textContent = unitText || 'mm';

        row.appendChild(caption);
        row.appendChild(input);
        row.appendChild(unit);
        return { row, input };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | What It Is - the Name and Which Elevation
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Draw the Compass Mark
    // ------------------------------------------------------------
    // North up. A ring, the building as a square at its centre, and the
    // viewer as a dot on the ring at their TRUE bearing with the line of
    // sight running in to the face they are looking at - so the mark is a
    // plan of the sentence beside it. trueBearingDeg null draws the ring and
    // the building alone, greyed: nothing is known, so nothing is pointed at.
    // ------------------------------------------------------------
    function Na__ElevRow__DrawCompassMark(svg, trueBearingDeg) {
        while (svg.firstChild) svg.removeChild(svg.firstChild);

        const centre = Na__ElevRow__MARK_SIZE / 2;
        const radius = Na__ElevRow__MARK_RADIUS;
        const half   = Na__ElevRow__MARK_BUILDING / 2;
        const known  = Number.isFinite(trueBearingDeg);

        const make = (tag, attributes) => {
            const node = document.createElementNS(Na__ElevRow__SVG_NS, tag);
            Object.keys(attributes).forEach((key) => node.setAttribute(key, String(attributes[key])));
            svg.appendChild(node);
            return node;
        };

        make('circle', { cx : centre, cy : centre, r : radius, class : 'na-elev-dev__mark-ring' });
        make('line',   { x1 : centre, y1 : centre - radius - 3, x2 : centre, y2 : centre - radius + 3, class : 'na-elev-dev__mark-north' });
        make('rect',   { x : centre - half, y : centre - half, width : half * 2, height : half * 2, class : 'na-elev-dev__mark-building' });

        if (known) {
            const angle = trueBearingDeg * (Math.PI / 180);
            const dirX  = Math.sin(angle);
            const dirY  = -Math.cos(angle);                                       // <-- Screen y runs down; north is up
            make('line', {
                x1 : centre + (dirX * radius), y1 : centre + (dirY * radius),
                x2 : centre + (dirX * (half + 1.5)), y2 : centre + (dirY * (half + 1.5)),
                class : 'na-elev-dev__mark-sight'
            });
            make('circle', { cx : centre + (dirX * radius), cy : centre + (dirY * radius), r : 3, class : 'na-elev-dev__mark-viewer' });
        }
        svg.classList.toggle('na-elev-dev__mark--unknown', !known);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Name Box, and Which Elevation This Is
    // ------------------------------------------------------------
    // Returns { element, refresh }. refresh re-reads the record: the name may
    // have been rewritten by a change of direction, and the sentence always
    // is. onNameTyped(text) and onUseAutoName() are the editor's.
    // ------------------------------------------------------------
    function Na__ElevRow__BuildIdentity(elevation, handlers) {
        const element = document.createElement('div');
        element.className = 'na-elev-dev__identity';

        const input = document.createElement('input');
        input.type         = 'text';
        input.className    = 'na-pm-dev__input na-fp-dev__name';
        input.spellcheck   = false;
        input.autocomplete = 'off';
        input.addEventListener('change', () => handlers.onNameTyped(input.value));
        element.appendChild(input);

        const facing = document.createElement('div');
        facing.className = 'na-elev-dev__facing';

        const mark = document.createElementNS(Na__ElevRow__SVG_NS, 'svg');
        mark.setAttribute('class', 'na-elev-dev__mark');
        mark.setAttribute('viewBox', '0 0 ' + Na__ElevRow__MARK_SIZE + ' ' + Na__ElevRow__MARK_SIZE);
        mark.setAttribute('width', String(Na__ElevRow__MARK_SIZE));
        mark.setAttribute('height', String(Na__ElevRow__MARK_SIZE));
        mark.setAttribute('aria-hidden', 'true');
        facing.appendChild(mark);

        const words = document.createElement('div');
        words.className = 'na-elev-dev__facing-words';

        const sentence = document.createElement('div');
        sentence.className = 'na-elev-dev__facing-sentence';
        words.appendChild(sentence);

        const detail = document.createElement('div');
        detail.className = 'na-elev-dev__facing-detail';
        words.appendChild(detail);

        facing.appendChild(words);
        element.appendChild(facing);

        const useAuto = Na__DrawShell__Button('', 'na-elev-dev__use-auto', '', () => handlers.onUseAutoName());
        element.appendChild(useAuto);

        const refresh = () => {
            const told    = Na__ElevName__Statement(elevation);
            const isAuto  = Na__ElevName__IsAuto(elevation);
            const derived = Na__ElevName__Derive(elevation);

            if (document.activeElement !== input) input.value = elevation.Elevation__Name;   // <-- Never rewrite a box somebody is typing in
            input.title = isAuto
                ? 'Named from the way it faces. Type over it to give it a name of its own - "Coach House East Elevation". '
                  + 'Also the label on its carousel card.'
                : 'A name of its own. Clear the box to name it from the way it faces again. Also the label on its carousel card.';
            input.classList.toggle('na-elev-dev__name--auto', isAuto);

            sentence.textContent = told.text;
            sentence.classList.toggle('na-elev-dev__facing-sentence--unknown', !told.known);

            detail.textContent = told.known
                ? 'True bearing ' + Math.round(told.trueBearingDeg) + ' deg'
                  + (isAuto ? ' - the name follows this.' : ' - this drawing has a name of its own.')
                : (isAuto ? 'The name will follow its direction once north is set.' : '');
            detail.hidden = detail.textContent === '';

            Na__ElevRow__DrawCompassMark(mark, told.known ? told.trueBearingDeg : null);

            // THE WAY BACK | Only when there is a name to go back to.
            useAuto.hidden      = isAuto || derived === '';
            useAuto.textContent = 'Name it "' + derived + '"';
            useAuto.title       = 'Drop the typed name and name this drawing from the way it faces.';
        };
        refresh();

        return { element, refresh };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Where It Is - Drawing Type and the Plane
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build the Elevation / Section Choice
    // ------------------------------------------------------------
    // Two states of one drawing rather than two drawings, so a pair of
    // buttons rather than a separate row per type.
    // ------------------------------------------------------------
    function Na__ElevRow__BuildModeChoice(elevation, onChanged) {
        const wrapper = document.createElement('div');
        wrapper.className = 'na-pm-dev__actions na-draw-dev__choice';

        const elevationBtn = Na__ElevRow__BuildButton(
            Na__ElevCfg__GetLabel('ModeElevationLabel', 'Elevation'), '', () => {
                elevation.Elevation__Mode = Na__ElevData__MODE_ELEVATION;
                refreshPressed();
                onChanged();
            }
        );
        elevationBtn.title = 'Draw the building whole - nothing is cut.';

        const sectionBtn = Na__ElevRow__BuildButton(
            Na__ElevCfg__GetLabel('ModeSectionLabel', 'Section'), '', () => {
                elevation.Elevation__Mode = Na__ElevData__MODE_SECTION;
                refreshPressed();
                onChanged();
            }
        );
        sectionBtn.title = 'Cut the building at the plane and draw what is beyond it.';

        const refreshPressed = () => {
            const isSection = Na__ElevData__IsSection(elevation);
            elevationBtn.classList.toggle('na-pm-dev__btn--primary', !isSection);
            sectionBtn.classList.toggle('na-pm-dev__btn--primary', isSection);
            elevationBtn.setAttribute('aria-pressed', String(!isSection));
            sectionBtn.setAttribute('aria-pressed', String(isSection));
        };
        refreshPressed();

        wrapper.appendChild(elevationBtn);
        wrapper.appendChild(sectionBtn);
        return { wrapper, refreshPressed };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build One Axis Slider for the Drawing Plane
    // ------------------------------------------------------------
    // read/write are the two halves of "which world axis is this", handed in
    // so the X and Z sliders are one function rather than two near-copies.
    // ------------------------------------------------------------
    function Na__ElevRow__BuildPlaneSlider(elevation, labelText, read, write, onLive, onCommit, refreshReadout) {
        const range = Na__ElevCfg__GetPlaneOriginRangeMm();

        const wrapper = document.createElement('div');
        wrapper.className = 'na-fp-dev__slider-row';

        const caption = document.createElement('span');
        caption.className   = 'na-elev-dev__axis-label';
        caption.textContent = labelText;

        const slider = document.createElement('input');
        slider.type      = 'range';
        slider.className = 'na-fp-dev__slider';
        slider.min       = String(range.minMm);
        slider.max       = String(range.maxMm);
        slider.step      = String(range.stepMm);
        slider.value     = String(read(elevation));

        const value = document.createElement('span');
        value.className = 'na-elev-dev__axis-value';

        const refreshValue = () => {
            value.textContent = Math.round(read(elevation)) + ' mm';
            slider.value      = String(Math.round(read(elevation)));
        };
        refreshValue();

        slider.addEventListener('input', () => {
            write(elevation, parseFloat(slider.value));
            refreshValue();
            refreshReadout();
            onLive();                                                            // <-- Throttled recut and live plane while dragging
        });
        slider.addEventListener('change', () => {
            write(elevation, parseFloat(slider.value));
            refreshValue();
            refreshReadout();
            onCommit();                                                          // <-- Exact recut on release
        });

        wrapper.appendChild(caption);
        wrapper.appendChild(slider);
        wrapper.appendChild(value);
        return { wrapper, refreshValue };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Derived Cut Depth Readout
    // ------------------------------------------------------------
    // The number the two sliders actually control between them. Shown because
    // moving the plane perpendicular to the view changes it not at all, and a
    // slider that visibly does nothing is worse than no slider.
    // ------------------------------------------------------------
    function Na__ElevRow__BuildDepthReadout(elevation) {
        const readout = document.createElement('div');
        readout.className = 'na-elev-dev__readout';

        const refresh = () => {
            readout.textContent = Na__ElevCfg__FormatLabel(
                'CutDepthReadoutFormat', 'cut {depth} mm into the model',
                { depth: Math.round(Na__ElevData__GetPlaneDistanceMm(elevation)) }
            );
        };
        refresh();

        return { readout, refresh };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Model Bearing Field (for Advanced)
    // ------------------------------------------------------------
    // The number an elevation's direction is STORED as: the bearing of the
    // viewer's side against the model's own -Z axis, not against north. It is
    // what Aim at face writes, and it only needs typing for a building that
    // is square to nothing - which is why it lives under Advanced and the
    // sentence at the top of the row is what says which elevation this is.
    // ------------------------------------------------------------
    function Na__ElevRow__BuildBearingField(elevation, onChanged) {
        const direction = Na__ElevCfg__GetDirectionSetup();

        const wrapper = document.createElement('div');
        wrapper.className = 'na-elev-dev__bearing';

        const field = Na__ElevRow__BuildNumberRow(
            Na__ElevCfg__GetLabel('ModelBearingFieldLabel', 'Model bearing'), elevation.Elevation__AzimuthDeg,
            Na__ElevRow__AZIMUTH_MIN, Na__ElevRow__AZIMUTH_MAX, direction.stepDeg, '', 'deg',
            (value) => {
                if (!Number.isFinite(value)) {
                    field.input.value = String(elevation.Elevation__AzimuthDeg); // <-- A direction is the one thing that cannot be blank
                    return;
                }
                elevation.Elevation__AzimuthDeg = ((value % 360) + 360) % 360;
                field.input.value = String(elevation.Elevation__AzimuthDeg);
                onChanged();
            }
        );
        field.input.title = 'Which side of the building the viewer stands on, clockwise from the model\'s own -Z axis. '
                          + 'Aim at face sets this for you.';
        wrapper.appendChild(field.row);

        const note = document.createElement('p');
        note.className   = 'na-fp-dev__empty';
        note.textContent = Na__ElevCfg__GetLabel('ModelBearingNote',
            'Measured against the model\'s own axes, not north. Aim at face sets it by clicking a wall; type it only for '
            + 'a building that is square to nothing. Which elevation this makes it is stated at the top of the row.');
        wrapper.appendChild(note);

        const refresh = () => { field.input.value = String(elevation.Elevation__AzimuthDeg); };
        return { wrapper, refresh };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Row Assembly
// -----------------------------------------------------------------------------

    // FUNCTION | Build One Elevation's Complete Editor Row
    // ------------------------------------------------------------
    // handlers: {
    //   isActive, isEditMode,
    //   planeControls   - element | null : Show plane / Move to face / Aim at face
    //   sceneLinkRow    - element | null : the carousel card's status
    //   onNameTyped(text), onUseAutoName(),
    //   onDirectionChange, onModeChange,
    //   onPlaneLive, onPlaneCommit, onDepthChange, onFogChange, onCentrePlane,
    //   onPreviewToggle, onAnnotate, onUpdate, onRevert
    // }
    // Returns { row, refreshDraft(state), refreshIdentity(), refreshFog() }.
    // The editor folds `row` behind a header and adds the danger zone beneath it.
    // ------------------------------------------------------------
    function Na__ElevRow__BuildElevationRow(elevation, handlers) {
        const rowRoot = document.createElement('div');
        rowRoot.className = 'na-fp-dev__row' + (handlers.isActive ? ' na-fp-dev__row--active' : '');

        // WHAT IT IS | Its name, and which elevation of the building this is
        const identity = Na__ElevRow__BuildIdentity(elevation, handlers);
        rowRoot.appendChild(identity.element);

        // WHERE IT IS | The plane in the 3D view, first: it is the quickest way
        // to put an elevation where it belongs and to point it at a wall.
        const depth = Na__ElevRow__BuildDepthReadout(elevation);

        if (handlers.planeControls) {
            rowRoot.appendChild(Na__DrawShell__Caption(Na__ElevCfg__GetLabel('PlaneControlsCaption', 'Plane in the 3D view')));
            rowRoot.appendChild(handlers.planeControls);
        }

        // DRAWING TYPE | The same drawing with the cut on or off
        rowRoot.appendChild(Na__DrawShell__Caption(Na__ElevCfg__GetLabel('ModeFieldLabel', 'Drawing type')));
        rowRoot.appendChild(Na__ElevRow__BuildModeChoice(elevation, () => {
            identity.refresh();                                                  // <-- "East Elevation" becomes "East Section"
            handlers.onModeChange();
        }).wrapper);

        // DRAWING PLANE | The two controls that move it through the model
        rowRoot.appendChild(Na__DrawShell__Caption(Na__ElevCfg__GetLabel('PlanePositionCaption', 'Plane position')));
        const sliderX = Na__ElevRow__BuildPlaneSlider(
            elevation,
            Na__ElevCfg__GetLabel('PlaneXFieldLabel', 'Plane X'),
            (record) => Na__ElevData__GetPlaneOriginMm(record).xMm,
            (record, value) => Na__ElevData__SetPlaneOriginMm(record, value, null),
            handlers.onPlaneLive, handlers.onPlaneCommit, depth.refresh
        );
        const sliderZ = Na__ElevRow__BuildPlaneSlider(
            elevation,
            Na__ElevCfg__GetLabel('PlaneZFieldLabel', 'Plane Z'),
            (record) => Na__ElevData__GetPlaneOriginMm(record).zMm,
            (record, value) => Na__ElevData__SetPlaneOriginMm(record, null, value),
            handlers.onPlaneLive, handlers.onPlaneCommit, depth.refresh
        );
        rowRoot.appendChild(sliderX.wrapper);
        rowRoot.appendChild(sliderZ.wrapper);
        rowRoot.appendChild(depth.readout);

        const centreActions = document.createElement('div');
        centreActions.className = 'na-pm-dev__actions';
        centreActions.appendChild(Na__ElevRow__BuildButton(
            Na__ElevCfg__GetLabel('CentrePlaneLabel', 'Centre on model'), '',
            () => {
                handlers.onCentrePlane();
                sliderX.refreshValue();
                sliderZ.refreshValue();
                depth.refresh();
            }
        ));
        rowRoot.appendChild(centreActions);

        // VIEW DEPTH | Optional. Blank is the ordinary infinite cut backward,
        // needed only when the far side of the building would otherwise clutter
        // a section.
        rowRoot.appendChild(Na__ElevRow__BuildNumberRow(
            Na__ElevCfg__GetLabel('ViewDepthFieldLabel', 'View depth'),
            elevation.Elevation__ViewDepthMm,
            0, Na__ElevCfg__GetViewDepthMaxMm(), Na__ElevRow__DEPTH_STEP_MM,
            Na__ElevCfg__GetLabel('ViewDepthPlaceholder', 'Full'), 'mm',
            (value) => {
                elevation.Elevation__ViewDepthMm = (Number.isFinite(value) && value > 0) ? value : null;
                handlers.onDepthChange();
            }
        ).row);

        // FOG | This drawing's own depth fog: whether it has any, and the three
        // values on one line. Directly under View depth because both are about
        // how far back the drawing reads - one cuts the distance off, the other
        // fades it out - and an author reaching for one is thinking about the
        // other. Null when the fog system is switched off in its config.
        // @delegate: ../49__System__ElevationDepthFog/Na__ElevationDepthFog__DevMenu__Row__.js
        const fog = Na__ElevFogRow__Build({
            read      : () => Na__ElevData__GetDepthFog(elevation),
            write     : (patch) => Na__ElevData__SetDepthFog(elevation, patch),
            onChanged : handlers.onFogChange
        });
        if (fog) rowRoot.appendChild(fog.element);

        // ADVANCED | The stored bearing, for the building that needs it typed
        const advanced = Na__DrawShell__BuildAdvanced(elevation.Elevation__Id, 'Advanced');
        const bearing  = Na__ElevRow__BuildBearingField(elevation, () => {
            depth.refresh();                                                     // <-- A new bearing changes how deep the plane reaches
            identity.refresh();                                                  // <-- And which elevation this is
            handlers.onDirectionChange();
        });
        advanced.body.appendChild(bearing.wrapper);
        rowRoot.appendChild(advanced.element);

        // WHAT TO DO | Look, then keep or throw away
        const actions = Na__DrawShell__BuildCommitActions({
            isActive         : handlers.isActive,
            isEditMode       : handlers.isEditMode,
            drawingWord      : 'elevation',
            previewLabel     : Na__ElevCfg__GetLabel('PreviewLabel', 'Preview'),
            exitPreviewLabel : Na__ElevCfg__GetLabel('ExitPreviewLabel', 'Exit Preview'),
            annotateLabel    : Na__ElevCfg__GetLabel('AnnotateLabel', 'Annotate'),
            updateLabel      : Na__ElevCfg__GetLabel('UpdateLabel', 'Update Elevation'),
            revertLabel      : Na__ElevCfg__GetLabel('RevertLabel', 'Revert'),
            onPreviewToggle  : handlers.onPreviewToggle,
            onAnnotate       : handlers.onAnnotate,
            onUpdate         : handlers.onUpdate,
            onRevert         : handlers.onRevert
        });
        rowRoot.appendChild(actions.element);

        if (handlers.sceneLinkRow) rowRoot.appendChild(handlers.sceneLinkRow);

        return {
            row             : rowRoot,
            refreshDraft    : actions.refresh,
            refreshIdentity : () => { identity.refresh(); bearing.refresh(); },
            refreshFog      : () => { if (fog) fog.refresh(); }
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Elevation Dev Menu Row Builder API
    // ------------------------------------------------------------
    export {
        Na__ElevRow__BuildButton,
        Na__ElevRow__BuildNumberRow,
        Na__ElevRow__BuildElevationRow
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
