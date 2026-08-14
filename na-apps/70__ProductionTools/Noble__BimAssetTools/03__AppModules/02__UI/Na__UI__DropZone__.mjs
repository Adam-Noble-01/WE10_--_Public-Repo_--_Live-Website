/* =============================================================================
   NOBLE BIM ASSET TOOLS | USER INTERFACE - DROP ZONE
   =============================================================================

   FILE       : Na__UI__DropZone__.mjs
   NAMESPACE  : Na__BimAssetTools
   MODULE     : UI - DropZone
   AUTHOR     : Adam Noble - Noble Architecture
   PURPOSE    : Accept files and whole folders by drag and drop or by picker
   CREATED    : 14-Aug-2026

   DESCRIPTION:
   - A BIM object download is a folder tree, not a file. The Guttermaster set that
     prompted this tool is 86 Revit families across nine nested folders, so the
     drop zone walks a dropped directory recursively rather than asking the user
     to pick files one by one.
   - Recursion uses the webkitGetAsEntry directory API, which is what every current
     browser implements for dropped folders despite the vendor prefix in its name.

   ============================================================================= */

import { EVENTS, Publish }              from '../01__AppCore/Na__AppCore__EventBus__.mjs';
import { GetConfig }                    from '../01__AppCore/Na__AppCore__AppState__.mjs';
import { ExtensionOf, FindFormatEntry } from '../03__FileIngest/Na__FileIngest__FormatRouter__.mjs';

// =============================================================================
// REGION | Directory Traversal
// =============================================================================

    // HELPER FUNCTION | Read Every Entry in a Directory Reader
    // ------------------------------------------------------------
    // readEntries returns at most 100 entries per call and signals completion with
    // an empty batch, so it must be called repeatedly. Reading it once is the
    // classic bug that silently truncates a large folder to its first 100 files.
    function Na__DropZone__ReadAllEntries(directoryReader) {
        return new Promise(function Na__DropZone__ReadBatch(resolve, reject) {
            const collected = [];

            function readNextBatch() {
                directoryReader.readEntries(
                    function Na__DropZone__OnBatch(batch) {
                        if (batch.length === 0) { resolve(collected); return; }
                        collected.push(...batch);
                        readNextBatch();
                    },
                    reject
                );
            }
            readNextBatch();
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Resolve a File Entry into a File Object
    // ------------------------------------------------------------
    function Na__DropZone__EntryToFile(fileEntry) {
        return new Promise((resolve, reject) => fileEntry.file(resolve, reject));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Walk a Dropped Entry Tree Collecting Readable Files
    // ------------------------------------------------------------
    async function Na__DropZone__CollectFiles(entry, collected, maxFiles, recurse) {
        if (collected.length >= maxFiles) return collected;

        if (entry.isFile) {
            const file = await Na__DropZone__EntryToFile(entry);

            // -- Filter to formats the registry actually claims, so dropping a
            // -- vendor folder full of PDFs and thumbnails does not queue them.
            if (FindFormatEntry(ExtensionOf(file.name))) collected.push(file);
            return collected;
        }

        if (entry.isDirectory && recurse) {
            const entries = await Na__DropZone__ReadAllEntries(entry.createReader());
            for (const child of entries) {
                await Na__DropZone__CollectFiles(child, collected, maxFiles, recurse);
            }
        }

        return collected;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// =============================================================================
// REGION | Mounting
// =============================================================================

    // FUNCTION | Wire a Host Element as a Drop Target and Picker
    // ------------------------------------------------------------
    export function MountDropZone(hostElement, fileInputElement, onFilesReady) {
        const config = GetConfig();

        // -- Drag feedback -----------------------------------------------------
        // dragover must be cancelled or the browser navigates to the dropped file.
        let dragDepth = 0;

        hostElement.addEventListener('dragover', function Na__DropZone__OnDragOver(ev) {
            ev.preventDefault();
            ev.dataTransfer.dropEffect = 'copy';
        });

        hostElement.addEventListener('dragenter', function Na__DropZone__OnDragEnter(ev) {
            ev.preventDefault();
            dragDepth++;
            hostElement.classList.add('na-dropzone--active');
        });

        hostElement.addEventListener('dragleave', function Na__DropZone__OnDragLeave() {
            dragDepth = Math.max(0, dragDepth - 1);                               // <-- Counted, because dragleave also fires for child elements
            if (dragDepth === 0) hostElement.classList.remove('na-dropzone--active');
        });

        // -- Drop --------------------------------------------------------------
        hostElement.addEventListener('drop', async function Na__DropZone__OnDrop(ev) {
            ev.preventDefault();
            dragDepth = 0;
            hostElement.classList.remove('na-dropzone--active');

            const items = Array.from(ev.dataTransfer.items || []);
            const collected = [];

            // -- The entry list must be captured synchronously; the DataTransfer
            // -- is neutered as soon as the handler yields to an await.
            const entries = items
                .map(item => (item.webkitGetAsEntry ? item.webkitGetAsEntry() : null))
                .filter(Boolean);

            if (entries.length > 0) {
                for (const entry of entries) {
                    await Na__DropZone__CollectFiles(entry, collected, config.ingest.maxFilesPerBatch, config.ingest.recurseSubfolders);
                }
            } else {
                for (const file of Array.from(ev.dataTransfer.files || [])) {
                    if (FindFormatEntry(ExtensionOf(file.name))) collected.push(file);
                }
            }

            if (collected.length === 0) {
                Publish(EVENTS.NOTIFY, {
                    level   : 'warning',
                    message : 'Nothing readable was dropped. This tool reads IFC, STEP, IGES, glTF, OBJ, STL, PLY, 3DS, COLLADA, FBX and Revit RFA/RVT files.'
                });
                return;
            }

            onFilesReady(collected);
        });

        // -- Picker ------------------------------------------------------------
        if (fileInputElement) {
            fileInputElement.addEventListener('change', function Na__DropZone__OnPick(ev) {
                const picked = Array.from(ev.target.files || [])
                    .filter(file => FindFormatEntry(ExtensionOf(file.name)));

                if (picked.length > 0) onFilesReady(picked);
                ev.target.value = '';                                             // <-- Reset so the same file can be picked twice in a row
            });
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
