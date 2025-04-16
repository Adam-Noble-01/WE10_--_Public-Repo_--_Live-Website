/* =============================================================================
   BEF_-_Detection-Logic.js | Elevation Polygon Detector Application
   - Contains image processing and detection logic (Stages 1 & 2)
   - Separated from core UI/App logic for maintainability.
   ========================================================================== */

// --- Imports from Shared State ---
import * as SharedState from './BEF_-_Shared-State.js';

// Note: OpenCV (cv) is assumed to be globally available once loaded by Core.

// --- Image Preprocessing ---
function preprocessImage(inputMat) {
    let gray = new cv.Mat();
    let processed = new cv.Mat();
    let enhanced = new cv.Mat();

    try {
        cv.cvtColor(inputMat, gray, cv.COLOR_RGBA2GRAY);

        // 1. Noise Reduction (Subtle Gaussian Blur)
        cv.GaussianBlur(gray, processed, new cv.Size(3, 3), 0, 0, cv.BORDER_DEFAULT);

        // 2. Contrast Enhancement (Blend original with equalized)
        cv.equalizeHist(processed, enhanced);
        // Blend: Adjust weights (e.g., 0.7 original, 0.3 enhanced) for desired effect
        cv.addWeighted(processed, 0.7, enhanced, 0.3, 0, processed);

        return processed; // Return the preprocessed grayscale image

    } catch (err) {
        console.error("Error during preprocessing:", err);
        SharedState.showStatus(`Preprocessing Error: ${err.message}`, true);
        // Return original grayscale if preprocessing fails
        if (gray && !gray.empty()) {
           gray.copyTo(processed); // Copy gray to processed before returning
        } else {
           throw new Error("Cannot create even grayscale image from input."); // Rethrow if gray failed
        }
        return processed;
    } finally {
        // Ensure intermediate Mats are deleted
        // 'processed' is the return value, so it shouldn't be deleted here
        if (gray !== processed) gray.delete(); // Delete gray only if it's different from processed
        enhanced.delete();
    }
}

/* =============================================================================
   STAGE 1: Detect Elements
   - Raw feature detection using Canny edges and basic filtering.
   - Populates the 'detectionResults' array (imported from Core).
   ========================================================================== */
function detectElements() {
    // Checks moved to Core App Logic button handler
    SharedState.showStatus("Running Stage 1: Detection...", false, true);

    // Use setTimeout to allow UI update before blocking thread
    return new Promise((resolve, reject) => { // Return a promise
        setTimeout(() => {
            let tempInput = null;
            let tempGray = null;
            let tempCanny = null;
            let tempContours = null;
            let tempHierarchy = null;
            let kernel = null;

            try {
                const startTime = performance.now();

                // 1. Get Parameters for DETECTION stage from imported sliders
                const cannyThreshold1 = parseInt(SharedState.sliders.cannyThreshold1.value);
                const cannyThreshold2 = parseInt(SharedState.sliders.cannyThreshold2.value);
                const minWidthMm = parseInt(SharedState.sliders.detectMinWidth.value);
                const minHeightMm = parseInt(SharedState.sliders.detectMinHeight.value);
                const minWidthPixels = minWidthMm * SharedState.pixelsPerMm;
                const minHeightPixels = minHeightMm * SharedState.pixelsPerMm;

                // 2. Reset Canvas and Clear Previous Results (Using imported function/arrays)
                SharedState.resetImage(false); // Redraw base image + grid (via Core)
                SharedState.detectionResults.length = 0; // Clear shared array
                SharedState.polygons.length = 0; // Clear shared array

                // 3. OpenCV Operations
                tempInput = cv.imread(SharedState.getCanvas()); // Read from imported canvas
                if (!tempInput || tempInput.empty()) throw new Error('Failed to read image from canvas');

                // --- PREPROCESSING ---
                tempGray = preprocessImage(tempInput);
                if (!tempGray || tempGray.empty()) throw new Error('Preprocessing failed');

                // --- CANNY EDGE DETECTION ---
                tempCanny = new cv.Mat();
                cv.Canny(tempGray, tempCanny, cannyThreshold1, cannyThreshold2, 3, false); // Aperture size 3, no L2 gradient
                if (!tempCanny || tempCanny.empty()) throw new Error('Canny edge detection failed');

                // --- OPTIONAL: Minimal Morphological Closing for edges ---
                kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(2, 2)); // Slightly smaller kernel
                cv.morphologyEx(tempCanny, tempCanny, cv.MORPH_CLOSE, kernel, new cv.Point(-1, -1), 1);

                // --- FIND CONTOURS ---
                tempContours = new cv.MatVector();
                tempHierarchy = new cv.Mat();
                cv.findContours(tempCanny, tempContours, tempHierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

                let rawContourCount = tempContours.size();
                let keptRawContours = 0;

                // --- BASIC FILTERING & STORAGE (into imported detectionResults) ---
                for (let i = 0; i < rawContourCount; ++i) {
                    const contour = tempContours.get(i);
                    if (!contour || contour.rows < 3) {
                        contour?.delete();
                        continue;
                    }

                    const rect = cv.boundingRect(contour);
                    if (rect.width < minWidthPixels || rect.height < minHeightPixels) {
                        contour.delete();
                        continue;
                    }

                    let points = [];
                    for (let j = 0; j < contour.rows; ++j) {
                        points.push({ x: contour.data32S[j * 2], y: contour.data32S[j * 2 + 1] });
                    }
                    if (points.length >= 3) {
                        SharedState.detectionResults.push(points); // Modify imported array
                        keptRawContours++;
                    }

                    contour.delete();
                }

                const endTime = performance.now();
                const duration = ((endTime - startTime) / 1000).toFixed(2);

                // --- Report Status (via imported function) ---
                if (keptRawContours > 0) {
                    SharedState.showStatus(`Stage 1 Detection complete in ${duration}s. Found ${keptRawContours} potential elements (out of ${rawContourCount} raw). Ready for Stage 2 Refinement.`);
                } else {
                    SharedState.showStatus(`Stage 1 Detection complete in ${duration}s. No potential elements found with current detection settings. Try adjusting Edge Sensitivity or Min Detection Size.`, false, true);
                }
                resolve(keptRawContours > 0); // Resolve promise indicating if results were found

            } catch (err) {
                SharedState.showStatus(`Error during Stage 1 Detection: ${err.message}`, true);
                console.error("Detection Error:", err);
                reject(err); // Reject promise on error

            } finally {
                // --- Cleanup CV Mats used in this stage ---
                tempInput?.delete();
                tempGray?.delete();
                tempCanny?.delete();
                tempContours?.delete();
                tempHierarchy?.delete();
                kernel?.delete();
            }
        }, 10); // 10ms timeout
    });
}


