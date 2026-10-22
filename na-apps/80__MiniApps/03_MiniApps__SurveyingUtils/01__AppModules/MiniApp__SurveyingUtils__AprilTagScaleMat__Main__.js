// =============================================================================
// NOBLE ARCHITECTURE - APRILTAG SCALE MAT - MAIN
// =============================================================================
//
// FILE    : MiniApp__SurveyingUtils__AprilTagScaleMat__Main__.js
// AUTHOR  : Adam Noble - Noble Architecture
// PURPOSE : Config load, event wiring and application bootstrap
// CREATED : 20-Oct-2026
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Imports
// -----------------------------------------------------------------------------

// @delegate: ./MiniApp__SurveyingUtils__AprilTagScaleMat__Settings__.js
import { Na__AprilTagScaleMat__ReadSettings } from "./MiniApp__SurveyingUtils__AprilTagScaleMat__Settings__.js";

// @delegate: ./MiniApp__SurveyingUtils__AprilTagScaleMat__Preview__.js
import { Na__AprilTagScaleMat__RenderPreview } from "./MiniApp__SurveyingUtils__AprilTagScaleMat__Preview__.js";

// @delegate: ./MiniApp__SurveyingUtils__AprilTagScaleMat__PdfExport__.js
import { Na__AprilTagScaleMat__DownloadPdf } from "./MiniApp__SurveyingUtils__AprilTagScaleMat__PdfExport__.js";

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module-Level Variables
// -----------------------------------------------------------------------------

 const Na__AprilTagScaleMat__ConfigPath = "./MiniApp__SurveyingUtils__AprilTagScaleMat__AppConfig__.json";   // Resolved against the page, not the module folder

 let Na__AprilTagScaleMat__AppConfig = null;

 const Na__AprilTagScaleMat__LiveInputIds = [
     "js__orientation", "js__customW", "js__customH", "js__blackSize", "js__edgeMargin",
     "js__colsCount", "js__rowsCount", "js__startId", "js__unitMode",
     "js__showDimLines", "js__showCrosshairs", "js__showTurntable", "js__showScaleBar"
 ];

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Event Handlers
// -----------------------------------------------------------------------------

// FUNCTION | Re-read the form and repaint the preview
// ------------------------------------------------------------
function Na__AprilTagScaleMat__Refresh() {
    const Na__Settings = Na__AprilTagScaleMat__ReadSettings(Na__AprilTagScaleMat__AppConfig);
    Na__AprilTagScaleMat__RenderPreview(Na__Settings, Na__AprilTagScaleMat__AppConfig);
}
// ------------------------------------------------------------


// FUNCTION | Show custom width / height only for the Custom preset
// ------------------------------------------------------------
function Na__AprilTagScaleMat__HandlePresetChange(Na__Event) {
    document.getElementById("js__customDimRow").style.display =
        Na__Event.target.value === "CUSTOM" ? "flex" : "none";
    Na__AprilTagScaleMat__Refresh();
}
// ------------------------------------------------------------


// FUNCTION | Download the true-scale vector PDF
// ------------------------------------------------------------
function Na__AprilTagScaleMat__HandleDownloadClick() {
    const Na__Settings = Na__AprilTagScaleMat__ReadSettings(Na__AprilTagScaleMat__AppConfig);
    Na__AprilTagScaleMat__DownloadPdf(Na__Settings, Na__AprilTagScaleMat__AppConfig);
}
// ------------------------------------------------------------


// FUNCTION | Attach every listener
// ------------------------------------------------------------
function Na__AprilTagScaleMat__RegisterEventListeners() {
    document.getElementById("js__paperPreset").addEventListener("change", Na__AprilTagScaleMat__HandlePresetChange);

    Na__AprilTagScaleMat__LiveInputIds.forEach((Na__Id) => {
        const Na__Node = document.getElementById(Na__Id);
        Na__Node.addEventListener("input",  Na__AprilTagScaleMat__Refresh);
        Na__Node.addEventListener("change", Na__AprilTagScaleMat__Refresh);
    });

    document.getElementById("js__downloadPdfBtn").addEventListener("click", Na__AprilTagScaleMat__HandleDownloadClick);
    document.getElementById("js__printSheetBtn").addEventListener("click",  () => window.print());
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Bootstrap
// -----------------------------------------------------------------------------

// FUNCTION | Load config, paint titles, wire events and draw the first sheet
// ------------------------------------------------------------
async function Na__AprilTagScaleMat__BootstrapApp() {
    const Na__ConfigResponse = await fetch(Na__AprilTagScaleMat__ConfigPath, { cache: "no-cache" });
    if (!Na__ConfigResponse.ok) {
        throw new Error(`Failed to load app config (HTTP ${Na__ConfigResponse.status}).`);
    }

    Na__AprilTagScaleMat__AppConfig = await Na__ConfigResponse.json();

    const Na__Meta   = Na__AprilTagScaleMat__AppConfig.NaMiniApp__Meta;
    const Na__UiText = Na__AprilTagScaleMat__AppConfig.NaMiniApp__UiText;

    document.title = Na__UiText.NaMiniApp__PageTitle;
    document.getElementById("js__appTitle").textContent    = Na__Meta.NaMiniApp__AppTitle;
    document.getElementById("js__appSubTitle").textContent = Na__Meta.NaMiniApp__AppSubTitle;
    document.getElementById("js__appVersion").textContent  = `v${Na__Meta.NaMiniApp__Version}`;
    document.getElementById("js__statusPillText").textContent = Na__UiText.NaMiniApp__StatusPillText;

    Na__AprilTagScaleMat__RegisterEventListeners();
    Na__AprilTagScaleMat__Refresh();
}
// ------------------------------------------------------------

Na__AprilTagScaleMat__BootstrapApp().catch((Na__ErrorObject) => {
    console.error(Na__ErrorObject);
    document.body.innerHTML = `<p class="ATM__error-message">Unable to load app configuration. ${Na__ErrorObject.message}</p>`;
});

// endregion -------------------------------------------------------------------
