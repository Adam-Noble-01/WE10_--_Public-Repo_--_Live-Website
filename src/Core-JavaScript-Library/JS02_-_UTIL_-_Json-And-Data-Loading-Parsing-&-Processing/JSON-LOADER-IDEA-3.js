TASK CREATE NEW LOADER SCRIPT
- Script is to be a Runtime Configurable Asset Loader
- Reads the Core Web Application Data Library JSON file
- Load Project JS Files from dynamic Json Data File

### Function Purpose
- Keeps a central index location for all project JS files
- Loads the JS files from the JSON data file
- Loaded early by the script requiring it as to ensure all other scripts have access to the JS files
This script recieves a unique code identifier for the script such as . . 

```example-code-identifier
"JS03_01_-_UTIL_-_Version-Number-Header-Injection.js"
```
- This identifier is used to load the correct JS file from the JSON data file
- The JSON data file is used to store the JS files in a central location
- The Json Files lists the URL path to the JS file as well as other data about the file
- It Should also list the version number of the file
- Script should also load asset files from the JSON data file
- basically acustom JSON-driven JavaScript asset bootstrapper.
    - But designed designed to intalise modular web applications at runtime.
- A dynamic JSON-driven asset bootstrapper that initialises JavaScript modules and associated.
- Loads resources from a centralised application json registry file using unique code identifiers.




Loads JSON data from a file and returns it as a JavaScript object.

INPUT = The script that calls this new loader script will need to provide the path to the JSON data file.

The input will the the unique code identifier for the script

### JSON DATA FILE LOCATION
- Load This File
assets/AD01_-_DATA_-_Common_-_Global-Data-Library/AD01_03-_DATA_-_Core-Web-Application-Data-Library.json






-----------------------------------------------------------------------------------------------------------------------



"SN10_01_-_UTIL_-_Text-To-Reader-App": {
    "app-name"              :  "Text To Reader Utility",
    "app-browser-title"     :  "Text To Reader",
    "app-description"       :  "A utility to parse WhatsApp chat text or render Markdown text into a readable format",
    "app-category"          :  "UTIL",
    "app-keywords"          :  "Reader, Text to Speech, Utility, WhatsApp, Markdown",
    "app-usage"             :  "For converting Whatsapp messages / markdown text into a readable format",
    "app-dir-path"          :  "./sn-apps/SN10_01_-_UTIL_-_Text-To-Reader-App/SN10_01_01_-_PAGE_-_Text-To-Reader-App",
    "app-web-url"           :  "https://www.noble-architecture.com/sn-apps/SN10_01_-_UTIL_-_Text-To-Reader-App/SN10_01_01_-_PAGE_-_Text-To-Reader-App",
    "app-file-name"         :  "SN10_01_01_-_PAGE_-_Text-To-Reader-App.html",
    "app-file-format"       :  "html",
    "app-type"              :  "Productivity Utility",
    "app-created"           :  "08-Apr-2025",
    "app-author"            :  "Adam Noble",
    "app-last-updated"      :  "09-Apr-2025",
    "app-current-version"   :  "1.2.4",
    "app-bot-visible"       :  false,
    "app-active-status"     :  true,
    "app-assets-loader":{
        "app-assets-config":{
            "assets-required"         :  true,
            "assets-fonts-required"   :  true,
            "assets-scripts-required" :  true,
            "assets-external-libs"    :  false,
            "assets-required-notes"   :  ""
        },
        "app-scripts-loader" :  {
            "JS02_03_-_UTIL_-_Fetch-And-Load-App-Data-JSON-Data.js":{
                "script-load-order"       :  1,
                "script-unique-id"        :  "JS02_03_-_UTIL_-_Fetch-And-Load-App-Data.js",
                "script-functionality"    :  "Loads the app data from the JSON file into the app",
                "script-directory-path"   :  "/src/Core-JavaScript-Library/JS02_-_UTIL_-_Json-And-Data-Loading-Parsing-And-Processing/JS02_03_-_UTIL_-_Fetch-And-Load-App-Data.js",
                "script-web-url"          :  "https://www.noble-architecture.com/src/Core-JavaScript-Library/JS02_-_UTIL_-_Json-And-Data-Loading-Parsing-And-Processing/JS02_03_-_UTIL_-_Fetch-And-Load-App-Data.js",
                "scripts-to-load-prior"   :  "N/A"
            },
            "JS01_01_-_UTIL_-_Version-Number-Header-Injection.js":{
                "script-load-order"       :  2,
                "script-unique-id"        :  "JS01_01_-_UTIL_-_Version-Number-Header-Injection.js",
                "script-functionality"    :  "Injects the version number from the core app data file into the applications top menu",
                "script-directory-path"   :  "/src/Core-JavaScript-Library/JS01_-_UTIL_-_Utility-Scripts_-_Page-And-HTML-Manipulation/JS01_01_-_UTIL_-_Version-Number-Header-Injection.js",
                "script-web-url"          :  "https://www.noble-architecture.com/src/Core-JavaScript-Library/JS01_-_UTIL_-_Utility-Scripts_-_Page-And-HTML-Manipulation/JS01_01_-_UTIL_-_Version-Number-Header-Injection.js",
                "scripts-to-load-prior"   :  "N/A"
            },
            "app-script-parameter-manager" :  {
                "placeholder-parameter-1" :  "Placeholder Parameter 1",
                "placeholder-parameter-2" :  "Placeholder Parameter 2",
                "placeholder-parameter-3" :  "Placeholder Parameter 3"
            }
        },
        "app-development-logs":{
            "Version - 1.3.0": {
                "version-title"  :  "Style Update",
                "version-date"   :  "09-Apr-2025",
                "version-notes"  :  "Refactored the page style to match the organisation's design patterns"
            },
            "Version - 1.2.4": {
                "version-title"  :  "Style Update",
                "version-date"   :  "09-Apr-2025",
                "version-notes"  :  "Refactored the page style to match the organisation's design patterns"
            },
            "Version - 1.0.0": {
                "version-title"  :  "Initial Version",
                "version-date"   :  "08-Apr-2025",
                "version-notes"  :  "First release of the WhatsApp/Markdown text reader utility"
            }
        }
    }
},
