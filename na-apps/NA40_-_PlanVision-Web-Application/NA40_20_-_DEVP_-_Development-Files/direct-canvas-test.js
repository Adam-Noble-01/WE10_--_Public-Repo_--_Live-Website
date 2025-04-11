/*
================================================================================
JAVASCRIPT | DIRECT CANVAS TEST SCRIPT
- Bypasses normal rendering pipeline to directly test canvas display
================================================================================
*/

console.log("📊 DIRECT CANVAS TEST SCRIPT LOADED");

// Global variables for direct image loading
let directPlanImage = new Image();
let directDrawings = null;
let directIsImageLoaded = false;

/**
 * Initialize direct canvas test
 */
function initDirectCanvasTest() {
    console.log("📊 Initializing direct canvas test");
    
    // Find the canvas element
    const canvas = document.getElementById("CNVS__Plan");
    if (!canvas) {
        console.error("📊 ERROR: Canvas element not found!");
        return;
    }
    
    console.log("📊 Canvas found, dimensions:", canvas.width, "x", canvas.height);
    
    // Get the rendering context
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        console.error("📊 ERROR: Could not get canvas context!");
        return;
    }
    
    // Draw something immediately to test the canvas
    drawTestPattern(canvas, ctx);
    
    // Add button for direct JSON loading
    const debugSection = document.querySelector('.MENU__Drawing-Header-Text');
    if (debugSection && debugSection.textContent.includes('Debug Tools')) {
        const jsonButton = document.createElement("button");
        jsonButton.className = "BTTN__Tool";
        jsonButton.id = "BTTN__Debug-Direct-JSON";
        jsonButton.textContent = "Load Using Old Method";
        jsonButton.addEventListener("click", () => directFetchDrawings());
        
        // Insert after debug section
        debugSection.parentNode.insertBefore(jsonButton, debugSection.nextSibling);
    }
    
    // Add event listener for the Legacy Load Method button
    const legacyButton = document.getElementById("BTTN__Debug-Legacy-Load");
    if (legacyButton) {
        legacyButton.addEventListener("click", directFetchDrawings);
        console.log("📊 Added event listener for Legacy Load Method button");
    }
}

/**
 * Draw a test pattern directly on the canvas
 */
function drawTestPattern(canvas, ctx) {
    console.log("📊 Drawing test pattern on canvas");
    
    // Ensure canvas size matches display size
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    
    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
        console.log("📊 Adjusted canvas dimensions to:", displayWidth, "x", displayHeight);
    }
    
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Fill with a light background
    ctx.fillStyle = "#f0f0f0";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw a border
    ctx.strokeStyle = "#333333";
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
    
    // Draw text
    ctx.font = "bold 24px Arial";
    ctx.fillStyle = "#333333";
    ctx.textAlign = "center";
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    ctx.fillText("Canvas Test Pattern", centerX, centerY - 50);
    ctx.fillText("If you can see this, the canvas is working", centerX, centerY);
    
    // Draw a colorful grid
    const gridSize = 50;
    ctx.lineWidth = 1;
    
    for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.strokeStyle = `hsl(${(x * 360 / canvas.width) % 360}, 50%, 50%)`;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    
    for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.strokeStyle = `hsl(${(y * 360 / canvas.height) % 360}, 50%, 50%)`;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
    
    // Draw the current time
    ctx.font = "16px Arial";
    ctx.fillStyle = "#333333";
    ctx.fillText("Current time: " + new Date().toLocaleTimeString(), centerX, centerY + 50);
    
    console.log("📊 Test pattern drawing complete");
}

/**
 * Load a test image directly without using the normal pipeline
 */
function loadDirectTestImage(canvas, ctx) {
    console.log("📊 Loading direct test image");
    
    // Use a test image URL
    const testImageUrl = "https://raw.githubusercontent.com/Adam-Noble-01/RE20_--_Core_Repo_--_Public/main/SN40_31_--_Web-App_-_PlanVision_-_Web-Assets-Library/SN40_32_--_PlanVision_-_Placeholder-Testing-Assets/GA06_T02_D11_--_PD-Site-Plans.png";
    
    // Create a new image
    const img = new Image();
    img.crossOrigin = "anonymous";
    
    // Show loading state
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f0f0f0";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = "bold 24px Arial";
    ctx.fillStyle = "#333333";
    ctx.textAlign = "center";
    ctx.fillText("Loading test image...", canvas.width / 2, canvas.height / 2);
    
    // Image loaded handler
    img.onload = function() {
        console.log("📊 Test image loaded successfully:", img.width, "x", img.height);
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw the image
        const centerX = (canvas.width - img.width) / 2;
        const centerY = (canvas.height - img.height) / 2;
        
        ctx.drawImage(img, centerX, centerY);
        
        // Draw information text
        ctx.font = "16px Arial";
        ctx.fillStyle = "#333333";
        ctx.textAlign = "center";
        ctx.fillText(`Image loaded directly: ${img.width} x ${img.height}`, canvas.width / 2, 30);
    };
    
    // Image error handler
    img.onerror = function(error) {
        console.error("📊 Error loading test image:", error);
        
        // Show error on canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#fff0f0";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = "bold 24px Arial";
        ctx.fillStyle = "#ff0000";
        ctx.textAlign = "center";
        ctx.fillText("Error loading test image", canvas.width / 2, canvas.height / 2 - 20);
        ctx.font = "16px Arial";
        ctx.fillText("See console for details", canvas.width / 2, canvas.height / 2 + 20);
    };
    
    // Start loading the image
    img.src = testImageUrl;
}

