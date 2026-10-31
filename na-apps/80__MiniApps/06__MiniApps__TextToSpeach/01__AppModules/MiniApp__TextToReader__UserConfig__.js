// =============================================================================
// NOBLE ARCHITECTURE - TEXT TO READER - USER CONFIG
// =============================================================================
//
// FILE    : MiniApp__TextToReader__UserConfig__.js
// AUTHOR  : Adam Noble - Noble Architecture
// PURPOSE : Remember this user's choices between sessions (voice, speed, pitch,
//           reading in sections, last file and the folder it came from)
// CREATED : 27-Oct-2026
//
// STORAGE : One JSON document, kept in two places so neither is a single point of loss:
//   - localStorage  NaTextToReader__UserConfig        read synchronously at launch
//   - Cache Storage NaTextToReader__UserConfig        the same JSON as a file,
//                   ./MiniApp__TextToReader__UserConfig__.json (open it in the browser
//                   to see it). The service worker purges only NaTextToReader__Shell__*
//                   caches, so this one outlasts every app release.
//   On launch the newer of the two (NaUserConfig__Updated) wins and both are rewritten.
//   The last opened file's handle cannot go in JSON; it lives in IndexedDB, and the
//   file picker starts in its folder. The page asks the browser for persistent storage
//   so none of this is evicted under storage pressure.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module-Level Variables
// -----------------------------------------------------------------------------

 const Na__UserConfig__StorageKey   = "NaTextToReader__UserConfig";
 const Na__UserConfig__CacheName    = "NaTextToReader__UserConfig";
 const Na__UserConfig__FileUrl      = new URL("../MiniApp__TextToReader__UserConfig__.json", import.meta.url).href;
 const Na__UserConfig__DbName       = "NaTextToReader__UserConfig";
 const Na__UserConfig__DbStore      = "NaUserConfig__Handles";
 const Na__UserConfig__LastFileKey  = "NaUserConfig__LastOpenedFile";
 const Na__UserConfig__SchemaVersion = 1;

 // Loose keys from 1.8.x, folded into the document once and then removed
 const Na__UserConfig__LegacyKeys = {
     Model : "NaTextToReader__ReadAloudModel",
     Speed : "NaTextToReader__PhononSpeed",
     Pitch : "NaTextToReader__VoicePitch"
 };

 let Na__UserConfig__Document   = Na__UserConfig__BuildDefaults({}, "");
 let Na__UserConfig__CacheTimer = 0;

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Document
// -----------------------------------------------------------------------------

// FUNCTION | BuildDefaults - A fresh user's document, from the AppConfig defaults
// ------------------------------------------------------------
function Na__UserConfig__BuildDefaults(Na__ReadAloudConfig, Na__AppVersion) {
    const Na__Now = new Date().toISOString();
    return {
        "NaUserConfig__Meta" : {
            "NaUserConfig__App"           : "Text To Reader",
            "NaUserConfig__SchemaVersion" : Na__UserConfig__SchemaVersion,
            "NaUserConfig__AppVersion"    : Na__AppVersion,
            "NaUserConfig__Created"       : Na__Now,
            "NaUserConfig__Updated"       : ""
        },
        "NaUserConfig__ReadAloud" : {
            "NaUserConfig__VoiceModelId"  : Na__ReadAloudConfig.NaMiniApp__DefaultModelId || null,
            "NaUserConfig__PlaybackSpeed" : Number(Na__ReadAloudConfig.NaMiniApp__DefaultSpeed) || 2,
            "NaUserConfig__PitchPercent"  : 0,
            "NaUserConfig__SectionedReading" : true
        },
        "NaUserConfig__Files" : {
            "NaUserConfig__LastFileName"   : null,
            "NaUserConfig__LastFileOpened" : null,
            "NaUserConfig__FolderRemembered" : false
        }
    };
}
// ------------------------------------------------------------


// FUNCTION | MergeOver - Saved values over the defaults, section by section
// Sections and keys the defaults do not know are dropped, so an old or edited
// file can never add junk; new defaults appear for keys a saved file lacks.
// ------------------------------------------------------------
function Na__UserConfig__MergeOver(Na__Defaults, Na__Saved) {
    if (!Na__Saved || typeof Na__Saved !== "object") return Na__Defaults;
    for (const [Na__Section, Na__Values] of Object.entries(Na__Defaults)) {
        const Na__SavedSection = Na__Saved[Na__Section];
        if (!Na__SavedSection || typeof Na__SavedSection !== "object") continue;
        for (const Na__Key of Object.keys(Na__Values)) {
            if (Na__Key in Na__SavedSection) Na__Values[Na__Key] = Na__SavedSection[Na__Key];
        }
    }
    return Na__Defaults;
}
// ------------------------------------------------------------


