// =============================================================================
// TRUEVISION3D - LOCAL FILE PARITY - LOGIC
// =============================================================================
//
// FILE       : Na__FileParity__Logic__.js
// NAMESPACE  : Na__FileParity
// MODULE     : Local File Parity - Logic
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Decide, from the server's file versions and this window's baselines, which files moved on disk, who moved them, whether a save would bury the move, and how to say so in plain words
// CREATED    : 22-Sep-2026
//
// DESCRIPTION:
// - PURE. No DOM, no fetch, no storage, no imports: every answer here is a
//   function of its arguments, so the node test runs it exactly as the app
//   does.
// - A CHANGE is a watched file this window holds (it has a baseline) whose
//   version on disk is not the baseline. A change this window made itself -
//   the server remembers the window that made the last write - is not a
//   change but a baseline the window missed, and is adopted quietly.
// - A CONFLICT is a change a save would write over. The drawings save merges
//   its own top-level keys into the project data and keeps every other key as
//   the file has it, so a build sync that only touched modelGroups is a
//   change but not a conflict. Every other watched file is written whole, so
//   any change to it is a conflict. When the keys that moved are not known,
//   the answer is conflict: the cautious reading.
// - WORDS. Which file (in the app's own terms), when it moved, who moved it
//   (another TrueVision window, or something outside the app - an agent, an
//   editor, a sync) and what moved (the parts of the project data, notes and
//   groups counted before and after, a statement's size).
//
// INTEGRATION:
// - Imported by Na__FileParity__Watcher__ and Na__FileParity__Modal__.
// - Proved by 80__Testing__PrototypeEnvironment/Na__Test__FileParity__.test.mjs.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (22-Sep-2026)
// - ValeVision    : not yet ported. Nothing here is app-specific but the
//                   key labels.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | What Each Watched File Is, in the App's Own Terms
    // ------------------------------------------------------------
    const Na__FileParity__FILE_TITLES = Object.freeze({
        'project-data'    : 'Drawings, sheets and scenes',
        'drawing-notes'   : 'Project specification (drawing notes)',
        'statement-index' : 'Statement documents index'
    });
    // ------------------------------------------------------------

    // MODULE CONSTANTS | The Parts of the Project Data, for "what moved"
    // ------------------------------------------------------------
    const Na__FileParity__KEY_LABELS = Object.freeze({
        'LayoutEditor__DrawingsData'          : 'drawings and sheets',
        'PresentationMode__SavedCameraScenes' : 'saved scenes',
        'CrossSection__SceneData'             : 'section cuts',
        'modelGroups'                         : 'model groups',
        'activeGroupIndex'                    : 'active model group',
        'SitePlan__Data'                      : 'site plan data'
    });
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Counts the Server Reports, and Their Words
    // ------------------------------------------------------------
    const Na__FileParity__SUMMARY_WORDS = Object.freeze({
        sheets    : 'sheets',
        notes     : 'notes',
        groups    : 'groups',
        documents : 'documents'
    });
    const Na__FileParity__STATEMENT_PREFIX = 'statement:';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Finding Changes
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Key Made Comparable (statement keys are lower case)
    // ------------------------------------------------------------
    function Na__FileParity__Logic__Key(key) {
        const text = String(key || '');
        return text.startsWith(Na__FileParity__STATEMENT_PREFIX) ? text.toLowerCase() : text;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Top-Level Keys Whose Content Differs Between Two Key Maps (sorted)
    // ------------------------------------------------------------
    // Null when either map is unknown: "we cannot tell" is not "nothing moved".
    // ------------------------------------------------------------
    function Na__FileParity__DiffKeys(before, after) {
        if (!before || !after || typeof before !== 'object' || typeof after !== 'object') return null;
        const names = new Set(Object.keys(before).concat(Object.keys(after)));
        return Array.from(names).filter((name) => before[name] !== after[name]).sort();
    }
    // ------------------------------------------------------------


    // FUNCTION | Every Watched File This Window Holds That Has Moved On Disk
    // ------------------------------------------------------------
    // files      : the state route's files array
    // baselines  : key -> { version, ... } (this window's)
    // clientId   : this window's id
    // Answers [{ key, adopt, ... }]. adopt: true marks this window's own write
    // whose version it never heard about - take it as the baseline and move on.
    // ------------------------------------------------------------
    function Na__FileParity__FindChanges(files, baselines, clientId) {
        const changes = [];
        (Array.isArray(files) ? files : []).forEach((file) => {
            if (!file || typeof file !== 'object') return;
            const key  = Na__FileParity__Logic__Key(file.key);
            const base = baselines ? baselines[key] : null;
            if (!base || !base.version) return;                                   // <-- Never read or written here: nothing here can overwrite it
            if (file.version === base.version) return;

            const last          = file.lastAppWrite || null;
            const byLastWrite   = !!(last && last.version === file.version);
            const byThisWindow  = byLastWrite && !!clientId && last.clientId === clientId;
            if (byThisWindow) {
                changes.push({ key : key, adopt : true, version : file.version, mtimeMs : file.mtimeMs || null });
                return;
            }

            changes.push({
                key           : key,
                adopt         : false,
                kind          : file.kind || (key.startsWith(Na__FileParity__STATEMENT_PREFIX) ? 'statement' : 'data'),
                name          : file.name || key,
                path          : file.path || '',
                baseVersion   : base.version,
                version       : file.version,
                exists        : file.exists !== false,
                valid         : file.valid !== false,
                mtimeMs       : Number.isFinite(file.mtimeMs) ? file.mtimeMs : null,
                size          : Number.isFinite(file.size) ? file.size : null,
                baseSize      : Number.isFinite(file.baseSize) ? file.baseSize : null,
                summary       : file.summary || null,
                baseSummary   : file.baseSummary || null,
                stamp         : file.stamp || null,
                changedKeys   : Na__FileParity__DiffKeys(file.baseKeys, file.keys),
                byOtherWindow : byLastWrite && !!last.clientId && last.clientId !== clientId,
                lastAppWrite  : last
            });
        });
        return changes;
    }
    // ------------------------------------------------------------


    // FUNCTION | Would a Save That Writes These Keys Bury This Change
    // ------------------------------------------------------------
    // writesKeys: the top-level keys a merge-save writes (the drawings save),
    // or null for a whole-file write. A file that is gone or broken on disk
    // is always a conflict: saving over it is exactly the decision to ask about.
    // ------------------------------------------------------------
    function Na__FileParity__IsConflict(change, writesKeys) {
        if (!change || change.adopt) return false;
        if (!change.exists || !change.valid) return true;
        if (!Array.isArray(writesKeys) || change.key !== 'project-data') return true;
        if (!Array.isArray(change.changedKeys)) return true;                     // <-- The keys that moved are not known: assume the worst
        return change.changedKeys.some((name) => writesKeys.indexOf(name) !== -1);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Words
// -----------------------------------------------------------------------------

    // FUNCTION | What a Watched File Is Called in the App
    // ------------------------------------------------------------
    function Na__FileParity__FileTitle(key, name) {
        const normalised = Na__FileParity__Logic__Key(key);
        if (Na__FileParity__FILE_TITLES[normalised]) return Na__FileParity__FILE_TITLES[normalised];
        if (normalised.startsWith(Na__FileParity__STATEMENT_PREFIX)) return 'Statement - ' + String(name || normalised.split('/').pop());
        return String(name || normalised);
    }
    // ------------------------------------------------------------


    // FUNCTION | A Time as the Modal Says It: "10:04:31, 2 min ago"
    // ------------------------------------------------------------
    function Na__FileParity__When(ms, nowMs) {
        if (!Number.isFinite(ms)) return 'at an unknown time';
        const date  = new Date(ms);
        const clock = [date.getHours(), date.getMinutes(), date.getSeconds()].map((part) => String(part).padStart(2, '0')).join(':');
        const ago   = Math.max(0, Math.round(((Number.isFinite(nowMs) ? nowMs : Date.now()) - ms) / 1000));
        let relative;
        if (ago < 10)          relative = 'just now';
        else if (ago < 60)     relative = `${ago} s ago`;
        else if (ago < 3600)   relative = `${Math.round(ago / 60)} min ago`;
        else if (ago < 86400)  relative = `${Math.round(ago / 3600)} h ago`;
        else                   relative = `${Math.round(ago / 86400)} day(s) ago`;
        return `${clock}, ${relative}`;
    }
    // ------------------------------------------------------------


    // FUNCTION | Who Moved It
    // ------------------------------------------------------------
    function Na__FileParity__Who(change) {
        if (change && change.byOtherWindow) return 'another TrueVision window';
        return 'outside TrueVision (an agent, an editor or a sync)';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Byte Difference in Words: "+1.2 KB"
    // ------------------------------------------------------------
    function Na__FileParity__Bytes(delta) {
        if (!Number.isFinite(delta) || delta === 0) return null;
        const sign = delta > 0 ? '+' : '-';
        const size = Math.abs(delta);
        if (size < 1024) return `${sign}${size} bytes`;
        if (size < 1024 * 1024) return `${sign}${(size / 1024).toFixed(1)} KB`;
        return `${sign}${(size / (1024 * 1024)).toFixed(1)} MB`;
    }
    // ------------------------------------------------------------


    // FUNCTION | What Moved, in a Few Short Phrases
    // ------------------------------------------------------------
    // ["Notes 73 -> 82", "groups 15 -> 16"], ["Changed: drawings and sheets,
    // model groups"], ["Deleted from disk"], ["Not valid JSON right now ..."].
    // ------------------------------------------------------------
    function Na__FileParity__WhatMoved(change) {
        if (!change) return [];
        if (!change.exists) return ['Deleted from disk.'];
        const phrases = [];
        if (!change.valid) phrases.push('Not valid JSON right now - it may still be being written. Wait a moment before reloading.');

        const before = change.baseSummary || null;
        const after  = change.summary || null;
        if (after) {
            const counts = Object.keys(Na__FileParity__SUMMARY_WORDS)
                .filter((name) => Number.isFinite(after[name]))
                .map((name) => {
                    const word = Na__FileParity__SUMMARY_WORDS[name];
                    const was  = before && Number.isFinite(before[name]) ? before[name] : null;
                    return (was === null || was === after[name]) ? `${after[name]} ${word}` : `${word} ${was} → ${after[name]}`;
                });
            if (counts.length) phrases.push(counts.join(' · ').replace(/^./, (first) => first.toUpperCase()));
        }

        if (change.key === 'project-data' && Array.isArray(change.changedKeys) && change.changedKeys.length) {
            const parts = change.changedKeys.map((name) => Na__FileParity__KEY_LABELS[name] || name);
            phrases.push('Changed: ' + parts.join(', ') + '.');
        }

        if (change.kind === 'statement' || (!after && !phrases.length)) {
            const delta = (Number.isFinite(change.size) && Number.isFinite(change.baseSize)) ? Na__FileParity__Bytes(change.size - change.baseSize) : null;
            phrases.push(delta ? `Text changed (${delta}).` : 'Content changed.');
        }
        return phrases;
    }
    // ------------------------------------------------------------


    // FUNCTION | One Change, Everything the Modal Puts on Its Row
    // ------------------------------------------------------------
    // conflict: whether the save being asked about would bury it (or, with no
    // save in hand, whether a save of this file would).
    // ------------------------------------------------------------
    function Na__FileParity__Describe(change, options) {
        const opts = options || {};
        return {
            key      : change.key,
            title    : Na__FileParity__FileTitle(change.key, change.name),
            fileName : change.name,
            when     : Na__FileParity__When(change.mtimeMs, opts.nowMs),
            who      : Na__FileParity__Who(change),
            what     : Na__FileParity__WhatMoved(change),
            conflict : Na__FileParity__IsConflict(change, opts.writesKeys || null),
            dirty    : opts.dirty === true
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Local File Parity Logic API
    // ------------------------------------------------------------
    export {
        Na__FileParity__KEY_LABELS,
        Na__FileParity__DiffKeys,
        Na__FileParity__FindChanges,
        Na__FileParity__IsConflict,
        Na__FileParity__FileTitle,
        Na__FileParity__When,
        Na__FileParity__Who,
        Na__FileParity__WhatMoved,
        Na__FileParity__Describe
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
