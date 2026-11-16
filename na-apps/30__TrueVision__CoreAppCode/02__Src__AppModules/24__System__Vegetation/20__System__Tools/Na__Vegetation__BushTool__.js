// =============================================================================
// TRUEVISION3D - VEGETATION - THE BUSH TOOL
// =============================================================================
//
// FILE       : Na__Vegetation__BushTool__.js
// NAMESPACE  : Na__VegBushTool
// MODULE     : System - Vegetation
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Brush plants onto the model from a palette
// CREATED    : 04-Nov-2026
//
// DESCRIPTION:
// - Adam, 04-Nov-2026: "Vegetation Bush tool, creates a pallette and you can assign
//   proibability for the items in the selection so you can mix and match and brush the
//   vegetation."
// - THE LEFT BUTTON PAINTS, so while this is armed the middle button orbits, as in SketchUp,
//   and the wheel still zooms. Alt, or the Erase toggle, takes plants away instead.
// - EACH PLANT IS DRAWN FROM THE PALETTE BY ITS PROBABILITY, evenly but not regularly spaced,
//   and set on the real surface under it. Too steep, or too close to another, and that spot
//   is passed over, so plants never stack. Same Height Only keeps a stroke on the surface it
//   started on: brushing a planter leaves the ground beside it alone.
// - WHILE PAINTING NEW PLANTS ARE PROXIES on the drawing layer, and they draw as lines on
//   release, so the stroke stays smooth however many there are: nothing is built and the
//   model is not rendered until then.
// - A STROKE IS ONE UNDO, and saves its plants as themselves (plan, D17): they depend on the
//   surface under the pointer at that moment.
// - A PATH'S PLANTS ARE NOT ERASED HERE. They would come straight back from its rules, so a
//   stroke leaves them and says so: edit the path, or bake it.
// - PLANT SCALE (Adam, 04-Nov-2026: "I would set a scale of 0.5") is the whole plant. Density and
//   Minimum spacing follow it by the same ratio, so half size is the same bed, smaller.
//
// FRAMES:
// - Picks are world metres, and everything saved is integer mm in three.js axes, once, here.
//
// - A SECTION OF THE VEGETATION PANEL (Adam, 06-Nov-2026: "we currently have multiple places for
//   creating things"). Its rows are drawn into the Brush Tool section on the left, not a panel of
//   its own on the right. It is armed only while that section is open, and Escape folds it.
//
// INTEGRATION:
// - Mounted by the Vegetation panel's Brush Tool section (../10__Ui__Panels/Na__Vegetation__AssetBrowser__.js).
// - @delegate: ./Na__Vegetation__ToolHost__.js
// - @delegate: ../01__Core__Engine/Na__Vegetation__BrushModel__.js
// - @delegate: ../10__Ui__Panels/Na__Vegetation__PaletteEditor__.js
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 24__System__Vegetation/20__System__Tools/Na__Vegetation__BushTool__.js (ValeVision3D v2.98.6)
// - Ported on     : 15-Nov-2026 for TrueVision3D v2.185.0
// - Parity        : identical (header, console prefix and the Entourage folder's number apart)
// - Divergences   : none in behaviour. Entourage is 28__System__Entourage in TrueVision (its 23
//                   is Scene Sync); the vegetation and entourage READMEs list what differs around it.
// - Back-port     : n/a (this IS the port).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 12-Nov-2026 - Version 1.4.0 (ValeVision3D v2.97.0)
// - A standard palette chosen sets the brush's plant scale, with density and spacing following.
//
// 06-Nov-2026 - Version 1.3.0 (ValeVision3D v2.91.0)
// - A section of the Vegetation panel: Mount draws into it, Escape folds it. Toggle opens that section.
//
// 05-Nov-2026 - Version 1.2.0 (ValeVision3D v2.89.0)
// - Called the Brush Tool on screen.
//
// 04-Nov-2026 - Version 1.1.0 (ValeVision3D v2.86.0)
// - Plant scale, with Density and Minimum spacing following. Proxies at the size a plant really
//   is. Density goes up to 20 per square metre, for small plants.
//
// 04-Nov-2026 - Version 1.0.0 (ValeVision3D v2.85.0)
// - Initial build: Stage 6 of ValeVision__PLAN__VegetationSystem__.md.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Engine, Data and Runtime
    // ------------------------------------------------------------
    import { Na__VegRand__Create } from '../01__Core__Engine/Na__Vegetation__Random__.js';
    import {
        Na__VegBrush__DrawItem,
        Na__VegBrush__CreateSpacing,
        Na__VegBrush__SpotInDisc,
        Na__VegBrush__MakePlop
    } from '../01__Core__Engine/Na__Vegetation__BrushModel__.js';
    import { Na__VegData__NextUid, Na__VegData__NextStrokeUid } from '../02__Core__Data/Na__Vegetation__SceneData__.js';
    import {
        Na__VegRun__GetSceneData,
        Na__VegRun__SyncPlants,
        Na__VegRun__PaletteItems,
        Na__VegRun__WantedPlants,
        Na__VegRun__EnsureRecipe,
        Na__VegRun__PaintProxy,
        Na__VegRun__PinInUse
    } from '../03__System__SceneLayer/Na__Vegetation__Runtime__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Panels and Tools
    // ------------------------------------------------------------
    import {
        Na__VegShell__El,
        Na__VegShell__Button,
        Na__VegShell__Slider,
        Na__VegShell__PlantScaleSlider,
        Na__VegShell__Tick,
        Na__VegShell__Choice,
        Na__VegShell__MarkChanged,
        Na__VegShell__BeforeChange,
        Na__VegShell__Toast,
        Na__VegShell__Prepare
    } from '../10__Ui__Panels/Na__Vegetation__PanelShell__.js';
    import {
        Na__VegPalUi__Ensure,
        Na__VegPalUi__Mount,
        Na__VegPalUi__SetCurrentUid
    } from '../10__Ui__Panels/Na__Vegetation__PaletteEditor__.js';
    import {
        Na__VegTools__Prepare,
        Na__VegTools__Arm,
        Na__VegTools__Disarm,
        Na__VegTools__Current,
        Na__VegTools__Repaint
    } from './Na__Vegetation__ToolHost__.js';
    import { Na__VegPick__AtPointer, Na__VegPick__Under } from './Na__Vegetation__SurfacePick__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and Variables
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Stroke's Pace
    // ------------------------------------------------------------
    const Na__VegBushTool__TICK_MS      = 30;                                 // <-- A pick no oftener than this
    const Na__VegBushTool__STEP_SHARE   = 0.25;                                // <-- Of the radius: how far the brush travels before it paints again
    const Na__VegBushTool__TRIES_A_PLANT = 6;                                  // <-- Spots tried for each plant owed, before it gives up for this stamp
    const Na__VegBushTool__SEED_RANGE   = 2147483647;
    const Na__VegBushTool__REACH_Y_MM   = 1800;                                // <-- A plant further above or below than this is not a neighbour: another storey
    const Na__VegBushTool__DENSITY_MAX  = 20;                                  // <-- Per square metre, for small plants
    const Na__VegBushTool__SPACING_MIN  = 100;
    // ------------------------------------------------------------

    // MODULE VARIABLES | What the Brush Is Doing
    // ------------------------------------------------------------
    const Na__VegBushTool__State = {
        context    : null,
        body       : null,
        fold       : null,                                                     // <-- Folds the Brush Tool section: what Escape does
        unmountPal : null,
        erase      : false,
        ringAt     : null,                                                     // <-- World metres under the pointer, and the ring is drawn there
        hoverAt    : 0,
        altHeld    : false,
        sliders    : {},                                                       // <-- The brush's sliders on the panel, by key
        stroke     : null                                                      // <-- { uid, plops, startY, last, owed, spacing, rng, erasing, items, tally, skippedPathPlants }
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Brush's Settings in the Project's Object
    // ------------------------------------------------------------
    function Na__VegBushTool__Brush() {
        return Na__VegRun__GetSceneData().Vegetation__SceneData__Tools.Vegetation__Tools__Brush;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Is This Press or Drag Erasing?
    // ------------------------------------------------------------
    function Na__VegBushTool__IsErasing(event) {
        return Na__VegBushTool__State.erase || (event && event.altKey === true);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | A Stroke
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Grid Holding Everything Already Planted
    // ------------------------------------------------------------
    function Na__VegBushTool__SpacingNow(brush) {
        const spacing = Na__VegBrush__CreateSpacing(brush.Vegetation__Brush__MinSpacingMm);
        Na__VegRun__WantedPlants().forEach((plop) => {
            const p = plop.Vegetation__Plop__PositionMm;
            spacing.add(p[0], p[1], p[2]);
        });
        return spacing;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Plant What Is Owed Round a Point
    // ------------------------------------------------------------
    function Na__VegBushTool__Stamp(stroke, centreMm) {
        const brush   = Na__VegBushTool__Brush();
        const radius  = brush.Vegetation__Brush__RadiusMm;
        const minGap  = brush.Vegetation__Brush__MinSpacingMm;
        const cosMax  = Math.cos((brush.Vegetation__Brush__MaxSlopeDeg * Math.PI) / 180);
        const sameH   = brush.Vegetation__Brush__SameHeightOnly === true;
        const heightT = brush.Vegetation__Brush__SameHeightMm;
        const sceneData = Na__VegRun__GetSceneData();

        while (stroke.owed >= 1) {
            let planted = false;
            for (let attempt = 0; attempt < Na__VegBushTool__TRIES_A_PLANT && !planted; attempt++) {
                const spot = Na__VegBrush__SpotInDisc(stroke.rng, radius);
                const xMm = centreMm[0] + spot.dx, zMm = centreMm[2] + spot.dz;
                const hit = Na__VegPick__Under(xMm / 1000, centreMm[1] / 1000, zMm / 1000);
                if (!hit || hit.normal.y < cosMax) continue;
                const yMm = hit.point.y * 1000;
                if (sameH && Math.abs(yMm - stroke.startY) > heightT) continue;
                if (!stroke.spacing.isFree(xMm, yMm, zMm, minGap, Na__VegBushTool__REACH_Y_MM)) continue;

                const item = Na__VegBrush__DrawItem(stroke.items, stroke.rng.next());
                if (!item || !item.recipe) break;
                const uid = Na__VegData__NextUid('A', sceneData.Vegetation__SceneData__Plops.concat(stroke.plops), 'Vegetation__Plop__Uid');
                stroke.plops.push(Na__VegBrush__MakePlop(item, [xMm, yMm, zMm], brush, stroke.rng, uid, stroke.uid));
                stroke.spacing.add(xMm, yMm, zMm);
                planted = true;
            }
            stroke.owed -= 1;                                                  // <-- Owed whether it landed or not: a full bed must not pile up debts
        }
        Na__VegTools__Repaint();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Take Out What the Brush Passes Over
    // ------------------------------------------------------------
    function Na__VegBushTool__EraseAt(stroke, centreMm) {
        const radius = Na__VegBushTool__Brush().Vegetation__Brush__RadiusMm;
        const radiusSq = radius * radius;
        const inRing = (p) => {
            const dx = p[0] - centreMm[0], dz = p[2] - centreMm[2];
            return dx * dx + dz * dz <= radiusSq && Math.abs(p[1] - centreMm[1]) <= Na__VegBushTool__REACH_Y_MM;
        };
        const sceneData = Na__VegRun__GetSceneData();
        const before = sceneData.Vegetation__SceneData__Plops.length;
        sceneData.Vegetation__SceneData__Plops = sceneData.Vegetation__SceneData__Plops.filter((plop) => !inRing(plop.Vegetation__Plop__PositionMm));
        if (sceneData.Vegetation__SceneData__Plops.length !== before) {
            stroke.changed = true;
            Na__VegRun__SyncPlants();
        }
        if (!stroke.skippedPathPlants) {
            stroke.skippedPathPlants = Na__VegRun__WantedPlants().some((plop) => plop.Vegetation__Plop__PathUid && inRing(plop.Vegetation__Plop__PositionMm));
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Brush Has Reached a New Point
    // ------------------------------------------------------------
    function Na__VegBushTool__AdvanceTo(stroke, event) {
        const hit = Na__VegPick__AtPointer(event.clientX, event.clientY);
        if (!hit) return;
        Na__VegBushTool__State.ringAt = hit.point;
        const centreMm = [hit.point.x * 1000, hit.point.y * 1000, hit.point.z * 1000];

        if (stroke.erasing) {
            Na__VegBushTool__EraseAt(stroke, centreMm);
            Na__VegTools__Repaint();
            return;
        }

        const brush  = Na__VegBushTool__Brush();
        const radius = brush.Vegetation__Brush__RadiusMm;
        const perMm2 = brush.Vegetation__Brush__DensityPerSquareM / 1000000;
        if (!stroke.last) {
            stroke.startY = centreMm[1];
            stroke.owed  += perMm2 * Math.PI * radius * radius;                // <-- The first stamp is the whole disc
        } else {
            const travelled = Math.hypot(centreMm[0] - stroke.last[0], centreMm[2] - stroke.last[2]);
            if (travelled < radius * Na__VegBushTool__STEP_SHARE) {
                Na__VegTools__Repaint();
                return;
            }
            stroke.owed += perMm2 * travelled * radius * 2;                    // <-- A swept band: only the new ground owes anything
        }
        stroke.last = centreMm;
        Na__VegBushTool__Stamp(stroke, centreMm);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Stroke Is Over: Plants Become Plants
    // ------------------------------------------------------------
    async function Na__VegBushTool__FinishStroke() {
        const state = Na__VegBushTool__State;
        const stroke = state.stroke;
        state.stroke = null;
        if (!stroke) return;

        if (stroke.erasing) {
            if (stroke.changed) Na__VegShell__MarkChanged();
            if (stroke.skippedPathPlants) {
                Na__VegShell__Toast('A path\'s plants come from its rules, so they stay. Edit the path in the Line Tool, or bake it into single plants.', false);
            }
            await Na__VegRun__SyncPlants();
            Na__VegTools__Repaint();
            return;
        }

        if (stroke.plops.length > 0) {
            Na__VegRun__GetSceneData().Vegetation__SceneData__Plops.push(...stroke.plops);
            Na__VegShell__MarkChanged();
            await Na__VegRun__PinInUse();
            await Na__VegRun__SyncPlants();
        }
        Na__VegTools__Repaint();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Tool on the Model
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | The Tool Itself
    // ------------------------------------------------------------
    const Na__VegBushTool__Tool = {
        name           : 'bush',
        cursor         : 'crosshair',
        paintsWithLeft : true,

        onPress(event) {
            const state = Na__VegBushTool__State;
            const brush = Na__VegBushTool__Brush();
            const items = Na__VegRun__PaletteItems(brush.Vegetation__Brush__PaletteUid).filter((item) => item.recipe && item.weight > 0);
            const erasing = Na__VegBushTool__IsErasing(event);
            if (!erasing && items.length === 0) {
                Na__VegShell__Toast('This palette has nothing to plant: give an item some probability.', true);
                return true;
            }

            Na__VegShell__BeforeChange('');
            const sceneData = Na__VegRun__GetSceneData();
            state.stroke = {
                uid     : Na__VegData__NextStrokeUid(sceneData.Vegetation__SceneData__Plops),
                plops   : [],
                startY  : 0,
                last    : null,
                owed    : 0,
                spacing : Na__VegBushTool__SpacingNow(brush),
                rng     : Na__VegRand__Create(Math.floor(Math.random() * Na__VegBushTool__SEED_RANGE)),
                erasing,
                items,
                changed : false,
                skippedPathPlants : false,
                tickAt  : 0
            };
            Na__VegBushTool__AdvanceTo(state.stroke, event);
            return true;                                                       // <-- Taken: the left button paints
        },

        onDrag(event) {
            const state = Na__VegBushTool__State;
            const stroke = state.stroke;
            if (!stroke) return;
            const now = performance.now();
            if (now - stroke.tickAt < Na__VegBushTool__TICK_MS) return;
            stroke.tickAt = now;
            Na__VegBushTool__AdvanceTo(stroke, event);
        },

        onRelease() {
            Na__VegBushTool__FinishStroke();
        },

        onHover(event) {
            const state = Na__VegBushTool__State;
            const now = performance.now();
            if (now - state.hoverAt < Na__VegBushTool__TICK_MS) return;
            state.hoverAt = now;
            state.altHeld = event.altKey === true;
            const hit = Na__VegPick__AtPointer(event.clientX, event.clientY);
            state.ringAt = hit ? hit.point : null;
            Na__VegTools__Repaint();
        },

        onKey(event) {
            if (event.key === 'Alt') {
                event.preventDefault();                                        // <-- Or the browser's menu takes the focus on release
                return false;
            }
            if (event.key === 'Escape') {
                const fold = Na__VegBushTool__State.fold;                    // <-- Stop brushing: its section folds, and the tool with it
                if (fold) fold();
                return true;
            }
            return false;
        },

        paint(pen) {
            const state = Na__VegBushTool__State;
            const stroke = state.stroke;
            if (stroke) {
                stroke.plops.forEach((plop) => Na__VegRun__PaintProxy(pen, plop));
            }
            if (state.ringAt) {
                const erasing = stroke ? stroke.erasing : (state.erase || state.altHeld);
                const radiusM = Na__VegBushTool__Brush().Vegetation__Brush__RadiusMm / 1000;
                pen.ring(state.ringAt.x, state.ringAt.y, state.ringAt.z, radiusM, { colour : erasing ? pen.ERASE : pen.LINE, width : 2 });
            }
        },

        onDisarm() {
            const state = Na__VegBushTool__State;
            if (state.stroke) Na__VegBushTool__FinishStroke();
            state.ringAt = null;
        }
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Panel
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | One Slider Over One of the Brush's Keys
    // ------------------------------------------------------------
    function Na__VegBushTool__BrushSlider(key, label, min, max, step, format, title) {
        const brush = Na__VegBushTool__Brush();
        const slider = Na__VegShell__Slider({
            label,
            min,
            max,
            step,
            title,
            value   : brush[key],
            format,
            onInput : (value) => {
                Na__VegShell__BeforeChange('brush-' + key);
                Na__VegBushTool__Brush()[key] = value;
                Na__VegShell__MarkChanged();
                Na__VegTools__Repaint();
            }
        });
        Na__VegBushTool__State.sliders[key] = slider;
        return slider.row;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Plant Scale Slider, with Density and Spacing Following
    // ------------------------------------------------------------
    // From where they stood when the slider was taken up, so a limit reached on the way
    // down is not carried back up.
    // ------------------------------------------------------------
    function Na__VegBushTool__PlantScaleRow() {
        const state = Na__VegBushTool__State;
        let from = null;
        return Na__VegShell__PlantScaleSlider({
            value   : Na__VegBushTool__Brush().Vegetation__Brush__PlantScale,
            title   : 'The whole plant: 0.50 is half the size in every way. Density and spacing follow, so the bed stays as full.',
            onInput : (value) => {
                const brush = Na__VegBushTool__Brush();
                if (!from) {
                    from = {
                        scale   : brush.Vegetation__Brush__PlantScale > 0 ? brush.Vegetation__Brush__PlantScale : 1,
                        density : brush.Vegetation__Brush__DensityPerSquareM,
                        spacing : brush.Vegetation__Brush__MinSpacingMm
                    };
                }
                const ratio = value / from.scale;
                Na__VegShell__BeforeChange('brush-plant-scale');
                brush.Vegetation__Brush__PlantScale = value;
                brush.Vegetation__Brush__DensityPerSquareM = Math.min(Na__VegBushTool__DENSITY_MAX, Math.round((from.density / (ratio * ratio)) * 10) / 10);
                brush.Vegetation__Brush__MinSpacingMm      = Math.max(Na__VegBushTool__SPACING_MIN, Math.round(from.spacing * ratio));
                state.sliders.Vegetation__Brush__DensityPerSquareM.setValue(brush.Vegetation__Brush__DensityPerSquareM);
                state.sliders.Vegetation__Brush__MinSpacingMm.setValue(brush.Vegetation__Brush__MinSpacingMm);
                Na__VegShell__MarkChanged();
            },
            onChange : () => { from = null; }
        }).row;
    }
    // ------------------------------------------------------------


    // FUNCTION | Draw the Panel's Rows
    // ------------------------------------------------------------
    function Na__VegBushTool__PaintPanel() {
        const state = Na__VegBushTool__State;
        const body = state.body;
        if (!body) return;
        if (state.unmountPal) { state.unmountPal(); state.unmountPal = null; }
        body.textContent = '';
        const brush = Na__VegBushTool__Brush();

        const mode = Na__VegShell__El('div', 'na-veg-row na-veg-row--between');
        mode.appendChild(Na__VegShell__Choice([['paint', 'Paint'], ['erase', 'Erase']], state.erase ? 'erase' : 'paint', (value) => {
            state.erase = value === 'erase';
            Na__VegTools__Repaint();
        }).row);
        body.appendChild(mode);
        body.appendChild(Na__VegShell__El('p', 'na-veg-panel__hint', 'Drag on the model to paint. Hold Alt to erase. The middle button orbits while this is open, and the wheel zooms. Escape stops brushing.'));

        body.appendChild(Na__VegShell__El('div', 'na-veg-panel__section', 'Palette'));
        const mix = Na__VegShell__El('div', '');
        body.appendChild(mix);
        if (brush.Vegetation__Brush__PaletteUid) Na__VegPalUi__SetCurrentUid(brush.Vegetation__Brush__PaletteUid);
        Na__VegPalUi__Mount({
            holder : mix,
            onPick : async (paletteUid, layout) => {
                const brush = Na__VegBushTool__Brush();
                brush.Vegetation__Brush__PaletteUid = paletteUid;
                if (layout) {
                    // A STANDARD PALETTE | Takes its plant scale, density and spacing following, as the slider does
                    const ratio = layout.plantScale / (brush.Vegetation__Brush__PlantScale > 0 ? brush.Vegetation__Brush__PlantScale : 1);
                    brush.Vegetation__Brush__PlantScale        = layout.plantScale;
                    brush.Vegetation__Brush__DensityPerSquareM = Math.min(Na__VegBushTool__DENSITY_MAX, Math.round((brush.Vegetation__Brush__DensityPerSquareM / (ratio * ratio)) * 10) / 10);
                    brush.Vegetation__Brush__MinSpacingMm      = Math.max(Na__VegBushTool__SPACING_MIN, Math.round(brush.Vegetation__Brush__MinSpacingMm * ratio));
                }
                Na__VegShell__MarkChanged();
                await Na__VegBushTool__ReadPaletteRecipes();
                if (layout) Na__VegBushTool__PaintPanel();                     // <-- The sliders show the new scale, density and spacing
            }
        }).then((unmount) => { state.unmountPal = unmount; });

        body.appendChild(Na__VegShell__El('div', 'na-veg-panel__section', 'Brush'));
        body.appendChild(Na__VegBushTool__PlantScaleRow());
        body.appendChild(Na__VegBushTool__BrushSlider('Vegetation__Brush__RadiusMm', 'Radius', 200, 4000, 50, (value) => Math.round(value) + ' mm'));
        body.appendChild(Na__VegBushTool__BrushSlider('Vegetation__Brush__DensityPerSquareM', 'Density', 0.1, Na__VegBushTool__DENSITY_MAX, 0.1, (value) => Number(value).toFixed(1) + ' per sq m'));

        const details = Na__VegShell__El('details', 'na-veg-advanced');
        details.appendChild(Na__VegShell__El('summary', 'na-veg-advanced__title', 'Advanced'));
        details.appendChild(Na__VegBushTool__BrushSlider('Vegetation__Brush__MinSpacingMm', 'Minimum spacing', 100, 3000, 50, (value) => Math.round(value) + ' mm', 'So plants never stack'));
        details.appendChild(Na__VegBushTool__BrushSlider('Vegetation__Brush__RotationVariationDeg', 'Rotation variation', 0, 180, 1, (value) => Math.round(value) + ' deg'));
        details.appendChild(Na__VegBushTool__BrushSlider('Vegetation__Brush__ScaleVariationPercent', 'Scale variation', 0, 40, 1, (value) => Math.round(value) + '%', 'Changes a plant\'s size, never its scallops'));
        details.appendChild(Na__VegBushTool__BrushSlider('Vegetation__Brush__MaxSlopeDeg', 'Max slope', 0, 80, 1, (value) => Math.round(value) + ' deg', 'A surface steeper than this takes no plants'));
        details.appendChild(Na__VegShell__Tick('Same height only', brush.Vegetation__Brush__SameHeightOnly === true, (checked) => {
            Na__VegBushTool__Brush().Vegetation__Brush__SameHeightOnly = checked;
            Na__VegShell__MarkChanged();
        }, 'A stroke stays on the surface it started on, so brushing a planter leaves the ground beside it alone').row);
        body.appendChild(details);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Palette's Recipes, So the First Press Has Them
    // ------------------------------------------------------------
    async function Na__VegBushTool__ReadPaletteRecipes() {
        const items = Na__VegRun__PaletteItems(Na__VegBushTool__Brush().Vegetation__Brush__PaletteUid);
        for (const item of items) await Na__VegRun__EnsureRecipe(item.assetId);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | An Undo Replaced the Object: Read It Again
    // ------------------------------------------------------------
    function Na__VegBushTool__OnObjectReplaced() {
        Na__VegBushTool__PaintPanel();
        Na__VegTools__Repaint();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Stop What the Section Was Doing
    // ------------------------------------------------------------
    function Na__VegBushTool__OnClose() {
        const state = Na__VegBushTool__State;
        if (state.unmountPal) { state.unmountPal(); state.unmountPal = null; }
        state.body = null;
        state.fold = null;
        window.removeEventListener('na-vegetation-object-replaced', Na__VegBushTool__OnObjectReplaced);
        if (Na__VegTools__Current() === Na__VegBushTool__Tool) Na__VegTools__Disarm();
    }
    // ------------------------------------------------------------


    // FUNCTION | Draw the Tool's Rows into Its Section, and Arm It on the Model
    // ------------------------------------------------------------
    // Called by the Vegetation panel when its Brush Tool section opens. controls.fold folds that
    // section, which is what Escape does. Returns what stops it.
    // ------------------------------------------------------------
    async function Na__VegBushTool__Mount(context, holder, controls) {
        await Na__VegShell__Prepare(context);
        await Na__VegTools__Prepare(context);
        const state = Na__VegBushTool__State;
        state.context = context;

        const palette = await Na__VegPalUi__Ensure();
        const brush = Na__VegBushTool__Brush();
        if (!brush.Vegetation__Brush__PaletteUid) brush.Vegetation__Brush__PaletteUid = palette;
        await Na__VegBushTool__ReadPaletteRecipes();

        state.body = holder;
        state.fold = controls && controls.fold ? controls.fold : null;
        window.removeEventListener('na-vegetation-object-replaced', Na__VegBushTool__OnObjectReplaced);
        window.addEventListener('na-vegetation-object-replaced', Na__VegBushTool__OnObjectReplaced);
        Na__VegTools__Arm(Na__VegBushTool__Tool);
        Na__VegBushTool__PaintPanel();
        return () => {
            if (state.body === holder) Na__VegBushTool__OnClose();
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Open the Brush Tool, or Fold It If It Is Open
    // ------------------------------------------------------------
    async function Na__VegBushTool__Toggle(context) {
        const panel = await import('../10__Ui__Panels/Na__Vegetation__AssetBrowser__.js');
        if (panel.Na__VegCards__CurrentSection() === 'brush') {
            panel.Na__VegCards__FoldSection('brush');
            return;
        }
        await panel.Na__VegCards__OpenOn(context, 'brush');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Bush Tool API
    // ------------------------------------------------------------
    export {
        Na__VegBushTool__Mount,
        Na__VegBushTool__Toggle
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
