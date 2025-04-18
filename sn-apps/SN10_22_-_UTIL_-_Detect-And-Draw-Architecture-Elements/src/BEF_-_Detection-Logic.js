// ===================================================================================
// JAVASCRIPT | ARCHITECTURE ELEMENT DETECTION LOGIC
// ===================================================================================
//
// FILE NAME | BEF_-_Detection-Logic.js
// FILE PATH | ./src/BEF_-_Detection-Logic.js
//
// Description:
// - Contains image processing and detection logic (Stages 1 & 2)
// - Separated from core UI/App logic for maintainability
// - Implements orthogonal bias feature for architectural drawings
// - Handles all OpenCV-based detection operations
//
// VERSIONING HISTORY
// - 19-Apr-2025 - Version 1.0.0 - Initial implementation
// - 21-Apr-2025 - Version 1.1.0 - Added orthogonal bias feature
// - 22-Apr-2025 - Version 1.2.0 - Fixed orthogonal angle calculation
// ----------------------------------------------------------------------------------

// DEPENDENCY IMPORTS
// ========================================================================== //
import * as SharedState from './BEF_-_Shared-State.js';

// Note: OpenCV (cv) is assumed to be globally available once loaded by Core.

// ----------------------------------------------------------------------------------
// MODULE VARIABLES
// ----------------------------------------------------------------------------------

// DETECTION CONSTANTS
const ZERO_TOLERANCE    =            1e-6;  // <- Tolerance for floating point comparisons
const CLEANUP_TOLERANCE =            0.5;   // <- Tolerance for point deduplication in pixels

// RUNTIME VARIABLES
let orthoBiasActive     =           false;  // <- Tracks if orthogonal bias is active
let verboseLogging      =            true;  // <- Controls detailed console logging


// PREPROCESSING FUNCTIONS
// ========================================================================== //

// FUNCTION |  Image preprocessing for edge detection
// ----------------------------------------------------------------------------------
// - Converts image to grayscale and enhances edges for better detection
// - Applied before Canny edge detection in the pipeline

function preprocessImage(inputMat) {
    let gray      = new cv.Mat();
    let processed = new cv.Mat();
    let enhanced  = new cv.Mat();

    try {
        cv.cvtColor(inputMat, gray, cv.COLOR_RGBA2GRAY);
        cv.GaussianBlur(gray, processed, new cv.Size(3, 3), 0, 0, cv.BORDER_DEFAULT);
        cv.equalizeHist(processed, enhanced);
        cv.addWeighted(processed, 0.7, enhanced, 0.3, 0, processed);
        return processed;
    } catch (err) {
        console.error("Error during preprocessing:", err);
        SharedState.showStatus(`Preprocessing Error: ${err.message}`, true);
        if (gray && !gray.empty()) {
           gray.copyTo(processed);
        } else {
           throw new Error("Cannot create even grayscale image from input.");
        }
        return processed;
    } finally {
        if (gray !== processed) gray?.delete();
        enhanced?.delete();
    }
}
// End of function  


//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   . 

/**
 * DEBUGGING VERSION 3: Enhanced debugging for orthogonal adjustment logic.
 * @param {Array<{x: number, y: number}>} points - Input contour points.
 * @param {number} angleTolerance - Max deviation from H/V in degrees.
 * @param {number} contourIndex - Index of the contour for logging purposes.
 * @returns {Array<{x: number, y: number}>} - Orthogonalized points.
 */

// ----------------------------------------------------------------------------------
// ORTHOGONALISATION FUNCTIONS
// ----------------------------------------------------------------------------------

