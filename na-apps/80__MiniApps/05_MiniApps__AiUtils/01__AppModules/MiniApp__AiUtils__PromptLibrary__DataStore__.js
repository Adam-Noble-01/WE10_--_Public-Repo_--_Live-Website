// =============================================================================
// NOBLE ARCHITECTURE - AI UTILS - PROMPT LIBRARY - DATA STORE
// =============================================================================
//
// FILE    : MiniApp__AiUtils__PromptLibrary__DataStore__.js
// AUTHOR  : Adam Noble - Noble Architecture
// PURPOSE : Single data access layer for the prompt library
// CREATED : 26-Aug-2026
//
// DESCRIPTION:
// - Loads the taxonomy, prompt manifest, prompt records and snippet blocks.
// - Applies a browser held overlay of unsaved edits on top of the disk records.
// - Journals every write as a pending operation ready to replay to the server.
// - Presents one identical interface whether the source is static files or the
//   future Raspberry Pi API, so no other module knows or cares which is live.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module-Level State
// -----------------------------------------------------------------------------

const Na__AiUtils__StoreState = {
    config          : null,                                                          // Loaded AppConfig JSON object
    taxonomy        : null,                                                          // Loaded taxonomy definition
    snippets        : {},                                                            // Snippet blocks keyed by snippet key
    records         : {},                                                            // Normalised prompt records keyed by id
    overlay         : null,                                                          // Browser held edits, deletions and usage
    connectionMode  : "StaticOnly",                                                  // Resolved mode - StaticOnly or ApiOnly
    apiIsOnline     : false,                                                         // True when the server answered its health check
    lastLoadWarnings: []                                                             // Non fatal load problems surfaced to the UI
};

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Small Shared Helpers
// -----------------------------------------------------------------------------

// HELPER FUNCTION | Format a date object into the Noble Architecture DD-Mmm-YYYY convention
// ------------------------------------------------------------
export function Na__AiUtils__FormatDateStamp(Na__DateObject) {
    const Na__MonthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const Na__Date       = Na__DateObject instanceof Date ? Na__DateObject : new Date();
    const Na__Day        = String(Na__Date.getDate()).padStart(2, "0");
    return `${Na__Day}-${Na__MonthNames[Na__Date.getMonth()]}-${Na__Date.getFullYear()}`;
}
// ------------------------------------------------------------


// HELPER FUNCTION | Convert a stored line array or plain string into a single text block
// ------------------------------------------------------------
export function Na__AiUtils__JoinTextLines(Na__Value) {
    if (Array.isArray(Na__Value)) return Na__Value.join("\n");
    return typeof Na__Value === "string" ? Na__Value : "";
}
// ------------------------------------------------------------


// HELPER FUNCTION | Split a text block back into the readable line array used on disk
// ------------------------------------------------------------
export function Na__AiUtils__SplitTextLines(Na__Text) {
    return String(Na__Text || "").replace(/\r\n/g, "\n").split("\n");
}
// ------------------------------------------------------------


// HELPER FUNCTION | Build a URL safe slug from any free text string
// ------------------------------------------------------------
export function Na__AiUtils__BuildSlug(Na__Text) {
    return String(Na__Text || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60);
}
// ------------------------------------------------------------


// HELPER FUNCTION | Build a PascalCase fragment for use inside a record file name
// ------------------------------------------------------------
function Na__AiUtils__BuildPascalFragment(Na__Text) {
    return String(Na__Text || "")
        .replace(/[^a-zA-Z0-9 ]+/g, " ")
        .split(/\s+/)
        .filter(Boolean)
        .map((Na__Word) => Na__Word.charAt(0).toUpperCase() + Na__Word.slice(1))
        .join("")
        .slice(0, 48);
}
// ------------------------------------------------------------


