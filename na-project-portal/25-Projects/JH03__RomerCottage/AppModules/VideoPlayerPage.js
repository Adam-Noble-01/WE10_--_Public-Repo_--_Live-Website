// =============================================================================
// REGION | VideoPlayerPage Module - Noble Architecture Video Player
// =============================================================================
// Purpose: Modular video player with standard controls, overlay, and fullscreen
// Author: Adam Noble - Noble Architecture  
// Created: 03-Nov-2025
// =============================================================================

(function() {
    'use strict';

    // NAMESPACE | Ensure TrueVision3D namespace exists
    // -------------------------------------------------------------------------
    window.TrueVision3D = window.TrueVision3D || {};

    // =============================================================================
    // REGION | Module State & Configuration
    // =============================================================================

    const MODULE_NAME = 'VideoPlayerPage';
    
    const STATE = {
        currentVideo            : null,                      // <-- Current video data
        videoPlayerActive       : false,                     // <-- Player visibility state
        isFullscreen            : false,                     // <-- Fullscreen state
        videoElement            : null,                      // <-- Video DOM element
        overlayElement          : null,                      // <-- Overlay DOM element
        controlsTimeout         : null                       // <-- Auto-hide timeout
    };

    const CONFIG = {
        controlsAutoHideDelay   : 3000,                      // <-- 3 seconds
        fadeTransitionTime      : 300,                       // <-- 300ms fade
        overlayFadeOpacity      : 0.9                        // <-- Overlay opacity
    };

    // =============================================================================
    // REGION | Video Player UI Creation
    // =============================================================================

    // FUNCTION | Create Video Player Container
    // -------------------------------------------------------------------------
    function createVideoPlayerUI() {
        const playerContainer = document.createElement('div');
        playerContainer.id = 'na-video-player-container';
        playerContainer.className = 'na-video-player-hidden';
        
        playerContainer.innerHTML = `
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

        document.body.appendChild(playerContainer);
        
        // Store references
        STATE.videoElement = document.getElementById('na-video-element');
        STATE.overlayElement = document.getElementById('na-video-overlay');
        
        attachEventListeners();
        createVideoPlayerStyles();
    }

    // =============================================================================
    // REGION | Event Listeners
    // =============================================================================

    // FUNCTION | Attach Event Listeners
    // -------------------------------------------------------------------------
    function attachEventListeners() {
        const video = STATE.videoElement;
        const overlay = STATE.overlayElement;
        const playOverlayBtn = document.getElementById('na-video-play-overlay-btn');
        const closeBtn = document.getElementById('na-video-close-btn');
        const backdrop = document.getElementById('na-video-backdrop');
        const playBtn = document.getElementById('na-video-play-btn');
        const rewindBtn = document.getElementById('na-video-rewind-btn');
        const forwardBtn = document.getElementById('na-video-forward-btn');
        const muteBtn = document.getElementById('na-video-mute-btn');
        const volumeSlider = document.getElementById('na-video-volume-slider');
        const fullscreenBtn = document.getElementById('na-video-fullscreen-btn');
        const progressBar = document.getElementById('na-video-progress-bar');
        const wrapper = document.getElementById('na-video-wrapper');

        // Play/Pause via overlay
        playOverlayBtn.addEventListener('click', handlePlayPause);
        
        // Close player
        closeBtn.addEventListener('click', closeVideoPlayer);
        backdrop.addEventListener('click', closeVideoPlayer);
        
        // Standard controls
        playBtn.addEventListener('click', handlePlayPause);
        rewindBtn.addEventListener('click', () => skipTime(-10));
        forwardBtn.addEventListener('click', () => skipTime(10));
        muteBtn.addEventListener('click', toggleMute);
        volumeSlider.addEventListener('input', handleVolumeChange);
        fullscreenBtn.addEventListener('click', toggleFullscreen);
        progressBar.addEventListener('click', handleProgressBarClick);
        
        // Video events
        video.addEventListener('play', handleVideoPlay);
        video.addEventListener('pause', handleVideoPause);
        video.addEventListener('ended', handleVideoEnded);
        video.addEventListener('timeupdate', updateProgress);
        video.addEventListener('loadedmetadata', updateDuration);
        video.addEventListener('loadeddata', handleVideoLoaded);
        video.addEventListener('waiting', handleVideoWaiting);
        video.addEventListener('playing', handleVideoPlaying);
        video.addEventListener('canplay', handleVideoCanPlay);
        
        // Mouse movement for controls auto-hide
        wrapper.addEventListener('mousemove', showControls);
        wrapper.addEventListener('mouseleave', hideControls);
        
        // Keyboard controls
        document.addEventListener('keydown', handleKeyboardControls);
        
        // Fullscreen change events
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('mozfullscreenchange', handleFullscreenChange);
        document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    }

    // =============================================================================
    // REGION | Player Control Functions
    // =============================================================================

    // FUNCTION | Play/Pause Toggle
    // -------------------------------------------------------------------------
    function handlePlayPause() {
        const video = STATE.videoElement;
        
        if (video.paused) {
            video.play();
        } else {
            video.pause();
        }
    }

    // FUNCTION | Handle Video Play Event
    // -------------------------------------------------------------------------
    function handleVideoPlay() {
        STATE.overlayElement.style.opacity = '0';
        STATE.overlayElement.style.pointerEvents = 'none';
        
        document.querySelector('.na-play-icon').style.display = 'none';
        document.querySelector('.na-pause-icon').style.display = 'inline';
        
        showControls();
    }

    // FUNCTION | Handle Video Pause Event
    // -------------------------------------------------------------------------
    function handleVideoPause() {
        STATE.overlayElement.style.opacity = CONFIG.overlayFadeOpacity;
        STATE.overlayElement.style.pointerEvents = 'auto';
        
        document.querySelector('.na-play-icon').style.display = 'inline';
        document.querySelector('.na-pause-icon').style.display = 'none';
        
        clearTimeout(STATE.controlsTimeout);
    }

    // FUNCTION | Handle Video Ended Event
    // -------------------------------------------------------------------------
    function handleVideoEnded() {
        STATE.overlayElement.style.opacity = CONFIG.overlayFadeOpacity;
        STATE.overlayElement.style.pointerEvents = 'auto';
        
        document.querySelector('.na-play-icon').style.display = 'inline';
        document.querySelector('.na-pause-icon').style.display = 'none';
    }

    // FUNCTION | Handle Video Loaded
    // -------------------------------------------------------------------------
    function handleVideoLoaded() {
        console.log('[VideoPlayer] Video data loaded');
        hideBuffering();
    }

    // FUNCTION | Handle Video Waiting (Buffering)
    // -------------------------------------------------------------------------
    function handleVideoWaiting() {
        console.log('[VideoPlayer] Video buffering...');
        showBuffering();
    }

    // FUNCTION | Handle Video Playing (After Buffer)
    // -------------------------------------------------------------------------
    function handleVideoPlaying() {
        console.log('[VideoPlayer] Video playing smoothly');
        hideBuffering();
    }

    // FUNCTION | Handle Video Can Play
    // -------------------------------------------------------------------------
    function handleVideoCanPlay() {
        console.log('[VideoPlayer] Video ready to play');
        hideBuffering();
    }

    // FUNCTION | Show Buffering Indicator
    // -------------------------------------------------------------------------
    function showBuffering() {
        const buffering = document.getElementById('na-video-buffering');
        if (buffering) {
            buffering.style.display = 'flex';
        }
    }

    // FUNCTION | Hide Buffering Indicator
    // -------------------------------------------------------------------------
    function hideBuffering() {
        const buffering = document.getElementById('na-video-buffering');
        if (buffering) {
            buffering.style.display = 'none';
        }
    }

    // FUNCTION | Skip Time Forward/Backward
    // -------------------------------------------------------------------------
    function skipTime(seconds) {
        const video = STATE.videoElement;
        video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
    }

    // FUNCTION | Toggle Mute
    // -------------------------------------------------------------------------
    function toggleMute() {
        const video = STATE.videoElement;
        video.muted = !video.muted;
        
        document.querySelector('.na-volume-icon').style.display = video.muted ? 'none' : 'inline';
        document.querySelector('.na-muted-icon').style.display = video.muted ? 'inline' : 'none';
    }

    // FUNCTION | Handle Volume Change
    // -------------------------------------------------------------------------
    function handleVolumeChange(e) {
        const video = STATE.videoElement;
        video.volume = e.target.value / 100;
        
        if (video.volume === 0) {
            video.muted = true;
            document.querySelector('.na-volume-icon').style.display = 'none';
            document.querySelector('.na-muted-icon').style.display = 'inline';
        } else {
            video.muted = false;
            document.querySelector('.na-volume-icon').style.display = 'inline';
            document.querySelector('.na-muted-icon').style.display = 'none';
        }
    }

    // FUNCTION | Toggle Fullscreen
    // -------------------------------------------------------------------------
    function toggleFullscreen() {
        const wrapper = document.getElementById('na-video-wrapper');
        
        if (!STATE.isFullscreen) {
            if (wrapper.requestFullscreen) {
                wrapper.requestFullscreen();
            } else if (wrapper.webkitRequestFullscreen) {
                wrapper.webkitRequestFullscreen();
            } else if (wrapper.mozRequestFullScreen) {
                wrapper.mozRequestFullScreen();
            } else if (wrapper.msRequestFullscreen) {
                wrapper.msRequestFullscreen();
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
    }

    // FUNCTION | Handle Fullscreen Change
    // -------------------------------------------------------------------------
    function handleFullscreenChange() {
        STATE.isFullscreen = !!(document.fullscreenElement || 
                                document.webkitFullscreenElement || 
                                document.mozFullScreenElement || 
                                document.msFullscreenElement);
        
        document.querySelector('.na-fullscreen-icon').style.display = 
            STATE.isFullscreen ? 'none' : 'inline';
        document.querySelector('.na-exit-fullscreen-icon').style.display = 
            STATE.isFullscreen ? 'inline' : 'none';
    }

    // FUNCTION | Handle Progress Bar Click
    // -------------------------------------------------------------------------
    function handleProgressBarClick(e) {
        const video = STATE.videoElement;
        const progressBar = e.currentTarget;
        const rect = progressBar.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        
        video.currentTime = percent * video.duration;
    }

    // FUNCTION | Update Progress Bar
    // -------------------------------------------------------------------------
    function updateProgress() {
        const video = STATE.videoElement;
        const progressFilled = document.getElementById('na-video-progress-filled');
        const currentTimeDisplay = document.getElementById('na-video-current-time');
        
        const percent = (video.currentTime / video.duration) * 100;
        progressFilled.style.width = `${percent}%`;
        
        currentTimeDisplay.textContent = formatTime(video.currentTime);
    }

    // FUNCTION | Update Duration Display
    // -------------------------------------------------------------------------
    function updateDuration() {
        const video = STATE.videoElement;
        const durationDisplay = document.getElementById('na-video-duration');
        
        durationDisplay.textContent = formatTime(video.duration);
    }

    // FUNCTION | Format Time (seconds to MM:SS)
    // -------------------------------------------------------------------------
    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    // FUNCTION | Show Controls
    // -------------------------------------------------------------------------
    function showControls() {
        const controls = document.getElementById('na-video-controls');
        controls.style.opacity = '1';
        
        clearTimeout(STATE.controlsTimeout);
        
        if (!STATE.videoElement.paused) {
            STATE.controlsTimeout = setTimeout(hideControls, CONFIG.controlsAutoHideDelay);
        }
    }

    // FUNCTION | Hide Controls
    // -------------------------------------------------------------------------
    function hideControls() {
        if (!STATE.videoElement.paused) {
            const controls = document.getElementById('na-video-controls');
            controls.style.opacity = '0';
        }
    }

    // FUNCTION | Keyboard Controls
    // -------------------------------------------------------------------------
    function handleKeyboardControls(e) {
        if (!STATE.videoPlayerActive) return;
        
        switch(e.key) {
            case ' ':
            case 'k':
                e.preventDefault();
                handlePlayPause();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                skipTime(-10);
                break;
            case 'ArrowRight':
                e.preventDefault();
                skipTime(10);
                break;
            case 'f':
                e.preventDefault();
                toggleFullscreen();
                break;
            case 'm':
                e.preventDefault();
                toggleMute();
                break;
            case 'Escape':
                if (!STATE.isFullscreen) {
                    closeVideoPlayer();
                }
                break;
        }
    }

    // =============================================================================
    // REGION | Public API Functions
    // =============================================================================

    // FUNCTION | Open Video Player
    // -------------------------------------------------------------------------
    function openVideoPlayer(videoData) {
        STATE.currentVideo = videoData;
        STATE.videoPlayerActive = true;
        
        const container = document.getElementById('na-video-player-container');
        const video = STATE.videoElement;
        const title = document.getElementById('na-video-title');
        const description = document.getElementById('na-video-description');
        
        console.log(`[VideoPlayer] Opening video: ${videoData.name}`);
        console.log(`[VideoPlayer] CDN URL: ${videoData.cdnUrl}`);
        
        // Show buffering while loading
        showBuffering();
        
        // Set video source
        video.src = videoData.cdnUrl;
        
        // Preload video
        video.load();
        
        // Set video info
        title.textContent = videoData.name || 'Video';
        description.textContent = videoData.type || '';
        
        // Show player
        container.classList.remove('na-video-player-hidden');
        container.classList.add('na-video-player-visible');
        
        // Show overlay with first frame when metadata loads
        video.addEventListener('loadedmetadata', function onMetadata() {
            // Generate thumbnail from first frame
            video.currentTime = 0.1; // Seek to 0.1s to get first frame
            video.removeEventListener('loadedmetadata', onMetadata);
        }, { once: true });
        
        // When seeked to first frame, show it
        video.addEventListener('seeked', function onSeeked() {
            STATE.overlayElement.style.opacity = CONFIG.overlayFadeOpacity;
            STATE.overlayElement.style.pointerEvents = 'auto';
            hideBuffering();
            video.removeEventListener('seeked', onSeeked);
        }, { once: true });
        
        console.log(`[VideoPlayer] Opened video: ${videoData.name}`);
    }

    // FUNCTION | Close Video Player
    // -------------------------------------------------------------------------
    function closeVideoPlayer() {
        const container = document.getElementById('na-video-player-container');
        const video = STATE.videoElement;
        
        // Pause and reset video
        video.pause();
        video.src = '';
        
        // Hide player
        container.classList.remove('na-video-player-visible');
        container.classList.add('na-video-player-hidden');
        
        // Exit fullscreen if active
        if (STATE.isFullscreen) {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
        
        STATE.videoPlayerActive = false;
        STATE.currentVideo = null;
        
        console.log('[VideoPlayerPage] Closed video player');
    }

    // FUNCTION | Initialize Module
    // -------------------------------------------------------------------------
    function initialize() {
        console.log('[VideoPlayerPage] Initializing video player module...');
        
        createVideoPlayerUI();
        
        console.log('[VideoPlayerPage] Video player module initialized successfully');
    }

    // =============================================================================
    // REGION | Styles
    // =============================================================================

    // FUNCTION | Create Video Player Styles
    // -------------------------------------------------------------------------
    function createVideoPlayerStyles() {
        const styleId = 'na-video-player-styles';
        
        if (document.getElementById(styleId)) return;
        
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
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
                transition: opacity ${CONFIG.fadeTransitionTime}ms ease;
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
                z-index: 10001;
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
            }
            
            /* Video Element */
            .na-video-element {
                width: 100%;
                height: auto;
                display: block;
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
                transition: opacity ${CONFIG.fadeTransitionTime}ms ease;
                z-index: 10;
                backdrop-filter: blur(5px);
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
            }
            
            .na-video-wrapper:-webkit-full-screen {
                width: 100vw;
                height: 100vh;
            }
            
            .na-video-wrapper:-moz-full-screen {
                width: 100vw;
                height: 100vh;
            }
            
            .na-video-wrapper:-ms-fullscreen {
                width: 100vw;
                height: 100vh;
            }
        `;
        
        document.head.appendChild(style);
    }

    // =============================================================================
    // REGION | Module Export & Registration
    // =============================================================================

    // Export public API
    window.TrueVision3D.VideoPlayerPage = {
        initialize,
        openVideoPlayer,
        closeVideoPlayer
    };

    // MANDATORY | Mark module as loaded
    if (window.TrueVision3D.ModuleDependencyManager) {
        window.TrueVision3D.ModuleDependencyManager.markModuleLoaded(MODULE_NAME);
    }

    console.log('[VideoPlayerPage] Module loaded and registered');

// endregion -------------------------------------------------------------------
})();