// FUNCTION |  Orthogonalizes contours to favor horizontal/vertical lines
// ----------------------------------------------------------------------------------
// - Examines each segment and adjusts vertices to create more orthogonal layouts
// - Core component of the orthogonal bias feature for architectural drawings
// - Includes verbose debugging for development/diagnostic purposes
function orthogonalizeContour(points, angleTolerance, contourIndex) {
    const loggingEnabled = true;                               // Keep logging enabled for confirmation
    const verboseLogging = contourIndex % 100 === 0;           // More detailed logs for every 100th contour
    const logPrefix = `[Ortho C#${contourIndex}]`;

    if (verboseLogging) console.log(`${logPrefix} Input points:`, JSON.parse(JSON.stringify(points)), `Tolerance: ${angleTolerance}`);

    if (angleTolerance <= 0 || !points || points.length < 2) {
         if (loggingEnabled) console.log(`${logPrefix} Skipping: Tolerance <= 0 or not enough points.`);
        return points;
    }

    let newPoints = JSON.parse(JSON.stringify(points)); // Work on a copy
    const n = newPoints.length;
    let changesMadeInLoop = false; // Track if any adjustment happens

    for (let i = 0; i < n; i++) {
        const p1_index = i;
        const p2_index = (i + 1) % n; // Wrap around

        const p1 = newPoints[p1_index];
        const p2 = newPoints[p2_index];

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;

        if (verboseLogging) console.log(`${logPrefix} Seg ${i}: (${p1.x},${p1.y}) -> (${p2.x},${p2.y}), dx=${dx.toFixed(1)}, dy=${dy.toFixed(1)}`);

        if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) {
            if (verboseLogging) console.log(`${logPrefix}   Skipping zero-length segment.`);
            continue;
        }

        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        const absAngle = Math.abs(angle);
        
        if (verboseLogging) console.log(`${logPrefix}   Angle: ${angle.toFixed(1)} deg, absAngle: ${absAngle.toFixed(1)}, tolerance: ${angleTolerance}`);
        
        // HORIZONTAL LINE DETECTION
        // ----------------------------------------------------------------------------------
        const horizCheck = Math.min(absAngle, Math.abs(absAngle - 180));
        if (verboseLogging) console.log(`${logPrefix}   Horiz check: ${horizCheck.toFixed(2)} <= ${angleTolerance}`);
        
        // Check horizontal candidate (angles near 0° or 180°)
        if (Math.min(absAngle, Math.abs(absAngle - 180)) <= angleTolerance) {
             if (verboseLogging) console.log(`${logPrefix}   Horizontal candidate (Angle near 0/180).`);
             
             // Force Y coordinate alignment if not already aligned
             if (Math.abs(p2.y - p1.y) > 1e-6) {
                if (loggingEnabled) console.log(`${logPrefix}     ADJUSTING P2.y: ${p2.y} -> ${p1.y}`);
                newPoints[p2_index].y = p1.y;
                changesMadeInLoop = true;
             } else {
                if (verboseLogging) console.log(`${logPrefix}     Already exactly horizontal.`);
             }
        }
        
        // VERTICAL LINE DETECTION
        // ----------------------------------------------------------------------------------
        const vertCheck = Math.min(Math.abs(absAngle - 90), Math.abs(absAngle - 270));
        if (verboseLogging) console.log(`${logPrefix}   Vert check: ${vertCheck.toFixed(2)} <= ${angleTolerance}`);
        
        // Check vertical candidate (angles near 90° or 270°)
        else if (Math.min(Math.abs(absAngle - 90), Math.abs(absAngle - 270)) <= angleTolerance) {
             if (verboseLogging) console.log(`${logPrefix}   Vertical candidate (Angle near 90/270).`);
             
             // Force X coordinate alignment if not already aligned
             if (Math.abs(p2.x - p1.x) > 1e-6) {
                 if (loggingEnabled) console.log(`${logPrefix}     ADJUSTING P2.x: ${p2.x} -> ${p1.x}`);
                 newPoints[p2_index].x = p1.x;
                 changesMadeInLoop = true;
             } else {
                 if (verboseLogging) console.log(`${logPrefix}     Already exactly vertical.`);
             }
        } else {
            if (verboseLogging) console.log(`${logPrefix}   Diagonal segment.`);
        }
    } // End for loop

     if (loggingEnabled && !changesMadeInLoop) console.log(`${logPrefix} No adjustments made in loop.`);
     if (verboseLogging && changesMadeInLoop) console.log(`${logPrefix} Points after loop:`, JSON.parse(JSON.stringify(newPoints)));


    // --- Post-processing Cleanup (Only if changes were made) ---
    if (!changesMadeInLoop) {
         if (verboseLogging) console.log(`${logPrefix} Skipping cleanup as no loop changes occurred.`);
         // Return the points array (which is identical to input if no changes)
         // Still need the final validity check
         return newPoints.length >= 3 ? newPoints : points;
    }

    if (verboseLogging) console.log(`${logPrefix} Starting cleanup...`);
    let cleanedPoints = [];
    if (newPoints.length > 0) {
        cleanedPoints.push(newPoints[0]);
        for (let i = 1; i < newPoints.length; i++) {
            const lastCleaned = cleanedPoints[cleanedPoints.length - 1];
            const currentNew = newPoints[i];
             // Use a small tolerance for duplicate check after adjustments
            if (Math.abs(currentNew.x - lastCleaned.x) > 0.5 || Math.abs(currentNew.y - lastCleaned.y) > 0.5) {
                cleanedPoints.push(currentNew);
            } else {
                 if (verboseLogging) console.log(`${logPrefix}   Cleaning: Removed duplicate point at index ${i}: (${currentNew.x}, ${currentNew.y})`);
            }
        }
        // Check closing point duplication
        if (cleanedPoints.length > 1) {
            const firstCleaned = cleanedPoints[0];
            const lastCleaned = cleanedPoints[cleanedPoints.length - 1];
            if (Math.abs(firstCleaned.x - lastCleaned.x) < 0.5 && Math.abs(firstCleaned.y - lastCleaned.y) < 0.5) {
                if (verboseLogging) console.log(`${logPrefix}   Cleaning: Removed duplicate closing point: (${lastCleaned.x}, ${lastCleaned.y})`);
                cleanedPoints.pop();
            }
        }
    }

    if (verboseLogging) console.log(`${logPrefix} Points after cleanup:`, JSON.parse(JSON.stringify(cleanedPoints)));

    const finalPoints = cleanedPoints.length >= 3 ? cleanedPoints : points;
    if (verboseLogging) console.log(`${logPrefix} Final returned points:`, JSON.parse(JSON.stringify(finalPoints)));
    return finalPoints;
}


// ===================================================================================
// STAGE 1: DETECTION PIPELINE
// ===================================================================================

