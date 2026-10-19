// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - DOCUMENT SHARING - OPENING A SHARED LINK
// =============================================================================
//
// FILE       : Na__LayoutEditor__Share__Open__.js
// NAMESPACE  : Na__LeShareOpen
// MODULE     : Layout Editor - Document Sharing - Open
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The app's half of the resolver: read the document key a shared link carries and open that document's read view
// CREATED    : 29-Sep-2026
//
// DESCRIPTION:
// - WHAT ARRIVES. s/index.html turns https://www.noble-architecture.com/s/?RB05&open=Sheet_004
//   into the project's own address with ?open=Sheet_004 on the end. This
//   module reads that key when the app starts and opens the document it names
//   - a drawing, the Project Specification, the Document Register or one
//   Design Statement - in its READ view. On the live site every tab is read
//   only already; where this session can author, Read is chosen as well, so a
//   link opens the same view on every machine.
// - WHAT A KEY MEANS IS LOOKED UP, THEN WORKED OUT. The project's share link
//   record (Na__LayoutEditor__Share__Manifest__) is asked first: it says what
//   each key was recorded to open, so a link keeps working when the rules that
//   build keys change. A key it does not list is parsed by the rules
//   (Na__LayoutEditor__Share__Links__), and a key neither knows is looked for
//   among the drawings as a document id or a drawing number - the form a
//   person typing a link by hand would use. Whatever is still not found says so
//   in a toast and opens the nearest thing that helps: a drawing that has gone
//   opens the Document Register, where the current drawings are.
// - WHEN. A drawing tab can open as soon as the project's sheets are known,
//   which is BEFORE the 3D model starts loading. For a reader (the web viewer,
//   which never renders a drawing) that is exactly when it opens, and the
//   loading screen is lifted off the document - a planning officer sent the
//   specification does not wait for a whole model they did not ask for. It is
//   put back if they go to the 3D Model tab before the model has arrived. A
//   session that can AUTHOR waits for the model instead, because the editor
//   renders its drawings from it.
// - AND THE MODEL WAITS FOR THEM (v2.183.0). A reader opened on a document is
//   not sent the 3D model at all until they go to the 3D Model tab. The gate
//   the model files wait at (01__AppCore/Na__AppFlow__ModelGate__.js) is armed
//   the moment a key is read, kept shut once the document is on screen with
//   the loading screen lifted, and opened by the 3D Model tab. Every other
//   ending opens it at once: an author, the setting off
//   (Open__LoadModelOnDemand), nothing opened, a project with no drawings.
// - THE DRAWINGS KEY. "Drawings" - what the Project Hub's PlanVision card
//   opens - names no one document: it opens the first drawing of the Drawings
//   menu that is published, so a reader lands on a drawing they can read
//   rather than on a grey "not published yet" panel. A pack with none
//   published opens its first drawing, which says so; an author, whose editor
//   draws every sheet, gets the first drawing.
// - ONCE. The key is honoured on the load that carries it and never again in
//   that page; it stays in the address, so a reload opens the same document.
//
// INTEGRATION:
// - Index.html calls Na__LeShareOpen__Initialize straight after asking the
//   Layout Editor to start, in the same run of its module body as
//   Na__AppFlow__StartLoadingSequence: the model gate is armed in its
//   synchronous start, which is only certain to land before the loading
//   sequence reaches the gate because of that. The call also starts the share
//   link record's statement listener and fetches the sharing settings.
// - Opens documents only through the mode controller's own entry points.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : none. TrueVision original.
// - Back-port     : candidate.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Oct-2026 - Version 1.1.0
// - THE PROJECT HUB'S WAY IN (TrueVision3D v2.183.0). Adam: the PlanVision
//   card should go "straight past the 3D model into the first drawing in the
//   drawings list ... opening the drawing viewer", and "maybe it only gets
//   loaded when you hop back to the 3D model tab". The Drawings key opens the
//   first published drawing (FirstDrawing, through the share link record's
//   PublishedIds), and a reader's model now waits at the model gate until the
//   3D Model tab is pressed.
// - The loading screen is lifted only when a document actually opened. A key
//   that opened nothing used to lift it as well, showing the reader an empty
//   page while the model loaded behind it.
//
// 29-Sep-2026 - Version 1.0.0
// - Initial implementation (TrueVision3D v2.166.0).
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The Mode Controller's Entry Points and What They Open
    // ------------------------------------------------------------
    import {
        Na__LeMode__CHANGED_EVENT, Na__LeMode__Ready, Na__LeMode__IsEditable, Na__LeMode__IsActive, Na__LeMode__Enter,
        Na__LeMode__OpenSpecification, Na__LeMode__OpenRegister, Na__LeMode__OpenStatements
    } from '../05__Core__ModeController/Na__LayoutEditor__ModeController__.js';
    import {
        Na__LeModel__CHANGED_EVENT, Na__LeModel__GetSheets, Na__LeModel__GetSheetById, Na__LeModel__GetDocumentId,
        Na__LeModel__GetDrawingNumber, Na__LeModel__GetShortCode
    } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__DrawData__IsLoaded } from '../../40__System__DrawingViewCore/Na__DrawView__ProjectData__.js';
    import { Na__LeSpecEd__SetView } from '../50__Feature__Specification/Na__LayoutEditor__SpecEditor__.js';
    import { Na__LeSpecEd__VIEW_READ } from '../50__Feature__Specification/Na__LayoutEditor__SpecEditor__State__.js';
    import { Na__LeStmt__EnsureLoaded, Na__LeStmt__List } from '../52__Feature__StatementWriter/01__Core__Data/Na__LayoutEditor__Statement__Data__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Sharing: the Rules, the Record
    // ------------------------------------------------------------
    import {
        Na__LeShareLink__KIND_DRAWING, Na__LeShareLink__KIND_SPEC, Na__LeShareLink__KIND_REGISTER, Na__LeShareLink__KIND_STATEMENT,
        Na__LeShareLink__KIND_DRAWINGS, Na__LeShareLink__PREFIX_SHEET, Na__LeShareLink__Ready, Na__LeShareLink__GetSetup,
        Na__LeShareLink__Label, Na__LeShareLink__Parse, Na__LeShareLink__ReadOpenParam
    } from './Na__LayoutEditor__Share__Links__.js';
    import {
        Na__LeShareMf__Load, Na__LeShareMf__Find, Na__LeShareMf__Initialize, Na__LeShareMf__PublishedIds
    } from './Na__LayoutEditor__Share__Manifest__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | The Model Gate: a Reader's 3D Model Waits for the 3D Model Tab
    // ------------------------------------------------------------
    import { Na__ModelGate__Arm, Na__ModelGate__Keep, Na__ModelGate__Open } from '../../01__AppCore/Na__AppFlow__ModelGate__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    const Na__LeShareOpen__SCENE_READY_EVENT = 'na-app-scene-ready';               // <-- Na__AppFlow__LoadingSequence: the model is loaded and visible
    const Na__LeShareOpen__OVERLAY_ID        = 'loadingOverlay';                   // <-- Index.html's loading screen
    const Na__LeShareOpen__OVERLAY_HIDDEN    = 'hidden';                           // <-- The class the loading sequence itself lifts it with

    let Na__LeShareOpen__Started    = false;
    let Na__LeShareOpen__Toast      = null;
    let Na__LeShareOpen__SceneReady = false;
    let Na__LeShareOpen__Lifted     = false;                                       // <-- This module lifted the loading screen, and may put it back

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Waiting
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Say Something to the Reader
    // ------------------------------------------------------------
    function Na__LeShareOpen__Say(message, isError) {
        if (!message) return;
        if (typeof Na__LeShareOpen__Toast === 'function') Na__LeShareOpen__Toast(message, isError === true);
        console.info('[TrueVision3D Share] ' + message);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Is the 3D Model Already Up (its loading screen lifted)
    // ------------------------------------------------------------
    function Na__LeShareOpen__ModelShown() {
        if (Na__LeShareOpen__SceneReady) return true;
        const overlay = document.getElementById(Na__LeShareOpen__OVERLAY_ID);
        return !overlay || (overlay.classList.contains(Na__LeShareOpen__OVERLAY_HIDDEN) && !Na__LeShareOpen__Lifted) || overlay.style.display === 'none';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Resolve When the Project's Sheets Are Known (false on a timeout)
    // ------------------------------------------------------------
    // The sheet model announces 'loaded' when the drawings block lands. When it
    // has already landed the answer waits one task, so the model's own
    // announcement - queued as a microtask - has run before anything opens.
    // ------------------------------------------------------------
    function Na__LeShareOpen__SheetsKnown(timeoutMs) {
        return new Promise((resolve) => {
            let done = false;
            const finish = (value) => {
                if (done) return;
                done = true;
                window.removeEventListener(Na__LeModel__CHANGED_EVENT, onChange);
                window.clearTimeout(timer);
                window.setTimeout(() => resolve(value), 0);
            };
            const onChange = (event) => {
                if (event && event.detail && event.detail.reason === 'loaded' && Na__LeModel__GetSheets().length > 0) finish(true);
            };
            const timer = window.setTimeout(() => finish(Na__LeModel__GetSheets().length > 0), timeoutMs);
            window.addEventListener(Na__LeModel__CHANGED_EVENT, onChange);
            if (Na__DrawData__IsLoaded() && Na__LeModel__GetSheets().length > 0) finish(true);
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Resolve When the 3D Model Is Up (authoring sessions only)
    // ------------------------------------------------------------
    function Na__LeShareOpen__ModelUp(timeoutMs) {
        return new Promise((resolve) => {
            if (Na__LeShareOpen__ModelShown()) { resolve(true); return; }
            const timer = window.setTimeout(() => { window.removeEventListener(Na__LeShareOpen__SCENE_READY_EVENT, onReady); resolve(false); }, timeoutMs);
            const onReady = () => { window.clearTimeout(timer); window.removeEventListener(Na__LeShareOpen__SCENE_READY_EVENT, onReady); resolve(true); };
            window.addEventListener(Na__LeShareOpen__SCENE_READY_EVENT, onReady);
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Lift the Loading Screen Off the Document; Put It Back for the 3D View
    // ------------------------------------------------------------
    // Only for a reader, and only while the model is still loading. The class
    // is the loading sequence's own, so when the model lands its ShowScene
    // finds the screen already lifted and hides it for good as it always does.
    // ------------------------------------------------------------
    function Na__LeShareOpen__LiftLoadingScreen() {
        if (Na__LeShareOpen__ModelShown()) return false;
        const overlay = document.getElementById(Na__LeShareOpen__OVERLAY_ID);
        if (!overlay) return false;
        overlay.classList.add(Na__LeShareOpen__OVERLAY_HIDDEN);
        Na__LeShareOpen__Lifted = true;
        const onMode = (event) => {
            if (Na__LeShareOpen__SceneReady) { window.removeEventListener(Na__LeMode__CHANGED_EVENT, onMode); return; }
            const active = !!(event && event.detail && event.detail.isActive);
            overlay.classList.toggle(Na__LeShareOpen__OVERLAY_HIDDEN, active);       // <-- Back to the 3D view before the model: the loading screen, as a first visit shows it
        };
        window.addEventListener(Na__LeMode__CHANGED_EVENT, onMode);
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Let the Model Go When the Reader Goes to the 3D Model Tab
    // ------------------------------------------------------------
    // Once: the first time the editor closes, which is the 3D Model tab (or a
    // pack left with no drawing to show). The loading screen the listener above
    // puts back then covers the model as it loads, as it does a first visit.
    // ------------------------------------------------------------
    function Na__LeShareOpen__ReleaseOn3d() {
        const onMode = (event) => {
            if (event && event.detail && event.detail.isActive) return;
            window.removeEventListener(Na__LeMode__CHANGED_EVENT, onMode);
            Na__ModelGate__Open('the reader went to the 3D Model tab');
        };
        window.addEventListener(Na__LeMode__CHANGED_EVENT, onMode);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Project With No Drawings Wants Its Model Now
    // ------------------------------------------------------------
    // The opener waits a long while for sheets that may still be coming; the
    // model need not. The first load the sheet model announces settles it: no
    // sheets, and the gate opens. Opening early is always safe - holding the
    // model is only ever an optimisation.
    // ------------------------------------------------------------
    function Na__LeShareOpen__ReleaseIfNoDrawings() {
        const onModel = (event) => {
            if (!event || !event.detail || event.detail.reason !== 'loaded') return;
            window.removeEventListener(Na__LeModel__CHANGED_EVENT, onModel);
            if (Na__LeModel__GetSheets().length === 0) Na__ModelGate__Open('the project has no drawings');
        };
        window.addEventListener(Na__LeModel__CHANGED_EVENT, onModel);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | What a Key Opens
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Sheet a Drawing Key Names Now (null when there is none)
    // ------------------------------------------------------------
    // In order: the sheet id the record holds for the key, the sheet id the key
    // IS (leading zeros aside), then - for a key the rules do not recognise -
    // a sheet whose document id, drawing number or short code it is.
    // ------------------------------------------------------------
    function Na__LeShareOpen__FindSheet(parsed, entry) {
        const sheets = Na__LeModel__GetSheets();
        const target = (entry && entry['Share__Target']) || {};
        const byId = (id) => {
            if (!id) return null;
            const exact = Na__LeModel__GetSheetById(id);
            if (exact) return exact;
            const want = /(\d+)$/.exec(String(id));
            if (!want || String(id).toLowerCase().indexOf(Na__LeShareLink__PREFIX_SHEET.toLowerCase()) !== 0) return null;
            return sheets.find((sheet) => {
                const have = /(\d+)$/.exec(String(sheet.Sheet__Id || ''));
                return !!have && parseInt(have[1], 10) === parseInt(want[1], 10);
            }) || null;
        };
        const found = byId(target['Target__SheetId']) || byId(parsed && parsed.id);
        if (found) return found;
        if (!parsed || !parsed.loose) return null;
        const wanted = String(parsed.key || '').toLowerCase();
        return sheets.find((sheet) => [ Na__LeModel__GetDocumentId(sheet), Na__LeModel__GetDrawingNumber(sheet), Na__LeModel__GetShortCode(sheet) ]
            .some((one) => one && String(one).toLowerCase() === wanted)) || null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Statement a Key Names Now (null when there is none)
    // ------------------------------------------------------------
    // By its id first; then by the folder the record says it lived in, which
    // is what survives a statement being taken out of the index and adopted
    // back in under a new id.
    // ------------------------------------------------------------
    function Na__LeShareOpen__FindStatement(parsed, entry) {
        const records = Na__LeStmt__List();
        const target  = (entry && entry['Share__Target']) || {};
        const id      = Number(target['Target__StatementId'] || (parsed && parsed.id));
        const byId    = records.find((record) => record.Doc__Id === id);
        if (byId) return byId;
        const folder = target['Target__Folder'];
        return folder ? (records.find((record) => record.Doc__Folder === folder) || null) : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Drawing the Drawings Key Opens (null when the project has none)
    // ------------------------------------------------------------
    // The first sheet of the Drawings menu - the register's order - whose
    // drawing the index says is published: the first one a reader can read.
    // An author gets the first sheet, because the editor draws every sheet
    // from the model. A pack with nothing published, or an index that cannot
    // be read, opens its first sheet, which says honestly that it is not
    // published yet.
    // ------------------------------------------------------------
    async function Na__LeShareOpen__FirstDrawing() {
        const sheets = Na__LeModel__GetSheets();
        if (!sheets.length) return null;
        if (Na__LeMode__IsEditable()) return sheets[0];
        const published = await Na__LeShareMf__PublishedIds();                   // <-- The index the reader opens next is fetched normally, so this read warms it
        const first = (published && published.size > 0)
            ? sheets.find((sheet) => published.has(Na__LeModel__GetDocumentId(sheet)))
            : null;
        return first || sheets[0];
    }
    // ------------------------------------------------------------


    // FUNCTION | Open the Document a Key Names, in Its Read View
    // ------------------------------------------------------------
    // Resolves { Ok, Kind, Reason }. Never throws.
    // ------------------------------------------------------------
    async function Na__LeShareOpen__Open(key) {
        const L = Na__LeShareLink__Label;
        await Na__LeShareMf__Load();                                             // <-- Never fails: no record is an answer too
        const entry  = Na__LeShareMf__Find(key);
        const parsed = entry ? Na__LeShareLink__Parse(entry['Share__Key']) : Na__LeShareLink__Parse(key);
        const kind   = entry ? entry['Share__Kind'] : (parsed ? parsed.kind : null);
        if (!parsed || !kind) {
            Na__LeShareOpen__Say(L('OpenUnknown', 'That link names a document this project does not have.'), true);
            return { Ok : false, Kind : null, Reason : 'not a document key' };
        }

        if (kind === Na__LeShareLink__KIND_SPEC) {
            if (!Na__LeMode__OpenSpecification()) return { Ok : false, Kind : kind, Reason : 'the specification could not be opened' };
            if (Na__LeMode__IsEditable()) Na__LeSpecEd__SetView(Na__LeSpecEd__VIEW_READ);   // <-- A reader is always on Read; an author is put there too
            return { Ok : true, Kind : kind, Reason : null };
        }
        if (kind === Na__LeShareLink__KIND_REGISTER) {
            return { Ok : Na__LeMode__OpenRegister({ view : 'read' }), Kind : kind, Reason : null };
        }
        if (kind === Na__LeShareLink__KIND_STATEMENT) {
            const statementId = Number((entry && entry['Share__Target'] && entry['Share__Target']['Target__StatementId']) || parsed.id);
            if (!Na__LeMode__OpenStatements({ statementId : statementId, view : 'read' })) return { Ok : false, Kind : kind, Reason : 'the statements could not be opened' };
            try { await Na__LeStmt__EnsureLoaded(); } catch (error) { /* the page says why */ }
            const record = Na__LeShareOpen__FindStatement(parsed, entry);
            if (!record) {
                Na__LeShareOpen__Say(L('OpenMissingStatement', 'The statement that link was for is no longer part of this project.'), true);
                return { Ok : false, Kind : kind, Reason : 'statement not found' };
            }
            if (record.Doc__Id !== statementId) Na__LeMode__OpenStatements({ statementId : record.Doc__Id, view : 'read' });   // <-- Found by its folder under a new id
            return { Ok : true, Kind : kind, Reason : null };
        }
        if (kind === Na__LeShareLink__KIND_DRAWINGS) {
            const first = await Na__LeShareOpen__FirstDrawing();
            if (!first) return { Ok : false, Kind : kind, Reason : 'the project has no drawings' };   // <-- The model is shown, as it is for a concept-only job
            return { Ok : Na__LeMode__Enter(first.Sheet__Id), Kind : kind, Reason : null };
        }

        // A DRAWING
        const sheet = Na__LeShareOpen__FindSheet(parsed, entry);
        if (!sheet) {
            Na__LeShareOpen__Say(L('OpenMissingDrawing', 'The drawing that link was for is no longer part of this project, so here is its current document register.'), true);
            Na__LeMode__OpenRegister({ view : 'read' });
            return { Ok : false, Kind : Na__LeShareLink__KIND_DRAWING, Reason : 'drawing not found' };
        }
        return { Ok : Na__LeMode__Enter(sheet.Sheet__Id), Kind : Na__LeShareLink__KIND_DRAWING, Reason : null };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Start Sharing: Honour a Shared Link on This Load, Listen for Statement Publishes
    // ------------------------------------------------------------
    // options: { showToast }. Called once, straight after the Layout Editor is
    // asked to start (it waits for the editor itself). Resolves
    // { Ok, Kind, Reason } for a link, or null when the page was not opened
    // by one.
    //
    // NOTHING WAITS IN LINE THAT CAN RUN ALONGSIDE. The settings and the
    // share link record are asked for while the editor reads its own
    // configuration and the drawings arrive, so the document opens the moment
    // the sheets are known rather than a round trip or two later.
    //
    // THE MODEL GATE IS ARMED BEFORE THE FIRST AWAIT, and the try below opens
    // it on every way out but one: a reader with a document on screen and the
    // loading screen lifted off it, where the 3D Model tab opens it instead.
    // ------------------------------------------------------------
    async function Na__LeShareOpen__Initialize(options) {
        if (Na__LeShareOpen__Started) return null;
        Na__LeShareOpen__Started = true;
        Na__LeShareOpen__Toast   = (options && typeof options.showToast === 'function') ? options.showToast : null;
        window.addEventListener(Na__LeShareOpen__SCENE_READY_EVENT, () => { Na__LeShareOpen__SceneReady = true; });

        const armed = !!Na__LeShareLink__ReadOpenParam() && Na__ModelGate__Arm('opened by a shared link');   // <-- Synchronous: the loading sequence is round trips short of the gate
        if (armed) Na__LeShareOpen__ReleaseIfNoDrawings();
        let kept = false;
        try {
            const settings = Na__LeShareLink__Ready();                           // <-- Alongside the editor's own start
            if (Na__LeShareLink__ReadOpenParam()) void Na__LeShareMf__Load();   // <-- The record, alongside the drawings (the built-in key name is enough to know there is a link)
            const enabled = await Na__LeMode__Ready();
            await settings;
            if (!enabled) return null;
            Na__LeShareMf__Initialize({ editable : Na__LeMode__IsEditable() });  // <-- A published statement's link is recorded the moment it goes out

            const key = Na__LeShareLink__ReadOpenParam();
            if (!key) return null;
            const setup  = Na__LeShareLink__GetSetup();
            const author = Na__LeMode__IsEditable();
            if (author) Na__ModelGate__Open('an authoring session draws its sheets from the model');
            else if (!setup.open.loadModelOnDemand) Na__ModelGate__Open('Open__LoadModelOnDemand is off');
            console.info('[TrueVision3D Share] Opened by a shared link: ' + key);

            const known = await Na__LeShareOpen__SheetsKnown(setup.open.waitForSheetsMs);
            if (!known) {
                console.warn('[TrueVision3D Share] The project\'s drawings did not arrive, so the link to ' + key + ' was not opened.');
                return { Ok : false, Kind : null, Reason : 'no sheets' };
            }
            if (author) await Na__LeShareOpen__ModelUp(setup.open.waitForSheetsMs);   // <-- The editor renders its drawings from the model

            const result  = await Na__LeShareOpen__Open(key);
            const reading = !author && Na__LeMode__IsActive();                   // <-- A document is on screen: lifting the loading screen off nothing would show an empty page
            if (reading && setup.open.liftLoadingScreen) Na__LeShareOpen__LiftLoadingScreen();
            if (reading && Na__LeShareOpen__Lifted && setup.open.loadModelOnDemand && Na__ModelGate__Keep('reading ' + key)) {
                kept = true;
                Na__LeShareOpen__ReleaseOn3d();
            }
            return result;
        } finally {
            if (armed && !kept) Na__ModelGate__Open('nothing for it to wait for');   // <-- A no-op when it opened already
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Document Sharing Open API
    // ------------------------------------------------------------
    export {
        Na__LeShareOpen__Initialize,
        Na__LeShareOpen__Open
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
