#!/usr/bin/env python3
"""
File Combiner Script

This script combines all .txt files in the current directory into a single output file
with dividers between each file's content.
"""

import os
import glob
from tqdm import tqdm

def main():
    # Get the current directory (where the script is located)
    current_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Find all .txt files in the current directory
    txt_files = glob.glob(os.path.join(current_dir, "*.txt"))
    
    # Sort files to maintain their sequential order
    txt_files.sort()
    
    # Output file path
    output_file_path = os.path.join(current_dir, "docs-files-combined.txt")
    
    # Count of files for document numbering
    total_files = len(txt_files)
    
    print(f"Found {total_files} text files to combine")
    
    # Create progress bar
    with tqdm(total=total_files, desc="Combining Files", unit="file") as pbar:
        # Open the output file for writing
        with open(output_file_path, "w", encoding="utf-8") as output_file:
            # Process each file
            for doc_num, file_path in enumerate(txt_files, 1):
                file_name = os.path.basename(file_path)
                
                # Create the divider
                divider = f"""
-------------------------------------------------------------------------------
DOCUMENT {doc_num} |  `{file_name}`
-------------------------------------------------------------------------------

"""
                
                # Read the content of the current file
                try:
                    with open(file_path, "r", encoding="utf-8") as input_file:
                        content = input_file.read()
                        
                    # Write the divider and content to the output file
                    output_file.write(divider)
                    output_file.write(content)
                    output_file.write("\n\n")
                    
                except Exception as e:
                    print(f"\nError processing file {file_name}: {e}")
                
                # Update the progress bar
                pbar.update(1)
    
    print(f"\nAll files combined successfully into: {output_file_path}")

if __name__ == "__main__":
    main()