// HELPER FUNCTION | Deep clone a plain data object without carrying references
// ------------------------------------------------------------
function Na__AiUtils__CloneObject(Na__Value) {
    return JSON.parse(JSON.stringify(Na__Value));
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Record Normalisation and Serialisation
// -----------------------------------------------------------------------------

// FUNCTION | Convert a raw record file into the flat shape used throughout the app
// ------------------------------------------------------------
export function Na__AiUtils__DataStore__NormaliseRecord(Na__RawRecord, Na__SourceFileName) {
    const Na__Meta      = Na__RawRecord.PromptRecord__Meta      || {};
    const Na__Body      = Na__RawRecord.PromptRecord__Body      || {};
    const Na__Usage     = Na__RawRecord.PromptRecord__Usage     || {};
    const Na__Variables = Na__RawRecord.PromptRecord__Variables || [];


    // Map every declared variable into the flat internal shape
    // ------------------------------------
    const Na__MappedVariables = Na__Variables.map((Na__Variable) => ({
        token           : Na__Variable.Variable__Token           || "",
        label           : Na__Variable.Variable__Label           || Na__Variable.Variable__Token || "",
        inputType       : Na__Variable.Variable__InputType       || "Text",
        required        : Na__Variable.Variable__Required        === true,
        defaultValue    : Na__Variable.Variable__DefaultValue    || "",
        placeholder     : Na__Variable.Variable__Placeholder     || "",
        helpText        : Na__Variable.Variable__HelpText        || "",
        omitLineIfEmpty : Na__Variable.Variable__OmitLineIfEmpty === true,
        options         : Array.isArray(Na__Variable.Variable__Options) ? Na__Variable.Variable__Options : []
    }));


    // Assemble the normalised record
    // ------------------------------------
    return {
        id           : Na__Meta.PromptRecord__Id          || "",
        title        : Na__Meta.PromptRecord__Title       || "Untitled Prompt",
        summary      : Na__Meta.PromptRecord__Summary     || "",
        category     : Na__Meta.PromptRecord__Category    || "",
        subCategory  : Na__Meta.PromptRecord__SubCategory || "",
        modelTargets : Array.isArray(Na__Meta.PromptRecord__ModelTargets) ? Na__Meta.PromptRecord__ModelTargets : [],
        keyWords     : Array.isArray(Na__Meta.PromptRecord__KeyWords)     ? Na__Meta.PromptRecord__KeyWords     : [],
        status       : Na__Meta.PromptRecord__Status      || "Active",
        favourite    : Na__Meta.PromptRecord__Favourite   === true,
        version      : Na__Meta.PromptRecord__Version     || "1.0.0",
        created      : Na__Meta.PromptRecord__Created     || "",
        updated      : Na__Meta.PromptRecord__Updated     || "",
        author       : Na__Meta.PromptRecord__Author      || "Adam Noble",
        promptText   : Na__AiUtils__JoinTextLines(Na__Body.PromptRecord__PromptText),
        variables    : Na__MappedVariables,
        copyCount    : Na__Usage.PromptRecord__CopyCount  || 0,
        lastUsed     : Na__Usage.PromptRecord__LastUsed   || null,
        notes        : Na__Usage.PromptRecord__Notes      || "",
        sourceFile   : Na__SourceFileName                 || ""
    };
}
// ------------------------------------------------------------


// FUNCTION | Convert an internal record back into the on-disk file structure
// ------------------------------------------------------------
export function Na__AiUtils__DataStore__SerialiseRecord(Na__Record) {
    return {
        PromptRecord__Meta : {
            PromptRecord__Id           : Na__Record.id,
            PromptRecord__Title        : Na__Record.title,
            PromptRecord__Summary      : Na__Record.summary,
            PromptRecord__Category     : Na__Record.category,
            PromptRecord__SubCategory  : Na__Record.subCategory,
            PromptRecord__ModelTargets : Na__Record.modelTargets,
            PromptRecord__KeyWords     : Na__Record.keyWords,
            PromptRecord__Status       : Na__Record.status,
            PromptRecord__Favourite    : Na__Record.favourite,
            PromptRecord__Version      : Na__Record.version,
            PromptRecord__Created      : Na__Record.created,
            PromptRecord__Updated      : Na__Record.updated,
            PromptRecord__Author       : Na__Record.author
        },

        PromptRecord__Body : {
            PromptRecord__PromptText : Na__AiUtils__SplitTextLines(Na__Record.promptText)
        },

        PromptRecord__Variables : Na__Record.variables.map((Na__Variable) => ({
            Variable__Token           : Na__Variable.token,
            Variable__Label           : Na__Variable.label,
            Variable__InputType       : Na__Variable.inputType,
            Variable__Required        : Na__Variable.required,
            Variable__DefaultValue    : Na__Variable.defaultValue,
            Variable__Placeholder     : Na__Variable.placeholder,
            Variable__HelpText        : Na__Variable.helpText,
            Variable__OmitLineIfEmpty : Na__Variable.omitLineIfEmpty,
            Variable__Options         : Na__Variable.options
        })),

        PromptRecord__Usage : {
            PromptRecord__CopyCount : Na__Record.copyCount,
            PromptRecord__LastUsed  : Na__Record.lastUsed,
            PromptRecord__Notes     : Na__Record.notes
        }
    };
}
// ------------------------------------------------------------


// FUNCTION | Build the canonical on-disk file name for a record
// ------------------------------------------------------------
export function Na__AiUtils__DataStore__BuildRecordFileName(Na__Record) {
    if (Na__Record.sourceFile) return Na__Record.sourceFile;

    const Na__CategoryPart    = Na__AiUtils__BuildPascalFragment(Na__Record.category    || "Uncategorised");
    const Na__SubCategoryPart = Na__AiUtils__BuildPascalFragment(Na__Record.subCategory || "General");
    const Na__TitlePart       = Na__AiUtils__BuildPascalFragment(Na__Record.title       || "Untitled");
    return `PromptRecord__${Na__CategoryPart}__${Na__SubCategoryPart}__${Na__TitlePart}__.json`;
}
// ------------------------------------------------------------


// FUNCTION | Create an empty record pre-filled from the configured new prompt defaults
// ------------------------------------------------------------
export function Na__AiUtils__DataStore__CreateBlankRecord() {
    const Na__Defaults  = Na__AiUtils__StoreState.config.NaMiniApp__Defaults.NaMiniApp__NewPromptDefaults || {};
    const Na__DateStamp = Na__AiUtils__FormatDateStamp(new Date());

    return {
        id           : "",
        title        : "",
        summary      : "",
        category     : Na__Defaults.PromptRecord__Category    || "",
        subCategory  : Na__Defaults.PromptRecord__SubCategory || "",
        modelTargets : [],
        keyWords     : [],
        status       : Na__Defaults.PromptRecord__Status      || "Draft",
        favourite    : false,
        version      : "1.0.0",
        created      : Na__DateStamp,
        updated      : Na__DateStamp,
        author       : Na__Defaults.PromptRecord__Author      || "Adam Noble",
        promptText   : "",
        variables    : [],
        copyCount    : 0,
        lastUsed     : null,
        notes        : "",
        sourceFile   : ""
    };
}
// ------------------------------------------------------------


// FUNCTION | Generate a stable record id from the category, sub category and title
// ------------------------------------------------------------
export function Na__AiUtils__DataStore__BuildRecordId(Na__Record) {
    const Na__CategorySlug    = Na__AiUtils__BuildSlug(Na__Record.category    || "general");
    const Na__SubCategorySlug = Na__AiUtils__BuildSlug(Na__Record.subCategory || "general");
    const Na__TitleSlug       = Na__AiUtils__BuildSlug(Na__Record.title       || "untitled");
    return `prompt__${Na__CategorySlug}__${Na__SubCategorySlug}__${Na__TitleSlug}`;
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Browser Overlay Persistence
// -----------------------------------------------------------------------------

// HELPER FUNCTION | Produce an empty overlay structure
// ------------------------------------------------------------
function Na__AiUtils__CreateEmptyOverlay() {
    return {
        Overlay__Version           : Na__AiUtils__StoreState.config.NaMiniApp__StorageKeys.NaMiniApp__OverlayFormat || 1,
        Overlay__Records           : {},
        Overlay__DeletedIds        : [],
        Overlay__Usage             : {},
        Overlay__PendingOperations : []
    };
}
// ------------------------------------------------------------


// FUNCTION | Read the overlay out of browser storage, falling back to an empty one
// ------------------------------------------------------------
function Na__AiUtils__LoadOverlay() {
    const Na__StorageKey = Na__AiUtils__StoreState.config.NaMiniApp__StorageKeys.NaMiniApp__OverlayKey;

    try {
        const Na__RawValue = window.localStorage.getItem(Na__StorageKey);
        if (!Na__RawValue) return Na__AiUtils__CreateEmptyOverlay();

        const Na__Parsed = JSON.parse(Na__RawValue);
        return {
            Overlay__Version           : Na__Parsed.Overlay__Version           || 1,
            Overlay__Records           : Na__Parsed.Overlay__Records           || {},
            Overlay__DeletedIds        : Na__Parsed.Overlay__DeletedIds        || [],
            Overlay__Usage             : Na__Parsed.Overlay__Usage             || {},
            Overlay__PendingOperations : Na__Parsed.Overlay__PendingOperations || []
        };


    // Error handling
    // ------------------------------------
    } catch (Na__ErrorObject) {
        console.warn("Prompt library overlay could not be read - starting clean.", Na__ErrorObject);
        return Na__AiUtils__CreateEmptyOverlay();
    }
}
// ------------------------------------------------------------


// FUNCTION | Write the overlay back into browser storage
// ------------------------------------------------------------
function Na__AiUtils__PersistOverlay() {
    const Na__StorageKey = Na__AiUtils__StoreState.config.NaMiniApp__StorageKeys.NaMiniApp__OverlayKey;

    try {
        window.localStorage.setItem(Na__StorageKey, JSON.stringify(Na__AiUtils__StoreState.overlay));


    // Error handling
    // ------------------------------------
    } catch (Na__ErrorObject) {
        console.error("Prompt library overlay could not be saved.", Na__ErrorObject);
    }
}
// ------------------------------------------------------------


// FUNCTION | Append one write operation to the replay journal
// ------------------------------------------------------------
function Na__AiUtils__QueuePendingOperation(Na__OperationType, Na__RecordId, Na__Payload) {
    if (Na__AiUtils__StoreState.apiIsOnline) return;                                 // Server writes need no journal entry

    const Na__Journal = Na__AiUtils__StoreState.overlay.Overlay__PendingOperations;
    const Na__Existing = Na__Journal.findIndex((Na__Entry) => Na__Entry.Operation__RecordId === Na__RecordId);
    if (Na__Existing !== -1) Na__Journal.splice(Na__Existing, 1);                     // Collapse repeat edits of one record

    Na__Journal.push({
        Operation__Type      : Na__OperationType,
        Operation__RecordId  : Na__RecordId,
        Operation__Timestamp : new Date().toISOString(),
        Operation__Payload   : Na__Payload || null
    });
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Network Helpers
// -----------------------------------------------------------------------------

// HELPER FUNCTION | Fetch and parse a JSON file, throwing a readable error on failure
// ------------------------------------------------------------
async function Na__AiUtils__FetchJsonFile(Na__Url) {
    const Na__Response = await fetch(Na__Url, { cache: "no-cache" });
    if (!Na__Response.ok) throw new Error(`Failed to load ${Na__Url} (HTTP ${Na__Response.status}).`);
    return await Na__Response.json();
}
// ------------------------------------------------------------


// HELPER FUNCTION | Build the request headers, including the optional API auth header
// ------------------------------------------------------------
function Na__AiUtils__BuildApiHeaders() {
    const Na__Server  = Na__AiUtils__StoreState.config.NaMiniApp__ServerConfig;
    const Na__Headers = { "Content-Type": "application/json" };
    if (Na__Server.NaMiniApp__ApiAuthHeader && Na__Server.NaMiniApp__ApiAuthToken) {
        Na__Headers[Na__Server.NaMiniApp__ApiAuthHeader] = Na__Server.NaMiniApp__ApiAuthToken;
    }
    return Na__Headers;
}
// ------------------------------------------------------------


// FUNCTION | Call the prompt server with a timeout, returning null when unreachable
// ------------------------------------------------------------
async function Na__AiUtils__CallApi(Na__Path, Na__Method, Na__BodyObject) {
    const Na__Server     = Na__AiUtils__StoreState.config.NaMiniApp__ServerConfig;
    const Na__Controller = new AbortController();
    const Na__TimeoutId  = window.setTimeout(() => Na__Controller.abort(), Na__Server.NaMiniApp__ApiTimeoutMs || 2500);

    try {
        const Na__Response = await fetch(`${Na__Server.NaMiniApp__ApiBaseUrl}${Na__Path}`, {
            method  : Na__Method || "GET",
            headers : Na__AiUtils__BuildApiHeaders(),
            body    : Na__BodyObject ? JSON.stringify(Na__BodyObject) : undefined,
            signal  : Na__Controller.signal
        });

        if (!Na__Response.ok) return null;
        if (Na__Response.status === 204) return {};
        return await Na__Response.json();


    // Error handling
    // ------------------------------------
    } catch (Na__ErrorObject) {
        return null;

    } finally {
        window.clearTimeout(Na__TimeoutId);
    }
}
// ------------------------------------------------------------


// FUNCTION | Ping the server health endpoint to decide which mode the app runs in
// ------------------------------------------------------------
async function Na__AiUtils__ProbeApiAvailability() {
    const Na__Server = Na__AiUtils__StoreState.config.NaMiniApp__ServerConfig;
    const Na__Mode   = Na__Server.NaMiniApp__ConnectionMode || "Auto";

    if (Na__Mode === "StaticOnly") return false;
    if (!Na__Server.NaMiniApp__ApiBaseUrl) return false;

    const Na__HealthResult = await Na__AiUtils__CallApi(Na__Server.NaMiniApp__ApiHealthPath || "/health", "GET", null);
    return Na__HealthResult !== null;
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Library Loading
// -----------------------------------------------------------------------------

// FUNCTION | Load every prompt record file listed in the manifest
// ------------------------------------------------------------
async function Na__AiUtils__LoadRecordsFromStaticFiles(Na__PromptIndex) {
    const Na__Sources    = Na__AiUtils__StoreState.config.NaMiniApp__DataSources;
    const Na__RecordList = Na__PromptIndex.PromptIndex__Records || {};
    const Na__Entries    = Object.keys(Na__RecordList).map((Na__Key) => ({
        recordId  : Na__Key,
        fileName  : Na__RecordList[Na__Key].Record__FileName,
        loadOrder : Na__RecordList[Na__Key].Record__LoadOrder || 999
    }));


    // Fetch every record file in parallel and keep the ones that resolve
    // ------------------------------------
    const Na__Loaded = await Promise.all(Na__Entries.map(async (Na__Entry) => {
        try {
            const Na__RawRecord = await Na__AiUtils__FetchJsonFile(`${Na__Sources.NaMiniApp__PromptRecordPath}${Na__Entry.fileName}`);
            return Na__AiUtils__DataStore__NormaliseRecord(Na__RawRecord, Na__Entry.fileName);

        } catch (Na__ErrorObject) {
            Na__AiUtils__StoreState.lastLoadWarnings.push(`Could not load record file "${Na__Entry.fileName}".`);
            console.warn(Na__ErrorObject);
            return null;
        }
    }));

    return Na__Loaded.filter(Boolean);
}
// ------------------------------------------------------------


// FUNCTION | Load every prompt record from the server
// ------------------------------------------------------------
async function Na__AiUtils__LoadRecordsFromApi() {
    const Na__Server   = Na__AiUtils__StoreState.config.NaMiniApp__ServerConfig;
    const Na__Response = await Na__AiUtils__CallApi(Na__Server.NaMiniApp__ApiPromptsPath || "/prompts", "GET", null);
    if (!Na__Response) return [];

    const Na__RawList = Array.isArray(Na__Response) ? Na__Response : (Na__Response.prompts || []);
    return Na__RawList.map((Na__RawRecord) => Na__AiUtils__DataStore__NormaliseRecord(Na__RawRecord, ""));
}
// ------------------------------------------------------------


// FUNCTION | Merge the browser overlay on top of the freshly loaded disk records
// ------------------------------------------------------------
function Na__AiUtils__ApplyOverlayToRecords() {
    const Na__Overlay = Na__AiUtils__StoreState.overlay;


    // Drop anything the user deleted locally
    // ------------------------------------
    Na__Overlay.Overlay__DeletedIds.forEach((Na__DeletedId) => {
        delete Na__AiUtils__StoreState.records[Na__DeletedId];
    });


    // Apply locally edited and locally created records
    // ------------------------------------
    Object.keys(Na__Overlay.Overlay__Records).forEach((Na__RecordId) => {
        Na__AiUtils__StoreState.records[Na__RecordId] = Na__AiUtils__CloneObject(Na__Overlay.Overlay__Records[Na__RecordId]);
    });


    // Layer usage statistics over whatever the record files declared
    // ------------------------------------
    Object.keys(Na__Overlay.Overlay__Usage).forEach((Na__RecordId) => {
        const Na__Record = Na__AiUtils__StoreState.records[Na__RecordId];
        if (!Na__Record) return;
        Na__Record.copyCount = Na__Overlay.Overlay__Usage[Na__RecordId].copyCount || Na__Record.copyCount;
        Na__Record.lastUsed  = Na__Overlay.Overlay__Usage[Na__RecordId].lastUsed  || Na__Record.lastUsed;
    });
}
// ------------------------------------------------------------


// FUNCTION | Load the whole library and resolve the active connection mode
// ------------------------------------------------------------
export async function Na__AiUtils__DataStore__Initialise(Na__Config) {
    Na__AiUtils__StoreState.config           = Na__Config;
    Na__AiUtils__StoreState.lastLoadWarnings = [];
    Na__AiUtils__StoreState.overlay          = Na__AiUtils__LoadOverlay();

    const Na__Sources = Na__Config.NaMiniApp__DataSources;
    const Na__Server  = Na__Config.NaMiniApp__ServerConfig;


    // Decide whether the prompt server is answering
    // ------------------------------------
    Na__AiUtils__StoreState.apiIsOnline    = await Na__AiUtils__ProbeApiAvailability();
    Na__AiUtils__StoreState.connectionMode = Na__AiUtils__StoreState.apiIsOnline ? "ApiOnly" : "StaticOnly";

    if (Na__Server.NaMiniApp__ConnectionMode === "ApiOnly" && !Na__AiUtils__StoreState.apiIsOnline) {
        Na__AiUtils__StoreState.lastLoadWarnings.push("Server mode was forced but the prompt server did not answer - showing static files.");
    }


    // Load the taxonomy and snippet definitions
    // ------------------------------------
    Na__AiUtils__StoreState.taxonomy = await Na__AiUtils__FetchJsonFile(Na__Sources.NaMiniApp__TaxonomyFile);
    const Na__SnippetFile            = await Na__AiUtils__FetchJsonFile(Na__Sources.NaMiniApp__SnippetFile);
    Na__AiUtils__StoreState.snippets = Na__SnippetFile.SnippetLibrary__Snippets || {};


    // Load the prompt records from whichever source is live
    // ------------------------------------
    let Na__LoadedRecords = [];
    if (Na__AiUtils__StoreState.apiIsOnline) {
        Na__LoadedRecords = await Na__AiUtils__LoadRecordsFromApi();
    }

    if (!Na__LoadedRecords.length) {
        const Na__PromptIndex = await Na__AiUtils__FetchJsonFile(Na__Sources.NaMiniApp__PromptIndexFile);
        Na__LoadedRecords     = await Na__AiUtils__LoadRecordsFromStaticFiles(Na__PromptIndex);
    }

    Na__AiUtils__StoreState.records = {};
    Na__LoadedRecords.forEach((Na__Record) => {
        Na__AiUtils__StoreState.records[Na__Record.id] = Na__Record;
    });


    // Layer the browser held edits on top
    // ------------------------------------
    Na__AiUtils__ApplyOverlayToRecords();

    return {
        taxonomy : Na__AiUtils__StoreState.taxonomy,
        snippets : Na__AiUtils__StoreState.snippets,
        prompts  : Na__AiUtils__DataStore__GetPromptList(),
        warnings : Na__AiUtils__StoreState.lastLoadWarnings
    };
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Read Accessors
// -----------------------------------------------------------------------------

// HELPER FUNCTION | Return every loaded prompt record as an array
// ------------------------------------------------------------
export function Na__AiUtils__DataStore__GetPromptList() {
    return Object.keys(Na__AiUtils__StoreState.records).map((Na__Key) => Na__AiUtils__StoreState.records[Na__Key]);
}
// ------------------------------------------------------------


// HELPER FUNCTION | Return one prompt record by its id
// ------------------------------------------------------------
export function Na__AiUtils__DataStore__GetPromptById(Na__RecordId) {
    return Na__AiUtils__StoreState.records[Na__RecordId] || null;
}
// ------------------------------------------------------------


// HELPER FUNCTION | Return the loaded taxonomy definition
// ------------------------------------------------------------
export function Na__AiUtils__DataStore__GetTaxonomy() {
    return Na__AiUtils__StoreState.taxonomy;
}
// ------------------------------------------------------------


// HELPER FUNCTION | Return the loaded snippet block definitions
// ------------------------------------------------------------
export function Na__AiUtils__DataStore__GetSnippets() {
    return Na__AiUtils__StoreState.snippets;
}
// ------------------------------------------------------------


// HELPER FUNCTION | Report the live connection state for the status pill
// ------------------------------------------------------------
export function Na__AiUtils__DataStore__GetConnectionState() {
    return {
        mode            : Na__AiUtils__StoreState.connectionMode,
        apiIsOnline     : Na__AiUtils__StoreState.apiIsOnline,
        pendingCount    : Na__AiUtils__StoreState.overlay ? Na__AiUtils__StoreState.overlay.Overlay__PendingOperations.length : 0,
        localEditCount  : Na__AiUtils__StoreState.overlay ? Object.keys(Na__AiUtils__StoreState.overlay.Overlay__Records).length : 0
    };
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Write Operations
// -----------------------------------------------------------------------------

// FUNCTION | Insert or update a prompt record
// ------------------------------------------------------------
export async function Na__AiUtils__DataStore__SavePrompt(Na__Record) {
    const Na__Server = Na__AiUtils__StoreState.config.NaMiniApp__ServerConfig;
    const Na__Stored = Na__AiUtils__CloneObject(Na__Record);

    Na__Stored.updated = Na__AiUtils__FormatDateStamp(new Date());
    if (!Na__Stored.created) Na__Stored.created = Na__Stored.updated;
    if (!Na__Stored.id)      Na__Stored.id      = Na__AiUtils__DataStore__BuildRecordId(Na__Stored);


    // Hold the record in memory so the UI updates immediately
    // ------------------------------------
    Na__AiUtils__StoreState.records[Na__Stored.id] = Na__Stored;

    const Na__DeletedIndex = Na__AiUtils__StoreState.overlay.Overlay__DeletedIds.indexOf(Na__Stored.id);
    if (Na__DeletedIndex !== -1) Na__AiUtils__StoreState.overlay.Overlay__DeletedIds.splice(Na__DeletedIndex, 1);


    // Push straight to the server when one is answering
    // ------------------------------------
    if (Na__AiUtils__StoreState.apiIsOnline) {
        const Na__Path     = `${Na__Server.NaMiniApp__ApiPromptsPath || "/prompts"}/${encodeURIComponent(Na__Stored.id)}`;
        const Na__Response = await Na__AiUtils__CallApi(Na__Path, "PUT", Na__AiUtils__DataStore__SerialiseRecord(Na__Stored));

        if (Na__Response !== null) return Na__Stored;
        Na__AiUtils__StoreState.apiIsOnline = false;                                 // Server dropped mid session - fall back
    }


    // Otherwise hold it in the browser overlay and journal the write
    // ------------------------------------
    Na__AiUtils__StoreState.overlay.Overlay__Records[Na__Stored.id] = Na__Stored;
    Na__AiUtils__QueuePendingOperation("Upsert", Na__Stored.id, Na__AiUtils__DataStore__SerialiseRecord(Na__Stored));
    Na__AiUtils__PersistOverlay();

    return Na__Stored;
}
// ------------------------------------------------------------


// FUNCTION | Remove a prompt record
// ------------------------------------------------------------
export async function Na__AiUtils__DataStore__DeletePrompt(Na__RecordId) {
    const Na__Server = Na__AiUtils__StoreState.config.NaMiniApp__ServerConfig;

    delete Na__AiUtils__StoreState.records[Na__RecordId];
    delete Na__AiUtils__StoreState.overlay.Overlay__Records[Na__RecordId];


    // Delete on the server when one is answering
    // ------------------------------------
    if (Na__AiUtils__StoreState.apiIsOnline) {
        const Na__Path     = `${Na__Server.NaMiniApp__ApiPromptsPath || "/prompts"}/${encodeURIComponent(Na__RecordId)}`;
        const Na__Response = await Na__AiUtils__CallApi(Na__Path, "DELETE", null);

        if (Na__Response !== null) return true;
        Na__AiUtils__StoreState.apiIsOnline = false;
    }


    // Otherwise record the deletion locally so it survives a reload
    // ------------------------------------
    if (!Na__AiUtils__StoreState.overlay.Overlay__DeletedIds.includes(Na__RecordId)) {
        Na__AiUtils__StoreState.overlay.Overlay__DeletedIds.push(Na__RecordId);
    }

    Na__AiUtils__QueuePendingOperation("Delete", Na__RecordId, null);
    Na__AiUtils__PersistOverlay();

    return true;
}
// ------------------------------------------------------------


// FUNCTION | Flip the favourite flag on a record and persist it
// ------------------------------------------------------------
export async function Na__AiUtils__DataStore__ToggleFavourite(Na__RecordId) {
    const Na__Record = Na__AiUtils__StoreState.records[Na__RecordId];
    if (!Na__Record) return null;

    Na__Record.favourite = !Na__Record.favourite;
    return await Na__AiUtils__DataStore__SavePrompt(Na__Record);
}
// ------------------------------------------------------------


// FUNCTION | Log a copy event against a record for the usage ranking
// ------------------------------------------------------------
export function Na__AiUtils__DataStore__RecordCopyEvent(Na__RecordId) {
    const Na__Record = Na__AiUtils__StoreState.records[Na__RecordId];
    if (!Na__Record) return;

    Na__Record.copyCount = (Na__Record.copyCount || 0) + 1;
    Na__Record.lastUsed  = new Date().toISOString();

    Na__AiUtils__StoreState.overlay.Overlay__Usage[Na__RecordId] = {
        copyCount : Na__Record.copyCount,
        lastUsed  : Na__Record.lastUsed
    };

    Na__AiUtils__PersistOverlay();
}
// ------------------------------------------------------------


// FUNCTION | Replay every journalled write against the server once it is available
// ------------------------------------------------------------
export async function Na__AiUtils__DataStore__FlushPendingOperations() {
    const Na__Server  = Na__AiUtils__StoreState.config.NaMiniApp__ServerConfig;
    const Na__Journal = Na__AiUtils__StoreState.overlay.Overlay__PendingOperations;

    if (!Na__Journal.length) return { flushed: 0, remaining: 0 };

    Na__AiUtils__StoreState.apiIsOnline = await Na__AiUtils__ProbeApiAvailability();
    if (!Na__AiUtils__StoreState.apiIsOnline) return { flushed: 0, remaining: Na__Journal.length };

    let Na__FlushedCount = 0;


    // Replay each entry in the order it was recorded
    // ------------------------------------
    for (const Na__Entry of [...Na__Journal]) {
        const Na__BasePath = Na__Server.NaMiniApp__ApiPromptsPath || "/prompts";
        const Na__Path     = `${Na__BasePath}/${encodeURIComponent(Na__Entry.Operation__RecordId)}`;
        const Na__Method   = Na__Entry.Operation__Type === "Delete" ? "DELETE" : "PUT";
        const Na__Response = await Na__AiUtils__CallApi(Na__Path, Na__Method, Na__Entry.Operation__Payload);

        if (Na__Response === null) break;                                            // Stop on first failure and keep the rest

        Na__Journal.splice(Na__Journal.indexOf(Na__Entry), 1);
        delete Na__AiUtils__StoreState.overlay.Overlay__Records[Na__Entry.Operation__RecordId];
        Na__FlushedCount += 1;
    }

    Na__AiUtils__StoreState.connectionMode = "ApiOnly";
    Na__AiUtils__PersistOverlay();

    return { flushed: Na__FlushedCount, remaining: Na__Journal.length };
}
// ------------------------------------------------------------


// FUNCTION | Discard every locally held edit and revert to the files on disk
// ------------------------------------------------------------
export function Na__AiUtils__DataStore__ClearLocalOverlay() {
    Na__AiUtils__StoreState.overlay = Na__AiUtils__CreateEmptyOverlay();
    Na__AiUtils__PersistOverlay();
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Import and Export
// -----------------------------------------------------------------------------

// HELPER FUNCTION | Trigger a browser download of a text payload
// ------------------------------------------------------------
function Na__AiUtils__TriggerFileDownload(Na__FileName, Na__TextContent) {
    const Na__Blob       = new Blob([Na__TextContent], { type: "application/json;charset=utf-8" });
    const Na__ObjectUrl  = URL.createObjectURL(Na__Blob);
    const Na__LinkElement = document.createElement("a");

    Na__LinkElement.href     = Na__ObjectUrl;
    Na__LinkElement.download = Na__FileName;
    document.body.appendChild(Na__LinkElement);
    Na__LinkElement.click();
    document.body.removeChild(Na__LinkElement);

    window.setTimeout(() => URL.revokeObjectURL(Na__ObjectUrl), 1000);
}
// ------------------------------------------------------------


// FUNCTION | Download one record as the exact JSON file to drop into the repo
// ------------------------------------------------------------
export function Na__AiUtils__DataStore__DownloadRecordFile(Na__Record) {
    const Na__FileName = Na__AiUtils__DataStore__BuildRecordFileName(Na__Record);
    const Na__Payload  = JSON.stringify(Na__AiUtils__DataStore__SerialiseRecord(Na__Record), null, 4);
    Na__AiUtils__TriggerFileDownload(Na__FileName, Na__Payload);
    return Na__FileName;
}
// ------------------------------------------------------------


// FUNCTION | Download the whole library as a single portable bundle
// ------------------------------------------------------------
export function Na__AiUtils__DataStore__DownloadLibraryBundle() {
    const Na__Records = Na__AiUtils__DataStore__GetPromptList();

    const Na__Bundle = {
        Bundle__Meta : {
            Bundle__ExportedOn   : new Date().toISOString(),
            Bundle__RecordCount  : Na__Records.length,
            Bundle__AppVersion   : Na__AiUtils__StoreState.config.NaMiniApp__Meta.NaMiniApp__Version,
            Bundle__Description  : "Full export of the AI Prompt Library. Each entry below is a complete prompt record file - split them back out into 02__AppData/03__PromptRecords/ and list them in PromptLibrary__PromptIndex__.json, or POST the array straight at the prompt server."
        },
        Bundle__Records : Na__Records.map((Na__Record) => ({
            Bundle__FileName : Na__AiUtils__DataStore__BuildRecordFileName(Na__Record),
            Bundle__Record   : Na__AiUtils__DataStore__SerialiseRecord(Na__Record)
        }))
    };

    const Na__FileName = `PromptLibrary__Bundle__${Na__AiUtils__FormatDateStamp(new Date())}__.json`;
    Na__AiUtils__TriggerFileDownload(Na__FileName, JSON.stringify(Na__Bundle, null, 4));
    return Na__FileName;
}
// ------------------------------------------------------------


// FUNCTION | Download only the records edited or created in this browser
// ------------------------------------------------------------
export function Na__AiUtils__DataStore__DownloadChangedRecords() {
    const Na__ChangedIds = Object.keys(Na__AiUtils__StoreState.overlay.Overlay__Records);
    if (!Na__ChangedIds.length) return null;

    const Na__Bundle = {
        Bundle__Meta : {
            Bundle__ExportedOn  : new Date().toISOString(),
            Bundle__RecordCount : Na__ChangedIds.length,
            Bundle__Description : "Prompt records added or edited in the browser and not yet written back to the repo or the prompt server."
        },
        Bundle__Records : Na__ChangedIds.map((Na__RecordId) => ({
            Bundle__FileName : Na__AiUtils__DataStore__BuildRecordFileName(Na__AiUtils__StoreState.overlay.Overlay__Records[Na__RecordId]),
            Bundle__Record   : Na__AiUtils__DataStore__SerialiseRecord(Na__AiUtils__StoreState.overlay.Overlay__Records[Na__RecordId])
        }))
    };

    const Na__FileName = `PromptLibrary__ChangedRecords__${Na__AiUtils__FormatDateStamp(new Date())}__.json`;
    Na__AiUtils__TriggerFileDownload(Na__FileName, JSON.stringify(Na__Bundle, null, 4));
    return Na__FileName;
}
// ------------------------------------------------------------


// FUNCTION | Merge an exported bundle back into the library
// ------------------------------------------------------------
export async function Na__AiUtils__DataStore__ImportLibraryBundle(Na__JsonText) {
    const Na__Parsed  = JSON.parse(Na__JsonText);
    const Na__Entries = Na__Parsed.Bundle__Records || [];
    let   Na__Imported = 0;


    // Accept either a full bundle or a bare array of record objects
    // ------------------------------------
    const Na__RawRecords = Na__Entries.length
        ? Na__Entries.map((Na__Entry) => ({ raw: Na__Entry.Bundle__Record, file: Na__Entry.Bundle__FileName }))
        : (Array.isArray(Na__Parsed) ? Na__Parsed.map((Na__Raw) => ({ raw: Na__Raw, file: "" })) : []);

    for (const Na__Item of Na__RawRecords) {
        if (!Na__Item.raw || !Na__Item.raw.PromptRecord__Meta) continue;
        const Na__Record = Na__AiUtils__DataStore__NormaliseRecord(Na__Item.raw, Na__Item.file);
        await Na__AiUtils__DataStore__SavePrompt(Na__Record);
        Na__Imported += 1;
    }

    return Na__Imported;
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------
