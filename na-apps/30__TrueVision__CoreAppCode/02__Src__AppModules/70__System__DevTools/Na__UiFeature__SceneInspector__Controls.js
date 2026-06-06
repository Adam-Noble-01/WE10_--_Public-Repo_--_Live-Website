// =============================================================================
// TRUEVISION3D - DEV TOOLS - SCENE INSPECTOR CONTROLS
// =============================================================================
//
// FILE       : Na__UiFeature__SceneInspector__Controls.js
// NAMESPACE  : Na__UiFeature
// MODULE     : SceneInspector Controls
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : On-demand scene graph reporter for the Dev Tools panel
// CREATED    : 25-May-2026
//
// DESCRIPTION:
// - Provides a Scan Scene button in the Dev Tools panel that traverses the
//   live Three.js scene graph and renders a collapsible node tree.
// - Reports per-node type, name, visibility state, and mesh stats
//   (triangle + vertex counts) inline without mutating the scene.
// - Each node row has an interactive visibility dot that toggles the Three.js
//   node.visible property live and invalidates the render loop.
// - Hide All and Restore All bulk controls allow quickly isolating or
//   restoring the scene to its scanned state for per-object testing.
// - A filter input narrows the displayed tree to nodes matching the typed
//   name fragment, showing ancestor groups automatically.
// - Isolate Pair mode toggles paired mesh and linework siblings under the
//   same TrueVision category group.
// - Instance aggregation collapses siblings sharing a base name (stripping
//   TrueVision _IDxxxxxxx suffixes) into a single ×N row in both the DOM
//   tree and the exported text log.
// - Download .txt exports the full scene report as a timestamped text file.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 06-Jun-2026 - Version 1.1.0
// - Added instance aggregation: sibling nodes sharing a base name
//   (after stripping _IDxxxxxxx suffixes) are collapsed into one row
//   showing ×N count, total triangles, and a shared visibility dot.
//   Applies to both the DOM tree and the exported text log.
// - Added Download .txt button: exports the full concise + full report
//   as a timestamped TrueVision_SceneLog_*.txt file.
//
// 25-May-2026 - Version 1.0.0
// - Ported from ValeVision3D Scene Inspector and adapted for TrueVision.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Render Loop Invalidation
    // ------------------------------------------------------------
    import { Na__RenderLoop__RequestRender } from '../05__RenderPipeline/Na__RenderLoop__Invalidation.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | DOM IDs
    // ------------------------------------------------------------
    const Na__SceneInspector__ToggleId         = 'naSceneInspectorToggle';        // <-- Panel open/close button
    const Na__SceneInspector__PanelId          = 'naSceneInspectorPanel';         // <-- Collapsible panel container
    const Na__SceneInspector__StatsId          = 'naSceneInspectorStats';         // <-- Summary stats line
    const Na__SceneInspector__TreeId           = 'naSceneInspectorTree';          // <-- Tree scroll container
    const Na__SceneInspector__ScanBtnId        = 'naSceneInspectorScanBtn';       // <-- Scan trigger button
    const Na__SceneInspector__FilterId         = 'naSceneInspectorFilter';        // <-- Name filter input
    const Na__SceneInspector__HideAllBtnId     = 'naSceneInspectorHideAll';       // <-- Hide all nodes button
    const Na__SceneInspector__RestoreAllBtnId  = 'naSceneInspectorRestoreAll';    // <-- Restore all nodes button
    const Na__SceneInspector__IsolatePairBtnId = 'naSceneInspectorIsolatePair';   // <-- Pair mode toggle
    const Na__SceneInspector__CopyTreeBtnId     = 'naSceneInspectorCopyTree';      // <-- Copy tree button
    const Na__SceneInspector__DownloadBtnId    = 'naSceneInspectorDownloadTree';  // <-- Download .txt button
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Asset Category Group Name Pattern
    // ------------------------------------------------------------
    const Na__SceneInspector__CategoryPattern    = /^(?:TrueVision|Storey)__\w+/; // <-- Matches TrueVision and Storey category groups
    const Na__SceneInspector__DefaultExpandDepth = 3;                             // <-- Expand down to model roots by default
    const Na__SceneInspector__AggregationMin     = 2;                             // <-- Minimum siblings to trigger aggregation
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Type Badge Labels and Families
    // ------------------------------------------------------------
    const Na__SceneInspector__TypeFamilies = {
        Mesh               : 'mesh',
        SkinnedMesh        : 'mesh',
        Scene              : 'group',
        Group              : 'group',
        Object3D           : 'group',
        DirectionalLight   : 'light',
        AmbientLight       : 'light',
        PointLight         : 'light',
        SpotLight          : 'light',
        HemisphereLight    : 'light',
        LineSegments       : 'line',
        LineSegments2      : 'line',
        Line               : 'line',
        PerspectiveCamera  : 'camera',
        OrthographicCamera : 'camera'
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Node Registry and Visibility Snapshot
    // ------------------------------------------------------------
    let Na__SceneInspector__NodeRegistry       = [];
    let Na__SceneInspector__VisibilitySnapshot = {};
    let Na__SceneInspector__IsolatePairActive  = false;
    let Na__SceneInspector__LastScannedTree    = null;
    let Na__SceneInspector__IsInitialized      = false;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Scene Traversal and Stats Collection
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Classify Node Type Family
    // ------------------------------------------------------------
    function Na__SceneInspector__GetTypeFamily(node) {
        return Na__SceneInspector__TypeFamilies[node.type] || 'other';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Compute Mesh Triangle and Vertex Count
    // ------------------------------------------------------------
    function Na__SceneInspector__GetMeshStats(node) {
        if (!node.isMesh && !node.isSkinnedMesh) return null;

        const geometry = node.geometry;
        if (!geometry) return null;

        const positionAttribute = geometry.attributes && geometry.attributes.position;
        const vertexCount       = positionAttribute ? positionAttribute.count : 0;
        const triangleCount     = geometry.index
            ? Math.floor(geometry.index.count / 3)
            : Math.floor(vertexCount / 3);

        return { vertexCount, triangleCount };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build a Single Node Data Record
    // ------------------------------------------------------------
    function Na__SceneInspector__BuildNodeRecord(node) {
        const meshStats = Na__SceneInspector__GetMeshStats(node);

        return {
            uuid       : node.uuid,
            name       : node.name || '[unnamed]',
            type       : node.type || 'Object3D',
            family     : Na__SceneInspector__GetTypeFamily(node),
            visible    : node.visible,
            childCount : node.children ? node.children.length : 0,
            meshStats  : meshStats,
            nodeRef    : node,
            children   : []
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Recursively Walk Scene Children
    // ------------------------------------------------------------
    function Na__SceneInspector__WalkNode(node, stats) {
        const record = Na__SceneInspector__BuildNodeRecord(node);

        stats.totalNodes += 1;

        if (record.family === 'mesh') stats.totalMeshes += 1;
        if (record.family === 'light') stats.totalLights += 1;
        if (record.family === 'line') stats.totalLines += 1;

        if (record.meshStats) {
            stats.totalTriangles += record.meshStats.triangleCount;
            stats.totalVertices  += record.meshStats.vertexCount;
        }

        if (node.children && node.children.length > 0) {
            for (const child of node.children) {
                record.children.push(Na__SceneInspector__WalkNode(child, stats));
            }
        }

        return record;
    }
    // ------------------------------------------------------------


    // FUNCTION | Scan Scene
    // ------------------------------------------------------------
    function Na__SceneInspector__ScanScene(scene) {
        const stats = {
            totalNodes     : 0,
            totalMeshes    : 0,
            totalTriangles : 0,
            totalVertices  : 0,
            totalLights    : 0,
            totalLines     : 0
        };

        return {
            stats : stats,
            tree  : Na__SceneInspector__WalkNode(scene, stats)
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Instance Aggregation
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Extract Base Name by Stripping Instance ID Suffix
    // ------------------------------------------------------------
    // Strips TrueVision _IDxxxxxxx suffixes (instanced component node names)
    // and trims any resulting trailing underscores, giving a canonical base
    // name that all instances of the same definition share.
    // ------------------------------------------------------------
    function Na__SceneInspector__ExtractBaseName(name) {
        return name
            .replace(/_ID\d+$/, '')    // <-- Strip TrueVision instancing suffix
            .replace(/[_]+$/, '');     // <-- Trim trailing underscores
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Decide Whether a Child Record Is Eligible for Aggregation
    // ------------------------------------------------------------
    // Two cases are aggregatable:
    //   1. TrueVision instanced nodes  — name ends with _IDxxxxxxx (GLB Builder suffix).
    //   2. Unnamed leaf nodes          — name is '[unnamed]' AND family is mesh or line,
    //                                    never group (unnamed group wrappers are distinct
    //                                    scene containers that must remain visible).
    // Everything else passes through as a singleton regardless of count.
    // ------------------------------------------------------------
    function Na__SceneInspector__IsAggregatable(record) {
        if (/_ID\d+$/.test(record.name)) return true;                          // <-- TrueVision instance ID
        if (record.name === '[unnamed]' && record.family !== 'group') return true; // <-- Unnamed leaf
        return false;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Group Sibling Records by Shared Base Name
    // ------------------------------------------------------------
    // Returns an ordered array of items preserving first-seen insertion order.
    // Each item is one of:
    //   { kind: 'single', record }
    //   { kind: 'group',  baseName, records, family, type }
    // Only aggregatable siblings (see IsAggregatable) are bucketed.
    // Non-aggregatable siblings are always emitted as singles.
    // Buckets below AggregationMin are demoted back to singles.
    // ------------------------------------------------------------
    function Na__SceneInspector__GroupSiblingsByBaseName(children) {
        const bucketMap    = new Map();      // <-- key → group item (mutated as records fill in)
        const orderedItems = [];             // <-- insertion-order list of single | group items

        for (const child of children) {
            if (!Na__SceneInspector__IsAggregatable(child)) {
                orderedItems.push({ kind: 'single', record: child });
                continue;
            }

            const base = Na__SceneInspector__ExtractBaseName(child.name);
            const key  = `${base}\x00${child.type}`;                           // <-- qualify by type to avoid Mesh/Group collision

            if (!bucketMap.has(key)) {
                const entry = {
                    kind     : 'group',
                    baseName : base,
                    records  : [],
                    family   : child.family,
                    type     : child.type
                };
                bucketMap.set(key, entry);
                orderedItems.push(entry);                                       // <-- same object reference, records filled below
            }

            bucketMap.get(key).records.push(child);
        }

        // Demote under-threshold groups back to individual singles
        const result = [];

        for (const item of orderedItems) {
            if (item.kind === 'single') {
                result.push(item);
            } else if (item.records.length >= Na__SceneInspector__AggregationMin) {
                result.push(item);
            } else {
                for (const r of item.records) result.push({ kind: 'single', record: r });
            }
        }

        return result;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Visibility State Management
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Snapshot Current Visibility from Registry
    // ------------------------------------------------------------
    function Na__SceneInspector__TakeVisibilitySnapshot() {
        Na__SceneInspector__VisibilitySnapshot = {};

        for (const entry of Na__SceneInspector__NodeRegistry) {
            Na__SceneInspector__VisibilitySnapshot[entry.uuid] = entry.nodeRef.visible;
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Sync Dot Element State
    // ------------------------------------------------------------
    function Na__SceneInspector__SyncDotElement(dotEl, isVisible) {
        if (!dotEl) return;

        dotEl.className = `na-scene-inspector__dot na-scene-inspector__dot--${isVisible ? 'visible' : 'hidden'}`;
        dotEl.title     = isVisible ? 'Click to hide' : 'Click to show';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Apply a Visibility Map to All Registered Nodes
    // ------------------------------------------------------------
    function Na__SceneInspector__ApplyVisibilityToAll(visibleMap) {
        for (const entry of Na__SceneInspector__NodeRegistry) {
            const isVisible = Object.prototype.hasOwnProperty.call(visibleMap, entry.uuid)
                ? visibleMap[entry.uuid]
                : false;

            entry.nodeRef.visible = isVisible;
            Na__SceneInspector__SyncDotElement(entry.dotEl, isVisible);
        }

        Na__RenderLoop__RequestRender();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Find TrueVision Category Group Ancestor
    // ------------------------------------------------------------
    function Na__SceneInspector__FindCategoryGroup(nodeRef) {
        let current = nodeRef.parent;

        while (current) {
            if (current.name && Na__SceneInspector__CategoryPattern.test(current.name)) {
                return current;
            }

            current = current.parent;
        }

        return null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Get Pair Siblings
    // ------------------------------------------------------------
    function Na__SceneInspector__GetPairSiblings(nodeRef, categoryGroup) {
        let branchRoot = nodeRef;

        while (branchRoot.parent && branchRoot.parent !== categoryGroup) {
            branchRoot = branchRoot.parent;
        }

        return categoryGroup.children.filter(child => child !== branchRoot);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Toggle Pair Siblings and Sync Their Dot Elements
    // ------------------------------------------------------------
    function Na__SceneInspector__TogglePairSiblings(nodeRef, isVisible) {
        const categoryGroup = Na__SceneInspector__FindCategoryGroup(nodeRef);
        if (!categoryGroup) return;

        const siblings = Na__SceneInspector__GetPairSiblings(nodeRef, categoryGroup);

        for (const sibling of siblings) {
            sibling.visible = isVisible;

            const entry = Na__SceneInspector__NodeRegistry.find(registryEntry => registryEntry.uuid === sibling.uuid);
            if (entry) {
                Na__SceneInspector__SyncDotElement(entry.dotEl, isVisible);
            }
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | DOM Tree Rendering
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Format Number with Thousands Separator
    // ------------------------------------------------------------
    function Na__SceneInspector__FormatNumber(value) {
        return value.toLocaleString();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Render Stats Summary Line
    // ------------------------------------------------------------
    function Na__SceneInspector__RenderStats(statsEl, stats) {
        if (!statsEl) return;

        statsEl.innerHTML = [
            `<span class="na-scene-inspector__stat-item"><strong>${Na__SceneInspector__FormatNumber(stats.totalNodes)}</strong> nodes</span>`,
            `<span class="na-scene-inspector__stat-item"><strong>${Na__SceneInspector__FormatNumber(stats.totalMeshes)}</strong> meshes</span>`,
            `<span class="na-scene-inspector__stat-item"><strong>${Na__SceneInspector__FormatNumber(stats.totalTriangles)}</strong> tris</span>`,
            `<span class="na-scene-inspector__stat-item"><strong>${Na__SceneInspector__FormatNumber(stats.totalLines)}</strong> lines</span>`,
            `<span class="na-scene-inspector__stat-item"><strong>${Na__SceneInspector__FormatNumber(stats.totalLights)}</strong> lights</span>`
        ].join('');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build Single Node Row Element
    // ------------------------------------------------------------
    function Na__SceneInspector__BuildNodeRowEl(record) {
        const row = document.createElement('div');
        row.className = 'na-scene-inspector__row';

        const indent = document.createElement('span');
        indent.className = 'na-scene-inspector__indent';
        row.appendChild(indent);

        const toggle = document.createElement('span');
        toggle.className = 'na-scene-inspector__toggle';
        toggle.textContent = record.children.length > 0 ? '▾' : '';
        toggle.setAttribute('aria-hidden', 'true');
        row.appendChild(toggle);

        const dot = document.createElement('span');
        Na__SceneInspector__SyncDotElement(dot, record.visible);
        dot.addEventListener('click', (event) => {
            event.stopPropagation();

            const newVisible       = !record.nodeRef.visible;
            record.nodeRef.visible = newVisible;

            Na__SceneInspector__SyncDotElement(dot, newVisible);

            if (Na__SceneInspector__IsolatePairActive) {
                Na__SceneInspector__TogglePairSiblings(record.nodeRef, newVisible);
            }

            Na__RenderLoop__RequestRender();
        });
        row.appendChild(dot);

        const badge = document.createElement('span');
        badge.className = `na-scene-inspector__badge na-scene-inspector__badge--${record.family}`;
        badge.textContent = record.type;
        row.appendChild(badge);

        const name = document.createElement('span');
        name.className = 'na-scene-inspector__name';
        name.textContent = record.name;
        name.title = record.name;
        row.appendChild(name);

        const count = Na__SceneInspector__BuildNodeCountEl(record);
        if (count) row.appendChild(count);

        return { rowEl: row, dotEl: dot };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build Node Count Element
    // ------------------------------------------------------------
    function Na__SceneInspector__BuildNodeCountEl(record) {
        if (!record.meshStats && record.children.length === 0) return null;

        const count = document.createElement('span');
        count.className = 'na-scene-inspector__count';

        if (record.meshStats) {
            count.textContent = `${Na__SceneInspector__FormatNumber(record.meshStats.triangleCount)}t`;
            count.title       = `${Na__SceneInspector__FormatNumber(record.meshStats.triangleCount)} triangles, ${Na__SceneInspector__FormatNumber(record.meshStats.vertexCount)} vertices`;
            return count;
        }

        count.textContent = `${record.children.length}`;
        count.title       = `${record.children.length} direct children`;
        return count;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build Aggregated Instance Group Row Element
    // ------------------------------------------------------------
    // Produces a single non-expandable row representing N sibling nodes
    // that share the same base name. The visibility dot toggles all of them.
    // All underlying nodeRefs are registered in the NodeRegistry sharing
    // the same wrapperEl and dotEl so Hide All / Restore All still work.
    // ------------------------------------------------------------
    function Na__SceneInspector__BuildAggregatedGroupNode(item, depth) {
        const { baseName, records, family, type } = item;

        const wrapper = document.createElement('div');
        wrapper.className        = 'na-scene-inspector__node';
        wrapper.dataset.nodeName = baseName.toLowerCase();

        const row = document.createElement('div');
        row.className = 'na-scene-inspector__row';

        const indent = document.createElement('span');
        indent.className             = 'na-scene-inspector__indent';
        indent.style.paddingLeft     = `${depth * 12}px`;
        row.appendChild(indent);

        const toggle = document.createElement('span');          // <-- No expand arrow for aggregated leaf group
        toggle.className = 'na-scene-inspector__toggle';
        row.appendChild(toggle);

        const allVisible = records.every(r => r.visible);
        const dot = document.createElement('span');
        Na__SceneInspector__SyncDotElement(dot, allVisible);
        dot.addEventListener('click', (event) => {
            event.stopPropagation();
            const newVisible = !records[0].nodeRef.visible;
            for (const r of records) r.nodeRef.visible = newVisible;
            Na__SceneInspector__SyncDotElement(dot, newVisible);
            Na__RenderLoop__RequestRender();
        });
        row.appendChild(dot);

        const badge = document.createElement('span');
        badge.className   = `na-scene-inspector__badge na-scene-inspector__badge--${family}`;
        badge.textContent = type;
        row.appendChild(badge);

        const nameEl = document.createElement('span');
        nameEl.className   = 'na-scene-inspector__name';
        nameEl.textContent = baseName || '[unnamed]';
        nameEl.title       = baseName || '[unnamed]';
        row.appendChild(nameEl);

        const totalTris = records.reduce((sum, r) => sum + (r.meshStats?.triangleCount ?? 0), 0);
        const countEl   = document.createElement('span');
        countEl.className   = 'na-scene-inspector__count na-scene-inspector__count--instances';
        countEl.textContent = `×${Na__SceneInspector__FormatNumber(records.length)}`;
        countEl.title       = `${Na__SceneInspector__FormatNumber(records.length)} instances`
            + (totalTris > 0 ? `  |  ${Na__SceneInspector__FormatNumber(totalTris)} total triangles` : '');
        row.appendChild(countEl);

        wrapper.appendChild(row);

        for (const r of records) {                              // <-- Register each underlying node
            Na__SceneInspector__NodeRegistry.push({
                uuid      : r.uuid,
                nodeRef   : r.nodeRef,
                dotEl     : dot,
                wrapperEl : wrapper,
                name      : baseName.toLowerCase()
            });
        }

        return wrapper;
    }
    // ------------------------------------------------------------


    // FUNCTION | Recursively Build DOM Tree from Record
    // ------------------------------------------------------------
    function Na__SceneInspector__BuildDomTree(record, depth, defaultExpandDepth) {
        const wrapper = document.createElement('div');
        wrapper.className        = 'na-scene-inspector__node';
        wrapper.dataset.nodeName = record.name.toLowerCase();

        const { rowEl, dotEl } = Na__SceneInspector__BuildNodeRowEl(record);

        const indentEl = rowEl.querySelector('.na-scene-inspector__indent');
        if (indentEl) indentEl.style.paddingLeft = `${depth * 12}px`;

        wrapper.appendChild(rowEl);

        Na__SceneInspector__NodeRegistry.push({
            uuid      : record.uuid,
            nodeRef   : record.nodeRef,
            dotEl     : dotEl,
            wrapperEl : wrapper,
            name      : record.name.toLowerCase()
        });

        if (record.children.length > 0) {
            const childContainer = document.createElement('div');
            childContainer.className = 'na-scene-inspector__children';

            if (depth >= defaultExpandDepth) {
                childContainer.style.display = 'none';
                rowEl.querySelector('.na-scene-inspector__toggle').textContent = '▸';
            }

            const groups = Na__SceneInspector__GroupSiblingsByBaseName(record.children); // <-- Aggregate siblings

            for (const item of groups) {
                if (item.kind === 'single') {
                    childContainer.appendChild(Na__SceneInspector__BuildDomTree(item.record, depth + 1, defaultExpandDepth));
                } else {
                    childContainer.appendChild(Na__SceneInspector__BuildAggregatedGroupNode(item, depth + 1));
                }
            }

            wrapper.appendChild(childContainer);
            rowEl.style.cursor = 'pointer';
            rowEl.addEventListener('click', () => {
                const isHidden = childContainer.style.display === 'none';
                childContainer.style.display = isHidden ? '' : 'none';
                rowEl.querySelector('.na-scene-inspector__toggle').textContent = isHidden ? '▾' : '▸';
            });
        }

        return wrapper;
    }
    // ------------------------------------------------------------


    // FUNCTION | Render Full Tree into DOM Container
    // ------------------------------------------------------------
    function Na__SceneInspector__RenderTree(treeEl, tree) {
        if (!treeEl) return;

        treeEl.innerHTML = '';
        Na__SceneInspector__NodeRegistry = [];

        treeEl.appendChild(Na__SceneInspector__BuildDomTree(
            tree,
            0,
            Na__SceneInspector__DefaultExpandDepth
        ));

        Na__SceneInspector__TakeVisibilitySnapshot();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Filter Logic
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Reveal All Ancestors of a Matched Node Wrapper
    // ------------------------------------------------------------
    function Na__SceneInspector__RevealAncestors(el) {
        let current = el.parentElement;

        while (current) {
            if (current.classList.contains('na-scene-inspector__node')) current.style.display = '';
            if (current.classList.contains('na-scene-inspector__children')) current.style.display = '';

            current = current.parentElement;
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Apply Filter to Node Registry
    // ------------------------------------------------------------
    function Na__SceneInspector__ApplyFilter(query) {
        const term = query.trim().toLowerCase();

        for (const entry of Na__SceneInspector__NodeRegistry) {
            entry.wrapperEl.style.display = term ? 'none' : '';
        }

        if (!term) return;

        for (const entry of Na__SceneInspector__NodeRegistry) {
            if (entry.name.includes(term)) {
                entry.wrapperEl.style.display = '';
                Na__SceneInspector__RevealAncestors(entry.wrapperEl);
            }
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Copy Tree to Clipboard
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build Concise Text Line for a Single Node
    // ------------------------------------------------------------
    function Na__SceneInspector__BuildNodeTextLineConcise(record, depth) {
        const indent = '    '.repeat(Math.max(0, depth - 1));
        return `${indent}${record.type} ${record.name}`;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build Full Text Line for a Single Node
    // ------------------------------------------------------------
    function Na__SceneInspector__BuildNodeTextLineFull(record, depth) {
        const indent     = '  '.repeat(depth);
        const visibleStr = `Visible = ${record.visible ? 'True' : 'False'}`;
        const triSegment = record.meshStats
            ? `  |  ${Na__SceneInspector__FormatNumber(record.meshStats.triangleCount)} triangles`
            : '';

        return `${indent}${record.type} ${record.name}${triSegment}  |  ${visibleStr}`;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build Aggregated Text Line for a Sibling Group
    // ------------------------------------------------------------
    // Synthesises a single record-like object that lineBuilder can consume,
    // representing N aggregated siblings as one line in the text output.
    // ------------------------------------------------------------
    function Na__SceneInspector__BuildAggregatedTextLine(item, depth, lineBuilder) {
        const sample    = item.records[0];
        const totalTris = item.records.reduce((sum, r) => sum + (r.meshStats?.triangleCount ?? 0), 0);

        const syntheticRecord = {
            uuid      : sample.uuid,
            name      : `${item.baseName || '[unnamed]'} [×${item.records.length}]`,
            type      : item.type,
            family    : item.family,
            visible   : sample.visible,
            childCount: 0,
            meshStats : totalTris > 0 ? { triangleCount: totalTris, vertexCount: 0 } : null,
            nodeRef   : sample.nodeRef,
            children  : []
        };

        return lineBuilder(syntheticRecord, depth);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Recursively Build Plain-Text Tree Lines (with aggregation)
    // ------------------------------------------------------------
    function Na__SceneInspector__WalkTreeToText(record, depth, lines, lineBuilder) {
        lines.push(lineBuilder(record, depth));

        if (record.children.length === 0) return;

        const groups = Na__SceneInspector__GroupSiblingsByBaseName(record.children); // <-- Aggregate siblings

        for (const item of groups) {
            if (item.kind === 'single') {
                Na__SceneInspector__WalkTreeToText(item.record, depth + 1, lines, lineBuilder);
            } else {
                lines.push(Na__SceneInspector__BuildAggregatedTextLine(item, depth + 1, lineBuilder));
            }
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build Report Text String
    // ------------------------------------------------------------
    function Na__SceneInspector__BuildReportText() {
        const conciseLines = [];
        const fullLines    = [];
        const divider      = '=======================================';

        Na__SceneInspector__WalkTreeToText(Na__SceneInspector__LastScannedTree, 0, conciseLines, Na__SceneInspector__BuildNodeTextLineConcise);
        Na__SceneInspector__WalkTreeToText(Na__SceneInspector__LastScannedTree, 0, fullLines,    Na__SceneInspector__BuildNodeTextLineFull);

        return [
            '1. CONCISE REPORT',
            divider,
            conciseLines.join('\n'),
            divider,
            '',
            '2. FULL REPORT WITH STATES & STATISTICS',
            divider,
            fullLines.join('\n'),
            divider,
            'END'
        ].join('\n');
    }
    // ------------------------------------------------------------


    // FUNCTION | Copy Scene Tree to Clipboard
    // ------------------------------------------------------------
    function Na__SceneInspector__CopyTreeToClipboard(copyBtn) {
        if (!Na__SceneInspector__LastScannedTree) {
            Na__SceneInspector__SetTemporaryButtonText(copyBtn, 'No scan yet', 'Copy Tree');
            return;
        }

        navigator.clipboard.writeText(Na__SceneInspector__BuildReportText())
            .then(() => Na__SceneInspector__SetTemporaryButtonText(copyBtn, 'Copied!', 'Copy Tree'))
            .catch(() => Na__SceneInspector__SetTemporaryButtonText(copyBtn, 'Failed', 'Copy Tree'));
    }
    // ------------------------------------------------------------


    // FUNCTION | Download Scene Tree as .txt File
    // ------------------------------------------------------------
    function Na__SceneInspector__DownloadTree(downloadBtn) {
        if (!Na__SceneInspector__LastScannedTree) {
            Na__SceneInspector__SetTemporaryButtonText(downloadBtn, 'No scan yet', 'Download .txt');
            return;
        }

        const text      = Na__SceneInspector__BuildReportText();
        const timestamp = new Date().toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-');
        const filename  = `TrueVision_SceneLog_${timestamp}.txt`;

        const blob = new Blob([text], { type: 'text/plain' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);

        Na__SceneInspector__SetTemporaryButtonText(downloadBtn, 'Downloaded!', 'Download .txt');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Set Temporary Button Text
    // ------------------------------------------------------------
    function Na__SceneInspector__SetTemporaryButtonText(button, text, resetText) {
        if (!button) return;

        button.textContent = text;
        setTimeout(() => {
            button.textContent = resetText;
        }, 1500);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Panel Toggle and Initialization
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Wire Panel Open/Close Toggle
    // ------------------------------------------------------------
    function Na__SceneInspector__InitPanelToggle() {
        const toggleBtn = document.getElementById(Na__SceneInspector__ToggleId);
        const panel     = document.getElementById(Na__SceneInspector__PanelId);
        if (!toggleBtn || !panel) return;

        toggleBtn.addEventListener('click', () => {
            const isOpen = panel.classList.contains('is-open');

            panel.classList.toggle('is-open', !isOpen);
            toggleBtn.setAttribute('aria-expanded', String(!isOpen));
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Run Scene Scan and Render Result
    // ------------------------------------------------------------
    function Na__SceneInspector__RunScan(scene, elements) {
        if (!scene) {
            elements.statsEl.textContent = 'Scene not available.';
            return;
        }

        elements.scanBtn.textContent = 'Scanning...';
        elements.scanBtn.disabled    = true;

        const { stats, tree } = Na__SceneInspector__ScanScene(scene);

        Na__SceneInspector__RenderStats(elements.statsEl, stats);
        Na__SceneInspector__RenderTree(elements.treeEl, tree);
        Na__SceneInspector__LastScannedTree = tree;

        if (elements.filterEl) elements.filterEl.value = '';

        elements.scanBtn.textContent = 'Rescan';
        elements.scanBtn.disabled    = false;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Collect Scene Inspector DOM Elements
    // ------------------------------------------------------------
    function Na__SceneInspector__GetDomElements() {
        return {
            scanBtn        : document.getElementById(Na__SceneInspector__ScanBtnId),
            statsEl        : document.getElementById(Na__SceneInspector__StatsId),
            treeEl         : document.getElementById(Na__SceneInspector__TreeId),
            filterEl       : document.getElementById(Na__SceneInspector__FilterId),
            hideAllBtn     : document.getElementById(Na__SceneInspector__HideAllBtnId),
            restoreAllBtn  : document.getElementById(Na__SceneInspector__RestoreAllBtnId),
            isolatePairBtn : document.getElementById(Na__SceneInspector__IsolatePairBtnId),
            copyTreeBtn    : document.getElementById(Na__SceneInspector__CopyTreeBtnId),
            downloadBtn    : document.getElementById(Na__SceneInspector__DownloadBtnId)     // <-- Download .txt
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Initialize Scene Inspector Dev Tool
    // ------------------------------------------------------------
    function Na__UiFeature__InitializeSceneInspector(scene) {
        if (Na__SceneInspector__IsInitialized) return;

        Na__SceneInspector__InitPanelToggle();

        const elements = Na__SceneInspector__GetDomElements();
        if (!elements.scanBtn || !elements.statsEl || !elements.treeEl) return;

        elements.scanBtn.addEventListener('click', () => Na__SceneInspector__RunScan(scene, elements));

        if (elements.filterEl) {
            elements.filterEl.addEventListener('input', () => Na__SceneInspector__ApplyFilter(elements.filterEl.value));
        }

        if (elements.hideAllBtn) {
            elements.hideAllBtn.addEventListener('click', () => Na__SceneInspector__ApplyVisibilityToAll({}));
        }

        if (elements.restoreAllBtn) {
            elements.restoreAllBtn.addEventListener('click', () => Na__SceneInspector__ApplyVisibilityToAll(Na__SceneInspector__VisibilitySnapshot));
        }

        if (elements.isolatePairBtn) {
            elements.isolatePairBtn.addEventListener('click', () => {
                Na__SceneInspector__IsolatePairActive = !Na__SceneInspector__IsolatePairActive;
                elements.isolatePairBtn.classList.toggle('na-scene-inspector__toolbar-btn--active', Na__SceneInspector__IsolatePairActive);
                elements.isolatePairBtn.setAttribute('aria-pressed', String(Na__SceneInspector__IsolatePairActive));
            });
        }

        if (elements.copyTreeBtn) {
            elements.copyTreeBtn.addEventListener('click', () => Na__SceneInspector__CopyTreeToClipboard(elements.copyTreeBtn));
        }

        if (elements.downloadBtn) {
            elements.downloadBtn.addEventListener('click', () => Na__SceneInspector__DownloadTree(elements.downloadBtn));
        }

        Na__SceneInspector__IsInitialized = true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Scene Inspector API
    // ------------------------------------------------------------
    export {
        Na__UiFeature__InitializeSceneInspector
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