// FUNCTION |  Primary detection of architectural elements
// ----------------------------------------------------------------------------------
// - Processes image through preprocessing, edge detection, and contour finding
// - Applies orthogonal bias to improve architectural element recognition
// - Returns promise that resolves to true if elements were found
function detectElements() {
    SharedState.showStatus("Running Stage 1: Detection...", false, true);
    console.log("--- detectElements START ---"); // Log start

    return new Promise((resolve, reject) => {
        setTimeout(() => {
            // ... (previous declarations: tempInput, tempGray, etc.)
            let tempInput = null;
            let tempGray = null;
            let tempCanny = null;
            let tempContours = null;
            let tempHierarchy = null;
            let kernel = null;

            try {
                const startTime = performance.now();

                // DETECTION PARAMETERS
                // ----------------------------------------------------------------------------------
                // Canny edge detection parameters
                const cannyThreshold1       = parseInt(SharedState.sliders.cannyThreshold1.value);
                const cannyThreshold2       = parseInt(SharedState.sliders.cannyThreshold2.value);
                
                // Size filtering parameters (millimeters)
                const minWidthMm            = parseInt(SharedState.sliders.detectMinWidth.value);
                const minHeightMm           = parseInt(SharedState.sliders.detectMinHeight.value);
                const maxWidthMm            = parseInt(SharedState.sliders.detectMaxWidth.value);
                const maxHeightMm           = parseInt(SharedState.sliders.detectMaxHeight.value);
                
                // Size filtering parameters (pixels) - converted based on real-world scaling
                const minWidthPixels        = minWidthMm * SharedState.pixelsPerMm;
                const minHeightPixels       = minHeightMm * SharedState.pixelsPerMm;
                const maxWidthPixels        = maxWidthMm * SharedState.pixelsPerMm;
                const maxHeightPixels       = maxHeightMm * SharedState.pixelsPerMm;

                const orthogonalBiasPercent = parseInt(SharedState.sliders.orthogonalBias.value);
                
                // ANGLE TOLERANCE CALCULATION
                // ----------------------------------------------------------------------------------
                // - Higher scale factor (1.0) makes orthogonalisation more effective
                // - 100% bias = 100 degrees tolerance for maximum angle adjustment flexibility
                const angleTolerance             = orthogonalBiasPercent * 1.0;     // 0-100% → 0-100 degrees
                
                console.log(`[Detect] Orthogonal Bias: ${orthogonalBiasPercent}%, Angle Tolerance: ${angleTolerance.toFixed(1)} deg`);

                // --- Reset & Image Read ---
                SharedState.resetImage(false);
                SharedState.detectionResults.length = 0;
                SharedState.polygons.length = 0;
                tempInput = cv.imread(SharedState.getCanvas());
                if (!tempInput || tempInput.empty()) throw new Error('Failed to read image');
                 console.log("[Detect] Image read successfully.");

                // --- Preprocessing, Canny, Morphology ---
                tempGray = preprocessImage(tempInput);
                if (!tempGray || tempGray.empty()) throw new Error('Preprocessing failed');
                 console.log("[Detect] Preprocessing done.");

                tempCanny = new cv.Mat();
                cv.Canny(tempGray, tempCanny, cannyThreshold1, cannyThreshold2, 3, false);
                if (!tempCanny || tempCanny.empty()) throw new Error('Canny failed');
                 console.log("[Detect] Canny edges detected.");

                kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(2, 2));
                cv.morphologyEx(tempCanny, tempCanny, cv.MORPH_CLOSE, kernel, new cv.Point(-1, -1), 1);
                 console.log("[Detect] Morphology applied.");

                // --- Find Contours ---
                tempContours = new cv.MatVector();
                tempHierarchy = new cv.Mat();
                cv.findContours(tempCanny, tempContours, tempHierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
                let rawContourCount = tempContours.size();
                 console.log(`[Detect] Found ${rawContourCount} raw contours.`);

                // CONTOUR PROCESSING
                // ----------------------------------------------------------------------------------
                // Tracking variables for diagnostic reporting
                let keptRawContours      = 0;        // Count of contours kept after filtering
                let rejectedByMinSize    = 0;        // Count of contours rejected for being too small
                let rejectedByMaxSize    = 0;        // Count of contours rejected for being too large
                let orthogonalizedCount  = 0;        // Count of contours attempted for orthogonalisation
                let actuallyChangedCount = 0;        // Count of contours actually changed by orthogonalisation
                let unfilteredContours   = [];       // Temporary storage for size-filtered contours

                // Process each contour found in the image
                for (let i = 0; i < rawContourCount; ++i) {
                    const contour = tempContours.get(i);
                    if (!contour || contour.rows < 3) {
                        contour?.delete(); 
                        continue;
                    }

                    const rect = cv.boundingRect(contour);
                    if (rect.width < minWidthPixels || rect.height < minHeightPixels) {
                        rejectedByMinSize++; contour.delete(); continue;
                    }
                    if (rect.width > maxWidthPixels || rect.height > maxHeightPixels) {
                        rejectedByMaxSize++; contour.delete(); continue;
                    }

                    // Extract points
                    let initialPoints = [];
                    for (let j = 0; j < contour.rows; ++j) {
                        initialPoints.push({ x: contour.data32S[j * 2], y: contour.data32S[j * 2 + 1] });
                    }

                    let processedPoints = initialPoints; // Default to initial


                    // FEATURE |  ORTHOGONAL BIAS - TECHNICAL NOTES                
                    // ----------------------------------------------------------------------------------
                    // - Forces detection to prioritize horizontal/vertical paths (X/Y axes) over organic/diagonal paths
                    // - Higher bias % = stricter enforcement of orthogonal (right-angle) path segments
                    // - Helps trace rectangular architectural elements (windows, doors) with cleaner straight edges
                    // - Implements corner detection for right-angle transitions (80°-100° tolerance)
                    // - Reduces detection errors from watercolor/reflection details in architectural drawings
                    // - Prevents jagged edges by snapping segments to horizontal or vertical alignment
                    // - Makes polygon generation more suitable for CAD-ready architectural element extraction
                    // - Separate from simplified detection, allows precision when needed
                    // - Only activates when bias slider > 0%, preserving ability to trace organic shapes
                    // - Improves detection for square/rectangular elements which predominate in architecture

                    if (angleTolerance > 0 && initialPoints.length >= 3) {
                        orthogonalizedCount++; // Count attempt
                        // console.log(`[Detect C#${i}] Attempting orthogonalization... Initial:`, JSON.stringify(initialPoints));
                        processedPoints = orthogonalizeContour(initialPoints, angleTolerance, i); // Pass index for logging
                        // console.log(`[Detect C#${i}] Orthogonalization returned:`, JSON.stringify(processedPoints));

                        // --- Comparison for Change Detection ---
                        const initialPointsStr = JSON.stringify(initialPoints);
                        const processedPointsStr = JSON.stringify(processedPoints);
                        if (processedPointsStr !== initialPointsStr) {
                             if (i % 50 === 0) { // Log change detection sporadically to reduce console noise
                                console.log(`[Detect C#${i}] Change DETECTED.`);
                             }
                            actuallyChangedCount++;
                        } else {
                             // if (i % 50 === 0) { // Log no change sporadically
                             //   console.log(`[Detect C#${i}] No change detected by string comparison.`);
                             // }
                        }
                    }

                    // Store potentially modified points if still valid
                    if (processedPoints.length >= 3) {
                        unfilteredContours.push(processedPoints);
                        keptRawContours++;
                    } else {
                         console.log(`[Detect C#${i}] Discarded after orthogonalization (too few points: ${processedPoints.length})`);
                    }

                    contour.delete(); // Delete CV Mat
                } // End contour loop
                
                // Apply island unification if enabled
                let finalContours = unfilteredContours;
                let removedByUnification = 0;
                
                if (SharedState.unifyIslands && unfilteredContours.length > 1) {
                    console.log(`[Detect] Unify Islands is ENABLED. Processing ${unfilteredContours.length} contours...`);
                    const unifiedContours = unifyNestedIslands(unfilteredContours);
                    removedByUnification = unfilteredContours.length - unifiedContours.length;
                    finalContours = unifiedContours;
                    console.log(`[Detect] Unification removed ${removedByUnification} nested islands.`);
                } else {
                    console.log(`[Detect] Unify Islands is ${SharedState.unifyIslands ? 'ENABLED but no action needed' : 'DISABLED'}.`);
                }
                
                // Store the final contours to the shared state
                // Can't directly reassign the imported array as it's read-only
                // Instead, modify it in-place
                SharedState.detectionResults.length = 0; // Clear existing results
                for (const contour of finalContours) {
                    SharedState.detectionResults.push(contour); // Add each contour one by one
                }

                // --- Reporting ---
                const endTime = performance.now();
                const duration = ((endTime - startTime) / 1000).toFixed(2);
                console.log(`[Detect] Loop finished. Kept: ${finalContours.length}, Changed by Ortho: ${actuallyChangedCount}/${orthogonalizedCount}`);

                 let statusMsg = `Stage 1 Detection complete in ${duration}s. Found ${finalContours.length} potential elements (out of ${rawContourCount} raw).`;
                 statusMsg += ` Rejected MinSize: ${rejectedByMinSize}, MaxSize: ${rejectedByMaxSize}.`;
                 if (orthogonalBiasPercent > 0) {
                      // Report the count of contours whose points were actually changed
                     statusMsg += ` Orthogonal bias (${orthogonalBiasPercent}%) applied, modifying ${actuallyChangedCount}/${orthogonalizedCount} contours.`;
                 }
                 if (SharedState.unifyIslands && removedByUnification > 0) {
                     statusMsg += ` Unified ${removedByUnification} nested islands.`;
                 }
                 statusMsg += ` Ready for Stage 2 Refinement.`;

                if (finalContours.length > 0) {
                    SharedState.showStatus(statusMsg);
                } else {
                    // Simplified message for brevity
                    SharedState.showStatus(`Stage 1 Detection complete in ${duration}s. No potential elements found. Rejected Min/Max: ${rejectedByMinSize}/${rejectedByMaxSize}.`, false, true);
                }
                 console.log("--- detectElements END ---");
                resolve(finalContours.length > 0);

            } catch (err) {
                 console.error("[Detect] Error in detectElements:", err); // Log error
                SharedState.showStatus(`Error during Stage 1 Detection: ${err.message}`, true);
                 console.log("--- detectElements END (Error) ---");
                reject(err);

            } finally {
                // --- Cleanup ---
                tempInput?.delete();
                tempGray?.delete();
                tempCanny?.delete();
                tempContours?.delete();
                tempHierarchy?.delete();
                kernel?.delete();
                 console.log("[Detect] Cleanup finished.");
            }
        }, 10); // setTimeout
    }); // Promise
}
// End of function



