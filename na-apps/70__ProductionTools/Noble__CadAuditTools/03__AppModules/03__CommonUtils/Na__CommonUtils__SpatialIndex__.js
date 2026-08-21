// =============================================================================
// NOBLE CAD AUDIT TOOLS - SPATIAL INDEX
// =============================================================================
//
// FILE      : Na__CommonUtils__SpatialIndex__.js
// NAMESPACE : CadAuditTools.CommonUtils
// MODULE    : SpatialIndex
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Uniform-grid spatial index over loaded entities so selection and
//             hit-testing stop scanning the whole drawing on every interaction
// CREATED   : 19-Aug-2026
//
// DESCRIPTION:
// Click-select, box-select, and lasso-select all used to walk EVERY entity in
// the drawing on every single interaction. On a 230,000-entity file that is a
// quarter of a million bounding-box tests per click — the reason selection felt
// sluggish on large drawings regardless of how fast the file loaded.
//
// This index buckets entities into a uniform grid keyed on their bounding
// boxes, so a query only ever touches the entities near the query area.
//
// GRID SIZING:
// Cell size is derived from the drawing extent (~256 cells across the longest
// side), matching the approach already used by the dimension SnapEngine.
//
// OVERSIZED ENTITIES:
// A border line or site boundary can span the whole drawing. Inserting it into
// every cell it covers would bloat the index and slow every query, so any
// entity covering more than _MAX_CELLS_PER_ENTITY cells goes into an "always
// consider" list that every query includes. In practice that list is tiny.
//
// UNIT PARTS:
// Selection works in UNITS (an INSERT and its exploded children are one unit).
// Window mode needs to test EVERY part of a candidate unit — including parts
// that fall outside the query rectangle — or a unit would be wrongly reported
// as fully enclosed. The index therefore also carries a unitHandle -> parts map
// so a caller can widen from "parts near the rectangle" to "all parts of the
// units near the rectangle" without touching the rest of the drawing.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Aug-2026 - Version 0.1.0
// - Initial release — uniform grid, oversized-entity list, unit parts map.
//
// =============================================================================

