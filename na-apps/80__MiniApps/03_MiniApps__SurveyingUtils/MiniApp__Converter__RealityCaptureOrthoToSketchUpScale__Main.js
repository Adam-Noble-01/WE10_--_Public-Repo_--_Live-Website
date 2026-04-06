// =============================================================================
// NOBLE ARCHITECTURE - REALITYCAPTURE ORTHO TO SKETCHUP SCALE - MAIN
// =============================================================================
//
// FILE    : MiniApp__Converter__RealityCaptureOrthoToSketchUpScale__Main.js
// PURPOSE : Main UI and workflow controller for ortho metadata conversion
// CREATED : 06-Apr-2026
//
// =============================================================================

// -----------------------------------------------------------------------------
// REGION | Imports
// -----------------------------------------------------------------------------

// @delegate: ./MiniApp__Converter__RealityCaptureOrthoToSketchUpScale__XmlParser.js
import { Na__SurveyingUtils__ParseRealityCaptureXml } from "./MiniApp__Converter__RealityCaptureOrthoToSketchUpScale__XmlParser.js";

// @delegate: ./MiniApp__Converter__RealityCaptureOrthoToSketchUpScale__XmlHighlighter.js
import { Na__SurveyingUtils__HighlightXml } from "./MiniApp__Converter__RealityCaptureOrthoToSketchUpScale__XmlHighlighter.js";

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Module State and DOM Cache
// -----------------------------------------------------------------------------

 let Na__SurveyingUtils__AppConfigData = null;

 const Na__SurveyingUtils__Dom = {
     Na__FileInput       : document.getElementById("js__fileInput"),
     Na__DropZone        : document.getElementById("js__dropZone"),
     Na__SelectFileBtn   : document.getElementById("js__buttonSelectFile"),
     Na__XmlDisplay      : document.getElementById("js__xmlDisplay"),
     Na__StatusBox       : document.getElementById("js__statusBox"),
     Na__ResultsCard     : document.getElementById("js__resultsCard"),
     Na__OutputWidth     : document.getElementById("js__outputWidth"),
     Na__OutputHeight    : document.getElementById("js__outputHeight"),
     Na__PanelTitleSrc   : document.getElementById("js__panelTitleSource"),
     Na__PanelTitleCtrl  : document.getElementById("js__panelTitleControls"),
     Na__DropZonePrompt  : document.getElementById("js__dropZonePrompt"),
     Na__ResultTitle     : document.getElementById("js__resultTitle"),
     Na__LabelWidth      : document.getElementById("js__labelWidth"),
     Na__LabelHeight     : document.getElementById("js__labelHeight"),
     Na__HintText        : document.getElementById("js__hintText")
 };

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

 // HELPER FUNCTION | Read App Config JSON
 // ------------------------------------------------------------
 async function Na__SurveyingUtils__LoadAppConfig() {
     const Na__ConfigResponse = await fetch("./MiniApp__Converter__RealityCaptureOrthoToSketchUpScale__AppConfig.json");
     if (!Na__ConfigResponse.ok) {
         throw new Error(`Failed to load app config (HTTP ${Na__ConfigResponse.status}).`);
     }

     const Na__ConfigData = await Na__ConfigResponse.json();
     return Na__ConfigData;
 }
 // ------------------------------------------------------------


 // HELPER FUNCTION | Update Status Message
 // ------------------------------------------------------------
 function Na__SurveyingUtils__SetStatus(Na__Message, Na__Type) {
     Na__SurveyingUtils__Dom.Na__StatusBox.textContent = Na__Message;
     Na__SurveyingUtils__Dom.Na__StatusBox.className   = "RCO2SU__status-box";

     if (Na__Type === "success") {
         Na__SurveyingUtils__Dom.Na__StatusBox.classList.add("RCO2SU__status-success");
     }

     if (Na__Type === "error") {
         Na__SurveyingUtils__Dom.Na__StatusBox.classList.add("RCO2SU__status-error");
     }
 }
 // ------------------------------------------------------------


 // HELPER FUNCTION | Apply UI Text Labels From Config
 // ------------------------------------------------------------
 function Na__SurveyingUtils__ApplyUiTextFromConfig(Na__UiTextConfig) {
     document.title                                             = Na__SurveyingUtils__AppConfigData.NaMiniApp__Meta.NaMiniApp__AppTitle;
     Na__SurveyingUtils__Dom.Na__PanelTitleSrc.textContent      = Na__UiTextConfig.NaMiniApp__PanelTitleSource;
     Na__SurveyingUtils__Dom.Na__PanelTitleCtrl.textContent     = Na__UiTextConfig.NaMiniApp__PanelTitleControls;
     Na__SurveyingUtils__Dom.Na__DropZonePrompt.textContent     = Na__UiTextConfig.NaMiniApp__DropZonePrompt;
     Na__SurveyingUtils__Dom.Na__ResultTitle.textContent        = Na__UiTextConfig.NaMiniApp__ResultTitle;
     Na__SurveyingUtils__Dom.Na__LabelWidth.textContent         = Na__UiTextConfig.NaMiniApp__ResultWidthLabel;
     Na__SurveyingUtils__Dom.Na__LabelHeight.textContent        = Na__UiTextConfig.NaMiniApp__ResultHeightLabel;
     Na__SurveyingUtils__Dom.Na__HintText.textContent           = Na__UiTextConfig.NaMiniApp__HintText;
     Na__SurveyingUtils__Dom.Na__XmlDisplay.textContent         = Na__UiTextConfig.NaMiniApp__DefaultSourcePromptText;

     Na__SurveyingUtils__SetStatus(Na__UiTextConfig.NaMiniApp__StatusWaitingForInput, "neutral");
 }
 // ------------------------------------------------------------


 // HELPER FUNCTION | Render Conversion Results To UI
 // ------------------------------------------------------------
 function Na__SurveyingUtils__RenderResults(Na__ParsedData) {
     Na__SurveyingUtils__Dom.Na__OutputWidth.innerHTML  = `${Na__ParsedData.Na__WidthMm}<span class="RCO2SU__unit-suffix">mm</span>`;
     Na__SurveyingUtils__Dom.Na__OutputHeight.innerHTML = `${Na__ParsedData.Na__HeightMm}<span class="RCO2SU__unit-suffix">mm</span>`;
     Na__SurveyingUtils__Dom.Na__ResultsCard.classList.remove("RCO2SU__hidden");
 }
 // ------------------------------------------------------------


 // HELPER FUNCTION | Extract First File From Input Or Drop
 // ------------------------------------------------------------
 function Na__SurveyingUtils__GetFirstFileFromEvent(Na__Event) {
     const Na__FileFromInput = Na__Event?.target?.files?.[0];
     const Na__FileFromDrop  = Na__Event?.dataTransfer?.files?.[0];
     return Na__FileFromInput || Na__FileFromDrop || null;
 }
 // ------------------------------------------------------------


 // HELPER FUNCTION | Read File As Text
 // ------------------------------------------------------------
 function Na__SurveyingUtils__ReadFileTextAsync(Na__FileObject) {
     return new Promise((Na__Resolve, Na__Reject) => {
         const Na__FileReader = new FileReader();
         Na__FileReader.onload = (Na__ReaderEvent) => Na__Resolve(Na__ReaderEvent.target.result);
         Na__FileReader.onerror = () => Na__Reject(new Error("Unable to read selected file."));
         Na__FileReader.readAsText(Na__FileObject);
     });
 }
 // ------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Event Handlers
