// =============================================================================
// NOBLE ARCHITECTURE - REALITYCAPTURE XML PARSER MODULE
// =============================================================================
//
// FILE    : MiniApp__Converter__RealityCaptureOrthoToSketchUpScale__XmlParser.js
// PURPOSE : Parse .rsortho XML and convert physical dimensions to millimeters
// CREATED : 06-Apr-2026
//
// =============================================================================

// -----------------------------------------------------------------------------
// REGION | XML Parsing and Conversion
// -----------------------------------------------------------------------------

 // HELPER FUNCTION | Read Numeric Dimensions Array From Region Node
 // ------------------------------------------------------------
 function Na__SurveyingUtils__ReadDimensionsArray(Na__RegionNode, Na__DimensionsTagName) {
     const Na__DimensionsNode = Na__RegionNode.getElementsByTagName(Na__DimensionsTagName)[0];
     if (!Na__DimensionsNode || !Na__DimensionsNode.textContent) {
         throw new Error("Missing widthHeightDepth dimensions in ReconstructionRegion.");
     }

     const Na__DimensionsArray = Na__DimensionsNode.textContent
         .trim()
         .split(/\s+/)
         .map(Number)
         .filter((Na__Value) => Number.isFinite(Na__Value));

     if (Na__DimensionsArray.length < 3) {
         throw new Error("RealityCapture dimensions array is invalid or incomplete.");
     }

     return Na__DimensionsArray;
 }
 // ------------------------------------------------------------


 // HELPER FUNCTION | Convert Meters To Millimeters
 // ------------------------------------------------------------
 function Na__SurveyingUtils__MetersToMillimeters(Na__MetersValue, Na__ConversionFactor, Na__DecimalPlaces) {
     const Na__ConvertedValue = Na__MetersValue * Na__ConversionFactor;
     return Na__ConvertedValue.toFixed(Na__DecimalPlaces);
 }
 // ------------------------------------------------------------


 // FUNCTION | Parse RealityCapture XML And Return SketchUp Scale Data
 // ------------------------------------------------------------
 export function Na__SurveyingUtils__ParseRealityCaptureXml(Na__XmlText, Na__ParserConfig) {
     const Na__WrapperRootTag     = Na__ParserConfig.NaMiniApp__WrapperRootTag;
     const Na__OrthoTagName       = Na__ParserConfig.NaMiniApp__OrthoTagName;
     const Na__RegionTagName      = Na__ParserConfig.NaMiniApp__RegionTagName;
     const Na__DimensionsTagName  = Na__ParserConfig.NaMiniApp__DimensionsTagName;
     const Na__WidthIndex         = Na__ParserConfig.NaMiniApp__WidthIndex;
     const Na__HeightIndex        = Na__ParserConfig.NaMiniApp__HeightIndex;
     const Na__MetersToMmFactor   = Na__ParserConfig.NaMiniApp__MetersToMm;
     const Na__DecimalPlaces      = Na__ParserConfig.NaMiniApp__DecimalPlaces;

     const Na__WrappedXmlText     = `<${Na__WrapperRootTag}>${Na__XmlText}</${Na__WrapperRootTag}>`;
     const Na__XmlParser          = new DOMParser();
     const Na__XmlDocument        = Na__XmlParser.parseFromString(Na__WrappedXmlText, "text/xml");

     if (Na__XmlDocument.getElementsByTagName("parsererror").length > 0) {
         throw new Error("Invalid XML format in the selected file.");
     }

     const Na__OrthoNode          = Na__XmlDocument.getElementsByTagName(Na__OrthoTagName)[0];
     const Na__RegionNode         = Na__XmlDocument.getElementsByTagName(Na__RegionTagName)[0];

     if (!Na__OrthoNode || !Na__RegionNode) {
         throw new Error("Required RealityCapture tags were not found.");
     }

     const Na__PixelWidth         = Number.parseFloat(Na__OrthoNode.getAttribute("width"));
     const Na__PixelHeight        = Number.parseFloat(Na__OrthoNode.getAttribute("height"));

     if (!Number.isFinite(Na__PixelWidth) || !Number.isFinite(Na__PixelHeight)) {
         throw new Error("OrthoProjection width/height attributes are missing or invalid.");
     }

     const Na__DimensionsArray    = Na__SurveyingUtils__ReadDimensionsArray(Na__RegionNode, Na__DimensionsTagName);
     const Na__PhysicalWidthM     = Na__DimensionsArray[Na__WidthIndex];
     const Na__PhysicalHeightM    = Na__DimensionsArray[Na__HeightIndex];

     if (!Number.isFinite(Na__PhysicalWidthM) || !Number.isFinite(Na__PhysicalHeightM)) {
         throw new Error("RealityCapture physical dimensions are missing or invalid.");
     }

     const Na__WidthMm            = Na__SurveyingUtils__MetersToMillimeters(Na__PhysicalWidthM, Na__MetersToMmFactor, Na__DecimalPlaces);
     const Na__HeightMm           = Na__SurveyingUtils__MetersToMillimeters(Na__PhysicalHeightM, Na__MetersToMmFactor, Na__DecimalPlaces);

     return {
         Na__WidthMm,
         Na__HeightMm,
         Na__PixelWidth,
         Na__PixelHeight
     };
 }
 // ------------------------------------------------------------

// endregion -------------------------------------------------------------------

