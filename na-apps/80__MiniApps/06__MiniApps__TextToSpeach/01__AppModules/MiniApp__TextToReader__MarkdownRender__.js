// =============================================================================
// NOBLE ARCHITECTURE - TEXT TO READER - MARKDOWN RENDER
// =============================================================================
//
// FILE    : MiniApp__TextToReader__MarkdownRender__.js
// AUTHOR  : Adam Noble - Noble Architecture
// PURPOSE : Run the WhatsApp -> CSV -> Marked.js render pipeline
// CREATED : 19-Sep-2026
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Imports
// -----------------------------------------------------------------------------

// @delegate: ./MiniApp__TextToReader__WhatsAppParser__.js
import { Na__TextToReader__ParseWhatsAppMessages } from "./MiniApp__TextToReader__WhatsAppParser__.js";

// @delegate: ./MiniApp__TextToReader__CsvTable__.js
import {
    Na__TextToReader__EscapeHtml,
    Na__TextToReader__ProcessCsvBlocks,
    Na__TextToReader__ReplaceCsvPlaceholders
} from "./MiniApp__TextToReader__CsvTable__.js";

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Exports
// -----------------------------------------------------------------------------

// FUNCTION | Load the Marked.js ESM build from the configured CDN URL
// ------------------------------------------------------------
export async function Na__TextToReader__LoadMarkedLibrary(Na__MarkedEsmUrl) {
    const Na__MarkedModule = await import(Na__MarkedEsmUrl);
    return Na__MarkedModule.marked;
}
// ------------------------------------------------------------


// FUNCTION | Convert raw input into rendered HTML
// ------------------------------------------------------------
export function Na__TextToReader__RenderInputToHtml(Na__RawText, Na__MarkedParse, Na__AppConfig) {
    const Na__UiText      = Na__AppConfig.NaMiniApp__UiText;
    const Na__CleanedText = Na__TextToReader__ParseWhatsAppMessages(
        Na__RawText,
        Na__AppConfig.NaMiniApp__WhatsApp
    );
    const Na__CsvResult   = Na__TextToReader__ProcessCsvBlocks(Na__CleanedText);
    const Na__MarkdownHtml = Na__MarkedParse(Na__CsvResult.processedText);

    if (Na__CsvResult.csvBlocks.length === 0) {
        return Na__MarkdownHtml;
    }

    return Na__TextToReader__ReplaceCsvPlaceholders(
        Na__MarkdownHtml,
        Na__CsvResult.csvBlocks,
        Na__UiText
    );
}
// ------------------------------------------------------------


// FUNCTION | Build a safe error paragraph for the output pane
// ------------------------------------------------------------
export function Na__TextToReader__BuildErrorHtml(Na__Message) {
    return `<p class="TTR__error-message">${Na__TextToReader__EscapeHtml(Na__Message)}</p>`;
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------