//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   . 


// FUNCTION |  UNIFY NESTED ISLANDS FUNCTION
// ----------------------------------------------------------------------------------
// DESCRIPTION
// - Unifies nested islands by absorbing smaller contours inside larger ones
// - Detects when a contour is completely contained within another
// - Helps eliminate duplicate detections caused by reflections/shadows in drawings
// - Prevents smaller details from creating multiple overlapping elements

function unifyNestedIslands(contours) {
    if (!contours || contours.length < 2) return contours;
    
    console.log(`[UnifyIslands] Processing ${contours.length} contours for unification`);
    
    // 1. First calculate bounding boxes for all contours for faster containment testing
    const contoursWithBounds = contours.map(points => {
        // Find min/max x,y to create bounding box
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        
        for (const pt of points) {
            minX = Math.min(minX, pt.x);
            minY = Math.min(minY, pt.y);
            maxX = Math.max(maxX, pt.x);
            maxY = Math.max(maxY, pt.y);
        }
        
        return {
            points,
            bounds: {minX, minY, maxX, maxY},
            area: (maxX - minX) * (maxY - minY)
        };
    });
    
    // 2. Sort by area (largest first) to simplify the containment checks
    contoursWithBounds.sort((a, b) => b.area - a.area);
    
    // 3. Mark contours that should be eliminated (absorbed into larger ones)
    const shouldEliminate = new Array(contoursWithBounds.length).fill(false);
    let eliminatedCount = 0;
    
    // For each contour (except the last one as it's the smallest)
    for (let i = 0; i < contoursWithBounds.length - 1; i++) {
        // Skip if this contour has already been marked for elimination
        if (shouldEliminate[i]) continue;
        
        const outerContour = contoursWithBounds[i];
        
        // Check all smaller contours
        for (let j = i + 1; j < contoursWithBounds.length; j++) {
            // Skip if already marked
            if (shouldEliminate[j]) continue;
            
            const innerContour = contoursWithBounds[j];
            
            // Quick check: if the inner contour's bounds are outside the outer contour's bounds, 
            // it cannot be contained
            if (innerContour.bounds.minX < outerContour.bounds.minX ||
                innerContour.bounds.minY < outerContour.bounds.minY ||
                innerContour.bounds.maxX > outerContour.bounds.maxX ||
                innerContour.bounds.maxY > outerContour.bounds.maxY) {
                continue;
            }
            
            // More accurate check: test if all points of the inner contour are inside the outer contour
            // Use the point-in-polygon algorithm
            let allPointsInside = true;
            for (const pt of innerContour.points) {
                if (!isPointInPolygon(pt, outerContour.points)) {
                    allPointsInside = false;
                    break;
                }
            }
            
            if (allPointsInside) {
                shouldEliminate[j] = true;
                eliminatedCount++;
                console.log(`[UnifyIslands] Contour #${j} will be absorbed into larger contour #${i}`);
            }
        }
    }
    
    // 4. Return only the contours that were not eliminated
    const unifiedContours = contoursWithBounds
        .filter((_, index) => !shouldEliminate[index])
        .map(c => c.points);
    
    console.log(`[UnifyIslands] Eliminated ${eliminatedCount} nested contours. Kept ${unifiedContours.length} unified contours.`);
    return unifiedContours;
}
// End of function

//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   . 

// HELPER FUNCTION |  POINT IN POLYGON HELPER FUNCTION
// ----------------------------------------------------------------------------
// - Tests if a point is inside a polygon using the ray casting algorithm

