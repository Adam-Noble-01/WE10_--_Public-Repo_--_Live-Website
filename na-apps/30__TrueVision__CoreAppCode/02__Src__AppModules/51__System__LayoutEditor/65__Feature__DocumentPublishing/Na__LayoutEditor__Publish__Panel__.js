// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - DOCUMENT PUBLISHING - PANEL
// =============================================================================
//
// FILE       : Na__LayoutEditor__Publish__Panel__.js
// NAMESPACE  : Na__LePubPanel
// MODULE     : Layout Editor - Document Publishing - Panel
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The Publish Drawings dialog: which drawings, whether to push to R2, and what happened
// SCHEMA REF : na-project-portal/26-Projects/AA00__ExampleProjectStructure/
//              30__TrueVision__AppContent/06__Layout__PublishedDocuments
//              ^ The readable schema. CHANGE A KEY HERE, CHANGE IT THERE.
// CREATED    : 23-Sep-2026
//
// DESCRIPTION:
// - OPENED FROM THE DRAWING REGISTER, beside Export all drawings and Download
//   entire pack, because that is where the list of drawings already lives. It
//   is an AUTHORING dialog and is never built for a reader.
// - EVERY SHEET IS LISTED WITH ITS STATE: published at the revision it is now,
//   published at an older revision, or never published. Stale and unpublished
//   drawings are ticked by default; an up-to-date one is not, because
//   re-publishing an unchanged drawing only rewrites the same files.
// - PUSHING TO R2 IS A SECOND, DELIBERATE TICK, off by default. Publishing
//   files everything into the project folder, where it can be looked at on
//   localhost first; the tick is what makes a client able to see it.
// - IT SAYS WHAT HAPPENED IN WORDS: each drawing as it is baked, every
//   revision archived, every warning counted, and why anything failed.
// - Its few styles are carried here and injected once, so the dialog needs no
//   stylesheet link in the app's page.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 23-Sep-2026 - Version 1.0.0
// - Created with Phase 4 of TrueVision__PLAN__PublishingSystem__.md.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    import { Na__LePub__Ready, Na__LePub__Label, Na__LePub__Status, Na__LePub__PublishSheets, Na__LePub__IsBusy } from './Na__LayoutEditor__Publish__.js';

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    const Na__LePubPanel__STYLE_ID = 'na-le-publish-styles';
    const Na__LePubPanel__CSS = [
        '.na-le-publish{position:fixed;inset:0;z-index:10050;display:flex;align-items:center;justify-content:center;background:rgba(20,28,34,0.45);font:13px/1.45 "Open Sans","Segoe UI",system-ui,sans-serif;color:#172b3a}',
        '.na-le-publish__card{background:#fff;border-radius:6px;box-shadow:0 12px 40px rgba(0,0,0,0.28);width:min(640px,94vw);max-height:88vh;display:flex;flex-direction:column}',
        '.na-le-publish__head{padding:16px 20px 8px;border-bottom:1px solid #e3e7ea}',
        '.na-le-publish__title{margin:0 0 6px;font-size:16px;font-weight:600}',
        '.na-le-publish__intro{margin:0;color:#4a5b67}',
        '.na-le-publish__list{overflow:auto;padding:8px 20px;flex:1 1 auto}',
        '.na-le-publish__row{display:flex;align-items:center;gap:10px;padding:5px 0;border-bottom:1px solid #f1f3f4}',
        '.na-le-publish__row label{flex:1 1 auto;cursor:pointer}',
        '.na-le-publish__state{font-size:12px;padding:1px 8px;border-radius:10px;white-space:nowrap}',
        '.na-le-publish__state--published{background:#e3f1e6;color:#2f6b3b}',
        '.na-le-publish__state--stale{background:#fdf1dc;color:#8a5a12}',
        '.na-le-publish__state--never{background:#eceff1;color:#56646c}',
        '.na-le-publish__controls{padding:10px 20px;border-top:1px solid #e3e7ea;display:flex;flex-wrap:wrap;gap:10px;align-items:center}',
        '.na-le-publish__controls .na-le-publish__spacer{flex:1 1 auto}',
        '.na-le-publish button{font:inherit;padding:5px 12px;border:1px solid #b9c3c9;border-radius:4px;background:#fff;color:#172b3a;cursor:pointer}',
        '.na-le-publish button.na-le-publish__go{background:#172b3a;border-color:#172b3a;color:#fff}',
        '.na-le-publish button:disabled{opacity:0.5;cursor:default}',
        '.na-le-publish__log{margin:0 20px 16px;padding:8px 10px;background:#f6f8f9;border-radius:4px;max-height:160px;overflow:auto;font-size:12px;white-space:pre-wrap}',
        '.na-le-publish__log:empty{display:none}',
        '.na-le-publish__log .na-le-publish__bad{color:#a12a1f}',
        '.na-le-publish__log .na-le-publish__good{color:#2f6b3b}'
    ].join('\n');

    let Na__LePubPanel__Root  = null;
    let Na__LePubPanel__Toast = null;

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Building
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | An Element With a Class and Text
    // ------------------------------------------------------------
    function Na__LePubPanel__El(tag, className, text) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (text !== undefined && text !== null) el.textContent = text;
        return el;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Put the Dialog's Styles on the Page Once
    // ------------------------------------------------------------
    function Na__LePubPanel__Styles() {
        if (document.getElementById(Na__LePubPanel__STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = Na__LePubPanel__STYLE_ID;
        style.textContent = Na__LePubPanel__CSS;
        document.head.appendChild(style);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Line in the Log
    // ------------------------------------------------------------
    function Na__LePubPanel__Log(log, text, tone) {
        const line = Na__LePubPanel__El('div', tone ? ('na-le-publish__' + tone) : '', text);
        log.appendChild(line);
        log.scrollTop = log.scrollHeight;
        return line;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The State Badge for One Sheet
    // ------------------------------------------------------------
    function Na__LePubPanel__Badge(row) {
        const text = row.State === 'published'
            ? Na__LePub__Label('StatePublished', 'Published rev {revision}', { revision : row.PublishedRevision || '-' })
            : (row.State === 'stale'
                ? Na__LePub__Label('StateStale', 'Published rev {published}, now rev {revision}', { published : row.PublishedRevision || '-', revision : row.Revision || '-' })
                : Na__LePub__Label('StateNever', 'Not published'));
        return Na__LePubPanel__El('span', 'na-le-publish__state na-le-publish__state--' + row.State, text);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Close the Dialog
    // ------------------------------------------------------------
    function Na__LePubPanel__Close() {
        if (Na__LePub__IsBusy()) return false;                                    // <-- A publish in flight keeps its dialog
        if (Na__LePubPanel__Root && Na__LePubPanel__Root.parentNode) Na__LePubPanel__Root.parentNode.removeChild(Na__LePubPanel__Root);
        Na__LePubPanel__Root = null;
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Open the Publish Drawings Dialog
    // ------------------------------------------------------------
    // options: { showToast(text, isError) }
    // ------------------------------------------------------------
    async function Na__LePubPanel__Open(options) {
        Na__LePubPanel__Toast = (options && typeof options.showToast === 'function') ? options.showToast : null;
        if (Na__LePubPanel__Root) return true;
        const setup = await Na__LePub__Ready();
        Na__LePubPanel__Styles();

        const root = Na__LePubPanel__El('div', 'na-le-publish');
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-modal', 'true');
        const card = Na__LePubPanel__El('div', 'na-le-publish__card');
        const head = Na__LePubPanel__El('div', 'na-le-publish__head');
        head.appendChild(Na__LePubPanel__El('h2', 'na-le-publish__title', Na__LePub__Label('PanelTitle', 'Publish Drawings')));
        head.appendChild(Na__LePubPanel__El('p', 'na-le-publish__intro', Na__LePub__Label('PanelIntro', '')));
        const list = Na__LePubPanel__El('div', 'na-le-publish__list');
        list.textContent = '...';
        const controls = Na__LePubPanel__El('div', 'na-le-publish__controls');
        const log = Na__LePubPanel__El('div', 'na-le-publish__log');
        card.append(head, list, controls, log);
        root.appendChild(card);
        document.body.appendChild(root);
        Na__LePubPanel__Root = root;
        root.addEventListener('click', (event) => { if (event.target === root) Na__LePubPanel__Close(); });

        // THE SHEETS AND WHAT IS PUBLISHED OF EACH
        const rows  = await Na__LePub__Status();
        const boxes = new Map();
        list.textContent = '';
        rows.forEach((row) => {
            const line  = Na__LePubPanel__El('div', 'na-le-publish__row');
            const box   = Na__LePubPanel__El('input');
            box.type    = 'checkbox';
            box.id      = 'na-le-publish-' + row.SheetId;
            box.checked = row.State !== 'published';                              // <-- Up to date: not ticked; stale or never: ticked
            const label = Na__LePubPanel__El('label', '', row.DocumentId + '  -  ' + row.Name);
            label.htmlFor = box.id;
            line.append(box, label, Na__LePubPanel__Badge(row));
            list.appendChild(line);
            boxes.set(row.SheetId, box);
        });

        // THE CONTROLS
        const all  = Na__LePubPanel__El('button', '', Na__LePub__Label('SelectAll', 'All'));
        const none = Na__LePubPanel__El('button', '', Na__LePub__Label('SelectNone', 'None'));
        all.addEventListener('click', () => boxes.forEach((box) => { box.checked = true; }));
        none.addEventListener('click', () => boxes.forEach((box) => { box.checked = false; }));
        const r2Label = Na__LePubPanel__El('label');
        const r2 = Na__LePubPanel__El('input');
        r2.type = 'checkbox';
        r2.checked = setup.pushToR2Default === true;
        r2Label.append(r2, document.createTextNode(' ' + Na__LePub__Label('PushToR2', 'Also push to R2 (clients see it)')));
        const spacer = Na__LePubPanel__El('span', 'na-le-publish__spacer');
        const close = Na__LePubPanel__El('button', '', Na__LePub__Label('Close', 'Close'));
        const go = Na__LePubPanel__El('button', 'na-le-publish__go', Na__LePub__Label('Publish', 'Publish'));
        close.addEventListener('click', Na__LePubPanel__Close);
        controls.append(all, none, r2Label, spacer, close, go);

        go.addEventListener('click', async () => {
            const chosen = rows.filter((row) => boxes.get(row.SheetId).checked).map((row) => row.SheetId);
            if (chosen.length === 0) return;
            const every = chosen.length === rows.length ? null : chosen;          // <-- Every sheet: a full publish, which may retire orphans
            [ go, close, all, none, r2 ].concat([ ...boxes.values() ]).forEach((one) => { one.disabled = true; });
            log.textContent = '';
            let stageLine = null;
            const result = await Na__LePub__PublishSheets(every, {
                ToR2 : r2.checked,
                OnProgress : (event) => {
                    const text = event.Index
                        ? Na__LePub__Label('Working', 'Publishing {index} of {total}: {name}...', { index : event.Index, total : event.Total, name : event.Name }) + '  ' + event.Stage
                        : event.Stage;
                    if (!stageLine) stageLine = Na__LePubPanel__Log(log, text);
                    else stageLine.textContent = text;
                }
            });
            if (stageLine) stageLine.remove();

            result.Archived.forEach((one) => Na__LePubPanel__Log(log, Na__LePub__Label('Archived', '{name}: revision {revision} archived to {file}.', { name : one.DocumentId, revision : one.Revision, file : one.File }), null));
            result.Failed.forEach((one) => Na__LePubPanel__Log(log, Na__LePub__Label('Failed', '{name} was not published: {reason}', { name : one.DocumentId || one.Name, reason : one.Reason }), 'bad'));
            if (result.Orphans.length) Na__LePubPanel__Log(log, Na__LePub__Label('Orphans', '{count} published drawing(s) no longer match a sheet: {ids}. Publish all drawings to retire them.', { count : result.Orphans.length, ids : result.Orphans.join(', ') }), null);
            if (result.Retired.length) Na__LePubPanel__Log(log, Na__LePub__Label('Retired', 'Retired {ids}: archived here and taken off R2.', { ids : result.Retired.join(', ') }), null);
            if (result.Warnings.length) Na__LePubPanel__Log(log, Na__LePub__Label('Warnings', '{count} warning(s) - see the console.', { count : result.Warnings.length }), null);
            if (!result.Ok && result.Reason && result.Failed.length === 0) {
                Na__LePubPanel__Log(log, Na__LePub__Label('NoLocal', 'Cannot publish: {reason}.', { reason : result.Reason }), 'bad');
            }
            if (result.Published.length) {
                const done = r2.checked
                    ? Na__LePub__Label('DoneR2', 'Published {count} drawing(s) and pushed them to R2.', { count : result.Published.length })
                    : Na__LePub__Label('Done', 'Published {count} drawing(s).', { count : result.Published.length });
                Na__LePubPanel__Log(log, done, 'good');
                if (Na__LePubPanel__Toast) Na__LePubPanel__Toast(done, false);
            }

            // Refresh the badges from what is now on disk
            const fresh = await Na__LePub__Status();
            fresh.forEach((row) => {
                const box = boxes.get(row.SheetId);
                if (!box) return;
                const line = box.parentNode;
                const old = line.querySelector('.na-le-publish__state');
                if (old) old.replaceWith(Na__LePubPanel__Badge(row));
                box.checked = row.State !== 'published';
            });
            [ go, close, all, none, r2 ].concat([ ...boxes.values() ]).forEach((one) => { one.disabled = false; });
        });
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    export {
        Na__LePubPanel__Open,
        Na__LePubPanel__Close
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
