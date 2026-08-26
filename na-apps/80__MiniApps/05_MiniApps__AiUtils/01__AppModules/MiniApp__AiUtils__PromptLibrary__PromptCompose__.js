// =============================================================================
// NOBLE ARCHITECTURE - AI UTILS - PROMPT LIBRARY - PROMPT COMPOSE
// =============================================================================
//
// FILE    : MiniApp__AiUtils__PromptLibrary__PromptCompose__.js
// AUTHOR  : Adam Noble - Noble Architecture
// PURPOSE : Token parsing, variable reconciliation, prompt composition, clipboard
// CREATED : 26-Aug-2026
//
// DESCRIPTION:
// - Job specific values live in the prompt body as double brace tokens, written
//   as {{TokenName}}. Each token is declared once and can appear any number of
//   times in the body - typing a value once fills every occurrence.
// - Reconciliation keeps the declared variable list honest against the body so
//   a token added while editing never silently goes unasked.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Token Constants
// -----------------------------------------------------------------------------

const Na__AiUtils__TokenPattern       = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;            // Global matcher for {{TokenName}}
const Na__AiUtils__TokenPatternSingle = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/;             // Non global variant for single tests

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Token Extraction and Reconciliation
// -----------------------------------------------------------------------------

// FUNCTION | Pull every unique token out of a prompt body in first appearance order
// ------------------------------------------------------------
export function Na__AiUtils__Compose__ExtractTokens(Na__PromptText) {
    const Na__Found = [];
    const Na__Seen  = new Set();
    let   Na__Match;

    Na__AiUtils__TokenPattern.lastIndex = 0;
    while ((Na__Match = Na__AiUtils__TokenPattern.exec(String(Na__PromptText || ""))) !== null) {
        const Na__TokenName = Na__Match[1];
        if (Na__Seen.has(Na__TokenName)) continue;
        Na__Seen.add(Na__TokenName);
        Na__Found.push(Na__TokenName);
    }

    return Na__Found;
}
// ------------------------------------------------------------


// HELPER FUNCTION | Turn a PascalCase or snake_case token into a readable field label
// ------------------------------------------------------------
export function Na__AiUtils__Compose__BuildLabelFromToken(Na__TokenName) {
    const Na__Spaced = String(Na__TokenName || "")
        .replace(/_/g, " ")
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .trim()
        .toLowerCase();

    return Na__Spaced.charAt(0).toUpperCase() + Na__Spaced.slice(1);
}
// ------------------------------------------------------------


// FUNCTION | Reconcile the declared variable list against the tokens found in the body
// ------------------------------------------------------------
export function Na__AiUtils__Compose__ReconcileVariables(Na__PromptText, Na__DeclaredVariables) {
    const Na__BodyTokens = Na__AiUtils__Compose__ExtractTokens(Na__PromptText);
    const Na__Declared   = Array.isArray(Na__DeclaredVariables) ? Na__DeclaredVariables : [];
    const Na__Reconciled = [];


    // Keep declared variables in body order, auto declaring anything undeclared
    // ------------------------------------
    Na__BodyTokens.forEach((Na__TokenName) => {
        const Na__Existing = Na__Declared.find((Na__Variable) => Na__Variable.token === Na__TokenName);

        if (Na__Existing) {
            Na__Reconciled.push({ ...Na__Existing, isOrphan: false });
            return;
        }

        Na__Reconciled.push({
            token           : Na__TokenName,
            label           : Na__AiUtils__Compose__BuildLabelFromToken(Na__TokenName),
            inputType       : "Text",
            required        : false,
            defaultValue    : "",
            placeholder     : "",
            helpText        : "Auto detected from the prompt body - open the editor to describe it properly.",
            omitLineIfEmpty : false,
            options         : [],
            isOrphan        : false,
            isAutoDetected  : true
        });
    });


    // Carry through declared variables whose token no longer appears in the body
    // ------------------------------------
    Na__Declared.forEach((Na__Variable) => {
        if (Na__BodyTokens.includes(Na__Variable.token)) return;
        Na__Reconciled.push({ ...Na__Variable, isOrphan: true });
    });

    return Na__Reconciled;
}
// ------------------------------------------------------------


// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Composition
// -----------------------------------------------------------------------------

