// =============================================================================
// NOBLE ARCHITECTURE - USER INTERACTION: TOUCH SCREEN DEVICES
// =============================================================================
//
// FILE       : UserIteraction__TouchScreenDevices__.js
// NAMESPACE  : NaPlanVision.UserInteraction.TouchScreenDevices
// MODULE     : TouchScreenDevices
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Touch event handling for tablets and mobile devices
// CREATED    : 09-Feb-2026
//
// DESCRIPTION:
// - Attaches touch event listeners to the plan canvas
// - Translates touch events into mouse-like events for system delegation
// - Handles pinch-to-zoom with two-finger gestures
// - Delegates single-finger interactions to the KeyboardAndMouse handlers
//   via the measurement and markup systems
//
// =============================================================================

// #region ------------------------------------------------
// MODULE | Touch Screen Devices Interaction
// --------------------------------------------------------

    (function() {
        'use strict';

        const TouchScreenDevices = {};

    // #region ------------------------------------------------
    // STATE | Module References and Touch State
    // ----------------------------------------------------

        let appContext = null;
        let isPinching = false;
        let pinchStartDist = 0;
        let pinchStartZoom = 1;
        let pinchMidpoint = { x: 0, y: 0 };

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
    // UTILITY | Touch Geometry Helpers
    // ----------------------------------------------------

        function touchDistance(t1, t2) {
            return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        }

        function touchMidpoint(t1, t2) {
            return {
                x: (t1.clientX + t2.clientX) / 2,
                y: (t1.clientY + t2.clientY) / 2
            };
        }

        function createTouchEvent(touch, originalEvent) {
            const rect = appContext.planCanvas.getBoundingClientRect();
            return {
                offsetX: touch.clientX - rect.left,
                offsetY: touch.clientY - rect.top,
                clientX: touch.clientX,
                clientY: touch.clientY,
                detail: originalEvent.detail || 0,
                preventDefault: () => originalEvent.preventDefault(),
                stopPropagation: () => originalEvent.stopPropagation(),
                ctrlKey: originalEvent.ctrlKey || false
            };
        }

    // endregion ----------------------------------------------

    // #region ------------------------------------------------
    // PUBLIC | Initialise
    // ----------------------------------------------------

        TouchScreenDevices.initialise = function(context) {
            appContext = context;
            if (!appContext || !appContext.planCanvas) {
                console.warn('[UserInteraction.TouchScreenDevices] Missing app context');
                return;
            }

            const canvas = appContext.planCanvas;
            canvas.addEventListener('touchstart', onTouchStart, { passive: false });
            canvas.addEventListener('touchmove', onTouchMove, { passive: false });
            canvas.addEventListener('touchend', onTouchEnd);
            canvas.addEventListener('touchcancel', onTouchEnd);
        };

    // endregion ----------------------------------------------

    // #region ------------------------------------------------
    // HANDLER | Touch Start
    // ----------------------------------------------------

        function onTouchStart(e) {
            // Delegate single-finger to markup system
            const markup = markupSystem();
            if (markup && markup.isActive && markup.isActive()) {
                if (e.touches.length === 1 && markup.handleMouseDown) {
                    const touchEvent = createTouchEvent(e.touches[0], e);
                    if (markup.handleMouseDown(touchEvent)) {
                        e.preventDefault();
                        return;
                    }
                }
            }

            if (e.touches.length === 1) {
                // Delegate single-finger to measurement system
                const meas = measSystem();
                const touchEvent = createTouchEvent(e.touches[0], e);

                if (meas && meas.handleMouseDown && meas.handleMouseDown(touchEvent)) {
                    e.preventDefault();
                    return;
                }

                // Default: start panning
                setState({
                    isDragging: true,
                    lastX: e.touches[0].clientX,
                    lastY: e.touches[0].clientY
                });
            } else if (e.touches.length === 2) {
                // Start pinch-to-zoom
                isPinching = true;
                pinchStartDist = touchDistance(e.touches[0], e.touches[1]);
                pinchMidpoint = touchMidpoint(e.touches[0], e.touches[1]);
                pinchStartZoom = getState().zoomFactor || 1;
            }
        }

    // endregion ----------------------------------------------

    // #region ------------------------------------------------
    // HANDLER | Touch Move
    // ----------------------------------------------------

        function onTouchMove(e) {
            // Delegate single-finger to markup system
            const markup = markupSystem();
            if (markup && markup.isActive && markup.isActive()) {
                if (e.touches.length === 1 && markup.handleMouseMove) {
                    const touchEvent = createTouchEvent(e.touches[0], e);
                    if (markup.handleMouseMove(touchEvent)) {
                        e.preventDefault();
                        return;
                    }
                }
            }

            if (isPinching && e.touches.length === 2) {
                // Pinch-to-zoom
                e.preventDefault();
                const newDist = touchDistance(e.touches[0], e.touches[1]);
                const zoomDiff = (newDist - pinchStartDist) * 0.005;
                const newZoom = pinchStartZoom + zoomDiff;
                const rect = appContext.planCanvas.getBoundingClientRect();
                const midX = pinchMidpoint.x - rect.left;
                const midY = pinchMidpoint.y - rect.top;

                if (appContext.setZoom) {
                    appContext.setZoom(newZoom, midX, midY);
                }
            } else if (e.touches.length === 1 && !isPinching) {
                // Single-finger drag: delegate to measurement system or pan
                const meas = measSystem();
                const touchEvent = createTouchEvent(e.touches[0], e);

                if (meas && meas.handleMouseMove && meas.handleMouseMove(touchEvent)) {
                    return;
                }

                // Default: panning
                const state = getState();
                if (state.isDragging) {
                    setState({
                        offsetX: state.offsetX + (e.touches[0].clientX - state.lastX),
                        offsetY: state.offsetY + (e.touches[0].clientY - state.lastY),
                        lastX: e.touches[0].clientX,
                        lastY: e.touches[0].clientY
                    });
                }
            }
        }

    // endregion ----------------------------------------------

    // #region ------------------------------------------------
    // HANDLER | Touch End
    // ----------------------------------------------------

        function onTouchEnd(e) {
            // Delegate to markup system
            const markup = markupSystem();
            if (markup && markup.isActive && markup.isActive()) {
                if (markup.handleMouseUp) {
                    const state = getState();
                    const fakeEvent = {
                        clientX: state.lastX,
                        clientY: state.lastY,
                        offsetX: state.lastX - appContext.planCanvas.getBoundingClientRect().left,
                        offsetY: state.lastY - appContext.planCanvas.getBoundingClientRect().top,
                        detail: 0,
                        preventDefault: () => e.preventDefault(),
                        stopPropagation: () => e.stopPropagation(),
                        ctrlKey: e.ctrlKey || false
                    };
                    if (markup.handleMouseUp(fakeEvent)) {
                        return;
                    }
                }
            }

            if (e.touches.length === 0) {
                // All fingers lifted - delegate to measurement system
                const meas = measSystem();
                const state = getState();
                const fakeEvent = {
                    clientX: state.lastX,
                    clientY: state.lastY,
                    offsetX: state.lastX - appContext.planCanvas.getBoundingClientRect().left,
                    offsetY: state.lastY - appContext.planCanvas.getBoundingClientRect().top,
                    detail: 0,
                    preventDefault: () => e.preventDefault(),
                    stopPropagation: () => e.stopPropagation(),
                    ctrlKey: e.ctrlKey || false
                };

                if (meas && meas.handleMouseUp) {
                    meas.handleMouseUp(fakeEvent);
                }
            }

            if (e.touches.length < 2) isPinching = false;
            setState({ isDragging: false });
        }

    // endregion ----------------------------------------------

    // #region ------------------------------------------------
    // EXPORTS | Module API
    // ----------------------------------------------------

        window.NaPlanVision = window.NaPlanVision || {};
        window.NaPlanVision.UserInteraction = window.NaPlanVision.UserInteraction || {};
        window.NaPlanVision.UserInteraction.TouchScreenDevices = TouchScreenDevices;

    // endregion ----------------------------------------------

    })();

// endregion ----------------------------------------------
