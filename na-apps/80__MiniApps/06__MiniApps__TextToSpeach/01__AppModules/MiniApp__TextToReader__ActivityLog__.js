// =============================================================================
// NOBLE ARCHITECTURE - TEXT TO READER - ACTIVITY LOG
// =============================================================================
//
// PURPOSE : A running record of what the reader did and how long it took
//           (voice downloads, engine loads, speech preparation) and anything
//           that failed, opened from the Na logo in the header. Kept across
//           reloads so a failure can still be read after the page restarts.
//
// USE     : Na__TextToReader__Log(level, text, ms?)   level: info | ok | warn | error
//           const done = Na__TextToReader__LogTimer("Loading Edwin");
//           done("Edwin ready on 6 CPU threads");      -> logs with the elapsed ms
//           done.fail(error);                           -> logs the failure with ms
// =============================================================================


// REGION | State
// --------------------------------------------------------
const Na__Log__StorageKey = "NaTextToReader__ActivityLog";
const Na__Log__MaxEntries = 250;
let Na__Log__Entries = Na__Log__Restore();
let Na__Log__Nodes = null;
// endregion -------------------------------------------------------------------


// REGION | Recording
// --------------------------------------------------------

// FUNCTION | Restore - Entries from earlier page loads, newest last
// --------------------------------------------------------
function Na__Log__Restore() {
    try {
        const Na__Stored = JSON.parse(localStorage.getItem(Na__Log__StorageKey) || "[]");
        return Array.isArray(Na__Stored) ? Na__Stored.slice(-Na__Log__MaxEntries) : [];
    } catch {
        return [];
    }
}
// --------------------------------------------------------


// FUNCTION | Save - Keep the log for the next page load
// --------------------------------------------------------
function Na__Log__Save() {
    try {
        localStorage.setItem(Na__Log__StorageKey, JSON.stringify(Na__Log__Entries));
    } catch {
        // Storage full or blocked: the log still works for this page
    }
}
// --------------------------------------------------------


// FUNCTION | Log - Record one line; repaint the dialog if it is open
// --------------------------------------------------------
export function Na__TextToReader__Log(Na__Level, Na__Text, Na__Ms) {
    if (!Na__Text) return;
    const Na__Entry = { at: Date.now(), level: Na__Level, text: String(Na__Text) };
    if (Number.isFinite(Na__Ms)) Na__Entry.ms = Math.round(Na__Ms);
    Na__Log__Entries.push(Na__Entry);
    if (Na__Log__Entries.length > Na__Log__MaxEntries) Na__Log__Entries.splice(0, Na__Log__Entries.length - Na__Log__MaxEntries);
    Na__Log__Save();
    if (Na__Log__Nodes?.dialog.open) Na__Log__Render();
}
// --------------------------------------------------------


// FUNCTION | LogTimer - Start timing a job; call the result when it finishes
// --------------------------------------------------------
export function Na__TextToReader__LogTimer(Na__Label) {
    const Na__Start = performance.now();
    Na__TextToReader__Log("info", Na__Label + "…");
    const Na__Done = (Na__Text) => Na__TextToReader__Log("ok", Na__Text || Na__Label, performance.now() - Na__Start);
    Na__Done.fail = (Na__Error) => Na__TextToReader__Log("error",
        Na__Label + " failed: " + (Na__Error?.message || Na__Error), performance.now() - Na__Start);
    return Na__Done;
}
// --------------------------------------------------------


// FUNCTION | CaptureGlobalErrors - Uncaught errors, rejected promises and console warnings
// --------------------------------------------------------
function Na__Log__CaptureGlobalErrors() {
    window.addEventListener("error", (Na__Event) =>
        Na__TextToReader__Log("error", Na__Event.message + (Na__Event.filename
            ? " (" + Na__Event.filename.split("/").pop().split("?")[0] + ":" + Na__Event.lineno + ")" : "")));
    window.addEventListener("unhandledrejection", (Na__Event) =>
        Na__TextToReader__Log("error", "Unhandled: " + (Na__Event.reason?.message || Na__Event.reason)));

    for (const [Na__Method, Na__Level] of [["warn", "warn"], ["error", "error"]]) {
        const Na__Original = console[Na__Method].bind(console);
        console[Na__Method] = (...Na__Args) => {
            Na__Original(...Na__Args);
            Na__TextToReader__Log(Na__Level, Na__Args.map((Na__Arg) =>
                Na__Arg instanceof Error ? Na__Arg.message : String(Na__Arg)).join(" "));
        };
    }
}
// --------------------------------------------------------

// endregion -------------------------------------------------------------------


// REGION | Dialog
// --------------------------------------------------------

