#!/usr/bin/env python3
# =============================================================================
# NOBLE ARCHITECTURE - CAD AUDIT TOOLS ICON GENERATOR
# =============================================================================
#
# FILE      : Na__WinIntegration__GenerateIcons__.py
# MODULE    : AppAssets.IconGenerator
# AUTHOR    : Adam Noble - Noble Architecture
# PURPOSE   : Generate the PWA + Windows shell icon set (192/512 PNG + multi-res ICO)
# CREATED   : 07-Jul-2026
#
# DESCRIPTION:
# - Draws a Noble-branded placeholder app icon: dark slate rounded tile with a
#   crosshair/measure motif and a "CAD" wordmark.
# - Emits Na__CadAuditToolsApp__Icon__192x192.png, __512x512.png and a
#   multi-resolution .ico used by the Windows right-click shell verb.
# - Re-run to regenerate after swapping in a real source logo.
#
# USAGE:
#   python Na__WinIntegration__GenerateIcons__.py
#
# =============================================================================

import os

from PIL import Image, ImageDraw, ImageFont


# #region ---------------------------------------------------------------------
# REGION | Configuration Constants
# -----------------------------------------------------------------------------

ASSET_DIR       = os.path.dirname(os.path.abspath(__file__))         # <-- 01__AppAssets__CadAuditTools/
BG_COLOR        = (30, 41, 59, 255)                                  # <-- Slate #1e293b (manifest theme colour)
TILE_COLOR      = (37, 51, 74, 255)                                  # <-- Slightly lighter inner tile
ACCENT_COLOR    = (77, 171, 247, 255)                                # <-- Noble blue accent (#4dabf7)
LINE_COLOR      = (226, 226, 232, 255)                               # <-- Light stroke (#e2e2e8)
TEXT_COLOR      = (255, 255, 255, 255)                               # <-- Wordmark colour

PNG_SIZES       = [192, 512]                                         # <-- PWA manifest icon sizes
ICO_SIZES       = [16, 24, 32, 48, 64, 128, 256]                     # <-- Windows shell verb icon resolutions

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Icon Rendering
# -----------------------------------------------------------------------------

# HELPER FUNCTION | Load a Bold TrueType Font Scaled to the Canvas
# ------------------------------------------------------------
def na_load_font(size_px):
    """Return a bold sans-serif font, falling back to the PIL default."""
    for candidate in ("arialbd.ttf", "seguisb.ttf", "segoeuib.ttf", "arial.ttf"):
        try:
            return ImageFont.truetype(candidate, size_px)           # <-- Windows system font
        except Exception:
            continue
    return ImageFont.load_default()                                 # <-- Last-resort bitmap font
# ------------------------------------------------------------


# FUNCTION | Render the App Icon at a Given Square Resolution
# ------------------------------------------------------------
def na_render_icon(size):
    """Draw the branded CAD Audit Tools tile at `size` x `size` pixels."""
    img  = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    pad    = int(size * 0.06)                                        # <-- Outer transparent margin
    radius = int(size * 0.20)                                        # <-- Rounded-corner radius

    # ROUNDED BACKGROUND TILE
    draw.rounded_rectangle([pad, pad, size - pad, size - pad], radius=radius, fill=BG_COLOR)
    inset = int(size * 0.10)
    draw.rounded_rectangle(
        [inset, inset, size - inset, size - inset],
        radius=int(radius * 0.7), outline=ACCENT_COLOR, width=max(1, int(size * 0.012))
    )

    # CROSSHAIR / MEASURE MOTIF — centred, upper two-thirds
    cx, cy = size // 2, int(size * 0.42)
    reach  = int(size * 0.20)
    lw     = max(1, int(size * 0.016))
    draw.line([cx - reach, cy, cx + reach, cy], fill=LINE_COLOR, width=lw)   # <-- Horizontal axis
    draw.line([cx, cy - reach, cx, cy + reach], fill=LINE_COLOR, width=lw)   # <-- Vertical axis
    tick = int(size * 0.045)
    for dx in (-reach, reach):
        draw.line([cx + dx, cy - tick, cx + dx, cy + tick], fill=ACCENT_COLOR, width=lw)
    for dy in (-reach, reach):
        draw.line([cx - tick, cy + dy, cx + tick, cy + dy], fill=ACCENT_COLOR, width=lw)
    r = int(size * 0.035)
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=ACCENT_COLOR)        # <-- Centre snap dot

    # "CAD" WORDMARK — lower third (skip on very small icons where it turns to mush)
    if size >= 48:
        font = na_load_font(int(size * 0.22))
        text = "CAD"
        bbox = draw.textbbox((0, 0), text, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        tx = (size - tw) // 2 - bbox[0]
        ty = int(size * 0.66) - bbox[1]
        draw.text((tx, ty), text, font=font, fill=TEXT_COLOR)

    return img
# ------------------------------------------------------------

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Entry Point — Emit PNG + ICO Assets
# -----------------------------------------------------------------------------

def na_main():
    """Render and write all icon files into the asset directory."""
    master = na_render_icon(1024)                                   # <-- High-res master for clean downscales

    for px in PNG_SIZES:
        out = master.resize((px, px), Image.LANCZOS)
        path = os.path.join(ASSET_DIR, f"Na__CadAuditToolsApp__Icon__{px}x{px}.png")
        out.save(path, format="PNG")
        print(f"  wrote {os.path.basename(path)}")

    ico_frames = [na_render_icon(px) for px in ICO_SIZES]           # <-- Per-size renders keep small icons legible
    ico_path   = os.path.join(ASSET_DIR, "Na__CadAuditToolsApp__Icon__.ico")
    ico_frames[-1].save(
        ico_path, format="ICO",
        sizes=[(px, px) for px in ICO_SIZES],
        append_images=ico_frames[:-1]
    )
    print(f"  wrote {os.path.basename(ico_path)}")


if __name__ == "__main__":
    na_main()

# endregion -------------------------------------------------------------------
