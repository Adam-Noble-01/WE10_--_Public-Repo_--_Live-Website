// =============================================================================
// NOBLE ARCHITECTURE - TEXT TO READER - WHATSAPP PARSER
// =============================================================================
//
// FILE    : MiniApp__TextToReader__WhatsAppParser__.js
// AUTHOR  : Adam Noble - Noble Architecture
// PURPOSE : Detect WhatsApp chat exports and convert them to a Markdown list
// CREATED : 19-Sep-2026
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Exports
// -----------------------------------------------------------------------------

// FUNCTION | Strip WhatsApp timestamp/sender prefixes and emit a bullet list
// ------------------------------------------------------------
export function Na__TextToReader__ParseWhatsAppMessages(Na__RawText, Na__WhatsAppConfig) {
    const Na__TestPattern    = new RegExp(Na__WhatsAppConfig.NaMiniApp__TestPattern);
    const Na__ReplacePattern = new RegExp(Na__WhatsAppConfig.NaMiniApp__ReplacePattern, "g");

    if (!Na__TestPattern.test(Na__RawText)) {
        return Na__RawText;
    }

    let Na__Replaced = Na__RawText.replace(Na__ReplacePattern, "\n");
    Na__Replaced     = Na__Replaced.replace(/\n{2,}/g, "\n");
    Na__Replaced     = Na__Replaced.trim();
    Na__Replaced     = Na__Replaced
        .split("\n")
        .map((Na__Line) => Na__Line.trim())
        .filter((Na__Line) => Na__Line)
        .join("\n- ");

    if (Na__Replaced) {
        Na__Replaced = "- " + Na__Replaced;
    }

    return Na__Replaced;
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------
