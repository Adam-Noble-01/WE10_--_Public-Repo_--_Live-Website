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
//                    not install anything to read one. It is generated here,
//                    it links the same stylesheet the app uses, and its
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
// 20-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, the Markdown Engine, the Data and the Pictures
    // ------------------------------------------------------------
    import { Na__LeCfg__GetStatementSetup } from '../../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeStmtMd__Tokenise } from '../02__Core__Markdown/Na__LayoutEditor__Statement__Md__Tokenise__.js';
    import { Na__LeStmtRnd__Blocks } from '../02__Core__Markdown/Na__LayoutEditor__Statement__Md__Render__.js';
    import { Na__LeStmtInl__Escape } from '../02__Core__Markdown/Na__LayoutEditor__Statement__Md__Inline__.js';
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

    // HELPER FUNCTION | Escape a String for an Attribute
    // ------------------------------------------------------------
    function Na__LeStmtPublish__Attr(value) {
        return Na__LeStmtInl__Escape(String(value === undefined || value === null ? '' : value)).replace(/"/g, '&quot;');
    }
    // ------------------------------------------------------------


    // FUNCTION | The Statement's Title, for the Page and the File Name
    // ------------------------------------------------------------
    // The first heading in the document if there is one, because that is what
    // the writer called it; the index entry's title otherwise.
    // ------------------------------------------------------------
    function Na__LeStmtPublish__Title(markdown, record) {
        const heading = /^\s{0,3}#{1,6}[ \t]+(.+?)\s*#*\s*$/m.exec(String(markdown || ''));
        if (heading && heading[1].trim()) return heading[1].trim();
        return (record && record.Doc__Title) || 'Statement';
    }
    // ------------------------------------------------------------


    // FUNCTION | Point Every Relative Picture in the HTML at Its CDN URL
    // ------------------------------------------------------------
    // links maps the link as the markdown writes it to what it was published
    // as. A link with no entry is left as it stands rather than pointed at
    // nothing: the HTML then shows a broken picture where the statement has a
    // broken link, which is the truth and is findable.
    // ------------------------------------------------------------
    function Na__LeStmtPublish__Relink(html, links) {
        return String(html || '').replace(/(\ssrc\s*=\s*")([^"]+)(")/gi, (whole, before, src, after) => {
            const found = links[src];
            return found ? before + Na__LeStmtPublish__Attr(found.url) + after : whole;
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Wrap the Rendered Statement in a Standalone Page
    // ------------------------------------------------------------
    // The one stylesheet the app itself uses is linked by its public URL, so a
    // statement opened straight off the CDN is the same document as the one on
    // screen. Nothing is inlined: a change to the house style reaches every
    // statement ever published without any of them being rebuilt.
    // ------------------------------------------------------------
    function Na__LeStmtPublish__Page(bodyHtml, context) {
        const setup = Na__LeCfg__GetStatementSetup();
        const when  = new Date();
        const stamp = when.toISOString();

        return [
            '<!DOCTYPE html>',
            '<html lang="en">',
            '<head>',
            '    <meta charset="UTF-8">',
            '    <meta name="viewport" content="width=device-width, initial-scale=1.0">',
            '    <meta name="generator" content="Noble Architecture - TrueVision Statement Writer">',
            '    <meta name="na-project-code" content="' + Na__LeStmtPublish__Attr(context.projectCode) + '">',
            '    <meta name="na-statement" content="' + Na__LeStmtPublish__Attr(context.file) + '">',
            '    <meta name="na-generated" content="' + Na__LeStmtPublish__Attr(stamp) + '">',
            '    <title>' + Na__LeStmtInl__Escape(context.title) + '</title>',
            '    <link rel="stylesheet" href="' + Na__LeStmtPublish__Attr(setup.stylesheetUrl) + '">',
            '    <style>',
            '        /* THE DESK. The document stylesheet styles the paper; this is what it lies on. */',
            '        body { margin: 0; background: #fafafa; }',
            '        @media print { body { background: #ffffff; } .na-le-stmt-doc { margin: 0; box-shadow: none; } }',
            '    </style>',
            '</head>',
            '<body>',
            '<article class="na-le-stmt-doc">',
            bodyHtml,
            '</article>',
            '</body>',
            '</html>',
            ''
        ].join('\n');
    }
    // ------------------------------------------------------------


    // FUNCTION | Build the Standalone HTML for a Statement
    // ------------------------------------------------------------
    // Exported on its own so the HTML can be built and looked at without
    // anything being uploaded.
    // ------------------------------------------------------------
    function Na__LeStmtPublish__BuildHtml(markdown, record, links) {
        const body  = Na__LeStmtRnd__Blocks(Na__LeStmtMd__Tokenise(markdown || ''), { Editable : false });
        const bound = Na__LeStmtPublish__Relink(body, links || {});
        return Na__LeStmtPublish__Page(bound, {
            title       : Na__LeStmtPublish__Title(markdown, record),
            file        : (record && record.Doc__File) || '',
            projectCode : Na__DrawData__GetProjectCode() || ''
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

        // THE HTML | Built from the same renderer the app reads with
        say('Building the HTML…', 0.70);
        const html     = Na__LeStmtPublish__BuildHtml(markdown, record, pictures.links);
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
        Na__LeStmtPublish__BuildHtml,
        Na__LeStmtPublish__Title,
        Na__LeStmtPublish__Url
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
