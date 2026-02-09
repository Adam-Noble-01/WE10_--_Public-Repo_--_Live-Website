// =============================================================================
// NOBLE ARCHITECTURE - VIDEO PLAYER MAIN CONTROLLER
// =============================================================================
//
// FILE       : VideoPlayer__Main__.js
// NAMESPACE  : NaPlanVision.VideoPlayerMain
// MODULE     : VideoPlayerMain
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Initialise and orchestrate the video player system
// CREATED    : 09-Feb-2026
//
// DESCRIPTION:
// - Bootstraps core, gallery, and data loader modules
// - Loads video data and triggers background preloading
//
// -----
//
// DEVELOPMENT LOG:
// 09-Feb-2026 - Version 1.0.0
// - Created main controller for video player system
//
// =============================================================================

// #Region ------------------------------------------------
// MODULE | Video Player Main Controller
// --------------------------------------------------------

    (function () {
        'use strict';

        // #Region ------------------------------------------------
        // CONST | Module Constants
        // --------------------------------------------------------

            const Na__MODULE_NAME = 'VideoPlayerMain';

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // INIT | Video Player System Bootstrap
        // --------------------------------------------------------

            const Na__LogModuleAvailability = function () {
                const Na__HasCore = !!(window.NaPlanVision && window.NaPlanVision.VideoPlayerCore);
                const Na__HasData = !!(window.NaPlanVision && window.NaPlanVision.VideoPlayerDataLoader);
                const Na__HasGallery = !!(window.NaPlanVision && window.NaPlanVision.VideoPlayerGalleryManager);

                console.log('[VideoPlayerMain] Module availability:', {
                    core     : Na__HasCore,
                    data     : Na__HasData,
                    gallery  : Na__HasGallery
                });

                return Na__HasCore && Na__HasData && Na__HasGallery;
            };

            const Na__Video__Initialise = async function () {
                console.log('[VideoPlayerMain] Initialising video player system...');

                if (!Na__LogModuleAvailability()) {
                    console.warn('[VideoPlayerMain] Required modules missing - video system disabled');
                    return;
                }

                window.NaPlanVision.VideoPlayerCore.Na__Video__Initialize();

                const Na__Videos = await window.NaPlanVision.VideoPlayerDataLoader.Na__Video__FetchVideos();
                if (Na__Videos) {
                    console.log('[VideoPlayerMain] Videos loaded successfully');
                    window.NaPlanVision.VideoPlayerGalleryManager.Na__Video__CreateMainMenuVideoButton(Na__Videos);

                    console.log('[VideoPlayerMain] Starting background video preload...');
                    setTimeout(() => window.NaPlanVision.VideoPlayerDataLoader.Na__Video__PreloadVideos(Na__Videos), 2000);
                } else {
                    console.warn('[VideoPlayerMain] No videos found in JSON - Video buttons will not appear');
                    if (typeof NaProjectDataFile__ActiveProject !== 'undefined') {
                        console.info(`[VideoPlayerMain] → Action Required: Upload updated ${NaProjectDataFile__ActiveProject} to server`);
                    }
                }

                console.log('[VideoPlayerMain] Video player system initialised');
            };

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // EXPORTS | Module API
        // --------------------------------------------------------

            window.NaPlanVision = window.NaPlanVision || {};
            window.NaPlanVision.VideoPlayerMain = {
                Na__Video__Initialise : Na__Video__Initialise
            };

            if (window.NaPlanVision.ModuleDependencyManager) {
                window.NaPlanVision.ModuleDependencyManager.markModuleLoaded(Na__MODULE_NAME);
            }

            console.log('[VideoPlayerMain] Module loaded and registered');

        // endregion ----------------------------------------------

    })();

// endregion ----------------------------------------------
