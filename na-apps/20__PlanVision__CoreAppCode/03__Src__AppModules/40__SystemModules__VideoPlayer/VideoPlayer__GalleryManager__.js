// =============================================================================
// NOBLE ARCHITECTURE - VIDEO PLAYER GALLERY MANAGER
// =============================================================================
//
// FILE       : VideoPlayer__GalleryManager__.js
// NAMESPACE  : NaPlanVision.VideoPlayerGalleryManager
// MODULE     : VideoPlayerGalleryManager
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Manage video gallery buttons and menu navigation
// CREATED    : 09-Feb-2026
//
// DESCRIPTION:
// - Creates video gallery buttons in toolbar and main menu
// - Renders video lists and bridges to the video player core
//
// -----
//
// DEVELOPMENT LOG:
// 09-Feb-2026 - Version 1.0.0
// - Modularised video gallery management and UI rendering
//
// =============================================================================

// #Region ------------------------------------------------
// MODULE | Video Player Gallery Manager
// --------------------------------------------------------

    (function () {
        'use strict';

        // #Region ------------------------------------------------
        // CONST | Module Constants
        // --------------------------------------------------------

            const Na__MODULE_NAME = 'VideoPlayerGalleryManager';

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // STATE | Gallery State
        // --------------------------------------------------------

            let Na__AllVideosData = null;                         // <-- Stores all videos from JSON
            let Na__IsViewingVideoGallery = false;                // <-- Tracks if viewing video gallery

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // UTILS | DOM Helpers
        // --------------------------------------------------------

            const Na__GetToolbar = function () {
                return document.getElementById('toolbar');
            };

            const Na__GetMainMenuSection = function () {
                return document.getElementById('main-menu-section');
            };

            const Na__GetSubMenuSection = function () {
                return document.getElementById('sub-menu-section');
            };

            const Na__GetDocumentSelectionArea = function () {
                return document.getElementById('document-selection-area');
            };

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // STATE | Public State Helpers
        // --------------------------------------------------------

            const Na__SetVideoData = function (videos) {
                Na__AllVideosData = videos;
            };

            const Na__ResetVideoGalleryState = function () {
                Na__IsViewingVideoGallery = false;
            };

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // UI | Video Gallery Buttons
        // --------------------------------------------------------

            const Na__CreateVideoButtons = function (videos) {
                if (!videos) {
                    console.error('[VideoButtons] ❌ No videos data provided - this should not happen!');
                    return;
                }

                Na__SetVideoData(videos);

                console.log('[VideoButtons] Creating Video Gallery button...');

                const Na__Toolbar = Na__GetToolbar();
                if (!Na__Toolbar) return;

                const Na__ExistingHeader = Na__Toolbar.querySelector('.video-section-header');
                const Na__ExistingContainer = Na__Toolbar.querySelector('.video-button-container');
                const Na__ExistingSpacer = Na__Toolbar.querySelector('.video-section-spacer');
                if (Na__ExistingHeader) Na__ExistingHeader.remove();
                if (Na__ExistingContainer) Na__ExistingContainer.remove();
                if (Na__ExistingSpacer) Na__ExistingSpacer.remove();

                const Na__Header = document.createElement('div');
                Na__Header.className = 'menu_-_drawing-button-header-text video-section-header';
                Na__Header.textContent = 'Project Videos';
                Na__Header.style.marginTop = '10px';

                const Na__VideoButtonContainer = document.createElement('div');
                Na__VideoButtonContainer.className = 'video-button-container';

                const Na__DrawingSpacer = Na__Toolbar.querySelector('.drawing-section-spacer');

                if (Na__DrawingSpacer) {
                    Na__DrawingSpacer.after(Na__Header);
                    Na__Header.after(Na__VideoButtonContainer);
                } else {
                    const Na__CancelToolBtn = document.getElementById('cancelToolBtn');
                    if (Na__CancelToolBtn) {
                        Na__CancelToolBtn.after(Na__Header);
                        Na__Header.after(Na__VideoButtonContainer);
                    }
                }

                const Na__GalleryBtn = document.createElement('button');
                Na__GalleryBtn.className = 'tool-button';
                Na__GalleryBtn.textContent = '🎬 Video Gallery';
                Na__GalleryBtn.addEventListener('click', () => {
                    Na__ShowVideoGallery();
                });
                Na__VideoButtonContainer.appendChild(Na__GalleryBtn);

                const Na__Spacer = document.createElement('div');
                Na__Spacer.className = 'video-section-spacer';
                Na__Spacer.style.marginBottom = '20px';
                Na__VideoButtonContainer.after(Na__Spacer);

                console.log('[VideoButtons] Video Gallery button created');
            };

            const Na__CreateMainMenuVideoButton = function (videos) {
                if (!videos) {
                    console.error('[VideoButtons] ❌ No videos data provided');
                    return;
                }

                Na__SetVideoData(videos);

                console.log('[VideoButtons] Creating Video Gallery button in main menu...');

                const Na__VideoSection = document.getElementById('main-menu-video-section');
                if (!Na__VideoSection) {
                    console.error('[VideoButtons] ❌ Main menu video section not found');
                    return;
                }

                Na__VideoSection.innerHTML = '';

                const Na__Header = document.createElement('div');
                Na__Header.className = 'menu_-_drawing-button-header-text';
                Na__Header.textContent = 'Project Videos';
                Na__VideoSection.appendChild(Na__Header);

                const Na__VideoButtonContainer = document.createElement('div');
                Na__VideoButtonContainer.className = 'category-button-container';
                Na__VideoSection.appendChild(Na__VideoButtonContainer);

                const Na__GalleryBtn = document.createElement('button');
                Na__GalleryBtn.className = 'tool-button';
                Na__GalleryBtn.textContent = '🎬 Video Gallery';
                Na__GalleryBtn.addEventListener('click', () => {
                    Na__ShowVideoGalleryFromMainMenu();
                });
                Na__VideoButtonContainer.appendChild(Na__GalleryBtn);

                const Na__Divider = document.createElement('div');
                Na__Divider.className = 'menu-section-divider';
                Na__VideoSection.appendChild(Na__Divider);

                console.log('[VideoButtons] Main menu video button created');
            };

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // UI | Video Gallery Views
        // --------------------------------------------------------

            const Na__ShowVideoGalleryFromMainMenu = function () {
                if (!Na__AllVideosData) {
                    console.error('[VideoGallery] No videos data available');
                    return;
                }

                console.log('[VideoGallery] Opening video gallery from main menu...');

                const Na__MainMenuSection = Na__GetMainMenuSection();
                const Na__SubMenuSection = Na__GetSubMenuSection();
                const Na__DocumentSelectionArea = Na__GetDocumentSelectionArea();

                if (Na__MainMenuSection) {
                    Na__MainMenuSection.classList.add('hidden');
                }

                if (Na__SubMenuSection) {
                    Na__SubMenuSection.classList.add('visible');
                }

                if (Na__DocumentSelectionArea) {
                    Na__DocumentSelectionArea.innerHTML = '';

                    const Na__Header = document.createElement('div');
                    Na__Header.className = 'menu_-_drawing-button-header-text';
                    Na__Header.textContent = 'Select Video';
                    Na__DocumentSelectionArea.appendChild(Na__Header);

                    const Na__ButtonContainer = document.createElement('div');
                    Na__ButtonContainer.className = 'drawing-button-container';
                    Na__DocumentSelectionArea.appendChild(Na__ButtonContainer);

                    const Na__VideoList = window.NaPlanVision.VideoPlayerDataLoader.Na__Video__BuildSortedVideoList(Na__AllVideosData);

                    Na__VideoList.forEach((videoItem) => {
                        const Na__Video = videoItem.data;
                        const Na__Button = document.createElement('button');
                        Na__Button.className = 'tool-button';
                        Na__Button.textContent = Na__Video['video-name'];
                        Na__Button.addEventListener('click', () => {
                            if (window.NaPlanVision && window.NaPlanVision.VideoPlayerCore) {
                                window.NaPlanVision.VideoPlayerCore.Na__Video__OpenVideoPlayer({
                                    cdnUrl : Na__Video['video-links']['cdn-url'],
                                    name   : Na__Video['video-name'],
                                    type   : Na__Video['video-type']
                                });
                            } else {
                                console.error('VideoPlayerCore module not loaded');
                            }
                        });
                        Na__ButtonContainer.appendChild(Na__Button);
                    });

                    console.log('[VideoGallery] Video gallery displayed with', Na__VideoList.length, 'videos');
                }

                if (typeof currentMenuView !== 'undefined') {
                    currentMenuView = 'videos';
                }
            };

            const Na__ShowVideoGallery = function () {
                if (!Na__AllVideosData) {
                    console.error('[VideoGallery] No videos data available');
                    return;
                }

                Na__IsViewingVideoGallery = true;
                console.log('[VideoGallery] Opening video gallery view...');

                const Na__Toolbar = Na__GetToolbar();
                if (!Na__Toolbar) return;

                const Na__DrawingHeader = Na__Toolbar.querySelector('.drawing-section-header');
                const Na__DrawingContainer = Na__Toolbar.querySelector('.drawing-button-container');
                const Na__DrawingSpacer = Na__Toolbar.querySelector('.drawing-section-spacer');
                const Na__HistoricBanner = Na__Toolbar.querySelector('.historic-mode-banner');

                if (Na__DrawingHeader) Na__DrawingHeader.style.display = 'none';
                if (Na__DrawingContainer) Na__DrawingContainer.style.display = 'none';
                if (Na__DrawingSpacer) Na__DrawingSpacer.style.display = 'none';
                if (Na__HistoricBanner) Na__HistoricBanner.style.display = 'none';

                const Na__VideoHeader = Na__Toolbar.querySelector('.video-section-header');
                if (Na__VideoHeader) Na__VideoHeader.textContent = 'Select Video';

                const Na__VideoButtonContainer = Na__Toolbar.querySelector('.video-button-container');
                if (Na__VideoButtonContainer) {
                    Na__VideoButtonContainer.innerHTML = '';
                }

                const Na__VideoList = window.NaPlanVision.VideoPlayerDataLoader.Na__BuildSortedVideoList(Na__AllVideosData);

                Na__VideoList.forEach((videoItem) => {
                    const Na__Video = videoItem.data;
                    const Na__Button = document.createElement('button');
                    Na__Button.className = 'tool-button';
                    Na__Button.textContent = Na__Video['video-name'];
                    Na__Button.addEventListener('click', () => {
                        if (window.NaPlanVision && window.NaPlanVision.VideoPlayerCore) {
                            window.NaPlanVision.VideoPlayerCore.Na__OpenVideoPlayer({
                                cdnUrl : Na__Video['video-links']['cdn-url'],
                                name   : Na__Video['video-name'],
                                type   : Na__Video['video-type']
                            });
                        } else {
                            console.error('VideoPlayerCore module not loaded');
                        }
                    });
                    Na__VideoButtonContainer.appendChild(Na__Button);
                });

                const Na__BackBtn = document.createElement('button');
                Na__BackBtn.className = 'tool-button return-current-btn';
                Na__BackBtn.textContent = 'Back to Main Menu';
                Na__BackBtn.addEventListener('click', () => {
                    Na__HideVideoGallery();
                });
                Na__VideoButtonContainer.appendChild(Na__BackBtn);

                console.log('[VideoGallery] Video gallery view displayed with', Na__VideoList.length, 'videos');
            };

            const Na__HideVideoGallery = function () {
                Na__IsViewingVideoGallery = false;
                console.log('[VideoGallery] Returning to main menu...');

                const Na__Toolbar = Na__GetToolbar();
                if (!Na__Toolbar) return;

                const Na__DrawingHeader = Na__Toolbar.querySelector('.drawing-section-header');
                const Na__DrawingContainer = Na__Toolbar.querySelector('.drawing-button-container');
                const Na__DrawingSpacer = Na__Toolbar.querySelector('.drawing-section-spacer');
                const Na__HistoricBanner = Na__Toolbar.querySelector('.historic-mode-banner');

                if (Na__DrawingHeader) Na__DrawingHeader.style.display = '';
                if (Na__DrawingContainer) Na__DrawingContainer.style.display = '';
                if (Na__DrawingSpacer) Na__DrawingSpacer.style.display = '';
                if (Na__HistoricBanner && typeof isViewingHistoricArchive !== 'undefined' && isViewingHistoricArchive) {
                    Na__HistoricBanner.style.display = '';
                }

                const Na__VideoHeader = Na__Toolbar.querySelector('.video-section-header');
                if (Na__VideoHeader) Na__VideoHeader.textContent = 'Project Videos';

                const Na__VideoButtonContainer = Na__Toolbar.querySelector('.video-button-container');
                if (Na__VideoButtonContainer) {
                    Na__VideoButtonContainer.innerHTML = '';

                    const Na__GalleryBtn = document.createElement('button');
                    Na__GalleryBtn.className = 'tool-button';
                    Na__GalleryBtn.textContent = '🎬 Video Gallery';
                    Na__GalleryBtn.addEventListener('click', () => {
                        Na__ShowVideoGallery();
                    });
                    Na__VideoButtonContainer.appendChild(Na__GalleryBtn);
                }

                console.log('[VideoGallery] Returned to main menu');
            };

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // EXPORTS | Module API
        // --------------------------------------------------------

            window.NaPlanVision = window.NaPlanVision || {};
            window.NaPlanVision.VideoPlayerGalleryManager = {
                Na__Video__SetVideoData             : Na__SetVideoData,
                Na__Video__ResetVideoGalleryState   : Na__ResetVideoGalleryState,
                Na__Video__CreateVideoButtons       : Na__CreateVideoButtons,
                Na__Video__CreateMainMenuVideoButton: Na__CreateMainMenuVideoButton,
                Na__Video__ShowVideoGallery         : Na__ShowVideoGallery,
                Na__Video__ShowVideoGalleryFromMainMenu : Na__ShowVideoGalleryFromMainMenu,
                Na__Video__HideVideoGallery         : Na__HideVideoGallery
            };

            if (window.NaPlanVision.ModuleDependencyManager) {
                window.NaPlanVision.ModuleDependencyManager.markModuleLoaded(Na__MODULE_NAME);
            }

            console.log('[VideoPlayerGalleryManager] Module loaded and registered');

        // endregion ----------------------------------------------

    })();

// endregion ----------------------------------------------
