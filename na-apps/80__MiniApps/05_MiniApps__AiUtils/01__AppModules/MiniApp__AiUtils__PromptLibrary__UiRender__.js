// =============================================================================
// NOBLE ARCHITECTURE - AI UTILS - PROMPT LIBRARY - UI RENDER
// =============================================================================
//
// FILE    : MiniApp__AiUtils__PromptLibrary__UiRender__.js
// AUTHOR  : Adam Noble - Noble Architecture
// PURPOSE : All DOM construction for the rail, result list, detail pane and toasts
// CREATED : 26-Aug-2026
//
// DESCRIPTION:
// - Pure rendering only. Nothing here reads or writes application state and
//   nothing here binds an event listener - every interactive element carries a
//   data attribute and the controller handles it by delegation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Text and Markup Helpers
// -----------------------------------------------------------------------------

// HELPER FUNCTION | Escape a string for safe insertion into markup
// ------------------------------------------------------------
export function Na__AiUtils__Ui__EscapeHtml(Na__Text) {
    return String(Na__Text === null || Na__Text === undefined ? "" : Na__Text)
        .replace(/&/g,  "&amp;")
        .replace(/</g,  "&lt;")
        .replace(/>/g,  "&gt;")
        .replace(/"/g,  "&quot;")
        .replace(/'/g,  "&#39;");
}
// ------------------------------------------------------------


// HELPER FUNCTION | Wrap any remaining unfilled token in a highlight span
// ------------------------------------------------------------
function Na__AiUtils__HighlightUnfilledTokens(Na__EscapedText) {
    return Na__EscapedText.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, '<span class="AIPL__token-gap">{{$1}}</span>');
}
// ------------------------------------------------------------


// HELPER FUNCTION | Trim a long string to a preview length on a word boundary
// ------------------------------------------------------------
function Na__AiUtils__TruncateText(Na__Text, Na__MaxLength) {
    const Na__Clean = String(Na__Text || "").replace(/\s+/g, " ").trim();
    if (Na__Clean.length <= Na__MaxLength) return Na__Clean;

    const Na__Cut       = Na__Clean.slice(0, Na__MaxLength);
    const Na__LastSpace = Na__Cut.lastIndexOf(" ");
    return `${Na__LastSpace > 40 ? Na__Cut.slice(0, Na__LastSpace) : Na__Cut}...`;
}
// ------------------------------------------------------------


// HELPER FUNCTION | Resolve the readable titles for a record's category pairing
// ------------------------------------------------------------
export function Na__AiUtils__Ui__ResolveCategoryTitles(Na__Record, Na__Taxonomy) {
    const Na__Categories = (Na__Taxonomy && Na__Taxonomy.PromptLibrary__Categories) || {};
    const Na__Category   = Na__Categories[Na__Record.category];

    if (!Na__Category) {
        return { categoryTitle: Na__Record.category || "Uncategorised", subCategoryTitle: Na__Record.subCategory || "", accentColour: "#6b7280" };
    }

    const Na__SubCategory = (Na__Category.Category__SubCategories || {})[Na__Record.subCategory];

    return {
        categoryTitle    : Na__Category.Category__Title || Na__Record.category,
        subCategoryTitle : Na__SubCategory ? (Na__SubCategory.SubCategory__Title || Na__Record.subCategory) : (Na__Record.subCategory || ""),
        accentColour     : Na__Category.Category__AccentColour || "#6b7280"
    };
}
// ------------------------------------------------------------


// HELPER FUNCTION | Convert an ISO timestamp into a short relative description
// ------------------------------------------------------------
function Na__AiUtils__DescribeTimeSince(Na__IsoTimestamp) {
    if (!Na__IsoTimestamp) return "never";

    const Na__ElapsedMs   = Date.now() - new Date(Na__IsoTimestamp).getTime();
    const Na__ElapsedMins = Math.floor(Na__ElapsedMs / 60000);

    if (Na__ElapsedMins < 1)    return "just now";
    if (Na__ElapsedMins < 60)   return `${Na__ElapsedMins} min ago`;

    const Na__ElapsedHours = Math.floor(Na__ElapsedMins / 60);
    if (Na__ElapsedHours < 24)  return `${Na__ElapsedHours} hr ago`;

    const Na__ElapsedDays = Math.floor(Na__ElapsedHours / 24);
    if (Na__ElapsedDays < 31)   return `${Na__ElapsedDays} day${Na__ElapsedDays === 1 ? "" : "s"} ago`;

    return new Date(Na__IsoTimestamp).toLocaleDateString("en-GB");
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Navigation Rail
// -----------------------------------------------------------------------------

// HELPER FUNCTION | Build one scope row for the library section of the rail
// ------------------------------------------------------------
function Na__AiUtils__BuildScopeRow(Na__ScopeKey, Na__Label, Na__Count, Na__ActiveScope) {
    const Na__IsActive = Na__ActiveScope === Na__ScopeKey;
    return `
        <button type="button" class="AIPL__rail-row ${Na__IsActive ? "AIPL__rail-row--active" : ""}" data-na-scope="${Na__ScopeKey}">
            <span class="AIPL__rail-row-label">${Na__AiUtils__Ui__EscapeHtml(Na__Label)}</span>
            <span class="AIPL__rail-count">${Na__Count}</span>
        </button>`;
}
// ------------------------------------------------------------


// FUNCTION | Render the whole navigation rail
// ------------------------------------------------------------
export function Na__AiUtils__Ui__RenderRail(Na__RailElement, Na__RenderModel) {
    const { taxonomy, records, categoryCounts, keywordCloud, criteria, uiText } = Na__RenderModel;

    const Na__FavouriteCount = records.filter((Na__Record) => Na__Record.favourite).length;
    const Na__RecentCount    = records.filter((Na__Record) => Na__Record.lastUsed).length;
    const Na__DraftCount     = records.filter((Na__Record) => Na__Record.status === "Draft").length;
    const Na__ArchivedCount  = records.filter((Na__Record) => Na__Record.status === "Archived").length;
    const Na__LiveCount      = records.filter((Na__Record) => Na__Record.status !== "Archived").length;


    // Library scope rows
    // ------------------------------------
    let Na__Markup = `
        <div class="AIPL__rail-section">
            <h2 class="AIPL__rail-heading">${Na__AiUtils__Ui__EscapeHtml(uiText.NaMiniApp__RailHeadingLibrary)}</h2>
            ${Na__AiUtils__BuildScopeRow("All",        uiText.NaMiniApp__LabelAllPrompts, Na__LiveCount,      criteria.scope)}
            ${Na__AiUtils__BuildScopeRow("Favourites", uiText.NaMiniApp__LabelFavourites, Na__FavouriteCount, criteria.scope)}
            ${Na__AiUtils__BuildScopeRow("Recent",     uiText.NaMiniApp__LabelRecent,     Na__RecentCount,    criteria.scope)}
            ${Na__AiUtils__BuildScopeRow("Drafts",     uiText.NaMiniApp__LabelDrafts,     Na__DraftCount,     criteria.scope)}
            ${Na__AiUtils__BuildScopeRow("Archived",   uiText.NaMiniApp__LabelArchived,   Na__ArchivedCount,  criteria.scope)}
        </div>`;


    // Category tree with sub category children
    // ------------------------------------
    const Na__Categories = (taxonomy && taxonomy.PromptLibrary__Categories) || {};
    const Na__OrderedKeys = Object.keys(Na__Categories).sort(
        (Na__A, Na__B) => (Na__Categories[Na__A].Category__LoadOrder || 999) - (Na__Categories[Na__B].Category__LoadOrder || 999)
    );

    Na__Markup += `
        <div class="AIPL__rail-section">
            <h2 class="AIPL__rail-heading">${Na__AiUtils__Ui__EscapeHtml(uiText.NaMiniApp__RailHeadingCategories)}</h2>`;

    Na__OrderedKeys.forEach((Na__CategoryKey) => {
        const Na__Category      = Na__Categories[Na__CategoryKey];
        const Na__CountEntry    = categoryCounts[Na__CategoryKey] || { total: 0, subCategories: {} };
        const Na__IsActive      = criteria.category === Na__CategoryKey && !criteria.subCategory;
        const Na__IsExpanded    = criteria.category === Na__CategoryKey;
        const Na__AccentColour  = Na__Category.Category__AccentColour || "#6b7280";

        Na__Markup += `
            <button type="button" class="AIPL__rail-row AIPL__rail-row--category ${Na__IsActive ? "AIPL__rail-row--active" : ""}"
                    data-na-category="${Na__AiUtils__Ui__EscapeHtml(Na__CategoryKey)}"
                    title="${Na__AiUtils__Ui__EscapeHtml(Na__Category.Category__Description || "")}">
                <span class="AIPL__rail-glyph" style="color:${Na__AiUtils__Ui__EscapeHtml(Na__AccentColour)}">${Na__AiUtils__Ui__EscapeHtml(Na__Category.Category__Glyph || "")}</span>
                <span class="AIPL__rail-row-label">${Na__AiUtils__Ui__EscapeHtml(Na__Category.Category__Title)}</span>
                <span class="AIPL__rail-count">${Na__CountEntry.total}</span>
            </button>`;


        // Sub category children only render for the open category
        // ------------------------------------
        if (!Na__IsExpanded) return;

        const Na__SubCategories = Na__Category.Category__SubCategories || {};
        const Na__SubKeys       = Object.keys(Na__SubCategories).sort(
            (Na__A, Na__B) => (Na__SubCategories[Na__A].SubCategory__LoadOrder || 999) - (Na__SubCategories[Na__B].SubCategory__LoadOrder || 999)
        );

        Na__SubKeys.forEach((Na__SubKey) => {
            const Na__SubCount    = Na__CountEntry.subCategories[Na__SubKey] || 0;
            const Na__SubIsActive = criteria.subCategory === Na__SubKey;

            Na__Markup += `
                <button type="button" class="AIPL__rail-row AIPL__rail-row--sub ${Na__SubIsActive ? "AIPL__rail-row--active" : ""} ${Na__SubCount === 0 ? "AIPL__rail-row--empty" : ""}"
                        data-na-category="${Na__AiUtils__Ui__EscapeHtml(Na__CategoryKey)}"
                        data-na-subcategory="${Na__AiUtils__Ui__EscapeHtml(Na__SubKey)}"
                        title="${Na__AiUtils__Ui__EscapeHtml(Na__SubCategories[Na__SubKey].SubCategory__Description || "")}">
                    <span class="AIPL__rail-row-label">${Na__AiUtils__Ui__EscapeHtml(Na__SubCategories[Na__SubKey].SubCategory__Title)}</span>
                    <span class="AIPL__rail-count">${Na__SubCount}</span>
                </button>`;
        });
    });

    Na__Markup += `</div>`;


    // Keyword chips
    // ------------------------------------
    Na__Markup += `
        <div class="AIPL__rail-section">
            <h2 class="AIPL__rail-heading">${Na__AiUtils__Ui__EscapeHtml(uiText.NaMiniApp__RailHeadingKeywords)}</h2>
            <div class="AIPL__chip-cloud">`;

    keywordCloud.forEach((Na__Entry) => {
        const Na__IsSelected = (criteria.selectedKeywords || []).includes(Na__Entry.keyword);
        Na__Markup += `
                <button type="button" class="AIPL__chip ${Na__IsSelected ? "AIPL__chip--active" : ""}" data-na-keyword="${Na__AiUtils__Ui__EscapeHtml(Na__Entry.keyword)}">
                    ${Na__AiUtils__Ui__EscapeHtml(Na__Entry.keyword)}<span class="AIPL__chip-count">${Na__Entry.count}</span>
                </button>`;
    });

    Na__Markup += `
            </div>
        </div>`;

    Na__RailElement.innerHTML = Na__Markup;
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Result List
// -----------------------------------------------------------------------------

// FUNCTION | Render the search result list
// ------------------------------------------------------------
export function Na__AiUtils__Ui__RenderResultList(Na__ListElement, Na__RenderModel) {
    const { results, selectedId, taxonomy, uiText, previewLength } = Na__RenderModel;


    // Empty state
    // ------------------------------------
    if (!results.length) {
        Na__ListElement.innerHTML = `
            <div class="AIPL__empty-block">
                <strong class="AIPL__empty-heading">${Na__AiUtils__Ui__EscapeHtml(uiText.NaMiniApp__EmptyListHeading)}</strong>
                <p class="AIPL__empty-body">${Na__AiUtils__Ui__EscapeHtml(uiText.NaMiniApp__EmptyListBody)}</p>
            </div>`;
        return;
    }

    let Na__Markup = "";


    // One card per result
    // ------------------------------------
    results.forEach((Na__Result) => {
        const Na__Record   = Na__Result.record;
        const Na__Titles   = Na__AiUtils__Ui__ResolveCategoryTitles(Na__Record, taxonomy);
        const Na__IsActive = Na__Record.id === selectedId;
        const Na__Preview  = Na__AiUtils__TruncateText(Na__Record.summary || Na__Record.promptText, previewLength || 190);
        const Na__VarCount = (Na__Record.variables || []).length;

        Na__Markup += `
            <article class="AIPL__card ${Na__IsActive ? "AIPL__card--active" : ""}" data-na-prompt-id="${Na__AiUtils__Ui__EscapeHtml(Na__Record.id)}" tabindex="0">
                <div class="AIPL__card-head">
                    <h3 class="AIPL__card-title">${Na__AiUtils__Ui__EscapeHtml(Na__Record.title)}</h3>
                    <div class="AIPL__card-actions">
                        <button type="button" class="AIPL__icon-button ${Na__Record.favourite ? "AIPL__icon-button--starred" : ""}"
                                data-na-action="toggle-favourite" title="Toggle favourite">${Na__Record.favourite ? "★" : "☆"}</button>
                        <button type="button" class="AIPL__icon-button" data-na-action="quick-copy" title="Copy this prompt straight to the clipboard">⧉</button>
                    </div>
                </div>

                <div class="AIPL__card-meta">
                    <span class="AIPL__pill" style="border-color:${Na__AiUtils__Ui__EscapeHtml(Na__Titles.accentColour)}66; background-color:${Na__AiUtils__Ui__EscapeHtml(Na__Titles.accentColour)}14; color:${Na__AiUtils__Ui__EscapeHtml(Na__Titles.accentColour)}">
                        ${Na__AiUtils__Ui__EscapeHtml(Na__Titles.subCategoryTitle || Na__Titles.categoryTitle)}
                    </span>
                    ${Na__Record.status !== "Active" ? `<span class="AIPL__pill AIPL__pill--status">${Na__AiUtils__Ui__EscapeHtml(Na__Record.status)}</span>` : ""}
                    ${Na__VarCount ? `<span class="AIPL__pill AIPL__pill--variable">${Na__VarCount} field${Na__VarCount === 1 ? "" : "s"}</span>` : ""}
                    ${Na__Record.copyCount ? `<span class="AIPL__pill AIPL__pill--usage">used ${Na__Record.copyCount}&times;</span>` : ""}
                </div>

                <p class="AIPL__card-preview">${Na__AiUtils__Ui__EscapeHtml(Na__Preview)}</p>

                <div class="AIPL__card-keywords">
                    ${(Na__Record.keyWords || []).slice(0, 6).map((Na__Keyword) => `<span class="AIPL__keyword">${Na__AiUtils__Ui__EscapeHtml(Na__Keyword)}</span>`).join("")}
                </div>
            </article>`;
    });

    Na__ListElement.innerHTML = Na__Markup;
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Detail Pane
// -----------------------------------------------------------------------------

// HELPER FUNCTION | Build the input control markup for one job specific variable
// ------------------------------------------------------------
function Na__AiUtils__BuildVariableField(Na__Variable, Na__CurrentValue) {
    const Na__SafeToken   = Na__AiUtils__Ui__EscapeHtml(Na__Variable.token);
    const Na__SafeValue   = Na__AiUtils__Ui__EscapeHtml(Na__CurrentValue || "");
    const Na__Placeholder = Na__AiUtils__Ui__EscapeHtml(Na__Variable.placeholder || "");
    const Na__FieldId     = `js__variable__${Na__SafeToken}`;

    let Na__ControlMarkup = "";


    // Pick the control that matches the declared input type
    // ------------------------------------
    switch (Na__Variable.inputType) {
        case "TextArea":
            Na__ControlMarkup = `<textarea id="${Na__FieldId}" class="AIPL__field-input AIPL__field-input--area" rows="4"
                                     data-na-token="${Na__SafeToken}" placeholder="${Na__Placeholder}">${Na__SafeValue}</textarea>`;
            break;

        case "Select":
            Na__ControlMarkup = `<select id="${Na__FieldId}" class="AIPL__field-input" data-na-token="${Na__SafeToken}">
                                     <option value="">- not set -</option>
                                     ${(Na__Variable.options || []).map((Na__Option) => {
                                         const Na__SafeOption = Na__AiUtils__Ui__EscapeHtml(Na__Option);
                                         return `<option value="${Na__SafeOption}" ${Na__Option === Na__CurrentValue ? "selected" : ""}>${Na__SafeOption}</option>`;
                                     }).join("")}
                                 </select>`;
            break;

        case "Number":
            Na__ControlMarkup = `<input id="${Na__FieldId}" type="number" class="AIPL__field-input"
                                     data-na-token="${Na__SafeToken}" value="${Na__SafeValue}" placeholder="${Na__Placeholder}" />`;
            break;

        case "Toggle":
            Na__ControlMarkup = `<select id="${Na__FieldId}" class="AIPL__field-input" data-na-token="${Na__SafeToken}">
                                     ${(Na__Variable.options && Na__Variable.options.length ? Na__Variable.options : ["Yes", "No"]).map((Na__Option) => {
                                         const Na__SafeOption = Na__AiUtils__Ui__EscapeHtml(Na__Option);
                                         return `<option value="${Na__SafeOption}" ${Na__Option === Na__CurrentValue ? "selected" : ""}>${Na__SafeOption}</option>`;
                                     }).join("")}
                                 </select>`;
            break;

        default:
            Na__ControlMarkup = `<input id="${Na__FieldId}" type="text" class="AIPL__field-input"
                                     data-na-token="${Na__SafeToken}" value="${Na__SafeValue}" placeholder="${Na__Placeholder}" />`;
            break;
    }

    const Na__IsEmpty = String(Na__CurrentValue || "").trim() === "";

    return `
        <div class="AIPL__field ${Na__Variable.required && Na__IsEmpty ? "AIPL__field--missing" : ""} ${Na__Variable.isOrphan ? "AIPL__field--orphan" : ""}">
            <label class="AIPL__field-label" for="${Na__FieldId}">
                ${Na__AiUtils__Ui__EscapeHtml(Na__Variable.label)}
                ${Na__Variable.required ? '<span class="AIPL__field-required">required</span>' : ""}
                ${Na__Variable.isOrphan ? '<span class="AIPL__field-warning">token missing from body</span>' : ""}
                ${Na__Variable.isAutoDetected ? '<span class="AIPL__field-warning">auto detected</span>' : ""}
            </label>
            ${Na__ControlMarkup}
            ${Na__Variable.helpText ? `<p class="AIPL__field-help">${Na__AiUtils__Ui__EscapeHtml(Na__Variable.helpText)}</p>` : ""}
        </div>`;
}
// ------------------------------------------------------------


// FUNCTION | Render the empty state shown when no prompt is open
// ------------------------------------------------------------
export function Na__AiUtils__Ui__RenderEmptyDetail(Na__DetailElement, Na__UiText) {
    Na__DetailElement.innerHTML = `
        <div class="AIPL__empty-block AIPL__empty-block--detail">
            <strong class="AIPL__empty-heading">${Na__AiUtils__Ui__EscapeHtml(Na__UiText.NaMiniApp__EmptyDetailHeading)}</strong>
            <p class="AIPL__empty-body">${Na__AiUtils__Ui__EscapeHtml(Na__UiText.NaMiniApp__EmptyDetailBody)}</p>
        </div>`;
}
// ------------------------------------------------------------


// FUNCTION | Render the full detail and compose pane for one prompt
// ------------------------------------------------------------
export function Na__AiUtils__Ui__RenderDetail(Na__DetailElement, Na__RenderModel) {
    const { record, variables, valueMap, composeResult, taxonomy, uiText } = Na__RenderModel;
    const Na__Titles = Na__AiUtils__Ui__ResolveCategoryTitles(record, taxonomy);


    // Header block with breadcrumb and primary actions
    // ------------------------------------
    let Na__Markup = `
        <header class="AIPL__detail-head">
            <div class="AIPL__detail-breadcrumb">
                <span style="color:${Na__AiUtils__Ui__EscapeHtml(Na__Titles.accentColour)}">${Na__AiUtils__Ui__EscapeHtml(Na__Titles.categoryTitle)}</span>
                ${Na__Titles.subCategoryTitle ? `<span class="AIPL__breadcrumb-sep">/</span><span>${Na__AiUtils__Ui__EscapeHtml(Na__Titles.subCategoryTitle)}</span>` : ""}
                <span class="AIPL__breadcrumb-sep">/</span><span>v${Na__AiUtils__Ui__EscapeHtml(record.version)}</span>
                ${record.status !== "Active" ? `<span class="AIPL__breadcrumb-sep">/</span><span class="AIPL__pill AIPL__pill--status">${Na__AiUtils__Ui__EscapeHtml(record.status)}</span>` : ""}
            </div>

            <div class="AIPL__detail-title-row">
                <h2 class="AIPL__detail-title">${Na__AiUtils__Ui__EscapeHtml(record.title)}</h2>
                <button type="button" class="AIPL__icon-button AIPL__icon-button--large ${record.favourite ? "AIPL__icon-button--starred" : ""}"
                        data-na-action="detail-toggle-favourite" title="Toggle favourite (Alt + F)">${record.favourite ? "★" : "☆"}</button>
            </div>

            ${record.summary ? `<p class="AIPL__detail-summary">${Na__AiUtils__Ui__EscapeHtml(record.summary)}</p>` : ""}

            <div class="AIPL__detail-toolbar">
                <button type="button" class="AIPL__button AIPL__button--primary" data-na-action="copy-composed">
                    ${Na__AiUtils__Ui__EscapeHtml(uiText.NaMiniApp__ButtonCopyComposed)}
                </button>
                <button type="button" class="AIPL__button" data-na-action="copy-raw">${Na__AiUtils__Ui__EscapeHtml(uiText.NaMiniApp__ButtonCopyRaw)}</button>
                <button type="button" class="AIPL__button" data-na-action="edit-prompt">${Na__AiUtils__Ui__EscapeHtml(uiText.NaMiniApp__ButtonEdit)}</button>
                <button type="button" class="AIPL__button" data-na-action="duplicate-prompt">${Na__AiUtils__Ui__EscapeHtml(uiText.NaMiniApp__ButtonDuplicate)}</button>
                <button type="button" class="AIPL__button" data-na-action="download-record">${Na__AiUtils__Ui__EscapeHtml(uiText.NaMiniApp__ButtonDownloadRecord)}</button>
                <button type="button" class="AIPL__button AIPL__button--danger" data-na-action="delete-prompt">${Na__AiUtils__Ui__EscapeHtml(uiText.NaMiniApp__ButtonDelete)}</button>
            </div>

            <div class="AIPL__detail-chips">
                ${(record.modelTargets || []).map((Na__Model) => `<span class="AIPL__pill AIPL__pill--model">@${Na__AiUtils__Ui__EscapeHtml(Na__Model)}</span>`).join("")}
                ${(record.keyWords || []).map((Na__Keyword) => `<span class="AIPL__keyword">${Na__AiUtils__Ui__EscapeHtml(Na__Keyword)}</span>`).join("")}
            </div>
        </header>`;


    // Job specific field form, only when the prompt declares variables
    // ------------------------------------
    if (variables.length) {
        Na__Markup += `
            <section class="AIPL__detail-section">
                <div class="AIPL__section-head">
                    <h3 class="AIPL__section-title">${Na__AiUtils__Ui__EscapeHtml(uiText.NaMiniApp__DetailHeadingJob)}</h3>
                    <button type="button" class="AIPL__link-button" data-na-action="reset-fields">${Na__AiUtils__Ui__EscapeHtml(uiText.NaMiniApp__ButtonResetFields)}</button>
                </div>
                <div class="AIPL__field-grid">
                    ${variables.map((Na__Variable) => Na__AiUtils__BuildVariableField(Na__Variable, valueMap[Na__Variable.token])).join("")}
                </div>
            </section>`;
    }


    // Composed output block
    // ------------------------------------
    Na__Markup += `
        <section class="AIPL__detail-section AIPL__detail-section--output">
            <div class="AIPL__section-head">
                <h3 class="AIPL__section-title">${Na__AiUtils__Ui__EscapeHtml(uiText.NaMiniApp__DetailHeadingOutput)}</h3>
                <span id="js__composeStatus" class="AIPL__compose-status"></span>
            </div>
            <pre id="js__composedOutput" class="AIPL__composed-output"></pre>
        </section>`;


    // Working notes and usage footer
    // ------------------------------------
    Na__Markup += `
        <section class="AIPL__detail-section">
            <h3 class="AIPL__section-title">${Na__AiUtils__Ui__EscapeHtml(uiText.NaMiniApp__DetailHeadingNotes)}</h3>
            <p class="AIPL__detail-notes">${record.notes ? Na__AiUtils__Ui__EscapeHtml(record.notes) : "No notes recorded."}</p>
            <div class="AIPL__detail-stats">
                <span>Copied <strong>${record.copyCount || 0}</strong> times</span>
                <span>Last used <strong>${Na__AiUtils__Ui__EscapeHtml(Na__AiUtils__DescribeTimeSince(record.lastUsed))}</strong></span>
                <span>Updated <strong>${Na__AiUtils__Ui__EscapeHtml(record.updated || "-")}</strong></span>
                <span class="AIPL__detail-id">${Na__AiUtils__Ui__EscapeHtml(record.id)}</span>
            </div>
        </section>`;

    Na__DetailElement.innerHTML = Na__Markup;
    Na__AiUtils__Ui__UpdateComposedOutput(Na__DetailElement, composeResult, uiText);
}
// ------------------------------------------------------------


// FUNCTION | Refresh only the composed output block, leaving field focus intact
// ------------------------------------------------------------
export function Na__AiUtils__Ui__UpdateComposedOutput(Na__DetailElement, Na__ComposeResult, Na__UiText) {
    const Na__OutputElement = Na__DetailElement.querySelector("#js__composedOutput");
    const Na__StatusElement = Na__DetailElement.querySelector("#js__composeStatus");
    if (!Na__OutputElement) return;

    Na__OutputElement.innerHTML = Na__AiUtils__HighlightUnfilledTokens(Na__AiUtils__Ui__EscapeHtml(Na__ComposeResult.composedText));

    if (!Na__StatusElement) return;


    // Report readiness against the required fields
    // ------------------------------------
    if (Na__ComposeResult.missingRequired.length) {
        const Na__Labels = Na__ComposeResult.missingRequired.map((Na__Variable) => Na__Variable.label).join(", ");
        Na__StatusElement.textContent = `Waiting on: ${Na__Labels}`;
        Na__StatusElement.className   = "AIPL__compose-status AIPL__compose-status--waiting";
        return;
    }

    Na__StatusElement.textContent = "Ready to copy";
    Na__StatusElement.className   = "AIPL__compose-status AIPL__compose-status--ready";
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Snippet Panel and Toast
// -----------------------------------------------------------------------------

// FUNCTION | Render the reusable snippet block list
// ------------------------------------------------------------
export function Na__AiUtils__Ui__RenderSnippets(Na__ContainerElement, Na__Snippets, Na__PreviewLength) {
    const Na__OrderedKeys = Object.keys(Na__Snippets || {}).sort(
        (Na__A, Na__B) => (Na__Snippets[Na__A].Snippet__LoadOrder || 999) - (Na__Snippets[Na__B].Snippet__LoadOrder || 999)
    );

    if (!Na__OrderedKeys.length) {
        Na__ContainerElement.innerHTML = `<p class="AIPL__empty-body">No snippet blocks defined.</p>`;
        return;
    }

    Na__ContainerElement.innerHTML = Na__OrderedKeys.map((Na__Key) => {
        const Na__Snippet     = Na__Snippets[Na__Key];
        const Na__SnippetText = Array.isArray(Na__Snippet.Snippet__Text) ? Na__Snippet.Snippet__Text.join("\n") : String(Na__Snippet.Snippet__Text || "");

        return `
            <article class="AIPL__snippet" data-na-snippet="${Na__AiUtils__Ui__EscapeHtml(Na__Key)}">
                <div class="AIPL__snippet-head">
                    <h4 class="AIPL__snippet-title">${Na__AiUtils__Ui__EscapeHtml(Na__Snippet.Snippet__Title)}</h4>
                    <button type="button" class="AIPL__icon-button" data-na-action="copy-snippet" title="Copy this block">⧉</button>
                </div>
                <p class="AIPL__snippet-description">${Na__AiUtils__Ui__EscapeHtml(Na__Snippet.Snippet__Description || "")}</p>
                <pre class="AIPL__snippet-preview">${Na__AiUtils__Ui__EscapeHtml(Na__AiUtils__TruncateText(Na__SnippetText, Na__PreviewLength || 190))}</pre>
            </article>`;
    }).join("");
}
// ------------------------------------------------------------


// FUNCTION | Flash a transient status message in the corner of the screen
// ------------------------------------------------------------
export function Na__AiUtils__Ui__ShowToast(Na__ToastElement, Na__Message, Na__DurationMs, Na__IsError) {
    Na__ToastElement.textContent = Na__Message;
    Na__ToastElement.className   = `AIPL__toast AIPL__toast--visible ${Na__IsError ? "AIPL__toast--error" : ""}`;

    window.clearTimeout(Na__ToastElement.__na_toast_timer);
    Na__ToastElement.__na_toast_timer = window.setTimeout(() => {
        Na__ToastElement.className = "AIPL__toast";
    }, Na__DurationMs || 2200);
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------
