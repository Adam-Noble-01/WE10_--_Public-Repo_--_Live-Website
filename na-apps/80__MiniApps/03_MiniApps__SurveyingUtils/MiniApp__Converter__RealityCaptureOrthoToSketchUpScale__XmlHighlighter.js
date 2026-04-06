// =============================================================================
// NOBLE ARCHITECTURE - XML HIGHLIGHTER MODULE
// =============================================================================
//
// FILE    : MiniApp__Converter__RealityCaptureOrthoToSketchUpScale__XmlHighlighter.js
// PURPOSE : XML syntax highlighting helper for source preview panel
// CREATED : 06-Apr-2026
//
// =============================================================================

// -----------------------------------------------------------------------------
// REGION | XML Highlighting Helpers
// -----------------------------------------------------------------------------

 // HELPER FUNCTION | Escape HTML Reserved Characters
 // ------------------------------------------------------------
 function Na__SurveyingUtils__EscapeHtmlCharacters(Na__XmlText) {
     return Na__XmlText
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;");
 }
 // ------------------------------------------------------------


 // FUNCTION | Return Highlighted XML Markup String
 // ------------------------------------------------------------
 export function Na__SurveyingUtils__HighlightXml(Na__XmlText) {
     const Na__EscapedXmlText = Na__SurveyingUtils__EscapeHtmlCharacters(Na__XmlText);

     return Na__EscapedXmlText
         .replace(/(&lt;\/?[\w:.-]+)/g, '<span class="RCO2SU__xml-tag">$1</span>')
         .replace(/([\w:.-]+)=/g, '<span class="RCO2SU__xml-attribute">$1</span>=')
         .replace(/"([^"]*)"/g, '"<span class="RCO2SU__xml-value">$1</span>"');
 }
 // ------------------------------------------------------------

// endregion -------------------------------------------------------------------