/**
 * Direct implementation of fetchDrawings from the reference file
 */
async function directFetchDrawings() {
    const canvas = document.getElementById("CNVS__Plan");
    const ctx = canvas.getContext("2d");
    
    // Draw loading message
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f0f0f0";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = "bold 24px Arial";
    ctx.fillStyle = "#333333";
    ctx.textAlign = "center";
    ctx.fillText("Loading drawings data...", canvas.width / 2, canvas.height / 2);
    
    // Using the JSON path from the current config
    const jsonPath = "NA40_02_-_DATA_-_App-Files-And-App-Config/NA40_01_01_-_DATA_-_PlanVision-App-Config.json";
    console.log("📊 Fetching drawings from:", jsonPath);
    
    try {
        const response = await fetch(jsonPath);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("📊 Fetched data:", data);

        // In the new format, drawings are at Project_Documentation.project-drawings
        if (data["Project_Documentation"] && data["Project_Documentation"]["project-drawings"]) {
            directDrawings = data["Project_Documentation"]["project-drawings"];
            console.log("📊 Found drawings:", directDrawings);
            
            // Create buttons and load first drawing
            directCreateDrawingButtons(directDrawings);
            
            // Load the first drawing
            const firstDrawingKey = Object.keys(directDrawings).find(
                key => key.startsWith("drawing-") && 
                directDrawings[key]["file-name"] !== "{{TEMPLATE_-_ENTRY_-_TO_-_COPY_-_DO_-_NOT_-_DELETE}}"
            );
            
            if (firstDrawingKey) {
                await directLoadDrawing(directDrawings[firstDrawingKey]);
            } else {
                console.error("📊 No valid drawings found");
                
                // Show error on canvas
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = "#fff0f0";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.font = "bold 24px Arial";
                ctx.fillStyle = "#ff0000";
                ctx.textAlign = "center";
                ctx.fillText("No valid drawings found in JSON data", canvas.width / 2, canvas.height / 2);
            }
        } else {
            throw new Error("Missing project-drawings in JSON");
        }
    } catch (error) {
        console.error("📊 Error fetching JSON:", error);
        
        // Show error on canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#fff0f0";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = "bold 24px Arial";
        ctx.fillStyle = "#ff0000";
        ctx.textAlign = "center";
        ctx.fillText("Error loading drawing data", canvas.width / 2, canvas.height / 2 - 20);
        ctx.font = "16px Arial";
        ctx.fillText(error.message, canvas.width / 2, canvas.height / 2 + 20);
    }
}

/**
 * Create buttons for each drawing
 */
function directCreateDrawingButtons(drawings) {
    console.log("📊 Creating drawing buttons");
    
    // Create header element for drawing section
    const header = document.createElement("div");
    header.className = "MENU__Drawing-Header-Text";
    header.textContent = "Direct Loading Drawings";
    
    // Create a separate container for the drawing buttons
    const buttonContainer = document.createElement("div");
    buttonContainer.className = "direct-drawing-buttons";
    buttonContainer.style.marginBottom = "20px";
    
    // Get the toolbar element
    const toolbar = document.getElementById("TOOL__Container");
    
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
    
    // Count the number of buttons created
    let buttonCount = 0;
    
    // Iterate over drawing entries and create buttons
    for (const key in drawings) {
        if (key.startsWith("drawing-") && 
            drawings[key]["file-name"] !== "{{TEMPLATE_-_ENTRY_-_TO_-_COPY_-_DO_-_NOT_-_DELETE}}") {
            
            const button = document.createElement("button");
            button.className = "BTTN__Tool";
            button.textContent = drawings[key]["document-name"] || `Drawing ${++buttonCount}`;
            button.addEventListener("click", () => directLoadDrawing(drawings[key]));
            buttonContainer.appendChild(button);
            buttonCount++;
        }
    }
    
    console.log(`📊 Created ${buttonCount} drawing buttons`);
}

/**
 * Load a specific drawing
 */
