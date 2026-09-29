// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - STATEMENT PUBLISH
// =============================================================================
//
// FILE       : Na__LayoutEditor__Statement__Publish__.js
// NAMESPACE  : Na__LeStmtPublish
// MODULE     : Layout Editor - Statement Writer - Publishing
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Put a statement where a client can read it: the markdown, an HTML rendering of it, and its pictures, on R2
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - WHAT PUBLISH ACTUALLY SENDS, and why three things rather than one:
//     the markdown   because it is the source, and a statement whose source
//                    exists only on one laptop is one hard drive away from
//                    gone. It goes up exactly as it is on disk.
//     the HTML       because a browser cannot read markdown and a client will
//                    not install anything to read one. It is generated here
//                    (Na__LayoutEditor__Statement__Publish__Page__), it is
//                    the Read view taken out of the app - the same renderer,
//                    the app's fonts and reset, and the document stylesheet
//                    as it stood at publishing written into it - and its
//                    picture links are absolute CDN URLs so it opens anywhere.
//     the pictures   because the HTML is no use without them, and because the
//                    repository cannot carry them: 713 MB of photography in
//                    one project against a GitHub Pages limit of a gigabyte.
// - THE MARKDOWN IS NOT REWRITTEN. The links inside it stay relative, which
//   is what keeps the file working in Typora on this machine. Only the
//   GENERATED HTML carries CDN URLs. The two are different artefacts for
//   different readers, and confusing them is how a statement ends up opening
//   correctly in exactly one place.
// - A COMPANION HTML FILE SITS BESIDE THE MARKDOWN ON DISK TOO, named the
//   same with an .html suffix, so the folder holds a readable copy without
//   the app or the network.
// - NOTHING IS MARKED PUBLISHED UNTIL IT IS. The index entry's published
//   stamp is written last, after the pictures, the HTML and the markdown have
//   all landed, so a half-finished publish never reads as a finished one.
//
// INTEGRATION:
// - Called by the page's Publish button. Reports progress back so the bar can
//   say what it is doing - a statement is dozens of megabytes of photography
//   and takes long enough that silence would read as a hang.
// - Marks the statement published through Na__LayoutEditor__Statement__Data__,
//   which is what writes the index to R2.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : the shape of ProjectVision__DasBuilder__ (18-Jul-2026),
//                   which does this in Python at build time
// - Divergences   : it runs in the browser at the moment of publishing rather
//                   than in a build script; the folder structure is mirrored
//                   rather than flattened; the pictures are resized for the
//                   web; the markdown keeps its relative links.
// - Back-port     : offer to ValeVision3D with the statement tab.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 29-Sep-2026 - Version 1.1.0
// - EVERY ELEMENT THE STATEMENT WRITER DRAWS NOW PUBLISHES AS IT IS SEEN
//   (TrueVision3D v2.170.0). The page is built by the new
//   ...Publish__Page__ module; this file reads it the two stylesheets from
//   the app's own files at the moment of publishing (Styles), and waits for
//   the standard sections' and the QR code's configs before drawing, so a
//   Publish pressed as the tab opens cannot bake a hub without its code.
// - BuildHtml takes the styles as a fourth argument; without them the page
//   links the published stylesheets, as 1.0.0 did.
//
// 20-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, the Page, the Data and the Pictures
    // ------------------------------------------------------------
    import { Na__LeCfg__GetStatementSetup } from '../../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import {
        Na__LeStmtPubPage__Title,
        Na__LeStmtPubPage__PrepareCss,
        Na__LeStmtPubPage__FontFaces,
        Na__LeStmtPubPage__Build
    } from './Na__LayoutEditor__Statement__Publish__Page__.js';
    import { Na__LeStmtStd__Ready } from '../09__Standard__Sections/Na__LayoutEditor__Statement__Standard__Registry__.js';
    import { Na__ProjectQr__Ready } from '../../53__Feature__ProjectQrCode/Na__ProjectQr__Symbol__.js';
    import {
        Na__LeStmt__GetOpen,
        Na__LeStmt__GetText,
        Na__LeStmt__GetTree,
        Na__LeStmt__SaveLocal,
        Na__LeStmt__MarkPublished
    } from '../01__Core__Data/Na__LayoutEditor__Statement__Data__.js';
    import { Na__LeStmtImg__Used } from '../01__Core__Data/Na__LayoutEditor__Statement__Images__.js';
    import { Na__LeStmtPub__Send } from './Na__LayoutEditor__Statement__Publish__Images__.js';
    import {
        Na__CfApi__IsConfigured,
        Na__CfApi__StatementFileLocation,
        Na__CfApi__WriteStatementFile
    } from '../../../80__CloudflareIntegration/Na__CloudflareIntegration__ApiClient__.js';
    import { Na__LocalMirror__WriteStatementFile } from '../../../03__AppUtils/Na__AppUtils__LocalProjectMirror__.js';
    import { Na__DrawData__GetProjectCode } from '../../../40__System__DrawingViewCore/Na__DrawView__ProjectData__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Building the HTML
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Where the Two Stylesheets Are
    // ------------------------------------------------------------
    // The document stylesheet beside this module, and the app's fonts relative
    // to the document stylesheet - a path that holds on this machine and on the
    // website alike, so the same step finds the published copy from the
    // configured public address of the first.
    // ------------------------------------------------------------
    const Na__LeStmtPublish__DOCUMENT_CSS = '../08__Style__Stylesheets/Na__LayoutEditor__Styles__Statement__Document__.css';
    const Na__LeStmtPublish__FONTS_CSS    = '../../../../03__Style__AppStylesheets/Na__CoreUi__Styles__Fonts__.css';   // <-- From the document stylesheet
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read One of the App's Own Files as Text (null if it cannot be read)
    // ------------------------------------------------------------
    async function Na__LeStmtPublish__ReadText(url) {
        try {
            const response = await fetch(url, { cache : 'no-store' });
            return response.ok ? await response.text() : null;
        } catch (error) {
            return null;
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Where the Two Stylesheets Are Published
    // ------------------------------------------------------------
    // From the configured public address of the document stylesheet. Both are
    // null when there is none, or it is not an address.
    // ------------------------------------------------------------
    function Na__LeStmtPublish__PublicUrls() {
        const setup = Na__LeCfg__GetStatementSetup();
        try {
            const documentUrl = setup.stylesheetUrl ? new URL(setup.stylesheetUrl).href : null;
            return {
                documentUrl : documentUrl,
                fontsUrl    : documentUrl ? new URL(Na__LeStmtPublish__FONTS_CSS, documentUrl).href : null
            };
        } catch (error) {
            return { documentUrl : null, fontsUrl : null };
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | The Stylesheets a Published Statement Carries
    // ------------------------------------------------------------
    // Read from the app's own files at the moment of publishing - the files
    // the Read view on this screen is drawn with - and made ready to be
    // written into the page, their relative addresses (the fonts) read
    // against where they are published. Resolves to
    //     { documentCss, fontsCss, documentUrl, fontsUrl }
    // where either text may be null: the page then links that published
    // address instead, as every statement did before v2.170.0.
    // ------------------------------------------------------------
    async function Na__LeStmtPublish__Styles() {
        const published    = Na__LeStmtPublish__PublicUrls();
        const documentHere = new URL(Na__LeStmtPublish__DOCUMENT_CSS, import.meta.url);
        const fontsHere    = new URL(Na__LeStmtPublish__FONTS_CSS, documentHere);

        const read = await Promise.all([ Na__LeStmtPublish__ReadText(documentHere), Na__LeStmtPublish__ReadText(fontsHere) ]);
        const documentCss = read[0] ? Na__LeStmtPubPage__PrepareCss(read[0], published.documentUrl) : null;
        const fontsCss    = read[1] ? Na__LeStmtPubPage__FontFaces(Na__LeStmtPubPage__PrepareCss(read[1], published.fontsUrl)) : null;

        return {
            documentCss : documentCss || null,
            fontsCss    : fontsCss || null,
            documentUrl : published.documentUrl,
            fontsUrl    : published.fontsUrl
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Statement's Title, for the Page and the File Name
    // ------------------------------------------------------------
    // The Document Header's Title field, the first heading, or the index
    // entry's title (Na__LeStmtPubPage__Title).
    // ------------------------------------------------------------
    function Na__LeStmtPublish__Title(markdown, record) {
        return Na__LeStmtPubPage__Title(markdown, record);
    }
    // ------------------------------------------------------------


    // FUNCTION | Build the Standalone HTML for a Statement
    // ------------------------------------------------------------
    // Exported on its own so the HTML can be built and looked at without
    // anything being uploaded. styles is what Styles resolves to; without it
    // the page links the published stylesheets.
    // ------------------------------------------------------------
    function Na__LeStmtPublish__BuildHtml(markdown, record, links, styles) {
        return Na__LeStmtPubPage__Build(markdown, record, links || {}, {
            projectCode : Na__DrawData__GetProjectCode() || '',
            styles      : styles || Na__LeStmtPublish__PublicUrls()
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Publishing
// -----------------------------------------------------------------------------

    // FUNCTION | Publish the Open Statement
    // ------------------------------------------------------------
    // options: { onProgress(message, fraction) }
    // Resolves to { ok, url, images, failed, error }.
    //
    // The order matters and is not arbitrary: the local file first so nothing
    // typed is lost if anything below fails, then the pictures, then the HTML,
    // then the markdown, and the index's published stamp last of all.
    // ------------------------------------------------------------
    async function Na__LeStmtPublish__Run(options) {
        const opts   = options || {};
        const say    = (typeof opts.onProgress === 'function') ? opts.onProgress : () => {};
        const setup  = Na__LeCfg__GetStatementSetup();
        const record = Na__LeStmt__GetOpen();

        if (!record) return { ok : false, error : 'no statement is open' };
        if (!Na__CfApi__IsConfigured()) return { ok : false, error : 'the Cloudflare Worker is not configured, so nothing can be published' };

        // THE FILE ON DISK FIRST. What is published must be what is saved, and
        // the saved file is the one a later session will open.
        say('Saving…', 0.01);
        await Na__LeStmt__SaveLocal({ quiet : true });

        const markdown = Na__LeStmt__GetText();
        if (!markdown.trim()) return { ok : false, error : 'the statement is empty' };

        // THE PICTURES | Only the ones this statement links to
        const used = Na__LeStmtImg__Used(markdown, record.Doc__Folder, Na__LeStmt__GetTree());
        say(used.length ? 'Sending ' + used.length + ' picture(s)…' : 'No pictures to send.', 0.05);
        const pictures = await Na__LeStmtPub__Send(used, (message, share) => say(message, 0.05 + share * 0.6));

        // THE HTML | Built from the same renderer the app reads with, once the
        // standard sections and the QR code have their configs (each settles,
        // on its built-in words if its file cannot be read), and carrying the
        // stylesheets this screen is drawn with
        say('Building the HTML…', 0.70);
        await Promise.all([ Na__LeStmtStd__Ready(), Na__ProjectQr__Ready() ]);
        const styles   = await Na__LeStmtPublish__Styles();
        const html     = Na__LeStmtPublish__BuildHtml(markdown, record, pictures.links, styles);
        const htmlPath = record.Doc__Folder + '/' + record.Doc__File.replace(/\.md$/i, '') + setup.htmlFileSuffix;

        say('Sending the HTML…', 0.78);
        const htmlUp = await Na__CfApi__WriteStatementFile(htmlPath, html, 'text/html; charset=utf-8');
        if (!htmlUp || !htmlUp.ok) {
            return { ok : false, error : 'the HTML could not be sent (' + ((htmlUp && htmlUp.error) || 'unknown') + ')', failed : pictures.failed };
        }

        // THE COMPANION ON DISK, so the folder holds a readable copy too
        void Na__LocalMirror__WriteStatementFile(htmlPath, html);

        // THE MARKDOWN | Exactly as it is, links and all
        say('Sending the statement…', 0.88);
        const mdPath = record.Doc__Folder + '/' + record.Doc__File;
        const mdUp   = await Na__CfApi__WriteStatementFile(mdPath, markdown, 'text/markdown; charset=utf-8');
        if (!mdUp || !mdUp.ok) {
            return { ok : false, error : 'the markdown could not be sent (' + ((mdUp && mdUp.error) || 'unknown') + ')', failed : pictures.failed };
        }

        // THE STAMP, LAST | Only now is this statement published
        say('Writing the index…', 0.95);
        const images = Object.keys(pictures.links).map((src) => ({
            Img__Src   : src,
            Img__Path  : pictures.links[src].path,
            Img__Url   : pictures.links[src].url,
            Img__Bytes : pictures.links[src].bytes
        }));
        await Na__LeStmt__MarkPublished(record.Doc__Id, { url : htmlUp.publicUrl, images : images });

        say('Published.', 1);
        return {
            ok     : true,
            url    : htmlUp.publicUrl,
            images : images.length,
            bytes  : pictures.bytes,
            failed : pictures.failed
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Where a Published Statement Can Be Read
    // ------------------------------------------------------------
    // The CDN URL of the HTML, whether or not it has been published yet, so
    // the link can be shown and copied before the first publish as well as
    // after it.
    // ------------------------------------------------------------
    function Na__LeStmtPublish__Url(record) {
        if (!record || !record.Doc__File) return null;
        const setup    = Na__LeCfg__GetStatementSetup();
        const path     = record.Doc__Folder + '/' + record.Doc__File.replace(/\.md$/i, '') + setup.htmlFileSuffix;
        const location = Na__CfApi__StatementFileLocation(path);
        return location ? location.cdnUrl : null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Statement Publishing API
    // ------------------------------------------------------------
    export {
        Na__LeStmtPublish__Run,
        Na__LeStmtPublish__Styles,
        Na__LeStmtPublish__BuildHtml,
        Na__LeStmtPublish__Title,
        Na__LeStmtPublish__Url
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
