TASK CREATE NEW LOADER SCRIPT
- Load Project JS Files from dynamic Json Data File

### Function Purpose
- Keeps a central index location for all project JS files
- Loads the JS files from the JSON data file
- Returns the JS files as an array of objects
- Loaded early by the script requiring it as to ensure all other scripts have access to the JS files

This script recieves a unique code identifier for the script such as . . 

```example-code-identifier
"JS01_01_-_UTIL_-_Version-Number-Header-Injection"
```
- This identifier is used to load the correct JS file from the JSON data file
- The JSON data file is used to store the JS files in a central location
- The Json Files lists the URL path to the JS file as well as other data about the file
- It Should also list the version number of the file


Loads JSON data from a file and returns it as a JavaScript object.

INPUT = The script that calls this new loader script will need to provide the path to the JSON data file.

The input will the the unique code identifier for the script

### JSON DATA FILE LOCATION
- Load This File
assets/AD01_-_DATA_-_Common_-_Global-Data-Library/AD01_02_-_DATA_-_Core-Website-Structure_-_Site-Map.json
