// =============================================================================
// NOBLE ARCHITECTURE - AI UTILS - PROMPT LIBRARY - PROMPT EDITOR
// =============================================================================
//
// FILE    : MiniApp__AiUtils__PromptLibrary__PromptEditor__.js
// AUTHOR  : Adam Noble - Noble Architecture
// PURPOSE : The add and edit prompt modal - form build, token scan and collection
// CREATED : 26-Aug-2026
//
// DESCRIPTION:
// - Builds the editor form from the taxonomy so category, sub category, model
//   target and status choices always match the data definition.
// - The variable table is the contract between the prompt body and the compose
//   form - Scan Body For Tokens keeps the two in step in one click.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Imports
// -----------------------------------------------------------------------------

// @delegate: ./MiniApp__AiUtils__PromptLibrary__UiRender__.js
import { Na__AiUtils__Ui__EscapeHtml } from "./MiniApp__AiUtils__PromptLibrary__UiRender__.js";

// @delegate: ./MiniApp__AiUtils__PromptLibrary__PromptCompose__.js
import {
    Na__AiUtils__Compose__ExtractTokens,
    Na__AiUtils__Compose__BuildLabelFromToken
} from "./MiniApp__AiUtils__PromptLibrary__PromptCompose__.js";

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Option Builders
// -----------------------------------------------------------------------------

// HELPER FUNCTION | Build option markup for the category select
// ------------------------------------------------------------
function Na__AiUtils__BuildCategoryOptions(Na__Taxonomy, Na__SelectedKey) {
    const Na__Categories = (Na__Taxonomy && Na__Taxonomy.PromptLibrary__Categories) || {};

    return Object.keys(Na__Categories)
        .sort((Na__A, Na__B) => (Na__Categories[Na__A].Category__LoadOrder || 999) - (Na__Categories[Na__B].Category__LoadOrder || 999))
        .map((Na__Key) => `<option value="${Na__AiUtils__Ui__EscapeHtml(Na__Key)}" ${Na__Key === Na__SelectedKey ? "selected" : ""}>${Na__AiUtils__Ui__EscapeHtml(Na__Categories[Na__Key].Category__Title)}</option>`)
        .join("");
}
// ------------------------------------------------------------


// HELPER FUNCTION | Build option markup for the sub category select of one category
// ------------------------------------------------------------
function Na__AiUtils__BuildSubCategoryOptions(Na__Taxonomy, Na__CategoryKey, Na__SelectedKey) {
    const Na__Categories  = (Na__Taxonomy && Na__Taxonomy.PromptLibrary__Categories) || {};
    const Na__Category    = Na__Categories[Na__CategoryKey];
    if (!Na__Category) return "";

    const Na__SubCategories = Na__Category.Category__SubCategories || {};

    return Object.keys(Na__SubCategories)
        .sort((Na__A, Na__B) => (Na__SubCategories[Na__A].SubCategory__LoadOrder || 999) - (Na__SubCategories[Na__B].SubCategory__LoadOrder || 999))
        .map((Na__Key) => `<option value="${Na__AiUtils__Ui__EscapeHtml(Na__Key)}" ${Na__Key === Na__SelectedKey ? "selected" : ""}>${Na__AiUtils__Ui__EscapeHtml(Na__SubCategories[Na__Key].SubCategory__Title)}</option>`)
        .join("");
}
// ------------------------------------------------------------


// HELPER FUNCTION | Build the model target checkbox list
// ------------------------------------------------------------
function Na__AiUtils__BuildModelTargetChecks(Na__Taxonomy, Na__SelectedTargets) {
    const Na__ModelTargets = (Na__Taxonomy && Na__Taxonomy.PromptLibrary__ModelTargets) || {};
    const Na__Selected     = Na__SelectedTargets || [];

    return Object.keys(Na__ModelTargets)
        .sort((Na__A, Na__B) => (Na__ModelTargets[Na__A].ModelTarget__LoadOrder || 999) - (Na__ModelTargets[Na__B].ModelTarget__LoadOrder || 999))
        .map((Na__Key) => `
            <label class="AIPL__check-item" title="${Na__AiUtils__Ui__EscapeHtml(Na__ModelTargets[Na__Key].ModelTarget__Description || "")}">
                <input type="checkbox" data-na-model-target="${Na__AiUtils__Ui__EscapeHtml(Na__Key)}" ${Na__Selected.includes(Na__Key) ? "checked" : ""} />
                <span>${Na__AiUtils__Ui__EscapeHtml(Na__ModelTargets[Na__Key].ModelTarget__Title)}</span>
            </label>`)
        .join("");
}
// ------------------------------------------------------------


