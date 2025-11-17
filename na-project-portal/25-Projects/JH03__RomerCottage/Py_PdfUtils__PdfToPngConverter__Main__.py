# =========================================================
# PDF TO PNG CONVERTER 
# =========================================================
#
# FILENAME  |  SnPy_PdfToPngConverter.py
# DIRECTORY |  C:\03_-_Adam-Noble-Tools\02_-_Python\SnPy_PdfToPngConverter\SnPy_PdfToPngConverter.py
#
# AUTHOR    |  Adam Noble - Studio NoodlFjord 
# DATE      |  2025-05-09
#
# DESCRIPTION
# - This script converts a PDF file to a PNG image.
# - For pip install dependencies, see: .\SnPY_CommonDependencyFiles\SnPy_MasterPipDependencies.txt
#
# PIP DEPENDENCIES COMMAND LINE
# pip install pymupdf PyPDF2 Pillow tqdm
#
# DEVELOPMENT LOG
# 0.9.1 - 10-May-2025 |  Switched to PyMuPDF for PDF to PNG conversion
# - Replaced pdf2image/Poppler dependency with PyMuPDF (fitz) for pure pip, high-quality conversion.
# - Now requires only `pip install pymupdf` for all features.
#
# 0.9.0 - 09-May-2025 |  Initial Development
# - Development Started on basic PDF to PNG conversion script.
# - Script produce the highest quality PNG images from a PDF.
#   - The PDF's document size is preserved in the PNG, no downscaling.
#   - The script also preserves the PDF's original aspect ratio.
# - The script should be added the to widows startup folder to run at startup.
# - This script runs in the background and adds a right click options when a PDF is selected.
# - This context menu option will allow you to convert the PDF to a PNG image.
# - Should be compatible with Windows 10 & Windows 11 Native File Explorer.
# - Script takes the original PDF Document Name and appends "_Converted_From_PDF" to the end of the file name.
#   -  Example PDF Document Name  : "MyDocumentExample.pdf"
#   -  Converted PNG Image Name   : "MyDocumentExample_Converted_From_PDF.png"
# - The script should create the new PNG file in the same directory as the original PDF file.
# - If file is not created an error message should be display on screen.
#
# 1.0.0 - 10-May-2025 |  Initial Development
# - Added the icon loader utility from the sibling dependency directory.
# - Refactored all icon handling logic out of this script for modularity and reuse.
# - Now imports set_noble_icon from SnPy_Core_Utils_IconLoaderAndHandling.py using a relative path.
# - All Tkinter windows now use the shared icon loader utility for consistent branding.

# 1.0.1 - 27-May-2025 |  Multi-Page PDFs Support
# - PDF's should now be able to have multiple pages exported as separate PNG files.
# - The script will now check if the PDF has multiple pages and will export each page as a separate PNG file.
# - Each Page of the PDF is first checked for the correct dimensions so that pages of different sizes are not stretched.
# - A warning is displayed if the PDF has over 10 pages asking whether you would like to continue.
#   - If you select yes, the script will export all pages as separate PNG files.
#   - If you select no, the script will exit.
#
# =========================================================

import os
import sys
import logging
import tkinter as tk
from tkinter import messagebox, filedialog
from pathlib import Path
from PyPDF2 import PdfReader
from PIL import Image, ImageTk
import io
import urllib.request
from tqdm import tqdm


# ------------------------------------------------------------
# LOADER | Icon Loader setup for the script
# ------------------------------------------------------------
# Add the common local code libraries directory to sys.path for imports                                   # <-- This adds the icon loader path
parent_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))                                 # <-- Navigate up three levels to 02_Python root
icon_loader_path = os.path.join(parent_dir, '02__Python__CommonLocalCodeLibs')                           # <-- Build path to common local code libs
if icon_loader_path not in sys.path:                                                                     # <-- This checks if path exists in sys.path
    sys.path.insert(0, os.path.abspath(icon_loader_path))                                                # <-- This adds path at beginning for priority
    
