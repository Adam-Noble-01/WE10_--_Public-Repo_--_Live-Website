// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - DOCUMENT PUBLISHING - TRANSPORT
// =============================================================================
//
// FILE       : Na__LayoutEditor__Publish__Transport__.js
// NAMESPACE  : Na__LePubNet
// MODULE     : Layout Editor - Document Publishing - Transport
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Put published files on this disk and on R2, archive a superseded revision, and take away only what one document no longer names
// SCHEMA REF : na-project-portal/26-Projects/AA00__ExampleProjectStructure/
//              30__TrueVision__AppContent/06__Layout__PublishedDocuments
//              ^ The readable schema. CHANGE A NAME HERE, CHANGE IT THERE.
// CREATED    : 23-Sep-2026
//
// DESCRIPTION:
// - TWO DESTINATIONS, ONE SHAPE. Every path handed in is relative to
//   06__Layout__PublishedDocuments, and both the local filing API and the R2
//   client take that same path, so the orchestrator never builds a key or a
//   folder of its own.
// - THE LOCAL COPY IS THE AUTHORITY AND GOES FIRST. It is what a reader on
//   localhost sees at once, what the archive zips, and what a later sync or a
//   git commit carries. R2 is written second, and only when asked.
// - NOTHING IS DELETED WIDELY. Both prunes take ONE document id and keep a list;
//   neither can walk the published root. The R2 sync's habit of deleting
//   whatever no local folder holds is right for a mirror and would be ruinous
//   here, where a half-failed publish must leave every other drawing whole.
// - FAILURES COME BACK AS VALUES with a reason a person can act on - "the local
//   server needs restarting" rather than "405".
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 23-Sep-2026 - Version 1.0.0
// - Created with Phase 5 of TrueVision__PLAN__PublishingSystem__.md.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    import { Na__AppUtils__GetProjectFolderFromUrl, Na__AppUtils__GetYearFromUrl } from '../../03__AppUtils/Na__AppUtils__ProjectLoader.js';
    import {
        Na__CfApi__IsConfigured, Na__CfApi__UploadPublished, Na__CfApi__ListPublished, Na__CfApi__DeletePublished
    } from '../../80__CloudflareIntegration/Na__CloudflareIntegration__ApiClient__.js';

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    const Na__LePubNet__API = '/api/truevision/published';

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Local Filing API
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Project Query Every Local Route Takes
    // ------------------------------------------------------------
    function Na__LePubNet__Query(extra) {
        const query = new URLSearchParams({
            'project-folder' : Na__AppUtils__GetProjectFolderFromUrl() || '',
            'year'           : Na__AppUtils__GetYearFromUrl() || '26'
        });
        Object.keys(extra || {}).forEach((key) => { if (extra[key] != null) query.set(key, extra[key]); });
        return query.toString();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Local Response Turned Into { Ok, Json, Reason }
    // ------------------------------------------------------------
    async function Na__LePubNet__Answer(response) {
        let json = null;
        try { json = await response.json(); } catch (error) { json = null; }
        if (response.ok) return { Ok : true, Json : json };
        if (response.status === 405 || (response.status === 404 && !json)) {
            return { Ok : false, Status : response.status,
                     Reason : 'the local server does not have the publishing routes yet - restart ProjectVision__LocalServer__Main__.py (it does not reload its routes)' };
        }
        return { Ok : false, Status : response.status, Reason : (json && json.error) || (response.status + ' ' + response.statusText) };
    }
    // ------------------------------------------------------------


    // FUNCTION | Can This Page File Published Documents Locally?
    // ------------------------------------------------------------
    // Asked once before a publish starts, so a server that has not been
    // restarted since the routes were added says so at the start rather than
    // after a fourteen-sheet render.
    // ------------------------------------------------------------
    async function Na__LePubNet__LocalReady() {
        if (!Na__AppUtils__GetProjectFolderFromUrl()) {
            return { Ok : false, Reason : 'the page has no ?project-folder= in its address, so there is no project folder to publish into' };
        }
        try {
            const response = await fetch(Na__LePubNet__API + '/list?' + Na__LePubNet__Query(), { cache : 'no-store' });
            return await Na__LePubNet__Answer(response);
        } catch (error) {
            return { Ok : false, Reason : 'the local server is not answering (' + error.message + ')' };
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Write One File Into the Project's Published Folder
    // ------------------------------------------------------------
    async function Na__LePubNet__WriteLocal(path, blob) {
        try {
            const response = await fetch(Na__LePubNet__API + '/file?' + Na__LePubNet__Query({ path : path }), {
                method  : 'POST',
                headers : { 'Content-Type' : 'application/octet-stream' },
                body    : blob
            });
            const answer = await Na__LePubNet__Answer(response);
            return answer.Ok ? { Ok : true, Unchanged : !!(answer.Json && answer.Json.unchanged) } : answer;
        } catch (error) {
            return { Ok : false, Reason : 'the local server is not answering (' + error.message + ')' };
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Read One Published JSON File Back, Fresh (null when not published)
    // ------------------------------------------------------------
    async function Na__LePubNet__ReadLocal(path) {
        try {
            const response = await fetch(Na__LePubNet__API + '/file?' + Na__LePubNet__Query({ path : path }), { cache : 'no-store' });
            if (response.status === 404) return null;
            const answer = await Na__LePubNet__Answer(response);
            return answer.Ok && answer.Json ? answer.Json.json : null;
        } catch (error) {
            return null;
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Zip a Document's Folder Into the Archive and Remove It
    // ------------------------------------------------------------
    // The superseded revision is kept whole on this machine; the archive
    // folder starts with 00__, so nothing ever carries it to R2.
    // ------------------------------------------------------------
    async function Na__LePubNet__Archive(documentId, revision) {
        try {
            const response = await fetch(Na__LePubNet__API + '/archive?' + Na__LePubNet__Query({ document : documentId, revision : revision }), { method : 'POST' });
            const answer = await Na__LePubNet__Answer(response);
            return answer.Ok ? { Ok : true, Archived : answer.Json ? answer.Json.archived : null } : answer;
        } catch (error) {
            return { Ok : false, Reason : 'the local server is not answering (' + error.message + ')' };
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Take Away the Files of ONE Document That Its New Manifest Does Not Name
    // ------------------------------------------------------------
    async function Na__LePubNet__PruneLocal(documentId, keepPaths) {
        try {
            const response = await fetch(Na__LePubNet__API + '/prune?' + Na__LePubNet__Query(), {
                method  : 'POST',
                headers : { 'Content-Type' : 'application/json' },
                body    : JSON.stringify({ document : documentId, keep : keepPaths })
            });
            const answer = await Na__LePubNet__Answer(response);
            return answer.Ok ? { Ok : true, Removed : (answer.Json && answer.Json.removed) || [] } : answer;
        } catch (error) {
            return { Ok : false, Reason : 'the local server is not answering (' + error.message + ')' };
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Every File Published Locally, Under the Root or One Document
    // ------------------------------------------------------------
    async function Na__LePubNet__ListLocal(documentId) {
        try {
            const response = await fetch(Na__LePubNet__API + '/list?' + Na__LePubNet__Query(documentId ? { document : documentId } : {}), { cache : 'no-store' });
            const answer = await Na__LePubNet__Answer(response);
            return answer.Ok ? { Ok : true, Files : (answer.Json && answer.Json.files) || [] } : Object.assign({ Files : [] }, answer);
        } catch (error) {
            return { Ok : false, Files : [], Reason : 'the local server is not answering (' + error.message + ')' };
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | R2
// -----------------------------------------------------------------------------

    // FUNCTION | Can This Page Push to R2?
    // ------------------------------------------------------------
    function Na__LePubNet__R2Ready() {
        return Na__CfApi__IsConfigured()
            ? { Ok : true }
            : { Ok : false, Reason : 'the Cloudflare Worker is not configured on this page, so nothing can be pushed to R2' };
    }
    // ------------------------------------------------------------


    // FUNCTION | Put One File on R2
    // ------------------------------------------------------------
    async function Na__LePubNet__PushR2(path, blob) {
        const result = await Na__CfApi__UploadPublished(path, blob);
        return result.ok ? { Ok : true } : { Ok : false, Reason : result.error || 'upload failed' };
    }
    // ------------------------------------------------------------


    // FUNCTION | Check Files Landed on R2 at the Size They Were Sent
    // ------------------------------------------------------------
    // The step between uploading a document's files and writing its manifest:
    // a manifest must never name a file that is not whole in the bucket, because
    // a reader treats that as a broken drawing. Listing the document's prefix
    // gives every size in one call instead of a HEAD per file.
    // ------------------------------------------------------------
    async function Na__LePubNet__VerifyR2(documentId, expected) {
        const listed = await Na__CfApi__ListPublished(documentId);
        if (!listed.ok) return { Ok : false, Reason : 'could not list what reached R2 (' + (listed.error || 'unknown') + ')' };
        const sizes = new Map(listed.objects.map((one) => [ one.path, one.size ]));
        const wrong = [];
        expected.forEach((one) => {
            if (!sizes.has(one.Path)) wrong.push(one.Path + ' is missing');
            else if (Number(sizes.get(one.Path)) !== Number(one.Bytes)) wrong.push(one.Path + ' is ' + sizes.get(one.Path) + ' bytes, not ' + one.Bytes);
        });
        return wrong.length ? { Ok : false, Reason : wrong.slice(0, 5).join('; ') + (wrong.length > 5 ? ' (and ' + (wrong.length - 5) + ' more)' : '') } : { Ok : true };
    }
    // ------------------------------------------------------------


    // FUNCTION | Take Away the R2 Keys of ONE Document That Its New Manifest Does Not Name
    // ------------------------------------------------------------
    // Run only AFTER the new manifest is on R2: until then the old files are
    // what the old manifest names, and a reader may be showing them.
    // ------------------------------------------------------------
    async function Na__LePubNet__PruneR2(documentId, keepPaths) {
        const listed = await Na__CfApi__ListPublished(documentId);
        if (!listed.ok) return { Ok : false, Reason : 'could not list R2 to prune (' + (listed.error || 'unknown') + ')', Removed : [] };
        const keep    = new Set(keepPaths);
        const removed = [];
        const failed  = [];
        for (const object of listed.objects) {
            if (keep.has(object.path)) continue;
            if (object.path.indexOf(documentId + '/') !== 0) continue;           // <-- Never outside this one document
            const result = await Na__CfApi__DeletePublished(object.path);
            if (result.ok) removed.push(object.path); else failed.push(object.path);
        }
        return failed.length ? { Ok : false, Removed : removed, Reason : failed.length + ' stale file(s) could not be removed from R2' } : { Ok : true, Removed : removed };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    export {
        Na__LePubNet__LocalReady,
        Na__LePubNet__WriteLocal,
        Na__LePubNet__ReadLocal,
        Na__LePubNet__ListLocal,
        Na__LePubNet__Archive,
        Na__LePubNet__PruneLocal,
        Na__LePubNet__R2Ready,
        Na__LePubNet__PushR2,
        Na__LePubNet__VerifyR2,
        Na__LePubNet__PruneR2
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
