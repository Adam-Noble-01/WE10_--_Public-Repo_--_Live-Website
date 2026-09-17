#!/usr/bin/env python3
"""
pd_fetch_legislation.py  --  refresh the primary-source legislation snapshot.

Pulls the CURRENT IN-FORCE (latest revised) text of the parts of the GPDO 2015
that a householder permitted-development appraisal depends on, straight from
legislation.gov.uk, and writes them to references/source/ as plain markdown.

Run this whenever you want to re-verify that the snapshot in the skill is still
the current law:

    python pd_fetch_legislation.py

It prints, for each part, the "up to date" / outstanding-effects banner that
legislation.gov.uk shows, so you can see at a glance whether the revised text
has unapplied amendments. NEVER appraise against a snapshot whose banner warns
of outstanding effects without checking those effects first.

Dependencies: requests, beautifulsoup4, lxml (all already present on this PC).
"""

import re
import sys
import datetime
from pathlib import Path

import requests
from bs4 import BeautifulSoup

BASE = "https://www.legislation.gov.uk"
UA = {"User-Agent": "Mozilla/5.0 (compatible; NobleArchitecture-PD-Check/1.0)"}

# Everything a householder appraisal can turn on.
TARGETS = [
    ("uksi/2015/596/article/2",            "GPDO-2015__Article-2__Interpretation"),
    ("uksi/2015/596/article/3",            "GPDO-2015__Article-3__Permission-granted"),
    ("uksi/2015/596/article/4",            "GPDO-2015__Article-4__Article-4-directions"),
    ("uksi/2015/596/schedule/1",           "GPDO-2015__Sch1__Article-2(3)-land"),
    ("uksi/2015/596/schedule/2/part/1",    "GPDO-2015__Sch2-Part-1__Householder"),
    ("uksi/2015/596/schedule/2/part/2",    "GPDO-2015__Sch2-Part-2__Minor-operations"),
    ("uksi/2015/596/schedule/2/part/14",   "GPDO-2015__Sch2-Part-14__Renewable-energy"),
    ("uksi/2015/596/schedule/2/part/20",   "GPDO-2015__Sch2-Part-20__New-dwellinghouses"),
]

OUT = Path(__file__).resolve().parent.parent / "references" / "source"


# Editorial apparatus that clutters a quote but carries no statutory meaning.
DROP_INLINE = (
    "span.LegExtentRestriction",   # the "E+W" extent tags
    "a.LegCommentaryLink",         # the F1 / F2 / I1 amendment footnote markers
    "span.LegChangeDelimiter",     # the square brackets around amended text
    "span.btr", "span.bbl", "span.bbr",  # purely decorative
)
BLOCKS = ["h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "td", "blockquote"]
HEADING_TAGS = {"h1", "h2", "h3", "h4", "h5", "h6"}


def html_to_text(html: str) -> tuple[str, str]:
    """Return (banner, body_text) from a legislation.gov.uk page.

    Keeps each statutory paragraph on ONE line so it can be quoted verbatim,
    and marks headings with markdown ## so the reference indexes can point at
    them. Strips only editorial apparatus, never statutory wording.
    """
    soup = BeautifulSoup(html, "lxml")

    # The "Changes to legislation" / version banner, captured before stripping.
    banner_bits = []
    for sel in ("#viewLegChanges", "#statusWarning", ".warning", "#versionBanner"):
        for node in soup.select(sel):
            t = " ".join(node.get_text(" ", strip=True).split())
            if t and t not in banner_bits:
                banner_bits.append(t)
    banner = "\n".join(banner_bits)

    for tag in soup(["script", "style", "nav", "header", "footer"]):
        tag.decompose()
    for sel in ("#globalNav", "#primaryNav", "#secondaryNav", "#footer",
                "#breadcrumbNav", ".interstitial", "#searchForm"):
        for node in soup.select(sel):
            node.decompose()

    body = soup.select_one("#viewLegContents") or soup.select_one("#content") or soup
    for sel in DROP_INLINE:
        for node in body.select(sel):
            node.decompose()

    lines, seen = [], set()
    for el in body.find_all(BLOCKS):
        if any(id(a) in seen for a in el.parents):
            continue            # already emitted as part of an outer block
        seen.add(id(el))
        txt = " ".join(el.get_text(" ", strip=True).split())
        if not txt:
            continue
        if el.name in HEADING_TAGS:
            lines.append(f"\n## {txt}\n")
        else:
            lines.append(txt)

    text = "\n\n".join(lines)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return banner, text


def fetch(path: str, name: str) -> None:
    url = f"{BASE}/{path}"
    r = requests.get(url, headers=UA, timeout=60)
    r.raise_for_status()
    banner, text = html_to_text(r.text)

    stamp = datetime.date.today().strftime("%d-%b-%Y")
    header = (
        f"# {name.replace('__', ' — ').replace('-', ' ')}\n\n"
        f"- **Primary source URL:** {url}\n"
        f"- **Version fetched:** latest available revised text (as published by "
        f"The National Archives)\n"
        f"- **Snapshot taken:** {stamp}\n"
        f"- **Status banner on the page at the time of fetch:**\n\n"
        + ("".join(f"  > {ln}\n" for ln in (banner.splitlines() or ["(none shown)"])))
        + "\n> Verbatim statutory text follows. Do not paraphrase it in an "
          "appraisal — quote it.\n\n---\n\n"
    )
    dest = OUT / f"{name}.md"
    dest.write_text(header + text, encoding="utf-8")
    print(f"  wrote {dest.name:<58} {len(text):>7,} chars")
    if banner:
        print(f"    BANNER: {banner[:300]}")


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    print(f"Fetching current in-force GPDO text -> {OUT}")
    fail = 0
    for path, name in TARGETS:
        try:
            fetch(path, name)
        except Exception as exc:  # noqa: BLE001
            print(f"  FAILED {name}: {exc}", file=sys.stderr)
            fail = 1
    print("\nDone. Re-read 00__SOURCE-REGISTER.md and update its dates if the "
          "text changed.")
    return fail


if __name__ == "__main__":
    raise SystemExit(main())
