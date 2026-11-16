// =============================================================================
// TRUEVISION3D - VEGETATION - THE MENU SECTION
// =============================================================================
//
// FILE       : Na__Vegetation__MenuSection__.js
// NAMESPACE  : Na__VegMenu
// MODULE     : System - Vegetation
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The Vegetation section of Tools & Settings: Show Vegetation and Transparency
//              for everyone, the Vegetation panel opening with it for staff, and the line
//              rules for an admin
// CREATED    : 04-Nov-2026
//
// DESCRIPTION:
// - Adam, 04-Nov-2026: "add a menu section called vegetation which can be toggled on if
//   required via dev menu for the main menu". Dev Tools > Vegetation is the toggle, and
//   the section is hidden on every project where that is off, so a project without plants
//   shows nothing new at all.
// - TWO ROWS FOR EVERYONE, clients and phones included (plan, D07): "Vegetation toggle
//   on/of - All users if the menu is active", "Vegetation transparency slider - All users
//   if the menu is active". The <li> carries data-na-client-menu for that reason.
// - THE VEGETATION PANEL OPENS AND SHUTS WITH THIS SECTION, FOR STAFF ON A COMPUTER OR TABLET
//   (Adam, 06-Nov-2026: "Make it so the entourage assets and vegetation assets panels always open
//   when the menu section is unfolded ... ensure when the section in the menu is folded the browser
//   dissapears"). Unfolding opens it with every section folded (Adam, 11-Nov-2026); folding, or its
//   own Close, shuts it, and the two stay in step. Placing, the Line and Brush Tools, In This Project,
//   the Change Log and Save are all in
//   that panel, so this section holds no buttons for them ("this section is pointless, this should
//   be handled by the specialit menu that pops up"). Closing Tools & Settings itself leaves the
//   panel open, so the model's right side is clear to work on (Adam's answer).
// - AN ADMIN ALSO GETS the line rules and the drawings tick, which change the look of the whole
//   project, here as before (Adam's answer: they stay in this menu).
// - THESE ROWS ARE NEVER IN A CLIENT'S PAGE. They are built here, for staff only, and the panel is
//   fetched the first time the section is unfolded. The layer is made then too, with no plants yet.
// - EVERY VIEWER OPENS THE PROJECT AS IT WAS SAVED (Adam, 13-Nov-2026: "this should be captured
//   at save for entourage and vegetation and be the value for each indifivauaL project model is
//   loaded with"). The project's own ShowByDefault and DefaultTransparencyPercent are where every
//   device starts, every time; devices no longer remember (that was plan D19), and an old choice
//   a device kept is forgotten here. Moving the two rows changes this visit's view at once.
// - STAFF CAPTURE THEM WITH SAVE (Adam's answers: "Any staff who can save", and the Show tick
//   "Also captured at save"). For anyone with the panel, moving a row holds it in the project's
//   object and lights Save Vegetation. Anyone else's move is for this visit only.
//
// INTEGRATION:
// - Loaded by Na__Vegetation__.js on an enabled project, and by nothing else.
// - Markup: #naVegetationMenuItem and its children in index.html.
// - Reported by 03__AppUtils/Na__AppUtils__ActivityLog__.js, which listens for the two ids.
// - @delegate: ../03__System__SceneLayer/Na__Vegetation__Runtime__.js
// - @delegate: ./Na__Vegetation__AssetBrowser__.js
// - @delegate: ./Na__Vegetation__PanelShell__.js
// - @delegate: ./Na__Vegetation__LineworkPanel__.js
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 24__System__Vegetation/10__Ui__Panels/Na__Vegetation__MenuSection__.js (ValeVision3D v2.98.6)
// - Ported on     : 15-Nov-2026 for TrueVision3D v2.185.0
// - Parity        : identical (header, console prefix and the Entourage folder's number apart)
// - Divergences   : none in behaviour. Entourage is 28__System__Entourage in TrueVision (its 23
//                   is Scene Sync); the vegetation and entourage READMEs list what differs around it.
// - Back-port     : n/a (this IS the port).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 13-Nov-2026 - Version 1.3.0 (ValeVision3D v2.98.4)
// - Every viewer starts from the project's Show and Transparency; staff capture them with Save.
//   The device memory is gone, and an old one is forgotten.
//
// 11-Nov-2026 - Version 1.2.1 (ValeVision3D v2.94.2)
// - Notes only: the panel now opens with every section folded (Na__Vegetation__AssetBrowser__.js).
//
// 06-Nov-2026 - Version 1.2.0 (ValeVision3D v2.91.0)
// - Unfolding the section opens the Vegetation panel, folding it shuts it, and the panel closing folds
//   it. Create New Vegetation, Changes and Save are gone from here: they are in the panel.
//
// 05-Nov-2026 - Version 1.1.0 (ValeVision3D v2.89.0)
// - Staff get Create New Vegetation and Changes, with icons. An admin is told what is waiting on
//   opening a project.
//
// 04-Nov-2026 - Version 1.0.0 (ValeVision3D v2.85.0)
// - Initial build: Stage 3 of ValeVision__PLAN__VegetationSystem__.md.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Markup Ids, and the Old Device Memory to Forget
    // ------------------------------------------------------------
    const Na__VegMenu__ITEM_ID       = 'naVegetationMenuItem';
    const Na__VegMenu__TOGGLE_ID     = 'naVegetationToggle';
    const Na__VegMenu__PANEL_ID      = 'naVegetationPanel';
    const Na__VegMenu__SHOW_ID       = 'naVegetationShowToggle';
    const Na__VegMenu__SLIDER_ID     = 'naVegetationTransparencySlider';
    const Na__VegMenu__VALUE_ID      = 'naVegetationTransparencyValue';
    const Na__VegMenu__DEV_ROWS_ID   = 'naVegetationDevRows';
    const Na__VegMenu__HUB_ID        = 'naVegetationAssetsPanel';               // <-- The Vegetation panel on the left (Na__Vegetation__AssetBrowser__.js)
    const Na__VegMenu__STORAGE_STEM  = 'TrueVision3D__Vegetation__';            // <-- Followed by the project's id: what a device chose before v2.98.4, now forgotten
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Variables
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | What Has Been Wired
    // ------------------------------------------------------------
    const Na__VegMenu__State = {
        context : null,
        wired   : false,
        devDone : false,
        shell   : null,                                                        // <-- The panels' shell, once this person may place plants: the panel follows the fold
        data    : null
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Where Every Viewer Starts, and Holding It for the Next Save
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Forget What This Device Chose Before v2.98.4 (storage can throw)
    // ------------------------------------------------------------
    function Na__VegMenu__ForgetOldChoice() {
        try {
            const params = new URLSearchParams(window.location.search);
            window.localStorage.removeItem(Na__VegMenu__STORAGE_STEM + (params.get('project') || params.get('project-folder') || 'none'));
        } catch (error) { /* nothing was kept, or nothing can be */ }
    }
    // ------------------------------------------------------------


    // FUNCTION | Where Every Viewer Starts on This Project: as It Was Saved
    // ------------------------------------------------------------
    function Na__VegMenu__StartingState(sceneData) {
        Na__VegMenu__ForgetOldChoice();
        return {
            shown               : sceneData.Vegetation__SceneData__ShowByDefault !== false,
            transparencyPercent : sceneData.Vegetation__SceneData__DefaultTransparencyPercent || 0
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Hold the Two Rows in the Project's Object, for the Next Save
    // ------------------------------------------------------------
    // Only for someone with the panel, whose Save Vegetation writes them; the server takes them from
    // any staff save. Undo and Redo leave them alone (Na__VegHist__KEYS).
    // ------------------------------------------------------------
    function Na__VegMenu__HoldForSave(shown, transparencyPercent) {
        const data = Na__VegMenu__State.data;
        const sceneData = data ? data.Na__VegData__Current() : null;
        if (!sceneData) return;
        const percent = Math.round(transparencyPercent);
        if (sceneData.Vegetation__SceneData__ShowByDefault === shown && sceneData.Vegetation__SceneData__DefaultTransparencyPercent === percent) return;
        sceneData.Vegetation__SceneData__ShowByDefault              = shown;
        sceneData.Vegetation__SceneData__DefaultTransparencyPercent = percent;
        data.Na__VegData__SetDirty(true);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Two Rows Everyone Gets
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Runtime, Already Loaded Once a Project Is On
    // ------------------------------------------------------------
    function Na__VegMenu__Runtime() {
        return import('../03__System__SceneLayer/Na__Vegetation__Runtime__.js');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Write the Slider's Words
    // ------------------------------------------------------------
    function Na__VegMenu__WriteValue(percent) {
        const value = document.getElementById(Na__VegMenu__VALUE_ID);
        if (value) value.textContent = Math.round(percent) + '%';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Wire the Section Once
    // ------------------------------------------------------------
    function Na__VegMenu__Wire() {
        if (Na__VegMenu__State.wired) return;
        const toggle = document.getElementById(Na__VegMenu__TOGGLE_ID);
        const panel  = document.getElementById(Na__VegMenu__PANEL_ID);
        const show   = document.getElementById(Na__VegMenu__SHOW_ID);
        const slider = document.getElementById(Na__VegMenu__SLIDER_ID);
        if (!toggle || !panel || !show || !slider) return;
        Na__VegMenu__State.wired = true;

        toggle.addEventListener('click', () => {
            panel.classList.toggle('is-open');
            Na__VegMenu__FollowFold();
        });

        show.addEventListener('change', async () => {
            const runtime = await Na__VegMenu__Runtime();
            runtime.Na__VegRun__SetShown(show.checked);
            Na__VegMenu__HoldForSave(show.checked, Number(slider.value));
        });

        slider.addEventListener('input', async () => {
            const percent = Number(slider.value);
            Na__VegMenu__WriteValue(percent);
            const runtime = await Na__VegMenu__Runtime();
            runtime.Na__VegRun__SetTransparency(percent);
        });
        slider.addEventListener('change', () => {
            Na__VegMenu__HoldForSave(show.checked, Number(slider.value));
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Dev Rows
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | One Row That Opens Something, with Its Icon
    // ------------------------------------------------------------
    // Everything a row opens needs the layer, so it is made here if nothing was planted before.
    // ------------------------------------------------------------
    function Na__VegMenu__DevButton(id, text, title, iconName, changes, open) {
        const button = document.createElement('button');
        button.type      = 'button';
        button.id        = id;
        button.className = 'na-dropdown-menu__action na-dropdown-menu__action--secondary na-scene-row';
        button.title     = title;
        button.appendChild(changes.Na__SceneChanges__Icon(iconName));
        const label = document.createElement('span');
        label.className   = 'na-scene-row__label';
        label.textContent = text;
        button.appendChild(label);
        button.addEventListener('click', async () => {
            try {
                const door = await import('../Na__Vegetation__.js');
                await door.Na__Vegetation__EnsureStarted();
                await open();
            } catch (error) {
                console.warn('[TrueVision3D Vegetation] ' + text + ' could not open:', error);
                const context = Na__VegMenu__State.context;
                if (context && context.showToast) context.showToast(text + ' could not open: ' + (error && error.message), true);
            }
        });
        return button;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Small Heading Among the Dev Rows
    // ------------------------------------------------------------
    function Na__VegMenu__DevHeading(text) {
        const heading = document.createElement('div');
        heading.className   = 'na-dropdown-menu__panel-title';
        heading.style.marginTop = '12px';
        heading.style.marginBottom = '0';
        heading.textContent = text;
        return heading;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Rows Only an Admin Gets
    // ------------------------------------------------------------
    function Na__VegMenu__BuildAdminRows(holder, context, changes, data) {
        holder.appendChild(Na__VegMenu__DevHeading('Line Rules'));
        holder.appendChild(Na__VegMenu__DevButton('naVegetationLineworkButton', 'Vegetation Linework', 'The demo\'s line rules: every value saves in this project', 'Vegetation', changes, async () => {
            const panel = await import('./Na__Vegetation__LineworkPanel__.js');
            await panel.Na__VegLine__Toggle(context);
        }));

        // DRAWINGS | Off by default (plan, D04). A sheet's viewport has its own tick, in its
        // render composites. This is for a plan or elevation on screen in the 3D view.
        holder.appendChild(Na__VegMenu__DevHeading('Drawings'));
        const liveRow = document.createElement('label');
        liveRow.className = 'na-dropdown-menu__panel-row na-dropdown-menu__panel-row--toggle';
        liveRow.style.marginTop = '8px';
        const liveText = document.createElement('span');
        liveText.textContent = 'Show on live plans and elevations';
        liveRow.appendChild(liveText);
        const liveTick = document.createElement('input');
        liveTick.type = 'checkbox';
        liveTick.id = 'naVegetationLiveDrawingsToggle';
        liveTick.className = 'na-dropdown-menu__checkbox';
        liveTick.checked = data.Na__VegData__Current().Vegetation__SceneData__ShowOnLiveDrawings === true;
        liveTick.addEventListener('change', async () => {
            data.Na__VegData__Current().Vegetation__SceneData__ShowOnLiveDrawings = liveTick.checked;
            data.Na__VegData__SetDirty(true);
            const runtime = await Na__VegMenu__Runtime();
            runtime.Na__VegRun__SetShown(runtime.Na__VegRun__IsShown());       // <-- A way to ask for a frame, and the sheet stamp stays right
        });
        liveRow.appendChild(liveTick);
        holder.appendChild(liveRow);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Rows for Staff
    // ------------------------------------------------------------
    // The gate only decides what the page offers: the server decides what each save does,
    // whatever a page sends.
    // ------------------------------------------------------------
    async function Na__VegMenu__BuildDevRows() {
        if (Na__VegMenu__State.devDone) return;
        const holder = document.getElementById(Na__VegMenu__DEV_ROWS_ID);
        if (!holder) return;
        const gate = await import('../../03__AppUtils/Na__AppUtils__DevGate__.js');
        if (!gate.Na__DevGate__CanCreateAssets()) return;
        if (Na__VegMenu__State.devDone) return;
        Na__VegMenu__State.devDone = true;

        const context = Na__VegMenu__State.context;
        const changes = await import('../../22__System__SceneAssets/Na__SceneAssets__ChangesPanel__.js');
        const data    = await import('../02__Core__Data/Na__Vegetation__SceneData__.js');
        changes.Na__SceneChanges__AddStyles();

        // AN ADMIN'S ROWS | The look of the whole project stays in this menu (Adam's answer)
        if (gate.Na__DevGate__IsAuthoringEnabled()) {
            holder.hidden = false;
            const divider = document.createElement('hr');
            divider.className = 'na-dropdown-menu__panel-divider';
            holder.appendChild(divider);
            Na__VegMenu__BuildAdminRows(holder, context, changes, data);
        }

        // THE PANEL FOLLOWS THE FOLD | Prepared now for the leave-site guard: an admin's drawings
        // tick can leave unsaved work before the panel has ever opened.
        const shell = await import('./Na__Vegetation__PanelShell__.js');
        await shell.Na__VegShell__Prepare(context);
        Na__VegMenu__State.shell = shell;
        Na__VegMenu__State.data  = data;
        window.addEventListener(shell.Na__VegShell__CLOSED_EVENT, Na__VegMenu__OnPanelClosed);
        window.addEventListener(shell.Na__VegShell__OPENING_EVENT, Na__VegMenu__OnPanelOpening);
        if (Na__VegMenu__IsUnfolded()) Na__VegMenu__OpenPanel();               // <-- Unfolded before these rows were ready

        // AN ADMIN IS TOLD WHAT IS WAITING | Nobody else need keep watch
        const work = data.Na__VegData__Work();
        const waiting = work.isAdmin ? changes.Na__SceneChanges__CountWaiting(work.summary, '') : 0;
        if (waiting > 0 && context && context.showToast) {
            context.showToast(waiting + (waiting === 1 ? ' vegetation change is' : ' vegetation changes are') + ' waiting for your approval: Tools & Settings, Vegetation, Changes.', false);
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Vegetation Panel Follows the Fold
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Is the Section Unfolded?
    // ------------------------------------------------------------
    function Na__VegMenu__IsUnfolded() {
        const panel = document.getElementById(Na__VegMenu__PANEL_ID);
        return !!(panel && panel.classList.contains('is-open'));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Open the Panel, Every Section Folded
    // ------------------------------------------------------------
    // The layer is made here if nothing was planted before: everything in the panel needs it.
    // ------------------------------------------------------------
    async function Na__VegMenu__OpenPanel() {
        const context = Na__VegMenu__State.context;
        try {
            const door = await import('../Na__Vegetation__.js');
            await door.Na__Vegetation__EnsureStarted();
            const browser = await import('./Na__Vegetation__AssetBrowser__.js');
            await browser.Na__VegCards__Open(context);
            if (!Na__VegMenu__IsUnfolded()) browser.Na__VegCards__Close();     // <-- Folded again while the library loaded
        } catch (error) {
            console.warn('[TrueVision3D Vegetation] The Vegetation panel could not open:', error);
            if (context && context.showToast) context.showToast('The Vegetation panel could not open: ' + (error && error.message), true);
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Section Was Unfolded or Folded: the Panel Follows
    // ------------------------------------------------------------
    // Only for someone who may place plants. Anyone else has the two rows, and nothing opens.
    // ------------------------------------------------------------
    function Na__VegMenu__FollowFold() {
        const shell = Na__VegMenu__State.shell;
        if (!shell) return;
        if (Na__VegMenu__IsUnfolded()) Na__VegMenu__OpenPanel();
        else shell.Na__VegShell__Close(Na__VegMenu__HUB_ID);
    }
    // ------------------------------------------------------------


    // HANDLER | The Panel Closed: Its Section Folds
    // ------------------------------------------------------------
    // Its own Close, the Entourage panel taking the left, or the section folding. Save goes with
    // the panel, so unsaved work is mentioned.
    // ------------------------------------------------------------
    function Na__VegMenu__OnPanelClosed(event) {
        const detail = event.detail || {};
        if (detail.id !== Na__VegMenu__HUB_ID) return;
        const panel = document.getElementById(Na__VegMenu__PANEL_ID);
        if (panel) panel.classList.remove('is-open');
        const data = Na__VegMenu__State.data;
        const context = Na__VegMenu__State.context;
        if (data && data.Na__VegData__IsDirty() && context && context.showToast) {
            context.showToast('Vegetation has unsaved changes. Unfold Vegetation in Tools & Settings to save them.', false);
        }
    }
    // ------------------------------------------------------------


    // HANDLER | The Panel Is Opening from Somewhere Else: Its Section Unfolds
    // ------------------------------------------------------------
    function Na__VegMenu__OnPanelOpening(event) {
        const detail = event.detail || {};
        if (detail.owner !== 'vegetation' || detail.side !== 'left') return;
        const panel = document.getElementById(Na__VegMenu__PANEL_ID);
        if (panel) panel.classList.add('is-open');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Show the Section, Set to Where This Device Starts
    // ------------------------------------------------------------
    function Na__VegMenu__Show(context, starting) {
        Na__VegMenu__State.context = context;
        const item = document.getElementById(Na__VegMenu__ITEM_ID);
        if (!item) return false;                                               // <-- Markup absent: plants still draw

        Na__VegMenu__Wire();
        const show   = document.getElementById(Na__VegMenu__SHOW_ID);
        const slider = document.getElementById(Na__VegMenu__SLIDER_ID);
        if (show) show.checked = starting.shown;
        if (slider) slider.value = String(starting.transparencyPercent);
        Na__VegMenu__WriteValue(starting.transparencyPercent);

        item.style.display = '';
        Na__VegMenu__BuildDevRows().catch((error) => {
            console.warn('[TrueVision3D Vegetation] The dev rows could not be built:', error && error.message);
        });
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Hide the Section, and Close Anything Opened from It
    // ------------------------------------------------------------
    function Na__VegMenu__Hide() {
        const item = document.getElementById(Na__VegMenu__ITEM_ID);
        if (item) item.style.display = 'none';
        const panel = document.getElementById(Na__VegMenu__PANEL_ID);
        if (panel) panel.classList.remove('is-open');
        if (Na__VegMenu__State.devDone) {
            import('./Na__Vegetation__PanelShell__.js').then((shell) => shell.Na__VegShell__CloseAll()).catch(() => {});
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Menu Section API
    // ------------------------------------------------------------
    export {
        Na__VegMenu__StartingState,
        Na__VegMenu__Show,
        Na__VegMenu__Hide
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
