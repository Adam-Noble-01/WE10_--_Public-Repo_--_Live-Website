// =============================================================================
// TRUEVISION3D - VISUAL EFFECTS USER CONTROLS
// =============================================================================
//
// FILE       : Na__UiFeature__VisualEffects__Controls.js
// NAMESPACE  : Na__UiFeature
// MODULE     : Visual Effects User Controls
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : User-facing Visual Effects section inside Tools and Settings ->
//              App Settings, with a frame rate and refinement readout
// CREATED    : 16-Sep-2026
//
// DESCRIPTION:
// - One folded section holding the three render effects a user might actually
//   want to turn off on a slow machine, and the two numbers that tell them
//   whether they need to:
//     Progressive Renderer  - idle-time supersampling of the 3D viewport
//     Profile Lines         - the architectural edge outline pass
//     Ambient Occlusion     - SSAO, previously the top-level "Shadows" row
//     Frame Rate            - average of recent continuously rendered frames
//     Refinement            - how far the settled picture has got, 0 to 16
// - Folded by default. Nothing here polls or costs anything until the section
//   is opened; the readout timer starts on open and stops on close.
//
// THE BADGES READ THE PASSES, THEY DO NOT REMEMBER CLICKS:
// - Profile Lines and SSAO report pass.enabled rather than a local flag. Both
//   can be changed by something other than this panel - a drawing view
//   borrowing the pipeline, and in SSAO's case the performance monitor
//   switching itself off when the frame rate drops - and a badge that only
//   tracked its own clicks would confidently show ON over a picture that has
//   neither.
// - A pass the pipeline does not have reads as a disabled row rather than a
//   lie: profile lines can be off for the whole model in AppConfig, and SSAO
//   likewise.
//
// PROFILE LINES ARE ONE SWITCH FOR TWO RENDERERS:
// - The 3D viewport's Sobel pass lives in the composer; a 2D drawing bypasses
//   the composer entirely and inks its own outline through Na__DrawProfile__.
//   Turning profile lines off has to mean off on both, or the setting would
//   silently come back the moment a plan was opened. The caller passes the
//   drawing-side setter in, so this module stays free of a dependency on the
//   drawing view core.
//
// INTEGRATION:
// - Call Na__UiFeature__InitializeVisualEffectsControls({ pipelineRef,
//   setDrawingProfileLines }) from Index.html after the loading sequence has
//   started. pipelineRef is the same mutable { current } the rest of the app
//   follows.
// - The Progressive Renderer row drives the refiner registered by the render
//   loop. Before the loop exists the row reads as unavailable.
//   @delegate: ./Na__RenderEffect__ProgressiveRefine__.js
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 05__RenderPipeline/Na__UiFeature__VisualEffects__Controls.js 1.0.0
// - Ported on     : 16-Sep-2026 for TrueVision3D v2.56.0
// - Divergences   : the profile-lines row also drives the drawing-view outline
//                   (ValeVision has no equivalent), and there is no Dev Tools
//                   profile-lines row here to stay in step with, so the
//                   na-profile-lines-changed round trip is not needed. The AO
//                   row listens for na-ao-disabled so the performance monitor
//                   switching SSAO off shows immediately rather than at the
//                   next poll.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 16-Sep-2026 - Version 1.0.0
// - Initial implementation, replacing the top-level Shadows and Profile Lines
//   rows that used to sit loose in the Tools menu.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Render Loop Invalidation
    // ------------------------------------------------------------
    import { Na__RenderLoop__RequestRender } from './Na__RenderLoop__Invalidation.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Progressive Refinement
    // ------------------------------------------------------------
    import { Na__ProgressiveRefine__GetActive } from './Na__RenderEffect__ProgressiveRefine__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | DOM Element IDs
    // ------------------------------------------------------------
    const Na__Vfx__ToggleId          = 'naVisualEffectsToggle';         // <-- Section open/close button
    const Na__Vfx__PanelId           = 'naVisualEffectsPanel';          // <-- Collapsible section panel
    const Na__Vfx__ProgressiveBtnId  = 'naVfxProgressiveToggle';        // <-- Progressive Renderer row
    const Na__Vfx__ProgressiveStatId = 'naVfxProgressiveStatus';
    const Na__Vfx__ProfileBtnId      = 'naVfxProfileLinesToggle';       // <-- Profile Lines row
    const Na__Vfx__ProfileStatId     = 'naVfxProfileLinesStatus';
    const Na__Vfx__SsaoBtnId         = 'naVfxSsaoToggle';               // <-- Ambient Occlusion row
    const Na__Vfx__SsaoStatId        = 'naVfxSsaoStatus';
    const Na__Vfx__FrameRateId       = 'naVfxFrameRateValue';           // <-- Frame rate readout
    const Na__Vfx__RefineId          = 'naVfxRefineValue';              // <-- Refinement progress readout
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Row State Classes
    // ------------------------------------------------------------
    const Na__Vfx__ActiveClass      = 'na-dev-toggle--active';          // <-- Lights the row's indicator
    const Na__Vfx__UnavailableClass = 'na-dev-toggle--unavailable';     // <-- The pipeline does not have this pass
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Readout Refresh Interval
    // ------------------------------------------------------------
    // Slow enough to read, fast enough to watch a refinement climb. Runs only
    // while the section is open.
    // ------------------------------------------------------------
    const Na__Vfx__READOUT_INTERVAL_MS = 400;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Panel Poll Handle and Caller Wiring
    // ------------------------------------------------------------
    let Na__Vfx__ReadoutHandle       = null;                            // <-- Interval id while the section is open
    let Na__Vfx__PipelineRef         = null;                            // <-- Mutable { current } shared with the rest of the app
    let Na__Vfx__SetDrawingProfiles  = null;                            // <-- Drawing-view outline setter (see header)
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Row Rendering
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Paint One Toggle Row
    // ------------------------------------------------------------
    // available false means the pipeline has no such pass: the row is dimmed,
    // unclickable and reads N/A rather than pretending to be off.
    // ------------------------------------------------------------
    function Na__Vfx__PaintRow(buttonId, statusId, isOn, available) {
        const button = document.getElementById(buttonId);
        const status = document.getElementById(statusId);
        if (!button) return;

        button.classList.toggle(Na__Vfx__ActiveClass, available && isOn);
        button.classList.toggle(Na__Vfx__UnavailableClass, !available);
        button.disabled = !available;
        button.setAttribute('aria-pressed', (available && isOn) ? 'true' : 'false');

        if (status) status.textContent = available ? (isOn ? 'ON' : 'OFF') : 'N/A';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read the Active Pipeline State
    // ------------------------------------------------------------
    function Na__Vfx__GetPipeline() {
        return Na__Vfx__PipelineRef ? Na__Vfx__PipelineRef.current : null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Readout Refresh
// -----------------------------------------------------------------------------

    // FUNCTION | Repaint Every Row and Readout From Live State
    // ------------------------------------------------------------
    function Na__Vfx__Refresh() {
        const pipeline = Na__Vfx__GetPipeline();
        const refiner  = Na__ProgressiveRefine__GetActive();

        // PROGRESSIVE RENDERER | Unavailable until the render loop has built it
        const refineStatus = refiner ? refiner.getStatus() : null;
        Na__Vfx__PaintRow(
            Na__Vfx__ProgressiveBtnId, Na__Vfx__ProgressiveStatId,
            !!(refineStatus && refineStatus.enabled), !!refiner
        );

        // PROFILE LINES | The pass exists only when enabled for the model
        const profilePass = pipeline ? pipeline.profileLinesPassRef : null;
        Na__Vfx__PaintRow(
            Na__Vfx__ProfileBtnId, Na__Vfx__ProfileStatId,
            !!(profilePass && profilePass.enabled), !!profilePass
        );

        // AMBIENT OCCLUSION | The pass exists only when enabled for the model
        const aoPass = pipeline ? pipeline.aoPassRef : null;
        Na__Vfx__PaintRow(
            Na__Vfx__SsaoBtnId, Na__Vfx__SsaoStatId,
            !!(aoPass && aoPass.enabled), !!aoPass
        );

        // FRAME RATE | Average of recent CONTINUOUS frames, so it survives the
        // engine going idle rather than falling to zero the moment you stop
        // moving. A dash until enough frames have been drawn to mean anything.
        const frameRateEl = document.getElementById(Na__Vfx__FrameRateId);
        if (frameRateEl) {
            const fps = refineStatus ? refineStatus.fps : 0;
            frameRateEl.textContent = fps > 0 ? `${Math.round(fps)} fps` : '--';
        }

        // REFINEMENT | How far the settled picture has got
        const refineEl = document.getElementById(Na__Vfx__RefineId);
        if (refineEl) {
            if (!refineStatus || !refineStatus.enabled) {
                refineEl.textContent = 'Off';
            } else if (refineStatus.converged) {
                refineEl.textContent = `${refineStatus.sampleCount}x`;
            } else if (refineStatus.samplesDone > 0) {
                refineEl.textContent = `${refineStatus.samplesDone} of ${refineStatus.sampleCount}`;
            } else {
                refineEl.textContent = 'Waiting';                          // <-- Camera moving, or inside the settle debounce
            }
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Start and Stop the Readout Poll With the Section
    // ------------------------------------------------------------
    function Na__Vfx__SetReadoutRunning(isRunning) {
        if (isRunning && Na__Vfx__ReadoutHandle === null) {
            Na__Vfx__Refresh();                                            // <-- Paint immediately; do not wait a tick
            Na__Vfx__ReadoutHandle = window.setInterval(Na__Vfx__Refresh, Na__Vfx__READOUT_INTERVAL_MS);
            return;
        }
        if (!isRunning && Na__Vfx__ReadoutHandle !== null) {
            window.clearInterval(Na__Vfx__ReadoutHandle);
            Na__Vfx__ReadoutHandle = null;
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Initialization
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize the Visual Effects Settings Section
    // ------------------------------------------------------------
    // options:
    //   pipelineRef            {object}    Mutable { current } render pipeline state
    //   setDrawingProfileLines {function}  Na__DrawProfile__SetEnabled (see header)
    // ------------------------------------------------------------
    function Na__UiFeature__InitializeVisualEffectsControls(options) {
        const { pipelineRef, setDrawingProfileLines } = options || {};
        Na__Vfx__PipelineRef        = pipelineRef || null;
        Na__Vfx__SetDrawingProfiles = (typeof setDrawingProfileLines === 'function') ? setDrawingProfileLines : null;

        const toggleBtn = document.getElementById(Na__Vfx__ToggleId);
        const panel     = document.getElementById(Na__Vfx__PanelId);
        if (!toggleBtn || !panel) return;                                  // <-- Markup absent: nothing to wire

        // SECTION OPEN / CLOSE | The readout only runs while it is open
        toggleBtn.addEventListener('click', () => {
            const willOpen = !panel.classList.contains('is-open');
            panel.classList.toggle('is-open', willOpen);
            toggleBtn.setAttribute('aria-expanded', String(willOpen));
            Na__Vfx__SetReadoutRunning(willOpen);
        });

        // PROGRESSIVE RENDERER | Off drops the viewport back to one sample with
        // FXAA, exactly as it behaved before this feature existed
        const progressiveBtn = document.getElementById(Na__Vfx__ProgressiveBtnId);
        if (progressiveBtn) {
            progressiveBtn.addEventListener('click', () => {
                const refiner = Na__ProgressiveRefine__GetActive();
                if (!refiner) return;

                refiner.setEnabled(!refiner.getStatus().enabled);
                Na__Vfx__Refresh();
                Na__RenderLoop__RequestRender();                            // <-- Repaint at the new setting
            });
        }

        // PROFILE LINES | One switch for the composer pass AND the drawing
        // view's own outline; OFF while a plan is open must mean OFF there too
        const profileBtn = document.getElementById(Na__Vfx__ProfileBtnId);
        if (profileBtn) {
            profileBtn.addEventListener('click', () => {
                const pipeline = Na__Vfx__GetPipeline();
                if (!pipeline || !pipeline.toggleProfileLines) return;

                const isNowOn = pipeline.toggleProfileLines();
                if (Na__Vfx__SetDrawingProfiles) Na__Vfx__SetDrawingProfiles(isNowOn);
                Na__Vfx__Refresh();
                Na__RenderLoop__RequestRender();
            });
        }

        // AMBIENT OCCLUSION | The old top-level Shadows row
        const ssaoBtn = document.getElementById(Na__Vfx__SsaoBtnId);
        if (ssaoBtn) {
            ssaoBtn.addEventListener('click', () => {
                const pipeline = Na__Vfx__GetPipeline();
                if (!pipeline || !pipeline.toggleAo) return;

                pipeline.toggleAo();
                Na__Vfx__Refresh();
                Na__RenderLoop__RequestRender();
            });
        }

        // AO SWITCHED ITSELF OFF | The performance monitor drops SSAO when the
        // frame rate falls; show that at once rather than at the next poll
        window.addEventListener('na-ao-disabled', Na__Vfx__Refresh);

        Na__Vfx__Refresh();                                                // <-- Seed the rows before the section is ever opened
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Visual Effects User Controls API
    // ------------------------------------------------------------
    export {
        Na__UiFeature__InitializeVisualEffectsControls
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
