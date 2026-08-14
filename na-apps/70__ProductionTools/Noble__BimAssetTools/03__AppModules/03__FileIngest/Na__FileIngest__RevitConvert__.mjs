/* =============================================================================
   NOBLE BIM ASSET TOOLS | FILE INGEST - REVIT CONVERSION CLIENT
   =============================================================================

   FILE       : Na__FileIngest__RevitConvert__.mjs
   NAMESPACE  : Na__BimAssetTools
   MODULE     : FileIngest - RevitConvert
   AUTHOR     : Adam Noble - Noble Architecture
   PURPOSE    : Drive the local server's Revit to IFC conversion from the browser
   CREATED    : 14-Aug-2026

   DESCRIPTION:
   - Closes the loop that the first version left open. Telling the user to go and
     convert a file themselves is not a feature; this hands the file to the local
     server, watches the conversion, and brings the IFC straight back into the
     application.
   - A browser cannot launch an executable, and should not be able to. The local
     Python server brokers it instead, which is why this is a client rather than
     a converter.

   ---------------------------------------------------------------------------

   PROTOCOL:

     GET  /api/capabilities            Is a converter present on this machine?
     POST /api/convert/start           Raw file bytes, name in X-Na-Filename.
                                       Returns { jobId } with 202.
     GET  /api/convert/status?job=id   { state, percent, message, elapsedMs }
     GET  /api/convert/result?job=id   The IFC bytes once state is 'completed'.

   Conversion runs on a background thread server side and is polled rather than
   held open on one long request, because a large project takes minutes and a
   stalled request tells the user nothing.

   ---------------------------------------------------------------------------

   WHEN THERE IS NO SERVER:
   The application is also intended to run hosted, where no local converter
   exists. IsConversionAvailable resolves false in that case and the interface
   simply does not offer the action, rather than offering it and failing.

   ============================================================================= */

// =============================================================================
// REGION | Module Constants
// =============================================================================

    // MODULE CONSTANTS | API Routes and Polling Behaviour
    // ------------------------------------------------------------
    const ROUTE_CAPABILITIES  =  './api/capabilities';
    const ROUTE_START         =  './api/convert/start';
    const ROUTE_STATUS        =  './api/convert/status';
    const ROUTE_RESULT        =  './api/convert/result';

    const POLL_INTERVAL_MS    =  700;                                            // <-- Fast enough to feel live, slow enough not to spam the server
    const POLL_TIMEOUT_MS     =  900000;                                         // <-- 15 minutes, matching the server's own conversion timeout
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// =============================================================================
// REGION | Capability Detection
// =============================================================================

    // MODULE STATE | Cached Capability Probe
    // ------------------------------------------------------------
    let CAPABILITY_PROBE = null;                                                 // <-- In-flight or resolved promise; probed once per session
    // ------------------------------------------------------------


    // FUNCTION | Ask the Server What It Can Do
    // ------------------------------------------------------------
    // Never throws. A missing server, a hosted deployment or a 404 all resolve to
    // the same "conversion is not available here" answer.
    export function ProbeCapabilities() {
        if (CAPABILITY_PROBE) return CAPABILITY_PROBE;

        CAPABILITY_PROBE = (async function Na__RevitConvert__Probe() {
            try {
                const response = await fetch(ROUTE_CAPABILITIES, { cache : 'no-store' });
                if (!response.ok) return { revitConversion : false };

                return await response.json();
            } catch {
                return { revitConversion : false };                               // <-- No local server; running hosted or offline
            }
        })();

        return CAPABILITY_PROBE;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is Revit Conversion Available on This Machine
    // ------------------------------------------------------------
    export async function IsConversionAvailable() {
        const capabilities = await ProbeCapabilities();
        return capabilities.revitConversion === true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// =============================================================================
// REGION | Conversion
// =============================================================================

    // HELPER FUNCTION | Read a JSON Error Body, Falling Back to the Status Text
    // ------------------------------------------------------------
    async function Na__RevitConvert__ErrorFrom(response) {
        try {
            const body = await response.json();
            if (body && body.error) return body.error;
        } catch {
            // Body was not JSON; the status line is all there is.
        }
        return `Server returned HTTP ${response.status}.`;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Wait
    // ------------------------------------------------------------
    function Na__RevitConvert__Wait(milliseconds) {
        return new Promise(resolve => setTimeout(resolve, milliseconds));
    }
    // ------------------------------------------------------------


    // FUNCTION | Convert a Revit File and Return the IFC as a File Object
    // ------------------------------------------------------------
    // onProgress receives { percent, message, elapsedMs } as the job advances, so
    // the caller can drive a status line without knowing the protocol.
    export async function ConvertRevitToIfc(sourceFile, onProgress) {
        const report = (percent, message, elapsedMs) => {
            if (onProgress) onProgress({ percent : percent, message : message, elapsedMs : elapsedMs || 0 });
        };

        report(0, 'Uploading to the local converter...');

        // -- Start the job -----------------------------------------------------
        const startResponse = await fetch(ROUTE_START, {
            method  : 'POST',
            headers : { 'X-Na-Filename' : sourceFile.name, 'Content-Type' : 'application/octet-stream' },
            body    : sourceFile
        });

        if (!startResponse.ok) {
            throw new Error(`Conversion could not be started. ${await Na__RevitConvert__ErrorFrom(startResponse)}`);
        }

        const { jobId } = await startResponse.json();
        if (!jobId) throw new Error('The server accepted the file but returned no job id.');

        // -- Poll to completion -------------------------------------------------
        const startedAt = Date.now();
        let   lastState = null;

        while (true) {
            if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
                throw new Error('Conversion did not finish within 15 minutes and has been abandoned.');
            }

            await Na__RevitConvert__Wait(POLL_INTERVAL_MS);

            const statusResponse = await fetch(`${ROUTE_STATUS}?job=${encodeURIComponent(jobId)}`, { cache : 'no-store' });
            if (!statusResponse.ok) {
                throw new Error(`Lost track of the conversion. ${await Na__RevitConvert__ErrorFrom(statusResponse)}`);
            }

            const status = await statusResponse.json();
            lastState = status.state;

            report(status.percent, status.message, status.elapsedMs);

            if (status.state === 'completed') break;

            if (status.state === 'failed') {
                throw new Error(`Conversion failed. ${status.message}`);
            }
        }

        // -- Collect the IFC ----------------------------------------------------
        report(100, 'Downloading the converted IFC...');

        const resultResponse = await fetch(`${ROUTE_RESULT}?job=${encodeURIComponent(jobId)}`, { cache : 'no-store' });
        if (!resultResponse.ok) {
            throw new Error(`Converted file could not be collected. ${await Na__RevitConvert__ErrorFrom(resultResponse)}`);
        }

        const ifcName  = resultResponse.headers.get('X-Na-Filename')
                      || sourceFile.name.replace(/\.[^.]+$/, '') + '.ifc';
        const ifcBytes = await resultResponse.arrayBuffer();

        if (ifcBytes.byteLength === 0) throw new Error('The converter returned an empty IFC file.');

        report(100, `Converted to ${ifcName} (${(ifcBytes.byteLength / 1048576).toFixed(2)} MB).`);

        // -- Handed back as a File so it can go through the ordinary ingest path
        // -- with no special casing anywhere downstream.
        return new File([ifcBytes], ifcName, { type : 'application/x-step' });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
