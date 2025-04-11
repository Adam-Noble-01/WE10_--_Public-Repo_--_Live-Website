/*
================================================================================
JAVASCRIPT | JSON HELPER SCRIPT
- Helper functions for loading and processing JSON data
================================================================================
*/

console.log("📊 JSON HELPER SCRIPT LOADED");

/**
 * Resolves a path to the drawing JSON file
 * Handles different path formats in different project structures
 */
function resolveJsonPath() {
    // Try multiple possible locations for the JSON
    const possiblePaths = [
        // GitHub URL (preferred for production)
        "https://raw.githubusercontent.com/Adam-Noble-01/RE20_--_Core_Repo_--_Public/main/SN40_31_--_Web-App_-_PlanVision_-_Web-Assets-Library/SN40_-_DATA_-_Document-Library.json",
        
        // Local paths (for development)
        "NA40_02_-_DATA_-_App-Files-And-App-Config/NA40_01_01_-_DATA_-_PlanVision-App-Config.json",
        "../NA40_02_-_DATA_-_App-Files-And-App-Config/NA40_01_01_-_DATA_-_PlanVision-App-Config.json"
    ];
    
    console.log("📊 Will try these JSON paths:", possiblePaths);
    return possiblePaths;
}

/**
 * Fetch JSON from multiple possible sources
 * Tries each source in sequence until one works
 */
async function fetchJsonFromAnySource() {
    const paths = resolveJsonPath();
    let lastError = null;
    
    for (const path of paths) {
        try {
            console.log(`📊 Trying to fetch JSON from: ${path}`);
            const response = await fetch(path);
            
            if (!response.ok) {
                console.warn(`📊 Failed to fetch from ${path}: ${response.status} ${response.statusText}`);
                continue;
            }
            
            const data = await response.json();
            console.log(`📊 Successfully loaded JSON from: ${path}`);
            return { path, data };
        } catch (error) {
            console.warn(`📊 Error fetching from ${path}:`, error);
            lastError = error;
        }
    }
    
    // If we get here, all paths failed
    throw new Error(`Failed to load JSON from any source: ${lastError?.message || "Unknown error"}`);
}

/**
 * Extract drawings data from various possible JSON structures
 */
function extractDrawingsFromJson(jsonData) {
    console.log("📊 Extracting drawings from JSON data");
    
    // Try the structure from the reference implementation
    if (jsonData["na-project-data-library"]?.["project-documentation"]?.["project-drawings"]) {
        console.log("📊 Found drawings in reference format");
        return jsonData["na-project-data-library"]["project-documentation"]["project-drawings"];
    }
    
    // Try the structure from the current implementation
    if (jsonData["Project_Documentation"]?.["project-drawings"]) {
        console.log("📊 Found drawings in current format");
        return jsonData["Project_Documentation"]["project-drawings"];
    }
    
    // Try other possible locations
    if (jsonData["project-drawings"]) {
        console.log("📊 Found drawings at root level");
        return jsonData["project-drawings"];
    }
    
    // If we haven't returned by now, we couldn't find the drawings
    throw new Error("Could not find drawings data in JSON");
}

// Make functions available globally
window.JSON_HELPER = {
    resolveJsonPath,
    fetchJsonFromAnySource,
    extractDrawingsFromJson
}; 