/* =============================================================================
   NOBLE BIM ASSET TOOLS | USER INTERFACE - INSPECTOR PANEL
   =============================================================================

   FILE       : Na__UI__InspectorPanel__.mjs
   NAMESPACE  : Na__BimAssetTools
   MODULE     : UI - InspectorPanel
   AUTHOR     : Adam Noble - Noble Architecture
   PURPOSE    : Present the audit findings and the Revit parameter schedule
   CREATED    : 14-Aug-2026

   DESCRIPTION:
   - Two quite different reports share this panel, because they answer the same
     question from opposite directions.
   - For an asset with geometry it shows the audit: dimensions, topology, materials.
   - For a Revit family, where no geometry can be read, it shows the parameter
     schedule recovered from the PartAtom stream. That schedule is often more
     useful than the mesh would have been, because it gives every family type with
     its real dimensions in declared units.

   ============================================================================= */

import { EVENTS, Subscribe }    from '../01__AppCore/Na__AppCore__EventBus__.mjs';
import { GetActiveAsset }       from '../01__AppCore/Na__AppCore__AppState__.mjs';

// =============================================================================
// REGION | Module State
// =============================================================================

    // MODULE STATE | Mounted Host Element
    // ------------------------------------------------------------
    let HOST_ELEMENT = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// =============================================================================
