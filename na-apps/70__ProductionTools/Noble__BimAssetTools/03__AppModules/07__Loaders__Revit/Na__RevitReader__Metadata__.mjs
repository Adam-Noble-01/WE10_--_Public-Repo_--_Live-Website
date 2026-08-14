/* =============================================================================
   NOBLE BIM ASSET TOOLS | REVIT READER - FAMILY AND PROJECT METADATA
   =============================================================================

   FILE       : Na__RevitReader__Metadata__.mjs
   NAMESPACE  : Na__BimAssetTools
   MODULE     : Loaders - Revit - Metadata
   AUTHOR     : Adam Noble - Noble Architecture
   PURPOSE    : Recover the parameter schedule, version data and preview from Revit files
   CREATED    : 14-Aug-2026

   DESCRIPTION:
   - Sits on top of Na__RevitReader__Cfbf__ and turns the three interesting streams
     into a structured audit record.
   - This is the whole reason .rfa files are worth opening at all in a tool that
     cannot read their geometry. The PartAtom schedule carries every family type
     with its real dimensional parameters in declared units, which is exactly the
     information needed to judge whether a downloaded component is worth using.

   ---------------------------------------------------------------------------

   WHERE EACH PIECE COMES FROM:

     .rfa family files
       PartAtom            Plain UTF-8 XML, uncompressed. One <A:part> element per
                           family type, each holding its parameters as child tags.

     .rvt project files
       ProjectInformation  The same Autodesk partatom schema, but DEFLATE compressed
                           inside a ZIP local file record. Inflated here with the
                           native DecompressionStream, so no zip dependency.

     both
       BasicFileInfo       UTF-16LE text with binary padding. Authoring version,
                           build string and the original save path.
       RevitPreview4.0     A proprietary wrapper with a complete PNG embedded inside
                           it. Located by scanning for the PNG signature rather than
                           by a fixed offset, because the wrapper length varies.

   ---------------------------------------------------------------------------

   PRIVACY NOTE:
   BasicFileInfo routinely contains the original author's local or network save
   path, for example "B:\01. Projects\...". That is genuine information about the
   supplier and is shown in the audit panel, but it is worth being aware that it
   leaves the vendor's internal folder structure visible.

   ============================================================================= */

import { ParseCompoundFile, IsCompoundFile } from './Na__RevitReader__Cfbf__.mjs';

