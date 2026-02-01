// =============================================================================
// NOBLE ARCHITECTURE - CLOUDFLARE HELPER - PROJECT PATH
// =============================================================================
//
// FILE       : CloudflareHelper__ProjectPath__.js
// NAMESPACE  : CloudflareWorker.Helper.ProjectPath
// MODULE     : ProjectPathHelper
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Resolves project folder paths using R2 listing
// CREATED    : 31-Jan-2026
//
// DESCRIPTION:
// - Finds project folders by project code across all year folders
// - Handles folder naming convention: ProjectCode__ProjectName
// - Caches results to avoid repeated R2 lookups
// - Shared utility for all Cloudflare handlers
// - Supports fallback path construction for new projects
//
// -----
//
// DEVELOPMENT LOG:
// 01-Feb-2026 - Version 1.1.0
// - Added buildProjectFilePathWithFallback()
//   - Constructs path when folder doesn't exist in R2 yet
//   - Uses Flask naming convention: {code}__{projectName.replace(/\s+/g, '')}
//   - Enables saving client data to new projects
//
// 31-Jan-2026 - Version 1.0.0
// - Initial Release
//   - findProjectFolder() with R2 listing
//   - Year auto-detection
//   - Result caching
//
// =============================================================================

// #Region ---
// REGION | Module State
// -----

    // Simple in-memory cache for project paths (cleared on worker restart)
    const projectPathCache       = new Map();

// endregion ----