// FUNCTION | FormatMs - 850 ms, 4.2 s, 1 min 05 s
// --------------------------------------------------------
function Na__Log__FormatMs(Na__Ms) {
    if (Na__Ms < 1000) return Na__Ms + " ms";
    if (Na__Ms < 60000) return (Na__Ms / 1000).toFixed(1) + " s";
    const Na__Seconds = Math.round(Na__Ms / 1000);
    return Math.floor(Na__Seconds / 60) + " min " + String(Na__Seconds % 60).padStart(2, "0") + " s";
}
// --------------------------------------------------------


// FUNCTION | DescribeDevice - The facts that explain speed: threads, isolation, offline worker, storage
// --------------------------------------------------------
async function Na__Log__DescribeDevice() {
    const Na__Parts = [
        (navigator.hardwareConcurrency || "?") + " CPU cores",
        window.crossOriginIsolated ? "threads available" : "single thread only (page not isolated)",
        navigator.serviceWorker?.controller ? "offline worker active" : "offline worker not active"
    ];
    try {
        const Na__Estimate = await navigator.storage?.estimate();
        if (Na__Estimate?.usage) Na__Parts.push(Math.round(Na__Estimate.usage / (1024 * 1024)) + " MB stored");
    } catch {
        // Estimate unavailable: leave it out
    }
    return Na__Parts.join(" · ");
}
// --------------------------------------------------------


// FUNCTION | Render - Newest first, a day's date only when it changes
// --------------------------------------------------------
function Na__Log__Render() {
    const Na__List = Na__Log__Nodes.list;
    Na__List.replaceChildren();
    if (!Na__Log__Entries.length) {
        const Na__Empty = document.createElement("li");
        Na__Empty.className = "TTR__log-empty";
        Na__Empty.textContent = "Nothing logged yet.";
        Na__List.append(Na__Empty);
        return;
    }
    let Na__LastDay = "";
    for (const Na__Entry of [...Na__Log__Entries].reverse()) {
        const Na__When = new Date(Na__Entry.at);
        const Na__Day = Na__When.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
        const Na__Row = document.createElement("li");
        Na__Row.className = "TTR__log-row TTR__log-row--" + Na__Entry.level;

        const Na__Time = document.createElement("span");
        Na__Time.className = "TTR__log-time";
        Na__Time.textContent = (Na__Day !== Na__LastDay ? Na__Day + " " : "") +
            Na__When.toLocaleTimeString("en-GB", { hour12: false });
        Na__LastDay = Na__Day;

        const Na__Text = document.createElement("span");
        Na__Text.className = "TTR__log-text";
        Na__Text.textContent = Na__Entry.text;

        const Na__Ms = document.createElement("span");
        Na__Ms.className = "TTR__log-ms";
        Na__Ms.textContent = Number.isFinite(Na__Entry.ms) ? Na__Log__FormatMs(Na__Entry.ms) : "";

        Na__Row.append(Na__Time, Na__Text, Na__Ms);
        Na__List.append(Na__Row);
    }
}
// --------------------------------------------------------


// FUNCTION | AsText - The whole log as plain text, for Copy
// --------------------------------------------------------
function Na__Log__AsText(Na__Device) {
    return ["Text To Reader activity log", Na__Device, ""].concat(Na__Log__Entries.map((Na__Entry) =>
        new Date(Na__Entry.at).toISOString().replace("T", " ").slice(0, 19) + "  " +
        Na__Entry.level.toUpperCase().padEnd(5) + "  " + Na__Entry.text +
        (Number.isFinite(Na__Entry.ms) ? "  (" + Na__Log__FormatMs(Na__Entry.ms) + ")" : ""))).join("\n");
}
// --------------------------------------------------------


// FUNCTION | Open - Show the log with a fresh device summary
// --------------------------------------------------------
async function Na__Log__Open() {
    Na__Log__Render();
    Na__Log__Nodes.device.textContent = await Na__Log__DescribeDevice();
    if (!Na__Log__Nodes.dialog.open) Na__Log__Nodes.dialog.showModal();
}
// --------------------------------------------------------


// FUNCTION | InitialiseActivityLog - Wire the logo, the dialog buttons and global error capture
// --------------------------------------------------------
export function Na__TextToReader__InitialiseActivityLog({ trigger, dialog, list, device, copy, clear, close, version }) {
    Na__Log__Nodes = { dialog, list, device };
    Na__Log__CaptureGlobalErrors();
    Na__TextToReader__Log("info", "App opened" + (version ? " (v" + version + ")" : ""));

    trigger.addEventListener("click", Na__Log__Open);
    close.addEventListener("click", () => dialog.close());
    clear.addEventListener("click", () => {
        Na__Log__Entries = [];
        Na__Log__Save();
        Na__Log__Render();
    });
    copy.addEventListener("click", async () => {
        try {
            await navigator.clipboard.writeText(Na__Log__AsText(device.textContent));
            copy.textContent = "Copied";
        } catch {
            copy.textContent = "Copy failed";
        }
        setTimeout(() => { copy.textContent = "Copy"; }, 1500);
    });
}
// --------------------------------------------------------

// endregion -------------------------------------------------------------------
