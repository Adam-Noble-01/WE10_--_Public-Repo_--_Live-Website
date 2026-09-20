// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - STATEMENT IMAGES
// =============================================================================
//
// FILE       : Na__LayoutEditor__Statement__Images__.js
// NAMESPACE  : Na__LeStmtImg
// MODULE     : Layout Editor - Statement Writer - Picture Paths
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Work out which file a statement's picture link actually means, and where to show it from
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - A PICTURE LINK IN A STATEMENT IS NOT A RELIABLE PATH. It is whatever
//   Typora wrote when the picture was dragged in, on whichever machine, before
//   whatever folder rename happened afterwards. The RB05 statement is the
//   case that made this file necessary: every one of its sixteen links reads
//   ./02_Images__Content/... and the folder has been called
//   02_StatementDocs__Content__Images since half past seven that evening. The
//   links are not wrong about which picture is meant - only about where it is.
// - SO THE FILE NAME IS TRUSTED AND THE PATH IS NOT. A link is resolved by
//   trying it as written, and then by looking for its bare file name anywhere
//   in the statement's folder. A single match is the picture. Several matches
//   means the deepest path that still matches the link's own folder names
//   wins, so two pictures called 1.jpg in different folders do not get
//   confused with each other.
// - PARKED AND ARCHIVED FOLDERS ARE NOT SEARCHED. A folder whose name starts
//   with 00__ holds pictures deliberately set aside; finding one there and
//   silently publishing it would undo the setting aside.
// - WHAT IS RESOLVED AGAINST WHAT. The app shows a picture from the project
//   folder on this machine and from the CDN everywhere else, and the published
//   HTML always carries the CDN URL. The markdown itself is never rewritten:
//   it has to keep working in Typora, which resolves it against the folder it
//   sits in.
//
// INTEGRATION:
// - Used by the page (to show the pictures), by the publisher (to find which
//   files to upload and what to rewrite the links to) and by the tidy-up
//   (to know which pictures the statement does NOT use).
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : the filename-trusting idea in ProjectVision__DasBuilder__,
//                   which flattens every picture into one folder. This does
//                   not flatten: the sub-folders are how a statement's
//                   photography is actually organised, and they are mirrored.
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
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Recognising Links and Folders
    // ------------------------------------------------------------
    const Na__LeStmtImg__RE_ABSOLUTE = /^(?:[a-z]+:)?\/\//i;                    // <-- http://, https://, //cdn...
    const Na__LeStmtImg__RE_DATA     = /^data:/i;
    const Na__LeStmtImg__RE_IMAGE    = /\.(jpe?g|png|webp|gif|tiff?|bmp|svg|heic)$/i;
    const Na__LeStmtImg__RE_PARKED   = /(^|\/)00__/;                            // <-- Archived and parked folders, at any depth
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // FUNCTION | Is This Link One This App Should Resolve
    // ------------------------------------------------------------
    // An absolute URL is somebody's deliberate choice - the company logo is
    // linked straight off the website - and is left exactly as it is.
    // ------------------------------------------------------------
    function Na__LeStmtImg__IsLocal(src) {
        const text = String(src || '').trim();
        if (!text) return false;
        if (Na__LeStmtImg__RE_ABSOLUTE.test(text)) return false;
        if (Na__LeStmtImg__RE_DATA.test(text)) return false;
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Link Reduced to Its Path Parts
    // ------------------------------------------------------------
    function Na__LeStmtImg__Parts(src) {
        const clean = decodeURI(String(src || '').trim().replace(/\\/g, '/').split('?')[0].split('#')[0]);
        return clean.split('/').filter((part) => part !== '' && part !== '.');
    }
    // ------------------------------------------------------------


    // FUNCTION | The Bare File Name a Link Points At
    // ------------------------------------------------------------
    function Na__LeStmtImg__FileName(src) {
        const parts = Na__LeStmtImg__Parts(src);
        return parts.length ? parts[parts.length - 1] : '';
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Resolving
// -----------------------------------------------------------------------------

    // FUNCTION | Which File in the Folder a Link Means
    // ------------------------------------------------------------
    // src      the link as the markdown writes it
    // folder   the statement's folder name, e.g. "01__PreApp__Statement"
    // entries  the tree from the local server, or [] when there is none
    //
    // Returns { path, matched, ambiguous } where path is relative to the
    // statements folder. matched says HOW it was found:
    //   'literal'   the link was right
    //   'name'      the path was wrong, the file name found it
    //   'guess'     nothing on disk to check against, the link is taken as read
    // ------------------------------------------------------------
    function Na__LeStmtImg__Resolve(src, folder, entries) {
        const parts = Na__LeStmtImg__Parts(src);
        if (!parts.length) return { path : null, matched : null, ambiguous : false };

        const asked  = parts.join('/');
        const inside = folder ? folder + '/' + asked : asked;
        const name   = parts[parts.length - 1].toLowerCase();

        // NO LISTING TO CHECK AGAINST - off localhost there is no local server
        // to ask, so the link is taken at its word and the CDN answers or does
        // not. That is the right behaviour for a reader: a picture that is
        // there shows, and one that is not leaves a gap rather than a stall.
        if (!entries || !entries.length) return { path : inside, matched : 'guess', ambiguous : false };

        const known = new Set(entries.map((entry) => String(entry.path || '')));
        if (known.has(inside)) return { path : inside, matched : 'literal', ambiguous : false };

        // THE FILE NAME, ANYWHERE IN THIS STATEMENT'S FOLDER
        const candidates = entries.filter((entry) =>
            String(entry.name || '').toLowerCase() === name
            && String(entry.path || '').startsWith(folder + '/')
            && !Na__LeStmtImg__RE_PARKED.test(String(entry.path || '')));

        if (candidates.length === 0) return { path : inside, matched : null, ambiguous : false };
        if (candidates.length === 1) return { path : candidates[0].path, matched : 'name', ambiguous : false };

        // SEVERAL FILES OF THAT NAME. The one whose folders agree most closely
        // with what the link asked for wins - a link to
        // 02_Images__Content/02__Site__Location/x.png prefers a file in a
        // folder called 02__Site__Location over one anywhere else.
        const wanted = parts.slice(0, -1).map((part) => part.toLowerCase());
        let   best   = candidates[0];
        let   score  = -1;
        for (const candidate of candidates) {
            const has = String(candidate.folder || '').toLowerCase().split('/');
            const hit = wanted.reduce((count, part) => count + (has.indexOf(part) !== -1 ? 1 : 0), 0);
            if (hit > score) { score = hit; best = candidate; }
        }
        return { path : best.path, matched : 'name', ambiguous : true };
    }
    // ------------------------------------------------------------


    // FUNCTION | Every Picture a Statement Actually Links To
    // ------------------------------------------------------------
    // markdown  the statement as it stands
    // folder    the statement's folder name
    // entries   the tree from the local server, or []
    //
    // Returns one entry per DISTINCT picture: { src, path, matched, ambiguous }.
    // Absolute links are left out - they are already somewhere a reader can
    // reach and are not this statement's files to publish.
    // ------------------------------------------------------------
    function Na__LeStmtImg__Used(markdown, folder, entries) {
        const text  = String(markdown || '');
        const found = new Map();

        const consider = (src) => {
            if (!Na__LeStmtImg__IsLocal(src)) return;
            if (!Na__LeStmtImg__RE_IMAGE.test(Na__LeStmtImg__FileName(src))) return;
            if (found.has(src)) return;
            found.set(src, Object.assign({ src : src }, Na__LeStmtImg__Resolve(src, folder, entries)));
        };

        for (const match of text.matchAll(/<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi)) consider(match[1]);
        for (const match of text.matchAll(/!\[[^\]]*\]\(\s*<?([^)\s>]+)>?[^)]*\)/g))      consider(match[1]);

        return Array.from(found.values());
    }
    // ------------------------------------------------------------


    // FUNCTION | Every Picture in the Folder the Statement Does NOT Use
    // ------------------------------------------------------------
    // What the tidy-up parks in 00__Images. Anything already parked or
    // archived is left where it is.
    // ------------------------------------------------------------
    function Na__LeStmtImg__Unused(markdown, folder, entries) {
        const used = new Set(Na__LeStmtImg__Used(markdown, folder, entries).map((one) => one.path).filter(Boolean));
        return (entries || []).filter((entry) => {
            const path = String(entry.path || '');
            if (!path.startsWith(folder + '/')) return false;
            if (!Na__LeStmtImg__RE_IMAGE.test(String(entry.name || ''))) return false;
            if (Na__LeStmtImg__RE_PARKED.test(path)) return false;
            return !used.has(path);
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Showing
// -----------------------------------------------------------------------------

    // FUNCTION | Point Every Relative Picture in a Rendered Page at a Real File
    // ------------------------------------------------------------
    // root     the rendered document
    // base     the absolute folder the statement sits in, for this session
    // folder   the statement's folder name
    // entries  the tree from the local server, or []
    //
    // The markdown is NOT changed: only the src attribute of what is on screen,
    // and the original markup stays on the frozen block for the serialiser.
    // ------------------------------------------------------------
    function Na__LeStmtImg__Apply(root, base, folder, entries) {
        if (!root || !base) return 0;
        let changed = 0;

        for (const image of Array.from(root.querySelectorAll('img'))) {
            const src = image.getAttribute('src') || '';
            if (!Na__LeStmtImg__IsLocal(src)) continue;

            const resolved = Na__LeStmtImg__Resolve(src, folder, entries);
            if (!resolved.path) continue;

            const inside = folder && resolved.path.startsWith(folder + '/') ? resolved.path.slice(folder.length + 1) : resolved.path;
            image.setAttribute('src', base + encodeURI(inside));
            image.setAttribute('crossorigin', 'anonymous');                     // <-- Needed before the PDF exporter can rasterise it
            if (resolved.matched === 'name') image.setAttribute('data-na-stmt-relinked', src);
            changed++;
        }

        return changed;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Statement Picture Path API
    // ------------------------------------------------------------
    export {
        Na__LeStmtImg__IsLocal,
        Na__LeStmtImg__FileName,
        Na__LeStmtImg__Resolve,
        Na__LeStmtImg__Used,
        Na__LeStmtImg__Unused,
        Na__LeStmtImg__Apply
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
