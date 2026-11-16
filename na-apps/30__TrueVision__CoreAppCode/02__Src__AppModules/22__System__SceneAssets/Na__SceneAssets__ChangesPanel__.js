// =============================================================================
// TRUEVISION3D - PLACED ASSETS - THE CHANGES TAB
// =============================================================================
//
// FILE       : Na__SceneAssets__ChangesPanel__.js
// NAMESPACE  : Na__SceneChanges
// MODULE     : System - Placed Assets
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Who has changed what: each person's changes, Remove My Changes for them, and
//              Approve and Remove Their Changes for an admin. The same for people and plants
// CREATED    : 05-Nov-2026
//
// DESCRIPTION:
// - Adam, 05-Nov-2026: "Add way for user / admin to delete their changes (effectively revert the
//   assetrs to the state before they added anything". His answers: an Employee may change anything,
//   all of it tracked, and client links see it only once an admin has approved it.
// - ONE TAB IN EACH ASSET BROWSER, drawn here. It holds no state of its own: everything comes from
//   the summary the server last sent, and a press asks the server and hands back its answer.
// - SAVED FIRST. Remove My Changes means everything, so unsaved work is saved and then put back.
// - THE SERVER DECIDES. These rows are what the page offers; an Employee asking to remove someone
//   else's, or to approve, is refused there.
// - NOTHING WAITS NOW (v2.96.0). Adam, 11-Nov-2026: "Remove this, any entorage added by anyone staff
//   or above should be updated when saved". A save goes straight into the record, so Approve and the
//   waiting marks show only for work left waiting from before, until the next save publishes it.
// - WHO ADDED IT AND WHEN, for the right-click menus of people and plants: OwnerLines.
//
// INTEGRATION:
// - Drawn by ../28__System__Entourage/10__Ui__Panels/Na__Entourage__AssetBrowser__.js and
//   ../24__System__Vegetation/10__Ui__Panels/Na__Vegetation__AssetBrowser__.js.
// - Styles: ./Na__SceneAssets__Styles__.css, added to the page by Na__SceneChanges__AddStyles.
// - Staff only: nothing on a client's path imports this file.
// - @delegate: ./Na__SceneAssets__Api__.js
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 22__System__SceneAssets/Na__SceneAssets__ChangesPanel__.js (ValeVision3D v2.98.6)
// - Ported on     : 15-Nov-2026 for TrueVision3D v2.185.0
// - Parity        : identical (header, console prefix and the Entourage folder's number apart)
// - Divergences   : none in behaviour. Entourage is 28__System__Entourage in TrueVision (its 23
//                   is Scene Sync); the vegetation and entourage READMEs list what differs around it.
// - Back-port     : n/a (this IS the port).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 11-Nov-2026 - Version 1.1.0 (ValeVision3D v2.96.0)
// - OwnerLines: who added an item and when, and who changed it last, for the right-click menus.
//   A person's block no longer says "all approved".
//
// 05-Nov-2026 - Version 1.0.0 (ValeVision3D v2.89.0)
// - Initial build.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports and Constants
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The Server
    // ------------------------------------------------------------
    import { Na__SceneApi__Approve, Na__SceneApi__Revert } from './Na__SceneAssets__Api__.js';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | The Stylesheet, the Icons' Folder and How Much History Shows
    // ------------------------------------------------------------
    const Na__SceneChanges__STYLES_URL  = new URL('./Na__SceneAssets__Styles__.css', import.meta.url);
    const Na__SceneChanges__ICONS_URL   = new URL('../../01__AppAssets__TrueVision/UiIcons__MenuIcons__ToolsMenu/', import.meta.url);
    const Na__SceneChanges__HISTORY_ROWS = 40;
    const Na__SceneChanges__MONTHS      = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const Na__SceneChanges__ACTIONS     = { added : 'Added', changed : 'Changed', removed : 'Deleted', approved : 'Approved', 'put back' : 'Put back' };
    const Na__SceneChanges__KINDS       = { figure : 'Person', plop : 'Plant', path : 'Path', palette : 'Palette' };
    // ------------------------------------------------------------

    // MODULE VARIABLES | What Is Asking for a Second Press
    // ------------------------------------------------------------
    const Na__SceneChanges__State = { asking : '', busy : false };             // <-- asking: the button waiting to be pressed again
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Small Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Make an Element
    // ------------------------------------------------------------
    function Na__SceneChanges__El(tag, className, text) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (text !== undefined) el.textContent = text;
        return el;
    }
    // ------------------------------------------------------------


    // FUNCTION | Add the Stylesheet to the Page, Once
    // ------------------------------------------------------------
    function Na__SceneChanges__AddStyles() {
        if (document.querySelector('link[href="' + Na__SceneChanges__STYLES_URL.href + '"]')) return;
        const link = document.createElement('link');
        link.rel  = 'stylesheet';
        link.href = Na__SceneChanges__STYLES_URL.href;
        document.head.appendChild(link);
    }
    // ------------------------------------------------------------


    // FUNCTION | One of the Menu's Icons, as an Image
    // ------------------------------------------------------------
    // name: what follows Icon__ToolsMenu__, such as 'Entourage' or 'VegetationBrush'.
    // ------------------------------------------------------------
    function Na__SceneChanges__Icon(name, className) {
        const image = document.createElement('img');
        image.className = className || 'na-scene-icon';
        image.alt = '';
        image.src = new URL('Icon__ToolsMenu__' + name + '__.svg', Na__SceneChanges__ICONS_URL).href;
        return image;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Time as It Reads Here: 5 Nov, 14:02
    // ------------------------------------------------------------
    function Na__SceneChanges__When(iso) {
        const date = new Date(iso);
        if (!iso || Number.isNaN(date.getTime())) return '';
        const hours = String(date.getHours()).padStart(2, '0'), minutes = String(date.getMinutes()).padStart(2, '0');
        return date.getDate() + ' ' + Na__SceneChanges__MONTHS[date.getMonth()] + ', ' + hours + ':' + minutes;
    }
    // ------------------------------------------------------------


    // FUNCTION | How Many Are Waiting for an Admin, Everyone's or One Person's
    // ------------------------------------------------------------
    function Na__SceneChanges__CountWaiting(summary, code) {
        const waiting = summary && summary.Waiting ? summary.Waiting : {};
        return Object.keys(waiting).filter((key) => !code || waiting[key].By === code).length;
    }
    // ------------------------------------------------------------


    // FUNCTION | Who Put an Item Here, and Is It Waiting? For a Row in In This Project
    // ------------------------------------------------------------
    // itemKey: 'figure:E0001', 'plop:A0001', 'path:P0001'. Returns { name, waiting, mine }.
    // ------------------------------------------------------------
    function Na__SceneChanges__WhoDid(summary, itemKey, myCode) {
        if (!summary) return { name : '', waiting : false, mine : false };
        const owner   = (summary.Owners || {})[itemKey] || {};
        const waiting = (summary.Waiting || {})[itemKey] || null;
        const code    = owner.CreatedBy || (waiting ? waiting.By : '') || owner.ChangedBy || '';
        return {
            name    : owner.CreatedName || (waiting ? waiting.Name : '') || owner.ChangedName || '',
            waiting : !!waiting,
            mine    : !!myCode && (code === myCode || (waiting ? waiting.By === myCode : owner.ChangedBy === myCode))
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Who Added an Item and When, for Its Right-Click Menu
    // ------------------------------------------------------------
    // Adam, 11-Nov-2026: "just ensure when you right click it shows who added that thing into the
    // scene and when so this gives ownership / accountability". itemKey: 'figure:E0001',
    // 'plop:A0001', 'path:P0001'. onServer: the item is in what this window last read from the
    // server. Returns the menu's lines:
    //   ['Added by Jo Bloggs, 11 Nov 2026, 14:32', 'Last changed by Sam Smith, 12 Nov 2026, 09:05']
    // An item the server has not got is this window's, not saved yet. One placed before anyone kept
    // track says so. Empty with no summary (it could not be read): the menu then says nothing.
    // ------------------------------------------------------------
    function Na__SceneChanges__OwnerLines(summary, itemKey, myCode, onServer) {
        if (!summary) return [];
        const owner = (summary.Owners || {})[itemKey];
        const name  = (person, code) => (myCode && code === myCode ? 'you' : (person || 'someone'));
        if (!onServer) return ['Added by you, not saved yet'];
        if (!owner) return ['Added before who placed what was kept'];
        const lines = [];
        if (owner.CreatedBy || owner.CreatedName) {
            lines.push('Added by ' + name(owner.CreatedName, owner.CreatedBy) + ', ' + Na__SceneChanges__WhenInFull(owner.CreatedAt));
        } else {
            lines.push('Added before who placed what was kept');
        }
        const changedLater = owner.ChangedAt && owner.ChangedAt !== owner.CreatedAt;
        if (changedLater && owner.ChangedBy) {
            lines.push('Last changed by ' + name(owner.ChangedName, owner.ChangedBy) + ', ' + Na__SceneChanges__WhenInFull(owner.ChangedAt));
        }
        return lines;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Time with Its Year: 11 Nov 2026, 14:32
    // ------------------------------------------------------------
    function Na__SceneChanges__WhenInFull(iso) {
        const date = new Date(iso);
        if (!iso || Number.isNaN(date.getTime())) return 'date not known';
        const hours = String(date.getHours()).padStart(2, '0'), minutes = String(date.getMinutes()).padStart(2, '0');
        return date.getDate() + ' ' + Na__SceneChanges__MONTHS[date.getMonth()] + ' ' + date.getFullYear() + ', ' + hours + ':' + minutes;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Small Line Under a Row: Who, and a Mark If It Is Waiting
    // ------------------------------------------------------------
    function Na__SceneChanges__WhoLine(who) {
        const line = Na__SceneChanges__El('span', 'na-scene-who');
        if (who.name) line.appendChild(Na__SceneChanges__El('span', '', who.name));
        if (who.waiting) line.appendChild(Na__SceneChanges__El('span', 'na-scene-waiting', 'Waiting'));
        return line;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Asking the Server
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Press: Save First, Ask the Server, and Hand Back Its Answer
    // ------------------------------------------------------------
    async function Na__SceneChanges__Act(options, ask, saying) {
        const state = Na__SceneChanges__State;
        if (state.busy) return;
        state.busy = true;
        state.asking = '';
        try {
            if (options.saveFirst) {
                const saved = await options.saveFirst();
                if (saved === false) return;                                   // <-- The save has said what went wrong
            }
            const answer = await ask();
            if (!answer || answer.ok !== true) {
                options.toast('Nothing changed: ' + ((answer && answer.error) || 'the server did not answer') + '.', true);
                return;
            }
            await options.onAnswer(answer);
            options.toast(saying(answer), false);
        } finally {
            state.busy = false;
            options.redraw();
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Words After a Put Back
    // ------------------------------------------------------------
    function Na__SceneChanges__PutBackWords(answer, isAdmin) {
        const restored = (answer.restored || []).length;
        const left = answer.leftAlone || [];
        const count = restored + (restored === 1 ? ' change' : ' changes');
        let words = restored === 0 ? 'Nothing to put back.' : count + ' put back.';
        if (restored > 0 && !isAdmin && Na__SceneChanges__CountWaiting(answer.summary, answer.me && answer.me.code) > 0) {
            words += ' Clients still see what was approved until an admin agrees.';
        }
        if (left.length > 0) {
            const names = Array.from(new Set(left.map((row) => row.By).filter(Boolean))).join(', ');
            words += ' ' + left.length + ' left alone: ' + (names || 'somebody else') + ' changed them since.';
        }
        return words;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Tab
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Button That Asks for a Second Press, Saying What It Will Do
    // ------------------------------------------------------------
    function Na__SceneChanges__Confirmed(id, label, sure, className, title, options, act) {
        const state = Na__SceneChanges__State;
        const asking = state.asking === id;
        const button = Na__SceneChanges__El('button', 'na-veg-btn' + (className ? ' ' + className : '') + (asking ? ' na-veg-btn--danger' : ''), asking ? sure : label);
        button.type = 'button';
        button.id = id;
        button.title = title;
        button.disabled = state.busy;
        button.addEventListener('click', () => {
            if (state.asking !== id) {
                state.asking = id;
                options.redraw();
                return;
            }
            act();
        });
        return button;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Thing Someone Did
    // ------------------------------------------------------------
    function Na__SceneChanges__ItemRow(item, options) {
        const live = item.Kind === 'figure' || item.Kind === 'plop' || item.Kind === 'path';
        const row = Na__SceneChanges__El(live && options.onItem ? 'button' : 'div', 'na-scene-item');
        if (row.tagName === 'BUTTON') {
            row.type = 'button';
            row.title = 'Select it';
            row.addEventListener('click', () => options.onItem(item));
        }
        const what = options.nameOf(item.What) || Na__SceneChanges__KINDS[item.Kind] || item.Kind;
        row.appendChild(Na__SceneChanges__El('span', 'na-scene-item__what', (Na__SceneChanges__ACTIONS[item.Action] || item.Action) + ' ' + what));
        const end = Na__SceneChanges__El('span', 'na-scene-item__end');
        if (item.Waiting) end.appendChild(Na__SceneChanges__El('span', 'na-scene-waiting', 'Waiting'));
        else end.textContent = Na__SceneChanges__When(item.At);
        row.appendChild(end);
        return row;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Person's Block
    // ------------------------------------------------------------
    function Na__SceneChanges__Person(holder, person, options) {
        const block = Na__SceneChanges__El('section', 'na-scene-person');
        const title = person.IsMe ? 'Your changes' : person.Name;
        const head = Na__SceneChanges__El('div', 'na-veg-panel__section', title);
        block.appendChild(head);

        const total = person.Items.length;
        const words = total + (total === 1 ? ' change' : ' changes') + (person.Waiting > 0 ? ', ' + person.Waiting + ' waiting for approval' : '');   // <-- Since v2.96.0 a save goes straight in, so only work left from before can wait
        block.appendChild(Na__SceneChanges__El('p', 'na-veg-panel__hint', words));
        person.Items.forEach((item) => block.appendChild(Na__SceneChanges__ItemRow(item, options)));

        const actions = Na__SceneChanges__El('div', 'na-veg-row');
        actions.style.flexWrap = 'wrap';
        actions.style.marginTop = '6px';
        const system = options.system;

        if (options.isAdmin && person.Waiting > 0) {
            const approve = Na__SceneChanges__El('button', 'na-veg-btn na-veg-btn--strong', 'Approve');
            approve.type = 'button';
            approve.id = 'naSceneApprove__' + person.Code;
            approve.title = 'Clients see what ' + (person.IsMe ? 'you' : person.Name) + ' did from now on';
            approve.addEventListener('click', () => Na__SceneChanges__Act(options, () => Na__SceneApi__Approve(system, person.Code), (answer) => {
                return answer.approved + (answer.approved === 1 ? ' change' : ' changes') + ' approved. Clients see them now.';
            }));
            actions.appendChild(approve);
        }

        if (person.IsMe || options.isAdmin) {
            const id = 'naSceneRemove__' + person.Code;
            const label = person.IsMe ? 'Remove My Changes' : 'Remove Their Changes';
            const sure = 'Yes, put back ' + total + (total === 1 ? ' change' : ' changes');
            const title2 = 'Puts everything back as it stood before ' + (person.IsMe ? 'you' : person.Name) + ' touched it. What somebody else has changed since is left alone.';
            actions.appendChild(Na__SceneChanges__Confirmed(id, label, sure, '', title2, options, () => {
                const isOwnRevert = person.IsMe && !options.isAdmin;
                Na__SceneChanges__Act(options, () => Na__SceneApi__Revert(system, person.Code), (answer) => Na__SceneChanges__PutBackWords(answer, !isOwnRevert));
            }));
        }
        if (actions.childNodes.length > 0) block.appendChild(actions);
        holder.appendChild(block);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Record of Who Did What, Newest First
    // ------------------------------------------------------------
    function Na__SceneChanges__History(holder, summary, options) {
        const rows = (summary.History || []).slice(-Na__SceneChanges__HISTORY_ROWS).reverse();
        if (rows.length === 0) return;
        const details = Na__SceneChanges__El('details', 'na-scene-history');
        details.appendChild(Na__SceneChanges__El('summary', 'na-veg-panel__section', 'Who did what'));
        rows.forEach((row) => {
            const line = Na__SceneChanges__El('div', 'na-scene-history__row');
            const kind = String(row.Item || '').split(':')[0];
            const what = options.nameOf(row.What) || Na__SceneChanges__KINDS[kind] || kind;
            const verb = Na__SceneChanges__ACTIONS[row.Action] || row.Action;
            line.appendChild(Na__SceneChanges__El('span', '', (row.Name || '') + ': ' + verb.toLowerCase() + ' ' + what + (row.Of ? ' (' + row.Of + ')' : '')));
            line.appendChild(Na__SceneChanges__El('span', 'na-scene-item__end', Na__SceneChanges__When(row.At)));
            details.appendChild(line);
        });
        holder.appendChild(details);
    }
    // ------------------------------------------------------------


    // FUNCTION | Draw the Tab
    // ------------------------------------------------------------
    // options: {
    //   system    : 'Entourage' | 'Vegetation',
    //   summary   : what the server last said, or null,
    //   isAdmin   : what the server last said,
    //   nameOf(what)    : an asset id's name, for a row,
    //   saveFirst()     : resolves false if there was unsaved work that would not save,
    //   onAnswer(answer): take what the server now says is true,
    //   onItem(item)    : select a row's item, optional,
    //   toast(words, isError), redraw()
    // }
    // ------------------------------------------------------------
    function Na__SceneChanges__Draw(holder, options) {
        holder.textContent = '';
        const summary = options.summary;
        if (!summary) {
            holder.appendChild(Na__SceneChanges__El('p', 'na-veg-panel__hint', 'Who did what could not be read. Nothing here has been lost: try reloading.'));
            return;
        }

        const people = summary.People || [];
        if (people.length === 0) {
            holder.appendChild(Na__SceneChanges__El('p', 'na-veg-panel__hint', 'No changes yet. Whatever anyone adds, moves or deletes here is listed by name.'));
            Na__SceneChanges__History(holder, summary, options);
            return;
        }

        const waiting = Na__SceneChanges__CountWaiting(summary);
        if (options.isAdmin && waiting > 0) {
            const all = Na__SceneChanges__El('button', 'na-veg-btn na-veg-btn--strong', 'Approve All (' + waiting + ')');
            all.type = 'button';
            all.id = 'naSceneApproveAll';
            all.title = 'Clients see all of these from now on';
            all.addEventListener('click', () => Na__SceneChanges__Act(options, () => Na__SceneApi__Approve(options.system, ''), (answer) => {
                return answer.approved + (answer.approved === 1 ? ' change' : ' changes') + ' approved. Clients see them now.';
            }));
            holder.appendChild(all);
        } else if (!options.isAdmin && waiting > 0) {
            holder.appendChild(Na__SceneChanges__El('p', 'na-veg-panel__hint', 'Staff see these now. Clients see them once an admin has approved them.'));
        }

        people.forEach((person) => Na__SceneChanges__Person(holder, person, options));
        Na__SceneChanges__History(holder, summary, options);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Changes Tab API
    // ------------------------------------------------------------
    export {
        Na__SceneChanges__AddStyles,
        Na__SceneChanges__Icon,
        Na__SceneChanges__CountWaiting,
        Na__SceneChanges__WhoDid,
        Na__SceneChanges__OwnerLines,
        Na__SceneChanges__WhoLine,
        Na__SceneChanges__Draw
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
