// =============================================================================
// NOBLE ARCHITECTURE - AI UTILS - PROMPT LIBRARY - SEARCH ENGINE
// =============================================================================
//
// FILE    : MiniApp__AiUtils__PromptLibrary__SearchEngine__.js
// AUTHOR  : Adam Noble - Noble Architecture
// PURPOSE : Query parsing, weighted matching, filtering and result sorting
// CREATED : 26-Aug-2026
//
// DESCRIPTION:
// - Plain words are matched across every field with per field weighting.
// - Inline operators narrow the search without leaving the keyboard:
//     #keyword   restrict to prompts carrying that keyword
//     @model     restrict to prompts aimed at that model target
//     !fav       favourites only
//     !draft     drafts only
//     !archived  include archived prompts
//     "phrase"   exact phrase match
// - Every term must land somewhere for a record to survive, then the summed
//   weights decide the order.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Query Parsing
// -----------------------------------------------------------------------------

// FUNCTION | Break a raw query string into terms, phrases and inline operators
// ------------------------------------------------------------
export function Na__AiUtils__Search__ParseQuery(Na__QueryText) {
    const Na__Parsed = {
        terms          : [],
        phrases        : [],
        keywords       : [],
        models         : [],
        favouritesOnly : false,
        draftsOnly     : false,
        includeArchived: false
    };

    const Na__RawQuery = String(Na__QueryText || "").trim();
    if (!Na__RawQuery) return Na__Parsed;


    // Lift quoted phrases out first so their spaces survive tokenisation
    // ------------------------------------
    const Na__WithoutPhrases = Na__RawQuery.replace(/"([^"]+)"/g, (Na__Whole, Na__PhraseText) => {
        Na__Parsed.phrases.push(Na__PhraseText.toLowerCase().trim());
        return " ";
    });


    // Sort the remaining tokens into operators and plain search terms
    // ------------------------------------
    Na__WithoutPhrases.split(/\s+/).filter(Boolean).forEach((Na__Token) => {
        const Na__Lower = Na__Token.toLowerCase();

        if (Na__Lower.startsWith("#") && Na__Lower.length > 1) {
            Na__Parsed.keywords.push(Na__Lower.slice(1));
            return;
        }

        if (Na__Lower.startsWith("@") && Na__Lower.length > 1) {
            Na__Parsed.models.push(Na__Lower.slice(1));
            return;
        }

        if (Na__Lower === "!fav" || Na__Lower === "!favourite" || Na__Lower === "!favourites") {
            Na__Parsed.favouritesOnly = true;
            return;
        }

        if (Na__Lower === "!draft" || Na__Lower === "!drafts") {
            Na__Parsed.draftsOnly = true;
            return;
        }

        if (Na__Lower === "!archived" || Na__Lower === "!all") {
            Na__Parsed.includeArchived = true;
            return;
        }

        Na__Parsed.terms.push(Na__Lower);
    });

    return Na__Parsed;
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Field Preparation
// -----------------------------------------------------------------------------

// HELPER FUNCTION | Resolve the readable category and sub category titles for a record
// ------------------------------------------------------------
function Na__AiUtils__ResolveTaxonomyTitles(Na__Record, Na__Taxonomy) {
    const Na__Categories = (Na__Taxonomy && Na__Taxonomy.PromptLibrary__Categories) || {};
    const Na__Category   = Na__Categories[Na__Record.category];
    if (!Na__Category) return { categoryTitle: Na__Record.category, subCategoryTitle: Na__Record.subCategory };

    const Na__SubCategories = Na__Category.Category__SubCategories || {};
    const Na__SubCategory   = Na__SubCategories[Na__Record.subCategory];

    return {
        categoryTitle    : Na__Category.Category__Title || Na__Record.category,
        subCategoryTitle : Na__SubCategory ? (Na__SubCategory.SubCategory__Title || Na__Record.subCategory) : Na__Record.subCategory
    };
}
// ------------------------------------------------------------


