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
// - ON THE CDN A PICTURE IS ITS PUBLISHED COPY, NOT ITS ORIGINAL, AND IT IS
//   WHERE THE LINK SAYS. Since v2.172.0 Publish puts every picture in R2 at
//   the address its own link names (Used's target) - a smaller copy, under
//   the original's name - so R2 on its own is right for any reader. The index
//   also records every copy (Doc__Images: the link as written, the address it
//   went to, its width and its original's), and the reader off this machine
//   shows exactly those (v2.171.0), which keeps a zoom-sized figure its size.
//   Before both, the web viewer asked the CDN for each picture by its markdown
//   path while Publish had renamed resized copies to .webp: 24 of RB05's 35
//   were 404s (29-Sep-2026).
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
// 29-Sep-2026 - Version 1.2.0
// - Used reports each picture's target: the address its link names, resolved
//   exactly as a reader off this machine resolves it. Publish puts the
//   picture there in R2 (TrueVision3D v2.172.0), so R2 holds every picture
//   where the statement says it is and any reader finds it.
//
// 29-Sep-2026 - Version 1.1.0
// - Apply takes the index's published copies as an optional last argument
//   (TrueVision3D v2.171.0): a picture the list names is shown from its
//   published address, and one recorded as made smaller keeps its original's
//   size (srcset of its own width, sizes of its original's - the published
//   page's rule). The reader passes the list off localhost only.
//
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
    // Returns one entry per DISTINCT picture:
    //     { src, path, matched, ambiguous, target }
    // path is the file on this machine; target is the address the link itself
    // names - what a reader off this machine asks for (Apply, with no
    // listing), and so where Publish puts the picture in R2. The two differ
    // only for a link whose path went stale and was found by its file name.
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
            found.set(src, Object.assign({ src : src }, Na__LeStmtImg__Resolve(src, folder, entries),
                { target : Na__LeStmtImg__Resolve(src, folder, []).path }));          // <-- The reader's own resolution, with nothing on disk to consult
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

    // HELPER FUNCTION | The Published Copies, by the Link as the Markdown Writes It
    // ------------------------------------------------------------
    // published: an index entry's Doc__Images, as Publish recorded them -
    // [{ Img__Src, Img__Url, Img__Width, Img__SourceWidth, ... }].
    // ------------------------------------------------------------
    function Na__LeStmtImg__Copies(published) {
        const copies = new Map();
        for (const one of (Array.isArray(published) ? published : [])) {
            if (one && typeof one.Img__Src === 'string' && typeof one.Img__Url === 'string' && one.Img__Url) copies.set(one.Img__Src, one);
        }
        return copies;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Show One Picture From Its Published Copy
    // ------------------------------------------------------------
    // A copy recorded as smaller than its original is described by its own
    // width at the original's size, so a figure sized by its Typora zoom keeps
    // its size (Na__LeStmtPubPage__Relink does the same for the published
    // page). A copy published before its sizes were recorded is shown as it
    // is: a zoom-sized figure then comes out smaller until it is published
    // again. The page's own srcset or sizes, if it has one, is left alone.
    // ------------------------------------------------------------
    function Na__LeStmtImg__ShowCopy(image, copy) {
        image.setAttribute('crossorigin', 'anonymous');                         // <-- Before the address, so the picture is fetched once, ready for the PDF exporter
        const made   = Math.round(Number(copy.Img__Width));
        const source = Math.round(Number(copy.Img__SourceWidth));
        if (made > 0 && source > made && !image.hasAttribute('srcset') && !image.hasAttribute('sizes')) {
            image.setAttribute('srcset', String(copy.Img__Url).replace(/ /g, '%20').replace(/,/g, '%2C') + ' ' + made + 'w');
            image.setAttribute('sizes', source + 'px');
        }
        image.setAttribute('src', copy.Img__Url);
    }
    // ------------------------------------------------------------


    // FUNCTION | Point Every Relative Picture in a Rendered Page at a Real File
    // ------------------------------------------------------------
    // root       the rendered document
    // base       the absolute folder the statement sits in, for this session
    // folder     the statement's folder name
    // entries    the tree from the local server, or []
    // published  the index entry's Doc__Images, when this session reads the
    //            PUBLISHED statement (off localhost); a picture it names is
    //            shown from its published copy, anything else as before
    //
    // The markdown is NOT changed: only the src attribute of what is on screen,
    // and the original markup stays on the frozen block for the serialiser.
    // ------------------------------------------------------------
    function Na__LeStmtImg__Apply(root, base, folder, entries, published) {
        if (!root || !base) return 0;
        const copies = Na__LeStmtImg__Copies(published);
        let changed = 0;

        for (const image of Array.from(root.querySelectorAll('img'))) {
            const src = image.getAttribute('src') || '';
            if (!Na__LeStmtImg__IsLocal(src)) continue;

            const copy = copies.get(src) || copies.get(src.replace(/&/g, '&amp;'));   // <-- The DOM hands back a raw block's &amp; decoded
            if (copy) {
                Na__LeStmtImg__ShowCopy(image, copy);
                changed++;
                continue;
            }

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
