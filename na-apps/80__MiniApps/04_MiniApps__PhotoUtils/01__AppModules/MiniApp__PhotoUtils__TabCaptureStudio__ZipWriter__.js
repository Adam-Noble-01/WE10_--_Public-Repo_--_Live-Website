// =============================================================================
// NOBLE ARCHITECTURE - TAB CAPTURE STUDIO - ZIP WRITER
// =============================================================================
//
// FILE    : MiniApp__PhotoUtils__TabCaptureStudio__ZipWriter__.js
// AUTHOR  : Adam Noble - Noble Architecture
// PURPOSE : Builds stored (uncompressed) zip files from image Blobs
// CREATED : 12-Nov-2026
//
// NOTES:
// - JPEG, PNG and WebP are already compressed, so entries are stored, not
//   deflated. The zip is assembled from Blob parts: image bytes are never
//   copied into JavaScript memory, so large sets stay cheap.
// - Each zip is kept under NaMiniApp__ZipPartMaxBytes (below 4 GB), so no
//   ZIP64 records are needed. A bigger set is split into numbered parts.
// - CRC32 is computed per image in the worker as it is captured.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | CRC32
// -----------------------------------------------------------------------------

const Na__CrcTable = (() => {
    const Na__Table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        Na__Table[n] = c >>> 0;
    }
    return Na__Table;
})();