// HELPER FUNCTION | Build the lowercase searchable field set for one record
// ------------------------------------------------------------
function Na__AiUtils__BuildSearchFields(Na__Record, Na__Taxonomy) {
    const Na__Titles = Na__AiUtils__ResolveTaxonomyTitles(Na__Record, Na__Taxonomy);

    return {
        title     : String(Na__Record.title   || "").toLowerCase(),
        keywords  : (Na__Record.keyWords     || []).join(" ").toLowerCase(),
        summary   : String(Na__Record.summary || "").toLowerCase(),
        category  : `${Na__Titles.categoryTitle} ${Na__Titles.subCategoryTitle} ${Na__Record.category} ${Na__Record.subCategory}`.toLowerCase(),
        variables : (Na__Record.variables || []).map((Na__Variable) => `${Na__Variable.label} ${Na__Variable.token}`).join(" ").toLowerCase(),
        body      : `${String(Na__Record.promptText || "")} ${String(Na__Record.notes || "")}`.toLowerCase()
    };
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Scoring
// -----------------------------------------------------------------------------

// HELPER FUNCTION | Score one search term against one prepared field set
// ------------------------------------------------------------
function Na__AiUtils__ScoreTermAgainstFields(Na__Term, Na__Fields, Na__Weights) {
    const Na__FieldWeightPairs = [
        [Na__Fields.title,     Na__Weights.NaMiniApp__WeightTitle],
        [Na__Fields.keywords,  Na__Weights.NaMiniApp__WeightKeyword],
        [Na__Fields.summary,   Na__Weights.NaMiniApp__WeightSummary],
        [Na__Fields.category,  Na__Weights.NaMiniApp__WeightCategory],
        [Na__Fields.variables, Na__Weights.NaMiniApp__WeightVariable],
        [Na__Fields.body,      Na__Weights.NaMiniApp__WeightBody]
    ];

    let Na__TermScore = 0;


    // Accumulate a weighted score with bonuses for stronger match types
    // ------------------------------------
    Na__FieldWeightPairs.forEach(([Na__FieldText, Na__FieldWeight]) => {
        if (!Na__FieldText || Na__FieldText.indexOf(Na__Term) === -1) return;

        Na__TermScore += Na__FieldWeight;

        const Na__WordBoundaryTest = new RegExp(`(^|[^a-z0-9])${Na__Term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`);
        if (Na__WordBoundaryTest.test(Na__FieldText)) Na__TermScore += Na__Weights.NaMiniApp__BonusExactWord;
        if (Na__FieldText.startsWith(Na__Term))       Na__TermScore += Na__Weights.NaMiniApp__BonusPrefixMatch;
    });

    return Na__TermScore;
}
// ------------------------------------------------------------


// HELPER FUNCTION | Score every parsed term and phrase against one record
// ------------------------------------------------------------
function Na__AiUtils__ScoreRecord(Na__Record, Na__Fields, Na__ParsedQuery, Na__Weights) {
    let Na__TotalScore = 0;


    // Every plain term must land somewhere or the record drops out
    // ------------------------------------
    for (const Na__Term of Na__ParsedQuery.terms) {
        const Na__TermScore = Na__AiUtils__ScoreTermAgainstFields(Na__Term, Na__Fields, Na__Weights);
        if (Na__TermScore === 0) return null;
        Na__TotalScore += Na__TermScore;
    }


    // Quoted phrases must appear intact
    // ------------------------------------
    for (const Na__Phrase of Na__ParsedQuery.phrases) {
        const Na__PhraseScore = Na__AiUtils__ScoreTermAgainstFields(Na__Phrase, Na__Fields, Na__Weights);
        if (Na__PhraseScore === 0) return null;
        Na__TotalScore += Na__PhraseScore * 2;
    }

    if (Na__Record.favourite) Na__TotalScore += Na__Weights.NaMiniApp__BonusFavourite;

    return Na__TotalScore;
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Filtering and Sorting
// -----------------------------------------------------------------------------

// HELPER FUNCTION | Decide whether a record survives the non textual filters
// ------------------------------------------------------------
function Na__AiUtils__PassesFilters(Na__Record, Na__Criteria, Na__ParsedQuery) {
    const Na__ShowArchived = Na__Criteria.showArchived || Na__ParsedQuery.includeArchived || Na__Criteria.scope === "Archived";

    if (Na__Record.status === "Archived" && !Na__ShowArchived)                                    return false;
    if (Na__Criteria.scope === "Favourites"  && !Na__Record.favourite)                            return false;
    if (Na__Criteria.scope === "Drafts"      && Na__Record.status !== "Draft")                    return false;
    if (Na__Criteria.scope === "Archived"    && Na__Record.status !== "Archived")                 return false;
    if (Na__Criteria.scope === "Recent"      && !Na__Record.lastUsed)                             return false;
    if (Na__ParsedQuery.favouritesOnly       && !Na__Record.favourite)                            return false;
    if (Na__ParsedQuery.draftsOnly           && Na__Record.status !== "Draft")                    return false;
    if (Na__Criteria.category                && Na__Record.category    !== Na__Criteria.category) return false;
    if (Na__Criteria.subCategory             && Na__Record.subCategory !== Na__Criteria.subCategory) return false;


    // Keyword chips selected in the rail are an AND filter
    // ------------------------------------
    const Na__RecordKeywords = (Na__Record.keyWords || []).map((Na__Keyword) => Na__Keyword.toLowerCase());
    for (const Na__Selected of (Na__Criteria.selectedKeywords || [])) {
        if (!Na__RecordKeywords.includes(String(Na__Selected).toLowerCase())) return false;
    }


    // Inline #keyword operators match on a contains basis so partials work
    // ------------------------------------
    for (const Na__QueryKeyword of Na__ParsedQuery.keywords) {
        const Na__DidMatch = Na__RecordKeywords.some((Na__Keyword) => Na__Keyword.replace(/\s+/g, "").includes(Na__QueryKeyword.replace(/\s+/g, "")));
        if (!Na__DidMatch) return false;
    }


    // Inline @model operators match against the declared model targets
    // ------------------------------------
    const Na__RecordModels = (Na__Record.modelTargets || []).map((Na__Model) => Na__Model.toLowerCase());
    for (const Na__QueryModel of Na__ParsedQuery.models) {
        const Na__DidMatch = Na__RecordModels.some((Na__Model) => Na__Model.includes(Na__QueryModel));
        if (!Na__DidMatch) return false;
    }

    return true;
}
// ------------------------------------------------------------


// FUNCTION | Order a result set according to the chosen sort mode
// ------------------------------------------------------------
export function Na__AiUtils__Search__SortResults(Na__Results, Na__SortMode, Na__HasQuery) {
    const Na__Sorted = [...Na__Results];

    const Na__CompareByTitle = (Na__A, Na__B) => Na__A.record.title.localeCompare(Na__B.record.title, "en-GB");

    switch (Na__SortMode) {
        case "Alphabetical":
            Na__Sorted.sort(Na__CompareByTitle);
            break;

        case "MostUsed":
            Na__Sorted.sort((Na__A, Na__B) => (Na__B.record.copyCount || 0) - (Na__A.record.copyCount || 0) || Na__CompareByTitle(Na__A, Na__B));
            break;

        case "RecentlyUsed":
            Na__Sorted.sort((Na__A, Na__B) => String(Na__B.record.lastUsed || "").localeCompare(String(Na__A.record.lastUsed || "")) || Na__CompareByTitle(Na__A, Na__B));
            break;

        case "Updated":
            Na__Sorted.sort((Na__A, Na__B) => new Date(Na__B.record.updated || 0) - new Date(Na__A.record.updated || 0) || Na__CompareByTitle(Na__A, Na__B));
            break;

        default:
            if (Na__HasQuery) Na__Sorted.sort((Na__A, Na__B) => Na__B.score - Na__A.score || Na__CompareByTitle(Na__A, Na__B));
            else              Na__Sorted.sort((Na__A, Na__B) => Number(Na__B.record.favourite) - Number(Na__A.record.favourite) || Na__CompareByTitle(Na__A, Na__B));
            break;
    }

    return Na__Sorted;
}
// ------------------------------------------------------------


// FUNCTION | Run the full search - parse, filter, score and sort
// ------------------------------------------------------------
export function Na__AiUtils__Search__RunSearch(Na__Records, Na__Criteria, Na__Weights, Na__Taxonomy) {
    const Na__ParsedQuery = Na__AiUtils__Search__ParseQuery(Na__Criteria.queryText);
    const Na__HasQuery    = Na__ParsedQuery.terms.length > 0 || Na__ParsedQuery.phrases.length > 0;
    const Na__Results     = [];


    // Filter first, then score only the survivors
    // ------------------------------------
    Na__Records.forEach((Na__Record) => {
        if (!Na__AiUtils__PassesFilters(Na__Record, Na__Criteria, Na__ParsedQuery)) return;

        let Na__Score = 0;
        if (Na__HasQuery) {
            const Na__Fields   = Na__AiUtils__BuildSearchFields(Na__Record, Na__Taxonomy);
            const Na__Computed = Na__AiUtils__ScoreRecord(Na__Record, Na__Fields, Na__ParsedQuery, Na__Weights);
            if (Na__Computed === null) return;
            Na__Score = Na__Computed;
        }

        Na__Results.push({ record: Na__Record, score: Na__Score });
    });

    return Na__AiUtils__Search__SortResults(Na__Results, Na__Criteria.sortMode, Na__HasQuery);
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Keyword Aggregation
// -----------------------------------------------------------------------------

// FUNCTION | Build a counted keyword list for the rail filter chips
// ------------------------------------------------------------
export function Na__AiUtils__Search__BuildKeywordCloud(Na__Records) {
    const Na__Counts = {};

    Na__Records.forEach((Na__Record) => {
        if (Na__Record.status === "Archived") return;
        (Na__Record.keyWords || []).forEach((Na__Keyword) => {
            const Na__Clean = String(Na__Keyword).trim();
            if (!Na__Clean) return;
            Na__Counts[Na__Clean] = (Na__Counts[Na__Clean] || 0) + 1;
        });
    });

    return Object.keys(Na__Counts)
        .map((Na__Keyword) => ({ keyword: Na__Keyword, count: Na__Counts[Na__Keyword] }))
        .sort((Na__A, Na__B) => Na__B.count - Na__A.count || Na__A.keyword.localeCompare(Na__B.keyword, "en-GB"));
}
// ------------------------------------------------------------


// FUNCTION | Count how many live prompts sit under each category and sub category
// ------------------------------------------------------------
export function Na__AiUtils__Search__BuildCategoryCounts(Na__Records, Na__ShowArchived) {
    const Na__Counts = {};

    Na__Records.forEach((Na__Record) => {
        if (Na__Record.status === "Archived" && !Na__ShowArchived) return;

        const Na__CategoryKey    = Na__Record.category    || "Uncategorised";
        const Na__SubCategoryKey = Na__Record.subCategory || "General";

        if (!Na__Counts[Na__CategoryKey]) Na__Counts[Na__CategoryKey] = { total: 0, subCategories: {} };
        Na__Counts[Na__CategoryKey].total += 1;
        Na__Counts[Na__CategoryKey].subCategories[Na__SubCategoryKey] = (Na__Counts[Na__CategoryKey].subCategories[Na__SubCategoryKey] || 0) + 1;
    });

    return Na__Counts;
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------
