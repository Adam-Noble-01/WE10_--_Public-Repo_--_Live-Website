import os
from tkinter import Tk, filedialog
from PIL import Image

def convert_png_to_jpg():
    # Initialise file selection window
    root = Tk()
    root.withdraw()  # Hide root window
    file_paths = filedialog.askopenfilenames(
        title="Select PNG files",
        filetypes=[("PNG files", "*.png")]
    )

    for file_path in file_paths:
        try:
            img = Image.open(file_path).convert('RGB')
            original_width, original_height = img.size

            # Resize if width exceeds 4000px
            if original_width > 4000:
                scale_ratio = 4000 / original_width
                new_height = int(original_height * scale_ratio)
                img = img.resize((4000, new_height), Image.LANCZOS)

            # Set output path
            output_path = os.path.splitext(file_path)[0] + ".jpg"
            
            # Save as high-quality JPEG
            img.save(output_path, 'JPEG', quality=100, subsampling=0, optimize=True)
            print(f"Saved: {output_path}")

        except Exception as e:
            print(f"Failed to convert {file_path}: {e}")

if __name__ == "__main__":
    convert_png_to_jpg()

