// =============================================================================
// NOBLE ARCHITECTURE - ROOM SIZE COMPARATOR - PLAN DRAWING
// =============================================================================
//
// FILE    : MiniApp__SpacePlanningUtils__RoomSizeComparator__PlanDrawing__.js
// AUTHOR  : Adam Noble - Noble Architecture
// PURPOSE : Draw a room type's five size bands to scale as nested boxes from a
//           shared corner, with your room on top, and save it as a PNG
// CREATED : 16-Nov-2026
//
// - Drawn in screen pixels (not a scaled viewBox) so text and lines stay crisp
//   at any size; the controller redraws on resize.
// - Every colour, size and font is a presentation attribute, not CSS, so the
//   SVG serialises cleanly into the saved image.
// - Band boxes take the room type's typical plan shape (NaRoom__Aspect); only
//   their areas come from the data. Your room uses your length and width when
//   you give them.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Imports
// -----------------------------------------------------------------------------

// @delegate: ./MiniApp__SpacePlanningUtils__RoomSizeComparator__Units__.js
import {
    Na__RoomSizeComparator__FormatArea,
    Na__RoomSizeComparator__FormatDims,
    Na__RoomSizeComparator__FormatLength,
    Na__RoomSizeComparator__LengthToM
} from "./MiniApp__SpacePlanningUtils__RoomSizeComparator__Units__.js";

// @delegate: ./MiniApp__SpacePlanningUtils__RoomSizeComparator__RoomData__.js
import {
    Na__RoomSizeComparator__BandKeys,
    Na__RoomSizeComparator__BandLabel,
    Na__RoomSizeComparator__DimsForArea
} from "./MiniApp__SpacePlanningUtils__RoomSizeComparator__RoomData__.js";

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module-Level Variables
// -----------------------------------------------------------------------------

 const Na__SvgNs      = "http://www.w3.org/2000/svg";
 const Na__FontFamily = "'Open Sans', 'Segoe UI', Arial, sans-serif";

 const Na__ScaleBarMetres = [1, 2, 3, 4, 5, 10, 20, 50];
 const Na__ScaleBarFeet   = [2, 4, 5, 10, 20, 50, 100];

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | SVG Helpers
// -----------------------------------------------------------------------------

// HELPER FUNCTION | Create an SVG element with attributes
// ------------------------------------------------------------
function Na__RoomSizeComparator__SvgEl(Na__Tag, Na__Attrs = {}, Na__Parent = null) {
    const Na__El = document.createElementNS(Na__SvgNs, Na__Tag);
    Object.entries(Na__Attrs).forEach(([Na__Key, Na__Value]) => Na__El.setAttribute(Na__Key, String(Na__Value)));
    if (Na__Parent) Na__Parent.appendChild(Na__El);
    return Na__El;
}
// ------------------------------------------------------------


// HELPER FUNCTION | Text with a white halo so it reads over any fill
// ------------------------------------------------------------
function Na__RoomSizeComparator__SvgText(Na__Parent, Na__X, Na__Y, Na__Parts, Na__Attrs = {}) {
    const Na__Text = Na__RoomSizeComparator__SvgEl("text", {
        "x"               : Na__X,
        "y"               : Na__Y,
        "font-family"     : Na__FontFamily,
        "font-size"       : 12,
        "paint-order"     : "stroke",
        "stroke"          : "#ffffff",
        "stroke-width"    : 3,
        "stroke-linejoin" : "round",
        ...Na__Attrs
    }, Na__Parent);

    (Array.isArray(Na__Parts) ? Na__Parts : [{ Na__Text: Na__Parts }]).forEach((Na__Part) => {
        const Na__Span = Na__RoomSizeComparator__SvgEl("tspan", Na__Part.Na__Attrs || {}, Na__Text);
        Na__Span.textContent = Na__Part.Na__Text;
    });

    return Na__Text;
}
// ------------------------------------------------------------


// HELPER FUNCTION | Mix a colour with white (strength 1 = the colour itself)
// ------------------------------------------------------------
export function Na__RoomSizeComparator__Tint(Na__Hex, Na__Strength) {
    const Na__Clean = String(Na__Hex).replace("#", "");
    const Na__Rgb   = [0, 2, 4].map((Na__At) => Number.parseInt(Na__Clean.slice(Na__At, Na__At + 2), 16));
    const Na__Mixed = Na__Rgb.map((Na__C) => Math.round(255 - Na__Strength * (255 - Na__C)));
    return `#${Na__Mixed.map((Na__C) => Na__C.toString(16).padStart(2, "0")).join("")}`;
}
// ------------------------------------------------------------


// HELPER FUNCTION | Bounding boxes
// ------------------------------------------------------------
function Na__RoomSizeComparator__Box(Na__X, Na__Y, Na__W, Na__H) {
    return { x: Na__X, y: Na__Y, w: Na__W, h: Na__H };
}

