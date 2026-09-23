// =============================================================================
// TRUEVISION3D - PUBLISHED SCHEMA - VERSION GATE
// =============================================================================
//
// FILE       : Na__PublishedSchema__Version__.js
// NAMESPACE  : Na__PubVer
// MODULE     : Published Schema - Version Gate
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Decide what a reader will and will not read, and say why in words a person can act on
// SCHEMA REF : na-project-portal/26-Projects/AA00__ExampleProjectStructure/
//              30__TrueVision__AppContent/06__Layout__PublishedDocuments
//              ^ The readable schema. CHANGE A KEY HERE, CHANGE IT THERE.
// CREATED    : 23-Sep-2026
//
// DESCRIPTION:
// - THE ONE GATE IN THE READER, and it is not a fingerprint. A published
//   document is a deliverable, not a cache entry: the reader does not ask
//   whether the document matches the model it was baked from, because it holds
//   no model and could do nothing about the answer. It asks one question - is
//   this schema one I understand - and if the answer is no it says so plainly
//   rather than half-reading the file.
// - REFUSING NEWER IS THE POINT. A reader that understands schema 1 meeting a
//   schema 2 document must stop. Reading it optimistically means a key that
//   moved is silently absent, and a dimension that silently vanishes from a
//   client's drawing is worse than a drawing that says it cannot be shown.
// - REFUSING OLDER IS ALSO THE POINT, for the same reason in reverse. Both are
//   an honest "re-publish this", which is a thing Adam can do in one click.
// - EVERY REFUSAL CARRIES A REASON STRING meant for a human: it reaches the grey
//   mask on the sheet and the console, so "why is this drawing blank" is
//   answerable without a debugger.
//
// INTEGRATION:
// - 52__System__Layout__PublishedDocuments - the reader gates the index once and
//   each manifest as it loads.
// - 51__System__LayoutEditor/65__Feature__DocumentPublishing - the publisher
//   stamps the version it writes from Na__PubSchema__Get().schemaVersion, so the
//   two can never disagree by accident.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 23-Sep-2026 - Version 1.0.0
// - Created with the index and manifest gates for schema version 1.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    import { Na__PubSchema__Get } from './Na__PublishedSchema__Paths__.js';

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    const Na__PubVer__REASON = {
        ok          : 'ok',
        noFile      : 'the file could not be read',
        notObject   : 'the file is not a published document',
        noVersion   : 'the file does not say which schema it is',
        tooNew      : 'the file was published by a newer version of TrueVision',
        tooOld      : 'the file was published by an older version of TrueVision'
    };

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Version Comparison
// -----------------------------------------------------------------------------

    // FUNCTION | The Schema Version This Build Reads and Writes
    // ------------------------------------------------------------
    function Na__PubVer__Current() {
        return Na__PubSchema__Get().schemaVersion;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Judge One Version Number Against This Build
    // ------------------------------------------------------------
    function Na__PubVer__Judge(found, what) {
        const mine = Na__PubVer__Current();
        if (!Number.isInteger(found)) {
            return { Ok : false, Code : 'noVersion',
                     Reason : what + ' ' + Na__PubVer__REASON.noVersion + '.' };
        }
        if (found > mine) {
            return { Ok : false, Code : 'tooNew', Found : found, Expected : mine,
                     Reason : what + ' ' + Na__PubVer__REASON.tooNew +
                              ' (schema ' + found + '; this app reads ' + mine + '). Reload the page to pick up the newer app.' };
        }
        if (found < mine) {
            return { Ok : false, Code : 'tooOld', Found : found, Expected : mine,
                     Reason : what + ' ' + Na__PubVer__REASON.tooOld +
                              ' (schema ' + found + '; this app reads ' + mine + '). It needs publishing again.' };
        }
        return { Ok : true, Code : 'ok', Found : found, Expected : mine, Reason : Na__PubVer__REASON.ok };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Gates
// -----------------------------------------------------------------------------

    // FUNCTION | May This Build Read This Project Index?
    // ------------------------------------------------------------
    function Na__PubVer__ReadsIndex(index) {
        if (!index || typeof index !== 'object') {
            return { Ok : false, Code : 'notObject', Reason : 'The published drawings index ' + Na__PubVer__REASON.noFile + '.' };
        }
        const block = index['PublishedDocuments__Publish'];
        const found = (block && typeof block === 'object') ? block['Publish__SchemaVersion'] : undefined;
        return Na__PubVer__Judge(found, 'The published drawings index');
    }
    // ------------------------------------------------------------


    // FUNCTION | May This Build Read This Document Manifest?
    // ------------------------------------------------------------
    function Na__PubVer__ReadsManifest(manifest) {
        if (!manifest || typeof manifest !== 'object') {
            return { Ok : false, Code : 'notObject', Reason : 'This drawing ' + Na__PubVer__REASON.noFile + '.' };
        }
        const block = manifest['PublishedDocument__Publish'];
        const found = (block && typeof block === 'object') ? block['Publish__SchemaVersion'] : undefined;
        return Na__PubVer__Judge(found, 'This drawing');
    }
    // ------------------------------------------------------------


    // FUNCTION | The Version Block a Publish Stamps
    // ------------------------------------------------------------
    // The publisher never types a schema number. It asks for this, so a bump in
    // the schema JSON reaches the written files with no second edit.
    // ------------------------------------------------------------
    function Na__PubVer__Stamp(appVersion) {
        const now = new Date();
        return {
            Publish__SchemaVersion : Na__PubVer__Current(),
            Publish__AtIso         : now.toISOString(),
            Publish__AtEpochMs     : now.getTime(),
            Publish__ByApp         : 'TrueVision3D Layout Editor',
            Publish__ByAppVersion  : String(appVersion == null ? 'unknown' : appVersion)
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    export {
        Na__PubVer__Current,
        Na__PubVer__ReadsIndex,
        Na__PubVer__ReadsManifest,
        Na__PubVer__Stamp
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