/* =============================================================================
   STAGE 2: Generate Polygons
   - Refines contours from 'detectionResults' using simplification, snapping, filtering.
   - Populates the 'polygons' array (imported from Core).
   ========================================================================== */
function generatePolygons() {
    // Checks moved to Core App Logic button handler
    SharedState.showStatus("Running Stage 2: Polygon Refinement...", false, true);

    // Use setTimeout to allow UI update before blocking thread
    return new Promise((resolve, reject) => { // Return a promise
        setTimeout(() => {
            try {
                const startTime = performance.now();

                // 1. Get Parameters for POLYGON stage from imported elements
                const epsilonFactor = parseFloat(SharedState.sliders.epsilon.value) / 1000.0;
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

                // Get the values for the previously unused parameters
                const bridgeVerticesThresholdMm = parseInt(SharedState.sliders.bridgeVerticesThreshold.value);
                const bridgeVerticesThresholdPixels = bridgeVerticesThresholdMm * SharedState.pixelsPerMm;
                const closeCornersThresholdMm = parseInt(SharedState.sliders.closeCornersThreshold.value);
                const closeCornersThresholdPixels = closeCornersThresholdMm * SharedState.pixelsPerMm;

                SharedState.polygons.length = 0; // Clear shared polygon results array

                // --- Process Detected Contours (from imported detectionResults) ---
                let processedCount = 0;
                let rejectedBySize = 0;
                let rejectedByStraightness = 0;
                let rejectedByVertices = 0;
                let confirmedElements = 0;

                // Track bridging and corner closing operations for reporting
                let bridgedVerticesCount = 0;
                let closedCornersCount = 0;

                for (const rawPoints of SharedState.detectionResults) {
                    if (rawPoints.length < 3) continue;
                    processedCount++;

                    let contourMat = null;
                    let approx = null;
                    let snappedMat = null;

                    try {
                        // Clone the points array to avoid modifying the original
                        let points = JSON.parse(JSON.stringify(rawPoints));

                        // 1. Bridge Vertices if threshold > 0
                        if (bridgeVerticesThresholdPixels > 0) {
                            points = bridgeVertices(points, bridgeVerticesThresholdPixels);
                            bridgedVerticesCount++; // Track that we did bridging
                        }

                        // 2. Close Corners if threshold > 0
                        if (closeCornersThresholdPixels > 0) {
                            points = closeCorners(points, closeCornersThresholdPixels);
                            closedCornersCount++; // Track that we did corner closing
                        }

                        // Convert point array to cv.Mat for processing
                        contourMat = new cv.Mat(points.length, 1, cv.CV_32SC2);
                        for (let j = 0; j < points.length; j++) {
                            contourMat.data32S[j * 2] = points[j].x;
                            contourMat.data32S[j * 2 + 1] = points[j].y;
                        }

                        let currentMat = contourMat;

                        // --- Refinement Steps ---
                        // 3. Snapping
                        if (snapGridSizePixels > 0) {
                            let snappedPoints = [];
                            for (let j = 0; j < currentMat.rows; ++j) {
                                const x = snapToGrid(currentMat.data32S[j * 2], snapGridSizePixels);
                                const y = snapToGrid(currentMat.data32S[j * 2 + 1], snapGridSizePixels);
                                if (snappedPoints.length === 0 || snappedPoints[snappedPoints.length - 1].x !== x || snappedPoints[snappedPoints.length - 1].y !== y) {
                                    snappedPoints.push({ x: x, y: y });
                                }
                            }
                            if (snappedPoints.length > 1 && snappedPoints[0].x === snappedPoints[snappedPoints.length - 1].x && snappedPoints[0].y === snappedPoints[snappedPoints.length - 1].y) {
                                snappedPoints.pop();
                            }
                            if (snappedPoints.length >= 3) {
                                snappedMat = new cv.Mat(snappedPoints.length, 1, cv.CV_32SC2);
                                for (let j = 0; j < snappedPoints.length; j++) {
                                    snappedMat.data32S[j * 2] = snappedPoints[j].x;
                                    snappedMat.data32S[j * 2 + 1] = snappedPoints[j].y;
                                }
                                currentMat = snappedMat;
                            } else {
                                rejectedByVertices++; continue;
                            }
                        }

                        // 4. Simplification (ApproxPolyDP)
                        const perimeter = cv.arcLength(currentMat, true);
                        if (perimeter === 0) { rejectedByVertices++; continue; }

                        approx = new cv.Mat();
                        cv.approxPolyDP(currentMat, approx, epsilonFactor * perimeter, true);

                        if (!approx || approx.rows < 3) {
                            rejectedByVertices++; continue;
                        }

                        // 5. Final Filtering (Size, Straightness/Solidity)
                        const rect = cv.boundingRect(approx);
                        const areaPixels = cv.contourArea(approx);

                        if (rect.width < minWidthPixels || rect.height < minHeightPixels ||
                            rect.width > maxWidthPixels || rect.height > maxHeightPixels) {
                            rejectedBySize++; continue;
                        }

                        const boundingBoxArea = rect.width * rect.height;
                        const solidity = boundingBoxArea > 0 ? Math.abs(areaPixels) / boundingBoxArea : 0;
                        if (solidity < straightnessThreshold) {
                            rejectedByStraightness++; continue;
                        }

                        // --- Store Final Polygon (in imported polygons array) ---
                        let finalPoints = [];
                        for (let j = 0; j < approx.rows; ++j) {
                            finalPoints.push({ x: approx.data32S[j * 2], y: approx.data32S[j * 2 + 1] });
                        }
                        if (finalPoints.length >= 3) {
                            SharedState.polygons.push(finalPoints); // Modify imported array
                            confirmedElements++;
                        } else {
                            rejectedByVertices++;
                        }

                    } finally {
                        // Clean up Mats created inside the loop for this contour
                        // contourMat is potentially same as currentMat, snappedMat potentially same as currentMat
                        // Need careful deletion
                        if (snappedMat && snappedMat !== contourMat) snappedMat.delete();
                        contourMat?.delete(); // Original mat
                        approx?.delete();
                        snappedMat = null; // Avoid double delete if error occurred
                        contourMat = null;
                        approx = null;
                    }
                } // End loop

                const endTime = performance.now();
                const duration = ((endTime - startTime) / 1000).toFixed(2);

                // --- Report Status (via imported function) including bridge/corner operations ---
                let statusMessage = '';
                if (confirmedElements > 0) {
                    statusMessage = `Stage 2 Refinement complete in ${duration}s. Generated ${confirmedElements} CAD Polygons.`;
                    if (bridgedVerticesCount > 0) statusMessage += ` Bridged vertices: ${bridgedVerticesCount}.`;
                    if (closedCornersCount > 0) statusMessage += ` Closed corners: ${closedCornersCount}.`;
                    statusMessage += ` Rejected - Size: ${rejectedBySize}, Straightness: ${rejectedByStraightness}, Vertices: ${rejectedByVertices}.`;
                    SharedState.showStatus(statusMessage);
                } else {
                    statusMessage = `Stage 2 Refinement complete in ${duration}s. No polygons met the final criteria. Try adjusting Polygon Manipulator settings.`;
                    if (bridgedVerticesCount > 0) statusMessage += ` Bridged vertices: ${bridgedVerticesCount}.`;
                    if (closedCornersCount > 0) statusMessage += ` Closed corners: ${closedCornersCount}.`;
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

// --- Bridge Vertices Function ---
// Bridges nearby vertices within threshold distance
function bridgeVertices(points, thresholdPixels) {
    if (thresholdPixels <= 0 || points.length < 3) return points;

    // Make a copy of the points array
    let result = [...points];
    let changed = true;
    
    // Continue bridging until no more changes (or max iterations for safety)
    const maxIterations = 10; 
    let iterations = 0;
    
    while (changed && iterations < maxIterations) {
        changed = false;
        iterations++;
        
        // For each pair of points
        for (let i = 0; i < result.length - 1; i++) {
            for (let j = i + 2; j < result.length; j++) { // Skip adjacent points (i+1)
                // Skip if connecting endpoints (would create a new closed shape)
                if ((i === 0 && j === result.length - 1) || (j === 0 && i === result.length - 1)) {
                    continue;
                }
                
                // Calculate distance between points
                const p1 = result[i];
                const p2 = result[j];
                const distance = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
                
                // If points are close enough, connect them by removing points in between
                if (distance < thresholdPixels) {
                    // Decide which section to keep based on which has fewer points
                    if (j - i < result.length - (j - i)) {
                        // Remove points between i and j
                        result.splice(i + 1, j - i - 1);
                    } else {
                        // Remove points from j+1 to end and from 0 to i
                        result.splice(j + 1, result.length - j - 1);
                        result.splice(0, i);
                    }
                    changed = true;
                    break; // Start over with the new point list
                }
            }
            if (changed) break;
        }
    }
    
    return result;
}

// --- Close Corners Function ---
// Detects and closes potential corners based on perpendicular lines within threshold
function closeCorners(points, thresholdPixels) {
    if (thresholdPixels <= 0 || points.length < 3) return points;

    // Make a copy of the points
    let result = [...points];
    
    // Find potential corners
    for (let i = 0; i < result.length; i++) {
        const prev = (i === 0) ? result[result.length - 1] : result[i - 1];
        const current = result[i];
        const next = (i === result.length - 1) ? result[0] : result[i + 1];
        
        // Calculate vectors
        const v1 = { x: current.x - prev.x, y: current.y - prev.y };
        const v2 = { x: next.x - current.x, y: next.y - current.y };
        
        // Normalize vectors
        const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
        const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
        
        if (len1 === 0 || len2 === 0) continue;
        
        v1.x /= len1; v1.y /= len1;
        v2.x /= len2; v2.y /= len2;
        
        // Dot product (close to 0 means perpendicular)
        const dot = v1.x * v2.x + v1.y * v2.y;
        
        // Check if angle is close to 90 degrees (perpendicular)
        if (Math.abs(dot) < 0.3) { // Allow some tolerance, dot product of perpendicular vectors is 0
            // Check if corner needs closing (if it's already sharp, don't modify)
            const distToNext = Math.sqrt(Math.pow(next.x - current.x, 2) + Math.pow(next.y - current.y, 2));
            const distToPrev = Math.sqrt(Math.pow(current.x - prev.x, 2) + Math.pow(current.y - prev.y, 2));
            
            // Only close corners within threshold
            if (distToNext < thresholdPixels && distToPrev < thresholdPixels) {
                // Create a corner point by projecting perpendicular lines
                const cornerX = prev.x + v1.x * distToPrev;
                const cornerY = prev.y + v1.y * distToPrev;
                
                // Update current point to the new corner position
                result[i].x = cornerX;
                result[i].y = cornerY;
            }
        }
    }
    
    return result;
}

// --- Helper Functions ---
function snapToGrid(value, gridSize) {
    // gridSize check happens before calling in generatePolygons
    return Math.round(value / gridSize) * gridSize;
}

// Note: angleBetweenLines and extractPointsFromContour were not used in the final
// logic of the provided monolithic script, so they are omitted here for brevity.
// They could be added back if needed.

// --- Resource Management ---
// No explicit global cleanup needed here as Mats are managed within the functions.
// The Core App Logic handles OpenCV loading/unloading via script tag.

// --- Export processing functions ---
export {
    detectElements,
    generatePolygons,
    // preprocessImage // Export if needed externally, otherwise keep internal
};