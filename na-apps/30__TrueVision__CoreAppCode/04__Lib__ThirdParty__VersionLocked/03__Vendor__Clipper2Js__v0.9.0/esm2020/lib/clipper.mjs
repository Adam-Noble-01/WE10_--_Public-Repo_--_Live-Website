/*******************************************************************************
* Author    :  Angus Johnson                                                   *
* Date      :  16 July 2023                                                    *
* Website   :  http://www.angusj.com                                           *
* Copyright :  Angus Johnson 2010-2023                                         *
* Purpose   :  This module contains simple functions that will likely cover    *
*              most polygon boolean and offsetting needs, while also avoiding  *
*              the inherent complexities of the other modules.                 *
* Thanks    :  Special thanks to Thong Nguyen, Guus Kuiper, Phil Stopford,     *
*           :  and Daniel Gosnell for their invaluable assistance with C#.     *
* License   :  http://www.boost.org/LICENSE_1_0.txt                            *
*******************************************************************************/
//
// Converted from C# implemention https://github.com/AngusJohnson/Clipper2/blob/main/CSharp/Clipper2Lib/Clipper.cs
// Removed support for USINGZ
//
// Converted by ChatGPT 4 August 3 version https://help.openai.com/en/articles/6825453-chatgpt-release-notes
//
import { ClipType, FillRule, InternalClipper, Path64, PathType, Paths64, Point64, Rect64 } from "./core";
import { Clipper64 } from "./engine";
import { Minkowski } from "./minkowski";
import { ClipperOffset } from "./offset";
import { RectClip64, RectClipLines64 } from "./rectclip";
export class Clipper {
    static get InvalidRect64() {
        if (!Clipper.invalidRect64)
            Clipper.invalidRect64 = new Rect64(false);
        return this.invalidRect64;
    }
    static Intersect(subject, clip, fillRule) {
        return this.BooleanOp(ClipType.Intersection, subject, clip, fillRule);
    }
    static Union(subject, clip, fillRule = FillRule.EvenOdd) {
        return this.BooleanOp(ClipType.Union, subject, clip, fillRule);
    }
    static Difference(subject, clip, fillRule) {
        return this.BooleanOp(ClipType.Difference, subject, clip, fillRule);
    }
    static Xor(subject, clip, fillRule) {
        return this.BooleanOp(ClipType.Xor, subject, clip, fillRule);
    }
    static BooleanOp(clipType, subject, clip, fillRule = FillRule.EvenOdd) {
        const solution = new Paths64();
        if (!subject)
            return solution;
        const c = new Clipper64();
        c.addPaths(subject, PathType.Subject);
        if (clip)
            c.addPaths(clip, PathType.Clip);
        c.execute(clipType, fillRule, solution);
        return solution;
    }
    //public static BooleanOp(clipType: ClipType, subject: Paths64, clip: Paths64, polytree: PolyTree64, fillRule: FillRule): void {
    //  if (!subject) return;
    //  const c: Clipper64 = new Clipper64();
    //  c.addPaths(subject, PathType.Subject);
    //  if (clip)
    //    c.addPaths(clip, PathType.Clip);
    //  c.execute(clipType, fillRule, polytree);
    //}
    static InflatePaths(paths, delta, joinType, endType, miterLimit = 2.0) {
        const co = new ClipperOffset(miterLimit);
        co.addPaths(paths, joinType, endType);
        const solution = new Paths64();
        co.execute(delta, solution);
        return solution;
    }
    static RectClipPaths(rect, paths) {
        if (rect.isEmpty() || paths.length === 0)
            return new Paths64();
        const rc = new RectClip64(rect);
        return rc.execute(paths);
    }
    static RectClip(rect, path) {
        if (rect.isEmpty() || path.length === 0)
            return new Paths64();
        const tmp = new Paths64();
        tmp.push(path);
        return this.RectClipPaths(rect, tmp);
    }
    static RectClipLinesPaths(rect, paths) {
        if (rect.isEmpty() || paths.length === 0)
            return new Paths64();
        const rc = new RectClipLines64(rect);
        return rc.execute(paths);
    }
    static RectClipLines(rect, path) {
        if (rect.isEmpty() || path.length === 0)
            return new Paths64();
        const tmp = new Paths64();
        tmp.push(path);
        return this.RectClipLinesPaths(rect, tmp);
    }
    static MinkowskiSum(pattern, path, isClosed) {
        return Minkowski.sum(pattern, path, isClosed);
    }
    static MinkowskiDiff(pattern, path, isClosed) {
        return Minkowski.diff(pattern, path, isClosed);
    }
    static area(path) {
        // https://en.wikipedia.org/wiki/Shoelace_formula
        let a = 0.0;
        const cnt = path.length;
        if (cnt < 3)
            return 0.0;
        let prevPt = path[cnt - 1];
        for (const pt of path) {
            a += (prevPt.y + pt.y) * (prevPt.x - pt.x);
            prevPt = pt;
        }
        return a * 0.5;
    }
    static areaPaths(paths) {
        let a = 0.0;
        for (const path of paths)
            a += this.area(path);
        return a;
    }
    static isPositive(poly) {
        return this.area(poly) >= 0;
    }
    static path64ToString(path) {
        let result = "";
        for (const pt of path)
            result += pt.toString();
        return result + '\n';
    }
    static paths64ToString(paths) {
        let result = "";
        for (const path of paths)
            result += this.path64ToString(path);
        return result;
    }
    static offsetPath(path, dx, dy) {
        const result = new Path64();
        for (const pt of path)
            result.push(new Point64(pt.x + dx, pt.y + dy));
        return result;
    }
    static scalePoint64(pt, scale) {
        const result = new Point64(Math.round(pt.x * scale), Math.round(pt.y * scale));
        return result;
    }
    static scalePath(path, scale) {
        if (InternalClipper.isAlmostZero(scale - 1))
            return path;
        const result = [];
        for (const pt of path)
            result.push({ x: pt.x * scale, y: pt.y * scale });
        return result;
    }
    static scalePaths(paths, scale) {
        if (InternalClipper.isAlmostZero(scale - 1))
            return paths;
        const result = [];
        for (const path of paths)
            result.push(this.scalePath(path, scale));
        return result;
    }
    static translatePath(path, dx, dy) {
        const result = [];
        for (const pt of path) {
            result.push({ x: pt.x + dx, y: pt.y + dy });
        }
        return result;
    }
    static translatePaths(paths, dx, dy) {
        const result = [];
        for (const path of paths) {
            result.push(this.translatePath(path, dx, dy));
        }
        return result;
    }
    static reversePath(path) {
        return [...path].reverse();
    }
    static reversePaths(paths) {
        const result = [];
        for (const t of paths) {
            result.push(this.reversePath(t));
        }
        return result;
    }
    static getBounds(path) {
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
        return result.left === Number.MAX_SAFE_INTEGER ? new Rect64(0, 0, 0, 0) : result;
    }
    static getBoundsPaths(paths) {
        const result = Clipper.InvalidRect64;
        for (const path of paths) {
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
        }
        return result.left === Number.MAX_SAFE_INTEGER ? new Rect64(0, 0, 0, 0) : result;
    }
    static makePath(arr) {
        const len = arr.length / 2;
        const p = new Path64();
        for (let i = 0; i < len; i++)
            p.push(new Point64(arr[i * 2], arr[i * 2 + 1]));
        return p;
    }
    static stripDuplicates(path, isClosedPath) {
        const cnt = path.length;
        const result = new Path64();
        if (cnt === 0)
            return result;
        let lastPt = path[0];
        result.push(lastPt);
        for (let i = 1; i < cnt; i++)
            if (lastPt !== path[i]) {
                lastPt = path[i];
                result.push(lastPt);
            }
        if (isClosedPath && lastPt === result[0])
            result.pop();
        return result;
    }
    static addPolyNodeToPaths(polyPath, paths) {
        if (polyPath.polygon && polyPath.polygon.length > 0)
            paths.push(polyPath.polygon);
        for (let i = 0; i < polyPath.count; i++)
            this.addPolyNodeToPaths(polyPath.children[i], paths);
    }
    static polyTreeToPaths64(polyTree) {
        const result = new Paths64();
        for (let i = 0; i < polyTree.count; i++) {
            Clipper.addPolyNodeToPaths(polyTree.children[i], result);
        }
        return result;
    }
    static perpendicDistFromLineSqrd(pt, line1, line2) {
        const a = pt.x - line1.x;
        const b = pt.y - line1.y;
        const c = line2.x - line1.x;
        const d = line2.y - line1.y;
        if (c === 0 && d === 0)
            return 0;
        return Clipper.sqr(a * d - c * b) / (c * c + d * d);
    }
    static rdp(path, begin, end, epsSqrd, flags) {
        let idx = 0;
        let max_d = 0;
        while (end > begin && path[begin] === path[end]) {
            flags[end--] = false;
        }
        for (let i = begin + 1; i < end; i++) {
            const d = Clipper.perpendicDistFromLineSqrd(path[i], path[begin], path[end]);
            if (d <= max_d)
                continue;
            max_d = d;
            idx = i;
        }
        if (max_d <= epsSqrd)
            return;
        flags[idx] = true;
        if (idx > begin + 1)
            Clipper.rdp(path, begin, idx, epsSqrd, flags);
        if (idx < end - 1)
            Clipper.rdp(path, idx, end, epsSqrd, flags);
    }
    static ramerDouglasPeucker(path, epsilon) {
        const len = path.length;
        if (len < 5)
            return path;
        const flags = new Array(len).fill(false);
        flags[0] = true;
        flags[len - 1] = true;
        Clipper.rdp(path, 0, len - 1, Clipper.sqr(epsilon), flags);
        const result = [];
        for (let i = 0; i < len; i++) {
            if (flags[i])
                result.push(path[i]);
        }
        return result;
    }
    static ramerDouglasPeuckerPaths(paths, epsilon) {
        const result = [];
        for (const path of paths) {
            result.push(Clipper.ramerDouglasPeucker(path, epsilon));
        }
        return result;
    }
    static getNext(current, high, flags) {
        current++;
        while (current <= high && flags[current])
            current++;
        if (current <= high)
            return current;
        current = 0;
        while (flags[current])
            current++;
        return current;
    }
    static getPrior(current, high, flags) {
        if (current === 0)
            current = high;
        else
            current--;
        while (current > 0 && flags[current])
            current--;
        if (!flags[current])
            return current;
        current = high;
        while (flags[current])
            current--;
        return current;
    }
    static sqr(value) {
        return value * value;
    }
    static simplifyPath(path, epsilon, isClosedPath = false) {
        const len = path.length;
        const high = len - 1;
        const epsSqr = this.sqr(epsilon);
        if (len < 4)
            return path;
        const flags = new Array(len).fill(false);
        const dsq = new Array(len).fill(0);
        let prev = high;
        let curr = 0;
        let start, next, prior2, next2;
        if (isClosedPath) {
            dsq[0] = this.perpendicDistFromLineSqrd(path[0], path[high], path[1]);
            dsq[high] = this.perpendicDistFromLineSqrd(path[high], path[0], path[high - 1]);
        }
        else {
            dsq[0] = Number.MAX_VALUE;
            dsq[high] = Number.MAX_VALUE;
        }
        for (let i = 1; i < high; i++) {
            dsq[i] = this.perpendicDistFromLineSqrd(path[i], path[i - 1], path[i + 1]);
        }
        for (;;) {
            if (dsq[curr] > epsSqr) {
                start = curr;
                do {
                    curr = this.getNext(curr, high, flags);
                } while (curr !== start && dsq[curr] > epsSqr);
                if (curr === start)
                    break;
            }
            prev = this.getPrior(curr, high, flags);
            next = this.getNext(curr, high, flags);
            if (next === prev)
                break;
            if (dsq[next] < dsq[curr]) {
                flags[next] = true;
                next = this.getNext(next, high, flags);
                next2 = this.getNext(next, high, flags);
                dsq[curr] = this.perpendicDistFromLineSqrd(path[curr], path[prev], path[next]);
                if (next !== high || isClosedPath) {
                    dsq[next] = this.perpendicDistFromLineSqrd(path[next], path[curr], path[next2]);
                }
                curr = next;
            }
            else {
                flags[curr] = true;
                curr = next;
                next = this.getNext(next, high, flags);
                prior2 = this.getPrior(prev, high, flags);
                dsq[curr] = this.perpendicDistFromLineSqrd(path[curr], path[prev], path[next]);
                if (prev !== 0 || isClosedPath) {
                    dsq[prev] = this.perpendicDistFromLineSqrd(path[prev], path[prior2], path[curr]);
                }
            }
        }
        const result = [];
        for (let i = 0; i < len; i++) {
            if (!flags[i])
                result.push(path[i]);
        }
        return result;
    }
    static simplifyPaths(paths, epsilon, isClosedPaths = false) {
        const result = [];
        for (const path of paths) {
            result.push(this.simplifyPath(path, epsilon, isClosedPaths));
        }
        return result;
    }
    //private static getNext(current: number, high: number, flags: boolean[]): number {
    //  current++;
    //  while (current <= high && flags[current]) current++;
    //  return current;
    //}
    //private static getPrior(current: number, high: number, flags: boolean[]): number {
    //  if (current === 0) return high;
    //  current--;
    //  while (current > 0 && flags[current]) current--;
    //  return current;
    //}
    static trimCollinear(path, isOpen = false) {
        let len = path.length;
        let i = 0;
        if (!isOpen) {
            while (i < len - 1 && InternalClipper.crossProduct(path[len - 1], path[i], path[i + 1]) === 0)
                i++;
            while (i < len - 1 && InternalClipper.crossProduct(path[len - 2], path[len - 1], path[i]) === 0)
                len--;
        }
        if (len - i < 3) {
            if (!isOpen || len < 2 || path[0] === path[1]) {
                return [];
            }
            return path;
        }
        const result = [];
        let last = path[i];
        result.push(last);
        for (i++; i < len - 1; i++) {
            if (InternalClipper.crossProduct(last, path[i], path[i + 1]) === 0)
                continue;
            last = path[i];
            result.push(last);
        }
        if (isOpen) {
            result.push(path[len - 1]);
        }
        else if (InternalClipper.crossProduct(last, path[len - 1], result[0]) !== 0) {
            result.push(path[len - 1]);
        }
        else {
            while (result.length > 2 && InternalClipper.crossProduct(result[result.length - 1], result[result.length - 2], result[0]) === 0) {
                result.pop();
            }
            if (result.length < 3)
                result.splice(0, result.length);
        }
        return result;
    }
    static pointInPolygon(pt, polygon) {
        return InternalClipper.pointInPolygon(pt, polygon);
    }
    static ellipse(center, radiusX, radiusY = 0, steps = 0) {
        if (radiusX <= 0)
            return [];
        if (radiusY <= 0)
            radiusY = radiusX;
        if (steps <= 2)
            steps = Math.ceil(Math.PI * Math.sqrt((radiusX + radiusY) / 2));
        const si = Math.sin(2 * Math.PI / steps);
        const co = Math.cos(2 * Math.PI / steps);
        let dx = co, dy = si;
        const result = [{ x: center.x + radiusX, y: center.y }];
        for (let i = 1; i < steps; ++i) {
            result.push({ x: center.x + radiusX * dx, y: center.y + radiusY * dy });
            const x = dx * co - dy * si;
            dy = dy * co + dx * si;
            dx = x;
        }
        return result;
    }
    static showPolyPathStructure(pp, level) {
        const spaces = ' '.repeat(level * 2);
        const caption = pp.isHole ? "Hole " : "Outer ";
        if (pp.count === 0) {
            console.log(spaces + caption);
        }
        else {
            console.log(spaces + caption + `(${pp.count})`);
            pp.forEach(child => this.showPolyPathStructure(child, level + 1));
        }
    }
    static showPolyTreeStructure(polytree) {
        console.log("Polytree Root");
        polytree.forEach(child => this.showPolyPathStructure(child, 1));
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpcHBlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3Byb2plY3RzL2NsaXBwZXIyLWpzL3NyYy9saWIvY2xpcHBlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7Ozs7Z0ZBV2dGO0FBRWhGLEVBQUU7QUFDRixrSEFBa0g7QUFDbEgsNkJBQTZCO0FBQzdCLEVBQUU7QUFDRiw0R0FBNEc7QUFDNUcsRUFBRTtBQUVGLE9BQU8sRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFZLGVBQWUsRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sUUFBUSxDQUFDO0FBQ25ILE9BQU8sRUFBRSxTQUFTLEVBQThELE1BQU0sVUFBVSxDQUFDO0FBQ2pHLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxhQUFhLENBQUM7QUFDeEMsT0FBTyxFQUFFLGFBQWEsRUFBcUIsTUFBTSxVQUFVLENBQUM7QUFDNUQsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFFekQsTUFBTSxPQUFPLE9BQU87SUFHWCxNQUFNLEtBQUssYUFBYTtRQUM3QixJQUFJLENBQUMsT0FBTyxDQUFDLGFBQWE7WUFBRSxPQUFPLENBQUMsYUFBYSxHQUFHLElBQUksTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ3RFLE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FBQztJQUM1QixDQUFDO0lBRU0sTUFBTSxDQUFDLFNBQVMsQ0FBQyxPQUFnQixFQUFFLElBQWEsRUFBRSxRQUFrQjtRQUN6RSxPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLFlBQVksRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBQ3hFLENBQUM7SUFFTSxNQUFNLENBQUMsS0FBSyxDQUFDLE9BQWdCLEVBQUUsSUFBYyxFQUFFLFFBQVEsR0FBRyxRQUFRLENBQUMs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QUFFLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO1NBQ25FO0lBQ0gsQ0FBQztJQUVNLE1BQU0sQ0FBQyxxQkFBcUIsQ0FBQyxRQUFvQjtRQUN0RCxPQUFPLENBQUMsR0FBRyxDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBQzdCLFFBQVEsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMscUJBQXFCLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDbEUsQ0FBQztDQUVGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcclxuKiBBdXRob3IgICAgOiAgQW5ndXMgSm9obnNvbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcclxuKiBEYXRlICAgICAgOiAgMTYgSnVseSAyMDIzICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcclxuKiBXZWJzaXRlICAgOiAgaHR0cDovL3d3dy5hbmd1c2ouY29tICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcclxuKiBDb3B5cmlnaHQgOiAgQW5ndXMgSm9obnNvbiAyMDEwLTIwMjMgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcclxuKiBQdXJwb3NlICAgOiAgVGhpcyBtb2R1bGUgY29udGFpbnMgc2ltcGxlIGZ1bmN0aW9ucyB0aGF0IHdpbGwgbGlrZWx5IGNvdmVyICAgICpcclxuKiAgICAgICAgICAgICAgbW9zdCBwb2x5Z29uIGJvb2xlYW4gYW5kIG9mZnNldHRpbmcgbmVlZHMsIHdoaWxlIGFsc28gYXZvaWRpbmcgICpcclxuKiAgICAgICAgICAgICAgdGhlIGluaGVyZW50IGNvbXBsZXhpdGllcyBvZiB0aGUgb3RoZXIgbW9kdWxlcy4gICAgICAgICAgICAgICAgICpcclxuKiBUaGFua3MgICAgOiAgU3BlY2lhbCB0aGFua3MgdG8gVGhvbmcgTmd1eWVuLCBHdXVzIEt1aXBlciwgUGhpbCBTdG9wZm9yZCwgICAgICpcclxuKiAgICAgICAgICAgOiAgYW5kIERhbmllbCBHb3NuZWxsIGZvciB0aGVpciBpbnZhbHVhYmxlIGFzc2lzdGFuY2Ugd2l0aCBDIy4gICAgICpcclxuKiBMaWNlbnNlICAgOiAgaHR0cDovL3d3dy5ib29zdC5vcmcvTElDRU5TRV8xXzAudHh0ICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcclxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cclxuXHJcbi8vXHJcbi8vIENvbnZlcnRlZCBmcm9tIEMjIGltcGxlbWVudGlvbiBodHRwczovL2dpdGh1Yi5jb20vQW5ndXNKb2huc29uL0NsaXBwZXIyL2Jsb2IvbWFpbi9DU2hhcnAvQ2xpcHBlcjJMaWIvQ2xpcHBlci5jc1xyXG4vLyBSZW1vdmVkIHN1cHBvcnQgZm9yIFVTSU5HWlxyXG4vL1xyXG4vLyBDb252ZXJ0ZWQgYnkgQ2hhdEdQVCA0IEF1Z3VzdCAzIHZlcnNpb24gaHR0cHM6Ly9oZWxwLm9wZW5haS5jb20vZW4vYXJ0aWNsZXMvNjgyNTQ1My1jaGF0Z3B0LXJlbGVhc2Utbm90ZXNcclxuLy9cclxuXHJcbmltcG9ydCB7IENsaXBUeXBlLCBGaWxsUnVsZSwgSVBvaW50NjQsIEludGVybmFsQ2xpcHBlciwgUGF0aDY0LCBQYXRoVHlwZSwgUGF0aHM2NCwgUG9pbnQ2NCwgUmVjdDY0IH0gZnJvbSBcIi4vY29yZVwiO1xyXG5pbXBvcnQgeyBDbGlwcGVyNjQsIFBvaW50SW5Qb2x5Z29uUmVzdWx0LCBQb2x5UGF0aDY0LCBQb2x5UGF0aEJhc2UsIFBvbHlUcmVlNjQgfSBmcm9tIFwiLi9lbmdpbmVcIjtcclxuaW1wb3J0IHsgTWlua293c2tpIH0gZnJvbSBcIi4vbWlua293c2tpXCI7XHJcbmltcG9ydCB7IENsaXBwZXJPZmZzZXQsIEVuZFR5cGUsIEpvaW5UeXBlIH0gZnJvbSBcIi4vb2Zmc2V0XCI7XHJcbmltcG9ydCB7IFJlY3RDbGlwNjQsIFJlY3RDbGlwTGluZXM2NCB9IGZyb20gXCIuL3JlY3RjbGlwXCI7XHJcblxyXG5leHBvcnQgY2xhc3MgQ2xpcHBlciB7XHJcblxyXG4gIHByaXZhdGUgc3RhdGljIGludmFsaWRSZWN0NjQ6IFJlY3Q2NFxyXG4gIHB1YmxpYyBzdGF0aWMgZ2V0IEludmFsaWRSZWN0NjQoKTogUmVjdDY0IHtcclxuICAgIGlmICghQ2xpcHBlci5pbnZhbGlkUmVjdDY0KSBDbGlwcGVyLmludmFsaWRSZWN0NjQgPSBuZXcgUmVjdDY0KGZhbHNlKTtcclxuICAgIHJldHVybiB0aGlzLmludmFsaWRSZWN0NjQ7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgc3RhdGljIEludGVyc2VjdChzdWJqZWN0OiBQYXRoczY0LCBjbGlwOiBQYXRoczY0LCBmaWxsUnVsZTogRmlsbFJ1bGUpOiBQYXRoczY0IHtcclxuICAgIHJldHVybiB0aGlzLkJvb2xlYW5PcChDbGlwVHlwZS5JbnRlcnNlY3Rpb24sIHN1YmplY3QsIGNsaXAsIGZpbGxSdWxlKTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBzdGF0aWMgVW5pb24oc3ViamVjdDogUGF0aHM2NCwgY2xpcD86IFBhdGhzNjQsIGZpbGxSdWxlID0gRmlsbFJ1bGUuRXZlbk9kZCk6IFBhdGhzNjQge1xyXG4gICAgcmV0dXJuIHRoaXMuQm9vbGVhbk9wKENsaXBUeXBlLlVuaW9uLCBzdWJqZWN0LCBjbGlwLCBmaWxsUnVsZSk7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgc3RhdGljIERpZmZlcmVuY2Uoc3ViamVjdDogUGF0aHM2NCwgY2xpcDogUGF0aHM2NCwgZmlsbFJ1bGU6IEZpbGxSdWxlKTogUGF0aHM2NCB7XHJcbiAgICByZXR1cm4gdGhpcy5Cb29sZWFuT3AoQ2xpcFR5cGUuRGlmZmVyZW5jZSwgc3ViamVjdCwgY2xpcCwgZmlsbFJ1bGUpO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIHN0YXRpYyBYb3Ioc3ViamVjdDogUGF0aHM2NCwgY2xpcDogUGF0aHM2NCwgZmlsbFJ1bGU6IEZpbGxSdWxlKTogUGF0aHM2NCB7XHJcbiAgICByZXR1cm4gdGhpcy5Cb29sZWFuT3AoQ2xpcFR5cGUuWG9yLCBzdWJqZWN0LCBjbGlwLCBmaWxsUnVsZSk7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgc3RhdGljIEJvb2xlYW5PcChjbGlwVHlwZTogQ2xpcFR5cGUsIHN1YmplY3Q/OiBQYXRoczY0LCBjbGlwPzogUGF0aHM2NCwgZmlsbFJ1bGUgPSBGaWxsUnVsZS5FdmVuT2RkKTogUGF0aHM2NCB7XHJcbiAgICBjb25zdCBzb2x1dGlvbjogUGF0aHM2NCA9IG5ldyBQYXRoczY0KCk7XHJcbiAgICBpZiAoIXN1YmplY3QpIHJldHVybiBzb2x1dGlvbjtcclxuICAgIGNvbnN0IGM6IENsaXBwZXI2NCA9IG5ldyBDbGlwcGVyNjQoKTtcclxuICAgIGMuYWRkUGF0aHMoc3ViamVjdCwgUGF0aFR5cGUuU3ViamVjdCk7XHJcbiAgICBpZiAoY2xpcClcclxuICAgICAgYy5hZGRQYXRocyhjbGlwLCBQYXRoVHlwZS5DbGlwKTtcclxuICAgIGMuZXhlY3V0ZShjbGlwVHlwZSwgZmlsbFJ1bGUsIHNvbHV0aW9uKTtcclxuICAgIHJldHVybiBzb2x1dGlvbjtcclxuICB9XHJcblxyXG4gIC8vcHVibGljIHN0YXRpYyBCb29sZWFuT3AoY2xpcFR5cGU6IENsaXBUeXBlLCBzdWJqZWN0OiBQYXRoczY0LCBjbGlwOiBQYXRoczY0LCBwb2x5dHJlZTogUG9seVRyZWU2NCwgZmlsbFJ1bGU6IEZpbGxSdWxlKTogdm9pZCB7XHJcbiAgLy8gIGlmICghc3ViamVjdCkgcmV0dXJuO1xyXG4gIC8vICBjb25zdCBjOiBDbGlwcGVyNjQgPSBuZXcgQ2xpcHBlcjY0KCk7XHJcbiAgLy8gIGMuYWRkUGF0aHMoc3ViamVjdCwgUGF0aFR5cGUuU3ViamVjdCk7XHJcbiAgLy8gIGlmIChjbGlwKVxyXG4gIC8vICAgIGMuYWRkUGF0aHMoY2xpcCwgUGF0aFR5cGUuQ2xpcCk7XHJcbiAgLy8gIGMuZXhlY3V0ZShjbGlwVHlwZSwgZmlsbFJ1bGUsIHBvbHl0cmVlKTtcclxuICAvL31cclxuXHJcbiAgcHVibGljIHN0YXRpYyBJbmZsYXRlUGF0aHMocGF0aHM6IFBhdGhzNjQsIGRlbHRhOiBudW1iZXIsIGpvaW5UeXBlOiBKb2luVHlwZSwgZW5kVHlwZTogRW5kVHlwZSwgbWl0ZXJMaW1pdDogbnVtYmVyID0gMi4wKTogUGF0aHM2NCB7XHJcbiAgICBjb25zdCBjbzogQ2xpcHBlck9mZnNldCA9IG5ldyBDbGlwcGVyT2Zmc2V0KG1pdGVyTGltaXQpO1xyXG4gICAgY28uYWRkUGF0aHMocGF0aHMsIGpvaW5UeXBlLCBlbmRUeXBlKTtcclxuICAgIGNvbnN0IHNvbHV0aW9uOiBQYXRoczY0ID0gbmV3IFBhdGhzNjQoKTtcclxuICAgIGNvLmV4ZWN1dGUoZGVsdGEsIHNvbHV0aW9uKTtcclxuICAgIHJldHVybiBzb2x1dGlvbjtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBzdGF0aWMgUmVjdENsaXBQYXRocyhyZWN0OiBSZWN0NjQsIHBhdGhzOiBQYXRoczY0KTogUGF0aHM2NCB7XHJcbiAgICBpZiAocmVjdC5pc0VtcHR5KCkgfHwgcGF0aHMubGVuZ3RoID09PSAwKSByZXR1cm4gbmV3IFBhdGhzNjQoKTtcclxuICAgIGNvbnN0IHJjID0gbmV3IFJlY3RDbGlwNjQocmVjdCk7XHJcbiAgICByZXR1cm4gcmMuZXhlY3V0ZShwYXRocyk7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgc3RhdGljIFJlY3RDbGlwKHJlY3Q6IFJlY3Q2NCwgcGF0aDogUGF0aDY0KTogUGF0aHM2NCB7XHJcbiAgICBpZiAocmVjdC5pc0VtcHR5KCkgfHwgcGF0aC5sZW5ndGggPT09IDApIHJldHVybiBuZXcgUGF0aHM2NCgpO1xyXG4gICAgY29uc3QgdG1wOiBQYXRoczY0ID0gbmV3IFBhdGhzNjQoKTtcclxuICAgIHRtcC5wdXNoKHBhdGgpO1xyXG4gICAgcmV0dXJuIHRoaXMuUmVjdENsaXBQYXRocyhyZWN0LCB0bXApO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIHN0YXRpYyBSZWN0Q2xpcExpbmVzUGF0aHMocmVjdDogUmVjdDY0LCBwYXRoczogUGF0aHM2NCk6IFBhdGhzNjQge1xyXG4gICAgaWYgKHJlY3QuaXNFbXB0eSgpIHx8IHBhdGhzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIG5ldyBQYXRoczY0KCk7XHJcbiAgICBjb25zdCByYyA9IG5ldyBSZWN0Q2xpcExpbmVzNjQocmVjdCk7XHJcbiAgICByZXR1cm4gcmMuZXhlY3V0ZShwYXRocyk7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgc3RhdGljIFJlY3RDbGlwTGluZXMocmVjdDogUmVjdDY0LCBwYXRoOiBQYXRoNjQpOiBQYXRoczY0IHtcclxuICAgIGlmIChyZWN0LmlzRW1wdHkoKSB8fCBwYXRoLmxlbmd0aCA9PT0gMCkgcmV0dXJuIG5ldyBQYXRoczY0KCk7XHJcbiAgICBjb25zdCB0bXA6IFBhdGhzNjQgPSBuZXcgUGF0aHM2NCgpO1xyXG4gICAgdG1wLnB1c2gocGF0aCk7XHJcbiAgICByZXR1cm4gdGhpcy5SZWN0Q2xpcExpbmVzUGF0aHMocmVjdCwgdG1wKTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBzdGF0aWMgTWlua293c2tpU3VtKHBhdHRlcm46IFBhdGg2NCwgcGF0aDogUGF0aDY0LCBpc0Nsb3NlZDogYm9vbGVhbik6IFBhdGhzNjQge1xyXG4gICAgcmV0dXJuIE1pbmtvd3NraS5zdW0ocGF0dGVybiwgcGF0aCwgaXNDbG9zZWQpO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIHN0YXRpYyBNaW5rb3dza2lEaWZmKHBhdHRlcm46IFBhdGg2NCwgcGF0aDogUGF0aDY0LCBpc0Nsb3NlZDogYm9vbGVhbik6IFBhdGhzNjQge1xyXG4gICAgcmV0dXJuIE1pbmtvd3NraS5kaWZmKHBhdHRlcm4sIHBhdGgsIGlzQ2xvc2VkKTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBzdGF0aWMgYXJlYShwYXRoOiBQYXRoNjQpOiBudW1iZXIge1xyXG4gICAgLy8gaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvU2hvZWxhY2VfZm9ybXVsYVxyXG4gICAgbGV0IGEgPSAwLjA7XHJcbiAgICBjb25zdCBjbnQgPSBwYXRoLmxlbmd0aDtcclxuICAgIGlmIChjbnQgPCAzKSByZXR1cm4gMC4wO1xyXG4gICAgbGV0IHByZXZQdCA9IHBhdGhbY250IC0gMV07XHJcbiAgICBmb3IgKGNvbnN0IHB0IG9mIHBhdGgpIHtcclxuICAgICAgYSArPSAocHJldlB0LnkgKyBwdC55KSAqIChwcmV2UHQueCAtIHB0LngpO1xyXG4gICAgICBwcmV2UHQgPSBwdDtcclxuICAgIH1cclxuICAgIHJldHVybiBhICogMC41O1xyXG4gIH1cclxuXHJcbiAgcHVibGljIHN0YXRpYyBhcmVhUGF0aHMocGF0aHM6IFBhdGhzNjQpOiBudW1iZXIge1xyXG4gICAgbGV0IGEgPSAwLjA7XHJcbiAgICBmb3IgKGNvbnN0IHBhdGggb2YgcGF0aHMpXHJcbiAgICAgIGEgKz0gdGhpcy5hcmVhKHBhdGgpO1xyXG4gICAgcmV0dXJuIGE7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgc3RhdGljIGlzUG9zaXRpdmUocG9seTogUGF0aDY0KTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gdGhpcy5hcmVhKHBvbHkpID49IDA7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgc3RhdGljIHBhdGg2NFRvU3RyaW5nKHBhdGg6IFBhdGg2NCk6IHN0cmluZyB7XHJcbiAgICBsZXQgcmVzdWx0ID0gXCJcIjtcclxuICAgIGZvciAoY29uc3QgcHQgb2YgcGF0aClcclxuICAgICAgcmVzdWx0ICs9IHB0LnRvU3RyaW5nKCk7XHJcbiAgICByZXR1cm4gcmVzdWx0ICsgJ1xcbic7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgc3RhdGljIHBhdGhzNjRUb1N0cmluZyhwYXRoczogUGF0aHM2NCk6IHN0cmluZyB7XHJcbiAgICBsZXQgcmVzdWx0ID0gXCJcIjtcclxuICAgIGZvciAoY29uc3QgcGF0aCBvZiBwYXRocylcclxuICAgICAgcmVzdWx0ICs9IHRoaXMucGF0aDY0VG9TdHJpbmcocGF0aCk7XHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG4gIH1cclxuXHJcbiAgcHVibGljIHN0YXRpYyBvZmZzZXRQYXRoKHBhdGg6IFBhdGg2NCwgZHg6IG51bWJlciwgZHk6IG51bWJlcik6IFBhdGg2NCB7XHJcbiAgICBjb25zdCByZXN1bHQgPSBuZXcgUGF0aDY0KCk7XHJcbiAgICBmb3IgKGNvbnN0IHB0IG9mIHBhdGgpXHJcbiAgICAgIHJlc3VsdC5wdXNoKG5ldyBQb2ludDY0KHB0LnggKyBkeCwgcHQueSArIGR5KSk7XHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG4gIH1cclxuXHJcbiAgcHVibGljIHN0YXRpYyBzY2FsZVBvaW50NjQocHQ6IFBvaW50NjQsIHNjYWxlOiBudW1iZXIpOiBQb2ludDY0IHtcclxuICAgIGNvbnN0IHJlc3VsdCA9IG5ldyBQb2ludDY0KFxyXG4gICAgICBNYXRoLnJvdW5kKHB0LnggKiBzY2FsZSksXHJcbiAgICAgIE1hdGgucm91bmQocHQueSAqIHNjYWxlKVxyXG4gICAgKVxyXG4gICAgcmV0dXJuIHJlc3VsdDtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBzdGF0aWMgc2NhbGVQYXRoKHBhdGg6IFBhdGg2NCwgc2NhbGU6IG51bWJlcik6IFBhdGg2NCB7XHJcbiAgICBpZiAoSW50ZXJuYWxDbGlwcGVyLmlzQWxtb3N0WmVybyhzY2FsZSAtIDEpKSByZXR1cm4gcGF0aDtcclxuICAgIGNvbnN0IHJlc3VsdDogUGF0aDY0ID0gW107XHJcbiAgICBmb3IgKGNvbnN0IHB0IG9mIHBhdGgpXHJcbiAgICAgIHJlc3VsdC5wdXNoKHsgeDogcHQueCAqIHNjYWxlLCB5OiBwdC55ICogc2NhbGUgfSk7XHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG4gIH1cclxuXHJcbiAgcHVibGljIHN0YXRpYyBzY2FsZVBhdGhzKHBhdGhzOiBQYXRoczY0LCBzY2FsZTogbnVtYmVyKTogUGF0aHM2NCB7XHJcbiAgICBpZiAoSW50ZXJuYWxDbGlwcGVyLmlzQWxtb3N0WmVybyhzY2FsZSAtIDEpKSByZXR1cm4gcGF0aHM7XHJcbiAgICBjb25zdCByZXN1bHQ6IFBhdGhzNjQgPSBbXTtcclxuICAgIGZvciAoY29uc3QgcGF0aCBvZiBwYXRocylcclxuICAgICAgcmVzdWx0LnB1c2godGhpcy5zY2FsZVBhdGgocGF0aCwgc2NhbGUpKTtcclxuICAgIHJldHVybiByZXN1bHQ7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgc3RhdGljIHRyYW5zbGF0ZVBhdGgocGF0aDogUGF0aDY0LCBkeDogbnVtYmVyLCBkeTogbnVtYmVyKTogUGF0aDY0IHtcclxuICAgIGNvbnN0IHJlc3VsdDogUGF0aDY0ID0gW107XHJcbiAgICBmb3IgKGNvbnN0IHB0IG9mIHBhdGgpIHtcclxuICAgICAgcmVzdWx0LnB1c2goeyB4OiBwdC54ICsgZHgsIHk6IHB0LnkgKyBkeSB9KTtcclxuICAgIH1cclxuICAgIHJldHVybiByZXN1bHQ7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgc3RhdGljIHRyYW5zbGF0ZVBhdGhzKHBhdGhzOiBQYXRoczY0LCBkeDogbnVtYmVyLCBkeTogbnVtYmVyKTogUGF0aHM2NCB7XHJcbiAgICBjb25zdCByZXN1bHQ6IFBhdGhzNjQgPSBbXTtcclxuICAgIGZvciAoY29uc3QgcGF0aCBvZiBwYXRocykge1xyXG4gICAgICByZXN1bHQucHVzaCh0aGlzLnRyYW5zbGF0ZVBhdGgocGF0aCwgZHgsIGR5KSk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG4gIH1cclxuXHJcbiAgcHVibGljIHN0YXRpYyByZXZlcnNlUGF0aChwYXRoOiBQYXRoNjQpOiBQYXRoNjQge1xyXG4gICAgcmV0dXJuIFsuLi5wYXRoXS5yZXZlcnNlKCk7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgc3RhdGljIHJldmVyc2VQYXRocyhwYXRoczogUGF0aHM2NCk6IFBhdGhzNjQge1xyXG4gICAgY29uc3QgcmVzdWx0OiBQYXRoczY0ID0gW107XHJcbiAgICBmb3IgKGNvbnN0IHQgb2YgcGF0aHMpIHtcclxuICAgICAgcmVzdWx0LnB1c2godGhpcy5yZXZlcnNlUGF0aCh0KSk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG4gIH1cclxuXHJcbiAgcHVibGljIHN0YXRpYyBnZXRCb3VuZHMocGF0aDogUGF0aDY0KTogUmVjdDY0IHtcclxuICAgIGNvbnN0IHJlc3VsdDogUmVjdDY0ID0gQ2xpcHBlci5JbnZhbGlkUmVjdDY0O1xyXG4gICAgZm9yIChjb25zdCBwdCBvZiBwYXRoKSB7XHJcbiAgICAgIGlmIChwdC54IDwgcmVzdWx0LmxlZnQpIHJlc3VsdC5sZWZ0ID0gcHQueDtcclxuICAgICAgaWYgKHB0LnggPiByZXN1bHQucmlnaHQpIHJlc3VsdC5yaWdodCA9IHB0Lng7XHJcbiAgICAgIGlmIChwdC55IDwgcmVzdWx0LnRvcCkgcmVzdWx0LnRvcCA9IHB0Lnk7XHJcbiAgICAgIGlmIChwdC55ID4gcmVzdWx0LmJvdHRvbSkgcmVzdWx0LmJvdHRvbSA9IHB0Lnk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gcmVzdWx0LmxlZnQgPT09IE51bWJlci5NQVhfU0FGRV9JTlRFR0VSID8gbmV3IFJlY3Q2NCgwLCAwLCAwLCAwKSA6IHJlc3VsdDtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBzdGF0aWMgZ2V0Qm91bmRzUGF0aHMocGF0aHM6IFBhdGhzNjQpOiBSZWN0NjQge1xyXG4gICAgY29uc3QgcmVzdWx0OiBSZWN0NjQgPSBDbGlwcGVyLkludmFsaWRSZWN0NjQ7XHJcbiAgICBmb3IgKGNvbnN0IHBhdGggb2YgcGF0aHMpIHtcclxuICAgICAgZm9yIChjb25zdCBwdCBvZiBwYXRoKSB7XHJcbiAgICAgICAgaWYgKHB0LnggPCByZXN1bHQubGVmdCkgcmVzdWx0LmxlZnQgPSBwdC54O1xyXG4gICAgICAgIGlmIChwdC54ID4gcmVzdWx0LnJpZ2h0KSByZXN1bHQucmlnaHQgPSBwdC54O1xyXG4gICAgICAgIGlmIChwdC55IDwgcmVzdWx0LnRvcCkgcmVzdWx0LnRvcCA9IHB0Lnk7XHJcbiAgICAgICAgaWYgKHB0LnkgPiByZXN1bHQuYm90dG9tKSByZXN1bHQuYm90dG9tID0gcHQueTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIHJlc3VsdC5sZWZ0ID09PSBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUiA/IG5ldyBSZWN0NjQoMCwgMCwgMCwgMCkgOiByZXN1bHQ7XHJcbiAgfVxyXG5cclxuICBzdGF0aWMgbWFrZVBhdGgoYXJyOiBudW1iZXJbXSk6IFBhdGg2NCB7XHJcbiAgICBjb25zdCBsZW4gPSBhcnIubGVuZ3RoIC8gMjtcclxuICAgIGNvbnN0IHAgPSBuZXcgUGF0aDY0KCk7XHJcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbjsgaSsrKVxyXG4gICAgICBwLnB1c2gobmV3IFBvaW50NjQoYXJyW2kgKiAyXSwgYXJyW2kgKiAyICsgMV0pKTtcclxuICAgIHJldHVybiBwO1xyXG4gIH1cclxuXHJcbiAgc3RhdGljIHN0cmlwRHVwbGljYXRlcyhwYXRoOiBQYXRoNjQsIGlzQ2xvc2VkUGF0aDogYm9vbGVhbik6IFBhdGg2NCB7XHJcbiAgICBjb25zdCBjbnQgPSBwYXRoLmxlbmd0aDtcclxuICAgIGNvbnN0IHJlc3VsdCA9IG5ldyBQYXRoNjQoKTtcclxuICAgIGlmIChjbnQgPT09IDApIHJldHVybiByZXN1bHQ7XHJcbiAgICBsZXQgbGFzdFB0ID0gcGF0aFswXTtcclxuICAgIHJlc3VsdC5wdXNoKGxhc3RQdCk7XHJcbiAgICBmb3IgKGxldCBpID0gMTsgaSA8IGNudDsgaSsrKVxyXG4gICAgICBpZiAobGFzdFB0ICE9PSBwYXRoW2ldKSB7XHJcbiAgICAgICAgbGFzdFB0ID0gcGF0aFtpXTtcclxuICAgICAgICByZXN1bHQucHVzaChsYXN0UHQpO1xyXG4gICAgICB9XHJcbiAgICBpZiAoaXNDbG9zZWRQYXRoICYmIGxhc3RQdCA9PT0gcmVzdWx0WzBdKVxyXG4gICAgICByZXN1bHQucG9wKCk7XHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBzdGF0aWMgYWRkUG9seU5vZGVUb1BhdGhzKHBvbHlQYXRoOiBQb2x5UGF0aEJhc2UsIHBhdGhzOiBQYXRoczY0KTogdm9pZCB7XHJcbiAgICBpZiAocG9seVBhdGgucG9seWdvbiAmJiBwb2x5UGF0aC5wb2x5Z29uLmxlbmd0aCA+IDApXHJcbiAgICAgIHBhdGhzLnB1c2gocG9seVBhdGgucG9seWdvbik7XHJcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBvbHlQYXRoLmNvdW50OyBpKyspXHJcbiAgICAgIHRoaXMuYWRkUG9seU5vZGVUb1BhdGhzKHBvbHlQYXRoLmNoaWxkcmVuW2ldLCBwYXRocyk7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgc3RhdGljIHBvbHlUcmVlVG9QYXRoczY0KHBvbHlUcmVlOiBQb2x5VHJlZTY0KTogUGF0aHM2NCB7XHJcbiAgICBjb25zdCByZXN1bHQ6IFBhdGhzNjQgPSBuZXcgUGF0aHM2NCgpO1xyXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwb2x5VHJlZS5jb3VudDsgaSsrKSB7XHJcbiAgICAgIENsaXBwZXIuYWRkUG9seU5vZGVUb1BhdGhzKHBvbHlUcmVlLmNoaWxkcmVuW2ldIGFzIFBvbHlQYXRoNjQsIHJlc3VsdCk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG4gIH1cclxuXHJcbiAgcHVibGljIHN0YXRpYyBwZXJwZW5kaWNEaXN0RnJvbUxpbmVTcXJkKHB0OiBJUG9pbnQ2NCwgbGluZTE6IElQb2ludDY0LCBsaW5lMjogSVBvaW50NjQpOiBudW1iZXIge1xyXG4gICAgY29uc3QgYSA9IHB0LnggLSBsaW5lMS54O1xyXG4gICAgY29uc3QgYiA9IHB0LnkgLSBsaW5lMS55O1xyXG4gICAgY29uc3QgYyA9IGxpbmUyLnggLSBsaW5lMS54O1xyXG4gICAgY29uc3QgZCA9IGxpbmUyLnkgLSBsaW5lMS55O1xyXG4gICAgaWYgKGMgPT09IDAgJiYgZCA9PT0gMCkgcmV0dXJuIDA7XHJcbiAgICByZXR1cm4gQ2xpcHBlci5zcXIoYSAqIGQgLSBjICogYikgLyAoYyAqIGMgKyBkICogZCk7XHJcbiAgfVxyXG5cclxuICBzdGF0aWMgcmRwKHBhdGg6IFBhdGg2NCwgYmVnaW46IG51bWJlciwgZW5kOiBudW1iZXIsIGVwc1NxcmQ6IG51bWJlciwgZmxhZ3M6IGJvb2xlYW5bXSk6IHZvaWQge1xyXG4gICAgbGV0IGlkeCA9IDA7XHJcbiAgICBsZXQgbWF4X2QgPSAwO1xyXG5cclxuICAgIHdoaWxlIChlbmQgPiBiZWdpbiAmJiBwYXRoW2JlZ2luXSA9PT0gcGF0aFtlbmRdKSB7XHJcbiAgICAgIGZsYWdzW2VuZC0tXSA9IGZhbHNlO1xyXG4gICAgfVxyXG4gICAgZm9yIChsZXQgaSA9IGJlZ2luICsgMTsgaSA8IGVuZDsgaSsrKSB7XHJcbiAgICAgIGNvbnN0IGQgPSBDbGlwcGVyLnBlcnBlbmRpY0Rpc3RGcm9tTGluZVNxcmQocGF0aFtpXSwgcGF0aFtiZWdpbl0sIHBhdGhbZW5kXSk7XHJcbiAgICAgIGlmIChkIDw9IG1heF9kKSBjb250aW51ZTtcclxuICAgICAgbWF4X2QgPSBkO1xyXG4gICAgICBpZHggPSBpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChtYXhfZCA8PSBlcHNTcXJkKSByZXR1cm47XHJcblxyXG4gICAgZmxhZ3NbaWR4XSA9IHRydWU7XHJcbiAgICBpZiAoaWR4ID4gYmVnaW4gKyAxKSBDbGlwcGVyLnJkcChwYXRoLCBiZWdpbiwgaWR4LCBlcHNTcXJkLCBmbGFncyk7XHJcbiAgICBpZiAoaWR4IDwgZW5kIC0gMSkgQ2xpcHBlci5yZHAocGF0aCwgaWR4LCBlbmQsIGVwc1NxcmQsIGZsYWdzKTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBzdGF0aWMgcmFtZXJEb3VnbGFzUGV1Y2tlcihwYXRoOiBQYXRoNjQsIGVwc2lsb246IG51bWJlcik6IFBhdGg2NCB7XHJcbiAgICBjb25zdCBsZW4gPSBwYXRoLmxlbmd0aDtcclxuICAgIGlmIChsZW4gPCA1KSByZXR1cm4gcGF0aDtcclxuXHJcbiAgICBjb25zdCBmbGFncyA9IG5ldyBBcnJheTxib29sZWFuPihsZW4pLmZpbGwoZmFsc2UpO1xyXG4gICAgZmxhZ3NbMF0gPSB0cnVlO1xyXG4gICAgZmxhZ3NbbGVuIC0gMV0gPSB0cnVlO1xyXG4gICAgQ2xpcHBlci5yZHAocGF0aCwgMCwgbGVuIC0gMSwgQ2xpcHBlci5zcXIoZXBzaWxvbiksIGZsYWdzKTtcclxuXHJcbiAgICBjb25zdCByZXN1bHQ6IFBhdGg2NCA9IFtdO1xyXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47IGkrKykge1xyXG4gICAgICBpZiAoZmxhZ3NbaV0pIHJlc3VsdC5wdXNoKHBhdGhbaV0pO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHJlc3VsdDtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBzdGF0aWMgcmFtZXJEb3VnbGFzUGV1Y2tlclBhdGhzKHBhdGhzOiBQYXRoczY0LCBlcHNpbG9uOiBudW1iZXIpOiBQYXRoczY0IHtcclxuICAgIGNvbnN0IHJlc3VsdDogUGF0aHM2NCA9IFtdO1xyXG4gICAgZm9yIChjb25zdCBwYXRoIG9mIHBhdGhzKSB7XHJcbiAgICAgIHJlc3VsdC5wdXNoKENsaXBwZXIucmFtZXJEb3VnbGFzUGV1Y2tlcihwYXRoLCBlcHNpbG9uKSk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBzdGF0aWMgZ2V0TmV4dChjdXJyZW50OiBudW1iZXIsIGhpZ2g6IG51bWJlciwgZmxhZ3M6IGJvb2xlYW5bXSk6IG51bWJlciB7XHJcbiAgICBjdXJyZW50Kys7XHJcbiAgICB3aGlsZSAoY3VycmVudCA8PSBoaWdoICYmIGZsYWdzW2N1cnJlbnRdKSBjdXJyZW50Kys7XHJcbiAgICBpZiAoY3VycmVudCA8PSBoaWdoKSByZXR1cm4gY3VycmVudDtcclxuICAgIGN1cnJlbnQgPSAwO1xyXG4gICAgd2hpbGUgKGZsYWdzW2N1cnJlbnRdKSBjdXJyZW50Kys7XHJcbiAgICByZXR1cm4gY3VycmVudDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgc3RhdGljIGdldFByaW9yKGN1cnJlbnQ6IG51bWJlciwgaGlnaDogbnVtYmVyLCBmbGFnczogYm9vbGVhbltdKTogbnVtYmVyIHtcclxuICAgIGlmIChjdXJyZW50ID09PSAwKSBjdXJyZW50ID0gaGlnaDtcclxuICAgIGVsc2UgY3VycmVudC0tO1xyXG4gICAgd2hpbGUgKGN1cnJlbnQgPiAwICYmIGZsYWdzW2N1cnJlbnRdKSBjdXJyZW50LS07XHJcbiAgICBpZiAoIWZsYWdzW2N1cnJlbnRdKSByZXR1cm4gY3VycmVudDtcclxuICAgIGN1cnJlbnQgPSBoaWdoO1xyXG4gICAgd2hpbGUgKGZsYWdzW2N1cnJlbnRdKSBjdXJyZW50LS07XHJcbiAgICByZXR1cm4gY3VycmVudDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgc3RhdGljIHNxcih2YWx1ZTogbnVtYmVyKTogbnVtYmVyIHtcclxuICAgIHJldHVybiB2YWx1ZSAqIHZhbHVlO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIHN0YXRpYyBzaW1wbGlmeVBhdGgocGF0aDogUGF0aDY0LCBlcHNpbG9uOiBudW1iZXIsIGlzQ2xvc2VkUGF0aDogYm9vbGVhbiA9IGZhbHNlKTogUGF0aDY0IHtcclxuICAgIGNvbnN0IGxlbiA9IHBhdGgubGVuZ3RoO1xyXG4gICAgY29uc3QgaGlnaCA9IGxlbiAtIDE7XHJcbiAgICBjb25zdCBlcHNTcXIgPSB0aGlzLnNxcihlcHNpbG9uKTtcclxuICAgIGlmIChsZW4gPCA0KSByZXR1cm4gcGF0aDtcclxuXHJcbiAgICBjb25zdCBmbGFnczogYm9vbGVhbltdID0gbmV3IEFycmF5PGJvb2xlYW4+KGxlbikuZmlsbChmYWxzZSk7XHJcbiAgICBjb25zdCBkc3E6IG51bWJlcltdID0gbmV3IEFycmF5PG51bWJlcj4obGVuKS5maWxsKDApO1xyXG4gICAgbGV0IHByZXYgPSBoaWdoO1xyXG4gICAgbGV0IGN1cnIgPSAwO1xyXG4gICAgbGV0IHN0YXJ0OiBudW1iZXIsIG5leHQ6IG51bWJlciwgcHJpb3IyOiBudW1iZXIsIG5leHQyOiBudW1iZXI7XHJcblxyXG4gICAgaWYgKGlzQ2xvc2VkUGF0aCkge1xyXG4gICAgICBkc3FbMF0gPSB0aGlzLnBlcnBlbmRpY0Rpc3RGcm9tTGluZVNxcmQocGF0aFswXSwgcGF0aFtoaWdoXSwgcGF0aFsxXSk7XHJcbiAgICAgIGRzcVtoaWdoXSA9IHRoaXMucGVycGVuZGljRGlzdEZyb21MaW5lU3FyZChwYXRoW2hpZ2hdLCBwYXRoWzBdLCBwYXRoW2hpZ2ggLSAxXSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBkc3FbMF0gPSBOdW1iZXIuTUFYX1ZBTFVFO1xyXG4gICAgICBkc3FbaGlnaF0gPSBOdW1iZXIuTUFYX1ZBTFVFO1xyXG4gICAgfVxyXG5cclxuICAgIGZvciAobGV0IGkgPSAxOyBpIDwgaGlnaDsgaSsrKSB7XHJcbiAgICAgIGRzcVtpXSA9IHRoaXMucGVycGVuZGljRGlzdEZyb21MaW5lU3FyZChwYXRoW2ldLCBwYXRoW2kgLSAxXSwgcGF0aFtpICsgMV0pO1xyXG4gICAgfVxyXG5cclxuICAgIGZvciAoOyA7KSB7XHJcbiAgICAgIGlmIChkc3FbY3Vycl0gPiBlcHNTcXIpIHtcclxuICAgICAgICBzdGFydCA9IGN1cnI7XHJcbiAgICAgICAgZG8ge1xyXG4gICAgICAgICAgY3VyciA9IHRoaXMuZ2V0TmV4dChjdXJyLCBoaWdoLCBmbGFncyk7XHJcbiAgICAgICAgfSB3aGlsZSAoY3VyciAhPT0gc3RhcnQgJiYgZHNxW2N1cnJdID4gZXBzU3FyKTtcclxuICAgICAgICBpZiAoY3VyciA9PT0gc3RhcnQpIGJyZWFrO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBwcmV2ID0gdGhpcy5nZXRQcmlvcihjdXJyLCBoaWdoLCBmbGFncyk7XHJcbiAgICAgIG5leHQgPSB0aGlzLmdldE5leHQoY3VyciwgaGlnaCwgZmxhZ3MpO1xyXG4gICAgICBpZiAobmV4dCA9PT0gcHJldikgYnJlYWs7XHJcblxyXG4gICAgICBpZiAoZHNxW25leHRdIDwgZHNxW2N1cnJdKSB7XHJcbiAgICAgICAgZmxhZ3NbbmV4dF0gPSB0cnVlO1xyXG4gICAgICAgIG5leHQgPSB0aGlzLmdldE5leHQobmV4dCwgaGlnaCwgZmxhZ3MpO1xyXG4gICAgICAgIG5leHQyID0gdGhpcy5nZXROZXh0KG5leHQsIGhpZ2gsIGZsYWdzKTtcclxuICAgICAgICBkc3FbY3Vycl0gPSB0aGlzLnBlcnBlbmRpY0Rpc3RGcm9tTGluZVNxcmQocGF0aFtjdXJyXSwgcGF0aFtwcmV2XSwgcGF0aFtuZXh0XSk7XHJcbiAgICAgICAgaWYgKG5leHQgIT09IGhpZ2ggfHwgaXNDbG9zZWRQYXRoKSB7XHJcbiAgICAgICAgICBkc3FbbmV4dF0gPSB0aGlzLnBlcnBlbmRpY0Rpc3RGcm9tTGluZVNxcmQocGF0aFtuZXh0XSwgcGF0aFtjdXJyXSwgcGF0aFtuZXh0Ml0pO1xyXG4gICAgICAgIH1cclxuICAgICAgICBjdXJyID0gbmV4dDtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBmbGFnc1tjdXJyXSA9IHRydWU7XHJcbiAgICAgICAgY3VyciA9IG5leHQ7XHJcbiAgICAgICAgbmV4dCA9IHRoaXMuZ2V0TmV4dChuZXh0LCBoaWdoLCBmbGFncyk7XHJcbiAgICAgICAgcHJpb3IyID0gdGhpcy5nZXRQcmlvcihwcmV2LCBoaWdoLCBmbGFncyk7XHJcbiAgICAgICAgZHNxW2N1cnJdID0gdGhpcy5wZXJwZW5kaWNEaXN0RnJvbUxpbmVTcXJkKHBhdGhbY3Vycl0sIHBhdGhbcHJldl0sIHBhdGhbbmV4dF0pO1xyXG4gICAgICAgIGlmIChwcmV2ICE9PSAwIHx8IGlzQ2xvc2VkUGF0aCkge1xyXG4gICAgICAgICAgZHNxW3ByZXZdID0gdGhpcy5wZXJwZW5kaWNEaXN0RnJvbUxpbmVTcXJkKHBhdGhbcHJldl0sIHBhdGhbcHJpb3IyXSwgcGF0aFtjdXJyXSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgcmVzdWx0OiBQYXRoNjQgPSBbXTtcclxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcclxuICAgICAgaWYgKCFmbGFnc1tpXSkgcmVzdWx0LnB1c2gocGF0aFtpXSk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG4gIH1cclxuXHJcbiAgcHVibGljIHN0YXRpYyBzaW1wbGlmeVBhdGhzKHBhdGhzOiBQYXRoczY0LCBlcHNpbG9uOiBudW1iZXIsIGlzQ2xvc2VkUGF0aHM6IGJvb2xlYW4gPSBmYWxzZSk6IFBhdGhzNjQge1xyXG4gICAgY29uc3QgcmVzdWx0OiBQYXRoczY0ID0gW107XHJcbiAgICBmb3IgKGNvbnN0IHBhdGggb2YgcGF0aHMpIHtcclxuICAgICAgcmVzdWx0LnB1c2godGhpcy5zaW1wbGlmeVBhdGgocGF0aCwgZXBzaWxvbiwgaXNDbG9zZWRQYXRocykpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHJlc3VsdDtcclxuICB9XHJcblxyXG4gIC8vcHJpdmF0ZSBzdGF0aWMgZ2V0TmV4dChjdXJyZW50OiBudW1iZXIsIGhpZ2g6IG51bWJlciwgZmxhZ3M6IGJvb2xlYW5bXSk6IG51bWJlciB7XHJcbiAgLy8gIGN1cnJlbnQrKztcclxuICAvLyAgd2hpbGUgKGN1cnJlbnQgPD0gaGlnaCAmJiBmbGFnc1tjdXJyZW50XSkgY3VycmVudCsrO1xyXG4gIC8vICByZXR1cm4gY3VycmVudDtcclxuICAvL31cclxuXHJcbiAgLy9wcml2YXRlIHN0YXRpYyBnZXRQcmlvcihjdXJyZW50OiBudW1iZXIsIGhpZ2g6IG51bWJlciwgZmxhZ3M6IGJvb2xlYW5bXSk6IG51bWJlciB7XHJcbiAgLy8gIGlmIChjdXJyZW50ID09PSAwKSByZXR1cm4gaGlnaDtcclxuICAvLyAgY3VycmVudC0tO1xyXG4gIC8vICB3aGlsZSAoY3VycmVudCA+IDAgJiYgZmxhZ3NbY3VycmVudF0pIGN1cnJlbnQtLTtcclxuICAvLyAgcmV0dXJuIGN1cnJlbnQ7XHJcbiAgLy99XHJcblxyXG5cclxuICBwdWJsaWMgc3RhdGljIHRyaW1Db2xsaW5lYXIocGF0aDogUGF0aDY0LCBpc09wZW46IGJvb2xlYW4gPSBmYWxzZSk6IFBhdGg2NCB7XHJcbiAgICBsZXQgbGVuID0gcGF0aC5sZW5ndGg7XHJcbiAgICBsZXQgaSA9IDA7XHJcblxyXG4gICAgaWYgKCFpc09wZW4pIHtcclxuICAgICAgd2hpbGUgKGkgPCBsZW4gLSAxICYmIEludGVybmFsQ2xpcHBlci5jcm9zc1Byb2R1Y3QocGF0aFtsZW4gLSAxXSwgcGF0aFtpXSwgcGF0aFtpICsgMV0pID09PSAwKSBpKys7XHJcbiAgICAgIHdoaWxlIChpIDwgbGVuIC0gMSAmJiBJbnRlcm5hbENsaXBwZXIuY3Jvc3NQcm9kdWN0KHBhdGhbbGVuIC0gMl0sIHBhdGhbbGVuIC0gMV0sIHBhdGhbaV0pID09PSAwKSBsZW4tLTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAobGVuIC0gaSA8IDMpIHtcclxuICAgICAgaWYgKCFpc09wZW4gfHwgbGVuIDwgMiB8fCBwYXRoWzBdID09PSBwYXRoWzFdKSB7XHJcbiAgICAgICAgcmV0dXJuIFtdO1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiBwYXRoO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHJlc3VsdDogUGF0aDY0ID0gW107XHJcbiAgICBsZXQgbGFzdCA9IHBhdGhbaV07XHJcbiAgICByZXN1bHQucHVzaChsYXN0KTtcclxuXHJcbiAgICBmb3IgKGkrKzsgaSA8IGxlbiAtIDE7IGkrKykge1xyXG4gICAgICBpZiAoSW50ZXJuYWxDbGlwcGVyLmNyb3NzUHJvZHVjdChsYXN0LCBwYXRoW2ldLCBwYXRoW2kgKyAxXSkgPT09IDApIGNvbnRpbnVlO1xyXG4gICAgICBsYXN0ID0gcGF0aFtpXTtcclxuICAgICAgcmVzdWx0LnB1c2gobGFzdCk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGlzT3Blbikge1xyXG4gICAgICByZXN1bHQucHVzaChwYXRoW2xlbiAtIDFdKTtcclxuICAgIH0gZWxzZSBpZiAoSW50ZXJuYWxDbGlwcGVyLmNyb3NzUHJvZHVjdChsYXN0LCBwYXRoW2xlbiAtIDFdLCByZXN1bHRbMF0pICE9PSAwKSB7XHJcbiAgICAgIHJlc3VsdC5wdXNoKHBhdGhbbGVuIC0gMV0pO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgd2hpbGUgKHJlc3VsdC5sZW5ndGggPiAyICYmIEludGVybmFsQ2xpcHBlci5jcm9zc1Byb2R1Y3QocmVzdWx0W3Jlc3VsdC5sZW5ndGggLSAxXSwgcmVzdWx0W3Jlc3VsdC5sZW5ndGggLSAyXSwgcmVzdWx0WzBdKSA9PT0gMCkge1xyXG4gICAgICAgIHJlc3VsdC5wb3AoKTtcclxuICAgICAgfVxyXG4gICAgICBpZiAocmVzdWx0Lmxlbmd0aCA8IDMpIHJlc3VsdC5zcGxpY2UoMCwgcmVzdWx0Lmxlbmd0aCk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHJlc3VsdDtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBzdGF0aWMgcG9pbnRJblBvbHlnb24ocHQ6IFBvaW50NjQsIHBvbHlnb246IFBhdGg2NCk6IFBvaW50SW5Qb2x5Z29uUmVzdWx0IHtcclxuICAgIHJldHVybiBJbnRlcm5hbENsaXBwZXIucG9pbnRJblBvbHlnb24ocHQsIHBvbHlnb24pO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIHN0YXRpYyBlbGxpcHNlKGNlbnRlcjogSVBvaW50NjQsIHJhZGl1c1g6IG51bWJlciwgcmFkaXVzWTogbnVtYmVyID0gMCwgc3RlcHM6IG51bWJlciA9IDApOiBQYXRoNjQge1xyXG4gICAgaWYgKHJhZGl1c1ggPD0gMCkgcmV0dXJuIFtdO1xyXG4gICAgaWYgKHJhZGl1c1kgPD0gMCkgcmFkaXVzWSA9IHJhZGl1c1g7XHJcbiAgICBpZiAoc3RlcHMgPD0gMikgc3RlcHMgPSBNYXRoLmNlaWwoTWF0aC5QSSAqIE1hdGguc3FydCgocmFkaXVzWCArIHJhZGl1c1kpIC8gMikpO1xyXG5cclxuICAgIGNvbnN0IHNpID0gTWF0aC5zaW4oMiAqIE1hdGguUEkgLyBzdGVwcyk7XHJcbiAgICBjb25zdCBjbyA9IE1hdGguY29zKDIgKiBNYXRoLlBJIC8gc3RlcHMpO1xyXG4gICAgbGV0IGR4ID0gY28sIGR5ID0gc2k7XHJcbiAgICBjb25zdCByZXN1bHQ6IFBhdGg2NCA9IFt7IHg6IGNlbnRlci54ICsgcmFkaXVzWCwgeTogY2VudGVyLnkgfV07XHJcbiAgICBmb3IgKGxldCBpID0gMTsgaSA8IHN0ZXBzOyArK2kpIHtcclxuICAgICAgcmVzdWx0LnB1c2goeyB4OiBjZW50ZXIueCArIHJhZGl1c1ggKiBkeCwgeTogY2VudGVyLnkgKyByYWRpdXNZICogZHkgfSk7XHJcbiAgICAgIGNvbnN0IHggPSBkeCAqIGNvIC0gZHkgKiBzaTtcclxuICAgICAgZHkgPSBkeSAqIGNvICsgZHggKiBzaTtcclxuICAgICAgZHggPSB4O1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHJlc3VsdDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgc3RhdGljIHNob3dQb2x5UGF0aFN0cnVjdHVyZShwcDogUG9seVBhdGhCYXNlLCBsZXZlbDogbnVtYmVyKTogdm9pZCB7XHJcbiAgICBjb25zdCBzcGFjZXMgPSAnICcucmVwZWF0KGxldmVsICogMik7XHJcbiAgICBjb25zdCBjYXB0aW9uID0gcHAuaXNIb2xlID8gXCJIb2xlIFwiIDogXCJPdXRlciBcIjtcclxuICAgIGlmIChwcC5jb3VudCA9PT0gMCkge1xyXG4gICAgICBjb25zb2xlLmxvZyhzcGFjZXMgKyBjYXB0aW9uKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGNvbnNvbGUubG9nKHNwYWNlcyArIGNhcHRpb24gKyBgKCR7cHAuY291bnR9KWApO1xyXG4gICAgICBwcC5mb3JFYWNoKGNoaWxkID0+IHRoaXMuc2hvd1BvbHlQYXRoU3RydWN0dXJlKGNoaWxkLCBsZXZlbCArIDEpKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHB1YmxpYyBzdGF0aWMgc2hvd1BvbHlUcmVlU3RydWN0dXJlKHBvbHl0cmVlOiBQb2x5VHJlZTY0KTogdm9pZCB7XHJcbiAgICBjb25zb2xlLmxvZyhcIlBvbHl0cmVlIFJvb3RcIik7XHJcbiAgICBwb2x5dHJlZS5mb3JFYWNoKGNoaWxkID0+IHRoaXMuc2hvd1BvbHlQYXRoU3RydWN0dXJlKGNoaWxkLCAxKSk7XHJcbiAgfVxyXG5cclxufVxyXG4iXX0=