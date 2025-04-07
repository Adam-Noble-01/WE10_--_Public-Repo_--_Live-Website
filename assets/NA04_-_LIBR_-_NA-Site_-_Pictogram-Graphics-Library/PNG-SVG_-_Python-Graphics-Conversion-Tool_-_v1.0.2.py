#!/usr/bin/env python3

# PNG to SVG Vectorization Script v2
# ==================================
#
# Purpose:
#   Converts a raster PNG image file into a vector SVG file
#   using pure Python libraries, focusing on shape outlines.
#
# Tooling:
#   - Python 3: The scripting language
#   - Pillow (PIL Fork): For image preprocessing
#   - OpenCV (cv2): For contour detection and processing
#   - svgwrite: For SVG file creation
#   - scikit-image: For advanced edge detection
#
# Installation:
#   pip install pillow opencv-python svgwrite numpy scikit-image
#
# Version Notes:
# -------------
# v1.0.1 (Current)
#   - Added proper layered SVG structure instead of simple silhouettes
#   - Implemented separate processing paths for:
#     * Background circle with white fill and bronze outline
#     * Line work using bronze color with proper stroke width
#     * Internal shapes with white fill and bronze outlines
#   - Fixed compatibility issues with different svgwrite library versions
#   - Improved file path handling and error reporting
#   - Enhanced edge detection using Canny algorithm from scikit-image
#   - Added helpful debugging and status messages
#   - Added customization options for stroke width and color
#
# v1.0.0 (Initial)
#   - Basic implementation creating solid black shapes
#   - Simple threshold-based binary conversion
#   - Single-layer SVG with evenodd fill-rule
#
# Challenges Overcome:
# ------------------
# 1. Binary conversion losing structural detail: 
#    Solution: Used multi-layered approach with separate edge and shape detection
#
# 2. Lack of proper styling (everything was solid black): 
#    Solution: Added proper SVG attributes for fill, stroke, and colors
#
# 3. Library compatibility issues: 
#    Solution: Added error handling for various svgwrite implementations
#
# 4. Output path handling errors: 
#    Solution: Improved path handling with absolute paths and verification
#
# Usage:
#   python PNG-SVG_-_Python-Graphics-Conversion-Tool_-_v1.0.1.py your_icon.png
#
# Advanced Usage:
#   python PNG-SVG_-_Python-Graphics-Conversion-Tool_-_v1.0.1.py image.png -t 200 -s 1200
#   python PNG-SVG_-_Python-Graphics-Conversion-Tool_-_v1.0.1.py image.png -o custom_output.svg --smooth
#   python PNG-SVG_-_Python-Graphics-Conversion-Tool_-_v1.0.1.py *.png  # Process all PNG files

import os
import sys
import tempfile
import argparse
import glob
import numpy as np
import cv2
import svgwrite
from PIL import Image, ImageOps
from skimage import feature

# --- Default Configuration ---
DEFAULT_TARGET_SIZE_PX = 1000  # Intermediate processing size & SVG viewBox units
DEFAULT_REAL_WIDTH_MM = 100
DEFAULT_REAL_HEIGHT_MM = 100
# Default threshold: Assumes icon is darker than near-white (e.g., 240).
# Pixels < threshold become black (object), >= threshold become white (background).
# Adjust `-t` based on your icon's color vs. its immediate background.
DEFAULT_THRESHOLD_VALUE = 240
DEFAULT_SIMPLIFY = True
DEFAULT_SMOOTH = False # Smoothing often distorts icons, disable by default
DEFAULT_STROKE_WIDTH = 0.5  # Default stroke width in pt
DEFAULT_BRONZE_COLOR = "#8B7355"  # Bronze color for lines
DEFAULT_PRESERVE_LAYERS = True  # Create layered SVG by default

# --- Helper Functions ---