// -----------------------------------------------------------------------------

 // FUNCTION | Process Selected RealityCapture File
 // ------------------------------------------------------------
 async function Na__SurveyingUtils__HandleFileSelection(Na__Event) {
     try {
         const Na__FileObject = Na__SurveyingUtils__GetFirstFileFromEvent(Na__Event);
         if (!Na__FileObject) return;

         const Na__XmlText = await Na__SurveyingUtils__ReadFileTextAsync(Na__FileObject);
         const Na__ParsedData = Na__SurveyingUtils__ParseRealityCaptureXml(
             Na__XmlText,
             Na__SurveyingUtils__AppConfigData.NaMiniApp__ParserConfig
         );

         Na__SurveyingUtils__Dom.Na__XmlDisplay.innerHTML = Na__SurveyingUtils__HighlightXml(Na__XmlText);
         Na__SurveyingUtils__RenderResults(Na__ParsedData);

         const Na__UiText = Na__SurveyingUtils__AppConfigData.NaMiniApp__UiText;
         Na__SurveyingUtils__SetStatus(
             `${Na__UiText.NaMiniApp__StatusSuccessPrefix} ${Na__UiText.NaMiniApp__StatusSuccessMessage}`,
             "success"
         );
     } catch (Na__ErrorObject) {
         const Na__UiText = Na__SurveyingUtils__AppConfigData.NaMiniApp__UiText;
         Na__SurveyingUtils__Dom.Na__ResultsCard.classList.add("RCO2SU__hidden");
         Na__SurveyingUtils__SetStatus(`${Na__UiText.NaMiniApp__StatusErrorPrefix} ${Na__ErrorObject.message}`, "error");
     }
 }
 // ------------------------------------------------------------


 // FUNCTION | Handle Drag Over Visual State
 // ------------------------------------------------------------
 function Na__SurveyingUtils__HandleDragOver(Na__Event) {
     Na__Event.preventDefault();
     Na__SurveyingUtils__Dom.Na__DropZone.classList.add("RCO2SU__drop-active");
 }
 // ------------------------------------------------------------


 // FUNCTION | Handle Drag Leave Visual State
 // ------------------------------------------------------------
 function Na__SurveyingUtils__HandleDragLeave() {
     Na__SurveyingUtils__Dom.Na__DropZone.classList.remove("RCO2SU__drop-active");
 }
 // ------------------------------------------------------------


 // FUNCTION | Handle File Drop
 // ------------------------------------------------------------
 function Na__SurveyingUtils__HandleDrop(Na__Event) {
     Na__Event.preventDefault();
     Na__SurveyingUtils__Dom.Na__DropZone.classList.remove("RCO2SU__drop-active");
     Na__SurveyingUtils__HandleFileSelection(Na__Event);
 }
 // ------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | App Initialisation