// HELPER FUNCTION | Escape a token name for safe use inside a regular expression
// ------------------------------------------------------------
function Na__AiUtils__EscapeForRegex(Na__Text) {
    return String(Na__Text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
// ------------------------------------------------------------


// HELPER FUNCTION | Resolve the value a single variable should contribute
// ------------------------------------------------------------
function Na__AiUtils__ResolveVariableValue(Na__Variable, Na__ValueMap) {
    const Na__EnteredValue = Na__ValueMap ? Na__ValueMap[Na__Variable.token] : undefined;
    if (Na__EnteredValue !== undefined && String(Na__EnteredValue).trim() !== "") return String(Na__EnteredValue);
    return String(Na__Variable.defaultValue || "");
}
// ------------------------------------------------------------


// FUNCTION | Compose the finished prompt text from a body and a set of entered values
// ------------------------------------------------------------
export function Na__AiUtils__Compose__RenderPrompt(Na__PromptText, Na__Variables, Na__ValueMap, Na__Options) {
    const Na__Settings        = Na__Options || {};
    const Na__KeepUnfilled    = Na__Settings.unfilledTokenBehaviour !== "StripToken";
    const Na__ActiveVariables = Na__Variables || [];
    const Na__MissingRequired = [];
    const Na__OmitTokens      = new Set();


    // Work out which variables resolve empty, and which of those blank a whole line
    // ------------------------------------
    const Na__ResolvedValues = {};
    Na__ActiveVariables.forEach((Na__Variable) => {
        const Na__Value = Na__AiUtils__ResolveVariableValue(Na__Variable, Na__ValueMap);
        Na__ResolvedValues[Na__Variable.token] = Na__Value;

        if (Na__Value.trim() === "") {
            if (Na__Variable.required)        Na__MissingRequired.push(Na__Variable);
            if (Na__Variable.omitLineIfEmpty) Na__OmitTokens.add(Na__Variable.token);
        }
    });


    // Drop any line owned by an empty omit-if-blank variable
    // ------------------------------------
    let Na__WorkingLines = String(Na__PromptText || "").replace(/\r\n/g, "\n").split("\n");

    if (Na__OmitTokens.size) {
        Na__WorkingLines = Na__WorkingLines.filter((Na__Line) => {
            const Na__LineTokens = Na__AiUtils__Compose__ExtractTokens(Na__Line);
            return !Na__LineTokens.some((Na__TokenName) => Na__OmitTokens.has(Na__TokenName));
        });
    }


    // Substitute every declared token throughout the body
    // ------------------------------------
    let Na__ComposedText = Na__WorkingLines.join("\n");

    Object.keys(Na__ResolvedValues).forEach((Na__TokenName) => {
        const Na__Value = Na__ResolvedValues[Na__TokenName];
        if (Na__Value.trim() === "" && Na__KeepUnfilled) return;                     // Leave the token visible so the gap is obvious

        const Na__TokenRegex = new RegExp(`\\{\\{\\s*${Na__AiUtils__EscapeForRegex(Na__TokenName)}\\s*\\}\\}`, "g");
        Na__ComposedText     = Na__ComposedText.replace(Na__TokenRegex, Na__Value);
    });


    // Report anything still unresolved so the UI can flag it
    // ------------------------------------
    const Na__UnresolvedTokens = Na__AiUtils__Compose__ExtractTokens(Na__ComposedText);

    return {
        composedText     : Na__ComposedText,
        missingRequired  : Na__MissingRequired,
        unresolvedTokens : Na__UnresolvedTokens,
        isReadyToCopy    : Na__MissingRequired.length === 0
    };
}
// ------------------------------------------------------------


// HELPER FUNCTION | Test whether a body contains any token at all
// ------------------------------------------------------------
export function Na__AiUtils__Compose__HasTokens(Na__PromptText) {
    return Na__AiUtils__TokenPatternSingle.test(String(Na__PromptText || ""));
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Clipboard
// -----------------------------------------------------------------------------

// FUNCTION | Copy text to the clipboard, falling back for non secure contexts
// ------------------------------------------------------------
export async function Na__AiUtils__Compose__CopyToClipboard(Na__Text) {
    const Na__Payload = String(Na__Text || "");

    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(Na__Payload);
            return true;
        }


        // Fallback path for plain http origins such as a local Pi server
        // ------------------------------------
        const Na__TempArea = document.createElement("textarea");
        Na__TempArea.value                = Na__Payload;
        Na__TempArea.setAttribute("readonly", "");
        Na__TempArea.style.position       = "fixed";
        Na__TempArea.style.top            = "-1000px";
        Na__TempArea.style.opacity        = "0";
        document.body.appendChild(Na__TempArea);
        Na__TempArea.select();

        const Na__DidCopy = document.execCommand("copy");
        document.body.removeChild(Na__TempArea);
        return Na__DidCopy;


    // Error handling
    // ------------------------------------
    } catch (Na__ErrorObject) {
        console.error("Clipboard copy failed.", Na__ErrorObject);
        return false;
    }
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------
