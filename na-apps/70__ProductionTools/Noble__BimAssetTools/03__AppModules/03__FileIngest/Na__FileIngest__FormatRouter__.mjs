/* =============================================================================
   NOBLE BIM ASSET TOOLS | FILE INGEST - FORMAT ROUTER
   =============================================================================

   FILE       : Na__FileIngest__FormatRouter__.mjs
   NAMESPACE  : Na__BimAssetTools
   MODULE     : FileIngest - FormatRouter
   AUTHOR     : Adam Noble - Noble Architecture
   PURPOSE    : Identify each incoming file and drive it through the correct loader
   CREATED    : 14-Aug-2026

   DESCRIPTION:
   - The single place where a file becomes an asset record. Everything upstream
     deals in File objects; everything downstream deals in loaded assets.
   - Format identification is by extension against the registry, then confirmed
     against the file's actual leading bytes where a signature exists. A Revit
     file renamed to .ifc is a real thing that happens, and it produces a far more
     confusing failure if the mismatch is not caught here.

   ============================================================================= */

import { EVENTS, Publish }             from '../01__AppCore/Na__AppCore__EventBus__.mjs';
import { CreateAsset, UpdateAsset,
         GetConfig, GetFormatRegistry } from '../01__AppCore/Na__AppCore__AppState__.mjs';
import { LoadIfcModel }                from '../04__Loaders__Ifc/Na__IfcLoader__Engine__.mjs';
import { LoadCadModel }                from '../05__Loaders__Cad/Na__CadLoader__OcctBridge__.mjs';
import { LoadMeshModel }               from '../06__Loaders__Mesh/Na__MeshLoader__Router__.mjs';
import { ReadRevitMetadata }           from '../07__Loaders__Revit/Na__RevitReader__Metadata__.mjs';
import { AuditAsset }                  from '../20__System__AssetAudit/Na__AssetAudit__GeometryAudit__.mjs';