// -----------------------------------------------------------------------------

 // FUNCTION | Register UI Event Listeners
 // ------------------------------------------------------------
 function Na__SurveyingUtils__RegisterEventListeners() {
     Na__SurveyingUtils__Dom.Na__SelectFileBtn.addEventListener("click", () => {
         Na__SurveyingUtils__Dom.Na__FileInput.click();
     });

     Na__SurveyingUtils__Dom.Na__FileInput.addEventListener("change", Na__SurveyingUtils__HandleFileSelection);
     Na__SurveyingUtils__Dom.Na__DropZone.addEventListener("dragover", Na__SurveyingUtils__HandleDragOver);
     Na__SurveyingUtils__Dom.Na__DropZone.addEventListener("dragleave", Na__SurveyingUtils__HandleDragLeave);
     Na__SurveyingUtils__Dom.Na__DropZone.addEventListener("drop", Na__SurveyingUtils__HandleDrop);
 }
 // ------------------------------------------------------------


 // FUNCTION | Bootstrap Application
 // ------------------------------------------------------------
 async function Na__SurveyingUtils__BootstrapApp() {
     Na__SurveyingUtils__AppConfigData = await Na__SurveyingUtils__LoadAppConfig();
     Na__SurveyingUtils__ApplyUiTextFromConfig(Na__SurveyingUtils__AppConfigData.NaMiniApp__UiText);
     Na__SurveyingUtils__RegisterEventListeners();
 }
 // ------------------------------------------------------------


 // INITIALISE | Run On DOM Ready
 // ------------------------------------------------------------
 document.addEventListener("DOMContentLoaded", () => {
     Na__SurveyingUtils__BootstrapApp().catch((Na__ErrorObject) => {
         Na__SurveyingUtils__SetStatus(`Error: ${Na__ErrorObject.message}`, "error");
         console.error("Mini app bootstrap failed:", Na__ErrorObject);
     });
 });
 // ------------------------------------------------------------

// endregion -------------------------------------------------------------------