try:
    from Py_CoreCommonUtils__IconLoaderAndHandling import set_noble_icon                              # type: ignore  # <-- This imports Noble icon handler
    logging.info("Successfully imported Noble Architecture icon loader")                              # <-- Log successful import
except ImportError as e:                                                                             # <-- This catches import errors
    logging.warning(f"Could not import icon handling module: {e}. Windows will use default icons.")  # <-- This logs warning
    def set_noble_icon(window):                                                                       # <-- This creates fallback function
        pass                                                                                         # <-- This does nothing as fallback
# ------------------------------------------------------------


# LOADER | Logging setup for the script
# ------------------------------------------------------------
logging.basicConfig(
    filename=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'pdf_to_png.log'),
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

# LOADER | Main PDF to PNG Converter class definition
# ------------------------------------------------------------
class PdfToPngConverter:
    def __init__(self):
        self.app_path = os.path.abspath(__file__)
    
    # METHOD | convert_pdf_to_png
    # Convert a PDF file to high-quality PNG images using PyMuPDF (supports multi-page)
    # ------------------------------------------------------------
    def convert_pdf_to_png(self, pdf_path):
        """Convert a PDF file to high-quality PNG images using PyMuPDF. Supports multi-page PDFs."""
        try:
            import fitz  # PyMuPDF

            # VALIDATION | Check if file exists and is a PDF
            if not os.path.exists(pdf_path):
                raise FileNotFoundError(f"File not found: {pdf_path}")

            if not pdf_path.lower().endswith('.pdf'):
                raise ValueError(f"File is not a PDF: {pdf_path}")

            # PROCESS | Open PDF and check page count
            doc = fitz.open(pdf_path)
            if doc.page_count < 1:
                raise ValueError("PDF has no pages")

            # USER INTERACTION | Warn if PDF has more than 10 pages
            if doc.page_count > 10:
                root = tk.Tk()
                root.withdraw()
                set_noble_icon(root)
                result = messagebox.askyesno(
                    "Large PDF Warning",
                    f"This PDF has {doc.page_count} pages. This will create {doc.page_count} PNG files.\n\nDo you want to continue?"
                )
                root.destroy()
                if not result:
                    return False, "Conversion cancelled by user"

            # FILE HANDLING | Create base output filename
            pdf_name = os.path.basename(pdf_path)
            pdf_dir = os.path.dirname(pdf_path)
            base_name = pdf_name.rsplit('.', 1)[0]

            output_paths = []
            
            # CONVERSION | Convert each page
            for page_num in range(doc.page_count):
                page = doc.load_page(page_num)
                
                # FILE HANDLING | Create page-specific filename
                if doc.page_count == 1:
                    output_name = f"{base_name}_-_Converted_From_PDF.png"
                else:
                    output_name = f"{base_name}_-_Converted_From_PDF_Page_{page_num + 1:03d}.png"
                
                output_path = os.path.join(pdf_dir, output_name)
                
                # RENDERING | Render page at high DPI, preserving original dimensions
                pix = page.get_pixmap(dpi=300)
                pix.save(output_path)
                output_paths.append(output_path)

            doc.close()
            
            # RESULT | Return conversion result
            if len(output_paths) == 1:
                return True, output_paths[0]
            else:
                return True, f"Converted {len(output_paths)} pages to: {pdf_dir}"

        except Exception as e:
            logging.error(f"Error converting PDF to PNG: {str(e)}")
            return False, str(e)

    # METHOD | Show a success message window using Tkinter
    # ------------------------------------------------------------
    def show_success_message(self, output_path):
        """Show a success message window."""
        root = tk.Tk()
        root.withdraw()  # Hide the main window
        set_noble_icon(root)
        messagebox.showinfo(
            "Conversion Complete",
            f"PDF has been converted to PNG successfully!\n\n{output_path}"
        )
        root.destroy()

    # METHOD | Show an error message window using Tkinter
    # ------------------------------------------------------------
    def show_error_message(self, error_msg):
        """Show an error message window."""
        root = tk.Tk()
        root.withdraw()  # Hide the main window
        set_noble_icon(root)
        messagebox.showerror(
            "Conversion Error",
            f"Failed to convert PDF to PNG:\n\n{error_msg}"
        )
        root.destroy()
    
    # METHOD | Open a file dialog to select one or more PDF files and convert them
    # ------------------------------------------------------------
    def select_and_convert_pdf(self):
        """Open a file dialog to select one or more PDF files and convert them."""
        root = tk.Tk()
        root.withdraw()  # Hide the main window
        set_noble_icon(root)
        pdf_paths = filedialog.askopenfilenames(
            title="Select PDF(s) to Convert",
            filetypes=[("PDF Files", "*.pdf"), ("All Files", "*.*")]
        )
        root.destroy()
        if pdf_paths:
            if len(pdf_paths) == 1:
                success, result = self.convert_pdf_to_png(pdf_paths[0])
                if success:
                    self.show_success_message(result)
                else:
                    self.show_error_message(result)
            else:
                print(f"Converting {len(pdf_paths)} PDFs...")
                results = []
                for pdf_path in tqdm(pdf_paths, desc="Converting PDFs", unit="file"):
                    success, result = self.convert_pdf_to_png(pdf_path)
                    results.append((pdf_path, success, result))
                # Show summary in CLI
                print("\nConversion Summary:")
                for pdf_path, success, result in results:
                    if success:
                        print(f"SUCCESS: {os.path.basename(pdf_path)} -> {result}")
                    else:
                        print(f"FAILED: {os.path.basename(pdf_path)} -> {result}")
                # Show a message box for overall result
                num_success = sum(1 for _, s, _ in results if s)
                num_fail = len(results) - num_success
                root = tk.Tk()
                root.withdraw()
                set_noble_icon(root)
                messagebox.showinfo(
                    "Batch Conversion Complete",
                    f"Converted {num_success} of {len(results)} PDFs successfully.\nSee terminal for details."
                )
                root.destroy()

