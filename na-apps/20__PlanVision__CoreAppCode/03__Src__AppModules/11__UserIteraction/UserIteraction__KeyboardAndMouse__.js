// =============================================================================
// NOBLE ARCHITECTURE - USER INTERACTION: KEYBOARD AND MOUSE
// =============================================================================
//
// FILE       : UserIteraction__KeyboardAndMouse__.js
// NAMESPACE  : NaPlanVision.UserInteraction.KeyboardAndMouse
// MODULE     : KeyboardAndMouse
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Mouse and keyboard event handling for the canvas
// CREATED    : 09-Feb-2026
//
// DESCRIPTION:
// - Attaches mouse and keyboard event listeners to the plan canvas
// - Delegates tool events to the Measurement and Markup systems
// - Handles view panning (click-drag) and zoom (mouse wheel)
//
// =============================================================================

// #region ------------------------------------------------
// MODULE | Keyboard and Mouse Interaction
// --------------------------------------------------------

    (function() {
        'use strict';

        const KeyboardAndMouse = {};

    // #region ------------------------------------------------
    // STATE | Module References
    // ----------------------------------------------------

        let appContext = null;

        function getState() {
            return appContext ? appContext.getState() : {};
        }

        function setState(patch) {
            if (appContext && appContext.setState) appContext.setState(patch);
        }

        function measSystem() {
            return window.NaPlanVision?.MeasurmentToolsSystem?.Main;
        }

        function markupSystem() {
            return window.NaPlanVision?.MarkupToolsSystem?.Main;
        }

    // endregion ----------------------------------------------

    // #region ------------------------------------------------
    // PUBLIC | Initialise
    // ----------------------------------------------------

        KeyboardAndMouse.Na__Interact__Initialise = function(context) {
            appContext = context;
            if (!appContext || !appContext.planCanvas) {
                console.warn('[UserInteraction.KeyboardAndMouse] Missing app context');
                return;
            }

            const canvas = appContext.planCanvas;
            canvas.addEventListener('mousedown', onMouseDown);
            canvas.addEventListener('mousemove', onMouseMove);
            canvas.addEventListener('mouseup', onMouseUp);
            canvas.addEventListener('wheel', onWheel, { passive: false });
            window.addEventListener('keydown', onKeyDown);
        };

    // endregion ----------------------------------------------

    // #region ------------------------------------------------
    // HANDLER | Mouse Move
    // ----------------------------------------------------

        function onMouseMove(e) {
            // Delegate to markup system first
            const markup = markupSystem();
            if (markup && markup.Na__Markup__IsActive && markup.Na__Markup__IsActive()) {
                if (markup.Na__Markup__HandleMouseMove && markup.Na__Markup__HandleMouseMove(e)) {
                    return;
                }
            }

            // Delegate to measurement system
            const meas = measSystem();
            if (meas && meas.Na__Measure__HandleMouseMove && meas.Na__Measure__HandleMouseMove(e)) {
                return;
            }

            // Default: view panning
            const state = getState();
            if (state.isDragging) {
                setState({
                    offsetX: state.offsetX + (e.clientX - state.lastX),
                    offsetY: state.offsetY + (e.clientY - state.lastY),
                    lastX: e.clientX,
                    lastY: e.clientY
                });
            }
        }

    // endregion ----------------------------------------------

    // #region ------------------------------------------------
    // HANDLER | Mouse Down
    // ----------------------------------------------------

        function onMouseDown(e) {
            // Delegate to markup system first
            const markup = markupSystem();
            if (markup && markup.Na__Markup__IsActive && markup.Na__Markup__IsActive()) {
                if (markup.Na__Markup__HandleMouseDown && markup.Na__Markup__HandleMouseDown(e)) {
                    return;
                }
            }

            // Delegate to measurement system
            const meas = measSystem();
            if (meas && meas.Na__Measure__HandleMouseDown && meas.Na__Measure__HandleMouseDown(e)) {
                return;
            }

            // Default: start panning
            setState({
                isDragging: true,
                lastX: e.clientX,
                lastY: e.clientY
            });
        }

    // endregion ----------------------------------------------

    // #region ------------------------------------------------
    // HANDLER | Mouse Up
    // ----------------------------------------------------

        function onMouseUp(e) {
            // Delegate to markup system first
            const markup = markupSystem();
            if (markup && markup.isActive && markup.isActive()) {
                if (markup.handleMouseUp && markup.handleMouseUp(e)) {
                    return;
                }
            }

            // Delegate to measurement system
            const meas = measSystem();
            if (meas && meas.handleMouseUp && meas.handleMouseUp(e)) {
                return;
            }

            // Default: stop panning
            setState({ isDragging: false });
        }

    // endregion ----------------------------------------------

    // #region ------------------------------------------------
    // HANDLER | Mouse Wheel (Zoom)
    // ----------------------------------------------------

        function onWheel(e) {
            e.preventDefault();
            const zoomChange = e.deltaY * -0.001;
            if (appContext.applyZoom) {
                appContext.applyZoom(zoomChange, e.offsetX, e.offsetY);
            }
        }

    // endregion ----------------------------------------------

    // #region ------------------------------------------------
    // HANDLER | Keyboard
    // ----------------------------------------------------

        function onKeyDown(e) {
            const markup = markupSystem();
            if (markup && markup.Na__Markup__HandleKeyDown) {
                markup.Na__Markup__HandleKeyDown(e);
            }
        }

    // endregion ----------------------------------------------

    // #region ------------------------------------------------
    // EXPORTS | Module API
    // ----------------------------------------------------

        window.NaPlanVision = window.NaPlanVision || {};
        window.NaPlanVision.UserInteraction = window.NaPlanVision.UserInteraction || {};
        window.NaPlanVision.UserInteraction.KeyboardAndMouse = KeyboardAndMouse;

    // endregion ----------------------------------------------

    })();

// endregion ----------------------------------------------
