// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - PROJECT RECORD
// =============================================================================
//
// FILE       : Na__LayoutEditor__ProjectRecord__.js
// NAMESPACE  : Na__LeRecord
// MODULE     : Layout Editor - Project Record (the admin system's own facts)
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Read the client and the site address off the Project Admin record
// CREATED    : 19-Sep-2026
//
// DESCRIPTION:
// - Two facts on every title block already exist elsewhere in the business:
//   the site address, and the client's name as a drawing prints it. They are
//   the admin system's, written once when the project is set up, and copying
//   them by hand into each sheet is how a pack comes to disagree with its own
//   quotation.
// - This module reads them and nothing else. It never writes: the admin system
//   owns those documents.
//
// WHERE THE TWO FACTS LIVE:
// - Site address : ProjectAdmin__Quotation(s)__.json -> quotations[].projectAddress
// - Client name  : ProjectAdmin__ProjectConfig__.json -> clientDrawingName
//
// THE DRAWING NAME IS NOT THE CLIENT RECORD:
// - The full client record - given name, email, telephone, correspondence
//   address - is PII and stays where it belongs: AES-256-GCM encrypted in R2,
//   readable only by the admin Worker holding CLIENT_DATA_KEY. TrueVision has
//   no business holding it and does not ask for it.
// - clientDrawingName is a deliberately smaller thing: the salutation, an
//   initial and the surname, which is what a title block has always printed
//   and what a planning portal publishes anyway. "Mr P. Samra" is public in a
//   way that a full given name is not, and it is stored unencrypted precisely
//   because it is already public on the drawing.
//
// INTEGRATION:
// - Na__LayoutEditor__SheetModel__Common__ seeds the pack's common fields from
//   Fetch() when the project has none, and offers them when they differ.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Project File Locations
    // ------------------------------------------------------------
    import { Na__CfApi__AdminFileLocation } from '../../80__CloudflareIntegration/Na__CloudflareIntegration__ApiClient__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Admin Documents Read, In the Order They Are Tried
    // ------------------------------------------------------------
    const Na__LeRecord__CONFIG_FILE  = 'ProjectAdmin__ProjectConfig__.json';
    const Na__LeRecord__QUOTE_FILES  = [ 'ProjectAdmin__Quotations__.json', 'ProjectAdmin__Quotation__.json' ];
    const Na__LeRecord__FETCH_MS     = 6000;                                    // <-- A seed is a convenience; it never holds the editor open
    // ------------------------------------------------------------


    // MODULE VARIABLES | The One Fetch This Session Makes
    // ------------------------------------------------------------
    // The record cannot change while the editor is open - the admin system is
    // a different app - so one fetch answers every caller. The promise itself
    // is cached, not its result, so two callers in the same tick share it.
    // ------------------------------------------------------------
    let Na__LeRecord__Pending = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Fetching
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Fetch One JSON Document, Never Throwing
    // ------------------------------------------------------------
    // A missing admin folder is the ordinary case for a project set up before
    // the admin system, so 404 is an answer and not an error.
    // ------------------------------------------------------------
    async function Na__LeRecord__FetchJson(url) {
        try {
            const controller = (typeof AbortController === 'function') ? new AbortController() : null;
            const timer      = controller ? setTimeout(() => controller.abort(), Na__LeRecord__FETCH_MS) : null;
            const response   = await fetch(url, { cache : 'no-store', signal : controller ? controller.signal : undefined });
            if (timer) clearTimeout(timer);
            if (!response.ok) return null;
            const data = await response.json();
            return (data && typeof data === 'object') ? data : null;
        } catch (error) {
            return null;                                                        // <-- Offline, blocked, or not there: the seed simply does not happen
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read One Admin Document by Name
    // ------------------------------------------------------------
    async function Na__LeRecord__ReadAdminFile(fileName) {
        const location = Na__CfApi__AdminFileLocation(fileName);
        if (!location) return null;
        const repo = await Na__LeRecord__FetchJson(location.repoUrl);
        if (repo) return repo;
        return await Na__LeRecord__FetchJson(location.cdnUrl);                   // <-- Only answers if the model sync is ever widened to carry the admin folder
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Reading the Two Facts
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Compose the Client's Name as a Drawing Prints It
    // ------------------------------------------------------------
    // Accepts either a plain string - a company, a joint surname, anything the
    // parts do not fit - or { salutation, initial, surname }, which is the
    // ordinary householder case and the reason the parts exist: a title block
    // says "Mr P. Samra", and the salutation has to be stored to be printed.
    // ------------------------------------------------------------
    function Na__LeRecord__ComposeClientName(value) {
        if (typeof value === 'string') return value.trim();
        if (!value || typeof value !== 'object') return '';
        const text = (key) => (typeof value[key] === 'string') ? value[key].trim() : '';
        const composed = text('composed');
        if (composed) return composed;                                          // <-- A stored composition always wins: someone wrote it on purpose
        const initial = text('initial').replace(/\.+$/, '');                    // <-- Stored with or without its full stop; printed with one
        return [ text('salutation'), initial ? initial + '.' : '', text('surname') ]
            .filter((part) => part !== '')
            .join(' ');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Site Address Out of a Quotation Document
    // ------------------------------------------------------------
    // Every quotation on a project describes the same site, so the first one
    // carrying an address answers. Both document shapes are in use across the
    // portal - a quotations array, and a bare single quotation - exactly as
    // the ProjectVision manager reads them.
    // ------------------------------------------------------------
    function Na__LeRecord__AddressFromQuote(document) {
        if (!document || typeof document !== 'object') return '';
        const entries = Array.isArray(document.quotations) ? document.quotations : [ document ];
        for (const entry of entries) {
            if (entry && typeof entry.projectAddress === 'string' && entry.projectAddress.trim()) return entry.projectAddress.trim();
        }
        return '';
    }
    // ------------------------------------------------------------


    // FUNCTION | The Project Admin Record, or Empty Fields If It Has None
    // ------------------------------------------------------------
    // Always resolves, always to { Client, SiteAddress } of strings. A caller
    // seeding a title block wants a value or nothing; it never wants to know
    // which of four ways the fetch failed.
    // ------------------------------------------------------------
    function Na__LeRecord__Fetch() {
        if (Na__LeRecord__Pending) return Na__LeRecord__Pending;
        Na__LeRecord__Pending = (async () => {
            const config = await Na__LeRecord__ReadAdminFile(Na__LeRecord__CONFIG_FILE);
            let address  = '';
            for (const name of Na__LeRecord__QUOTE_FILES) {
                address = Na__LeRecord__AddressFromQuote(await Na__LeRecord__ReadAdminFile(name));
                if (address) break;
            }
            return {
                Client      : config ? Na__LeRecord__ComposeClientName(config.clientDrawingName) : '',
                SiteAddress : address
            };
        })();
        return Na__LeRecord__Pending;
    }
    // ------------------------------------------------------------


    // FUNCTION | Forget the Cached Record (a project change)
    // ------------------------------------------------------------
    function Na__LeRecord__Reset() {
        Na__LeRecord__Pending = null;
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Project Record API
    // ------------------------------------------------------------
    export {
        Na__LeRecord__Fetch,
        Na__LeRecord__Reset,
        Na__LeRecord__ComposeClientName
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