// HELPER FUNCTION | Build the status select options
// ------------------------------------------------------------
function Na__AiUtils__BuildStatusOptions(Na__Taxonomy, Na__SelectedKey) {
    const Na__StatusTypes = (Na__Taxonomy && Na__Taxonomy.PromptLibrary__StatusTypes) || {};

    return Object.keys(Na__StatusTypes)
        .map((Na__Key) => `<option value="${Na__AiUtils__Ui__EscapeHtml(Na__Key)}" ${Na__Key === Na__SelectedKey ? "selected" : ""}>${Na__AiUtils__Ui__EscapeHtml(Na__StatusTypes[Na__Key].StatusType__Title)}</option>`)
        .join("");
}
// ------------------------------------------------------------


// HELPER FUNCTION | Build the snippet insert select options
// ------------------------------------------------------------
function Na__AiUtils__BuildSnippetOptions(Na__Snippets) {
    return Object.keys(Na__Snippets || {})
        .sort((Na__A, Na__B) => (Na__Snippets[Na__A].Snippet__LoadOrder || 999) - (Na__Snippets[Na__B].Snippet__LoadOrder || 999))
        .map((Na__Key) => `<option value="${Na__AiUtils__Ui__EscapeHtml(Na__Key)}">${Na__AiUtils__Ui__EscapeHtml(Na__Snippets[Na__Key].Snippet__Title)}</option>`)
        .join("");
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Variable Row Construction
// -----------------------------------------------------------------------------

// FUNCTION | Build one editable variable row
// ------------------------------------------------------------
export function Na__AiUtils__Editor__BuildVariableRow(Na__Variable, Na__Taxonomy) {
    const Na__InputTypes = (Na__Taxonomy && Na__Taxonomy.PromptLibrary__VariableInputTypes) || {};
    const Na__Variable__ = Na__Variable || {};

    const Na__TypeOptions = Object.keys(Na__InputTypes)
        .map((Na__Key) => `<option value="${Na__AiUtils__Ui__EscapeHtml(Na__Key)}" ${Na__Key === Na__Variable__.inputType ? "selected" : ""}>${Na__AiUtils__Ui__EscapeHtml(Na__InputTypes[Na__Key].InputType__Title)}</option>`)
        .join("");

    return `
        <div class="AIPL__variable-row" data-na-variable-row>
            <div class="AIPL__variable-row-head">
                <input type="text" class="AIPL__field-input AIPL__field-input--token" data-na-field="token"
                       value="${Na__AiUtils__Ui__EscapeHtml(Na__Variable__.token || "")}" placeholder="TokenName" />
                <select class="AIPL__field-input AIPL__field-input--type" data-na-field="inputType">${Na__TypeOptions}</select>
                <label class="AIPL__check-item AIPL__check-item--inline">
                    <input type="checkbox" data-na-field="required" ${Na__Variable__.required ? "checked" : ""} /><span>Required</span>
                </label>
                <label class="AIPL__check-item AIPL__check-item--inline" title="Drop the whole line from the output when this field is left empty">
                    <input type="checkbox" data-na-field="omitLineIfEmpty" ${Na__Variable__.omitLineIfEmpty ? "checked" : ""} /><span>Drop line if empty</span>
                </label>
                <button type="button" class="AIPL__icon-button AIPL__icon-button--danger" data-na-action="remove-variable" title="Remove this field">&times;</button>
            </div>

            <div class="AIPL__variable-row-body">
                <input type="text" class="AIPL__field-input" data-na-field="label"
                       value="${Na__AiUtils__Ui__EscapeHtml(Na__Variable__.label || "")}" placeholder="Field label shown on the compose form" />
                <input type="text" class="AIPL__field-input" data-na-field="defaultValue"
                       value="${Na__AiUtils__Ui__EscapeHtml(Na__Variable__.defaultValue || "")}" placeholder="Default value - use the proven wording" />
                <input type="text" class="AIPL__field-input" data-na-field="placeholder"
                       value="${Na__AiUtils__Ui__EscapeHtml(Na__Variable__.placeholder || "")}" placeholder="Placeholder hint" />
                <input type="text" class="AIPL__field-input" data-na-field="helpText"
                       value="${Na__AiUtils__Ui__EscapeHtml(Na__Variable__.helpText || "")}" placeholder="Help text shown under the field" />
                <input type="text" class="AIPL__field-input" data-na-field="options"
                       value="${Na__AiUtils__Ui__EscapeHtml((Na__Variable__.options || []).join(", "))}" placeholder="Preset choices, comma separated (Select and On/Off only)" />
            </div>
        </div>`;
}
// ------------------------------------------------------------


// FUNCTION | Read every variable row back out of the editor
// ------------------------------------------------------------
export function Na__AiUtils__Editor__CollectVariables(Na__ModalElement) {
    const Na__Rows = Na__ModalElement.querySelectorAll("[data-na-variable-row]");

    return Array.from(Na__Rows).map((Na__Row) => {
        const Na__ReadField = (Na__FieldName) => {
            const Na__Element = Na__Row.querySelector(`[data-na-field="${Na__FieldName}"]`);
            if (!Na__Element) return "";
            return Na__Element.type === "checkbox" ? Na__Element.checked : Na__Element.value;
        };

        return {
            token           : String(Na__ReadField("token")).trim(),
            label           : String(Na__ReadField("label")).trim() || Na__AiUtils__Compose__BuildLabelFromToken(Na__ReadField("token")),
            inputType       : Na__ReadField("inputType") || "Text",
            required        : Na__ReadField("required") === true,
            defaultValue    : Na__ReadField("defaultValue"),
            placeholder     : Na__ReadField("placeholder"),
            helpText        : Na__ReadField("helpText"),
            omitLineIfEmpty : Na__ReadField("omitLineIfEmpty") === true,
            options         : String(Na__ReadField("options")).split(",").map((Na__Option) => Na__Option.trim()).filter(Boolean)
        };
    }).filter((Na__Variable) => Na__Variable.token !== "");
}
// ------------------------------------------------------------


// FUNCTION | Reconcile the variable rows against the tokens present in the body
// ------------------------------------------------------------
export function Na__AiUtils__Editor__ScanBodyForTokens(Na__ModalElement, Na__Taxonomy) {
    const Na__BodyElement    = Na__ModalElement.querySelector("#js__editorBody");
    const Na__VariableList   = Na__ModalElement.querySelector("#js__editorVariables");
    const Na__BodyTokens     = Na__AiUtils__Compose__ExtractTokens(Na__BodyElement.value);
    const Na__ExistingRows   = Na__AiUtils__Editor__CollectVariables(Na__ModalElement);
    const Na__Reconciled     = [];


    // Body order wins, keeping any settings already entered for that token
    // ------------------------------------
    Na__BodyTokens.forEach((Na__TokenName) => {
        const Na__Existing = Na__ExistingRows.find((Na__Row) => Na__Row.token === Na__TokenName);
        if (Na__Existing) {
            Na__Reconciled.push(Na__Existing);
            return;
        }

        Na__Reconciled.push({
            token           : Na__TokenName,
            label           : Na__AiUtils__Compose__BuildLabelFromToken(Na__TokenName),
            inputType       : "Text",
            required        : true,
            defaultValue    : "",
            placeholder     : "",
            helpText        : "",
            omitLineIfEmpty : false,
            options         : []
        });
    });


    // Keep declared rows whose token no longer appears so nothing is lost silently
    // ------------------------------------
    Na__ExistingRows.forEach((Na__Row) => {
        if (!Na__BodyTokens.includes(Na__Row.token)) Na__Reconciled.push(Na__Row);
    });

    Na__VariableList.innerHTML = Na__Reconciled.map((Na__Variable) => Na__AiUtils__Editor__BuildVariableRow(Na__Variable, Na__Taxonomy)).join("");

    return { declared: Na__Reconciled.length, inBody: Na__BodyTokens.length };
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Modal Lifecycle
// -----------------------------------------------------------------------------

// FUNCTION | Build and open the editor modal for a record
// ------------------------------------------------------------
export function Na__AiUtils__Editor__Open(Na__ModalElement, Na__RenderModel) {
    const { record, taxonomy, snippets, uiText, isNewRecord } = Na__RenderModel;

    Na__ModalElement.innerHTML = `
        <div class="AIPL__modal-backdrop" data-na-action="close-editor"></div>

        <div class="AIPL__modal-panel" role="dialog" aria-modal="true" aria-label="Prompt editor">
            <header class="AIPL__modal-head">
                <h2 class="AIPL__modal-title">${isNewRecord ? "New Prompt" : "Edit Prompt"}</h2>
                <button type="button" class="AIPL__icon-button" data-na-action="close-editor" title="Close">&times;</button>
            </header>

            <div class="AIPL__modal-body">

                <div class="AIPL__editor-grid">
                    <div class="AIPL__editor-field AIPL__editor-field--wide">
                        <label class="AIPL__field-label" for="js__editorTitle">Title</label>
                        <input id="js__editorTitle" type="text" class="AIPL__field-input" value="${Na__AiUtils__Ui__EscapeHtml(record.title)}" placeholder="Short descriptive prompt title" />
                    </div>

                    <div class="AIPL__editor-field AIPL__editor-field--wide">
                        <label class="AIPL__field-label" for="js__editorSummary">Summary</label>
                        <input id="js__editorSummary" type="text" class="AIPL__field-input" value="${Na__AiUtils__Ui__EscapeHtml(record.summary)}" placeholder="One line describing what it does and when to reach for it" />
                    </div>

                    <div class="AIPL__editor-field">
                        <label class="AIPL__field-label" for="js__editorCategory">Category</label>
                        <select id="js__editorCategory" class="AIPL__field-input">${Na__AiUtils__BuildCategoryOptions(taxonomy, record.category)}</select>
                    </div>

                    <div class="AIPL__editor-field">
                        <label class="AIPL__field-label" for="js__editorSubCategory">Sub category</label>
                        <select id="js__editorSubCategory" class="AIPL__field-input">${Na__AiUtils__BuildSubCategoryOptions(taxonomy, record.category, record.subCategory)}</select>
                    </div>

                    <div class="AIPL__editor-field">
                        <label class="AIPL__field-label" for="js__editorStatus">Status</label>
                        <select id="js__editorStatus" class="AIPL__field-input">${Na__AiUtils__BuildStatusOptions(taxonomy, record.status)}</select>
                    </div>

                    <div class="AIPL__editor-field">
                        <label class="AIPL__field-label" for="js__editorVersion">Version</label>
                        <input id="js__editorVersion" type="text" class="AIPL__field-input" value="${Na__AiUtils__Ui__EscapeHtml(record.version)}" placeholder="1.0.0" />
                    </div>

                    <div class="AIPL__editor-field AIPL__editor-field--wide">
                        <label class="AIPL__field-label" for="js__editorKeywords">Keywords</label>
                        <input id="js__editorKeywords" type="text" class="AIPL__field-input" value="${Na__AiUtils__Ui__EscapeHtml((record.keyWords || []).join(", "))}" placeholder="Comma separated - these drive the keyword filter chips" />
                    </div>

                    <div class="AIPL__editor-field AIPL__editor-field--wide">
                        <label class="AIPL__field-label">Model targets</label>
                        <div class="AIPL__check-grid">${Na__AiUtils__BuildModelTargetChecks(taxonomy, record.modelTargets)}</div>
                    </div>
                </div>


                <div class="AIPL__editor-section">
                    <div class="AIPL__section-head">
                        <h3 class="AIPL__section-title">Prompt Body</h3>
                        <div class="AIPL__section-actions">
                            <select id="js__snippetInsert" class="AIPL__field-input AIPL__field-input--compact">
                                <option value="">Insert snippet block...</option>
                                ${Na__AiUtils__BuildSnippetOptions(snippets)}
                            </select>
                            <button type="button" class="AIPL__button AIPL__button--small" data-na-action="scan-tokens">${Na__AiUtils__Ui__EscapeHtml(uiText.NaMiniApp__ButtonScanTokens)}</button>
                        </div>
                    </div>
                    <textarea id="js__editorBody" class="AIPL__field-input AIPL__field-input--body" rows="16"
                              placeholder="Write the prompt here. Mark job specific values with double braces, for example {{BuildingMaterials}}, then press Scan Body For Tokens.">${Na__AiUtils__Ui__EscapeHtml(record.promptText)}</textarea>
                    <p class="AIPL__field-help">Anything wrapped in double braces becomes a form field on the compose pane. The same token can appear as many times as you like and is filled from one entry.</p>
                </div>


                <div class="AIPL__editor-section">
                    <div class="AIPL__section-head">
                        <h3 class="AIPL__section-title">Job Specific Fields</h3>
                        <button type="button" class="AIPL__button AIPL__button--small" data-na-action="add-variable">Add Field</button>
                    </div>
                    <div id="js__editorVariables" class="AIPL__variable-list">
                        ${(record.variables || []).map((Na__Variable) => Na__AiUtils__Editor__BuildVariableRow(Na__Variable, taxonomy)).join("")}
                    </div>
                </div>


                <div class="AIPL__editor-section">
                    <label class="AIPL__field-label" for="js__editorNotes">Working notes</label>
                    <textarea id="js__editorNotes" class="AIPL__field-input" rows="3"
                              placeholder="What it is good at, what it fails at, which model gave the best result.">${Na__AiUtils__Ui__EscapeHtml(record.notes)}</textarea>
                </div>

            </div>

            <footer class="AIPL__modal-foot">
                <label class="AIPL__check-item">
                    <input id="js__editorFavourite" type="checkbox" ${record.favourite ? "checked" : ""} /><span>Favourite</span>
                </label>
                <div class="AIPL__modal-foot-actions">
                    <span id="js__editorError" class="AIPL__editor-error"></span>
                    <button type="button" class="AIPL__button" data-na-action="close-editor">${Na__AiUtils__Ui__EscapeHtml(uiText.NaMiniApp__ButtonCancel)}</button>
                    <button type="button" class="AIPL__button AIPL__button--primary" data-na-action="save-prompt">${Na__AiUtils__Ui__EscapeHtml(uiText.NaMiniApp__ButtonSave)}</button>
                </div>
            </footer>
        </div>`;

    Na__ModalElement.classList.add("AIPL__modal--open");

    const Na__TitleField = Na__ModalElement.querySelector("#js__editorTitle");
    if (Na__TitleField) Na__TitleField.focus();
}
// ------------------------------------------------------------


// FUNCTION | Close and clear the editor modal
// ------------------------------------------------------------
export function Na__AiUtils__Editor__Close(Na__ModalElement) {
    Na__ModalElement.classList.remove("AIPL__modal--open");
    Na__ModalElement.innerHTML = "";
}
// ------------------------------------------------------------


// FUNCTION | Rebuild the sub category options after a category change
// ------------------------------------------------------------
export function Na__AiUtils__Editor__RefreshSubCategoryOptions(Na__ModalElement, Na__Taxonomy) {
    const Na__CategorySelect    = Na__ModalElement.querySelector("#js__editorCategory");
    const Na__SubCategorySelect = Na__ModalElement.querySelector("#js__editorSubCategory");
    if (!Na__CategorySelect || !Na__SubCategorySelect) return;

    Na__SubCategorySelect.innerHTML = Na__AiUtils__BuildSubCategoryOptions(Na__Taxonomy, Na__CategorySelect.value, "");
}
// ------------------------------------------------------------


// FUNCTION | Insert a snippet block at the cursor position in the prompt body
// ------------------------------------------------------------
export function Na__AiUtils__Editor__InsertSnippetAtCursor(Na__ModalElement, Na__SnippetText) {
    const Na__BodyElement = Na__ModalElement.querySelector("#js__editorBody");
    if (!Na__BodyElement) return;

    const Na__CursorStart = Na__BodyElement.selectionStart || 0;
    const Na__CursorEnd   = Na__BodyElement.selectionEnd   || 0;
    const Na__Existing    = Na__BodyElement.value;
    const Na__NeedsBreak  = Na__CursorStart > 0 && Na__Existing.charAt(Na__CursorStart - 1) !== "\n";
    const Na__Insertion   = `${Na__NeedsBreak ? "\n\n" : ""}${Na__SnippetText}\n`;

    Na__BodyElement.value = Na__Existing.slice(0, Na__CursorStart) + Na__Insertion + Na__Existing.slice(Na__CursorEnd);
    Na__BodyElement.focus();
    Na__BodyElement.selectionStart = Na__BodyElement.selectionEnd = Na__CursorStart + Na__Insertion.length;
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Collection and Validation
// -----------------------------------------------------------------------------

// FUNCTION | Read the whole editor form back into a record object
// ------------------------------------------------------------
export function Na__AiUtils__Editor__CollectRecord(Na__ModalElement, Na__BaseRecord) {
    const Na__ReadValue = (Na__Selector) => {
        const Na__Element = Na__ModalElement.querySelector(Na__Selector);
        return Na__Element ? Na__Element.value : "";
    };

    const Na__ModelChecks = Na__ModalElement.querySelectorAll("[data-na-model-target]");
    const Na__ModelTargets = Array.from(Na__ModelChecks)
        .filter((Na__Check) => Na__Check.checked)
        .map((Na__Check) => Na__Check.getAttribute("data-na-model-target"));

    const Na__FavouriteCheck = Na__ModalElement.querySelector("#js__editorFavourite");

    return {
        ...Na__BaseRecord,
        title        : Na__ReadValue("#js__editorTitle").trim(),
        summary      : Na__ReadValue("#js__editorSummary").trim(),
        category     : Na__ReadValue("#js__editorCategory"),
        subCategory  : Na__ReadValue("#js__editorSubCategory"),
        status       : Na__ReadValue("#js__editorStatus"),
        version      : Na__ReadValue("#js__editorVersion").trim() || "1.0.0",
        keyWords     : Na__ReadValue("#js__editorKeywords").split(",").map((Na__Keyword) => Na__Keyword.trim()).filter(Boolean),
        modelTargets : Na__ModelTargets,
        promptText   : Na__ReadValue("#js__editorBody"),
        notes        : Na__ReadValue("#js__editorNotes").trim(),
        favourite    : Na__FavouriteCheck ? Na__FavouriteCheck.checked : false,
        variables    : Na__AiUtils__Editor__CollectVariables(Na__ModalElement)
    };
}
// ------------------------------------------------------------


// FUNCTION | Validate a collected record before saving
// ------------------------------------------------------------
export function Na__AiUtils__Editor__ValidateRecord(Na__Record) {
    const Na__Errors = [];

    if (!Na__Record.title)                        Na__Errors.push("A title is required.");
    if (!Na__Record.promptText.trim())            Na__Errors.push("The prompt body cannot be empty.");
    if (!Na__Record.category)                     Na__Errors.push("Pick a category.");


    // Duplicate tokens would make the compose form ambiguous
    // ------------------------------------
    const Na__TokenNames = Na__Record.variables.map((Na__Variable) => Na__Variable.token);
    const Na__Duplicates = Na__TokenNames.filter((Na__Token, Na__Index) => Na__TokenNames.indexOf(Na__Token) !== Na__Index);
    if (Na__Duplicates.length) Na__Errors.push(`Duplicate field token: ${[...new Set(Na__Duplicates)].join(", ")}`);


    // Tokens must be usable inside the double brace syntax
    // ------------------------------------
    const Na__BadTokens = Na__TokenNames.filter((Na__Token) => !/^[A-Za-z0-9_]+$/.test(Na__Token));
    if (Na__BadTokens.length) Na__Errors.push(`Field tokens may only use letters, numbers and underscores: ${Na__BadTokens.join(", ")}`);

    return Na__Errors;
}
// ------------------------------------------------------------


// FUNCTION | Show or clear the editor error line
// ------------------------------------------------------------
export function Na__AiUtils__Editor__SetErrorMessage(Na__ModalElement, Na__Message) {
    const Na__ErrorElement = Na__ModalElement.querySelector("#js__editorError");
    if (Na__ErrorElement) Na__ErrorElement.textContent = Na__Message || "";
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------