// #Region ---
// REGION | Main Functions
// -----

    /**
     * Find project folder in R2 by project code
     * Searches across all year folders to find the project
     * 
     * @param {string} projectCode - Project code (e.g., "DR02")
     * @param {Object} env - Environment bindings (R2_BUCKET, R2_PREFIX)
     * @returns {Object|null} { year, folderName, basePath } or null if not found
     */
    export async function findProjectFolder(projectCode, env) {
        if (!env.R2_BUCKET) {
            console.warn('[ProjectPath] R2 bucket not configured');
            return null;
        }

        const code               = projectCode.toUpperCase();
        const prefix             = env.R2_PREFIX || 'NaProjectPortal/';

        // Check cache first
        const cacheKey           = `${prefix}:${code}`;
        if (projectPathCache.has(cacheKey)) {
            console.log(`[ProjectPath] Cache hit for ${code}`);
            return projectPathCache.get(cacheKey);
        }

        // Years to search (most recent first)
        const yearsToSearch      = ['26', '25', '24', '23', '22', '21', '20'];

        for (const year of yearsToSearch) {
            const yearPrefix     = `${prefix}${year}-Projects/${code}`;
            
            try {
                // List objects that start with the project code in this year
                const listed     = await env.R2_BUCKET.list({
                    prefix       : yearPrefix,
                    limit        : 10,
                    delimiter    : '/'
                });

                // Check for matching folders (common prefixes)
                if (listed.delimitedPrefixes && listed.delimitedPrefixes.length > 0) {
                    // Found a folder starting with the project code
                    const folderPath = listed.delimitedPrefixes[0];
                    
                    // Extract folder name from path
                    // Path format: NaProjectPortal/26-Projects/DR02__SilverAvenue/
                    const parts  = folderPath.replace(/\/$/, '').split('/');
                    const folderName = parts[parts.length - 1];

                    const result = {
                        year         : year,
                        folderName   : folderName,
                        basePath     : `${prefix}${year}-Projects/${folderName}/`
                    };

                    // Cache the result
                    projectPathCache.set(cacheKey, result);
                    console.log(`[ProjectPath] Found ${code} -> ${folderName} (${year})`);
                    
                    return result;
                }

                // Also check objects directly (in case delimiter doesn't work as expected)
                if (listed.objects && listed.objects.length > 0) {
                    // Extract folder name from first object's key
                    const firstKey = listed.objects[0].key;
                    const keyParts = firstKey.split('/');
                    
                    // Find the folder part after year-Projects/
                    const yearProjectsIdx = keyParts.findIndex(p => p === `${year}-Projects`);
                    if (yearProjectsIdx >= 0 && keyParts[yearProjectsIdx + 1]) {
                        const folderName = keyParts[yearProjectsIdx + 1];
                        
                        if (folderName.toUpperCase().startsWith(code)) {
                            const result = {
                                year         : year,
                                folderName   : folderName,
                                basePath     : `${prefix}${year}-Projects/${folderName}/`
                            };

                            // Cache the result
                            projectPathCache.set(cacheKey, result);
                            console.log(`[ProjectPath] Found ${code} -> ${folderName} (${year})`);
                            
                            return result;
                        }
                    }
                }

            } catch (error) {
                console.warn(`[ProjectPath] Error searching year ${year}:`, error.message);
                // Continue to next year
            }
        }

        console.warn(`[ProjectPath] Project ${code} not found in any year folder`);
        return null;
    }

    /**
     * Build full path to a file within a project's admin content folder
     * 
     * @param {string} projectCode - Project code (e.g., "DR02")
     * @param {string} filename - File name within 10__ProjectAdmin__AppContent/
     * @param {Object} env - Environment bindings
     * @returns {string|null} Full R2 key path or null if project not found
     */
    export async function buildProjectFilePath(projectCode, filename, env) {
        const projectInfo        = await findProjectFolder(projectCode, env);
        
        if (!projectInfo) {
            return null;
        }

        return `${projectInfo.basePath}10__ProjectAdmin__AppContent/${filename}`;
    }

    /**
     * Build full path to a subfolder within a project's admin content folder
     * 
     * @param {string} projectCode - Project code (e.g., "DR02")
     * @param {string} subfolder - Subfolder path within 10__ProjectAdmin__AppContent/
     * @param {Object} env - Environment bindings
     * @returns {string|null} Full R2 key path or null if project not found
     */
    export async function buildProjectSubfolderPath(projectCode, subfolder, env) {
        const projectInfo        = await findProjectFolder(projectCode, env);
        
        if (!projectInfo) {
            return null;
        }

        // Ensure subfolder doesn't start with /
        const cleanSubfolder     = subfolder.replace(/^\//, '');
        
        return `${projectInfo.basePath}10__ProjectAdmin__AppContent/${cleanSubfolder}`;
    }

    /**
     * Clear the project path cache
     * Useful if projects are renamed or moved
     */
    export function clearCache() {
        projectPathCache.clear();
        console.log('[ProjectPath] Cache cleared');
    }

    /**
     * Get project year from cache or lookup
     * 
     * @param {string} projectCode - Project code
     * @param {Object} env - Environment bindings
     * @returns {string|null} Two-digit year or null
     */
    export async function getProjectYear(projectCode, env) {
        const projectInfo        = await findProjectFolder(projectCode, env);
        return projectInfo?.year || null;
    }

    /**
     * Build full path to a file with fallback for new projects
     * First tries existing folder lookup, then constructs path if year + projectName provided
     * 
     * @param {string} projectCode - Project code (e.g., "NP03")
     * @param {string} filename - File name within 10__ProjectAdmin__AppContent/
     * @param {Object} env - Environment bindings
     * @param {Object} options - Optional parameters
     * @param {string} options.year - Two-digit year (e.g., "26")
     * @param {string} options.projectName - Project name for folder construction
     * @returns {string|null} Full R2 key path or null if cannot be determined
     */
    export async function buildProjectFilePathWithFallback(projectCode, filename, env, options = {}) {
        const { year, projectName } = options;
        
        // First try existing folder lookup
        const projectInfo        = await findProjectFolder(projectCode, env);
        
        if (projectInfo) {
            console.log(`[ProjectPath] Using existing folder: ${projectInfo.folderName}`);
            return `${projectInfo.basePath}10__ProjectAdmin__AppContent/${filename}`;
        }
        
        // Fallback: construct path if year AND projectName provided
        if (year && projectName) {
            const prefix         = env.R2_PREFIX || 'NaProjectPortal/';
            const code           = projectCode.toUpperCase();
            
            // Match Flask naming convention: {code}__{projectName with spaces removed}
            // From start_local_server.py line 400: folder_name = f"{code}__{project_name.replace(' ', '')}"
            const folderName     = `${code}__${projectName.replace(/\s+/g, '')}`;
            const path           = `${prefix}${year}-Projects/${folderName}/10__ProjectAdmin__AppContent/${filename}`;
            
            console.log(`[ProjectPath] Constructing new path: ${path}`);
            return path;
        }
        
        console.warn(`[ProjectPath] Cannot build path for ${projectCode} - folder not found and no year/projectName provided`);
        return null;
    }

// endregion ----

