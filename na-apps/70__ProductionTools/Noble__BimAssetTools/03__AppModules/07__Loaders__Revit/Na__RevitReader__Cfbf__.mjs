/* =============================================================================
   NOBLE BIM ASSET TOOLS | REVIT READER - OLE2 COMPOUND FILE PARSER
   =============================================================================

   FILE       : Na__RevitReader__Cfbf__.mjs
   NAMESPACE  : Na__BimAssetTools
   MODULE     : Loaders - Revit - CFBF Container
   AUTHOR     : Adam Noble - Noble Architecture
   PURPOSE    : Read the streams out of an OLE2 Compound File without any dependency
   CREATED    : 14-Aug-2026

   DESCRIPTION:
   - Revit .rfa, .rvt, .rte and .rft files are all Microsoft Compound File Binary
     Format containers, the same OLE2 structure used by legacy .doc and .xls. The
     container is fully documented in [MS-CFB]; only the element streams Revit
     puts inside it are proprietary.
   - This module reads the container. It is about three hundred lines and has no
     dependency, which is a far better trade than pulling a general purpose OLE
     library in to reach three streams.

   ---------------------------------------------------------------------------

   WHAT THIS MAKES AVAILABLE, AND WHAT IT DOES NOT:
   Recoverable from a Revit family:
     - PartAtom          Autodesk Exchange XML. The complete parameter schedule:
                         every family type with its real dimensional values.
     - BasicFileInfo     Authoring Revit version, build and save path.
     - RevitPreview4.0   The embedded preview thumbnail.

   NOT recoverable, by this or any other open-source code:
     - Geometry. Solids live in the proprietary element streams and in the stream
       named "Contents". They are undocumented and partially compressed. There is
       no open-source reader for them and this module does not pretend otherwise.
       Geometry requires converting the file to IFC first.

   ---------------------------------------------------------------------------

   FORMAT NOTES THAT ARE EASY TO GET WRONG:
   - Sector N begins at byte offset (N + 1) * sectorSize. The 512 byte header is
     padded out to a full sector, so with 4096 byte sectors the first 3584 bytes
     after the header are zero filler rather than data.
   - Streams shorter than the mini stream cutoff, normally 4096 bytes, are NOT in
     the main FAT. They live packed inside the mini stream, which is itself an
     ordinary stream hanging off the Root Entry and chained through a separate
     mini FAT in 64 byte sectors. Revit puts BasicFileInfo and the preview
     thumbnail down there, so skipping mini FAT support would miss both.

   ============================================================================= */

// =============================================================================
// REGION | Format Constants
// =============================================================================

    // MODULE CONSTANTS | Compound File Signature and Sector Sentinels
    // ------------------------------------------------------------
    const CFBF_SIGNATURE      =  [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1];
    const SECTOR_END_OF_CHAIN =  0xFFFFFFFE;                                     // <-- ENDOFCHAIN
    const SECTOR_FREE         =  0xFFFFFFFF;                                     // <-- FREESECT
    const DIRECTORY_ENTRY_SIZE=  128;                                            // <-- Fixed by the specification
    const MAX_CHAIN_LENGTH    =  1048576;                                        // <-- Runaway guard against a corrupt or hostile FAT
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Directory Entry Field Offsets
    // ------------------------------------------------------------
    const DIR_NAME_LENGTH     =  0x40;                                           // <-- uint16, byte length of the UTF-16 name including terminator
    const DIR_OBJECT_TYPE     =  0x42;                                           // <-- uint8: 0 unused, 1 storage, 2 stream, 5 root
    const DIR_START_SECTOR    =  0x74;                                           // <-- uint32
    const DIR_STREAM_SIZE     =  0x78;                                           // <-- uint64, little endian
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Header Field Offsets
    // ------------------------------------------------------------
    const HDR_SECTOR_SHIFT      =  0x1E;
    const HDR_MINI_SECTOR_SHIFT =  0x20;
    const HDR_FIRST_DIR_SECTOR  =  0x30;
    const HDR_MINI_CUTOFF       =  0x38;
    const HDR_FIRST_MINIFAT     =  0x3C;
    const HDR_FIRST_DIFAT       =  0x44;
    const HDR_DIFAT_ARRAY       =  0x4C;                                         // <-- First 109 FAT sector numbers live in the header itself
    const HDR_DIFAT_ARRAY_COUNT =  109;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// =============================================================================
// REGION | Compound File Parser
// =============================================================================