async function directLoadDrawing(drawing) {
    const canvas = document.getElementById("CNVS__Plan");
    const ctx = canvas.getContext("2d");
    
    // Show loading state
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f0f0f0";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = "bold 24px Arial";
    ctx.fillStyle = "#333333";
    ctx.textAlign = "center";
    ctx.fillText("Loading drawing...", canvas.width / 2, canvas.height / 2);
    
    console.log("📊 Loading drawing:", drawing);
    
    try {
        // Extract URLs from drawing
        let pngUrl = null;
        let pdfUrl = null;
        
        if (drawing["document-links"]) {
            if (drawing["document-links"]["png--github-link-url"]) {
                pngUrl = drawing["document-links"]["png--github-link-url"];
            }
            if (drawing["document-links"]["pdf--github-link-url"]) {
                pdfUrl = drawing["document-links"]["pdf--github-link-url"];
            }
        }
        
        if (!pngUrl) {
            throw new Error("No PNG URL found in drawing data");
        }
        
        console.log("📊 Loading image from URL:", pngUrl);
        
        // Load the image
        await directLoadPlanImage(pngUrl);
        
        // Draw the loaded image
        directRenderImage(canvas, ctx);
        
        // Update document title
        if (drawing["document-name"]) {
            document.title = "PlanVision | " + drawing["document-name"];
        }
        
    } catch (error) {
        console.error("📊 Error loading drawing:", error);
        
        // Show error on canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#fff0f0";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = "bold 24px Arial";
        ctx.fillStyle = "#ff0000";
        ctx.textAlign = "center";
        ctx.fillText("Error loading drawing", canvas.width / 2, canvas.height / 2 - 20);
        ctx.font = "16px Arial";
        ctx.fillText(error.message, canvas.width / 2, canvas.height / 2 + 20);
    }
}

/**
 * Load the plan image using a Promise
 */
function directLoadPlanImage(url) {
    return new Promise((resolve, reject) => {
        directPlanImage = new Image();
        directPlanImage.crossOrigin = "anonymous";
        
        directPlanImage.onload = () => {
            console.log("📊 Image loaded successfully:", 
                directPlanImage.width, "x", directPlanImage.height);
            directIsImageLoaded = true;
            resolve();
        };
        
        directPlanImage.onerror = (error) => {
            console.error("📊 Error loading image:", error);
            directIsImageLoaded = false;
            reject(new Error("Failed to load image: " + url));
        };
        
        // Add cache-busting to avoid caching issues
        const cacheBuster = "?t=" + new Date().getTime();
        directPlanImage.src = url + cacheBuster;
    });
}

/**
 * Render the loaded image to the canvas
 */
function directRenderImage(canvas, ctx) {
    if (!directIsImageLoaded || !directPlanImage) {
        console.error("📊 Cannot render - no image loaded");
        return;
    }
    
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Set up transformations to center the image
    ctx.save();
    
    // Calculate scale to fit image within canvas
    const canvasRatio = canvas.width / canvas.height;
    const imageRatio = directPlanImage.width / directPlanImage.height;
    
    let scale = 1;
    if (imageRatio > canvasRatio) {
        // Image is wider than canvas (relative to height)
        scale = canvas.width / directPlanImage.width * 0.9;
    } else {
        // Image is taller than canvas (relative to width)
        scale = canvas.height / directPlanImage.height * 0.9;
    }
    
    // Center the image
    const centerX = (canvas.width - directPlanImage.width * scale) / 2;
    const centerY = (canvas.height - directPlanImage.height * scale) / 2;
    
    // Apply drop shadow effect (as in reference)
    ctx.shadowColor = "rgba(0, 0, 0, 0.2)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 5;
    ctx.shadowOffsetY = 5;
    
    // Draw image
    ctx.translate(centerX, centerY);
    ctx.scale(scale, scale);
    ctx.drawImage(directPlanImage, 0, 0);
    
    // Restore context state
    ctx.restore();
    
    // Draw information text
    ctx.font = "16px Arial";
    ctx.fillStyle = "#333333";
    ctx.textAlign = "center";
    ctx.fillText(`Loaded using direct method: ${directPlanImage.width} x ${directPlanImage.height}`, 
        canvas.width / 2, 30);
}

// Initialize when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Slight delay to ensure canvas is ready
    setTimeout(initDirectCanvasTest, 1000);
});

// Make functions available globally
window.directCanvasTest = {
    drawTestPattern: function() {
        const canvas = document.getElementById("CNVS__Plan");
        const ctx = canvas.getContext("2d");
        drawTestPattern(canvas, ctx);
    },
    loadDirectTestImage: function() {
        const canvas = document.getElementById("CNVS__Plan");
        const ctx = canvas.getContext("2d");
        loadDirectTestImage(canvas, ctx);
    },
    fetchDrawings: directFetchDrawings
}; 