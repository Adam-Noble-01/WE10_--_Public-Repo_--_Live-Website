import os

def collect_file_content(file_path):
    line_break = "=" * 80
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        return (
            f"\n{line_break}\n"
            f"### {file_path}\n"
            f"{line_break}\n\n"
            f"{content.strip()}\n"
            f"{line_break}\n"
        )
    except Exception as e:
        return (
            f"\n{line_break}\n"
            f"### {file_path}\n"
            f"{line_break}\n\n"
            f"Error reading file: {str(e)}\n"
            f"{line_break}\n"
        )

def main():
    # Define the root directory
    root_dir = r"C:\02_Temp_Script_Development\RE20_05_--_Utility-App_-_Directory-Scanner"
    
    # Define the output file path
    output_file_path = os.path.join(root_dir, "Combined-Codebase-File.txt")
    
    # File types to include
    allowed_extensions = {'.py', '.html', '.css', '.js', '.txt', '.md'}
    
    # Container for combined output
    combined_output = []

    # Walk the directory
    for dirpath, dirnames, filenames in os.walk(root_dir):
        for filename in filenames:
            ext = os.path.splitext(filename)[1].lower()
            if ext in allowed_extensions:
                file_path = os.path.join(dirpath, filename)
                file_output = collect_file_content(file_path)
                combined_output.append(file_output)
    
    # Write all collected content to a single file
    with open(output_file_path, 'w', encoding='utf-8') as output_file:
        output_file.write("".join(combined_output))  # Do NOT add extra joins or breaks here
    
    print(f"✅ Combined codebase saved to: {output_file_path}")

if __name__ == "__main__":
    main()