function isPointInPolygon(point, polygon) {
    let inside = false;
    const x = point.x;
    const y = point.y;
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;
        
        const intersect = ((yi > y) !== (yj > y)) && 
                          (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    
    return inside;
}
// End of function

//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   . 



// ============================================================================
// KEY SECOND STAGE - POLYGON REFINEMENT PIPELINE
// ============================================================================
//
// PROCESS & REFINEMENTS TO GEOMETRY FOR EXPORT
// - This step takes the input from The detection.
// - The has a secondary  set of of tools allowing users to interpolate and further refine the geometry.
// - This ensure the final shapes are more structured and the normalised geometry.
// - This removes any inconsistencies from the first initial detection stage.
// - This ensures the geometry is ready for a CAD environment.
//
// DATA FLOW DESIGN 
// - This stage is designed to take the Filtered Detection Results
// - This EXPLICITLY iterates over what Stage 1 produced and stored in `SharedState.detectionResults`
// - So to clarify and confirm . . . .
//     - **The script does not revert to some raw, unfiltered data from before detection.**
// - It works directly with the same set of contours the user sees on the "Detection Layer" preview.
//
// SHAPE SIMPLIFICATION MODIFIER 
// ----------------------------------------------------------------------------------
// - Reduces the number of vertices in detected shapes to create cleaner, more efficient geometry
// - Preserves key corner vertices while eliminating redundant points along linear paths
// - Values represent maximum deviation tolerance in mm from original shape
// - Higher values (10-20mm) produce more aggressive simplification for schematic/concept drawings
// - Lower values (1-5mm) maintain higher fidelity for detailed architectural elements
// - Intelligently identifies and preserves architectural corners even during simplification
// - Improves CAD software compatibility by reducing unnecessary points and file size
// - Enhances visual clarity by producing smoother, more regular shapes
// - Acts as the second-to-last modifier before final grid snapping
// - Particularly useful for faceted curves which often contain unnecessary vertex density

// GRID SNAPPING MODIFIER
// ----------------------------------------------------------------------------------
// - The final step in the pipeline is a final process that forces the vertexes of the final object to coordinates
// - The application initially asks the user for a size input, this dictates the global units and build a grid
// - These mm's are the grid-space referenced, when the user moves the slider this dictates the grid snapped to
// - This feature is designed to ensure that all corner vertexes are snapped to whole numbers like would be the case
//   in CAD Software where architecture dimensions are normally rounded to 5mm / 10mm / 20mm as dictated by the 
//   accuracy required on the users project.
// - CRITICAL NOTE |  This modifier should be the final pass applied to the geometry and serves as a correction.
// - For clarity; its not designed to brute force Orthagonal alignment, instead to round vertex x / y positions.

//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   . 


// FUNCTION |  Refine detected elements into CAD-ready polygons
// ----------------------------------------------------------------------------------
// - Transforms raw detected contours into clean, usable geometric shapes
// - Applies smoothing, simplification, and snapping operations
// - Provides precise control over output geometry quality

function generatePolygons() {
    // Checks moved to Core App Logic button handler
    SharedState.showStatus("Running Stage 2: Polygon Refinement...", false, true);

    // Use setTimeout to allow UI update before blocking thread
    return new Promise((resolve, reject) => { // Return a promise
        setTimeout(() => {
            try {
                const startTime = performance.now();

                // 1. Get Parameters for POLYGON stage from imported elements
                // Update to ensure we get a small value suitable for mm
                // Use slider value directly as mm for better user understanding 
                const epsilonSliderValue = parseInt(SharedState.sliders.epsilon.value);
                // The display value should be in mm for clarity
                const epsilonMm = epsilonSliderValue / 10; // Scale to reasonable mm range (0.1mm to 10mm)
                const snapGridSizeMm = parseInt(SharedState.sliders.snapGridSize.value);
                const snapGridSizePixels = snapGridSizeMm > 0 ? snapGridSizeMm * SharedState.pixelsPerMm : 0; // Handle 0 grid size
                const straightnessThreshold = parseFloat(SharedState.valueDisplays.straightnessThreshold.textContent); // Get scaled value from display
                const minWidthMm = parseInt(SharedState.sliders.minWidth.value); // Final Min/Max
                const minHeightMm = parseInt(SharedState.sliders.minHeight.value);
                const maxWidthMm = parseFloat(SharedState.sliders.maxWidth.value);
                const maxHeightMm = parseFloat(SharedState.sliders.maxHeight.value);
                const minWidthPixels = minWidthMm * SharedState.pixelsPerMm;
                const minHeightPixels = minHeightMm * SharedState.pixelsPerMm;
                const maxWidthPixels = maxWidthMm * SharedState.pixelsPerMm;
                const maxHeightPixels = maxHeightMm * SharedState.pixelsPerMm;
                const bridgeVerticesThresholdMm = parseInt(SharedState.sliders.bridgeVerticesThreshold.value);
                const bridgeVerticesThresholdPixels = bridgeVerticesThresholdMm * SharedState.pixelsPerMm;
                const closeCornersThresholdMm = parseInt(SharedState.sliders.closeCornersThreshold.value);
                const closeCornersThresholdPixels = closeCornersThresholdMm * SharedState.pixelsPerMm;
                // Convert epsilon from mm to pixels for shape simplification
                const epsilonPixels = epsilonMm * SharedState.pixelsPerMm;

                if (verboseLogging) {
                    console.log(`[Polygons] Parameters - snapGridSize: ${snapGridSizeMm}mm (${snapGridSizePixels.toFixed(2)}px), ` +
                               `simplification: ${epsilonMm.toFixed(1)}mm (${epsilonPixels.toFixed(2)}px), straightness: ${straightnessThreshold}`);
                    console.log(`[Polygons] Scale factor: ${SharedState.pixelsPerMm.toFixed(3)} pixels/mm`);
                }

                SharedState.polygons.length = 0; // Clear shared polygon results array

                // --- Process Detected Contours (from imported detectionResults) ---
                let processedCount = 0;
                let rejectedBySize = 0;
                let rejectedByStraightness = 0;
                let rejectedByVertices = 0;
                let confirmedElements = 0;
                let bridgedVerticesCount = 0; // Track how many contours bridging was applied to
                let closedCornersCount = 0; // Track how many contours corner closing was applied to
                let snappedContourCount = 0; // Track how many contours were grid-snapped
                let simplifiedContourCount = 0; // Track how many contours were simplified

                for (const rawPoints of SharedState.detectionResults) { // Input here is potentially orthogonalized
                    if (rawPoints.length < 3) continue;
                    processedCount++;

                    let contourMat = null;
                    let approx = null;
                    let currentMat = null; // Define here for broader scope in finally

                    try {
                        // Clone the points array to avoid modifying the original Stage 1 results
                        let points = JSON.parse(JSON.stringify(rawPoints));
                        let didBridge = false;
                        let didCloseCorners = false;

                        // 1. Bridge Vertices if threshold > 0
                        if (bridgeVerticesThresholdPixels > 0) {
                            const originalLength = points.length;
                            points = bridgeVertices(points, bridgeVerticesThresholdPixels);
                             if (points.length !== originalLength) didBridge = true; // Track if bridging changed the points
                        }

                        // 2. Close Corners if threshold > 0
                        if (closeCornersThresholdPixels > 0) {
                             const originalPointsJSON = JSON.stringify(points); // Store original for comparison
                             points = closeCorners(points, closeCornersThresholdPixels);
                             if (JSON.stringify(points) !== originalPointsJSON) didCloseCorners = true; // Track if closing changed points
                        }

                         // Increment counters if operations were performed
                         if (didBridge) bridgedVerticesCount++;
                         if (didCloseCorners) closedCornersCount++;

                        // Convert point array to cv.Mat for processing
                        // Make sure we still have enough points after bridging/closing
                        if (points.length < 3) {
                             rejectedByVertices++; continue;
                        }
                        contourMat = new cv.Mat(points.length, 1, cv.CV_32SC2);
                        for (let j = 0; j < points.length; j++) {
                            contourMat.data32S[j * 2] = points[j].x;
                            contourMat.data32S[j * 2 + 1] = points[j].y;
                        }

                        currentMat = contourMat; // Start with the mat from points

                        // 3. Size filtering (done directly on the contour)
                        const rect = cv.boundingRect(currentMat);
                        if (rect.width < minWidthPixels || rect.height < minHeightPixels ||
                            rect.width > maxWidthPixels || rect.height > maxHeightPixels) {
                            rejectedBySize++; continue;
                        }

                        // 4. Straightness/solidity filtering
                        const areaPixels = cv.contourArea(currentMat);
                        const boundingBoxArea = rect.width * rect.height;
                        const solidity = boundingBoxArea > 0 ? Math.abs(areaPixels) / boundingBoxArea : 0;
                        if (solidity < straightnessThreshold) {
                            rejectedByStraightness++; continue;
                        }

                        // Extract points after filtering for shape simplification
                        let filteredPoints = [];
                        for (let j = 0; j < currentMat.rows; ++j) {
                            filteredPoints.push({ 
                                x: currentMat.data32S[j * 2], 
                                y: currentMat.data32S[j * 2 + 1] 
                            });
                        }

                        // 5. Shape Simplification (NEW APPROACH - right before grid snapping)
                        // Only apply if epsilon is greater than 0 and we have enough points
                        let finalPoints = [...filteredPoints]; // Default to filtered points
                        
                        if (epsilonPixels > 0 && filteredPoints.length > 3) {
                            // Store original points for logging
                            const preSimplifyPoints = [...filteredPoints];
                            
                            // NEW IMPLEMENTATION: Use a more conservative approach to simplification
                            // that preserves important corner vertices while removing redundant points
                            if (epsilonPixels >= 1.0) { // Only apply if epsilon is meaningful
                                let simplifiedPoints = simplifyPolyline(filteredPoints, epsilonPixels);
                                
                                // Only use the simplified points if we still have enough vertices
                                if (simplifiedPoints.length >= 3) {
                                    finalPoints = simplifiedPoints;
                                    simplifiedContourCount++;
                                    
                                    if (verboseLogging) {
                                        // Log simplification results for monitoring
                                        if (processedCount % 10 === 0) {
                                            const reductionPercent = ((preSimplifyPoints.length - simplifiedPoints.length) / preSimplifyPoints.length * 100).toFixed(1);
                                            console.log(`[Polygons] Shape simplification (element #${processedCount}): ` +
                                                `Reduced from ${preSimplifyPoints.length} to ${simplifiedPoints.length} points (${reductionPercent}% reduction)`);
                                            console.log(`  Epsilon: ${epsilonMm.toFixed(1)}mm (${epsilonPixels.toFixed(1)}px)`);
                                        }
                                    }
                                } else {
                                    // If simplification created too few points, revert to original points
                                    if (verboseLogging) {
                                        console.log(`[Polygons] Simplification rejected - would create too few points (${simplifiedPoints.length})`);
                                    }
                                }
                            }
                        }

                        // 6. GRID SNAPPING AS FINAL STEP
                        // Apply grid snapping as the very last step (after all other processing)
                        if (snapGridSizePixels > 0 && finalPoints.length >= 3) {
                            const preSnapPoints = [...finalPoints]; // Copy for comparison
                            
                            // Apply snapping to each point
                            for (let j = 0; j < finalPoints.length; j++) {
                                finalPoints[j].x = snapToGrid(finalPoints[j].x, snapGridSizePixels);
                                finalPoints[j].y = snapToGrid(finalPoints[j].y, snapGridSizePixels);
                            }
                            
                            // Remove duplicates that might have been created by snapping
                            let uniquePoints = [];
                            for (let j = 0; j < finalPoints.length; j++) {
                                const pt = finalPoints[j];
                                // Check if this point duplicates the previous one after snapping
                                if (uniquePoints.length === 0 || 
                                    Math.abs(uniquePoints[uniquePoints.length-1].x - pt.x) > 0.5 || 
                                    Math.abs(uniquePoints[uniquePoints.length-1].y - pt.y) > 0.5) {
                                    uniquePoints.push(pt);
                                }
                            }
                            
                            // Check if last point duplicates first after snapping and remove if needed
                            if (uniquePoints.length > 1 && 
                                Math.abs(uniquePoints[0].x - uniquePoints[uniquePoints.length-1].x) < 0.5 && 
                                Math.abs(uniquePoints[0].y - uniquePoints[uniquePoints.length-1].y) < 0.5) {
                                uniquePoints.pop();
                            }
                            
                            // Only use the snapped points if we still have enough vertices
                            if (uniquePoints.length >= 3) {
                                finalPoints = uniquePoints;
                                snappedContourCount++;
                                
                                if (verboseLogging) {
                                    // Log a sample of how points changed
                                    if (processedCount % 10 === 0) {
                                        console.log(`[Polygons] Grid snapping example (element #${processedCount}):`);
                                        const samplePoint = Math.min(2, finalPoints.length-1);
                                        console.log(`  Before: (${preSnapPoints[samplePoint].x.toFixed(1)}, ${preSnapPoints[samplePoint].y.toFixed(1)})`);
                                        console.log(`  After:  (${finalPoints[samplePoint].x.toFixed(1)}, ${finalPoints[samplePoint].y.toFixed(1)})`);
                                        console.log(`  Grid size: ${snapGridSizePixels.toFixed(1)}px`);
                                    }
                                }
                            } else {
                                // If snapping created too few points (e.g., all points snapped to same location)
                                // revert to pre-snap points
                                finalPoints = preSnapPoints;
                                if (verboseLogging) {
                                    console.log(`[Polygons] Grid snapping rejected - would create too few points (${uniquePoints.length})`);
                                }
                            }
                        }

                        // Final check on vertex count after all processing
                        if (finalPoints.length >= 3) {
                            SharedState.polygons.push(finalPoints); // Modify imported array
                            confirmedElements++;
                        } else {
                            rejectedByVertices++;
                        }

                    } finally {
                        // Clean up Mats created inside the loop for this contour
                        currentMat?.delete(); // Deletes whichever Mat currentMat points to
                        approx?.delete();

                        // Nullify to prevent accidental reuse
                        contourMat = null;
                        approx = null;
                        currentMat = null;
                    }
                } // End loop

                const endTime = performance.now();
                const duration = ((endTime - startTime) / 1000).toFixed(2);

                // --- Report Status (via imported function) including bridge/corner operations ---
                let statusMessage = '';
                if (confirmedElements > 0) {
                    statusMessage = `Stage 2 Refinement complete in ${duration}s. Generated ${confirmedElements} CAD Polygons.`;
                    if (bridgedVerticesCount > 0) statusMessage += ` Applied bridging to ${bridgedVerticesCount} contours.`;
                    if (closedCornersCount > 0) statusMessage += ` Applied corner closing to ${closedCornersCount} contours.`;
                    if (simplifiedContourCount > 0) statusMessage += ` Applied shape simplification (${epsilonMm.toFixed(1)}mm) to ${simplifiedContourCount} elements.`;
                    if (snappedContourCount > 0) statusMessage += ` Applied grid snapping (${snapGridSizeMm}mm) to ${snappedContourCount} elements.`;
                    statusMessage += ` Rejected - Size: ${rejectedBySize}, Straightness: ${rejectedByStraightness}, Vertices: ${rejectedByVertices}.`;
                    SharedState.showStatus(statusMessage);
                } else {
                    statusMessage = `Stage 2 Refinement complete in ${duration}s. No polygons met the final criteria. Try adjusting Polygon Manipulator settings.`;
                     if (bridgedVerticesCount > 0) statusMessage += ` Applied bridging to ${bridgedVerticesCount} contours.`;
                    if (closedCornersCount > 0) statusMessage += ` Applied corner closing to ${closedCornersCount} contours.`;
                    if (simplifiedContourCount > 0) statusMessage += ` Shape simplification (${epsilonMm.toFixed(1)}mm) was applied to ${simplifiedContourCount} elements.`;
                    if (snappedContourCount > 0) statusMessage += ` Grid snapping (${snapGridSizeMm}mm) was active but no final elements passed filters.`;
                    statusMessage += ` Rejected - Size: ${rejectedBySize}, Straightness: ${rejectedByStraightness}, Vertices: ${rejectedByVertices}.`;
                    SharedState.showStatus(statusMessage, false, true);
                }

                resolve(confirmedElements > 0); // Resolve promise indicating if results were found

            } catch (err) {
                SharedState.showStatus(`Error during Stage 2 Polygon Generation: ${err.message}`, true);
                console.error("Polygon Generation Error:", err);
                reject(err); // Reject promise on error
            }
            // No finally block needed here as loop handles internal Mat cleanup
        }, 10); // 10ms timeout
    });
}

// FUNCTION |  Bridge closely spaced vertices to simplify contours
// ----------------------------------------------------------------------------------
// - Connects nearby vertices that fall within a specified threshold distance
// - Helps complete shapes from broken or interrupted edge detections
// - Simplifies complex shapes by removing redundant or noise-induced vertices
function bridgeVertices(points, thresholdPixels) {
    if (thresholdPixels <= 0 || points.length < 3) return points;

    // Make a copy of the points array
    let result = [...points];
    let changed = true;
    const maxIterations = result.length; // Limit iterations to prevent infinite loops in complex cases
    let iterations = 0;

    while (changed && iterations < maxIterations) {
        changed = false;
        iterations++;
        let currentLength = result.length; // Length at the start of this pass

        for (let i = 0; i < currentLength; i++) {
            // J starts from i+2 to avoid adjacent points and self-comparison
            // Modulo is used to wrap around for closed polygons
            for (let j_offset = 2; j_offset < currentLength - 1; j_offset++) { // Check up to n-2 points away
                 const j = (i + j_offset) % currentLength;

                 // Check for valid indices after potential modifications in previous loops
                 if (i >= result.length || j >= result.length || i === j) continue;

                const p1 = result[i];
                const p2 = result[j];
                if (!p1 || !p2) continue; // Safety check

                const distance = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));

                if (distance < thresholdPixels) {
                    // Found points to bridge. Remove the points *between* i and j.
                    // Need to handle wrapping around the array.
                    let pointsToRemoveIndices = [];
                    if (i < j) {
                        // Simple case: remove i+1 to j-1
                        for (let k = i + 1; k < j; k++) {
                            pointsToRemoveIndices.push(k);
                        }
                    } else { // Wrap-around case: j < i
                        // Remove i+1 to end of array, and 0 to j-1
                        for (let k = i + 1; k < currentLength; k++) {
                            pointsToRemoveIndices.push(k);
                        }
                        for (let k = 0; k < j; k++) {
                            pointsToRemoveIndices.push(k);
                        }
                    }

                    // Sort indices in descending order for safe splicing
                    pointsToRemoveIndices.sort((a, b) => b - a);

                    // Splice out the points
                    for (const index of pointsToRemoveIndices) {
                         // Check index validity again before splicing, as array length changes
                         if (index < result.length) {
                            result.splice(index, 1);
                         }
                    }

                    changed = true;
                    // Restart the checks from the beginning after a modification
                    currentLength = result.length; // Update length
                    i = -1; // Restart outer loop
                    break; // Exit inner loop (j_offset loop)
                }
            } // End inner loop (j_offset)
             if (changed) break; // Exit outer loop (i) if a change was made to restart
        } // End outer loop (i)
    } // End while loop

    // Final check for degenerate polygons
    return result.length >= 3 ? result : points;
}
// End of function

