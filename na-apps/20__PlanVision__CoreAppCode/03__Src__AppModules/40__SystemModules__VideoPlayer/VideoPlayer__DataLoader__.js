// =============================================================================
// NOBLE ARCHITECTURE - VIDEO PLAYER DATA LOADER
// =============================================================================
//
// FILE       : VideoPlayer__DataLoader__.js
// NAMESPACE  : NaPlanVision.VideoPlayerDataLoader
// MODULE     : VideoPlayerDataLoader
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Fetch and prepare video data for the Video Player system
// CREATED    : 09-Feb-2026
//
// DESCRIPTION:
// - Loads project video data from the JSON configuration file
// - Provides helpers for sorting and preloading video assets
//
// -----
//
// DEVELOPMENT LOG:
// 09-Feb-2026 - Version 1.0.0
// - Modularised video data loading and preloading utilities
//
// =============================================================================

// #Region ------------------------------------------------
// MODULE | Video Player Data Loader
// --------------------------------------------------------

    (function () {
        'use strict';

        // #Region ------------------------------------------------
        // CONST | Module Constants
        // --------------------------------------------------------

            const Na__MODULE_NAME = 'VideoPlayerDataLoader';

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // UTILS | Data Helpers
        // --------------------------------------------------------

            const Na__ExtractVideoNumber = function (fileName) {
                const Na__Match = fileName.match(/VID(\d+)/i);
                return Na__Match ? parseInt(Na__Match[1], 10) : 999;
            };

            const Na__IsValidVideoEntry = function (videoEntry) {
                return videoEntry && videoEntry['file-name'] !== '{{TEMPLATE_-_ENTRY_-_TO_-_COPY_-_DO_-_NOT_-_DELETE}}';
            };

            const Na__BuildSortedVideoList = function (videos) {
                const Na__VideoArray = [];

                if (!videos) return Na__VideoArray;

                for (const Na__Key in videos) {
                    if (Na__Key.startsWith('video-') && Na__IsValidVideoEntry(videos[Na__Key])) {
                        Na__VideoArray.push({
                            key       : Na__Key,
                            data      : videos[Na__Key],
                            vidNumber : Na__ExtractVideoNumber(videos[Na__Key]['file-name'])
                        });
                    }
                }

                Na__VideoArray.sort((a, b) => a.vidNumber - b.vidNumber);
                return Na__VideoArray;
            };

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // DATA | Fetch and Preload
        // --------------------------------------------------------

            const Na__FetchVideos = async function () {
                if (typeof JSON_CONFIG_URL === 'undefined' || !JSON_CONFIG_URL) {
                    console.error('[FetchVideos] JSON_CONFIG_URL is not defined');
                    return null;
                }

                try {
                    const Na__Response = await fetch(JSON_CONFIG_URL);
                    if (!Na__Response.ok) {
                        throw new Error(`HTTP error! Status: ${Na__Response.status}`);
                    }
                    const Na__Data = await Na__Response.json();
                    console.log('[FetchVideos] Full JSON data:', Na__Data);

                    if (!Na__Data['na-project-data-library']) {
                        throw new Error("Missing 'na-project-data-library' in JSON");
                    }

                    if (!Na__Data['na-project-data-library']['project-documentation']) {
                        throw new Error("Missing 'project-documentation' in JSON");
                    }

                    console.log('[FetchVideos] project-documentation keys:', Object.keys(Na__Data['na-project-data-library']['project-documentation']));

                    const Na__ProjectDoc = Na__Data['na-project-data-library']['project-documentation'];

                    if (!Na__ProjectDoc['project-videos']) {
                        console.warn("[FetchVideos] No 'project-videos' section found in JSON.");
                        console.warn('[FetchVideos] This means the JSON file on the server needs to be updated.');
                        console.warn('[FetchVideos] Available keys:', Object.keys(Na__ProjectDoc));
                        if (typeof NaProjectDataFile__ActiveProject !== 'undefined') {
                            console.log(`[FetchVideos] To fix: Upload the updated ${NaProjectDataFile__ActiveProject} file to the server`);
                        }
                        return null;
                    }

                    const Na__Videos = Na__ProjectDoc['project-videos'];
                    console.log('[FetchVideos] Found videos section:', Na__Videos);
                    return Na__Videos;
                } catch (error) {
                    console.error('[FetchVideos] Error fetching videos JSON:', error.message);
                    return null;
                }
            };

            const Na__PreloadVideos = function (videos) {
                if (!videos) return;

                console.log('[VideoPreload] Starting background preload of videos...');

                for (const Na__Key in videos) {
                    if (Na__Key.startsWith('video-') && Na__IsValidVideoEntry(videos[Na__Key])) {
                        const Na__Video = videos[Na__Key];
                        const Na__CdnUrl = Na__Video['video-links']['cdn-url'];

                        const Na__PreloadVideo = document.createElement('video');
                        Na__PreloadVideo.preload = 'auto';
                        Na__PreloadVideo.src = Na__CdnUrl;
                        Na__PreloadVideo.style.display = 'none';
                        Na__PreloadVideo.muted = true;

                        document.body.appendChild(Na__PreloadVideo);

                        console.log(`[VideoPreload] Preloading: ${Na__Video['video-name']} (${Na__CdnUrl})`);

                        Na__PreloadVideo.load();
                    }
                }

                console.log('[VideoPreload] All videos queued for preloading');
            };

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // EXPORTS | Module API
        // --------------------------------------------------------

            window.NaPlanVision = window.NaPlanVision || {};
            window.NaPlanVision.VideoPlayerDataLoader = {
                Na__FetchVideos          : Na__FetchVideos,
                Na__PreloadVideos        : Na__PreloadVideos,
                Na__BuildSortedVideoList : Na__BuildSortedVideoList
            };

            if (window.NaPlanVision.ModuleDependencyManager) {
                window.NaPlanVision.ModuleDependencyManager.markModuleLoaded(Na__MODULE_NAME);
            }

            console.log('[VideoPlayerDataLoader] Module loaded and registered');

        // endregion ----------------------------------------------

    })();

// endregion ----------------------------------------------