def preprocess_image(input_path, target_size, threshold, preserve_layers=True):
    """Prepares the image for vectorization: handles transparency, converts to B&W bitmap based on threshold."""
    try:
        print(f"Preprocessing image: {input_path}")
        img = Image.open(input_path)
        original_img = img.copy()

        # Handle transparency: Create a white background
        if img.mode == 'RGBA' or 'A' in img.info.get('transparency', ()):
            print("Handling transparency (placing on white background)...")
            bg = Image.new("RGB", img.size, (255, 255, 255))
            try:
                # Use alpha channel as mask
                bg.paste(img, mask=img.split()[3]) # Assumes alpha is the 4th channel
            except IndexError:
                 # Fallback if no alpha channel after check (should not happen often with check)
                 bg.paste(img, mask=img.convert('RGBA').split()[3])
            img = bg
        else:
            # If no alpha, ensure it's RGB first before grayscale
            img = img.convert("RGB")
        
        # Resize image for processing
        img_resized = img.resize((target_size, target_size), Image.Resampling.LANCZOS)
        
        if preserve_layers:
            # For layered processing, we'll create multiple representations
            # Convert to Grayscale for edge detection
            img_gray = img_resized.convert('L')
            img_array = np.array(img_gray)
            
            # Detect edges using Canny
            edges = feature.canny(img_array, sigma=3)
            edges_uint8 = np.uint8(edges) * 255
            
            # Create binary mask for the main shapes (for fills)
            # Pixels darker than threshold become black (0), others white (255)
            img_bw = img_gray.point(lambda p: 0 if p < threshold else 255, '1')
            img_array_bw = np.array(img_bw)
            img_opencv_bw = np.uint8(img_array_bw) * 255
            
            # Detect the outer circle for background
            img_circle = img_opencv_bw.copy()
            # Apply a morphological operation to ensure the circle is complete
            kernel = np.ones((5,5), np.uint8)
            img_circle = cv2.morphologyEx(img_circle, cv2.MORPH_CLOSE, kernel)
            
            print("Multi-layer image preprocessing completed.")
            return {
                'edges': edges_uint8,
                'shapes': img_opencv_bw,
                'circle': img_circle,
                'original': np.array(img_resized)
            }, True
        else:
            # Original binary processing for backward compatibility
            # Convert to Grayscale
            print("Converting to grayscale...")
            img_gray = img_resized.convert('L')

            # Apply threshold to make it black and white
            print(f"Applying threshold (value: {threshold}). Pixels < {threshold} become black.")
            img_bw = img_gray.point(lambda p: 0 if p < threshold else 255, '1')
            img_array_bw = np.array(img_bw)
            img_opencv_bw = np.uint8(img_array_bw) * 255
            
            print("Image preprocessing completed.")
            return img_opencv_bw, True

    except FileNotFoundError:
        print(f"ERROR: Input file not found: {input_path}", file=sys.stderr)
        return None, False
    except Exception as e:
        print(f"ERROR during image preprocessing: {e}", file=sys.stderr)
        # import traceback
        # traceback.print_exc() # Uncomment for detailed debugging
        return None, False


