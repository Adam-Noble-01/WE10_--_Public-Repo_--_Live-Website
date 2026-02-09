// =============================================================================
// NOBLE ARCHITECTURE - VIDEO PLAYER CORE
// =============================================================================
//
// FILE       : VideoPlayer__Core__.js
// NAMESPACE  : NaPlanVision.VideoPlayerCore
// MODULE     : VideoPlayerCore
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Core video player UI, controls, and fullscreen handling
// CREATED    : 09-Feb-2026
//
// DESCRIPTION:
// - Creates the video player UI and injects styles
// - Handles playback, buffering, and fullscreen controls
// - Exposes open/close APIs for the video gallery
//
// -----
//
// DEVELOPMENT LOG:
// 09-Feb-2026 - Version 1.0.0
// - Modularised video player core from inline and legacy UI script
//
// =============================================================================

// #Region ------------------------------------------------
// MODULE | Video Player Core
// --------------------------------------------------------

    (function () {
        'use strict';

        // #Region ------------------------------------------------
        // CONST | Module Constants
        // --------------------------------------------------------

            const Na__MODULE_NAME = 'VideoPlayerCore';

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // STATE | Module State
        // --------------------------------------------------------

            const Na__VideoPlayerState = {
                currentVideo            : null,                      // <-- Current video data
                videoPlayerActive       : false,                     // <-- Player visibility state
                isFullscreen            : false,                     // <-- Fullscreen state
                videoElement            : null,                      // <-- Video DOM element
                overlayElement          : null,                      // <-- Overlay DOM element
                controlsTimeout         : null                       // <-- Auto-hide timeout
            };

            const Na__VideoPlayerConfig = {
                controlsAutoHideDelay   : 3000,                      // <-- 3 seconds
                fadeTransitionTime      : 300,                       // <-- 300ms fade
                overlayFadeOpacity      : 0.9                        // <-- Overlay opacity
            };

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // INIT | Video Player UI Creation
        // --------------------------------------------------------

            const Na__CreateVideoPlayerUI = function () {
                const Na__PlayerContainer = document.createElement('div');
                Na__PlayerContainer.id = 'na-video-player-container';
                Na__PlayerContainer.className = 'na-video-player-hidden';
                
                Na__PlayerContainer.innerHTML = `
                    <div class="na-video-player-backdrop" id="na-video-backdrop"></div>
                    <div class="na-video-player-content">
                        <!-- Close Button -->
                        <button class="na-video-close-btn" id="na-video-close-btn" title="Close Player">
                            <span>✕</span>
                        </button>

                        <!-- Video Wrapper -->
                        <div class="na-video-wrapper" id="na-video-wrapper">
                            <!-- White Overlay with Play Button -->
                            <div class="na-video-overlay" id="na-video-overlay">
                                <button class="na-video-play-overlay-btn" id="na-video-play-overlay-btn">
                                    <svg width="80" height="80" viewBox="0 0 80 80">
                                        <circle cx="40" cy="40" r="35" fill="white" opacity="0.9"/>
                                        <polygon points="32,25 32,55 55,40" fill="#333"/>
                                    </svg>
                                </button>
                            </div>

                            <!-- Video Element -->
                            <video id="na-video-element" class="na-video-element" preload="auto" poster="">
                                Your browser does not support video playback.
                            </video>
                            
                            <!-- Buffering Indicator -->
                            <div class="na-video-buffering" id="na-video-buffering" style="display: none;">
                                <div class="na-video-spinner"></div>
                                <p>Loading video...</p>
                            </div>

                            <!-- Video Controls -->
                            <div class="na-video-controls" id="na-video-controls">
                                <div class="na-video-progress-bar" id="na-video-progress-bar">
                                    <div class="na-video-progress-filled" id="na-video-progress-filled"></div>
                                </div>
                                
                                <div class="na-video-controls-row">
                                    <button class="na-video-control-btn" id="na-video-play-btn" title="Play/Pause">
                                        <span class="na-play-icon">▶</span>
                                        <span class="na-pause-icon" style="display:none;">⏸</span>
                                    </button>
                                    
                                    <button class="na-video-control-btn" id="na-video-rewind-btn" title="Rewind 10s">
                                        ⏪
                                    </button>
                                    
                                    <button class="na-video-control-btn" id="na-video-forward-btn" title="Forward 10s">
                                        ⏩
                                    </button>
                                    
                                    <div class="na-video-time-display" id="na-video-time-display">
                                        <span id="na-video-current-time">0:00</span> / 
                                        <span id="na-video-duration">0:00</span>
                                    </div>
                                    
                                    <div class="na-video-volume-control">
                                        <button class="na-video-control-btn" id="na-video-mute-btn" title="Mute/Unmute">
                                            <span class="na-volume-icon">🔊</span>
                                            <span class="na-muted-icon" style="display:none;">🔇</span>
                                        </button>
                                        <input type="range" id="na-video-volume-slider" 
                                               class="na-video-volume-slider" min="0" max="100" value="100">
                                    </div>
                                    
                                    <button class="na-video-control-btn" id="na-video-fullscreen-btn" title="Fullscreen">
                                        <span class="na-fullscreen-icon">⛶</span>
                                        <span class="na-exit-fullscreen-icon" style="display:none;">⛶</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Video Info -->
                        <div class="na-video-info" id="na-video-info">
                            <h3 id="na-video-title">Video Title</h3>
                            <p id="na-video-description">Video Description</p>
                        </div>
                    </div>
                `;

                document.body.appendChild(Na__PlayerContainer);
                
                // Store references
                Na__VideoPlayerState.videoElement = document.getElementById('na-video-element');
                Na__VideoPlayerState.overlayElement = document.getElementById('na-video-overlay');
                
                Na__AttachEventListeners();
                Na__CreateVideoPlayerStyles();
            };

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // EVENT LISTENERS | Player Controls
        // --------------------------------------------------------

            const Na__AttachEventListeners = function () {
                const Na__Video = Na__VideoPlayerState.videoElement;
                const Na__Overlay = Na__VideoPlayerState.overlayElement;
                const Na__PlayOverlayBtn = document.getElementById('na-video-play-overlay-btn');
                const Na__CloseBtn = document.getElementById('na-video-close-btn');
                const Na__Backdrop = document.getElementById('na-video-backdrop');
                const Na__PlayBtn = document.getElementById('na-video-play-btn');
                const Na__RewindBtn = document.getElementById('na-video-rewind-btn');
                const Na__ForwardBtn = document.getElementById('na-video-forward-btn');
                const Na__MuteBtn = document.getElementById('na-video-mute-btn');
                const Na__VolumeSlider = document.getElementById('na-video-volume-slider');
                const Na__FullscreenBtn = document.getElementById('na-video-fullscreen-btn');
                const Na__ProgressBar = document.getElementById('na-video-progress-bar');
                const Na__Wrapper = document.getElementById('na-video-wrapper');

                if (!Na__Video || !Na__Overlay || !Na__PlayOverlayBtn) return;

                // Play/Pause via overlay
                Na__PlayOverlayBtn.addEventListener('click', Na__HandlePlayPause);
                
                // Close player
                Na__CloseBtn.addEventListener('click', Na__CloseVideoPlayer);
                Na__Backdrop.addEventListener('click', Na__CloseVideoPlayer);
                
                // Standard controls
                Na__PlayBtn.addEventListener('click', Na__HandlePlayPause);
                Na__RewindBtn.addEventListener('click', () => Na__SkipTime(-10));
                Na__ForwardBtn.addEventListener('click', () => Na__SkipTime(10));
                Na__MuteBtn.addEventListener('click', Na__ToggleMute);
                Na__VolumeSlider.addEventListener('input', Na__HandleVolumeChange);
                Na__FullscreenBtn.addEventListener('click', Na__ToggleFullscreen);
                Na__ProgressBar.addEventListener('click', Na__HandleProgressBarClick);
                
                // Video events
                Na__Video.addEventListener('play', Na__HandleVideoPlay);
                Na__Video.addEventListener('pause', Na__HandleVideoPause);
                Na__Video.addEventListener('ended', Na__HandleVideoEnded);
                Na__Video.addEventListener('timeupdate', Na__UpdateProgress);
                Na__Video.addEventListener('loadedmetadata', Na__UpdateDuration);
                Na__Video.addEventListener('loadeddata', Na__HandleVideoLoaded);
                Na__Video.addEventListener('waiting', Na__HandleVideoWaiting);
                Na__Video.addEventListener('playing', Na__HandleVideoPlaying);
                Na__Video.addEventListener('canplay', Na__HandleVideoCanPlay);
                
                // Mouse movement for controls auto-hide
                Na__Wrapper.addEventListener('mousemove', Na__ShowControls);
                Na__Wrapper.addEventListener('mouseleave', Na__HideControls);
                
                // Keyboard controls
                document.addEventListener('keydown', Na__HandleKeyboardControls);
                
                // Fullscreen change events
                document.addEventListener('fullscreenchange', Na__HandleFullscreenChange);
                document.addEventListener('webkitfullscreenchange', Na__HandleFullscreenChange);
                document.addEventListener('mozfullscreenchange', Na__HandleFullscreenChange);
                document.addEventListener('MSFullscreenChange', Na__HandleFullscreenChange);
            };

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // CONTROLS | Playback and State Handling
        // --------------------------------------------------------

            const Na__HandlePlayPause = function () {
                const Na__Video = Na__VideoPlayerState.videoElement;
                
                if (Na__Video.paused) {
                    Na__Video.play();
                } else {
                    Na__Video.pause();
                }
            };

            const Na__HandleVideoPlay = function () {
                Na__VideoPlayerState.overlayElement.style.opacity = '0';
                Na__VideoPlayerState.overlayElement.style.pointerEvents = 'none';
                
                document.querySelector('.na-play-icon').style.display = 'none';
                document.querySelector('.na-pause-icon').style.display = 'inline';
                
                Na__ShowControls();
            };

            const Na__HandleVideoPause = function () {
                Na__VideoPlayerState.overlayElement.style.opacity = Na__VideoPlayerConfig.overlayFadeOpacity;
                Na__VideoPlayerState.overlayElement.style.pointerEvents = 'auto';
                
                document.querySelector('.na-play-icon').style.display = 'inline';
                document.querySelector('.na-pause-icon').style.display = 'none';
                
                clearTimeout(Na__VideoPlayerState.controlsTimeout);
            };

            const Na__HandleVideoEnded = function () {
                Na__VideoPlayerState.overlayElement.style.opacity = Na__VideoPlayerConfig.overlayFadeOpacity;
                Na__VideoPlayerState.overlayElement.style.pointerEvents = 'auto';
                
                document.querySelector('.na-play-icon').style.display = 'inline';
                document.querySelector('.na-pause-icon').style.display = 'none';
            };

            const Na__HandleVideoLoaded = function () {
                console.log('[VideoPlayer] Video data loaded');
                Na__HideBuffering();
            };

            const Na__HandleVideoWaiting = function () {
                console.log('[VideoPlayer] Video buffering...');
                Na__ShowBuffering();
            };

            const Na__HandleVideoPlaying = function () {
                console.log('[VideoPlayer] Video playing smoothly');
                Na__HideBuffering();
            };

            const Na__HandleVideoCanPlay = function () {
                console.log('[VideoPlayer] Video ready to play');
                Na__HideBuffering();
            };

            const Na__ShowBuffering = function () {
                const Na__Buffering = document.getElementById('na-video-buffering');
                if (Na__Buffering) {
                    Na__Buffering.style.display = 'flex';
                }
            };

            const Na__HideBuffering = function () {
                const Na__Buffering = document.getElementById('na-video-buffering');
                if (Na__Buffering) {
                    Na__Buffering.style.display = 'none';
                }
            };

            const Na__SkipTime = function (seconds) {
                const Na__Video = Na__VideoPlayerState.videoElement;
                Na__Video.currentTime = Math.max(0, Math.min(Na__Video.duration, Na__Video.currentTime + seconds));
            };

            const Na__ToggleMute = function () {
                const Na__Video = Na__VideoPlayerState.videoElement;
                Na__Video.muted = !Na__Video.muted;
                
                document.querySelector('.na-volume-icon').style.display = Na__Video.muted ? 'none' : 'inline';
                document.querySelector('.na-muted-icon').style.display = Na__Video.muted ? 'inline' : 'none';
            };

            const Na__HandleVolumeChange = function (e) {
                const Na__Video = Na__VideoPlayerState.videoElement;
                Na__Video.volume = e.target.value / 100;
                
                if (Na__Video.volume === 0) {
                    Na__Video.muted = true;
                    document.querySelector('.na-volume-icon').style.display = 'none';
                    document.querySelector('.na-muted-icon').style.display = 'inline';
                } else {
                    Na__Video.muted = false;
                    document.querySelector('.na-volume-icon').style.display = 'inline';
                    document.querySelector('.na-muted-icon').style.display = 'none';
                }
            };

            const Na__ToggleFullscreen = function () {
                const Na__Wrapper = document.getElementById('na-video-wrapper');
                
                if (!Na__VideoPlayerState.isFullscreen) {
                    if (Na__Wrapper.requestFullscreen) {
                        Na__Wrapper.requestFullscreen();
                    } else if (Na__Wrapper.webkitRequestFullscreen) {
                        Na__Wrapper.webkitRequestFullscreen();
                    } else if (Na__Wrapper.mozRequestFullScreen) {
                        Na__Wrapper.mozRequestFullScreen();
                    } else if (Na__Wrapper.msRequestFullscreen) {
                        Na__Wrapper.msRequestFullscreen();
                    }
                } else {
                    if (document.exitFullscreen) {
                        document.exitFullscreen();
                    } else if (document.webkitExitFullscreen) {
                        document.webkitExitFullscreen();
                    } else if (document.mozCancelFullScreen) {
                        document.mozCancelFullScreen();
                    } else if (document.msExitFullscreen) {
                        document.msExitFullscreen();
                    }
                }
            };

            const Na__HandleFullscreenChange = function () {
                Na__VideoPlayerState.isFullscreen = !!(document.fullscreenElement || 
                                        document.webkitFullscreenElement || 
                                        document.mozFullScreenElement || 
                                        document.msFullscreenElement);
                
                document.querySelector('.na-fullscreen-icon').style.display = 
                    Na__VideoPlayerState.isFullscreen ? 'none' : 'inline';
                document.querySelector('.na-exit-fullscreen-icon').style.display = 
                    Na__VideoPlayerState.isFullscreen ? 'inline' : 'none';
                
                // Update video aspect ratio when entering/exiting fullscreen
                Na__UpdateVideoAspectRatio();
                
                // Add resize listener for fullscreen adjustments
                if (Na__VideoPlayerState.isFullscreen) {
                    window.addEventListener('resize', Na__UpdateVideoAspectRatio);
                } else {
                    window.removeEventListener('resize', Na__UpdateVideoAspectRatio);
                }
            };

            const Na__HandleProgressBarClick = function (e) {
                const Na__Video = Na__VideoPlayerState.videoElement;
                const Na__ProgressBar = e.currentTarget;
                const Na__Rect = Na__ProgressBar.getBoundingClientRect();
                const Na__Percent = (e.clientX - Na__Rect.left) / Na__Rect.width;
                
                Na__Video.currentTime = Na__Percent * Na__Video.duration;
            };

            const Na__UpdateProgress = function () {
                const Na__Video = Na__VideoPlayerState.videoElement;
                const Na__ProgressFilled = document.getElementById('na-video-progress-filled');
                const Na__CurrentTimeDisplay = document.getElementById('na-video-current-time');
                
                const Na__Percent = (Na__Video.currentTime / Na__Video.duration) * 100;
                Na__ProgressFilled.style.width = `${Na__Percent}%`;
                
                Na__CurrentTimeDisplay.textContent = Na__FormatTime(Na__Video.currentTime);
            };

            const Na__UpdateDuration = function () {
                const Na__Video = Na__VideoPlayerState.videoElement;
                const Na__DurationDisplay = document.getElementById('na-video-duration');
                
                Na__DurationDisplay.textContent = Na__FormatTime(Na__Video.duration);
                
                Na__HandleVideoLoadedMetadata();
            };

            const Na__HandleVideoLoadedMetadata = function () {
                const Na__Video = Na__VideoPlayerState.videoElement;
                const Na__Wrapper = document.getElementById('na-video-wrapper');
                
                if (Na__Video.videoWidth && Na__Video.videoHeight) {
                    const Na__AspectRatio = Na__Video.videoWidth / Na__Video.videoHeight;
                    Na__Wrapper.setAttribute('data-aspect-ratio', Na__AspectRatio);
                    
                    Na__UpdateVideoAspectRatio();
                    
                    console.log(`[VideoPlayer] Video dimensions: ${Na__Video.videoWidth}x${Na__Video.videoHeight}, AR: ${Na__AspectRatio.toFixed(2)}`);
                }
            };

            const Na__UpdateVideoAspectRatio = function () {
                const Na__Wrapper = document.getElementById('na-video-wrapper');
                const Na__Video = Na__VideoPlayerState.videoElement;
                const Na__AspectRatio = parseFloat(Na__Wrapper.getAttribute('data-aspect-ratio') || '1.778');
                
                if (!Na__AspectRatio || Na__AspectRatio <= 0) return;
                
                if (Na__VideoPlayerState.isFullscreen) {
                    const Na__ScreenAspectRatio = window.innerWidth / window.innerHeight;
                    
                    if (Na__AspectRatio > Na__ScreenAspectRatio) {
                        Na__Video.style.width = '100vw';
                        Na__Video.style.height = 'auto';
                    } else {
                        Na__Video.style.width = 'auto';
                        Na__Video.style.height = '100vh';
                    }
                    
                    Na__Wrapper.style.display = 'flex';
                    Na__Wrapper.style.alignItems = 'center';
                    Na__Wrapper.style.justifyContent = 'center';
                } else {
                    Na__Video.style.width = '100%';
                    Na__Video.style.height = 'auto';
                    Na__Video.style.maxHeight = '80vh';
                    Na__Wrapper.style.display = 'block';
                }
            };

            const Na__FormatTime = function (seconds) {
                const Na__Minutes = Math.floor(seconds / 60);
                const Na__Seconds = Math.floor(seconds % 60);
                return `${Na__Minutes}:${Na__Seconds.toString().padStart(2, '0')}`;
            };

            const Na__ShowControls = function () {
                const Na__Controls = document.getElementById('na-video-controls');
                Na__Controls.style.opacity = '1';
                
                clearTimeout(Na__VideoPlayerState.controlsTimeout);
                
                if (!Na__VideoPlayerState.videoElement.paused) {
                    Na__VideoPlayerState.controlsTimeout = setTimeout(Na__HideControls, Na__VideoPlayerConfig.controlsAutoHideDelay);
                }
            };

            const Na__HideControls = function () {
                if (!Na__VideoPlayerState.videoElement.paused) {
                    const Na__Controls = document.getElementById('na-video-controls');
                    Na__Controls.style.opacity = '0';
                }
            };

            const Na__HandleKeyboardControls = function (e) {
                if (!Na__VideoPlayerState.videoPlayerActive) return;
                
                switch (e.key) {
                    case ' ':
                    case 'k':
                        e.preventDefault();
                        Na__HandlePlayPause();
                        break;
                    case 'ArrowLeft':
                        e.preventDefault();
                        Na__SkipTime(-10);
                        break;
                    case 'ArrowRight':
                        e.preventDefault();
                        Na__SkipTime(10);
                        break;
                    case 'f':
                        e.preventDefault();
                        Na__ToggleFullscreen();
                        break;
                    case 'm':
                        e.preventDefault();
                        Na__ToggleMute();
                        break;
                    case 'Escape':
                        if (!Na__VideoPlayerState.isFullscreen) {
                            Na__CloseVideoPlayer();
                        }
                        break;
                }
            };

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // PUBLIC API | Core Player Methods
        // --------------------------------------------------------

            const Na__OpenVideoPlayer = function (videoData) {
                Na__VideoPlayerState.currentVideo = videoData;
                Na__VideoPlayerState.videoPlayerActive = true;
                
                const Na__Container = document.getElementById('na-video-player-container');
                const Na__Video = Na__VideoPlayerState.videoElement;
                const Na__Title = document.getElementById('na-video-title');
                const Na__Description = document.getElementById('na-video-description');
                
                console.log(`[VideoPlayer] Opening video: ${videoData.name}`);
                console.log(`[VideoPlayer] CDN URL: ${videoData.cdnUrl}`);
                
                Na__ShowBuffering();
                
                Na__Video.src = videoData.cdnUrl;
                Na__Video.load();
                
                Na__Title.textContent = videoData.name || 'Video';
                Na__Description.textContent = videoData.type || '';
                
                Na__Container.classList.remove('na-video-player-hidden');
                Na__Container.classList.add('na-video-player-visible');
                
                Na__Video.addEventListener('loadedmetadata', function Na__OnMetadata() {
                    Na__Video.currentTime = 0.1;
                    Na__Video.removeEventListener('loadedmetadata', Na__OnMetadata);
                }, { once: true });
                
                Na__Video.addEventListener('seeked', function Na__OnSeeked() {
                    Na__VideoPlayerState.overlayElement.style.opacity = Na__VideoPlayerConfig.overlayFadeOpacity;
                    Na__VideoPlayerState.overlayElement.style.pointerEvents = 'auto';
                    Na__HideBuffering();
                    Na__Video.removeEventListener('seeked', Na__OnSeeked);
                }, { once: true });
                
                console.log(`[VideoPlayer] Opened video: ${videoData.name}`);
            };

            const Na__CloseVideoPlayer = function () {
                const Na__Container = document.getElementById('na-video-player-container');
                const Na__Video = Na__VideoPlayerState.videoElement;
                
                Na__Video.pause();
                Na__Video.src = '';
                
                Na__Container.classList.remove('na-video-player-visible');
                Na__Container.classList.add('na-video-player-hidden');
                
                if (Na__VideoPlayerState.isFullscreen) {
                    if (document.exitFullscreen) {
                        document.exitFullscreen();
                    }
                }
                
                Na__VideoPlayerState.videoPlayerActive = false;
                Na__VideoPlayerState.currentVideo = null;
                
                console.log('[VideoPlayerCore] Closed video player');
            };

            const Na__Initialize = function () {
                console.log('[VideoPlayerCore] Initialising video player module...');
                Na__CreateVideoPlayerUI();
                console.log('[VideoPlayerCore] Video player module initialised successfully');
            };

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // STYLES | Inject Video Player Styles
        // --------------------------------------------------------

            const Na__CreateVideoPlayerStyles = function () {
                const Na__StyleId = 'na-video-player-styles';
                
                if (document.getElementById(Na__StyleId)) return;
                
                const Na__Style = document.createElement('style');
                Na__Style.id = Na__StyleId;
                Na__Style.textContent = `
                    /* Video Player Container */
                    #na-video-player-container {
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100vw;
                        height: 100vh;
                        z-index: 10000;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        transition: opacity ${Na__VideoPlayerConfig.fadeTransitionTime}ms ease;
                    }
                    
                    .na-video-player-hidden {
                        opacity: 0;
                        pointer-events: none;
                    }
                    
                    .na-video-player-visible {
                        opacity: 1;
                        pointer-events: auto;
                    }
                    
                    /* Backdrop */
                    .na-video-player-backdrop {
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background: rgba(0, 0, 0, 0.95);
                    }
                    
                    /* Content */
                    .na-video-player-content {
                        position: relative;
                        width: 90%;
                        max-width: 1400px;
                        max-height: 95vh;
                        z-index: 10001;
                        display: flex;
                        flex-direction: column;
                        box-sizing: border-box;
                    }
                    
                    /* Close Button */
                    .na-video-close-btn {
                        position: absolute;
                        top: -50px;
                        right: 0;
                        background: white;
                        border: none;
                        width: 40px;
                        height: 40px;
                        border-radius: 50%;
                        cursor: pointer;
                        font-size: 24px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        transition: transform 0.2s ease;
                        z-index: 10002;
                    }
                    
                    .na-video-close-btn:hover {
                        transform: scale(1.1);
                    }
                    
                    /* Video Wrapper */
                    .na-video-wrapper {
                        position: relative;
                        width: 100%;
                        background: #000;
                        border-radius: 8px;
                        overflow: hidden;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    
                    /* Video Element */
                    .na-video-element {
                        width: 100%;
                        height: auto;
                        display: block;
                        max-width: 100%;
                        max-height: 80vh;
                        object-fit: contain;
                    }
                    
                    /* Video Overlay */
                    .na-video-overlay {
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background: rgba(255, 255, 255, 0.9);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        transition: opacity ${Na__VideoPlayerConfig.fadeTransitionTime}ms ease;
                        z-index: 10;
                        backdrop-filter: blur(5px);
                        box-sizing: border-box;
                    }
                    
                    .na-video-play-overlay-btn {
                        background: none;
                        border: none;
                        cursor: pointer;
                        transition: transform 0.2s ease;
                        filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));
                    }
                    
                    .na-video-play-overlay-btn:hover {
                        transform: scale(1.1);
                    }
                    
                    /* Buffering Indicator */
                    .na-video-buffering {
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background: rgba(0, 0, 0, 0.7);
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        z-index: 15;
                    }
                    
                    .na-video-buffering p {
                        color: white;
                        margin-top: 20px;
                        font-size: 16px;
                    }
                    
                    .na-video-spinner {
                        border: 4px solid rgba(255, 255, 255, 0.3);
                        border-top: 4px solid white;
                        border-radius: 50%;
                        width: 50px;
                        height: 50px;
                        animation: spin 1s linear infinite;
                    }
                    
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                    
                    /* Video Controls */
                    .na-video-controls {
                        position: absolute;
                        bottom: 0;
                        left: 0;
                        width: 100%;
                        background: linear-gradient(transparent, rgba(0,0,0,0.8));
                        padding: 20px 15px 15px;
                        transition: opacity 0.3s ease;
                        z-index: 20;
                        box-sizing: border-box;
                    }
                    
                    .na-video-progress-bar {
                        width: 100%;
                        height: 5px;
                        background: rgba(255,255,255,0.3);
                        border-radius: 3px;
                        cursor: pointer;
                        margin-bottom: 10px;
                        position: relative;
                    }
                    
                    .na-video-progress-filled {
                        height: 100%;
                        background: white;
                        border-radius: 3px;
                        width: 0%;
                        transition: width 0.1s linear;
                    }
                    
                    .na-video-controls-row {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }
                    
                    .na-video-control-btn {
                        background: none;
                        border: none;
                        color: white;
                        font-size: 20px;
                        cursor: pointer;
                        padding: 5px 10px;
                        transition: transform 0.2s ease;
                    }
                    
                    .na-video-control-btn:hover {
                        transform: scale(1.1);
                    }
                    
                    .na-video-time-display {
                        color: white;
                        font-size: 14px;
                        margin-left: auto;
                    }
                    
                    .na-video-volume-control {
                        display: flex;
                        align-items: center;
                        gap: 5px;
                    }
                    
                    .na-video-volume-slider {
                        width: 80px;
                        cursor: pointer;
                    }
                    
                    /* Video Info */
                    .na-video-info {
                        margin-top: 20px;
                        color: white;
                        text-align: center;
                    }
                    
                    .na-video-info h3 {
                        margin: 0 0 10px 0;
                        font-size: 24px;
                    }
                    
                    .na-video-info p {
                        margin: 0;
                        font-size: 16px;
                        opacity: 0.8;
                    }
                    
                    /* Fullscreen Adjustments */
                    .na-video-wrapper:fullscreen {
                        width: 100vw;
                        height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: #000;
                        border-radius: 0;
                    }
                    
                    .na-video-wrapper:fullscreen .na-video-element {
                        max-width: 100vw;
                        max-height: 100vh;
                        width: auto;
                        height: auto;
                        object-fit: contain;
                    }
                    
                    .na-video-wrapper:-webkit-full-screen {
                        width: 100vw;
                        height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: #000;
                        border-radius: 0;
                    }
                    
                    .na-video-wrapper:-webkit-full-screen .na-video-element {
                        max-width: 100vw;
                        max-height: 100vh;
                        width: auto;
                        height: auto;
                        object-fit: contain;
                    }
                    
                    .na-video-wrapper:-moz-full-screen {
                        width: 100vw;
                        height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: #000;
                        border-radius: 0;
                    }
                    
                    .na-video-wrapper:-moz-full-screen .na-video-element {
                        max-width: 100vw;
                        max-height: 100vh;
                        width: auto;
                        height: auto;
                        object-fit: contain;
                    }
                    
                    .na-video-wrapper:-ms-fullscreen {
                        width: 100vw;
                        height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: #000;
                        border-radius: 0;
                    }
                    
                    .na-video-wrapper:-ms-fullscreen .na-video-element {
                        max-width: 100vw;
                        max-height: 100vh;
                        width: auto;
                        height: auto;
                        object-fit: contain;
                    }
                `;
                
                document.head.appendChild(Na__Style);
            };

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // EXPORTS | Module API
        // --------------------------------------------------------

            window.NaPlanVision = window.NaPlanVision || {};
            window.NaPlanVision.VideoPlayerCore = {
                Na__Video__Initialize       : Na__Initialize,
                Na__Video__OpenVideoPlayer  : Na__OpenVideoPlayer,
                Na__Video__CloseVideoPlayer : Na__CloseVideoPlayer
            };

            if (window.NaPlanVision.ModuleDependencyManager) {
                window.NaPlanVision.ModuleDependencyManager.markModuleLoaded(Na__MODULE_NAME);
            }

            console.log('[VideoPlayerCore] Module loaded and registered');

        // endregion ----------------------------------------------

    })();

// endregion ----------------------------------------------
