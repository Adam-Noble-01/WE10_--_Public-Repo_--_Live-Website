// =============================================================================
// NOBLE ARCHITECTURE - AI UTILS - PROMPT LIBRARY - MAIN
// =============================================================================
//
// FILE    : MiniApp__AiUtils__PromptLibrary__Main__.js
// AUTHOR  : Adam Noble - Noble Architecture
// PURPOSE : App state, DOM cache, event wiring, refresh cycle and bootstrap
// CREATED : 26-Aug-2026
//
// DESCRIPTION:
// - The controller. Owns the live criteria, the selected prompt and the values
//   typed into the job specific fields, then drives the render modules.
// - Every interactive element is handled by delegation against a data attribute
//   so re-rendering a panel never leaves a stale listener behind.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Imports
// -----------------------------------------------------------------------------

// @delegate: ./MiniApp__AiUtils__PromptLibrary__DataStore__.js
import {
    Na__AiUtils__DataStore__Initialise,
    Na__AiUtils__DataStore__GetPromptList,
    Na__AiUtils__DataStore__GetPromptById,
    Na__AiUtils__DataStore__GetTaxonomy,
    Na__AiUtils__DataStore__GetSnippets,
    Na__AiUtils__DataStore__GetConnectionState,
    Na__AiUtils__DataStore__SavePrompt,
    Na__AiUtils__DataStore__DeletePrompt,
    Na__AiUtils__DataStore__ToggleFavourite,
    Na__AiUtils__DataStore__RecordCopyEvent,
    Na__AiUtils__DataStore__FlushPendingOperations,
    Na__AiUtils__DataStore__CreateBlankRecord,
    Na__AiUtils__DataStore__BuildRecordId,
    Na__AiUtils__DataStore__DownloadRecordFile,
    Na__AiUtils__DataStore__DownloadLibraryBundle,
    Na__AiUtils__DataStore__DownloadChangedRecords,
    Na__AiUtils__DataStore__ImportLibraryBundle
} from "./MiniApp__AiUtils__PromptLibrary__DataStore__.js";

// @delegate: ./MiniApp__AiUtils__PromptLibrary__SearchEngine__.js
import {
    Na__AiUtils__Search__RunSearch,
    Na__AiUtils__Search__BuildKeywordCloud,
    Na__AiUtils__Search__BuildCategoryCounts
} from "./MiniApp__AiUtils__PromptLibrary__SearchEngine__.js";

// @delegate: ./MiniApp__AiUtils__PromptLibrary__PromptCompose__.js
import {
    Na__AiUtils__Compose__ReconcileVariables,
    Na__AiUtils__Compose__RenderPrompt,
    Na__AiUtils__Compose__CopyToClipboard
} from "./MiniApp__AiUtils__PromptLibrary__PromptCompose__.js";

// @delegate: ./MiniApp__AiUtils__PromptLibrary__UiRender__.js
import {
    Na__AiUtils__Ui__RenderRail,
    Na__AiUtils__Ui__RenderResultList,
    Na__AiUtils__Ui__RenderDetail,
    Na__AiUtils__Ui__RenderEmptyDetail,
    Na__AiUtils__Ui__UpdateComposedOutput,
    Na__AiUtils__Ui__RenderSnippets,
    Na__AiUtils__Ui__ShowToast,
    Na__AiUtils__Ui__EscapeHtml
} from "./MiniApp__AiUtils__PromptLibrary__UiRender__.js";

// @delegate: ./MiniApp__AiUtils__PromptLibrary__PromptEditor__.js
import {
    Na__AiUtils__Editor__Open,
    Na__AiUtils__Editor__Close,
    Na__AiUtils__Editor__CollectRecord,
    Na__AiUtils__Editor__ValidateRecord,
    Na__AiUtils__Editor__SetErrorMessage,
    Na__AiUtils__Editor__ScanBodyForTokens,
    Na__AiUtils__Editor__BuildVariableRow,
    Na__AiUtils__Editor__RefreshSubCategoryOptions,
    Na__AiUtils__Editor__InsertSnippetAtCursor
} from "./MiniApp__AiUtils__PromptLibrary__PromptEditor__.js";

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module-Level State
// -----------------------------------------------------------------------------

const Na__AiUtils__ConfigPath = "./MiniApp__AiUtils__PromptLibrary__AppConfig__.json";   // Resolved against the page, not the module folder

let Na__AiUtils__AppConfig = null;

const Na__AiUtils__State = {
    criteria : {
        queryText        : "",
        scope            : "All",
        category         : "",
        subCategory      : "",
        selectedKeywords : [],
        sortMode         : "Relevance",
        showArchived     : false
    },
    activeView       : "Prompts",                                                    // Prompts or Snippets
    selectedId       : "",
    currentResults   : [],
    activeVariables  : [],
    valueMaps        : {},                                                           // Entered job values keyed by prompt id
    editorBaseRecord : null,
    editorIsNew      : false,
    searchTimerId    : 0
};

const Na__AiUtils__Dom = {
    Na__Rail            : document.getElementById("js__rail"),
    Na__SearchInput     : document.getElementById("js__searchInput"),
    Na__SortSelect      : document.getElementById("js__sortSelect"),
    Na__ResultList      : document.getElementById("js__resultList"),
    Na__ResultCount     : document.getElementById("js__resultCount"),
    Na__SnippetPanel    : document.getElementById("js__snippetPanel"),
    Na__DetailPane      : document.getElementById("js__detailPane"),
    Na__Modal           : document.getElementById("js__modal"),
    Na__Toast           : document.getElementById("js__toast"),
    Na__ConnectionPill  : document.getElementById("js__connectionPill"),
    Na__ViewTabs        : document.getElementById("js__viewTabs"),
    Na__ActiveFilters   : document.getElementById("js__activeFilters"),
    Na__ImportFile      : document.getElementById("js__importFile"),
    Na__ShortcutPanel   : document.getElementById("js__shortcutPanel"),
    Na__AppTitle        : document.getElementById("js__appTitle")
};

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | UI State Persistence
// -----------------------------------------------------------------------------

// FUNCTION | Save the live criteria, selection and typed job values to browser storage
// ------------------------------------------------------------
function Na__AiUtils__PersistUiState() {
    try {
        const Na__StorageKey = Na__AiUtils__AppConfig.NaMiniApp__StorageKeys.NaMiniApp__UiStateKey;
        window.localStorage.setItem(Na__StorageKey, JSON.stringify({
            criteria   : Na__AiUtils__State.criteria,
            selectedId : Na__AiUtils__State.selectedId,
            valueMaps  : Na__AiUtils__State.valueMaps,
            activeView : Na__AiUtils__State.activeView
        }));


    // Error handling
    // ------------------------------------
    } catch (Na__ErrorObject) {
        console.warn("UI state could not be saved.", Na__ErrorObject);
    }
}
// ------------------------------------------------------------


