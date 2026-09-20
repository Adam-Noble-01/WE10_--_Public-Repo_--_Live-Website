// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - CUSTOM SCRAPBOOK - TRANSPORT
// =============================================================================
//
// FILE       : Na__LayoutEditor__ScrapbookCustom__Transport__.js
// NAMESPACE  : Na__LeScrapCustomIo
// MODULE     : Layout Editor - Custom Scrapbook Transport
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Read the Custom Scrapbook's index and item files, and save and delete items through the ProjectVision local server
// CREATED    : 19-Sep-2026
//
// DESCRIPTION:
// - THE LIBRARY IS FILES. One JSON file per item, in a category folder of
//   51__LayoutEditor__UserScrapbookContent beside Index.html, and one index
//   file at its root listing them all. This module is the only one that
//   knows where any of that is, or that a server is involved.
// - READING WORKS EVERYWHERE. On the ProjectVision local server the index is
//   asked of the API, which rebuilds it from the folders first, so a file
//   dropped in by hand is there. Anywhere else - a static server, the live
//   website - the index file itself is read, which is as fresh as the last
//   save that was pushed. Item files are plain GETs in both cases.
// - WRITING NEEDS THE LOCAL SERVER. Save and Delete POST to it; without it
//   the library reports itself read-only and the section says so. A server
//   that answers /api/health but not the scrapbook routes was started before
//   they existed - it never reloads its routes - and that is reported as a
//   restart, not as "no server".
// - NEVER THROWS. Every call resolves to a result the panel can put in a
//   toast: { ok, error, ... }.
//
// INTEGRATION:
// - Na__LayoutEditor__ScrapbookCustom__ configures this with the config's
//   Library block and calls everything else.
// - Server side: na-apps/ProjectVision__TrueVisionScrapbook__Api__.py.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (19-Sep-2026)
// - ValeVision    : 1.0.0 ported 20-Sep-2026 as ValeVision3D v2.69.0, adapted: its server is
//                   Whitecardopedia's server.py, known by /api/check-localhost, with the
//                   routes under /api/valevision/scrapbook.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Sep-2026 - Version 1.0.0
// - Initial implementation: ReadIndex, ReadItem, Save and Delete.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Project URL Utilities
    // ------------------------------------------------------------
    import { Na__AppUtils__IsRunningOnLocalhost } from '../../03__AppUtils/Na__AppUtils__ProjectLoader.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The App Root, the Server's Name and Where an Index Came From
    // ------------------------------------------------------------
    const Na__LeScrapCustomIo__AppRootUrl    = new URL('../../../', import.meta.url);      // <-- 56__Feature / 51__System / 02__Src: the folder Index.html is in
    const Na__LeScrapCustomIo__ServerService = 'na-projectvision-local-dev';                // <-- The name the ProjectVision local server gives in /api/health
    const Na__LeScrapCustomIo__SOURCE_API    = 'api';
    const Na__LeScrapCustomIo__SOURCE_FILE   = 'file';
    const Na__LeScrapCustomIo__SOURCE_NONE   = 'none';
    const Na__LeScrapCustomIo__WHY_NO_SERVER = 'no-server';                                 // <-- Why the library cannot be written to
    const Na__LeScrapCustomIo__WHY_RESTART   = 'restart';
    const Na__LeScrapCustomIo__INDEX_ITEMS   = 'UserScrapbook__Index__Items';
    // ------------------------------------------------------------

    // MODULE VARIABLES | Where the Library Is (the config's Library block)
    // ------------------------------------------------------------
    let Na__LeScrapCustomIo__Place = { contentFolder : '51__LayoutEditor__UserScrapbookContent', indexFile : 'UserScrapbook__Index__.json', apiPath : '/api/truevision/scrapbook' };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // FUNCTION | Say Where the Library Is
    // ------------------------------------------------------------
    // Anything missing keeps the value above, which is where Adam made it.
    // ------------------------------------------------------------
    function Na__LeScrapCustomIo__Configure(library) {
        const block = (library && typeof library === 'object') ? library : {};
        const text  = (value, fallback) => ((typeof value === 'string' && value.trim() !== '') ? value.trim() : fallback);
        Na__LeScrapCustomIo__Place = {
            contentFolder : text(block.Library__ContentFolder, Na__LeScrapCustomIo__Place.contentFolder).replace(/^\/+|\/+$/g, ''),
            indexFile     : text(block.Library__IndexFile,     Na__LeScrapCustomIo__Place.indexFile),
            apiPath       : '/' + text(block.Library__ApiPath, Na__LeScrapCustomIo__Place.apiPath).replace(/^\/+|\/+$/g, '')
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The URL of a File in the Content Folder
    // ------------------------------------------------------------
    // relativePath is 'Category/File.json', or just the index file's name.
    // Each part is encoded on its own, so a slash stays a slash.
    // ------------------------------------------------------------
    function Na__LeScrapCustomIo__FileUrl(relativePath) {
        const parts = String(relativePath).split('/').filter((part) => part !== '' && part !== '.' && part !== '..').map(encodeURIComponent);
        return new URL(Na__LeScrapCustomIo__Place.contentFolder + '/' + parts.join('/'), Na__LeScrapCustomIo__AppRootUrl).href;
    }
    function Na__LeScrapCustomIo__ApiUrl(suffix) {
        return window.location.origin + Na__LeScrapCustomIo__Place.apiPath + (suffix || '');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Is the ProjectVision Local Server the One Answering
    // ------------------------------------------------------------
    // Asked only after the scrapbook routes have not answered, to tell a
    // server that needs a restart from a static server that cannot save at
    // all. Never throws.
    // ------------------------------------------------------------
    async function Na__LeScrapCustomIo__IsProjectVisionServer() {
        try {
            const response = await fetch(window.location.origin + '/api/health', { cache : 'no-store' });
            const health   = response.ok ? await response.json().catch(() => null) : null;
            return !!(health && health.service === Na__LeScrapCustomIo__ServerService);
        } catch (error) {
            return false;
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Items an Index Document Lists
    // ------------------------------------------------------------
    // Only entries with a file and a category: an index is written by the
    // server but may have been edited by hand.
    // ------------------------------------------------------------
    function Na__LeScrapCustomIo__ItemsOf(index) {
        const list = (index && Array.isArray(index[Na__LeScrapCustomIo__INDEX_ITEMS])) ? index[Na__LeScrapCustomIo__INDEX_ITEMS] : [];
        return list.filter((entry) => !!entry && typeof entry.Item__File === 'string' && entry.Item__File !== '' && typeof entry.Item__Category === 'string');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Reading
// -----------------------------------------------------------------------------

    // FUNCTION | Read the Index
    // ------------------------------------------------------------
    // Resolves to { ok, items, source, writable, why, error }.
    //     source    'api' from the local server, 'file' from the index file,
    //               'none' when neither could be read
    //     writable  true only when the local server's scrapbook routes answer
    //     why       when not writable: 'restart' for a ProjectVision server
    //               started before the routes existed, else 'no-server'
    // A library with no index file yet is an empty library, not an error.
    // ------------------------------------------------------------
    async function Na__LeScrapCustomIo__ReadIndex() {
        let why = Na__LeScrapCustomIo__WHY_NO_SERVER;
        if (Na__AppUtils__IsRunningOnLocalhost()) {
            try {
                const response = await fetch(Na__LeScrapCustomIo__ApiUrl(''), { cache : 'no-store' });
                const answer   = response.ok ? await response.json().catch(() => null) : null;
                if (answer && answer.status === 'ok' && answer.index) {
                    return { ok : true, items : Na__LeScrapCustomIo__ItemsOf(answer.index), source : Na__LeScrapCustomIo__SOURCE_API, writable : true, why : null, error : null };
                }
                if (await Na__LeScrapCustomIo__IsProjectVisionServer()) why = Na__LeScrapCustomIo__WHY_RESTART;
            } catch (error) { /* no server behind this origin: the index file is read instead */ }
        }
        try {
            const response = await fetch(Na__LeScrapCustomIo__FileUrl(Na__LeScrapCustomIo__Place.indexFile), { cache : 'no-store' });
            if (response.status === 404) return { ok : true, items : [], source : Na__LeScrapCustomIo__SOURCE_FILE, writable : false, why : why, error : null };
            if (!response.ok) throw new Error('HTTP ' + response.status);
            return { ok : true, items : Na__LeScrapCustomIo__ItemsOf(await response.json()), source : Na__LeScrapCustomIo__SOURCE_FILE, writable : false, why : why, error : null };
        } catch (error) {
            return { ok : false, items : [], source : Na__LeScrapCustomIo__SOURCE_NONE, writable : false, why : why, error : (error && error.message) || 'the index could not be read' };
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Read One Item File
    // ------------------------------------------------------------
    // relativeFile is the index's Item__File: 'Category/File.json'. Resolves
    // to { ok, item, error }.
    // ------------------------------------------------------------
    async function Na__LeScrapCustomIo__ReadItem(relativeFile) {
        try {
            const response = await fetch(Na__LeScrapCustomIo__FileUrl(relativeFile), { cache : 'no-store' });
            if (!response.ok) throw new Error('HTTP ' + response.status);
            const item = await response.json();
            if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('not a scrapbook item');
            return { ok : true, item : item, error : null };
        } catch (error) {
            return { ok : false, item : null, error : (error && error.message) || 'the item could not be read' };
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Writing
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | POST JSON to a Scrapbook Route; Never Throws
    // ------------------------------------------------------------
    // Resolves to { ok, answer, error }. The server answers in JSON with an
    // error of its own; a static server does not, and a ProjectVision server
    // without the routes answers 404 or 405.
    // ------------------------------------------------------------
    async function Na__LeScrapCustomIo__Post(suffix, payload) {
        try {
            const response = await fetch(Na__LeScrapCustomIo__ApiUrl(suffix), {
                method  : 'POST',
                headers : { 'Content-Type' : 'application/json' },
                body    : JSON.stringify(payload)
            });
            const answer = await response.json().catch(() => null);
            if (response.ok && answer && answer.status === 'ok') return { ok : true, answer : answer, error : null };
            if (answer && answer.error) return { ok : false, answer : null, error : String(answer.error) };
            if (await Na__LeScrapCustomIo__IsProjectVisionServer()) {
                return { ok : false, answer : null, error : 'the ProjectVision local server is running without the scrapbook routes (' + response.status + ') - restart it' };
            }
            return { ok : false, answer : null, error : 'no local save server at ' + window.location.origin + ' (' + response.status + ') - serve the app with the ProjectVision local server' };
        } catch (error) {
            return { ok : false, answer : null, error : 'the local server did not answer (' + ((error && error.message) || 'no answer') + ')' };
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Save an Item as a New File
    // ------------------------------------------------------------
    // The server names the file, stamps the item with its id, name, category
    // and times, writes it and rewrites the index. Resolves to
    // { ok, entry, items, error }: entry is the new item's index entry and
    // items the whole index after the save.
    // ------------------------------------------------------------
    async function Na__LeScrapCustomIo__Save(categoryFolder, name, itemDocument) {
        const result = await Na__LeScrapCustomIo__Post('/items', { category : categoryFolder, name : name, item : itemDocument });
        if (!result.ok) return { ok : false, entry : null, items : null, error : result.error };
        return { ok : true, entry : result.answer.item || null, items : Na__LeScrapCustomIo__ItemsOf(result.answer.index), error : null };
    }
    // ------------------------------------------------------------


    // FUNCTION | Delete an Item (the server moves its file to the quarantine folder)
    // ------------------------------------------------------------
    // Resolves to { ok, items, error }: items is the index after the delete.
    // ------------------------------------------------------------
    async function Na__LeScrapCustomIo__Delete(relativeFile) {
        const result = await Na__LeScrapCustomIo__Post('/items/delete', { file : relativeFile });
        if (!result.ok) return { ok : false, items : null, error : result.error };
        return { ok : true, items : Na__LeScrapCustomIo__ItemsOf(result.answer.index), error : null };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Custom Scrapbook Transport API
    // ------------------------------------------------------------
    export {
        Na__LeScrapCustomIo__SOURCE_API,
        Na__LeScrapCustomIo__SOURCE_FILE,
        Na__LeScrapCustomIo__SOURCE_NONE,
        Na__LeScrapCustomIo__WHY_NO_SERVER,
        Na__LeScrapCustomIo__WHY_RESTART,
        Na__LeScrapCustomIo__Configure,
        Na__LeScrapCustomIo__ReadIndex,
        Na__LeScrapCustomIo__ReadItem,
        Na__LeScrapCustomIo__Save,
        Na__LeScrapCustomIo__Delete
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
