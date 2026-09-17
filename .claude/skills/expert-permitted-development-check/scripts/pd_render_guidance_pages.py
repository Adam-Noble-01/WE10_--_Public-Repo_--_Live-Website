#!/usr/bin/env python3
"""
pd_render_guidance_pages.py  --  bake the MHCLG technical guidance to page images.

The guidance explains measurement rules (eaves on a sloping site, principal
elevation on an L-shaped house, how a 45-degree roof pitch is judged) mainly
through diagrams. Extracted text loses them, so this renders every page to PNG
and reports which pages actually carry drawn figures.

    python pd_render_guidance_pages.py

Output: references/source/guidance-pages/page-NN.png
plus a printed table of pages -> figure count, used to keep
references/01__INDEX__technical-guidance.md honest.

Dependency: PyMuPDF (already present on this PC).
"""

import sys
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parent.parent / "references" / "source"
PDF = ROOT / "MHCLG__PD-Householder-Technical-Guidance__2019-09-10.pdf"
OUT = ROOT / "guidance-pages"
DPI = 120          # legible for diagrams, small enough to open cheaply


def main() -> int:
    if not PDF.exists():
        print(f"Missing source PDF: {PDF}", file=sys.stderr)
        print("Re-download it from the URL in 00__SOURCE-REGISTER.md.", file=sys.stderr)
        return 1

    OUT.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(PDF)
    zoom = DPI / 72.0
    mat = fitz.Matrix(zoom, zoom)

    print(f"{'page':>5}  {'paths':>7}  file")
    with_figs = []
    for i, page in enumerate(doc, 1):
        pix = page.get_pixmap(matrix=mat)
        dest = OUT / f"page-{i:02d}.png"
        pix.save(dest)

        # The guidance diagrams are vector line art (filled blocks + arrows),
        # not embedded rasters, so count drawing paths rather than images.
        n_raster = len(page.get_images(full=True))
        n_paths = len(page.get_drawings())
        has_fig = n_raster > 0 or n_paths >= 5
        if has_fig:
            with_figs.append(i)
        print(f"{i:>5}  {n_paths:>7}  {dest.name}{'   <-- FIGURE' if has_fig else ''}")

    print(f"\nPages carrying figures: {with_figs}")
    print(f"Wrote {doc.page_count} PNGs to {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