# HELPER FUNC | Create a batch script for Windows startup
# ------------------------------------------------------------
def create_shortcut_script():
    """Create a simple batch script to add to startup folder manually."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    shortcut_path = os.path.join(script_dir, "run_converter.bat")
    
    script_content = f"""@echo off
start pythonw "{os.path.abspath(__file__)}" --background
"""
    
    try:
        with open(shortcut_path, "w") as f:
            f.write(script_content)
        
        return True, shortcut_path
    except Exception as e:
        logging.error(f"Error creating shortcut script: {str(e)}")
        return False, str(e)

# FUNCTION | Main entry point for the script
# ------------------------------------------------------------
def main():
    converter = PdfToPngConverter()
    
    # Handle command-line arguments
    if len(sys.argv) > 1:
        if sys.argv[1] == "--help" or sys.argv[1] == "-h":
            print("""
PDF to PNG Converter Usage:
---------------------------
No arguments: Opens file selection dialog
<pdf_path>: Converts the specified PDF file
--background: Runs in background mode (for startup use)
--create-shortcut: Creates a batch file you can add to Windows startup folder
--help or -h: Shows this help message
""")
        elif sys.argv[1] == "--background":
            # Just exit - this is used when the script is added to startup
            # The script exists but doesn't do anything until explicitly called
            logging.info("Started in background mode")
            return
            
        elif sys.argv[1] == "--create-shortcut":
            success, result = create_shortcut_script()
            
            if success:
                print(f"Shortcut script created at: {result}")
                print("\nTo add to startup manually:")
                print("1. Press Win+R, type 'shell:startup' and press Enter")
                print("2. Copy the created batch file into the opened folder")
            else:
                print(f"Failed to create shortcut script: {result}")
                
        else:
            # Assume the argument is a PDF file path
            pdf_path = sys.argv[1]
            logging.info(f"Converting PDF: {pdf_path}")
            
            success, result = converter.convert_pdf_to_png(pdf_path)
            
            if success:
                converter.show_success_message(result)
            else:
                converter.show_error_message(result)
    else:
        # No arguments, open file selection dialog
        converter.select_and_convert_pdf()


if __name__ == "__main__":
    main()

# ------------------------------------------------------------
# END OF FILE
# ------------------------------------------------------------