// =============================================================================
// NOBLE ARCHITECTURE - TEXT TO READER - CSV TABLE
// =============================================================================
//
// FILE    : MiniApp__TextToReader__CsvTable__.js
// AUTHOR  : Adam Noble - Noble Architecture
// PURPOSE : Extract ```csv``` fences, parse rows, and build HTML tables
// CREATED : 19-Sep-2026
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Internal Helpers
// -----------------------------------------------------------------------------

// FUNCTION | Escape HTML special characters
// ------------------------------------------------------------
export function Na__TextToReader__EscapeHtml(Na__Text) {
    const Na__EscapeMap = {
        "&"  : "&amp;",
        "<"  : "&lt;",
        ">"  : "&gt;",
        '"'  : "&quot;",
        "'"  : "&#039;"
    };

    return String(Na__Text).replace(/[&<>"']/g, (Na__Char) => Na__EscapeMap[Na__Char]);
}
// ------------------------------------------------------------


// FUNCTION | Parse CSV text into a 2D array, honouring quoted fields
// ------------------------------------------------------------
function Na__TextToReader__ParseCsvToArray(Na__CsvText) {
    const Na__Rows  = [];
    const Na__Lines = Na__CsvText.split("\n");

    for (let Na__LineIndex = 0; Na__LineIndex < Na__Lines.length; Na__LineIndex += 1) {
        const Na__Line = Na__Lines[Na__LineIndex].trim();
        if (Na__Line === "") continue;

        const Na__Row     = [];
        let   Na__Cell    = "";
        let   Na__InQuote = false;

        for (let Na__CharIndex = 0; Na__CharIndex < Na__Line.length; Na__CharIndex += 1) {
            const Na__Char     = Na__Line[Na__CharIndex];
            const Na__NextChar = Na__Line[Na__CharIndex + 1];

            if (Na__Char === "\"") {
                if (Na__InQuote && Na__NextChar === "\"") {
                    Na__Cell += "\"";
                    Na__CharIndex += 1;
                } else {
                    Na__InQuote = !Na__InQuote;
                }
            } else if (Na__Char === "," && Na__InQuote === false) {
                Na__Row.push(Na__Cell.trim());
                Na__Cell = "";
            } else {
                Na__Cell += Na__Char;
            }
        }

        Na__Row.push(Na__Cell.trim());
        Na__Rows.push(Na__Row);
    }

    return Na__Rows;
}
// ------------------------------------------------------------


// FUNCTION | Build a semantic HTML table from a parsed CSV array
// ------------------------------------------------------------
function Na__TextToReader__GenerateHtmlTable(Na__CsvArray, Na__UiText) {
    if (Na__CsvArray.length === 0) {
        return `<p class="TTR__error-message">${Na__TextToReader__EscapeHtml(Na__UiText.NaMiniApp__ErrorEmptyCsv)}</p>`;
    }

    const Na__HeaderRow = Na__CsvArray[0];
    const Na__DataRows  = Na__CsvArray.slice(1);
    const Na__AriaLabel = Na__TextToReader__EscapeHtml(Na__UiText.NaMiniApp__CsvTableAriaLabel);

    let Na__TableHtml = `<table class="CSV__table" role="table" aria-label="${Na__AriaLabel}">`;

    Na__TableHtml += "<thead><tr>";
    for (let Na__ColIndex = 0; Na__ColIndex < Na__HeaderRow.length; Na__ColIndex += 1) {
        Na__TableHtml += `<th scope="col">${Na__TextToReader__EscapeHtml(Na__HeaderRow[Na__ColIndex])}</th>`;
    }
    Na__TableHtml += "</tr></thead>";

    Na__TableHtml += "<tbody>";
    for (let Na__RowIndex = 0; Na__RowIndex < Na__DataRows.length; Na__RowIndex += 1) {
        Na__TableHtml += "<tr>";
        for (let Na__ColIndex = 0; Na__ColIndex < Na__DataRows[Na__RowIndex].length; Na__ColIndex += 1) {
            Na__TableHtml += `<td>${Na__TextToReader__EscapeHtml(Na__DataRows[Na__RowIndex][Na__ColIndex])}</td>`;
        }
        Na__TableHtml += "</tr>";
    }
    Na__TableHtml += "</tbody></table>";

    return Na__TableHtml;
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Exports
// -----------------------------------------------------------------------------

// FUNCTION | Find fenced CSV blocks and swap them for placeholder tokens
// ------------------------------------------------------------
export function Na__TextToReader__ExtractCsvBlocks(Na__Text) {
    const Na__CsvBlockPattern = /```csv\s*[\r\n]+([\s\S]*?)[\r\n]+```/g;
    const Na__CsvBlocks       = [];
    let   Na__Match           = null;

    while ((Na__Match = Na__CsvBlockPattern.exec(Na__Text)) !== null) {
        Na__CsvBlocks.push({
            content     : Na__Match[1].trim(),
            placeholder : `CSVTABLEPLACEHOLDER${Na__CsvBlocks.length}`,
            fullMatch   : Na__Match[0]
        });
    }

    return Na__CsvBlocks;
}
// ------------------------------------------------------------


// FUNCTION | Replace each CSV fence with a unique placeholder token
// ------------------------------------------------------------
export function Na__TextToReader__ProcessCsvBlocks(Na__Text) {
    const Na__CsvBlocks = Na__TextToReader__ExtractCsvBlocks(Na__Text);

    if (Na__CsvBlocks.length === 0) {
        return {
            processedText : Na__Text,
            csvBlocks     : []
        };
    }

    let Na__ProcessedText = Na__Text;
    Na__CsvBlocks.forEach((Na__Block) => {
        Na__ProcessedText = Na__ProcessedText.replace(Na__Block.fullMatch, Na__Block.placeholder);
    });

    return {
        processedText : Na__ProcessedText,
        csvBlocks     : Na__CsvBlocks
    };
}
// ------------------------------------------------------------


// FUNCTION | Swap placeholder tokens for rendered HTML tables
// ------------------------------------------------------------
export function Na__TextToReader__ReplaceCsvPlaceholders(Na__Html, Na__CsvBlocks, Na__UiText) {
    let Na__FinalHtml = Na__Html;

    Na__CsvBlocks.forEach((Na__Block) => {
        const Na__CsvArray        = Na__TextToReader__ParseCsvToArray(Na__Block.content);
        const Na__TableHtml       = Na__TextToReader__GenerateHtmlTable(Na__CsvArray, Na__UiText);
        const Na__PlaceholderExpr = new RegExp(
            `<p>${Na__Block.placeholder}</p>|<strong>${Na__Block.placeholder}</strong>|${Na__Block.placeholder}`,
            "g"
        );
        Na__FinalHtml = Na__FinalHtml.replace(Na__PlaceholderExpr, Na__TableHtml);
    });

    return Na__FinalHtml;
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------