// =============================================================================
// REGION | Module Constants
// =============================================================================

    // MODULE CONSTANTS | Leading Byte Signatures Used to Confirm a Format
    // ------------------------------------------------------------
    const SIGNATURES = Object.freeze([
        { bytes : [0xD0, 0xCF, 0x11, 0xE0], label : 'Revit / OLE2 compound file', extensions : ['.rfa', '.rvt', '.rte', '.rft'] },
        { bytes : [0x67, 0x6C, 0x54, 0x46], label : 'glTF binary',                extensions : ['.glb']  },
        { bytes : [0x49, 0x53, 0x4F, 0x2D], label : 'ISO-10303 STEP or IFC',      extensions : ['.ifc', '.step', '.stp'] }
    ]);
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// =============================================================================
// REGION | Identification
// =============================================================================

    // HELPER FUNCTION | Extract the Lower Case Extension Including Its Dot
    // ------------------------------------------------------------
    export function ExtensionOf(fileName) {
        const dot = fileName.lastIndexOf('.');
        return dot === -1 ? '' : fileName.slice(dot).toLowerCase();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Find the Registry Entry Claiming an Extension
    // ------------------------------------------------------------
    export function FindFormatEntry(extension) {
        const registry = GetFormatRegistry();
        return registry.formats.find(format => format.extensions.includes(extension)) || null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Compare the File's Leading Bytes Against Known Signatures
    // ------------------------------------------------------------
    // Returns a warning string when the content plainly disagrees with the name,
    // or null when it agrees or when no signature covers the format.
    function Na__FormatRouter__CheckSignature(arrayBuffer, extension) {
        if (arrayBuffer.byteLength < 4) return 'File is too short to contain any recognisable geometry.';

        const head = new Uint8Array(arrayBuffer, 0, 4);

        for (const signature of SIGNATURES) {
            const matches = signature.bytes.every((byte, i) => head[i] === byte);
            if (!matches) continue;

            if (signature.extensions.includes(extension)) return null;            // <-- Content agrees with the name

            return `This file is named "${extension}" but its contents are a ${signature.label}. ` +
                   `It has most likely been renamed. Treat the extension as unreliable.`;
        }

        return null;                                                              // <-- No signature covers this format; nothing to contradict
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// =============================================================================
// REGION | Loading
// =============================================================================

    // HELPER FUNCTION | Dispatch to the Loader for a Registry Route
    // ------------------------------------------------------------
    async function Na__FormatRouter__RunLoader(route, arrayBuffer, fileName, extension, formatEntry, options) {
        switch (route) {
            case 'ifc':
                return LoadIfcModel(arrayBuffer, fileName, options.onProgress);

            case 'occt':
                return LoadCadModel(arrayBuffer, fileName, extension, options.tessellationPreset);

            case 'three':
                return LoadMeshModel(arrayBuffer, fileName, extension, formatEntry);

            case 'revitAudit': {
                const metadata = await ReadRevitMetadata(arrayBuffer, fileName);
                return {
                    object3d        : null,                                       // <-- No geometry is obtainable from this route
                    auditOnly       : true,
                    axisConvention  : 'n/a',
                    sourceUnit      : 'millimetre',
                    unitWasDeclared : true,
                    unitFactorToMm  : 1.0,
                    unitDeclaration : 'Revit parameter values carry their own declared units.',
                    unitConfidence  : 'declared',
                    warnings        : metadata.warnings,
                    metadata        : metadata
                };
            }

            default:
                throw new Error(`[Na FormatRouter] Registry route "${route}" has no loader bound to it.`);
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// =============================================================================
// REGION | Public Ingest Entry
// =============================================================================

    // FUNCTION | Ingest a Single File into an Audited Asset Record
    // ------------------------------------------------------------
    export async function IngestFile(file, options) {
        const settings   =  options || {};
        const config     =  GetConfig();
        const extension  =  ExtensionOf(file.name);
        const formatEntry=  FindFormatEntry(extension);

        if (!formatEntry) {
            const supported = GetFormatRegistry().formats.flatMap(f => f.extensions).join(', ');
            throw new Error(`"${file.name}" is not a format this tool reads. Supported: ${supported}`);
        }

        const maxBytes = config.ingest.maxFileSizeMb * 1024 * 1024;
        if (file.size > maxBytes) {
            throw new Error(`"${file.name}" is ${(file.size / 1024 / 1024).toFixed(0)} MB, over the ${config.ingest.maxFileSizeMb} MB limit. Parsing it would likely exhaust the browser tab's memory.`);
        }

        const asset = CreateAsset({
            fileName      : file.name,
            extension     : extension,
            fileSizeBytes : file.size,
            route         : formatEntry.route,
            sourceUnit    : formatEntry.assumedUnit || 'millimetre',
            unitWasDeclared: formatEntry.unitsDeclared === true
        });

        // -- The File handle is retained on Revit assets so they can be sent for
        // -- conversion later without asking the user to find the file again. A
        // -- File is a reference to disk-backed data, not an in-memory copy, so
        // -- holding it costs nothing meaningful.
        UpdateAsset(asset.id, {
            status     : 'loading',
            sourceFile : formatEntry.route === 'revitAudit' ? file : null
        });
        Publish(EVENTS.LOAD_STARTED, { asset : asset });

        try {
            const arrayBuffer  =  await file.arrayBuffer();
            const warnings     =  [];

            const signatureWarning = Na__FormatRouter__CheckSignature(arrayBuffer, extension);
            if (signatureWarning) warnings.push(signatureWarning);

            const loaded = await Na__FormatRouter__RunLoader(
                formatEntry.route, arrayBuffer, file.name, extension, formatEntry,
                {
                    tessellationPreset : settings.tessellationPreset,
                    onProgress         : (count) => Publish(EVENTS.LOAD_PROGRESS, { asset : asset, count : count })
                }
            );

            const allWarnings = warnings.concat(loaded.warnings || []);

            UpdateAsset(asset.id, {
                status          : loaded.auditOnly ? 'auditOnly' : 'loaded',
                object3d        : loaded.object3d,
                axisConvention  : loaded.axisConvention,
                sourceUnit      : loaded.sourceUnit,
                unitWasDeclared : loaded.unitWasDeclared,
                unitFactorToMm  : loaded.unitFactorToMm,
                unitDeclaration : loaded.unitDeclaration,
                unitConfidence  : loaded.unitConfidence,
                worldOffsetMm   : loaded.worldOffsetMm || [0, 0, 0],
                wasRecentred    : loaded.wasRecentred === true,
                warnings        : allWarnings,
                metadata        : loaded.metadata || {}
            });

            // -- Audit anything that produced geometry -------------------------
            if (loaded.object3d && config.audit.runAutomaticallyOnLoad) {
                UpdateAsset(asset.id, { audit : AuditAsset(asset) });
                Publish(EVENTS.AUDIT_COMPLETED, { asset : asset });
            }

            Publish(EVENTS.LOAD_COMPLETED, { asset : asset });
            return asset;
        } catch (err) {
            UpdateAsset(asset.id, { status : 'failed', error : err.message });
            Publish(EVENTS.LOAD_FAILED, { asset : asset, error : err });
            throw err;
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Ingest a Batch of Files, Reporting Per-File Outcomes
    // ------------------------------------------------------------
    // Files are loaded one at a time on purpose. Both WASM engines hold a single
    // heap, and running several large parses concurrently is the reliable way to
    // exhaust it. Sequential loading is also what makes the progress readout
    // meaningful.
    export async function IngestFiles(fileList, options) {
        const config    =  GetConfig();
        const files     =  Array.from(fileList).slice(0, config.ingest.maxFilesPerBatch);
        const succeeded =  [];
        const failed    =  [];

        Publish(EVENTS.FILES_QUEUED, { count : files.length });

        for (const file of files) {
            try {
                succeeded.push(await IngestFile(file, options));
            } catch (err) {
                failed.push({ fileName : file.name, error : err.message });
                console.warn(`[Na FormatRouter] "${file.name}" failed to load.`, err);
            }
        }

        return { succeeded : succeeded, failed : failed };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
