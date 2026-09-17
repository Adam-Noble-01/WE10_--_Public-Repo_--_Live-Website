#!/usr/bin/env python3
"""
pd_audit_checklists.py  --  prove every limit in the checklists is still the law.

The checklist files in references/ quote numeric limits. If the GPDO snapshot is
refreshed and a limit has changed, the checklists would silently be wrong. This
script asserts each limit against the verbatim statutory text.

    python pd_audit_checklists.py

Exits non-zero if any assertion fails. Run it after every
pd_fetch_legislation.py, and fix the checklist -- not the assertion -- when one
fails, then re-read the amending instrument to see what else moved.
"""

import sys
from pathlib import Path

SRC = Path(__file__).resolve().parent.parent / "references" / "source"
P1 = "GPDO-2015__Sch2-Part-1__Householder.md"
P2 = "GPDO-2015__Sch2-Part-2__Minor-operations.md"
P14 = "GPDO-2015__Sch2-Part-14__Renewable-energy.md"
ART2 = "GPDO-2015__Article-2__Interpretation.md"
ART3 = "GPDO-2015__Article-3__Permission-granted.md"

# (label, exact substring that must appear, file)
ASSERTIONS = [
    # --- Class A ---------------------------------------------------------
    ("A.1(b) 50% curtilage", "would exceed 50% of the total area of the curtilage", P1),
    ("A.1(f) 4m detached / 3m other", "by more than 4 metres in the case of a detached dwellinghouse, or 3 metres", P1),
    ("A.1(g) 8m detached / 6m other", "by more than 8 metres in the case of a detached dwellinghouse, or 6 metres", P1),
    ("A.1(h)(i) 3m two-storey rear", "extend beyond the rear wall of the original dwellinghouse by more than 3 metres", P1),
    ("A.1(h)(ii) 7m to opposite boundary", "be within 7 metres of any boundary", P1),
    ("A.1(i) 2m boundary / 3m eaves", "within 2 metres of the boundary of the curtilage of the dwellinghouse, and the height of the eaves of the enlarged part would exceed 3 metres", P1),
    ("A.1(j)(iii) half the width", "have a width greater than half the width of the original dwellinghouse", P1),
    ("A.1(k)(iv) roof alterations out of Class A", "an alteration to any part of the roof of the dwellinghouse", P1),
    ("A.2(a) cladding on art 2(3) land", "pebble dash, render, timber, plastic or tiles", P1),
    ("A.3(b)(ii) 1.7m above floor", "more than 1.7 metres above the floor of the room", P1),
    ("A.4(5)(d) not less than 21 days", "not less than 21 days from the date of the notice", P1),
    ("A.4(10)(c) 42 days", "the expiry of 42 days", P1),
    # --- Class AA --------------------------------------------------------
    ("AA.1(c) 1 Jul 1948 / 28 Oct 2018", "constructed before 1st July 1948 or after 28th October 2018", P1),
    ("AA.1(e) 18m cap", "would exceed 18 metres", P1),
    ("AA.1(f) 3.5m one storey", "3.5 metres, where the existing dwellinghouse consists of one storey", P1),
    ("AA.1(f) 7m more than one storey", "7 metres, where the existing dwellinghouse consists of more than one storey", P1),
    ("AA.1(h) floor-to-ceiling, internal", "measured internally, would exceed the lower of", P1),
    ("AA.2(2)(b) NO side-elevation window", "must not include a window in any wall or roof slope forming a side elevation", P1),
    ("AA.2(3)(c) 3 year completion", "completed within a period of 3 years", P1),
    ("AA.3(13) written approval, no deemed consent", "must not begin before the receipt by the applicant", P1),
    # --- Classes B and C -------------------------------------------------
    ("B.1(d) 40 cubic metres terrace", "40 cubic metres in the case of a terrace house", P1),
    ("B.1(d) 50 cubic metres other", "50 cubic metres in any other case", P1),
    ("B.1(f) no Class B on art 2(3) land", "the dwellinghouse is on article 2(3) land", P1),
    ("B.1(h) Class AA extinguishes Class B", "enlarged in reliance on the permission granted by Class AA", P1),
    ("B.2 0.2m eaves set-back", "not less than 0.2 metres from the eaves", P1),
    ("C.1(b) 0.15m protrusion", "protrude more than 0.15 metres beyond the plane of the slope of the original roof", P1),
    # --- Classes D, E, F, G, H -------------------------------------------
    ("D.1(b) 3 square metres", "would exceed 3 square metres", P1),
    ("D.1(c) 3m above ground level", "more than 3 metres above ground level", P1),
    ("D.1(d) within 2m of a highway", "within 2 metres of any boundary of the curtilage of the dwellinghouse with a highway", P1),
    ("E.1(e)(i) 4m dual-pitched", "4 metres in the case of a building with a dual-pitched roof", P1),
    ("E.1(e)(ii) 2.5m within 2m of boundary", "2.5 metres in the case of a building, enclosure or container within 2 metres of the boundary", P1),
    ("E.1(e)(iii) 3m otherwise", "3 metres in any other case", P1),
    ("E.1(f) 2.5m eaves", "height of the eaves of the building would exceed 2.5 metres", P1),
    ("E.1(g) curtilage of a listed building", "situated within the curtilage of a listed building", P1),
    ("E.1(j) 3,500 litres", "exceed 3,500 litres", P1),
    ("E.2 20m / 10 square metres", "more than 20 metres from any wall of the dwellinghouse would exceed 10 square metres", P1),
    ("F.2(b) 5 square metres", "would exceed 5 square metres", P1),
    ("G.1(b) '1 metre or more'", "exceed the highest part of the roof by 1 metre or more", P1),
    ("H.1(b)(ii) 1 metre antenna", "a single antenna exceeding 1 metre in length", P1),
    ("H.1(b)(vi) 35 litres", "cubic capacity in excess of 35 litres", P1),
    ("H.3(a) 0.6m relevant size criteria", "only 1 of the antennas may exceed 0.6 metres in length", P1),
    # --- Part 1 interpretation -------------------------------------------
    ("Pt1 'raised' = greater than 0.3m", "platform with a height greater than 0.3 metres", P1),
    ("Pt1 'highway' includes private way", "includes an unadopted street or a private way", P1),
    # --- Articles ---------------------------------------------------------
    ("art 2 'original' = 1 July 1948", "existing on 1st July 1948, as existing on that date", ART2),
    ("art 2 'dwellinghouse' excludes flats", "does not include a building containing one or more flats", ART2),
    ("art 2 'cubic content' measured externally", "cubic content of a structure or building measured externally", ART2),
    ("art 3(4) conditions override", "permits development contrary to any condition imposed by any planning permission", ART3),
    ("art 3(5) unlawful building", "the building operations involved in the construction of that building are unlawful", ART3),
    # --- Part 2 -----------------------------------------------------------
    ("Pt2 A.1(a)(ii) 1m adjacent to highway", "in any other case, 1 metre above ground level", P2),
    ("Pt2 A.1(b) 2m elsewhere", "means of enclosure erected or constructed would exceed 2 metres above ground level", P2),
    ("Pt2 A.1(d) listed building", "surrounding, a listed building", P2),
    # --- Part 14 ----------------------------------------------------------
    ("Pt14 A.1(2)(d) flat roof 0.6m", "more than 0.6 metres higher than the highest part of the roof", P14),
    ("Pt14 G.1 MCS Planning Standards", "complies with the MCS Planning Standards", P14),
    ("Pt14 G.2(a)(ii) 2 pumps on detached", "more than two air source heat pumps on, or within the curtilage of, a detached", P14),
    ("Pt14 G.2(d)(i) 1.5 cubic metres", "exceed 1.5 cubic metres", P14),
    ("Pt14 G.2(g) 1m from flat roof edge", "within 1 metre of the external edge of that roof", P14),
]


def main() -> int:
    cache: dict[str, str] = {}
    failures = []
    for label, needle, fname in ASSERTIONS:
        if fname not in cache:
            path = SRC / fname
            if not path.exists():
                print(f"MISSING SOURCE: {fname}", file=sys.stderr)
                return 2
            cache[fname] = path.read_text(encoding="utf-8")
        ok = needle in cache[fname]
        print(f"  {'OK  ' if ok else 'FAIL'}  {label}")
        if not ok:
            failures.append((label, needle, fname))

    print(f"\n{len(ASSERTIONS) - len(failures)}/{len(ASSERTIONS)} assertions hold.")
    if failures:
        print("\nThe law has moved, or the snapshot changed shape. For each failure,"
              "\nre-read the provision and correct the CHECKLIST, not this script:\n")
        for label, needle, fname in failures:
            print(f"  {label}\n    expected in {fname}:\n    {needle!r}\n")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
