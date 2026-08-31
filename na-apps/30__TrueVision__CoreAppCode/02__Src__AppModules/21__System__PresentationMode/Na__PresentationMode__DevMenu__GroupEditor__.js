// =============================================================================
// TRUEVISION3D - PRESENTATION MODE - DEV MENU SCENE GROUP EDITOR
// =============================================================================
//
// FILE       : Na__PresentationMode__DevMenu__GroupEditor__.js
// NAMESPACE  : Na__PmGroupDev
// MODULE     : PresentationMode - Dev Menu Scene Group Editor
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Localhost-only editor for the per-project scene group set, shown
//              as a collapsible section at the top of the Presentation Scenes
//              panel in the Dev Tools menu
// CREATED    : 31-Aug-2026
//
// DESCRIPTION:
// - Renders one row per group: an enable toggle, an editable name, up/down
//   reorder arrows and a delete button. Plus an Add Group button.
// - A project that has never had groups is seeded IN MEMORY from this system's
//   AppConfig defaults the first time this panel renders - four groups with
//   only the first enabled. Nothing is written to R2 until the author actually
//   changes something, so merely opening the Dev menu can never alter a
//   project's stored data.
// - Switching a group off, or deleting it, while scenes still sit in it warns
//   and moves those scenes to the first enabled group rather than letting them
//   vanish. At least one group must always stay enabled.
//
// WHY IT SIGNALS RATHER THAN SAVES:
// - Groups and scenes live in the SAME project JSON block, so a save must
//   write both. Rather than duplicate the commit-and-persist path, this module
//   mutates the live config and broadcasts 'na-presentation-groups-changed';
//   the scene editor owns the single implementation of normalise -> commit ->
//   write to R2 and responds to that event. The import direction is therefore
//   one-way (scene editor -> this module) with an event travelling back, and
//   there is exactly one code path that writes to R2.
//
// INTEGRATION:
// - Rendered by Na__PresentationMode__DevMenu__SceneEditor.js into a container
//   it creates at the top of #naPmDevEditorPanel.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 31-Aug-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Scene Group Data Layer
    // ------------------------------------------------------------
    import {
        Na__PresentationMode__SceneGroups__IsEnabled,
        Na__PresentationMode__SceneGroups__GetDevMenuLabels,
        Na__PresentationMode__SceneGroups__FormatViewCount,
        Na__PresentationMode__SceneGroups__GetDefaultGroups,
        Na__PresentationMode__SceneGroups__GetGroups,
        Na__PresentationMode__SceneGroups__GetEnabledGroups,
        Na__PresentationMode__SceneGroups__GetFallbackGroupId,
        Na__PresentationMode__SceneGroups__ResolveSceneGroupId
    } from './Na__PresentationMode__SceneGroups__Data__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Scene Data Accessors
    // ------------------------------------------------------------
    import {
        Na__PresentationMode__ProjectJson__GetActiveConfig
    } from './Na__PresentationMode__ProjectJson__SceneData.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Project JSON Key Names
    // ------------------------------------------------------------
    const Na__PmGroupDev__GROUPS_KEY        = 'PresentationMode__SavedCameraScenes__Groups';
    const Na__PmGroupDev__SCENES_KEY        = 'PresentationMode__SavedCameraScenes__Scenes';
    const Na__PmGroupDev__GROUP_ID_KEY      = 'PresentationMode__Group__Id';
    const Na__PmGroupDev__GROUP_NAME_KEY    = 'PresentationMode__Group__Name';
    const Na__PmGroupDev__GROUP_ORDER_KEY   = 'PresentationMode__Group__Order';
    const Na__PmGroupDev__GROUP_ENABLED_KEY = 'PresentationMode__Group__Enabled';
    const Na__PmGroupDev__SCENE_GROUP_KEY   = 'PresentationMode__Scene__GroupId';
    // ------------------------------------------------------------


    // MODULE CONSTANTS | DOM and Event Names
    // ------------------------------------------------------------
    const Na__PmGroupDev__SECTION_ID     = 'naPmDevGroupSection';                 // <-- Collapsible section wrapper
    const Na__PmGroupDev__CHANGED_EVENT  = 'na-presentation-groups-changed';      // <-- Scene editor persists in response
    const Na__PmGroupDev__NEW_GROUP_NAME = 'New Group';                           // <-- Placeholder name for an added group
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Panel UI State
    // ------------------------------------------------------------
    let Na__PmGroupDev__IsSectionOpen = false;   // <-- Collapsed by default; survives panel rebuilds
    let Na__PmGroupDev__ShowToast     = null;    // <-- Toast helper, shared from the scene editor
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Wording Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Fill {placeholders} in a Configured Message Template
    // ------------------------------------------------------------
    function Na__PmGroupDev__FormatMessage(template, values) {
        if (!template) return '';
        return Object.keys(values).reduce(
            (text, key) => text.split(`{${key}}`).join(String(values[key])),
            template
        );
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Group Data Mutation
// -----------------------------------------------------------------------------

    // FUNCTION | Seed the Configured Default Groups Into a Project That Has None
    // ------------------------------------------------------------
    // In memory only. Nothing reaches R2 until the author makes an actual
    // change, so opening the Dev menu on a project is never itself an edit.
    // Only the first group is enabled by default, which means the selector bar
    // stays hidden and the project looks exactly as it did until a second group
    // is deliberately switched on.
    // ------------------------------------------------------------
    function Na__PmGroupDev__EnsureGroupsSeeded(config) {
        if (!config) return false;

        const existing = config[Na__PmGroupDev__GROUPS_KEY];
        if (Array.isArray(existing) && existing.length > 0) return false;    // <-- Already has a group set

        const defaults = Na__PresentationMode__SceneGroups__GetDefaultGroups();
        if (defaults.length === 0) return false;                             // <-- Config not loaded; never seed an empty set

        config[Na__PmGroupDev__GROUPS_KEY] = defaults;
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Rewrite Group Order to Match Array Position (1..N)
    // ------------------------------------------------------------
    function Na__PmGroupDev__NormaliseGroupOrder(groups) {
        groups.forEach((group, index) => {
            group[Na__PmGroupDev__GROUP_ORDER_KEY] = index + 1;              // <-- Contiguous, 1-based
        });
        return groups;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Generate the Next Unused Group Id
    // ------------------------------------------------------------
    function Na__PmGroupDev__GetNextGroupId(existingGroups) {
        const usedIds = new Set(existingGroups.map(g => g[Na__PmGroupDev__GROUP_ID_KEY]));
        let n = existingGroups.length + 1;
        let candidate = `Group_${String(n).padStart(3, '0')}`;
        while (usedIds.has(candidate)) {                                     // <-- Avoid collisions after deletes
            n++;
            candidate = `Group_${String(n).padStart(3, '0')}`;
        }
        return candidate;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Count the Scenes Currently Resolving Into a Group
    // ------------------------------------------------------------
    function Na__PmGroupDev__CountScenesInGroup(config, groupId) {
        const scenes = (config && config[Na__PmGroupDev__SCENES_KEY]) || [];
        if (!Array.isArray(scenes)) return 0;
        return scenes.filter(scene =>
            Na__PresentationMode__SceneGroups__ResolveSceneGroupId(scene, config) === groupId
        ).length;
    }
    // ------------------------------------------------------------


    // FUNCTION | Move Every Scene Out of One Group and Into Another
    // ------------------------------------------------------------
    // Assignments are written explicitly rather than left to the runtime
    // fallback, so a later rename or reorder of the destination group cannot
    // silently move these scenes a second time.
    // ------------------------------------------------------------
    function Na__PmGroupDev__ReassignScenes(config, fromGroupId, toGroupId) {
        const scenes = (config && config[Na__PmGroupDev__SCENES_KEY]) || [];
        if (!Array.isArray(scenes) || !toGroupId) return;

        scenes.forEach((scene) => {
            const currentGroupId = Na__PresentationMode__SceneGroups__ResolveSceneGroupId(scene, config);
            if (currentGroupId === fromGroupId) {
                scene[Na__PmGroupDev__SCENE_GROUP_KEY] = toGroupId;
            }
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Broadcast That Groups Changed so the Scene Editor Persists
    // ------------------------------------------------------------
    function Na__PmGroupDev__NotifyChanged() {
        window.dispatchEvent(new CustomEvent(Na__PmGroupDev__CHANGED_EVENT));
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Group Actions
// -----------------------------------------------------------------------------

    // FUNCTION | Enable or Disable a Group
    // ------------------------------------------------------------
    // Returns false when the change was refused or cancelled, so the caller can
    // put the checkbox back where it was.
    // ------------------------------------------------------------
    function Na__PmGroupDev__SetGroupEnabled(config, group, enabled) {
        const labels  = Na__PresentationMode__SceneGroups__GetDevMenuLabels();
        const groupId = group[Na__PmGroupDev__GROUP_ID_KEY];

        if (enabled) {
            group[Na__PmGroupDev__GROUP_ENABLED_KEY] = true;
            return true;
        }

        // GUARD | Never leave the project with nothing enabled
        const enabledGroups = Na__PresentationMode__SceneGroups__GetEnabledGroups(config);
        if (enabledGroups.length <= 1) {
            if (Na__PmGroupDev__ShowToast) {
                Na__PmGroupDev__ShowToast(labels.SceneGroups__DevMenu__LastGroupBlockedMessage
                    || 'At least one scene group must stay enabled.', true);
            }
            return false;
        }

        // WARN | Scenes living here would otherwise be stranded
        const sceneCount = Na__PmGroupDev__CountScenesInGroup(config, groupId);
        const fallback   = enabledGroups.find(g => g[Na__PmGroupDev__GROUP_ID_KEY] !== groupId);
        const fallbackId = fallback ? fallback[Na__PmGroupDev__GROUP_ID_KEY] : null;

        if (sceneCount > 0) {
            const message = Na__PmGroupDev__FormatMessage(labels.SceneGroups__DevMenu__DisableWithScenesPrompt, {
                group    : group[Na__PmGroupDev__GROUP_NAME_KEY],
                count    : sceneCount,
                fallback : fallback ? fallback[Na__PmGroupDev__GROUP_NAME_KEY] : ''
            });
            if (!window.confirm(message)) return false;                      // <-- Author backed out

            Na__PmGroupDev__ReassignScenes(config, groupId, fallbackId);     // <-- Move them before the group goes dark
        }

        group[Na__PmGroupDev__GROUP_ENABLED_KEY] = false;
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Delete a Group Entirely
    // ------------------------------------------------------------
    function Na__PmGroupDev__DeleteGroup(config, group) {
        const labels  = Na__PresentationMode__SceneGroups__GetDevMenuLabels();
        const groups  = config[Na__PmGroupDev__GROUPS_KEY] || [];
        const groupId = group[Na__PmGroupDev__GROUP_ID_KEY];

        // GUARD | The last remaining group cannot go
        if (groups.length <= 1) {
            if (Na__PmGroupDev__ShowToast) {
                Na__PmGroupDev__ShowToast(labels.SceneGroups__DevMenu__LastGroupBlockedMessage
                    || 'At least one scene group must stay enabled.', true);
            }
            return false;
        }

        const sceneCount = Na__PmGroupDev__CountScenesInGroup(config, groupId);
        const fallback   = Na__PresentationMode__SceneGroups__GetEnabledGroups(config)
            .find(g => g[Na__PmGroupDev__GROUP_ID_KEY] !== groupId) || null;

        // GUARD | Deleting the only enabled group would strand every scene
        if (sceneCount > 0 && !fallback) {
            if (Na__PmGroupDev__ShowToast) {
                Na__PmGroupDev__ShowToast(labels.SceneGroups__DevMenu__LastGroupBlockedMessage
                    || 'At least one scene group must stay enabled.', true);
            }
            return false;
        }

        const message = sceneCount > 0
            ? Na__PmGroupDev__FormatMessage(labels.SceneGroups__DevMenu__DeleteWithScenesPrompt, {
                group    : group[Na__PmGroupDev__GROUP_NAME_KEY],
                count    : sceneCount,
                fallback : fallback ? fallback[Na__PmGroupDev__GROUP_NAME_KEY] : ''
            })
            : Na__PmGroupDev__FormatMessage(labels.SceneGroups__DevMenu__DeleteEmptyPrompt, {
                group : group[Na__PmGroupDev__GROUP_NAME_KEY]
            });

        if (!window.confirm(message)) return false;

        if (sceneCount > 0 && fallback) {
            Na__PmGroupDev__ReassignScenes(config, groupId, fallback[Na__PmGroupDev__GROUP_ID_KEY]);
        }

        config[Na__PmGroupDev__GROUPS_KEY] = groups.filter(g => g[Na__PmGroupDev__GROUP_ID_KEY] !== groupId);
        Na__PmGroupDev__NormaliseGroupOrder(config[Na__PmGroupDev__GROUPS_KEY]); // <-- Close the gap
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Move a Group Up or Down by One Position
    // ------------------------------------------------------------
    // Group order decides the order the carousel chevrons roll through the
    // groups, so this is genuinely a playback-order control, not cosmetics.
    // ------------------------------------------------------------
    function Na__PmGroupDev__MoveGroup(config, groupId, offset) {
        const groups    = Na__PresentationMode__SceneGroups__GetGroups(config);
        const fromIndex = groups.findIndex(g => g[Na__PmGroupDev__GROUP_ID_KEY] === groupId);
        if (fromIndex === -1) return false;

        const targetIndex = fromIndex + offset;
        if (targetIndex < 0 || targetIndex > groups.length - 1) return false; // <-- Already at an end

        const [moved] = groups.splice(fromIndex, 1);
        groups.splice(targetIndex, 0, moved);

        config[Na__PmGroupDev__GROUPS_KEY] = Na__PmGroupDev__NormaliseGroupOrder(groups);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Append a New Group
    // ------------------------------------------------------------
    function Na__PmGroupDev__AddGroup(config) {
        const groups   = Na__PresentationMode__SceneGroups__GetGroups(config);
        const newGroup = {
            [Na__PmGroupDev__GROUP_ID_KEY]      : Na__PmGroupDev__GetNextGroupId(groups),
            [Na__PmGroupDev__GROUP_NAME_KEY]    : Na__PmGroupDev__NEW_GROUP_NAME,
            [Na__PmGroupDev__GROUP_ORDER_KEY]   : groups.length + 1,
            [Na__PmGroupDev__GROUP_ENABLED_KEY] : true                       // <-- Added on purpose, so switched on
        };

        config[Na__PmGroupDev__GROUPS_KEY] = Na__PmGroupDev__NormaliseGroupOrder([...groups, newGroup]);
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Group Row DOM Builder
// -----------------------------------------------------------------------------

    // FUNCTION | Build a Single Group Editor Row
    // ------------------------------------------------------------
    function Na__PmGroupDev__BuildGroupRow(config, group, rowIndex, rowCount, onMutated) {
        const groupId = group[Na__PmGroupDev__GROUP_ID_KEY];

        const row = document.createElement('div');
        row.className        = 'na-pm-dev__group-row';
        row.dataset.groupId  = groupId;

        // ENABLE TOGGLE | Whether this group exists for this project at all
        const enabledBox = document.createElement('input');
        enabledBox.type      = 'checkbox';
        enabledBox.className = 'na-pm-dev__checkbox';
        enabledBox.checked   = group[Na__PmGroupDev__GROUP_ENABLED_KEY] !== false;
        enabledBox.title     = 'Switch this group on or off for this project';
        enabledBox.addEventListener('change', () => {
            const applied = Na__PmGroupDev__SetGroupEnabled(config, group, enabledBox.checked);
            if (!applied) {
                enabledBox.checked = !enabledBox.checked;                    // <-- Refused or cancelled; put it back
                return;
            }
            onMutated();
        });
        row.appendChild(enabledBox);

        // NAME | Renaming is the point of the feature - an interiors job just
        // renames a group rather than needing a new one
        const nameInput = document.createElement('input');
        nameInput.type      = 'text';
        nameInput.className = 'na-pm-dev__input na-pm-dev__group-name';
        nameInput.value     = group[Na__PmGroupDev__GROUP_NAME_KEY] || '';
        nameInput.title     = 'Rename this group';
        nameInput.addEventListener('input', () => {
            group[Na__PmGroupDev__GROUP_NAME_KEY] = nameInput.value;         // <-- Live edit on the working config
        });
        nameInput.addEventListener('change', () => onMutated());             // <-- Persist once the field is committed
        row.appendChild(nameInput);

        // SCENE COUNT | How many views this group currently holds
        const count = document.createElement('span');
        count.className   = 'na-pm-dev__group-count';
        count.textContent = Na__PresentationMode__SceneGroups__FormatViewCount(
            Na__PmGroupDev__CountScenesInGroup(config, groupId));            // <-- "3 Views", never a bare number
        count.title       = 'Scenes currently in this group';
        row.appendChild(count);

        // MOVE UP / MOVE DOWN | This is the order the carousel rolls through
        const moveUpBtn = document.createElement('button');
        moveUpBtn.type        = 'button';
        moveUpBtn.className   = 'na-pm-dev__reorder-btn';
        moveUpBtn.textContent = '▲';
        moveUpBtn.title       = 'Move this group one position earlier';
        moveUpBtn.disabled    = rowIndex === 0;
        moveUpBtn.addEventListener('click', () => {
            if (Na__PmGroupDev__MoveGroup(config, groupId, -1)) onMutated();
        });
        row.appendChild(moveUpBtn);

        const moveDownBtn = document.createElement('button');
        moveDownBtn.type        = 'button';
        moveDownBtn.className   = 'na-pm-dev__reorder-btn';
        moveDownBtn.textContent = '▼';
        moveDownBtn.title       = 'Move this group one position later';
        moveDownBtn.disabled    = rowIndex === rowCount - 1;
        moveDownBtn.addEventListener('click', () => {
            if (Na__PmGroupDev__MoveGroup(config, groupId, 1)) onMutated();
        });
        row.appendChild(moveDownBtn);

        // DELETE
        const deleteBtn = document.createElement('button');
        deleteBtn.type        = 'button';
        deleteBtn.className   = 'na-pm-dev__reorder-btn na-pm-dev__reorder-btn--danger';
        deleteBtn.textContent = '✕';
        deleteBtn.title       = 'Delete this group';
        deleteBtn.addEventListener('click', () => {
            if (Na__PmGroupDev__DeleteGroup(config, group)) onMutated();
        });
        row.appendChild(deleteBtn);

        return row;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Section Render
// -----------------------------------------------------------------------------

    // FUNCTION | Render the Collapsible Scene Groups Section
    // ------------------------------------------------------------
    // Called by the scene editor with a container it owns at the top of the
    // Presentation Scenes panel.
    // ------------------------------------------------------------
    function Na__PresentationMode__DevMenu__RenderGroupEditor(container, showToast) {
        if (!container) return;
        if (showToast) Na__PmGroupDev__ShowToast = showToast;

        container.innerHTML = '';
        if (!Na__PresentationMode__SceneGroups__IsEnabled()) return;         // <-- Config missing; feature inert

        const config = Na__PresentationMode__ProjectJson__GetActiveConfig();
        if (!config) return;                                                 // <-- No project scenes yet

        Na__PmGroupDev__EnsureGroupsSeeded(config);                          // <-- In-memory default set on first render

        const labels = Na__PresentationMode__SceneGroups__GetDevMenuLabels();

        const section = document.createElement('div');
        section.className = 'na-pm-dev__group-section';
        section.id        = Na__PmGroupDev__SECTION_ID;

        // COLLAPSIBLE HEADER
        const toggle = document.createElement('button');
        toggle.type      = 'button';
        toggle.className = 'na-pm-dev__group-toggle';
        toggle.setAttribute('aria-expanded', String(Na__PmGroupDev__IsSectionOpen));
        toggle.innerHTML = `${labels.SceneGroups__DevMenu__SectionTitle || 'Scene Groups'}`
                         + ` <span class="na-pm-dev__advanced-arrow">&#9662;</span>`;

        const body = document.createElement('div');
        body.className = 'na-pm-dev__group-body';
        body.classList.toggle('is-open', Na__PmGroupDev__IsSectionOpen);

        toggle.addEventListener('click', () => {
            Na__PmGroupDev__IsSectionOpen = !body.classList.contains('is-open');
            body.classList.toggle('is-open', Na__PmGroupDev__IsSectionOpen);
            toggle.setAttribute('aria-expanded', String(Na__PmGroupDev__IsSectionOpen));
        });

        // ROWS | Every group, enabled or not, so switching one on is one click
        const groups   = Na__PresentationMode__SceneGroups__GetGroups(config);
        const rowCount = groups.length;

        const onMutated = () => {
            Na__PmGroupDev__NotifyChanged();                                 // <-- Scene editor normalises, commits and saves
        };

        groups.forEach((group, index) => {
            body.appendChild(Na__PmGroupDev__BuildGroupRow(config, group, index, rowCount, onMutated));
        });

        // ADD GROUP
        const addBtn = document.createElement('button');
        addBtn.type        = 'button';
        addBtn.className   = 'na-pm-dev__btn na-pm-dev__btn--primary';
        addBtn.textContent = labels.SceneGroups__DevMenu__AddGroupLabel || '+ Add Group';
        addBtn.addEventListener('click', () => {
            if (Na__PmGroupDev__AddGroup(config)) onMutated();
        });

        const addRow = document.createElement('div');
        addRow.className = 'na-pm-dev__group-actions';
        addRow.appendChild(addBtn);
        body.appendChild(addRow);

        section.appendChild(toggle);
        section.appendChild(body);
        container.appendChild(section);
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Fallback Group Name for Display Elsewhere
    // ------------------------------------------------------------
    // Used by the per-scene dropdown to label the "inherit the default" option
    // with the name the scene would actually land in.
    // ------------------------------------------------------------
    function Na__PresentationMode__DevMenu__GetFallbackGroupName(config) {
        const fallbackId = Na__PresentationMode__SceneGroups__GetFallbackGroupId(config);
        if (!fallbackId) return '';

        const group = Na__PresentationMode__SceneGroups__GetGroups(config)
            .find(g => g[Na__PmGroupDev__GROUP_ID_KEY] === fallbackId);
        return group ? (group[Na__PmGroupDev__GROUP_NAME_KEY] || '') : '';
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Dev Menu Scene Group Editor API
    // ------------------------------------------------------------
    export {
        Na__PresentationMode__DevMenu__RenderGroupEditor,
        Na__PresentationMode__DevMenu__GetFallbackGroupName,
        Na__PmGroupDev__CHANGED_EVENT as Na__PresentationMode__DevMenu__GROUPS_CHANGED_EVENT
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
