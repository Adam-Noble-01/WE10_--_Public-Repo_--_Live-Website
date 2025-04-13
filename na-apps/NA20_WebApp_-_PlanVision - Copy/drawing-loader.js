// ====================================================================================
// DRAWING MANAGEMENT MODULE
// ====================================================================================
// OFFLOADED | 12-Apr-2025
// Tested - Confirmed module is working as expected ✔
//
// Description:
// - This module is responsible for fetching drawings data from a JSON configuration file
// - It also loads a specific drawing's image and update download link
// - It also loads the plan image asynchronously
// - It also creates dynamic buttons for each drawing in the toolbar
// - It also updates the PDF download button with the current drawing's link
// ----------------------------------------------------------------------------------


// ----------------------------------------------------------------------------------
// MODULE VARIABLES
// ----------------------------------------------------------------------------------
// None for this module - all functions are stateless


//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .


// FUNCTION |  Fetch Drawings
// ----------------------------------------------------------------------------------
// - Fetches drawings data from JSON configuration file

async function fetchDrawings() {
    const JSON_URL = "https://raw.githubusercontent.com/Adam-Noble-01/RE20_--_Core_Repo_--_Public/main/SN40_31_--_Web-App_-_PlanVision_-_Web-Assets-Library/SN40_-_DATA_-_Document-Library.json";
    try {
        const response = await fetch(JSON_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        console.log("Fetched data:", data);

        // Check for the existence of each nested level
        if (!data["na-project-data-library"]) {
            throw new Error("Missing 'na-project-data-library' in JSON");
        }
        console.log("na-project-data-library:", data["na-project-data-library"]);

        if (!data["na-project-data-library"]["project-documentation"]) {
            throw new Error("Missing 'project-documentation' in JSON");
        }
        console.log("project-documentation:", data["na-project-data-library"]["project-documentation"]);

        if (!data["na-project-data-library"]["project-documentation"]["project-drawings"]) {
            throw new Error("Missing 'project-drawings' in JSON");
        }
        console.log("project-drawings:", data["na-project-data-library"]["project-documentation"]["project-drawings"]);

        const drawings = data["na-project-data-library"]["project-documentation"]["project-drawings"];
        return drawings;
    } catch (error) {
        console.error("Error fetching JSON:", error.message);
        throw error; // Re-throw to handle in the main application
    }
}

// END OF FUNCTION |  Fetch Drawings



//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .



// FUNCTION |  Load Drawing
// ----------------------------------------------------------------------------------
// - Loads a specific drawing's image and update download link

async function loadDrawing(drawing, planImage) {
    try {
        const pngUrl = drawing["document-links"]["png--github-link-url"];
        const documentName = drawing["document-name"];
        const documentScale = drawing["document-scale"];
        const documentSize = drawing["document-size"];
        
        // Return drawing metadata and URLs
        return {
            pngUrl,
            pdfUrl: drawing["document-links"]["pdf--github-link-url"],
            documentName,
            documentScale: documentScale || "1:50", // Default to 1:50 if not specified
            documentSize: documentSize || "A1" // Default to A1 if not specified
        };
    } catch (error) {
        console.error("Error loading drawing:", error);
        throw error;
    }
}

// END OF FUNCTION |  Load Drawing



//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .



// FUNCTION |  Load Plan Image
// ----------------------------------------------------------------------------------
// - Loads the plan image asynchronously

function loadPlanImage(url) {
    return new Promise((resolve, reject) => {
        const planImage = new Image();
        planImage.crossOrigin = "anonymous";
        
        planImage.onload = () => {
            resolve({
                image: planImage,
                naturalWidth: planImage.naturalWidth,
                naturalHeight: planImage.naturalHeight
            });
        };
        
        planImage.onerror = () => {
            reject(new Error("Failed to load plan image: " + url));
        };
        
        planImage.src = url;
    });
}

// END OF FUNCTION |  Load Plan Image



//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .



// FUNCTION |  Create Drawing Buttons
// ----------------------------------------------------------------------------------
// - Creates dynamic buttons for each drawing in the toolbar

function createDrawingButtons(drawings, toolbar, onDrawingSelect) {
    // Create header element for drawing section
    const header = document.createElement("div");
    header.className = "menu_-_drawing-button-header-text";
    header.textContent = "Select Drawing";

    // Create a separate container for the drawing buttons
    const buttonContainer = document.createElement("div");
    buttonContainer.className = "drawing-button-container";
    
    // Insert at the beginning of the toolbar
    if (toolbar.firstChild) {
        toolbar.insertBefore(buttonContainer, toolbar.firstChild);
        toolbar.insertBefore(header, buttonContainer);
    } else {
        toolbar.appendChild(header);
        toolbar.appendChild(buttonContainer);
    }

    // Add a spacer after the drawing buttons
    const spacer = document.createElement("div");
    spacer.style.marginBottom = "20px";
    buttonContainer.after(spacer);

    // Iterate over drawing entries and create buttons
    for (const key in drawings) {
        if (key.startsWith("drawing-") && drawings[key]["file-name"] !== "{{TEMPLATE_-_ENTRY_-_TO_-_COPY_-_DO_-_NOT_-_DELETE}}") {
            const button = document.createElement("button");
            button.className = "tool-button";
            button.textContent = drawings[key]["document-name"];
            button.addEventListener("click", () => onDrawingSelect(drawings[key]));
            buttonContainer.appendChild(button);
        }
    }
}

// END OF FUNCTION |  Create Drawing Buttons



//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .



// FUNCTION |  Update Download Link
// ----------------------------------------------------------------------------------
// - Updates the PDF download button with the current drawing's link

function updateDownloadLink(pdfUrl, documentName) {
    const downloadBtn = document.getElementById("downloadPDFBtn");
    if (downloadBtn) {
        downloadBtn.onclick = () => {
            const link = document.createElement("a");
            link.href = pdfUrl;
            link.download = documentName.replace(/ /g, "-") + ".pdf";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        };
    }
}

// END OF FUNCTION |  Update Download Link



//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .



// MODULE EXPORTS
// ----------------------------------------------------------------------------------
export {
    fetchDrawings,
    loadDrawing,
    loadPlanImage,
    createDrawingButtons,
    updateDownloadLink
}; 