// -----------------------------------------------------------------------------
// REGION | Signature and Header
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Confirm the Buffer Opens with the OLE2 Magic Number
    // ------------------------------------------------------------
    export function IsCompoundFile(arrayBuffer) {
        if (!arrayBuffer || arrayBuffer.byteLength < 512) return false;

        const bytes = new Uint8Array(arrayBuffer, 0, CFBF_SIGNATURE.length);
        for (let i = 0; i < CFBF_SIGNATURE.length; i++) {
            if (bytes[i] !== CFBF_SIGNATURE[i]) return false;
        }
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read the Header Fields Needed to Walk the Container
    // ------------------------------------------------------------
    function Na__Cfbf__ReadHeader(view) {
        const sectorShift     =  view.getUint16(HDR_SECTOR_SHIFT,      true);
        const miniSectorShift =  view.getUint16(HDR_MINI_SECTOR_SHIFT, true);

        return {
            sectorSize      :  1 << sectorShift,                                 // <-- Normally 512 or 4096
            miniSectorSize  :  1 << miniSectorShift,                             // <-- Normally 64
            firstDirSector  :  view.getUint32(HDR_FIRST_DIR_SECTOR, true),
            miniStreamCutoff:  view.getUint32(HDR_MINI_CUTOFF,      true),
            firstMiniFat    :  view.getUint32(HDR_FIRST_MINIFAT,    true),
            firstDifat      :  view.getUint32(HDR_FIRST_DIFAT,      true)
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Allocation Tables
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Collect Every FAT Sector Number from the DIFAT
    // ------------------------------------------------------------
    // The first 109 entries sit in the header. Beyond that the DIFAT continues in
    // its own sector chain, where the last uint32 of each sector points at the
    // next DIFAT sector rather than at a FAT sector.
    function Na__Cfbf__CollectFatSectors(view, header) {
        const fatSectors  =  [];
        const sectorAt    =  (s) => (s + 1) * header.sectorSize;

        for (let i = 0; i < HDR_DIFAT_ARRAY_COUNT; i++) {
            const sector = view.getUint32(HDR_DIFAT_ARRAY + i * 4, true);
            if (sector === SECTOR_FREE) break;
            fatSectors.push(sector);
        }

        const entriesPerSector = (header.sectorSize / 4) - 1;                     // <-- Last slot is the next-DIFAT pointer
        let   difatSector      = header.firstDifat;
        let   guard            = 0;

        while (difatSector !== SECTOR_END_OF_CHAIN && difatSector !== SECTOR_FREE && guard++ < MAX_CHAIN_LENGTH) {
            const base = sectorAt(difatSector);
            if (base + header.sectorSize > view.byteLength) break;                // <-- Truncated file, stop rather than read past the end

            for (let i = 0; i < entriesPerSector; i++) {
                const sector = view.getUint32(base + i * 4, true);
                if (sector === SECTOR_FREE) continue;
                fatSectors.push(sector);
            }
            difatSector = view.getUint32(base + entriesPerSector * 4, true);
        }

        return fatSectors;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Flatten a List of Table Sectors into a Sector Number Array
    // ------------------------------------------------------------
    function Na__Cfbf__ReadTable(view, header, tableSectors) {
        const table        =  [];
        const perSector    =  header.sectorSize / 4;
        const sectorAt     =  (s) => (s + 1) * header.sectorSize;

        for (const sector of tableSectors) {
            const base = sectorAt(sector);
            if (base + header.sectorSize > view.byteLength) break;

            for (let i = 0; i < perSector; i++) {
                table.push(view.getUint32(base + i * 4, true));
            }
        }
        return table;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Walk an Allocation Chain from a Starting Sector
    // ------------------------------------------------------------
    function Na__Cfbf__FollowChain(table, startSector) {
        const chain  =  [];
        let   sector =  startSector;
        let   guard  =  0;

        while (sector !== SECTOR_END_OF_CHAIN && sector !== SECTOR_FREE && guard++ < MAX_CHAIN_LENGTH) {
            if (sector >= table.length) break;                                    // <-- Chain points outside the table: corrupt, stop cleanly
            chain.push(sector);
            sector = table[sector];
        }
        return chain;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Directory
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Read Every Directory Entry in the Container
    // ------------------------------------------------------------
    function Na__Cfbf__ReadDirectory(view, header, fat) {
        const entries   =  [];
        const perSector =  header.sectorSize / DIRECTORY_ENTRY_SIZE;
        const sectorAt  =  (s) => (s + 1) * header.sectorSize;

        for (const sector of Na__Cfbf__FollowChain(fat, header.firstDirSector)) {
            const base = sectorAt(sector);
            if (base + header.sectorSize > view.byteLength) break;

            for (let slot = 0; slot < perSector; slot++) {
                const offset    =  base + slot * DIRECTORY_ENTRY_SIZE;
                const nameBytes =  view.getUint16(offset + DIR_NAME_LENGTH, true);
                if (nameBytes === 0) continue;                                    // <-- Unused slot

                const charCount =  Math.max(0, (nameBytes / 2) - 1);              // <-- Length includes the UTF-16 null terminator
                let   name      =  '';
                for (let c = 0; c < charCount; c++) {
                    name += String.fromCharCode(view.getUint16(offset + c * 2, true));
                }

                const sizeLow   =  view.getUint32(offset + DIR_STREAM_SIZE,     true);
                const sizeHigh  =  view.getUint32(offset + DIR_STREAM_SIZE + 4, true);

                entries.push({
                    name        :  name,
                    objectType  :  view.getUint8(offset + DIR_OBJECT_TYPE),
                    startSector :  view.getUint32(offset + DIR_START_SECTOR, true),
                    size        :  sizeLow + sizeHigh * 4294967296
                });
            }
        }
        return entries;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Stream Extraction
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Copy a Chain of Full Size Sectors into One Buffer
    // ------------------------------------------------------------
    function Na__Cfbf__ReadFromChain(sourceBytes, chain, sectorSize, sectorBaseOffset, byteLength) {
        const output  =  new Uint8Array(byteLength);
        let   written =  0;

        for (const sector of chain) {
            if (written >= byteLength) break;

            const start = sectorBaseOffset(sector);
            const count = Math.min(sectorSize, byteLength - written);
            if (start + count > sourceBytes.length) break;                        // <-- Truncated file: return what is genuinely there

            output.set(sourceBytes.subarray(start, start + count), written);
            written += count;
        }

        return written === byteLength ? output : output.subarray(0, written);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Extract a Stream, Choosing the Main or Mini Allocation Path
    // ------------------------------------------------------------
    function Na__Cfbf__ReadStreamBytes(context, entry) {
        const { bytes, header, fat, miniFat, miniStream } = context;

        if (entry.size === 0) return new Uint8Array(0);

        if (entry.size >= header.miniStreamCutoff) {                              // <-- Ordinary stream in the main FAT
            return Na__Cfbf__ReadFromChain(
                bytes,
                Na__Cfbf__FollowChain(fat, entry.startSector),
                header.sectorSize,
                (s) => (s + 1) * header.sectorSize,
                entry.size
            );
        }

        if (!miniStream) return new Uint8Array(0);                                // <-- No mini stream container present

        return Na__Cfbf__ReadFromChain(                                           // <-- Small stream packed inside the mini stream
            miniStream,
            Na__Cfbf__FollowChain(miniFat, entry.startSector),
            header.miniSectorSize,
            (s) => s * header.miniSectorSize,                                     // <-- Mini sectors are indexed from zero, not offset by one
            entry.size
        );
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public Entry Point
// -----------------------------------------------------------------------------

    // FUNCTION | Parse a Compound File and Return a Stream Accessor
    // ------------------------------------------------------------
    export function ParseCompoundFile(arrayBuffer) {
        if (!IsCompoundFile(arrayBuffer)) {
            throw new Error('[Na CFBF] Not an OLE2 compound file - signature mismatch.');
        }

        const view    =  new DataView(arrayBuffer);
        const bytes   =  new Uint8Array(arrayBuffer);
        const header  =  Na__Cfbf__ReadHeader(view);

        const fat     =  Na__Cfbf__ReadTable(view, header, Na__Cfbf__CollectFatSectors(view, header));
        const entries =  Na__Cfbf__ReadDirectory(view, header, fat);

        // -- The Root Entry doubles as the container for every mini stream, and its
        // -- declared size is the mini stream length. Build it before reading any
        // -- small stream, because small streams are slices of it.
        const rootEntry =  entries.find(entry => entry.objectType === 5) || null;
        const miniFat   =  Na__Cfbf__ReadTable(view, header, Na__Cfbf__FollowChain(fat, header.firstMiniFat));

        const miniStream = (rootEntry && rootEntry.size > 0)
            ? Na__Cfbf__ReadFromChain(
                bytes,
                Na__Cfbf__FollowChain(fat, rootEntry.startSector),
                header.sectorSize,
                (s) => (s + 1) * header.sectorSize,
                rootEntry.size
              )
            : null;

        const context = { bytes, header, fat, miniFat, miniStream };

        return {
            header      :  header,
            entries     :  entries,

            // -- Names present in the container, storages excluded.
            StreamNames : function Na__Cfbf__StreamNames() {
                return entries.filter(entry => entry.objectType === 2).map(entry => entry.name);
            },

            // -- Raw bytes of a named stream, or null when the stream is absent.
            ReadStream  : function Na__Cfbf__ReadStream(name) {
                const entry = entries.find(candidate => candidate.name === name && candidate.objectType === 2);
                return entry ? Na__Cfbf__ReadStreamBytes(context, entry) : null;
            },

            // -- Convenience for the several Revit streams that hold plain text.
            ReadStreamAsText : function Na__Cfbf__ReadStreamAsText(name, encoding) {
                const raw = this.ReadStream(name);
                if (!raw) return null;
                return new TextDecoder(encoding || 'utf-8', { fatal : false }).decode(raw);
            }
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------

// endregion -------------------------------------------------------------------