// FUNCTION | Restore the previous session's criteria and typed job values
// ------------------------------------------------------------
function Na__AiUtils__RestoreUiState() {
    try {
        const Na__StorageKey = Na__AiUtils__AppConfig.NaMiniApp__StorageKeys.NaMiniApp__UiStateKey;
        const Na__RawValue   = window.localStorage.getItem(Na__StorageKey);
        if (!Na__RawValue) return;

        const Na__Parsed = JSON.parse(Na__RawValue);
        if (Na__Parsed.criteria)   Na__AiUtils__State.criteria   = { ...Na__AiUtils__State.criteria, ...Na__Parsed.criteria };
        if (Na__Parsed.valueMaps)  Na__AiUtils__State.valueMaps  = Na__Parsed.valueMaps;
        if (Na__Parsed.selectedId) Na__AiUtils__State.selectedId = Na__Parsed.selectedId;
        if (Na__Parsed.activeView) Na__AiUtils__State.activeView = Na__Parsed.activeView;


    // Error handling
    // ------------------------------------
    } catch (Na__ErrorObject) {
        console.warn("UI state could not be restored.", Na__ErrorObject);
    }
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Small UI Helpers
// -----------------------------------------------------------------------------

// HELPER FUNCTION | Flash a message in the corner toast
// ------------------------------------------------------------
function Na__AiUtils__Toast(Na__Message, Na__IsError) {
    Na__AiUtils__Ui__ShowToast(
        Na__AiUtils__Dom.Na__Toast,
        Na__Message,
        Na__AiUtils__AppConfig.NaMiniApp__Defaults.NaMiniApp__ToastDurationMs,
        Na__IsError === true
    );
}
// ------------------------------------------------------------


// FUNCTION | Repaint the connection status pill from the data store state
// ------------------------------------------------------------
function Na__AiUtils__RefreshConnectionPill() {
    const Na__UiText     = Na__AiUtils__AppConfig.NaMiniApp__UiText;
    const Na__Connection = Na__AiUtils__DataStore__GetConnectionState();
    const Na__IsServer   = Na__Connection.apiIsOnline;

    const Na__PendingLabel = Na__Connection.pendingCount === 1
        ? Na__UiText.NaMiniApp__LabelPendingChanges
        : Na__UiText.NaMiniApp__LabelPendingChangesPl;

    const Na__PendingText = Na__Connection.pendingCount
        ? ` - ${Na__Connection.pendingCount} ${Na__PendingLabel}`
        : "";

    Na__AiUtils__Dom.Na__ConnectionPill.textContent = `${Na__IsServer ? Na__UiText.NaMiniApp__ModeServerLabel : Na__UiText.NaMiniApp__ModeLocalLabel}${Na__PendingText}`;
    Na__AiUtils__Dom.Na__ConnectionPill.title       = Na__IsServer ? Na__UiText.NaMiniApp__ModeServerHint : Na__UiText.NaMiniApp__ModeLocalHint;
    Na__AiUtils__Dom.Na__ConnectionPill.className   = `AIPL__status-pill ${Na__IsServer ? "AIPL__status-pill--server" : "AIPL__status-pill--local"} ${Na__Connection.pendingCount ? "AIPL__status-pill--pending" : ""}`;
}
// ------------------------------------------------------------


// FUNCTION | Repaint the active filter chip strip above the result list
// ------------------------------------------------------------
function Na__AiUtils__RefreshActiveFilters() {
    const Na__Criteria   = Na__AiUtils__State.criteria;
    const Na__Categories = (Na__AiUtils__DataStore__GetTaxonomy() || {}).PromptLibrary__Categories || {};
    const Na__Category   = Na__Categories[Na__Criteria.category];
    const Na__SubEntry   = Na__Category ? (Na__Category.Category__SubCategories || {})[Na__Criteria.subCategory] : null;
    const Na__Chips      = [];


    // Chip labels read from the taxonomy so they match the rail wording
    // ------------------------------------
    if (Na__Criteria.scope !== "All")  Na__Chips.push({ label: Na__Criteria.scope, clear: "scope" });
    if (Na__Criteria.category)         Na__Chips.push({ label: Na__Category ? Na__Category.Category__Title : Na__Criteria.category, clear: "category" });
    if (Na__Criteria.subCategory)      Na__Chips.push({ label: Na__SubEntry ? Na__SubEntry.SubCategory__Title : Na__Criteria.subCategory, clear: "subCategory" });

    Na__Criteria.selectedKeywords.forEach((Na__Keyword) => Na__Chips.push({ label: `#${Na__Keyword}`, clear: `keyword:${Na__Keyword}` }));

    if (!Na__Chips.length) {
        Na__AiUtils__Dom.Na__ActiveFilters.innerHTML = "";
        Na__AiUtils__Dom.Na__ActiveFilters.classList.remove("AIPL__active-filters--visible");
        return;
    }

    Na__AiUtils__Dom.Na__ActiveFilters.innerHTML = `
        ${Na__Chips.map((Na__Chip) => `
            <button type="button" class="AIPL__filter-chip" data-na-clear-filter="${Na__AiUtils__Ui__EscapeHtml(Na__Chip.clear)}" title="Remove this filter">
                ${Na__AiUtils__Ui__EscapeHtml(Na__Chip.label)}<span class="AIPL__filter-chip-x">&times;</span>
            </button>`).join("")}
        <button type="button" class="AIPL__link-button" data-na-clear-filter="all">Clear all</button>`;

    Na__AiUtils__Dom.Na__ActiveFilters.classList.add("AIPL__active-filters--visible");
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Compose Cycle
// -----------------------------------------------------------------------------

// HELPER FUNCTION | Return the stored value map for a prompt, creating it if needed
// ------------------------------------------------------------
function Na__AiUtils__GetValueMap(Na__PromptId) {
    if (!Na__AiUtils__State.valueMaps[Na__PromptId]) Na__AiUtils__State.valueMaps[Na__PromptId] = {};
    return Na__AiUtils__State.valueMaps[Na__PromptId];
}
// ------------------------------------------------------------


// FUNCTION | Compose one prompt against its stored job values
// ------------------------------------------------------------
function Na__AiUtils__ComposeRecord(Na__Record) {
    const Na__Variables = Na__AiUtils__Compose__ReconcileVariables(Na__Record.promptText, Na__Record.variables);
    const Na__ValueMap  = Na__AiUtils__GetValueMap(Na__Record.id);


    // Seed untouched fields with their declared default so the form shows what
    // the output will actually say - a field the user has cleared stays cleared
    // ------------------------------------
    Na__Variables.forEach((Na__Variable) => {
        if (Na__ValueMap[Na__Variable.token] === undefined) Na__ValueMap[Na__Variable.token] = Na__Variable.defaultValue || "";
    });

    const Na__Result = Na__AiUtils__Compose__RenderPrompt(Na__Record.promptText, Na__Variables, Na__ValueMap, {
        unfilledTokenBehaviour : Na__AiUtils__AppConfig.NaMiniApp__Defaults.NaMiniApp__UnfilledTokenBehaviour
    });

    return { variables: Na__Variables, valueMap: Na__ValueMap, composeResult: Na__Result };
}
// ------------------------------------------------------------


// FUNCTION | Recompose the open prompt and refresh only the output block
// ------------------------------------------------------------
function Na__AiUtils__RecomposeActivePrompt() {
    const Na__Record = Na__AiUtils__DataStore__GetPromptById(Na__AiUtils__State.selectedId);
    if (!Na__Record) return;

    const Na__Composed = Na__AiUtils__ComposeRecord(Na__Record);
    Na__AiUtils__State.activeVariables = Na__Composed.variables;

    Na__AiUtils__Ui__UpdateComposedOutput(
        Na__AiUtils__Dom.Na__DetailPane,
        Na__Composed.composeResult,
        Na__AiUtils__AppConfig.NaMiniApp__UiText
    );
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Render Cycle
// -----------------------------------------------------------------------------

// FUNCTION | Open a prompt in the detail pane
// ------------------------------------------------------------
function Na__AiUtils__SelectPrompt(Na__PromptId) {
    const Na__Record = Na__AiUtils__DataStore__GetPromptById(Na__PromptId);

    if (!Na__Record) {
        Na__AiUtils__State.selectedId = "";
        Na__AiUtils__Ui__RenderEmptyDetail(Na__AiUtils__Dom.Na__DetailPane, Na__AiUtils__AppConfig.NaMiniApp__UiText);
        return;
    }

    Na__AiUtils__State.selectedId = Na__PromptId;

    const Na__Composed = Na__AiUtils__ComposeRecord(Na__Record);
    Na__AiUtils__State.activeVariables = Na__Composed.variables;

    Na__AiUtils__Ui__RenderDetail(Na__AiUtils__Dom.Na__DetailPane, {
        record        : Na__Record,
        variables     : Na__Composed.variables,
        valueMap      : Na__Composed.valueMap,
        composeResult : Na__Composed.composeResult,
        taxonomy      : Na__AiUtils__DataStore__GetTaxonomy(),
        uiText        : Na__AiUtils__AppConfig.NaMiniApp__UiText
    });

    Na__AiUtils__PersistUiState();
}
// ------------------------------------------------------------


// FUNCTION | Re-run the search and repaint the rail, list and filter chips
// ------------------------------------------------------------
function Na__AiUtils__RunRefreshCycle() {
    const Na__Records  = Na__AiUtils__DataStore__GetPromptList();
    const Na__Taxonomy = Na__AiUtils__DataStore__GetTaxonomy();
    const Na__UiText   = Na__AiUtils__AppConfig.NaMiniApp__UiText;

    const Na__Results = Na__AiUtils__Search__RunSearch(
        Na__Records,
        Na__AiUtils__State.criteria,
        Na__AiUtils__AppConfig.NaMiniApp__SearchWeights,
        Na__Taxonomy
    );

    Na__AiUtils__State.currentResults = Na__Results;


    // Navigation rail
    // ------------------------------------
    Na__AiUtils__Ui__RenderRail(Na__AiUtils__Dom.Na__Rail, {
        taxonomy       : Na__Taxonomy,
        records        : Na__Records,
        categoryCounts : Na__AiUtils__Search__BuildCategoryCounts(Na__Records, Na__AiUtils__State.criteria.showArchived),
        keywordCloud   : Na__AiUtils__Search__BuildKeywordCloud(Na__Records),
        criteria       : Na__AiUtils__State.criteria,
        uiText         : Na__UiText
    });


    // Result list
    // ------------------------------------
    Na__AiUtils__Ui__RenderResultList(Na__AiUtils__Dom.Na__ResultList, {
        results       : Na__Results,
        selectedId    : Na__AiUtils__State.selectedId,
        taxonomy      : Na__Taxonomy,
        uiText        : Na__UiText,
        previewLength : Na__AiUtils__AppConfig.NaMiniApp__Defaults.NaMiniApp__SnippetPreviewLength
    });

    Na__AiUtils__Dom.Na__ResultCount.textContent = `${Na__Results.length} prompt${Na__Results.length === 1 ? "" : "s"}`;

    Na__AiUtils__RefreshActiveFilters();
    Na__AiUtils__RefreshConnectionPill();
    Na__AiUtils__PersistUiState();
}
// ------------------------------------------------------------


// FUNCTION | Switch between the prompt list and the snippet block list
// ------------------------------------------------------------
function Na__AiUtils__SetActiveView(Na__ViewName) {
    Na__AiUtils__State.activeView = Na__ViewName;

    const Na__IsSnippets = Na__ViewName === "Snippets";
    Na__AiUtils__Dom.Na__ResultList.classList.toggle("AIPL__hidden",   Na__IsSnippets);
    Na__AiUtils__Dom.Na__SnippetPanel.classList.toggle("AIPL__hidden", !Na__IsSnippets);

    Array.from(Na__AiUtils__Dom.Na__ViewTabs.querySelectorAll("[data-na-view]")).forEach((Na__Tab) => {
        Na__Tab.classList.toggle("AIPL__tab--active", Na__Tab.getAttribute("data-na-view") === Na__ViewName);
    });

    if (Na__IsSnippets) {
        Na__AiUtils__Ui__RenderSnippets(
            Na__AiUtils__Dom.Na__SnippetPanel,
            Na__AiUtils__DataStore__GetSnippets(),
            Na__AiUtils__AppConfig.NaMiniApp__Defaults.NaMiniApp__SnippetPreviewLength
        );
    }

    Na__AiUtils__PersistUiState();
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Copy Actions
// -----------------------------------------------------------------------------

// FUNCTION | Compose and copy one prompt, logging the usage against the record
// ------------------------------------------------------------
async function Na__AiUtils__CopyPromptToClipboard(Na__Record, Na__UseRawTemplate) {
    const Na__UiText = Na__AiUtils__AppConfig.NaMiniApp__UiText;


    // Raw template copies straight out with the tokens left in place
    // ------------------------------------
    if (Na__UseRawTemplate) {
        const Na__DidCopyRaw = await Na__AiUtils__Compose__CopyToClipboard(Na__Record.promptText);
        Na__AiUtils__Toast(Na__DidCopyRaw ? Na__UiText.NaMiniApp__StatusCopiedRaw : Na__UiText.NaMiniApp__StatusCopyFailed, !Na__DidCopyRaw);
        return Na__DidCopyRaw;
    }

    const Na__Composed = Na__AiUtils__ComposeRecord(Na__Record);


    // Block the copy when a required job field is still empty
    // ------------------------------------
    if (!Na__Composed.composeResult.isReadyToCopy) {
        if (Na__AiUtils__State.selectedId !== Na__Record.id) Na__AiUtils__SelectPrompt(Na__Record.id);

        const Na__FirstMissing = Na__Composed.composeResult.missingRequired[0];
        const Na__FieldElement = Na__AiUtils__Dom.Na__DetailPane.querySelector(`[data-na-token="${Na__FirstMissing.token}"]`);
        if (Na__FieldElement) Na__FieldElement.focus();

        Na__AiUtils__Toast(Na__UiText.NaMiniApp__StatusMissingRequired, true);
        return false;
    }

    const Na__DidCopy = await Na__AiUtils__Compose__CopyToClipboard(Na__Composed.composeResult.composedText);

    if (Na__DidCopy) {
        Na__AiUtils__DataStore__RecordCopyEvent(Na__Record.id);
        Na__AiUtils__Toast(Na__UiText.NaMiniApp__StatusCopiedComposed);
        Na__AiUtils__RunRefreshCycle();
        return true;
    }

    Na__AiUtils__Toast(Na__UiText.NaMiniApp__StatusCopyFailed, true);
    return false;
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Editor Actions
// -----------------------------------------------------------------------------

// FUNCTION | Open the editor modal against a record
// ------------------------------------------------------------
function Na__AiUtils__OpenEditor(Na__Record, Na__IsNewRecord) {
    Na__AiUtils__State.editorBaseRecord = Na__Record;
    Na__AiUtils__State.editorIsNew      = Na__IsNewRecord === true;

    Na__AiUtils__Editor__Open(Na__AiUtils__Dom.Na__Modal, {
        record      : Na__Record,
        taxonomy    : Na__AiUtils__DataStore__GetTaxonomy(),
        snippets    : Na__AiUtils__DataStore__GetSnippets(),
        uiText      : Na__AiUtils__AppConfig.NaMiniApp__UiText,
        isNewRecord : Na__AiUtils__State.editorIsNew
    });
}
// ------------------------------------------------------------


// FUNCTION | Validate and persist whatever is currently in the editor
// ------------------------------------------------------------
async function Na__AiUtils__SaveEditorRecord() {
    const Na__UiText   = Na__AiUtils__AppConfig.NaMiniApp__UiText;
    const Na__Collected = Na__AiUtils__Editor__CollectRecord(Na__AiUtils__Dom.Na__Modal, Na__AiUtils__State.editorBaseRecord);
    const Na__Errors    = Na__AiUtils__Editor__ValidateRecord(Na__Collected);

    if (Na__Errors.length) {
        Na__AiUtils__Editor__SetErrorMessage(Na__AiUtils__Dom.Na__Modal, Na__Errors[0]);
        return;
    }

    if (!Na__Collected.id) Na__Collected.id = Na__AiUtils__DataStore__BuildRecordId(Na__Collected);

    const Na__Saved = await Na__AiUtils__DataStore__SavePrompt(Na__Collected);

    Na__AiUtils__Editor__Close(Na__AiUtils__Dom.Na__Modal);
    Na__AiUtils__RunRefreshCycle();
    Na__AiUtils__SelectPrompt(Na__Saved.id);
    Na__AiUtils__Toast(Na__UiText.NaMiniApp__StatusSaved);
}
// ------------------------------------------------------------


// FUNCTION | Copy the open prompt into a fresh draft record
// ------------------------------------------------------------
function Na__AiUtils__DuplicateActivePrompt() {
    const Na__Record = Na__AiUtils__DataStore__GetPromptById(Na__AiUtils__State.selectedId);
    if (!Na__Record) return;

    const Na__Copy = {
        ...JSON.parse(JSON.stringify(Na__Record)),
        id         : "",
        title      : `${Na__Record.title} (copy)`,
        status     : "Draft",
        favourite  : false,
        copyCount  : 0,
        lastUsed   : null,
        sourceFile : ""
    };

    Na__AiUtils__OpenEditor(Na__Copy, true);
    Na__AiUtils__Toast(Na__AiUtils__AppConfig.NaMiniApp__UiText.NaMiniApp__StatusDuplicated);
}
// ------------------------------------------------------------


// FUNCTION | Delete the open prompt after confirmation
// ------------------------------------------------------------
async function Na__AiUtils__DeleteActivePrompt() {
    const Na__UiText = Na__AiUtils__AppConfig.NaMiniApp__UiText;
    const Na__Record = Na__AiUtils__DataStore__GetPromptById(Na__AiUtils__State.selectedId);
    if (!Na__Record) return;

    if (!window.confirm(Na__UiText.NaMiniApp__ConfirmDelete)) return;

    await Na__AiUtils__DataStore__DeletePrompt(Na__Record.id);
    Na__AiUtils__State.selectedId = "";

    Na__AiUtils__Ui__RenderEmptyDetail(Na__AiUtils__Dom.Na__DetailPane, Na__UiText);
    Na__AiUtils__RunRefreshCycle();
    Na__AiUtils__Toast(Na__UiText.NaMiniApp__StatusDeleted);
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Rail and List Event Handling
// -----------------------------------------------------------------------------

// FUNCTION | Handle every click inside the navigation rail
// ------------------------------------------------------------
function Na__AiUtils__HandleRailClick(Na__Event) {
    const Na__ScopeButton = Na__Event.target.closest("[data-na-scope]");
    if (Na__ScopeButton) {
        Na__AiUtils__State.criteria.scope       = Na__ScopeButton.getAttribute("data-na-scope");
        Na__AiUtils__State.criteria.category    = "";
        Na__AiUtils__State.criteria.subCategory = "";
        Na__AiUtils__RunRefreshCycle();
        return;
    }

    const Na__CategoryButton = Na__Event.target.closest("[data-na-category]");
    if (Na__CategoryButton) {
        const Na__CategoryKey    = Na__CategoryButton.getAttribute("data-na-category");
        const Na__SubCategoryKey = Na__CategoryButton.getAttribute("data-na-subcategory") || "";
        const Na__Criteria       = Na__AiUtils__State.criteria;


        // Clicking the open category or sub category again clears it
        // ------------------------------------
        if (Na__SubCategoryKey) {
            Na__Criteria.subCategory = Na__Criteria.subCategory === Na__SubCategoryKey ? "" : Na__SubCategoryKey;
            Na__Criteria.category    = Na__CategoryKey;
        } else {
            const Na__IsSameCategory = Na__Criteria.category === Na__CategoryKey && !Na__Criteria.subCategory;
            Na__Criteria.category    = Na__IsSameCategory ? "" : Na__CategoryKey;
            Na__Criteria.subCategory = "";
        }

        Na__Criteria.scope = "All";
        Na__AiUtils__RunRefreshCycle();
        return;
    }

    const Na__KeywordButton = Na__Event.target.closest("[data-na-keyword]");
    if (Na__KeywordButton) {
        const Na__Keyword  = Na__KeywordButton.getAttribute("data-na-keyword");
        const Na__Selected = Na__AiUtils__State.criteria.selectedKeywords;
        const Na__Index    = Na__Selected.indexOf(Na__Keyword);

        if (Na__Index === -1) Na__Selected.push(Na__Keyword);
        else                  Na__Selected.splice(Na__Index, 1);

        Na__AiUtils__RunRefreshCycle();
    }
}
// ------------------------------------------------------------


// FUNCTION | Handle every click inside the result list
// ------------------------------------------------------------
async function Na__AiUtils__HandleResultListClick(Na__Event) {
    const Na__Card = Na__Event.target.closest("[data-na-prompt-id]");
    if (!Na__Card) return;

    const Na__PromptId = Na__Card.getAttribute("data-na-prompt-id");
    const Na__Record   = Na__AiUtils__DataStore__GetPromptById(Na__PromptId);
    if (!Na__Record) return;

    const Na__ActionButton = Na__Event.target.closest("[data-na-action]");
    const Na__Action       = Na__ActionButton ? Na__ActionButton.getAttribute("data-na-action") : "";


    // Quick copy straight from the card
    // ------------------------------------
    if (Na__Action === "quick-copy") {
        Na__Event.stopPropagation();
        await Na__AiUtils__CopyPromptToClipboard(Na__Record, false);
        return;
    }


    // Favourite toggle straight from the card
    // ------------------------------------
    if (Na__Action === "toggle-favourite") {
        Na__Event.stopPropagation();
        await Na__AiUtils__DataStore__ToggleFavourite(Na__PromptId);
        Na__AiUtils__RunRefreshCycle();
        if (Na__AiUtils__State.selectedId === Na__PromptId) Na__AiUtils__SelectPrompt(Na__PromptId);
        return;
    }

    Na__AiUtils__SelectPrompt(Na__PromptId);
    Na__AiUtils__RunRefreshCycle();
}
// ------------------------------------------------------------


// FUNCTION | Handle every click inside the detail pane
// ------------------------------------------------------------
async function Na__AiUtils__HandleDetailClick(Na__Event) {
    const Na__ActionButton = Na__Event.target.closest("[data-na-action]");
    if (!Na__ActionButton) return;

    const Na__Action = Na__ActionButton.getAttribute("data-na-action");
    const Na__Record = Na__AiUtils__DataStore__GetPromptById(Na__AiUtils__State.selectedId);
    if (!Na__Record) return;

    const Na__UiText = Na__AiUtils__AppConfig.NaMiniApp__UiText;

    switch (Na__Action) {
        case "copy-composed":
            await Na__AiUtils__CopyPromptToClipboard(Na__Record, false);
            break;

        case "copy-raw":
            await Na__AiUtils__CopyPromptToClipboard(Na__Record, true);
            break;

        case "edit-prompt":
            Na__AiUtils__OpenEditor(JSON.parse(JSON.stringify(Na__Record)), false);
            break;

        case "duplicate-prompt":
            Na__AiUtils__DuplicateActivePrompt();
            break;

        case "delete-prompt":
            await Na__AiUtils__DeleteActivePrompt();
            break;

        case "download-record":
            Na__AiUtils__DataStore__DownloadRecordFile(Na__Record);
            Na__AiUtils__Toast(Na__UiText.NaMiniApp__StatusExported);
            break;

        case "detail-toggle-favourite":
            await Na__AiUtils__DataStore__ToggleFavourite(Na__Record.id);
            Na__AiUtils__SelectPrompt(Na__Record.id);
            Na__AiUtils__RunRefreshCycle();
            break;

        case "reset-fields":
            Na__AiUtils__State.valueMaps[Na__Record.id] = {};
            Na__AiUtils__SelectPrompt(Na__Record.id);
            break;

        default:
            break;
    }
}
// ------------------------------------------------------------


// FUNCTION | Handle typing inside the job specific fields
// ------------------------------------------------------------
function Na__AiUtils__HandleDetailInput(Na__Event) {
    const Na__Field = Na__Event.target.closest("[data-na-token]");
    if (!Na__Field) return;

    const Na__Token   = Na__Field.getAttribute("data-na-token");
    const Na__ValueMap = Na__AiUtils__GetValueMap(Na__AiUtils__State.selectedId);

    Na__ValueMap[Na__Token] = Na__Field.value;
    Na__Field.closest(".AIPL__field").classList.toggle("AIPL__field--missing", false);

    Na__AiUtils__RecomposeActivePrompt();
    Na__AiUtils__PersistUiState();
}
// ------------------------------------------------------------


// FUNCTION | Handle clicks inside the snippet panel
// ------------------------------------------------------------
async function Na__AiUtils__HandleSnippetClick(Na__Event) {
    const Na__SnippetElement = Na__Event.target.closest("[data-na-snippet]");
    if (!Na__SnippetElement) return;

    const Na__SnippetKey = Na__SnippetElement.getAttribute("data-na-snippet");
    const Na__Snippet    = Na__AiUtils__DataStore__GetSnippets()[Na__SnippetKey];
    if (!Na__Snippet) return;

    const Na__SnippetText = Array.isArray(Na__Snippet.Snippet__Text) ? Na__Snippet.Snippet__Text.join("\n") : String(Na__Snippet.Snippet__Text || "");
    const Na__DidCopy     = await Na__AiUtils__Compose__CopyToClipboard(Na__SnippetText);
    const Na__UiText      = Na__AiUtils__AppConfig.NaMiniApp__UiText;

    Na__AiUtils__Toast(Na__DidCopy ? Na__UiText.NaMiniApp__StatusCopiedSnippet : Na__UiText.NaMiniApp__StatusCopyFailed, !Na__DidCopy);
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Modal Event Handling
// -----------------------------------------------------------------------------

// FUNCTION | Handle every click inside the editor modal
// ------------------------------------------------------------
async function Na__AiUtils__HandleModalClick(Na__Event) {
    const Na__ActionElement = Na__Event.target.closest("[data-na-action]");
    if (!Na__ActionElement) return;

    const Na__Action   = Na__ActionElement.getAttribute("data-na-action");
    const Na__Taxonomy = Na__AiUtils__DataStore__GetTaxonomy();

    switch (Na__Action) {
        case "close-editor":
            Na__AiUtils__Editor__Close(Na__AiUtils__Dom.Na__Modal);
            break;

        case "save-prompt":
            await Na__AiUtils__SaveEditorRecord();
            break;

        case "scan-tokens": {
            const Na__ScanResult = Na__AiUtils__Editor__ScanBodyForTokens(Na__AiUtils__Dom.Na__Modal, Na__Taxonomy);
            Na__AiUtils__Toast(`${Na__ScanResult.inBody} token${Na__ScanResult.inBody === 1 ? "" : "s"} in the body, ${Na__ScanResult.declared} field${Na__ScanResult.declared === 1 ? "" : "s"} declared.`);
            break;
        }

        case "add-variable": {
            const Na__VariableList = Na__AiUtils__Dom.Na__Modal.querySelector("#js__editorVariables");
            Na__VariableList.insertAdjacentHTML("beforeend", Na__AiUtils__Editor__BuildVariableRow({ inputType: "Text" }, Na__Taxonomy));
            break;
        }

        case "remove-variable":
            Na__ActionElement.closest("[data-na-variable-row]").remove();
            break;

        default:
            break;
    }
}
// ------------------------------------------------------------


// FUNCTION | Handle select changes inside the editor modal
// ------------------------------------------------------------
function Na__AiUtils__HandleModalChange(Na__Event) {
    if (Na__Event.target.id === "js__editorCategory") {
        Na__AiUtils__Editor__RefreshSubCategoryOptions(Na__AiUtils__Dom.Na__Modal, Na__AiUtils__DataStore__GetTaxonomy());
        return;
    }


    // Snippet dropdown inserts at the cursor then resets itself
    // ------------------------------------
    if (Na__Event.target.id === "js__snippetInsert") {
        const Na__SnippetKey = Na__Event.target.value;
        if (!Na__SnippetKey) return;

        const Na__Snippet = Na__AiUtils__DataStore__GetSnippets()[Na__SnippetKey];
        if (Na__Snippet) {
            const Na__SnippetText = Array.isArray(Na__Snippet.Snippet__Text) ? Na__Snippet.Snippet__Text.join("\n") : String(Na__Snippet.Snippet__Text || "");
            Na__AiUtils__Editor__InsertSnippetAtCursor(Na__AiUtils__Dom.Na__Modal, Na__SnippetText);
        }

        Na__Event.target.value = "";
    }
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Toolbar and Import Export
// -----------------------------------------------------------------------------

// FUNCTION | Handle every click on the top toolbar
// ------------------------------------------------------------
async function Na__AiUtils__HandleToolbarClick(Na__Event) {
    const Na__ActionElement = Na__Event.target.closest("[data-na-action]");
    if (!Na__ActionElement) return;

    const Na__Action = Na__ActionElement.getAttribute("data-na-action");
    const Na__UiText = Na__AiUtils__AppConfig.NaMiniApp__UiText;

    switch (Na__Action) {
        case "new-prompt":
            Na__AiUtils__OpenEditor(Na__AiUtils__DataStore__CreateBlankRecord(), true);
            break;

        case "export-bundle":
            Na__AiUtils__DataStore__DownloadLibraryBundle();
            Na__AiUtils__Toast(Na__UiText.NaMiniApp__StatusBundleExported);
            break;

        case "export-changed": {
            const Na__FileName = Na__AiUtils__DataStore__DownloadChangedRecords();
            Na__AiUtils__Toast(Na__FileName ? Na__UiText.NaMiniApp__StatusBundleExported : "No local changes to export.", !Na__FileName);
            break;
        }

        case "import-bundle":
            Na__AiUtils__Dom.Na__ImportFile.click();
            break;

        case "sync-server": {
            const Na__Result = await Na__AiUtils__DataStore__FlushPendingOperations();
            Na__AiUtils__Toast(Na__Result.flushed
                ? `Pushed ${Na__Result.flushed} change${Na__Result.flushed === 1 ? "" : "s"} to the server.`
                : "No server answering - changes are still held locally.", !Na__Result.flushed);
            Na__AiUtils__RunRefreshCycle();
            break;
        }

        case "toggle-shortcuts":
            Na__AiUtils__Dom.Na__ShortcutPanel.classList.toggle("AIPL__shortcut-panel--open");
            break;

        case "toggle-archived":
            Na__AiUtils__State.criteria.showArchived = !Na__AiUtils__State.criteria.showArchived;
            Na__ActionElement.classList.toggle("AIPL__button--toggled", Na__AiUtils__State.criteria.showArchived);
            Na__AiUtils__RunRefreshCycle();
            break;

        default:
            break;
    }
}
// ------------------------------------------------------------


// FUNCTION | Read an imported bundle file and merge it into the library
// ------------------------------------------------------------
async function Na__AiUtils__HandleImportFileChosen(Na__Event) {
    const Na__File = Na__Event.target.files && Na__Event.target.files[0];
    if (!Na__File) return;

    try {
        const Na__FileText = await Na__File.text();
        const Na__Count    = await Na__AiUtils__DataStore__ImportLibraryBundle(Na__FileText);

        Na__AiUtils__RunRefreshCycle();
        Na__AiUtils__Toast(`Imported ${Na__Count} prompt${Na__Count === 1 ? "" : "s"}.`);


    // Error handling
    // ------------------------------------
    } catch (Na__ErrorObject) {
        console.error("Import failed.", Na__ErrorObject);
        Na__AiUtils__Toast("That file could not be read as a prompt library bundle.", true);

    } finally {
        Na__Event.target.value = "";
    }
}
// ------------------------------------------------------------


// FUNCTION | Clear one active filter chip
// ------------------------------------------------------------
function Na__AiUtils__HandleClearFilter(Na__Event) {
    const Na__ChipElement = Na__Event.target.closest("[data-na-clear-filter]");
    if (!Na__ChipElement) return;

    const Na__Target   = Na__ChipElement.getAttribute("data-na-clear-filter");
    const Na__Criteria = Na__AiUtils__State.criteria;

    if (Na__Target === "all") {
        Na__Criteria.scope            = "All";
        Na__Criteria.category         = "";
        Na__Criteria.subCategory      = "";
        Na__Criteria.selectedKeywords = [];

    } else if (Na__Target === "scope") {
        Na__Criteria.scope = "All";

    } else if (Na__Target === "category") {
        Na__Criteria.category    = "";
        Na__Criteria.subCategory = "";

    } else if (Na__Target === "subCategory") {
        Na__Criteria.subCategory = "";

    } else if (Na__Target.startsWith("keyword:")) {
        const Na__Keyword = Na__Target.slice(8);
        Na__Criteria.selectedKeywords = Na__Criteria.selectedKeywords.filter((Na__Entry) => Na__Entry !== Na__Keyword);
    }

    Na__AiUtils__RunRefreshCycle();
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Keyboard Handling
// -----------------------------------------------------------------------------

// HELPER FUNCTION | Move the selection up or down the current result list
// ------------------------------------------------------------
function Na__AiUtils__StepSelection(Na__Direction) {
    const Na__Results = Na__AiUtils__State.currentResults;
    if (!Na__Results.length) return;

    const Na__CurrentIndex = Na__Results.findIndex((Na__Result) => Na__Result.record.id === Na__AiUtils__State.selectedId);
    const Na__NextIndex    = Math.max(0, Math.min(Na__Results.length - 1, Na__CurrentIndex + Na__Direction));

    Na__AiUtils__SelectPrompt(Na__Results[Na__NextIndex].record.id);
    Na__AiUtils__RunRefreshCycle();

    const Na__ActiveCard = Na__AiUtils__Dom.Na__ResultList.querySelector(".AIPL__card--active");
    if (Na__ActiveCard) Na__ActiveCard.scrollIntoView({ block: "nearest" });
}
// ------------------------------------------------------------


// FUNCTION | Global keyboard shortcut handling
// ------------------------------------------------------------
async function Na__AiUtils__HandleKeyDown(Na__Event) {
    const Na__IsModalOpen  = Na__AiUtils__Dom.Na__Modal.classList.contains("AIPL__modal--open");
    const Na__ActiveTag    = (document.activeElement && document.activeElement.tagName) || "";
    const Na__IsTypingHere = Na__ActiveTag === "INPUT" || Na__ActiveTag === "TEXTAREA" || Na__ActiveTag === "SELECT";


    // Escape closes the editor, then clears the search box
    // ------------------------------------
    if (Na__Event.key === "Escape") {
        if (Na__IsModalOpen) {
            Na__AiUtils__Editor__Close(Na__AiUtils__Dom.Na__Modal);
            return;
        }

        if (Na__AiUtils__Dom.Na__SearchInput.value) {
            Na__AiUtils__Dom.Na__SearchInput.value      = "";
            Na__AiUtils__State.criteria.queryText       = "";
            Na__AiUtils__RunRefreshCycle();
        }
        return;
    }

    if (Na__IsModalOpen) return;


    // Ctrl + K jumps to the search box from anywhere
    // ------------------------------------
    if ((Na__Event.ctrlKey || Na__Event.metaKey) && Na__Event.key.toLowerCase() === "k") {
        Na__Event.preventDefault();
        Na__AiUtils__Dom.Na__SearchInput.focus();
        Na__AiUtils__Dom.Na__SearchInput.select();
        return;
    }


    // Ctrl + Enter copies the composed prompt
    // ------------------------------------
    if ((Na__Event.ctrlKey || Na__Event.metaKey) && Na__Event.key === "Enter") {
        Na__Event.preventDefault();
        const Na__Record = Na__AiUtils__DataStore__GetPromptById(Na__AiUtils__State.selectedId);
        if (Na__Record) await Na__AiUtils__CopyPromptToClipboard(Na__Record, false);
        return;
    }


    // Alt shortcuts for the record level actions
    // ------------------------------------
    if (Na__Event.altKey) {
        const Na__Key = Na__Event.key.toLowerCase();

        if (Na__Key === "n") {
            Na__Event.preventDefault();
            Na__AiUtils__OpenEditor(Na__AiUtils__DataStore__CreateBlankRecord(), true);
            return;
        }

        if (Na__Key === "e" && Na__AiUtils__State.selectedId) {
            Na__Event.preventDefault();
            Na__AiUtils__OpenEditor(JSON.parse(JSON.stringify(Na__AiUtils__DataStore__GetPromptById(Na__AiUtils__State.selectedId))), false);
            return;
        }

        if (Na__Key === "f" && Na__AiUtils__State.selectedId) {
            Na__Event.preventDefault();
            await Na__AiUtils__DataStore__ToggleFavourite(Na__AiUtils__State.selectedId);
            Na__AiUtils__SelectPrompt(Na__AiUtils__State.selectedId);
            Na__AiUtils__RunRefreshCycle();
            return;
        }
    }


    // Arrow navigation works from the search box and the list, not from a job field
    // ------------------------------------
    const Na__IsSearchBox = document.activeElement === Na__AiUtils__Dom.Na__SearchInput;
    if ((Na__Event.key === "ArrowDown" || Na__Event.key === "ArrowUp") && (!Na__IsTypingHere || Na__IsSearchBox)) {
        Na__Event.preventDefault();
        Na__AiUtils__StepSelection(Na__Event.key === "ArrowDown" ? 1 : -1);
    }
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Event Registration
// -----------------------------------------------------------------------------

// FUNCTION | Wire every listener the app needs
// ------------------------------------------------------------
function Na__AiUtils__RegisterEventListeners() {
    const Na__Debounce = Na__AiUtils__AppConfig.NaMiniApp__Defaults.NaMiniApp__SearchDebounceMs;


    // Search box with a short debounce so typing stays smooth
    // ------------------------------------
    Na__AiUtils__Dom.Na__SearchInput.addEventListener("input", () => {
        window.clearTimeout(Na__AiUtils__State.searchTimerId);
        Na__AiUtils__State.searchTimerId = window.setTimeout(() => {
            Na__AiUtils__State.criteria.queryText = Na__AiUtils__Dom.Na__SearchInput.value;
            Na__AiUtils__RunRefreshCycle();
        }, Na__Debounce || 90);
    });

    Na__AiUtils__Dom.Na__SortSelect.addEventListener("change", () => {
        Na__AiUtils__State.criteria.sortMode = Na__AiUtils__Dom.Na__SortSelect.value;
        Na__AiUtils__RunRefreshCycle();
    });


    // Delegated panel handlers
    // ------------------------------------
    Na__AiUtils__Dom.Na__Rail.addEventListener("click",          Na__AiUtils__HandleRailClick);
    Na__AiUtils__Dom.Na__ResultList.addEventListener("click",    Na__AiUtils__HandleResultListClick);
    Na__AiUtils__Dom.Na__SnippetPanel.addEventListener("click",  Na__AiUtils__HandleSnippetClick);
    Na__AiUtils__Dom.Na__DetailPane.addEventListener("click",    Na__AiUtils__HandleDetailClick);
    Na__AiUtils__Dom.Na__DetailPane.addEventListener("input",    Na__AiUtils__HandleDetailInput);
    Na__AiUtils__Dom.Na__DetailPane.addEventListener("change",   Na__AiUtils__HandleDetailInput);
    Na__AiUtils__Dom.Na__Modal.addEventListener("click",         Na__AiUtils__HandleModalClick);
    Na__AiUtils__Dom.Na__Modal.addEventListener("change",        Na__AiUtils__HandleModalChange);
    Na__AiUtils__Dom.Na__ActiveFilters.addEventListener("click", Na__AiUtils__HandleClearFilter);
    Na__AiUtils__Dom.Na__ImportFile.addEventListener("change",   Na__AiUtils__HandleImportFileChosen);

    document.getElementById("js__toolbar").addEventListener("click", Na__AiUtils__HandleToolbarClick);


    // View tabs
    // ------------------------------------
    Na__AiUtils__Dom.Na__ViewTabs.addEventListener("click", (Na__Event) => {
        const Na__Tab = Na__Event.target.closest("[data-na-view]");
        if (Na__Tab) Na__AiUtils__SetActiveView(Na__Tab.getAttribute("data-na-view"));
    });


    // Keyboard activation of a result card
    // ------------------------------------
    Na__AiUtils__Dom.Na__ResultList.addEventListener("keydown", (Na__Event) => {
        if (Na__Event.key !== "Enter") return;
        const Na__Card = Na__Event.target.closest("[data-na-prompt-id]");
        if (!Na__Card) return;
        Na__AiUtils__SelectPrompt(Na__Card.getAttribute("data-na-prompt-id"));
        Na__AiUtils__RunRefreshCycle();
    });

    window.addEventListener("keydown", Na__AiUtils__HandleKeyDown);
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Bootstrap
// -----------------------------------------------------------------------------

// FUNCTION | Apply the configured UI text into the static page furniture
// ------------------------------------------------------------
function Na__AiUtils__ApplyUiTextFromConfig() {
    const Na__UiText = Na__AiUtils__AppConfig.NaMiniApp__UiText;
    const Na__Meta   = Na__AiUtils__AppConfig.NaMiniApp__Meta;

    document.title                                    = `${Na__Meta.NaMiniApp__AppTitle} - Noble Architecture`;
    Na__AiUtils__Dom.Na__AppTitle.textContent         = Na__UiText.NaMiniApp__AppHeading;
    Na__AiUtils__Dom.Na__SearchInput.placeholder      = Na__UiText.NaMiniApp__SearchPlaceholder;


    // Sort mode options come from the config so the list order stays data driven
    // ------------------------------------
    const Na__SortModes = Na__AiUtils__AppConfig.NaMiniApp__SortModes;
    Na__AiUtils__Dom.Na__SortSelect.innerHTML = Object.keys(Na__SortModes)
        .sort((Na__A, Na__B) => Na__SortModes[Na__A].SortMode__LoadOrder - Na__SortModes[Na__B].SortMode__LoadOrder)
        .map((Na__Key) => `<option value="${Na__Key}">${Na__SortModes[Na__Key].SortMode__Title}</option>`)
        .join("");


    // Keyboard shortcut reference panel
    // ------------------------------------
    Na__AiUtils__Dom.Na__ShortcutPanel.innerHTML = (Na__AiUtils__AppConfig.NaMiniApp__KeyboardShortcuts || [])
        .map((Na__Shortcut) => `<div class="AIPL__shortcut-row"><span class="AIPL__kbd">${Na__Shortcut.Shortcut__Keys}</span><span>${Na__Shortcut.Shortcut__Action}</span></div>`)
        .join("");
}
// ------------------------------------------------------------


// FUNCTION | Load config, load the library, restore state and paint the first frame
// ------------------------------------------------------------
async function Na__AiUtils__BootstrapApp() {
    const Na__ConfigResponse = await fetch(Na__AiUtils__ConfigPath, { cache: "no-cache" });
    if (!Na__ConfigResponse.ok) throw new Error(`Failed to load app config (HTTP ${Na__ConfigResponse.status}).`);

    Na__AiUtils__AppConfig = await Na__ConfigResponse.json();

    const Na__Defaults = Na__AiUtils__AppConfig.NaMiniApp__Defaults;
    Na__AiUtils__State.criteria.sortMode     = Na__Defaults.NaMiniApp__DefaultSortMode;
    Na__AiUtils__State.criteria.showArchived = Na__Defaults.NaMiniApp__ShowArchivedByDefault === true;

    Na__AiUtils__ApplyUiTextFromConfig();
    Na__AiUtils__RestoreUiState();

    const Na__Library = await Na__AiUtils__DataStore__Initialise(Na__AiUtils__AppConfig);

    Na__AiUtils__Dom.Na__SortSelect.value = Na__AiUtils__State.criteria.sortMode;
    Na__AiUtils__RegisterEventListeners();

    Na__AiUtils__Dom.Na__SearchInput.value = Na__AiUtils__State.criteria.queryText || "";
    Na__AiUtils__SetActiveView(Na__AiUtils__State.activeView);
    Na__AiUtils__RunRefreshCycle();


    // Restore the previously open prompt where it still exists
    // ------------------------------------
    if (Na__AiUtils__State.selectedId && Na__AiUtils__DataStore__GetPromptById(Na__AiUtils__State.selectedId)) {
        Na__AiUtils__SelectPrompt(Na__AiUtils__State.selectedId);
        Na__AiUtils__RunRefreshCycle();
    } else {
        Na__AiUtils__Ui__RenderEmptyDetail(Na__AiUtils__Dom.Na__DetailPane, Na__AiUtils__AppConfig.NaMiniApp__UiText);
    }

    if (Na__Library.warnings.length) {
        Na__AiUtils__Toast(Na__Library.warnings[0], true);
    }
}
// ------------------------------------------------------------


// INITIALISE | Run bootstrap on DOM ready
// ------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
    Na__AiUtils__BootstrapApp().catch((Na__ErrorObject) => {
        console.error("AI Prompt Library bootstrap failed:", Na__ErrorObject);
        document.getElementById("js__detailPane").innerHTML =
            `<div class="AIPL__empty-block"><strong class="AIPL__empty-heading">Could not start</strong>
             <p class="AIPL__empty-body">${Na__ErrorObject.message}</p>
             <p class="AIPL__empty-body">This app loads JSON data files, so it must be served over http rather than opened straight off disk.</p></div>`;
    });
});
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------
