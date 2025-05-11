# =========================================================
# ICON LOADER & HANDLING UTILS
# =========================================================
#
# FILENAME  |  SnPy_Core_Utils_IconLoaderAndHandling.py
# DIRECTORY |  C:/03_-_Adam-Noble-Tools/02_-_Python/SnPY_CommonDependencyFiles/SnPy_Core_Utils_IconLoaderAndHandling.py
#
# AUTHOR    |  Adam Noble - Studio NoodlFjord
# DATE      |  2025-05-10
#
# DESCRIPTION
# - Utility function to set a custom PNG icon for Tkinter windows.
# - Downloads icon from a URL or uses a local fallback PNG.
# - Ensures consistent branding for all Tkinter windows in SnPy tools.
# - For pip install dependencies, see: .\SnPY_CommonDependencyFiles\SnPy_MasterPipDependencies.txt
#
# DEVELOPMENT LOG
# 1.0.0 - 10-May-2025 |  Initial utility version (extracted from main script, tested)
# - Provides set_window_icon for use in all SnPy GUI scripts.
#
# =========================================================

# IMPORTS | Standard and third-party libraries for image and URL handling
# ------------------------------------------------------------
import os
from PIL import Image, ImageTk
import urllib.request

# FUNCTION | Set a custom PNG icon for a Tkinter window, with fallback to local PNG
# ------------------------------------------------------------
def set_window_icon(root):
    """Set a custom PNG icon for the Tkinter window, fallback to local PNG if download fails."""
    try:
        icon_url = "https://www.noble-architecture.com/assets/AD05_-_LIBR_-_Common_-_Icons-and-favicons/AD05_05_-_NA_Favicon_-_PNG-h192px.png"
        icon_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "custom_icon.png")
        fallback_path = r"C:\03_-_Adam-Noble-Tools\02_-_Python\SnPY_CommonDependencyFiles\AD05_05_-_NA_Favicon_-_PNG-h192px.png"

        # Try to download icon if not present
        if not os.path.exists(icon_path):
            try:
                urllib.request.urlretrieve(icon_url, icon_path)
            except Exception:
                icon_path = fallback_path
        # Try to load the icon (downloaded or fallback)
        try:
            img = Image.open(icon_path)
        except Exception:
            img = Image.open(fallback_path)
        img = img.resize((32, 32), Image.LANCZOS)
        icon = ImageTk.PhotoImage(img)
        root.iconphoto(True, icon)
        root._icon_ref = icon  # Prevent garbage collection
    except Exception:
        pass  # Fallback to default icon

# ------------------------------------------------------------
# END OF FILE
# ------------------------------------------------------------