// FUNCTION | UpdatedTime - When a saved document was last written, 0 if unknown
// ------------------------------------------------------------
function Na__UserConfig__UpdatedTime(Na__Saved) {
    return Date.parse(Na__Saved?.NaUserConfig__Meta?.NaUserConfig__Updated || "") || 0;
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Storage
// -----------------------------------------------------------------------------

// FUNCTION | ReadLocal - The localStorage copy, or null
// ------------------------------------------------------------
function Na__UserConfig__ReadLocal() {
    try {
        return JSON.parse(localStorage.getItem(Na__UserConfig__StorageKey) || "null");
    } catch {
        return null;
    }
}
// ------------------------------------------------------------


// FUNCTION | ReadCached - The Cache Storage copy, or null
// ------------------------------------------------------------
async function Na__UserConfig__ReadCached() {
    if (!("caches" in window)) return null;
    try {
        const Na__Cache = await caches.open(Na__UserConfig__CacheName);
        const Na__Response = await Na__Cache.match(Na__UserConfig__FileUrl);
        return Na__Response ? await Na__Response.json() : null;
    } catch {
        return null;
    }
}
// ------------------------------------------------------------


// FUNCTION | WriteLocal - Save the document to localStorage now
// ------------------------------------------------------------
function Na__UserConfig__WriteLocal() {
    try {
        localStorage.setItem(Na__UserConfig__StorageKey, JSON.stringify(Na__UserConfig__Document));
    } catch {
        // Private windows or a full quota: the cache copy still holds it
    }
}
// ------------------------------------------------------------


// FUNCTION | WriteCached - Save the document as a JSON file in Cache Storage
// ------------------------------------------------------------
async function Na__UserConfig__WriteCached() {
    if (!("caches" in window)) return;
    try {
        const Na__Cache = await caches.open(Na__UserConfig__CacheName);
        await Na__Cache.put(Na__UserConfig__FileUrl, new Response(
            JSON.stringify(Na__UserConfig__Document, null, 4),
            { headers: { "Content-Type": "application/json; charset=utf-8" } }
        ));
    } catch (Na__Error) {
        console.warn("Text To Reader: user config not written to the app cache:", Na__Error);
    }
}
// ------------------------------------------------------------


// FUNCTION | Save - Stamp the time, write localStorage now and the cache file shortly
// ------------------------------------------------------------
function Na__UserConfig__Save() {
    Na__UserConfig__Document.NaUserConfig__Meta.NaUserConfig__Updated = new Date().toISOString();
    Na__UserConfig__WriteLocal();
    clearTimeout(Na__UserConfig__CacheTimer);
    Na__UserConfig__CacheTimer = setTimeout(Na__UserConfig__WriteCached, 400);
}
// ------------------------------------------------------------


// FUNCTION | MigrateLegacyKeys - Fold the 1.8.x loose keys into the document, then remove them
// ------------------------------------------------------------
function Na__UserConfig__MigrateLegacyKeys() {
    const Na__ReadAloud = Na__UserConfig__Document.NaUserConfig__ReadAloud;
    try {
        const Na__Model = localStorage.getItem(Na__UserConfig__LegacyKeys.Model);
        const Na__Speed = Number(localStorage.getItem(Na__UserConfig__LegacyKeys.Speed));
        const Na__Pitch = localStorage.getItem(Na__UserConfig__LegacyKeys.Pitch);
        if (Na__Model) Na__ReadAloud.NaUserConfig__VoiceModelId = Na__Model;
        if (Na__Speed) Na__ReadAloud.NaUserConfig__PlaybackSpeed = Na__Speed;
        if (Na__Pitch !== null) Na__ReadAloud.NaUserConfig__PitchPercent = Number(Na__Pitch) || 0;
        Object.values(Na__UserConfig__LegacyKeys).forEach((Na__Key) => localStorage.removeItem(Na__Key));
    } catch {
        // No localStorage: nothing to migrate
    }
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | File Handle (IndexedDB)
// -----------------------------------------------------------------------------

// FUNCTION | WithStore - Run one request against the handle store
// ------------------------------------------------------------
function Na__UserConfig__WithStore(Na__Mode, Na__Action) {
    return new Promise((Na__Resolve, Na__Reject) => {
        if (!("indexedDB" in window)) {
            Na__Resolve(null);
            return;
        }
        const Na__Open = indexedDB.open(Na__UserConfig__DbName, 1);
        Na__Open.onupgradeneeded = () => Na__Open.result.createObjectStore(Na__UserConfig__DbStore);
        Na__Open.onerror = () => Na__Reject(Na__Open.error);
        Na__Open.onsuccess = () => {
            const Na__Db = Na__Open.result;
            const Na__Request = Na__Action(Na__Db.transaction(Na__UserConfig__DbStore, Na__Mode).objectStore(Na__UserConfig__DbStore));
            Na__Request.onsuccess = () => {
                Na__Resolve(Na__Request.result ?? null);
                Na__Db.close();
            };
            Na__Request.onerror = () => {
                Na__Reject(Na__Request.error);
                Na__Db.close();
            };
        };
    });
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Exports
// -----------------------------------------------------------------------------

// FUNCTION | LoadUserConfig - Read both copies, keep the newer, fill gaps from defaults
// ------------------------------------------------------------
export async function Na__TextToReader__LoadUserConfig(Na__ReadAloudConfig, Na__AppVersion) {
    const Na__Local  = Na__UserConfig__ReadLocal();
    const Na__Cached = await Na__UserConfig__ReadCached();
    const Na__Newest = Na__UserConfig__UpdatedTime(Na__Cached) > Na__UserConfig__UpdatedTime(Na__Local)
        ? Na__Cached
        : Na__Local;

    Na__UserConfig__Document = Na__UserConfig__MergeOver(
        Na__UserConfig__BuildDefaults(Na__ReadAloudConfig || {}, Na__AppVersion),
        Na__Newest
    );
    if (!Na__Newest) Na__UserConfig__MigrateLegacyKeys();
    Na__UserConfig__Document.NaUserConfig__Meta.NaUserConfig__AppVersion = Na__AppVersion;
    Na__UserConfig__Save();

    // Ask once for storage the browser will not evict; refused quietly is fine
    if (navigator.storage?.persist) navigator.storage.persist().catch(() => false);
    return Na__UserConfig__Document;
}
// ------------------------------------------------------------


// FUNCTION | GetUserSetting - One remembered value, or undefined
// ------------------------------------------------------------
export function Na__TextToReader__GetUserSetting(Na__Section, Na__Key) {
    return Na__UserConfig__Document[Na__Section]?.[Na__Key];
}
// ------------------------------------------------------------


// FUNCTION | SetUserSetting - Change one value and save it (skipped when unchanged)
// ------------------------------------------------------------
export function Na__TextToReader__SetUserSetting(Na__Section, Na__Key, Na__Value) {
    const Na__Values = Na__UserConfig__Document[Na__Section];
    if (!Na__Values || !(Na__Key in Na__Values) || Na__Values[Na__Key] === Na__Value) return;
    Na__Values[Na__Key] = Na__Value;
    Na__UserConfig__Save();
}
// ------------------------------------------------------------


// FUNCTION | GetLastFileHandle - The last opened file's handle, so the picker starts in its folder
// ------------------------------------------------------------
export async function Na__TextToReader__GetLastFileHandle() {
    try {
        return await Na__UserConfig__WithStore("readonly", (Na__Store) => Na__Store.get(Na__UserConfig__LastFileKey));
    } catch {
        return null;
    }
}
// ------------------------------------------------------------


// FUNCTION | RememberOpenedFile - Record the file's name and, where there is one, its handle
// ------------------------------------------------------------
export async function Na__TextToReader__RememberOpenedFile(Na__FileName, Na__Handle) {
    let Na__FolderRemembered = false;
    if (Na__Handle) {
        try {
            await Na__UserConfig__WithStore("readwrite", (Na__Store) => Na__Store.put(Na__Handle, Na__UserConfig__LastFileKey));
            Na__FolderRemembered = true;
        } catch (Na__Error) {
            console.warn("Text To Reader: last folder not remembered:", Na__Error);
        }
    }
    const Na__Files = Na__UserConfig__Document.NaUserConfig__Files;
    Na__Files.NaUserConfig__LastFileName     = Na__FileName;
    Na__Files.NaUserConfig__LastFileOpened   = new Date().toISOString();
    Na__Files.NaUserConfig__FolderRemembered = Na__FolderRemembered || Na__Files.NaUserConfig__FolderRemembered;
    Na__UserConfig__Save();
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------
