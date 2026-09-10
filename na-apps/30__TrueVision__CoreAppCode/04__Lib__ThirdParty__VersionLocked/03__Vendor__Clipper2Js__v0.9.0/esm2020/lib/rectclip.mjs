/*******************************************************************************
* Author    :  Angus Johnson                                                   *
* Date      :  6 August 2023                                                   *
* Website   :  http://www.angusj.com                                           *
* Copyright :  Angus Johnson 2010-2023                                         *
* Purpose   :  FAST rectangular clipping                                       *
* License   :  http://www.boost.org/LICENSE_1_0.txt                            *
*******************************************************************************/
//
// Converted from C# implemention https://github.com/AngusJohnson/Clipper2/blob/main/CSharp/Clipper2Lib/Clipper.Core.cs
// Removed support for USINGZ
//
// Converted by ChatGPT 4 August 3 version https://help.openai.com/en/articles/6825453-chatgpt-release-notes
//
import { Clipper } from "./clipper";
import { InternalClipper, Path64, Paths64, Point64 } from "./core";
import { PointInPolygonResult } from "./engine";
export class OutPt2 {
    constructor(pt) {
        this.pt = pt;
        this.ownerIdx = 0;
    }
}
var Location;
(function (Location) {
    Location[Location["left"] = 0] = "left";
    Location[Location["top"] = 1] = "top";
    Location[Location["right"] = 2] = "right";
    Location[Location["bottom"] = 3] = "bottom";
    Location[Location["inside"] = 4] = "inside";
})(Location || (Location = {}));
export class RectClip64 {
    constructor(rect) {
        this.currIdx = -1;
        this.rect = rect;
        this.mp = rect.midPoint();
        this.rectPath = rect.asPath();
        this.results = [];
        this.edges = Array(8).fill(undefined).map(() => []);
    }
    add(pt, startingNewPath = false) {
        let currIdx = this.results.length;
        let result;
        if (currIdx === 0 || startingNewPath) {
            result = new OutPt2(pt);
            this.results.push(result);
            result.ownerIdx = currIdx;
            result.prev = result;
            result.next = result;
        }
        else {
            currIdx--;
            const prevOp = this.results[currIdx];
            if (prevOp.pt === pt)
                return prevOp;
            result = new OutPt2(pt);
            result.ownerIdx = currIdx;
            result.next = prevOp.next;
            prevOp.next.prev = result;
            prevOp.next = result;
            result.prev = prevOp;
            this.results[currIdx] = result;
        }
        return result;
    }
    static path1ContainsPath2(path1, path2) {
        let ioCount = 0;
        for (const pt of path2) {
            const pip = InternalClipper.pointInPolygon(pt, path1);
            switch (pip) {
                case PointInPolygonResult.IsInside:
                    ioCount--;
                    break;
                case PointInPolygonResult.IsOutside:
                    ioCount++;
                    break;
            }
            if (Math.abs(ioCount) > 1)
                break;
        }
        return ioCount <= 0;
    }
    static isClockwise(prev, curr, prevPt, currPt, rectMidPoint) {
        if (this.areOpposites(prev, curr))
            return InternalClipper.crossProduct(prevPt, rectMidPoint, currPt) < 0;
        else
            return this.headingClockwise(prev, curr);
    }
    static areOpposites(prev, curr) {
        return Math.abs(prev - curr) === 2;
    }
    static headingClockwise(prev, curr) {
        return (prev + 1) % 4 === curr;
    }
    static getAdjacentLocation(loc, isClockwise) {
        const delta = isClockwise ? 1 : 3;
        return (loc + delta) % 4;
    }
    static unlinkOp(op) {
        if (op.next === op)
            return undefined;
        op.prev.next = op.next;
        op.next.prev = op.prev;
        return op.next;
    }
    static unlinkOpBack(op) {
        if (op.next === op)
            return undefined;
        op.prev.next = op.next;
        op.next.prev = op.prev;
        return op.prev;
    }
    static getEdgesForPt(pt, rec) {
        let result = 0;
        if (pt.x === rec.left)
            result = 1;
        else if (pt.x === rec.right)
            result = 4;
        if (pt.y === rec.top)
            result += 2;
        else if (pt.y === rec.bottom)
            result += 8;
        return result;
    }
    static isHeadingClockwise(pt1, pt2, edgeIdx) {
        switch (edgeIdx) {
            case 0: return pt2.y < pt1.y;
            case 1: return pt2.x > pt1.x;
            case 2: return pt2.y > pt1.y;
            default: return pt2.x < pt1.x;
        }
    }
    static hasHorzOverlap(left1, right1, left2, right2) {
        return (left1.x < right2.x) && (right1.x > left2.x);
    }
    static hasVertOverlap(top1, bottom1, top2, bottom2) {
        return (top1.y < bottom2.y) && (bottom1.y > top2.y);
    }
    static addToEdge(edge, op) {
        if (op.edge)
            return;
        op.edge = edge;
        edge.push(op);
    }
    static uncoupleEdge(op) {
        if (!op.edge)
            return;
        for (let i = 0; i < op.edge.length; i++) {
            const op2 = op.edge[i];
            if (op2 === op) {
                op.edge[i] = undefined;
                break;
            }
        }
        op.edge = undefined;
    }
    static setNewOwner(op, newIdx) {
        op.ownerIdx = newIdx;
        let op2 = op.next;
        while (op2 !== op) {
            op2.ownerIdx = newIdx;
            op2 = op2.next;
        }
    }
    addCorner(prev, curr) {
        if (RectClip64.headingClockwise(prev, curr))
            this.add(this.rectPath[prev]);
        else
            this.add(this.rectPath[curr]);
    }
    addCornerByRef(loc, isClockwise) {
        if (isClockwise) {
            this.add(this.rectPath[loc]);
            loc = RectClip64.getAdjacentLocation(loc, true);
        }
        else {
            loc = RectClip64.getAdjacentLocation(loc, false);
            this.add(this.rectPath[loc]);
        }
    }
    static getLocation(rec, pt) {
        let loc;
        if (pt.x === rec.left && pt.y >= rec.top && pt.y <= rec.bottom) {
            loc = Location.left; // pt on rec
            return { success: false, loc };
        }
        if (pt.x === rec.right && pt.y >= rec.top && pt.y <= rec.bottom) {
            loc = Location.right; // pt on rec
            return { success: false, loc };
        }
        if (pt.y === rec.top && pt.x >= rec.left && pt.x <= rec.right) {
            loc = Location.top; // pt on rec
            return { success: false, loc };
        }
        if (pt.y === rec.bottom && pt.x >= rec.left && pt.x <= rec.right) {
            loc = Location.bottom; // pt on rec
            return { success: false, loc };
        }
        if (pt.x < rec.left)
            loc = Location.left;
        else if (pt.x > rec.right)
            loc = Location.right;
        else if (pt.y < rec.top)
            loc = Location.top;
        else if (pt.y > rec.bottom)
            loc = Location.bottom;
        else
            loc = Location.inside;
        return { success: true, loc };
    }
    static getIntersection(rectPath, p, p2, loc) {
        // gets the pt of intersection between rectPath and segment(p, p2) that's closest to 'p'
        // when result == false, loc will remain unchanged
        let ip = new Point64();
        switch (loc) {
            case Location.left:
                if (InternalClipper.segsIntersect(p, p2, rectPath[0], rectPath[3], true)) {
                    ip = InternalClipper.getIntersectPt(p, p2, rectPath[0], rectPath[3]).ip;
                }
                else if (p.y < rectPath[0].y && InternalClipper.segsIntersect(p, p2, rectPath[0], rectPath[1], true)) {
                    ip = InternalClipper.getIntersectPt(p, p2, rectPath[0], rectPath[1]).ip;
                    loc = Location.top;
                }
                else if (InternalClipper.segsIntersect(p, p2, rectPath[2], rectPath[3], true)) {
                    ip = InternalClipper.getIntersectPt(p, p2, rectPath[2], rectPath[3]).ip;
                    loc = Location.bottom;
                }
                else {
                    return { success: false, loc, ip };
                }
                break;
            case Location.right:
                if (InternalClipper.segsIntersect(p, p2, rectPath[1], rectPath[2], true)) {
                    ip = InternalClipper.getIntersectPt(p, p2, rectPath[1], rectPath[2]).ip;
                }
                else if (p.y < rectPath[0].y && InternalClipper.segsIntersect(p, p2, rectPath[0], rectPath[1], true)) {
                    ip = InternalClipper.getIntersectPt(p, p2, rectPath[0], rectPath[1]).ip;
                    loc = Location.top;
                }
                else if (InternalClipper.segsIntersect(p, p2, rectPath[2], rectPath[3], true)) {
                    ip = InternalClipper.getIntersectPt(p, p2, rectPath[2], rectPath[3]).ip;
                    loc = Location.bottom;
                }
                else {
                    return { success: false, loc, ip };
                }
                break;
            case Location.top:
                if (InternalClipper.segsIntersect(p, p2, rectPath[0], rectPath[1], true)) {
                    ip = InternalClipper.getIntersectPt(p, p2, rectPath[0], rectPath[1]).ip;
                }
                else if (p.x < rectPath[0].x && InternalClipper.segsIntersect(p, p2, rectPath[0], rectPath[3], true)) {
                    ip = InternalClipper.getIntersectPt(p, p2, rectPath[0], rectPath[3]).ip;
                    loc = Location.left;
                }
                else if (p.x > rectPath[1].x && InternalClipper.segsIntersect(p, p2, rectPath[1], rectPath[2], true)) {
                    ip = InternalClipper.getIntersectPt(p, p2, rectPath[1], rectPath[2]).ip;
                    loc = Location.right;
                }
                else {
                    return { success: false, loc, ip };
                }
                break;
            case Location.bottom:
                if (InternalClipper.segsIntersect(p, p2, rectPath[2], rectPath[3], true)) {
                    ip = InternalClipper.getIntersectPt(p, p2, rectPath[2], rectPath[3]).ip;
                }
                else if (p.x < rectPath[3].x && InternalClipper.segsIntersect(p, p2, rectPath[0], rectPath[3], true)) {
                    ip = InternalClipper.getIntersectPt(p, p2, rectPath[0], rectPath[3]).ip;
                    loc = Location.left;
                }
                else if (p.x > rectPath[2].x && InternalClipper.segsIntersect(p, p2, rectPath[1], rectPath[2], true)) {
                    ip = InternalClipper.getIntersectPt(p, p2, rectPath[1], rectPath[2]).ip;
                    loc = Location.right;
                }
                else {
                    return { success: false, loc, ip };
                }
                break;
            case Location.inside:
                if (InternalClipper.segsIntersect(p, p2, rectPath[0], rectPath[3], true)) {
                    ip = InternalClipper.getIntersectPt(p, p2, rectPath[0], rectPath[3]).ip;
                    loc = Location.left;
                }
                else if (InternalClipper.segsIntersect(p, p2, rectPath[0], rectPath[1], true)) {
                    ip = InternalClipper.getIntersectPt(p, p2, rectPath[0], rectPath[1]).ip;
                    loc = Location.top;
                }
                else if (InternalClipper.segsIntersect(p, p2, rectPath[1], rectPath[2], true)) {
                    ip = InternalClipper.getIntersectPt(p, p2, rectPath[1], rectPath[2]).ip;
                    loc = Location.right;
                }
                else if (InternalClipper.segsIntersect(p, p2, rectPath[2], rectPath[3], true)) {
                    ip = InternalClipper.getIntersectPt(p, p2, rectPath[2], rectPath[3]).ip;
                    loc = Location.bottom;
                }
                else {
                    return { success: false, loc, ip };
                }
                break;
        }
        return { success: true, loc, ip };
    }
    getNextLocation(path, context) {
        switch (context.loc) {
            case Location.left:
                while (context.i <= context.highI && path[context.i].x <= this.rect.left)
                    context.i++;
                if (context.i > context.highI)
                    break;
                if (path[context.i].x >= this.rect.right)
                    context.loc = Location.right;
                else if (path[context.i].y <= this.rect.top)
                    context.loc = Location.top;
                else if (path[context.i].y >= this.rect.bottom)
                    context.loc = Location.bottom;
                else
                    context.loc = Location.inside;
                break;
            case Location.top:
                while (context.i <= context.highI && path[context.i].y <= this.rect.top)
                    context.i++;
                if (context.i > context.highI)
                    break;
                if (path[context.i].y >= this.rect.bottom)
                    context.loc = Location.bottom;
                else if (path[context.i].x <= this.rect.left)
                    context.loc = Location.left;
                else if (path[context.i].x >= this.rect.right)
                    context.loc = Location.right;
                else
                    context.loc = Location.inside;
                break;
            case Location.right:
                while (context.i <= context.highI && path[context.i].x >= this.rect.right)
                    context.i++;
                if (context.i > context.highI)
                    break;
                if (path[context.i].x <= this.rect.left)
                    context.loc = Location.left;
                else if (path[context.i].y <= this.rect.top)
                    context.loc = Location.top;
                else if (path[context.i].y >= this.rect.bottom)
                    context.loc = Location.bottom;
                else
                    context.loc = Location.inside;
                break;
            case Location.bottom:
                while (context.i <= context.highI && path[context.i].y >= this.rect.bottom)
                    context.i++;
                if (context.i > context.highI)
                    break;
                if (path[context.i].y <= this.rect.top)
                    context.loc = Location.top;
                else if (path[context.i].x <= this.rect.left)
                    context.loc = Location.left;
                else if (path[context.i].x >= this.rect.right)
                    context.loc = Location.right;
                else
                    context.loc = Location.inside;
                break;
            case Location.inside:
                while (context.i <= context.highI) {
                    if (path[context.i].x < this.rect.left)
                        context.loc = Location.left;
                    else if (path[context.i].x > this.rect.right)
                        context.loc = Location.right;
                    else if (path[context.i].y > this.rect.bottom)
                        context.loc = Location.bottom;
                    else if (path[context.i].y < this.rect.top)
                        context.loc = Location.top;
                    else {
                        this.add(path[context.i]);
                        context.i++;
                        continue;
                    }
                    break;
                }
                break;
        }
    }
    executeInternal(path) {
        if (path.length < 3 || this.rect.isEmpty())
            return;
        const startLocs = [];
        let firstCross = Location.inside;
        let crossingLoc = firstCross, prev = firstCross;
        let i;
        const highI = path.length - 1;
        let result = RectClip64.getLocation(this.rect, path[highI]);
        let loc = result.loc;
        if (!result.success) {
            i = highI - 1;
            while (i >= 0 && !result.success) {
                i--;
                result = RectClip64.getLocation(this.rect, path[i]);
                prev = result.loc;
            }
            if (i < 0) {
                for (const pt of path) {
                    this.add(pt);
                }
                return;
            }
            if (prev == Location.inside)
                loc = Location.inside;
        }
        const startingLoc = loc;
        ///////////////////////////////////////////////////
        i = 0;
        while (i <= highI) {
            prev = loc;
            const prevCrossLoc = crossingLoc;
            this.getNextLocation(path, { loc, i, highI });
            if (i > highI)
                break;
            const prevPt = (i == 0) ? path[highI] : path[i - 1];
            crossingLoc = loc;
            let result = RectClip64.getIntersection(this.rectPath, path[i], prevPt, crossingLoc);
            const ip = result.ip;
            if (!result.success) {
                if (prevCrossLoc == Location.inside) {
                    const isClockw = RectClip64.isClockwise(prev, loc, prevPt, path[i], this.mp);
                    do {
                        startLocs.push(prev);
                        prev = RectClip64.getAdjacentLocation(prev, isClockw);
                    } while (prev != loc);
                    crossingLoc = prevCrossLoc;
                }
                else if (prev != Location.inside && prev != loc) {
                    const isClockw = RectClip64.isClockwise(prev, loc, prevPt, path[i], this.mp);
                    do {
                        this.addCornerByRef(prev, isClockw);
                    } while (prev != loc);
                }
                ++i;
                continue;
            }
            ////////////////////////////////////////////////////
            // we must be crossing the rect boundary to get here
            ////////////////////////////////////////////////////
            if (loc == Location.inside) {
                if (firstCross == Location.inside) {
                    firstCross = crossingLoc;
                    startLocs.push(prev);
                }
                else if (prev != crossingLoc) {
                    const isClockw = RectClip64.isClockwise(prev, crossingLoc, prevPt, path[i], this.mp);
                    do {
                        this.addCornerByRef(prev, isClockw);
                    } while (prev != crossingLoc);
                }
            }
            else if (prev != Location.inside) {
                // passing right through rect. 'ip' here will be the second
                // intersect pt but we'll also need the first intersect pt (ip2)
                loc = prev;
                result = RectClip64.getIntersection(this.rectPath, prevPt, path[i], loc);
                const ip2 = result.ip;
                if (prevCrossLoc != Location.inside && prevCrossLoc != loc)
                    this.addCorner(prevCrossLoc, loc);
                if (firstCross == Location.inside) {
                    firstCross = loc;
                    startLocs.push(prev);
                }
                loc = crossingLoc;
                this.add(ip2);
                if (ip == ip2) {
                    loc = RectClip64.getLocation(this.rect, path[i]).loc;
                    this.addCorner(crossingLoc, loc);
                    crossingLoc = loc;
                    continue;
                }
            }
            else {
                loc = crossingLoc;
                if (firstCross == Location.inside)
                    firstCross = crossingLoc;
            }
            this.add(ip);
        } //while i <= highI
        ///////////////////////////////////////////////////
        if (firstCross == Location.inside) {
            if (startingLoc != Location.inside) {
                if (this.pathBounds.containsRect(this.rect) && RectClip64.path1ContainsPath2(path, this.rectPath)) {
                    for (let j = 0; j < 4; j++) {
                        this.add(this.rectPath[j]);
                        RectClip64.addToEdge(this.edges[j * 2], this.results[0]);
                    }
                }
            }
        }
        else if (loc != Location.inside && (loc != firstCross || startLocs.length > 2)) {
            if (startLocs.length > 0) {
                prev = loc;
                for (const loc2 of startLocs) {
                    if (prev == loc2)
                        continue;
                    this.addCornerByRef(prev, RectClip64.headingClockwise(prev, loc2));
                    prev = loc2;
                }
                loc = prev;
            }
            if (loc != firstCross)
                this.addCornerByRef(loc, RectClip64.headingClockwise(loc, firstCross));
        }
    }
    execute(paths) {
        const result = [];
        if (this.rect.isEmpty())
            return result;
        for (const path of paths) {
            if (path.length < 3)
                continue;
            this.pathBounds = Clipper.getBounds(path);
            if (!this.rect.intersects(this.pathBounds))
                continue;
            else if (this.rect.containsRect(this.pathBounds)) {
                result.push(path);
                continue;
            }
            this.executeInternal(path);
            this.checkEdges();
            for (let i = 0; i < 4; ++i)
                this.tidyEdgePair(i, this.edges[i * 2], this.edges[i * 2 + 1]);
            for (const op of this.results) {
                const tmp = this.getPath(op);
                if (tmp.length > 0)
                    result.push(tmp);
            }
            this.results.length = 0;
            for (let i = 0; i < 8; i++)
                this.edges[i].length = 0;
        }
        return result;
    }
    checkEdges() {
        for (let i = 0; i < this.results.length; i++) {
            let op = this.results[i];
            let op2 = op;
            if (op === undefined)
                continue;
            do {
                if (InternalClipper.crossProduct(op2.prev.pt, op2.pt, op2.next.pt) === 0) {
                    if (op2 === op) {
                        op2 = RectClip64.unlinkOpBack(op2);
                        if (op2 === undefined)
                            break;
                        op = op2.prev;
                    }
                    else {
                        op2 = RectClip64.unlinkOpBack(op2);
                        if (op2 === undefined)
                            break;
                    }
                }
                else {
                    op2 = op2.next;
                }
            } while (op2 !== op);
            if (op2 === undefined) {
                this.results[i] = undefined;
                continue;
            }
            this.results[i] = op2;
            let edgeSet1 = RectClip64.getEdgesForPt(op.prev.pt, this.rect);
            op2 = op;
            do {
                const edgeSet2 = RectClip64.getEdgesForPt(op2.pt, this.rect);
                if (edgeSet2 !== 0 && op2.edge === undefined) {
                    const combinedSet = (edgeSet1 & edgeSet2);
                    for (let j = 0; j < 4; ++j) {
                        if ((combinedSet & (1 << j)) !== 0) {
                            if (RectClip64.isHeadingClockwise(op2.prev.pt, op2.pt, j))
                                RectClip64.addToEdge(this.edges[j * 2], op2);
                            else
                                RectClip64.addToEdge(this.edges[j * 2 + 1], op2);
                        }
                    }
                }
                edgeSet1 = edgeSet2;
                op2 = op2.next;
            } while (op2 !== op);
        }
    }
    tidyEdgePair(idx, cw, ccw) {
        if (ccw.length === 0)
            return;
        const isHorz = (idx === 1 || idx === 3);
        const cwIsTowardLarger = (idx === 1 || idx === 2);
        let i = 0, j = 0;
        let p1, p2, p1a, p2a, op, op2;
        while (i < cw.length) {
            p1 = cw[i];
            if (!p1 || p1.next === p1.prev) {
                cw[i++] = undefined;
                j = 0;
                continue;
            }
            const jLim = ccw.length;
            while (j < jLim && (!ccw[j] || ccw[j].next === ccw[j].prev))
                ++j;
            if (j === jLim) {
                ++i;
                j = 0;
                continue;
            }
            if (cwIsTowardLarger) {
                p1 = cw[i].prev;
                p1a = cw[i];
                p2 = ccw[j];
                p2a = ccw[j].prev;
            }
            else {
                p1 = cw[i];
                p1a = cw[i].prev;
                p2 = ccw[j].prev;
                p2a = ccw[j];
            }
            if ((isHorz && !RectClip64.hasHorzOverlap(p1.pt, p1a.pt, p2.pt, p2a.pt)) ||
                (!isHorz && !RectClip64.hasVertOverlap(p1.pt, p1a.pt, p2.pt, p2a.pt))) {
                ++j;
                continue;
            }
            const isRejoining = cw[i].ownerIdx !== ccw[j].ownerIdx;
            if (isRejoining) {
                this.results[p2.ownerIdx] = undefined;
                RectClip64.setNewOwner(p2, p1.ownerIdx);
            }
            if (cwIsTowardLarger) {
                // p1 >> | >> p1a;
                // p2 << | << p2a;
                p1.next = p2;
                p2.prev = p1;
                p1a.prev = p2a;
                p2a.next = p1a;
            }
            else {
                // p1 << | << p1a;
                // p2 >> | >> p2a;
                p1.prev = p2;
                p2.next = p1;
                p1a.next = p2a;
                p2a.prev = p1a;
            }
            if (!isRejoining) {
                const new_idx = this.results.length;
                this.results.push(p1a);
                RectClip64.setNewOwner(p1a, new_idx);
            }
            if (cwIsTowardLarger) {
                op = p2;
                op2 = p1a;
            }
            else {
                op = p1;
                op2 = p2a;
            }
            this.results[op.ownerIdx] = op;
            this.results[op2.ownerIdx] = op2;
            // and now lots of work to get ready for the next loop
            let opIsLarger, op2IsLarger;
            if (isHorz) { // X
                opIsLarger = op.pt.x > op.prev.pt.x;
                op2IsLarger = op2.pt.x > op2.prev.pt.x;
            }
            else { // Y
                opIsLarger = op.pt.y > op.prev.pt.y;
                op2IsLarger = op2.pt.y > op2.prev.pt.y;
            }
            if ((op.next === op.prev) || (op.pt === op.prev.pt)) {
                if (op2IsLarger === cwIsTowardLarger) {
                    cw[i] = op2;
                    ccw[j++] = undefined;
                }
                else {
                    ccw[j] = op2;
                    cw[i++] = undefined;
                }
            }
            else if ((op2.next === op2.prev) || (op2.pt === op2.prev.pt)) {
                if (opIsLarger === cwIsTowardLarger) {
                    cw[i] = op;
                    ccw[j++] = undefined;
                }
                else {
                    ccw[j] = op;
                    cw[i++] = undefined;
                }
            }
            else if (opIsLarger === op2IsLarger) {
                if (opIsLarger === cwIsTowardLarger) {
                    cw[i] = op;
                    RectClip64.uncoupleEdge(op2);
                    RectClip64.addToEdge(cw, op2);
                    ccw[j++] = undefined;
                }
                else {
                    cw[i++] = undefined;
                    ccw[j] = op2;
                    RectClip64.uncoupleEdge(op);
                    RectClip64.addToEdge(ccw, op);
                    j = 0;
                }
            }
            else {
                if (opIsLarger === cwIsTowardLarger)
                    cw[i] = op;
                else
                    ccw[j] = op;
                if (op2IsLarger === cwIsTowardLarger)
                    cw[i] = op2;
                else
                    ccw[j] = op2;
            }
        }
    }
    getPath(op) {
        const result = new Path64();
        if (!op || op.prev === op.next)
            return result;
        let op2 = op.next;
        while (op2 && op2 !== op) {
            if (InternalClipper.crossProduct(op2.prev.pt, op2.pt, op2.next.pt) === 0) {
                op = op2.prev;
                op2 = RectClip64.unlinkOp(op2);
            }
            else {
                op2 = op2.next;
            }
        }
        if (!op2)
            return new Path64();
        result.push(op.pt);
        op2 = op.next;
        while (op2 !== op) {
            result.push(op2.pt);
            op2 = op2.next;
        }
        return result;
    }
}
export class RectClipLines64 extends RectClip64 {
    constructor(rect) {
        super(rect);
    }
    execute(paths) {
        const result = new Paths64();
        if (this.rect.isEmpty())
            return result;
        for (const path of paths) {
            if (path.length < 2)
                continue;
            this.pathBounds = Clipper.getBounds(path);
            if (!this.rect.intersects(this.pathBounds))
                continue;
            this.executeInternal(path);
            for (const op of this.results) {
                const tmp = this.getPath(op);
                if (tmp.length > 0)
                    result.push(tmp);
            }
            // Clean up after every loop
            this.results.length = 0; // Clear the array
            for (let i = 0; i < 8; i++) {
                this.edges[i].length = 0; // Clear each array
            }
        }
        return result;
    }
    getPath(op) {
        const result = new Path64();
        if (!op || op === op.next)
            return result;
        op = op.next; // starting at path beginning 
        result.push(op.pt);
        let op2 = op.next;
        while (op2 !== op) {
            result.push(op2.pt);
            op2 = op2.next;
        }
        return result;
    }
    executeInternal(path) {
        this.results = [];
        if (path.length < 2 || this.rect.isEmpty())
            return;
        let prev = Location.inside;
        let i = 1;
        const highI = path.length - 1;
        let result = RectClipLines64.getLocation(this.rect, path[0]);
        let loc = result.loc;
        if (!result.success) {
            while (i <= highI && !result.success) {
                i++;
                result = RectClipLines64.getLocation(this.rect, path[i]);
                prev = result.loc;
            }
            if (i > highI) {
                for (const pt of path)
                    this.add(pt);
            }
            if (prev == Location.inside)
                loc = Location.inside;
            i = 1;
        }
        if (loc == Location.inside)
            this.add(path[0]);
        while (i <= highI) {
            prev = loc;
            this.getNextLocation(path, { loc, i, highI });
            if (i > highI)
                break;
            const prevPt = path[i - 1];
            let crossingLoc = loc;
            let result = RectClipLines64.getIntersection(this.rectPath, path[i], prevPt, crossingLoc);
            const ip = result.ip;
            crossingLoc = result.loc;
            if (!result.success) {
                i++;
                continue;
            }
            if (loc == Location.inside) {
                this.add(ip, true);
            }
            else if (prev !== Location.inside) {
                crossingLoc = prev;
                result = RectClipLines64.getIntersection(this.rectPath, prevPt, path[i], crossingLoc);
                const ip2 = result.ip;
                crossingLoc = result.loc;
                this.add(ip2);
                this.add(ip);
            }
            else {
                this.add(ip);
            }
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVjdGNsaXAuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9wcm9qZWN0cy9jbGlwcGVyMi1qcy9zcmMvbGliL3JlY3RjbGlwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7O2dGQU9nRjtBQUVoRixFQUFFO0FBQ0YsdUhBQXVIO0FBQ3ZILDZCQUE2QjtBQUM3QixFQUFFO0FBQ0YsNEdBQTRHO0FBQzVHLEVBQUU7QUFFRixPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sV0FBVyxDQUFDO0FBQ3BDLE9BQU8sRUFBWSxlQUFlLEVBQUUsTUFBTSxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQVUsTUFBTSxRQUFRLENBQUM7QUFDckYsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRWhELE1BQU0sT0FBTyxNQUFNO0lBUWpCLFlBQVksRUFBWTtRQUN0QixJQUFJLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQztRQUNiLElBQUksQ0FBQyxRQUFRLEdBQUcsQ0FBQyxDQUFBO0lBQ25CLENBQUM7Q0FDRjtBQUVELElBQUssUUFFSjtBQUZELFdBQUssUUFBUTtJQUNYLHVDQUFJLENBQUE7SUFBRSxxQ0FBRyxDQUFBO0lBQUUseUNBQUssQ0FBQTtJQUFFLDJDQUFNLENBQUE7SUFBRSwyQ0FBTSxDQUFBO0FBQ2xDLENBQUMsRUFGSSxRQUFRLEtBQVIsUUFBUSxRQUVaO0FBRUQsTUFBTSxPQUFPLFVBQVU7SUFTckIsWUFBWSxJQUFZO1FBRmQsWUFBTyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBR3JCLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO1FBQ2pCLElBQUksQ0FBQyxFQUFFLEdBQUcsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBQzFCLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1FBQzlCLElBQUksQ0FBQyxPQUFPLEdBQUcsRUFBRSxDQUFDO1FBQ2xCLElB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QyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztvQkFDeEUsR0FBRyxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUM7aUJBQ3JCO3FCQUFNLElBQUksZUFBZSxDQUFDLGFBQWEsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUMsRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLEVBQUU7b0JBQy9FLEVBQUUsR0FBRyxlQUFlLENBQUMsY0FBYyxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztvQkFDeEUsR0FBRyxHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUM7aUJBQ3BCO3FCQUFNLElBQUksZUFBZSxDQUFDLGFBQWEsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUMsRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLEVBQUU7b0JBQy9FLEVBQUUsR0FBRyxlQUFlLENBQUMsY0FBYyxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztvQkFDeEUsR0FBRyxHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQUM7aUJBQ3RCO3FCQUFNLElBQUksZUFBZSxDQUFDLGFBQWEsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUMsRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLEVBQUU7b0JBQy9FLEVBQUUsR0FBRyxlQUFlLENBQUMsY0FBYyxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztvQkFDeEUsR0FBRyxHQUFHLFFBQVEs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QUMsRUFBRSxDQUFDLENBQUM7YUFDZDtpQkFBTTtnQkFDTCxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDO2FBQ2Q7U0FDRjtJQUNILENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbIi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXHJcbiogQXV0aG9yICAgIDogIEFuZ3VzIEpvaG5zb24gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXHJcbiogRGF0ZSAgICAgIDogIDYgQXVndXN0IDIwMjMgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXHJcbiogV2Vic2l0ZSAgIDogIGh0dHA6Ly93d3cuYW5ndXNqLmNvbSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXHJcbiogQ29weXJpZ2h0IDogIEFuZ3VzIEpvaG5zb24gMjAxMC0yMDIzICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXHJcbiogUHVycG9zZSAgIDogIEZBU1QgcmVjdGFuZ3VsYXIgY2xpcHBpbmcgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXHJcbiogTGljZW5zZSAgIDogIGh0dHA6Ly93d3cuYm9vc3Qub3JnL0xJQ0VOU0VfMV8wLnR4dCAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXHJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXHJcblxyXG4vL1xyXG4vLyBDb252ZXJ0ZWQgZnJvbSBDIyBpbXBsZW1lbnRpb24gaHR0cHM6Ly9naXRodWIuY29tL0FuZ3VzSm9obnNvbi9DbGlwcGVyMi9ibG9iL21haW4vQ1NoYXJwL0NsaXBwZXIyTGliL0NsaXBwZXIuQ29yZS5jc1xyXG4vLyBSZW1vdmVkIHN1cHBvcnQgZm9yIFVTSU5HWlxyXG4vL1xyXG4vLyBDb252ZXJ0ZWQgYnkgQ2hhdEdQVCA0IEF1Z3VzdCAzIHZlcnNpb24gaHR0cHM6Ly9oZWxwLm9wZW5haS5jb20vZW4vYXJ0aWNsZXMvNjgyNTQ1My1jaGF0Z3B0LXJlbGVhc2Utbm90ZXNcclxuLy9cclxuXHJcbmltcG9ydCB7IENsaXBwZXIgfSBmcm9tIFwiLi9jbGlwcGVyXCI7XHJcbmltcG9ydCB7IElQb2ludDY0LCBJbnRlcm5hbENsaXBwZXIsIFBhdGg2NCwgUGF0aHM2NCwgUG9pbnQ2NCwgUmVjdDY0IH0gZnJvbSBcIi4vY29yZVwiO1xyXG5pbXBvcnQgeyBQb2ludEluUG9seWdvblJlc3VsdCB9IGZyb20gXCIuL2VuZ2luZVwiO1xyXG5cclxuZXhwb3J0IGNsYXNzIE91dFB0MiB7XHJcbiAgbmV4dD86IE91dFB0MjtcclxuICBwcmV2PzogT3V0UHQyO1xyXG5cclxuICBwdDogSVBvaW50NjQ7XHJcbiAgb3duZXJJZHg6IG51bWJlcjtcclxuICBlZGdlPzogQXJyYXk8T3V0UHQyIHwgdW5kZWZpbmVkPjtcclxuXHJcbiAgY29uc3RydWN0b3IocHQ6IElQb2ludDY0KSB7XHJcbiAgICB0aGlzLnB0ID0gcHQ7XHJcbiAgICB0aGlzLm93bmVySWR4ID0gMFxyXG4gIH1cclxufVxyXG5cclxuZW51bSBMb2NhdGlvbiB7XHJcbiAgbGVmdCwgdG9wLCByaWdodCwgYm90dG9tLCBpbnNpZGVcclxufVxyXG5cclxuZXhwb3J0IGNsYXNzIFJlY3RDbGlwNjQge1xyXG4gIHByb3RlY3RlZCByZWN0OiBSZWN0NjQ7XHJcbiAgcHJvdGVjdGVkIG1wOiBQb2ludDY0O1xyXG4gIHByb3RlY3RlZCByZWN0UGF0aDogUGF0aDY0O1xyXG4gIHByb3RlY3RlZCBwYXRoQm91bmRzITogUmVjdDY0O1xyXG4gIHByb3RlY3RlZCByZXN1bHRzOiBBcnJheTxPdXRQdDIgfCB1bmRlZmluZWQ+XHJcbiAgcHJvdGVjdGVkIGVkZ2VzOiBBcnJheTxPdXRQdDIgfCB1bmRlZmluZWQ+W107XHJcbiAgcHJvdGVjdGVkIGN1cnJJZHggPSAtMTtcclxuXHJcbiAgY29uc3RydWN0b3IocmVjdDogUmVjdDY0KSB7XHJcbiAgICB0aGlzLnJlY3QgPSByZWN0O1xyXG4gICAgdGhpcy5tcCA9IHJlY3QubWlkUG9pbnQoKTtcclxuICAgIHRoaXMucmVjdFBhdGggPSByZWN0LmFzUGF0aCgpO1xyXG4gICAgdGhpcy5yZXN1bHRzID0gW107XHJcbiAgICB0aGlzLmVkZ2VzID0gQXJyYXkoOCkuZmlsbCh1bmRlZmluZWQpLm1hcCgoKSA9PiBbXSk7XHJcbiAgfVxyXG5cclxuICBwcm90ZWN0ZWQgYWRkKHB0OiBJUG9pbnQ2NCwgc3RhcnRpbmdOZXdQYXRoOiBib29sZWFuID0gZmFsc2UpOiBPdXRQdDIgIHtcclxuICAgIGxldCBjdXJySWR4ID0gdGhpcy5yZXN1bHRzLmxlbmd0aDtcclxuICAgIGxldCByZXN1bHQ6IE91dFB0MjtcclxuICAgIGlmIChjdXJySWR4ID09PSAwIHx8IHN0YXJ0aW5nTmV3UGF0aCkge1xyXG4gICAgICByZXN1bHQgPSBuZXcgT3V0UHQyKHB0KTtcclxuICAgICAgdGhpcy5yZXN1bHRzLnB1c2gocmVzdWx0KTtcclxuICAgICAgcmVzdWx0Lm93bmVySWR4ID0gY3VycklkeDtcclxuICAgICAgcmVzdWx0LnByZXYgPSByZXN1bHQ7XHJcbiAgICAgIHJlc3VsdC5uZXh0ID0gcmVzdWx0O1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgY3VycklkeC0tO1xyXG4gICAgICBjb25zdCBwcmV2T3AgPSB0aGlzLnJlc3VsdHNbY3VycklkeF07XHJcbiAgICAgIGlmIChwcmV2T3AhLnB0ID09PSBwdCkgcmV0dXJuIHByZXZPcCE7XHJcbiAgICAgIHJlc3VsdCA9IG5ldyBPdXRQdDIocHQpO1xyXG4gICAgICByZXN1bHQub3duZXJJZHggPSBjdXJySWR4O1xyXG4gICAgICByZXN1bHQubmV4dCA9IHByZXZPcCEubmV4dDtcclxuICAgICAgcHJldk9wIS5uZXh0IS5wcmV2ID0gcmVzdWx0O1xyXG4gICAgICBwcmV2T3AhLm5leHQgPSByZXN1bHQ7XHJcbiAgICAgIHJlc3VsdC5wcmV2ID0gcHJldk9wITtcclxuICAgICAgdGhpcy5yZXN1bHRzW2N1cnJJZHhdID0gcmVzdWx0O1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHJlc3VsdDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgc3RhdGljIHBhdGgxQ29udGFpbnNQYXRoMihwYXRoMTogUGF0aDY0LCBwYXRoMjogUGF0aDY0KTogYm9vbGVhbiB7XHJcbiAgICBsZXQgaW9Db3VudCA9IDA7XHJcbiAgICBmb3IgKGNvbnN0IHB0IG9mIHBhdGgyKSB7XHJcbiAgICAgIGNvbnN0IHBpcCA9IEludGVybmFsQ2xpcHBlci5wb2ludEluUG9seWdvbihwdCwgcGF0aDEpO1xyXG4gICAgICBzd2l0Y2ggKHBpcCkge1xyXG4gICAgICAgIGNhc2UgUG9pbnRJblBvbHlnb25SZXN1bHQuSXNJbnNpZGU6XHJcbiAgICAgICAgICBpb0NvdW50LS07IGJyZWFrO1xyXG4gICAgICAgIGNhc2UgUG9pbnRJblBvbHlnb25SZXN1bHQuSXNPdXRzaWRlOlxyXG4gICAgICAgICAgaW9Db3VudCsrOyBicmVhaztcclxuICAgICAgfVxyXG4gICAgICBpZiAoTWF0aC5hYnMoaW9Db3VudCkgPiAxKSBicmVhaztcclxuICAgIH1cclxuICAgIHJldHVybiBpb0NvdW50IDw9IDA7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHN0YXRpYyBpc0Nsb2Nrd2lzZShwcmV2OiBMb2NhdGlvbiwgY3VycjogTG9jYXRpb24sIHByZXZQdDogSVBvaW50NjQsIGN1cnJQdDogSVBvaW50NjQsIHJlY3RNaWRQb2ludDogUG9pbnQ2NCk6IGJvb2xlYW4ge1xyXG4gICAgaWYgKHRoaXMuYXJlT3Bwb3NpdGVzKHByZXYsIGN1cnIpKVxyXG4gICAgICByZXR1cm4gSW50ZXJuYWxDbGlwcGVyLmNyb3NzUHJvZHVjdChwcmV2UHQsIHJlY3RNaWRQb2ludCwgY3VyclB0KSA8IDA7XHJcbiAgICBlbHNlXHJcbiAgICAgIHJldHVybiB0aGlzLmhlYWRpbmdDbG9ja3dpc2UocHJldiwgY3Vycik7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHN0YXRpYyBhcmVPcHBvc2l0ZXMocHJldjogTG9jYXRpb24sIGN1cnI6IExvY2F0aW9uKTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gTWF0aC5hYnMocHJldiAtIGN1cnIpID09PSAyO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBzdGF0aWMgaGVhZGluZ0Nsb2Nrd2lzZShwcmV2OiBMb2NhdGlvbiwgY3VycjogTG9jYXRpb24pOiBib29sZWFuIHtcclxuICAgIHJldHVybiAocHJldiArIDEpICUgNCA9PT0gY3VycjtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgc3RhdGljIGdldEFkamFjZW50TG9jYXRpb24obG9jOiBMb2NhdGlvbiwgaXNDbG9ja3dpc2U6IGJvb2xlYW4pOiBMb2NhdGlvbiB7XHJcbiAgICBjb25zdCBkZWx0YSA9IGlzQ2xvY2t3aXNlID8gMSA6IDM7XHJcbiAgICByZXR1cm4gKGxvYyArIGRlbHRhKSAlIDQ7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHN0YXRpYyB1bmxpbmtPcChvcDogT3V0UHQyIHwgdW5kZWZpbmVkKTogT3V0UHQyIHwgdW5kZWZpbmVkIHtcclxuICAgIGlmIChvcCEubmV4dCA9PT0gb3ApIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgICBvcCEucHJldiEubmV4dCA9IG9wIS5uZXh0O1xyXG4gICAgb3AhLm5leHQhLnByZXYgPSBvcCEucHJldjtcclxuICAgIHJldHVybiBvcCEubmV4dDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgc3RhdGljIHVubGlua09wQmFjayhvcDogT3V0UHQyIHwgdW5kZWZpbmVkKTogT3V0UHQyIHwgdW5kZWZpbmVkIHtcclxuICAgIGlmIChvcCEubmV4dCA9PT0gb3ApIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgICBvcCEucHJldiEubmV4dCA9IG9wIS5uZXh0O1xyXG4gICAgb3AhLm5leHQhLnByZXYgPSBvcCEucHJldjtcclxuICAgIHJldHVybiBvcCEucHJldjtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgc3RhdGljIGdldEVkZ2VzRm9yUHQocHQ6IElQb2ludDY0LCByZWM6IFJlY3Q2NCk6IG51bWJlciB7XHJcbiAgICBsZXQgcmVzdWx0ID0gMDtcclxuICAgIGlmIChwdC54ID09PSByZWMubGVmdCkgcmVzdWx0ID0gMTtcclxuICAgIGVsc2UgaWYgKHB0LnggPT09IHJlYy5yaWdodCkgcmVzdWx0ID0gNDtcclxuICAgIGlmIChwdC55ID09PSByZWMudG9wKSByZXN1bHQgKz0gMjtcclxuICAgIGVsc2UgaWYgKHB0LnkgPT09IHJlYy5ib3R0b20pIHJlc3VsdCArPSA4O1xyXG4gICAgcmV0dXJuIHJlc3VsdDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgc3RhdGljIGlzSGVhZGluZ0Nsb2Nrd2lzZShwdDE6IElQb2ludDY0LCBwdDI6IElQb2ludDY0LCBlZGdlSWR4OiBudW1iZXIpOiBib29sZWFuIHtcclxuICAgIHN3aXRjaCAoZWRnZUlkeCkge1xyXG4gICAgICBjYXNlIDA6IHJldHVybiBwdDIueSA8IHB0MS55O1xyXG4gICAgICBjYXNlIDE6IHJldHVybiBwdDIueCA+IHB0MS54O1xyXG4gICAgICBjYXNlIDI6IHJldHVybiBwdDIueSA+IHB0MS55O1xyXG4gICAgICBkZWZhdWx0OiByZXR1cm4gcHQyLnggPCBwdDEueDtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgc3RhdGljIGhhc0hvcnpPdmVybGFwKGxlZnQxOiBJUG9pbnQ2NCwgcmlnaHQxOiBJUG9pbnQ2NCwgbGVmdDI6IElQb2ludDY0LCByaWdodDI6IElQb2ludDY0KTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gKGxlZnQxLnggPCByaWdodDIueCkgJiYgKHJpZ2h0MS54ID4gbGVmdDIueCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHN0YXRpYyBoYXNWZXJ0T3ZlcmxhcCh0b3AxOiBJUG9pbnQ2NCwgYm90dG9tMTogSVBvaW50NjQsIHRvcDI6IElQb2ludDY0LCBib3R0b20yOiBJUG9pbnQ2NCk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuICh0b3AxLnkgPCBib3R0b20yLnkpICYmIChib3R0b20xLnkgPiB0b3AyLnkpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBzdGF0aWMgYWRkVG9FZGdlKGVkZ2U6IChPdXRQdDIgfCB1bmRlZmluZWQpW10sIG9wOiBPdXRQdDIpOiB2b2lkIHtcclxuICAgIGlmIChvcC5lZGdlKSByZXR1cm47XHJcbiAgICBvcC5lZGdlID0gZWRnZTtcclxuICAgIGVkZ2UucHVzaChvcCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHN0YXRpYyB1bmNvdXBsZUVkZ2Uob3A6IE91dFB0Mik6IHZvaWQge1xyXG4gICAgaWYgKCFvcC5lZGdlKSByZXR1cm47XHJcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG9wLmVkZ2UubGVuZ3RoOyBpKyspIHtcclxuICAgICAgY29uc3Qgb3AyID0gb3AuZWRnZVtpXTtcclxuICAgICAgaWYgKG9wMiA9PT0gb3ApIHtcclxuICAgICAgICBvcC5lZGdlW2ldID0gdW5kZWZpbmVkO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICBvcC5lZGdlID0gdW5kZWZpbmVkO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBzdGF0aWMgc2V0TmV3T3duZXIob3A6IE91dFB0MiwgbmV3SWR4OiBudW1iZXIpOiB2b2lkIHtcclxuICAgIG9wLm93bmVySWR4ID0gbmV3SWR4O1xyXG4gICAgbGV0IG9wMiA9IG9wLm5leHQhO1xyXG4gICAgd2hpbGUgKG9wMiAhPT0gb3ApIHtcclxuICAgICAgb3AyLm93bmVySWR4ID0gbmV3SWR4O1xyXG4gICAgICBvcDIgPSBvcDIubmV4dCE7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGFkZENvcm5lcihwcmV2OiBMb2NhdGlvbiwgY3VycjogTG9jYXRpb24pOiB2b2lkIHtcclxuICAgIGlmIChSZWN0Q2xpcDY0LmhlYWRpbmdDbG9ja3dpc2UocHJldiwgY3VycikpXHJcbiAgICAgIHRoaXMuYWRkKHRoaXMucmVjdFBhdGhbcHJldl0pO1xyXG4gICAgZWxzZVxyXG4gICAgICB0aGlzLmFkZCh0aGlzLnJlY3RQYXRoW2N1cnJdKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgYWRkQ29ybmVyQnlSZWYobG9jOiBMb2NhdGlvbiwgaXNDbG9ja3dpc2U6IGJvb2xlYW4pOiB2b2lkIHtcclxuICAgIGlmIChpc0Nsb2Nrd2lzZSkge1xyXG4gICAgICB0aGlzLmFkZCh0aGlzLnJlY3RQYXRoW2xvY10pO1xyXG4gICAgICBsb2MgPSBSZWN0Q2xpcDY0LmdldEFkamFjZW50TG9jYXRpb24obG9jLCB0cnVlKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGxvYyA9IFJlY3RDbGlwNjQuZ2V0QWRqYWNlbnRMb2NhdGlvbihsb2MsIGZhbHNlKTtcclxuICAgICAgdGhpcy5hZGQodGhpcy5yZWN0UGF0aFtsb2NdKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByb3RlY3RlZCBzdGF0aWMgZ2V0TG9jYXRpb24ocmVjOiBSZWN0NjQsIHB0OiBJUG9pbnQ2NCk6IHsgc3VjY2VzczogYm9vbGVhbiwgbG9jOiBMb2NhdGlvbiB9IHtcclxuICAgIGxldCBsb2M6IExvY2F0aW9uO1xyXG5cclxuICAgIGlmIChwdC54ID09PSByZWMubGVmdCAmJiBwdC55ID49IHJlYy50b3AgJiYgcHQueSA8PSByZWMuYm90dG9tKSB7XHJcbiAgICAgIGxvYyA9IExvY2F0aW9uLmxlZnQ7IC8vIHB0IG9uIHJlY1xyXG4gICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgbG9jIH1cclxuICAgIH1cclxuICAgIGlmIChwdC54ID09PSByZWMucmlnaHQgJiYgcHQueSA+PSByZWMudG9wICYmIHB0LnkgPD0gcmVjLmJvdHRvbSkge1xyXG4gICAgICBsb2MgPSBMb2NhdGlvbi5yaWdodDsgLy8gcHQgb24gcmVjXHJcbiAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBsb2MgfTtcclxuICAgIH1cclxuICAgIGlmIChwdC55ID09PSByZWMudG9wICYmIHB0LnggPj0gcmVjLmxlZnQgJiYgcHQueCA8PSByZWMucmlnaHQpIHtcclxuICAgICAgbG9jID0gTG9jYXRpb24udG9wOyAvLyBwdCBvbiByZWNcclxuICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGxvYyB9O1xyXG4gICAgfVxyXG4gICAgaWYgKHB0LnkgPT09IHJlYy5ib3R0b20gJiYgcHQueCA+PSByZWMubGVmdCAmJiBwdC54IDw9IHJlYy5yaWdodCkge1xyXG4gICAgICBsb2MgPSBMb2NhdGlvbi5ib3R0b207IC8vIHB0IG9uIHJlY1xyXG4gICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgbG9jIH07XHJcbiAgICB9XHJcbiAgICBpZiAocHQueCA8IHJlYy5sZWZ0KSBsb2MgPSBMb2NhdGlvbi5sZWZ0O1xyXG4gICAgZWxzZSBpZiAocHQueCA+IHJlYy5yaWdodCkgbG9jID0gTG9jYXRpb24ucmlnaHQ7XHJcbiAgICBlbHNlIGlmIChwdC55IDwgcmVjLnRvcCkgbG9jID0gTG9jYXRpb24udG9wO1xyXG4gICAgZWxzZSBpZiAocHQueSA+IHJlYy5ib3R0b20pIGxvYyA9IExvY2F0aW9uLmJvdHRvbTtcclxuICAgIGVsc2UgbG9jID0gTG9jYXRpb24uaW5zaWRlO1xyXG5cclxuICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGxvYyB9O1xyXG4gIH1cclxuXHJcbiAgcHJvdGVjdGVkIHN0YXRpYyBnZXRJbnRlcnNlY3Rpb24ocmVjdFBhdGg6IFBhdGg2NCwgcDogSVBvaW50NjQsIHAyOiBJUG9pbnQ2NCwgbG9jOiBMb2NhdGlvbik6IHsgc3VjY2VzczogYm9vbGVhbiwgbG9jOiBMb2NhdGlvbiwgaXA6IElQb2ludDY0IH0ge1xyXG4gICAgLy8gZ2V0cyB0aGUgcHQgb2YgaW50ZXJzZWN0aW9uIGJldHdlZW4gcmVjdFBhdGggYW5kIHNlZ21lbnQocCwgcDIpIHRoYXQncyBjbG9zZXN0IHRvICdwJ1xyXG4gICAgLy8gd2hlbiByZXN1bHQgPT0gZmFsc2UsIGxvYyB3aWxsIHJlbWFpbiB1bmNoYW5nZWRcclxuICAgIGxldCBpcDogSVBvaW50NjQgPSBuZXcgUG9pbnQ2NCgpO1xyXG4gICAgc3dpdGNoIChsb2MpIHtcclxuICAgICAgY2FzZSBMb2NhdGlvbi5sZWZ0OlxyXG4gICAgICAgIGlmIChJbnRlcm5hbENsaXBwZXIuc2Vnc0ludGVyc2VjdChwLCBwMiwgcmVjdFBhdGhbMF0sIHJlY3RQYXRoWzNdLCB0cnVlKSkge1xyXG4gICAgICAgICAgaXAgPSBJbnRlcm5hbENsaXBwZXIuZ2V0SW50ZXJzZWN0UHQocCwgcDIsIHJlY3RQYXRoWzBdLCByZWN0UGF0aFszXSkuaXA7XHJcbiAgICAgICAgfSBlbHNlIGlmIChwLnkgPCByZWN0UGF0aFswXS55ICYmIEludGVybmFsQ2xpcHBlci5zZWdzSW50ZXJzZWN0KHAsIHAyLCByZWN0UGF0aFswXSwgcmVjdFBhdGhbMV0sIHRydWUpKSB7XHJcbiAgICAgICAgICBpcCA9IEludGVybmFsQ2xpcHBlci5nZXRJbnRlcnNlY3RQdChwLCBwMiwgcmVjdFBhdGhbMF0sIHJlY3RQYXRoWzFdKS5pcDtcclxuICAgICAgICAgIGxvYyA9IExvY2F0aW9uLnRvcDtcclxuICAgICAgICB9IGVsc2UgaWYgKEludGVybmFsQ2xpcHBlci5zZWdzSW50ZXJzZWN0KHAsIHAyLCByZWN0UGF0aFsyXSwgcmVjdFBhdGhbM10sIHRydWUpKSB7XHJcbiAgICAgICAgICBpcCA9IEludGVybmFsQ2xpcHBlci5nZXRJbnRlcnNlY3RQdChwLCBwMiwgcmVjdFBhdGhbMl0sIHJlY3RQYXRoWzNdKS5pcDtcclxuICAgICAgICAgIGxvYyA9IExvY2F0aW9uLmJvdHRvbTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgbG9jLCBpcCB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGJyZWFrO1xyXG5cclxuICAgICAgY2FzZSBMb2NhdGlvbi5yaWdodDpcclxuICAgICAgICBpZiAoSW50ZXJuYWxDbGlwcGVyLnNlZ3NJbnRlcnNlY3QocCwgcDIsIHJlY3RQYXRoWzFdLCByZWN0UGF0aFsyXSwgdHJ1ZSkpIHtcclxuICAgICAgICAgIGlwID0gSW50ZXJuYWxDbGlwcGVyLmdldEludGVyc2VjdFB0KHAsIHAyLCByZWN0UGF0aFsxXSwgcmVjdFBhdGhbMl0pLmlwO1xyXG4gICAgICAgIH0gZWxzZSBpZiAocC55IDwgcmVjdFBhdGhbMF0ueSAmJiBJbnRlcm5hbENsaXBwZXIuc2Vnc0ludGVyc2VjdChwLCBwMiwgcmVjdFBhdGhbMF0sIHJlY3RQYXRoWzFdLCB0cnVlKSkge1xyXG4gICAgICAgICAgaXAgPSBJbnRlcm5hbENsaXBwZXIuZ2V0SW50ZXJzZWN0UHQocCwgcDIsIHJlY3RQYXRoWzBdLCByZWN0UGF0aFsxXSkuaXA7XHJcbiAgICAgICAgICBsb2MgPSBMb2NhdGlvbi50b3A7XHJcbiAgICAgICAgfSBlbHNlIGlmIChJbnRlcm5hbENsaXBwZXIuc2Vnc0ludGVyc2VjdChwLCBwMiwgcmVjdFBhdGhbMl0sIHJlY3RQYXRoWzNdLCB0cnVlKSkge1xyXG4gICAgICAgICAgaXAgPSBJbnRlcm5hbENsaXBwZXIuZ2V0SW50ZXJzZWN0UHQocCwgcDIsIHJlY3RQYXRoWzJdLCByZWN0UGF0aFszXSkuaXA7XHJcbiAgICAgICAgICBsb2MgPSBMb2NhdGlvbi5ib3R0b207XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBsb2MsIGlwIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgIGNhc2UgTG9jYXRpb24udG9wOlxyXG4gICAgICAgIGlmIChJbnRlcm5hbENsaXBwZXIuc2Vnc0ludGVyc2VjdChwLCBwMiwgcmVjdFBhdGhbMF0sIHJlY3RQYXRoWzFdLCB0cnVlKSkge1xyXG4gICAgICAgICAgaXAgPSBJbnRlcm5hbENsaXBwZXIuZ2V0SW50ZXJzZWN0UHQocCwgcDIsIHJlY3RQYXRoWzBdLCByZWN0UGF0aFsxXSkuaXA7XHJcbiAgICAgICAgfSBlbHNlIGlmIChwLnggPCByZWN0UGF0aFswXS54ICYmIEludGVybmFsQ2xpcHBlci5zZWdzSW50ZXJzZWN0KHAsIHAyLCByZWN0UGF0aFswXSwgcmVjdFBhdGhbM10sIHRydWUpKSB7XHJcbiAgICAgICAgICBpcCA9IEludGVybmFsQ2xpcHBlci5nZXRJbnRlcnNlY3RQdChwLCBwMiwgcmVjdFBhdGhbMF0sIHJlY3RQYXRoWzNdKS5pcDtcclxuICAgICAgICAgIGxvYyA9IExvY2F0aW9uLmxlZnQ7XHJcbiAgICAgICAgfSBlbHNlIGlmIChwLnggPiByZWN0UGF0aFsxXS54ICYmIEludGVybmFsQ2xpcHBlci5zZWdzSW50ZXJzZWN0KHAsIHAyLCByZWN0UGF0aFsxXSwgcmVjdFBhdGhbMl0sIHRydWUpKSB7XHJcbiAgICAgICAgICBpcCA9IEludGVybmFsQ2xpcHBlci5nZXRJbnRlcnNlY3RQdChwLCBwMiwgcmVjdFBhdGhbMV0sIHJlY3RQYXRoWzJdKS5pcDtcclxuICAgICAgICAgIGxvYyA9IExvY2F0aW9uLnJpZ2h0O1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgbG9jLCBpcCB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGJyZWFrO1xyXG5cclxuICAgICAgY2FzZSBMb2NhdGlvbi5ib3R0b206XHJcbiAgICAgICAgaWYgKEludGVybmFsQ2xpcHBlci5zZWdzSW50ZXJzZWN0KHAsIHAyLCByZWN0UGF0aFsyXSwgcmVjdFBhdGhbM10sIHRydWUpKSB7XHJcbiAgICAgICAgICBpcCA9IEludGVybmFsQ2xpcHBlci5nZXRJbnRlcnNlY3RQdChwLCBwMiwgcmVjdFBhdGhbMl0sIHJlY3RQYXRoWzNdKS5pcDtcclxuICAgICAgICB9IGVsc2UgaWYgKHAueCA8IHJlY3RQYXRoWzNdLnggJiYgSW50ZXJuYWxDbGlwcGVyLnNlZ3NJbnRlcnNlY3QocCwgcDIsIHJlY3RQYXRoWzBdLCByZWN0UGF0aFszXSwgdHJ1ZSkpIHtcclxuICAgICAgICAgIGlwID0gSW50ZXJuYWxDbGlwcGVyLmdldEludGVyc2VjdFB0KHAsIHAyLCByZWN0UGF0aFswXSwgcmVjdFBhdGhbM10pLmlwO1xyXG4gICAgICAgICAgbG9jID0gTG9jYXRpb24ubGVmdDtcclxuICAgICAgICB9IGVsc2UgaWYgKHAueCA+IHJlY3RQYXRoWzJdLnggJiYgSW50ZXJuYWxDbGlwcGVyLnNlZ3NJbnRlcnNlY3QocCwgcDIsIHJlY3RQYXRoWzFdLCByZWN0UGF0aFsyXSwgdHJ1ZSkpIHtcclxuICAgICAgICAgIGlwID0gSW50ZXJuYWxDbGlwcGVyLmdldEludGVyc2VjdFB0KHAsIHAyLCByZWN0UGF0aFsxXSwgcmVjdFBhdGhbMl0pLmlwO1xyXG4gICAgICAgICAgbG9jID0gTG9jYXRpb24ucmlnaHQ7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBsb2MsIGlwIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgYnJlYWs7XHJcblxyXG4gICAgICBjYXNlIExvY2F0aW9uLmluc2lkZTpcclxuICAgICAgICBpZiAoSW50ZXJuYWxDbGlwcGVyLnNlZ3NJbnRlcnNlY3QocCwgcDIsIHJlY3RQYXRoWzBdLCByZWN0UGF0aFszXSwgdHJ1ZSkpIHtcclxuICAgICAgICAgIGlwID0gSW50ZXJuYWxDbGlwcGVyLmdldEludGVyc2VjdFB0KHAsIHAyLCByZWN0UGF0aFswXSwgcmVjdFBhdGhbM10pLmlwO1xyXG4gICAgICAgICAgbG9jID0gTG9jYXRpb24ubGVmdDtcclxuICAgICAgICB9IGVsc2UgaWYgKEludGVybmFsQ2xpcHBlci5zZWdzSW50ZXJzZWN0KHAsIHAyLCByZWN0UGF0aFswXSwgcmVjdFBhdGhbMV0sIHRydWUpKSB7XHJcbiAgICAgICAgICBpcCA9IEludGVybmFsQ2xpcHBlci5nZXRJbnRlcnNlY3RQdChwLCBwMiwgcmVjdFBhdGhbMF0sIHJlY3RQYXRoWzFdKS5pcDtcclxuICAgICAgICAgIGxvYyA9IExvY2F0aW9uLnRvcDtcclxuICAgICAgICB9IGVsc2UgaWYgKEludGVybmFsQ2xpcHBlci5zZWdzSW50ZXJzZWN0KHAsIHAyLCByZWN0UGF0aFsxXSwgcmVjdFBhdGhbMl0sIHRydWUpKSB7XHJcbiAgICAgICAgICBpcCA9IEludGVybmFsQ2xpcHBlci5nZXRJbnRlcnNlY3RQdChwLCBwMiwgcmVjdFBhdGhbMV0sIHJlY3RQYXRoWzJdKS5pcDtcclxuICAgICAgICAgIGxvYyA9IExvY2F0aW9uLnJpZ2h0O1xyXG4gICAgICAgIH0gZWxzZSBpZiAoSW50ZXJuYWxDbGlwcGVyLnNlZ3NJbnRlcnNlY3QocCwgcDIsIHJlY3RQYXRoWzJdLCByZWN0UGF0aFszXSwgdHJ1ZSkpIHtcclxuICAgICAgICAgIGlwID0gSW50ZXJuYWxDbGlwcGVyLmdldEludGVyc2VjdFB0KHAsIHAyLCByZWN0UGF0aFsyXSwgcmVjdFBhdGhbM10pLmlwO1xyXG4gICAgICAgICAgbG9jID0gTG9jYXRpb24uYm90dG9tO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgbG9jLCBpcCB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGJyZWFrO1xyXG5cclxuICAgIH1cclxuICAgIHJldHVybiB7IHN1Y2Nlc3M6dHJ1ZSwgbG9jLCBpcCB9O1xyXG4gIH1cclxuXHJcbiAgcHJvdGVjdGVkIGdldE5leHRMb2NhdGlvbihwYXRoOiBQYXRoNjQsIGNvbnRleHQ6IHsgbG9jOiBMb2NhdGlvbiwgaTogbnVtYmVyLCBoaWdoSTogbnVtYmVyIH0pOiB2b2lkIHtcclxuXHJcbiAgICBzd2l0Y2ggKGNvbnRleHQubG9jKSB7XHJcbiAgICAgIGNhc2UgTG9jYXRpb24ubGVmdDpcclxuICAgICAgICB3aGlsZSAoY29udGV4dC5pIDw9IGNvbnRleHQuaGlnaEkgJiYgcGF0aFtjb250ZXh0LmldLnggPD0gdGhpcy5yZWN0LmxlZnQpIGNvbnRleHQuaSsrO1xyXG4gICAgICAgIGlmIChjb250ZXh0LmkgPiBjb250ZXh0LmhpZ2hJKSBicmVhaztcclxuICAgICAgICBpZiAocGF0aFtjb250ZXh0LmldLnggPj0gdGhpcy5yZWN0LnJpZ2h0KSBjb250ZXh0LmxvYyA9IExvY2F0aW9uLnJpZ2h0O1xyXG4gICAgICAgIGVsc2UgaWYgKHBhdGhbY29udGV4dC5pXS55IDw9IHRoaXMucmVjdC50b3ApIGNvbnRleHQubG9jID0gTG9jYXRpb24udG9wO1xyXG4gICAgICAgIGVsc2UgaWYgKHBhdGhbY29udGV4dC5pXS55ID49IHRoaXMucmVjdC5ib3R0b20pIGNvbnRleHQubG9jID0gTG9jYXRpb24uYm90dG9tO1xyXG4gICAgICAgIGVsc2UgY29udGV4dC5sb2MgPSBMb2NhdGlvbi5pbnNpZGU7XHJcbiAgICAgICAgYnJlYWs7XHJcblxyXG4gICAgICBjYXNlIExvY2F0aW9uLnRvcDpcclxuICAgICAgICB3aGlsZSAoY29udGV4dC5pIDw9IGNvbnRleHQuaGlnaEkgJiYgcGF0aFtjb250ZXh0LmldLnkgPD0gdGhpcy5yZWN0LnRvcCkgY29udGV4dC5pKys7XHJcbiAgICAgICAgaWYgKGNvbnRleHQuaSA+IGNvbnRleHQuaGlnaEkpIGJyZWFrO1xyXG4gICAgICAgIGlmIChwYXRoW2NvbnRleHQuaV0ueSA+PSB0aGlzLnJlY3QuYm90dG9tKSBjb250ZXh0LmxvYyA9IExvY2F0aW9uLmJvdHRvbTtcclxuICAgICAgICBlbHNlIGlmIChwYXRoW2NvbnRleHQuaV0ueCA8PSB0aGlzLnJlY3QubGVmdCkgY29udGV4dC5sb2MgPSBMb2NhdGlvbi5sZWZ0O1xyXG4gICAgICAgIGVsc2UgaWYgKHBhdGhbY29udGV4dC5pXS54ID49IHRoaXMucmVjdC5yaWdodCkgY29udGV4dC5sb2MgPSBMb2NhdGlvbi5yaWdodDtcclxuICAgICAgICBlbHNlIGNvbnRleHQubG9jID0gTG9jYXRpb24uaW5zaWRlO1xyXG4gICAgICAgIGJyZWFrO1xyXG5cclxuICAgICAgY2FzZSBMb2NhdGlvbi5yaWdodDpcclxuICAgICAgICB3aGlsZSAoY29udGV4dC5pIDw9IGNvbnRleHQuaGlnaEkgJiYgcGF0aFtjb250ZXh0LmldLnggPj0gdGhpcy5yZWN0LnJpZ2h0KSBjb250ZXh0LmkrKztcclxuICAgICAgICBpZiAoY29udGV4dC5pID4gY29udGV4dC5oaWdoSSkgYnJlYWs7XHJcbiAgICAgICAgaWYgKHBhdGhbY29udGV4dC5pXS54IDw9IHRoaXMucmVjdC5sZWZ0KSBjb250ZXh0LmxvYyA9IExvY2F0aW9uLmxlZnQ7XHJcbiAgICAgICAgZWxzZSBpZiAocGF0aFtjb250ZXh0LmldLnkgPD0gdGhpcy5yZWN0LnRvcCkgY29udGV4dC5sb2MgPSBMb2NhdGlvbi50b3A7XHJcbiAgICAgICAgZWxzZSBpZiAocGF0aFtjb250ZXh0LmldLnkgPj0gdGhpcy5yZWN0LmJvdHRvbSkgY29udGV4dC5sb2MgPSBMb2NhdGlvbi5ib3R0b207XHJcbiAgICAgICAgZWxzZSBjb250ZXh0LmxvYyA9IExvY2F0aW9uLmluc2lkZTtcclxuICAgICAgICBicmVhaztcclxuXHJcbiAgICAgIGNhc2UgTG9jYXRpb24uYm90dG9tOlxyXG4gICAgICAgIHdoaWxlIChjb250ZXh0LmkgPD0gY29udGV4dC5oaWdoSSAmJiBwYXRoW2NvbnRleHQuaV0ueSA+PSB0aGlzLnJlY3QuYm90dG9tKSBjb250ZXh0LmkrKztcclxuICAgICAgICBpZiAoY29udGV4dC5pID4gY29udGV4dC5oaWdoSSkgYnJlYWs7XHJcbiAgICAgICAgaWYgKHBhdGhbY29udGV4dC5pXS55IDw9IHRoaXMucmVjdC50b3ApIGNvbnRleHQubG9jID0gTG9jYXRpb24udG9wO1xyXG4gICAgICAgIGVsc2UgaWYgKHBhdGhbY29udGV4dC5pXS54IDw9IHRoaXMucmVjdC5sZWZ0KSBjb250ZXh0LmxvYyA9IExvY2F0aW9uLmxlZnQ7XHJcbiAgICAgICAgZWxzZSBpZiAocGF0aFtjb250ZXh0LmldLnggPj0gdGhpcy5yZWN0LnJpZ2h0KSBjb250ZXh0LmxvYyA9IExvY2F0aW9uLnJpZ2h0O1xyXG4gICAgICAgIGVsc2UgY29udGV4dC5sb2MgPSBMb2NhdGlvbi5pbnNpZGU7XHJcbiAgICAgICAgYnJlYWs7XHJcblxyXG4gICAgICBjYXNlIExvY2F0aW9uLmluc2lkZTpcclxuICAgICAgICB3aGlsZSAoY29udGV4dC5pIDw9IGNvbnRleHQuaGlnaEkpIHtcclxuICAgICAgICAgIGlmIChwYXRoW2NvbnRleHQuaV0ueCA8IHRoaXMucmVjdC5sZWZ0KSBjb250ZXh0LmxvYyA9IExvY2F0aW9uLmxlZnQ7XHJcbiAgICAgICAgICBlbHNlIGlmIChwYXRoW2NvbnRleHQuaV0ueCA+IHRoaXMucmVjdC5yaWdodCkgY29udGV4dC5sb2MgPSBMb2NhdGlvbi5yaWdodDtcclxuICAgICAgICAgIGVsc2UgaWYgKHBhdGhbY29udGV4dC5pXS55ID4gdGhpcy5yZWN0LmJvdHRvbSkgY29udGV4dC5sb2MgPSBMb2NhdGlvbi5ib3R0b207XHJcbiAgICAgICAgICBlbHNlIGlmIChwYXRoW2NvbnRleHQuaV0ueSA8IHRoaXMucmVjdC50b3ApIGNvbnRleHQubG9jID0gTG9jYXRpb24udG9wO1xyXG4gICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMuYWRkKHBhdGhbY29udGV4dC5pXSk7ICBcclxuICAgICAgICAgICAgY29udGV4dC5pKys7XHJcbiAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJvdGVjdGVkIGV4ZWN1dGVJbnRlcm5hbChwYXRoOiBQYXRoNjQpOiB2b2lkIHtcclxuICAgIGlmIChwYXRoLmxlbmd0aCA8IDMgfHwgdGhpcy5yZWN0LmlzRW1wdHkoKSkgcmV0dXJuO1xyXG4gICAgY29uc3Qgc3RhcnRMb2NzOiBMb2NhdGlvbltdID0gW107XHJcblxyXG4gICAgbGV0IGZpcnN0Q3Jvc3M6IExvY2F0aW9uID0gTG9jYXRpb24uaW5zaWRlO1xyXG4gICAgbGV0IGNyb3NzaW5nTG9jOiBMb2NhdGlvbiA9IGZpcnN0Q3Jvc3MsIHByZXY6IExvY2F0aW9uID0gZmlyc3RDcm9zcztcclxuXHJcbiAgICBsZXQgaTogbnVtYmVyXHJcbiAgICBjb25zdCBoaWdoSSA9IHBhdGgubGVuZ3RoIC0gMTtcclxuICAgIGxldCByZXN1bHQgPSBSZWN0Q2xpcDY0LmdldExvY2F0aW9uKHRoaXMucmVjdCwgcGF0aFtoaWdoSV0pXHJcbiAgICBsZXQgbG9jOiBMb2NhdGlvbiA9IHJlc3VsdC5sb2NcclxuICAgIGlmICghcmVzdWx0LnN1Y2Nlc3MpIHtcclxuICAgICAgaSA9IGhpZ2hJIC0gMTtcclxuICAgICAgd2hpbGUgKGkgPj0gMCAmJiAhcmVzdWx0LnN1Y2Nlc3MpIHtcclxuICAgICAgICBpLS1cclxuICAgICAgICByZXN1bHQgPSBSZWN0Q2xpcDY0LmdldExvY2F0aW9uKHRoaXMucmVjdCwgcGF0aFtpXSlcclxuICAgICAgICBwcmV2ID0gcmVzdWx0LmxvY1xyXG4gICAgICB9XHJcbiAgICAgIGlmIChpIDwgMCkge1xyXG4gICAgICAgIGZvciAoY29uc3QgcHQgb2YgcGF0aCkge1xyXG4gICAgICAgICAgdGhpcy5hZGQocHQpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH1cclxuICAgICAgaWYgKHByZXYgPT0gTG9jYXRpb24uaW5zaWRlKSBsb2MgPSBMb2NhdGlvbi5pbnNpZGU7XHJcbiAgICB9XHJcbiAgICBjb25zdCBzdGFydGluZ0xvYyA9IGxvYztcclxuXHJcbiAgICAvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cclxuICAgIGkgPSAwO1xyXG4gICAgd2hpbGUgKGkgPD0gaGlnaEkpIHtcclxuICAgICAgcHJldiA9IGxvYztcclxuICAgICAgY29uc3QgcHJldkNyb3NzTG9jOiBMb2NhdGlvbiA9IGNyb3NzaW5nTG9jO1xyXG4gICAgICB0aGlzLmdldE5leHRMb2NhdGlvbihwYXRoLCB7IGxvYywgaSwgaGlnaEkgfSk7XHJcbiAgICAgIGlmIChpID4gaGlnaEkpIGJyZWFrO1xyXG5cclxuICAgICAgY29uc3QgcHJldlB0ID0gKGkgPT0gMCkgPyBwYXRoW2hpZ2hJXSA6IHBhdGhbaSAtIDFdO1xyXG4gICAgICBjcm9zc2luZ0xvYyA9IGxvYztcclxuXHJcbiAgICAgIGxldCByZXN1bHQgPSBSZWN0Q2xpcDY0LmdldEludGVyc2VjdGlvbih0aGlzLnJlY3RQYXRoLCBwYXRoW2ldLCBwcmV2UHQsIGNyb3NzaW5nTG9jKVxyXG4gICAgICBjb25zdCBpcDogSVBvaW50NjQgPSByZXN1bHQuaXBcclxuXHJcbiAgICAgIGlmICghcmVzdWx0LnN1Y2Nlc3MpIHtcclxuICAgICAgICBpZiAocHJldkNyb3NzTG9jID09IExvY2F0aW9uLmluc2lkZSkge1xyXG4gICAgICAgICAgY29uc3QgaXNDbG9ja3cgPSBSZWN0Q2xpcDY0LmlzQ2xvY2t3aXNlKHByZXYsIGxvYywgcHJldlB0LCBwYXRoW2ldLCB0aGlzLm1wKTsgXHJcbiAgICAgICAgICBkbyB7XHJcbiAgICAgICAgICAgIHN0YXJ0TG9jcy5wdXNoKHByZXYpO1xyXG4gICAgICAgICAgICBwcmV2ID0gUmVjdENsaXA2NC5nZXRBZGphY2VudExvY2F0aW9uKHByZXYsIGlzQ2xvY2t3KTtcclxuICAgICAgICAgIH0gd2hpbGUgKHByZXYgIT0gbG9jKTtcclxuICAgICAgICAgIGNyb3NzaW5nTG9jID0gcHJldkNyb3NzTG9jO1xyXG4gICAgICAgIH0gZWxzZSBpZiAocHJldiAhPSBMb2NhdGlvbi5pbnNpZGUgJiYgcHJldiAhPSBsb2MpIHtcclxuICAgICAgICAgIGNvbnN0IGlzQ2xvY2t3ID0gUmVjdENsaXA2NC5pc0Nsb2Nrd2lzZShwcmV2LCBsb2MsIHByZXZQdCwgcGF0aFtpXSwgdGhpcy5tcCk7XHJcbiAgICAgICAgICBkbyB7XHJcbiAgICAgICAgICAgIHRoaXMuYWRkQ29ybmVyQnlSZWYocHJldiwgaXNDbG9ja3cpO1xyXG4gICAgICAgICAgfSB3aGlsZSAocHJldiAhPSBsb2MpO1xyXG4gICAgICAgIH1cclxuICAgICAgICArK2k7XHJcbiAgICAgICAgY29udGludWU7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cclxuICAgICAgLy8gd2UgbXVzdCBiZSBjcm9zc2luZyB0aGUgcmVjdCBib3VuZGFyeSB0byBnZXQgaGVyZVxyXG4gICAgICAvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXHJcbiAgICAgIGlmIChsb2MgPT0gTG9jYXRpb24uaW5zaWRlKSB7XHJcbiAgICAgICAgaWYgKGZpcnN0Q3Jvc3MgPT0gTG9jYXRpb24uaW5zaWRlKSB7XHJcbiAgICAgICAgICBmaXJzdENyb3NzID0gY3Jvc3NpbmdMb2M7XHJcbiAgICAgICAgICBzdGFydExvY3MucHVzaChwcmV2KTtcclxuICAgICAgICB9IGVsc2UgaWYgKHByZXYgIT0gY3Jvc3NpbmdMb2MpIHtcclxuICAgICAgICAgIGNvbnN0IGlzQ2xvY2t3ID0gUmVjdENsaXA2NC5pc0Nsb2Nrd2lzZShwcmV2LCBjcm9zc2luZ0xvYywgcHJldlB0LCBwYXRoW2ldLCB0aGlzLm1wKTtcclxuICAgICAgICAgIGRvIHtcclxuICAgICAgICAgICAgdGhpcy5hZGRDb3JuZXJCeVJlZihwcmV2LCBpc0Nsb2Nrdyk7XHJcbiAgICAgICAgICB9IHdoaWxlIChwcmV2ICE9IGNyb3NzaW5nTG9jKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0gZWxzZSBpZiAocHJldiAhPSBMb2NhdGlvbi5pbnNpZGUpIHtcclxuICAgICAgICAvLyBwYXNzaW5nIHJpZ2h0IHRocm91Z2ggcmVjdC4gJ2lwJyBoZXJlIHdpbGwgYmUgdGhlIHNlY29uZFxyXG4gICAgICAgIC8vIGludGVyc2VjdCBwdCBidXQgd2UnbGwgYWxzbyBuZWVkIHRoZSBmaXJzdCBpbnRlcnNlY3QgcHQgKGlwMilcclxuXHJcbiAgICAgICAgbG9jID0gcHJldjtcclxuICAgICAgICByZXN1bHQgPSBSZWN0Q2xpcDY0LmdldEludGVyc2VjdGlvbih0aGlzLnJlY3RQYXRoLCBwcmV2UHQsIHBhdGhbaV0sIGxvYyk7XHJcbiAgICAgICAgY29uc3QgaXAyOiBJUG9pbnQ2NCA9IHJlc3VsdC5pcFxyXG5cclxuICAgICAgICBpZiAocHJldkNyb3NzTG9jICE9IExvY2F0aW9uLmluc2lkZSAmJiBwcmV2Q3Jvc3NMb2MgIT0gbG9jKVxyXG4gICAgICAgICAgdGhpcy5hZGRDb3JuZXIocHJldkNyb3NzTG9jLCBsb2MpO1xyXG5cclxuICAgICAgICBpZiAoZmlyc3RDcm9zcyA9PSBMb2NhdGlvbi5pbnNpZGUpIHtcclxuICAgICAgICAgIGZpcnN0Q3Jvc3MgPSBsb2M7XHJcbiAgICAgICAgICBzdGFydExvY3MucHVzaChwcmV2KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGxvYyA9IGNyb3NzaW5nTG9jO1xyXG4gICAgICAgIHRoaXMuYWRkKGlwMik7XHJcbiAgICAgICAgaWYgKGlwID09IGlwMikge1xyXG4gICAgICAgICAgbG9jID0gUmVjdENsaXA2NC5nZXRMb2NhdGlvbih0aGlzLnJlY3QsIHBhdGhbaV0pLmxvYztcclxuICAgICAgICAgIHRoaXMuYWRkQ29ybmVyKGNyb3NzaW5nTG9jLCBsb2MpO1xyXG4gICAgICAgICAgY3Jvc3NpbmdMb2MgPSBsb2M7XHJcbiAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICB9XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgbG9jID0gY3Jvc3NpbmdMb2M7XHJcbiAgICAgICAgaWYgKGZpcnN0Q3Jvc3MgPT0gTG9jYXRpb24uaW5zaWRlKVxyXG4gICAgICAgICAgZmlyc3RDcm9zcyA9IGNyb3NzaW5nTG9jO1xyXG4gICAgICB9XHJcblxyXG4gICAgICB0aGlzLmFkZChpcCk7XHJcbiAgICB9Ly93aGlsZSBpIDw9IGhpZ2hJXHJcbiAgICAvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cclxuXHJcbiAgICBpZiAoZmlyc3RDcm9zcyA9PSBMb2NhdGlvbi5pbnNpZGUpIHtcclxuICAgICAgaWYgKHN0YXJ0aW5nTG9jICE9IExvY2F0aW9uLmluc2lkZSkge1xyXG4gICAgICAgIGlmICh0aGlzLnBhdGhCb3VuZHMuY29udGFpbnNSZWN0KHRoaXMucmVjdCkgJiYgUmVjdENsaXA2NC5wYXRoMUNvbnRhaW5zUGF0aDIocGF0aCwgdGhpcy5yZWN0UGF0aCkpIHtcclxuICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgNDsgaisrKSB7XHJcbiAgICAgICAgICAgIHRoaXMuYWRkKHRoaXMucmVjdFBhdGhbal0pO1xyXG4gICAgICAgICAgICBSZWN0Q2xpcDY0LmFkZFRvRWRnZSh0aGlzLmVkZ2VzW2ogKiAyXSwgdGhpcy5yZXN1bHRzWzBdISk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9IGVsc2UgaWYgKGxvYyAhPSBMb2NhdGlvbi5pbnNpZGUgJiYgKGxvYyAhPSBmaXJzdENyb3NzIHx8IHN0YXJ0TG9jcy5sZW5ndGggPiAyKSkge1xyXG4gICAgICBpZiAoc3RhcnRMb2NzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICBwcmV2ID0gbG9jO1xyXG4gICAgICAgIGZvciAoY29uc3QgbG9jMiBvZiBzdGFydExvY3MpIHtcclxuICAgICAgICAgIGlmIChwcmV2ID09IGxvYzIpIGNvbnRpbnVlO1xyXG4gICAgICAgICAgdGhpcy5hZGRDb3JuZXJCeVJlZihwcmV2LCBSZWN0Q2xpcDY0LmhlYWRpbmdDbG9ja3dpc2UocHJldiwgbG9jMikpO1xyXG4gICAgICAgICAgcHJldiA9IGxvYzI7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGxvYyA9IHByZXY7XHJcbiAgICAgIH1cclxuICAgICAgaWYgKGxvYyAhPSBmaXJzdENyb3NzKVxyXG4gICAgICAgIHRoaXMuYWRkQ29ybmVyQnlSZWYobG9jLCBSZWN0Q2xpcDY0LmhlYWRpbmdDbG9ja3dpc2UobG9jLCBmaXJzdENyb3NzKSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgZXhlY3V0ZShwYXRoczogUGF0aHM2NCk6IFBhdGhzNjQgeyBcclxuICAgIGNvbnN0IHJlc3VsdDogUGF0aHM2NCA9IFtdOyBcclxuICAgIGlmICh0aGlzLnJlY3QuaXNFbXB0eSgpKSByZXR1cm4gcmVzdWx0O1xyXG5cclxuICAgIGZvciAoY29uc3QgcGF0aCBvZiBwYXRocykge1xyXG4gICAgICBpZiAocGF0aC5sZW5ndGggPCAzKSBjb250aW51ZTtcclxuICAgICAgdGhpcy5wYXRoQm91bmRzID0gQ2xpcHBlci5nZXRCb3VuZHMocGF0aCk7XHJcblxyXG4gICAgICBpZiAoIXRoaXMucmVjdC5pbnRlcnNlY3RzKHRoaXMucGF0aEJvdW5kcykpIGNvbnRpbnVlO1xyXG4gICAgICBlbHNlIGlmICh0aGlzLnJlY3QuY29udGFpbnNSZWN0KHRoaXMucGF0aEJvdW5kcykpIHtcclxuICAgICAgICByZXN1bHQucHVzaChwYXRoKTtcclxuICAgICAgICBjb250aW51ZTtcclxuICAgICAgfVxyXG4gICAgICB0aGlzLmV4ZWN1dGVJbnRlcm5hbChwYXRoKTtcclxuICAgICAgdGhpcy5jaGVja0VkZ2VzKCk7XHJcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgNDsgKytpKVxyXG4gICAgICAgIHRoaXMudGlkeUVkZ2VQYWlyKGksIHRoaXMuZWRnZXNbaSAqIDJdLCB0aGlzLmVkZ2VzW2kgKiAyICsgMV0pO1xyXG5cclxuICAgICAgZm9yIChjb25zdCBvcCBvZiB0aGlzLnJlc3VsdHMpIHtcclxuICAgICAgICBjb25zdCB0bXAgPSB0aGlzLmdldFBhdGgob3ApOyBcclxuICAgICAgICBpZiAodG1wLmxlbmd0aCA+IDApIHJlc3VsdC5wdXNoKHRtcCk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIHRoaXMucmVzdWx0cy5sZW5ndGggPSAwXHJcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgODsgaSsrKVxyXG4gICAgICAgIHRoaXMuZWRnZXNbaV0ubGVuZ3RoID0gMFxyXG4gICAgfVxyXG4gICAgcmV0dXJuIHJlc3VsdDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgY2hlY2tFZGdlcygpOiB2b2lkIHtcclxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5yZXN1bHRzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgIGxldCBvcCA9IHRoaXMucmVzdWx0c1tpXTtcclxuICAgICAgbGV0IG9wMiA9IG9wO1xyXG5cclxuICAgICAgaWYgKG9wID09PSB1bmRlZmluZWQpIGNvbnRpbnVlO1xyXG5cclxuICAgICAgZG8ge1xyXG4gICAgICAgIGlmIChJbnRlcm5hbENsaXBwZXIuY3Jvc3NQcm9kdWN0KG9wMiEucHJldiEucHQsIG9wMiEucHQsIG9wMiEubmV4dCEucHQpID09PSAwKSB7IFxyXG4gICAgICAgICAgaWYgKG9wMiA9PT0gb3ApIHtcclxuICAgICAgICAgICAgb3AyID0gUmVjdENsaXA2NC51bmxpbmtPcEJhY2sob3AyKTtcclxuICAgICAgICAgICAgaWYgKG9wMiA9PT0gdW5kZWZpbmVkKSBicmVhaztcclxuICAgICAgICAgICAgb3AgPSBvcDIucHJldjtcclxuICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIG9wMiA9IFJlY3RDbGlwNjQudW5saW5rT3BCYWNrKG9wMik7XHJcbiAgICAgICAgICAgIGlmIChvcDIgPT09IHVuZGVmaW5lZCkgYnJlYWs7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIG9wMiA9IG9wMiEubmV4dDtcclxuICAgICAgICB9XHJcbiAgICAgIH0gd2hpbGUgKG9wMiAhPT0gb3ApO1xyXG5cclxuICAgICAgaWYgKG9wMiA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgdGhpcy5yZXN1bHRzW2ldID0gdW5kZWZpbmVkO1xyXG4gICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICB9XHJcbiAgICAgIHRoaXMucmVzdWx0c1tpXSA9IG9wMjtcclxuXHJcbiAgICAgIGxldCBlZGdlU2V0MSA9IFJlY3RDbGlwNjQuZ2V0RWRnZXNGb3JQdChvcCEucHJldiEucHQsIHRoaXMucmVjdCk7XHJcbiAgICAgIG9wMiA9IG9wO1xyXG4gICAgICBkbyB7XHJcbiAgICAgICAgY29uc3QgZWRnZVNldDIgPSBSZWN0Q2xpcDY0LmdldEVkZ2VzRm9yUHQob3AyIS5wdCwgdGhpcy5yZWN0KTtcclxuICAgICAgICBpZiAoZWRnZVNldDIgIT09IDAgJiYgb3AyIS5lZGdlID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgIGNvbnN0IGNvbWJpbmVkU2V0ID0gKGVkZ2VTZXQxICYgZWRnZVNldDIpO1xyXG4gICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCA0OyArK2opIHtcclxuICAgICAgICAgICAgaWYgKChjb21iaW5lZFNldCAmICgxIDw8IGopKSAhPT0gMCkge1xyXG4gICAgICAgICAgICAgIGlmIChSZWN0Q2xpcDY0LmlzSGVhZGluZ0Nsb2Nrd2lzZShvcDIhLnByZXYhLnB0LCBvcDIhLnB0LCBqKSlcclxuICAgICAgICAgICAgICAgIFJlY3RDbGlwNjQuYWRkVG9FZGdlKHRoaXMuZWRnZXNbaiAqIDJdLCBvcDIhKTtcclxuICAgICAgICAgICAgICBlbHNlXHJcbiAgICAgICAgICAgICAgICBSZWN0Q2xpcDY0LmFkZFRvRWRnZSh0aGlzLmVkZ2VzW2ogKiAyICsgMV0sIG9wMiEpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVkZ2VTZXQxID0gZWRnZVNldDI7XHJcbiAgICAgICAgb3AyID0gb3AyIS5uZXh0O1xyXG4gICAgICB9IHdoaWxlIChvcDIgIT09IG9wKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgdGlkeUVkZ2VQYWlyKGlkeDogbnVtYmVyLCBjdzogQXJyYXk8T3V0UHQyIHwgdW5kZWZpbmVkPiwgY2N3OiBBcnJheTxPdXRQdDIgfCB1bmRlZmluZWQ+KTogdm9pZCB7XHJcbiAgICBpZiAoY2N3Lmxlbmd0aCA9PT0gMCkgcmV0dXJuO1xyXG4gICAgY29uc3QgaXNIb3J6ID0gKGlkeCA9PT0gMSB8fCBpZHggPT09IDMpO1xyXG4gICAgY29uc3QgY3dJc1Rvd2FyZExhcmdlciA9IChpZHggPT09IDEgfHwgaWR4ID09PSAyKTtcclxuICAgIGxldCBpID0gMCwgaiA9IDA7XHJcbiAgICBsZXQgcDE6IE91dFB0MiB8IHVuZGVmaW5lZCwgcDI6IE91dFB0MiB8IHVuZGVmaW5lZCwgcDFhOiBPdXRQdDIgfCB1bmRlZmluZWQsIHAyYTogT3V0UHQyIHwgdW5kZWZpbmVkLCBvcDogT3V0UHQyIHwgdW5kZWZpbmVkLCBvcDI6IE91dFB0MiB8IHVuZGVmaW5lZDtcclxuXHJcbiAgICB3aGlsZSAoaSA8IGN3Lmxlbmd0aCkge1xyXG4gICAgICBwMSA9IGN3W2ldO1xyXG4gICAgICBpZiAoIXAxIHx8IHAxLm5leHQgPT09IHAxLnByZXYpIHtcclxuICAgICAgICBjd1tpKytdID0gdW5kZWZpbmVkO1xyXG4gICAgICAgIGogPSAwO1xyXG4gICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBjb25zdCBqTGltID0gY2N3Lmxlbmd0aDtcclxuICAgICAgd2hpbGUgKGogPCBqTGltICYmICghY2N3W2pdIHx8IGNjd1tqXSEubmV4dCA9PT0gY2N3W2pdIS5wcmV2KSkgKytqO1xyXG5cclxuICAgICAgaWYgKGogPT09IGpMaW0pIHtcclxuICAgICAgICArK2k7XHJcbiAgICAgICAgaiA9IDA7XHJcbiAgICAgICAgY29udGludWU7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGlmIChjd0lzVG93YXJkTGFyZ2VyKSB7XHJcbiAgICAgICAgcDEgPSBjd1tpXSEucHJldiE7XHJcbiAgICAgICAgcDFhID0gY3dbaV07XHJcbiAgICAgICAgcDIgPSBjY3dbal07XHJcbiAgICAgICAgcDJhID0gY2N3W2pdIS5wcmV2ITtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBwMSA9IGN3W2ldO1xyXG4gICAgICAgIHAxYSA9IGN3W2ldIS5wcmV2ITtcclxuICAgICAgICBwMiA9IGNjd1tqXSEucHJldiE7XHJcbiAgICAgICAgcDJhID0gY2N3W2pdO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBpZiAoKGlzSG9yeiAmJiAhUmVjdENsaXA2NC5oYXNIb3J6T3ZlcmxhcChwMSEucHQsIHAxYSEucHQsIHAyIS5wdCwgcDJhIS5wdCkpIHx8XHJcbiAgICAgICAgKCFpc0hvcnogJiYgIVJlY3RDbGlwNjQuaGFzVmVydE92ZXJsYXAocDEhLnB0LCBwMWEhLnB0LCBwMiEucHQsIHAyYSEucHQpKSkge1xyXG4gICAgICAgICsrajtcclxuICAgICAgICBjb250aW51ZTtcclxuICAgICAgfVxyXG5cclxuICAgICAgY29uc3QgaXNSZWpvaW5pbmcgPSBjd1tpXSEub3duZXJJZHggIT09IGNjd1tqXSEub3duZXJJZHg7XHJcblxyXG4gICAgICBpZiAoaXNSZWpvaW5pbmcpIHtcclxuICAgICAgICB0aGlzLnJlc3VsdHNbcDIhLm93bmVySWR4XSA9IHVuZGVmaW5lZDtcclxuICAgICAgICBSZWN0Q2xpcDY0LnNldE5ld093bmVyKHAyISwgcDEhLm93bmVySWR4KTtcclxuICAgICAgfVxyXG5cclxuICAgICAgaWYgKGN3SXNUb3dhcmRMYXJnZXIpIHtcclxuICAgICAgICAvLyBwMSA+PiB8ID4+IHAxYTtcclxuICAgICAgICAvLyBwMiA8PCB8IDw8IHAyYTtcclxuICAgICAgICBwMSEubmV4dCA9IHAyO1xyXG4gICAgICAgIHAyIS5wcmV2ID0gcDE7XHJcbiAgICAgICAgcDFhIS5wcmV2ID0gcDJhO1xyXG4gICAgICAgIHAyYSEubmV4dCA9IHAxYTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICAvLyBwMSA8PCB8IDw8IHAxYTtcclxuICAgICAgICAvLyBwMiA+PiB8ID4+IHAyYTtcclxuICAgICAgICBwMSEucHJldiA9IHAyO1xyXG4gICAgICAgIHAyIS5uZXh0ID0gcDE7XHJcbiAgICAgICAgcDFhIS5uZXh0ID0gcDJhO1xyXG4gICAgICAgIHAyYSEucHJldiA9IHAxYTtcclxuICAgICAgfVxyXG5cclxuICAgICAgaWYgKCFpc1Jlam9pbmluZykge1xyXG4gICAgICAgIGNvbnN0IG5ld19pZHggPSB0aGlzLnJlc3VsdHMubGVuZ3RoO1xyXG4gICAgICAgIHRoaXMucmVzdWx0cy5wdXNoKHAxYSk7XHJcbiAgICAgICAgUmVjdENsaXA2NC5zZXROZXdPd25lcihwMWEhLCBuZXdfaWR4KTtcclxuICAgICAgfVxyXG5cclxuICAgICAgaWYgKGN3SXNUb3dhcmRMYXJnZXIpIHtcclxuICAgICAgICBvcCA9IHAyO1xyXG4gICAgICAgIG9wMiA9IHAxYTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBvcCA9IHAxO1xyXG4gICAgICAgIG9wMiA9IHAyYTtcclxuICAgICAgfVxyXG4gICAgICB0aGlzLnJlc3VsdHNbb3AhLm93bmVySWR4XSA9IG9wO1xyXG4gICAgICB0aGlzLnJlc3VsdHNbb3AyIS5vd25lcklkeF0gPSBvcDI7XHJcblxyXG4gICAgICAvLyBhbmQgbm93IGxvdHMgb2Ygd29yayB0byBnZXQgcmVhZHkgZm9yIHRoZSBuZXh0IGxvb3BcclxuXHJcbiAgICAgIGxldCBvcElzTGFyZ2VyOiBib29sZWFuLCBvcDJJc0xhcmdlcjogYm9vbGVhbjtcclxuICAgICAgaWYgKGlzSG9yeikgeyAvLyBYXHJcbiAgICAgICAgb3BJc0xhcmdlciA9IG9wIS5wdC54ID4gb3AhLnByZXYhLnB0Lng7XHJcbiAgICAgICAgb3AySXNMYXJnZXIgPSBvcDIhLnB0LnggPiBvcDIhLnByZXYhLnB0Lng7XHJcbiAgICAgIH0gZWxzZSB7ICAgICAgLy8gWVxyXG4gICAgICAgIG9wSXNMYXJnZXIgPSBvcCEucHQueSA+IG9wIS5wcmV2IS5wdC55O1xyXG4gICAgICAgIG9wMklzTGFyZ2VyID0gb3AyIS5wdC55ID4gb3AyIS5wcmV2IS5wdC55O1xyXG4gICAgICB9XHJcblxyXG4gICAgICBpZiAoKG9wIS5uZXh0ID09PSBvcCEucHJldikgfHwgKG9wIS5wdCA9PT0gb3AhLnByZXYhLnB0KSkge1xyXG4gICAgICAgIGlmIChvcDJJc0xhcmdlciA9PT0gY3dJc1Rvd2FyZExhcmdlcikge1xyXG4gICAgICAgICAgY3dbaV0gPSBvcDI7XHJcbiAgICAgICAgICBjY3dbaisrXSA9IHVuZGVmaW5lZDtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgY2N3W2pdID0gb3AyO1xyXG4gICAgICAgICAgY3dbaSsrXSA9IHVuZGVmaW5lZDtcclxuICAgICAgICB9XHJcbiAgICAgIH0gZWxzZSBpZiAoKG9wMiEubmV4dCA9PT0gb3AyIS5wcmV2KSB8fCAob3AyIS5wdCA9PT0gb3AyIS5wcmV2IS5wdCkpIHtcclxuICAgICAgICBpZiAob3BJc0xhcmdlciA9PT0gY3dJc1Rvd2FyZExhcmdlcikge1xyXG4gICAgICAgICAgY3dbaV0gPSBvcDtcclxuICAgICAgICAgIGNjd1tqKytdID0gdW5kZWZpbmVkO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICBjY3dbal0gPSBvcDtcclxuICAgICAgICAgIGN3W2krK10gPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgfVxyXG4gICAgICB9IGVsc2UgaWYgKG9wSXNMYXJnZXIgPT09IG9wMklzTGFyZ2VyKSB7XHJcbiAgICAgICAgaWYgKG9wSXNMYXJnZXIgPT09IGN3SXNUb3dhcmRMYXJnZXIpIHtcclxuICAgICAgICAgIGN3W2ldID0gb3A7XHJcbiAgICAgICAgICBSZWN0Q2xpcDY0LnVuY291cGxlRWRnZShvcDIhKTtcclxuICAgICAgICAgIFJlY3RDbGlwNjQuYWRkVG9FZGdlKGN3LCBvcDIhKTtcclxuICAgICAgICAgIGNjd1tqKytdID0gdW5kZWZpbmVkO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICBjd1tpKytdID0gdW5kZWZpbmVkO1xyXG4gICAgICAgICAgY2N3W2pdID0gb3AyO1xyXG4gICAgICAgICAgUmVjdENsaXA2NC51bmNvdXBsZUVkZ2Uob3AhKTtcclxuICAgICAgICAgIFJlY3RDbGlwNjQuYWRkVG9FZGdlKGNjdywgb3AhKTtcclxuICAgICAgICAgIGogPSAwO1xyXG4gICAgICAgIH1cclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBpZiAob3BJc0xhcmdlciA9PT0gY3dJc1Rvd2FyZExhcmdlcilcclxuICAgICAgICAgIGN3W2ldID0gb3A7XHJcbiAgICAgICAgZWxzZVxyXG4gICAgICAgICAgY2N3W2pdID0gb3A7XHJcblxyXG4gICAgICAgIGlmIChvcDJJc0xhcmdlciA9PT0gY3dJc1Rvd2FyZExhcmdlcilcclxuICAgICAgICAgIGN3W2ldID0gb3AyO1xyXG4gICAgICAgIGVsc2VcclxuICAgICAgICAgIGNjd1tqXSA9IG9wMjtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJvdGVjdGVkIGdldFBhdGgob3A6IE91dFB0MiB8IHVuZGVmaW5lZCk6IFBhdGg2NCB7XHJcbiAgICBjb25zdCByZXN1bHQgPSBuZXcgUGF0aDY0KCk7XHJcbiAgICBpZiAoIW9wIHx8IG9wLnByZXYgPT09IG9wLm5leHQpIHJldHVybiByZXN1bHQ7XHJcblxyXG4gICAgbGV0IG9wMjogT3V0UHQyIHwgdW5kZWZpbmVkID0gb3AubmV4dDtcclxuICAgIHdoaWxlIChvcDIgJiYgb3AyICE9PSBvcCkge1xyXG4gICAgICBpZiAoSW50ZXJuYWxDbGlwcGVyLmNyb3NzUHJvZHVjdChvcDIucHJldiEucHQsIG9wMi5wdCwgb3AyLm5leHQhLnB0KSA9PT0gMCkge1xyXG4gICAgICAgIG9wID0gb3AyLnByZXYhO1xyXG4gICAgICAgIG9wMiA9IFJlY3RDbGlwNjQudW5saW5rT3Aob3AyKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBvcDIgPSBvcDIubmV4dCE7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBpZiAoIW9wMikgcmV0dXJuIG5ldyBQYXRoNjQoKTtcclxuXHJcbiAgICByZXN1bHQucHVzaChvcC5wdCk7XHJcbiAgICBvcDIgPSBvcC5uZXh0ITtcclxuICAgIHdoaWxlIChvcDIgIT09IG9wKSB7XHJcbiAgICAgIHJlc3VsdC5wdXNoKG9wMi5wdCk7XHJcbiAgICAgIG9wMiA9IG9wMi5uZXh0ITtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG4gIH1cclxufVxyXG5cclxuZXhwb3J0IGNsYXNzIFJlY3RDbGlwTGluZXM2NCBleHRlbmRzIFJlY3RDbGlwNjQge1xyXG5cclxuICBjb25zdHJ1Y3RvcihyZWN0OiBSZWN0NjQpIHtcclxuICAgIHN1cGVyKHJlY3QpO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIG92ZXJyaWRlIGV4ZWN1dGUocGF0aHM6IFBhdGhzNjQpOiBQYXRoczY0IHtcclxuICAgIGNvbnN0IHJlc3VsdCA9IG5ldyBQYXRoczY0KCk7XHJcbiAgICBpZiAodGhpcy5yZWN0LmlzRW1wdHkoKSkgcmV0dXJuIHJlc3VsdDsgXHJcbiAgICBmb3IgKGNvbnN0IHBhdGggb2YgcGF0aHMpIHtcclxuICAgICAgaWYgKHBhdGgubGVuZ3RoIDwgMikgY29udGludWU7XHJcbiAgICAgIHRoaXMucGF0aEJvdW5kcyA9IENsaXBwZXIuZ2V0Qm91bmRzKHBhdGgpO1xyXG4gICAgICBpZiAoIXRoaXMucmVjdC5pbnRlcnNlY3RzKHRoaXMucGF0aEJvdW5kcykpIGNvbnRpbnVlOyBcclxuXHJcbiAgICAgIHRoaXMuZXhlY3V0ZUludGVybmFsKHBhdGgpO1xyXG5cclxuICAgICAgZm9yIChjb25zdCBvcCBvZiB0aGlzLnJlc3VsdHMpIHtcclxuICAgICAgICBjb25zdCB0bXAgPSB0aGlzLmdldFBhdGgob3ApO1xyXG4gICAgICAgIGlmICh0bXAubGVuZ3RoID4gMCkgcmVzdWx0LnB1c2godG1wKTtcclxuICAgICAgfVxyXG5cclxuICAgICAgLy8gQ2xlYW4gdXAgYWZ0ZXIgZXZlcnkgbG9vcFxyXG4gICAgICB0aGlzLnJlc3VsdHMubGVuZ3RoID0gMDsgLy8gQ2xlYXIgdGhlIGFycmF5XHJcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgODsgaSsrKSB7XHJcbiAgICAgICAgdGhpcy5lZGdlc1tpXS5sZW5ndGggPSAwOyAvLyBDbGVhciBlYWNoIGFycmF5XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiByZXN1bHQ7XHJcbiAgfVxyXG5cclxuICBwcm90ZWN0ZWQgb3ZlcnJpZGUgZ2V0UGF0aChvcDogT3V0UHQyIHwgdW5kZWZpbmVkKTogUGF0aDY0IHtcclxuICAgIGNvbnN0IHJlc3VsdCA9IG5ldyBQYXRoNjQoKTtcclxuICAgIGlmICghb3AgfHwgb3AgPT09IG9wLm5leHQpIHJldHVybiByZXN1bHQ7XHJcbiAgICBvcCA9IG9wLm5leHQ7IC8vIHN0YXJ0aW5nIGF0IHBhdGggYmVnaW5uaW5nIFxyXG4gICAgcmVzdWx0LnB1c2gob3AhLnB0KTtcclxuICAgIGxldCBvcDIgPSBvcCEubmV4dCE7XHJcbiAgICB3aGlsZSAob3AyICE9PSBvcCkge1xyXG4gICAgICByZXN1bHQucHVzaChvcDIucHQpO1xyXG4gICAgICBvcDIgPSBvcDIubmV4dCE7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG4gIH1cclxuXHJcbiAgcHJvdGVjdGVkIG92ZXJyaWRlICBleGVjdXRlSW50ZXJuYWwocGF0aDogUGF0aDY0KTogdm9pZCB7XHJcbiAgICB0aGlzLnJlc3VsdHMgPSBbXTtcclxuICAgIGlmIChwYXRoLmxlbmd0aCA8IDIgfHwgdGhpcy5yZWN0LmlzRW1wdHkoKSkgcmV0dXJuOyBcclxuXHJcbiAgICBsZXQgcHJldjogTG9jYXRpb24gPSBMb2NhdGlvbi5pbnNpZGU7XHJcbiAgICBsZXQgaSA9IDE7XHJcbiAgICBjb25zdCBoaWdoSSA9IHBhdGgubGVuZ3RoIC0gMTtcclxuXHJcbiAgICBsZXQgcmVzdWx0ID0gUmVjdENsaXBMaW5lczY0LmdldExvY2F0aW9uKHRoaXMucmVjdCwgcGF0aFswXSlcclxuICAgIGxldCBsb2M6IExvY2F0aW9uID0gcmVzdWx0LmxvY1xyXG4gICAgaWYgKCFyZXN1bHQuc3VjY2Vzcykge1xyXG4gICAgICB3aGlsZSAoaSA8PSBoaWdoSSAmJiAhcmVzdWx0LnN1Y2Nlc3MpIHtcclxuICAgICAgICBpKytcclxuICAgICAgICByZXN1bHQgPSBSZWN0Q2xpcExpbmVzNjQuZ2V0TG9jYXRpb24odGhpcy5yZWN0LCBwYXRoW2ldKVxyXG4gICAgICAgIHByZXYgPSByZXN1bHQubG9jXHJcbiAgICAgIH1cclxuICAgICAgaWYgKGkgPiBoaWdoSSkge1xyXG4gICAgICAgIGZvciAoY29uc3QgcHQgb2YgcGF0aCkgdGhpcy5hZGQocHQpO1xyXG4gICAgICB9XHJcbiAgICAgIGlmIChwcmV2ID09IExvY2F0aW9uLmluc2lkZSkgbG9jID0gTG9jYXRpb24uaW5zaWRlO1xyXG4gICAgICBpID0gMTtcclxuICAgIH1cclxuICAgIGlmIChsb2MgPT0gTG9jYXRpb24uaW5zaWRlKSB0aGlzLmFkZChwYXRoWzBdKTtcclxuXHJcbiAgICB3aGlsZSAoaSA8PSBoaWdoSSkge1xyXG4gICAgICBwcmV2ID0gbG9jO1xyXG4gICAgICB0aGlzLmdldE5leHRMb2NhdGlvbihwYXRoLCB7IGxvYywgaSwgaGlnaEkgfSk7XHJcblxyXG4gICAgICBpZiAoaSA+IGhpZ2hJKSBicmVhaztcclxuXHJcbiAgICAgIGNvbnN0IHByZXZQdDogSVBvaW50NjQgPSBwYXRoW2kgLSAxXTtcclxuICAgICAgbGV0IGNyb3NzaW5nTG9jOiBMb2NhdGlvbiA9IGxvYztcclxuXHJcbiAgICAgIGxldCByZXN1bHQgPSBSZWN0Q2xpcExpbmVzNjQuZ2V0SW50ZXJzZWN0aW9uKHRoaXMucmVjdFBhdGgsIHBhdGhbaV0sIHByZXZQdCwgY3Jvc3NpbmdMb2MpXHJcbiAgICAgIGNvbnN0IGlwOiBJUG9pbnQ2NCA9IHJlc3VsdC5pcFxyXG4gICAgICBjcm9zc2luZ0xvYyA9IHJlc3VsdC5sb2NcclxuXHJcbiAgICAgIGlmICghcmVzdWx0LnN1Y2Nlc3MpIHtcclxuICAgICAgICBpKys7XHJcbiAgICAgICAgY29udGludWU7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGlmIChsb2MgPT0gTG9jYXRpb24uaW5zaWRlKSB7XHJcbiAgICAgICAgdGhpcy5hZGQoaXAsIHRydWUpO1xyXG4gICAgICB9IGVsc2UgaWYgKHByZXYgIT09IExvY2F0aW9uLmluc2lkZSkge1xyXG4gICAgICAgIGNyb3NzaW5nTG9jID0gcHJldjtcclxuXHJcbiAgICAgICAgcmVzdWx0ID0gUmVjdENsaXBMaW5lczY0LmdldEludGVyc2VjdGlvbih0aGlzLnJlY3RQYXRoLCBwcmV2UHQsIHBhdGhbaV0sIGNyb3NzaW5nTG9jKTtcclxuICAgICAgICBjb25zdCBpcDI6IElQb2ludDY0ID0gcmVzdWx0LmlwXHJcbiAgICAgICAgY3Jvc3NpbmdMb2MgPSByZXN1bHQubG9jXHJcblxyXG4gICAgICAgIHRoaXMuYWRkKGlwMik7XHJcbiAgICAgICAgdGhpcy5hZGQoaXApO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIHRoaXMuYWRkKGlwKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxufVxyXG4iXX0=