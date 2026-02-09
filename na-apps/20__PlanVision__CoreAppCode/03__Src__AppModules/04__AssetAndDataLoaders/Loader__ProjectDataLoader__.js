// =============================================================================
// NOBLE ARCHITECTURE | PLANVISION | PROJECT DATA LOADER
// =============================================================================
// FILE       : Loader__ProjectDataLoader__.js
// NAMESPACE  : NaPlanVision.ProjectDataLoader
// MODULE     : ProjectDataLoader
// AUTHOR     : Adam Noble - Noble Architecture
// CREATED    : 09-Feb-2026
//
// PURPOSE:
// - Fetch centralized project data JSON
// - Inject font-face declarations from project data (if provided)
// - Update image sources from project data
// - Provide font availability checks
// =============================================================================

(function () {
    'use strict';

    window.NaPlanVision = window.NaPlanVision || {};

    const PROJECT_DATA_URL = 'https://raw.githubusercontent.com/Adam-Noble-01/RE20_--_Core_Repo_--_Public/refs/heads/main/SN40_31_--_Web-App_-_PlanVision_-_Web-Assets-Library/SN40_31_--_PlanVision_-_Asset-Link-Library.json';

    // -------------------------------------------------------------------------
    // FUNCTION | Fetch Project Data
    // -------------------------------------------------------------------------
    async function Na__FetchProjectData() {
        try {
            const response = await fetch(PROJECT_DATA_URL);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Project data loaded successfully:', data.file_metadata['file-name']);
            return data;
        } catch (error) {
            console.error('Error fetching project data:', error.message);
            return null;
        }
    }

    // -------------------------------------------------------------------------
    // FUNCTION | Load Fonts from Project Data
    // -------------------------------------------------------------------------
    function Na__LoadFontsFromProjectData(projectData) {
        const fontStylesElement = document.getElementById('dynamic-font-styles');
        if (!fontStylesElement) return;

        let fontDeclarations = '';

        // Load Open Sans fonts
        const openSansFonts = projectData?.na_assets?.na_fonts?.['fonts-open-sans'] || {};
        if (openSansFonts) {
            if (openSansFonts['open-sans-regular']) {
                fontDeclarations += `
                    @font-face {
                        font-family: 'Open Sans';
                        font-style: normal;
                        font-weight: 400;
                        src: url('${openSansFonts['open-sans-regular']}') format('truetype');
                        font-display: swap;
                    }
                `;
            } else {
                console.warn('Open Sans Regular not found in project data, using Google Fonts fallback.');
                fontDeclarations += `
                    @font-face {
                        font-family: 'Open Sans';
                        font-style: normal;
                        font-weight: 400;
                        src: url('https://fonts.gstatic.com/s/opensans/v35/memSYaGs126MiZpBA-UvWbX2vVnXBbObj2OVZyOOSr4dVJWUgsjZ0B4gaVI.woff2') format('woff2');
                        font-display: swap;
                    }
                `;
            }
        }

        // Load Caveat fonts (handwriting style for markup)
        const caveatFonts = projectData?.na_assets?.na_fonts?.['fonts-caveat'] || {};
        let hasCaveatFonts = false;

        if (caveatFonts['caveat-regular']) {
            hasCaveatFonts = true;
            fontDeclarations += `
                @font-face {
                    font-family: 'Caveat';
                    font-style: normal;
                    font-weight: 400;
                    src: url('${caveatFonts['caveat-regular']}') format('truetype');
                    font-display: swap;
                }
            `;
        }

        if (caveatFonts['caveat-semi-bold']) {
            hasCaveatFonts = true;
            fontDeclarations += `
                @font-face {
                    font-family: 'Caveat';
                    font-style: normal;
                    font-weight: 600;
                    src: url('${caveatFonts['caveat-semi-bold']}') format('truetype');
                    font-display: swap;
                }
            `;
        }

        if (!hasCaveatFonts) {
            console.warn('Caveat fonts not found in project data, using Google Fonts fallback.');
            fontDeclarations += `
                @font-face {
                    font-family: 'Caveat';
                    font-style: normal;
                    font-weight: 400;
                    src: url('https://fonts.gstatic.com/s/caveat/v17/WnznHAc5bAfYB2QRah7pcpNvOx-pjfJ9eIupYS9AoA.woff2') format('woff2');
                    font-display: swap;
                }
                @font-face {
                    font-family: 'Caveat';
                    font-style: normal;
                    font-weight: 600;
                    src: url('https://fonts.gstatic.com/s/caveat/v17/WnznHAc5bAfYB2QRah7pcpNvOx-pjSx6eIupYS9AoA.woff2') format('woff2');
                    font-display: swap;
                }
            `;
        }

        fontStylesElement.innerHTML = fontDeclarations;
        console.log('Font declarations loaded from project data');
    }

    // -------------------------------------------------------------------------
    // FUNCTION | Update Images from Project Data
    // -------------------------------------------------------------------------
    function Na__UpdateImagesFromProjectData(projectData) {
        if (!projectData || !projectData.na_assets || !projectData.na_assets.images_png) {
            console.warn('Project data missing image definitions, using existing sources');
            return;
        }

        const images = projectData.na_assets.images_png;

        if (images['na-brand-logo']) {
            const logoElements = document.querySelectorAll('img[alt="Noble Architecture Logo"]');
            logoElements.forEach(img => {
                img.src = images['na-brand-logo'];
            });
        }

        console.log('Image sources updated from project data');
    }

    // -------------------------------------------------------------------------
    // FUNCTION | Preload Fonts (Fallback)
    // -------------------------------------------------------------------------
    async function Na__PreloadFonts() {
        try {
            const caveat = new FontFace('Caveat', 'url(https://fonts.gstatic.com/s/caveat/v17/WnznHAc5bAfYB2QRah7pcpNvOx-pjfJ9eIupYS9AoA.woff2)', {
                style: 'normal',
                weight: '400',
                display: 'swap'
            });

            const loadedFace = await caveat.load();
            document.fonts.add(loadedFace);
            console.log('Caveat font preloaded successfully as backup');
            return true;
        } catch (error) {
            console.error('Failed to preload Caveat font:', error);
            return false;
        }
    }

    // -------------------------------------------------------------------------
    // FUNCTION | Check Font Availability
    // -------------------------------------------------------------------------
    async function Na__CheckFontAvailability() {
        if (!document.fonts.check("16px 'Caveat'")) {
            console.warn('Caveat font not loaded or available after initialization. Using fallback fonts.');

            const preloaded = await Na__PreloadFonts();

            if (!preloaded) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = 'https://fonts.googleapis.com/css2?family=Caveat:wght@400;600&display=swap';
                document.head.appendChild(link);
                console.log('Using Google Fonts stylesheet as fallback for Caveat font');
            }

            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                console.error('DEVELOPER WARNING: Sketchy Text Style (Caveat font) failed to load initially.');
            }
        } else {
            console.log('Caveat font loaded successfully. Sketchy text style is available.');
        }
    }

    // -------------------------------------------------------------------------
    // MODULE EXPORT
    // -------------------------------------------------------------------------
    window.NaPlanVision.ProjectDataLoader = {
        fetchProjectData: Na__FetchProjectData,
        loadFontsFromProjectData: Na__LoadFontsFromProjectData,
        updateImagesFromProjectData: Na__UpdateImagesFromProjectData,
        preloadFonts: Na__PreloadFonts,
        checkFontAvailability: Na__CheckFontAvailability
    };
})();