function Na__RoomSizeComparator__BoxesOverlap(Na__A, Na__B, Na__Pad = 2) {
    return Na__A.x < Na__B.x + Na__B.w + Na__Pad && Na__B.x < Na__A.x + Na__A.w + Na__Pad
        && Na__A.y < Na__B.y + Na__B.h + Na__Pad && Na__B.y < Na__A.y + Na__A.h + Na__Pad;
}

function Na__RoomSizeComparator__BoxInside(Na__Inner, Na__Outer, Na__Pad = 0) {
    return Na__Inner.x >= Na__Outer.x + Na__Pad && Na__Inner.y >= Na__Outer.y + Na__Pad
        && Na__Inner.x + Na__Inner.w <= Na__Outer.x + Na__Outer.w - Na__Pad
        && Na__Inner.y + Na__Inner.h <= Na__Outer.y + Na__Outer.h - Na__Pad;
}

function Na__RoomSizeComparator__TextBox(Na__TextEl) {
    const Na__B = Na__TextEl.getBBox();
    return Na__RoomSizeComparator__Box(Na__B.x, Na__B.y, Na__B.width, Na__B.height);
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Scale Helpers
// -----------------------------------------------------------------------------

// FUNCTION | Grid step: the smallest tidy step that leaves room between lines
// ------------------------------------------------------------
function Na__RoomSizeComparator__PickGridStep(Na__Unit, Na__PxPerM, Na__DrawingConfig) {
    const Na__MinPx  = Number(Na__DrawingConfig.NaMiniApp__MinGridSpacingPx) || 18;
    const Na__Steps  = Na__Unit === "ft2"
        ? (Na__DrawingConfig.NaMiniApp__GridStepsFeet   || [1, 2, 5, 10, 20, 50])
        : (Na__DrawingConfig.NaMiniApp__GridStepsMetres || [0.5, 1, 2, 5, 10, 20]);

    for (const Na__Step of Na__Steps) {
        const Na__StepM = Na__RoomSizeComparator__LengthToM(Na__Step, Na__Unit);
        if (Na__StepM * Na__PxPerM >= Na__MinPx) {
            return { Na__StepM: Na__StepM, Na__Label: Na__Unit === "ft2" ? `${Na__Step} ft` : `${Na__Step} m` };
        }
    }

    const Na__Last = Na__Steps[Na__Steps.length - 1];
    return { Na__StepM: Na__RoomSizeComparator__LengthToM(Na__Last, Na__Unit), Na__Label: Na__Unit === "ft2" ? `${Na__Last} ft` : `${Na__Last} m` };
}
// ------------------------------------------------------------


// FUNCTION | Scale bar: the longest tidy length that fits the space given
// ------------------------------------------------------------
function Na__RoomSizeComparator__PickScaleBar(Na__Unit, Na__PxPerM, Na__MaxPx) {
    const Na__Options = Na__Unit === "ft2" ? Na__ScaleBarFeet : Na__ScaleBarMetres;

    let Na__Chosen = Na__Options[0];
    for (const Na__Option of Na__Options) {
        if (Na__RoomSizeComparator__LengthToM(Na__Option, Na__Unit) * Na__PxPerM <= Na__MaxPx) Na__Chosen = Na__Option;
    }

    const Na__Segments = Na__Chosen <= 5 ? Na__Chosen : (Na__Chosen % 5 === 0 ? 5 : 4);
    return {
        Na__Length   : Na__Chosen,
        Na__LengthPx : Na__RoomSizeComparator__LengthToM(Na__Chosen, Na__Unit) * Na__PxPerM,
        Na__Segments : Na__Segments,
        Na__Label    : Na__Unit === "ft2" ? `${Na__Chosen} ft` : `${Na__Chosen} m`
    };
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Drawing Layers
// -----------------------------------------------------------------------------

// FUNCTION | Hairline grid over the drawing area
// ------------------------------------------------------------
function Na__RoomSizeComparator__DrawGrid(Na__Layer, Na__Frame, Na__Grid, Na__Colour) {
    const Na__StepPx = Na__Grid.Na__StepM * Na__Frame.Na__S;
    const Na__Right  = Na__Frame.Na__Ox + Na__Frame.Na__MaxLongPx;
    const Na__Top    = Na__Frame.Na__Oy - Na__Frame.Na__MaxShortPx;
    const Na__Attrs  = { "stroke": Na__Colour, "stroke-width": 1, "shape-rendering": "crispEdges" };

    for (let Na__X = Na__Frame.Na__Ox; Na__X <= Na__Right + 0.5; Na__X += Na__StepPx) {
        const Na__Px = Math.round(Na__X) + 0.5;
        Na__RoomSizeComparator__SvgEl("line", { ...Na__Attrs, x1: Na__Px, y1: Na__Top, x2: Na__Px, y2: Na__Frame.Na__Oy }, Na__Layer);
    }

    for (let Na__Y = Na__Frame.Na__Oy; Na__Y >= Na__Top - 0.5; Na__Y -= Na__StepPx) {
        const Na__Px = Math.round(Na__Y) + 0.5;
        Na__RoomSizeComparator__SvgEl("line", { ...Na__Attrs, x1: Na__Frame.Na__Ox, y1: Na__Px, x2: Na__Right, y2: Na__Px }, Na__Layer);
    }
}
// ------------------------------------------------------------


// FUNCTION | One furniture piece in the shared corner, for a sense of scale
// ------------------------------------------------------------
function Na__RoomSizeComparator__DrawFurniture(Na__Layer, Na__Frame, Na__Object, Na__Unit, Na__Colours, Na__MinBand) {
    const Na__S       = Na__Frame.Na__S;
    const Na__LongM   = Math.max(Number(Na__Object.NaObject__LengthM), Number(Na__Object.NaObject__WidthM));
    const Na__ShortM  = Math.min(Number(Na__Object.NaObject__LengthM), Number(Na__Object.NaObject__WidthM));


    // Up to 300 mm off the walls, less where the piece would leave the smallest (Min) box
    // ------------------------------------
    const Na__OffsetM = Math.max(0, Math.min(0.3,
        (Na__MinBand.Na__LongM - Na__LongM) / 2,
        (Na__MinBand.Na__ShortM - Na__ShortM) / 2));
    const Na__Label   = Na__Object.NaObject__Label || "";
    const Na__Ink     = Na__Colours.NaMiniApp__Furniture;
    let Na__Box;


    // Shape: a circle (turning circle) or a rectangle, long side horizontal
    // ------------------------------------
    if (Na__Object.NaObject__Shape === "circle") {
        const Na__R  = (Na__LongM / 2) * Na__S;
        const Na__Cx = Na__Frame.Na__Ox + (Na__OffsetM * Na__S) + Na__R;
        const Na__Cy = Na__Frame.Na__Oy - (Na__OffsetM * Na__S) - Na__R;
        Na__RoomSizeComparator__SvgEl("circle", {
            cx: Na__Cx, cy: Na__Cy, r: Na__R, fill: "#ffffff", "fill-opacity": 0.78, stroke: Na__Ink, "stroke-width": 1.25
        }, Na__Layer);
        Na__RoomSizeComparator__SvgEl("path", {
            d: `M ${Na__Cx - 5} ${Na__Cy} H ${Na__Cx + 5} M ${Na__Cx} ${Na__Cy - 5} V ${Na__Cy + 5}`, stroke: Na__Ink, "stroke-width": 1
        }, Na__Layer);
        Na__Box = Na__RoomSizeComparator__Box(Na__Cx - Na__R, Na__Cy - Na__R, Na__R * 2, Na__R * 2);
    } else {
        const Na__W = Na__LongM * Na__S;
        const Na__H = Na__ShortM * Na__S;
        const Na__X = Na__Frame.Na__Ox + Na__OffsetM * Na__S;
        const Na__Y = Na__Frame.Na__Oy - Na__OffsetM * Na__S - Na__H;
        Na__RoomSizeComparator__SvgEl("rect", {
            x: Na__X, y: Na__Y, width: Na__W, height: Na__H, rx: 2, fill: "#ffffff", "fill-opacity": 0.9, stroke: Na__Ink, "stroke-width": 1.25
        }, Na__Layer);
        Na__Box = Na__RoomSizeComparator__Box(Na__X, Na__Y, Na__W, Na__H);
    }


    // Label inside the piece when it fits, with its size
    // ------------------------------------
    const Na__Size = Na__Object.NaObject__Shape === "circle"
        ? Na__RoomSizeComparator__FormatLength(Na__LongM, Na__Unit, 2)
        : Na__RoomSizeComparator__FormatDims(Na__LongM, Na__ShortM, Na__Unit, 2);

    const Na__TextEl = Na__RoomSizeComparator__SvgText(Na__Layer, Na__Box.x + Na__Box.w / 2, Na__Box.y + Na__Box.h / 2 + 3.5,
        [{ Na__Text: Na__Label }], { "font-size": 10.5, "fill": Na__Ink, "text-anchor": "middle", "stroke-width": 2.5 });

    if (!Na__RoomSizeComparator__BoxInside(Na__RoomSizeComparator__TextBox(Na__TextEl), Na__Box, 2)) Na__TextEl.remove();

    const Na__Title = Na__RoomSizeComparator__SvgEl("title", {}, Na__Layer);
    Na__Title.textContent = `${Na__Label}: ${Na__Size}`;

    return { Na__Box: Na__Box, Na__Text: `${Na__Label}, ${Na__Size}` };
}
// ------------------------------------------------------------


// FUNCTION | Architectural dimension line with 45° ticks
// ------------------------------------------------------------
function Na__RoomSizeComparator__DrawDimension(Na__Layer, Na__X1, Na__Y1, Na__X2, Na__Y2, Na__Label, Na__Colour, Na__Ink, Na__Vertical) {
    const Na__Attrs = { stroke: Na__Colour, "stroke-width": 1.25, "stroke-linecap": "round" };
    Na__RoomSizeComparator__SvgEl("line", { ...Na__Attrs, x1: Na__X1, y1: Na__Y1, x2: Na__X2, y2: Na__Y2 }, Na__Layer);

    [[Na__X1, Na__Y1], [Na__X2, Na__Y2]].forEach(([Na__X, Na__Y]) => {
        Na__RoomSizeComparator__SvgEl("line", { ...Na__Attrs, "stroke-width": 1.5, x1: Na__X - 4, y1: Na__Y + 4, x2: Na__X + 4, y2: Na__Y - 4 }, Na__Layer);


        // Extension line back towards the room outline
        // ------------------------------------
        const Na__Ext = Na__Vertical
            ? { x1: Na__X - 4, y1: Na__Y, x2: Na__X + 11, y2: Na__Y }
            : { x1: Na__X, y1: Na__Y - 11, x2: Na__X, y2: Na__Y + 4 };
        Na__RoomSizeComparator__SvgEl("line", { ...Na__Attrs, "stroke-width": 0.75, ...Na__Ext }, Na__Layer);
    });

    if (Na__Vertical) {
        const Na__Cx = Na__X1 - 9;
        const Na__Cy = (Na__Y1 + Na__Y2) / 2;
        Na__RoomSizeComparator__SvgText(Na__Layer, Na__Cx, Na__Cy, [{ Na__Text: Na__Label }], {
            "font-size": 11, "fill": Na__Ink, "text-anchor": "middle", "transform": `rotate(-90 ${Na__Cx} ${Na__Cy})`
        });
    } else {
        Na__RoomSizeComparator__SvgText(Na__Layer, (Na__X1 + Na__X2) / 2, Na__Y1 + 15, [{ Na__Text: Na__Label }], {
            "font-size": 11, "fill": Na__Ink, "text-anchor": "middle"
        });
    }
}
// ------------------------------------------------------------


// FUNCTION | Scale bar, bottom right
// ------------------------------------------------------------
function Na__RoomSizeComparator__DrawScaleBar(Na__Layer, Na__Bar, Na__Right, Na__Y, Na__Colours) {
    const Na__Ink   = Na__Colours.NaMiniApp__InkSecondary;
    const Na__Left  = Na__Right - Na__Bar.Na__LengthPx;
    const Na__SegPx = Na__Bar.Na__LengthPx / Na__Bar.Na__Segments;

    for (let Na__I = 0; Na__I < Na__Bar.Na__Segments; Na__I += 1) {
        Na__RoomSizeComparator__SvgEl("rect", {
            x: Na__Left + Na__I * Na__SegPx, y: Na__Y, width: Na__SegPx, height: 5,
            fill: Na__I % 2 === 0 ? Na__Ink : "#ffffff", stroke: Na__Ink, "stroke-width": 0.75
        }, Na__Layer);
    }

    const Na__Text = { "font-size": 10.5, "fill": Na__Colours.NaMiniApp__InkMuted, "stroke-width": 0 };
    Na__RoomSizeComparator__SvgText(Na__Layer, Na__Left, Na__Y + 17, [{ Na__Text: "0" }], { ...Na__Text, "text-anchor": "middle" });
    Na__RoomSizeComparator__SvgText(Na__Layer, Na__Right, Na__Y + 17, [{ Na__Text: Na__Bar.Na__Label }], { ...Na__Text, "text-anchor": "end" });
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Render
// -----------------------------------------------------------------------------

// FUNCTION | Draw the plan into the SVG; returns the grid label and a text summary
// ------------------------------------------------------------
// Na__Model: {
//   Na__Index, Na__Room, Na__Unit, Na__ShowFurniture,
//   Na__YourRoom : null | { Na__AreaM2, Na__LongM, Na__ShortM },
//   Na__Colours  : AppConfig NaMiniApp__Colours,
//   Na__Drawing  : AppConfig NaMiniApp__Drawing,
//   Na__Text     : { Na__YourRoomTag }
// }
export function Na__RoomSizeComparator__RenderPlan(Na__Svg, Na__Model) {
    const Na__Host = Na__Svg.parentElement;
    const Na__W    = Math.floor(Na__Host ? Na__Host.clientWidth : 0);
    if (Na__W < 60) return null;   // hidden tab: drawn when shown

    while (Na__Svg.firstChild) Na__Svg.removeChild(Na__Svg.firstChild);

    const Na__C     = Na__Model.Na__Colours;
    const Na__Room  = Na__Model.Na__Room;
    const Na__Unit  = Na__Model.Na__Unit;
    const Na__You   = Na__Model.Na__YourRoom;
    const Na__Ramp  = Na__C.NaMiniApp__BandRamp;
    const Na__Tints = Number(Na__C.NaMiniApp__BandTintStrength) || 0.22;


    // Band geometry from the areas and the room type's plan shape
    // ------------------------------------
    const Na__Bands = Na__Room.Na__AreaList.map((Na__Area, Na__I) => {
        const Na__Key = Na__RoomSizeComparator__BandKeys[Na__I];
        return {
            Na__I      : Na__I,
            Na__Key    : Na__Key,
            Na__Label  : Na__RoomSizeComparator__BandLabel(Na__Model.Na__Index, Na__I),
            Na__Area   : Na__Area,
            Na__Colour : Na__Ramp[Na__Key],
            Na__Fill   : Na__RoomSizeComparator__Tint(Na__Ramp[Na__Key], Na__Tints),
            ...Na__RoomSizeComparator__DimsForArea(Na__Area, Na__Room.Na__Aspect)
        };
    });


    // Frame: margins, scale and the shared bottom-left corner
    // ------------------------------------
    const Na__MarginT = 16;
    const Na__MarginR = 16;
    const Na__MarginL = Na__You ? 40 : 16;
    const Na__MarginB = (Na__You ? 30 : 8) + 26;

    let Na__MaxLong  = Math.max(...Na__Bands.map((Na__B) => Na__B.Na__LongM));
    let Na__MaxShort = Math.max(...Na__Bands.map((Na__B) => Na__B.Na__ShortM));
    if (Na__You) {
        Na__MaxLong  = Math.max(Na__MaxLong,  Na__You.Na__LongM);
        Na__MaxShort = Math.max(Na__MaxShort, Na__You.Na__ShortM);
    }

    const Na__Narrow  = Na__W < 560;
    const Na__TargetH = Na__Narrow ? Math.min(460, Math.max(260, Na__W * 0.9)) : Math.min(540, Math.max(320, Na__W * 0.6));
    const Na__S       = Math.min((Na__W - Na__MarginL - Na__MarginR) / Na__MaxLong, (Na__TargetH - Na__MarginT - Na__MarginB) / Na__MaxShort);
    const Na__H       = Math.round(Na__MarginT + Na__MaxShort * Na__S + Na__MarginB);

    // Centre the drawing across the width when the height limits the scale
    const Na__SpareW = Math.max(0, (Na__W - Na__MarginL - Na__MarginR) - Na__MaxLong * Na__S);

    const Na__Frame = {
        Na__S          : Na__S,
        Na__Ox         : Na__MarginL + Na__SpareW / 2,
        Na__Oy         : Na__MarginT + Na__MaxShort * Na__S,
        Na__MaxLongPx  : Na__MaxLong * Na__S,
        Na__MaxShortPx : Na__MaxShort * Na__S
    };

    Na__Svg.setAttribute("width", Na__W);
    Na__Svg.setAttribute("height", Na__H);
    Na__Svg.setAttribute("viewBox", `0 0 ${Na__W} ${Na__H}`);
    Na__Svg.setAttribute("font-family", Na__FontFamily);

    const Na__RectOf = (Na__LongM, Na__ShortM) => Na__RoomSizeComparator__Box(
        Na__Frame.Na__Ox, Na__Frame.Na__Oy - Na__ShortM * Na__S, Na__LongM * Na__S, Na__ShortM * Na__S);


    // Layers, bottom to top
    // ------------------------------------
    Na__RoomSizeComparator__SvgEl("rect", { x: 0, y: 0, width: Na__W, height: Na__H, fill: Na__C.NaMiniApp__Surface }, Na__Svg);
    const Na__GridLayer  = Na__RoomSizeComparator__SvgEl("g", { "aria-hidden": "true" }, Na__Svg);
    const Na__BandLayer  = Na__RoomSizeComparator__SvgEl("g", {}, Na__Svg);
    const Na__FurnLayer  = Na__RoomSizeComparator__SvgEl("g", {}, Na__Svg);
    const Na__YouLayer   = Na__RoomSizeComparator__SvgEl("g", {}, Na__Svg);
    const Na__LabelLayer = Na__RoomSizeComparator__SvgEl("g", { "aria-hidden": "true" }, Na__Svg);
    const Na__DimLayer   = Na__RoomSizeComparator__SvgEl("g", { "aria-hidden": "true" }, Na__Svg);


    // Grid
    // ------------------------------------
    const Na__Grid = Na__RoomSizeComparator__PickGridStep(Na__Unit, Na__S, Na__Model.Na__Drawing || {});
    Na__RoomSizeComparator__DrawGrid(Na__GridLayer, Na__Frame, Na__Grid, Na__C.NaMiniApp__Grid);


    // Band boxes, largest first so each smaller box sits on top
    // ------------------------------------
    [...Na__Bands].reverse().forEach((Na__Band) => {
        const Na__Box = Na__RectOf(Na__Band.Na__LongM, Na__Band.Na__ShortM);
        Na__Band.Na__Box = Na__Box;
        const Na__Rect = Na__RoomSizeComparator__SvgEl("rect", {
            x: Na__Box.x, y: Na__Box.y, width: Na__Box.w, height: Na__Box.h,
            fill: Na__Band.Na__Fill, stroke: Na__C.NaMiniApp__BandOutline, "stroke-opacity": 0.5, "stroke-width": 1
        }, Na__BandLayer);
        const Na__Title = Na__RoomSizeComparator__SvgEl("title", {}, Na__Rect);
        Na__Title.textContent = `${Na__Band.Na__Label}: ${Na__RoomSizeComparator__FormatArea(Na__Band.Na__Area, Na__Unit)}, about ${Na__RoomSizeComparator__FormatDims(Na__Band.Na__LongM, Na__Band.Na__ShortM, Na__Unit)}`;
    });


    // Furniture for scale
    // ------------------------------------
    const Na__Placed = [];
    let Na__FurnitureText = "";
    if (Na__Model.Na__ShowFurniture && Na__Room.NaRoom__ScaleObject) {
        const Na__Furniture = Na__RoomSizeComparator__DrawFurniture(Na__FurnLayer, Na__Frame, Na__Room.NaRoom__ScaleObject, Na__Unit, Na__C, Na__Bands[0]);
        Na__Placed.push(Na__Furniture.Na__Box);
        Na__FurnitureText = Na__Furniture.Na__Text;
    }


    // Your room: orange outline with a white ring, dimension lines and a label
    // ------------------------------------
    const Na__SvgBounds = Na__RoomSizeComparator__Box(0, 0, Na__W, Na__H);
    if (Na__You) {
        const Na__Box = Na__RectOf(Na__You.Na__LongM, Na__You.Na__ShortM);
        const Na__Geo = { x: Na__Box.x, y: Na__Box.y, width: Na__Box.w, height: Na__Box.h };
        Na__RoomSizeComparator__SvgEl("rect", { ...Na__Geo, fill: "none", stroke: "#ffffff", "stroke-width": 6, "stroke-opacity": 0.9 }, Na__YouLayer);
        Na__RoomSizeComparator__SvgEl("rect", { ...Na__Geo, fill: Na__C.NaMiniApp__YourRoom, "fill-opacity": 0.07, stroke: Na__C.NaMiniApp__YourRoom, "stroke-width": 2.5 }, Na__YouLayer);

        // Typed dimensions to the centimetre; a shape assumed from an area to 0.1 m (prefixed ≈)
        const Na__Decimals = Na__You.Na__FromDims ? 2 : 1;
        const Na__Approx   = Na__You.Na__FromDims ? "" : "≈ ";
        Na__RoomSizeComparator__DrawDimension(Na__DimLayer,
            Na__Box.x, Na__Frame.Na__Oy + 14, Na__Box.x + Na__Box.w, Na__Frame.Na__Oy + 14,
            `${Na__Approx}${Na__RoomSizeComparator__FormatLength(Na__You.Na__LongM, Na__Unit, Na__Decimals)}`, Na__C.NaMiniApp__YourRoom, Na__C.NaMiniApp__InkPrimary, false);
        Na__RoomSizeComparator__DrawDimension(Na__DimLayer,
            Na__Frame.Na__Ox - 14, Na__Frame.Na__Oy, Na__Frame.Na__Ox - 14, Na__Box.y,
            `${Na__Approx}${Na__RoomSizeComparator__FormatLength(Na__You.Na__ShortM, Na__Unit, Na__Decimals)}`, Na__C.NaMiniApp__YourRoom, Na__C.NaMiniApp__InkPrimary, true);


        // Label: inside the top-left corner, else above it, else beside it
        // ------------------------------------
        const Na__Parts = [
            { Na__Text: Na__Model.Na__Text.Na__YourRoomTag, Na__Attrs: { "font-weight": 700 } },
            { Na__Text: `  ${Na__RoomSizeComparator__FormatArea(Na__You.Na__AreaM2, Na__Unit, "measured")}` }
        ];
        const Na__Spots = [
            [Na__Box.x + 8, Na__Box.y + 17, "start"],
            [Na__Box.x + 2, Na__Box.y - 7, "start"],
            [Na__Box.x + Na__Box.w + 8, Na__Box.y + 12, "start"]
        ];

        for (const [Na__X, Na__Y, Na__Anchor] of Na__Spots) {
            const Na__TextEl = Na__RoomSizeComparator__SvgText(Na__LabelLayer, Na__X, Na__Y, Na__Parts, {
                "font-size": 12.5, "fill": Na__C.NaMiniApp__InkPrimary, "text-anchor": Na__Anchor, "stroke-width": 3.5
            });
            const Na__TextBox = Na__RoomSizeComparator__TextBox(Na__TextEl);
            const Na__Fits = Na__RoomSizeComparator__BoxInside(Na__TextBox, Na__SvgBounds, 2)
                && !Na__Placed.some((Na__Other) => Na__RoomSizeComparator__BoxesOverlap(Na__TextBox, Na__Other));
            if (Na__Fits) { Na__Placed.push(Na__TextBox); break; }
            Na__TextEl.remove();
        }
    }


    // Band labels at each box's top-right corner, kept inside the band's own strip
    // ------------------------------------
    [...Na__Bands].reverse().forEach((Na__Band) => {
        const Na__Box      = Na__Band.Na__Box;
        const Na__Inner    = Na__Band.Na__I > 0 ? Na__Bands[Na__Band.Na__I - 1].Na__Box : null;
        const Na__X        = Na__Box.x + Na__Box.w - 7;
        const Na__Y        = Na__Box.y + 16;
        const Na__Blockers = Na__Inner ? [...Na__Placed, Na__Inner] : Na__Placed;

        const Na__Line1 = Na__RoomSizeComparator__SvgText(Na__LabelLayer, Na__X, Na__Y, [
            { Na__Text: Na__Band.Na__Label, Na__Attrs: { "font-weight": 700 } },
            { Na__Text: `  ${Na__RoomSizeComparator__FormatArea(Na__Band.Na__Area, Na__Unit)}` }
        ], { "font-size": 12, "fill": Na__C.NaMiniApp__InkPrimary, "text-anchor": "end" });

        // Text boxes include the font's full ascent, so allow them to touch the strip edge
        const Na__Fits = (Na__TextBox) => Na__RoomSizeComparator__BoxInside(Na__TextBox, Na__Box, 0)
            && !Na__Blockers.some((Na__Other) => Na__RoomSizeComparator__BoxesOverlap(Na__TextBox, Na__Other));

        const Na__Box1 = Na__RoomSizeComparator__TextBox(Na__Line1);
        if (!Na__Fits(Na__Box1)) {
            Na__Line1.remove();


            // Thin strip (small screens, close bands): the band name alone, smaller
            // ------------------------------------
            const Na__Short = Na__RoomSizeComparator__SvgText(Na__LabelLayer, Na__X + 2, Na__Box.y + 13, [
                { Na__Text: Na__Band.Na__Label, Na__Attrs: { "font-weight": 700 } }
            ], { "font-size": 10, "fill": Na__C.NaMiniApp__InkPrimary, "text-anchor": "end", "stroke-width": 2.5 });
            const Na__ShortBox = Na__RoomSizeComparator__TextBox(Na__Short);
            if (Na__Fits(Na__ShortBox)) Na__Placed.push(Na__ShortBox);
            else Na__Short.remove();
            return;
        }
        Na__Placed.push(Na__Box1);

        const Na__Line2 = Na__RoomSizeComparator__SvgText(Na__LabelLayer, Na__X, Na__Y + 14, [
            { Na__Text: `≈ ${Na__RoomSizeComparator__FormatDims(Na__Band.Na__LongM, Na__Band.Na__ShortM, Na__Unit)}` }
        ], { "font-size": 11, "fill": Na__C.NaMiniApp__InkSecondary, "text-anchor": "end" });

        const Na__Box2 = Na__RoomSizeComparator__TextBox(Na__Line2);
        const Na__Ok2  = Na__RoomSizeComparator__BoxInside(Na__Box2, Na__Box, 0)
            && !Na__Blockers.some((Na__Other) => Na__RoomSizeComparator__BoxesOverlap(Na__Box2, Na__Other));
        if (!Na__Ok2) { Na__Line2.remove(); return; }
        Na__Placed.push(Na__Box2);
    });


    // Scale bar
    // ------------------------------------
    const Na__Bar = Na__RoomSizeComparator__PickScaleBar(Na__Unit, Na__S, Math.max(60, Na__Frame.Na__MaxLongPx * 0.4));
    Na__RoomSizeComparator__DrawScaleBar(Na__DimLayer, Na__Bar, Na__Frame.Na__Ox + Na__Frame.Na__MaxLongPx, Na__H - 24, Na__C);


    // Accessible summary
    // ------------------------------------
    const Na__Summary = Na__Bands.map((Na__Band) => `${Na__Band.Na__Label} ${Na__RoomSizeComparator__FormatArea(Na__Band.Na__Area, Na__Unit)}`).join(", ");
    const Na__YouText = Na__You ? `. ${Na__Model.Na__Text.Na__YourRoomTag}: ${Na__RoomSizeComparator__FormatArea(Na__You.Na__AreaM2, Na__Unit, "measured")}, ${Na__RoomSizeComparator__FormatDims(Na__You.Na__LongM, Na__You.Na__ShortM, Na__Unit, 2)}` : "";
    Na__Svg.setAttribute("aria-label", `${Na__Room.NaRoom__Name} size bands drawn to scale: ${Na__Summary}${Na__YouText}.`);

    return { Na__GridLabel: Na__Grid.Na__Label, Na__FurnitureText: Na__FurnitureText, Na__Width: Na__W, Na__Height: Na__H };
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Save As PNG
// -----------------------------------------------------------------------------

// FUNCTION | Save the drawing with a title strip as a PNG
// ------------------------------------------------------------
// Na__Options: { Na__Title, Na__Subtitle, Na__Credit, Na__Scale, Na__FileName, Na__Colours }
export async function Na__RoomSizeComparator__ExportPlanPng(Na__Svg, Na__Options) {
    const Na__W      = Number(Na__Svg.getAttribute("width"));
    const Na__H      = Number(Na__Svg.getAttribute("height"));
    const Na__HeadH  = 56;
    const Na__FootH  = 24;
    const Na__TotalH = Na__H + Na__HeadH + Na__FootH;
    const Na__C      = Na__Options.Na__Colours;


    // Wrap the live drawing with a title and a credit line
    // ------------------------------------
    const Na__Wrap = document.createElementNS(Na__SvgNs, "svg");
    Na__Wrap.setAttribute("xmlns", Na__SvgNs);
    Na__Wrap.setAttribute("width", Na__W);
    Na__Wrap.setAttribute("height", Na__TotalH);
    Na__Wrap.setAttribute("viewBox", `0 0 ${Na__W} ${Na__TotalH}`);
    Na__Wrap.setAttribute("font-family", Na__FontFamily);

    Na__RoomSizeComparator__SvgEl("rect", { x: 0, y: 0, width: Na__W, height: Na__TotalH, fill: "#ffffff" }, Na__Wrap);
    Na__RoomSizeComparator__SvgText(Na__Wrap, 16, 26, [{ Na__Text: Na__Options.Na__Title }], { "font-size": 16, "font-weight": 700, "fill": Na__C.NaMiniApp__InkPrimary, "stroke-width": 0 });
    Na__RoomSizeComparator__SvgText(Na__Wrap, 16, 45, [{ Na__Text: Na__Options.Na__Subtitle }], { "font-size": 12, "fill": Na__C.NaMiniApp__InkSecondary, "stroke-width": 0 });

    const Na__Inner = Na__Svg.cloneNode(true);
    Na__Inner.removeAttribute("id");
    Na__Inner.removeAttribute("class");
    Na__Inner.setAttribute("x", 0);
    Na__Inner.setAttribute("y", Na__HeadH);
    Na__Wrap.appendChild(Na__Inner);

    Na__RoomSizeComparator__SvgText(Na__Wrap, Na__W - 16, Na__TotalH - 9, [{ Na__Text: Na__Options.Na__Credit }], {
        "font-size": 10.5, "fill": Na__C.NaMiniApp__InkMuted, "text-anchor": "end", "stroke-width": 0
    });


    // Rasterise at 2× and download
    // ------------------------------------
    const Na__Xml   = new XMLSerializer().serializeToString(Na__Wrap);
    const Na__Image = new Image();
    Na__Image.src   = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(Na__Xml)}`;
    await Na__Image.decode();

    const Na__Scale  = Number(Na__Options.Na__Scale) || 2;
    const Na__Canvas = document.createElement("canvas");
    Na__Canvas.width  = Math.round(Na__W * Na__Scale);
    Na__Canvas.height = Math.round(Na__TotalH * Na__Scale);
    const Na__Ctx = Na__Canvas.getContext("2d");
    Na__Ctx.scale(Na__Scale, Na__Scale);
    Na__Ctx.drawImage(Na__Image, 0, 0, Na__W, Na__TotalH);

    const Na__Blob = await new Promise((Na__Resolve) => Na__Canvas.toBlob(Na__Resolve, "image/png"));
    if (!Na__Blob) throw new Error("The browser could not encode the PNG.");

    const Na__Url  = URL.createObjectURL(Na__Blob);
    const Na__Link = document.createElement("a");
    Na__Link.href     = Na__Url;
    Na__Link.download = Na__Options.Na__FileName;
    document.body.appendChild(Na__Link);
    Na__Link.click();
    Na__Link.remove();
    window.setTimeout(() => URL.revokeObjectURL(Na__Url), 2000);
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------