import { Na__Geom__GetEntityBoundingBox } from './Na__CommonUtils__GeometryHelpers__.js';


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    const _GRID_DIVISIONS        = 256;                                  // <-- Target cells across the drawing's longest side
    const _MAX_CELLS_PER_ENTITY  = 64;                                   // <-- Beyond this an entity is treated as oversized

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | SpatialIndex Class
// -----------------------------------------------------------------------------

    export class Na__CommonUtils__SpatialIndex {

        // SUB FUNCTION | Constructor
        // ------------------------------------------------------------
        constructor() {
            this._grid      = new Map();                                 // <-- Map<cellKey, entity[]>
            this._oversized = [];                                        // <-- Entities spanning too many cells
            this._unitParts = new Map();                                 // <-- Map<unitHandle, entity[]>
            this._cellSize  = 0;
            this._ready     = false;
        }
        // ------------------------------------------------------------


        // FUNCTION | Build the Index from an Entity Array
        // ------------------------------------------------------------
        Na__SpatialIndex__Build(entities) {
            this._grid      = new Map();
            this._oversized = [];
            this._unitParts = new Map();
            this._ready     = false;

            if (!entities || entities.length === 0) return;

            // PASS 1 — bounding boxes, drawing extent, and the unit parts map
            const boxes = new Array(entities.length);
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

            for (let i = 0; i < entities.length; i++) {
                const entity     = entities[i];
                const unitHandle = entity.parentHandle || entity.handle;

                let parts = this._unitParts.get(unitHandle);
                if (!parts) { parts = []; this._unitParts.set(unitHandle, parts); }
                parts.push(entity);

                const bbox = Na__Geom__GetEntityBoundingBox(entity);
                boxes[i]   = bbox;
                if (!bbox) continue;

                if (bbox.minX < minX) minX = bbox.minX;
                if (bbox.minY < minY) minY = bbox.minY;
                if (bbox.maxX > maxX) maxX = bbox.maxX;
                if (bbox.maxY > maxY) maxY = bbox.maxY;
            }

            if (!isFinite(minX)) return;                                 // <-- No entity had usable geometry

            const extent   = Math.max(maxX - minX, maxY - minY) || 1;
            this._cellSize = extent / _GRID_DIVISIONS;
            this._originX  = minX;
            this._originY  = minY;

            // PASS 2 — bucket every entity into the cells its bbox covers
            for (let i = 0; i < entities.length; i++) {
                const bbox = boxes[i];
                if (!bbox) continue;

                const c0 = this._cellCoord(bbox.minX, bbox.minY);
                const c1 = this._cellCoord(bbox.maxX, bbox.maxY);
                const cellCount = (c1.cx - c0.cx + 1) * (c1.cy - c0.cy + 1);

                if (cellCount > _MAX_CELLS_PER_ENTITY) {
                    this._oversized.push(entities[i]);                   // <-- Spans the drawing: always a candidate
                    continue;
                }

                for (let cx = c0.cx; cx <= c1.cx; cx++) {
                    for (let cy = c0.cy; cy <= c1.cy; cy++) {
                        const key  = `${cx}:${cy}`;
                        let bucket = this._grid.get(key);
                        if (!bucket) { bucket = []; this._grid.set(key, bucket); }
                        bucket.push(entities[i]);
                    }
                }
            }

            this._ready = true;
            console.log(`[Na__SpatialIndex] Indexed ${entities.length} entities — `
                      + `${this._grid.size} cells, ${this._oversized.length} oversized, `
                      + `${this._unitParts.size} units`);
        }
        // ------------------------------------------------------------


        // FUNCTION | Is the Index Usable?
        // ------------------------------------------------------------
        Na__SpatialIndex__IsReady() {
            return this._ready;
        }
        // ------------------------------------------------------------


        // FUNCTION | Candidate Entities Overlapping a Rectangle
        // ------------------------------------------------------------
        Na__SpatialIndex__QueryRect(rect) {
            if (!this._ready) return null;                               // <-- Caller falls back to a full scan

            const found = new Set(this._oversized);
            const c0    = this._cellCoord(rect.minX, rect.minY);
            const c1    = this._cellCoord(rect.maxX, rect.maxY);

            for (let cx = c0.cx; cx <= c1.cx; cx++) {
                for (let cy = c0.cy; cy <= c1.cy; cy++) {
                    const bucket = this._grid.get(`${cx}:${cy}`);
                    if (!bucket) continue;
                    for (let i = 0; i < bucket.length; i++) found.add(bucket[i]);
                }
            }
            return found;
        }
        // ------------------------------------------------------------


        // FUNCTION | Candidate Entities Near a Point (Within a Tolerance)
        // ------------------------------------------------------------
        Na__SpatialIndex__QueryPoint(x, y, tolerance) {
            return this.Na__SpatialIndex__QueryRect({
                minX : x - tolerance, minY : y - tolerance,
                maxX : x + tolerance, maxY : y + tolerance,
            });
        }
        // ------------------------------------------------------------


        // FUNCTION | Every Part of Every Unit Represented in a Candidate Set
        // ------------------------------------------------------------
        // Widens "parts near the query area" to "ALL parts of the units near the
        // query area". Window-mode selection needs this: a unit is only fully
        // enclosed if none of its parts sits outside, including the parts the
        // rectangle never touched.
        Na__SpatialIndex__ExpandToWholeUnits(candidates) {
            if (!candidates) return null;

            const unitHandles = new Set();
            candidates.forEach((entity) => {
                unitHandles.add(entity.parentHandle || entity.handle);
            });

            const expanded = new Set();
            unitHandles.forEach((handle) => {
                const parts = this._unitParts.get(handle);
                if (parts) parts.forEach((part) => expanded.add(part));
            });
            return expanded;
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Map a Model-Space Point to Grid Cell Coordinates
        // ------------------------------------------------------------
        _cellCoord(x, y) {
            const size = this._cellSize || 1;
            return {
                cx : Math.floor((x - this._originX) / size),
                cy : Math.floor((y - this._originY) / size),
            };
        }
        // ------------------------------------------------------------

    }

// endregion -------------------------------------------------------------------
