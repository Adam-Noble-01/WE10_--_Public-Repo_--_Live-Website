// =============================================================================
// TRUEVISION3D - PUBLISHED SCHEMA - PATHS AND TABLES
// =============================================================================
//
// FILE       : Na__PublishedSchema__Paths__.js
// NAMESPACE  : Na__PubSchema
// MODULE     : Published Schema - Paths and Tables
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Build every published folder and file name, and serve the tier and element tables; both the publisher and the reader use these
// SCHEMA REF : na-project-portal/26-Projects/AA00__ExampleProjectStructure/
//              30__TrueVision__AppContent/06__Layout__PublishedDocuments
//              ^ The readable schema. CHANGE A NAME HERE, CHANGE IT THERE.
// CREATED    : 23-Sep-2026
//
// DESCRIPTION:
// - THE ONLY PLACE A PUBLISHED PATH IS SPELLED. The publisher writes files and
//   the reader fetches them, and the two agree because neither builds a name of
//   its own - they both call in here. A publisher that spelled a folder itself
//   and a reader that spelled it slightly differently is a blank drawing on a
//   client's phone, and nothing in either module would look wrong.
// - EVERY PATH IS RELATIVE TO A PROJECT'S 30__TrueVision__AppContent, which is
//   exactly what Na__AppUtils__ResolveAssetUrl takes, so a published asset
//   resolves through the same R2-first, repository-fallback builder as every
//   other project asset. There is no second URL scheme to keep in step.
// - NOTHING HERE TOUCHES THE NETWORK except Ready(), which reads the schema
//   JSON beside this file once. Every builder is synchronous and pure.
// - THE BUILT-IN TABLES ARE THE FILE'S. If the schema JSON cannot be read the
//   module works from the constants below rather than failing, so a missing
//   config never takes a drawing off a client's screen. They are kept identical
//   to the JSON by hand; the JSON is the document, these are the floor.
//
// INTEGRATION:
// - 51__System__LayoutEditor/65__Feature__DocumentPublishing - the publisher
// - 52__System__Layout__PublishedDocuments - the reader
// - Neither of those imports the other. Both import this.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 23-Sep-2026 - Version 1.0.0
// - Created with the folder, file, element and tier tables of schema version 1.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants - the Built-In Floor
// -----------------------------------------------------------------------------

    const Na__PubSchema__ConfigUrl = new URL('./Na__PublishedSchema__.json', import.meta.url);

    const Na__PubSchema__F = {                                                    // <-- Fallbacks: identical to the JSON, by hand
        schemaVersion : 1,
        minReader     : 'v2.142.0',
        folders : {
            root     : '06__Layout__PublishedDocuments',
            archive  : '00__Archive__Revisions',
            shared       : '01__Shared__Patterns',
            sharedImages : '02__Shared__Images',
            elements     : '01__Elements__Data',
            vector   : '02__Viewports__Vector',
            raster   : '03__Viewports__Raster'
        },
        files : {
            index         : 'PublishedDocuments__Index__.json',
            unpublished   : 'PublishedDocuments__Unpublished__.json',
            manifest      : 'Document__Manifest__.json',
            sheet         : 'Document__Sheet__.json',
            readMe        : 'PublishedDocuments__ReadMe__.md',
            pdfPrefix     : 'Document__Print',
            elementPrefix : 'Elements__',
            elementSuffix : '__.json',
            hashLength    : 10
        },
        states : { published : 'published', unpublished : 'unpublished', superseded : 'superseded' },
        vectorSuffix : 'Linework',
        maskSuffix   : 'FogMask',
        // name is the stable identity and is what a manifest records as File__Type.
        // It is NOT the layer type: "group" is a kind with no layer at all, so
        // matching on layerType alone silently fails for exactly one kind.
        kinds : [
            { name : 'viewport',   layerType : 'viewport',   file : 'Elements__Viewports__.json',  arrayKey : 'Elements__Viewports'  },
            { name : 'dimension',  layerType : 'dimension',  file : 'Elements__Dimensions__.json', arrayKey : 'Elements__Dimensions' },
            { name : 'annotation', layerType : 'annotation', file : 'Elements__Text__.json',       arrayKey : 'Elements__Text'       },
            { name : 'vector',     layerType : 'vector',     file : 'Elements__Vectors__.json',    arrayKey : 'Elements__Vectors'    },
            { name : 'area',       layerType : 'area',       file : 'Elements__Areas__.json',      arrayKey : 'Elements__Areas'      },
            { name : 'leader',     layerType : 'leader',     file : 'Elements__Bubbles__.json',    arrayKey : 'Elements__Bubbles'    },
            { name : 'image',      layerType : 'image',      file : 'Elements__Images__.json',     arrayKey : 'Elements__Images'     },
            { name : 'group',      layerType : null,         file : 'Elements__Groups__.json',     arrayKey : 'Elements__Groups'     }
        ],
        tiers : [
            { id : 'Tier01', name : 'Fit',    pixelsPerMm : 2,  maxPixels : 1024, format : 'image/webp', extension : 'webp', quality : 0.90, upToZoom : 1.5,  screen : true  },
            { id : 'Tier02', name : 'Read',   pixelsPerMm : 6,  maxPixels : 3072, format : 'image/webp', extension : 'webp', quality : 0.92, upToZoom : 4.5,  screen : true  },
            { id : 'Tier03', name : 'Detail', pixelsPerMm : 12, maxPixels : 5120, format : 'image/webp', extension : 'webp', quality : 0.94, upToZoom : null, screen : true  },
            { id : 'Print',  name : 'Print',  pixelsPerMm : 20, maxPixels : 8192, format : 'image/png',  extension : 'png',  quality : null, screen : false }
        ]
    };

    const Na__PubSchema__SEGMENT = /^[A-Za-z0-9][A-Za-z0-9_\-.]{0,159}$/;         // <-- One path segment we are willing to build

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    let Na__PubSchema__Setup   = null;                                            // <-- Resolved once, then reused
    let Na__PubSchema__Loading = null;                                            // <-- The in-flight read, so concurrent callers share one fetch

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Configuration Load
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Fold the Schema JSON Onto the Built-In Floor
    // ------------------------------------------------------------
    function Na__PubSchema__Fold(whole) {
        const setup = JSON.parse(JSON.stringify(Na__PubSchema__F));
        if (!whole || typeof whole !== 'object') return setup;

        const version = whole['PublishedSchema__Version'] || {};
        if (Number.isInteger(version['Version__Schema'])) setup.schemaVersion = version['Version__Schema'];
        if (typeof version['Version__MinReader'] === 'string') setup.minReader = version['Version__MinReader'];

        const folders = whole['PublishedSchema__Folders'] || {};
        const folderMap = { root : 'Folders__Root', archive : 'Folders__Archive', shared : 'Folders__Shared',
                            sharedImages : 'Folders__SharedImages',
                            elements : 'Folders__Elements', vector : 'Folders__Vector', raster : 'Folders__Raster' };
        Object.keys(folderMap).forEach((key) => {
            const value = folders[folderMap[key]];
            if (typeof value === 'string' && value !== '') setup.folders[key] = value;
        });

        const files = whole['PublishedSchema__Files'] || {};
        const fileMap = { index : 'Files__Index', unpublished : 'Files__Unpublished', manifest : 'Files__Manifest', sheet : 'Files__Sheet',
                          readMe : 'Files__ReadMe', pdfPrefix : 'Files__PdfPrefix',
                          elementPrefix : 'Files__ElementPrefix', elementSuffix : 'Files__ElementSuffix' };
        Object.keys(fileMap).forEach((key) => {
            const value = files[fileMap[key]];
            if (typeof value === 'string' && value !== '') setup.files[key] = value;
        });
        if (Number.isInteger(files['Files__HashLength'])) setup.files.hashLength = files['Files__HashLength'];

        const states = whole['PublishedSchema__States'] || {};
        ['published', 'unpublished', 'superseded'].forEach((key) => {
            const value = states['States__' + key.charAt(0).toUpperCase() + key.slice(1)];
            if (typeof value === 'string' && value !== '') setup.states[key] = value;
        });

        const kinds = (whole['PublishedSchema__Elements'] || {})['Elements__Kinds'];
        if (Array.isArray(kinds) && kinds.length > 0) {
            setup.kinds = kinds.map((one) => ({
                name      : one['Kind__Name'] || one['Kind__LayerType'] || null,
                layerType : (typeof one['Kind__LayerType'] === 'string') ? one['Kind__LayerType'] : null,
                file      : one['Kind__File'],
                arrayKey  : one['Kind__ArrayKey'],
                sourceKey : one['Kind__SourceKey'] || null,
                resolved  : Array.isArray(one['Kind__Resolved']) ? one['Kind__Resolved'].slice() : []
            })).filter((one) => typeof one.file === 'string' && typeof one.arrayKey === 'string');
        }

        const rasters = whole['PublishedSchema__RasterTiers'] || {};
        if (typeof rasters['RasterTiers__VectorSuffix'] === 'string') setup.vectorSuffix = rasters['RasterTiers__VectorSuffix'];
        if (typeof rasters['RasterTiers__MaskSuffix'] === 'string')   setup.maskSuffix   = rasters['RasterTiers__MaskSuffix'];
        const tiers = rasters['RasterTiers__Tiers'];
        if (Array.isArray(tiers) && tiers.length > 0) {
            setup.tiers = tiers.map((one) => ({
                id          : one['Tier__Id'],
                name        : one['Tier__Name'],
                pixelsPerMm : Number(one['Tier__PixelsPerMm']) || 1,
                maxPixels   : Number(one['Tier__MaxPixels']) || 1024,
                format      : one['Tier__Format'] || 'image/webp',
                extension   : one['Tier__Extension'] || 'webp',
                quality     : (typeof one['Tier__Quality'] === 'number') ? one['Tier__Quality'] : null,
                upToZoom    : (typeof one['Tier__UpToZoom'] === 'number') ? one['Tier__UpToZoom'] : null,
                screen      : one['Tier__Screen'] !== false
            })).filter((one) => typeof one.id === 'string');
        }
        return setup;
    }
    // ------------------------------------------------------------


    // FUNCTION | Read the Schema Once (never throws; falls back to the built-in tables)
    // ------------------------------------------------------------
    function Na__PubSchema__Ready() {
        if (Na__PubSchema__Setup)   return Promise.resolve(Na__PubSchema__Setup);
        if (Na__PubSchema__Loading) return Na__PubSchema__Loading;

        Na__PubSchema__Loading = (async () => {
            try {
                const response = await fetch(Na__PubSchema__ConfigUrl, { cache : 'no-store' });
                if (!response.ok) throw new Error(response.status + ' ' + response.statusText);
                Na__PubSchema__Setup = Na__PubSchema__Fold(await response.json());
            } catch (error) {
                console.warn('[TrueVision3D PublishedSchema] Schema JSON unreadable (' + error.message +
                             '); using the built-in tables.');
                Na__PubSchema__Setup = Na__PubSchema__Fold(null);
            }
            Na__PubSchema__Loading = null;
            return Na__PubSchema__Setup;
        })();
        return Na__PubSchema__Loading;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Resolved Schema, Synchronously (the floor until Ready has run)
    // ------------------------------------------------------------
    function Na__PubSchema__Get() {
        return Na__PubSchema__Setup || (Na__PubSchema__Setup = Na__PubSchema__Fold(null));
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Document Identity
// -----------------------------------------------------------------------------

    // FUNCTION | Compose a Document Id From Its Three Parts
    // ------------------------------------------------------------
    // A drawing is identified by three separate facts and the joined form is
    // never stored - see TrueVision__NOTES__DrawingNumberingSchema__.md. This is
    // the one place the publishing system joins them.
    // ------------------------------------------------------------
    function Na__PubSchema__DocumentId(projectCode, phase, number) {
        const parts = [ projectCode, phase, number ]
            .map((one) => String(one == null ? '' : one).trim())
            .filter((one) => one !== '');
        return parts.length === 3 ? parts.join('_') : '';
    }
    // ------------------------------------------------------------


    // FUNCTION | Is This a Document Id This Module Will Build a Path For?
    // ------------------------------------------------------------
    function Na__PubSchema__IsDocumentId(documentId) {
        return typeof documentId === 'string' && Na__PubSchema__SEGMENT.test(documentId);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Path Builders
// -----------------------------------------------------------------------------
//
// Every return value is relative to a project's 30__TrueVision__AppContent, and
// every one of them returns null rather than a half-built path when the caller
// hands over something that is not a segment. A null is a refusal the caller can
// see; a path built from a bad id is a 404 nobody can trace.
//
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Join Segments With Forward Slashes
    // ------------------------------------------------------------
    function Na__PubSchema__Join() {
        return Array.prototype.slice.call(arguments)
            .filter((one) => typeof one === 'string' && one !== '')
            .join('/');
    }
    // ------------------------------------------------------------


    // FUNCTION | The Published Documents Root
    // ------------------------------------------------------------
    function Na__PubSchema__RootFolder() {
        return Na__PubSchema__Get().folders.root;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Project Index
    // ------------------------------------------------------------
    function Na__PubSchema__IndexPath() {
        const setup = Na__PubSchema__Get();
        return Na__PubSchema__Join(setup.folders.root, setup.files.index);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Paper of Every Unpublished Sheet (one file, beside the index)
    // ------------------------------------------------------------
    function Na__PubSchema__UnpublishedPath() {
        const setup = Na__PubSchema__Get();
        return Na__PubSchema__Join(setup.folders.root, setup.files.unpublished);
    }
    // ------------------------------------------------------------


    // FUNCTION | One Document's Folder
    // ------------------------------------------------------------
    function Na__PubSchema__DocumentFolder(documentId) {
        if (!Na__PubSchema__IsDocumentId(documentId)) return null;
        return Na__PubSchema__Join(Na__PubSchema__Get().folders.root, documentId);
    }
    // ------------------------------------------------------------


    // FUNCTION | One Document's Manifest
    // ------------------------------------------------------------
    function Na__PubSchema__ManifestPath(documentId) {
        const folder = Na__PubSchema__DocumentFolder(documentId);
        return folder ? Na__PubSchema__Join(folder, Na__PubSchema__Get().files.manifest) : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | One Document's Sheet
    // ------------------------------------------------------------
    function Na__PubSchema__SheetPath(documentId) {
        const folder = Na__PubSchema__DocumentFolder(documentId);
        return folder ? Na__PubSchema__Join(folder, Na__PubSchema__Get().files.sheet) : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | One Element File of One Document, by Layer Type or by File Name
    // ------------------------------------------------------------
    function Na__PubSchema__ElementPath(documentId, kindOrFile) {
        const folder = Na__PubSchema__DocumentFolder(documentId);
        if (!folder) return null;
        const setup = Na__PubSchema__Get();
        const kind  = Na__PubSchema__Kind(kindOrFile);
        const file  = kind ? kind.file : (typeof kindOrFile === 'string' && Na__PubSchema__SEGMENT.test(kindOrFile) ? kindOrFile : null);
        return file ? Na__PubSchema__Join(folder, setup.folders.elements, file) : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | One Viewport's Paint-Ready Linework SVG
    // ------------------------------------------------------------
    function Na__PubSchema__VectorPath(documentId, viewportId, hash) {
        const folder = Na__PubSchema__DocumentFolder(documentId);
        if (!folder || !Na__PubSchema__SEGMENT.test(String(viewportId))) return null;
        const setup = Na__PubSchema__Get();
        const name  = [ viewportId, setup.vectorSuffix, Na__PubSchema__Hash(hash) ].join('__') + '.svg';
        return Na__PubSchema__Join(folder, setup.folders.vector, name);
    }
    // ------------------------------------------------------------


    // FUNCTION | One Viewport's Flattened Raster at One Tier
    // ------------------------------------------------------------
    // Tier01 to Tier03 carry their name as well as their id, as the example
    // folder does - Viewport_001__Tier01__Fit__<hash>.webp - because a file name
    // a person may have to read in a bucket listing should say what it is. Print
    // carries only "Print", which already says it.
    // ------------------------------------------------------------
    function Na__PubSchema__RasterPath(documentId, viewportId, tierId, hash) {
        const folder = Na__PubSchema__DocumentFolder(documentId);
        const tier   = Na__PubSchema__Tier(tierId);
        if (!folder || !tier || !Na__PubSchema__SEGMENT.test(String(viewportId))) return null;
        const setup = Na__PubSchema__Get();
        const parts = (tier.name && tier.name !== tier.id) ? [ viewportId, tier.id, tier.name ] : [ viewportId, tier.id ];
        const name  = parts.concat([ Na__PubSchema__Hash(hash) ]).join('__') + '.' + tier.extension;
        return Na__PubSchema__Join(folder, setup.folders.raster, name);
    }
    // ------------------------------------------------------------


    // FUNCTION | One Viewport's Fog Mask at One Screen Tier
    // ------------------------------------------------------------
    // <viewport>__FogMask__<tier>__<name>__<hash>.webp, beside the rasters it
    // belongs to. Only a viewport with depth fog has one: the reader applies it
    // to the linework, because on paper the fog is painted OVER the lines.
    // ------------------------------------------------------------
    function Na__PubSchema__MaskPath(documentId, viewportId, tierId, hash) {
        const folder = Na__PubSchema__DocumentFolder(documentId);
        const tier   = Na__PubSchema__Tier(tierId);
        if (!folder || !tier || !tier.screen || !Na__PubSchema__SEGMENT.test(String(viewportId))) return null;
        const setup = Na__PubSchema__Get();
        const parts = (tier.name && tier.name !== tier.id) ? [ viewportId, setup.maskSuffix, tier.id, tier.name ] : [ viewportId, setup.maskSuffix, tier.id ];
        const name  = parts.concat([ Na__PubSchema__Hash(hash) ]).join('__') + '.webp';
        return Na__PubSchema__Join(folder, setup.folders.raster, name);
    }
    // ------------------------------------------------------------


    // FUNCTION | One Document's Baked PDF
    // ------------------------------------------------------------
    function Na__PubSchema__PdfPath(documentId, hash) {
        const folder = Na__PubSchema__DocumentFolder(documentId);
        if (!folder) return null;
        return Na__PubSchema__Join(folder, Na__PubSchema__Get().files.pdfPrefix + '__' + Na__PubSchema__Hash(hash) + '.pdf');
    }
    // ------------------------------------------------------------


    // FUNCTION | A Shared Image, Stored Once by Its Hash
    // ------------------------------------------------------------
    function Na__PubSchema__SharedImagePath(hash, extension) {
        const ext = String(extension || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!ext) return null;
        return Na__PubSchema__Join(Na__PubSchema__Get().folders.root, Na__PubSchema__Get().folders.sharedImages,
                                   'Image__' + Na__PubSchema__Hash(hash) + '.' + ext);
    }
    // ------------------------------------------------------------


    // FUNCTION | A Shared Asset, From a Path the Files Write as "/name"
    // ------------------------------------------------------------
    // A published file refers to a shared asset with a leading slash, meaning
    // "relative to the published documents root". That is the ONLY shape a
    // shared reference takes, and this is where the slash is turned into a real
    // project-relative path.
    // ------------------------------------------------------------
    function Na__PubSchema__SharedPath(reference) {
        if (typeof reference !== 'string' || reference === '') return null;
        const setup = Na__PubSchema__Get();
        const clean = reference.replace(/^\/+/, '');
        if (clean.indexOf('..') !== -1) return null;                              // <-- Never climb out of the folder
        if (reference.charAt(0) !== '/') return null;                             // <-- Not a shared reference at all
        return Na__PubSchema__Join(setup.folders.root, clean);
    }
    // ------------------------------------------------------------


    // FUNCTION | Resolve a Path a Manifest Holds, Relative to Its Document
    // ------------------------------------------------------------
    // Manifests and element files name their own files relative to the document
    // folder ("03__Viewports__Raster/x.webp"), shared assets with a leading
    // slash, and a sheet picture with "/../05__Layout__DrawingDocs__Images/...",
    // which leaves the published root but stays inside the project's TrueVision
    // content. All three end up as one project-relative path here.
    // ------------------------------------------------------------
    function Na__PubSchema__ResolveDocumentRef(documentId, reference) {
        if (typeof reference !== 'string' || reference === '') return null;
        if (reference.charAt(0) === '/') {
            const setup  = Na__PubSchema__Get();
            const clean  = reference.replace(/^\/+/, '');
            if (clean.slice(0, 3) === '../') {                                    // <-- Out of the published root, still inside the project
                const rest = clean.slice(3);
                return (rest.indexOf('..') === -1) ? rest : null;
            }
            return Na__PubSchema__SharedPath(reference);
        }
        if (reference.indexOf('..') !== -1) return null;
        const folder = Na__PubSchema__DocumentFolder(documentId);
        return folder ? Na__PubSchema__Join(folder, reference) : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Archive Zip Name for a Superseded Revision
    // ------------------------------------------------------------
    function Na__PubSchema__ArchiveName(documentId, revision) {
        if (!Na__PubSchema__IsDocumentId(documentId)) return null;
        const letter = String(revision == null ? '' : revision).trim().replace(/[^A-Za-z0-9]/g, '');
        return letter ? (documentId + '__Revision__' + letter + '.zip') : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Where an Archive Zip Goes (local only - never pushed to R2)
    // ------------------------------------------------------------
    function Na__PubSchema__ArchivePath(documentId, revision) {
        const name = Na__PubSchema__ArchiveName(documentId, revision);
        if (!name) return null;
        const setup = Na__PubSchema__Get();
        return Na__PubSchema__Join(setup.folders.root, setup.folders.archive, name);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Table Lookups
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The First Ten Hex Digits of a Fingerprint, Padded
    // ------------------------------------------------------------
    function Na__PubSchema__Hash(hash) {
        const length = Na__PubSchema__Get().files.hashLength;
        const clean  = String(hash == null ? '' : hash).toLowerCase().replace(/[^0-9a-f]/g, '');
        return (clean + '0000000000000000').slice(0, length);
    }
    // ------------------------------------------------------------


    // FUNCTION | Every Element Kind
    // ------------------------------------------------------------
    function Na__PubSchema__Kinds() {
        return Na__PubSchema__Get().kinds.slice();
    }
    // ------------------------------------------------------------


    // FUNCTION | One Element Kind, by Name, Layer Type, File Name or Array Key
    // ------------------------------------------------------------
    // NAME FIRST, and the name is not the layer type. A manifest records a kind
    // as File__Type, which is the NAME: seven of the eight kinds share a name
    // with their Layer__Type, but groups have no layer at all, so a lookup that
    // only knew about layer types resolved every kind but that one - and the one
    // it missed is the one no drawing paints, so nothing looked wrong.
    // ------------------------------------------------------------
    function Na__PubSchema__Kind(which) {
        if (which == null) return null;
        const want = String(which);
        return Na__PubSchema__Get().kinds.find((one) =>
            one.name === want || one.layerType === want || one.file === want || one.arrayKey === want) || null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Every Raster Tier
    // ------------------------------------------------------------
    function Na__PubSchema__Tiers() {
        return Na__PubSchema__Get().tiers.slice();
    }
    // ------------------------------------------------------------


    // FUNCTION | The Screen Tiers, Smallest First (Print is not one of them)
    // ------------------------------------------------------------
    function Na__PubSchema__ScreenTiers() {
        return Na__PubSchema__Get().tiers
            .filter((one) => one.screen)
            .sort((a, b) => a.pixelsPerMm - b.pixelsPerMm);
    }
    // ------------------------------------------------------------


    // FUNCTION | One Tier by Id
    // ------------------------------------------------------------
    function Na__PubSchema__Tier(tierId) {
        if (tierId == null) return null;
        const want = String(tierId);
        return Na__PubSchema__Get().tiers.find((one) => one.id === want) || null;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Tier a Sheet at This Zoom Should Be Shown At
    // ------------------------------------------------------------
    // upToZoom is the ceiling of each screen tier and the last one has none, so
    // a reader zoomed past every threshold lands on the top tier and stops. The
    // reader holds ONE tier of a viewport at a time; this only says which.
    // ------------------------------------------------------------
    function Na__PubSchema__TierForZoom(zoom) {
        const tiers = Na__PubSchema__ScreenTiers();
        if (tiers.length === 0) return null;
        const want  = Number(zoom);
        if (!Number.isFinite(want) || want <= 0) return tiers[0];
        for (let i = 0; i < tiers.length; i++) {
            const ceiling = tiers[i].upToZoom;
            if (ceiling == null || want <= ceiling) return tiers[i];
        }
        return tiers[tiers.length - 1];
    }
    // ------------------------------------------------------------


    // FUNCTION | The Tier a Screen of This Density Needs
    // ------------------------------------------------------------
    // devicePxPerMm is how many DEVICE pixels one paper millimetre covers on
    // screen right now - the sheet's own CSS pixels per millimetre times its
    // zoom times the device pixel ratio. The answer is the SMALLEST screen tier
    // whose pixels per millimetre meet it, so a picture is never shown upscaled
    // when a sharper one exists and never decoded bigger than the screen can
    // use. Past the top tier the top tier is used. This is the reader's rule;
    // TierForZoom remains for a caller that knows only a zoom factor.
    // ------------------------------------------------------------
    function Na__PubSchema__TierForDensity(devicePxPerMm) {
        const tiers = Na__PubSchema__ScreenTiers();
        if (tiers.length === 0) return null;
        const want = Number(devicePxPerMm);
        if (!Number.isFinite(want) || want <= 0) return tiers[0];
        for (let i = 0; i < tiers.length; i++) {
            if (tiers[i].pixelsPerMm >= want) return tiers[i];
        }
        return tiers[tiers.length - 1];
    }
    // ------------------------------------------------------------


    // FUNCTION | The Pixel Size of a Viewport at a Tier
    // ------------------------------------------------------------
    // The one piece of arithmetic the publisher and any test of it must agree
    // about: paper millimetres times the tier's pixels per millimetre, scaled
    // down whole if the longest side is over the tier's cap.
    // ------------------------------------------------------------
    function Na__PubSchema__TierPixels(tierId, widthMm, heightMm) {
        const tier = Na__PubSchema__Tier(tierId);
        if (!tier) return null;
        const w = Number(widthMm), h = Number(heightMm);
        if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
        let pixelW = w * tier.pixelsPerMm;
        let pixelH = h * tier.pixelsPerMm;
        const longest = Math.max(pixelW, pixelH);
        if (longest > tier.maxPixels) {
            const scale = tier.maxPixels / longest;
            pixelW *= scale;
            pixelH *= scale;
        }
        return { PixelW : Math.max(1, Math.round(pixelW)), PixelH : Math.max(1, Math.round(pixelH)) };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Document States
    // ------------------------------------------------------------
    function Na__PubSchema__States() {
        return Object.assign({}, Na__PubSchema__Get().states);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    export {
        Na__PubSchema__Ready,
        Na__PubSchema__Get,
        Na__PubSchema__DocumentId,
        Na__PubSchema__IsDocumentId,
        Na__PubSchema__RootFolder,
        Na__PubSchema__IndexPath,
        Na__PubSchema__UnpublishedPath,
        Na__PubSchema__DocumentFolder,
        Na__PubSchema__ManifestPath,
        Na__PubSchema__SheetPath,
        Na__PubSchema__ElementPath,
        Na__PubSchema__VectorPath,
        Na__PubSchema__RasterPath,
        Na__PubSchema__MaskPath,
        Na__PubSchema__PdfPath,
        Na__PubSchema__SharedImagePath,
        Na__PubSchema__SharedPath,
        Na__PubSchema__ResolveDocumentRef,
        Na__PubSchema__ArchiveName,
        Na__PubSchema__ArchivePath,
        Na__PubSchema__Hash,
        Na__PubSchema__Kinds,
        Na__PubSchema__Kind,
        Na__PubSchema__Tiers,
        Na__PubSchema__ScreenTiers,
        Na__PubSchema__Tier,
        Na__PubSchema__TierForZoom,
        Na__PubSchema__TierForDensity,
        Na__PubSchema__TierPixels,
        Na__PubSchema__States
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
