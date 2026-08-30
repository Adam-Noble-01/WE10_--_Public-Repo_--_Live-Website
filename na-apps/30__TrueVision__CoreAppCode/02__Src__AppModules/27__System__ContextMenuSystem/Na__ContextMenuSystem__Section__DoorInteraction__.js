// =============================================================================
// TRUEVISION3D - CONTEXT MENU SYSTEM - DOOR INTERACTION SECTION
// =============================================================================
//
// FILE       : Na__ContextMenuSystem__Section__DoorInteraction__.js
// NAMESPACE  : Na__ContextMenu
// MODULE     : Context Menu System - Door Interaction Section Provider
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Offer Open / Close Door on the right-click menu
// CREATED    : 30-Aug-2026
//
// DESCRIPTION:
// - The reference implementation of an OBJECT-TYPE interaction section. It is
//   the template every future interactive asset should copy: a small module
//   that knows how to recognise one kind of object in a raycast hit, and
//   returns the rows that apply to it.
// - Doors already open on left-click. This section exists so the interaction is
//   DISCOVERABLE - a user who never learns that a door is clickable will still
//   find "Open Door" by right-clicking it - and so that future assets with more
//   than one possible interaction have an established place to present them.
// - Section order places object interactions above the model visibility rows,
//   separated by a rule (see ContextMenu__Sections__*__Order in AppConfig).
//
// HOW TO ADD ANOTHER OBJECT-TYPE SECTION:
// - Copy this file's shape: export a GetProvider() returning { id, buildSection }
//   where buildSection(hitContext) returns { id, rows } or null.
// - A row is { group, label, meta, isActive, action }. Rows sharing a group
//   value are drawn together; a rule separates groups.
// - Register the provider in Na__ContextMenuSystem__SystemLogic__.js.
// - Nothing in the menu renderer needs to change.
//
// INTEGRATION:
// - Registered with Na__ContextMenuSystem__SystemLogic__.js at init.
// - Reads and drives the existing door animation module; owns no door state.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 30-Aug-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Door Animation System
    // ------------------------------------------------------------
    import {
        Na__DoorAnim__DoorRegistry,
        Na__DoorAnim__ToggleDoor,
        Na__DoorAnim__TogglePanel,
        Na__DoorAnim__FindAdrAncestor,
        Na__DoorAnim__ResolveHitPanel,
        Na__DoorAnim__IsDoorOpen
    } from '../25__System__3dObject__InteractionSystem/3dObjectIInteraction__Animation__ClickToOpenDoors__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Section Identity
    // ------------------------------------------------------------
    const Na__CtxDoor__SectionId = 'doorInteraction';                            // <-- Provider key in the section registry
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State (Private)
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Resolved Label Configuration
    // ------------------------------------------------------------
    let Na__CtxDoor__Labels = {};                                                // <-- Row wording from AppConfig
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Door Resolution
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Resolve a Raycast Hit to a Door Record and Panel
    // ------------------------------------------------------------
    // Independent-panel assemblies (explicitly configured exterior doubles)
    // resolve to the single leaf that was clicked, matching what a left-click
    // on that same leaf would do. Everything else resolves to the whole ADR.
    // ------------------------------------------------------------
    function Na__CtxDoor__ResolveDoor(hitObject) {
        if (!hitObject) return null;

        const adrObject = Na__DoorAnim__FindAdrAncestor(hitObject);
        if (!adrObject) return null;                                             // <-- Not part of a door assembly

        const doorRecord = Na__DoorAnim__DoorRegistry.get(adrObject.name);
        if (!doorRecord) return null;                                            // <-- Assembly is not registered

        if (doorRecord.isIndependentPanels === true) {
            const hitPanel = Na__DoorAnim__ResolveHitPanel(doorRecord, hitObject);
            if (hitPanel) {
                return { doorRecord: doorRecord, panel: hitPanel };               // <-- Single leaf
            }
        }

        return { doorRecord: doorRecord, panel: null };                          // <-- Whole assembly, lockstep
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read the Configured Label or Fall Back
    // ------------------------------------------------------------
    function Na__CtxDoor__ResolveLabel(labelKey, fallback) {
        const configured = Na__CtxDoor__Labels[labelKey];
        return (typeof configured === 'string' && configured.length > 0) ? configured : fallback;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Section Building
// -----------------------------------------------------------------------------

    // FUNCTION | Build the Door Interaction Section for a Resolved Hit
    // ------------------------------------------------------------
    function Na__CtxDoor__BuildSection(hitContext) {
        if (!hitContext) return null;

        const resolved = Na__CtxDoor__ResolveDoor(hitContext.hitObject);
        if (!resolved) return null;                                              // <-- Not a door, contribute nothing

        const animationTarget = resolved.panel || resolved.doorRecord;           // <-- Panel state when independent, else ADR
        const isOpen          = Na__DoorAnim__IsDoorOpen(animationTarget);

        const label = isOpen
            ? Na__CtxDoor__ResolveLabel('ContextMenu__Labels__CloseDoor', 'Close Door')
            : Na__CtxDoor__ResolveLabel('ContextMenu__Labels__OpenDoor',  'Open Door');

        return {
            id   : Na__CtxDoor__SectionId,
            rows : [{
                group  : 'doorInteraction',
                label  : label,
                action : () => {
                    if (resolved.panel) {
                        Na__DoorAnim__TogglePanel(resolved.doorRecord, resolved.panel);
                    } else {
                        Na__DoorAnim__ToggleDoor(resolved.doorRecord);
                    }
                }
            }]
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Apply Label Configuration from AppConfig
    // ------------------------------------------------------------
    function Na__ContextMenu__DoorInteraction__ApplyConfig(config) {
        if (!config) return;

        const labels = config['ContextMenu__Labels'];
        if (labels && typeof labels === 'object') {
            Na__CtxDoor__Labels = { ...labels };
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Section Provider Descriptor
    // ------------------------------------------------------------
    function Na__ContextMenu__DoorInteraction__GetProvider() {
        return {
            id           : Na__CtxDoor__SectionId,
            buildSection : Na__CtxDoor__BuildSection
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Door Interaction Section API
    // ------------------------------------------------------------
    export {
        Na__ContextMenu__DoorInteraction__GetProvider,
        Na__ContextMenu__DoorInteraction__ApplyConfig
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
