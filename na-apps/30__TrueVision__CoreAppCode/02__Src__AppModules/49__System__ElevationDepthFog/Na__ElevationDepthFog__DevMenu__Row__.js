// =============================================================================
// TRUEVISION3D - ELEVATION DEPTH FOG - DEV MENU ROW
// =============================================================================
//
// FILE       : Na__ElevationDepthFog__DevMenu__Row__.js
// NAMESPACE  : Na__ElevFogRow
// MODULE     : Elevation Depth Fog - Dev Menu Row
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Build the Fog block of a drawing's row in the Dev menu
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - THE BLOCK READS TOP TO BOTTOM AS ADAM ASKED FOR IT: a subheading, FOG;
//   whether this drawing has any; then the three values IN ONE LINE - Depth,
//   End, Fall-off - and under them a sentence saying what the three mean
//   together.
//
// - THE SENTENCE IS THERE BECAUSE "END" CAN BE READ TWO WAYS. It could be where
//   the fog is full, measured from the plane like Depth, or how long the fade
//   runs from Depth. It is the first - both numbers are distances behind the
//   drawing's plane - and rather than leave that to be discovered, the block
//   says it: "fog from 1000 to 15000 mm behind the plane". It follows every
//   edit, and it is where a Depth typed past End shows End being pushed out.
//
// - THREE BOXES ON ONE LINE NEED THEIR LABELS ABOVE THEM. A drawing's row is
//   some 250 px across; three label-box-unit triplets side by side would give
//   each box room for two digits. So each is a small column - the label and
//   its unit over the box - and the three columns share the line equally.
//
// - A BOX IS READ WHEN IT IS LEFT, NOT AS IT IS TYPED IN. The block settles its
//   numbers against each other (End gives way to Depth), and settling on every
//   keystroke would rewrite "15000" under the author's hands at "1". Stepping
//   a box with the arrow keys or its spinner commits each step, which is what
//   makes the fog walk back and forth across the building as the key is held.
//
// - IT KNOWS NOTHING ABOUT ELEVATIONS. It is handed read() and write(patch) and
//   calls onChanged(); which record they reach, and what a change does to a
//   draft or a preview, is its caller's business. The Floor Plans row and the
//   Cross Sections row will take the same block with their own accessors.
//   @delegate: ../40__System__DrawingViewCore/Na__DrawView__StyleRows__.js
//   (the same arrangement, for the style toggles)
//
// INTEGRATION:
// - Na__Elevation__DevMenu__RowBuilders__ places it directly under View depth
//   and above Advanced, and hands it the elevation's accessors.
// - Buttons and the subheading are the shared row shell's, so the block reads
//   as part of the row it sits in.
//   @delegate: ../40__System__DrawingViewCore/Na__DrawView__DevRowShell__.js
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (20-Sep-2026)
// - ValeVision    : not yet ported.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 20-Sep-2026 - Version 1.0.0
// - Initial implementation for the Elevation Depth Fog build.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Fog Config
    // ------------------------------------------------------------
    // @delegate: ./Na__ElevationDepthFog__ConfigState__.js
    // ------------------------------------------------------------
    import {
        Na__ElevFogCfg__IsEnabled,
        Na__ElevFogCfg__GetLimits,
        Na__ElevFogCfg__GetLabel,
        Na__ElevFogCfg__FormatLabel
    } from './Na__ElevationDepthFog__ConfigState__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | The Parts Every Drawing Row Is Made Of
    // ------------------------------------------------------------
    import {
        Na__DrawShell__Button,
        Na__DrawShell__Caption
    } from '../40__System__DrawingViewCore/Na__DrawView__DevRowShell__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Class Names
    // ------------------------------------------------------------
    const Na__ElevFogRow__ROOT_CLASS    = 'na-depthfog-dev';
    const Na__ElevFogRow__OFF_CLASS     = 'na-depthfog-dev--off';
    const Na__ElevFogRow__FIELDS_CLASS  = 'na-depthfog-dev__fields';
    const Na__ElevFogRow__FIELD_CLASS   = 'na-depthfog-dev__field';
    const Na__ElevFogRow__LABEL_CLASS   = 'na-depthfog-dev__label';
    const Na__ElevFogRow__UNIT_CLASS    = 'na-depthfog-dev__unit';
    const Na__ElevFogRow__INPUT_CLASS   = 'na-pm-dev__input na-depthfog-dev__input';
    const Na__ElevFogRow__READOUT_CLASS = 'na-depthfog-dev__readout';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Small Builders
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build One Column: a Label and Its Unit Over a Number Box
    // ------------------------------------------------------------
    // onCommit receives a finite number. A box left empty, or holding something
    // that is not a number, commits nothing - the refresh that follows every
    // commit puts the stored value back, so the box never shows what the
    // record does not hold.
    //
    // A MILLIMETRE BOX (unitText 'mm') ALSO TAKES METRES. The 'm' key is
    // invalid inside a number input and never reaches the box's value, so it
    // is caught on the way down: whatever is typed so far is read as metres,
    // multiplied out to whole millimetres, and written back in place. The
    // usual change handler then commits it exactly as if that many millimetres
    // had been typed directly - mm stays the box's own unit, metres is just a
    // faster way to reach a number in it.
    // ------------------------------------------------------------
    function Na__ElevFogRow__BuildField(labelText, unitText, titleText, min, max, step, onCommit, onAbandon) {
        const field = document.createElement('label');
        field.className = Na__ElevFogRow__FIELD_CLASS;
        field.title     = titleText;

        const label = document.createElement('span');
        label.className   = Na__ElevFogRow__LABEL_CLASS;
        label.textContent = labelText;

        const unit = document.createElement('span');
        unit.className   = Na__ElevFogRow__UNIT_CLASS;
        unit.textContent = unitText;
        label.appendChild(unit);

        const input = document.createElement('input');
        input.type         = 'number';
        input.className    = Na__ElevFogRow__INPUT_CLASS;
        input.min          = String(min);
        input.max          = String(max);
        input.step         = String(step);
        input.inputMode    = 'decimal';
        input.autocomplete = 'off';
        input.addEventListener('change', () => {
            const value = parseFloat(input.value);
            if (Number.isFinite(value)) onCommit(value);
            else onAbandon();
        });

        if (unitText === 'mm') {
            input.addEventListener('keydown', (event) => {
                if (event.key !== 'm' && event.key !== 'M') return;
                event.preventDefault();
                const typedMetres = parseFloat(input.value);
                if (!Number.isFinite(typedMetres)) return;
                input.value = String(Math.round(typedMetres * 1000));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            });
        }

        field.appendChild(label);
        field.appendChild(input);
        return { field, input };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Build the Fog Block for One Drawing
    // ------------------------------------------------------------
    // context: {
    //   read()       - the drawing's fog as { enabled, startDepthMm, endDepthMm,
    //                  falloffPercent }
    //   write(patch) - change some of it; answers what is now stored
    //   onChanged()  - an edit has landed on the record
    // }
    // Returns { element, refresh }, or null when the whole system is switched
    // off in config - the caller simply appends nothing. refresh re-reads the
    // record, for a revert or anything else that changes it from outside.
    // ------------------------------------------------------------
    function Na__ElevFogRow__Build(context) {
        if (!Na__ElevFogCfg__IsEnabled()) return null;
        if (!context || typeof context.read !== 'function' || typeof context.write !== 'function') return null;

        const limits  = Na__ElevFogCfg__GetLimits();
        const changed = () => { if (typeof context.onChanged === 'function') context.onChanged(); };

        const element = document.createElement('div');
        element.className = Na__ElevFogRow__ROOT_CLASS;

        // SUBHEADING | "Fog", in the row's own caption style
        element.appendChild(Na__DrawShell__Caption(Na__ElevFogCfg__GetLabel('Caption', 'Fog')));

        // OFF / ON | Two states of one drawing, so a pair of buttons - the same
        // idiom as Elevation / Section directly above it in the row.
        const choice = document.createElement('div');
        choice.className = 'na-pm-dev__actions na-draw-dev__choice';

        const offBtn = Na__DrawShell__Button(
            Na__ElevFogCfg__GetLabel('OffLabel', 'Off'), '',
            Na__ElevFogCfg__GetLabel('OffTitle', 'No fog on this drawing. The three values are kept for when it is switched on.'),
            () => commit({ enabled : false })
        );
        const onBtn = Na__DrawShell__Button(
            Na__ElevFogCfg__GetLabel('OnLabel', 'On'), '',
            Na__ElevFogCfg__GetLabel('OnTitle', 'Fade what lies behind the drawing\'s plane into the paper - surfaces and linework alike - in the 3D view and on every sheet that draws it.'),
            () => commit({ enabled : true })
        );
        choice.appendChild(offBtn);
        choice.appendChild(onBtn);
        element.appendChild(choice);

        // THE THREE VALUES | One line: Depth, End, Fall-off
        const fields = document.createElement('div');
        fields.className = Na__ElevFogRow__FIELDS_CLASS;

        const depthUnit = Na__ElevFogCfg__GetLabel('DepthUnit', 'mm');
        const start = Na__ElevFogRow__BuildField(
            Na__ElevFogCfg__GetLabel('StartField', 'Depth'), depthUnit,
            Na__ElevFogCfg__GetLabel('StartTitle', 'Where the fog starts: how far BEHIND the drawing\'s plane, away from the viewer. 1000 starts it a metre into the building.'),
            0, limits.maxDepthMm, limits.depthStepMm,
            (value) => commit({ startDepthMm : value }), () => refresh()
        );
        const end = Na__ElevFogRow__BuildField(
            Na__ElevFogCfg__GetLabel('EndField', 'End'), depthUnit,
            Na__ElevFogCfg__GetLabel('EndTitle', 'Where the fog is full, measured from the same plane. Everything beyond it is gone.'),
            0, limits.maxDepthMm, limits.depthStepMm,
            (value) => commit({ endDepthMm : value }), () => refresh()
        );
        const falloff = Na__ElevFogRow__BuildField(
            Na__ElevFogCfg__GetLabel('FalloffField', 'Fall-off'), Na__ElevFogCfg__GetLabel('FalloffUnit', '%'),
            Na__ElevFogCfg__GetLabel('FalloffTitle', 'How hard the fog comes on, 0 to 100: how fogged the drawing is half way between Depth and End. 50 is an even fade. Higher is more aggressive and reads denser; lower holds off until late.'),
            0, 100, limits.falloffStepPercent,
            (value) => commit({ falloffPercent : value }), () => refresh()
        );
        fields.appendChild(start.field);
        fields.appendChild(end.field);
        fields.appendChild(falloff.field);
        element.appendChild(fields);

        // WHAT THE THREE MEAN TOGETHER | Says which way End is measured
        const readout = document.createElement('div');
        readout.className = Na__ElevFogRow__READOUT_CLASS;
        element.appendChild(readout);

        // Re-reads the record. Never rewrites a box somebody is typing in.
        function refresh() {
            const fog = context.read();

            offBtn.classList.toggle('na-pm-dev__btn--primary', !fog.enabled);
            onBtn.classList.toggle('na-pm-dev__btn--primary', fog.enabled);
            offBtn.setAttribute('aria-pressed', String(!fog.enabled));
            onBtn.setAttribute('aria-pressed', String(fog.enabled));
            element.classList.toggle(Na__ElevFogRow__OFF_CLASS, !fog.enabled);

            if (document.activeElement !== start.input)   start.input.value   = String(fog.startDepthMm);
            if (document.activeElement !== end.input)     end.input.value     = String(fog.endDepthMm);
            if (document.activeElement !== falloff.input) falloff.input.value = String(fog.falloffPercent);

            readout.textContent = Na__ElevFogCfg__FormatLabel(
                fog.enabled ? 'ReadoutOn' : 'ReadoutOff',
                fog.enabled ? 'fog from {start} to {end} mm behind the plane - {falloff}% by half way'
                            : 'off - would run {start} to {end} mm behind the plane',
                { start : fog.startDepthMm, end : fog.endDepthMm, band : fog.endDepthMm - fog.startDepthMm, falloff : fog.falloffPercent }
            );
        }

        // One edit: write it, show what the record now holds - which may not be
        // what was typed, if End had to give way - and tell the caller. The box
        // that was typed in is blurred-or-not by the browser, not by this, so
        // its value is set outright: it is the one box that must show the
        // settled number and the focus guard above would skip it.
        function commit(patch) {
            const settled = context.write(patch);
            if (Number.isFinite(patch.startDepthMm))   start.input.value   = String(settled.startDepthMm);
            if (Number.isFinite(patch.endDepthMm))     end.input.value     = String(settled.endDepthMm);
            if (Number.isFinite(patch.falloffPercent)) falloff.input.value = String(settled.falloffPercent);
            refresh();
            changed();
        }

        refresh();
        return { element, refresh };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Elevation Depth Fog Dev Menu Row API
    // ------------------------------------------------------------
    export {
        Na__ElevFogRow__Build
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