// FUNCTION | CRC32 of a byte array
// ------------------------------------------------------------
export function Na__TabCapture__Crc32(Na__Bytes) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < Na__Bytes.length; i++) c = Na__CrcTable[(c ^ Na__Bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------



// -----------------------------------------------------------------------------
// REGION | Zip Records
// -----------------------------------------------------------------------------

// FUNCTION | DOS date and time words for a JS timestamp
// ------------------------------------------------------------
function Na__DosDateTime(Na__Ms) {
    const d = new Date(Na__Ms);
    const Na__Year = Math.max(1980, d.getFullYear());
    return {
        time : ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xFFFF,
        date : (((Na__Year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF
    };
}
// ------------------------------------------------------------


// FUNCTION | Local file header (30 bytes + name)
// ------------------------------------------------------------
function Na__LocalHeader(Na__File, Na__NameBytes) {
    const Na__Buf = new Uint8Array(30 + Na__NameBytes.length);
    const v = new DataView(Na__Buf.buffer);
    const t = Na__DosDateTime(Na__File.date);
    v.setUint32(0,  0x04034b50, true);
    v.setUint16(4,  20, true);                      // version needed
    v.setUint16(6,  0x0800, true);                  // UTF-8 names
    v.setUint16(8,  0, true);                       // stored
    v.setUint16(10, t.time, true);
    v.setUint16(12, t.date, true);
    v.setUint32(14, Na__File.crc >>> 0, true);
    v.setUint32(18, Na__File.size, true);
    v.setUint32(22, Na__File.size, true);
    v.setUint16(26, Na__NameBytes.length, true);
    v.setUint16(28, 0, true);
    Na__Buf.set(Na__NameBytes, 30);
    return Na__Buf;
}
// ------------------------------------------------------------


// FUNCTION | Central directory entry (46 bytes + name)
// ------------------------------------------------------------
function Na__CentralEntry(Na__File, Na__NameBytes, Na__Offset) {
    const Na__Buf = new Uint8Array(46 + Na__NameBytes.length);
    const v = new DataView(Na__Buf.buffer);
    const t = Na__DosDateTime(Na__File.date);
    v.setUint32(0,  0x02014b50, true);
    v.setUint16(4,  20, true);                      // version made by
    v.setUint16(6,  20, true);                      // version needed
    v.setUint16(8,  0x0800, true);
    v.setUint16(10, 0, true);
    v.setUint16(12, t.time, true);
    v.setUint16(14, t.date, true);
    v.setUint32(16, Na__File.crc >>> 0, true);
    v.setUint32(20, Na__File.size, true);
    v.setUint32(24, Na__File.size, true);
    v.setUint16(28, Na__NameBytes.length, true);
    v.setUint16(30, 0, true);
    v.setUint16(32, 0, true);
    v.setUint16(34, 0, true);
    v.setUint16(36, 0, true);
    v.setUint32(38, 0, true);
    v.setUint32(42, Na__Offset, true);
    Na__Buf.set(Na__NameBytes, 46);
    return Na__Buf;
}
// ------------------------------------------------------------


// FUNCTION | End of central directory record (22 bytes)
// ------------------------------------------------------------
function Na__EndRecord(Na__Count, Na__CdSize, Na__CdOffset) {
    const Na__Buf = new Uint8Array(22);
    const v = new DataView(Na__Buf.buffer);
    v.setUint32(0,  0x06054b50, true);
    v.setUint16(4,  0, true);
    v.setUint16(6,  0, true);
    v.setUint16(8,  Na__Count, true);
    v.setUint16(10, Na__Count, true);
    v.setUint32(12, Na__CdSize, true);
    v.setUint32(16, Na__CdOffset, true);
    v.setUint16(20, 0, true);
    return Na__Buf;
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------



// -----------------------------------------------------------------------------
// REGION | Public Builders
// -----------------------------------------------------------------------------

// FUNCTION | Text file entry (CSV, JSON) with its CRC worked out here
// ------------------------------------------------------------
export function Na__TabCapture__TextEntry(Na__Name, Na__Text, Na__Mime) {
    const Na__Bytes = new TextEncoder().encode(Na__Text);
    return {
        name : Na__Name,
        blob : new Blob([Na__Bytes], { type: Na__Mime || "text/plain" }),
        crc  : Na__TabCapture__Crc32(Na__Bytes),
        size : Na__Bytes.length,
        date : Date.now()
    };
}
// ------------------------------------------------------------


// FUNCTION | Build one or more zip Blobs from { name, blob, crc, size, date } entries
// ------------------------------------------------------------
// Na__Shared entries (the log) are added to every part.
export function Na__TabCapture__BuildZips(Na__Files, Na__Shared, Na__MaxBytes) {
    const Na__Encoder = new TextEncoder();
    const Na__Parts   = [];
    let   Na__Current = [];
    let   Na__Bytes   = 0;

    const Na__Cost = (f) => 30 + 46 + Na__Encoder.encode(f.name).length * 2 + f.size;
    const Na__SharedCost = Na__Shared.reduce((a, f) => a + Na__Cost(f), 22);


    // Group images into parts below the size limit
    // ------------------------------------
    Na__Files.forEach((f) => {
        const c = Na__Cost(f);
        if (Na__Current.length && (Na__Bytes + c + Na__SharedCost > Na__MaxBytes || Na__Current.length >= 60000)) {
            Na__Parts.push(Na__Current);
            Na__Current = [];
            Na__Bytes   = 0;
        }
        Na__Current.push(f);
        Na__Bytes += c;
    });
    if (Na__Current.length) Na__Parts.push(Na__Current);


    // Assemble each part from Blob pieces
    // ------------------------------------
    return Na__Parts.map((Na__List) => {
        const Na__All     = Na__List.concat(Na__Shared);
        const Na__Pieces  = [];
        const Na__Central = [];
        let   Na__Offset  = 0;

        Na__All.forEach((f) => {
            const Na__Name   = Na__Encoder.encode(f.name);
            const Na__Header = Na__LocalHeader(f, Na__Name);
            Na__Central.push(Na__CentralEntry(f, Na__Name, Na__Offset));
            Na__Pieces.push(Na__Header, f.blob);
            Na__Offset += Na__Header.length + f.size;
        });

        const Na__CdSize = Na__Central.reduce((a, b) => a + b.length, 0);
        return new Blob(Na__Pieces.concat(Na__Central, [Na__EndRecord(Na__All.length, Na__CdSize, Na__Offset)]), { type: "application/zip" });
    });
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------