// REGION | Element Builders
// =============================================================================

    // HELPER FUNCTION | Create an Element with a Class and Optional Text
    // ------------------------------------------------------------
    function Na__Inspector__El(tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text !== undefined && text !== null) element.textContent = text;
        return element;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build a Titled Section
    // ------------------------------------------------------------
    function Na__Inspector__Section(title) {
        const section = Na__Inspector__El('section', 'na-inspector__section');
        section.appendChild(Na__Inspector__El('h3', 'na-inspector__section-title', title));
        return section;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build a Label and Value Row
    // ------------------------------------------------------------
    function Na__Inspector__Row(label, value, modifier) {
        const row = Na__Inspector__El('div', 'na-inspector__row');
        row.appendChild(Na__Inspector__El('span', 'na-inspector__label', label));

        const valueEl = Na__Inspector__El('span', 'na-inspector__value', value);
        if (modifier) valueEl.classList.add(`na-inspector__value--${modifier}`);
        row.appendChild(valueEl);
        return row;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// =============================================================================
// REGION | Geometry Audit Report
// =============================================================================

    // HELPER FUNCTION | Build the Source and Unit Provenance Section
    // ------------------------------------------------------------
    // Presented first and prominently. Every other number in this panel is only
    // as trustworthy as the unit that produced it, so the unit's provenance is
    // stated rather than assumed to be understood.
    function Na__Inspector__BuildProvenance(asset) {
        const section = Na__Inspector__Section('Source and units');

        section.appendChild(Na__Inspector__Row('File', asset.fileName));
        section.appendChild(Na__Inspector__Row('Format', asset.extension.replace('.', '').toUpperCase()));
        section.appendChild(Na__Inspector__Row(
            'Source unit',
            asset.sourceUnit,
            asset.unitWasDeclared ? 'good' : 'warn'
        ));
        section.appendChild(Na__Inspector__Row(
            'Unit basis',
            asset.unitWasDeclared ? 'Declared by the file' : 'ASSUMED - verify before use',
            asset.unitWasDeclared ? 'good' : 'warn'
        ));

        if (asset.unitDeclaration) {
            const note = Na__Inspector__El('p', 'na-inspector__note', asset.unitDeclaration);
            section.appendChild(note);
        }

        if (asset.axisConvention) {
            section.appendChild(Na__Inspector__Row('Axis convention', asset.axisConvention));
        }

        if (asset.wasRecentred) {
            section.appendChild(Na__Inspector__Row(
                'Re-centred',
                `Yes, by ${asset.worldOffsetMm.map(v => (v / 1000).toFixed(1)).join(', ')} m`,
                'warn'
            ));
        }

        return section;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Audit Findings Section
    // ------------------------------------------------------------
    function Na__Inspector__BuildAudit(audit) {
        const section = Na__Inspector__Section('Geometry audit');

        // -- Verdict banner ---------------------------------------------------
        const banner = Na__Inspector__El('div', `na-verdict na-verdict--${audit.verdict}`);
        banner.appendChild(Na__Inspector__El('strong', null, audit.verdict.toUpperCase()));
        banner.appendChild(Na__Inspector__El('span', null,
            audit.criticalCount === 0 && audit.warningCount === 0
                ? 'No defects found'
                : `${audit.criticalCount} critical, ${audit.warningCount} warning${audit.warningCount === 1 ? '' : 's'}`
        ));
        section.appendChild(banner);

        // -- Findings ---------------------------------------------------------
        for (const finding of audit.findings) {
            const item = Na__Inspector__El('div', `na-finding na-finding--${finding.severity}`);

            const head = Na__Inspector__El('div', 'na-finding__head');
            head.appendChild(Na__Inspector__El('span', 'na-finding__label', finding.label));
            head.appendChild(Na__Inspector__El('span', 'na-finding__value', String(finding.value)));
            item.appendChild(head);

            if (finding.detail) {
                item.appendChild(Na__Inspector__El('p', 'na-finding__detail', finding.detail));
            }
            section.appendChild(item);
        }

        return section;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// =============================================================================
// REGION | Revit Schedule Report
// =============================================================================

    // HELPER FUNCTION | Build the Revit Family Header Section
    // ------------------------------------------------------------
    function Na__Inspector__BuildRevitHeader(metadata) {
        const section = Na__Inspector__Section('Revit family');
        const basic   = metadata.basicFileInfo || {};
        const schedule= metadata.schedule;

        if (metadata.preview) {
            const figure = Na__Inspector__El('figure', 'na-inspector__preview');
            const image  = document.createElement('img');
            image.src    = metadata.preview.dataUrl;
            image.alt    = `Embedded preview of ${metadata.fileName}`;
            image.width  = metadata.preview.width;
            image.height = metadata.preview.height;
            figure.appendChild(image);
            figure.appendChild(Na__Inspector__El('figcaption', null, `Embedded preview, ${metadata.preview.width} × ${metadata.preview.height}`));
            section.appendChild(figure);
        }

        if (schedule) {
            section.appendChild(Na__Inspector__Row('Family', schedule.title || '--'));
            if (schedule.revitCategory) section.appendChild(Na__Inspector__Row('Category', schedule.revitCategory));
            if (schedule.omniClass)     section.appendChild(Na__Inspector__Row('OmniClass', schedule.omniClass));
            if (schedule.hostBehaviour) section.appendChild(Na__Inspector__Row('Host', schedule.hostBehaviour));
            section.appendChild(Na__Inspector__Row('Types', String(schedule.typeCount)));
        }

        if (basic.revitVersion) section.appendChild(Na__Inspector__Row('Authored in', `Revit ${basic.revitVersion}`));
        if (basic.revitBuild)   section.appendChild(Na__Inspector__Row('Build', basic.revitBuild));
        if (basic.worksharing)  section.appendChild(Na__Inspector__Row('Worksharing', basic.worksharing));

        if (basic.originalPath) {
            const path = Na__Inspector__El('p', 'na-inspector__note', `Original save path: ${basic.originalPath}`);
            section.appendChild(path);
        }

        return section;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Family Type Parameter Table
    // ------------------------------------------------------------
    // Length and Angle parameters are put first because those are the ones being
    // checked against a data sheet. Text and Yes/No parameters follow.
    function Na__Inspector__BuildScheduleTable(schedule) {
        // -- Project files have no family types; they carry document-level
        // -- parameters instead, so those are shown rather than an empty table.
        if (schedule && schedule.typeCount === 0 && schedule.documentParameters && schedule.documentParameters.length > 0) {
            const section = Na__Inspector__Section('Project parameters');

            for (const parameter of schedule.documentParameters) {
                section.appendChild(Na__Inspector__Row(
                    parameter.displayName,
                    parameter.rawValue + (parameter.units ? ` ${parameter.units}` : '')
                ));
            }

            section.appendChild(Na__Inspector__El('p', 'na-inspector__note',
                'This is a Revit project file, so it carries project information rather than family types.'));
            return section;
        }

        const section = Na__Inspector__Section('Type parameters');

        if (!schedule || schedule.typeCount === 0) {
            section.appendChild(Na__Inspector__El('p', 'na-inspector__note', 'No family types were recovered from this file.'));
            return section;
        }

        const dimensional = schedule.parameterColumns.filter(c => c.typeOfParameter === 'Length' || c.typeOfParameter === 'Angle');
        const other       = schedule.parameterColumns.filter(c => c.typeOfParameter !== 'Length' && c.typeOfParameter !== 'Angle');
        const columns     = dimensional.concat(other);

        const wrapper = Na__Inspector__El('div', 'na-table-scroll');
        const table   = Na__Inspector__El('table', 'na-schedule-table');

        // -- Header -----------------------------------------------------------
        const thead    = document.createElement('thead');
        const headRow  = document.createElement('tr');
        headRow.appendChild(Na__Inspector__El('th', 'na-schedule-table__type', 'Type'));

        for (const column of columns) {
            const th = Na__Inspector__El('th', null, column.displayName);
            if (column.units) {
                th.appendChild(Na__Inspector__El('span', 'na-schedule-table__unit', ` (${column.units})`));
            }
            th.title = `${column.typeOfParameter || 'parameter'} · ${column.origin}`;
            headRow.appendChild(th);
        }
        thead.appendChild(headRow);
        table.appendChild(thead);

        // -- Body -------------------------------------------------------------
        const tbody = document.createElement('tbody');
        for (const type of schedule.types) {
            const row = document.createElement('tr');
            row.appendChild(Na__Inspector__El('td', 'na-schedule-table__type', type.typeName));

            for (const column of columns) {
                const parameter = type.parameters.find(p => p.name === column.name);
                const cell = Na__Inspector__El('td', null, parameter ? parameter.rawValue : '--');
                if (!parameter) cell.classList.add('na-schedule-table__empty');
                row.appendChild(cell);
            }
            tbody.appendChild(row);
        }
        table.appendChild(tbody);

        wrapper.appendChild(table);
        section.appendChild(wrapper);
        return section;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// =============================================================================
// REGION | Panel Rendering
// =============================================================================

    // HELPER FUNCTION | Build the Warning List Shared by Both Report Types
    // ------------------------------------------------------------
    function Na__Inspector__BuildWarnings(warnings) {
        const section = Na__Inspector__Section('Notes and warnings');
        const list    = Na__Inspector__El('ul', 'na-warning-list');

        for (const warning of warnings) {
            list.appendChild(Na__Inspector__El('li', null, warning));
        }
        section.appendChild(list);
        return section;
    }
    // ------------------------------------------------------------


    // FUNCTION | Redraw the Inspector for the Active Asset
    // ------------------------------------------------------------
    export function RenderInspector() {
        if (!HOST_ELEMENT) return;

        const asset = GetActiveAsset();
        HOST_ELEMENT.textContent = '';

        if (!asset) {
            HOST_ELEMENT.appendChild(Na__Inspector__El('p', 'na-inspector__empty',
                'Select an asset to inspect it.'));
            return;
        }

        if (asset.status === 'failed') {
            const section = Na__Inspector__Section('Load failed');
            section.appendChild(Na__Inspector__El('p', 'na-inspector__error', asset.error || 'Unknown error.'));
            HOST_ELEMENT.appendChild(section);
            return;
        }

        // -- Revit route: metadata schedule, no geometry -----------------------
        if (asset.status === 'auditOnly' && asset.metadata && asset.metadata.containerStreams) {
            HOST_ELEMENT.appendChild(Na__Inspector__BuildRevitHeader(asset.metadata));
            HOST_ELEMENT.appendChild(Na__Inspector__BuildScheduleTable(asset.metadata.schedule));
            if (asset.warnings && asset.warnings.length > 0) {
                HOST_ELEMENT.appendChild(Na__Inspector__BuildWarnings(asset.warnings));
            }
            return;
        }

        // -- Geometry route: provenance then audit -----------------------------
        HOST_ELEMENT.appendChild(Na__Inspector__BuildProvenance(asset));

        if (asset.audit) {
            HOST_ELEMENT.appendChild(Na__Inspector__BuildAudit(asset.audit));
        }

        if (asset.warnings && asset.warnings.length > 0) {
            HOST_ELEMENT.appendChild(Na__Inspector__BuildWarnings(asset.warnings));
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Mount the Inspector onto a Host Element
    // ------------------------------------------------------------
    export function MountInspector(hostElement) {
        HOST_ELEMENT = hostElement;

        Subscribe(EVENTS.ASSET_SELECTED,  RenderInspector);
        Subscribe(EVENTS.AUDIT_COMPLETED, RenderInspector);
        Subscribe(EVENTS.LOAD_FAILED,     RenderInspector);

        RenderInspector();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