//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   . 

// FUNCTION |  Close near-perpendicular corners to improve shape quality
// ----------------------------------------------------------------------------------
// - Identifies potential corners where lines are nearly perpendicular
// - Adjusts vertex positions to create clean 90-degree corners
// - Improves architectural element recognition by enforcing right angles
function closeCorners(points, thresholdPixels) {
    if (thresholdPixels <= 0 || points.length < 3) return points;

    let result = [...points]; // Work on a copy
    const n = result.length;
    let changed = false; // Track if any corner was adjusted

    for (let i = 0; i < n; i++) {
        // Get previous, current, and next points with wrap-around
        const p_prev = result[(i + n - 1) % n];
        const p_curr = result[i];
        const p_next = result[(i + 1) % n];

        // Vectors from current point
        const v_prev = { x: p_prev.x - p_curr.x, y: p_prev.y - p_curr.y };
        const v_next = { x: p_next.x - p_curr.x, y: p_next.y - p_curr.y };

        // Calculate lengths
        const len_prev = Math.sqrt(v_prev.x * v_prev.x + v_prev.y * v_prev.y);
        const len_next = Math.sqrt(v_next.x * v_next.x + v_next.y * v_next.y);

        // Check if segments are reasonably long enough and within the threshold
        if (len_prev > 1e-6 && len_prev < thresholdPixels &&
            len_next > 1e-6 && len_next < thresholdPixels)
        {
            // Normalize vectors
            const v_prev_norm = { x: v_prev.x / len_prev, y: v_prev.y / len_prev };
            const v_next_norm = { x: v_next.x / len_next, y: v_next.y / len_next };

            // Calculate dot product. Close to 0 means near 90 degrees.
            const dotProduct = v_prev_norm.x * v_next_norm.x + v_prev_norm.y * v_next_norm.y;

            // Define a tolerance for perpendicularity (e.g., cos(80deg) ~ 0.17, cos(100deg) ~ -0.17)
            // Allow angles between ~80 and ~100 degrees.
            const perpendicularityTolerance = 0.18;
            if (Math.abs(dotProduct) < perpendicularityTolerance) {
                // Potential corner found! Adjust p_curr to the theoretical intersection
                // A simple approximation:
                // If prev-curr is mostly horizontal & curr-next is mostly vertical -> corner is (p_next.x, p_prev.y)
                // If prev-curr is mostly vertical & curr-next is mostly horizontal -> corner is (p_prev.x, p_next.y)

                const isPrevHorizontal = Math.abs(v_prev_norm.x) > Math.abs(v_prev_norm.y);
                const isPrevVertical = !isPrevHorizontal;
                const isNextHorizontal = Math.abs(v_next_norm.x) > Math.abs(v_next_norm.y);
                const isNextVertical = !isNextHorizontal;

                let cornerX = p_curr.x; // Default to current
                let cornerY = p_curr.y;

                if (isPrevHorizontal && isNextVertical) {
                    cornerX = p_next.x;
                    cornerY = p_prev.y;
                } else if (isPrevVertical && isNextHorizontal) {
                    cornerX = p_prev.x;
                    cornerY = p_next.y;
                }
                 // Add other potential combinations or a more robust intersection calculation if needed
                 // For now, we only adjust the most common right-angle cases

                // Update the point in the result array if it's different
                 if (Math.abs(cornerX - p_curr.x) > 0.5 || Math.abs(cornerY - p_curr.y) > 0.5) {
                    result[i] = { x: cornerX, y: cornerY };
                    changed = true;
                 }
            }
        }
    }

    // Optional: Cleanup duplicate points if changes were made
    if (changed) {
        let cleanedPoints = [];
        if (result.length > 0) {
            cleanedPoints.push(result[0]);
            for (let i = 1; i < result.length; i++) {
                 const lastCleaned = cleanedPoints[cleanedPoints.length - 1];
                 const current = result[i];
                 if (Math.abs(current.x - lastCleaned.x) > 0.5 || Math.abs(current.y - lastCleaned.y) > 0.5) {
                    cleanedPoints.push(current);
                 }
            }
            if (cleanedPoints.length > 1) {
                 const firstCleaned = cleanedPoints[0];
                 const lastCleaned = cleanedPoints[cleanedPoints.length - 1];
                 if (Math.abs(firstCleaned.x - lastCleaned.x) < 0.5 && Math.abs(firstCleaned.y - lastCleaned.y) < 0.5) {
                    cleanedPoints.pop();
                 }
            }
        }
        // Return cleaned points only if still valid
        return cleanedPoints.length >= 3 ? cleanedPoints : points; // Fallback to original
    } else {
        return points; // No changes made
    }
}
// End of function

