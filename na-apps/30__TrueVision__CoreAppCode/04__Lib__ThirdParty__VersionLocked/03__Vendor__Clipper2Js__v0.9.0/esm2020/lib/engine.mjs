/*******************************************************************************
* Author    :  Angus Johnson                                                   *
* Date      :  27 August 2023                                                  *
* Website   :  http://www.angusj.com                                           *
* Copyright :  Angus Johnson 2010-2023                                         *
* Purpose   :  This is the main polygon clipping module                        *
* Thanks    :  Special thanks to Thong Nguyen, Guus Kuiper, Phil Stopford,     *
*           :  and Daniel Gosnell for their invaluable assistance with C#.     *
* License   :  http://www.boost.org/LICENSE_1_0.txt                            *
*******************************************************************************/
import { Clipper } from "./clipper";
import { ClipType, FillRule, InternalClipper, Path64, PathType, Paths64, Point64, Rect64 } from "./core";
//
// Converted from C# implemention https://github.com/AngusJohnson/Clipper2/blob/main/CSharp/Clipper2Lib/Clipper.Engine.cs
// Removed support for USINGZ
//
// Converted by ChatGPT 4 August 3 version https://help.openai.com/en/articles/6825453-chatgpt-release-notes
//
export var PointInPolygonResult;
(function (PointInPolygonResult) {
    PointInPolygonResult[PointInPolygonResult["IsOn"] = 0] = "IsOn";
    PointInPolygonResult[PointInPolygonResult["IsInside"] = 1] = "IsInside";
    PointInPolygonResult[PointInPolygonResult["IsOutside"] = 2] = "IsOutside";
})(PointInPolygonResult || (PointInPolygonResult = {}));
export var VertexFlags;
(function (VertexFlags) {
    VertexFlags[VertexFlags["None"] = 0] = "None";
    VertexFlags[VertexFlags["OpenStart"] = 1] = "OpenStart";
    VertexFlags[VertexFlags["OpenEnd"] = 2] = "OpenEnd";
    VertexFlags[VertexFlags["LocalMax"] = 4] = "LocalMax";
    VertexFlags[VertexFlags["LocalMin"] = 8] = "LocalMin";
})(VertexFlags || (VertexFlags = {}));
class Vertex {
    constructor(pt, flags, prev) {
        this.pt = pt;
        this.flags = flags;
        this.next = undefined;
        this.prev = prev;
    }
}
class LocalMinima {
    constructor(vertex, polytype, isOpen = false) {
        this.vertex = vertex;
        this.polytype = polytype;
        this.isOpen = isOpen;
    }
    static equals(lm1, lm2) {
        return lm1.vertex === lm2.vertex;
    }
    static notEquals(lm1, lm2) {
        return lm1.vertex !== lm2.vertex;
    }
}
class IntersectNode {
    constructor(pt, edge1, edge2) {
        this.pt = pt;
        this.edge1 = edge1;
        this.edge2 = edge2;
    }
}
class OutPt {
    constructor(pt, outrec) {
        this.pt = pt;
        this.outrec = outrec;
        this.next = this;
        this.prev = this;
        this.horz = undefined;
    }
}
export var JoinWith;
(function (JoinWith) {
    JoinWith[JoinWith["None"] = 0] = "None";
    JoinWith[JoinWith["Left"] = 1] = "Left";
    JoinWith[JoinWith["Right"] = 2] = "Right";
})(JoinWith || (JoinWith = {}));
export var HorzPosition;
(function (HorzPosition) {
    HorzPosition[HorzPosition["Bottom"] = 0] = "Bottom";
    HorzPosition[HorzPosition["Middle"] = 1] = "Middle";
    HorzPosition[HorzPosition["Top"] = 2] = "Top";
})(HorzPosition || (HorzPosition = {}));
export class OutRec {
    constructor(idx) {
        this.idx = idx;
        this.isOpen = false;
    }
}
class HorzSegment {
    constructor(op) {
        this.leftOp = op;
        this.rightOp = undefined;
        this.leftToRight = true;
    }
}
class HorzJoin {
    constructor(ltor, rtol) {
        this.op1 = ltor;
        this.op2 = rtol;
    }
}
///////////////////////////////////////////////////////////////////
// Important: UP and DOWN here are premised on Y-axis positive down
// displays, which is the orientation used in Clipper's development.
///////////////////////////////////////////////////////////////////
export class Active {
    constructor() {
        this.dx = this.windCount = this.windCount2 = 0;
        this.isLeftBound = false;
        this.joinWith = JoinWith.None;
    }
}
export class ClipperEngine {
    static addLocMin(vert, polytype, isOpen, minimaList) {
        // make sure the vertex is added only once ...
        if ((vert.flags & VertexFlags.LocalMin) !== VertexFlags.None)
            return;
        vert.flags |= VertexFlags.LocalMin;
        const lm = new LocalMinima(vert, polytype, isOpen);
        minimaList.push(lm);
    }
    static addPathsToVertexList(paths, polytype, isOpen, minimaList, vertexList) {
        let totalVertCnt = 0;
        for (const path of paths)
            totalVertCnt += path.length;
        for (const path of paths) {
            let v0 = undefined;
            let prev_v = undefined;
            let curr_v = undefined;
            for (const pt of path) {
                if (!v0) {
                    v0 = new Vertex(pt, VertexFlags.None, undefined);
                    vertexList.push(v0);
                    prev_v = v0;
                }
                else if (prev_v.pt !== pt) { // i.e., skips duplicates
                    curr_v = new Vertex(pt, VertexFlags.None, prev_v);
                    vertexList.push(curr_v);
                    prev_v.next = curr_v;
                    prev_v = curr_v;
                }
            }
            if (!prev_v || !prev_v.prev)
                continue;
            if (!isOpen && prev_v.pt === v0.pt)
                prev_v = prev_v.prev;
            prev_v.next = v0;
            v0.prev = prev_v;
            if (!isOpen && prev_v.next === prev_v)
                continue;
            // OK, we have a valid path
            let going_up = false;
            if (isOpen) {
                curr_v = v0.next;
                let count = 0;
                while (curr_v !== v0 && curr_v.pt.y === v0.pt.y) {
                    curr_v = curr_v.next;
                    if (count++ > totalVertCnt) {
                        console.warn('infinite loop detected');
                        break;
                    }
                }
                going_up = curr_v.pt.y <= v0.pt.y;
                if (going_up) {
                    v0.flags = VertexFlags.OpenStart;
                    this.addLocMin(v0, polytype, true, minimaList);
                }
                else {
                    v0.flags = VertexFlags.OpenStart | VertexFlags.LocalMax;
                }
            }
            else { // closed path
                prev_v = v0.prev;
                let count = 0;
                while (prev_v !== v0 && prev_v.pt.y === v0.pt.y) {
                    prev_v = prev_v.prev;
                    if (count++ > totalVertCnt) {
                        console.warn('infinite loop detected');
                        break;
                    }
                }
                if (prev_v === v0) {
                    continue; // only open paths can be completely flat
                }
                going_up = prev_v.pt.y > v0.pt.y;
            }
            const going_up0 = going_up;
            prev_v = v0;
            curr_v = v0.next;
            let count = 0;
            while (curr_v !== v0) {
                if (curr_v.pt.y > prev_v.pt.y && going_up) {
                    prev_v.flags |= VertexFlags.LocalMax;
                    going_up = false;
                }
                else if (curr_v.pt.y < prev_v.pt.y && !going_up) {
                    going_up = true;
                    this.addLocMin(prev_v, polytype, isOpen, minimaList);
                }
                prev_v = curr_v;
                curr_v = curr_v.next;
                if (count++ > totalVertCnt) {
                    console.warn('infinite loop detected');
                    break;
                }
            }
            if (isOpen) {
                prev_v.flags |= VertexFlags.OpenEnd;
                if (going_up) {
                    prev_v.flags |= VertexFlags.LocalMax;
                }
                else {
                    this.addLocMin(prev_v, polytype, isOpen, minimaList);
                }
            }
            else if (going_up !== going_up0) {
                if (going_up0) {
                    this.addLocMin(prev_v, polytype, false, minimaList);
                }
                else {
                    prev_v.flags |= VertexFlags.LocalMax;
                }
            }
        }
    }
}
export class ReuseableDataContainer64 {
    constructor() {
        this._minimaList = [];
        this._vertexList = [];
    }
    clear() {
        this._minimaList.length = 0;
        this._vertexList.length = 0;
    }
    addPaths(paths, pt, isOpen) {
        ClipperEngine.addPathsToVertexList(paths, pt, isOpen, this._minimaList, this._vertexList);
    }
}
class SimpleNavigableSet {
    constructor() {
        this.items = [];
        this.items = [];
    }
    clear() { this.items.length = 0; }
    isEmpty() { return this.items.length == 0; }
    pollLast() {
        return this.items.pop();
    }
    add(item) {
        if (!this.items.includes(item)) {
            this.items.push(item);
            this.items.sort((a, b) => a - b);
        }
    }
}
export class ClipperBase {
    constructor() {
        this._cliptype = ClipType.None;
        this._fillrule = FillRule.EvenOdd;
        this._currentLocMin = 0;
        this._currentBotY = 0;
        this._isSortedMinimaList = false;
        this._hasOpenPaths = false;
        this._using_polytree = false;
        this._succeeded = false;
        this.reverseSolution = false;
        this._minimaList = [];
        this._intersectList = [];
        this._vertexList = [];
        this._outrecList = [];
        this._scanlineList = new SimpleNavigableSet();
        this._horzSegList = [];
        this._horzJoinList = [];
        this.preserveCollinear = true;
    }
    static isOdd(val) {
        return ((val & 1) !== 0);
    }
    static isHotEdgeActive(ae) {
        return ae.outrec !== undefined;
    }
    static isOpen(ae) {
        return ae.localMin.isOpen;
    }
    static isOpenEndActive(ae) {
        return ae.localMin.isOpen && ClipperBase.isOpenEnd(ae.vertexTop);
    }
    static isOpenEnd(v) {
        return (v.flags & (VertexFlags.OpenStart | VertexFlags.OpenEnd)) !== VertexFlags.None;
    }
    static getPrevHotEdge(ae) {
        let prev = ae.prevInAEL;
        while (prev && (ClipperBase.isOpen(prev) || !ClipperBase.isHotEdgeActive(prev)))
            prev = prev.prevInAEL;
        return prev;
    }
    static isFront(ae) {
        return ae === ae.outrec.frontEdge;
    }
    /*******************************************************************************
    *  Dx:                             0(90deg)                                    *
    *                                  |                                           *
    *               +inf (180deg) <--- o --. -inf (0deg)                          *
    *******************************************************************************/
    static getDx(pt1, pt2) {
        const dy = pt2.y - pt1.y;
        if (dy !== 0)
            return (pt2.x - pt1.x) / dy;
        if (pt2.x > pt1.x)
            return Number.NEGATIVE_INFINITY;
        return Number.POSITIVE_INFINITY;
    }
    static topX(ae, currentY) {
        if ((currentY === ae.top.y) || (ae.top.x === ae.bot.x))
            return ae.top.x;
        if (currentY === ae.bot.y)
            return ae.bot.x;
        return ae.bot.x + Math.round(ae.dx * (currentY - ae.bot.y));
    }
    static isHorizontal(ae) {
        return (ae.top.y === ae.bot.y);
    }
    static isHeadingRightHorz(ae) {
        return (Number.NEGATIVE_INFINITY === ae.dx);
    }
    static isHeadingLeftHorz(ae) {
        return (Number.POSITIVE_INFINITY === ae.dx);
    }
    static swapActives(ae1, ae2) {
        [ae2, ae1] = [ae1, ae2];
    }
    static getPolyType(ae) {
        return ae.localMin.polytype;
    }
    static isSamePolyType(ae1, ae2) {
        return ae1.localMin.polytype === ae2.localMin.polytype;
    }
    static setDx(ae) {
        ae.dx = ClipperBase.getDx(ae.bot, ae.top);
    }
    static nextVertex(ae) {
        if (ae.windDx > 0)
            return ae.vertexTop.next;
        return ae.vertexTop.prev;
    }
    static prevPrevVertex(ae) {
        if (ae.windDx > 0)
            return ae.vertexTop.prev.prev;
        return ae.vertexTop.next.next;
    }
    static isMaxima(vertex) {
        return (vertex.flags & VertexFlags.LocalMax) !== VertexFlags.None;
    }
    static isMaximaActive(ae) {
        return ClipperBase.isMaxima(ae.vertexTop);
    }
    static getMaximaPair(ae) {
        let ae2 = ae.nextInAEL;
        while (ae2) {
            if (ae2.vertexTop === ae.vertexTop)
                return ae2; // Found!
            ae2 = ae2.nextInAEL;
        }
        return undefined;
    }
    static getCurrYMaximaVertex_Open(ae) {
        let result = ae.vertexTop;
        if (ae.windDx > 0) {
            while (result.next.pt.y === result.pt.y &&
                ((result.flags & (VertexFlags.OpenEnd |
                    VertexFlags.LocalMax)) === VertexFlags.None))
                result = result.next;
        }
        else {
            while (result.prev.pt.y === result.pt.y &&
                ((result.flags & (VertexFlags.OpenEnd |
                    VertexFlags.LocalMax)) === VertexFlags.None))
                result = result.prev;
        }
        if (!ClipperBase.isMaxima(result))
            result = undefined; // not a maxima
        return result;
    }
    static getCurrYMaximaVertex(ae) {
        let result = ae.vertexTop;
        if (ae.windDx > 0) {
            while (result.next.pt.y === result.pt.y)
                result = result.next;
        }
        else {
            while (result.prev.pt.y === result.pt.y)
                result = result.prev;
        }
        if (!ClipperBase.isMaxima(result))
            result = undefined; // not a maxima
        return result;
    }
    static setSides(outrec, startEdge, endEdge) {
        outrec.frontEdge = startEdge;
        outrec.backEdge = endEdge;
    }
    static swapOutrecs(ae1, ae2) {
        const or1 = ae1.outrec;
        const or2 = ae2.outrec;
        if (or1 === or2) {
            const ae = or1.frontEdge;
            or1.frontEdge = or1.backEdge;
            or1.backEdge = ae;
            return;
        }
        if (or1) {
            if (ae1 === or1.frontEdge)
                or1.frontEdge = ae2;
            else
                or1.backEdge = ae2;
        }
        if (or2) {
            if (ae2 === or2.frontEdge)
                or2.frontEdge = ae1;
            else
                or2.backEdge = ae1;
        }
        ae1.outrec = or2;
        ae2.outrec = or1;
    }
    static setOwner(outrec, newOwner) {
        while (newOwner.owner && !newOwner.owner.pts) {
            newOwner.owner = newOwner.owner.owner;
        }
        //make sure that outrec isn't an owner of newOwner
        let tmp = newOwner;
        while (tmp && tmp !== outrec)
            tmp = tmp.owner;
        if (tmp)
            newOwner.owner = outrec.owner;
        outrec.owner = newOwner;
    }
    static area(op) {
        // https://en.wikipedia.org/wiki/Shoelace_formula
        let area = 0.0;
        let op2 = op;
        do {
            area += (op2.prev.pt.y + op2.pt.y) *
                (op2.prev.pt.x - op2.pt.x);
            op2 = op2.next;
        } while (op2 !== op);
        return area * 0.5;
    }
    static areaTriangle(pt1, pt2, pt3) {
        return (pt3.y + pt1.y) * (pt3.x - pt1.x) +
            (pt1.y + pt2.y) * (pt1.x - pt2.x) +
            (pt2.y + pt3.y) * (pt2.x - pt3.x);
    }
    static getRealOutRec(outRec) {
        while (outRec !== undefined && outRec.pts === undefined) {
            outRec = outRec.owner;
        }
        return outRec;
    }
    static isValidOwner(outRec, testOwner) {
        while (testOwner !== undefined && testOwner !== outRec)
            testOwner = testOwner.owner;
        return testOwner === undefined;
    }
    static uncoupleOutRec(ae) {
        const outrec = ae.outrec;
        if (outrec === undefined)
            return;
        outrec.frontEdge.outrec = undefined;
        outrec.backEdge.outrec = undefined;
        outrec.frontEdge = undefined;
        outrec.backEdge = undefined;
    }
    static outrecIsAscending(hotEdge) {
        return (hotEdge === hotEdge.outrec.frontEdge);
    }
    static swapFrontBackSides(outrec) {
        // while this proc. is needed for open paths
        // it's almost never needed for closed paths
        const ae2 = outrec.frontEdge;
        outrec.frontEdge = outrec.backEdge;
        outrec.backEdge = ae2;
        outrec.pts = outrec.pts.next;
    }
    static edgesAdjacentInAEL(inode) {
        return (inode.edge1.nextInAEL === inode.edge2) || (inode.edge1.prevInAEL === inode.edge2);
    }
    clearSolutionOnly() {
        while (this._actives)
            this.deleteFromAEL(this._actives);
        this._scanlineList.clear();
        this.disposeIntersectNodes();
        this._outrecList.length = 0;
        this._horzSegList.length = 0;
        this._horzJoinList.length = 0;
    }
    clear() {
        this.clearSolutionOnly();
        this._minimaList.length = 0;
        this._vertexList.length = 0;
        this._currentLocMin = 0;
        this._isSortedMinimaList = false;
        this._hasOpenPaths = false;
    }
    reset() {
        if (!this._isSortedMinimaList) {
            this._minimaList.sort((locMin1, locMin2) => locMin2.vertex.pt.y - locMin1.vertex.pt.y);
            this._isSortedMinimaList = true;
        }
        for (let i = this._minimaList.length - 1; i >= 0; i--) {
            this._scanlineList.add(this._minimaList[i].vertex.pt.y);
        }
        this._currentBotY = 0;
        this._currentLocMin = 0;
        this._actives = undefined;
        this._sel = undefined;
        this._succeeded = true;
    }
    insertScanline(y) {
        this._scanlineList.add(y);
    }
    popScanline() {
        return this._scanlineList.pollLast();
    }
    hasLocMinAtY(y) {
        return (this._currentLocMin < this._minimaList.length && this._minimaList[this._currentLocMin].vertex.pt.y == y);
    }
    popLocalMinima() {
        return this._minimaList[this._currentLocMin++];
    }
    addLocMin(vert, polytype, isOpen) {
        // make sure the vertex is added only once ...
        if ((vert.flags & VertexFlags.LocalMin) != VertexFlags.None)
            return;
        vert.flags |= VertexFlags.LocalMin;
        const lm = new LocalMinima(vert, polytype, isOpen);
        this._minimaList.push(lm);
    }
    addSubject(path) {
        this.addPath(path, PathType.Subject);
    }
    addOpenSubject(path) {
        this.addPath(path, PathType.Subject, true);
    }
    addClip(path) {
        this.addPath(path, PathType.Clip);
    }
    addPath(path, polytype, isOpen = false) {
        const tmp = [path];
        this.addPaths(tmp, polytype, isOpen);
    }
    addPaths(paths, polytype, isOpen = false) {
        if (isOpen)
            this._hasOpenPaths = true;
        this._isSortedMinimaList = false;
        ClipperEngine.addPathsToVertexList(paths, polytype, isOpen, this._minimaList, this._vertexList);
    }
    addReuseableData(reuseableData) {
        if (reuseableData._minimaList.length === 0)
            return;
        this._isSortedMinimaList = false;
        for (const lm of reuseableData._minimaList) {
            this._minimaList.push(new LocalMinima(lm.vertex, lm.polytype, lm.isOpen));
            if (lm.isOpen)
                this._hasOpenPaths = true;
        }
    }
    isContributingClosed(ae) {
        switch (this._fillrule) {
            case FillRule.Positive:
                if (ae.windCount !== 1)
                    return false;
                break;
            case FillRule.Negative:
                if (ae.windCount !== -1)
                    return false;
                break;
            case FillRule.NonZero:
                if (Math.abs(ae.windCount) !== 1)
                    return false;
                break;
        }
        switch (this._cliptype) {
            case ClipType.Intersection:
                switch (this._fillrule) {
                    case FillRule.Positive: return ae.windCount2 > 0;
                    case FillRule.Negative: return ae.windCount2 < 0;
                    default: return ae.windCount2 !== 0;
                }
            case ClipType.Union:
                switch (this._fillrule) {
                    case FillRule.Positive: return ae.windCount2 <= 0;
                    case FillRule.Negative: return ae.windCount2 >= 0;
                    default: return ae.windCount2 === 0;
                }
            case ClipType.Difference:
                const result = this._fillrule === FillRule.Positive ? (ae.windCount2 <= 0) :
                    this._fillrule === FillRule.Negative ? (ae.windCount2 >= 0) :
                        (ae.windCount2 === 0);
                return ClipperBase.getPolyType(ae) === PathType.Subject ? result : !result;
            case ClipType.Xor:
                return true;
            default:
                return false;
        }
    }
    isContributingOpen(ae) {
        let isInClip, isInSubj;
        switch (this._fillrule) {
            case FillRule.Positive:
                isInSubj = ae.windCount > 0;
                isInClip = ae.windCount2 > 0;
                break;
            case FillRule.Negative:
                isInSubj = ae.windCount < 0;
                isInClip = ae.windCount2 < 0;
                break;
            default:
                isInSubj = ae.windCount !== 0;
                isInClip = ae.windCount2 !== 0;
                break;
        }
        switch (this._cliptype) {
            case ClipType.Intersection:
                return isInClip;
            case ClipType.Union:
                return !isInSubj && !isInClip;
            default:
                return !isInClip;
        }
    }
    setWindCountForClosedPathEdge(ae) {
        let ae2 = ae.prevInAEL;
        const pt = ClipperBase.getPolyType(ae);
        while (ae2 !== undefined && (ClipperBase.getPolyType(ae2) !== pt || ClipperBase.isOpen(ae2))) {
            ae2 = ae2.prevInAEL;
        }
        if (ae2 === undefined) {
            ae.windCount = ae.windDx;
            ae2 = this._actives;
        }
        else if (this._fillrule === FillRule.EvenOdd) {
            ae.windCount = ae.windDx;
            ae.windCount2 = ae2.windCount2;
            ae2 = ae2.nextInAEL;
        }
        else {
            // NonZero, positive, or negative filling here ...
            // when e2's WindCnt is in the SAME direction as its WindDx,
            // then polygon will fill on the right of 'e2' (and 'e' will be inside)
            // nb: neither e2.WindCnt nor e2.WindDx should ever be 0.
            if (ae2.windCount * ae2.windDx < 0) {
                // opposite directions so 'ae' is outside 'ae2' ...
                if (Math.abs(ae2.windCount) > 1) {
                    // outside prev poly but still inside another.
                    if (ae2.windDx * ae.windDx < 0)
                        // reversing direction so use the same WC
                        ae.windCount = ae2.windCount;
                    else
                        // otherwise keep 'reducing' the WC by 1 (i.e. towards 0) ...
                        ae.windCount = ae2.windCount + ae.windDx;
                }
                else {
                    // now outside all polys of same polytype so set own WC ...
                    ae.windCount = (ClipperBase.isOpen(ae) ? 1 : ae.windDx);
                }
            }
            else {
                // 'ae' must be inside 'ae2'
                if (ae2.windDx * ae.windDx < 0)
                    // reversing direction so use the same WC
                    ae.windCount = ae2.windCount;
                else
                    // otherwise keep 'increasing' the WC by 1 (i.e. away from 0) ...
                    ae.windCount = ae2.windCount + ae.windDx;
            }
            ae.windCount2 = ae2.windCount2;
            ae2 = ae2.nextInAEL; // i.e. get ready to calc WindCnt2
        }
        if (this._fillrule === FillRule.EvenOdd) {
            while (ae2 !== ae) {
                if (ClipperBase.getPolyType(ae2) !== pt && !ClipperBase.isOpen(ae2)) {
                    ae.windCount2 = (ae.windCount2 === 0 ? 1 : 0);
                }
                ae2 = ae2.nextInAEL;
            }
        }
        else {
            while (ae2 !== ae) {
                if (ClipperBase.getPolyType(ae2) !== pt && !ClipperBase.isOpen(ae2)) {
                    ae.windCount2 += ae2.windDx;
                }
                ae2 = ae2.nextInAEL;
            }
        }
    }
    setWindCountForOpenPathEdge(ae) {
        let ae2 = this._actives;
        if (this._fillrule === FillRule.EvenOdd) {
            let cnt1 = 0, cnt2 = 0;
            while (ae2 !== ae) {
                if (ClipperBase.getPolyType(ae2) === PathType.Clip)
                    cnt2++;
                else if (!ClipperBase.isOpen(ae2))
                    cnt1++;
                ae2 = ae2.nextInAEL;
            }
            ae.windCount = (ClipperBase.isOdd(cnt1) ? 1 : 0);
            ae.windCount2 = (ClipperBase.isOdd(cnt2) ? 1 : 0);
        }
        else {
            while (ae2 !== ae) {
                if (ClipperBase.getPolyType(ae2) === PathType.Clip)
                    ae.windCount2 += ae2.windDx;
                else if (!ClipperBase.isOpen(ae2))
                    ae.windCount += ae2.windDx;
                ae2 = ae2.nextInAEL;
            }
        }
    }
    static isValidAelOrder(resident, newcomer) {
        if (newcomer.curX !== resident.curX)
            return newcomer.curX > resident.curX;
        // get the turning direction  a1.top, a2.bot, a2.top
        const d = InternalClipper.crossProduct(resident.top, newcomer.bot, newcomer.top);
        if (d !== 0.0)
            return (d < 0);
        // edges must be collinear to get here
        // for starting open paths, place them according to
        // the direction they're about to turn
        if (!this.isMaximaActive(resident) && (resident.top.y > newcomer.top.y)) {
            return InternalClipper.crossProduct(newcomer.bot, resident.top, this.nextVertex(resident).pt) <= 0;
        }
        if (!this.isMaximaActive(newcomer) && (newcomer.top.y > resident.top.y)) {
            return InternalClipper.crossProduct(newcomer.bot, newcomer.top, this.nextVertex(newcomer).pt) >= 0;
        }
        const y = newcomer.bot.y;
        const newcomerIsLeft = newcomer.isLeftBound;
        if (resident.bot.y !== y || resident.localMin.vertex.pt.y !== y)
            return newcomer.isLeftBound;
        // resident must also have just been inserted
        if (resident.isLeftBound !== newcomerIsLeft)
            return newcomerIsLeft;
        if (InternalClipper.crossProduct(this.prevPrevVertex(resident).pt, resident.bot, resident.top) === 0)
            return true;
        // compare turning direction of the alternate bound
        return (InternalClipper.crossProduct(this.prevPrevVertex(resident).pt, newcomer.bot, this.prevPrevVertex(newcomer).pt) > 0) === newcomerIsLeft;
    }
    insertLeftEdge(ae) {
        let ae2;
        if (!this._actives) {
            ae.prevInAEL = undefined;
            ae.nextInAEL = undefined;
            this._actives = ae;
        }
        else if (!ClipperBase.isValidAelOrder(this._actives, ae)) {
            ae.prevInAEL = undefined;
            ae.nextInAEL = this._actives;
            this._actives.prevInAEL = ae;
            this._actives = ae;
        }
        else {
            ae2 = this._actives;
            while (ae2.nextInAEL && ClipperBase.isValidAelOrder(ae2.nextInAEL, ae))
                ae2 = ae2.nextInAEL;
            //don't separate joined edges
            if (ae2.joinWith === JoinWith.Right)
                ae2 = ae2.nextInAEL;
            ae.nextInAEL = ae2.nextInAEL;
            if (ae2.nextInAEL)
                ae2.nextInAEL.prevInAEL = ae;
            ae.prevInAEL = ae2;
            ae2.nextInAEL = ae;
        }
    }
    static insertRightEdge(ae, ae2) {
        ae2.nextInAEL = ae.nextInAEL;
        if (ae.nextInAEL)
            ae.nextInAEL.prevInAEL = ae2;
        ae2.prevInAEL = ae;
        ae.nextInAEL = ae2;
    }
    insertLocalMinimaIntoAEL(botY) {
        let localMinima;
        let leftBound;
        let rightBound;
        // Add any local minima (if any) at BotY ...
        // NB horizontal local minima edges should contain locMin.vertex.prev
        while (this.hasLocMinAtY(botY)) {
            localMinima = this.popLocalMinima();
            if ((localMinima.vertex.flags & VertexFlags.OpenStart) !== VertexFlags.None) {
                leftBound = undefined;
            }
            else {
                leftBound = new Active();
                leftBound.bot = localMinima.vertex.pt;
                leftBound.curX = localMinima.vertex.pt.x;
                leftBound.windDx = -1;
                leftBound.vertexTop = localMinima.vertex.prev;
                leftBound.top = localMinima.vertex.prev.pt;
                leftBound.outrec = undefined;
                leftBound.localMin = localMinima;
                ClipperBase.setDx(leftBound);
            }
            if ((localMinima.vertex.flags & VertexFlags.OpenEnd) !== VertexFlags.None) {
                rightBound = undefined;
            }
            else {
                rightBound = new Active();
                rightBound.bot = localMinima.vertex.pt;
                rightBound.curX = localMinima.vertex.pt.x;
                rightBound.windDx = 1;
                rightBound.vertexTop = localMinima.vertex.next;
                rightBound.top = localMinima.vertex.next.pt;
                rightBound.outrec = undefined;
                rightBound.localMin = localMinima;
                ClipperBase.setDx(rightBound);
            }
            if (leftBound && rightBound) {
                if (ClipperBase.isHorizontal(leftBound)) {
                    if (ClipperBase.isHeadingRightHorz(leftBound)) {
                        [rightBound, leftBound] = [leftBound, rightBound];
                    }
                }
                else if (ClipperBase.isHorizontal(rightBound)) {
                    if (ClipperBase.isHeadingLeftHorz(rightBound)) {
                        [rightBound, leftBound] = [leftBound, rightBound];
                    }
                }
                else if (leftBound.dx < rightBound.dx) {
                    [rightBound, leftBound] = [leftBound, rightBound];
                }
                //so when leftBound has windDx == 1, the polygon will be oriented
                //counter-clockwise in Cartesian coords (clockwise with inverted Y).
            }
            else if (leftBound === undefined) {
                leftBound = rightBound;
                rightBound = undefined;
            }
            let contributing = false;
            leftBound.isLeftBound = true;
            this.insertLeftEdge(leftBound);
            if (ClipperBase.isOpen(leftBound)) {
                this.setWindCountForOpenPathEdge(leftBound);
                contributing = this.isContributingOpen(leftBound);
            }
            else {
                this.setWindCountForClosedPathEdge(leftBound);
                contributing = this.isContributingClosed(leftBound);
            }
            if (rightBound) {
                rightBound.windCount = leftBound.windCount;
                rightBound.windCount2 = leftBound.windCount2;
                ClipperBase.insertRightEdge(leftBound, rightBound);
                if (contributing) {
                    this.addLocalMinPoly(leftBound, rightBound, leftBound.bot, true);
                    if (!ClipperBase.isHorizontal(leftBound)) {
                        this.checkJoinLeft(leftBound, leftBound.bot);
                    }
                }
                while (rightBound.nextInAEL &&
                    ClipperBase.isValidAelOrder(rightBound.nextInAEL, rightBound)) {
                    this.intersectEdges(rightBound, rightBound.nextInAEL, rightBound.bot);
                    this.swapPositionsInAEL(rightBound, rightBound.nextInAEL);
                }
                if (ClipperBase.isHorizontal(rightBound)) {
                    this.pushHorz(rightBound);
                }
                else {
                    this.checkJoinRight(rightBound, rightBound.bot);
                    this.insertScanline(rightBound.top.y);
                }
            }
            else if (contributing) {
                this.startOpenPath(leftBound, leftBound.bot);
            }
            if (ClipperBase.isHorizontal(leftBound)) {
                this.pushHorz(leftBound);
            }
            else {
                this.insertScanline(leftBound.top.y);
            }
        }
    }
    pushHorz(ae) {
        ae.nextInSEL = this._sel;
        this._sel = ae;
    }
    popHorz() {
        const ae = this._sel;
        if (this._sel === undefined)
            return undefined;
        this._sel = this._sel.nextInSEL;
        return ae;
    }
    addLocalMinPoly(ae1, ae2, pt, isNew = false) {
        const outrec = this.newOutRec();
        ae1.outrec = outrec;
        ae2.outrec = outrec;
        if (ClipperBase.isOpen(ae1)) {
            outrec.owner = undefined;
            outrec.isOpen = true;
            if (ae1.windDx > 0)
                ClipperBase.setSides(outrec, ae1, ae2);
            else
                ClipperBase.setSides(outrec, ae2, ae1);
        }
        else {
            outrec.isOpen = false;
            const prevHotEdge = ClipperBase.getPrevHotEdge(ae1);
            // e.windDx is the winding direction of the **input** paths
            // and unrelated to the winding direction of output polygons.
            // Output orientation is determined by e.outrec.frontE which is
            // the ascending edge (see AddLocalMinPoly).
            if (prevHotEdge) {
                if (this._using_polytree)
                    ClipperBase.setOwner(outrec, prevHotEdge.outrec);
                outrec.owner = prevHotEdge.outrec;
                if (ClipperBase.outrecIsAscending(prevHotEdge) === isNew)
                    ClipperBase.setSides(outrec, ae2, ae1);
                else
                    ClipperBase.setSides(outrec, ae1, ae2);
            }
            else {
                outrec.owner = undefined;
                if (isNew)
                    ClipperBase.setSides(outrec, ae1, ae2);
                else
                    ClipperBase.setSides(outrec, ae2, ae1);
            }
        }
        const op = new OutPt(pt, outrec);
        outrec.pts = op;
        return op;
    }
    addLocalMaxPoly(ae1, ae2, pt) {
        if (ClipperBase.isJoined(ae1))
            this.split(ae1, pt);
        if (ClipperBase.isJoined(ae2))
            this.split(ae2, pt);
        if (ClipperBase.isFront(ae1) === ClipperBase.isFront(ae2)) {
            if (ClipperBase.isOpenEndActive(ae1))
                ClipperBase.swapFrontBackSides(ae1.outrec);
            else if (ClipperBase.isOpenEndActive(ae2))
                ClipperBase.swapFrontBackSides(ae2.outrec);
            else {
                this._succeeded = false;
                return undefined;
            }
        }
        const result = ClipperBase.addOutPt(ae1, pt);
        if (ae1.outrec === ae2.outrec) {
            const outrec = ae1.outrec;
            outrec.pts = result;
            if (this._using_polytree) {
                const e = ClipperBase.getPrevHotEdge(ae1);
                if (e === undefined)
                    outrec.owner = undefined;
                else
                    ClipperBase.setOwner(outrec, e.outrec);
            }
            ClipperBase.uncoupleOutRec(ae1);
        }
        else if (ClipperBase.isOpen(ae1)) {
            if (ae1.windDx < 0)
                ClipperBase.joinOutrecPaths(ae1, ae2);
            else
                ClipperBase.joinOutrecPaths(ae2, ae1);
        }
        else if (ae1.outrec.idx < ae2.outrec.idx)
            ClipperBase.joinOutrecPaths(ae1, ae2);
        else
            ClipperBase.joinOutrecPaths(ae2, ae1);
        return result;
    }
    static joinOutrecPaths(ae1, ae2) {
        // join ae2 outrec path onto ae1 outrec path and then delete ae2 outrec path
        // pointers. (NB Only very rarely do the joining ends share the same coords.)
        const p1Start = ae1.outrec.pts;
        const p2Start = ae2.outrec.pts;
        const p1End = p1Start.next;
        const p2End = p2Start.next;
        if (ClipperBase.isFront(ae1)) {
            p2End.prev = p1Start;
            p1Start.next = p2End;
            p2Start.next = p1End;
            p1End.prev = p2Start;
            ae1.outrec.pts = p2Start;
            // nb: if IsOpen(e1) then e1 & e2 must be a 'maximaPair'
            ae1.outrec.frontEdge = ae2.outrec.frontEdge;
            if (ae1.outrec.frontEdge)
                ae1.outrec.frontEdge.outrec = ae1.outrec;
        }
        else {
            p1End.prev = p2Start;
            p2Start.next = p1End;
            p1Start.next = p2End;
            p2End.prev = p1Start;
            ae1.outrec.backEdge = ae2.outrec.backEdge;
            if (ae1.outrec.backEdge)
                ae1.outrec.backEdge.outrec = ae1.outrec;
        }
        // after joining, the ae2.OutRec must contains no vertices ...
        ae2.outrec.frontEdge = undefined;
        ae2.outrec.backEdge = undefined;
        ae2.outrec.pts = undefined;
        ClipperBase.setOwner(ae2.outrec, ae1.outrec);
        if (ClipperBase.isOpenEndActive(ae1)) {
            ae2.outrec.pts = ae1.outrec.pts;
            ae1.outrec.pts = undefined;
        }
        // and ae1 and ae2 are maxima and are about to be dropped from the Actives list.
        ae1.outrec = undefined;
        ae2.outrec = undefined;
    }
    static addOutPt(ae, pt) {
        const outrec = ae.outrec;
        const toFront = ClipperBase.isFront(ae);
        const opFront = outrec.pts;
        const opBack = opFront.next;
        if (toFront && (pt == opFront.pt))
            return opFront;
        else if (!toFront && (pt == opBack.pt))
            return opBack;
        const newOp = new OutPt(pt, outrec);
        opBack.prev = newOp;
        newOp.prev = opFront;
        newOp.next = opBack;
        opFront.next = newOp;
        if (toFront)
            outrec.pts = newOp;
        return newOp;
    }
    newOutRec() {
        const result = new OutRec(this._outrecList.length);
        this._outrecList.push(result);
        return result;
    }
    startOpenPath(ae, pt) {
        const outrec = this.newOutRec();
        outrec.isOpen = true;
        if (ae.windDx > 0) {
            outrec.frontEdge = ae;
            outrec.backEdge = undefined;
        }
        else {
            outrec.frontEdge = undefined;
            outrec.backEdge = ae;
        }
        ae.outrec = outrec;
        const op = new OutPt(pt, outrec);
        outrec.pts = op;
        return op;
    }
    updateEdgeIntoAEL(ae) {
        ae.bot = ae.top;
        ae.vertexTop = ClipperBase.nextVertex(ae);
        ae.top = ae.vertexTop.pt;
        ae.curX = ae.bot.x;
        ClipperBase.setDx(ae);
        if (ClipperBase.isJoined(ae))
            this.split(ae, ae.bot);
        if (ClipperBase.isHorizontal(ae))
            return;
        this.insertScanline(ae.top.y);
        this.checkJoinLeft(ae, ae.bot);
        this.checkJoinRight(ae, ae.bot, true);
    }
    static findEdgeWithMatchingLocMin(e) {
        let result = e.nextInAEL;
        while (result) {
            if (result.localMin === e.localMin)
                return result;
            if (!ClipperBase.isHorizontal(result) && e.bot !== result.bot)
                result = undefined;
            else
                result = result.nextInAEL;
        }
        result = e.prevInAEL;
        while (result) {
            if (result.localMin === e.localMin)
                return result;
            if (!ClipperBase.isHorizontal(result) && e.bot !== result.bot)
                return undefined;
            result = result.prevInAEL;
        }
        return result;
    }
    intersectEdges(ae1, ae2, pt) {
        let resultOp = undefined;
        // MANAGE OPEN PATH INTERSECTIONS SEPARATELY ...
        if (this._hasOpenPaths && (ClipperBase.isOpen(ae1) || ClipperBase.isOpen(ae2))) {
            if (ClipperBase.isOpen(ae1) && ClipperBase.isOpen(ae2))
                return undefined;
            // the following line avoids duplicating quite a bit of code
            if (ClipperBase.isOpen(ae2))
                ClipperBase.swapActives(ae1, ae2);
            if (ClipperBase.isJoined(ae2))
                this.split(ae2, pt);
            if (this._cliptype === ClipType.Union) {
                if (!ClipperBase.isHotEdgeActive(ae2))
                    return undefined;
            }
            else if (ae2.localMin.polytype === PathType.Subject)
                return undefined;
            switch (this._fillrule) {
                case FillRule.Positive:
                    if (ae2.windCount !== 1)
                        return undefined;
                    break;
                case FillRule.Negative:
                    if (ae2.windCount !== -1)
                        return undefined;
                    break;
                default:
                    if (Math.abs(ae2.windCount) !== 1)
                        return undefined;
                    break;
            }
            // toggle contribution ...
            if (ClipperBase.isHotEdgeActive(ae1)) {
                resultOp = ClipperBase.addOutPt(ae1, pt);
                if (ClipperBase.isFront(ae1)) {
                    ae1.outrec.frontEdge = undefined;
                }
                else {
                    ae1.outrec.backEdge = undefined;
                }
                ae1.outrec = undefined;
                // horizontal edges can pass under open paths at a LocMins
            }
            else if (pt === ae1.localMin.vertex.pt && !ClipperBase.isOpenEnd(ae1.localMin.vertex)) {
                // find the other side of the LocMin and
                // if it's 'hot' join up with it ...
                const ae3 = ClipperBase.findEdgeWithMatchingLocMin(ae1);
                if (ae3 && ClipperBase.isHotEdgeActive(ae3)) {
                    ae1.outrec = ae3.outrec;
                    if (ae1.windDx > 0) {
                        ClipperBase.setSides(ae3.outrec, ae1, ae3);
                    }
                    else {
                        ClipperBase.setSides(ae3.outrec, ae3, ae1);
                    }
                    return ae3.outrec.pts;
                }
                resultOp = this.startOpenPath(ae1, pt);
            }
            else {
                resultOp = this.startOpenPath(ae1, pt);
            }
            return resultOp;
        }
        // MANAGING CLOSED PATHS FROM HERE ON
        if (ClipperBase.isJoined(ae1))
            this.split(ae1, pt);
        if (ClipperBase.isJoined(ae2))
            this.split(ae2, pt);
        // UPDATE WINDING COUNTS...
        let oldE1WindCount;
        let oldE2WindCount;
        if (ae1.localMin.polytype === ae2.localMin.polytype) {
            if (this._fillrule === FillRule.EvenOdd) {
                oldE1WindCount = ae1.windCount;
                ae1.windCount = ae2.windCount;
                ae2.windCount = oldE1WindCount;
            }
            else {
                if (ae1.windCount + ae2.windDx === 0)
                    ae1.windCount = -ae1.windCount;
                else
                    ae1.windCount += ae2.windDx;
                if (ae2.windCount - ae1.windDx === 0)
                    ae2.windCount = -ae2.windCount;
                else
                    ae2.windCount -= ae1.windDx;
            }
        }
        else {
            if (this._fillrule !== FillRule.EvenOdd)
                ae1.windCount2 += ae2.windDx;
            else
                ae1.windCount2 = (ae1.windCount2 === 0 ? 1 : 0);
            if (this._fillrule !== FillRule.EvenOdd)
                ae2.windCount2 -= ae1.windDx;
            else
                ae2.windCount2 = (ae2.windCount2 === 0 ? 1 : 0);
        }
        switch (this._fillrule) {
            case FillRule.Positive:
                oldE1WindCount = ae1.windCount;
                oldE2WindCount = ae2.windCount;
                break;
            case FillRule.Negative:
                oldE1WindCount = -ae1.windCount;
                oldE2WindCount = -ae2.windCount;
                break;
            default:
                oldE1WindCount = Math.abs(ae1.windCount);
                oldE2WindCount = Math.abs(ae2.windCount);
                break;
        }
        const e1WindCountIs0or1 = oldE1WindCount === 0 || oldE1WindCount === 1;
        const e2WindCountIs0or1 = oldE2WindCount === 0 || oldE2WindCount === 1;
        if ((!ClipperBase.isHotEdgeActive(ae1) && !e1WindCountIs0or1) || (!ClipperBase.isHotEdgeActive(ae2) && !e2WindCountIs0or1))
            return undefined;
        // NOW PROCESS THE INTERSECTION ...
        // if both edges are 'hot' ...
        if (ClipperBase.isHotEdgeActive(ae1) && ClipperBase.isHotEdgeActive(ae2)) {
            if ((oldE1WindCount !== 0 && oldE1WindCount !== 1) ||
                (oldE2WindCount !== 0 && oldE2WindCount !== 1) ||
                (ae1.localMin.polytype !== ae2.localMin.polytype &&
                    this._cliptype !== ClipType.Xor)) {
                resultOp = this.addLocalMaxPoly(ae1, ae2, pt);
            }
            else if (ClipperBase.isFront(ae1) || (ae1.outrec === ae2.outrec)) {
                // this 'else if' condition isn't strictly needed but
                // it's sensible to split polygons that only touch at
                // a common vertex (not at common edges).
                resultOp = this.addLocalMaxPoly(ae1, ae2, pt);
                this.addLocalMinPoly(ae1, ae2, pt);
            }
            else {
                // can't treat as maxima & minima
                resultOp = ClipperBase.addOutPt(ae1, pt);
                ClipperBase.addOutPt(ae2, pt);
                ClipperBase.swapOutrecs(ae1, ae2);
            }
        }
        // if one or the other edge is 'hot' ...
        else if (ClipperBase.isHotEdgeActive(ae1)) {
            resultOp = ClipperBase.addOutPt(ae1, pt);
            ClipperBase.swapOutrecs(ae1, ae2);
        }
        else if (ClipperBase.isHotEdgeActive(ae2)) {
            resultOp = ClipperBase.addOutPt(ae2, pt);
            ClipperBase.swapOutrecs(ae1, ae2);
        }
        // neither edge is 'hot'
        else {
            let e1Wc2;
            let e2Wc2;
            switch (this._fillrule) {
                case FillRule.Positive:
                    e1Wc2 = ae1.windCount2;
                    e2Wc2 = ae2.windCount2;
                    break;
                case FillRule.Negative:
                    e1Wc2 = -ae1.windCount2;
                    e2Wc2 = -ae2.windCount2;
                    break;
                default:
                    e1Wc2 = Math.abs(ae1.windCount2);
                    e2Wc2 = Math.abs(ae2.windCount2);
                    break;
            }
            if (!ClipperBase.isSamePolyType(ae1, ae2)) {
                resultOp = this.addLocalMinPoly(ae1, ae2, pt);
            }
            else if (oldE1WindCount === 1 && oldE2WindCount === 1) {
                resultOp = undefined;
                switch (this._cliptype) {
                    case ClipType.Union:
                        if (e1Wc2 > 0 && e2Wc2 > 0)
                            return undefined;
                        resultOp = this.addLocalMinPoly(ae1, ae2, pt);
                        break;
                    case ClipType.Difference:
                        if (((ClipperBase.getPolyType(ae1) === PathType.Clip) && (e1Wc2 > 0) && (e2Wc2 > 0)) ||
                            ((ClipperBase.getPolyType(ae1) === PathType.Subject) && (e1Wc2 <= 0) && (e2Wc2 <= 0))) {
                            resultOp = this.addLocalMinPoly(ae1, ae2, pt);
                        }
                        break;
                    case ClipType.Xor:
                        resultOp = this.addLocalMinPoly(ae1, ae2, pt);
                        break;
                    default: // ClipType.Intersection:
                        if (e1Wc2 <= 0 || e2Wc2 <= 0)
                            return undefined;
                        resultOp = this.addLocalMinPoly(ae1, ae2, pt);
                        break;
                }
            }
        }
        return resultOp;
    }
    deleteFromAEL(ae) {
        const prev = ae.prevInAEL;
        const next = ae.nextInAEL;
        if (!prev && !next && ae !== this._actives)
            return; // already deleted
        if (prev)
            prev.nextInAEL = next;
        else
            this._actives = next;
        if (next)
            next.prevInAEL = prev;
    }
    adjustCurrXAndCopyToSEL(topY) {
        let ae = this._actives;
        this._sel = ae;
        while (ae) {
            ae.prevInSEL = ae.prevInAEL;
            ae.nextInSEL = ae.nextInAEL;
            ae.jump = ae.nextInSEL;
            if (ae.joinWith === JoinWith.Left)
                ae.curX = ae.prevInAEL.curX; // This also avoids complications
            else
                ae.curX = ClipperBase.topX(ae, topY);
            // NB don't update ae.curr.Y yet (see AddNewIntersectNode)
            ae = ae.nextInAEL;
        }
    }
    executeInternal(ct, fillRule) {
        if (ct === ClipType.None)
            return;
        this._fillrule = fillRule;
        this._cliptype = ct;
        this.reset();
        let y = this.popScanline();
        if (y === undefined)
            return;
        while (this._succeeded) {
            this.insertLocalMinimaIntoAEL(y);
            let ae = this.popHorz();
            while (ae) {
                this.doHorizontal(ae);
                ae = this.popHorz();
            }
            if (this._horzSegList.length > 0) {
                this.convertHorzSegsToJoins();
                this._horzSegList.length = 0;
            }
            this._currentBotY = y; // bottom of scanbeam
            y = this.popScanline();
            if (y === undefined)
                break; // y new top of scanbeam
            this.doIntersections(y);
            this.doTopOfScanbeam(y);
            ae = this.popHorz();
            while (ae) {
                this.doHorizontal(ae);
                ae = this.popHorz();
            }
        }
        if (this._succeeded)
            this.processHorzJoins();
    }
    doIntersections(topY) {
        if (this.buildIntersectList(topY)) {
            this.processIntersectList();
            this.disposeIntersectNodes();
        }
    }
    disposeIntersectNodes() {
        this._intersectList.length = 0;
    }
    addNewIntersectNode(ae1, ae2, topY) {
        const result = InternalClipper.getIntersectPt(ae1.bot, ae1.top, ae2.bot, ae2.top);
        let ip = result.ip;
        if (!result.success) {
            ip = new Point64(ae1.curX, topY);
        }
        if (ip.y > this._currentBotY || ip.y < topY) {
            const absDx1 = Math.abs(ae1.dx);
            const absDx2 = Math.abs(ae2.dx);
            if (absDx1 > 100 && absDx2 > 100) {
                if (absDx1 > absDx2) {
                    ip = InternalClipper.getClosestPtOnSegment(ip, ae1.bot, ae1.top);
                }
                else {
                    ip = InternalClipper.getClosestPtOnSegment(ip, ae2.bot, ae2.top);
                }
            }
            else if (absDx1 > 100) {
                ip = InternalClipper.getClosestPtOnSegment(ip, ae1.bot, ae1.top);
            }
            else if (absDx2 > 100) {
                ip = InternalClipper.getClosestPtOnSegment(ip, ae2.bot, ae2.top);
            }
            else {
                if (ip.y < topY) {
                    ip.y = topY;
                }
                else {
                    ip.y = this._currentBotY;
                }
                if (absDx1 < absDx2) {
                    ip.x = ClipperBase.topX(ae1, ip.y);
                }
                else {
                    ip.x = ClipperBase.topX(ae2, ip.y);
                }
            }
        }
        const node = new IntersectNode(ip, ae1, ae2);
        this._intersectList.push(node);
    }
    static extractFromSEL(ae) {
        const res = ae.nextInSEL;
        if (res) {
            res.prevInSEL = ae.prevInSEL;
        }
        ae.prevInSEL.nextInSEL = res;
        return res;
    }
    static insert1Before2InSEL(ae1, ae2) {
        ae1.prevInSEL = ae2.prevInSEL;
        if (ae1.prevInSEL) {
            ae1.prevInSEL.nextInSEL = ae1;
        }
        ae1.nextInSEL = ae2;
        ae2.prevInSEL = ae1;
    }
    buildIntersectList(topY) {
        if (!this._actives || !this._actives.nextInAEL)
            return false;
        // Calculate edge positions at the top of the current scanbeam, and from this
        // we will determine the intersections required to reach these new positions.
        this.adjustCurrXAndCopyToSEL(topY);
        // Find all edge intersections in the current scanbeam using a stable merge
        // sort that ensures only adjacent edges are intersecting. Intersect info is
        // stored in FIntersectList ready to be processed in ProcessIntersectList.
        // Re merge sorts see https://stackoverflow.com/a/46319131/359538
        let left = this._sel, right, lEnd, rEnd, currBase, prevBase, tmp;
        while (left.jump) {
            prevBase = undefined;
            while (left && left.jump) {
                currBase = left;
                right = left.jump;
                lEnd = right;
                rEnd = right.jump;
                left.jump = rEnd;
                while (left !== lEnd && right !== rEnd) {
                    if (right.curX < left.curX) {
                        tmp = right.prevInSEL;
                        for (;;) {
                            this.addNewIntersectNode(tmp, right, topY);
                            if (tmp === left)
                                break;
                            tmp = tmp.prevInSEL;
                        }
                        tmp = right;
                        right = ClipperBase.extractFromSEL(tmp);
                        lEnd = right;
                        ClipperBase.insert1Before2InSEL(tmp, left);
                        if (left === currBase) {
                            currBase = tmp;
                            currBase.jump = rEnd;
                            if (prevBase === undefined)
                                this._sel = currBase;
                            else
                                prevBase.jump = currBase;
                        }
                    }
                    else {
                        left = left.nextInSEL;
                    }
                }
                prevBase = currBase;
                left = rEnd;
            }
            left = this._sel;
        }
        return this._intersectList.length > 0;
    }
    processIntersectList() {
        // We now have a list of intersections required so that edges will be
        // correctly positioned at the top of the scanbeam. However, it's important
        // that edge intersections are processed from the bottom up, but it's also
        // crucial that intersections only occur between adjacent edges.
        // First we do a quicksort so intersections proceed in a bottom up order ...
        this._intersectList.sort((a, b) => {
            if (a.pt.y === b.pt.y) {
                if (a.pt.x === b.pt.x)
                    return 0;
                return (a.pt.x < b.pt.x) ? -1 : 1;
            }
            return (a.pt.y > b.pt.y) ? -1 : 1;
        });
        // Now as we process these intersections, we must sometimes adjust the order
        // to ensure that intersecting edges are always adjacent ...
        for (let i = 0; i < this._intersectList.length; ++i) {
            if (!ClipperBase.edgesAdjacentInAEL(this._intersectList[i])) {
                let j = i + 1;
                while (!ClipperBase.edgesAdjacentInAEL(this._intersectList[j]))
                    j++;
                // swap
                [this._intersectList[j], this._intersectList[i]] =
                    [this._intersectList[i], this._intersectList[j]];
            }
            const node = this._intersectList[i];
            this.intersectEdges(node.edge1, node.edge2, node.pt);
            this.swapPositionsInAEL(node.edge1, node.edge2);
            node.edge1.curX = node.pt.x;
            node.edge2.curX = node.pt.x;
            this.checkJoinLeft(node.edge2, node.pt, true);
            this.checkJoinRight(node.edge1, node.pt, true);
        }
    }
    swapPositionsInAEL(ae1, ae2) {
        // preconditon: ae1 must be immediately to the left of ae2
        const next = ae2.nextInAEL;
        if (next)
            next.prevInAEL = ae1;
        const prev = ae1.prevInAEL;
        if (prev)
            prev.nextInAEL = ae2;
        ae2.prevInAEL = prev;
        ae2.nextInAEL = ae1;
        ae1.prevInAEL = ae2;
        ae1.nextInAEL = next;
        if (!ae2.prevInAEL)
            this._actives = ae2;
    }
    static resetHorzDirection(horz, vertexMax) {
        let leftX, rightX;
        if (horz.bot.x === horz.top.x) {
            // the horizontal edge is going nowhere ...
            leftX = horz.curX;
            rightX = horz.curX;
            let ae = horz.nextInAEL;
            while (ae && ae.vertexTop !== vertexMax)
                ae = ae.nextInAEL;
            return { isLeftToRight: ae !== undefined, leftX, rightX };
        }
        if (horz.curX < horz.top.x) {
            leftX = horz.curX;
            rightX = horz.top.x;
            return { isLeftToRight: true, leftX, rightX };
        }
        leftX = horz.top.x;
        rightX = horz.curX;
        return { isLeftToRight: false, leftX, rightX }; // right to left
    }
    static horzIsSpike(horz) {
        const nextPt = ClipperBase.nextVertex(horz).pt;
        return (horz.bot.x < horz.top.x) !== (horz.top.x < nextPt.x);
    }
    static trimHorz(horzEdge, preserveCollinear) {
        let wasTrimmed = false;
        let pt = ClipperBase.nextVertex(horzEdge).pt;
        while (pt.y === horzEdge.top.y) {
            // always trim 180 deg. spikes (in closed paths)
            // but otherwise break if preserveCollinear = true
            if (preserveCollinear &&
                (pt.x < horzEdge.top.x) !== (horzEdge.bot.x < horzEdge.top.x)) {
                break;
            }
            horzEdge.vertexTop = ClipperBase.nextVertex(horzEdge);
            horzEdge.top = pt;
            wasTrimmed = true;
            if (ClipperBase.isMaximaActive(horzEdge))
                break;
            pt = ClipperBase.nextVertex(horzEdge).pt;
        }
        if (wasTrimmed)
            ClipperBase.setDx(horzEdge); // +/-infinity
    }
    addToHorzSegList(op) {
        if (op.outrec.isOpen)
            return;
        this._horzSegList.push(new HorzSegment(op));
    }
    getLastOp(hotEdge) {
        const outrec = hotEdge.outrec;
        return (hotEdge === outrec.frontEdge) ?
            outrec.pts : outrec.pts.next;
    }
    /*******************************************************************************
    * Notes: Horizontal edges (HEs) at scanline intersections (i.e. at the top or    *
    * bottom of a scanbeam) are processed as if layered.The order in which HEs     *
    * are processed doesn't matter. HEs intersect with the bottom vertices of      *
    * other HEs[#] and with non-horizontal edges [*]. Once these intersections     *
    * are completed, intermediate HEs are 'promoted' to the next edge in their     *
    * bounds, and they in turn may be intersected[%] by other HEs.                 *
    *                                                                              *
    * eg: 3 horizontals at a scanline:    /   |                     /           /  *
    *              |                     /    |     (HE3)o ========%========== o   *
    *              o ======= o(HE2)     /     |         /         /                *
    *          o ============#=========*======*========#=========o (HE1)           *
    *         /              |        /       |       /                            *
    *******************************************************************************/
    doHorizontal(horz) {
        let pt;
        const horzIsOpen = ClipperBase.isOpen(horz);
        const Y = horz.bot.y;
        const vertex_max = horzIsOpen ?
            ClipperBase.getCurrYMaximaVertex_Open(horz) :
            ClipperBase.getCurrYMaximaVertex(horz);
        // remove 180 deg.spikes and also simplify
        // consecutive horizontals when PreserveCollinear = true
        if (vertex_max && !horzIsOpen && vertex_max !== horz.vertexTop)
            ClipperBase.trimHorz(horz, this.preserveCollinear);
        let { isLeftToRight, leftX, rightX } = ClipperBase.resetHorzDirection(horz, vertex_max);
        if (ClipperBase.isHotEdgeActive(horz)) {
            const op = ClipperBase.addOutPt(horz, new Point64(horz.curX, Y));
            this.addToHorzSegList(op);
        }
        for (;;) {
            // loops through consec. horizontal edges (if open)
            let ae = isLeftToRight ? horz.nextInAEL : horz.prevInAEL;
            while (ae) {
                if (ae.vertexTop === vertex_max) {
                    // do this first!!
                    if (ClipperBase.isHotEdgeActive(horz) && ClipperBase.isJoined(ae))
                        this.split(ae, ae.top);
                    if (ClipperBase.isHotEdgeActive(horz)) {
                        while (horz.vertexTop !== vertex_max) {
                            ClipperBase.addOutPt(horz, horz.top);
                            this.updateEdgeIntoAEL(horz);
                        }
                        if (isLeftToRight)
                            this.addLocalMaxPoly(horz, ae, horz.top);
                        else
                            this.addLocalMaxPoly(ae, horz, horz.top);
                    }
                    this.deleteFromAEL(ae);
                    this.deleteFromAEL(horz);
                    return;
                }
                // if horzEdge is a maxima, keep going until we reach
                // its maxima pair, otherwise check for break conditions
                if (vertex_max !== horz.vertexTop || ClipperBase.isOpenEndActive(horz)) {
                    // otherwise stop when 'ae' is beyond the end of the horizontal line
                    if ((isLeftToRight && ae.curX > rightX) || (!isLeftToRight && ae.curX < leftX))
                        break;
                    if (ae.curX === horz.top.x && !ClipperBase.isHorizontal(ae)) {
                        pt = ClipperBase.nextVertex(horz).pt;
                        // to maximize the possibility of putting open edges into
                        // solutions, we'll only break if it's past HorzEdge's end
                        if (ClipperBase.isOpen(ae) && !ClipperBase.isSamePolyType(ae, horz) && !ClipperBase.isHotEdgeActive(ae)) {
                            if ((isLeftToRight && (ClipperBase.topX(ae, pt.y) > pt.x)) || (!isLeftToRight && (ClipperBase.topX(ae, pt.y) < pt.x)))
                                break;
                        }
                        // otherwise for edges at horzEdge's end, only stop when horzEdge's
                        // outslope is greater than e's slope when heading right or when
                        // horzEdge's outslope is less than e's slope when heading left.
                        else if ((isLeftToRight && (ClipperBase.topX(ae, pt.y) >= pt.x)) || (!isLeftToRight && (ClipperBase.topX(ae, pt.y) <= pt.x)))
                            break;
                    }
                }
                pt = new Point64(ae.curX, Y);
                if (isLeftToRight) {
                    this.intersectEdges(horz, ae, pt);
                    this.swapPositionsInAEL(horz, ae);
                    horz.curX = ae.curX;
                    ae = horz.nextInAEL;
                }
                else {
                    this.intersectEdges(ae, horz, pt);
                    this.swapPositionsInAEL(ae, horz);
                    horz.curX = ae.curX;
                    ae = horz.prevInAEL;
                }
                if (ClipperBase.isHotEdgeActive(horz))
                    this.addToHorzSegList(this.getLastOp(horz));
            } // we've reached the end of this horizontal
            // check if we've finished looping
            // through consecutive horizontals
            if (horzIsOpen && ClipperBase.isOpenEndActive(horz)) { // ie open at top
                if (ClipperBase.isHotEdgeActive(horz)) {
                    ClipperBase.addOutPt(horz, horz.top);
                    if (ClipperBase.isFront(horz))
                        horz.outrec.frontEdge = undefined;
                    else
                        horz.outrec.backEdge = undefined;
                    horz.outrec = undefined;
                }
                this.deleteFromAEL(horz);
                return;
            }
            else if (ClipperBase.nextVertex(horz).pt.y !== horz.top.y)
                break;
            // still more horizontals in bound to process ...
            if (ClipperBase.isHotEdgeActive(horz)) {
                ClipperBase.addOutPt(horz, horz.top);
            }
            this.updateEdgeIntoAEL(horz);
            if (this.preserveCollinear && !horzIsOpen && ClipperBase.horzIsSpike(horz)) {
                ClipperBase.trimHorz(horz, true);
            }
            const result = ClipperBase.resetHorzDirection(horz, vertex_max);
            isLeftToRight = result.isLeftToRight;
            leftX = result.leftX;
            rightX = result.rightX;
        }
        if (ClipperBase.isHotEdgeActive(horz)) {
            const op = ClipperBase.addOutPt(horz, horz.top);
            this.addToHorzSegList(op);
        }
        this.updateEdgeIntoAEL(horz);
    }
    doTopOfScanbeam(y) {
        this._sel = undefined; // _sel is reused to flag horizontals (see pushHorz below)
        let ae = this._actives;
        while (ae) {
            // NB 'ae' will never be horizontal here
            if (ae.top.y === y) {
                ae.curX = ae.top.x;
                if (ClipperBase.isMaximaActive(ae)) {
                    ae = this.doMaxima(ae); // TOP OF BOUND (MAXIMA)
                    continue;
                }
                // INTERMEDIATE VERTEX ...
                if (ClipperBase.isHotEdgeActive(ae))
                    ClipperBase.addOutPt(ae, ae.top);
                this.updateEdgeIntoAEL(ae);
                if (ClipperBase.isHorizontal(ae))
                    this.pushHorz(ae); // horizontals are processed later
            }
            else { // i.e. not the top of the edge
                ae.curX = ClipperBase.topX(ae, y);
            }
            ae = ae.nextInAEL;
        }
    }
    doMaxima(ae) {
        const prevE = ae.prevInAEL;
        let nextE = ae.nextInAEL;
        if (ClipperBase.isOpenEndActive(ae)) {
            if (ClipperBase.isHotEdgeActive(ae))
                ClipperBase.addOutPt(ae, ae.top);
            if (!ClipperBase.isHorizontal(ae)) {
                if (ClipperBase.isHotEdgeActive(ae)) {
                    if (ClipperBase.isFront(ae))
                        ae.outrec.frontEdge = undefined;
                    else
                        ae.outrec.backEdge = undefined;
                    ae.outrec = undefined;
                }
                this.deleteFromAEL(ae);
            }
            return nextE;
        }
        const maxPair = ClipperBase.getMaximaPair(ae);
        if (!maxPair)
            return nextE; // eMaxPair is horizontal
        if (ClipperBase.isJoined(ae))
            this.split(ae, ae.top);
        if (ClipperBase.isJoined(maxPair))
            this.split(maxPair, maxPair.top);
        // only non-horizontal maxima here.
        // process any edges between maxima pair ...
        while (nextE !== maxPair) {
            this.intersectEdges(ae, nextE, ae.top);
            this.swapPositionsInAEL(ae, nextE);
            nextE = ae.nextInAEL;
        }
        if (ClipperBase.isOpen(ae)) {
            if (ClipperBase.isHotEdgeActive(ae))
                this.addLocalMaxPoly(ae, maxPair, ae.top);
            this.deleteFromAEL(maxPair);
            this.deleteFromAEL(ae);
            return (prevE ? prevE.nextInAEL : this._actives);
        }
        // here ae.nextInAel == ENext == EMaxPair ...
        if (ClipperBase.isHotEdgeActive(ae))
            this.addLocalMaxPoly(ae, maxPair, ae.top);
        this.deleteFromAEL(ae);
        this.deleteFromAEL(maxPair);
        return (prevE ? prevE.nextInAEL : this._actives);
    }
    static isJoined(e) {
        return e.joinWith !== JoinWith.None;
    }
    split(e, currPt) {
        if (e.joinWith === JoinWith.Right) {
            e.joinWith = JoinWith.None;
            e.nextInAEL.joinWith = JoinWith.None;
            this.addLocalMinPoly(e, e.nextInAEL, currPt, true);
        }
        else {
            e.joinWith = JoinWith.None;
            e.prevInAEL.joinWith = JoinWith.None;
            this.addLocalMinPoly(e.prevInAEL, e, currPt, true);
        }
    }
    checkJoinLeft(e, pt, checkCurrX = false) {
        const prev = e.prevInAEL;
        if (!prev || ClipperBase.isOpen(e) || ClipperBase.isOpen(prev) ||
            !ClipperBase.isHotEdgeActive(e) || !ClipperBase.isHotEdgeActive(prev))
            return;
        if ((pt.y < e.top.y + 2 || pt.y < prev.top.y + 2) && // avoid trivial joins
            ((e.bot.y > pt.y) || (prev.bot.y > pt.y)))
            return; // (#490)
        if (checkCurrX) {
            if (Clipper.perpendicDistFromLineSqrd(pt, prev.bot, prev.top) > 0.25)
                return;
        }
        else if (e.curX !== prev.curX)
            return;
        if (InternalClipper.crossProduct(e.top, pt, prev.top) !== 0)
            return;
        if (e.outrec.idx === prev.outrec.idx)
            this.addLocalMaxPoly(prev, e, pt);
        else if (e.outrec.idx < prev.outrec.idx)
            ClipperBase.joinOutrecPaths(e, prev);
        else
            ClipperBase.joinOutrecPaths(prev, e);
        prev.joinWith = JoinWith.Right;
        e.joinWith = JoinWith.Left;
    }
    checkJoinRight(e, pt, checkCurrX = false) {
        const next = e.nextInAEL;
        if (ClipperBase.isOpen(e) || !ClipperBase.isHotEdgeActive(e) || ClipperBase.isJoined(e) ||
            !next || ClipperBase.isOpen(next) || !ClipperBase.isHotEdgeActive(next))
            return;
        if ((pt.y < e.top.y + 2 || pt.y < next.top.y + 2) && // avoid trivial joins
            ((e.bot.y > pt.y) || (next.bot.y > pt.y)))
            return; // (#490)
        if (checkCurrX) {
            if (Clipper.perpendicDistFromLineSqrd(pt, next.bot, next.top) > 0.25)
                return;
        }
        else if (e.curX !== next.curX)
            return;
        if (InternalClipper.crossProduct(e.top, pt, next.top) !== 0)
            return;
        if (e.outrec.idx === next.outrec.idx)
            this.addLocalMaxPoly(e, next, pt);
        else if (e.outrec.idx < next.outrec.idx)
            ClipperBase.joinOutrecPaths(e, next);
        else
            ClipperBase.joinOutrecPaths(next, e);
        e.joinWith = JoinWith.Right;
        next.joinWith = JoinWith.Left;
    }
    static fixOutRecPts(outrec) {
        let op = outrec.pts;
        do {
            op.outrec = outrec;
            op = op.next;
        } while (op !== outrec.pts);
    }
    static setHorzSegHeadingForward(hs, opP, opN) {
        if (opP.pt.x === opN.pt.x)
            return false;
        if (opP.pt.x < opN.pt.x) {
            hs.leftOp = opP;
            hs.rightOp = opN;
            hs.leftToRight = true;
        }
        else {
            hs.leftOp = opN;
            hs.rightOp = opP;
            hs.leftToRight = false;
        }
        return true;
    }
    static updateHorzSegment(hs) {
        const op = hs.leftOp;
        const outrec = this.getRealOutRec(op.outrec);
        const outrecHasEdges = outrec.frontEdge !== undefined;
        const curr_y = op.pt.y;
        let opP = op, opN = op;
        if (outrecHasEdges) {
            const opA = outrec.pts, opZ = opA.next;
            while (opP !== opZ && opP.prev.pt.y === curr_y)
                opP = opP.prev;
            while (opN !== opA && opN.next.pt.y === curr_y)
                opN = opN.next;
        }
        else {
            while (opP.prev !== opN && opP.prev.pt.y === curr_y)
                opP = opP.prev;
            while (opN.next !== opP && opN.next.pt.y === curr_y)
                opN = opN.next;
        }
        const result = this.setHorzSegHeadingForward(hs, opP, opN) && hs.leftOp.horz === undefined;
        if (result)
            hs.leftOp.horz = hs;
        else
            hs.rightOp = undefined; // (for sorting)
        return result;
    }
    static duplicateOp(op, insert_after) {
        const result = new OutPt(op.pt, op.outrec);
        if (insert_after) {
            result.next = op.next;
            result.next.prev = result;
            result.prev = op;
            op.next = result;
        }
        else {
            result.prev = op.prev;
            result.prev.next = result;
            result.next = op;
            op.prev = result;
        }
        return result;
    }
    convertHorzSegsToJoins() {
        let k = 0;
        for (const hs of this._horzSegList) {
            if (ClipperBase.updateHorzSegment(hs))
                k++;
        }
        if (k < 2)
            return;
        this._horzSegList.sort((hs1, hs2) => {
            if (!hs1 || !hs2)
                return 0;
            if (!hs1.rightOp) {
                return !hs2.rightOp ? 0 : 1;
            }
            else if (!hs2.rightOp)
                return -1;
            else
                return hs1.leftOp.pt.x - hs2.leftOp.pt.x;
        });
        for (let i = 0; i < k - 1; i++) {
            const hs1 = this._horzSegList[i];
            // for each HorzSegment, find others that overlap
            for (let j = i + 1; j < k; j++) {
                const hs2 = this._horzSegList[j];
                if (hs2.leftOp.pt.x >= hs1.rightOp.pt.x ||
                    hs2.leftToRight === hs1.leftToRight ||
                    hs2.rightOp.pt.x <= hs1.leftOp.pt.x)
                    continue;
                const curr_y = hs1.leftOp.pt.y;
                if (hs1.leftToRight) {
                    while (hs1.leftOp.next.pt.y === curr_y &&
                        hs1.leftOp.next.pt.x <= hs2.leftOp.pt.x) {
                        hs1.leftOp = hs1.leftOp.next;
                    }
                    while (hs2.leftOp.prev.pt.y === curr_y &&
                        hs2.leftOp.prev.pt.x <= hs1.leftOp.pt.x) {
                        hs2.leftOp = hs2.leftOp.prev;
                    }
                    const join = new HorzJoin(ClipperBase.duplicateOp(hs1.leftOp, true), ClipperBase.duplicateOp(hs2.leftOp, false));
                    this._horzJoinList.push(join);
                }
                else {
                    while (hs1.leftOp.prev.pt.y === curr_y &&
                        hs1.leftOp.prev.pt.x <= hs2.leftOp.pt.x) {
                        hs1.leftOp = hs1.leftOp.prev;
                    }
                    while (hs2.leftOp.next.pt.y === curr_y &&
                        hs2.leftOp.next.pt.x <= hs1.leftOp.pt.x) {
                        hs2.leftOp = hs2.leftOp.next;
                    }
                    const join = new HorzJoin(ClipperBase.duplicateOp(hs2.leftOp, true), ClipperBase.duplicateOp(hs1.leftOp, false));
                    this._horzJoinList.push(join);
                }
            }
        }
    }
    static getCleanPath(op) {
        const result = new Path64();
        let op2 = op;
        while (op2.next !== op &&
            ((op2.pt.x === op2.next.pt.x && op2.pt.x === op2.prev.pt.x) ||
                (op2.pt.y === op2.next.pt.y && op2.pt.y === op2.prev.pt.y))) {
            op2 = op2.next;
        }
        result.push(op2.pt);
        let prevOp = op2;
        op2 = op2.next;
        while (op2 !== op) {
            if ((op2.pt.x !== op2.next.pt.x || op2.pt.x !== prevOp.pt.x) &&
                (op2.pt.y !== op2.next.pt.y || op2.pt.y !== prevOp.pt.y)) {
                result.push(op2.pt);
                prevOp = op2;
            }
            op2 = op2.next;
        }
        return result;
    }
    static pointInOpPolygon(pt, op) {
        if (op === op.next || op.prev === op.next)
            return PointInPolygonResult.IsOutside;
        let op2 = op;
        do {
            if (op.pt.y !== pt.y)
                break;
            op = op.next;
        } while (op !== op2);
        if (op.pt.y === pt.y) // not a proper polygon
            return PointInPolygonResult.IsOutside;
        let isAbove = op.pt.y < pt.y;
        const startingAbove = isAbove;
        let val = 0;
        op2 = op.next;
        while (op2 !== op) {
            if (isAbove)
                while (op2 !== op && op2.pt.y < pt.y)
                    op2 = op2.next;
            else
                while (op2 !== op && op2.pt.y > pt.y)
                    op2 = op2.next;
            if (op2 === op)
                break;
            if (op2.pt.y === pt.y) {
                if (op2.pt.x === pt.x || (op2.pt.y === op2.prev.pt.y &&
                    (pt.x < op2.prev.pt.x) !== (pt.x < op2.pt.x)))
                    return PointInPolygonResult.IsOn;
                op2 = op2.next;
                if (op2 === op)
                    break;
                continue;
            }
            if (op2.pt.x <= pt.x || op2.prev.pt.x <= pt.x) {
                if (op2.prev.pt.x < pt.x && op2.pt.x < pt.x)
                    val = 1 - val;
                else {
                    const d = InternalClipper.crossProduct(op2.prev.pt, op2.pt, pt);
                    if (d === 0)
                        return PointInPolygonResult.IsOn;
                    if ((d < 0) === isAbove)
                        val = 1 - val;
                }
            }
            isAbove = !isAbove;
            op2 = op2.next;
        }
        if (isAbove !== startingAbove) {
            const d = InternalClipper.crossProduct(op2.prev.pt, op2.pt, pt);
            if (d === 0)
                return PointInPolygonResult.IsOn;
            if ((d < 0) === isAbove)
                val = 1 - val;
        }
        if (val === 0)
            return PointInPolygonResult.IsOutside;
        else
            return PointInPolygonResult.IsInside;
    }
    static path1InsidePath2(op1, op2) {
        let result;
        let outside_cnt = 0;
        let op = op1;
        do {
            result = this.pointInOpPolygon(op.pt, op2);
            if (result === PointInPolygonResult.IsOutside)
                ++outside_cnt;
            else if (result === PointInPolygonResult.IsInside)
                --outside_cnt;
            op = op.next;
        } while (op !== op1 && Math.abs(outside_cnt) < 2);
        if (Math.abs(outside_cnt) > 1)
            return (outside_cnt < 0);
        const mp = ClipperBase.getBoundsPath(this.getCleanPath(op1)).midPoint();
        const path2 = this.getCleanPath(op2);
        return InternalClipper.pointInPolygon(mp, path2) !== PointInPolygonResult.IsOutside;
    }
    moveSplits(fromOr, toOr) {
        if (!fromOr.splits)
            return;
        toOr.splits = toOr.splits || [];
        for (const i of fromOr.splits) {
            toOr.splits.push(i);
        }
        fromOr.splits = undefined;
    }
    processHorzJoins() {
        for (const j of this._horzJoinList) {
            const or1 = ClipperBase.getRealOutRec(j.op1.outrec);
            let or2 = ClipperBase.getRealOutRec(j.op2.outrec);
            const op1b = j.op1.next;
            const op2b = j.op2.prev;
            j.op1.next = j.op2;
            j.op2.prev = j.op1;
            op1b.prev = op2b;
            op2b.next = op1b;
            if (or1 === or2) {
                or2 = this.newOutRec();
                or2.pts = op1b;
                ClipperBase.fixOutRecPts(or2);
                if (or1.pts.outrec === or2) {
                    or1.pts = j.op1;
                    or1.pts.outrec = or1;
                }
                if (this._using_polytree) {
                    if (ClipperBase.path1InsidePath2(or1.pts, or2.pts)) {
                        const tmp = or1.pts;
                        or1.pts = or2.pts;
                        or2.pts = tmp;
                        ClipperBase.fixOutRecPts(or1);
                        ClipperBase.fixOutRecPts(or2);
                        or2.owner = or1.owner;
                    }
                    else if (ClipperBase.path1InsidePath2(or2.pts, or1.pts)) {
                        or2.owner = or1;
                    }
                    else {
                        or2.owner = or1.owner;
                    }
                    or1.splits = or1.splits || [];
                    or1.splits.push(or2.idx);
                }
                else {
                    or2.owner = or1;
                }
            }
            else {
                or2.pts = undefined;
                if (this._using_polytree) {
                    ClipperBase.setOwner(or2, or1);
                    this.moveSplits(or2, or1);
                }
                else {
                    or2.owner = or1;
                }
            }
        }
    }
    static ptsReallyClose(pt1, pt2) {
        return (Math.abs(pt1.x - pt2.x) < 2) && (Math.abs(pt1.y - pt2.y) < 2);
    }
    static isVerySmallTriangle(op) {
        return op.next.next === op.prev &&
            (this.ptsReallyClose(op.prev.pt, op.next.pt) ||
                this.ptsReallyClose(op.pt, op.next.pt) ||
                this.ptsReallyClose(op.pt, op.prev.pt));
    }
    static isValidClosedPath(op) {
        return op !== undefined && op.next !== op &&
            (op.next !== op.prev || !this.isVerySmallTriangle(op));
    }
    static disposeOutPt(op) {
        const result = op.next === op ? undefined : op.next;
        op.prev.next = op.next;
        op.next.prev = op.prev;
        return result;
    }
    cleanCollinear(outrec) {
        outrec = ClipperBase.getRealOutRec(outrec);
        if (outrec === undefined || outrec.isOpen)
            return;
        if (!ClipperBase.isValidClosedPath(outrec.pts)) {
            outrec.pts = undefined;
            return;
        }
        let startOp = outrec.pts;
        let op2 = startOp;
        for (;;) {
            // NB if preserveCollinear == true, then only remove 180 deg. spikes
            if (InternalClipper.crossProduct(op2.prev.pt, op2.pt, op2.next.pt) === 0 &&
                (op2.pt === op2.prev.pt || op2.pt === op2.next.pt || !this.preserveCollinear ||
                    InternalClipper.dotProduct(op2.prev.pt, op2.pt, op2.next.pt) < 0)) {
                if (op2 === outrec.pts) {
                    outrec.pts = op2.prev;
                }
                op2 = ClipperBase.disposeOutPt(op2);
                if (!ClipperBase.isValidClosedPath(op2)) {
                    outrec.pts = undefined;
                    return;
                }
                startOp = op2;
                continue;
            }
            op2 = op2.next;
            if (op2 === startOp)
                break;
        }
        this.fixSelfIntersects(outrec);
    }
    doSplitOp(outrec, splitOp) {
        // splitOp.prev <=> splitOp &&
        // splitOp.next <=> splitOp.next.next are intersecting
        const prevOp = splitOp.prev;
        const nextNextOp = splitOp.next.next;
        outrec.pts = prevOp;
        const ip = InternalClipper.getIntersectPoint(prevOp.pt, splitOp.pt, splitOp.next.pt, nextNextOp.pt).ip;
        const area1 = ClipperBase.area(prevOp);
        const absArea1 = Math.abs(area1);
        if (absArea1 < 2) {
            outrec.pts = undefined;
            return;
        }
        const area2 = ClipperBase.areaTriangle(ip, splitOp.pt, splitOp.next.pt);
        const absArea2 = Math.abs(area2);
        // de-link splitOp and splitOp.next from the path
        // while inserting the intersection point
        if (ip === prevOp.pt || ip === nextNextOp.pt) {
            nextNextOp.prev = prevOp;
            prevOp.next = nextNextOp;
        }
        else {
            const newOp2 = new OutPt(ip, outrec);
            newOp2.prev = prevOp;
            newOp2.next = nextNextOp;
            nextNextOp.prev = newOp2;
            prevOp.next = newOp2;
        }
        // nb: area1 is the path's area *before* splitting, whereas area2 is
        // the area of the triangle containing splitOp & splitOp.next.
        // So the only way for these areas to have the same sign is if
        // the split triangle is larger than the path containing prevOp or
        // if there's more than one self=intersection.
        if (absArea2 > 1 &&
            (absArea2 > absArea1 || (area2 > 0) === (area1 > 0))) {
            const newOutRec = this.newOutRec();
            newOutRec.owner = outrec.owner;
            splitOp.outrec = newOutRec;
            splitOp.next.outrec = newOutRec;
            const newOp = new OutPt(ip, newOutRec);
            newOp.prev = splitOp.next;
            newOp.next = splitOp;
            newOutRec.pts = newOp;
            splitOp.prev = newOp;
            splitOp.next.next = newOp;
            if (this._using_polytree) {
                if (ClipperBase.path1InsidePath2(prevOp, newOp)) {
                    newOutRec.splits = newOutRec.splits || [];
                    newOutRec.splits.push(outrec.idx);
                }
                else {
                    outrec.splits = outrec.splits || [];
                    outrec.splits.push(newOutRec.idx);
                }
            }
        }
        // else { splitOp = undefined; splitOp.next = undefined; }
    }
    fixSelfIntersects(outrec) {
        let op2 = outrec.pts;
        for (;;) {
            if (op2.prev === op2.next.next)
                break;
            if (InternalClipper.segsIntersect(op2.prev.pt, op2.pt, op2.next.pt, op2.next.next.pt)) {
                this.doSplitOp(outrec, op2);
                if (!outrec.pts)
                    return;
                op2 = outrec.pts;
                continue;
            }
            else {
                op2 = op2.next;
            }
            if (op2 === outrec.pts)
                break;
        }
    }
    static buildPath(op, reverse, isOpen, path) {
        if (op === undefined || op.next === op || (!isOpen && op.next === op.prev))
            return false;
        path.length = 0;
        let lastPt;
        let op2;
        if (reverse) {
            lastPt = op.pt;
            op2 = op.prev;
        }
        else {
            op = op.next;
            lastPt = op.pt;
            op2 = op.next;
        }
        path.push(lastPt);
        while (op2 !== op) {
            if (op2.pt !== lastPt) {
                lastPt = op2.pt;
                path.push(lastPt);
            }
            if (reverse) {
                op2 = op2.prev;
            }
            else {
                op2 = op2.next;
            }
        }
        if (path.length === 3 && this.isVerySmallTriangle(op2))
            return false;
        else
            return true;
    }
    buildPaths(solutionClosed, solutionOpen) {
        solutionClosed.length = 0;
        solutionOpen.length = 0;
        let i = 0;
        while (i < this._outrecList.length) {
            const outrec = this._outrecList[i++];
            if (!outrec.pts)
                continue;
            const path = new Path64();
            if (outrec.isOpen) {
                if (ClipperBase.buildPath(outrec.pts, this.reverseSolution, true, path)) {
                    solutionOpen.push(path);
                }
            }
            else {
                this.cleanCollinear(outrec);
                // closed paths should always return a Positive orientation
                // except when reverseSolution == true
                if (ClipperBase.buildPath(outrec.pts, this.reverseSolution, false, path)) {
                    solutionClosed.push(path);
                }
            }
        }
        return true;
    }
    static getBoundsPath(path) {
        if (path.length === 0)
            return new Rect64();
        const result = Clipper.InvalidRect64;
        for (const pt of path) {
            if (pt.x < result.left)
                result.left = pt.x;
            if (pt.x > result.right)
                result.right = pt.x;
            if (pt.y < result.top)
                result.top = pt.y;
            if (pt.y > result.bottom)
                result.bottom = pt.y;
        }
        return result;
    }
    checkBounds(outrec) {
        if (outrec.pts === undefined)
            return false;
        if (!outrec.bounds.isEmpty())
            return true;
        this.cleanCollinear(outrec);
        if (outrec.pts === undefined || !ClipperBase.buildPath(outrec.pts, this.reverseSolution, false, outrec.path))
            return false;
        outrec.bounds = ClipperBase.getBoundsPath(outrec.path);
        return true;
    }
    checkSplitOwner(outrec, splits) {
        for (const i of splits) {
            const split = ClipperBase.getRealOutRec(this._outrecList[i]);
            if (split === undefined || split === outrec || split.recursiveSplit === outrec)
                continue;
            split.recursiveSplit = outrec; //#599
            if (split.splits !== undefined && this.checkSplitOwner(outrec, split.splits))
                return true;
            if (ClipperBase.isValidOwner(outrec, split) &&
                this.checkBounds(split) &&
                split.bounds.containsRect(outrec.bounds) &&
                ClipperBase.path1InsidePath2(outrec.pts, split.pts)) {
                outrec.owner = split; //found in split
                return true;
            }
        }
        return false;
    }
    recursiveCheckOwners(outrec, polypath) {
        // pre-condition: outrec will have valid bounds
        // post-condition: if a valid path, outrec will have a polypath
        if (outrec.polypath !== undefined || outrec.bounds.isEmpty())
            return;
        while (outrec.owner !== undefined) {
            if (outrec.owner.splits !== undefined &&
                this.checkSplitOwner(outrec, outrec.owner.splits))
                break;
            else if (outrec.owner.pts !== undefined && this.checkBounds(outrec.owner) &&
                ClipperBase.path1InsidePath2(outrec.pts, outrec.owner.pts))
                break;
            outrec.owner = outrec.owner.owner;
        }
        if (outrec.owner !== undefined) {
            if (outrec.owner.polypath === undefined)
                this.recursiveCheckOwners(outrec.owner, polypath);
            outrec.polypath = outrec.owner.polypath.addChild(outrec.path);
        }
        else {
            outrec.polypath = polypath.addChild(outrec.path);
        }
    }
    buildTree(polytree, solutionOpen) {
        polytree.clear();
        solutionOpen.length = 0;
        let i = 0;
        while (i < this._outrecList.length) {
            const outrec = this._outrecList[i++];
            if (outrec.pts === undefined)
                continue;
            if (outrec.isOpen) {
                const open_path = new Path64();
                if (ClipperBase.buildPath(outrec.pts, this.reverseSolution, true, open_path))
                    solutionOpen.push(open_path);
                continue;
            }
            if (this.checkBounds(outrec))
                this.recursiveCheckOwners(outrec, polytree);
        }
    }
    getBounds() {
        const bounds = Clipper.InvalidRect64;
        for (const t of this._vertexList) {
            let v = t;
            do {
                if (v.pt.x < bounds.left)
                    bounds.left = v.pt.x;
                if (v.pt.x > bounds.right)
                    bounds.right = v.pt.x;
                if (v.pt.y < bounds.top)
                    bounds.top = v.pt.y;
                if (v.pt.y > bounds.bottom)
                    bounds.bottom = v.pt.y;
                v = v.next;
            } while (v !== t);
        }
        return bounds.isEmpty() ? new Rect64(0, 0, 0, 0) : bounds;
    }
}
export class Clipper64 extends ClipperBase {
    addPath(path, polytype, isOpen = false) {
        super.addPath(path, polytype, isOpen);
    }
    addReusableData(reusableData) {
        super.addReuseableData(reusableData);
    }
    addPaths(paths, polytype, isOpen = false) {
        super.addPaths(paths, polytype, isOpen);
    }
    addSubjectPaths(paths) {
        this.addPaths(paths, PathType.Subject);
    }
    addOpenSubjectPaths(paths) {
        this.addPaths(paths, PathType.Subject, true);
    }
    addClipPaths(paths) {
        this.addPaths(paths, PathType.Clip);
    }
    execute(clipType, fillRule, solutionClosed, solutionOpen = new Paths64()) {
        solutionClosed.length = 0;
        solutionOpen.length = 0;
        try {
            this.executeInternal(clipType, fillRule);
            this.buildPaths(solutionClosed, solutionOpen);
        }
        catch (error) {
            this._succeeded = false;
        }
        this.clearSolutionOnly();
        return this._succeeded;
    }
    executePolyTree(clipType, fillRule, polytree, openPaths = new Paths64()) {
        polytree.clear();
        openPaths.length = 0;
        this._using_polytree = true;
        try {
            this.executeInternal(clipType, fillRule);
            this.buildTree(polytree, openPaths);
        }
        catch (error) {
            this._succeeded = false;
        }
        this.clearSolutionOnly();
        return this._succeeded;
    }
}
export class PolyPathBase {
    get isHole() {
        return this.getIsHole();
    }
    constructor(parent) {
        this.children = [];
        this.forEach = this.children.forEach;
        this._parent = parent;
    }
    getLevel() {
        let result = 0;
        let pp = this._parent;
        while (pp !== undefined) {
            ++result;
            pp = pp._parent;
        }
        return result;
    }
    get level() {
        return this.getLevel();
    }
    getIsHole() {
        const lvl = this.getLevel();
        return lvl !== 0 && (lvl & 1) === 0;
    }
    get count() {
        return this.children.length;
    }
    clear() {
        this.children.length = 0;
    }
} // end of PolyPathBase class
export class PolyPath64 extends PolyPathBase {
    constructor(parent) {
        super(parent);
    }
    addChild(p) {
        const newChild = new PolyPath64(this);
        newChild.polygon = p;
        this.children.push(newChild);
        return newChild;
    }
    get(index) {
        if (index < 0 || index >= this.children.length) {
            throw new Error("InvalidOperationException");
        }
        return this.children[index];
    }
    child(index) {
        if (index < 0 || index >= this.children.length) {
            throw new Error("InvalidOperationException");
        }
        return this.children[index];
    }
    area() {
        let result = this.polygon ? Clipper.area(this.polygon) : 0;
        for (const polyPathBase of this.children) {
            const child = polyPathBase;
            result += child.area();
        }
        return result;
    }
}
export class PolyTree64 extends PolyPath64 {
}
export class ClipperLibException extends Error {
    constructor(description) {
        super(description);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW5naW5lLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vcHJvamVjdHMvY2xpcHBlcjItanMvc3JjL2xpYi9lbmdpbmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7OztnRkFTZ0Y7QUFFaEYsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLFdBQVcsQ0FBQztBQUNwQyxPQUFPLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBWSxlQUFlLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLFFBQVEsQ0FBQztBQUVuSCxFQUFFO0FBQ0YseUhBQXlIO0FBQ3pILDZCQUE2QjtBQUM3QixFQUFFO0FBQ0YsNEdBQTRHO0FBQzVHLEVBQUU7QUFFRixNQUFNLENBQU4sSUFBWSxvQkFJWDtBQUpELFdBQVksb0JBQW9CO0lBQzlCLCtEQUFRLENBQUE7SUFDUix1RUFBWSxDQUFBO0lBQ1oseUVBQWEsQ0FBQTtBQUNmLENBQUMsRUFKVyxvQkFBb0IsS0FBcEIsb0JBQW9CLFFBSS9CO0FBRUQsTUFBTSxDQUFOLElBQVksV0FNWDtBQU5ELFdBQVksV0FBVztJQUNyQiw2Q0FBUSxDQUFBO0lBQ1IsdURBQWEsQ0FBQTtJQUNiLG1EQUFXLENBQUE7SUFDWCxxREFBWSxDQUFBO0lBQ1oscURBQVksQ0FBQTtBQUNkLENBQUMsRUFOVyxXQUFXLEtBQVgsV0FBVyxRQU10QjtBQUVELE1BQU0sTUFBTTtJQU1WLFlBQVksRUFBWSxFQUFFLEtBQWtCLEVBQUUsSUFBd0I7UUFDcEUsSUFBSSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUM7UUFDYixJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztRQUNuQixJQUFJLENBQUMsSUFBSSxHQUFHLFNBQVMsQ0FBQztRQUN0QixJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztJQUNuQixDQUFDO0NBQ0Y7QUFHRCxNQUFNLFdBQVc7SUFLZixZ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QUFNLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUMzRCxLQUFLLE1BQU0sWUFBWSxJQUFJLElBQUksQ0FBQyxRQUFRLEVBQUU7WUFDeEMsTUFBTSxLQUFLLEdBQUcsWUFBMEIsQ0FBQztZQUN6QyxNQUFNLElBQUksS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDO1NBQ3hCO1FBQ0QsT0FBTyxNQUFNLENBQUM7SUFDaEIsQ0FBQztDQUNGO0FBR0QsTUFBTSxPQUFPLFVBQVcsU0FBUSxVQUFVO0NBQUk7QUFHOUMsTUFBTSxPQUFPLG1CQUFvQixTQUFRLEtBQUs7SUFDNUMsWUFBWSxXQUFtQjtRQUM3QixLQUFLLENBQUMsV0FBVyxDQUFDLENBQUM7SUFDckIsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcclxuKiBBdXRob3IgICAgOiAgQW5ndXMgSm9obnNvbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcclxuKiBEYXRlICAgICAgOiAgMjcgQXVndXN0IDIwMjMgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcclxuKiBXZWJzaXRlICAgOiAgaHR0cDovL3d3dy5hbmd1c2ouY29tICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcclxuKiBDb3B5cmlnaHQgOiAgQW5ndXMgSm9obnNvbiAyMDEwLTIwMjMgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcclxuKiBQdXJwb3NlICAgOiAgVGhpcyBpcyB0aGUgbWFpbiBwb2x5Z29uIGNsaXBwaW5nIG1vZHVsZSAgICAgICAgICAgICAgICAgICAgICAgICpcclxuKiBUaGFua3MgICAgOiAgU3BlY2lhbCB0aGFua3MgdG8gVGhvbmcgTmd1eWVuLCBHdXVzIEt1aXBlciwgUGhpbCBTdG9wZm9yZCwgICAgICpcclxuKiAgICAgICAgICAgOiAgYW5kIERhbmllbCBHb3NuZWxsIGZvciB0aGVpciBpbnZhbHVhYmxlIGFzc2lzdGFuY2Ugd2l0aCBDIy4gICAgICpcclxuKiBMaWNlbnNlICAgOiAgaHR0cDovL3d3dy5ib29zdC5vcmcvTElDRU5TRV8xXzAudHh0ICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcclxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cclxuXHJcbmltcG9ydCB7IENsaXBwZXIgfSBmcm9tIFwiLi9jbGlwcGVyXCI7XHJcbmltcG9ydCB7IENsaXBUeXBlLCBGaWxsUnVsZSwgSVBvaW50NjQsIEludGVybmFsQ2xpcHBlciwgUGF0aDY0LCBQYXRoVHlwZSwgUGF0aHM2NCwgUG9pbnQ2NCwgUmVjdDY0IH0gZnJvbSBcIi4vY29yZVwiO1xyXG5cclxuLy9cclxuLy8gQ29udmVydGVkIGZyb20gQyMgaW1wbGVtZW50aW9uIGh0dHBzOi8vZ2l0aHViLmNvbS9Bbmd1c0pvaG5zb24vQ2xpcHBlcjIvYmxvYi9tYWluL0NTaGFycC9DbGlwcGVyMkxpYi9DbGlwcGVyLkVuZ2luZS5jc1xyXG4vLyBSZW1vdmVkIHN1cHBvcnQgZm9yIFVTSU5HWlxyXG4vL1xyXG4vLyBDb252ZXJ0ZWQgYnkgQ2hhdEdQVCA0IEF1Z3VzdCAzIHZlcnNpb24gaHR0cHM6Ly9oZWxwLm9wZW5haS5jb20vZW4vYXJ0aWNsZXMvNjgyNTQ1My1jaGF0Z3B0LXJlbGVhc2Utbm90ZXNcclxuLy9cclxuXHJcbmV4cG9ydCBlbnVtIFBvaW50SW5Qb2x5Z29uUmVzdWx0IHtcclxuICBJc09uID0gMCxcclxuICBJc0luc2lkZSA9IDEsXHJcbiAgSXNPdXRzaWRlID0gMlxyXG59XHJcblxyXG5leHBvcnQgZW51bSBWZXJ0ZXhGbGFncyB7XHJcbiAgTm9uZSA9IDAsXHJcbiAgT3BlblN0YXJ0ID0gMSxcclxuICBPcGVuRW5kID0gMixcclxuICBMb2NhbE1heCA9IDQsXHJcbiAgTG9jYWxNaW4gPSA4XHJcbn1cclxuXHJcbmNsYXNzIFZlcnRleCB7XHJcbiAgcmVhZG9ubHkgcHQ6IElQb2ludDY0O1xyXG4gIG5leHQ6IFZlcnRleCB8IHVuZGVmaW5lZDtcclxuICBwcmV2OiBWZXJ0ZXggfCB1bmRlZmluZWQ7XHJcbiAgZmxhZ3M6IFZlcnRleEZsYWdzO1xyXG5cclxuICBjb25zdHJ1Y3RvcihwdDogSVBvaW50NjQsIGZsYWdzOiBWZXJ0ZXhGbGFncywgcHJldjogVmVydGV4IHwgdW5kZWZpbmVkKSB7XHJcbiAgICB0aGlzLnB0ID0gcHQ7XHJcbiAgICB0aGlzLmZsYWdzID0gZmxhZ3M7XHJcbiAgICB0aGlzLm5leHQgPSB1bmRlZmluZWQ7XHJcbiAgICB0aGlzLnByZXYgPSBwcmV2O1xyXG4gIH1cclxufVxyXG5cclxuXHJcbmNsYXNzIExvY2FsTWluaW1hIHtcclxuICByZWFkb25seSB2ZXJ0ZXg6IFZlcnRleDtcclxuICByZWFkb25seSBwb2x5dHlwZTogUGF0aFR5cGU7XHJcbiAgcmVhZG9ubHkgaXNPcGVuOiBib29sZWFuO1xyXG5cclxuICBjb25zdHJ1Y3Rvcih2ZXJ0ZXg6IFZlcnRleCwgcG9seXR5cGU6IFBhdGhUeXBlLCBpc09wZW46IGJvb2xlYW4gPSBmYWxzZSkge1xyXG4gICAgdGhpcy52ZXJ0ZXggPSB2ZXJ0ZXg7XHJcbiAgICB0aGlzLnBvbHl0eXBlID0gcG9seXR5cGU7XHJcbiAgICB0aGlzLmlzT3BlbiA9IGlzT3BlbjtcclxuICB9XHJcblxyXG4gIHN0YXRpYyBlcXVhbHMobG0xOiBMb2NhbE1pbmltYSwgbG0yOiBMb2NhbE1pbmltYSk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuIGxtMS52ZXJ0ZXggPT09IGxtMi52ZXJ0ZXg7XHJcbiAgfVxyXG5cclxuICBzdGF0aWMgbm90RXF1YWxzKGxtMTogTG9jYWxNaW5pbWEsIGxtMjogTG9jYWxNaW5pbWEpOiBib29sZWFuIHtcclxuICAgIHJldHVybiBsbTEudmVydGV4ICE9PSBsbTIudmVydGV4O1xyXG4gIH1cclxuXHJcbiAgLy9oYXNoQ29kZSgpOiBudW1iZXIge1xyXG4gIC8vICByZXR1cm4gdGhpcy52ZXJ0ZXguaGFzaENvZGUoKTtcclxuICAvL31cclxufVxyXG5cclxuY2xhc3MgSW50ZXJzZWN0Tm9kZSB7XHJcbiAgcmVhZG9ubHkgcHQ6IElQb2ludDY0O1xyXG4gIHJlYWRvbmx5IGVkZ2UxOiBBY3RpdmU7XHJcbiAgcmVhZG9ubHkgZWRnZTI6IEFjdGl2ZTtcclxuXHJcbiAgY29uc3RydWN0b3IocHQ6IElQb2ludDY0LCBlZGdlMTogQWN0aXZlLCBlZGdlMjogQWN0aXZlKSB7XHJcbiAgICB0aGlzLnB0ID0gcHQ7XHJcbiAgICB0aGlzLmVkZ2UxID0gZWRnZTE7XHJcbiAgICB0aGlzLmVkZ2UyID0gZWRnZTI7XHJcbiAgfVxyXG59XHJcblxyXG5jbGFzcyBPdXRQdCB7XHJcbiAgcHQ6IElQb2ludDY0O1xyXG4gIG5leHQ6IE91dFB0IHwgdW5kZWZpbmVkO1xyXG4gIHByZXY6IE91dFB0O1xyXG4gIG91dHJlYzogT3V0UmVjO1xyXG4gIGhvcno6IEhvcnpTZWdtZW50IHwgdW5kZWZpbmVkO1xyXG5cclxuICBjb25zdHJ1Y3RvcihwdDogSVBvaW50NjQsIG91dHJlYzogT3V0UmVjKSB7XHJcbiAgICB0aGlzLnB0ID0gcHQ7XHJcbiAgICB0aGlzLm91dHJlYyA9IG91dHJlYztcclxuICAgIHRoaXMubmV4dCA9IHRoaXM7XHJcbiAgICB0aGlzLnByZXYgPSB0aGlzO1xyXG4gICAgdGhpcy5ob3J6ID0gdW5kZWZpbmVkO1xyXG4gIH1cclxufVxyXG5cclxuZXhwb3J0IGVudW0gSm9pbldpdGgge1xyXG4gIE5vbmUsXHJcbiAgTGVmdCxcclxuICBSaWdodFxyXG59XHJcblxyXG5leHBvcnQgZW51bSBIb3J6UG9zaXRpb24ge1xyXG4gIEJvdHRvbSxcclxuICBNaWRkbGUsXHJcbiAgVG9wXHJcbn1cclxuXHJcblxyXG5leHBvcnQgY2xhc3MgT3V0UmVjIHtcclxuICBpZHg6IG51bWJlcjtcclxuICBvd25lcjogT3V0UmVjIHwgdW5kZWZpbmVkO1xyXG4gIGZyb250RWRnZTogQWN0aXZlIHwgdW5kZWZpbmVkO1xyXG4gIGJhY2tFZGdlOiBBY3RpdmUgfCB1bmRlZmluZWQ7XHJcbiAgcHRzOiBPdXRQdCB8IHVuZGVmaW5lZDtcclxuICBwb2x5cGF0aDogUG9seVBhdGhCYXNlIHwgdW5kZWZpbmVkO1xyXG4gIGJvdW5kcyE6IFJlY3Q2NDtcclxuICBwYXRoITogUGF0aDY0O1xyXG4gIGlzT3BlbjogYm9vbGVhbjtcclxuICBzcGxpdHM6IG51bWJlcltdIHwgdW5kZWZpbmVkO1xyXG4gIHJlY3Vyc2l2ZVNwbGl0OiBPdXRSZWMgfCB1bmRlZmluZWQ7XHJcbiAgY29uc3RydWN0b3IoaWR4OiBudW1iZXIpIHtcclxuICAgIHRoaXMuaWR4ID0gaWR4XHJcbiAgICB0aGlzLmlzT3BlbiA9IGZhbHNlXHJcbiAgfVxyXG59XHJcblxyXG5jbGFzcyBIb3J6U2VnbWVudCB7XHJcbiAgbGVmdE9wOiBPdXRQdCAvL3wgdW5kZWZpbmVkO1xyXG4gIHJpZ2h0T3A6IE91dFB0IHwgdW5kZWZpbmVkO1xyXG4gIGxlZnRUb1JpZ2h0OiBib29sZWFuO1xyXG5cclxuICBjb25zdHJ1Y3RvcihvcDogT3V0UHQpIHtcclxuICAgIHRoaXMubGVmdE9wID0gb3A7XHJcbiAgICB0aGlzLnJpZ2h0T3AgPSB1bmRlZmluZWQ7XHJcbiAgICB0aGlzLmxlZnRUb1JpZ2h0ID0gdHJ1ZTtcclxuICB9XHJcbn1cclxuXHJcbmNsYXNzIEhvcnpKb2luIHtcclxuICBvcDE6IE91dFB0IHwgdW5kZWZpbmVkO1xyXG4gIG9wMjogT3V0UHQgfCB1bmRlZmluZWQ7XHJcblxyXG4gIGNvbnN0cnVjdG9yKGx0b3I6IE91dFB0LCBydG9sOiBPdXRQdCkge1xyXG4gICAgdGhpcy5vcDEgPSBsdG9yO1xyXG4gICAgdGhpcy5vcDIgPSBydG9sO1xyXG4gIH1cclxufVxyXG5cclxuLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xyXG4vLyBJbXBvcnRhbnQ6IFVQIGFuZCBET1dOIGhlcmUgYXJlIHByZW1pc2VkIG9uIFktYXhpcyBwb3NpdGl2ZSBkb3duXHJcbi8vIGRpc3BsYXlzLCB3aGljaCBpcyB0aGUgb3JpZW50YXRpb24gdXNlZCBpbiBDbGlwcGVyJ3MgZGV2ZWxvcG1lbnQuXHJcbi8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cclxuXHJcbmV4cG9ydCBjbGFzcyBBY3RpdmUge1xyXG4gIGJvdCE6IElQb2ludDY0XHJcbiAgdG9wITogSVBvaW50NjRcclxuICBjdXJYITogbnVtYmVyOy8vIGN1cnJlbnQgKHVwZGF0ZWQgYXQgZXZlcnkgbmV3IHNjYW5saW5lKVxyXG4gIGR4OiBudW1iZXI7XHJcbiAgd2luZER4ITogbnVtYmVyOy8vIDEgb3IgLTEgZGVwZW5kaW5nIG9uIHdpbmRpbmcgZGlyZWN0aW9uXHJcbiAgd2luZENvdW50OiBudW1iZXI7XHJcbiAgd2luZENvdW50MjogbnVtYmVyOy8vIHdpbmRpbmcgY291bnQgb2YgdGhlIG9wcG9zaXRlIHBvbHl0eXBlXHJcbiAgb3V0cmVjOiBPdXRSZWMgfCB1bmRlZmluZWQ7XHJcblxyXG4gIC8vIEFFTDogJ2FjdGl2ZSBlZGdlIGxpc3QnIChWYXR0aSdzIEFFVCAtIGFjdGl2ZSBlZGdlIHRhYmxlKVxyXG4gIC8vICAgICBhIGxpbmtlZCBsaXN0IG9mIGFsbCBlZGdlcyAoZnJvbSBsZWZ0IHRvIHJpZ2h0KSB0aGF0IGFyZSBwcmVzZW50XHJcbiAgLy8gICAgIChvciAnYWN0aXZlJykgd2l0aGluIHRoZSBjdXJyZW50IHNjYW5iZWFtIChhIGhvcml6b250YWwgJ2JlYW0nIHRoYXRcclxuICAvLyAgICAgc3dlZXBzIGZyb20gYm90dG9tIHRvIHRvcCBvdmVyIHRoZSBwYXRocyBpbiB0aGUgY2xpcHBpbmcgb3BlcmF0aW9uKS5cclxuICBwcmV2SW5BRUw6IEFjdGl2ZSB8IHVuZGVmaW5lZDtcclxuICBuZXh0SW5BRUw6IEFjdGl2ZSB8IHVuZGVmaW5lZDtcclxuXHJcbiAgLy8gU0VMOiAnc29ydGVkIGVkZ2UgbGlzdCcgKFZhdHRpJ3MgU1QgLSBzb3J0ZWQgdGFibGUpXHJcbiAgLy8gICAgIGxpbmtlZCBsaXN0IHVzZWQgd2hlbiBzb3J0aW5nIGVkZ2VzIGludG8gdGhlaXIgbmV3IHBvc2l0aW9ucyBhdCB0aGVcclxuICAvLyAgICAgdG9wIG9mIHNjYW5iZWFtcywgYnV0IGFsc28gKHJlKXVzZWQgdG8gcHJvY2VzcyBob3Jpem9udGFscy5cclxuICBwcmV2SW5TRUw6IEFjdGl2ZSB8IHVuZGVmaW5lZDtcclxuICBuZXh0SW5TRUw6IEFjdGl2ZSB8IHVuZGVmaW5lZDtcclxuICBqdW1wOiBBY3RpdmUgfCB1bmRlZmluZWQ7XHJcbiAgdmVydGV4VG9wOiBWZXJ0ZXggfCB1bmRlZmluZWRcclxuICBsb2NhbE1pbiE6IExvY2FsTWluaW1hIC8vIHRoZSBib3R0b20gb2YgYW4gZWRnZSAnYm91bmQnIChhbHNvIFZhdHRpKVxyXG4gIGlzTGVmdEJvdW5kOiBib29sZWFuXHJcbiAgam9pbldpdGg6IEpvaW5XaXRoXHJcblxyXG4gIGNvbnN0cnVjdG9yKCkge1xyXG4gICAgdGhpcy5keCA9IHRoaXMud2luZENvdW50ID0gdGhpcy53aW5kQ291bnQyID0gMFxyXG4gICAgdGhpcy5pc0xlZnRCb3VuZCA9IGZhbHNlXHJcbiAgICB0aGlzLmpvaW5XaXRoID0gSm9pbldpdGguTm9uZVxyXG4gIH1cclxufVxyXG5cclxuZXhwb3J0IGNsYXNzIENsaXBwZXJFbmdpbmUge1xyXG4gIHN0YXRpYyBhZGRMb2NNaW4odmVydDogVmVydGV4LCBwb2x5dHlwZTogUGF0aFR5cGUsIGlzT3BlbjogYm9vbGVhbiwgbWluaW1hTGlzdDogTG9jYWxNaW5pbWFbXSk6IHZvaWQge1xyXG4gICAgLy8gbWFrZSBzdXJlIHRoZSB2ZXJ0ZXggaXMgYWRkZWQgb25seSBvbmNlIC4uLlxyXG4gICAgaWYgKCh2ZXJ0LmZsYWdzICYgVmVydGV4RmxhZ3MuTG9jYWxNaW4pICE9PSBWZXJ0ZXhGbGFncy5Ob25lKSByZXR1cm47XHJcbiAgICB2ZXJ0LmZsYWdzIHw9IFZlcnRleEZsYWdzLkxvY2FsTWluO1xyXG5cclxuICAgIGNvbnN0IGxtID0gbmV3IExvY2FsTWluaW1hKHZlcnQsIHBvbHl0eXBlLCBpc09wZW4pO1xyXG4gICAgbWluaW1hTGlzdC5wdXNoKGxtKTtcclxuICB9XHJcblxyXG4gIHN0YXRpYyBhZGRQYXRoc1RvVmVydGV4TGlzdChwYXRoczogUGF0aDY0W10sIHBvbHl0eXBlOiBQYXRoVHlwZSwgaXNPcGVuOiBib29sZWFuLCBtaW5pbWFMaXN0OiBMb2NhbE1pbmltYVtdLCB2ZXJ0ZXhMaXN0OiBWZXJ0ZXhbXSk6IHZvaWQge1xyXG4gICAgbGV0IHRvdGFsVmVydENudCA9IDA7XHJcbiAgICBmb3IgKGNvbnN0IHBhdGggb2YgcGF0aHMpXHJcbiAgICAgIHRvdGFsVmVydENudCArPSBwYXRoLmxlbmd0aDtcclxuXHJcbiAgICBmb3IgKGNvbnN0IHBhdGggb2YgcGF0aHMpIHtcclxuICAgICAgbGV0IHYwOiBWZXJ0ZXggfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XHJcbiAgICAgIGxldCBwcmV2X3Y6IFZlcnRleCB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcclxuICAgICAgbGV0IGN1cnJfdjogVmVydGV4IHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xyXG4gICAgICBmb3IgKGNvbnN0IHB0IG9mIHBhdGgpIHtcclxuICAgICAgICBpZiAoIXYwKSB7XHJcbiAgICAgICAgICB2MCA9IG5ldyBWZXJ0ZXgocHQsIFZlcnRleEZsYWdzLk5vbmUsIHVuZGVmaW5lZCk7XHJcbiAgICAgICAgICB2ZXJ0ZXhMaXN0LnB1c2godjApO1xyXG4gICAgICAgICAgcHJldl92ID0gdjA7XHJcbiAgICAgICAgfSBlbHNlIGlmIChwcmV2X3YhLnB0ICE9PSBwdCkgeyAgLy8gaS5lLiwgc2tpcHMgZHVwbGljYXRlc1xyXG4gICAgICAgICAgY3Vycl92ID0gbmV3IFZlcnRleChwdCwgVmVydGV4RmxhZ3MuTm9uZSwgcHJldl92KTtcclxuICAgICAgICAgIHZlcnRleExpc3QucHVzaChjdXJyX3YpO1xyXG4gICAgICAgICAgcHJldl92IS5uZXh0ID0gY3Vycl92O1xyXG4gICAgICAgICAgcHJldl92ID0gY3Vycl92O1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICBpZiAoIXByZXZfdiB8fCAhcHJldl92LnByZXYpIGNvbnRpbnVlO1xyXG4gICAgICBpZiAoIWlzT3BlbiAmJiBwcmV2X3YucHQgPT09IHYwIS5wdCkgcHJldl92ID0gcHJldl92LnByZXY7XHJcbiAgICAgIHByZXZfdi5uZXh0ID0gdjA7XHJcbiAgICAgIHYwIS5wcmV2ID0gcHJldl92O1xyXG4gICAgICBpZiAoIWlzT3BlbiAmJiBwcmV2X3YubmV4dCA9PT0gcHJldl92KSBjb250aW51ZTtcclxuXHJcbiAgICAgIC8vIE9LLCB3ZSBoYXZlIGEgdmFsaWQgcGF0aFxyXG4gICAgICBsZXQgZ29pbmdfdXAgPSBmYWxzZVxyXG5cclxuICAgICAgaWYgKGlzT3Blbikge1xyXG4gICAgICAgIGN1cnJfdiA9IHYwIS5uZXh0O1xyXG4gICAgICAgIGxldCBjb3VudCA9IDBcclxuICAgICAgICB3aGlsZSAoY3Vycl92ICE9PSB2MCAmJiBjdXJyX3YhLnB0LnkgPT09IHYwIS5wdC55KSB7XHJcbiAgICAgICAgICBjdXJyX3YgPSBjdXJyX3YhLm5leHQ7XHJcbiAgICAgICAgICBpZiAoY291bnQrKyA+IHRvdGFsVmVydENudCkge1xyXG4gICAgICAgICAgICBjb25zb2xlLndhcm4oJ2luZmluaXRlIGxvb3AgZGV0ZWN0ZWQnKVxyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgZ29pbmdfdXAgPSBjdXJyX3YhLnB0LnkgPD0gdjAhLnB0Lnk7XHJcbiAgICAgICAgaWYgKGdvaW5nX3VwKSB7XHJcbiAgICAgICAgICB2MCEuZmxhZ3MgPSBWZXJ0ZXhGbGFncy5PcGVuU3RhcnQ7XHJcbiAgICAgICAgICB0aGlzLmFkZExvY01pbih2MCEsIHBvbHl0eXBlLCB0cnVlLCBtaW5pbWFMaXN0KTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgdjAhLmZsYWdzID0gVmVydGV4RmxhZ3MuT3BlblN0YXJ0IHwgVmVydGV4RmxhZ3MuTG9jYWxNYXg7XHJcbiAgICAgICAgfVxyXG4gICAgICB9IGVsc2UgeyAvLyBjbG9zZWQgcGF0aFxyXG4gICAgICAgIHByZXZfdiA9IHYwIS5wcmV2O1xyXG4gICAgICAgIGxldCBjb3VudCA9IDBcclxuICAgICAgICB3aGlsZSAocHJldl92ICE9PSB2MCAmJiBwcmV2X3YhLnB0LnkgPT09IHYwIS5wdC55KSB7XHJcbiAgICAgICAgICBwcmV2X3YgPSBwcmV2X3YhLnByZXY7XHJcblxyXG4gICAgICAgICAgaWYgKGNvdW50KysgPiB0b3RhbFZlcnRDbnQpIHtcclxuICAgICAgICAgICAgY29uc29sZS53YXJuKCdpbmZpbml0ZSBsb29wIGRldGVjdGVkJylcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChwcmV2X3YgPT09IHYwKSB7XHJcbiAgICAgICAgICBjb250aW51ZTsgLy8gb25seSBvcGVuIHBhdGhzIGNhbiBiZSBjb21wbGV0ZWx5IGZsYXRcclxuICAgICAgICB9XHJcbiAgICAgICAgZ29pbmdfdXAgPSBwcmV2X3YhLnB0LnkgPiB2MCEucHQueTtcclxuICAgICAgfVxyXG5cclxuICAgICAgY29uc3QgZ29pbmdfdXAwID0gZ29pbmdfdXA7XHJcbiAgICAgIHByZXZfdiA9IHYwO1xyXG4gICAgICBjdXJyX3YgPSB2MCEubmV4dDtcclxuXHJcbiAgICAgIGxldCBjb3VudCA9IDBcclxuICAgICAgd2hpbGUgKGN1cnJfdiAhPT0gdjApIHtcclxuICAgICAgICBpZiAoY3Vycl92IS5wdC55ID4gcHJldl92IS5wdC55ICYmIGdvaW5nX3VwKSB7XHJcbiAgICAgICAgICBwcmV2X3YhLmZsYWdzIHw9IFZlcnRleEZsYWdzLkxvY2FsTWF4O1xyXG4gICAgICAgICAgZ29pbmdfdXAgPSBmYWxzZTtcclxuICAgICAgICB9IGVsc2UgaWYgKGN1cnJfdiEucHQueSA8IHByZXZfdiEucHQueSAmJiAhZ29pbmdfdXApIHtcclxuICAgICAgICAgIGdvaW5nX3VwID0gdHJ1ZTtcclxuICAgICAgICAgIHRoaXMuYWRkTG9jTWluKHByZXZfdiEsIHBvbHl0eXBlLCBpc09wZW4sIG1pbmltYUxpc3QpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBwcmV2X3YgPSBjdXJyX3Y7XHJcbiAgICAgICAgY3Vycl92ID0gY3Vycl92IS5uZXh0O1xyXG5cclxuICAgICAgICBpZiAoY291bnQrKyA+IHRvdGFsVmVydENudCkge1xyXG4gICAgICAgICAgY29uc29sZS53YXJuKCdpbmZpbml0ZSBsb29wIGRldGVjdGVkJylcclxuICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGlmIChpc09wZW4pIHtcclxuICAgICAgICBwcmV2X3YhLmZsYWdzIHw9IFZlcnRleEZsYWdzLk9wZW5FbmQ7XHJcbiAgICAgICAgaWYgKGdvaW5nX3VwKSB7XHJcbiAgICAgICAgICBwcmV2X3YhLmZsYWdzIHw9IFZlcnRleEZsYWdzLkxvY2FsTWF4O1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICB0aGlzLmFkZExvY01pbihwcmV2X3YhLCBwb2x5dHlwZSwgaXNPcGVuLCBtaW5pbWFMaXN0KTtcclxuICAgICAgICB9XHJcbiAgICAgIH0gZWxzZSBpZiAoZ29pbmdfdXAgIT09IGdvaW5nX3VwMCkge1xyXG4gICAgICAgIGlmIChnb2luZ191cDApIHtcclxuICAgICAgICAgIHRoaXMuYWRkTG9jTWluKHByZXZfdiEsIHBvbHl0eXBlLCBmYWxzZSwgbWluaW1hTGlzdCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIHByZXZfdiEuZmxhZ3MgfD0gVmVydGV4RmxhZ3MuTG9jYWxNYXg7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG59XHJcblxyXG5leHBvcnQgY2xhc3MgUmV1c2VhYmxlRGF0YUNvbnRhaW5lcjY0IHtcclxuICByZWFkb25seSBfbWluaW1hTGlzdDogTG9jYWxNaW5pbWFbXTtcclxuICBwcml2YXRlIHJlYWRvbmx5IF92ZXJ0ZXhMaXN0OiBWZXJ0ZXhbXTtcclxuXHJcbiAgY29uc3RydWN0b3IoKSB7XHJcbiAgICB0aGlzLl9taW5pbWFMaXN0ID0gW107XHJcbiAgICB0aGlzLl92ZXJ0ZXhMaXN0ID0gW107XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgY2xlYXIoKTogdm9pZCB7XHJcbiAgICB0aGlzLl9taW5pbWFMaXN0Lmxlbmd0aCA9IDA7XHJcbiAgICB0aGlzLl92ZXJ0ZXhMaXN0Lmxlbmd0aCA9IDA7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgYWRkUGF0aHMocGF0aHM6IFBhdGhzNjQsIHB0OiBQYXRoVHlwZSwgaXNPcGVuOiBib29sZWFuKTogdm9pZCB7XHJcbiAgICBDbGlwcGVyRW5naW5lLmFkZFBhdGhzVG9WZXJ0ZXhMaXN0KHBhdGhzLCBwdCwgaXNPcGVuLCB0aGlzLl9taW5pbWFMaXN0LCB0aGlzLl92ZXJ0ZXhMaXN0KTtcclxuICB9XHJcbn1cclxuXHJcbmNsYXNzIFNpbXBsZU5hdmlnYWJsZVNldCB7XHJcbiAgaXRlbXM6IEFycmF5PG51bWJlcj4gPSBbXVxyXG5cclxuICBjb25zdHJ1Y3RvcigpIHtcclxuICAgIHRoaXMuaXRlbXMgPSBbXTtcclxuICB9XHJcblxyXG4gIGNsZWFyKCk6IHZvaWQgeyB0aGlzLml0ZW1zLmxlbmd0aCA9IDAgfVxyXG4gIGlzRW1wdHkoKTogYm9vbGVhbiB7IHJldHVybiB0aGlzLml0ZW1zLmxlbmd0aCA9PSAwIH1cclxuXHJcbiAgcG9sbExhc3QoKTogbnVtYmVyIHwgdW5kZWZpbmVkIHtcclxuICAgIHJldHVybiB0aGlzLml0ZW1zLnBvcCgpO1xyXG4gIH1cclxuXHJcbiAgYWRkKGl0ZW06IG51bWJlcikge1xyXG4gICAgaWYgKCF0aGlzLml0ZW1zLmluY2x1ZGVzKGl0ZW0pKSB7XHJcbiAgICAgIHRoaXMuaXRlbXMucHVzaChpdGVtKTtcclxuICAgICAgdGhpcy5pdGVtcy5zb3J0KChhLCBiKSA9PiBhIC0gYik7XHJcbiAgICB9XHJcbiAgfVxyXG59XHJcblxyXG5leHBvcnQgY2xhc3MgQ2xpcHBlckJhc2Uge1xyXG4gIHByaXZhdGUgX2NsaXB0eXBlOiBDbGlwVHlwZSA9IENsaXBUeXBlLk5vbmVcclxuICBwcml2YXRlIF9maWxscnVsZTogRmlsbFJ1bGUgPSBGaWxsUnVsZS5FdmVuT2RkXHJcbiAgcHJpdmF0ZSBfYWN0aXZlcz86IEFjdGl2ZTtcclxuICBwcml2YXRlIF9zZWw/OiBBY3RpdmU7XHJcbiAgcHJpdmF0ZSByZWFkb25seSBfbWluaW1hTGlzdDogTG9jYWxNaW5pbWFbXTtcclxuICBwcml2YXRlIHJlYWRvbmx5IF9pbnRlcnNlY3RMaXN0OiBJbnRlcnNlY3ROb2RlW107XHJcbiAgcHJpdmF0ZSByZWFkb25seSBfdmVydGV4TGlzdDogVmVydGV4W107XHJcbiAgcHJpdmF0ZSByZWFkb25seSBfb3V0cmVjTGlzdDogT3V0UmVjW107XHJcbiAgcHJpdmF0ZSByZWFkb25seSBfc2NhbmxpbmVMaXN0OiBTaW1wbGVOYXZpZ2FibGVTZXQ7XHJcbiAgcHJpdmF0ZSByZWFkb25seSBfaG9yelNlZ0xpc3Q6IEhvcnpTZWdtZW50W107XHJcbiAgcHJpdmF0ZSByZWFkb25seSBfaG9yekpvaW5MaXN0OiBIb3J6Sm9pbltdO1xyXG4gIHByaXZhdGUgX2N1cnJlbnRMb2NNaW46IG51bWJlciA9IDBcclxuICBwcml2YXRlIF9jdXJyZW50Qm90WTogbnVtYmVyID0gMFxyXG4gIHByaXZhdGUgX2lzU29ydGVkTWluaW1hTGlzdDogYm9vbGVhbiA9IGZhbHNlXHJcbiAgcHJpdmF0ZSBfaGFzT3BlblBhdGhzOiBib29sZWFuID0gZmFsc2VcclxuICBwcm90ZWN0ZWQgX3VzaW5nX3BvbHl0cmVlOiBib29sZWFuID0gZmFsc2VcclxuICBwcm90ZWN0ZWQgX3N1Y2NlZWRlZDogYm9vbGVhbiA9IGZhbHNlXHJcbiAgcHVibGljIHByZXNlcnZlQ29sbGluZWFyOiBib29sZWFuO1xyXG4gIHB1YmxpYyByZXZlcnNlU29sdXRpb246IGJvb2xlYW4gPSBmYWxzZVxyXG5cclxuICBjb25zdHJ1Y3RvcigpIHtcclxuICAgIHRoaXMuX21pbmltYUxpc3QgPSBbXTtcclxuICAgIHRoaXMuX2ludGVyc2VjdExpc3QgPSBbXTtcclxuICAgIHRoaXMuX3ZlcnRleExpc3QgPSBbXTtcclxuICAgIHRoaXMuX291dHJlY0xpc3QgPSBbXTtcclxuICAgIHRoaXMuX3NjYW5saW5lTGlzdCA9IG5ldyBTaW1wbGVOYXZpZ2FibGVTZXQoKVxyXG4gICAgdGhpcy5faG9yelNlZ0xpc3QgPSBbXTtcclxuICAgIHRoaXMuX2hvcnpKb2luTGlzdCA9IFtdO1xyXG4gICAgdGhpcy5wcmVzZXJ2ZUNvbGxpbmVhciA9IHRydWU7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHN0YXRpYyBpc09kZCh2YWw6IG51bWJlcik6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuICgodmFsICYgMSkgIT09IDApO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBzdGF0aWMgaXNIb3RFZGdlQWN0aXZlKGFlOiBBY3RpdmUpOiBib29sZWFuIHtcclxuICAgIHJldHVybiBhZS5vdXRyZWMgIT09IHVuZGVmaW5lZDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgc3RhdGljIGlzT3BlbihhZTogQWN0aXZlKTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gYWUubG9jYWxNaW4uaXNPcGVuO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBzdGF0aWMgaXNPcGVuRW5kQWN0aXZlKGFlOiBBY3RpdmUpOiBib29sZWFuIHtcclxuICAgIHJldHVybiBhZS5sb2NhbE1pbi5pc09wZW4gJiYgQ2xpcHBlckJhc2UuaXNPcGVuRW5kKGFlLnZlcnRleFRvcCEpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBzdGF0aWMgaXNPcGVuRW5kKHY6IFZlcnRleCk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuICh2LmZsYWdzICYgKFZlcnRleEZsYWdzLk9wZW5TdGFydCB8IFZlcnRleEZsYWdzLk9wZW5FbmQpKSAhPT0gVmVydGV4RmxhZ3MuTm9uZTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgc3RhdGljIGdldFByZXZIb3RFZGdlKGFlOiBBY3RpdmUpOiBBY3RpdmUgfCB1bmRlZmluZWQge1xyXG4gICAgbGV0IHByZXY6IEFjdGl2ZSB8IHVuZGVmaW5lZCA9IGFlLnByZXZJbkFFTDtcclxuICAgIHdoaWxlIChwcmV2ICYmIChDbGlwcGVyQmFzZS5pc09wZW4ocHJldikgfHwgIUNsaXBwZXJCYXNlLmlzSG90RWRnZUFjdGl2ZShwcmV2KSkpXHJcbiAgICAgIHByZXYgPSBwcmV2LnByZXZJbkFFTDtcclxuICAgIHJldHVybiBwcmV2O1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBzdGF0aWMgaXNGcm9udChhZTogQWN0aXZlKTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gYWUgPT09IGFlLm91dHJlYyEuZnJvbnRFZGdlO1xyXG4gIH1cclxuXHJcbiAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcclxuICAqICBEeDogICAgICAgICAgICAgICAgICAgICAgICAgICAgIDAoOTBkZWcpICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKlxyXG4gICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXHJcbiAgKiAgICAgICAgICAgICAgICtpbmYgKDE4MGRlZykgPC0tLSBvIC0tLiAtaW5mICgwZGVnKSAgICAgICAgICAgICAgICAgICAgICAgICAgKlxyXG4gICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXHJcblxyXG4gIHByaXZhdGUgc3RhdGljIGdldER4KHB0MTogSVBvaW50NjQsIHB0MjogSVBvaW50NjQpOiBudW1iZXIge1xyXG4gICAgY29uc3QgZHk6IG51bWJlciA9IHB0Mi55IC0gcHQxLnk7XHJcbiAgICBpZiAoZHkgIT09IDApXHJcbiAgICAgIHJldHVybiAocHQyLnggLSBwdDEueCkgLyBkeTtcclxuICAgIGlmIChwdDIueCA+IHB0MS54KVxyXG4gICAgICByZXR1cm4gTnVtYmVyLk5FR0FUSVZFX0lORklOSVRZO1xyXG4gICAgcmV0dXJuIE51bWJlci5QT1NJVElWRV9JTkZJTklUWTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgc3RhdGljIHRvcFgoYWU6IEFjdGl2ZSwgY3VycmVudFk6IG51bWJlcik6IG51bWJlciB7XHJcbiAgICBpZiAoKGN1cnJlbnRZID09PSBhZS50b3AueSkgfHwgKGFlLnRvcC54ID09PSBhZS5ib3QueCkpIHJldHVybiBhZS50b3AueDtcclxuICAgIGlmIChjdXJyZW50WSA9PT0gYWUuYm90LnkpIHJldHVybiBhZS5ib3QueDtcclxuICAgIHJldHVybiBhZS5ib3QueCArIE1hdGgucm91bmQoYWUuZHggKiAoY3VycmVudFkgLSBhZS5ib3QueSkpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBzdGF0aWMgaXNIb3Jpem9udGFsKGFlOiBBY3RpdmUpOiBib29sZWFuIHtcclxuICAgIHJldHVybiAoYWUudG9wLnkgPT09IGFlLmJvdC55KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgc3RhdGljIGlzSGVhZGluZ1JpZ2h0SG9yeihhZTogQWN0aXZlKTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gKE51bWJlci5ORUdBVElWRV9JTkZJTklUWSA9PT0gYWUuZHgpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBzdGF0aWMgaXNIZWFkaW5nTGVmdEhvcnooYWU6IEFjdGl2ZSk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuIChOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFkgPT09IGFlLmR4KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgc3RhdGljIHN3YXBBY3RpdmVzKGFlMTogQWN0aXZlLCBhZTI6IEFjdGl2ZSk6IHZvaWQge1xyXG4gICAgW2FlMiwgYWUxXSA9IFthZTEsIGFlMl07XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHN0YXRpYyBnZXRQb2x5VHlwZShhZTogQWN0aXZlKTogUGF0aFR5cGUge1xyXG4gICAgcmV0dXJuIGFlLmxvY2FsTWluLnBvbHl0eXBlO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBzdGF0aWMgaXNTYW1lUG9seVR5cGUoYWUxOiBBY3RpdmUsIGFlMjogQWN0aXZlKTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gYWUxLmxvY2FsTWluLnBvbHl0eXBlID09PSBhZTIubG9jYWxNaW4ucG9seXR5cGU7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHN0YXRpYyBzZXREeChhZTogQWN0aXZlKTogdm9pZCB7XHJcbiAgICBhZS5keCA9IENsaXBwZXJCYXNlLmdldER4KGFlLmJvdCwgYWUudG9wKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgc3RhdGljIG5leHRWZXJ0ZXgoYWU6IEFjdGl2ZSk6IFZlcnRleCB7XHJcbiAgICBpZiAoYWUud2luZER4ID4gMClcclxuICAgICAgcmV0dXJuIGFlLnZlcnRleFRvcCEubmV4dCE7XHJcbiAgICByZXR1cm4gYWUudmVydGV4VG9wIS5wcmV2ITtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgc3RhdGljIHByZXZQcmV2VmVydGV4KGFlOiBBY3RpdmUpOiBWZXJ0ZXgge1xyXG4gICAgaWYgKGFlLndpbmREeCA+IDApXHJcbiAgICAgIHJldHVybiBhZS52ZXJ0ZXhUb3AhLnByZXYhLnByZXYhO1xyXG4gICAgcmV0dXJuIGFlLnZlcnRleFRvcCEubmV4dCEubmV4dCE7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHN0YXRpYyBpc01heGltYSh2ZXJ0ZXg6IFZlcnRleCk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuICh2ZXJ0ZXguZmxhZ3MgJiBWZXJ0ZXhGbGFncy5Mb2NhbE1heCkgIT09IFZlcnRleEZsYWdzLk5vbmU7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHN0YXRpYyBpc01heGltYUFjdGl2ZShhZTogQWN0aXZlKTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gQ2xpcHBlckJhc2UuaXNNYXhpbWEoYWUudmVydGV4VG9wISk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHN0YXRpYyBnZXRNYXhpbWFQYWlyKGFlOiBBY3RpdmUpOiBBY3RpdmUgfCB1bmRlZmluZWQge1xyXG4gICAgbGV0IGFlMjogQWN0aXZlIHwgdW5kZWZpbmVkID0gYWUubmV4dEluQUVMO1xyXG4gICAgd2hpbGUgKGFlMikge1xyXG4gICAgICBpZiAoYWUyLnZlcnRleFRvcCA9PT0gYWUudmVydGV4VG9wKSByZXR1cm4gYWUyOyAvLyBGb3VuZCFcclxuICAgICAgYWUyID0gYWUyLm5leHRJbkFFTDtcclxuICAgIH1cclxuICAgIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHN0YXRpYyBnZXRDdXJyWU1heGltYVZlcnRleF9PcGVuKGFlOiBBY3RpdmUpOiBWZXJ0ZXggfCB1bmRlZmluZWQge1xyXG4gICAgbGV0IHJlc3VsdDogVmVydGV4IHwgdW5kZWZpbmVkID0gYWUudmVydGV4VG9wO1xyXG4gICAgaWYgKGFlLndpbmREeCA+IDApIHtcclxuICAgICAgd2hpbGUgKHJlc3VsdCEubmV4dCEucHQueSA9PT0gcmVzdWx0IS5wdC55ICYmXHJcbiAgICAgICAgKChyZXN1bHQhLmZsYWdzICYgKFZlcnRleEZsYWdzLk9wZW5FbmQgfFxyXG4gICAgICAgICAgVmVydGV4RmxhZ3MuTG9jYWxNYXgpKSA9PT0gVmVydGV4RmxhZ3MuTm9uZSkpXHJcbiAgICAgICAgcmVzdWx0ID0gcmVzdWx0IS5uZXh0O1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgd2hpbGUgKHJlc3VsdCEucHJldiEucHQueSA9PT0gcmVzdWx0IS5wdC55ICYmXHJcbiAgICAgICAgKChyZXN1bHQhLmZsYWdzICYgKFZlcnRleEZsYWdzLk9wZW5FbmQgfFxyXG4gICAgICAgICAgVmVydGV4RmxhZ3MuTG9jYWxNYXgpKSA9PT0gVmVydGV4RmxhZ3MuTm9uZSkpXHJcbiAgICAgICAgcmVzdWx0ID0gcmVzdWx0IS5wcmV2O1xyXG4gICAgfVxyXG4gICAgaWYgKCFDbGlwcGVyQmFzZS5pc01heGltYShyZXN1bHQhKSkgcmVzdWx0ID0gdW5kZWZpbmVkOyAvLyBub3QgYSBtYXhpbWFcclxuICAgIHJldHVybiByZXN1bHQ7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHN0YXRpYyBnZXRDdXJyWU1heGltYVZlcnRleChhZTogQWN0aXZlKTogVmVydGV4IHwgdW5kZWZpbmVkIHtcclxuICAgIGxldCByZXN1bHQ6IFZlcnRleCB8IHVuZGVmaW5lZCA9IGFlLnZlcnRleFRvcDtcclxuICAgIGlmIChhZS53aW5kRHggPiAwKSB7XHJcbiAgICAgIHdoaWxlIChyZXN1bHQhLm5leHQhLnB0LnkgPT09IHJlc3VsdCEucHQueSkgcmVzdWx0ID0gcmVzdWx0IS5uZXh0O1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgd2hpbGUgKHJlc3VsdCEucHJldiEucHQueSA9PT0gcmVzdWx0IS5wdC55KSByZXN1bHQgPSByZXN1bHQhLnByZXY7XHJcbiAgICB9XHJcbiAgICBpZiAoIUNsaXBwZXJCYXNlLmlzTWF4aW1hKHJlc3VsdCEpKSByZXN1bHQgPSB1bmRlZmluZWQ7IC8vIG5vdCBhIG1heGltYVxyXG4gICAgcmV0dXJuIHJlc3VsdDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgc3RhdGljIHNldFNpZGVzKG91dHJlYzogT3V0UmVjLCBzdGFydEVkZ2U6IEFjdGl2ZSwgZW5kRWRnZTogQWN0aXZlKTogdm9pZCB7XHJcbiAgICBvdXRyZWMuZnJvbnRFZGdlID0gc3RhcnRFZGdlO1xyXG4gICAgb3V0cmVjLmJhY2tFZGdlID0gZW5kRWRnZTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgc3RhdGljIHN3YXBPdXRyZWNzKGFlMTogQWN0aXZlLCBhZTI6IEFjdGl2ZSk6IHZvaWQge1xyXG4gICAgY29uc3Qgb3IxOiBPdXRSZWMgfCB1bmRlZmluZWQgPSBhZTEub3V0cmVjO1xyXG4gICAgY29uc3Qgb3IyOiBPdXRSZWMgfCB1bmRlZmluZWQgPSBhZTIub3V0cmVjO1xyXG4gICAgaWYgKG9yMSA9PT0gb3IyKSB7XHJcbiAgICAgIGNvbnN0IGFlOiBBY3RpdmUgfCB1bmRlZmluZWQgPSBvcjEhLmZyb250RWRnZTtcclxuICAgICAgb3IxIS5mcm9udEVkZ2UgPSBvcjEhLmJhY2tFZGdlO1xyXG4gICAgICBvcjEhLmJhY2tFZGdlID0gYWU7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBpZiAob3IxKSB7XHJcbiAgICAgIGlmIChhZTEgPT09IG9yMS5mcm9udEVkZ2UpXHJcbiAgICAgICAgb3IxLmZyb250RWRnZSA9IGFlMjtcclxuICAgICAgZWxzZVxyXG4gICAgICAgIG9yMS5iYWNrRWRnZSA9IGFlMjtcclxuICAgIH1cclxuXHJcbiAgICBpZiAob3IyKSB7XHJcbiAgICAgIGlmIChhZTIgPT09IG9yMi5mcm9udEVkZ2UpXHJcbiAgICAgICAgb3IyLmZyb250RWRnZSA9IGFlMTtcclxuICAgICAgZWxzZVxyXG4gICAgICAgIG9yMi5iYWNrRWRnZSA9IGFlMTtcclxuICAgIH1cclxuXHJcbiAgICBhZTEub3V0cmVjID0gb3IyO1xyXG4gICAgYWUyLm91dHJlYyA9IG9yMTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgc3RhdGljIHNldE93bmVyKG91dHJlYzogT3V0UmVjLCBuZXdPd25lcjogT3V0UmVjKTogdm9pZCB7XHJcbiAgICB3aGlsZSAobmV3T3duZXIub3duZXIgJiYgIW5ld093bmVyLm93bmVyLnB0cykge1xyXG4gICAgICBuZXdPd25lci5vd25lciA9IG5ld093bmVyLm93bmVyLm93bmVyO1xyXG4gICAgfVxyXG5cclxuICAgIC8vbWFrZSBzdXJlIHRoYXQgb3V0cmVjIGlzbid0IGFuIG93bmVyIG9mIG5ld093bmVyXHJcbiAgICBsZXQgdG1wOiBPdXRSZWMgfCB1bmRlZmluZWQgPSBuZXdPd25lcjtcclxuICAgIHdoaWxlICh0bXAgJiYgdG1wICE9PSBvdXRyZWMpXHJcbiAgICAgIHRtcCA9IHRtcC5vd25lcjtcclxuICAgIGlmICh0bXApXHJcbiAgICAgIG5ld093bmVyLm93bmVyID0gb3V0cmVjLm93bmVyO1xyXG4gICAgb3V0cmVjLm93bmVyID0gbmV3T3duZXI7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHN0YXRpYyBhcmVhKG9wOiBPdXRQdCk6IG51bWJlciB7XHJcbiAgICAvLyBodHRwczovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9TaG9lbGFjZV9mb3JtdWxhXHJcbiAgICBsZXQgYXJlYSA9IDAuMDtcclxuICAgIGxldCBvcDIgPSBvcDtcclxuICAgIGRvIHtcclxuICAgICAgYXJlYSArPSAob3AyLnByZXYucHQueSArIG9wMi5wdC55KSAqXHJcbiAgICAgICAgKG9wMi5wcmV2LnB0LnggLSBvcDIucHQueCk7XHJcbiAgICAgIG9wMiA9IG9wMi5uZXh0ITtcclxuICAgIH0gd2hpbGUgKG9wMiAhPT0gb3ApO1xyXG4gICAgcmV0dXJuIGFyZWEgKiAwLjU7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHN0YXRpYyBhcmVhVHJpYW5nbGUocHQxOiBJUG9pbnQ2NCwgcHQyOiBJUG9pbnQ2NCwgcHQzOiBJUG9pbnQ2NCk6IG51bWJlciB7XHJcbiAgICByZXR1cm4gKHB0My55ICsgcHQxLnkpICogKHB0My54IC0gcHQxLngpICtcclxuICAgICAgKHB0MS55ICsgcHQyLnkpICogKHB0MS54IC0gcHQyLngpICtcclxuICAgICAgKHB0Mi55ICsgcHQzLnkpICogKHB0Mi54IC0gcHQzLngpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBzdGF0aWMgZ2V0UmVhbE91dFJlYyhvdXRSZWM6IE91dFJlYyB8IHVuZGVmaW5lZCk6IE91dFJlYyB8IHVuZGVmaW5lZCB7XHJcbiAgICB3aGlsZSAob3V0UmVjICE9PSB1bmRlZmluZWQgJiYgb3V0UmVjLnB0cyA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgIG91dFJlYyA9IG91dFJlYy5vd25lcjtcclxuICAgIH1cclxuICAgIHJldHVybiBvdXRSZWM7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHN0YXRpYyBpc1ZhbGlkT3duZXIob3V0UmVjOiBPdXRSZWMgfCB1bmRlZmluZWQsIHRlc3RPd25lcjogT3V0UmVjIHwgdW5kZWZpbmVkKTogYm9vbGVhbiB7XHJcbiAgICB3aGlsZSAodGVzdE93bmVyICE9PSB1bmRlZmluZWQgJiYgdGVzdE93bmVyICE9PSBvdXRSZWMpXHJcbiAgICAgIHRlc3RPd25lciA9IHRlc3RPd25lci5vd25lcjtcclxuICAgIHJldHVybiB0ZXN0T3duZXIgPT09IHVuZGVmaW5lZDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgc3RhdGljIHVuY291cGxlT3V0UmVjKGFlOiBBY3RpdmUpOiB2b2lkIHtcclxuICAgIGNvbnN0IG91dHJlYyA9IGFlLm91dHJlYztcclxuICAgIGlmIChvdXRyZWMgPT09IHVuZGVmaW5lZCkgcmV0dXJuO1xyXG4gICAgb3V0cmVjLmZyb250RWRnZSEub3V0cmVjID0gdW5kZWZpbmVkO1xyXG4gICAgb3V0cmVjLmJhY2tFZGdlIS5vdXRyZWMgPSB1bmRlZmluZWQ7XHJcbiAgICBvdXRyZWMuZnJvbnRFZGdlID0gdW5kZWZpbmVkO1xyXG4gICAgb3V0cmVjLmJhY2tFZGdlID0gdW5kZWZpbmVkO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBzdGF0aWMgb3V0cmVjSXNBc2NlbmRpbmcoaG90RWRnZTogQWN0aXZlKTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gKGhvdEVkZ2UgPT09IGhvdEVkZ2Uub3V0cmVjIS5mcm9udEVkZ2UpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBzdGF0aWMgc3dhcEZyb250QmFja1NpZGVzKG91dHJlYzogT3V0UmVjKTogdm9pZCB7XHJcbiAgICAvLyB3aGlsZSB0aGlzIHByb2MuIGlzIG5lZWRlZCBmb3Igb3BlbiBwYXRoc1xyXG4gICAgLy8gaXQncyBhbG1vc3QgbmV2ZXIgbmVlZGVkIGZvciBjbG9zZWQgcGF0aHNcclxuICAgIGNvbnN0IGFlMiA9IG91dHJlYy5mcm9udEVkZ2UhO1xyXG4gICAgb3V0cmVjLmZyb250RWRnZSA9IG91dHJlYy5iYWNrRWRnZTtcclxuICAgIG91dHJlYy5iYWNrRWRnZSA9IGFlMjtcclxuICAgIG91dHJlYy5wdHMgPSBvdXRyZWMucHRzIS5uZXh0O1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBzdGF0aWMgZWRnZXNBZGphY2VudEluQUVMKGlub2RlOiBJbnRlcnNlY3ROb2RlKTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gKGlub2RlLmVkZ2UxLm5leHRJbkFFTCA9PT0gaW5vZGUuZWRnZTIpIHx8IChpbm9kZS5lZGdlMS5wcmV2SW5BRUwgPT09IGlub2RlLmVkZ2UyKTtcclxuICB9XHJcblxyXG4gIHByb3RlY3RlZCBjbGVhclNvbHV0aW9uT25seSgpOiB2b2lkIHtcclxuICAgIHdoaWxlICh0aGlzLl9hY3RpdmVzKSB0aGlzLmRlbGV0ZUZyb21BRUwodGhpcy5fYWN0aXZlcyk7XHJcbiAgICB0aGlzLl9zY2FubGluZUxpc3QuY2xlYXIoKVxyXG4gICAgdGhpcy5kaXNwb3NlSW50ZXJzZWN0Tm9kZXMoKTtcclxuICAgIHRoaXMuX291dHJlY0xpc3QubGVuZ3RoID0gMFxyXG4gICAgdGhpcy5faG9yelNlZ0xpc3QubGVuZ3RoID0gMFxyXG4gICAgdGhpcy5faG9yekpvaW5MaXN0Lmxlbmd0aCA9IDBcclxuICB9XHJcblxyXG4gIHB1YmxpYyBjbGVhcigpOiB2b2lkIHtcclxuICAgIHRoaXMuY2xlYXJTb2x1dGlvbk9ubHkoKTtcclxuICAgIHRoaXMuX21pbmltYUxpc3QubGVuZ3RoID0gMFxyXG4gICAgdGhpcy5fdmVydGV4TGlzdC5sZW5ndGggPSAwXHJcbiAgICB0aGlzLl9jdXJyZW50TG9jTWluID0gMDtcclxuICAgIHRoaXMuX2lzU29ydGVkTWluaW1hTGlzdCA9IGZhbHNlO1xyXG4gICAgdGhpcy5faGFzT3BlblBhdGhzID0gZmFsc2U7XHJcbiAgfVxyXG5cclxuICBwcm90ZWN0ZWQgcmVzZXQoKTogdm9pZCB7XHJcbiAgICBpZiAoIXRoaXMuX2lzU29ydGVkTWluaW1hTGlzdCkge1xyXG4gICAgICB0aGlzLl9taW5pbWFMaXN0LnNvcnQoKGxvY01pbjEsIGxvY01pbjIpID0+IGxvY01pbjIudmVydGV4LnB0LnkgLSBsb2NNaW4xLnZlcnRleC5wdC55KTtcclxuICAgICAgdGhpcy5faXNTb3J0ZWRNaW5pbWFMaXN0ID0gdHJ1ZTtcclxuICAgIH1cclxuXHJcbiAgICBmb3IgKGxldCBpID0gdGhpcy5fbWluaW1hTGlzdC5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xyXG4gICAgICB0aGlzLl9zY2FubGluZUxpc3QuYWRkKHRoaXMuX21pbmltYUxpc3RbaV0udmVydGV4LnB0LnkpO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuX2N1cnJlbnRCb3RZID0gMDtcclxuICAgIHRoaXMuX2N1cnJlbnRMb2NNaW4gPSAwO1xyXG4gICAgdGhpcy5fYWN0aXZlcyA9IHVuZGVmaW5lZDtcclxuICAgIHRoaXMuX3NlbCA9IHVuZGVmaW5lZDtcclxuICAgIHRoaXMuX3N1Y2NlZWRlZCA9IHRydWU7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGluc2VydFNjYW5saW5lKHk6IG51bWJlcik6IHZvaWQge1xyXG4gICAgdGhpcy5fc2NhbmxpbmVMaXN0LmFkZCh5KVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBwb3BTY2FubGluZSgpOiBudW1iZXIgfCB1bmRlZmluZWQge1xyXG4gICAgcmV0dXJuIHRoaXMuX3NjYW5saW5lTGlzdC5wb2xsTGFzdCgpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBoYXNMb2NNaW5BdFkoeTogbnVtYmVyKTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gKHRoaXMuX2N1cnJlbnRMb2NNaW4gPCB0aGlzLl9taW5pbWFMaXN0Lmxlbmd0aCAmJiB0aGlzLl9taW5pbWFMaXN0W3RoaXMuX2N1cnJlbnRMb2NNaW5dLnZlcnRleC5wdC55ID09IHkpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBwb3BMb2NhbE1pbmltYSgpOiBMb2NhbE1pbmltYSB7XHJcbiAgICByZXR1cm4gdGhpcy5fbWluaW1hTGlzdFt0aGlzLl9jdXJyZW50TG9jTWluKytdO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBhZGRMb2NNaW4odmVydDogVmVydGV4LCBwb2x5dHlwZTogUGF0aFR5cGUsIGlzT3BlbjogYm9vbGVhbik6IHZvaWQge1xyXG4gICAgLy8gbWFrZSBzdXJlIHRoZSB2ZXJ0ZXggaXMgYWRkZWQgb25seSBvbmNlIC4uLlxyXG4gICAgaWYgKCh2ZXJ0LmZsYWdzICYgVmVydGV4RmxhZ3MuTG9jYWxNaW4pICE9IFZlcnRleEZsYWdzLk5vbmUpIHJldHVyblxyXG5cclxuICAgIHZlcnQuZmxhZ3MgfD0gVmVydGV4RmxhZ3MuTG9jYWxNaW47XHJcblxyXG4gICAgY29uc3QgbG0gPSBuZXcgTG9jYWxNaW5pbWEodmVydCwgcG9seXR5cGUsIGlzT3Blbik7XHJcbiAgICB0aGlzLl9taW5pbWFMaXN0LnB1c2gobG0pO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGFkZFN1YmplY3QocGF0aDogUGF0aDY0KTogdm9pZCB7XHJcbiAgICB0aGlzLmFkZFBhdGgocGF0aCwgUGF0aFR5cGUuU3ViamVjdCk7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgYWRkT3BlblN1YmplY3QocGF0aDogUGF0aDY0KTogdm9pZCB7XHJcbiAgICB0aGlzLmFkZFBhdGgocGF0aCwgUGF0aFR5cGUuU3ViamVjdCwgdHJ1ZSk7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgYWRkQ2xpcChwYXRoOiBQYXRoNjQpOiB2b2lkIHtcclxuICAgIHRoaXMuYWRkUGF0aChwYXRoLCBQYXRoVHlwZS5DbGlwKTtcclxuICB9XHJcblxyXG4gIHByb3RlY3RlZCBhZGRQYXRoKHBhdGg6IFBhdGg2NCwgcG9seXR5cGU6IFBhdGhUeXBlLCBpc09wZW4gPSBmYWxzZSk6IHZvaWQge1xyXG4gICAgY29uc3QgdG1wOiBQYXRoczY0ID0gW3BhdGhdO1xyXG4gICAgdGhpcy5hZGRQYXRocyh0bXAsIHBvbHl0eXBlLCBpc09wZW4pO1xyXG4gIH1cclxuXHJcbiAgcHJvdGVjdGVkIGFkZFBhdGhzKHBhdGhzOiBQYXRoczY0LCBwb2x5dHlwZTogUGF0aFR5cGUsIGlzT3BlbiA9IGZhbHNlKTogdm9pZCB7XHJcbiAgICBpZiAoaXNPcGVuKSB0aGlzLl9oYXNPcGVuUGF0aHMgPSB0cnVlO1xyXG4gICAgdGhpcy5faXNTb3J0ZWRNaW5pbWFMaXN0ID0gZmFsc2U7XHJcbiAgICBDbGlwcGVyRW5naW5lLmFkZFBhdGhzVG9WZXJ0ZXhMaXN0KHBhdGhzLCBwb2x5dHlwZSwgaXNPcGVuLCB0aGlzLl9taW5pbWFMaXN0LCB0aGlzLl92ZXJ0ZXhMaXN0KTtcclxuICB9XHJcblxyXG4gIHByb3RlY3RlZCBhZGRSZXVzZWFibGVEYXRhKHJldXNlYWJsZURhdGE6IFJldXNlYWJsZURhdGFDb250YWluZXI2NCk6IHZvaWQge1xyXG4gICAgaWYgKHJldXNlYWJsZURhdGEuX21pbmltYUxpc3QubGVuZ3RoID09PSAwKSByZXR1cm47XHJcblxyXG4gICAgdGhpcy5faXNTb3J0ZWRNaW5pbWFMaXN0ID0gZmFsc2U7XHJcbiAgICBmb3IgKGNvbnN0IGxtIG9mIHJldXNlYWJsZURhdGEuX21pbmltYUxpc3QpIHtcclxuICAgICAgdGhpcy5fbWluaW1hTGlzdC5wdXNoKG5ldyBMb2NhbE1pbmltYShsbS52ZXJ0ZXgsIGxtLnBvbHl0eXBlLCBsbS5pc09wZW4pKTtcclxuICAgICAgaWYgKGxtLmlzT3BlbikgdGhpcy5faGFzT3BlblBhdGhzID0gdHJ1ZTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgaXNDb250cmlidXRpbmdDbG9zZWQoYWU6IEFjdGl2ZSk6IGJvb2xlYW4ge1xyXG4gICAgc3dpdGNoICh0aGlzLl9maWxscnVsZSkge1xyXG4gICAgICBjYXNlIEZpbGxSdWxlLlBvc2l0aXZlOlxyXG4gICAgICAgIGlmIChhZS53aW5kQ291bnQgIT09IDEpIHJldHVybiBmYWxzZTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgY2FzZSBGaWxsUnVsZS5OZWdhdGl2ZTpcclxuICAgICAgICBpZiAoYWUud2luZENvdW50ICE9PSAtMSkgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICBjYXNlIEZpbGxSdWxlLk5vblplcm86XHJcbiAgICAgICAgaWYgKE1hdGguYWJzKGFlLndpbmRDb3VudCkgIT09IDEpIHJldHVybiBmYWxzZTtcclxuICAgICAgICBicmVhaztcclxuICAgIH1cclxuXHJcbiAgICBzd2l0Y2ggKHRoaXMuX2NsaXB0eXBlKSB7XHJcbiAgICAgIGNhc2UgQ2xpcFR5cGUuSW50ZXJzZWN0aW9uOlxyXG4gICAgICAgIHN3aXRjaCAodGhpcy5fZmlsbHJ1bGUpIHtcclxuICAgICAgICAgIGNhc2UgRmlsbFJ1bGUuUG9zaXRpdmU6IHJldHVybiBhZS53aW5kQ291bnQyID4gMDtcclxuICAgICAgICAgIGNhc2UgRmlsbFJ1bGUuTmVnYXRpdmU6IHJldHVybiBhZS53aW5kQ291bnQyIDwgMDtcclxuICAgICAgICAgIGRlZmF1bHQ6IHJldHVybiBhZS53aW5kQ291bnQyICE9PSAwO1xyXG4gICAgICAgIH1cclxuICAgICAgY2FzZSBDbGlwVHlwZS5VbmlvbjpcclxuICAgICAgICBzd2l0Y2ggKHRoaXMuX2ZpbGxydWxlKSB7XHJcbiAgICAgICAgICBjYXNlIEZpbGxSdWxlLlBvc2l0aXZlOiByZXR1cm4gYWUud2luZENvdW50MiA8PSAwO1xyXG4gICAgICAgICAgY2FzZSBGaWxsUnVsZS5OZWdhdGl2ZTogcmV0dXJuIGFlLndpbmRDb3VudDIgPj0gMDtcclxuICAgICAgICAgIGRlZmF1bHQ6IHJldHVybiBhZS53aW5kQ291bnQyID09PSAwO1xyXG4gICAgICAgIH1cclxuICAgICAgY2FzZSBDbGlwVHlwZS5EaWZmZXJlbmNlOlxyXG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IHRoaXMuX2ZpbGxydWxlID09PSBGaWxsUnVsZS5Qb3NpdGl2ZSA/IChhZS53aW5kQ291bnQyIDw9IDApIDpcclxuICAgICAgICAgIHRoaXMuX2ZpbGxydWxlID09PSBGaWxsUnVsZS5OZWdhdGl2ZSA/IChhZS53aW5kQ291bnQyID49IDApIDpcclxuICAgICAgICAgICAgKGFlLndpbmRDb3VudDIgPT09IDApO1xyXG4gICAgICAgIHJldHVybiBDbGlwcGVyQmFzZS5nZXRQb2x5VHlwZShhZSkgPT09IFBhdGhUeXBlLlN1YmplY3QgPyByZXN1bHQgOiAhcmVzdWx0O1xyXG5cclxuICAgICAgY2FzZSBDbGlwVHlwZS5Yb3I6XHJcbiAgICAgICAgcmV0dXJuIHRydWU7XHJcblxyXG4gICAgICBkZWZhdWx0OlxyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgaXNDb250cmlidXRpbmdPcGVuKGFlOiBBY3RpdmUpOiBib29sZWFuIHtcclxuICAgIGxldCBpc0luQ2xpcDogYm9vbGVhbiwgaXNJblN1Ymo6IGJvb2xlYW47XHJcbiAgICBzd2l0Y2ggKHRoaXMuX2ZpbGxydWxlKSB7XHJcbiAgICAgIGNhc2UgRmlsbFJ1bGUuUG9zaXRpdmU6XHJcbiAgICAgICAgaXNJblN1YmogPSBhZS53aW5kQ291bnQgPiAwO1xyXG4gICAgICAgIGlzSW5DbGlwID0gYWUud2luZENvdW50MiA+IDA7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgIGNhc2UgRmlsbFJ1bGUuTmVnYXRpdmU6XHJcbiAgICAgICAgaXNJblN1YmogPSBhZS53aW5kQ291bnQgPCAwO1xyXG4gICAgICAgIGlzSW5DbGlwID0gYWUud2luZENvdW50MiA8IDA7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgaXNJblN1YmogPSBhZS53aW5kQ291bnQgIT09IDA7XHJcbiAgICAgICAgaXNJbkNsaXAgPSBhZS53aW5kQ291bnQyICE9PSAwO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgfVxyXG5cclxuICAgIHN3aXRjaCAodGhpcy5fY2xpcHR5cGUpIHtcclxuICAgICAgY2FzZSBDbGlwVHlwZS5JbnRlcnNlY3Rpb246XHJcbiAgICAgICAgcmV0dXJuIGlzSW5DbGlwO1xyXG4gICAgICBjYXNlIENsaXBUeXBlLlVuaW9uOlxyXG4gICAgICAgIHJldHVybiAhaXNJblN1YmogJiYgIWlzSW5DbGlwO1xyXG4gICAgICBkZWZhdWx0OlxyXG4gICAgICAgIHJldHVybiAhaXNJbkNsaXA7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHNldFdpbmRDb3VudEZvckNsb3NlZFBhdGhFZGdlKGFlOiBBY3RpdmUpOiB2b2lkIHtcclxuICAgIGxldCBhZTI6IEFjdGl2ZSB8IHVuZGVmaW5lZCA9IGFlLnByZXZJbkFFTDtcclxuICAgIGNvbnN0IHB0OiBQYXRoVHlwZSA9IENsaXBwZXJCYXNlLmdldFBvbHlUeXBlKGFlKTtcclxuXHJcbiAgICB3aGlsZSAoYWUyICE9PSB1bmRlZmluZWQgJiYgKENsaXBwZXJCYXNlLmdldFBvbHlUeXBlKGFlMikgIT09IHB0IHx8IENsaXBwZXJCYXNlLmlzT3BlbihhZTIpKSkge1xyXG4gICAgICBhZTIgPSBhZTIucHJldkluQUVMO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChhZTIgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICBhZS53aW5kQ291bnQgPSBhZS53aW5kRHg7XHJcbiAgICAgIGFlMiA9IHRoaXMuX2FjdGl2ZXM7XHJcbiAgICB9IGVsc2UgaWYgKHRoaXMuX2ZpbGxydWxlID09PSBGaWxsUnVsZS5FdmVuT2RkKSB7XHJcbiAgICAgIGFlLndpbmRDb3VudCA9IGFlLndpbmREeDtcclxuICAgICAgYWUud2luZENvdW50MiA9IGFlMi53aW5kQ291bnQyO1xyXG4gICAgICBhZTIgPSBhZTIubmV4dEluQUVMO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgLy8gTm9uWmVybywgcG9zaXRpdmUsIG9yIG5lZ2F0aXZlIGZpbGxpbmcgaGVyZSAuLi5cclxuICAgICAgLy8gd2hlbiBlMidzIFdpbmRDbnQgaXMgaW4gdGhlIFNBTUUgZGlyZWN0aW9uIGFzIGl0cyBXaW5kRHgsXHJcbiAgICAgIC8vIHRoZW4gcG9seWdvbiB3aWxsIGZpbGwgb24gdGhlIHJpZ2h0IG9mICdlMicgKGFuZCAnZScgd2lsbCBiZSBpbnNpZGUpXHJcbiAgICAgIC8vIG5iOiBuZWl0aGVyIGUyLldpbmRDbnQgbm9yIGUyLldpbmREeCBzaG91bGQgZXZlciBiZSAwLlxyXG4gICAgICBpZiAoYWUyLndpbmRDb3VudCAqIGFlMi53aW5kRHggPCAwKSB7XHJcbiAgICAgICAgLy8gb3Bwb3NpdGUgZGlyZWN0aW9ucyBzbyAnYWUnIGlzIG91dHNpZGUgJ2FlMicgLi4uXHJcbiAgICAgICAgaWYgKE1hdGguYWJzKGFlMi53aW5kQ291bnQpID4gMSkge1xyXG4gICAgICAgICAgLy8gb3V0c2lkZSBwcmV2IHBvbHkgYnV0IHN0aWxsIGluc2lkZSBhbm90aGVyLlxyXG4gICAgICAgICAgaWYgKGFlMi53aW5kRHggKiBhZS53aW5kRHggPCAwKVxyXG4gICAgICAgICAgICAvLyByZXZlcnNpbmcgZGlyZWN0aW9uIHNvIHVzZSB0aGUgc2FtZSBXQ1xyXG4gICAgICAgICAgICBhZS53aW5kQ291bnQgPSBhZTIud2luZENvdW50O1xyXG4gICAgICAgICAgZWxzZVxyXG4gICAgICAgICAgICAvLyBvdGhlcndpc2Uga2VlcCAncmVkdWNpbmcnIHRoZSBXQyBieSAxIChpLmUuIHRvd2FyZHMgMCkgLi4uXHJcbiAgICAgICAgICAgIGFlLndpbmRDb3VudCA9IGFlMi53aW5kQ291bnQgKyBhZS53aW5kRHg7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIC8vIG5vdyBvdXRzaWRlIGFsbCBwb2x5cyBvZiBzYW1lIHBvbHl0eXBlIHNvIHNldCBvd24gV0MgLi4uXHJcbiAgICAgICAgICBhZS53aW5kQ291bnQgPSAoQ2xpcHBlckJhc2UuaXNPcGVuKGFlKSA/IDEgOiBhZS53aW5kRHgpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICAvLyAnYWUnIG11c3QgYmUgaW5zaWRlICdhZTInXHJcbiAgICAgICAgaWYgKGFlMi53aW5kRHggKiBhZS53aW5kRHggPCAwKVxyXG4gICAgICAgICAgLy8gcmV2ZXJzaW5nIGRpcmVjdGlvbiBzbyB1c2UgdGhlIHNhbWUgV0NcclxuICAgICAgICAgIGFlLndpbmRDb3VudCA9IGFlMi53aW5kQ291bnQ7XHJcbiAgICAgICAgZWxzZVxyXG4gICAgICAgICAgLy8gb3RoZXJ3aXNlIGtlZXAgJ2luY3JlYXNpbmcnIHRoZSBXQyBieSAxIChpLmUuIGF3YXkgZnJvbSAwKSAuLi5cclxuICAgICAgICAgIGFlLndpbmRDb3VudCA9IGFlMi53aW5kQ291bnQgKyBhZS53aW5kRHg7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGFlLndpbmRDb3VudDIgPSBhZTIud2luZENvdW50MjtcclxuICAgICAgYWUyID0gYWUyLm5leHRJbkFFTDsgIC8vIGkuZS4gZ2V0IHJlYWR5IHRvIGNhbGMgV2luZENudDJcclxuXHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHRoaXMuX2ZpbGxydWxlID09PSBGaWxsUnVsZS5FdmVuT2RkKSB7XHJcbiAgICAgIHdoaWxlIChhZTIgIT09IGFlKSB7XHJcbiAgICAgICAgaWYgKENsaXBwZXJCYXNlLmdldFBvbHlUeXBlKGFlMiEpICE9PSBwdCAmJiAhQ2xpcHBlckJhc2UuaXNPcGVuKGFlMiEpKSB7XHJcbiAgICAgICAgICBhZS53aW5kQ291bnQyID0gKGFlLndpbmRDb3VudDIgPT09IDAgPyAxIDogMCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGFlMiA9IGFlMiEubmV4dEluQUVMO1xyXG4gICAgICB9XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB3aGlsZSAoYWUyICE9PSBhZSkge1xyXG4gICAgICAgIGlmIChDbGlwcGVyQmFzZS5nZXRQb2x5VHlwZShhZTIhKSAhPT0gcHQgJiYgIUNsaXBwZXJCYXNlLmlzT3BlbihhZTIhKSkge1xyXG4gICAgICAgICAgYWUud2luZENvdW50MiArPSBhZTIhLndpbmREeDtcclxuICAgICAgICB9XHJcbiAgICAgICAgYWUyID0gYWUyIS5uZXh0SW5BRUw7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgc2V0V2luZENvdW50Rm9yT3BlblBhdGhFZGdlKGFlOiBBY3RpdmUpIHtcclxuICAgIGxldCBhZTI6IEFjdGl2ZSB8IHVuZGVmaW5lZCA9IHRoaXMuX2FjdGl2ZXM7XHJcbiAgICBpZiAodGhpcy5fZmlsbHJ1bGUgPT09IEZpbGxSdWxlLkV2ZW5PZGQpIHtcclxuICAgICAgbGV0IGNudDEgPSAwLCBjbnQyID0gMDtcclxuICAgICAgd2hpbGUgKGFlMiAhPT0gYWUpIHtcclxuICAgICAgICBpZiAoQ2xpcHBlckJhc2UuZ2V0UG9seVR5cGUoYWUyISkgPT09IFBhdGhUeXBlLkNsaXApXHJcbiAgICAgICAgICBjbnQyKys7XHJcbiAgICAgICAgZWxzZSBpZiAoIUNsaXBwZXJCYXNlLmlzT3BlbihhZTIhKSlcclxuICAgICAgICAgIGNudDErKztcclxuICAgICAgICBhZTIgPSBhZTIhLm5leHRJbkFFTDtcclxuICAgICAgfVxyXG5cclxuICAgICAgYWUud2luZENvdW50ID0gKENsaXBwZXJCYXNlLmlzT2RkKGNudDEpID8gMSA6IDApO1xyXG4gICAgICBhZS53aW5kQ291bnQyID0gKENsaXBwZXJCYXNlLmlzT2RkKGNudDIpID8gMSA6IDApO1xyXG4gICAgfVxyXG4gICAgZWxzZSB7XHJcbiAgICAgIHdoaWxlIChhZTIgIT09IGFlKSB7XHJcbiAgICAgICAgaWYgKENsaXBwZXJCYXNlLmdldFBvbHlUeXBlKGFlMiEpID09PSBQYXRoVHlwZS5DbGlwKVxyXG4gICAgICAgICAgYWUud2luZENvdW50MiArPSBhZTIhLndpbmREeDtcclxuICAgICAgICBlbHNlIGlmICghQ2xpcHBlckJhc2UuaXNPcGVuKGFlMiEpKVxyXG4gICAgICAgICAgYWUud2luZENvdW50ICs9IGFlMiEud2luZER4O1xyXG4gICAgICAgIGFlMiA9IGFlMiEubmV4dEluQUVMO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHN0YXRpYyBpc1ZhbGlkQWVsT3JkZXIocmVzaWRlbnQ6IEFjdGl2ZSwgbmV3Y29tZXI6IEFjdGl2ZSk6IGJvb2xlYW4ge1xyXG4gICAgaWYgKG5ld2NvbWVyLmN1clggIT09IHJlc2lkZW50LmN1clgpXHJcbiAgICAgIHJldHVybiBuZXdjb21lci5jdXJYID4gcmVzaWRlbnQuY3VyWDtcclxuXHJcbiAgICAvLyBnZXQgdGhlIHR1cm5pbmcgZGlyZWN0aW9uICBhMS50b3AsIGEyLmJvdCwgYTIudG9wXHJcbiAgICBjb25zdCBkOiBudW1iZXIgPSBJbnRlcm5hbENsaXBwZXIuY3Jvc3NQcm9kdWN0KHJlc2lkZW50LnRvcCwgbmV3Y29tZXIuYm90LCBuZXdjb21lci50b3ApO1xyXG4gICAgaWYgKGQgIT09IDAuMCkgcmV0dXJuIChkIDwgMCk7XHJcblxyXG4gICAgLy8gZWRnZXMgbXVzdCBiZSBjb2xsaW5lYXIgdG8gZ2V0IGhlcmVcclxuXHJcbiAgICAvLyBmb3Igc3RhcnRpbmcgb3BlbiBwYXRocywgcGxhY2UgdGhlbSBhY2NvcmRpbmcgdG9cclxuICAgIC8vIHRoZSBkaXJlY3Rpb24gdGhleSdyZSBhYm91dCB0byB0dXJuXHJcbiAgICBpZiAoIXRoaXMuaXNNYXhpbWFBY3RpdmUocmVzaWRlbnQpICYmIChyZXNpZGVudC50b3AueSA+IG5ld2NvbWVyLnRvcC55KSkge1xyXG4gICAgICByZXR1cm4gSW50ZXJuYWxDbGlwcGVyLmNyb3NzUHJvZHVjdChuZXdjb21lci5ib3QsXHJcbiAgICAgICAgcmVzaWRlbnQudG9wLCB0aGlzLm5leHRWZXJ0ZXgocmVzaWRlbnQpLnB0KSA8PSAwO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICghdGhpcy5pc01heGltYUFjdGl2ZShuZXdjb21lcikgJiYgKG5ld2NvbWVyLnRvcC55ID4gcmVzaWRlbnQudG9wLnkpKSB7XHJcbiAgICAgIHJldHVybiBJbnRlcm5hbENsaXBwZXIuY3Jvc3NQcm9kdWN0KG5ld2NvbWVyLmJvdCxcclxuICAgICAgICBuZXdjb21lci50b3AsIHRoaXMubmV4dFZlcnRleChuZXdjb21lcikucHQpID49IDA7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgeTogbnVtYmVyID0gbmV3Y29tZXIuYm90Lnk7XHJcbiAgICBjb25zdCBuZXdjb21lcklzTGVmdDogYm9vbGVhbiA9IG5ld2NvbWVyLmlzTGVmdEJvdW5kO1xyXG5cclxuICAgIGlmIChyZXNpZGVudC5ib3QueSAhPT0geSB8fCByZXNpZGVudC5sb2NhbE1pbi52ZXJ0ZXgucHQueSAhPT0geSlcclxuICAgICAgcmV0dXJuIG5ld2NvbWVyLmlzTGVmdEJvdW5kO1xyXG4gICAgLy8gcmVzaWRlbnQgbXVzdCBhbHNvIGhhdmUganVzdCBiZWVuIGluc2VydGVkXHJcbiAgICBpZiAocmVzaWRlbnQuaXNMZWZ0Qm91bmQgIT09IG5ld2NvbWVySXNMZWZ0KVxyXG4gICAgICByZXR1cm4gbmV3Y29tZXJJc0xlZnQ7XHJcbiAgICBpZiAoSW50ZXJuYWxDbGlwcGVyLmNyb3NzUHJvZHVjdCh0aGlzLnByZXZQcmV2VmVydGV4KHJlc2lkZW50KS5wdCxcclxuICAgICAgcmVzaWRlbnQuYm90LCByZXNpZGVudC50b3ApID09PSAwKSByZXR1cm4gdHJ1ZTtcclxuICAgIC8vIGNvbXBhcmUgdHVybmluZyBkaXJlY3Rpb24gb2YgdGhlIGFsdGVybmF0ZSBib3VuZFxyXG4gICAgcmV0dXJuIChJbnRlcm5hbENsaXBwZXIuY3Jvc3NQcm9kdWN0KHRoaXMucHJldlByZXZWZXJ0ZXgocmVzaWRlbnQpLnB0LFxyXG4gICAgICBuZXdjb21lci5ib3QsIHRoaXMucHJldlByZXZWZXJ0ZXgobmV3Y29tZXIpLnB0KSA+IDApID09PSBuZXdjb21lcklzTGVmdDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgaW5zZXJ0TGVmdEVkZ2UoYWU6IEFjdGl2ZSk6IHZvaWQge1xyXG4gICAgbGV0IGFlMjogQWN0aXZlO1xyXG5cclxuICAgIGlmICghdGhpcy5fYWN0aXZlcykge1xyXG4gICAgICBhZS5wcmV2SW5BRUwgPSB1bmRlZmluZWQ7XHJcbiAgICAgIGFlLm5leHRJbkFFTCA9IHVuZGVmaW5lZDtcclxuICAgICAgdGhpcy5fYWN0aXZlcyA9IGFlO1xyXG4gICAgfSBlbHNlIGlmICghQ2xpcHBlckJhc2UuaXNWYWxpZEFlbE9yZGVyKHRoaXMuX2FjdGl2ZXMsIGFlKSkge1xyXG4gICAgICBhZS5wcmV2SW5BRUwgPSB1bmRlZmluZWQ7XHJcbiAgICAgIGFlLm5leHRJbkFFTCA9IHRoaXMuX2FjdGl2ZXM7XHJcbiAgICAgIHRoaXMuX2FjdGl2ZXMucHJldkluQUVMID0gYWU7XHJcbiAgICAgIHRoaXMuX2FjdGl2ZXMgPSBhZTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGFlMiA9IHRoaXMuX2FjdGl2ZXM7XHJcbiAgICAgIHdoaWxlIChhZTIubmV4dEluQUVMICYmIENsaXBwZXJCYXNlLmlzVmFsaWRBZWxPcmRlcihhZTIubmV4dEluQUVMLCBhZSkpXHJcbiAgICAgICAgYWUyID0gYWUyLm5leHRJbkFFTDtcclxuICAgICAgLy9kb24ndCBzZXBhcmF0ZSBqb2luZWQgZWRnZXNcclxuICAgICAgaWYgKGFlMi5qb2luV2l0aCA9PT0gSm9pbldpdGguUmlnaHQpIGFlMiA9IGFlMi5uZXh0SW5BRUwhO1xyXG4gICAgICBhZS5uZXh0SW5BRUwgPSBhZTIubmV4dEluQUVMO1xyXG4gICAgICBpZiAoYWUyLm5leHRJbkFFTCkgYWUyLm5leHRJbkFFTC5wcmV2SW5BRUwgPSBhZTtcclxuICAgICAgYWUucHJldkluQUVMID0gYWUyO1xyXG4gICAgICBhZTIubmV4dEluQUVMID0gYWU7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHN0YXRpYyBpbnNlcnRSaWdodEVkZ2UoYWU6IEFjdGl2ZSwgYWUyOiBBY3RpdmUpOiB2b2lkIHtcclxuICAgIGFlMi5uZXh0SW5BRUwgPSBhZS5uZXh0SW5BRUw7XHJcbiAgICBpZiAoYWUubmV4dEluQUVMKSBhZS5uZXh0SW5BRUwucHJldkluQUVMID0gYWUyO1xyXG4gICAgYWUyLnByZXZJbkFFTCA9IGFlO1xyXG4gICAgYWUubmV4dEluQUVMID0gYWUyO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBpbnNlcnRMb2NhbE1pbmltYUludG9BRUwoYm90WTogbnVtYmVyKTogdm9pZCB7XHJcbiAgICBsZXQgbG9jYWxNaW5pbWE6IExvY2FsTWluaW1hO1xyXG4gICAgbGV0IGxlZnRCb3VuZDogQWN0aXZlIHwgdW5kZWZpbmVkO1xyXG4gICAgbGV0IHJpZ2h0Qm91bmQ6IEFjdGl2ZSB8IHVuZGVmaW5lZDtcclxuXHJcbiAgICAvLyBBZGQgYW55IGxvY2FsIG1pbmltYSAoaWYgYW55KSBhdCBCb3RZIC4uLlxyXG4gICAgLy8gTkIgaG9yaXpvbnRhbCBsb2NhbCBtaW5pbWEgZWRnZXMgc2hvdWxkIGNvbnRhaW4gbG9jTWluLnZlcnRleC5wcmV2XHJcbiAgICB3aGlsZSAodGhpcy5oYXNMb2NNaW5BdFkoYm90WSkpIHtcclxuICAgICAgbG9jYWxNaW5pbWEgPSB0aGlzLnBvcExvY2FsTWluaW1hKCk7XHJcblxyXG4gICAgICBpZiAoKGxvY2FsTWluaW1hLnZlcnRleC5mbGFncyAmIFZlcnRleEZsYWdzLk9wZW5TdGFydCkgIT09IFZlcnRleEZsYWdzLk5vbmUpIHtcclxuICAgICAgICBsZWZ0Qm91bmQgPSB1bmRlZmluZWQ7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgbGVmdEJvdW5kID0gbmV3IEFjdGl2ZSgpXHJcbiAgICAgICAgbGVmdEJvdW5kLmJvdCA9IGxvY2FsTWluaW1hLnZlcnRleC5wdFxyXG4gICAgICAgIGxlZnRCb3VuZC5jdXJYID0gbG9jYWxNaW5pbWEudmVydGV4LnB0LnhcclxuICAgICAgICBsZWZ0Qm91bmQud2luZER4ID0gLTFcclxuICAgICAgICBsZWZ0Qm91bmQudmVydGV4VG9wID0gbG9jYWxNaW5pbWEudmVydGV4LnByZXZcclxuICAgICAgICBsZWZ0Qm91bmQudG9wID0gbG9jYWxNaW5pbWEudmVydGV4LnByZXYhLnB0XHJcbiAgICAgICAgbGVmdEJvdW5kLm91dHJlYyA9IHVuZGVmaW5lZFxyXG4gICAgICAgIGxlZnRCb3VuZC5sb2NhbE1pbiA9IGxvY2FsTWluaW1hXHJcblxyXG4gICAgICAgIENsaXBwZXJCYXNlLnNldER4KGxlZnRCb3VuZCk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGlmICgobG9jYWxNaW5pbWEudmVydGV4LmZsYWdzICYgVmVydGV4RmxhZ3MuT3BlbkVuZCkgIT09IFZlcnRleEZsYWdzLk5vbmUpIHtcclxuICAgICAgICByaWdodEJvdW5kID0gdW5kZWZpbmVkO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIHJpZ2h0Qm91bmQgPSBuZXcgQWN0aXZlKClcclxuICAgICAgICByaWdodEJvdW5kLmJvdCA9IGxvY2FsTWluaW1hLnZlcnRleC5wdFxyXG4gICAgICAgIHJpZ2h0Qm91bmQuY3VyWCA9IGxvY2FsTWluaW1hLnZlcnRleC5wdC54XHJcbiAgICAgICAgcmlnaHRCb3VuZC53aW5kRHggPSAxXHJcbiAgICAgICAgcmlnaHRCb3VuZC52ZXJ0ZXhUb3AgPSBsb2NhbE1pbmltYS52ZXJ0ZXgubmV4dFxyXG4gICAgICAgIHJpZ2h0Qm91bmQudG9wID0gbG9jYWxNaW5pbWEudmVydGV4Lm5leHQhLnB0XHJcbiAgICAgICAgcmlnaHRCb3VuZC5vdXRyZWMgPSB1bmRlZmluZWRcclxuICAgICAgICByaWdodEJvdW5kLmxvY2FsTWluID0gbG9jYWxNaW5pbWFcclxuXHJcbiAgICAgICAgQ2xpcHBlckJhc2Uuc2V0RHgocmlnaHRCb3VuZCk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGlmIChsZWZ0Qm91bmQgJiYgcmlnaHRCb3VuZCkge1xyXG4gICAgICAgIGlmIChDbGlwcGVyQmFzZS5pc0hvcml6b250YWwobGVmdEJvdW5kKSkge1xyXG4gICAgICAgICAgaWYgKENsaXBwZXJCYXNlLmlzSGVhZGluZ1JpZ2h0SG9yeihsZWZ0Qm91bmQpKSB7XHJcbiAgICAgICAgICAgIFtyaWdodEJvdW5kLCBsZWZ0Qm91bmRdID0gW2xlZnRCb3VuZCwgcmlnaHRCb3VuZF1cclxuICAgICAgICAgIH1cclxuICAgICAgICB9IGVsc2UgaWYgKENsaXBwZXJCYXNlLmlzSG9yaXpvbnRhbChyaWdodEJvdW5kKSkge1xyXG4gICAgICAgICAgaWYgKENsaXBwZXJCYXNlLmlzSGVhZGluZ0xlZnRIb3J6KHJpZ2h0Qm91bmQpKSB7XHJcbiAgICAgICAgICAgIFtyaWdodEJvdW5kLCBsZWZ0Qm91bmRdID0gW2xlZnRCb3VuZCwgcmlnaHRCb3VuZF1cclxuICAgICAgICAgIH1cclxuICAgICAgICB9IGVsc2UgaWYgKGxlZnRCb3VuZC5keCA8IHJpZ2h0Qm91bmQuZHgpIHtcclxuICAgICAgICAgIFtyaWdodEJvdW5kLCBsZWZ0Qm91bmRdID0gW2xlZnRCb3VuZCwgcmlnaHRCb3VuZF1cclxuICAgICAgICB9XHJcbiAgICAgICAgLy9zbyB3aGVuIGxlZnRCb3VuZCBoYXMgd2luZER4ID09IDEsIHRoZSBwb2x5Z29uIHdpbGwgYmUgb3JpZW50ZWRcclxuICAgICAgICAvL2NvdW50ZXItY2xvY2t3aXNlIGluIENhcnRlc2lhbiBjb29yZHMgKGNsb2Nrd2lzZSB3aXRoIGludmVydGVkIFkpLlxyXG4gICAgICB9IGVsc2UgaWYgKGxlZnRCb3VuZCA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgbGVmdEJvdW5kID0gcmlnaHRCb3VuZDtcclxuICAgICAgICByaWdodEJvdW5kID0gdW5kZWZpbmVkO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBsZXQgY29udHJpYnV0aW5nID0gZmFsc2VcclxuICAgICAgbGVmdEJvdW5kIS5pc0xlZnRCb3VuZCA9IHRydWU7XHJcbiAgICAgIHRoaXMuaW5zZXJ0TGVmdEVkZ2UobGVmdEJvdW5kISk7XHJcblxyXG4gICAgICBpZiAoQ2xpcHBlckJhc2UuaXNPcGVuKGxlZnRCb3VuZCEpKSB7XHJcbiAgICAgICAgdGhpcy5zZXRXaW5kQ291bnRGb3JPcGVuUGF0aEVkZ2UobGVmdEJvdW5kISk7XHJcbiAgICAgICAgY29udHJpYnV0aW5nID0gdGhpcy5pc0NvbnRyaWJ1dGluZ09wZW4obGVmdEJvdW5kISk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgdGhpcy5zZXRXaW5kQ291bnRGb3JDbG9zZWRQYXRoRWRnZShsZWZ0Qm91bmQhKTtcclxuICAgICAgICBjb250cmlidXRpbmcgPSB0aGlzLmlzQ29udHJpYnV0aW5nQ2xvc2VkKGxlZnRCb3VuZCEpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBpZiAocmlnaHRCb3VuZCkge1xyXG4gICAgICAgIHJpZ2h0Qm91bmQud2luZENvdW50ID0gbGVmdEJvdW5kIS53aW5kQ291bnQ7XHJcbiAgICAgICAgcmlnaHRCb3VuZC53aW5kQ291bnQyID0gbGVmdEJvdW5kIS53aW5kQ291bnQyO1xyXG4gICAgICAgIENsaXBwZXJCYXNlLmluc2VydFJpZ2h0RWRnZShsZWZ0Qm91bmQhLCByaWdodEJvdW5kKTtcclxuXHJcbiAgICAgICAgaWYgKGNvbnRyaWJ1dGluZykge1xyXG4gICAgICAgICAgdGhpcy5hZGRMb2NhbE1pblBvbHkobGVmdEJvdW5kISwgcmlnaHRCb3VuZCwgbGVmdEJvdW5kIS5ib3QsIHRydWUpO1xyXG4gICAgICAgICAgaWYgKCFDbGlwcGVyQmFzZS5pc0hvcml6b250YWwobGVmdEJvdW5kISkpIHtcclxuICAgICAgICAgICAgdGhpcy5jaGVja0pvaW5MZWZ0KGxlZnRCb3VuZCEsIGxlZnRCb3VuZCEuYm90KTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHdoaWxlIChyaWdodEJvdW5kLm5leHRJbkFFTCAmJlxyXG4gICAgICAgICAgQ2xpcHBlckJhc2UuaXNWYWxpZEFlbE9yZGVyKHJpZ2h0Qm91bmQubmV4dEluQUVMLCByaWdodEJvdW5kKSkge1xyXG4gICAgICAgICAgdGhpcy5pbnRlcnNlY3RFZGdlcyhyaWdodEJvdW5kLCByaWdodEJvdW5kLm5leHRJbkFFTCwgcmlnaHRCb3VuZC5ib3QpO1xyXG4gICAgICAgICAgdGhpcy5zd2FwUG9zaXRpb25zSW5BRUwocmlnaHRCb3VuZCwgcmlnaHRCb3VuZC5uZXh0SW5BRUwpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKENsaXBwZXJCYXNlLmlzSG9yaXpvbnRhbChyaWdodEJvdW5kKSkge1xyXG4gICAgICAgICAgdGhpcy5wdXNoSG9yeihyaWdodEJvdW5kKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgdGhpcy5jaGVja0pvaW5SaWdodChyaWdodEJvdW5kLCByaWdodEJvdW5kLmJvdCk7XHJcbiAgICAgICAgICB0aGlzLmluc2VydFNjYW5saW5lKHJpZ2h0Qm91bmQudG9wLnkpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgIH0gZWxzZSBpZiAoY29udHJpYnV0aW5nKSB7XHJcbiAgICAgICAgdGhpcy5zdGFydE9wZW5QYXRoKGxlZnRCb3VuZCEsIGxlZnRCb3VuZCEuYm90KTtcclxuICAgICAgfVxyXG5cclxuICAgICAgaWYgKENsaXBwZXJCYXNlLmlzSG9yaXpvbnRhbChsZWZ0Qm91bmQhKSkge1xyXG4gICAgICAgIHRoaXMucHVzaEhvcnoobGVmdEJvdW5kISk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgdGhpcy5pbnNlcnRTY2FubGluZShsZWZ0Qm91bmQhLnRvcC55KTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBwdXNoSG9yeihhZTogQWN0aXZlKTogdm9pZCB7XHJcbiAgICBhZS5uZXh0SW5TRUwgPSB0aGlzLl9zZWw7XHJcbiAgICB0aGlzLl9zZWwgPSBhZTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcG9wSG9yeigpOiBBY3RpdmUgfCB1bmRlZmluZWQge1xyXG4gICAgY29uc3QgYWUgPSB0aGlzLl9zZWw7XHJcbiAgICBpZiAodGhpcy5fc2VsID09PSB1bmRlZmluZWQpIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgICB0aGlzLl9zZWwgPSB0aGlzLl9zZWwubmV4dEluU0VMO1xyXG4gICAgcmV0dXJuIGFlO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBhZGRMb2NhbE1pblBvbHkoYWUxOiBBY3RpdmUsIGFlMjogQWN0aXZlLCBwdDogSVBvaW50NjQsIGlzTmV3OiBib29sZWFuID0gZmFsc2UpOiBPdXRQdCB7XHJcbiAgICBjb25zdCBvdXRyZWM6IE91dFJlYyA9IHRoaXMubmV3T3V0UmVjKCk7XHJcbiAgICBhZTEub3V0cmVjID0gb3V0cmVjO1xyXG4gICAgYWUyLm91dHJlYyA9IG91dHJlYztcclxuXHJcbiAgICBpZiAoQ2xpcHBlckJhc2UuaXNPcGVuKGFlMSkpIHtcclxuICAgICAgb3V0cmVjLm93bmVyID0gdW5kZWZpbmVkO1xyXG4gICAgICBvdXRyZWMuaXNPcGVuID0gdHJ1ZTtcclxuICAgICAgaWYgKGFlMS53aW5kRHggPiAwKVxyXG4gICAgICAgIENsaXBwZXJCYXNlLnNldFNpZGVzKG91dHJlYywgYWUxLCBhZTIpO1xyXG4gICAgICBlbHNlXHJcbiAgICAgICAgQ2xpcHBlckJhc2Uuc2V0U2lkZXMob3V0cmVjLCBhZTIsIGFlMSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBvdXRyZWMuaXNPcGVuID0gZmFsc2U7XHJcbiAgICAgIGNvbnN0IHByZXZIb3RFZGdlID0gQ2xpcHBlckJhc2UuZ2V0UHJldkhvdEVkZ2UoYWUxKTtcclxuXHJcbiAgICAgIC8vIGUud2luZER4IGlzIHRoZSB3aW5kaW5nIGRpcmVjdGlvbiBvZiB0aGUgKippbnB1dCoqIHBhdGhzXHJcbiAgICAgIC8vIGFuZCB1bnJlbGF0ZWQgdG8gdGhlIHdpbmRpbmcgZGlyZWN0aW9uIG9mIG91dHB1dCBwb2x5Z29ucy5cclxuICAgICAgLy8gT3V0cHV0IG9yaWVudGF0aW9uIGlzIGRldGVybWluZWQgYnkgZS5vdXRyZWMuZnJvbnRFIHdoaWNoIGlzXHJcbiAgICAgIC8vIHRoZSBhc2NlbmRpbmcgZWRnZSAoc2VlIEFkZExvY2FsTWluUG9seSkuXHJcbiAgICAgIGlmIChwcmV2SG90RWRnZSkge1xyXG4gICAgICAgIGlmICh0aGlzLl91c2luZ19wb2x5dHJlZSlcclxuICAgICAgICAgIENsaXBwZXJCYXNlLnNldE93bmVyKG91dHJlYywgcHJldkhvdEVkZ2Uub3V0cmVjISk7XHJcbiAgICAgICAgb3V0cmVjLm93bmVyID0gcHJldkhvdEVkZ2Uub3V0cmVjO1xyXG5cclxuICAgICAgICBpZiAoQ2xpcHBlckJhc2Uub3V0cmVjSXNBc2NlbmRpbmcocHJldkhvdEVkZ2UpID09PSBpc05ldylcclxuICAgICAgICAgIENsaXBwZXJCYXNlLnNldFNpZGVzKG91dHJlYywgYWUyLCBhZTEpO1xyXG4gICAgICAgIGVsc2VcclxuICAgICAgICAgIENsaXBwZXJCYXNlLnNldFNpZGVzKG91dHJlYywgYWUxLCBhZTIpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIG91dHJlYy5vd25lciA9IHVuZGVmaW5lZDtcclxuICAgICAgICBpZiAoaXNOZXcpXHJcbiAgICAgICAgICBDbGlwcGVyQmFzZS5zZXRTaWRlcyhvdXRyZWMsIGFlMSwgYWUyKTtcclxuICAgICAgICBlbHNlXHJcbiAgICAgICAgICBDbGlwcGVyQmFzZS5zZXRTaWRlcyhvdXRyZWMsIGFlMiwgYWUxKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IG9wID0gbmV3IE91dFB0KHB0LCBvdXRyZWMpO1xyXG4gICAgb3V0cmVjLnB0cyA9IG9wO1xyXG4gICAgcmV0dXJuIG9wO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBhZGRMb2NhbE1heFBvbHkoYWUxOiBBY3RpdmUsIGFlMjogQWN0aXZlLCBwdDogSVBvaW50NjQpOiBPdXRQdCB8IHVuZGVmaW5lZCB7XHJcbiAgICBpZiAoQ2xpcHBlckJhc2UuaXNKb2luZWQoYWUxKSkgdGhpcy5zcGxpdChhZTEsIHB0KTtcclxuICAgIGlmIChDbGlwcGVyQmFzZS5pc0pvaW5lZChhZTIpKSB0aGlzLnNwbGl0KGFlMiwgcHQpO1xyXG5cclxuICAgIGlmIChDbGlwcGVyQmFzZS5pc0Zyb250KGFlMSkgPT09IENsaXBwZXJCYXNlLmlzRnJvbnQoYWUyKSkge1xyXG4gICAgICBpZiAoQ2xpcHBlckJhc2UuaXNPcGVuRW5kQWN0aXZlKGFlMSkpXHJcbiAgICAgICAgQ2xpcHBlckJhc2Uuc3dhcEZyb250QmFja1NpZGVzKGFlMS5vdXRyZWMhKTtcclxuICAgICAgZWxzZSBpZiAoQ2xpcHBlckJhc2UuaXNPcGVuRW5kQWN0aXZlKGFlMikpXHJcbiAgICAgICAgQ2xpcHBlckJhc2Uuc3dhcEZyb250QmFja1NpZGVzKGFlMi5vdXRyZWMhKTtcclxuICAgICAgZWxzZSB7XHJcbiAgICAgICAgdGhpcy5fc3VjY2VlZGVkID0gZmFsc2U7XHJcbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHJlc3VsdCA9IENsaXBwZXJCYXNlLmFkZE91dFB0KGFlMSwgcHQpO1xyXG4gICAgaWYgKGFlMS5vdXRyZWMgPT09IGFlMi5vdXRyZWMpIHtcclxuICAgICAgY29uc3Qgb3V0cmVjID0gYWUxLm91dHJlYyE7XHJcbiAgICAgIG91dHJlYy5wdHMgPSByZXN1bHQ7XHJcblxyXG4gICAgICBpZiAodGhpcy5fdXNpbmdfcG9seXRyZWUpIHtcclxuICAgICAgICBjb25zdCBlID0gQ2xpcHBlckJhc2UuZ2V0UHJldkhvdEVkZ2UoYWUxKTtcclxuICAgICAgICBpZiAoZSA9PT0gdW5kZWZpbmVkKVxyXG4gICAgICAgICAgb3V0cmVjLm93bmVyID0gdW5kZWZpbmVkO1xyXG4gICAgICAgIGVsc2VcclxuICAgICAgICAgIENsaXBwZXJCYXNlLnNldE93bmVyKG91dHJlYywgZS5vdXRyZWMhKTtcclxuICAgICAgfVxyXG4gICAgICBDbGlwcGVyQmFzZS51bmNvdXBsZU91dFJlYyhhZTEpO1xyXG4gICAgfSBlbHNlIGlmIChDbGlwcGVyQmFzZS5pc09wZW4oYWUxKSkge1xyXG4gICAgICBpZiAoYWUxLndpbmREeCA8IDApXHJcbiAgICAgICAgQ2xpcHBlckJhc2Uuam9pbk91dHJlY1BhdGhzKGFlMSwgYWUyKTtcclxuICAgICAgZWxzZVxyXG4gICAgICAgIENsaXBwZXJCYXNlLmpvaW5PdXRyZWNQYXRocyhhZTIsIGFlMSk7XHJcbiAgICB9IGVsc2UgaWYgKGFlMS5vdXRyZWMhLmlkeCA8IGFlMi5vdXRyZWMhLmlkeClcclxuICAgICAgQ2xpcHBlckJhc2Uuam9pbk91dHJlY1BhdGhzKGFlMSwgYWUyKTtcclxuICAgIGVsc2VcclxuICAgICAgQ2xpcHBlckJhc2Uuam9pbk91dHJlY1BhdGhzKGFlMiwgYWUxKTtcclxuICAgIHJldHVybiByZXN1bHQ7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHN0YXRpYyBqb2luT3V0cmVjUGF0aHMoYWUxOiBBY3RpdmUsIGFlMjogQWN0aXZlKTogdm9pZCB7XHJcbiAgICAvLyBqb2luIGFlMiBvdXRyZWMgcGF0aCBvbnRvIGFlMSBvdXRyZWMgcGF0aCBhbmQgdGhlbiBkZWxldGUgYWUyIG91dHJlYyBwYXRoXHJcbiAgICAvLyBwb2ludGVycy4gKE5CIE9ubHkgdmVyeSByYXJlbHkgZG8gdGhlIGpvaW5pbmcgZW5kcyBzaGFyZSB0aGUgc2FtZSBjb29yZHMuKVxyXG4gICAgY29uc3QgcDFTdGFydDogT3V0UHQgPSBhZTEub3V0cmVjIS5wdHMhO1xyXG4gICAgY29uc3QgcDJTdGFydDogT3V0UHQgPSBhZTIub3V0cmVjIS5wdHMhO1xyXG4gICAgY29uc3QgcDFFbmQ6IE91dFB0ID0gcDFTdGFydC5uZXh0ITtcclxuICAgIGNvbnN0IHAyRW5kOiBPdXRQdCA9IHAyU3RhcnQubmV4dCE7XHJcblxyXG4gICAgaWYgKENsaXBwZXJCYXNlLmlzRnJvbnQoYWUxKSkge1xyXG4gICAgICBwMkVuZC5wcmV2ID0gcDFTdGFydDtcclxuICAgICAgcDFTdGFydC5uZXh0ID0gcDJFbmQ7XHJcbiAgICAgIHAyU3RhcnQubmV4dCA9IHAxRW5kO1xyXG4gICAgICBwMUVuZC5wcmV2ID0gcDJTdGFydDtcclxuXHJcbiAgICAgIGFlMS5vdXRyZWMhLnB0cyA9IHAyU3RhcnQ7XHJcbiAgICAgIC8vIG5iOiBpZiBJc09wZW4oZTEpIHRoZW4gZTEgJiBlMiBtdXN0IGJlIGEgJ21heGltYVBhaXInXHJcbiAgICAgIGFlMS5vdXRyZWMhLmZyb250RWRnZSA9IGFlMi5vdXRyZWMhLmZyb250RWRnZTtcclxuICAgICAgaWYgKGFlMS5vdXRyZWMhLmZyb250RWRnZSlcclxuICAgICAgICBhZTEub3V0cmVjIS5mcm9udEVkZ2UhLm91dHJlYyA9IGFlMS5vdXRyZWM7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBwMUVuZC5wcmV2ID0gcDJTdGFydDtcclxuICAgICAgcDJTdGFydC5uZXh0ID0gcDFFbmQ7XHJcbiAgICAgIHAxU3RhcnQubmV4dCA9IHAyRW5kO1xyXG4gICAgICBwMkVuZC5wcmV2ID0gcDFTdGFydDtcclxuXHJcbiAgICAgIGFlMS5vdXRyZWMhLmJhY2tFZGdlID0gYWUyLm91dHJlYyEuYmFja0VkZ2U7XHJcbiAgICAgIGlmIChhZTEub3V0cmVjIS5iYWNrRWRnZSlcclxuICAgICAgICBhZTEub3V0cmVjIS5iYWNrRWRnZSEub3V0cmVjID0gYWUxLm91dHJlYztcclxuICAgIH1cclxuXHJcbiAgICAvLyBhZnRlciBqb2luaW5nLCB0aGUgYWUyLk91dFJlYyBtdXN0IGNvbnRhaW5zIG5vIHZlcnRpY2VzIC4uLlxyXG4gICAgYWUyLm91dHJlYyEuZnJvbnRFZGdlID0gdW5kZWZpbmVkO1xyXG4gICAgYWUyLm91dHJlYyEuYmFja0VkZ2UgPSB1bmRlZmluZWQ7XHJcbiAgICBhZTIub3V0cmVjIS5wdHMgPSB1bmRlZmluZWQ7XHJcbiAgICBDbGlwcGVyQmFzZS5zZXRPd25lcihhZTIub3V0cmVjISwgYWUxLm91dHJlYyEpO1xyXG5cclxuICAgIGlmIChDbGlwcGVyQmFzZS5pc09wZW5FbmRBY3RpdmUoYWUxKSkge1xyXG4gICAgICBhZTIub3V0cmVjIS5wdHMgPSBhZTEub3V0cmVjIS5wdHM7XHJcbiAgICAgIGFlMS5vdXRyZWMhLnB0cyA9IHVuZGVmaW5lZDtcclxuICAgIH1cclxuXHJcbiAgICAvLyBhbmQgYWUxIGFuZCBhZTIgYXJlIG1heGltYSBhbmQgYXJlIGFib3V0IHRvIGJlIGRyb3BwZWQgZnJvbSB0aGUgQWN0aXZlcyBsaXN0LlxyXG4gICAgYWUxLm91dHJlYyA9IHVuZGVmaW5lZDtcclxuICAgIGFlMi5vdXRyZWMgPSB1bmRlZmluZWQ7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHN0YXRpYyBhZGRPdXRQdChhZTogQWN0aXZlLCBwdDogSVBvaW50NjQpOiBPdXRQdCB7XHJcbiAgICBjb25zdCBvdXRyZWM6IE91dFJlYyA9IGFlLm91dHJlYyE7XHJcbiAgICBjb25zdCB0b0Zyb250OiBib29sZWFuID0gQ2xpcHBlckJhc2UuaXNGcm9udChhZSk7XHJcbiAgICBjb25zdCBvcEZyb250OiBPdXRQdCA9IG91dHJlYy5wdHMhO1xyXG4gICAgY29uc3Qgb3BCYWNrOiBPdXRQdCA9IG9wRnJvbnQubmV4dCE7XHJcblxyXG4gICAgaWYgKHRvRnJvbnQgJiYgKHB0ID09IG9wRnJvbnQucHQpKSByZXR1cm4gb3BGcm9udDtcclxuICAgIGVsc2UgaWYgKCF0b0Zyb250ICYmIChwdCA9PSBvcEJhY2sucHQpKSByZXR1cm4gb3BCYWNrO1xyXG5cclxuICAgIGNvbnN0IG5ld09wID0gbmV3IE91dFB0KHB0LCBvdXRyZWMpO1xyXG4gICAgb3BCYWNrLnByZXYgPSBuZXdPcDtcclxuICAgIG5ld09wLnByZXYgPSBvcEZyb250O1xyXG4gICAgbmV3T3AubmV4dCA9IG9wQmFjaztcclxuICAgIG9wRnJvbnQubmV4dCA9IG5ld09wO1xyXG5cclxuICAgIGlmICh0b0Zyb250KSBvdXRyZWMucHRzID0gbmV3T3A7XHJcblxyXG4gICAgcmV0dXJuIG5ld09wO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBuZXdPdXRSZWMoKTogT3V0UmVjIHtcclxuICAgIGNvbnN0IHJlc3VsdCA9IG5ldyBPdXRSZWModGhpcy5fb3V0cmVjTGlzdC5sZW5ndGgpO1xyXG4gICAgdGhpcy5fb3V0cmVjTGlzdC5wdXNoKHJlc3VsdCk7XHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBzdGFydE9wZW5QYXRoKGFlOiBBY3RpdmUsIHB0OiBJUG9pbnQ2NCk6IE91dFB0IHtcclxuICAgIGNvbnN0IG91dHJlYyA9IHRoaXMubmV3T3V0UmVjKCk7XHJcbiAgICBvdXRyZWMuaXNPcGVuID0gdHJ1ZTtcclxuICAgIGlmIChhZS53aW5kRHggPiAwKSB7XHJcbiAgICAgIG91dHJlYy5mcm9udEVkZ2UgPSBhZTtcclxuICAgICAgb3V0cmVjLmJhY2tFZGdlID0gdW5kZWZpbmVkO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgb3V0cmVjLmZyb250RWRnZSA9IHVuZGVmaW5lZDtcclxuICAgICAgb3V0cmVjLmJhY2tFZGdlID0gYWU7XHJcbiAgICB9XHJcblxyXG4gICAgYWUub3V0cmVjID0gb3V0cmVjO1xyXG4gICAgY29uc3Qgb3AgPSBuZXcgT3V0UHQocHQsIG91dHJlYyk7XHJcbiAgICBvdXRyZWMucHRzID0gb3A7XHJcbiAgICByZXR1cm4gb3A7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHVwZGF0ZUVkZ2VJbnRvQUVMKGFlOiBBY3RpdmUpOiB2b2lkIHtcclxuICAgIGFlLmJvdCA9IGFlLnRvcCE7XHJcbiAgICBhZS52ZXJ0ZXhUb3AgPSBDbGlwcGVyQmFzZS5uZXh0VmVydGV4KGFlKTtcclxuICAgIGFlLnRvcCA9IGFlLnZlcnRleFRvcCEucHQ7XHJcbiAgICBhZS5jdXJYID0gYWUuYm90Lng7XHJcbiAgICBDbGlwcGVyQmFzZS5zZXREeChhZSk7XHJcblxyXG4gICAgaWYgKENsaXBwZXJCYXNlLmlzSm9pbmVkKGFlKSkgdGhpcy5zcGxpdChhZSwgYWUuYm90KTtcclxuXHJcbiAgICBpZiAoQ2xpcHBlckJhc2UuaXNIb3Jpem9udGFsKGFlKSkgcmV0dXJuO1xyXG4gICAgdGhpcy5pbnNlcnRTY2FubGluZShhZS50b3AueSk7XHJcblxyXG4gICAgdGhpcy5jaGVja0pvaW5MZWZ0KGFlLCBhZS5ib3QpO1xyXG4gICAgdGhpcy5jaGVja0pvaW5SaWdodChhZSwgYWUuYm90LCB0cnVlKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgc3RhdGljIGZpbmRFZGdlV2l0aE1hdGNoaW5nTG9jTWluKGU6IEFjdGl2ZSk6IEFjdGl2ZSB8IHVuZGVmaW5lZCB7XHJcbiAgICBsZXQgcmVzdWx0OiBBY3RpdmUgfCB1bmRlZmluZWQgPSBlLm5leHRJbkFFTDtcclxuICAgIHdoaWxlIChyZXN1bHQpIHtcclxuICAgICAgaWYgKHJlc3VsdC5sb2NhbE1pbiA9PT0gZS5sb2NhbE1pbikgcmV0dXJuIHJlc3VsdDtcclxuICAgICAgaWYgKCFDbGlwcGVyQmFzZS5pc0hvcml6b250YWwocmVzdWx0KSAmJiBlLmJvdCAhPT0gcmVzdWx0LmJvdCkgcmVzdWx0ID0gdW5kZWZpbmVkO1xyXG4gICAgICBlbHNlIHJlc3VsdCA9IHJlc3VsdC5uZXh0SW5BRUw7XHJcbiAgICB9XHJcblxyXG4gICAgcmVzdWx0ID0gZS5wcmV2SW5BRUw7XHJcbiAgICB3aGlsZSAocmVzdWx0KSB7XHJcbiAgICAgIGlmIChyZXN1bHQubG9jYWxNaW4gPT09IGUubG9jYWxNaW4pIHJldHVybiByZXN1bHQ7XHJcbiAgICAgIGlmICghQ2xpcHBlckJhc2UuaXNIb3Jpem9udGFsKHJlc3VsdCkgJiYgZS5ib3QgIT09IHJlc3VsdC5ib3QpIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgICAgIHJlc3VsdCA9IHJlc3VsdC5wcmV2SW5BRUw7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHJlc3VsdDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgaW50ZXJzZWN0RWRnZXMoYWUxOiBBY3RpdmUsIGFlMjogQWN0aXZlLCBwdDogSVBvaW50NjQpOiBPdXRQdCB8IHVuZGVmaW5lZCB7XHJcbiAgICBsZXQgcmVzdWx0T3A6IE91dFB0IHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xyXG5cclxuICAgIC8vIE1BTkFHRSBPUEVOIFBBVEggSU5URVJTRUNUSU9OUyBTRVBBUkFURUxZIC4uLlxyXG4gICAgaWYgKHRoaXMuX2hhc09wZW5QYXRocyAmJiAoQ2xpcHBlckJhc2UuaXNPcGVuKGFlMSkgfHwgQ2xpcHBlckJhc2UuaXNPcGVuKGFlMikpKSB7XHJcbiAgICAgIGlmIChDbGlwcGVyQmFzZS5pc09wZW4oYWUxKSAmJiBDbGlwcGVyQmFzZS5pc09wZW4oYWUyKSkgcmV0dXJuIHVuZGVmaW5lZDtcclxuICAgICAgLy8gdGhlIGZvbGxvd2luZyBsaW5lIGF2b2lkcyBkdXBsaWNhdGluZyBxdWl0ZSBhIGJpdCBvZiBjb2RlXHJcbiAgICAgIGlmIChDbGlwcGVyQmFzZS5pc09wZW4oYWUyKSkgQ2xpcHBlckJhc2Uuc3dhcEFjdGl2ZXMoYWUxLCBhZTIpO1xyXG4gICAgICBpZiAoQ2xpcHBlckJhc2UuaXNKb2luZWQoYWUyKSkgdGhpcy5zcGxpdChhZTIsIHB0KTtcclxuXHJcbiAgICAgIGlmICh0aGlzLl9jbGlwdHlwZSA9PT0gQ2xpcFR5cGUuVW5pb24pIHtcclxuICAgICAgICBpZiAoIUNsaXBwZXJCYXNlLmlzSG90RWRnZUFjdGl2ZShhZTIpKSByZXR1cm4gdW5kZWZpbmVkO1xyXG4gICAgICB9IGVsc2UgaWYgKGFlMi5sb2NhbE1pbi5wb2x5dHlwZSA9PT0gUGF0aFR5cGUuU3ViamVjdClcclxuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xyXG5cclxuICAgICAgc3dpdGNoICh0aGlzLl9maWxscnVsZSkge1xyXG4gICAgICAgIGNhc2UgRmlsbFJ1bGUuUG9zaXRpdmU6XHJcbiAgICAgICAgICBpZiAoYWUyLndpbmRDb3VudCAhPT0gMSkgcmV0dXJuIHVuZGVmaW5lZDtcclxuICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgRmlsbFJ1bGUuTmVnYXRpdmU6XHJcbiAgICAgICAgICBpZiAoYWUyLndpbmRDb3VudCAhPT0gLTEpIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgICAgICAgICBicmVhaztcclxuICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgaWYgKE1hdGguYWJzKGFlMi53aW5kQ291bnQpICE9PSAxKSByZXR1cm4gdW5kZWZpbmVkO1xyXG4gICAgICAgICAgYnJlYWs7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8vIHRvZ2dsZSBjb250cmlidXRpb24gLi4uXHJcbiAgICAgIGlmIChDbGlwcGVyQmFzZS5pc0hvdEVkZ2VBY3RpdmUoYWUxKSkge1xyXG4gICAgICAgIHJlc3VsdE9wID0gQ2xpcHBlckJhc2UuYWRkT3V0UHQoYWUxLCBwdCk7XHJcbiAgICAgICAgaWYgKENsaXBwZXJCYXNlLmlzRnJvbnQoYWUxKSkge1xyXG4gICAgICAgICAgYWUxLm91dHJlYyEuZnJvbnRFZGdlID0gdW5kZWZpbmVkO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICBhZTEub3V0cmVjIS5iYWNrRWRnZSA9IHVuZGVmaW5lZDtcclxuICAgICAgICB9XHJcbiAgICAgICAgYWUxLm91dHJlYyA9IHVuZGVmaW5lZDtcclxuXHJcbiAgICAgICAgLy8gaG9yaXpvbnRhbCBlZGdlcyBjYW4gcGFzcyB1bmRlciBvcGVuIHBhdGhzIGF0IGEgTG9jTWluc1xyXG4gICAgICB9IGVsc2UgaWYgKHB0ID09PSBhZTEubG9jYWxNaW4udmVydGV4LnB0ICYmICFDbGlwcGVyQmFzZS5pc09wZW5FbmQoYWUxLmxvY2FsTWluLnZlcnRleCkpIHtcclxuICAgICAgICAvLyBmaW5kIHRoZSBvdGhlciBzaWRlIG9mIHRoZSBMb2NNaW4gYW5kXHJcbiAgICAgICAgLy8gaWYgaXQncyAnaG90JyBqb2luIHVwIHdpdGggaXQgLi4uXHJcbiAgICAgICAgY29uc3QgYWUzOiBBY3RpdmUgfCB1bmRlZmluZWQgPSBDbGlwcGVyQmFzZS5maW5kRWRnZVdpdGhNYXRjaGluZ0xvY01pbihhZTEpO1xyXG4gICAgICAgIGlmIChhZTMgJiYgQ2xpcHBlckJhc2UuaXNIb3RFZGdlQWN0aXZlKGFlMykpIHtcclxuICAgICAgICAgIGFlMS5vdXRyZWMgPSBhZTMub3V0cmVjO1xyXG4gICAgICAgICAgaWYgKGFlMS53aW5kRHggPiAwKSB7XHJcbiAgICAgICAgICAgIENsaXBwZXJCYXNlLnNldFNpZGVzKGFlMy5vdXRyZWMhLCBhZTEsIGFlMyk7XHJcbiAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBDbGlwcGVyQmFzZS5zZXRTaWRlcyhhZTMub3V0cmVjISwgYWUzLCBhZTEpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgcmV0dXJuIGFlMy5vdXRyZWMhLnB0cztcclxuICAgICAgICB9XHJcbiAgICAgICAgcmVzdWx0T3AgPSB0aGlzLnN0YXJ0T3BlblBhdGgoYWUxLCBwdCk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgcmVzdWx0T3AgPSB0aGlzLnN0YXJ0T3BlblBhdGgoYWUxLCBwdCk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIHJldHVybiByZXN1bHRPcDtcclxuICAgIH1cclxuXHJcbiAgICAvLyBNQU5BR0lORyBDTE9TRUQgUEFUSFMgRlJPTSBIRVJFIE9OXHJcbiAgICBpZiAoQ2xpcHBlckJhc2UuaXNKb2luZWQoYWUxKSkgdGhpcy5zcGxpdChhZTEsIHB0KTtcclxuICAgIGlmIChDbGlwcGVyQmFzZS5pc0pvaW5lZChhZTIpKSB0aGlzLnNwbGl0KGFlMiwgcHQpO1xyXG5cclxuICAgIC8vIFVQREFURSBXSU5ESU5HIENPVU5UUy4uLlxyXG4gICAgbGV0IG9sZEUxV2luZENvdW50OiBudW1iZXI7XHJcbiAgICBsZXQgb2xkRTJXaW5kQ291bnQ6IG51bWJlcjtcclxuXHJcbiAgICBpZiAoYWUxLmxvY2FsTWluLnBvbHl0eXBlID09PSBhZTIubG9jYWxNaW4ucG9seXR5cGUpIHtcclxuICAgICAgaWYgKHRoaXMuX2ZpbGxydWxlID09PSBGaWxsUnVsZS5FdmVuT2RkKSB7XHJcbiAgICAgICAgb2xkRTFXaW5kQ291bnQgPSBhZTEud2luZENvdW50O1xyXG4gICAgICAgIGFlMS53aW5kQ291bnQgPSBhZTIud2luZENvdW50O1xyXG4gICAgICAgIGFlMi53aW5kQ291bnQgPSBvbGRFMVdpbmRDb3VudDtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBpZiAoYWUxLndpbmRDb3VudCArIGFlMi53aW5kRHggPT09IDApXHJcbiAgICAgICAgICBhZTEud2luZENvdW50ID0gLWFlMS53aW5kQ291bnQ7XHJcbiAgICAgICAgZWxzZVxyXG4gICAgICAgICAgYWUxLndpbmRDb3VudCArPSBhZTIud2luZER4O1xyXG4gICAgICAgIGlmIChhZTIud2luZENvdW50IC0gYWUxLndpbmREeCA9PT0gMClcclxuICAgICAgICAgIGFlMi53aW5kQ291bnQgPSAtYWUyLndpbmRDb3VudDtcclxuICAgICAgICBlbHNlXHJcbiAgICAgICAgICBhZTIud2luZENvdW50IC09IGFlMS53aW5kRHg7XHJcbiAgICAgIH1cclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGlmICh0aGlzLl9maWxscnVsZSAhPT0gRmlsbFJ1bGUuRXZlbk9kZClcclxuICAgICAgICBhZTEud2luZENvdW50MiArPSBhZTIud2luZER4O1xyXG4gICAgICBlbHNlXHJcbiAgICAgICAgYWUxLndpbmRDb3VudDIgPSAoYWUxLndpbmRDb3VudDIgPT09IDAgPyAxIDogMCk7XHJcbiAgICAgIGlmICh0aGlzLl9maWxscnVsZSAhPT0gRmlsbFJ1bGUuRXZlbk9kZClcclxuICAgICAgICBhZTIud2luZENvdW50MiAtPSBhZTEud2luZER4O1xyXG4gICAgICBlbHNlXHJcbiAgICAgICAgYWUyLndpbmRDb3VudDIgPSAoYWUyLndpbmRDb3VudDIgPT09IDAgPyAxIDogMCk7XHJcbiAgICB9XHJcblxyXG4gICAgc3dpdGNoICh0aGlzLl9maWxscnVsZSkge1xyXG4gICAgICBjYXNlIEZpbGxSdWxlLlBvc2l0aXZlOlxyXG4gICAgICAgIG9sZEUxV2luZENvdW50ID0gYWUxLndpbmRDb3VudDtcclxuICAgICAgICBvbGRFMldpbmRDb3VudCA9IGFlMi53aW5kQ291bnQ7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgIGNhc2UgRmlsbFJ1bGUuTmVnYXRpdmU6XHJcbiAgICAgICAgb2xkRTFXaW5kQ291bnQgPSAtYWUxLndpbmRDb3VudDtcclxuICAgICAgICBvbGRFMldpbmRDb3VudCA9IC1hZTIud2luZENvdW50O1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICBkZWZhdWx0OlxyXG4gICAgICAgIG9sZEUxV2luZENvdW50ID0gTWF0aC5hYnMoYWUxLndpbmRDb3VudCk7XHJcbiAgICAgICAgb2xkRTJXaW5kQ291bnQgPSBNYXRoLmFicyhhZTIud2luZENvdW50KTtcclxuICAgICAgICBicmVhaztcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBlMVdpbmRDb3VudElzMG9yMTogYm9vbGVhbiA9IG9sZEUxV2luZENvdW50ID09PSAwIHx8IG9sZEUxV2luZENvdW50ID09PSAxO1xyXG4gICAgY29uc3QgZTJXaW5kQ291bnRJczBvcjE6IGJvb2xlYW4gPSBvbGRFMldpbmRDb3VudCA9PT0gMCB8fCBvbGRFMldpbmRDb3VudCA9PT0gMTtcclxuXHJcbiAgICBpZiAoKCFDbGlwcGVyQmFzZS5pc0hvdEVkZ2VBY3RpdmUoYWUxKSAmJiAhZTFXaW5kQ291bnRJczBvcjEpIHx8ICghQ2xpcHBlckJhc2UuaXNIb3RFZGdlQWN0aXZlKGFlMikgJiYgIWUyV2luZENvdW50SXMwb3IxKSkgcmV0dXJuIHVuZGVmaW5lZDtcclxuXHJcbiAgICAvLyBOT1cgUFJPQ0VTUyBUSEUgSU5URVJTRUNUSU9OIC4uLlxyXG5cclxuICAgIC8vIGlmIGJvdGggZWRnZXMgYXJlICdob3QnIC4uLlxyXG4gICAgaWYgKENsaXBwZXJCYXNlLmlzSG90RWRnZUFjdGl2ZShhZTEpICYmIENsaXBwZXJCYXNlLmlzSG90RWRnZUFjdGl2ZShhZTIpKSB7XHJcbiAgICAgIGlmICgob2xkRTFXaW5kQ291bnQgIT09IDAgJiYgb2xkRTFXaW5kQ291bnQgIT09IDEpIHx8XHJcbiAgICAgICAgKG9sZEUyV2luZENvdW50ICE9PSAwICYmIG9sZEUyV2luZENvdW50ICE9PSAxKSB8fFxyXG4gICAgICAgIChhZTEubG9jYWxNaW4ucG9seXR5cGUgIT09IGFlMi5sb2NhbE1pbi5wb2x5dHlwZSAmJlxyXG4gICAgICAgICAgdGhpcy5fY2xpcHR5cGUgIT09IENsaXBUeXBlLlhvcikpIHtcclxuICAgICAgICByZXN1bHRPcCA9IHRoaXMuYWRkTG9jYWxNYXhQb2x5KGFlMSwgYWUyLCBwdCk7XHJcbiAgICAgIH0gZWxzZSBpZiAoQ2xpcHBlckJhc2UuaXNGcm9udChhZTEpIHx8IChhZTEub3V0cmVjID09PSBhZTIub3V0cmVjKSkge1xyXG4gICAgICAgIC8vIHRoaXMgJ2Vsc2UgaWYnIGNvbmRpdGlvbiBpc24ndCBzdHJpY3RseSBuZWVkZWQgYnV0XHJcbiAgICAgICAgLy8gaXQncyBzZW5zaWJsZSB0byBzcGxpdCBwb2x5Z29ucyB0aGF0IG9ubHkgdG91Y2ggYXRcclxuICAgICAgICAvLyBhIGNvbW1vbiB2ZXJ0ZXggKG5vdCBhdCBjb21tb24gZWRnZXMpLlxyXG4gICAgICAgIHJlc3VsdE9wID0gdGhpcy5hZGRMb2NhbE1heFBvbHkoYWUxLCBhZTIsIHB0KTtcclxuICAgICAgICB0aGlzLmFkZExvY2FsTWluUG9seShhZTEsIGFlMiwgcHQpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIC8vIGNhbid0IHRyZWF0IGFzIG1heGltYSAmIG1pbmltYVxyXG4gICAgICAgIHJlc3VsdE9wID0gQ2xpcHBlckJhc2UuYWRkT3V0UHQoYWUxLCBwdCk7XHJcbiAgICAgICAgQ2xpcHBlckJhc2UuYWRkT3V0UHQoYWUyLCBwdCk7XHJcbiAgICAgICAgQ2xpcHBlckJhc2Uuc3dhcE91dHJlY3MoYWUxLCBhZTIpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICAvLyBpZiBvbmUgb3IgdGhlIG90aGVyIGVkZ2UgaXMgJ2hvdCcgLi4uXHJcbiAgICBlbHNlIGlmIChDbGlwcGVyQmFzZS5pc0hvdEVkZ2VBY3RpdmUoYWUxKSkge1xyXG4gICAgICByZXN1bHRPcCA9IENsaXBwZXJCYXNlLmFkZE91dFB0KGFlMSwgcHQpO1xyXG4gICAgICBDbGlwcGVyQmFzZS5zd2FwT3V0cmVjcyhhZTEsIGFlMik7XHJcbiAgICB9IGVsc2UgaWYgKENsaXBwZXJCYXNlLmlzSG90RWRnZUFjdGl2ZShhZTIpKSB7XHJcbiAgICAgIHJlc3VsdE9wID0gQ2xpcHBlckJhc2UuYWRkT3V0UHQoYWUyLCBwdCk7XHJcbiAgICAgIENsaXBwZXJCYXNlLnN3YXBPdXRyZWNzKGFlMSwgYWUyKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBuZWl0aGVyIGVkZ2UgaXMgJ2hvdCdcclxuICAgIGVsc2Uge1xyXG4gICAgICBsZXQgZTFXYzI6IG51bWJlcjtcclxuICAgICAgbGV0IGUyV2MyOiBudW1iZXI7XHJcblxyXG4gICAgICBzd2l0Y2ggKHRoaXMuX2ZpbGxydWxlKSB7XHJcbiAgICAgICAgY2FzZSBGaWxsUnVsZS5Qb3NpdGl2ZTpcclxuICAgICAgICAgIGUxV2MyID0gYWUxLndpbmRDb3VudDI7XHJcbiAgICAgICAgICBlMldjMiA9IGFlMi53aW5kQ291bnQyO1xyXG4gICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSBGaWxsUnVsZS5OZWdhdGl2ZTpcclxuICAgICAgICAgIGUxV2MyID0gLWFlMS53aW5kQ291bnQyO1xyXG4gICAgICAgICAgZTJXYzIgPSAtYWUyLndpbmRDb3VudDI7XHJcbiAgICAgICAgICBicmVhaztcclxuICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgZTFXYzIgPSBNYXRoLmFicyhhZTEud2luZENvdW50Mik7XHJcbiAgICAgICAgICBlMldjMiA9IE1hdGguYWJzKGFlMi53aW5kQ291bnQyKTtcclxuICAgICAgICAgIGJyZWFrO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBpZiAoIUNsaXBwZXJCYXNlLmlzU2FtZVBvbHlUeXBlKGFlMSwgYWUyKSkge1xyXG4gICAgICAgIHJlc3VsdE9wID0gdGhpcy5hZGRMb2NhbE1pblBvbHkoYWUxLCBhZTIsIHB0KTtcclxuICAgICAgfSBlbHNlIGlmIChvbGRFMVdpbmRDb3VudCA9PT0gMSAmJiBvbGRFMldpbmRDb3VudCA9PT0gMSkge1xyXG4gICAgICAgIHJlc3VsdE9wID0gdW5kZWZpbmVkO1xyXG5cclxuICAgICAgICBzd2l0Y2ggKHRoaXMuX2NsaXB0eXBlKSB7XHJcbiAgICAgICAgICBjYXNlIENsaXBUeXBlLlVuaW9uOlxyXG4gICAgICAgICAgICBpZiAoZTFXYzIgPiAwICYmIGUyV2MyID4gMCkgcmV0dXJuIHVuZGVmaW5lZDtcclxuICAgICAgICAgICAgcmVzdWx0T3AgPSB0aGlzLmFkZExvY2FsTWluUG9seShhZTEsIGFlMiwgcHQpO1xyXG4gICAgICAgICAgICBicmVhaztcclxuXHJcbiAgICAgICAgICBjYXNlIENsaXBUeXBlLkRpZmZlcmVuY2U6XHJcbiAgICAgICAgICAgIGlmICgoKENsaXBwZXJCYXNlLmdldFBvbHlUeXBlKGFlMSkgPT09IFBhdGhUeXBlLkNsaXApICYmIChlMVdjMiA+IDApICYmIChlMldjMiA+IDApKSB8fFxyXG4gICAgICAgICAgICAgICgoQ2xpcHBlckJhc2UuZ2V0UG9seVR5cGUoYWUxKSA9PT0gUGF0aFR5cGUuU3ViamVjdCkgJiYgKGUxV2MyIDw9IDApICYmIChlMldjMiA8PSAwKSkpIHtcclxuICAgICAgICAgICAgICByZXN1bHRPcCA9IHRoaXMuYWRkTG9jYWxNaW5Qb2x5KGFlMSwgYWUyLCBwdCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgYnJlYWs7XHJcblxyXG4gICAgICAgICAgY2FzZSBDbGlwVHlwZS5Yb3I6XHJcbiAgICAgICAgICAgIHJlc3VsdE9wID0gdGhpcy5hZGRMb2NhbE1pblBvbHkoYWUxLCBhZTIsIHB0KTtcclxuICAgICAgICAgICAgYnJlYWs7XHJcblxyXG4gICAgICAgICAgZGVmYXVsdDogLy8gQ2xpcFR5cGUuSW50ZXJzZWN0aW9uOlxyXG4gICAgICAgICAgICBpZiAoZTFXYzIgPD0gMCB8fCBlMldjMiA8PSAwKSByZXR1cm4gdW5kZWZpbmVkO1xyXG4gICAgICAgICAgICByZXN1bHRPcCA9IHRoaXMuYWRkTG9jYWxNaW5Qb2x5KGFlMSwgYWUyLCBwdCk7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiByZXN1bHRPcDtcclxuICB9XHJcblxyXG5cclxuICBwcml2YXRlIGRlbGV0ZUZyb21BRUwoYWU6IEFjdGl2ZSk6IHZvaWQge1xyXG4gICAgY29uc3QgcHJldjogQWN0aXZlIHwgdW5kZWZpbmVkID0gYWUucHJldkluQUVMO1xyXG4gICAgY29uc3QgbmV4dDogQWN0aXZlIHwgdW5kZWZpbmVkID0gYWUubmV4dEluQUVMO1xyXG4gICAgaWYgKCFwcmV2ICYmICFuZXh0ICYmIGFlICE9PSB0aGlzLl9hY3RpdmVzKSByZXR1cm47ICAvLyBhbHJlYWR5IGRlbGV0ZWRcclxuXHJcbiAgICBpZiAocHJldilcclxuICAgICAgcHJldi5uZXh0SW5BRUwgPSBuZXh0O1xyXG4gICAgZWxzZVxyXG4gICAgICB0aGlzLl9hY3RpdmVzID0gbmV4dDtcclxuXHJcbiAgICBpZiAobmV4dClcclxuICAgICAgbmV4dC5wcmV2SW5BRUwgPSBwcmV2O1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBhZGp1c3RDdXJyWEFuZENvcHlUb1NFTCh0b3BZOiBudW1iZXIpOiB2b2lkIHtcclxuICAgIGxldCBhZTogQWN0aXZlIHwgdW5kZWZpbmVkID0gdGhpcy5fYWN0aXZlcztcclxuICAgIHRoaXMuX3NlbCA9IGFlO1xyXG4gICAgd2hpbGUgKGFlKSB7XHJcbiAgICAgIGFlLnByZXZJblNFTCA9IGFlLnByZXZJbkFFTDtcclxuICAgICAgYWUubmV4dEluU0VMID0gYWUubmV4dEluQUVMO1xyXG4gICAgICBhZS5qdW1wID0gYWUubmV4dEluU0VMO1xyXG4gICAgICBpZiAoYWUuam9pbldpdGggPT09IEpvaW5XaXRoLkxlZnQpXHJcbiAgICAgICAgYWUuY3VyWCA9IGFlLnByZXZJbkFFTCEuY3VyWDsgIC8vIFRoaXMgYWxzbyBhdm9pZHMgY29tcGxpY2F0aW9uc1xyXG4gICAgICBlbHNlXHJcbiAgICAgICAgYWUuY3VyWCA9IENsaXBwZXJCYXNlLnRvcFgoYWUsIHRvcFkpO1xyXG4gICAgICAvLyBOQiBkb24ndCB1cGRhdGUgYWUuY3Vyci5ZIHlldCAoc2VlIEFkZE5ld0ludGVyc2VjdE5vZGUpXHJcbiAgICAgIGFlID0gYWUubmV4dEluQUVMO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJvdGVjdGVkIGV4ZWN1dGVJbnRlcm5hbChjdDogQ2xpcFR5cGUsIGZpbGxSdWxlOiBGaWxsUnVsZSk6IHZvaWQge1xyXG4gICAgaWYgKGN0ID09PSBDbGlwVHlwZS5Ob25lKSByZXR1cm47XHJcbiAgICB0aGlzLl9maWxscnVsZSA9IGZpbGxSdWxlO1xyXG4gICAgdGhpcy5fY2xpcHR5cGUgPSBjdDtcclxuICAgIHRoaXMucmVzZXQoKTtcclxuXHJcbiAgICBsZXQgeSA9IHRoaXMucG9wU2NhbmxpbmUoKVxyXG4gICAgaWYgKHkgPT09IHVuZGVmaW5lZCkgcmV0dXJuXHJcblxyXG4gICAgd2hpbGUgKHRoaXMuX3N1Y2NlZWRlZCkge1xyXG4gICAgICB0aGlzLmluc2VydExvY2FsTWluaW1hSW50b0FFTCh5KVxyXG4gICAgICBsZXQgYWUgPSB0aGlzLnBvcEhvcnooKVxyXG4gICAgICB3aGlsZSAoYWUpIHtcclxuICAgICAgICB0aGlzLmRvSG9yaXpvbnRhbChhZSlcclxuICAgICAgICBhZSA9IHRoaXMucG9wSG9yeigpXHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGlmICh0aGlzLl9ob3J6U2VnTGlzdC5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgdGhpcy5jb252ZXJ0SG9yelNlZ3NUb0pvaW5zKCk7XHJcbiAgICAgICAgdGhpcy5faG9yelNlZ0xpc3QubGVuZ3RoID0gMFxyXG4gICAgICB9XHJcbiAgICAgIHRoaXMuX2N1cnJlbnRCb3RZID0geTsgIC8vIGJvdHRvbSBvZiBzY2FuYmVhbVxyXG5cclxuICAgICAgeSA9IHRoaXMucG9wU2NhbmxpbmUoKVxyXG4gICAgICBpZiAoeSA9PT0gdW5kZWZpbmVkKSBicmVhazsgIC8vIHkgbmV3IHRvcCBvZiBzY2FuYmVhbVxyXG5cclxuICAgICAgdGhpcy5kb0ludGVyc2VjdGlvbnMoeSk7XHJcbiAgICAgIHRoaXMuZG9Ub3BPZlNjYW5iZWFtKHkpO1xyXG5cclxuICAgICAgYWUgPSB0aGlzLnBvcEhvcnooKVxyXG4gICAgICB3aGlsZSAoYWUpIHtcclxuICAgICAgICB0aGlzLmRvSG9yaXpvbnRhbChhZSlcclxuICAgICAgICBhZSA9IHRoaXMucG9wSG9yeigpXHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIGlmICh0aGlzLl9zdWNjZWVkZWQpIHRoaXMucHJvY2Vzc0hvcnpKb2lucygpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBkb0ludGVyc2VjdGlvbnModG9wWTogbnVtYmVyKTogdm9pZCB7XHJcbiAgICBpZiAodGhpcy5idWlsZEludGVyc2VjdExpc3QodG9wWSkpIHtcclxuICAgICAgdGhpcy5wcm9jZXNzSW50ZXJzZWN0TGlzdCgpO1xyXG4gICAgICB0aGlzLmRpc3Bvc2VJbnRlcnNlY3ROb2RlcygpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBkaXNwb3NlSW50ZXJzZWN0Tm9kZXMoKTogdm9pZCB7XHJcbiAgICB0aGlzLl9pbnRlcnNlY3RMaXN0Lmxlbmd0aCA9IDBcclxuICB9XHJcblxyXG4gIHByaXZhdGUgYWRkTmV3SW50ZXJzZWN0Tm9kZShhZTE6IEFjdGl2ZSwgYWUyOiBBY3RpdmUsIHRvcFk6IG51bWJlcik6IHZvaWQge1xyXG4gICAgY29uc3QgcmVzdWx0ID0gSW50ZXJuYWxDbGlwcGVyLmdldEludGVyc2VjdFB0KGFlMS5ib3QsIGFlMS50b3AsIGFlMi5ib3QsIGFlMi50b3ApXHJcbiAgICBsZXQgaXA6IElQb2ludDY0ID0gcmVzdWx0LmlwXHJcbiAgICBpZiAoIXJlc3VsdC5zdWNjZXNzKSB7XHJcbiAgICAgIGlwID0gbmV3IFBvaW50NjQoYWUxLmN1clgsIHRvcFkpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChpcC55ID4gdGhpcy5fY3VycmVudEJvdFkgfHwgaXAueSA8IHRvcFkpIHtcclxuICAgICAgY29uc3QgYWJzRHgxOiBudW1iZXIgPSBNYXRoLmFicyhhZTEuZHgpO1xyXG4gICAgICBjb25zdCBhYnNEeDI6IG51bWJlciA9IE1hdGguYWJzKGFlMi5keCk7XHJcbiAgICAgIGlmIChhYnNEeDEgPiAxMDAgJiYgYWJzRHgyID4gMTAwKSB7XHJcbiAgICAgICAgaWYgKGFic0R4MSA+IGFic0R4Mikge1xyXG4gICAgICAgICAgaXAgPSBJbnRlcm5hbENsaXBwZXIuZ2V0Q2xvc2VzdFB0T25TZWdtZW50KGlwLCBhZTEuYm90LCBhZTEudG9wKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgaXAgPSBJbnRlcm5hbENsaXBwZXIuZ2V0Q2xvc2VzdFB0T25TZWdtZW50KGlwLCBhZTIuYm90LCBhZTIudG9wKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0gZWxzZSBpZiAoYWJzRHgxID4gMTAwKSB7XHJcbiAgICAgICAgaXAgPSBJbnRlcm5hbENsaXBwZXIuZ2V0Q2xvc2VzdFB0T25TZWdtZW50KGlwLCBhZTEuYm90LCBhZTEudG9wKTtcclxuICAgICAgfSBlbHNlIGlmIChhYnNEeDIgPiAxMDApIHtcclxuICAgICAgICBpcCA9IEludGVybmFsQ2xpcHBlci5nZXRDbG9zZXN0UHRPblNlZ21lbnQoaXAsIGFlMi5ib3QsIGFlMi50b3ApO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGlmIChpcC55IDwgdG9wWSkge1xyXG4gICAgICAgICAgaXAueSA9IHRvcFk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIGlwLnkgPSB0aGlzLl9jdXJyZW50Qm90WTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGFic0R4MSA8IGFic0R4Mikge1xyXG4gICAgICAgICAgaXAueCA9IENsaXBwZXJCYXNlLnRvcFgoYWUxLCBpcC55KTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgaXAueCA9IENsaXBwZXJCYXNlLnRvcFgoYWUyLCBpcC55KTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIGNvbnN0IG5vZGU6IEludGVyc2VjdE5vZGUgPSBuZXcgSW50ZXJzZWN0Tm9kZShpcCwgYWUxLCBhZTIpO1xyXG4gICAgdGhpcy5faW50ZXJzZWN0TGlzdC5wdXNoKG5vZGUpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBzdGF0aWMgZXh0cmFjdEZyb21TRUwoYWU6IEFjdGl2ZSk6IEFjdGl2ZSB8IHVuZGVmaW5lZCB7XHJcbiAgICBjb25zdCByZXM6IEFjdGl2ZSB8IHVuZGVmaW5lZCA9IGFlLm5leHRJblNFTDtcclxuICAgIGlmIChyZXMpIHtcclxuICAgICAgcmVzLnByZXZJblNFTCA9IGFlLnByZXZJblNFTDtcclxuICAgIH1cclxuICAgIGFlLnByZXZJblNFTCEubmV4dEluU0VMID0gcmVzO1xyXG4gICAgcmV0dXJuIHJlcztcclxuICB9XHJcblxyXG4gIHByaXZhdGUgc3RhdGljIGluc2VydDFCZWZvcmUySW5TRUwoYWUxOiBBY3RpdmUsIGFlMjogQWN0aXZlKTogdm9pZCB7XHJcbiAgICBhZTEucHJldkluU0VMID0gYWUyLnByZXZJblNFTDtcclxuICAgIGlmIChhZTEucHJldkluU0VMKSB7XHJcbiAgICAgIGFlMS5wcmV2SW5TRUwubmV4dEluU0VMID0gYWUxO1xyXG4gICAgfVxyXG4gICAgYWUxLm5leHRJblNFTCA9IGFlMjtcclxuICAgIGFlMi5wcmV2SW5TRUwgPSBhZTE7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGJ1aWxkSW50ZXJzZWN0TGlzdCh0b3BZOiBudW1iZXIpOiBib29sZWFuIHtcclxuICAgIGlmICghdGhpcy5fYWN0aXZlcyB8fCAhdGhpcy5fYWN0aXZlcy5uZXh0SW5BRUwpIHJldHVybiBmYWxzZTtcclxuXHJcbiAgICAvLyBDYWxjdWxhdGUgZWRnZSBwb3NpdGlvbnMgYXQgdGhlIHRvcCBvZiB0aGUgY3VycmVudCBzY2FuYmVhbSwgYW5kIGZyb20gdGhpc1xyXG4gICAgLy8gd2Ugd2lsbCBkZXRlcm1pbmUgdGhlIGludGVyc2VjdGlvbnMgcmVxdWlyZWQgdG8gcmVhY2ggdGhlc2UgbmV3IHBvc2l0aW9ucy5cclxuICAgIHRoaXMuYWRqdXN0Q3VyclhBbmRDb3B5VG9TRUwodG9wWSk7XHJcblxyXG4gICAgLy8gRmluZCBhbGwgZWRnZSBpbnRlcnNlY3Rpb25zIGluIHRoZSBjdXJyZW50IHNjYW5iZWFtIHVzaW5nIGEgc3RhYmxlIG1lcmdlXHJcbiAgICAvLyBzb3J0IHRoYXQgZW5zdXJlcyBvbmx5IGFkamFjZW50IGVkZ2VzIGFyZSBpbnRlcnNlY3RpbmcuIEludGVyc2VjdCBpbmZvIGlzXHJcbiAgICAvLyBzdG9yZWQgaW4gRkludGVyc2VjdExpc3QgcmVhZHkgdG8gYmUgcHJvY2Vzc2VkIGluIFByb2Nlc3NJbnRlcnNlY3RMaXN0LlxyXG4gICAgLy8gUmUgbWVyZ2Ugc29ydHMgc2VlIGh0dHBzOi8vc3RhY2tvdmVyZmxvdy5jb20vYS80NjMxOTEzMS8zNTk1MzhcclxuXHJcbiAgICBsZXQgbGVmdDogQWN0aXZlIHwgdW5kZWZpbmVkID0gdGhpcy5fc2VsLFxyXG4gICAgICByaWdodDogQWN0aXZlIHwgdW5kZWZpbmVkLFxyXG4gICAgICBsRW5kOiBBY3RpdmUgfCB1bmRlZmluZWQsXHJcbiAgICAgIHJFbmQ6IEFjdGl2ZSB8IHVuZGVmaW5lZCxcclxuICAgICAgY3VyckJhc2U6IEFjdGl2ZSB8IHVuZGVmaW5lZCxcclxuICAgICAgcHJldkJhc2U6IEFjdGl2ZSB8IHVuZGVmaW5lZCxcclxuICAgICAgdG1wOiBBY3RpdmUgfCB1bmRlZmluZWQ7XHJcblxyXG4gICAgd2hpbGUgKGxlZnQhLmp1bXApIHtcclxuICAgICAgcHJldkJhc2UgPSB1bmRlZmluZWQ7XHJcbiAgICAgIHdoaWxlIChsZWZ0ICYmIGxlZnQuanVtcCkge1xyXG4gICAgICAgIGN1cnJCYXNlID0gbGVmdDtcclxuICAgICAgICByaWdodCA9IGxlZnQuanVtcDtcclxuICAgICAgICBsRW5kID0gcmlnaHQ7XHJcbiAgICAgICAgckVuZCA9IHJpZ2h0IS5qdW1wO1xyXG4gICAgICAgIGxlZnQuanVtcCA9IHJFbmQ7XHJcbiAgICAgICAgd2hpbGUgKGxlZnQgIT09IGxFbmQgJiYgcmlnaHQgIT09IHJFbmQpIHtcclxuICAgICAgICAgIGlmIChyaWdodCEuY3VyWCA8IGxlZnQhLmN1clgpIHtcclxuICAgICAgICAgICAgdG1wID0gcmlnaHQhLnByZXZJblNFTCE7XHJcbiAgICAgICAgICAgIGZvciAoOyA7KSB7XHJcbiAgICAgICAgICAgICAgdGhpcy5hZGROZXdJbnRlcnNlY3ROb2RlKHRtcCwgcmlnaHQhLCB0b3BZKTtcclxuICAgICAgICAgICAgICBpZiAodG1wID09PSBsZWZ0KSBicmVhaztcclxuICAgICAgICAgICAgICB0bXAgPSB0bXAucHJldkluU0VMITtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdG1wID0gcmlnaHQ7XHJcbiAgICAgICAgICAgIHJpZ2h0ID0gQ2xpcHBlckJhc2UuZXh0cmFjdEZyb21TRUwodG1wISk7XHJcbiAgICAgICAgICAgIGxFbmQgPSByaWdodDtcclxuICAgICAgICAgICAgQ2xpcHBlckJhc2UuaW5zZXJ0MUJlZm9yZTJJblNFTCh0bXAhLCBsZWZ0ISk7XHJcbiAgICAgICAgICAgIGlmIChsZWZ0ID09PSBjdXJyQmFzZSkge1xyXG4gICAgICAgICAgICAgIGN1cnJCYXNlID0gdG1wO1xyXG4gICAgICAgICAgICAgIGN1cnJCYXNlIS5qdW1wID0gckVuZDtcclxuICAgICAgICAgICAgICBpZiAocHJldkJhc2UgPT09IHVuZGVmaW5lZCkgdGhpcy5fc2VsID0gY3VyckJhc2U7XHJcbiAgICAgICAgICAgICAgZWxzZSBwcmV2QmFzZS5qdW1wID0gY3VyckJhc2U7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGxlZnQgPSBsZWZ0IS5uZXh0SW5TRUw7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBwcmV2QmFzZSA9IGN1cnJCYXNlO1xyXG4gICAgICAgIGxlZnQgPSByRW5kO1xyXG4gICAgICB9XHJcbiAgICAgIGxlZnQgPSB0aGlzLl9zZWw7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHRoaXMuX2ludGVyc2VjdExpc3QubGVuZ3RoID4gMDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcHJvY2Vzc0ludGVyc2VjdExpc3QoKTogdm9pZCB7XHJcbiAgICAvLyBXZSBub3cgaGF2ZSBhIGxpc3Qgb2YgaW50ZXJzZWN0aW9ucyByZXF1aXJlZCBzbyB0aGF0IGVkZ2VzIHdpbGwgYmVcclxuICAgIC8vIGNvcnJlY3RseSBwb3NpdGlvbmVkIGF0IHRoZSB0b3Agb2YgdGhlIHNjYW5iZWFtLiBIb3dldmVyLCBpdCdzIGltcG9ydGFudFxyXG4gICAgLy8gdGhhdCBlZGdlIGludGVyc2VjdGlvbnMgYXJlIHByb2Nlc3NlZCBmcm9tIHRoZSBib3R0b20gdXAsIGJ1dCBpdCdzIGFsc29cclxuICAgIC8vIGNydWNpYWwgdGhhdCBpbnRlcnNlY3Rpb25zIG9ubHkgb2NjdXIgYmV0d2VlbiBhZGphY2VudCBlZGdlcy5cclxuXHJcbiAgICAvLyBGaXJzdCB3ZSBkbyBhIHF1aWNrc29ydCBzbyBpbnRlcnNlY3Rpb25zIHByb2NlZWQgaW4gYSBib3R0b20gdXAgb3JkZXIgLi4uXHJcbiAgICB0aGlzLl9pbnRlcnNlY3RMaXN0LnNvcnQoKGEsIGIpID0+IHtcclxuICAgICAgaWYgKGEucHQueSA9PT0gYi5wdC55KSB7XHJcbiAgICAgICAgaWYgKGEucHQueCA9PT0gYi5wdC54KSByZXR1cm4gMDtcclxuICAgICAgICByZXR1cm4gKGEucHQueCA8IGIucHQueCkgPyAtMSA6IDE7XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIChhLnB0LnkgPiBiLnB0LnkpID8gLTEgOiAxO1xyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gTm93IGFzIHdlIHByb2Nlc3MgdGhlc2UgaW50ZXJzZWN0aW9ucywgd2UgbXVzdCBzb21ldGltZXMgYWRqdXN0IHRoZSBvcmRlclxyXG4gICAgLy8gdG8gZW5zdXJlIHRoYXQgaW50ZXJzZWN0aW5nIGVkZ2VzIGFyZSBhbHdheXMgYWRqYWNlbnQgLi4uXHJcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2ludGVyc2VjdExpc3QubGVuZ3RoOyArK2kpIHtcclxuICAgICAgaWYgKCFDbGlwcGVyQmFzZS5lZGdlc0FkamFjZW50SW5BRUwodGhpcy5faW50ZXJzZWN0TGlzdFtpXSkpIHtcclxuICAgICAgICBsZXQgaiA9IGkgKyAxO1xyXG4gICAgICAgIHdoaWxlICghQ2xpcHBlckJhc2UuZWRnZXNBZGphY2VudEluQUVMKHRoaXMuX2ludGVyc2VjdExpc3Rbal0pKSBqKys7XHJcbiAgICAgICAgLy8gc3dhcFxyXG4gICAgICAgIFt0aGlzLl9pbnRlcnNlY3RMaXN0W2pdLCB0aGlzLl9pbnRlcnNlY3RMaXN0W2ldXSA9XHJcbiAgICAgICAgICBbdGhpcy5faW50ZXJzZWN0TGlzdFtpXSwgdGhpcy5faW50ZXJzZWN0TGlzdFtqXV07XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGNvbnN0IG5vZGUgPSB0aGlzLl9pbnRlcnNlY3RMaXN0W2ldO1xyXG4gICAgICB0aGlzLmludGVyc2VjdEVkZ2VzKG5vZGUuZWRnZTEsIG5vZGUuZWRnZTIsIG5vZGUucHQpO1xyXG4gICAgICB0aGlzLnN3YXBQb3NpdGlvbnNJbkFFTChub2RlLmVkZ2UxLCBub2RlLmVkZ2UyKTtcclxuXHJcbiAgICAgIG5vZGUuZWRnZTEuY3VyWCA9IG5vZGUucHQueDtcclxuICAgICAgbm9kZS5lZGdlMi5jdXJYID0gbm9kZS5wdC54O1xyXG4gICAgICB0aGlzLmNoZWNrSm9pbkxlZnQobm9kZS5lZGdlMiwgbm9kZS5wdCwgdHJ1ZSk7XHJcbiAgICAgIHRoaXMuY2hlY2tKb2luUmlnaHQobm9kZS5lZGdlMSwgbm9kZS5wdCwgdHJ1ZSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHN3YXBQb3NpdGlvbnNJbkFFTChhZTE6IEFjdGl2ZSwgYWUyOiBBY3RpdmUpOiB2b2lkIHtcclxuICAgIC8vIHByZWNvbmRpdG9uOiBhZTEgbXVzdCBiZSBpbW1lZGlhdGVseSB0byB0aGUgbGVmdCBvZiBhZTJcclxuICAgIGNvbnN0IG5leHQ6IEFjdGl2ZSB8IHVuZGVmaW5lZCA9IGFlMi5uZXh0SW5BRUw7XHJcbiAgICBpZiAobmV4dCkgbmV4dC5wcmV2SW5BRUwgPSBhZTE7XHJcbiAgICBjb25zdCBwcmV2OiBBY3RpdmUgfCB1bmRlZmluZWQgPSBhZTEucHJldkluQUVMO1xyXG4gICAgaWYgKHByZXYpIHByZXYubmV4dEluQUVMID0gYWUyO1xyXG4gICAgYWUyLnByZXZJbkFFTCA9IHByZXY7XHJcbiAgICBhZTIubmV4dEluQUVMID0gYWUxO1xyXG4gICAgYWUxLnByZXZJbkFFTCA9IGFlMjtcclxuICAgIGFlMS5uZXh0SW5BRUwgPSBuZXh0O1xyXG4gICAgaWYgKCFhZTIucHJldkluQUVMKSB0aGlzLl9hY3RpdmVzID0gYWUyO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBzdGF0aWMgcmVzZXRIb3J6RGlyZWN0aW9uKGhvcno6IEFjdGl2ZSwgdmVydGV4TWF4OiBWZXJ0ZXggfCB1bmRlZmluZWQpOiB7IGlzTGVmdFRvUmlnaHQ6IGJvb2xlYW4sIGxlZnRYOiBudW1iZXIsIHJpZ2h0WDogbnVtYmVyIH0ge1xyXG4gICAgbGV0IGxlZnRYLCByaWdodFhcclxuXHJcbiAgICBpZiAoaG9yei5ib3QueCA9PT0gaG9yei50b3AueCkge1xyXG4gICAgICAvLyB0aGUgaG9yaXpvbnRhbCBlZGdlIGlzIGdvaW5nIG5vd2hlcmUgLi4uXHJcbiAgICAgIGxlZnRYID0gaG9yei5jdXJYO1xyXG4gICAgICByaWdodFggPSBob3J6LmN1clg7XHJcbiAgICAgIGxldCBhZTogQWN0aXZlIHwgdW5kZWZpbmVkID0gaG9yei5uZXh0SW5BRUw7XHJcbiAgICAgIHdoaWxlIChhZSAmJiBhZS52ZXJ0ZXhUb3AgIT09IHZlcnRleE1heClcclxuICAgICAgICBhZSA9IGFlLm5leHRJbkFFTDtcclxuICAgICAgcmV0dXJuIHsgaXNMZWZ0VG9SaWdodDogYWUgIT09IHVuZGVmaW5lZCwgbGVmdFgsIHJpZ2h0WCB9XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGhvcnouY3VyWCA8IGhvcnoudG9wLngpIHtcclxuICAgICAgbGVmdFggPSBob3J6LmN1clg7XHJcbiAgICAgIHJpZ2h0WCA9IGhvcnoudG9wLng7XHJcbiAgICAgIHJldHVybiB7IGlzTGVmdFRvUmlnaHQ6IHRydWUsIGxlZnRYLCByaWdodFggfVxyXG4gICAgfVxyXG4gICAgbGVmdFggPSBob3J6LnRvcC54O1xyXG4gICAgcmlnaHRYID0gaG9yei5jdXJYO1xyXG4gICAgcmV0dXJuIHsgaXNMZWZ0VG9SaWdodDogZmFsc2UsIGxlZnRYLCByaWdodFggfSAvLyByaWdodCB0byBsZWZ0XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHN0YXRpYyBob3J6SXNTcGlrZShob3J6OiBBY3RpdmUpOiBib29sZWFuIHtcclxuICAgIGNvbnN0IG5leHRQdDogSVBvaW50NjQgPSBDbGlwcGVyQmFzZS5uZXh0VmVydGV4KGhvcnopLnB0O1xyXG4gICAgcmV0dXJuIChob3J6LmJvdC54IDwgaG9yei50b3AueCkgIT09IChob3J6LnRvcC54IDwgbmV4dFB0LngpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBzdGF0aWMgdHJpbUhvcnooaG9yekVkZ2U6IEFjdGl2ZSwgcHJlc2VydmVDb2xsaW5lYXI6IGJvb2xlYW4pOiB2b2lkIHtcclxuICAgIGxldCB3YXNUcmltbWVkID0gZmFsc2U7XHJcbiAgICBsZXQgcHQ6IElQb2ludDY0ID0gQ2xpcHBlckJhc2UubmV4dFZlcnRleChob3J6RWRnZSkucHQ7XHJcblxyXG4gICAgd2hpbGUgKHB0LnkgPT09IGhvcnpFZGdlLnRvcC55KSB7XHJcbiAgICAgIC8vIGFsd2F5cyB0cmltIDE4MCBkZWcuIHNwaWtlcyAoaW4gY2xvc2VkIHBhdGhzKVxyXG4gICAgICAvLyBidXQgb3RoZXJ3aXNlIGJyZWFrIGlmIHByZXNlcnZlQ29sbGluZWFyID0gdHJ1ZVxyXG4gICAgICBpZiAocHJlc2VydmVDb2xsaW5lYXIgJiZcclxuICAgICAgICAocHQueCA8IGhvcnpFZGdlLnRvcC54KSAhPT0gKGhvcnpFZGdlLmJvdC54IDwgaG9yekVkZ2UudG9wLngpKSB7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGhvcnpFZGdlLnZlcnRleFRvcCA9IENsaXBwZXJCYXNlLm5leHRWZXJ0ZXgoaG9yekVkZ2UpO1xyXG4gICAgICBob3J6RWRnZS50b3AgPSBwdDtcclxuICAgICAgd2FzVHJpbW1lZCA9IHRydWU7XHJcbiAgICAgIGlmIChDbGlwcGVyQmFzZS5pc01heGltYUFjdGl2ZShob3J6RWRnZSkpIGJyZWFrO1xyXG4gICAgICBwdCA9IENsaXBwZXJCYXNlLm5leHRWZXJ0ZXgoaG9yekVkZ2UpLnB0O1xyXG4gICAgfVxyXG4gICAgaWYgKHdhc1RyaW1tZWQpIENsaXBwZXJCYXNlLnNldER4KGhvcnpFZGdlKTsgLy8gKy8taW5maW5pdHlcclxuICB9XHJcblxyXG4gIHByaXZhdGUgYWRkVG9Ib3J6U2VnTGlzdChvcDogT3V0UHQpOiB2b2lkIHtcclxuICAgIGlmIChvcC5vdXRyZWMuaXNPcGVuKSByZXR1cm47XHJcbiAgICB0aGlzLl9ob3J6U2VnTGlzdC5wdXNoKG5ldyBIb3J6U2VnbWVudChvcCkpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBnZXRMYXN0T3AoaG90RWRnZTogQWN0aXZlKTogT3V0UHQge1xyXG4gICAgY29uc3Qgb3V0cmVjOiBPdXRSZWMgPSBob3RFZGdlLm91dHJlYyE7XHJcbiAgICByZXR1cm4gKGhvdEVkZ2UgPT09IG91dHJlYy5mcm9udEVkZ2UpID9cclxuICAgICAgb3V0cmVjLnB0cyEgOiBvdXRyZWMucHRzIS5uZXh0ITtcclxuICB9XHJcblxyXG4gIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXHJcbiAgKiBOb3RlczogSG9yaXpvbnRhbCBlZGdlcyAoSEVzKSBhdCBzY2FubGluZSBpbnRlcnNlY3Rpb25zIChpLmUuIGF0IHRoZSB0b3Agb3IgICAgKlxyXG4gICogYm90dG9tIG9mIGEgc2NhbmJlYW0pIGFyZSBwcm9jZXNzZWQgYXMgaWYgbGF5ZXJlZC5UaGUgb3JkZXIgaW4gd2hpY2ggSEVzICAgICAqXHJcbiAgKiBhcmUgcHJvY2Vzc2VkIGRvZXNuJ3QgbWF0dGVyLiBIRXMgaW50ZXJzZWN0IHdpdGggdGhlIGJvdHRvbSB2ZXJ0aWNlcyBvZiAgICAgICpcclxuICAqIG90aGVyIEhFc1sjXSBhbmQgd2l0aCBub24taG9yaXpvbnRhbCBlZGdlcyBbKl0uIE9uY2UgdGhlc2UgaW50ZXJzZWN0aW9ucyAgICAgKlxyXG4gICogYXJlIGNvbXBsZXRlZCwgaW50ZXJtZWRpYXRlIEhFcyBhcmUgJ3Byb21vdGVkJyB0byB0aGUgbmV4dCBlZGdlIGluIHRoZWlyICAgICAqXHJcbiAgKiBib3VuZHMsIGFuZCB0aGV5IGluIHR1cm4gbWF5IGJlIGludGVyc2VjdGVkWyVdIGJ5IG90aGVyIEhFcy4gICAgICAgICAgICAgICAgICpcclxuICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKlxyXG4gICogZWc6IDMgaG9yaXpvbnRhbHMgYXQgYSBzY2FubGluZTogICAgLyAgIHwgICAgICAgICAgICAgICAgICAgICAvICAgICAgICAgICAvICAqXHJcbiAgKiAgICAgICAgICAgICAgfCAgICAgICAgICAgICAgICAgICAgIC8gICAgfCAgICAgKEhFMylvID09PT09PT09JT09PT09PT09PT0gbyAgICpcclxuICAqICAgICAgICAgICAgICBvID09PT09PT0gbyhIRTIpICAgICAvICAgICB8ICAgICAgICAgLyAgICAgICAgIC8gICAgICAgICAgICAgICAgKlxyXG4gICogICAgICAgICAgbyA9PT09PT09PT09PT0jPT09PT09PT09Kj09PT09PSo9PT09PT09PSM9PT09PT09PT1vIChIRTEpICAgICAgICAgICAqXHJcbiAgKiAgICAgICAgIC8gICAgICAgICAgICAgIHwgICAgICAgIC8gICAgICAgfCAgICAgICAvICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcclxuICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xyXG4gIHByaXZhdGUgZG9Ib3Jpem9udGFsKGhvcno6IEFjdGl2ZSk6IHZvaWQge1xyXG4gICAgbGV0IHB0OiBJUG9pbnQ2NDtcclxuICAgIGNvbnN0IGhvcnpJc09wZW4gPSBDbGlwcGVyQmFzZS5pc09wZW4oaG9yeik7XHJcbiAgICBjb25zdCBZID0gaG9yei5ib3QueTtcclxuXHJcbiAgICBjb25zdCB2ZXJ0ZXhfbWF4OiBWZXJ0ZXggfCB1bmRlZmluZWQgPSBob3J6SXNPcGVuID9cclxuICAgICAgQ2xpcHBlckJhc2UuZ2V0Q3VycllNYXhpbWFWZXJ0ZXhfT3Blbihob3J6KSA6XHJcbiAgICAgIENsaXBwZXJCYXNlLmdldEN1cnJZTWF4aW1hVmVydGV4KGhvcnopO1xyXG5cclxuICAgIC8vIHJlbW92ZSAxODAgZGVnLnNwaWtlcyBhbmQgYWxzbyBzaW1wbGlmeVxyXG4gICAgLy8gY29uc2VjdXRpdmUgaG9yaXpvbnRhbHMgd2hlbiBQcmVzZXJ2ZUNvbGxpbmVhciA9IHRydWVcclxuICAgIGlmICh2ZXJ0ZXhfbWF4ICYmICFob3J6SXNPcGVuICYmIHZlcnRleF9tYXggIT09IGhvcnoudmVydGV4VG9wKVxyXG4gICAgICBDbGlwcGVyQmFzZS50cmltSG9yeihob3J6LCB0aGlzLnByZXNlcnZlQ29sbGluZWFyKTtcclxuXHJcbiAgICBsZXQgeyBpc0xlZnRUb1JpZ2h0LCBsZWZ0WCwgcmlnaHRYIH0gPVxyXG4gICAgICBDbGlwcGVyQmFzZS5yZXNldEhvcnpEaXJlY3Rpb24oaG9yeiwgdmVydGV4X21heCk7XHJcblxyXG4gICAgaWYgKENsaXBwZXJCYXNlLmlzSG90RWRnZUFjdGl2ZShob3J6KSkge1xyXG4gICAgICBjb25zdCBvcCA9IENsaXBwZXJCYXNlLmFkZE91dFB0KGhvcnosIG5ldyBQb2ludDY0KGhvcnouY3VyWCwgWSkpO1xyXG4gICAgICB0aGlzLmFkZFRvSG9yelNlZ0xpc3Qob3ApO1xyXG4gICAgfVxyXG5cclxuICAgIGZvciAoOyA7KSB7XHJcbiAgICAgIC8vIGxvb3BzIHRocm91Z2ggY29uc2VjLiBob3Jpem9udGFsIGVkZ2VzIChpZiBvcGVuKVxyXG4gICAgICBsZXQgYWU6IEFjdGl2ZSB8IHVuZGVmaW5lZCA9IGlzTGVmdFRvUmlnaHQgPyBob3J6Lm5leHRJbkFFTCA6IGhvcnoucHJldkluQUVMO1xyXG5cclxuICAgICAgd2hpbGUgKGFlKSB7XHJcbiAgICAgICAgaWYgKGFlLnZlcnRleFRvcCA9PT0gdmVydGV4X21heCkge1xyXG4gICAgICAgICAgLy8gZG8gdGhpcyBmaXJzdCEhXHJcbiAgICAgICAgICBpZiAoQ2xpcHBlckJhc2UuaXNIb3RFZGdlQWN0aXZlKGhvcnopICYmIENsaXBwZXJCYXNlLmlzSm9pbmVkKGFlKSkgdGhpcy5zcGxpdChhZSwgYWUudG9wKTtcclxuXHJcbiAgICAgICAgICBpZiAoQ2xpcHBlckJhc2UuaXNIb3RFZGdlQWN0aXZlKGhvcnopKSB7XHJcbiAgICAgICAgICAgIHdoaWxlIChob3J6LnZlcnRleFRvcCAhPT0gdmVydGV4X21heCkge1xyXG4gICAgICAgICAgICAgIENsaXBwZXJCYXNlLmFkZE91dFB0KGhvcnosIGhvcnoudG9wKTtcclxuICAgICAgICAgICAgICB0aGlzLnVwZGF0ZUVkZ2VJbnRvQUVMKGhvcnopO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmIChpc0xlZnRUb1JpZ2h0KVxyXG4gICAgICAgICAgICAgIHRoaXMuYWRkTG9jYWxNYXhQb2x5KGhvcnosIGFlLCBob3J6LnRvcCk7XHJcbiAgICAgICAgICAgIGVsc2VcclxuICAgICAgICAgICAgICB0aGlzLmFkZExvY2FsTWF4UG9seShhZSwgaG9yeiwgaG9yei50b3ApO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgdGhpcy5kZWxldGVGcm9tQUVMKGFlKTtcclxuICAgICAgICAgIHRoaXMuZGVsZXRlRnJvbUFFTChob3J6KTtcclxuICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIGlmIGhvcnpFZGdlIGlzIGEgbWF4aW1hLCBrZWVwIGdvaW5nIHVudGlsIHdlIHJlYWNoXHJcbiAgICAgICAgLy8gaXRzIG1heGltYSBwYWlyLCBvdGhlcndpc2UgY2hlY2sgZm9yIGJyZWFrIGNvbmRpdGlvbnNcclxuICAgICAgICBpZiAodmVydGV4X21heCAhPT0gaG9yei52ZXJ0ZXhUb3AgfHwgQ2xpcHBlckJhc2UuaXNPcGVuRW5kQWN0aXZlKGhvcnopKSB7XHJcbiAgICAgICAgICAvLyBvdGhlcndpc2Ugc3RvcCB3aGVuICdhZScgaXMgYmV5b25kIHRoZSBlbmQgb2YgdGhlIGhvcml6b250YWwgbGluZVxyXG4gICAgICAgICAgaWYgKChpc0xlZnRUb1JpZ2h0ICYmIGFlLmN1clggPiByaWdodFgpIHx8ICghaXNMZWZ0VG9SaWdodCAmJiBhZS5jdXJYIDwgbGVmdFgpKSBicmVhaztcclxuXHJcbiAgICAgICAgICBpZiAoYWUuY3VyWCA9PT0gaG9yei50b3AueCAmJiAhQ2xpcHBlckJhc2UuaXNIb3Jpem9udGFsKGFlKSkge1xyXG4gICAgICAgICAgICBwdCA9IENsaXBwZXJCYXNlLm5leHRWZXJ0ZXgoaG9yeikucHQ7XHJcblxyXG4gICAgICAgICAgICAvLyB0byBtYXhpbWl6ZSB0aGUgcG9zc2liaWxpdHkgb2YgcHV0dGluZyBvcGVuIGVkZ2VzIGludG9cclxuICAgICAgICAgICAgLy8gc29sdXRpb25zLCB3ZSdsbCBvbmx5IGJyZWFrIGlmIGl0J3MgcGFzdCBIb3J6RWRnZSdzIGVuZFxyXG4gICAgICAgICAgICBpZiAoQ2xpcHBlckJhc2UuaXNPcGVuKGFlKSAmJiAhQ2xpcHBlckJhc2UuaXNTYW1lUG9seVR5cGUoYWUsIGhvcnopICYmICFDbGlwcGVyQmFzZS5pc0hvdEVkZ2VBY3RpdmUoYWUpKSB7XHJcbiAgICAgICAgICAgICAgaWYgKChpc0xlZnRUb1JpZ2h0ICYmIChDbGlwcGVyQmFzZS50b3BYKGFlLCBwdC55KSA+IHB0LngpKSB8fCAoIWlzTGVmdFRvUmlnaHQgJiYgKENsaXBwZXJCYXNlLnRvcFgoYWUsIHB0LnkpIDwgcHQueCkpKSBicmVhaztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAvLyBvdGhlcndpc2UgZm9yIGVkZ2VzIGF0IGhvcnpFZGdlJ3MgZW5kLCBvbmx5IHN0b3Agd2hlbiBob3J6RWRnZSdzXHJcbiAgICAgICAgICAgIC8vIG91dHNsb3BlIGlzIGdyZWF0ZXIgdGhhbiBlJ3Mgc2xvcGUgd2hlbiBoZWFkaW5nIHJpZ2h0IG9yIHdoZW5cclxuICAgICAgICAgICAgLy8gaG9yekVkZ2UncyBvdXRzbG9wZSBpcyBsZXNzIHRoYW4gZSdzIHNsb3BlIHdoZW4gaGVhZGluZyBsZWZ0LlxyXG4gICAgICAgICAgICBlbHNlIGlmICgoaXNMZWZ0VG9SaWdodCAmJiAoQ2xpcHBlckJhc2UudG9wWChhZSwgcHQueSkgPj0gcHQueCkpIHx8ICghaXNMZWZ0VG9SaWdodCAmJiAoQ2xpcHBlckJhc2UudG9wWChhZSwgcHQueSkgPD0gcHQueCkpKSBicmVhaztcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHB0ID0gbmV3IFBvaW50NjQoYWUuY3VyWCwgWSk7XHJcblxyXG4gICAgICAgIGlmIChpc0xlZnRUb1JpZ2h0KSB7XHJcbiAgICAgICAgICB0aGlzLmludGVyc2VjdEVkZ2VzKGhvcnosIGFlLCBwdCk7XHJcbiAgICAgICAgICB0aGlzLnN3YXBQb3NpdGlvbnNJbkFFTChob3J6LCBhZSk7XHJcbiAgICAgICAgICBob3J6LmN1clggPSBhZS5jdXJYO1xyXG4gICAgICAgICAgYWUgPSBob3J6Lm5leHRJbkFFTDtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgdGhpcy5pbnRlcnNlY3RFZGdlcyhhZSwgaG9yeiwgcHQpO1xyXG4gICAgICAgICAgdGhpcy5zd2FwUG9zaXRpb25zSW5BRUwoYWUsIGhvcnopO1xyXG4gICAgICAgICAgaG9yei5jdXJYID0gYWUuY3VyWDtcclxuICAgICAgICAgIGFlID0gaG9yei5wcmV2SW5BRUw7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoQ2xpcHBlckJhc2UuaXNIb3RFZGdlQWN0aXZlKGhvcnopKVxyXG4gICAgICAgICAgdGhpcy5hZGRUb0hvcnpTZWdMaXN0KHRoaXMuZ2V0TGFzdE9wKGhvcnopKTtcclxuICAgICAgfSAvLyB3ZSd2ZSByZWFjaGVkIHRoZSBlbmQgb2YgdGhpcyBob3Jpem9udGFsXHJcblxyXG4gICAgICAvLyBjaGVjayBpZiB3ZSd2ZSBmaW5pc2hlZCBsb29waW5nXHJcbiAgICAgIC8vIHRocm91Z2ggY29uc2VjdXRpdmUgaG9yaXpvbnRhbHNcclxuICAgICAgaWYgKGhvcnpJc09wZW4gJiYgQ2xpcHBlckJhc2UuaXNPcGVuRW5kQWN0aXZlKGhvcnopKSB7IC8vIGllIG9wZW4gYXQgdG9wXHJcbiAgICAgICAgaWYgKENsaXBwZXJCYXNlLmlzSG90RWRnZUFjdGl2ZShob3J6KSkge1xyXG4gICAgICAgICAgQ2xpcHBlckJhc2UuYWRkT3V0UHQoaG9yeiwgaG9yei50b3ApO1xyXG4gICAgICAgICAgaWYgKENsaXBwZXJCYXNlLmlzRnJvbnQoaG9yeikpXHJcbiAgICAgICAgICAgIGhvcnoub3V0cmVjIS5mcm9udEVkZ2UgPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgICBlbHNlXHJcbiAgICAgICAgICAgIGhvcnoub3V0cmVjIS5iYWNrRWRnZSA9IHVuZGVmaW5lZDtcclxuICAgICAgICAgIGhvcnoub3V0cmVjID0gdW5kZWZpbmVkO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLmRlbGV0ZUZyb21BRUwoaG9yeik7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9IGVsc2UgaWYgKENsaXBwZXJCYXNlLm5leHRWZXJ0ZXgoaG9yeikucHQueSAhPT0gaG9yei50b3AueSlcclxuICAgICAgICBicmVhaztcclxuXHJcbiAgICAgIC8vIHN0aWxsIG1vcmUgaG9yaXpvbnRhbHMgaW4gYm91bmQgdG8gcHJvY2VzcyAuLi5cclxuICAgICAgaWYgKENsaXBwZXJCYXNlLmlzSG90RWRnZUFjdGl2ZShob3J6KSkge1xyXG4gICAgICAgIENsaXBwZXJCYXNlLmFkZE91dFB0KGhvcnosIGhvcnoudG9wKTtcclxuICAgICAgfVxyXG5cclxuICAgICAgdGhpcy51cGRhdGVFZGdlSW50b0FFTChob3J6KTtcclxuXHJcbiAgICAgIGlmICh0aGlzLnByZXNlcnZlQ29sbGluZWFyICYmICFob3J6SXNPcGVuICYmIENsaXBwZXJCYXNlLmhvcnpJc1NwaWtlKGhvcnopKSB7XHJcbiAgICAgICAgQ2xpcHBlckJhc2UudHJpbUhvcnooaG9yeiwgdHJ1ZSk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGNvbnN0IHJlc3VsdCA9IENsaXBwZXJCYXNlLnJlc2V0SG9yekRpcmVjdGlvbihob3J6LCB2ZXJ0ZXhfbWF4KTtcclxuICAgICAgaXNMZWZ0VG9SaWdodCA9IHJlc3VsdC5pc0xlZnRUb1JpZ2h0XHJcbiAgICAgIGxlZnRYID0gcmVzdWx0LmxlZnRYXHJcbiAgICAgIHJpZ2h0WCA9IHJlc3VsdC5yaWdodFhcclxuICAgIH1cclxuXHJcbiAgICBpZiAoQ2xpcHBlckJhc2UuaXNIb3RFZGdlQWN0aXZlKGhvcnopKSB7XHJcbiAgICAgIGNvbnN0IG9wID0gQ2xpcHBlckJhc2UuYWRkT3V0UHQoaG9yeiwgaG9yei50b3ApO1xyXG4gICAgICB0aGlzLmFkZFRvSG9yelNlZ0xpc3Qob3ApO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMudXBkYXRlRWRnZUludG9BRUwoaG9yeik7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGRvVG9wT2ZTY2FuYmVhbSh5OiBudW1iZXIpOiB2b2lkIHtcclxuICAgIHRoaXMuX3NlbCA9IHVuZGVmaW5lZDsgLy8gX3NlbCBpcyByZXVzZWQgdG8gZmxhZyBob3Jpem9udGFscyAoc2VlIHB1c2hIb3J6IGJlbG93KVxyXG4gICAgbGV0IGFlOiBBY3RpdmUgfCB1bmRlZmluZWQgPSB0aGlzLl9hY3RpdmVzO1xyXG5cclxuICAgIHdoaWxlIChhZSkge1xyXG4gICAgICAvLyBOQiAnYWUnIHdpbGwgbmV2ZXIgYmUgaG9yaXpvbnRhbCBoZXJlXHJcbiAgICAgIGlmIChhZS50b3AueSA9PT0geSkge1xyXG4gICAgICAgIGFlLmN1clggPSBhZS50b3AueDtcclxuXHJcbiAgICAgICAgaWYgKENsaXBwZXJCYXNlLmlzTWF4aW1hQWN0aXZlKGFlKSkge1xyXG4gICAgICAgICAgYWUgPSB0aGlzLmRvTWF4aW1hKGFlKTsgLy8gVE9QIE9GIEJPVU5EIChNQVhJTUEpXHJcbiAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIElOVEVSTUVESUFURSBWRVJURVggLi4uXHJcbiAgICAgICAgaWYgKENsaXBwZXJCYXNlLmlzSG90RWRnZUFjdGl2ZShhZSkpXHJcbiAgICAgICAgICBDbGlwcGVyQmFzZS5hZGRPdXRQdChhZSwgYWUudG9wKTtcclxuXHJcbiAgICAgICAgdGhpcy51cGRhdGVFZGdlSW50b0FFTChhZSk7XHJcblxyXG4gICAgICAgIGlmIChDbGlwcGVyQmFzZS5pc0hvcml6b250YWwoYWUpKVxyXG4gICAgICAgICAgdGhpcy5wdXNoSG9yeihhZSk7IC8vIGhvcml6b250YWxzIGFyZSBwcm9jZXNzZWQgbGF0ZXJcclxuICAgICAgfSBlbHNlIHsgLy8gaS5lLiBub3QgdGhlIHRvcCBvZiB0aGUgZWRnZVxyXG4gICAgICAgIGFlLmN1clggPSBDbGlwcGVyQmFzZS50b3BYKGFlLCB5KTtcclxuICAgICAgfVxyXG5cclxuICAgICAgYWUgPSBhZS5uZXh0SW5BRUw7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGRvTWF4aW1hKGFlOiBBY3RpdmUpOiBBY3RpdmUgfCB1bmRlZmluZWQge1xyXG4gICAgY29uc3QgcHJldkU6IEFjdGl2ZSB8IHVuZGVmaW5lZCA9IGFlLnByZXZJbkFFTFxyXG4gICAgbGV0IG5leHRFOiBBY3RpdmUgfCB1bmRlZmluZWQgPSBhZS5uZXh0SW5BRUxcclxuXHJcbiAgICBpZiAoQ2xpcHBlckJhc2UuaXNPcGVuRW5kQWN0aXZlKGFlKSkge1xyXG4gICAgICBpZiAoQ2xpcHBlckJhc2UuaXNIb3RFZGdlQWN0aXZlKGFlKSkgQ2xpcHBlckJhc2UuYWRkT3V0UHQoYWUsIGFlLnRvcCk7XHJcbiAgICAgIGlmICghQ2xpcHBlckJhc2UuaXNIb3Jpem9udGFsKGFlKSkge1xyXG4gICAgICAgIGlmIChDbGlwcGVyQmFzZS5pc0hvdEVkZ2VBY3RpdmUoYWUpKSB7XHJcbiAgICAgICAgICBpZiAoQ2xpcHBlckJhc2UuaXNGcm9udChhZSkpXHJcbiAgICAgICAgICAgIGFlLm91dHJlYyEuZnJvbnRFZGdlID0gdW5kZWZpbmVkO1xyXG4gICAgICAgICAgZWxzZVxyXG4gICAgICAgICAgICBhZS5vdXRyZWMhLmJhY2tFZGdlID0gdW5kZWZpbmVkO1xyXG4gICAgICAgICAgYWUub3V0cmVjID0gdW5kZWZpbmVkO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLmRlbGV0ZUZyb21BRUwoYWUpO1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiBuZXh0RTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBtYXhQYWlyOiBBY3RpdmUgfCB1bmRlZmluZWQgPSBDbGlwcGVyQmFzZS5nZXRNYXhpbWFQYWlyKGFlKTtcclxuICAgIGlmICghbWF4UGFpcikgcmV0dXJuIG5leHRFOyAvLyBlTWF4UGFpciBpcyBob3Jpem9udGFsXHJcblxyXG4gICAgaWYgKENsaXBwZXJCYXNlLmlzSm9pbmVkKGFlKSkgdGhpcy5zcGxpdChhZSwgYWUudG9wKTtcclxuICAgIGlmIChDbGlwcGVyQmFzZS5pc0pvaW5lZChtYXhQYWlyKSkgdGhpcy5zcGxpdChtYXhQYWlyLCBtYXhQYWlyLnRvcCk7XHJcblxyXG4gICAgLy8gb25seSBub24taG9yaXpvbnRhbCBtYXhpbWEgaGVyZS5cclxuICAgIC8vIHByb2Nlc3MgYW55IGVkZ2VzIGJldHdlZW4gbWF4aW1hIHBhaXIgLi4uXHJcbiAgICB3aGlsZSAobmV4dEUgIT09IG1heFBhaXIpIHtcclxuICAgICAgdGhpcy5pbnRlcnNlY3RFZGdlcyhhZSwgbmV4dEUhLCBhZS50b3ApO1xyXG4gICAgICB0aGlzLnN3YXBQb3NpdGlvbnNJbkFFTChhZSwgbmV4dEUhKTtcclxuICAgICAgbmV4dEUgPSBhZS5uZXh0SW5BRUxcclxuICAgIH1cclxuXHJcbiAgICBpZiAoQ2xpcHBlckJhc2UuaXNPcGVuKGFlKSkge1xyXG4gICAgICBpZiAoQ2xpcHBlckJhc2UuaXNIb3RFZGdlQWN0aXZlKGFlKSlcclxuICAgICAgICB0aGlzLmFkZExvY2FsTWF4UG9seShhZSwgbWF4UGFpciwgYWUudG9wKTtcclxuICAgICAgdGhpcy5kZWxldGVGcm9tQUVMKG1heFBhaXIpO1xyXG4gICAgICB0aGlzLmRlbGV0ZUZyb21BRUwoYWUpO1xyXG4gICAgICByZXR1cm4gKHByZXZFID8gcHJldkUubmV4dEluQUVMIDogdGhpcy5fYWN0aXZlcyk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gaGVyZSBhZS5uZXh0SW5BZWwgPT0gRU5leHQgPT0gRU1heFBhaXIgLi4uXHJcbiAgICBpZiAoQ2xpcHBlckJhc2UuaXNIb3RFZGdlQWN0aXZlKGFlKSlcclxuICAgICAgdGhpcy5hZGRMb2NhbE1heFBvbHkoYWUsIG1heFBhaXIsIGFlLnRvcCk7XHJcblxyXG4gICAgdGhpcy5kZWxldGVGcm9tQUVMKGFlKTtcclxuICAgIHRoaXMuZGVsZXRlRnJvbUFFTChtYXhQYWlyKTtcclxuICAgIHJldHVybiAocHJldkUgPyBwcmV2RS5uZXh0SW5BRUwgOiB0aGlzLl9hY3RpdmVzKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgc3RhdGljIGlzSm9pbmVkKGU6IEFjdGl2ZSk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuIGUuam9pbldpdGggIT09IEpvaW5XaXRoLk5vbmU7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHNwbGl0KGU6IEFjdGl2ZSwgY3VyclB0OiBJUG9pbnQ2NCk6IHZvaWQge1xyXG4gICAgaWYgKGUuam9pbldpdGggPT09IEpvaW5XaXRoLlJpZ2h0KSB7XHJcbiAgICAgIGUuam9pbldpdGggPSBKb2luV2l0aC5Ob25lO1xyXG4gICAgICBlLm5leHRJbkFFTCEuam9pbldpdGggPSBKb2luV2l0aC5Ob25lO1xyXG4gICAgICB0aGlzLmFkZExvY2FsTWluUG9seShlLCBlLm5leHRJbkFFTCEsIGN1cnJQdCwgdHJ1ZSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBlLmpvaW5XaXRoID0gSm9pbldpdGguTm9uZTtcclxuICAgICAgZS5wcmV2SW5BRUwhLmpvaW5XaXRoID0gSm9pbldpdGguTm9uZTtcclxuICAgICAgdGhpcy5hZGRMb2NhbE1pblBvbHkoZS5wcmV2SW5BRUwhLCBlLCBjdXJyUHQsIHRydWUpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBjaGVja0pvaW5MZWZ0KGU6IEFjdGl2ZSwgcHQ6IElQb2ludDY0LCBjaGVja0N1cnJYOiBib29sZWFuID0gZmFsc2UpOiB2b2lkIHtcclxuICAgIGNvbnN0IHByZXYgPSBlLnByZXZJbkFFTDtcclxuICAgIGlmICghcHJldiB8fCBDbGlwcGVyQmFzZS5pc09wZW4oZSkgfHwgQ2xpcHBlckJhc2UuaXNPcGVuKHByZXYpIHx8XHJcbiAgICAgICFDbGlwcGVyQmFzZS5pc0hvdEVkZ2VBY3RpdmUoZSkgfHwgIUNsaXBwZXJCYXNlLmlzSG90RWRnZUFjdGl2ZShwcmV2KSkgcmV0dXJuO1xyXG5cclxuICAgIGlmICgocHQueSA8IGUudG9wLnkgKyAyIHx8IHB0LnkgPCBwcmV2LnRvcC55ICsgMikgJiYgLy8gYXZvaWQgdHJpdmlhbCBqb2luc1xyXG4gICAgICAoKGUuYm90LnkgPiBwdC55KSB8fCAocHJldi5ib3QueSA+IHB0LnkpKSkgcmV0dXJuOyAvLyAoIzQ5MClcclxuXHJcbiAgICBpZiAoY2hlY2tDdXJyWCkge1xyXG4gICAgICBpZiAoQ2xpcHBlci5wZXJwZW5kaWNEaXN0RnJvbUxpbmVTcXJkKHB0LCBwcmV2LmJvdCwgcHJldi50b3ApID4gMC4yNSkgcmV0dXJuO1xyXG4gICAgfSBlbHNlIGlmIChlLmN1clggIT09IHByZXYuY3VyWCkgcmV0dXJuO1xyXG4gICAgaWYgKEludGVybmFsQ2xpcHBlci5jcm9zc1Byb2R1Y3QoZS50b3AsIHB0LCBwcmV2LnRvcCkgIT09IDApIHJldHVybjtcclxuXHJcbiAgICBpZiAoZS5vdXRyZWMhLmlkeCA9PT0gcHJldi5vdXRyZWMhLmlkeClcclxuICAgICAgdGhpcy5hZGRMb2NhbE1heFBvbHkocHJldiwgZSwgcHQpO1xyXG4gICAgZWxzZSBpZiAoZS5vdXRyZWMhLmlkeCA8IHByZXYub3V0cmVjIS5pZHgpXHJcbiAgICAgIENsaXBwZXJCYXNlLmpvaW5PdXRyZWNQYXRocyhlLCBwcmV2KTtcclxuICAgIGVsc2VcclxuICAgICAgQ2xpcHBlckJhc2Uuam9pbk91dHJlY1BhdGhzKHByZXYsIGUpO1xyXG4gICAgcHJldi5qb2luV2l0aCA9IEpvaW5XaXRoLlJpZ2h0O1xyXG4gICAgZS5qb2luV2l0aCA9IEpvaW5XaXRoLkxlZnQ7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGNoZWNrSm9pblJpZ2h0KGU6IEFjdGl2ZSwgcHQ6IElQb2ludDY0LCBjaGVja0N1cnJYOiBib29sZWFuID0gZmFsc2UpOiB2b2lkIHtcclxuICAgIGNvbnN0IG5leHQgPSBlLm5leHRJbkFFTDtcclxuICAgIGlmIChDbGlwcGVyQmFzZS5pc09wZW4oZSkgfHwgIUNsaXBwZXJCYXNlLmlzSG90RWRnZUFjdGl2ZShlKSB8fCBDbGlwcGVyQmFzZS5pc0pvaW5lZChlKSB8fFxyXG4gICAgICAhbmV4dCB8fCBDbGlwcGVyQmFzZS5pc09wZW4obmV4dCkgfHwgIUNsaXBwZXJCYXNlLmlzSG90RWRnZUFjdGl2ZShuZXh0KSkgcmV0dXJuO1xyXG5cclxuICAgIGlmICgocHQueSA8IGUudG9wLnkgKyAyIHx8IHB0LnkgPCBuZXh0LnRvcC55ICsgMikgJiYgLy8gYXZvaWQgdHJpdmlhbCBqb2luc1xyXG4gICAgICAoKGUuYm90LnkgPiBwdC55KSB8fCAobmV4dC5ib3QueSA+IHB0LnkpKSkgcmV0dXJuOyAvLyAoIzQ5MClcclxuXHJcbiAgICBpZiAoY2hlY2tDdXJyWCkge1xyXG4gICAgICBpZiAoQ2xpcHBlci5wZXJwZW5kaWNEaXN0RnJvbUxpbmVTcXJkKHB0LCBuZXh0LmJvdCwgbmV4dC50b3ApID4gMC4yNSkgcmV0dXJuO1xyXG4gICAgfSBlbHNlIGlmIChlLmN1clggIT09IG5leHQuY3VyWCkgcmV0dXJuO1xyXG4gICAgaWYgKEludGVybmFsQ2xpcHBlci5jcm9zc1Byb2R1Y3QoZS50b3AsIHB0LCBuZXh0LnRvcCkgIT09IDApIHJldHVybjtcclxuXHJcbiAgICBpZiAoZS5vdXRyZWMhLmlkeCA9PT0gbmV4dC5vdXRyZWMhLmlkeClcclxuICAgICAgdGhpcy5hZGRMb2NhbE1heFBvbHkoZSwgbmV4dCwgcHQpO1xyXG4gICAgZWxzZSBpZiAoZS5vdXRyZWMhLmlkeCA8IG5leHQub3V0cmVjIS5pZHgpXHJcbiAgICAgIENsaXBwZXJCYXNlLmpvaW5PdXRyZWNQYXRocyhlLCBuZXh0KTtcclxuICAgIGVsc2VcclxuICAgICAgQ2xpcHBlckJhc2Uuam9pbk91dHJlY1BhdGhzKG5leHQsIGUpO1xyXG4gICAgZS5qb2luV2l0aCA9IEpvaW5XaXRoLlJpZ2h0O1xyXG4gICAgbmV4dC5qb2luV2l0aCA9IEpvaW5XaXRoLkxlZnQ7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHN0YXRpYyBmaXhPdXRSZWNQdHMob3V0cmVjOiBPdXRSZWMpOiB2b2lkIHtcclxuICAgIGxldCBvcCA9IG91dHJlYy5wdHMhO1xyXG4gICAgZG8ge1xyXG4gICAgICBvcCEub3V0cmVjID0gb3V0cmVjO1xyXG4gICAgICBvcCA9IG9wLm5leHQhO1xyXG4gICAgfSB3aGlsZSAob3AgIT09IG91dHJlYy5wdHMpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBzdGF0aWMgc2V0SG9yelNlZ0hlYWRpbmdGb3J3YXJkKGhzOiBIb3J6U2VnbWVudCwgb3BQOiBPdXRQdCwgb3BOOiBPdXRQdCk6IGJvb2xlYW4ge1xyXG4gICAgaWYgKG9wUC5wdC54ID09PSBvcE4ucHQueCkgcmV0dXJuIGZhbHNlO1xyXG4gICAgaWYgKG9wUC5wdC54IDwgb3BOLnB0LngpIHtcclxuICAgICAgaHMubGVmdE9wID0gb3BQO1xyXG4gICAgICBocy5yaWdodE9wID0gb3BOO1xyXG4gICAgICBocy5sZWZ0VG9SaWdodCA9IHRydWU7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBocy5sZWZ0T3AgPSBvcE47XHJcbiAgICAgIGhzLnJpZ2h0T3AgPSBvcFA7XHJcbiAgICAgIGhzLmxlZnRUb1JpZ2h0ID0gZmFsc2U7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdHJ1ZTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgc3RhdGljIHVwZGF0ZUhvcnpTZWdtZW50KGhzOiBIb3J6U2VnbWVudCk6IGJvb2xlYW4ge1xyXG4gICAgY29uc3Qgb3AgPSBocy5sZWZ0T3A7XHJcbiAgICBjb25zdCBvdXRyZWMgPSB0aGlzLmdldFJlYWxPdXRSZWMob3Aub3V0cmVjKSE7XHJcbiAgICBjb25zdCBvdXRyZWNIYXNFZGdlcyA9IG91dHJlYy5mcm9udEVkZ2UgIT09IHVuZGVmaW5lZDtcclxuICAgIGNvbnN0IGN1cnJfeSA9IG9wLnB0Lnk7XHJcbiAgICBsZXQgb3BQID0gb3AsIG9wTiA9IG9wO1xyXG5cclxuICAgIGlmIChvdXRyZWNIYXNFZGdlcykge1xyXG4gICAgICBjb25zdCBvcEEgPSBvdXRyZWMucHRzISwgb3BaID0gb3BBLm5leHQhO1xyXG4gICAgICB3aGlsZSAob3BQICE9PSBvcFogJiYgb3BQLnByZXYucHQueSA9PT0gY3Vycl95KVxyXG4gICAgICAgIG9wUCA9IG9wUC5wcmV2O1xyXG4gICAgICB3aGlsZSAob3BOICE9PSBvcEEgJiYgb3BOLm5leHQhLnB0LnkgPT09IGN1cnJfeSlcclxuICAgICAgICBvcE4gPSBvcE4ubmV4dCE7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB3aGlsZSAob3BQLnByZXYgIT09IG9wTiAmJiBvcFAucHJldi5wdC55ID09PSBjdXJyX3kpXHJcbiAgICAgICAgb3BQID0gb3BQLnByZXY7XHJcbiAgICAgIHdoaWxlIChvcE4ubmV4dCAhPT0gb3BQICYmIG9wTi5uZXh0IS5wdC55ID09PSBjdXJyX3kpXHJcbiAgICAgICAgb3BOID0gb3BOLm5leHQhO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHJlc3VsdCA9IHRoaXMuc2V0SG9yelNlZ0hlYWRpbmdGb3J3YXJkKGhzLCBvcFAsIG9wTikgJiYgaHMubGVmdE9wIS5ob3J6ID09PSB1bmRlZmluZWQ7XHJcblxyXG4gICAgaWYgKHJlc3VsdClcclxuICAgICAgaHMubGVmdE9wIS5ob3J6ID0gaHM7XHJcbiAgICBlbHNlXHJcbiAgICAgIGhzLnJpZ2h0T3AgPSB1bmRlZmluZWQ7IC8vIChmb3Igc29ydGluZylcclxuXHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBzdGF0aWMgZHVwbGljYXRlT3Aob3A6IE91dFB0LCBpbnNlcnRfYWZ0ZXI6IGJvb2xlYW4pOiBPdXRQdCB7XHJcbiAgICBjb25zdCByZXN1bHQgPSBuZXcgT3V0UHQob3AucHQsIG9wLm91dHJlYyk7XHJcbiAgICBpZiAoaW5zZXJ0X2FmdGVyKSB7XHJcbiAgICAgIHJlc3VsdC5uZXh0ID0gb3AubmV4dDtcclxuICAgICAgcmVzdWx0Lm5leHQhLnByZXYgPSByZXN1bHQ7XHJcbiAgICAgIHJlc3VsdC5wcmV2ID0gb3A7XHJcbiAgICAgIG9wLm5leHQgPSByZXN1bHQ7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICByZXN1bHQucHJldiA9IG9wLnByZXY7XHJcbiAgICAgIHJlc3VsdC5wcmV2Lm5leHQgPSByZXN1bHQ7XHJcbiAgICAgIHJlc3VsdC5uZXh0ID0gb3A7XHJcbiAgICAgIG9wLnByZXYgPSByZXN1bHQ7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBjb252ZXJ0SG9yelNlZ3NUb0pvaW5zKCk6IHZvaWQge1xyXG4gICAgbGV0IGsgPSAwO1xyXG4gICAgZm9yIChjb25zdCBocyBvZiB0aGlzLl9ob3J6U2VnTGlzdCkge1xyXG4gICAgICBpZiAoQ2xpcHBlckJhc2UudXBkYXRlSG9yelNlZ21lbnQoaHMpKSBrKys7XHJcbiAgICB9XHJcbiAgICBpZiAoayA8IDIpIHJldHVybjtcclxuICAgIHRoaXMuX2hvcnpTZWdMaXN0LnNvcnQoKGhzMSwgaHMyKSA9PiB7XHJcbiAgICAgIGlmICghaHMxIHx8ICFoczIpIHJldHVybiAwO1xyXG4gICAgICBpZiAoIWhzMS5yaWdodE9wKSB7XHJcbiAgICAgICAgcmV0dXJuICFoczIucmlnaHRPcCA/IDAgOiAxO1xyXG4gICAgICB9IGVsc2UgaWYgKCFoczIucmlnaHRPcClcclxuICAgICAgICByZXR1cm4gLTE7XHJcbiAgICAgIGVsc2VcclxuICAgICAgICByZXR1cm4gaHMxLmxlZnRPcCEucHQueCAtIGhzMi5sZWZ0T3AhLnB0Lng7XHJcbiAgICB9KTtcclxuXHJcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGsgLSAxOyBpKyspIHtcclxuICAgICAgY29uc3QgaHMxID0gdGhpcy5faG9yelNlZ0xpc3RbaV07XHJcbiAgICAgIC8vIGZvciBlYWNoIEhvcnpTZWdtZW50LCBmaW5kIG90aGVycyB0aGF0IG92ZXJsYXBcclxuICAgICAgZm9yIChsZXQgaiA9IGkgKyAxOyBqIDwgazsgaisrKSB7XHJcbiAgICAgICAgY29uc3QgaHMyID0gdGhpcy5faG9yelNlZ0xpc3Rbal07XHJcbiAgICAgICAgaWYgKGhzMi5sZWZ0T3AhLnB0LnggPj0gaHMxLnJpZ2h0T3AhLnB0LnggfHxcclxuICAgICAgICAgIGhzMi5sZWZ0VG9SaWdodCA9PT0gaHMxLmxlZnRUb1JpZ2h0IHx8XHJcbiAgICAgICAgICBoczIucmlnaHRPcCEucHQueCA8PSBoczEubGVmdE9wIS5wdC54KSBjb250aW51ZTtcclxuXHJcbiAgICAgICAgY29uc3QgY3Vycl95ID0gaHMxLmxlZnRPcC5wdC55O1xyXG5cclxuICAgICAgICBpZiAoaHMxLmxlZnRUb1JpZ2h0KSB7XHJcbiAgICAgICAgICB3aGlsZSAoaHMxLmxlZnRPcC5uZXh0IS5wdC55ID09PSBjdXJyX3kgJiZcclxuICAgICAgICAgICAgaHMxLmxlZnRPcC5uZXh0IS5wdC54IDw9IGhzMi5sZWZ0T3AucHQueCkge1xyXG4gICAgICAgICAgICBoczEubGVmdE9wID0gaHMxLmxlZnRPcC5uZXh0ITtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIHdoaWxlIChoczIubGVmdE9wLnByZXYucHQueSA9PT0gY3Vycl95ICYmXHJcbiAgICAgICAgICAgIGhzMi5sZWZ0T3AucHJldi5wdC54IDw9IGhzMS5sZWZ0T3AucHQueCkge1xyXG4gICAgICAgICAgICBoczIubGVmdE9wID0gaHMyLmxlZnRPcC5wcmV2O1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgY29uc3Qgam9pbiA9IG5ldyBIb3J6Sm9pbihcclxuICAgICAgICAgICAgQ2xpcHBlckJhc2UuZHVwbGljYXRlT3AoaHMxLmxlZnRPcCwgdHJ1ZSksXHJcbiAgICAgICAgICAgIENsaXBwZXJCYXNlLmR1cGxpY2F0ZU9wKGhzMi5sZWZ0T3AsIGZhbHNlKVxyXG4gICAgICAgICAgKTtcclxuICAgICAgICAgIHRoaXMuX2hvcnpKb2luTGlzdC5wdXNoKGpvaW4pO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICB3aGlsZSAoaHMxLmxlZnRPcC5wcmV2LnB0LnkgPT09IGN1cnJfeSAmJlxyXG4gICAgICAgICAgICBoczEubGVmdE9wLnByZXYucHQueCA8PSBoczIubGVmdE9wLnB0LngpIHtcclxuICAgICAgICAgICAgaHMxLmxlZnRPcCA9IGhzMS5sZWZ0T3AucHJldjtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIHdoaWxlIChoczIubGVmdE9wLm5leHQhLnB0LnkgPT09IGN1cnJfeSAmJlxyXG4gICAgICAgICAgICBoczIubGVmdE9wLm5leHQhLnB0LnggPD0gaHMxLmxlZnRPcC5wdC54KSB7XHJcbiAgICAgICAgICAgIGhzMi5sZWZ0T3AgPSBoczIubGVmdE9wLm5leHQhO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgY29uc3Qgam9pbiA9IG5ldyBIb3J6Sm9pbihcclxuICAgICAgICAgICAgQ2xpcHBlckJhc2UuZHVwbGljYXRlT3AoaHMyLmxlZnRPcCwgdHJ1ZSksXHJcbiAgICAgICAgICAgIENsaXBwZXJCYXNlLmR1cGxpY2F0ZU9wKGhzMS5sZWZ0T3AsIGZhbHNlKVxyXG4gICAgICAgICAgKTtcclxuICAgICAgICAgIHRoaXMuX2hvcnpKb2luTGlzdC5wdXNoKGpvaW4pO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBzdGF0aWMgZ2V0Q2xlYW5QYXRoKG9wOiBPdXRQdCk6IFBhdGg2NCB7XHJcbiAgICBjb25zdCByZXN1bHQgPSBuZXcgUGF0aDY0KCk7XHJcbiAgICBsZXQgb3AyID0gb3A7XHJcbiAgICB3aGlsZSAob3AyLm5leHQgIT09IG9wICYmXHJcbiAgICAgICgob3AyLnB0LnggPT09IG9wMi5uZXh0IS5wdC54ICYmIG9wMi5wdC54ID09PSBvcDIucHJldi5wdC54KSB8fFxyXG4gICAgICAgIChvcDIucHQueSA9PT0gb3AyLm5leHQhLnB0LnkgJiYgb3AyLnB0LnkgPT09IG9wMi5wcmV2LnB0LnkpKSkge1xyXG4gICAgICBvcDIgPSBvcDIubmV4dCE7XHJcbiAgICB9XHJcbiAgICByZXN1bHQucHVzaChvcDIucHQpO1xyXG4gICAgbGV0IHByZXZPcCA9IG9wMjtcclxuICAgIG9wMiA9IG9wMi5uZXh0ITtcclxuXHJcbiAgICB3aGlsZSAob3AyICE9PSBvcCkge1xyXG4gICAgICBpZiAoKG9wMi5wdC54ICE9PSBvcDIubmV4dCEucHQueCB8fCBvcDIucHQueCAhPT0gcHJldk9wLnB0LngpICYmXHJcbiAgICAgICAgKG9wMi5wdC55ICE9PSBvcDIubmV4dCEucHQueSB8fCBvcDIucHQueSAhPT0gcHJldk9wLnB0LnkpKSB7XHJcbiAgICAgICAgcmVzdWx0LnB1c2gob3AyLnB0KTtcclxuICAgICAgICBwcmV2T3AgPSBvcDI7XHJcbiAgICAgIH1cclxuICAgICAgb3AyID0gb3AyLm5leHQhO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHJlc3VsdDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgc3RhdGljIHBvaW50SW5PcFBvbHlnb24ocHQ6IElQb2ludDY0LCBvcDogT3V0UHQpOiBQb2ludEluUG9seWdvblJlc3VsdCB7XHJcbiAgICBpZiAob3AgPT09IG9wLm5leHQgfHwgb3AucHJldiA9PT0gb3AubmV4dClcclxuICAgICAgcmV0dXJuIFBvaW50SW5Qb2x5Z29uUmVzdWx0LklzT3V0c2lkZTtcclxuXHJcbiAgICBsZXQgb3AyID0gb3A7XHJcbiAgICBkbyB7XHJcbiAgICAgIGlmIChvcC5wdC55ICE9PSBwdC55KSBicmVhaztcclxuICAgICAgb3AgPSBvcC5uZXh0ITtcclxuICAgIH0gd2hpbGUgKG9wICE9PSBvcDIpO1xyXG4gICAgaWYgKG9wLnB0LnkgPT09IHB0LnkpICAvLyBub3QgYSBwcm9wZXIgcG9seWdvblxyXG4gICAgICByZXR1cm4gUG9pbnRJblBvbHlnb25SZXN1bHQuSXNPdXRzaWRlO1xyXG5cclxuICAgIGxldCBpc0Fib3ZlID0gb3AucHQueSA8IHB0LnlcclxuICAgIGNvbnN0IHN0YXJ0aW5nQWJvdmUgPSBpc0Fib3ZlO1xyXG4gICAgbGV0IHZhbCA9IDA7XHJcblxyXG4gICAgb3AyID0gb3AubmV4dCE7XHJcbiAgICB3aGlsZSAob3AyICE9PSBvcCkge1xyXG4gICAgICBpZiAoaXNBYm92ZSlcclxuICAgICAgICB3aGlsZSAob3AyICE9PSBvcCAmJiBvcDIucHQueSA8IHB0LnkpIG9wMiA9IG9wMi5uZXh0ITtcclxuICAgICAgZWxzZVxyXG4gICAgICAgIHdoaWxlIChvcDIgIT09IG9wICYmIG9wMi5wdC55ID4gcHQueSkgb3AyID0gb3AyLm5leHQhO1xyXG4gICAgICBpZiAob3AyID09PSBvcCkgYnJlYWs7XHJcblxyXG4gICAgICBpZiAob3AyLnB0LnkgPT09IHB0LnkpIHtcclxuICAgICAgICBpZiAob3AyLnB0LnggPT09IHB0LnggfHwgKG9wMi5wdC55ID09PSBvcDIucHJldi5wdC55ICYmXHJcbiAgICAgICAgICAocHQueCA8IG9wMi5wcmV2LnB0LngpICE9PSAocHQueCA8IG9wMi5wdC54KSkpXHJcbiAgICAgICAgICByZXR1cm4gUG9pbnRJblBvbHlnb25SZXN1bHQuSXNPbjtcclxuICAgICAgICBvcDIgPSBvcDIubmV4dCE7XHJcbiAgICAgICAgaWYgKG9wMiA9PT0gb3ApIGJyZWFrO1xyXG4gICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBpZiAob3AyLnB0LnggPD0gcHQueCB8fCBvcDIucHJldi5wdC54IDw9IHB0LngpIHtcclxuICAgICAgICBpZiAob3AyLnByZXYucHQueCA8IHB0LnggJiYgb3AyLnB0LnggPCBwdC54KVxyXG4gICAgICAgICAgdmFsID0gMSAtIHZhbDtcclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgIGNvbnN0IGQgPSBJbnRlcm5hbENsaXBwZXIuY3Jvc3NQcm9kdWN0KG9wMi5wcmV2LnB0LCBvcDIucHQsIHB0KTtcclxuICAgICAgICAgIGlmIChkID09PSAwKSByZXR1cm4gUG9pbnRJblBvbHlnb25SZXN1bHQuSXNPbjtcclxuICAgICAgICAgIGlmICgoZCA8IDApID09PSBpc0Fib3ZlKSB2YWwgPSAxIC0gdmFsO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICBpc0Fib3ZlID0gIWlzQWJvdmU7XHJcbiAgICAgIG9wMiA9IG9wMi5uZXh0ITtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoaXNBYm92ZSAhPT0gc3RhcnRpbmdBYm92ZSkge1xyXG4gICAgICBjb25zdCBkID0gSW50ZXJuYWxDbGlwcGVyLmNyb3NzUHJvZHVjdChvcDIucHJldi5wdCwgb3AyLnB0LCBwdCk7XHJcbiAgICAgIGlmIChkID09PSAwKSByZXR1cm4gUG9pbnRJblBvbHlnb25SZXN1bHQuSXNPbjtcclxuICAgICAgaWYgKChkIDwgMCkgPT09IGlzQWJvdmUpIHZhbCA9IDEgLSB2YWw7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHZhbCA9PT0gMCkgcmV0dXJuIFBvaW50SW5Qb2x5Z29uUmVzdWx0LklzT3V0c2lkZTtcclxuICAgIGVsc2UgcmV0dXJuIFBvaW50SW5Qb2x5Z29uUmVzdWx0LklzSW5zaWRlO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBzdGF0aWMgcGF0aDFJbnNpZGVQYXRoMihvcDE6IE91dFB0LCBvcDI6IE91dFB0KTogYm9vbGVhbiB7XHJcbiAgICBsZXQgcmVzdWx0OiBQb2ludEluUG9seWdvblJlc3VsdDtcclxuICAgIGxldCBvdXRzaWRlX2NudCA9IDA7XHJcbiAgICBsZXQgb3AgPSBvcDE7XHJcbiAgICBkbyB7XHJcbiAgICAgIHJlc3VsdCA9IHRoaXMucG9pbnRJbk9wUG9seWdvbihvcC5wdCwgb3AyKTtcclxuICAgICAgaWYgKHJlc3VsdCA9PT0gUG9pbnRJblBvbHlnb25SZXN1bHQuSXNPdXRzaWRlKSArK291dHNpZGVfY250O1xyXG4gICAgICBlbHNlIGlmIChyZXN1bHQgPT09IFBvaW50SW5Qb2x5Z29uUmVzdWx0LklzSW5zaWRlKSAtLW91dHNpZGVfY250O1xyXG4gICAgICBvcCA9IG9wLm5leHQhO1xyXG4gICAgfSB3aGlsZSAob3AgIT09IG9wMSAmJiBNYXRoLmFicyhvdXRzaWRlX2NudCkgPCAyKTtcclxuICAgIGlmIChNYXRoLmFicyhvdXRzaWRlX2NudCkgPiAxKSByZXR1cm4gKG91dHNpZGVfY250IDwgMCk7XHJcblxyXG4gICAgY29uc3QgbXAgPSBDbGlwcGVyQmFzZS5nZXRCb3VuZHNQYXRoKHRoaXMuZ2V0Q2xlYW5QYXRoKG9wMSkpLm1pZFBvaW50KCk7XHJcbiAgICBjb25zdCBwYXRoMiA9IHRoaXMuZ2V0Q2xlYW5QYXRoKG9wMik7XHJcbiAgICByZXR1cm4gSW50ZXJuYWxDbGlwcGVyLnBvaW50SW5Qb2x5Z29uKG1wLCBwYXRoMikgIT09IFBvaW50SW5Qb2x5Z29uUmVzdWx0LklzT3V0c2lkZTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgbW92ZVNwbGl0cyhmcm9tT3I6IE91dFJlYywgdG9PcjogT3V0UmVjKTogdm9pZCB7XHJcbiAgICBpZiAoIWZyb21Pci5zcGxpdHMpIHJldHVybjtcclxuICAgIHRvT3Iuc3BsaXRzID0gdG9Pci5zcGxpdHMgfHwgW107XHJcbiAgICBmb3IgKGNvbnN0IGkgb2YgZnJvbU9yLnNwbGl0cykge1xyXG4gICAgICB0b09yLnNwbGl0cy5wdXNoKGkpO1xyXG4gICAgfVxyXG4gICAgZnJvbU9yLnNwbGl0cyA9IHVuZGVmaW5lZDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcHJvY2Vzc0hvcnpKb2lucygpOiB2b2lkIHtcclxuICAgIGZvciAoY29uc3QgaiBvZiB0aGlzLl9ob3J6Sm9pbkxpc3QpIHtcclxuICAgICAgY29uc3Qgb3IxID0gQ2xpcHBlckJhc2UuZ2V0UmVhbE91dFJlYyhqLm9wMSEub3V0cmVjKSE7XHJcbiAgICAgIGxldCBvcjIgPSBDbGlwcGVyQmFzZS5nZXRSZWFsT3V0UmVjKGoub3AyIS5vdXRyZWMpITtcclxuXHJcbiAgICAgIGNvbnN0IG9wMWIgPSBqLm9wMSEubmV4dCE7XHJcbiAgICAgIGNvbnN0IG9wMmIgPSBqLm9wMiEucHJldiE7XHJcbiAgICAgIGoub3AxIS5uZXh0ID0gai5vcDIhO1xyXG4gICAgICBqLm9wMiEucHJldiA9IGoub3AxITtcclxuICAgICAgb3AxYi5wcmV2ID0gb3AyYjtcclxuICAgICAgb3AyYi5uZXh0ID0gb3AxYjtcclxuXHJcbiAgICAgIGlmIChvcjEgPT09IG9yMikge1xyXG4gICAgICAgIG9yMiA9IHRoaXMubmV3T3V0UmVjKCk7XHJcbiAgICAgICAgb3IyLnB0cyA9IG9wMWI7XHJcbiAgICAgICAgQ2xpcHBlckJhc2UuZml4T3V0UmVjUHRzKG9yMik7XHJcblxyXG4gICAgICAgIGlmIChvcjEucHRzIS5vdXRyZWMgPT09IG9yMikge1xyXG4gICAgICAgICAgb3IxLnB0cyA9IGoub3AxO1xyXG4gICAgICAgICAgb3IxLnB0cyEub3V0cmVjID0gb3IxO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHRoaXMuX3VzaW5nX3BvbHl0cmVlKSB7XHJcbiAgICAgICAgICBpZiAoQ2xpcHBlckJhc2UucGF0aDFJbnNpZGVQYXRoMihvcjEucHRzISwgb3IyLnB0cykpIHtcclxuICAgICAgICAgICAgY29uc3QgdG1wID0gb3IxLnB0cztcclxuICAgICAgICAgICAgb3IxLnB0cyA9IG9yMi5wdHM7XHJcbiAgICAgICAgICAgIG9yMi5wdHMgPSB0bXA7XHJcbiAgICAgICAgICAgIENsaXBwZXJCYXNlLmZpeE91dFJlY1B0cyhvcjEpO1xyXG4gICAgICAgICAgICBDbGlwcGVyQmFzZS5maXhPdXRSZWNQdHMob3IyKTtcclxuICAgICAgICAgICAgb3IyLm93bmVyID0gb3IxLm93bmVyO1xyXG4gICAgICAgICAgfSBlbHNlIGlmIChDbGlwcGVyQmFzZS5wYXRoMUluc2lkZVBhdGgyKG9yMi5wdHMsIG9yMS5wdHMhKSkge1xyXG4gICAgICAgICAgICBvcjIub3duZXIgPSBvcjE7XHJcbiAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBvcjIub3duZXIgPSBvcjEub3duZXI7XHJcbiAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgb3IxLnNwbGl0cyA9IG9yMS5zcGxpdHMgfHwgW107XHJcbiAgICAgICAgICBvcjEuc3BsaXRzLnB1c2gob3IyLmlkeCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIG9yMi5vd25lciA9IG9yMTtcclxuICAgICAgICB9XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgb3IyLnB0cyA9IHVuZGVmaW5lZDtcclxuICAgICAgICBpZiAodGhpcy5fdXNpbmdfcG9seXRyZWUpIHtcclxuICAgICAgICAgIENsaXBwZXJCYXNlLnNldE93bmVyKG9yMiwgb3IxKTtcclxuICAgICAgICAgIHRoaXMubW92ZVNwbGl0cyhvcjIsIG9yMSk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIG9yMi5vd25lciA9IG9yMTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgc3RhdGljIHB0c1JlYWxseUNsb3NlKHB0MTogSVBvaW50NjQsIHB0MjogSVBvaW50NjQpOiBib29sZWFuIHtcclxuICAgIHJldHVybiAoTWF0aC5hYnMocHQxLnggLSBwdDIueCkgPCAyKSAmJiAoTWF0aC5hYnMocHQxLnkgLSBwdDIueSkgPCAyKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgc3RhdGljIGlzVmVyeVNtYWxsVHJpYW5nbGUob3A6IE91dFB0KTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gb3AubmV4dCEubmV4dCA9PT0gb3AucHJldiAmJlxyXG4gICAgICAodGhpcy5wdHNSZWFsbHlDbG9zZShvcC5wcmV2LnB0LCBvcC5uZXh0IS5wdCkgfHxcclxuICAgICAgICB0aGlzLnB0c1JlYWxseUNsb3NlKG9wLnB0LCBvcC5uZXh0IS5wdCkgfHxcclxuICAgICAgICB0aGlzLnB0c1JlYWxseUNsb3NlKG9wLnB0LCBvcC5wcmV2LnB0KSk7XHJcbiAgfVxyXG5cclxuXHJcbiAgcHJpdmF0ZSBzdGF0aWMgaXNWYWxpZENsb3NlZFBhdGgob3A6IE91dFB0IHwgdW5kZWZpbmVkKTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gb3AgIT09IHVuZGVmaW5lZCAmJiBvcC5uZXh0ICE9PSBvcCAmJlxyXG4gICAgICAob3AubmV4dCAhPT0gb3AucHJldiB8fCAhdGhpcy5pc1ZlcnlTbWFsbFRyaWFuZ2xlKG9wKSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHN0YXRpYyBkaXNwb3NlT3V0UHQob3A6IE91dFB0KTogT3V0UHQgfCB1bmRlZmluZWQge1xyXG4gICAgY29uc3QgcmVzdWx0ID0gb3AubmV4dCA9PT0gb3AgPyB1bmRlZmluZWQgOiBvcC5uZXh0O1xyXG4gICAgb3AucHJldi5uZXh0ID0gb3AubmV4dDtcclxuICAgIG9wLm5leHQhLnByZXYgPSBvcC5wcmV2O1xyXG4gICAgcmV0dXJuIHJlc3VsdDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgY2xlYW5Db2xsaW5lYXIob3V0cmVjOiBPdXRSZWMgfCB1bmRlZmluZWQpOiB2b2lkIHtcclxuICAgIG91dHJlYyA9IENsaXBwZXJCYXNlLmdldFJlYWxPdXRSZWMob3V0cmVjKTtcclxuXHJcbiAgICBpZiAob3V0cmVjID09PSB1bmRlZmluZWQgfHwgb3V0cmVjLmlzT3BlbikgcmV0dXJuO1xyXG5cclxuICAgIGlmICghQ2xpcHBlckJhc2UuaXNWYWxpZENsb3NlZFBhdGgob3V0cmVjLnB0cykpIHtcclxuICAgICAgb3V0cmVjLnB0cyA9IHVuZGVmaW5lZDtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIGxldCBzdGFydE9wOiBPdXRQdCA9IG91dHJlYy5wdHMhO1xyXG4gICAgbGV0IG9wMjogT3V0UHQgfCB1bmRlZmluZWQgPSBzdGFydE9wO1xyXG4gICAgZm9yICg7IDspIHtcclxuICAgICAgLy8gTkIgaWYgcHJlc2VydmVDb2xsaW5lYXIgPT0gdHJ1ZSwgdGhlbiBvbmx5IHJlbW92ZSAxODAgZGVnLiBzcGlrZXNcclxuICAgICAgaWYgKEludGVybmFsQ2xpcHBlci5jcm9zc1Byb2R1Y3Qob3AyIS5wcmV2LnB0LCBvcDIhLnB0LCBvcDIhLm5leHQhLnB0KSA9PT0gMCAmJlxyXG4gICAgICAgIChvcDIhLnB0ID09PSBvcDIhLnByZXYucHQgfHwgb3AyIS5wdCA9PT0gb3AyIS5uZXh0IS5wdCB8fCAhdGhpcy5wcmVzZXJ2ZUNvbGxpbmVhciB8fFxyXG4gICAgICAgICAgSW50ZXJuYWxDbGlwcGVyLmRvdFByb2R1Y3Qob3AyIS5wcmV2LnB0LCBvcDIhLnB0LCBvcDIhLm5leHQhLnB0KSA8IDApKSB7XHJcblxyXG4gICAgICAgIGlmIChvcDIgPT09IG91dHJlYy5wdHMpIHtcclxuICAgICAgICAgIG91dHJlYy5wdHMgPSBvcDIhLnByZXY7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBvcDIgPSBDbGlwcGVyQmFzZS5kaXNwb3NlT3V0UHQob3AyISk7XHJcbiAgICAgICAgaWYgKCFDbGlwcGVyQmFzZS5pc1ZhbGlkQ2xvc2VkUGF0aChvcDIpKSB7XHJcbiAgICAgICAgICBvdXRyZWMucHRzID0gdW5kZWZpbmVkO1xyXG4gICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICBzdGFydE9wID0gb3AyITtcclxuICAgICAgICBjb250aW51ZTtcclxuICAgICAgfVxyXG4gICAgICBvcDIgPSBvcDIhLm5leHQ7XHJcbiAgICAgIGlmIChvcDIgPT09IHN0YXJ0T3ApIGJyZWFrO1xyXG4gICAgfVxyXG4gICAgdGhpcy5maXhTZWxmSW50ZXJzZWN0cyhvdXRyZWMpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBkb1NwbGl0T3Aob3V0cmVjOiBPdXRSZWMsIHNwbGl0T3A6IE91dFB0KTogdm9pZCB7XHJcbiAgICAvLyBzcGxpdE9wLnByZXYgPD0+IHNwbGl0T3AgJiZcclxuICAgIC8vIHNwbGl0T3AubmV4dCA8PT4gc3BsaXRPcC5uZXh0Lm5leHQgYXJlIGludGVyc2VjdGluZ1xyXG4gICAgY29uc3QgcHJldk9wOiBPdXRQdCA9IHNwbGl0T3AucHJldjtcclxuICAgIGNvbnN0IG5leHROZXh0T3A6IE91dFB0ID0gc3BsaXRPcC5uZXh0IS5uZXh0ITtcclxuICAgIG91dHJlYy5wdHMgPSBwcmV2T3A7XHJcblxyXG4gICAgY29uc3QgaXA6IElQb2ludDY0ID0gSW50ZXJuYWxDbGlwcGVyLmdldEludGVyc2VjdFBvaW50KFxyXG4gICAgICBwcmV2T3AucHQsIHNwbGl0T3AucHQsIHNwbGl0T3AubmV4dCEucHQsIG5leHROZXh0T3AucHQpLmlwO1xyXG5cclxuICAgIGNvbnN0IGFyZWExOiBudW1iZXIgPSBDbGlwcGVyQmFzZS5hcmVhKHByZXZPcCk7XHJcbiAgICBjb25zdCBhYnNBcmVhMTogbnVtYmVyID0gTWF0aC5hYnMoYXJlYTEpO1xyXG5cclxuICAgIGlmIChhYnNBcmVhMSA8IDIpIHtcclxuICAgICAgb3V0cmVjLnB0cyA9IHVuZGVmaW5lZDtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGFyZWEyOiBudW1iZXIgPSBDbGlwcGVyQmFzZS5hcmVhVHJpYW5nbGUoaXAsIHNwbGl0T3AucHQsIHNwbGl0T3AubmV4dCEucHQpO1xyXG4gICAgY29uc3QgYWJzQXJlYTI6IG51bWJlciA9IE1hdGguYWJzKGFyZWEyKTtcclxuXHJcbiAgICAvLyBkZS1saW5rIHNwbGl0T3AgYW5kIHNwbGl0T3AubmV4dCBmcm9tIHRoZSBwYXRoXHJcbiAgICAvLyB3aGlsZSBpbnNlcnRpbmcgdGhlIGludGVyc2VjdGlvbiBwb2ludFxyXG4gICAgaWYgKGlwID09PSBwcmV2T3AucHQgfHwgaXAgPT09IG5leHROZXh0T3AucHQpIHtcclxuICAgICAgbmV4dE5leHRPcC5wcmV2ID0gcHJldk9wO1xyXG4gICAgICBwcmV2T3AubmV4dCA9IG5leHROZXh0T3A7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBjb25zdCBuZXdPcDIgPSBuZXcgT3V0UHQoaXAsIG91dHJlYyk7XHJcbiAgICAgIG5ld09wMi5wcmV2ID0gcHJldk9wO1xyXG4gICAgICBuZXdPcDIubmV4dCA9IG5leHROZXh0T3A7XHJcbiAgICAgIG5leHROZXh0T3AucHJldiA9IG5ld09wMjtcclxuICAgICAgcHJldk9wLm5leHQgPSBuZXdPcDI7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gbmI6IGFyZWExIGlzIHRoZSBwYXRoJ3MgYXJlYSAqYmVmb3JlKiBzcGxpdHRpbmcsIHdoZXJlYXMgYXJlYTIgaXNcclxuICAgIC8vIHRoZSBhcmVhIG9mIHRoZSB0cmlhbmdsZSBjb250YWluaW5nIHNwbGl0T3AgJiBzcGxpdE9wLm5leHQuXHJcbiAgICAvLyBTbyB0aGUgb25seSB3YXkgZm9yIHRoZXNlIGFyZWFzIHRvIGhhdmUgdGhlIHNhbWUgc2lnbiBpcyBpZlxyXG4gICAgLy8gdGhlIHNwbGl0IHRyaWFuZ2xlIGlzIGxhcmdlciB0aGFuIHRoZSBwYXRoIGNvbnRhaW5pbmcgcHJldk9wIG9yXHJcbiAgICAvLyBpZiB0aGVyZSdzIG1vcmUgdGhhbiBvbmUgc2VsZj1pbnRlcnNlY3Rpb24uXHJcbiAgICBpZiAoYWJzQXJlYTIgPiAxICYmXHJcbiAgICAgIChhYnNBcmVhMiA+IGFic0FyZWExIHx8IChhcmVhMiA+IDApID09PSAoYXJlYTEgPiAwKSkpIHtcclxuXHJcbiAgICAgIGNvbnN0IG5ld091dFJlYzogT3V0UmVjID0gdGhpcy5uZXdPdXRSZWMoKTtcclxuICAgICAgbmV3T3V0UmVjLm93bmVyID0gb3V0cmVjLm93bmVyO1xyXG4gICAgICBzcGxpdE9wLm91dHJlYyA9IG5ld091dFJlYztcclxuICAgICAgc3BsaXRPcC5uZXh0IS5vdXRyZWMgPSBuZXdPdXRSZWM7XHJcblxyXG4gICAgICBjb25zdCBuZXdPcDogT3V0UHQgPSBuZXcgT3V0UHQoaXAsIG5ld091dFJlYyk7XHJcbiAgICAgIG5ld09wLnByZXYgPSBzcGxpdE9wLm5leHQhO1xyXG4gICAgICBuZXdPcC5uZXh0ID0gc3BsaXRPcDtcclxuICAgICAgbmV3T3V0UmVjLnB0cyA9IG5ld09wO1xyXG4gICAgICBzcGxpdE9wLnByZXYgPSBuZXdPcDtcclxuICAgICAgc3BsaXRPcC5uZXh0IS5uZXh0ID0gbmV3T3A7XHJcblxyXG4gICAgICBpZiAodGhpcy5fdXNpbmdfcG9seXRyZWUpIHtcclxuICAgICAgICBpZiAoQ2xpcHBlckJhc2UucGF0aDFJbnNpZGVQYXRoMihwcmV2T3AsIG5ld09wKSkge1xyXG4gICAgICAgICAgbmV3T3V0UmVjLnNwbGl0cyA9IG5ld091dFJlYy5zcGxpdHMgfHwgW107XHJcbiAgICAgICAgICBuZXdPdXRSZWMuc3BsaXRzLnB1c2gob3V0cmVjLmlkeCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIG91dHJlYy5zcGxpdHMgPSBvdXRyZWMuc3BsaXRzIHx8IFtdO1xyXG4gICAgICAgICAgb3V0cmVjLnNwbGl0cy5wdXNoKG5ld091dFJlYy5pZHgpO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgLy8gZWxzZSB7IHNwbGl0T3AgPSB1bmRlZmluZWQ7IHNwbGl0T3AubmV4dCA9IHVuZGVmaW5lZDsgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBmaXhTZWxmSW50ZXJzZWN0cyhvdXRyZWM6IE91dFJlYyk6IHZvaWQge1xyXG4gICAgbGV0IG9wMjogT3V0UHQgPSBvdXRyZWMucHRzITtcclxuICAgIGZvciAoOyA7KSB7XHJcbiAgICAgIGlmIChvcDIucHJldiA9PT0gb3AyLm5leHQhLm5leHQpIGJyZWFrO1xyXG4gICAgICBpZiAoSW50ZXJuYWxDbGlwcGVyLnNlZ3NJbnRlcnNlY3Qob3AyLnByZXYucHQsIG9wMi5wdCwgb3AyLm5leHQhLnB0LCBvcDIubmV4dCEubmV4dCEucHQpKSB7XHJcbiAgICAgICAgdGhpcy5kb1NwbGl0T3Aob3V0cmVjLCBvcDIpO1xyXG4gICAgICAgIGlmICghb3V0cmVjLnB0cykgcmV0dXJuO1xyXG4gICAgICAgIG9wMiA9IG91dHJlYy5wdHM7XHJcbiAgICAgICAgY29udGludWU7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgb3AyID0gb3AyLm5leHQhO1xyXG4gICAgICB9XHJcbiAgICAgIGlmIChvcDIgPT09IG91dHJlYy5wdHMpIGJyZWFrO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgc3RhdGljIGJ1aWxkUGF0aChvcDogT3V0UHQgfCB1bmRlZmluZWQsIHJldmVyc2U6IGJvb2xlYW4sIGlzT3BlbjogYm9vbGVhbiwgcGF0aDogUGF0aDY0KTogYm9vbGVhbiB7XHJcbiAgICBpZiAob3AgPT09IHVuZGVmaW5lZCB8fCBvcC5uZXh0ID09PSBvcCB8fCAoIWlzT3BlbiAmJiBvcC5uZXh0ID09PSBvcC5wcmV2KSkgcmV0dXJuIGZhbHNlO1xyXG4gICAgcGF0aC5sZW5ndGggPSAwXHJcblxyXG4gICAgbGV0IGxhc3RQdDogSVBvaW50NjQ7XHJcbiAgICBsZXQgb3AyOiBPdXRQdDtcclxuICAgIGlmIChyZXZlcnNlKSB7XHJcbiAgICAgIGxhc3RQdCA9IG9wLnB0O1xyXG4gICAgICBvcDIgPSBvcC5wcmV2O1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgb3AgPSBvcC5uZXh0ITtcclxuICAgICAgbGFzdFB0ID0gb3AucHQ7XHJcbiAgICAgIG9wMiA9IG9wLm5leHQhO1xyXG4gICAgfVxyXG4gICAgcGF0aC5wdXNoKGxhc3RQdCk7XHJcblxyXG4gICAgd2hpbGUgKG9wMiAhPT0gb3ApIHtcclxuICAgICAgaWYgKG9wMi5wdCAhPT0gbGFzdFB0KSB7XHJcbiAgICAgICAgbGFzdFB0ID0gb3AyLnB0O1xyXG4gICAgICAgIHBhdGgucHVzaChsYXN0UHQpO1xyXG4gICAgICB9XHJcbiAgICAgIGlmIChyZXZlcnNlKSB7XHJcbiAgICAgICAgb3AyID0gb3AyLnByZXY7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgb3AyID0gb3AyLm5leHQhO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHBhdGgubGVuZ3RoID09PSAzICYmIHRoaXMuaXNWZXJ5U21hbGxUcmlhbmdsZShvcDIpKSByZXR1cm4gZmFsc2U7XHJcbiAgICBlbHNlIHJldHVybiB0cnVlO1xyXG4gIH1cclxuXHJcbiAgcHJvdGVjdGVkIGJ1aWxkUGF0aHMoc29sdXRpb25DbG9zZWQ6IFBhdGhzNjQsIHNvbHV0aW9uT3BlbjogUGF0aHM2NCk6IGJvb2xlYW4ge1xyXG4gICAgc29sdXRpb25DbG9zZWQubGVuZ3RoID0gMFxyXG4gICAgc29sdXRpb25PcGVuLmxlbmd0aCA9IDBcclxuXHJcbiAgICBsZXQgaSA9IDA7XHJcbiAgICB3aGlsZSAoaSA8IHRoaXMuX291dHJlY0xpc3QubGVuZ3RoKSB7XHJcbiAgICAgIGNvbnN0IG91dHJlYyA9IHRoaXMuX291dHJlY0xpc3RbaSsrXTtcclxuICAgICAgaWYgKCFvdXRyZWMucHRzKSBjb250aW51ZTtcclxuXHJcbiAgICAgIGNvbnN0IHBhdGggPSBuZXcgUGF0aDY0KCk7XHJcbiAgICAgIGlmIChvdXRyZWMuaXNPcGVuKSB7XHJcbiAgICAgICAgaWYgKENsaXBwZXJCYXNlLmJ1aWxkUGF0aChvdXRyZWMucHRzLCB0aGlzLnJldmVyc2VTb2x1dGlvbiwgdHJ1ZSwgcGF0aCkpIHtcclxuICAgICAgICAgIHNvbHV0aW9uT3Blbi5wdXNoKHBhdGgpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICB0aGlzLmNsZWFuQ29sbGluZWFyKG91dHJlYyk7XHJcbiAgICAgICAgLy8gY2xvc2VkIHBhdGhzIHNob3VsZCBhbHdheXMgcmV0dXJuIGEgUG9zaXRpdmUgb3JpZW50YXRpb25cclxuICAgICAgICAvLyBleGNlcHQgd2hlbiByZXZlcnNlU29sdXRpb24gPT0gdHJ1ZVxyXG4gICAgICAgIGlmIChDbGlwcGVyQmFzZS5idWlsZFBhdGgob3V0cmVjLnB0cywgdGhpcy5yZXZlcnNlU29sdXRpb24sIGZhbHNlLCBwYXRoKSkge1xyXG4gICAgICAgICAgc29sdXRpb25DbG9zZWQucHVzaChwYXRoKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiB0cnVlO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBzdGF0aWMgZ2V0Qm91bmRzUGF0aChwYXRoOiBQYXRoNjQpOiBSZWN0NjQge1xyXG4gICAgaWYgKHBhdGgubGVuZ3RoID09PSAwKSByZXR1cm4gbmV3IFJlY3Q2NCgpO1xyXG4gICAgY29uc3QgcmVzdWx0ID0gQ2xpcHBlci5JbnZhbGlkUmVjdDY0O1xyXG4gICAgZm9yIChjb25zdCBwdCBvZiBwYXRoKSB7XHJcbiAgICAgIGlmIChwdC54IDwgcmVzdWx0LmxlZnQpIHJlc3VsdC5sZWZ0ID0gcHQueDtcclxuICAgICAgaWYgKHB0LnggPiByZXN1bHQucmlnaHQpIHJlc3VsdC5yaWdodCA9IHB0Lng7XHJcbiAgICAgIGlmIChwdC55IDwgcmVzdWx0LnRvcCkgcmVzdWx0LnRvcCA9IHB0Lnk7XHJcbiAgICAgIGlmIChwdC55ID4gcmVzdWx0LmJvdHRvbSkgcmVzdWx0LmJvdHRvbSA9IHB0Lnk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBjaGVja0JvdW5kcyhvdXRyZWM6IE91dFJlYyk6IGJvb2xlYW4ge1xyXG4gICAgaWYgKG91dHJlYy5wdHMgPT09IHVuZGVmaW5lZCkgcmV0dXJuIGZhbHNlO1xyXG4gICAgaWYgKCFvdXRyZWMuYm91bmRzLmlzRW1wdHkoKSkgcmV0dXJuIHRydWU7XHJcbiAgICB0aGlzLmNsZWFuQ29sbGluZWFyKG91dHJlYyk7XHJcbiAgICBpZiAob3V0cmVjLnB0cyA9PT0gdW5kZWZpbmVkIHx8ICFDbGlwcGVyQmFzZS5idWlsZFBhdGgob3V0cmVjLnB0cywgdGhpcy5yZXZlcnNlU29sdXRpb24sIGZhbHNlLCBvdXRyZWMucGF0aCkpXHJcbiAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIG91dHJlYy5ib3VuZHMgPSBDbGlwcGVyQmFzZS5nZXRCb3VuZHNQYXRoKG91dHJlYy5wYXRoKTtcclxuICAgIHJldHVybiB0cnVlO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBjaGVja1NwbGl0T3duZXIob3V0cmVjOiBPdXRSZWMsIHNwbGl0czogbnVtYmVyW10gfCB1bmRlZmluZWQpOiBib29sZWFuIHtcclxuICAgIGZvciAoY29uc3QgaSBvZiBzcGxpdHMhKSB7XHJcbiAgICAgIGNvbnN0IHNwbGl0OiBPdXRSZWMgfCB1bmRlZmluZWQgPSBDbGlwcGVyQmFzZS5nZXRSZWFsT3V0UmVjKHRoaXMuX291dHJlY0xpc3RbaV0pO1xyXG4gICAgICBpZiAoc3BsaXQgPT09IHVuZGVmaW5lZCB8fCBzcGxpdCA9PT0gb3V0cmVjIHx8IHNwbGl0LnJlY3Vyc2l2ZVNwbGl0ID09PSBvdXRyZWMpIGNvbnRpbnVlO1xyXG4gICAgICBzcGxpdC5yZWN1cnNpdmVTcGxpdCA9IG91dHJlYzsgLy8jNTk5XHJcbiAgICAgIGlmIChzcGxpdCEuc3BsaXRzICE9PSB1bmRlZmluZWQgJiYgdGhpcy5jaGVja1NwbGl0T3duZXIob3V0cmVjLCBzcGxpdC5zcGxpdHMpKSByZXR1cm4gdHJ1ZTtcclxuICAgICAgaWYgKENsaXBwZXJCYXNlLmlzVmFsaWRPd25lcihvdXRyZWMsIHNwbGl0KSAmJlxyXG4gICAgICAgIHRoaXMuY2hlY2tCb3VuZHMoc3BsaXQpICYmXHJcbiAgICAgICAgc3BsaXQuYm91bmRzLmNvbnRhaW5zUmVjdChvdXRyZWMuYm91bmRzKSAmJlxyXG4gICAgICAgIENsaXBwZXJCYXNlLnBhdGgxSW5zaWRlUGF0aDIob3V0cmVjLnB0cyEsIHNwbGl0LnB0cyEpKSB7XHJcbiAgICAgICAgb3V0cmVjLm93bmVyID0gc3BsaXQ7IC8vZm91bmQgaW4gc3BsaXRcclxuICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIGZhbHNlO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSByZWN1cnNpdmVDaGVja093bmVycyhvdXRyZWM6IE91dFJlYywgcG9seXBhdGg6IFBvbHlQYXRoQmFzZSk6IHZvaWQge1xyXG4gICAgLy8gcHJlLWNvbmRpdGlvbjogb3V0cmVjIHdpbGwgaGF2ZSB2YWxpZCBib3VuZHNcclxuICAgIC8vIHBvc3QtY29uZGl0aW9uOiBpZiBhIHZhbGlkIHBhdGgsIG91dHJlYyB3aWxsIGhhdmUgYSBwb2x5cGF0aFxyXG5cclxuICAgIGlmIChvdXRyZWMucG9seXBhdGggIT09IHVuZGVmaW5lZCB8fCBvdXRyZWMuYm91bmRzLmlzRW1wdHkoKSkgcmV0dXJuO1xyXG5cclxuICAgIHdoaWxlIChvdXRyZWMub3duZXIgIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICBpZiAob3V0cmVjLm93bmVyLnNwbGl0cyAhPT0gdW5kZWZpbmVkICYmXHJcbiAgICAgICAgdGhpcy5jaGVja1NwbGl0T3duZXIob3V0cmVjLCBvdXRyZWMub3duZXIuc3BsaXRzKSkgYnJlYWs7XHJcbiAgICAgIGVsc2UgaWYgKG91dHJlYy5vd25lci5wdHMgIT09IHVuZGVmaW5lZCAmJiB0aGlzLmNoZWNrQm91bmRzKG91dHJlYy5vd25lcikgJiZcclxuICAgICAgICBDbGlwcGVyQmFzZS5wYXRoMUluc2lkZVBhdGgyKG91dHJlYy5wdHMhLCBvdXRyZWMub3duZXIucHRzISkpIGJyZWFrO1xyXG4gICAgICBvdXRyZWMub3duZXIgPSBvdXRyZWMub3duZXIub3duZXI7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKG91dHJlYy5vd25lciAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgIGlmIChvdXRyZWMub3duZXIucG9seXBhdGggPT09IHVuZGVmaW5lZClcclxuICAgICAgICB0aGlzLnJlY3Vyc2l2ZUNoZWNrT3duZXJzKG91dHJlYy5vd25lciwgcG9seXBhdGgpO1xyXG4gICAgICBvdXRyZWMucG9seXBhdGggPSBvdXRyZWMub3duZXIucG9seXBhdGghLmFkZENoaWxkKG91dHJlYy5wYXRoKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIG91dHJlYy5wb2x5cGF0aCA9IHBvbHlwYXRoLmFkZENoaWxkKG91dHJlYy5wYXRoKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByb3RlY3RlZCBidWlsZFRyZWUocG9seXRyZWU6IFBvbHlQYXRoQmFzZSwgc29sdXRpb25PcGVuOiBQYXRoczY0KTogdm9pZCB7XHJcbiAgICBwb2x5dHJlZS5jbGVhcigpO1xyXG4gICAgc29sdXRpb25PcGVuLmxlbmd0aCA9IDBcclxuXHJcbiAgICBsZXQgaSA9IDA7XHJcbiAgICB3aGlsZSAoaSA8IHRoaXMuX291dHJlY0xpc3QubGVuZ3RoKSB7XHJcbiAgICAgIGNvbnN0IG91dHJlYzogT3V0UmVjID0gdGhpcy5fb3V0cmVjTGlzdFtpKytdO1xyXG4gICAgICBpZiAob3V0cmVjLnB0cyA9PT0gdW5kZWZpbmVkKSBjb250aW51ZTtcclxuXHJcbiAgICAgIGlmIChvdXRyZWMuaXNPcGVuKSB7XHJcbiAgICAgICAgY29uc3Qgb3Blbl9wYXRoID0gbmV3IFBhdGg2NCgpO1xyXG4gICAgICAgIGlmIChDbGlwcGVyQmFzZS5idWlsZFBhdGgob3V0cmVjLnB0cywgdGhpcy5yZXZlcnNlU29sdXRpb24sIHRydWUsIG9wZW5fcGF0aCkpXHJcbiAgICAgICAgICBzb2x1dGlvbk9wZW4ucHVzaChvcGVuX3BhdGgpO1xyXG4gICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICB9XHJcbiAgICAgIGlmICh0aGlzLmNoZWNrQm91bmRzKG91dHJlYykpXHJcbiAgICAgICAgdGhpcy5yZWN1cnNpdmVDaGVja093bmVycyhvdXRyZWMsIHBvbHl0cmVlKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHB1YmxpYyBnZXRCb3VuZHMoKTogUmVjdDY0IHtcclxuICAgIGNvbnN0IGJvdW5kcyA9IENsaXBwZXIuSW52YWxpZFJlY3Q2NDtcclxuICAgIGZvciAoY29uc3QgdCBvZiB0aGlzLl92ZXJ0ZXhMaXN0KSB7XHJcbiAgICAgIGxldCB2ID0gdDtcclxuICAgICAgZG8ge1xyXG4gICAgICAgIGlmICh2LnB0LnggPCBib3VuZHMubGVmdCkgYm91bmRzLmxlZnQgPSB2LnB0Lng7XHJcbiAgICAgICAgaWYgKHYucHQueCA+IGJvdW5kcy5yaWdodCkgYm91bmRzLnJpZ2h0ID0gdi5wdC54O1xyXG4gICAgICAgIGlmICh2LnB0LnkgPCBib3VuZHMudG9wKSBib3VuZHMudG9wID0gdi5wdC55O1xyXG4gICAgICAgIGlmICh2LnB0LnkgPiBib3VuZHMuYm90dG9tKSBib3VuZHMuYm90dG9tID0gdi5wdC55O1xyXG4gICAgICAgIHYgPSB2Lm5leHQhO1xyXG4gICAgICB9IHdoaWxlICh2ICE9PSB0KTtcclxuICAgIH1cclxuICAgIHJldHVybiBib3VuZHMuaXNFbXB0eSgpID8gbmV3IFJlY3Q2NCgwLCAwLCAwLCAwKSA6IGJvdW5kcztcclxuICB9XHJcblxyXG59XHJcblxyXG5cclxuZXhwb3J0IGNsYXNzIENsaXBwZXI2NCBleHRlbmRzIENsaXBwZXJCYXNlIHtcclxuXHJcbiAgb3ZlcnJpZGUgYWRkUGF0aChwYXRoOiBQYXRoNjQsIHBvbHl0eXBlOiBQYXRoVHlwZSwgaXNPcGVuOiBib29sZWFuID0gZmFsc2UpOiB2b2lkIHtcclxuICAgIHN1cGVyLmFkZFBhdGgocGF0aCwgcG9seXR5cGUsIGlzT3Blbik7XHJcbiAgfVxyXG5cclxuICBhZGRSZXVzYWJsZURhdGEocmV1c2FibGVEYXRhOiBSZXVzZWFibGVEYXRhQ29udGFpbmVyNjQpOiB2b2lkIHtcclxuICAgIHN1cGVyLmFkZFJldXNlYWJsZURhdGEocmV1c2FibGVEYXRhKTtcclxuICB9XHJcblxyXG4gIG92ZXJyaWRlIGFkZFBhdGhzKHBhdGhzOiBQYXRoczY0LCBwb2x5dHlwZTogUGF0aFR5cGUsIGlzT3BlbjogYm9vbGVhbiA9IGZhbHNlKTogdm9pZCB7XHJcbiAgICBzdXBlci5hZGRQYXRocyhwYXRocywgcG9seXR5cGUsIGlzT3Blbik7XHJcbiAgfVxyXG5cclxuICBhZGRTdWJqZWN0UGF0aHMocGF0aHM6IFBhdGhzNjQpOiB2b2lkIHtcclxuICAgIHRoaXMuYWRkUGF0aHMocGF0aHMsIFBhdGhUeXBlLlN1YmplY3QpO1xyXG4gIH1cclxuXHJcbiAgYWRkT3BlblN1YmplY3RQYXRocyhwYXRoczogUGF0aHM2NCk6IHZvaWQge1xyXG4gICAgdGhpcy5hZGRQYXRocyhwYXRocywgUGF0aFR5cGUuU3ViamVjdCwgdHJ1ZSk7XHJcbiAgfVxyXG5cclxuICBhZGRDbGlwUGF0aHMocGF0aHM6IFBhdGhzNjQpOiB2b2lkIHtcclxuICAgIHRoaXMuYWRkUGF0aHMocGF0aHMsIFBhdGhUeXBlLkNsaXApO1xyXG4gIH1cclxuXHJcbiAgZXhlY3V0ZShjbGlwVHlwZTogQ2xpcFR5cGUsIGZpbGxSdWxlOiBGaWxsUnVsZSwgc29sdXRpb25DbG9zZWQ6IFBhdGhzNjQsIHNvbHV0aW9uT3BlbiA9IG5ldyBQYXRoczY0KCkpOiBib29sZWFuIHtcclxuICAgIHNvbHV0aW9uQ2xvc2VkLmxlbmd0aCA9IDBcclxuICAgIHNvbHV0aW9uT3Blbi5sZW5ndGggPSAwXHJcbiAgICB0cnkge1xyXG4gICAgICB0aGlzLmV4ZWN1dGVJbnRlcm5hbChjbGlwVHlwZSwgZmlsbFJ1bGUpO1xyXG4gICAgICB0aGlzLmJ1aWxkUGF0aHMoc29sdXRpb25DbG9zZWQsIHNvbHV0aW9uT3Blbik7XHJcbiAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICB0aGlzLl9zdWNjZWVkZWQgPSBmYWxzZTtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLmNsZWFyU29sdXRpb25Pbmx5KCk7XHJcbiAgICByZXR1cm4gdGhpcy5fc3VjY2VlZGVkO1xyXG4gIH1cclxuXHJcblxyXG4gIGV4ZWN1dGVQb2x5VHJlZShjbGlwVHlwZTogQ2xpcFR5cGUsIGZpbGxSdWxlOiBGaWxsUnVsZSwgcG9seXRyZWU6IFBvbHlUcmVlNjQsIG9wZW5QYXRocyA9IG5ldyBQYXRoczY0KCkpOiBib29sZWFuIHtcclxuICAgIHBvbHl0cmVlLmNsZWFyKCk7XHJcbiAgICBvcGVuUGF0aHMubGVuZ3RoID0gMFxyXG4gICAgdGhpcy5fdXNpbmdfcG9seXRyZWUgPSB0cnVlO1xyXG4gICAgdHJ5IHtcclxuICAgICAgdGhpcy5leGVjdXRlSW50ZXJuYWwoY2xpcFR5cGUsIGZpbGxSdWxlKTtcclxuICAgICAgdGhpcy5idWlsZFRyZWUocG9seXRyZWUsIG9wZW5QYXRocyk7XHJcbiAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICB0aGlzLl9zdWNjZWVkZWQgPSBmYWxzZTtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLmNsZWFyU29sdXRpb25Pbmx5KCk7XHJcbiAgICByZXR1cm4gdGhpcy5fc3VjY2VlZGVkO1xyXG4gIH1cclxuXHJcbn1cclxuXHJcbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBQb2x5UGF0aEJhc2Uge1xyXG4gIHByb3RlY3RlZCBfcGFyZW50PzogUG9seVBhdGhCYXNlO1xyXG4gIGNoaWxkcmVuOiBBcnJheTxQb2x5UGF0aEJhc2U+ID0gW107XHJcbiAgcHVibGljIHBvbHlnb24/OiBQYXRoNjQ7XHJcblxyXG4gIGdldCBpc0hvbGUoKTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gdGhpcy5nZXRJc0hvbGUoKTtcclxuICB9XHJcblxyXG4gIGNvbnN0cnVjdG9yKHBhcmVudD86IFBvbHlQYXRoQmFzZSkge1xyXG4gICAgdGhpcy5fcGFyZW50ID0gcGFyZW50O1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBnZXRMZXZlbCgpOiBudW1iZXIge1xyXG4gICAgbGV0IHJlc3VsdCA9IDA7XHJcbiAgICBsZXQgcHA6IFBvbHlQYXRoQmFzZSB8IHVuZGVmaW5lZCA9IHRoaXMuX3BhcmVudDtcclxuICAgIHdoaWxlIChwcCAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICsrcmVzdWx0O1xyXG4gICAgICBwcCA9IHBwLl9wYXJlbnQ7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG4gIH1cclxuXHJcbiAgZ2V0IGxldmVsKCk6IG51bWJlciB7XHJcbiAgICByZXR1cm4gdGhpcy5nZXRMZXZlbCgpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBnZXRJc0hvbGUoKTogYm9vbGVhbiB7XHJcbiAgICBjb25zdCBsdmwgPSB0aGlzLmdldExldmVsKCk7XHJcbiAgICByZXR1cm4gbHZsICE9PSAwICYmIChsdmwgJiAxKSA9PT0gMDtcclxuICB9XHJcblxyXG4gIGdldCBjb3VudCgpOiBudW1iZXIge1xyXG4gICAgcmV0dXJuIHRoaXMuY2hpbGRyZW4ubGVuZ3RoO1xyXG4gIH1cclxuXHJcbiAgYWJzdHJhY3QgYWRkQ2hpbGQocDogUGF0aDY0KTogUG9seVBhdGhCYXNlO1xyXG5cclxuICBjbGVhcigpOiB2b2lkIHtcclxuICAgIHRoaXMuY2hpbGRyZW4ubGVuZ3RoID0gMFxyXG4gIH1cclxuXHJcbiAgZm9yRWFjaCA9IHRoaXMuY2hpbGRyZW4uZm9yRWFjaFxyXG5cclxufSAvLyBlbmQgb2YgUG9seVBhdGhCYXNlIGNsYXNzXHJcblxyXG5leHBvcnQgY2xhc3MgUG9seVBhdGg2NCBleHRlbmRzIFBvbHlQYXRoQmFzZSB7XHJcblxyXG4gIGNvbnN0cnVjdG9yKHBhcmVudD86IFBvbHlQYXRoQmFzZSkge1xyXG4gICAgc3VwZXIocGFyZW50KTtcclxuICB9XHJcblxyXG4gIGFkZENoaWxkKHA6IFBhdGg2NCk6IFBvbHlQYXRoQmFzZSB7XHJcbiAgICBjb25zdCBuZXdDaGlsZCA9IG5ldyBQb2x5UGF0aDY0KHRoaXMpO1xyXG4gICAgKG5ld0NoaWxkIGFzIFBvbHlQYXRoNjQpLnBvbHlnb24gPSBwO1xyXG4gICAgdGhpcy5jaGlsZHJlbi5wdXNoKG5ld0NoaWxkKTtcclxuICAgIHJldHVybiBuZXdDaGlsZDtcclxuICB9XHJcblxyXG4gIGdldChpbmRleDogbnVtYmVyKTogUG9seVBhdGg2NCB7XHJcbiAgICBpZiAoaW5kZXggPCAwIHx8IGluZGV4ID49IHRoaXMuY2hpbGRyZW4ubGVuZ3RoKSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkludmFsaWRPcGVyYXRpb25FeGNlcHRpb25cIik7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdGhpcy5jaGlsZHJlbltpbmRleF0gYXMgUG9seVBhdGg2NDtcclxuICB9XHJcblxyXG4gIGNoaWxkKGluZGV4OiBudW1iZXIpOiBQb2x5UGF0aDY0IHtcclxuICAgIGlmIChpbmRleCA8IDAgfHwgaW5kZXggPj0gdGhpcy5jaGlsZHJlbi5sZW5ndGgpIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSW52YWxpZE9wZXJhdGlvbkV4Y2VwdGlvblwiKTtcclxuICAgIH1cclxuICAgIHJldHVybiB0aGlzLmNoaWxkcmVuW2luZGV4XSBhcyBQb2x5UGF0aDY0O1xyXG4gIH1cclxuXHJcbiAgYXJlYSgpOiBudW1iZXIge1xyXG4gICAgbGV0IHJlc3VsdCA9IHRoaXMucG9seWdvbiA/IENsaXBwZXIuYXJlYSh0aGlzLnBvbHlnb24pIDogMDtcclxuICAgIGZvciAoY29uc3QgcG9seVBhdGhCYXNlIG9mIHRoaXMuY2hpbGRyZW4pIHtcclxuICAgICAgY29uc3QgY2hpbGQgPSBwb2x5UGF0aEJhc2UgYXMgUG9seVBhdGg2NDtcclxuICAgICAgcmVzdWx0ICs9IGNoaWxkLmFyZWEoKTtcclxuICAgIH1cclxuICAgIHJldHVybiByZXN1bHQ7XHJcbiAgfVxyXG59XHJcblxyXG5cclxuZXhwb3J0IGNsYXNzIFBvbHlUcmVlNjQgZXh0ZW5kcyBQb2x5UGF0aDY0IHsgfVxyXG5cclxuXHJcbmV4cG9ydCBjbGFzcyBDbGlwcGVyTGliRXhjZXB0aW9uIGV4dGVuZHMgRXJyb3Ige1xyXG4gIGNvbnN0cnVjdG9yKGRlc2NyaXB0aW9uOiBzdHJpbmcpIHtcclxuICAgIHN1cGVyKGRlc2NyaXB0aW9uKTtcclxuICB9XHJcbn1cclxuIl19