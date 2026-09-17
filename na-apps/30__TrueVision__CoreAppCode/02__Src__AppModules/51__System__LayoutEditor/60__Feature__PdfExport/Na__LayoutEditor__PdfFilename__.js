// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - PDF FILE NAMES
// =============================================================================
//
// FILE       : Na__LayoutEditor__PdfFilename__.js
// NAMESPACE  : Na__LeFileName
// MODULE     : Layout Editor - PDF File Names
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Name a downloaded document after the drawing it holds, from one pattern
// CREATED    : 17-Sep-2026
//
// DESCRIPTION:
// - One place that turns a document's own fields into a file name, so a sheet
//   and the project specification come out of the app named the same way:
//       PS01_T02_D01__FloorPlans__A2__RevB__17-Sep-2026__.pdf
//       PS01_SPEC__ProjectSpecification__A4__RevB__17-Sep-2026__.pdf
// - The pattern is configured (Pdf FilenamePattern) and its tokens are
//   {drawingCode} {drawingName} {paperSize} {revision} {date}. {projectCode}
//   and {sheetName} still answer, so a pattern configured before these existed
//   keeps working rather than emitting its own braces into the file name.
//
// INTEGRATION:
// - Na__LayoutEditor__PdfExporter__ names a sheet; Na__LayoutEditor__SpecPdf__
//   names the specification. A leaf: it reads the config and nothing else, so
//   either may import it without reaching the other.
//
// -----------------------------------------------------------------------------
//
// WHY THE CALLER HANDS OVER FIELDS RATHER THAN A RECORD:
// The point of putting the number, revision and paper in a file name is that the
// name and the document cannot then disagree. That only holds if both are read
// from the same place, so every caller passes the values ITS document prints -
// a sheet its title block fields, the specification its own - and this module
// does no looking up of its own.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : n/a (TrueVision3D first, 17-Sep-2026)
// - Back-port     : offer to ValeVision3D with the exporter change.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 17-Sep-2026 - Version 1.0.0
// - Split out of Na__LayoutEditor__PdfExporter__ so the specification download
//   names its file the same way a sheet does.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config
    // ------------------------------------------------------------
    import { Na__LeCfg__GetPdfSetup } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Pieces of a Name
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Everything a File System Will Not Take, Gone
    // ------------------------------------------------------------
    // Windows, macOS and Linux disagree about what is legal in a file name, so
    // nothing outside A-Z, a-z, 0-9, underscore and hyphen survives. An empty
    // result is the caller's problem to fall back from, not a silent "_".
    // ------------------------------------------------------------
    function Na__LeFileName__Clean(value) {
        return String(value === undefined || value === null ? '' : value)
            .replace(/[^A-Za-z0-9_-]+/g, '_')
            .replace(/^_+|_+$/g, '');
    }
    // ------------------------------------------------------------


    // FUNCTION | A Document's Name, Run Together for a File Name
    // ------------------------------------------------------------
    // "D01 - Floor Plans" gives FloorPlans: the leading sheet number comes off,
    // because it is already in the drawing code and repeating it would give
    // D01__D01FloorPlans, and the words run together in PascalCase - each word
    // keeps its first character and lower-cases the rest. That last rule is what
    // makes "3D Images" read 3dImages rather than 3DImages, and a name shouted as
    // "SITE PLAN" read SitePlan.
    //
    // The number only comes off when it looks like one: a short run CONTAINING A
    // DIGIT, then a dash or a colon. "Section A-A" keeps every word.
    //
    // Accents are folded rather than dropped. The splitter breaks on anything that
    // is not a letter or a digit, so an untouched "Détails" would split at the é
    // and come back "DTails"; decomposing first and dropping the combining marks
    // turns it into "Details", which is the word.
    // ------------------------------------------------------------
    function Na__LeFileName__Words(documentName) {
        const plain    = String(documentName === undefined || documentName === null ? '' : documentName)
            .normalize('NFD').replace(/[̀-ͯ]/g, '');
        const stripped = plain.replace(/^\s*[A-Za-z]{0,3}\d{1,3}[A-Za-z]?\s*[-–—:|]\s*/, '');
        const words    = (stripped || plain).split(/[^A-Za-z0-9]+/).filter((word) => word !== '');
        return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join('');
    }
    // ------------------------------------------------------------


    // FUNCTION | A Revision Field as the File Name Says It ("B" gives RevB)
    // ------------------------------------------------------------
    // "Rev" or "Rev." already typed into the field is taken off first, so the
    // name reads RevC rather than Rev_Rev_C.
    // ------------------------------------------------------------
    function Na__LeFileName__Revision(revision) {
        const bare = Na__LeFileName__Clean(String(revision === undefined || revision === null ? '' : revision).replace(/^\s*rev\.?\s*/i, ''));
        return bare === '' ? '' : 'Rev' + bare;
    }
    // ------------------------------------------------------------


    // FUNCTION | Today, as a File Name Spells a Date
    // ------------------------------------------------------------
    function Na__LeFileName__Today(when) {
        const date = (when instanceof Date && !isNaN(when.valueOf())) ? when : new Date();
        return String(date.getDate()).padStart(2, '0') + '-' +
            [ 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec' ][date.getMonth()] + '-' +
            date.getFullYear();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Name
// -----------------------------------------------------------------------------

    // FUNCTION | Fill the Configured Pattern
    // ------------------------------------------------------------
    // parts: { code, name, paper, revision, projectCode, date }
    //   code        the document's own number, as its title block prints it
    //   name        its name; run through Words here, so pass it as it reads
    //   paper       A4, A3, A2, A1
    //   revision    the bare revision ("B"); Rev is added here
    //   date        optional Date; today when left out
    // ------------------------------------------------------------
    function Na__LeFileName__Build(parts) {
        const p    = parts || {};
        const or   = (value, fallback) => (value !== '' ? value : fallback);
        const code = Na__LeFileName__Clean(p.code);

        return Na__LeCfg__GetPdfSetup().filenamePattern
            .split('{drawingCode}').join(or(code, or(Na__LeFileName__Clean(p.projectCode), 'Drawing')))
            .split('{drawingName}').join(or(Na__LeFileName__Clean(Na__LeFileName__Words(p.name)), 'Document'))
            .split('{paperSize}').join(or(Na__LeFileName__Clean(p.paper), 'Paper'))
            .split('{revision}').join(or(Na__LeFileName__Revision(p.revision), 'Rev'))
            .split('{date}').join(Na__LeFileName__Today(p.date))
            .split('{projectCode}').join(or(Na__LeFileName__Clean(p.projectCode), 'Project'))     // <-- Answered so an older configured pattern keeps working
            .split('{sheetName}').join(or(Na__LeFileName__Clean(p.name), 'Document'));
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor PDF File Name API
    // ------------------------------------------------------------
    export {
        Na__LeFileName__Clean,
        Na__LeFileName__Words,
        Na__LeFileName__Revision,
        Na__LeFileName__Today,
        Na__LeFileName__Build
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
