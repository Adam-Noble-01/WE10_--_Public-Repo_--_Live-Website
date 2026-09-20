#!/usr/bin/env python3
# =============================================================================
# TRUEVISION3D - TEST - PROJECT QR CODE, READ BACK BY OPENCV
# =============================================================================
#
# FILE       : Na__Test__ProjectQr__Decode__.py
# AUTHOR     : Adam Noble - Noble Architecture
# PURPOSE    : Read the encoder's symbols back with a decoder nobody here wrote
# CREATED    : 20-Sep-2026
#
# DESCRIPTION:
# - Na__Test__ProjectQr__.test.mjs proves the encoder against a decoder written
#   from the specification. This proves it against OpenCV's, which was written
#   by somebody else entirely and is a good deal fussier than a phone.
# - Every case the Node test dumps is drawn as a plain bitmap at several sizes
#   and quiet zones and handed to cv2.QRCodeDetector.
#   - A WRONG read - text that is not what went in - fails the run outright.
#     In every run so far there has never been one.
#   - A case that reads in NO rendering fails it too.
#   - A case that reads in some renderings and not others is OpenCV, not the
#     symbol: its detector is sensitive to how a symbol's modules fall on the
#     pixel grid, and the same matrix that it misses at one size it reads at
#     the next. The count is printed so a change for the worse can be seen.
#
# USAGE:
#     node   80__Testing__PrototypeEnvironment/Na__Test__ProjectQr__.test.mjs --dump cases.json
#     python 80__Testing__PrototypeEnvironment/Na__Test__ProjectQr__Decode__.py cases.json
#
#   Needs numpy and opencv-python. Exit 0 = passed. Exit 1 = a wrong read, or a
#   case nothing could read.
#
# =============================================================================

import json
import sys

import numpy as np
import cv2


PIXELS_PER_MODULE = (4, 5, 6, 8, 10)
QUIET_MODULES     = (2, 4, 6)


def render(grid, size, pixels, quiet):
    """The symbol as a black and white bitmap, with `quiet` modules of white round it."""
    side  = (size + (quiet * 2)) * pixels
    image = np.full((side, side), 255, dtype=np.uint8)
    dark  = np.kron(grid, np.ones((pixels, pixels), dtype=np.uint8))
    image[quiet * pixels:(quiet + size) * pixels, quiet * pixels:(quiet + size) * pixels][dark == 1] = 0
    return image


def main():
    if len(sys.argv) < 2:
        print(__doc__ or 'usage: Na__Test__ProjectQr__Decode__.py <cases.json>')
        return 1

    with open(sys.argv[1], encoding='utf-8') as handle:
        cases = json.load(handle)

    detector = cv2.QRCodeDetector()
    wrong    = 0
    unread   = 0

    for case in cases:
        size  = case['size']
        grid  = np.array([[int(ch) for ch in row] for row in case['modules']], dtype=np.uint8)
        reads = 0
        tries = 0
        for pixels in PIXELS_PER_MODULE:
            for quiet in QUIET_MODULES:
                tries += 1
                text, _points, _straight = detector.detectAndDecode(render(grid, size, pixels, quiet))
                if text == case['text']:
                    reads += 1
                elif text:
                    wrong += 1
                    print('  WRONG  %-14s read %r' % (case['name'], text[:60]))
        if reads == 0:
            unread += 1
        print('  %s  %-14s version %2d  read in %2d of %d renderings' % ('ok  ' if reads else 'FAIL', case['name'], case['version'], reads, tries))

    print('\n%d cases | wrong reads: %d | cases nothing could read: %d\n' % (len(cases), wrong, unread))
    return 0 if (wrong == 0 and unread == 0) else 1


if __name__ == '__main__':
    raise SystemExit(main())
