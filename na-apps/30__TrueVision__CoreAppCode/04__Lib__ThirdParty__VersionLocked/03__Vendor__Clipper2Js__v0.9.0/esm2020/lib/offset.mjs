/*******************************************************************************
* Author    :  Angus Johnson                                                   *
* Date      :  7 August 2023                                                   *
* Website   :  http://www.angusj.com                                           *
* Copyright :  Angus Johnson 2010-2023                                         *
* Purpose   :  Path Offset (Inflate/Shrink)                                    *
* License   :  http://www.boost.org/LICENSE_1_0.txt                            *
*******************************************************************************/
//
// Converted from C# implemention https://github.com/AngusJohnson/Clipper2/blob/main/CSharp/Clipper2Lib/Clipper.Core.cs
// Removed support for USINGZ
//
// Converted by ChatGPT 4 August 3 version https://help.openai.com/en/articles/6825453-chatgpt-release-notes
//
import { Clipper } from "./clipper";
import { ClipType, FillRule, InternalClipper, Point64, Rect64 } from "./core";
import { Clipper64 } from "./engine";
export var JoinType;
(function (JoinType) {
    JoinType[JoinType["Square"] = 0] = "Square";
    JoinType[JoinType["Round"] = 1] = "Round";
    JoinType[JoinType["Miter"] = 2] = "Miter";
})(JoinType || (JoinType = {}));
export var EndType;
(function (EndType) {
    EndType[EndType["Polygon"] = 0] = "Polygon";
    EndType[EndType["Joined"] = 1] = "Joined";
    EndType[EndType["Butt"] = 2] = "Butt";
    EndType[EndType["Square"] = 3] = "Square";
    EndType[EndType["Round"] = 4] = "Round";
})(EndType || (EndType = {}));
class Group {
    constructor(paths, joinType, endType = EndType.Polygon) {
        this.inPaths = [...paths]; // creates a shallow copy of paths
        this.joinType = joinType;
        this.endType = endType;
        this.outPath = [];
        this.outPaths = [];
        this.pathsReversed = false;
    }
}
export class PointD {
    constructor(xOrPt, yOrScale) {
        if (typeof xOrPt === 'number' && typeof yOrScale === 'number') {
            this.x = xOrPt;
            this.y = yOrScale;
        }
        else if (xOrPt instanceof PointD) {
            if (yOrScale !== undefined) {
                this.x = xOrPt.x * yOrScale;
                this.y = xOrPt.y * yOrScale;
            }
            else {
                this.x = xOrPt.x;
                this.y = xOrPt.y;
            }
        }
        else {
            this.x = xOrPt.x * (yOrScale || 1);
            this.y = xOrPt.y * (yOrScale || 1);
        }
    }
    toString(precision = 2) {
        return `${this.x.toFixed(precision)},${this.y.toFixed(precision)}`;
    }
    static equals(lhs, rhs) {
        return InternalClipper.isAlmostZero(lhs.x - rhs.x) &&
            InternalClipper.isAlmostZero(lhs.y - rhs.y);
    }
    static notEquals(lhs, rhs) {
        return !InternalClipper.isAlmostZero(lhs.x - rhs.x) ||
            !InternalClipper.isAlmostZero(lhs.y - rhs.y);
    }
    equals(obj) {
        if (obj instanceof PointD) {
            return PointD.equals(this, obj);
        }
        return false;
    }
    negate() {
        this.x = -this.x;
        this.y = -this.y;
    }
}
export class ClipperOffset {
    constructor(miterLimit = 2.0, arcTolerance = 0.0, preserveCollinear = false, reverseSolution = false) {
        this._groupList = [];
        this._normals = [];
        this._solution = [];
        this.MiterLimit = miterLimit;
        this.ArcTolerance = arcTolerance;
        this.MergeGroups = true;
        this.PreserveCollinear = preserveCollinear;
        this.ReverseSolution = reverseSolution;
    }
    clear() {
        this._groupList = [];
    }
    addPath(path, joinType, endType) {
        if (path.length === 0)
            return;
        const pp = [path];
        this.addPaths(pp, joinType, endType);
    }
    addPaths(paths, joinType, endType) {
        if (paths.length === 0)
            return;
        this._groupList.push(new Group(paths, joinType, endType));
    }
    executeInternal(delta) {
        this._solution = [];
        if (this._groupList.length === 0)
            return;
        if (Math.abs(delta) < 0.5) {
            for (const group of this._groupList) {
                for (const path of group.inPaths) {
                    this._solution.push(path);
                }
            }
        }
        else {
            this._delta = delta;
            this._mitLimSqr = (this.MiterLimit <= 1 ? 2.0 : 2.0 / this.sqr(this.MiterLimit));
            for (const group of this._groupList) {
                this.doGroupOffset(group);
            }
        }
    }
    sqr(value) {
        return value * value;
    }
    execute(delta, solution) {
        solution.length = 0;
        this.executeInternal(delta);
        if (this._groupList.length === 0)
            return;
        // clean up self-intersections ...
        const c = new Clipper64();
        c.preserveCollinear = this.PreserveCollinear;
        // the solution should retain the orientation of the input
        c.reverseSolution = this.ReverseSolution !== this._groupList[0].pathsReversed;
        c.addSubjectPaths(this._solution);
        if (this._groupList[0].pathsReversed)
            c.execute(ClipType.Union, FillRule.Negative, solution);
        else
            c.execute(ClipType.Union, FillRule.Positive, solution);
    }
    executePolytree(delta, polytree) {
        polytree.clear();
        this.executeInternal(delta);
        if (this._groupList.length === 0)
            return;
        // clean up self-intersections ...
        const c = new Clipper64();
        c.preserveCollinear = this.PreserveCollinear;
        // the solution should retain the orientation of the input
        c.reverseSolution = this.ReverseSolution !== this._groupList[0].pathsReversed;
        c.addSubjectPaths(this._solution);
        if (this._groupList[0].pathsReversed)
            c.executePolyTree(ClipType.Union, FillRule.Negative, polytree);
        else
            c.executePolyTree(ClipType.Union, FillRule.Positive, polytree);
    }
    static getUnitNormal(pt1, pt2) {
        let dx = pt2.x - pt1.x;
        let dy = pt2.y - pt1.y;
        if (dx === 0 && dy === 0)
            return new PointD(0, 0);
        const f = 1.0 / Math.sqrt(dx * dx + dy * dy);
        dx *= f;
        dy *= f;
        return new PointD(dy, -dx);
    }
    executeCallback(deltaCallback, solution) {
        this.DeltaCallback = deltaCallback;
        this.execute(1.0, solution);
    }
    static getBoundsAndLowestPolyIdx(paths) {
        const rec = new Rect64(false); // ie invalid rect
        let lpX = Number.MIN_SAFE_INTEGER;
        let index = -1;
        for (let i = 0; i < paths.length; i++) {
            for (const pt of paths[i]) {
                if (pt.y >= rec.bottom) {
                    if (pt.y > rec.bottom || pt.x < lpX) {
                        index = i;
                        lpX = pt.x;
                        rec.bottom = pt.y;
                    }
                }
                else if (pt.y < rec.top)
                    rec.top = pt.y;
                if (pt.x > rec.right)
                    rec.right = pt.x;
                else if (pt.x < rec.left)
                    rec.left = pt.x;
            }
        }
        return { index, rec };
    }
    static translatePoint(pt, dx, dy) {
        return new PointD(pt.x + dx, pt.y + dy);
    }
    static reflectPoint(pt, pivot) {
        return new PointD(pivot.x + (pivot.x - pt.x), pivot.y + (pivot.y - pt.y));
    }
    static almostZero(value, epsilon = 0.001) {
        return Math.abs(value) < epsilon;
    }
    static hypotenuse(x, y) {
        return Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2));
    }
    static normalizeVector(vec) {
        const h = this.hypotenuse(vec.x, vec.y);
        if (this.almostZero(h))
            return new PointD(0, 0);
        const inverseHypot = 1 / h;
        return new PointD(vec.x * inverseHypot, vec.y * inverseHypot);
    }
    static getAvgUnitVector(vec1, vec2) {
        return this.normalizeVector(new PointD(vec1.x + vec2.x, vec1.y + vec2.y));
    }
    static intersectPoint(pt1a, pt1b, pt2a, pt2b) {
        if (InternalClipper.isAlmostZero(pt1a.x - pt1b.x)) { //vertical
            if (InternalClipper.isAlmostZero(pt2a.x - pt2b.x))
                return new PointD(0, 0);
            const m2 = (pt2b.y - pt2a.y) / (pt2b.x - pt2a.x);
            const b2 = pt2a.y - m2 * pt2a.x;
            return new PointD(pt1a.x, m2 * pt1a.x + b2);
        }
        if (InternalClipper.isAlmostZero(pt2a.x - pt2b.x)) { //vertical
            const m1 = (pt1b.y - pt1a.y) / (pt1b.x - pt1a.x);
            const b1 = pt1a.y - m1 * pt1a.x;
            return new PointD(pt2a.x, m1 * pt2a.x + b1);
        }
        else {
            const m1 = (pt1b.y - pt1a.y) / (pt1b.x - pt1a.x);
            const b1 = pt1a.y - m1 * pt1a.x;
            const m2 = (pt2b.y - pt2a.y) / (pt2b.x - pt2a.x);
            const b2 = pt2a.y - m2 * pt2a.x;
            if (InternalClipper.isAlmostZero(m1 - m2))
                return new PointD(0, 0);
            const x = (b2 - b1) / (m1 - m2);
            return new PointD(x, m1 * x + b1);
        }
    }
    getPerpendic(pt, norm) {
        return new Point64(pt.x + norm.x * this._groupDelta, pt.y + norm.y * this._groupDelta);
    }
    getPerpendicD(pt, norm) {
        return new PointD(pt.x + norm.x * this._groupDelta, pt.y + norm.y * this._groupDelta);
    }
    doSquare(group, path, j, k) {
        let vec;
        if (j === k) {
            vec = new PointD(this._normals[j].y, -this._normals[j].x);
        }
        else {
            vec = ClipperOffset.getAvgUnitVector(new PointD(-this._normals[k].y, this._normals[k].x), new PointD(this._normals[j].y, -this._normals[j].x));
        }
        const absDelta = Math.abs(this._groupDelta);
        // now offset the original vertex delta units along unit vector
        let ptQ = new PointD(path[j].x, path[j].y);
        ptQ = ClipperOffset.translatePoint(ptQ, absDelta * vec.x, absDelta * vec.y);
        // get perpendicular vertices
        const pt1 = ClipperOffset.translatePoint(ptQ, this._groupDelta * vec.y, this._groupDelta * -vec.x);
        const pt2 = ClipperOffset.translatePoint(ptQ, this._groupDelta * -vec.y, this._groupDelta * vec.x);
        // get 2 vertices along one edge offset
        const pt3 = this.getPerpendicD(path[k], this._normals[k]);
        if (j === k) {
            const pt4 = new PointD(pt3.x + vec.x * this._groupDelta, pt3.y + vec.y * this._groupDelta);
            const pt = ClipperOffset.intersectPoint(pt1, pt2, pt3, pt4);
            //get the second intersect point through reflection
            group.outPath.push(new Point64(ClipperOffset.reflectPoint(pt, ptQ).x, ClipperOffset.reflectPoint(pt, ptQ).y));
            group.outPath.push(new Point64(pt.x, pt.y));
        }
        else {
            const pt4 = this.getPerpendicD(path[j], this._normals[k]);
            const pt = ClipperOffset.intersectPoint(pt1, pt2, pt3, pt4);
            group.outPath.push(new Point64(pt.x, pt.y));
            //get the second intersect point through reflection
            group.outPath.push(new Point64(ClipperOffset.reflectPoint(pt, ptQ).x, ClipperOffset.reflectPoint(pt, ptQ).y));
        }
    }
    doMiter(group, path, j, k, cosA) {
        const q = this._groupDelta / (cosA + 1);
        group.outPath.push(new Point64(path[j].x + (this._normals[k].x + this._normals[j].x) * q, path[j].y + (this._normals[k].y + this._normals[j].y) * q));
    }
    doRound(group, path, j, k, angle) {
        if (typeof this.DeltaCallback !== "undefined") {
            const absDelta = Math.abs(this._groupDelta);
            const arcTol = this.ArcTolerance > 0.01
                ? this.ArcTolerance
                : Math.log10(2 + absDelta) * InternalClipper.defaultArcTolerance;
            const stepsPer360 = Math.PI / Math.acos(1 - arcTol / absDelta);
            this._stepSin = Math.sin((2 * Math.PI) / stepsPer360);
            this._stepCos = Math.cos((2 * Math.PI) / stepsPer360);
            if (this._groupDelta < 0.0)
                this._stepSin = -this._stepSin;
            this._stepsPerRad = stepsPer360 / (2 * Math.PI);
        }
        const pt = path[j];
        let offsetVec = new PointD(this._normals[k].x * this._groupDelta, this._normals[k].y * this._groupDelta);
        if (j === k)
            offsetVec.negate();
        group.outPath.push(new Point64(pt.x + offsetVec.x, pt.y + offsetVec.y));
        if (angle > -Math.PI + 0.01) {
            const steps = Math.ceil(this._stepsPerRad * Math.abs(angle));
            for (let i = 1; i < steps; i++) {
                offsetVec = new PointD(offsetVec.x * this._stepCos - this._stepSin * offsetVec.y, offsetVec.x * this._stepSin + offsetVec.y * this._stepCos);
                group.outPath.push(new Point64(pt.x + offsetVec.x, pt.y + offsetVec.y));
            }
        }
        group.outPath.push(this.getPerpendic(pt, this._normals[j]));
    }
    buildNormals(path) {
        const cnt = path.length;
        this._normals = [];
        this._normals.length = cnt;
        for (let i = 0; i < cnt - 1; i++) {
            this._normals.push(ClipperOffset.getUnitNormal(path[i], path[i + 1]));
        }
        this._normals.push(ClipperOffset.getUnitNormal(path[cnt - 1], path[0]));
    }
    crossProduct(vec1, vec2) {
        return (vec1.y * vec2.x - vec2.y * vec1.x);
    }
    dotProduct(vec1, vec2) {
        return (vec1.x * vec2.x + vec1.y * vec2.y);
    }
    offsetPoint(group, path, j, k) {
        const sinA = this.crossProduct(this._normals[j], this._normals[k]);
        let cosA = this.dotProduct(this._normals[j], this._normals[k]);
        if (sinA > 1.0)
            cosA = 1.0;
        else if (sinA < -1.0)
            cosA = -1.0;
        if (typeof this.DeltaCallback !== "undefined") {
            this._groupDelta = this.DeltaCallback(path, this._normals, j, k);
            if (group.pathsReversed)
                this._groupDelta = -this._groupDelta;
        }
        if (Math.abs(this._groupDelta) < ClipperOffset.Tolerance) {
            group.outPath.push(path[j]);
            return;
        }
        if (cosA > 0.999) {
            this.doMiter(group, path, j, k, cosA);
        }
        else if (cosA > -0.99 && (sinA * this._groupDelta < 0)) {
            group.outPath.push(this.getPerpendic(path[j], this._normals[k]));
            group.outPath.push(path[j]);
            group.outPath.push(this.getPerpendic(path[j], this._normals[j]));
        }
        else if (this._joinType === JoinType.Miter) {
            if (cosA > this._mitLimSqr - 1) {
                this.doMiter(group, path, j, k, cosA);
            }
            else {
                this.doSquare(group, path, j, k);
            }
        }
        else if (cosA > 0.99 || this._joinType === JoinType.Square) {
            this.doSquare(group, path, j, k);
        }
        else {
            this.doRound(group, path, j, k, Math.atan2(sinA, cosA));
        }
        k = j;
    }
    offsetPolygon(group, path) {
        const area = Clipper.area(path);
        if ((area < 0) !== (this._groupDelta < 0)) {
            const rect = Clipper.getBounds(path);
            if (Math.abs(this._groupDelta) * 2 > rect.width)
                return;
        }
        group.outPath = [];
        const cnt = path.length;
        const prev = cnt - 1;
        for (let i = 0; i < cnt; i++) {
            this.offsetPoint(group, path, i, prev);
        }
        group.outPaths.push(group.outPath);
    }
    offsetOpenJoined(group, path) {
        this.offsetPolygon(group, path);
        path = Clipper.reversePath(path);
        this.buildNormals(path);
        this.offsetPolygon(group, path);
    }
    offsetOpenPath(group, path) {
        group.outPath = [];
        const highI = path.length - 1;
        if (typeof this.DeltaCallback !== "undefined") {
            this._groupDelta = this.DeltaCallback(path, this._normals, 0, 0);
        }
        if (Math.abs(this._groupDelta) < ClipperOffset.Tolerance) {
            group.outPath.push(path[0]);
        }
        else {
            switch (this._endType) {
                case EndType.Butt:
                    group.outPath.push(new Point64(path[0].x - this._normals[0].x * this._groupDelta, path[0].y - this._normals[0].y * this._groupDelta));
                    group.outPath.push(this.getPerpendic(path[0], this._normals[0]));
                    break;
                case EndType.Round:
                    this.doRound(group, path, 0, 0, Math.PI);
                    break;
                default:
                    this.doSquare(group, path, 0, 0);
                    break;
            }
        }
        for (let i = 1, k = 0; i < highI; i++) {
            this.offsetPoint(group, path, i, k);
        }
        for (let i = highI; i > 0; i--) {
            this._normals[i] = new PointD(-this._normals[i - 1].x, -this._normals[i - 1].y);
        }
        this._normals[0] = this._normals[highI];
        if (typeof this.DeltaCallback !== "undefined") {
            this._groupDelta = this.DeltaCallback(path, this._normals, highI, highI);
        }
        if (Math.abs(this._groupDelta) < ClipperOffset.Tolerance) {
            group.outPath.push(path[highI]);
        }
        else {
            switch (this._endType) {
                case EndType.Butt:
                    group.outPath.push(new Point64(path[highI].x - this._normals[highI].x * this._groupDelta, path[highI].y - this._normals[highI].y * this._groupDelta));
                    group.outPath.push(this.getPerpendic(path[highI], this._normals[highI]));
                    break;
                case EndType.Round:
                    this.doRound(group, path, highI, highI, Math.PI);
                    break;
                default:
                    this.doSquare(group, path, highI, highI);
                    break;
            }
        }
        for (let i = highI, k = 0; i > 0; i--) {
            this.offsetPoint(group, path, i, k);
        }
        group.outPaths.push(group.outPath);
    }
    doGroupOffset(group) {
        if (group.endType == EndType.Polygon) {
            const { index } = ClipperOffset.getBoundsAndLowestPolyIdx(group.inPaths);
            if (index < 0)
                return;
            const area = Clipper.area(group.inPaths[index]);
            group.pathsReversed = area < 0;
            if (group.pathsReversed) {
                this._groupDelta = -this._delta;
            }
            else {
                this._groupDelta = this._delta;
            }
        }
        else {
            group.pathsReversed = false;
            this._groupDelta = Math.abs(this._delta) * 0.5;
        }
        const absDelta = Math.abs(this._groupDelta);
        this._joinType = group.joinType;
        this._endType = group.endType;
        if (!this.DeltaCallback &&
            (group.joinType == JoinType.Round || group.endType == EndType.Round)) {
            const arcTol = this.ArcTolerance > 0.01
                ? this.ArcTolerance
                : Math.log10(2 + absDelta) * InternalClipper.defaultArcTolerance;
            const stepsPer360 = Math.PI / Math.acos(1 - arcTol / absDelta);
            this._stepSin = Math.sin((2 * Math.PI) / stepsPer360);
            this._stepCos = Math.cos((2 * Math.PI) / stepsPer360);
            if (this._groupDelta < 0.0) {
                this._stepSin = -this._stepSin;
            }
            this._stepsPerRad = stepsPer360 / (2 * Math.PI);
        }
        const isJoined = group.endType == EndType.Joined || group.endType == EndType.Polygon;
        for (const p of group.inPaths) {
            const path = Clipper.stripDuplicates(p, isJoined);
            const cnt = path.length;
            if (cnt === 0 || (cnt < 3 && this._endType == EndType.Polygon)) {
                continue;
            }
            if (cnt == 1) {
                group.outPath = [];
                if (group.endType == EndType.Round) {
                    const r = absDelta;
                    group.outPath = Clipper.ellipse(path[0], r, r);
                }
                else {
                    const d = Math.ceil(this._groupDelta);
                    const r = new Rect64(path[0].x - d, path[0].y - d, path[0].x - d, path[0].y - d);
                    group.outPath = r.asPath();
                }
                group.outPaths.push(group.outPath);
            }
            else {
                if (cnt == 2 && group.endType == EndType.Joined) {
                    if (group.joinType == JoinType.Round) {
                        this._endType = EndType.Round;
                    }
                    else {
                        this._endType = EndType.Square;
                    }
                }
                this.buildNormals(path);
                if (this._endType == EndType.Polygon) {
                    this.offsetPolygon(group, path);
                }
                else if (this._endType == EndType.Joined) {
                    this.offsetOpenJoined(group, path);
                }
                else {
                    this.offsetOpenPath(group, path);
                }
            }
        }
        this._solution.push(...group.outPaths);
        group.outPaths = [];
    }
}
ClipperOffset.Tolerance = 1.0E-12;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib2Zmc2V0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vcHJvamVjdHMvY2xpcHBlcjItanMvc3JjL2xpYi9vZmZzZXQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7Z0ZBT2dGO0FBRWhGLEVBQUU7QUFDRix1SEFBdUg7QUFDdkgsNkJBQTZCO0FBQzdCLEVBQUU7QUFDRiw0R0FBNEc7QUFDNUcsRUFBRTtBQUVGLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxXQUFXLENBQUM7QUFDcEMsT0FBTyxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQVksZUFBZSxFQUFtQixPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sUUFBUSxDQUFDO0FBQ3pHLE9BQU8sRUFBRSxTQUFTLEVBQWMsTUFBTSxVQUFVLENBQUM7QUFFakQsTUFBTSxDQUFOLElBQVksUUFJWDtBQUpELFdBQVksUUFBUTtJQUNsQiwyQ0FBTSxDQUFBO0lBQ04seUNBQUssQ0FBQTtJQUNMLHlDQUFLLENBQUE7QUFDUCxDQUFDLEVBSlcsUUFBUSxLQUFSLFFBQVEsUUFJbkI7QUFFRCxNQUFNLENBQU4sSUFBWSxPQU1YO0FBTkQsV0FBWSxPQUFPO0lBQ2pCLDJDQUFPLENBQUE7SUFDUCx5Q0FBTSxDQUFBO0lBQ04scUNBQUksQ0FBQTtJQUNKLHlDQUFNLENBQUE7SUFDTix1Q0FBSyxDQUFBO0FBQ1AsQ0FBQyxFQU5XLE9BQU8sS0FBUCxPQUFPLFFBTWxCO0FBRUQsTUFBTSxLQUFLO0lBUVQsWUFBWSxLQUFjLEVBQUUsUUFBa0IsRUFBRSxVQUFtQixPQUFPLENBQUMsT0FBTztRQUNoRixJQUFJLENBQUMsT0FBTyxHQUFHLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLGtDQUFrQztRQUM3RCxJQUFJLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQztRQUN6QixJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQztRQUN2QixJQUFJLENBQUMsT0FBTyxHQUFHLEVB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LENBQUMsY0FBYyxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsV0FBVyxHQUFHLEdBQUcsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLFdBQVcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNuRyxNQUFNLEdBQUcsR0FBRyxhQUFhLENBQUMsY0FBYyxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsV0FBVyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsV0FBVyxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNuRyx1Q0FBdUM7UUFDdkMsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRTFELElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRTtZQUNYLE1BQU0sR0FBRyxHQUFHLElBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsV0FBVyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDM0YsTUFBTSxFQUFFLEdBQUcsYUFBYSxDQUFDLGNBQWMsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQztZQUM1RCxtREFBbUQ7WUFDbkQsS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxPQUFPLENBQUMsYUFBYSxDQUFDLFlBQVksQ0FBQyxFQUFFLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLGFBQWEsQ0FBQyxZQUFZLENBQUMsRUFBRSxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDOUcsS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxPQUFPLENBQUMsRUFBRSxDQUFDLENB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O0lBQ3RCLENBQUM7O0FBNWZjLHVCQUFTLEdBQVcsT0FBTyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcclxuKiBBdXRob3IgICAgOiAgQW5ndXMgSm9obnNvbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcclxuKiBEYXRlICAgICAgOiAgNyBBdWd1c3QgMjAyMyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcclxuKiBXZWJzaXRlICAgOiAgaHR0cDovL3d3dy5hbmd1c2ouY29tICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcclxuKiBDb3B5cmlnaHQgOiAgQW5ndXMgSm9obnNvbiAyMDEwLTIwMjMgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcclxuKiBQdXJwb3NlICAgOiAgUGF0aCBPZmZzZXQgKEluZmxhdGUvU2hyaW5rKSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcclxuKiBMaWNlbnNlICAgOiAgaHR0cDovL3d3dy5ib29zdC5vcmcvTElDRU5TRV8xXzAudHh0ICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcclxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cclxuXHJcbi8vXHJcbi8vIENvbnZlcnRlZCBmcm9tIEMjIGltcGxlbWVudGlvbiBodHRwczovL2dpdGh1Yi5jb20vQW5ndXNKb2huc29uL0NsaXBwZXIyL2Jsb2IvbWFpbi9DU2hhcnAvQ2xpcHBlcjJMaWIvQ2xpcHBlci5Db3JlLmNzXHJcbi8vIFJlbW92ZWQgc3VwcG9ydCBmb3IgVVNJTkdaXHJcbi8vXHJcbi8vIENvbnZlcnRlZCBieSBDaGF0R1BUIDQgQXVndXN0IDMgdmVyc2lvbiBodHRwczovL2hlbHAub3BlbmFpLmNvbS9lbi9hcnRpY2xlcy82ODI1NDUzLWNoYXRncHQtcmVsZWFzZS1ub3Rlc1xyXG4vL1xyXG5cclxuaW1wb3J0IHsgQ2xpcHBlciB9IGZyb20gXCIuL2NsaXBwZXJcIjtcclxuaW1wb3J0IHsgQ2xpcFR5cGUsIEZpbGxSdWxlLCBJUG9pbnQ2NCwgSW50ZXJuYWxDbGlwcGVyLCBQYXRoNjQsIFBhdGhzNjQsIFBvaW50NjQsIFJlY3Q2NCB9IGZyb20gXCIuL2NvcmVcIjtcclxuaW1wb3J0IHsgQ2xpcHBlcjY0LCBQb2x5VHJlZTY0IH0gZnJvbSBcIi4vZW5naW5lXCI7XHJcblxyXG5leHBvcnQgZW51bSBKb2luVHlwZSB7XHJcbiAgU3F1YXJlLFxyXG4gIFJvdW5kLFxyXG4gIE1pdGVyXHJcbn1cclxuXHJcbmV4cG9ydCBlbnVtIEVuZFR5cGUge1xyXG4gIFBvbHlnb24sXHJcbiAgSm9pbmVkLFxyXG4gIEJ1dHQsXHJcbiAgU3F1YXJlLFxyXG4gIFJvdW5kXHJcbn1cclxuXHJcbmNsYXNzIEdyb3VwIHtcclxuICBpblBhdGhzOiBQYXRoczY0O1xyXG4gIG91dFBhdGg6IFBhdGg2NDtcclxuICBvdXRQYXRoczogUGF0aHM2NDtcclxuICBqb2luVHlwZTogSm9pblR5cGU7XHJcbiAgZW5kVHlwZTogRW5kVHlwZTtcclxuICBwYXRoc1JldmVyc2VkOiBib29sZWFuO1xyXG5cclxuICBjb25zdHJ1Y3RvcihwYXRoczogUGF0aHM2NCwgam9pblR5cGU6IEpvaW5UeXBlLCBlbmRUeXBlOiBFbmRUeXBlID0gRW5kVHlwZS5Qb2x5Z29uKSB7XHJcbiAgICB0aGlzLmluUGF0aHMgPSBbLi4ucGF0aHNdOyAvLyBjcmVhdGVzIGEgc2hhbGxvdyBjb3B5IG9mIHBhdGhzXHJcbiAgICB0aGlzLmpvaW5UeXBlID0gam9pblR5cGU7XHJcbiAgICB0aGlzLmVuZFR5cGUgPSBlbmRUeXBlO1xyXG4gICAgdGhpcy5vdXRQYXRoID0gW107XHJcbiAgICB0aGlzLm91dFBhdGhzID0gW107XHJcbiAgICB0aGlzLnBhdGhzUmV2ZXJzZWQgPSBmYWxzZTtcclxuICB9XHJcbn1cclxuXHJcbmV4cG9ydCBjbGFzcyBQb2ludEQgaW1wbGVtZW50cyBJUG9pbnQ2NCB7XHJcbiAgcHVibGljIHg6IG51bWJlcjtcclxuICBwdWJsaWMgeTogbnVtYmVyO1xyXG5cclxuICBjb25zdHJ1Y3Rvcih4T3JQdDogbnVtYmVyIHwgUG9pbnREIHwgUG9pbnQ2NCwgeU9yU2NhbGU/OiBudW1iZXIpIHtcclxuICAgIGlmICh0eXBlb2YgeE9yUHQgPT09ICdudW1iZXInICYmIHR5cGVvZiB5T3JTY2FsZSA9PT0gJ251bWJlcicpIHtcclxuICAgICAgdGhpcy54ID0geE9yUHQ7XHJcbiAgICAgIHRoaXMueSA9IHlPclNjYWxlO1xyXG4gICAgfSBlbHNlIGlmICh4T3JQdCBpbnN0YW5jZW9mIFBvaW50RCkge1xyXG4gICAgICBpZiAoeU9yU2NhbGUgIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgIHRoaXMueCA9IHhPclB0LnggKiB5T3JTY2FsZTtcclxuICAgICAgICB0aGlzLnkgPSB4T3JQdC55ICogeU9yU2NhbGU7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgdGhpcy54ID0geE9yUHQueDtcclxuICAgICAgICB0aGlzLnkgPSB4T3JQdC55O1xyXG4gICAgICB9XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aGlzLnggPSAoPFBvaW50NjQ+eE9yUHQpLnggKiAoeU9yU2NhbGUgfHwgMSk7XHJcbiAgICAgIHRoaXMueSA9ICg8UG9pbnQ2ND54T3JQdCkueSAqICh5T3JTY2FsZSB8fCAxKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHB1YmxpYyB0b1N0cmluZyhwcmVjaXNpb246IG51bWJlciA9IDIpOiBzdHJpbmcge1xyXG4gICAgcmV0dXJuIGAke3RoaXMueC50b0ZpeGVkKHByZWNpc2lvbil9LCR7dGhpcy55LnRvRml4ZWQocHJlY2lzaW9uKX1gO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIHN0YXRpYyBlcXVhbHMobGhzOiBQb2ludEQsIHJoczogUG9pbnREKTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gSW50ZXJuYWxDbGlwcGVyLmlzQWxtb3N0WmVybyhsaHMueCAtIHJocy54KSAmJlxyXG4gICAgICBJbnRlcm5hbENsaXBwZXIuaXNBbG1vc3RaZXJvKGxocy55IC0gcmhzLnkpO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIHN0YXRpYyBub3RFcXVhbHMobGhzOiBQb2ludEQsIHJoczogUG9pbnREKTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gIUludGVybmFsQ2xpcHBlci5pc0FsbW9zdFplcm8obGhzLnggLSByaHMueCkgfHxcclxuICAgICAgIUludGVybmFsQ2xpcHBlci5pc0FsbW9zdFplcm8obGhzLnkgLSByaHMueSk7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgZXF1YWxzKG9iajogUG9pbnREKTogYm9vbGVhbiB7XHJcbiAgICBpZiAob2JqIGluc3RhbmNlb2YgUG9pbnREKSB7XHJcbiAgICAgIHJldHVybiBQb2ludEQuZXF1YWxzKHRoaXMsIG9iaik7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gZmFsc2U7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgbmVnYXRlKCk6IHZvaWQge1xyXG4gICAgdGhpcy54ID0gLXRoaXMueDtcclxuICAgIHRoaXMueSA9IC10aGlzLnk7XHJcbiAgfVxyXG5cclxuICAvLyAgcHVibGljIGdldEhhc2hDb2RlKCk6IG51bWJlciB7XHJcbiAgLy8gICAgcmV0dXJuIHRoaXMueCBeIHRoaXMueTsgIC8vIFhPUi1iYXNlZCBoYXNoIGNvbWJpbmF0aW9uLiBBZGp1c3QgaWYgbmVlZGVkLlxyXG4gIC8vICB9XHJcbn1cclxuXHJcbmV4cG9ydCBjbGFzcyBDbGlwcGVyT2Zmc2V0IHtcclxuXHJcbiAgcHJpdmF0ZSBzdGF0aWMgVG9sZXJhbmNlOiBudW1iZXIgPSAxLjBFLTEyO1xyXG4gIHByaXZhdGUgX2dyb3VwTGlzdDogQXJyYXk8R3JvdXA+ID0gW107XHJcbiAgcHJpdmF0ZSBfbm9ybWFsczogQXJyYXk8UG9pbnREPiA9IFtdO1xyXG4gIHByaXZhdGUgX3NvbHV0aW9uOiBQYXRoczY0ID0gW107XHJcbiAgcHJpdmF0ZSBfZ3JvdXBEZWx0YSE6IG51bWJlcjsgLy8qMC41IGZvciBvcGVuIHBhdGhzOyAqLTEuMCBmb3IgbmVnYXRpdmUgYXJlYXNcclxuICBwcml2YXRlIF9kZWx0YSE6IG51bWJlcjtcclxuICBwcml2YXRlIF9taXRMaW1TcXIhOiBudW1iZXI7XHJcbiAgcHJpdmF0ZSBfc3RlcHNQZXJSYWQhOiBudW1iZXI7XHJcbiAgcHJpdmF0ZSBfc3RlcFNpbiE6IG51bWJlcjtcclxuICBwcml2YXRlIF9zdGVwQ29zITogbnVtYmVyO1xyXG4gIHByaXZhdGUgX2pvaW5UeXBlITogSm9pblR5cGU7XHJcbiAgcHJpdmF0ZSBfZW5kVHlwZSE6IEVuZFR5cGU7XHJcbiAgcHVibGljIEFyY1RvbGVyYW5jZTogbnVtYmVyO1xyXG4gIHB1YmxpYyBNZXJnZUdyb3VwczogYm9vbGVhbjtcclxuICBwdWJsaWMgTWl0ZXJMaW1pdDogbnVtYmVyO1xyXG4gIHB1YmxpYyBQcmVzZXJ2ZUNvbGxpbmVhcjogYm9vbGVhbjtcclxuICBwdWJsaWMgUmV2ZXJzZVNvbHV0aW9uOiBib29sZWFuO1xyXG5cclxuICBwdWJsaWMgRGVsdGFDYWxsYmFjaz86IChwYXRoOiBJUG9pbnQ2NFtdLCBwYXRoX25vcm1zOiBQb2ludERbXSwgY3VyclB0OiBudW1iZXIsIHByZXZQdDogbnVtYmVyKSA9PiBudW1iZXI7XHJcblxyXG4gIGNvbnN0cnVjdG9yKG1pdGVyTGltaXQ6IG51bWJlciA9IDIuMCwgYXJjVG9sZXJhbmNlOiBudW1iZXIgPSAwLjAsXHJcbiAgICBwcmVzZXJ2ZUNvbGxpbmVhcjogYm9vbGVhbiA9IGZhbHNlLCByZXZlcnNlU29sdXRpb246IGJvb2xlYW4gPSBmYWxzZSkge1xyXG4gICAgdGhpcy5NaXRlckxpbWl0ID0gbWl0ZXJMaW1pdDtcclxuICAgIHRoaXMuQXJjVG9sZXJhbmNlID0gYXJjVG9sZXJhbmNlO1xyXG4gICAgdGhpcy5NZXJnZUdyb3VwcyA9IHRydWU7XHJcbiAgICB0aGlzLlByZXNlcnZlQ29sbGluZWFyID0gcHJlc2VydmVDb2xsaW5lYXI7XHJcbiAgICB0aGlzLlJldmVyc2VTb2x1dGlvbiA9IHJldmVyc2VTb2x1dGlvbjtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBjbGVhcigpOiB2b2lkIHtcclxuICAgIHRoaXMuX2dyb3VwTGlzdCA9IFtdO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGFkZFBhdGgocGF0aDogUG9pbnQ2NFtdLCBqb2luVHlwZTogSm9pblR5cGUsIGVuZFR5cGU6IEVuZFR5cGUpOiB2b2lkIHtcclxuICAgIGlmIChwYXRoLmxlbmd0aCA9PT0gMCkgcmV0dXJuO1xyXG4gICAgY29uc3QgcHA6IFBvaW50NjRbXVtdID0gW3BhdGhdO1xyXG4gICAgdGhpcy5hZGRQYXRocyhwcCwgam9pblR5cGUsIGVuZFR5cGUpO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGFkZFBhdGhzKHBhdGhzOiBQYXRoczY0LCBqb2luVHlwZTogSm9pblR5cGUsIGVuZFR5cGU6IEVuZFR5cGUpOiB2b2lkIHtcclxuICAgIGlmIChwYXRocy5sZW5ndGggPT09IDApIHJldHVybjtcclxuICAgIHRoaXMuX2dyb3VwTGlzdC5wdXNoKG5ldyBHcm91cChwYXRocywgam9pblR5cGUsIGVuZFR5cGUpKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZXhlY3V0ZUludGVybmFsKGRlbHRhOiBudW1iZXIpOiB2b2lkIHtcclxuICAgIHRoaXMuX3NvbHV0aW9uID0gW107XHJcbiAgICBpZiAodGhpcy5fZ3JvdXBMaXN0Lmxlbmd0aCA9PT0gMCkgcmV0dXJuO1xyXG5cclxuICAgIGlmIChNYXRoLmFicyhkZWx0YSkgPCAwLjUpIHtcclxuICAgICAgZm9yIChjb25zdCBncm91cCBvZiB0aGlzLl9ncm91cExpc3QpIHtcclxuICAgICAgICBmb3IgKGNvbnN0IHBhdGggb2YgZ3JvdXAuaW5QYXRocykge1xyXG4gICAgICAgICAgdGhpcy5fc29sdXRpb24ucHVzaChwYXRoKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRoaXMuX2RlbHRhID0gZGVsdGE7XHJcbiAgICAgIHRoaXMuX21pdExpbVNxciA9ICh0aGlzLk1pdGVyTGltaXQgPD0gMSA/IDIuMCA6IDIuMCAvIHRoaXMuc3FyKHRoaXMuTWl0ZXJMaW1pdCkpO1xyXG4gICAgICBmb3IgKGNvbnN0IGdyb3VwIG9mIHRoaXMuX2dyb3VwTGlzdCkge1xyXG4gICAgICAgIHRoaXMuZG9Hcm91cE9mZnNldChncm91cCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgc3FyKHZhbHVlOiBudW1iZXIpOiBudW1iZXIge1xyXG4gICAgcmV0dXJuIHZhbHVlICogdmFsdWU7XHJcbiAgfVxyXG5cclxuXHJcbiAgcHVibGljIGV4ZWN1dGUoZGVsdGE6IG51bWJlciwgc29sdXRpb246IFBhdGhzNjQpOiB2b2lkIHtcclxuICAgIHNvbHV0aW9uLmxlbmd0aCA9IDA7XHJcbiAgICB0aGlzLmV4ZWN1dGVJbnRlcm5hbChkZWx0YSk7XHJcbiAgICBpZiAodGhpcy5fZ3JvdXBMaXN0Lmxlbmd0aCA9PT0gMCkgcmV0dXJuO1xyXG5cclxuICAgIC8vIGNsZWFuIHVwIHNlbGYtaW50ZXJzZWN0aW9ucyAuLi5cclxuICAgIGNvbnN0IGMgPSBuZXcgQ2xpcHBlcjY0KClcclxuICAgIGMucHJlc2VydmVDb2xsaW5lYXIgPSB0aGlzLlByZXNlcnZlQ29sbGluZWFyXHJcbiAgICAvLyB0aGUgc29sdXRpb24gc2hvdWxkIHJldGFpbiB0aGUgb3JpZW50YXRpb24gb2YgdGhlIGlucHV0XHJcbiAgICBjLnJldmVyc2VTb2x1dGlvbiA9IHRoaXMuUmV2ZXJzZVNvbHV0aW9uICE9PSB0aGlzLl9ncm91cExpc3RbMF0ucGF0aHNSZXZlcnNlZFxyXG5cclxuICAgIGMuYWRkU3ViamVjdFBhdGhzKHRoaXMuX3NvbHV0aW9uKTtcclxuICAgIGlmICh0aGlzLl9ncm91cExpc3RbMF0ucGF0aHNSZXZlcnNlZClcclxuICAgICAgYy5leGVjdXRlKENsaXBUeXBlLlVuaW9uLCBGaWxsUnVsZS5OZWdhdGl2ZSwgc29sdXRpb24pO1xyXG4gICAgZWxzZVxyXG4gICAgICBjLmV4ZWN1dGUoQ2xpcFR5cGUuVW5pb24sIEZpbGxSdWxlLlBvc2l0aXZlLCBzb2x1dGlvbik7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgZXhlY3V0ZVBvbHl0cmVlKGRlbHRhOiBudW1iZXIsIHBvbHl0cmVlOiBQb2x5VHJlZTY0KTogdm9pZCB7XHJcbiAgICBwb2x5dHJlZS5jbGVhcigpO1xyXG4gICAgdGhpcy5leGVjdXRlSW50ZXJuYWwoZGVsdGEpO1xyXG4gICAgaWYgKHRoaXMuX2dyb3VwTGlzdC5sZW5ndGggPT09IDApIHJldHVybjtcclxuXHJcbiAgICAvLyBjbGVhbiB1cCBzZWxmLWludGVyc2VjdGlvbnMgLi4uXHJcbiAgICBjb25zdCBjID0gbmV3IENsaXBwZXI2NCgpXHJcbiAgICBjLnByZXNlcnZlQ29sbGluZWFyID0gdGhpcy5QcmVzZXJ2ZUNvbGxpbmVhclxyXG4gICAgLy8gdGhlIHNvbHV0aW9uIHNob3VsZCByZXRhaW4gdGhlIG9yaWVudGF0aW9uIG9mIHRoZSBpbnB1dFxyXG4gICAgYy5yZXZlcnNlU29sdXRpb24gPSB0aGlzLlJldmVyc2VTb2x1dGlvbiAhPT0gdGhpcy5fZ3JvdXBMaXN0WzBdLnBhdGhzUmV2ZXJzZWRcclxuXHJcbiAgICBjLmFkZFN1YmplY3RQYXRocyh0aGlzLl9zb2x1dGlvbik7XHJcbiAgICBpZiAodGhpcy5fZ3JvdXBMaXN0WzBdLnBhdGhzUmV2ZXJzZWQpXHJcbiAgICAgIGMuZXhlY3V0ZVBvbHlUcmVlKENsaXBUeXBlLlVuaW9uLCBGaWxsUnVsZS5OZWdhdGl2ZSwgcG9seXRyZWUpO1xyXG4gICAgZWxzZVxyXG4gICAgICBjLmV4ZWN1dGVQb2x5VHJlZShDbGlwVHlwZS5VbmlvbiwgRmlsbFJ1bGUuUG9zaXRpdmUsIHBvbHl0cmVlKTtcclxuICB9XHJcblxyXG4gIHByb3RlY3RlZCBzdGF0aWMgZ2V0VW5pdE5vcm1hbChwdDE6IElQb2ludDY0LCBwdDI6IElQb2ludDY0KTogUG9pbnREIHtcclxuICAgIGxldCBkeCA9IHB0Mi54IC0gcHQxLng7XHJcbiAgICBsZXQgZHkgPSBwdDIueSAtIHB0MS55O1xyXG4gICAgaWYgKGR4ID09PSAwICYmIGR5ID09PSAwKSByZXR1cm4gbmV3IFBvaW50RCgwLCAwKTtcclxuXHJcbiAgICBjb25zdCBmID0gMS4wIC8gTWF0aC5zcXJ0KGR4ICogZHggKyBkeSAqIGR5KTtcclxuICAgIGR4ICo9IGY7XHJcbiAgICBkeSAqPSBmO1xyXG5cclxuICAgIHJldHVybiBuZXcgUG9pbnREKGR5LCAtZHgpO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGV4ZWN1dGVDYWxsYmFjayhkZWx0YUNhbGxiYWNrOiAocGF0aDogSVBvaW50NjRbXSwgcGF0aF9ub3JtczogUG9pbnREW10sIGN1cnJQdDogbnVtYmVyLCBwcmV2UHQ6IG51bWJlcikgPT4gbnVtYmVyLCBzb2x1dGlvbjogUG9pbnQ2NFtdW10pOiB2b2lkIHtcclxuICAgIHRoaXMuRGVsdGFDYWxsYmFjayA9IGRlbHRhQ2FsbGJhY2s7XHJcbiAgICB0aGlzLmV4ZWN1dGUoMS4wLCBzb2x1dGlvbik7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHN0YXRpYyBnZXRCb3VuZHNBbmRMb3dlc3RQb2x5SWR4KHBhdGhzOiBQYXRoczY0KTogeyBpbmRleDogbnVtYmVyLCByZWM6IFJlY3Q2NCB9IHtcclxuICAgIGNvbnN0IHJlYyA9IG5ldyBSZWN0NjQoZmFsc2UpOyAvLyBpZSBpbnZhbGlkIHJlY3RcclxuICAgIGxldCBscFg6IG51bWJlciA9IE51bWJlci5NSU5fU0FGRV9JTlRFR0VSO1xyXG4gICAgbGV0IGluZGV4ID0gLTE7XHJcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBhdGhzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgIGZvciAoY29uc3QgcHQgb2YgcGF0aHNbaV0pIHtcclxuICAgICAgICBpZiAocHQueSA+PSByZWMuYm90dG9tKSB7XHJcbiAgICAgICAgICBpZiAocHQueSA+IHJlYy5ib3R0b20gfHwgcHQueCA8IGxwWCkge1xyXG4gICAgICAgICAgICBpbmRleCA9IGk7XHJcbiAgICAgICAgICAgIGxwWCA9IHB0Lng7XHJcbiAgICAgICAgICAgIHJlYy5ib3R0b20gPSBwdC55O1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0gZWxzZSBpZiAocHQueSA8IHJlYy50b3ApIHJlYy50b3AgPSBwdC55O1xyXG4gICAgICAgIGlmIChwdC54ID4gcmVjLnJpZ2h0KSByZWMucmlnaHQgPSBwdC54O1xyXG4gICAgICAgIGVsc2UgaWYgKHB0LnggPCByZWMubGVmdCkgcmVjLmxlZnQgPSBwdC54O1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4geyBpbmRleCwgcmVjIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgc3RhdGljIHRyYW5zbGF0ZVBvaW50KHB0OiBQb2ludEQsIGR4OiBudW1iZXIsIGR5OiBudW1iZXIpOiBQb2ludEQge1xyXG4gICAgcmV0dXJuIG5ldyBQb2ludEQocHQueCArIGR4LCBwdC55ICsgZHkpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBzdGF0aWMgcmVmbGVjdFBvaW50KHB0OiBQb2ludEQsIHBpdm90OiBQb2ludEQpOiBQb2ludEQge1xyXG4gICAgcmV0dXJuIG5ldyBQb2ludEQocGl2b3QueCArIChwaXZvdC54IC0gcHQueCksIHBpdm90LnkgKyAocGl2b3QueSAtIHB0LnkpKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgc3RhdGljIGFsbW9zdFplcm8odmFsdWU6IG51bWJlciwgZXBzaWxvbjogbnVtYmVyID0gMC4wMDEpOiBib29sZWFuIHtcclxuICAgIHJldHVybiBNYXRoLmFicyh2YWx1ZSkgPCBlcHNpbG9uO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBzdGF0aWMgaHlwb3RlbnVzZSh4OiBudW1iZXIsIHk6IG51bWJlcik6IG51bWJlciB7XHJcbiAgICByZXR1cm4gTWF0aC5zcXJ0KE1hdGgucG93KHgsIDIpICsgTWF0aC5wb3coeSwgMikpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBzdGF0aWMgbm9ybWFsaXplVmVjdG9yKHZlYzogUG9pbnREKTogUG9pbnREIHtcclxuICAgIGNvbnN0IGggPSB0aGlzLmh5cG90ZW51c2UodmVjLngsIHZlYy55KTtcclxuICAgIGlmICh0aGlzLmFsbW9zdFplcm8oaCkpIHJldHVybiBuZXcgUG9pbnREKDAsIDApO1xyXG4gICAgY29uc3QgaW52ZXJzZUh5cG90ID0gMSAvIGg7XHJcbiAgICByZXR1cm4gbmV3IFBvaW50RCh2ZWMueCAqIGludmVyc2VIeXBvdCwgdmVjLnkgKiBpbnZlcnNlSHlwb3QpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBzdGF0aWMgZ2V0QXZnVW5pdFZlY3Rvcih2ZWMxOiBQb2ludEQsIHZlYzI6IFBvaW50RCk6IFBvaW50RCB7XHJcbiAgICByZXR1cm4gdGhpcy5ub3JtYWxpemVWZWN0b3IobmV3IFBvaW50RCh2ZWMxLnggKyB2ZWMyLngsIHZlYzEueSArIHZlYzIueSkpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBzdGF0aWMgaW50ZXJzZWN0UG9pbnQocHQxYTogUG9pbnRELCBwdDFiOiBQb2ludEQsIHB0MmE6IFBvaW50RCwgcHQyYjogUG9pbnREKTogUG9pbnREIHtcclxuICAgIGlmIChJbnRlcm5hbENsaXBwZXIuaXNBbG1vc3RaZXJvKHB0MWEueCAtIHB0MWIueCkpIHsgLy92ZXJ0aWNhbFxyXG4gICAgICBpZiAoSW50ZXJuYWxDbGlwcGVyLmlzQWxtb3N0WmVybyhwdDJhLnggLSBwdDJiLngpKSByZXR1cm4gbmV3IFBvaW50RCgwLCAwKTtcclxuICAgICAgY29uc3QgbTIgPSAocHQyYi55IC0gcHQyYS55KSAvIChwdDJiLnggLSBwdDJhLngpO1xyXG4gICAgICBjb25zdCBiMiA9IHB0MmEueSAtIG0yICogcHQyYS54O1xyXG4gICAgICByZXR1cm4gbmV3IFBvaW50RChwdDFhLngsIG0yICogcHQxYS54ICsgYjIpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChJbnRlcm5hbENsaXBwZXIuaXNBbG1vc3RaZXJvKHB0MmEueCAtIHB0MmIueCkpIHsgLy92ZXJ0aWNhbFxyXG4gICAgICBjb25zdCBtMSA9IChwdDFiLnkgLSBwdDFhLnkpIC8gKHB0MWIueCAtIHB0MWEueCk7XHJcbiAgICAgIGNvbnN0IGIxID0gcHQxYS55IC0gbTEgKiBwdDFhLng7XHJcbiAgICAgIHJldHVybiBuZXcgUG9pbnREKHB0MmEueCwgbTEgKiBwdDJhLnggKyBiMSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBjb25zdCBtMSA9IChwdDFiLnkgLSBwdDFhLnkpIC8gKHB0MWIueCAtIHB0MWEueCk7XHJcbiAgICAgIGNvbnN0IGIxID0gcHQxYS55IC0gbTEgKiBwdDFhLng7XHJcbiAgICAgIGNvbnN0IG0yID0gKHB0MmIueSAtIHB0MmEueSkgLyAocHQyYi54IC0gcHQyYS54KTtcclxuICAgICAgY29uc3QgYjIgPSBwdDJhLnkgLSBtMiAqIHB0MmEueDtcclxuICAgICAgaWYgKEludGVybmFsQ2xpcHBlci5pc0FsbW9zdFplcm8obTEgLSBtMikpIHJldHVybiBuZXcgUG9pbnREKDAsIDApO1xyXG4gICAgICBjb25zdCB4ID0gKGIyIC0gYjEpIC8gKG0xIC0gbTIpO1xyXG4gICAgICByZXR1cm4gbmV3IFBvaW50RCh4LCBtMSAqIHggKyBiMSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGdldFBlcnBlbmRpYyhwdDogSVBvaW50NjQsIG5vcm06IFBvaW50RCk6IFBvaW50NjQge1xyXG4gICAgcmV0dXJuIG5ldyBQb2ludDY0KHB0LnggKyBub3JtLnggKiB0aGlzLl9ncm91cERlbHRhLCBwdC55ICsgbm9ybS55ICogdGhpcy5fZ3JvdXBEZWx0YSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGdldFBlcnBlbmRpY0QocHQ6IElQb2ludDY0LCBub3JtOiBQb2ludEQpOiBQb2ludEQge1xyXG4gICAgcmV0dXJuIG5ldyBQb2ludEQocHQueCArIG5vcm0ueCAqIHRoaXMuX2dyb3VwRGVsdGEsIHB0LnkgKyBub3JtLnkgKiB0aGlzLl9ncm91cERlbHRhKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZG9TcXVhcmUoZ3JvdXA6IEdyb3VwLCBwYXRoOiBQYXRoNjQsIGo6IG51bWJlciwgazogbnVtYmVyKTogdm9pZCB7XHJcbiAgICBsZXQgdmVjOiBQb2ludEQ7XHJcbiAgICBpZiAoaiA9PT0gaykge1xyXG4gICAgICB2ZWMgPSBuZXcgUG9pbnREKHRoaXMuX25vcm1hbHNbal0ueSwgLXRoaXMuX25vcm1hbHNbal0ueCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB2ZWMgPSBDbGlwcGVyT2Zmc2V0LmdldEF2Z1VuaXRWZWN0b3IoXHJcbiAgICAgICAgbmV3IFBvaW50RCgtdGhpcy5fbm9ybWFsc1trXS55LCB0aGlzLl9ub3JtYWxzW2tdLngpLFxyXG4gICAgICAgIG5ldyBQb2ludEQodGhpcy5fbm9ybWFsc1tqXS55LCAtdGhpcy5fbm9ybWFsc1tqXS54KVxyXG4gICAgICApO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGFic0RlbHRhID0gTWF0aC5hYnModGhpcy5fZ3JvdXBEZWx0YSk7XHJcbiAgICAvLyBub3cgb2Zmc2V0IHRoZSBvcmlnaW5hbCB2ZXJ0ZXggZGVsdGEgdW5pdHMgYWxvbmcgdW5pdCB2ZWN0b3JcclxuICAgIGxldCBwdFEgPSBuZXcgUG9pbnREKHBhdGhbal0ueCwgcGF0aFtqXS55KTsgXHJcbiAgICBwdFEgPSBDbGlwcGVyT2Zmc2V0LnRyYW5zbGF0ZVBvaW50KHB0USwgYWJzRGVsdGEgKiB2ZWMueCwgYWJzRGVsdGEgKiB2ZWMueSk7XHJcblxyXG4gICAgLy8gZ2V0IHBlcnBlbmRpY3VsYXIgdmVydGljZXNcclxuICAgIGNvbnN0IHB0MSA9IENsaXBwZXJPZmZzZXQudHJhbnNsYXRlUG9pbnQocHRRLCB0aGlzLl9ncm91cERlbHRhICogdmVjLnksIHRoaXMuX2dyb3VwRGVsdGEgKiAtdmVjLngpO1xyXG4gICAgY29uc3QgcHQyID0gQ2xpcHBlck9mZnNldC50cmFuc2xhdGVQb2ludChwdFEsIHRoaXMuX2dyb3VwRGVsdGEgKiAtdmVjLnksIHRoaXMuX2dyb3VwRGVsdGEgKiB2ZWMueCk7XHJcbiAgICAvLyBnZXQgMiB2ZXJ0aWNlcyBhbG9uZyBvbmUgZWRnZSBvZmZzZXRcclxuICAgIGNvbnN0IHB0MyA9IHRoaXMuZ2V0UGVycGVuZGljRChwYXRoW2tdLCB0aGlzLl9ub3JtYWxzW2tdKTtcclxuXHJcbiAgICBpZiAoaiA9PT0gaykge1xyXG4gICAgICBjb25zdCBwdDQgPSBuZXcgUG9pbnREKHB0My54ICsgdmVjLnggKiB0aGlzLl9ncm91cERlbHRhLCBwdDMueSArIHZlYy55ICogdGhpcy5fZ3JvdXBEZWx0YSk7XHJcbiAgICAgIGNvbnN0IHB0ID0gQ2xpcHBlck9mZnNldC5pbnRlcnNlY3RQb2ludChwdDEsIHB0MiwgcHQzLCBwdDQpO1xyXG4gICAgICAvL2dldCB0aGUgc2Vjb25kIGludGVyc2VjdCBwb2ludCB0aHJvdWdoIHJlZmxlY3Rpb25cclxuICAgICAgZ3JvdXAub3V0UGF0aC5wdXNoKG5ldyBQb2ludDY0KENsaXBwZXJPZmZzZXQucmVmbGVjdFBvaW50KHB0LCBwdFEpLngsIENsaXBwZXJPZmZzZXQucmVmbGVjdFBvaW50KHB0LCBwdFEpLnkpKTtcclxuICAgICAgZ3JvdXAub3V0UGF0aC5wdXNoKG5ldyBQb2ludDY0KHB0LngsIHB0LnkpKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGNvbnN0IHB0NCA9IHRoaXMuZ2V0UGVycGVuZGljRChwYXRoW2pdLCB0aGlzLl9ub3JtYWxzW2tdKTtcclxuICAgICAgY29uc3QgcHQgPSBDbGlwcGVyT2Zmc2V0LmludGVyc2VjdFBvaW50KHB0MSwgcHQyLCBwdDMsIHB0NCk7XHJcbiAgICAgIGdyb3VwLm91dFBhdGgucHVzaChuZXcgUG9pbnQ2NChwdC54LCBwdC55KSk7XHJcbiAgICAgIC8vZ2V0IHRoZSBzZWNvbmQgaW50ZXJzZWN0IHBvaW50IHRocm91Z2ggcmVmbGVjdGlvblxyXG4gICAgICBncm91cC5vdXRQYXRoLnB1c2gobmV3IFBvaW50NjQoQ2xpcHBlck9mZnNldC5yZWZsZWN0UG9pbnQocHQsIHB0USkueCwgQ2xpcHBlck9mZnNldC5yZWZsZWN0UG9pbnQocHQsIHB0USkueSkpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBkb01pdGVyKGdyb3VwOiBHcm91cCwgcGF0aDogUGF0aDY0LCBqOiBudW1iZXIsIGs6IG51bWJlciwgY29zQTogbnVtYmVyKTogdm9pZCB7XHJcbiAgICBjb25zdCBxID0gdGhpcy5fZ3JvdXBEZWx0YSAvIChjb3NBICsgMSk7XHJcbiAgICBncm91cC5vdXRQYXRoLnB1c2gobmV3IFBvaW50NjQoXHJcbiAgICAgIHBhdGhbal0ueCArICh0aGlzLl9ub3JtYWxzW2tdLnggKyB0aGlzLl9ub3JtYWxzW2pdLngpICogcSxcclxuICAgICAgcGF0aFtqXS55ICsgKHRoaXMuX25vcm1hbHNba10ueSArIHRoaXMuX25vcm1hbHNbal0ueSkgKiBxXHJcbiAgICApKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZG9Sb3VuZChncm91cDogR3JvdXAsIHBhdGg6IFBhdGg2NCwgajogbnVtYmVyLCBrOiBudW1iZXIsIGFuZ2xlOiBudW1iZXIpOiB2b2lkIHtcclxuICAgIGlmICh0eXBlb2YgdGhpcy5EZWx0YUNhbGxiYWNrICE9PSBcInVuZGVmaW5lZFwiKSB7XHJcbiAgICAgIGNvbnN0IGFic0RlbHRhID0gTWF0aC5hYnModGhpcy5fZ3JvdXBEZWx0YSk7XHJcbiAgICAgIGNvbnN0IGFyY1RvbCA9IHRoaXMuQXJjVG9sZXJhbmNlID4gMC4wMVxyXG4gICAgICAgID8gdGhpcy5BcmNUb2xlcmFuY2VcclxuICAgICAgICA6IE1hdGgubG9nMTAoMiArIGFic0RlbHRhKSAqIEludGVybmFsQ2xpcHBlci5kZWZhdWx0QXJjVG9sZXJhbmNlO1xyXG4gICAgICBjb25zdCBzdGVwc1BlcjM2MCA9IE1hdGguUEkgLyBNYXRoLmFjb3MoMSAtIGFyY1RvbCAvIGFic0RlbHRhKTtcclxuICAgICAgdGhpcy5fc3RlcFNpbiA9IE1hdGguc2luKCgyICogTWF0aC5QSSkgLyBzdGVwc1BlcjM2MCk7XHJcbiAgICAgIHRoaXMuX3N0ZXBDb3MgPSBNYXRoLmNvcygoMiAqIE1hdGguUEkpIC8gc3RlcHNQZXIzNjApO1xyXG4gICAgICBpZiAodGhpcy5fZ3JvdXBEZWx0YSA8IDAuMCkgdGhpcy5fc3RlcFNpbiA9IC10aGlzLl9zdGVwU2luO1xyXG4gICAgICB0aGlzLl9zdGVwc1BlclJhZCA9IHN0ZXBzUGVyMzYwIC8gKDIgKiBNYXRoLlBJKTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBwdCA9IHBhdGhbal07XHJcbiAgICBsZXQgb2Zmc2V0VmVjID0gbmV3IFBvaW50RCh0aGlzLl9ub3JtYWxzW2tdLnggKiB0aGlzLl9ncm91cERlbHRhLCB0aGlzLl9ub3JtYWxzW2tdLnkgKiB0aGlzLl9ncm91cERlbHRhKTtcclxuICAgIGlmIChqID09PSBrKSBvZmZzZXRWZWMubmVnYXRlKCk7XHJcbiAgICBncm91cC5vdXRQYXRoLnB1c2gobmV3IFBvaW50NjQocHQueCArIG9mZnNldFZlYy54LCBwdC55ICsgb2Zmc2V0VmVjLnkpKTtcclxuICAgIGlmIChhbmdsZSA+IC1NYXRoLlBJICsgMC4wMSkge1xyXG4gICAgICBjb25zdCBzdGVwcyA9IE1hdGguY2VpbCh0aGlzLl9zdGVwc1BlclJhZCAqIE1hdGguYWJzKGFuZ2xlKSk7XHJcbiAgICAgIGZvciAobGV0IGkgPSAxOyBpIDwgc3RlcHM7IGkrKykge1xyXG4gICAgICAgIG9mZnNldFZlYyA9IG5ldyBQb2ludEQoXHJcbiAgICAgICAgICBvZmZzZXRWZWMueCAqIHRoaXMuX3N0ZXBDb3MgLSB0aGlzLl9zdGVwU2luICogb2Zmc2V0VmVjLnksXHJcbiAgICAgICAgICBvZmZzZXRWZWMueCAqIHRoaXMuX3N0ZXBTaW4gKyBvZmZzZXRWZWMueSAqIHRoaXMuX3N0ZXBDb3NcclxuICAgICAgICApO1xyXG4gICAgICAgIGdyb3VwLm91dFBhdGgucHVzaChuZXcgUG9pbnQ2NChwdC54ICsgb2Zmc2V0VmVjLngsIHB0LnkgKyBvZmZzZXRWZWMueSkpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICBncm91cC5vdXRQYXRoLnB1c2godGhpcy5nZXRQZXJwZW5kaWMocHQsIHRoaXMuX25vcm1hbHNbal0pKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgYnVpbGROb3JtYWxzKHBhdGg6IFBhdGg2NCk6IHZvaWQge1xyXG4gICAgY29uc3QgY250ID0gcGF0aC5sZW5ndGg7XHJcbiAgICB0aGlzLl9ub3JtYWxzID0gW107XHJcbiAgICB0aGlzLl9ub3JtYWxzLmxlbmd0aCA9IGNudDtcclxuXHJcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNudCAtIDE7IGkrKykge1xyXG4gICAgICB0aGlzLl9ub3JtYWxzLnB1c2goQ2xpcHBlck9mZnNldC5nZXRVbml0Tm9ybWFsKHBhdGhbaV0sIHBhdGhbaSArIDFdKSk7XHJcbiAgICB9XHJcbiAgICB0aGlzLl9ub3JtYWxzLnB1c2goQ2xpcHBlck9mZnNldC5nZXRVbml0Tm9ybWFsKHBhdGhbY250IC0gMV0sIHBhdGhbMF0pKTtcclxuICB9XHJcblxyXG4gIGNyb3NzUHJvZHVjdCh2ZWMxOiBQb2ludEQsIHZlYzI6IFBvaW50RCk6IG51bWJlciB7XHJcbiAgICByZXR1cm4gKHZlYzEueSAqIHZlYzIueCAtIHZlYzIueSAqIHZlYzEueCk7XHJcbiAgfVxyXG5cclxuICBkb3RQcm9kdWN0KHZlYzE6IFBvaW50RCwgdmVjMjogUG9pbnREKTogbnVtYmVyIHtcclxuICAgIHJldHVybiAodmVjMS54ICogdmVjMi54ICsgdmVjMS55ICogdmVjMi55KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgb2Zmc2V0UG9pbnQoZ3JvdXA6IEdyb3VwLCBwYXRoOiBQYXRoNjQsIGo6IG51bWJlciwgazogbnVtYmVyKTogdm9pZCB7XHJcbiAgICBjb25zdCBzaW5BID0gdGhpcy5jcm9zc1Byb2R1Y3QodGhpcy5fbm9ybWFsc1tqXSwgdGhpcy5fbm9ybWFsc1trXSk7XHJcbiAgICBsZXQgY29zQSA9IHRoaXMuZG90UHJvZHVjdCh0aGlzLl9ub3JtYWxzW2pdLCB0aGlzLl9ub3JtYWxzW2tdKTtcclxuICAgIGlmIChzaW5BID4gMS4wKSBjb3NBID0gMS4wO1xyXG4gICAgZWxzZSBpZiAoc2luQSA8IC0xLjApIGNvc0EgPSAtMS4wO1xyXG5cclxuICAgIGlmICh0eXBlb2YgdGhpcy5EZWx0YUNhbGxiYWNrICE9PSBcInVuZGVmaW5lZFwiKSB7XHJcbiAgICAgIHRoaXMuX2dyb3VwRGVsdGEgPSB0aGlzLkRlbHRhQ2FsbGJhY2socGF0aCwgdGhpcy5fbm9ybWFscywgaiwgayk7XHJcbiAgICAgIGlmIChncm91cC5wYXRoc1JldmVyc2VkKSB0aGlzLl9ncm91cERlbHRhID0gLXRoaXMuX2dyb3VwRGVsdGE7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKE1hdGguYWJzKHRoaXMuX2dyb3VwRGVsdGEpIDwgQ2xpcHBlck9mZnNldC5Ub2xlcmFuY2UpIHtcclxuICAgICAgZ3JvdXAub3V0UGF0aC5wdXNoKHBhdGhbal0pO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGNvc0EgPiAwLjk5OSkge1xyXG4gICAgICB0aGlzLmRvTWl0ZXIoZ3JvdXAsIHBhdGgsIGosIGssIGNvc0EpO1xyXG4gICAgfSBlbHNlIGlmIChjb3NBID4gLTAuOTkgJiYgKHNpbkEgKiB0aGlzLl9ncm91cERlbHRhIDwgMCkpIHtcclxuICAgICAgZ3JvdXAub3V0UGF0aC5wdXNoKHRoaXMuZ2V0UGVycGVuZGljKHBhdGhbal0sIHRoaXMuX25vcm1hbHNba10pKTtcclxuICAgICAgZ3JvdXAub3V0UGF0aC5wdXNoKHBhdGhbal0pO1xyXG4gICAgICBncm91cC5vdXRQYXRoLnB1c2godGhpcy5nZXRQZXJwZW5kaWMocGF0aFtqXSwgdGhpcy5fbm9ybWFsc1tqXSkpO1xyXG4gICAgfSBlbHNlIGlmICh0aGlzLl9qb2luVHlwZSA9PT0gSm9pblR5cGUuTWl0ZXIpIHtcclxuICAgICAgaWYgKGNvc0EgPiB0aGlzLl9taXRMaW1TcXIgLSAxKSB7XHJcbiAgICAgICAgdGhpcy5kb01pdGVyKGdyb3VwLCBwYXRoLCBqLCBrLCBjb3NBKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICB0aGlzLmRvU3F1YXJlKGdyb3VwLCBwYXRoLCBqLCBrKTtcclxuICAgICAgfVxyXG4gICAgfSBlbHNlIGlmIChjb3NBID4gMC45OSB8fCB0aGlzLl9qb2luVHlwZSA9PT0gSm9pblR5cGUuU3F1YXJlKSB7XHJcbiAgICAgIHRoaXMuZG9TcXVhcmUoZ3JvdXAsIHBhdGgsIGosIGspO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhpcy5kb1JvdW5kKGdyb3VwLCBwYXRoLCBqLCBrLCBNYXRoLmF0YW4yKHNpbkEsIGNvc0EpKTtcclxuICAgIH1cclxuXHJcbiAgICBrID0gajtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgb2Zmc2V0UG9seWdvbihncm91cDogR3JvdXAsIHBhdGg6IFBhdGg2NCk6IHZvaWQge1xyXG4gICAgY29uc3QgYXJlYSA9IENsaXBwZXIuYXJlYShwYXRoKTtcclxuICAgIGlmICgoYXJlYSA8IDApICE9PSAodGhpcy5fZ3JvdXBEZWx0YSA8IDApKSB7XHJcbiAgICAgIGNvbnN0IHJlY3QgPSBDbGlwcGVyLmdldEJvdW5kcyhwYXRoKTtcclxuICAgICAgaWYgKE1hdGguYWJzKHRoaXMuX2dyb3VwRGVsdGEpICogMiA+IHJlY3Qud2lkdGgpIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBncm91cC5vdXRQYXRoID0gW107XHJcbiAgICBjb25zdCBjbnQgPSBwYXRoLmxlbmd0aDtcclxuICAgIGNvbnN0IHByZXYgPSBjbnQgLSAxO1xyXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjbnQ7IGkrKykge1xyXG4gICAgICB0aGlzLm9mZnNldFBvaW50KGdyb3VwLCBwYXRoLCBpLCBwcmV2KTtcclxuICAgIH1cclxuICAgIGdyb3VwLm91dFBhdGhzLnB1c2goZ3JvdXAub3V0UGF0aCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIG9mZnNldE9wZW5Kb2luZWQoZ3JvdXA6IEdyb3VwLCBwYXRoOiBQYXRoNjQpOiB2b2lkIHtcclxuICAgIHRoaXMub2Zmc2V0UG9seWdvbihncm91cCwgcGF0aCk7XHJcbiAgICBwYXRoID0gQ2xpcHBlci5yZXZlcnNlUGF0aChwYXRoKTtcclxuICAgIHRoaXMuYnVpbGROb3JtYWxzKHBhdGgpO1xyXG4gICAgdGhpcy5vZmZzZXRQb2x5Z29uKGdyb3VwLCBwYXRoKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgb2Zmc2V0T3BlblBhdGgoZ3JvdXA6IEdyb3VwLCBwYXRoOiBQYXRoNjQpOiB2b2lkIHtcclxuICAgIGdyb3VwLm91dFBhdGggPSBbXTtcclxuICAgIGNvbnN0IGhpZ2hJID0gcGF0aC5sZW5ndGggLSAxO1xyXG5cclxuICAgIGlmICh0eXBlb2YgdGhpcy5EZWx0YUNhbGxiYWNrICE9PSBcInVuZGVmaW5lZFwiKSB7XHJcbiAgICAgIHRoaXMuX2dyb3VwRGVsdGEgPSB0aGlzLkRlbHRhQ2FsbGJhY2socGF0aCwgdGhpcy5fbm9ybWFscywgMCwgMCk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKE1hdGguYWJzKHRoaXMuX2dyb3VwRGVsdGEpIDwgQ2xpcHBlck9mZnNldC5Ub2xlcmFuY2UpIHtcclxuICAgICAgZ3JvdXAub3V0UGF0aC5wdXNoKHBhdGhbMF0pO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgc3dpdGNoICh0aGlzLl9lbmRUeXBlKSB7XHJcbiAgICAgICAgY2FzZSBFbmRUeXBlLkJ1dHQ6XHJcbiAgICAgICAgICBncm91cC5vdXRQYXRoLnB1c2gobmV3IFBvaW50NjQoXHJcbiAgICAgICAgICAgIHBhdGhbMF0ueCAtIHRoaXMuX25vcm1hbHNbMF0ueCAqIHRoaXMuX2dyb3VwRGVsdGEsXHJcbiAgICAgICAgICAgIHBhdGhbMF0ueSAtIHRoaXMuX25vcm1hbHNbMF0ueSAqIHRoaXMuX2dyb3VwRGVsdGFcclxuICAgICAgICAgICkpO1xyXG4gICAgICAgICAgZ3JvdXAub3V0UGF0aC5wdXNoKHRoaXMuZ2V0UGVycGVuZGljKHBhdGhbMF0sIHRoaXMuX25vcm1hbHNbMF0pKTtcclxuICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgRW5kVHlwZS5Sb3VuZDpcclxuICAgICAgICAgIHRoaXMuZG9Sb3VuZChncm91cCwgcGF0aCwgMCwgMCwgTWF0aC5QSSk7XHJcbiAgICAgICAgICBicmVhaztcclxuICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgdGhpcy5kb1NxdWFyZShncm91cCwgcGF0aCwgMCwgMCk7XHJcbiAgICAgICAgICBicmVhaztcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGZvciAobGV0IGkgPSAxLCBrID0gMDsgaSA8IGhpZ2hJOyBpKyspIHtcclxuICAgICAgdGhpcy5vZmZzZXRQb2ludChncm91cCwgcGF0aCwgaSwgayk7XHJcbiAgICB9XHJcblxyXG4gICAgZm9yIChsZXQgaSA9IGhpZ2hJOyBpID4gMDsgaS0tKSB7XHJcbiAgICAgIHRoaXMuX25vcm1hbHNbaV0gPSBuZXcgUG9pbnREKC10aGlzLl9ub3JtYWxzW2kgLSAxXS54LCAtdGhpcy5fbm9ybWFsc1tpIC0gMV0ueSk7XHJcbiAgICB9XHJcbiAgICB0aGlzLl9ub3JtYWxzWzBdID0gdGhpcy5fbm9ybWFsc1toaWdoSV07XHJcblxyXG4gICAgaWYgKHR5cGVvZiB0aGlzLkRlbHRhQ2FsbGJhY2sgIT09IFwidW5kZWZpbmVkXCIpIHtcclxuICAgICAgdGhpcy5fZ3JvdXBEZWx0YSA9IHRoaXMuRGVsdGFDYWxsYmFjayhwYXRoLCB0aGlzLl9ub3JtYWxzLCBoaWdoSSwgaGlnaEkpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChNYXRoLmFicyh0aGlzLl9ncm91cERlbHRhKSA8IENsaXBwZXJPZmZzZXQuVG9sZXJhbmNlKSB7XHJcbiAgICAgIGdyb3VwLm91dFBhdGgucHVzaChwYXRoW2hpZ2hJXSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBzd2l0Y2ggKHRoaXMuX2VuZFR5cGUpIHtcclxuICAgICAgICBjYXNlIEVuZFR5cGUuQnV0dDpcclxuICAgICAgICAgIGdyb3VwLm91dFBhdGgucHVzaChuZXcgUG9pbnQ2NChcclxuICAgICAgICAgICAgcGF0aFtoaWdoSV0ueCAtIHRoaXMuX25vcm1hbHNbaGlnaEldLnggKiB0aGlzLl9ncm91cERlbHRhLFxyXG4gICAgICAgICAgICBwYXRoW2hpZ2hJXS55IC0gdGhpcy5fbm9ybWFsc1toaWdoSV0ueSAqIHRoaXMuX2dyb3VwRGVsdGFcclxuICAgICAgICAgICkpO1xyXG4gICAgICAgICAgZ3JvdXAub3V0UGF0aC5wdXNoKHRoaXMuZ2V0UGVycGVuZGljKHBhdGhbaGlnaEldLCB0aGlzLl9ub3JtYWxzW2hpZ2hJXSkpO1xyXG4gICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSBFbmRUeXBlLlJvdW5kOlxyXG4gICAgICAgICAgdGhpcy5kb1JvdW5kKGdyb3VwLCBwYXRoLCBoaWdoSSwgaGlnaEksIE1hdGguUEkpO1xyXG4gICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgIHRoaXMuZG9TcXVhcmUoZ3JvdXAsIHBhdGgsIGhpZ2hJLCBoaWdoSSk7XHJcbiAgICAgICAgICBicmVhaztcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGZvciAobGV0IGkgPSBoaWdoSSwgayA9IDA7IGkgPiAwOyBpLS0pIHtcclxuICAgICAgdGhpcy5vZmZzZXRQb2ludChncm91cCwgcGF0aCwgaSwgayk7XHJcbiAgICB9XHJcblxyXG4gICAgZ3JvdXAub3V0UGF0aHMucHVzaChncm91cC5vdXRQYXRoKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZG9Hcm91cE9mZnNldChncm91cDogR3JvdXApOiB2b2lkIHtcclxuICAgIGlmIChncm91cC5lbmRUeXBlID09IEVuZFR5cGUuUG9seWdvbikge1xyXG5cclxuICAgICAgY29uc3QgeyBpbmRleCB9ID0gQ2xpcHBlck9mZnNldC5nZXRCb3VuZHNBbmRMb3dlc3RQb2x5SWR4KGdyb3VwLmluUGF0aHMpO1xyXG5cclxuICAgICAgaWYgKGluZGV4IDwgMCkgcmV0dXJuO1xyXG5cclxuICAgICAgY29uc3QgYXJlYSA9IENsaXBwZXIuYXJlYShncm91cC5pblBhdGhzW2luZGV4XSk7XHJcbiAgICAgIGdyb3VwLnBhdGhzUmV2ZXJzZWQgPSBhcmVhIDwgMDtcclxuXHJcbiAgICAgIGlmIChncm91cC5wYXRoc1JldmVyc2VkKSB7XHJcbiAgICAgICAgdGhpcy5fZ3JvdXBEZWx0YSA9IC10aGlzLl9kZWx0YTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICB0aGlzLl9ncm91cERlbHRhID0gdGhpcy5fZGVsdGE7XHJcbiAgICAgIH1cclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGdyb3VwLnBhdGhzUmV2ZXJzZWQgPSBmYWxzZTtcclxuICAgICAgdGhpcy5fZ3JvdXBEZWx0YSA9IE1hdGguYWJzKHRoaXMuX2RlbHRhKSAqIDAuNTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBhYnNEZWx0YSA9IE1hdGguYWJzKHRoaXMuX2dyb3VwRGVsdGEpO1xyXG4gICAgdGhpcy5fam9pblR5cGUgPSBncm91cC5qb2luVHlwZTtcclxuICAgIHRoaXMuX2VuZFR5cGUgPSBncm91cC5lbmRUeXBlO1xyXG5cclxuICAgIGlmICghdGhpcy5EZWx0YUNhbGxiYWNrICYmXHJcbiAgICAgIChncm91cC5qb2luVHlwZSA9PSBKb2luVHlwZS5Sb3VuZCB8fCBncm91cC5lbmRUeXBlID09IEVuZFR5cGUuUm91bmQpKSB7XHJcbiAgICAgIGNvbnN0IGFyY1RvbCA9IHRoaXMuQXJjVG9sZXJhbmNlID4gMC4wMVxyXG4gICAgICAgID8gdGhpcy5BcmNUb2xlcmFuY2VcclxuICAgICAgICA6IE1hdGgubG9nMTAoMiArIGFic0RlbHRhKSAqIEludGVybmFsQ2xpcHBlci5kZWZhdWx0QXJjVG9sZXJhbmNlO1xyXG5cclxuICAgICAgY29uc3Qgc3RlcHNQZXIzNjAgPSBNYXRoLlBJIC8gTWF0aC5hY29zKDEgLSBhcmNUb2wgLyBhYnNEZWx0YSk7XHJcbiAgICAgIHRoaXMuX3N0ZXBTaW4gPSBNYXRoLnNpbigoMiAqIE1hdGguUEkpIC8gc3RlcHNQZXIzNjApO1xyXG4gICAgICB0aGlzLl9zdGVwQ29zID0gTWF0aC5jb3MoKDIgKiBNYXRoLlBJKSAvIHN0ZXBzUGVyMzYwKTtcclxuXHJcbiAgICAgIGlmICh0aGlzLl9ncm91cERlbHRhIDwgMC4wKSB7XHJcbiAgICAgICAgdGhpcy5fc3RlcFNpbiA9IC10aGlzLl9zdGVwU2luO1xyXG4gICAgICB9XHJcblxyXG4gICAgICB0aGlzLl9zdGVwc1BlclJhZCA9IHN0ZXBzUGVyMzYwIC8gKDIgKiBNYXRoLlBJKTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBpc0pvaW5lZCA9IGdyb3VwLmVuZFR5cGUgPT0gRW5kVHlwZS5Kb2luZWQgfHwgZ3JvdXAuZW5kVHlwZSA9PSBFbmRUeXBlLlBvbHlnb247XHJcblxyXG4gICAgZm9yIChjb25zdCBwIG9mIGdyb3VwLmluUGF0aHMpIHtcclxuICAgICAgY29uc3QgcGF0aCA9IENsaXBwZXIuc3RyaXBEdXBsaWNhdGVzKHAsIGlzSm9pbmVkKTtcclxuICAgICAgY29uc3QgY250ID0gcGF0aC5sZW5ndGg7XHJcblxyXG4gICAgICBpZiAoY250ID09PSAwIHx8IChjbnQgPCAzICYmIHRoaXMuX2VuZFR5cGUgPT0gRW5kVHlwZS5Qb2x5Z29uKSkge1xyXG4gICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBpZiAoY250ID09IDEpIHtcclxuICAgICAgICBncm91cC5vdXRQYXRoID0gW107XHJcblxyXG4gICAgICAgIGlmIChncm91cC5lbmRUeXBlID09IEVuZFR5cGUuUm91bmQpIHtcclxuICAgICAgICAgIGNvbnN0IHIgPSBhYnNEZWx0YTtcclxuICAgICAgICAgIGdyb3VwLm91dFBhdGggPSBDbGlwcGVyLmVsbGlwc2UocGF0aFswXSwgciwgcik7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIGNvbnN0IGQgPSBNYXRoLmNlaWwodGhpcy5fZ3JvdXBEZWx0YSk7XHJcbiAgICAgICAgICBjb25zdCByID0gbmV3IFJlY3Q2NChwYXRoWzBdLnggLSBkLCBwYXRoWzBdLnkgLSBkLCBwYXRoWzBdLnggLSBkLCBwYXRoWzBdLnkgLSBkKTtcclxuICAgICAgICAgIGdyb3VwLm91dFBhdGggPSByLmFzUGF0aCgpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZ3JvdXAub3V0UGF0aHMucHVzaChncm91cC5vdXRQYXRoKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBpZiAoY250ID09IDIgJiYgZ3JvdXAuZW5kVHlwZSA9PSBFbmRUeXBlLkpvaW5lZCkge1xyXG4gICAgICAgICAgaWYgKGdyb3VwLmpvaW5UeXBlID09IEpvaW5UeXBlLlJvdW5kKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2VuZFR5cGUgPSBFbmRUeXBlLlJvdW5kO1xyXG4gICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgdGhpcy5fZW5kVHlwZSA9IEVuZFR5cGUuU3F1YXJlO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5idWlsZE5vcm1hbHMocGF0aCk7XHJcblxyXG4gICAgICAgIGlmICh0aGlzLl9lbmRUeXBlID09IEVuZFR5cGUuUG9seWdvbikge1xyXG4gICAgICAgICAgdGhpcy5vZmZzZXRQb2x5Z29uKGdyb3VwLCBwYXRoKTtcclxuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX2VuZFR5cGUgPT0gRW5kVHlwZS5Kb2luZWQpIHtcclxuICAgICAgICAgIHRoaXMub2Zmc2V0T3BlbkpvaW5lZChncm91cCwgcGF0aCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIHRoaXMub2Zmc2V0T3BlblBhdGgoZ3JvdXAsIHBhdGgpO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuX3NvbHV0aW9uLnB1c2goLi4uZ3JvdXAub3V0UGF0aHMpO1xyXG4gICAgZ3JvdXAub3V0UGF0aHMgPSBbXTtcclxuICB9XHJcbn1cclxuIl19