def detect_contours(image_data, simplify=True, smooth=False, preserve_layers=True):
    """Detect contours in the preprocessed image data."""
    print("Detecting contours...")
    
    if preserve_layers:
        # Handle multi-layer approach
        result = {}
        
        # Process edges for strokes
        edges = image_data['edges']
        inverted_edges = cv2.bitwise_not(edges)
        edge_contours, _ = cv2.findContours(inverted_edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        # Process background circle
        circle_img = image_data['circle']
        inverted_circle = cv2.bitwise_not(circle_img)
        circle_contours, _ = cv2.findContours(inverted_circle, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        # Find largest contour which should be the outer circle
        if circle_contours:
            max_contour = max(circle_contours, key=cv2.contourArea)
            # Only keep the largest contour
            circle_contours = [max_contour]
        
        # Process shapes for internal details
        shapes = image_data['shapes']
        inverted_shapes = cv2.bitwise_not(shapes)
        shape_contours, shape_hierarchy = cv2.findContours(inverted_shapes, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
        
        # Apply simplification if requested
        if simplify:
            processed_edge_contours = []
            for contour in edge_contours:
                if len(contour) < 5:  # Skip very small contours
                    continue
                epsilon = 0.001 * cv2.arcLength(contour, True)
                simplified = cv2.approxPolyDP(contour, epsilon, True)
                processed_edge_contours.append(simplified)
            
            processed_circle_contours = []
            for contour in circle_contours:
                epsilon = 0.001 * cv2.arcLength(contour, True)
                simplified = cv2.approxPolyDP(contour, epsilon, True)
                processed_circle_contours.append(simplified)
                
            processed_shape_contours = []
            for contour in shape_contours:
                epsilon = 0.001 * cv2.arcLength(contour, True)
                simplified = cv2.approxPolyDP(contour, epsilon, True)
                processed_shape_contours.append(simplified)
        else:
            processed_edge_contours = edge_contours
            processed_circle_contours = circle_contours
            processed_shape_contours = shape_contours
        
        # Apply smoothing if requested
        if smooth:
            # Apply smoothing to each set of contours
            for contour_set in [processed_edge_contours, processed_circle_contours, processed_shape_contours]:
                for i, contour in enumerate(contour_set):
                    if len(contour) > 5:
                        try:
                            contour_float = np.float32(contour)
                            smoothed = cv2.GaussianBlur(contour_float, (3, 3), 0)
                            contour_set[i] = np.int32(smoothed)
                        except Exception as e:
                            print(f"Warning: Could not smooth contour: {e}", file=sys.stderr)
        
        result['edges'] = processed_edge_contours
        result['circle'] = processed_circle_contours
        result['shapes'] = processed_shape_contours
        result['shape_hierarchy'] = shape_hierarchy
        
        print(f"Processed contours: {len(processed_edge_contours)} edges, {len(processed_circle_contours)} circle, {len(processed_shape_contours)} shapes")
        return result, True
    else:
        # Original contour detection for backward compatibility
        inverted_bw = cv2.bitwise_not(image_data)
        contours, hierarchy = cv2.findContours(inverted_bw, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
        
        print(f"Found {len(contours)} raw contours.")

        # Ensure hierarchy is returned correctly (it's a numpy array wrapper)
        if hierarchy is None:
            print("No contours found or hierarchy is None.")
            return [], None
        else:
            hierarchy = hierarchy[0]

        processed_contours = []
        valid_hierarchy = []

        # Filter out tiny contours and process valid ones
        min_contour_area = 5
        for i, contour in enumerate(contours):
            area = cv2.contourArea(contour)
            if area < min_contour_area:
                continue

            processed_contour = contour

            # Simplify contours (reduce number of points)
            if simplify:
                epsilon = 0.001 * cv2.arcLength(processed_contour, True)
                processed_contour = cv2.approxPolyDP(processed_contour, epsilon, True)

            # Smooth contours (optional)
            if smooth and len(processed_contour) > 5:
                try:
                    processed_contour_float = np.float32(processed_contour)
                    smoothed_contour_float = cv2.GaussianBlur(processed_contour_float, (3, 3), 0)
                    processed_contour = np.int32(smoothed_contour_float)
                except Exception as smooth_err:
                    print(f"Warning: Could not smooth contour {i}: {smooth_err}", file=sys.stderr)

            # Check if contour is still valid after processing
            if len(processed_contour) >= 2:
                processed_contours.append(processed_contour)
                valid_hierarchy.append(hierarchy[i])
            else:
                print(f"  Skipping contour {i} after processing (too few points).")

        print(f"Processed {len(processed_contours)} contours after filtering/simplification.")
        final_hierarchy = np.array(valid_hierarchy) if valid_hierarchy else None
        return processed_contours, final_hierarchy


def create_svg_from_contours(contours_data, output_svg_path, viewbox_size, width_mm, height_mm, 
                             stroke_width=DEFAULT_STROKE_WIDTH, bronze_color=DEFAULT_BRONZE_COLOR, 
                             preserve_layers=True):
    """Create SVG file from detected contours with proper layering and styling."""
    print(f"Creating SVG file: {output_svg_path}")

    dwg = svgwrite.Drawing(
        output_svg_path,
        size=(f"{width_mm}mm", f"{height_mm}mm"),
        viewBox=f"0 0 {viewbox_size} {viewbox_size}"
    )
    
    # Add a title (try-except in case the svgwrite version doesn't support it)
    try:
        dwg.add(dwg.title("Vectorized Icon"))
    except (AttributeError, TypeError):
        print("Warning: Could not add title to SVG (unsupported by this version of svgwrite)")
    
    if preserve_layers:
        # Create background layer
        background_layer = dwg.g(id="background")
        dwg.add(background_layer)
        
        # Add the circle background with white fill
        if contours_data['circle']:
            for circle_contour in contours_data['circle']:
                if len(circle_contour) < 3:
                    continue
                    
                # Create path data
                path_data = []
                start_point = circle_contour[0][0]
                path_data.append(f"M {start_point[0]},{start_point[1]}")
                
                for point in circle_contour[1:]:
                    p = point[0]
                    path_data.append(f"L {p[0]},{p[1]}")
                
                path_data.append("Z")
                
                # Create the circle path with white fill and bronze stroke
                circle_path = dwg.path(
                    d=" ".join(path_data), 
                    fill="white",
                    stroke=bronze_color,
                    stroke_width=stroke_width
                )
                background_layer.add(circle_path)
        
        # Create foreground layer for the character lines
        foreground_layer = dwg.g(id="foreground")
        dwg.add(foreground_layer)
        
        # Add edge contours as bronze stroked paths
        for edge_contour in contours_data['edges']:
            if len(edge_contour) < 2:
                continue
                
            path_data = []
            start_point = edge_contour[0][0]
            path_data.append(f"M {start_point[0]},{start_point[1]}")
            
            for point in edge_contour[1:]:
                p = point[0]
                path_data.append(f"L {p[0]},{p[1]}")
            
            # Don't close path for lines unless it's very clearly a closed shape
            if cv2.arcLength(edge_contour, True) > 20:
                path_data.append("Z")
            
            edge_path = dwg.path(
                d=" ".join(path_data),
                fill="none",
                stroke=bronze_color,
                stroke_width=stroke_width,
                stroke_linejoin="round",
                stroke_linecap="round"
            )
            foreground_layer.add(edge_path)
        
        # Add shape details if needed
        detail_layer = dwg.g(id="details")
        foreground_layer.add(detail_layer)
        
        for shape_contour in contours_data['shapes']:
            if len(shape_contour) < 3 or cv2.contourArea(shape_contour) < 50:
                continue
                
            path_data = []
            start_point = shape_contour[0][0]
            path_data.append(f"M {start_point[0]},{start_point[1]}")
            
            for point in shape_contour[1:]:
                p = point[0]
                path_data.append(f"L {p[0]},{p[1]}")
            
            path_data.append("Z")
            
            detail_path = dwg.path(
                d=" ".join(path_data),
                fill="white",
                stroke=bronze_color,
                stroke_width=stroke_width * 0.75  # Slightly thinner lines for details
            )
            detail_layer.add(detail_path)
            
    else:
        # Original SVG creation for backward compatibility
        path_group = dwg.g(
            fill_rule="evenodd",
            fill="black",
            stroke="none"
        )
        dwg.add(path_group)
        
        for contour in contours_data:
            if len(contour) < 2:
                continue
                
            path_data = []
            start_point = contour[0][0]
            path_data.append(f"M {start_point[0]},{start_point[1]}")
            
            for point in contour[1:]:
                p = point[0]
                path_data.append(f"L {p[0]},{p[1]}")
                
            path_data.append("Z")
            path = dwg.path(d=" ".join(path_data))
            path_group.add(path)

    # Save the SVG file
    try:
        dwg.save(pretty=True)
        print("SVG file created successfully.")
        return True
    except Exception as e:
        print(f"ERROR saving SVG file: {e}", file=sys.stderr)
        return False


def parse_arguments():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Convert PNG to SVG using Python vectorization (v2). Focuses on shapes using thresholding and contour hierarchy.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )

    parser.add_argument(
        "input_files",
        nargs='+',
        help="Input PNG file(s) to convert. Supports wildcards (*.png)"
    )

    parser.add_argument(
        "-o", "--output",
        dest="output_file",
        help="Output SVG file (default: input_file with .svg extension). Only valid for single file input."
    )

    parser.add_argument(
        "-t", "--threshold",
        type=int,
        default=DEFAULT_THRESHOLD_VALUE,
        help="Threshold value (0-255). Pixels strictly darker than this become the object (black). Adjust based on icon color vs background."
    )

    parser.add_argument(
        "-s", "--size",
        type=int,
        default=DEFAULT_TARGET_SIZE_PX,
        help="Target size in pixels for internal processing and the SVG viewBox"
    )

    parser.add_argument(
        "-w", "--width",
        type=int,
        default=DEFAULT_REAL_WIDTH_MM,
        help="Real width in mm for the SVG"
    )

    parser.add_argument(
        "-H", "--height", # Changed from -h to avoid conflict with help
        type=int,
        default=DEFAULT_REAL_HEIGHT_MM,
        help="Real height in mm for the SVG"
    )

    parser.add_argument(
        "--no-simplify",
        action="store_false", # Action is store_false, so presence of flag makes simplify=False
        dest="simplify",      # Store result in 'simplify'
        default=DEFAULT_SIMPLIFY, # Default is True if flag is absent
        help="Disable contour simplification (makes SVG larger, more detailed)."
    )

    parser.add_argument(
        "--smooth",          # Flag to ENABLE smoothing
        action="store_true", # Action is store_true, presence makes smooth=True
        dest="smooth",       # Store result in 'smooth'
        default=DEFAULT_SMOOTH, # Default is False if flag is absent
        help="Enable contour smoothing (experimental, may distort sharp corners)."
    )
    
    parser.add_argument(
        "--stroke-width",
        type=float,
        default=DEFAULT_STROKE_WIDTH,
        help="Width of strokes in points for the SVG lines"
    )
    
    parser.add_argument(
        "--bronze-color",
        type=str,
        default=DEFAULT_BRONZE_COLOR,
        help="Color for strokes in hex format (e.g., #8B7355)"
    )
    
    parser.add_argument(
        "--no-layers",
        action="store_false",
        dest="preserve_layers",
        default=DEFAULT_PRESERVE_LAYERS,
        help="Disable layered output (will create simple solid shapes)"
    )

    args = parser.parse_args()

    # Expand any wildcards in input files (needed for Windows)
    expanded_files = []
    for pattern in args.input_files:
        # Check if it's an existing file first
        if os.path.isfile(pattern):
             expanded_files.append(pattern)
             continue
        # Otherwise, treat as a glob pattern
        matches = glob.glob(pattern)
        if matches:
            expanded_files.extend(matches)
        else:
            # If it wasn't a file and glob found nothing, it's an issue
             if not os.path.exists(pattern): # Check if it was a specific non-existent file
                 print(f"Error: Input file not found: {pattern}", file=sys.stderr)
             else: # It was a pattern that matched nothing
                 print(f"Warning: No files found matching pattern '{pattern}'", file=sys.stderr)


    if not expanded_files:
        parser.error("No valid input files specified or found")

    args.input_files = expanded_files

    # If output file specified but multiple input files provided, warn user
    if args.output_file and len(args.input_files) > 1:
        print("Warning: Output file (-o) specified with multiple input files.", file=sys.stderr)
        print("         The output filename will be ignored; each input file will be converted to", file=sys.stderr)
        print("         an SVG with the same base name in the same directory.", file=sys.stderr)
        args.output_file = None

    return args


def process_file(input_file, output_file, args):
    """Process a single file with the given arguments."""
    print("-" * 40)
    print(f"Processing file: {input_file}")
    print(f"Settings: Threshold={args.threshold}, Size={args.size}, Simplify={args.simplify}, Smooth={args.smooth}")
    print(f"Style: Stroke Width={args.stroke_width}pt, Bronze Color={args.bronze_color}, Layers={args.preserve_layers}")

    # Determine output filename
    if output_file is None:
        input_base = os.path.splitext(input_file)[0]
        output_file = input_base + ".svg"

    # Convert to absolute paths for clarity
    input_abs_path = os.path.abspath(input_file)
    output_abs_path = os.path.abspath(output_file)
    
    print(f"Input file (absolute): {input_abs_path}")
    print(f"Output will be (absolute): {output_abs_path}")

    # Check if input file exists (redundant check, but good practice)
    if not os.path.exists(input_file):
        print(f"ERROR: Input file disappeared or check failed: {input_file}", file=sys.stderr)
        return False

    success = False
    temp_svg_path = None
    try:
        # 1. Preprocess Image
        img_processed, preprocess_success = preprocess_image(
            input_file,
            args.size,
            args.threshold,
            preserve_layers=args.preserve_layers
        )

        if not preprocess_success or img_processed is None:
            raise Exception("Image preprocessing failed.")

        # 2. Detect Contours
        contours_data, contours_success = detect_contours(
            img_processed,
            simplify=args.simplify,
            smooth=args.smooth,
            preserve_layers=args.preserve_layers
        )

        if not contours_success:
            raise Exception("Contour detection failed.")

        # 3. Create SVG from Contours
        # Use a temporary file path during creation
        with tempfile.NamedTemporaryFile(delete=False, suffix=".svg", mode='w') as temp_f:
            temp_svg_path = temp_f.name
            print(f"Created temporary file: {temp_svg_path}")

        if not create_svg_from_contours(
            contours_data,
            temp_svg_path, # Write to temp file first
            args.size,
            args.width,
            args.height,
            stroke_width=args.stroke_width,
            bronze_color=args.bronze_color,
            preserve_layers=args.preserve_layers
        ):
            raise Exception("SVG creation failed.")

        # If SVG creation successful, move temp file to final destination
        print(f"Moving temporary file to final destination: {output_abs_path}")
        try:
            os.replace(temp_svg_path, output_file)
            if os.path.exists(output_file):
                print(f"Confirmed: Output file exists at {output_file}")
            else:
                print(f"WARNING: Output file was not found after move operation at {output_file}")
            temp_svg_path = None # Avoid deletion in finally block
        except Exception as move_err:
            raise Exception(f"Failed to move temporary SVG to final destination: {move_err}")

        success = True
        print("-" * 30)
        print(f"Successfully converted '{input_file}' to '{output_file}'")
        print(f"SVG Size: {args.width}mm x {args.height}mm")
        print(f"SVG ViewBox: 0 0 {args.size} {args.size}")
        
        if args.preserve_layers:
            edge_count = len(contours_data['edges']) if 'edges' in contours_data else 0
            circle_count = len(contours_data['circle']) if 'circle' in contours_data else 0 
            shape_count = len(contours_data['shapes']) if 'shapes' in contours_data else 0
            print(f"Contours found: {edge_count} edges, {circle_count} circle, {shape_count} shapes")
        else:
            print(f"Contours found: {len(contours_data)}")
            
        print("-" * 30)

    except Exception as e:
        print(f"\nERROR during processing of {input_file}: {e}", file=sys.stderr)
        # import traceback # Uncomment for detailed debugging
        # traceback.print_exc() # Uncomment for detailed debugging

    finally:
        # Clean up temporary SVG file if it still exists (due to error)
        if temp_svg_path and os.path.exists(temp_svg_path):
            try:
                print(f"Removing temporary file: {temp_svg_path}")
                os.remove(temp_svg_path)
            except OSError as rm_err:
                print(f"Warning: could not remove temporary output file '{temp_svg_path}': {rm_err}", file=sys.stderr)

    return success


# --- Main Execution ---
if __name__ == "__main__":
    # Parse command line arguments
    args = parse_arguments()

    print("PNG to SVG Conversion Tool v2")
    print("=============================")

    # Count successes and failures
    success_count = 0
    failure_count = 0

    # Process all input files
    for input_file in args.input_files:
        # Determine output file: Use -o if single input, otherwise generate automatically
        output_file_arg = args.output_file if len(args.input_files) == 1 else None
        if process_file(input_file, output_file_arg, args):
            success_count += 1
        else:
            failure_count += 1

    # Print summary if processing multiple files
    if len(args.input_files) > 1:
        print("\n" + "=" * 40)
        print("Conversion Summary:")
        print(f"  Successfully converted: {success_count}")
        print(f"  Failed conversions:     {failure_count}")
        print(f"  Total files processed:  {len(args.input_files)}")
        print("=" * 40)

    # Exit with error code if any conversions failed
    if failure_count > 0:
        print("\nCompleted with errors.", file=sys.stderr)
        sys.exit(1)

    print("\nCompleted successfully.")
    sys.exit(0) # Exit successfully