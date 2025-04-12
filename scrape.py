import os
import sys

# Common code file extensions
CODE_EXTENSIONS = {
    '.py', '.js', '.java', '.c', '.cpp', '.cs', '.go', '.rb', '.php',
    '.html', '.css', '.ts', '.sh', '.bat', '.ps1', '.swift', '.kt', '.rs',
    '.dart', '.lua', '.r', '.pl', '.scala', '.groovy', '.vb', '.tsx'
}

# Directories to automatically exclude
EXCLUDE_DIRS = {'node_modules', 'dist'}

def is_code_file(file_path):
    """Check if a file is a code file based on its extension."""
    _, ext = os.path.splitext(file_path.lower())
    return ext in CODE_EXTENSIONS

def should_exclude(dir_name):
    """Check if a directory should be excluded."""
    return dir_name in EXCLUDE_DIRS

def scrape_code_files(root_dir='.'):
    """
    Recursively scrape all code files, ignoring the specified directories.
    Returns a dictionary mapping file paths to their contents.
    """
    results = {}
    
    # Get the absolute path of the current script to exclude it
    current_script = os.path.abspath(sys.argv[0])
    
    for root, dirs, files in os.walk(root_dir):
        # Remove excluded directories from dirs to prevent traversing them
        dirs[:] = [d for d in dirs if not should_exclude(d)]
        
        for file in files:
            file_path = os.path.join(root, file)
            abs_file_path = os.path.abspath(file_path)
            
            # Skip the script itself
            if abs_file_path == current_script:
                continue
                
            # Skip non-code files
            if not is_code_file(file_path):
                continue
                
            try:
                # Try to open the file as text
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    # Add to results
                    results[file_path] = content
            except (UnicodeDecodeError, IsADirectoryError, PermissionError) as e:
                print(f"Warning: Could not read {file_path}: {e}")
                continue
    
    return results

def write_output_file(scraped_files, output_file='code_output.txt'):
    """Write all the scraped code to the output file."""
    with open(output_file, 'w', encoding='utf-8') as f:
        for file_path, content in scraped_files.items():
            # Write the filename as a Python comment
            f.write(f"# {file_path}\n")
            # Write a line of hashes to make it more visible
            f.write("#" * 80 + "\n")
            # Write the file content
            f.write(content)
            # Add some spacing between files
            f.write("\n\n")

def main():
    """Main function to run the code scraping process."""
    print("Code Scraper - Starting...")
    print(f"Ignoring directories: {', '.join(EXCLUDE_DIRS)}")
    
    # Use the current directory as the root
    root_dir = '.'
    output_file = 'code_output.txt'
    
    print(f"Scanning files in current directory and subdirectories...")
    scraped_files = scrape_code_files(root_dir)
    
    print(f"Found {len(scraped_files)} code files to include.")
    print(f"Writing output to {output_file}...")
    write_output_file(scraped_files, output_file)
    
    print(f"Code scraping complete! Output written to: {output_file}")

if __name__ == "__main__":
    main()
