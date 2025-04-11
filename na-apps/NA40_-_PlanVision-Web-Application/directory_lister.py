#!/usr/bin/env python3
"""
Directory Lister
---------------
This script generates a plaintext file containing a list of all files and directories
in the current working directory.

Usage:
    Simply run the script in the directory you want to list:
    python directory_lister.py
"""

import os
from datetime import datetime

def create_directory_listing():
    """
    Creates a text file listing of all files and directories in the current directory.
    """
    # Get the current directory
    current_dir = os.getcwd()
    directory_name = os.path.basename(current_dir)
    
    # Get all files and directories in the current directory
    all_items = os.listdir(current_dir)
    
    # Sort items alphabetically (case-insensitive)
    all_items.sort(key=str.lower)
    
    # Create separate lists for directories and files
    directories = []
    files = []
    
    for item in all_items:
        full_path = os.path.join(current_dir, item)
        if os.path.isdir(full_path):
            directories.append(item + '/')
        else:
            files.append(item)
    
    # Generate the output filename
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    output_filename = f"directory_listing_{directory_name}_{timestamp}.txt"
    
    # Write to file
    with open(output_filename, 'w', encoding='utf-8') as f:
        # Write header
        f.write(f"Directory Listing of: {current_dir}\n")
        f.write(f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write("=" * 80 + "\n\n")
        
        # Write directories section
        f.write(f"DIRECTORIES ({len(directories)})\n")
        f.write("-" * 40 + "\n")
        for directory in directories:
            f.write(f"{directory}\n")
        
        # Write files section
        f.write(f"\nFILES ({len(files)})\n")
        f.write("-" * 40 + "\n")
        for file in files:
            # Get file size
            try:
                size = os.path.getsize(os.path.join(current_dir, file))
                size_str = f"{size:,} bytes"
            except:
                size_str = "Unknown size"
                
            f.write(f"{file} ({size_str})\n")
            
        # Write summary
        f.write("\n" + "=" * 80 + "\n")
        f.write(f"SUMMARY: {len(directories)} directories, {len(files)} files\n")
    
    print(f"Directory listing created: {output_filename}")
    return output_filename

if __name__ == "__main__":
    create_directory_listing() 