//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   . 


// ==================================================================================
// HELPER FUNCTIONS LIBRARY
// ===================================================================================


// FUNCTION |  Snap coordinate to grid
// ----------------------------------------------------------------------------------
// - Aligns a coordinate value to the nearest grid line
// - Used for polygon refinement during snapping operations
function snapToGrid(value, gridSize) {
    if (gridSize <= 0) return value;
    
    // Improved snapping function with additional validation
    // Round to nearest grid line position
    const snapped = Math.round(value / gridSize) * gridSize;
    
    // Add a small epsilon to prevent floating point errors
    return parseFloat(snapped.toFixed(1));
}
// End of function

//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .


// ===================================================================================
// MODULE EXPORTS
// ===================================================================================

export {
    detectElements,
    generatePolygons,
};
// End of module exports

//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   . 

// NEW FUNCTION: Improved shape simplification that preserves important corners
// ----------------------------------------------------------------------------------
// - Uses the Douglas-Peucker algorithm approach but with better corner preservation
// - Maintains key geometry vertices while removing redundant points along linear paths
// - epsilon is the maximum distance (in pixels) between the original line and the simplified one
function simplifyPolyline(points, epsilonPixels) {
    if (points.length <= 3 || epsilonPixels <= 0) return points;
    
    // Limit epsilon to prevent excessive simplification
    const maxEpsilon = 50 * SharedState.pixelsPerMm; // Max 50mm
    epsilonPixels = Math.min(epsilonPixels, maxEpsilon);
    
    if (verboseLogging) {
        console.log(`[Simplify] Starting with ${points.length} points, epsilon: ${epsilonPixels.toFixed(1)}px`);
    }
    
    // Helper function to calculate squared distance from point to line segment
    function sqDistToSegment(p, p1, p2) {
        let x = p1.x;
        let y = p1.y;
        let dx = p2.x - x;
        let dy = p2.y - y;
        
        if (dx !== 0 || dy !== 0) {
            const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
            
            if (t > 1) {
                x = p2.x;
                y = p2.y;
            } else if (t > 0) {
                x += dx * t;
                y += dy * t;
            }
        }
        
        dx = p.x - x;
        dy = p.y - y;
        
        return dx * dx + dy * dy;
    }
    
    // Helper function to check if a point forms a significant corner
    function isCornerPoint(prev, curr, next) {
        // Calculate vectors from current point to neighbors
        const v1 = {
            x: prev.x - curr.x,
            y: prev.y - curr.y
        };
        const v2 = {
            x: next.x - curr.x,
            y: next.y - curr.y
        };
        
        // Calculate dot product and normalize
        const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
        const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
        
        if (len1 > 0 && len2 > 0) {
            const dot = (v1.x * v2.x + v1.y * v2.y) / (len1 * len2);
            // If angle is greater than ~30 degrees, consider it a corner
            return dot < 0.866; // cos(30°) ≈ 0.866
        }
        return false;
    }
    
    // NON-RECURSIVE implementation of Douglas-Peucker with corner preservation
    function simplifyDP(pointList, epsilon) {
        const sqEpsilon = epsilon * epsilon;
        const n = pointList.length;
        if (n <= 2) return [...pointList]; // Need at least 3 points to simplify
        
        // Mark points to keep (always keep first and last)
        const marked = new Array(n).fill(false);
        marked[0] = marked[n-1] = true;
        
        // Also pre-mark corner points to preserve them
        for (let i = 1; i < n-1; i++) {
            if (isCornerPoint(pointList[i-1], pointList[i], pointList[i+1])) {
                marked[i] = true;
            }
        }
        
        // Use a stack instead of recursion
        const stack = [[0, n-1]]; // Push start and end indices
        
        while (stack.length > 0) {
            const [start, end] = stack.pop();
            
            // Find point with max distance in this segment
            let maxDist = 0;
            let maxIdx = 0;
            
            for (let i = start + 1; i < end; i++) {
                if (!marked[i]) { // Only consider unmarked points
                    const dist = sqDistToSegment(pointList[i], pointList[start], pointList[end]);
                    if (dist > maxDist) {
                        maxDist = dist;
                        maxIdx = i;
                    }
                }
            }
            
            // If max distance > epsilon, mark the point and recurse
            if (maxDist > sqEpsilon) {
                marked[maxIdx] = true;
                
                // Push both segments onto stack
                stack.push([start, maxIdx]);
                stack.push([maxIdx, end]);
            }
            
            // If stack gets too big, break to prevent issues
            if (stack.length > 1000) {
                console.warn("Simplification stack too large, breaking early");
                break;
            }
        }
        
        // Create result with only marked points
        const result = [];
        for (let i = 0; i < n; i++) {
            if (marked[i]) {
                result.push(pointList[i]);
            }
        }
        
        return result;
    }
    
    // Handle closed polygons (first and last points are the same)
    const isClosed = points.length > 1 && 
                     Math.abs(points[0].x - points[points.length-1].x) < 0.5 && 
                     Math.abs(points[0].y - points[points.length-1].y) < 0.5;
    
    let result;
    
    if (isClosed) {
        // For closed polygons, ensure we close the result
        const simplified = simplifyDP(points, epsilonPixels);
        
        // Ensure first and last point are identical to close the polygon
        if (simplified.length > 1 && 
            (Math.abs(simplified[0].x - simplified[simplified.length-1].x) > 0.5 || 
             Math.abs(simplified[0].y - simplified[simplified.length-1].y) > 0.5)) {
            simplified.push({x: simplified[0].x, y: simplified[0].y});
        }
        
        result = simplified;
    } else {
        // For open polylines, just apply the algorithm
        result = simplifyDP(points, epsilonPixels);
    }
    
    if (verboseLogging) {
        console.log(`[Simplify] Finished with ${result.length} points, reduction: ${((points.length - result.length) / points.length * 100).toFixed(1)}%`);
    }
    
    return result;
}

