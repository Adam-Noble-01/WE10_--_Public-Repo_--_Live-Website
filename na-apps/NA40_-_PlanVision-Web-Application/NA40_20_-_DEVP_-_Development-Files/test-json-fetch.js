/*
================================================================================
JAVASCRIPT | TEST JSON FETCH SCRIPT
- Debug script to verify JSON loading
================================================================================
*/

console.log("🧪 TEST JSON FETCH SCRIPT LOADED");

// The path to the project data
const TEST_PROJECT_DATA_PATH = "../NA40_02_-_DATA_-_App-Files-And-App-Config/NA40_01_01_-_DATA_-_PlanVision-App-Config.json";

/**
 * Test function to fetch the project data
 */
async function testJsonFetch() {
    try {
        console.log("🧪 TEST: Attempting to fetch project data from:", TEST_PROJECT_DATA_PATH);
        
        // Fetch the data
        const response = await fetch(TEST_PROJECT_DATA_PATH);
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        // Parse the JSON
        const data = await response.json();
        
        console.log("🧪 TEST: Successfully fetched and parsed JSON data:", data);
        
        // Try to extract drawing data
        let drawings = null;
        
        if (data["Project_Documentation"] && data["Project_Documentation"]["project-drawings"]) {
            drawings = data["Project_Documentation"]["project-drawings"];
            console.log("🧪 TEST: Found drawings in Project_Documentation.project-drawings:", drawings);
        } else {
            console.log("🧪 TEST: No drawings found in expected location. Full data structure:", data);
        }
        
        return { success: true, data, drawings };
    } catch (error) {
        console.error("🧪 TEST: Error fetching JSON:", error);
        return { success: false, error: error.message };
    }
}

// Run the test immediately
document.addEventListener('DOMContentLoaded', () => {
    console.log("🧪 TEST: DOM loaded, running JSON fetch test");
    testJsonFetch();
});

// Export test function to window for console testing
window.testJsonFetch = testJsonFetch; 