// =============================================================================
// REGION | Module Constants
// =============================================================================

    // MODULE CONSTANTS | Stream Names and Binary Signatures
    // ------------------------------------------------------------
    const STREAM_PART_ATOM      =  'PartAtom';
    const STREAM_PROJECT_INFO   =  'ProjectInformation';
    const STREAM_BASIC_INFO     =  'BasicFileInfo';
    const STREAM_PREVIEW        =  'RevitPreview4.0';

    const PNG_SIGNATURE         =  [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    const PNG_IEND              =  [0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82];
    const ZIP_LOCAL_HEADER      =  [0x50, 0x4B, 0x03, 0x04];
    // ------------------------------------------------------------


    // MODULE CONSTANTS | ZIP Local File Header Field Offsets
    // ------------------------------------------------------------
    const ZIP_COMPRESSION_METHOD =  8;                                           // <-- uint16, 8 means deflate
    const ZIP_COMPRESSED_SIZE    =  18;                                          // <-- uint32
    const ZIP_NAME_LENGTH        =  26;                                          // <-- uint16
    const ZIP_EXTRA_LENGTH       =  28;                                          // <-- uint16
    const ZIP_HEADER_SIZE        =  30;                                          // <-- Fixed portion before the name
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// =============================================================================
// REGION | Binary Helpers
// =============================================================================

    // HELPER FUNCTION | Locate a Byte Signature Inside a Uint8Array
    // ------------------------------------------------------------
    function Na__RevitReader__FindSignature(haystack, signature, fromIndex) {
        const limit = haystack.length - signature.length;

        outer:
        for (let i = (fromIndex || 0); i <= limit; i++) {
            for (let j = 0; j < signature.length; j++) {
                if (haystack[i + j] !== signature[j]) continue outer;
            }
            return i;
        }
        return -1;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Inflate a Raw Deflate Payload Using the Native Stream API
    // ------------------------------------------------------------
    // DecompressionStream is available in every browser this tool targets and in
    // Node 18 and later, so a zip library would be dead weight for one stream.
    async function Na__RevitReader__InflateRaw(compressedBytes) {
        const stream = new Blob([compressedBytes])
            .stream()
            .pipeThrough(new DecompressionStream('deflate-raw'));

        return new Uint8Array(await new Response(stream).arrayBuffer());
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// =============================================================================
// REGION | Stream Decoders
// =============================================================================

// -----------------------------------------------------------------------------
// REGION | Preview Thumbnail
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Carve the Embedded PNG Out of the Preview Wrapper
    // ------------------------------------------------------------
    // The wrapper around the PNG is an undocumented Revit structure whose length
    // varies between files, so the signature is searched for rather than assumed
    // at a fixed offset. The IEND chunk gives the exact end of the image.
    function Na__RevitReader__ExtractPreviewPng(previewBytes) {
        if (!previewBytes || previewBytes.length === 0) return null;

        const start = Na__RevitReader__FindSignature(previewBytes, PNG_SIGNATURE, 0);
        if (start < 0) return null;

        const iend = Na__RevitReader__FindSignature(previewBytes, PNG_IEND, start);
        if (iend < 0) return null;

        const png    =  previewBytes.slice(start, iend + PNG_IEND.length);
        const view   =  new DataView(png.buffer, png.byteOffset, png.byteLength);

        return {
            bytes   :  png,
            width   :  view.getUint32(16, false),                                // <-- IHDR is always the first chunk; big endian per PNG spec
            height  :  view.getUint32(20, false),
            dataUrl :  `data:image/png;base64,${Na__RevitReader__ToBase64(png)}`
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Encode Bytes as Base64 Without Blowing the Call Stack
    // ------------------------------------------------------------
    // Spreading a large array into String.fromCharCode overflows the argument
    // limit, so the conversion is chunked. Thumbnails are small but the same
    // helper guards against an unusually large embedded preview.
    function Na__RevitReader__ToBase64(bytes) {
        const CHUNK = 0x8000;
        let   binary = '';

        for (let i = 0; i < bytes.length; i += CHUNK) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
        }
        return btoa(binary);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Basic File Info
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Decode the Version and Save Path Block
    // ------------------------------------------------------------
    // The stream is UTF-16LE with binary padding interleaved, so it is decoded
    // loosely and then filtered down to the lines that carry readable content.
    function Na__RevitReader__ParseBasicFileInfo(rawBytes) {
        if (!rawBytes || rawBytes.length === 0) return null;

        const text  = new TextDecoder('utf-16le', { fatal : false }).decode(rawBytes);
        const lines = text
            .split(/[\r\n\u0000]+/)
            .map(line => line.trim())
            .filter(line => line.length > 3 && /[A-Za-z]/.test(line));

        const findLine = (pattern) => {
            const hit = lines.find(line => pattern.test(line));
            return hit || null;
        };

        const buildLine   =  findLine(/Autodesk Revit/);
        const versionHit  =  buildLine ? buildLine.match(/Autodesk Revit\s+(\d{4})/) : null;

        // -- The build string itself contains brackets, as in "20160220_1515(x64)",
        // -- so the capture must run greedily to the LAST closing bracket on the
        // -- line. A lazy or negated-class match clips the platform suffix.
        const buildHit    =  buildLine ? buildLine.match(/Build:\s*(.+)\)/)          : null;

        return {
            revitVersion    :  versionHit ? versionHit[1] : null,
            revitBuild      :  buildHit   ? buildHit[1].trim() : null,
            buildString     :  buildLine ? buildLine.replace(/[^\x20-\x7E]/g, '').trim() : null,
            originalPath    :  findLine(/^[A-Za-z]:\\|^\\\\/),                    // <-- Drive letter or UNC path
            worksharing     :  /Worksharing:\s*Enabled/i.test(text) ? 'Enabled' : (/Worksharing:/i.test(text) ? 'Not enabled' : null),
            allReadableLines:  lines
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Part Atom Parameter Schedule
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Resolve an Element's Local Name Independently of the DOM
    // ------------------------------------------------------------
    // The Element.localName property is not dependable across implementations for
    // prefixed XML: browsers strip the prefix, some server side DOMs return the
    // whole qualified name. Deriving it from tagName is correct under both, and
    // this document is XML so tagName keeps its original case.
    function Na__RevitReader__LocalNameOf(element) {
        const qualified = element.tagName || element.nodeName || '';
        const colon     = qualified.lastIndexOf(':');
        return colon === -1 ? qualified : qualified.slice(colon + 1);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Collect Descendant Elements Matching a Local Name
    // ------------------------------------------------------------
    function Na__RevitReader__CollectByLocalName(rootElement, localName, collected) {
        const output = collected || [];

        for (const child of Array.from(rootElement.children)) {
            if (Na__RevitReader__LocalNameOf(child) === localName) output.push(child);
            Na__RevitReader__CollectByLocalName(child, localName, output);
        }
        return output;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read One Parameter Element into a Structured Record
    // ------------------------------------------------------------
    function Na__RevitReader__ReadParameter(element) {
        const rawValue  =  (element.textContent || '').trim();
        const units     =  element.getAttribute('units') || null;
        const kind      =  element.getAttribute('typeOfParameter') || null;
        const name      =  Na__RevitReader__LocalNameOf(element);

        // -- Length parameters carry a bare number in the declared unit. Angles
        // -- arrive as "90.00°" and need the symbol stripping before parsing.
        const numeric = parseFloat(rawValue.replace(/[^\d.eE+-]/g, ''));

        return {
            name            :  name,
            displayName     :  element.getAttribute('displayName') || name,
            origin          :  element.getAttribute('type') || 'custom',         // <-- 'custom' is family author defined, 'system' is built in
            typeOfParameter :  kind,
            units           :  units,
            rawValue        :  rawValue,
            numericValue    :  Number.isFinite(numeric) ? numeric : null
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Parse a PartAtom XML Document into Types and Parameters
    // ------------------------------------------------------------
    function Na__RevitReader__ParsePartAtom(xmlText) {
        if (!xmlText) return null;

        const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
        if (doc.querySelector('parsererror')) {
            throw new Error('[Na RevitReader] PartAtom XML is malformed and could not be parsed.');
        }

        const root         =  doc.documentElement;
        const localNamed   =  (parent, name) => Na__RevitReader__CollectByLocalName(parent, name);

        const titleEl      =  localNamed(root, 'title')[0]           || null;
        const familyEl     =  localNamed(root, 'family')[0]          || null;
        const productVerEl =  localNamed(root, 'product-version')[0] || null;

        // -- Every <category> pairs a term with the scheme that gives it meaning.
        const categories = localNamed(root, 'category').map(cat => {
            const termEl   = localNamed(cat, 'term')[0]   || null;
            const schemeEl = localNamed(cat, 'scheme')[0] || null;
            return {
                term   : termEl   ? (termEl.textContent   || '').trim() : null,
                scheme : schemeEl ? (schemeEl.textContent || '').trim() : null
            };
        });

        const revitCategory = categories.find(c => c.scheme === 'adsk:revit:grouping');
        const omniClass     = categories.find(c => c.scheme === 'std:oc1');

        // -- One <A:part> per family type. Its <title> names the type; every other
        // -- child element is a parameter of that type.
        const partElements = familyEl ? localNamed(familyEl, 'part') : [];
        const types        = partElements.map(function Na__RevitReader__ReadPart(partEl) {
            const parameters = [];
            let   typeName   = null;

            for (const child of Array.from(partEl.children)) {
                if (Na__RevitReader__LocalNameOf(child) === 'title') {
                    typeName = (child.textContent || '').trim();
                    continue;
                }
                parameters.push(Na__RevitReader__ReadParameter(child));
            }

            return { typeName : typeName || '(unnamed type)', parameters : parameters };
        });

        // -- Build the union of parameter names so the audit table can render a
        // -- stable column per parameter across every type.
        const parameterColumns = [];
        const seenColumns      = new Set();
        for (const type of types) {
            for (const parameter of type.parameters) {
                if (seenColumns.has(parameter.name)) continue;
                seenColumns.add(parameter.name);
                parameterColumns.push({
                    name            : parameter.name,
                    displayName     : parameter.displayName,
                    units           : parameter.units,
                    typeOfParameter : parameter.typeOfParameter,
                    origin          : parameter.origin
                });
            }
        }

        const hostEl = familyEl ? localNamed(familyEl, 'Host')[0] : null;

        // -- Project files carry no <A:part> types at all. Their parameters sit
        // -- at document level instead, describing the project rather than a
        // -- family: Project Name, Client Name, Project Address and so on.
        // -- Collecting them is what makes an .rvt worth opening here, rather
        // -- than reporting "0 types" and nothing else.
        const documentParameters = [];
        if (types.length === 0) {
            const insidePart = (element) => {
                for (let node = element.parentElement; node; node = node.parentElement) {
                    if (Na__RevitReader__LocalNameOf(node) === 'part') return true;
                }
                return false;
            };

            const collectParameters = (element) => {
                for (const child of Array.from(element.children)) {
                    // A parameter is any element carrying the typeOfParameter
                    // attribute, which is how the schema marks them.
                    if (child.hasAttribute('typeOfParameter') && !insidePart(child)) {
                        documentParameters.push(Na__RevitReader__ReadParameter(child));
                        continue;
                    }
                    collectParameters(child);
                }
            };
            collectParameters(root);
        }

        return {
            title              :  titleEl      ? titleEl.textContent.trim()      : null,
            revitVersion       :  productVerEl ? productVerEl.textContent.trim() : null,
            revitCategory      :  revitCategory ? revitCategory.term : null,
            omniClass          :  omniClass     ? omniClass.term     : null,
            hostBehaviour      :  hostEl ? (hostEl.textContent || '').trim() : null,
            typeCount          :  types.length,
            types              :  types,
            parameterColumns   :  parameterColumns,
            documentParameters :  documentParameters
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Recover the Zipped PartAtom Held in an RVT Project File
    // ------------------------------------------------------------
    // Project files store the same partatom schema, but DEFLATE compressed inside
    // a single ZIP local file record rather than as plain text.
    async function Na__RevitReader__ReadZippedProjectInfo(rawBytes) {
        if (!rawBytes || rawBytes.length < ZIP_HEADER_SIZE) return null;

        const headerAt = Na__RevitReader__FindSignature(rawBytes, ZIP_LOCAL_HEADER, 0);
        if (headerAt < 0) return null;

        const view   =  new DataView(rawBytes.buffer, rawBytes.byteOffset, rawBytes.byteLength);
        const method =  view.getUint16(headerAt + ZIP_COMPRESSION_METHOD, true);
        if (method !== 8) return null;                                            // <-- Only deflate is produced by Revit here

        const compressedSize =  view.getUint32(headerAt + ZIP_COMPRESSED_SIZE, true);
        const nameLength     =  view.getUint16(headerAt + ZIP_NAME_LENGTH,     true);
        const extraLength    =  view.getUint16(headerAt + ZIP_EXTRA_LENGTH,    true);
        const dataStart      =  headerAt + ZIP_HEADER_SIZE + nameLength + extraLength;

        if (compressedSize === 0 || dataStart + compressedSize > rawBytes.length) return null;

        try {
            const inflated = await Na__RevitReader__InflateRaw(rawBytes.subarray(dataStart, dataStart + compressedSize));
            return new TextDecoder('utf-8', { fatal : false }).decode(inflated);
        } catch (err) {
            console.warn('[Na RevitReader] ProjectInformation inflate failed.', err);
            return null;
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// =============================================================================
// REGION | Public Entry Point
// =============================================================================

    // FUNCTION | Read Every Recoverable Piece of Metadata from a Revit File
    // ------------------------------------------------------------
    export async function ReadRevitMetadata(arrayBuffer, fileName) {
        if (!IsCompoundFile(arrayBuffer)) {
            throw new Error(`[Na RevitReader] "${fileName}" is not a Revit compound file. It may be corrupt or renamed.`);
        }

        const compound = ParseCompoundFile(arrayBuffer);
        const record   = {
            fileName        :  fileName,
            containerStreams:  compound.StreamNames(),
            basicFileInfo   :  null,
            preview         :  null,
            schedule        :  null,
            scheduleSource  :  null,
            geometryAvailable: false,                                            // <-- Always false. Stated explicitly so the UI never has to infer it
            warnings        :  []
        };

        // -- Version and provenance -----------------------------------------
        record.basicFileInfo = Na__RevitReader__ParseBasicFileInfo(compound.ReadStream(STREAM_BASIC_INFO));

        // -- Preview thumbnail ----------------------------------------------
        record.preview = Na__RevitReader__ExtractPreviewPng(compound.ReadStream(STREAM_PREVIEW));
        if (!record.preview) record.warnings.push('No preview thumbnail is embedded in this file.');

        // -- Parameter schedule, family first then project ------------------
        const partAtomText = compound.ReadStreamAsText(STREAM_PART_ATOM, 'utf-8');

        if (partAtomText) {
            record.schedule       = Na__RevitReader__ParsePartAtom(partAtomText);
            record.scheduleSource = STREAM_PART_ATOM;
        } else {
            const projectXml = await Na__RevitReader__ReadZippedProjectInfo(compound.ReadStream(STREAM_PROJECT_INFO));
            if (projectXml) {
                record.schedule       = Na__RevitReader__ParsePartAtom(projectXml);
                record.scheduleSource = STREAM_PROJECT_INFO;
            }
        }

        if (!record.schedule) {
            record.warnings.push('No parameter schedule could be recovered. Project files saved without a preview or exchange block carry only version information.');
        }

        record.warnings.push('Geometry cannot be read from Revit files by any open-source library. Convert to IFC to inspect and export the solids.');

        return record;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
