// =============================================================================
// NOBLE ARCHITECTURE - PROJECT VISION PLANVISION CARD
// =============================================================================
//
// FILE       : ProjectVision__PlanVisionCard__.js
// NAMESPACE  : NaProjectVision.PlanVisionCard
// MODULE     : PlanVisionCard
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Decide what the hub's PlanVision card opens: the drawings
//              published from TrueVision, the legacy PlanVision app, or
//              nothing yet
// CREATED    : 19-Oct-2026
//
// DESCRIPTION:
// - PlanVision is being retired. Drawings are now made from the 3D model and
//   published from TrueVision's layout editor, and the PlanVision card is the
//   way straight into them: TrueVision opened on the first published drawing,
//   in the client's drawing viewer, without going through the 3D model. The
//   model is not even downloaded until the client goes to the 3D Model tab.
// - THREE ANSWERS, IN THIS ORDER:
//     1. drawings published from TrueVision  -> TrueVision, open=Drawings
//     2. a legacy job: PlanVision has drawings of its own (planVisionDrawings
//        in the master index, counted on disk by the build script)
//                                            -> PlanVision, as before
//     3. neither                             -> the card waits (Coming Soon).
//        A job's 3D model goes out for concept approval first; the card
//        lights up when its drawings are published.
//   A legacy job that has since had drawings published from TrueVision goes
//   to TrueVision: those are its current drawings.
// - LIVE, NOT BUILT. Whether drawings are published is read from the project's
//   published index, PublishedDocuments__Index__.json - the first file
//   TrueVision's reader opens - from the same places in the same order: the R2
//   CDN then the GitHub Pages copy on the live site, the repository first on
//   localhost (Na__PubDoc__Urls__.js). A publish lights the card the moment its
//   index lands; no build and no push are needed.
// - NEVER IN THE WAY. A project with no TrueVision content is not asked about.
//   An index that cannot be read in CHECK_TIMEOUT_MS counts as no drawings
//   published, so the hub shows within a few seconds whatever the network does.
// - An index written before the build counted PlanVision drawings carries no
//   planVisionDrawings, and the subApps.planVision flag alone decides, exactly
//   as before.
//
// -----
//
// DEVELOPMENT LOG:
// 19-Oct-2026 - Version 1.0.0
// - Initial implementation (Project Vision 0.5.4, TrueVision3D v2.183.0)
//
// =============================================================================

// #region ------------------------------------------------
// MODULE | Project Vision PlanVision Card
// --------------------------------------------------------

    (function() {
        'use strict';

        // #Region ------------------------------------------------
        // CONSTANTS | Where Published Drawings Live, and What Opens Them
        // --------------------------------------------------------

            const NaCdnBaseUrl            = 'https://cdn.noble-architecture.com';
            const NaR2Prefix              = 'NaProjectPortal';
            const NaTrueVisionContentDir  = '30__TrueVision__AppContent';
            const NaPublishedIndexPath    = '06__Layout__PublishedDocuments/PublishedDocuments__Index__.json';
            const NaPublishedDocumentsKey = 'PublishedDocuments__Documents';
            const NaPublishedState        = 'published';

            // THE KEY TRUEVISION OPENS THE DRAWINGS WITH. Its twin is
            // Na__LeShareLink__KEY_DRAWINGS in TrueVision's
            // 51__System__LayoutEditor/66__Feature__DocumentSharing/
            // Na__LayoutEditor__Share__Links__.js, which reads it back however
            // it is spelt; change neither without the other.
            const NaDrawingsOpenParam     = 'open';
            const NaDrawingsOpenKey       = 'Drawings';

            const NaCheckTimeoutMs        = 3000;                               // <-- Per address; the CDN answers in about a quarter of a second

            const NaRoute = {
                trueVision : 'truevision-drawings',
                planVision : 'planvision-legacy',
                none       : 'none'
            };

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // HELPER FUNCTIONS | Addresses and Fetching
        // --------------------------------------------------------

            // HELPER | Every address the project's published index could be at, in the order to try them
            function Na__PublishedIndexUrls(context, projectFolder, projectYear) {
                const year        = String(projectYear || '').trim().slice(-2);
                const folder      = String(projectFolder || '').trim();
                if (!/^[0-9]{2}$/.test(year) || !folder) return [];

                const contentPath = `${year}-Projects/${encodeURIComponent(folder)}/${NaTrueVisionContentDir}/${NaPublishedIndexPath}`;
                const cdnUrl      = `${NaCdnBaseUrl}/${NaR2Prefix}/${contentPath}`;
                const origin      = window.location.origin;
                const siteUrl     = (origin && origin !== 'null') ? `${origin}/na-project-portal/${contentPath}` : null;

                // ON LOCALHOST THE REPOSITORY COMES FIRST, as it does for TrueVision's
                // reader: what was just published is on this disk. The live site asks
                // R2, then the Pages copy of a folder that was committed.
                const ordered = context && context.isLocalDev ? [siteUrl, cdnUrl] : [cdnUrl, siteUrl];
                return ordered.filter(function(url) { return typeof url === 'string' && url !== ''; });
            }

            // HELPER | Fetch JSON from one address, or null, never throwing and never waiting past the timeout
            async function Na__FetchJson(url, timeoutMs) {
                const controller = (typeof AbortController === 'function') ? new AbortController() : null;
                const timer      = controller ? setTimeout(function() { controller.abort(); }, timeoutMs) : null;

                try {
                    const response = await fetch(url, {
                        cache  : 'no-cache',                                      // <-- Asks the CDN each time (a 304 when nothing changed), so a new publish shows at once
                        signal : controller ? controller.signal : undefined
                    });
                    if (!response.ok) return null;
                    return await response.json();
                } catch (err) {
                    return null;                                                  // <-- Offline, timed out, or not JSON: no answer from here
                } finally {
                    if (timer) clearTimeout(timer);
                }
            }

            // HELPER | How many drawings an index says are published
            function Na__CountPublished(index) {
                const documents = index && Array.isArray(index[NaPublishedDocumentsKey]) ? index[NaPublishedDocumentsKey] : [];
                return documents.filter(function(entry) {
                    return entry && entry.Document__State === NaPublishedState;
                }).length;
            }

            // HELPER | The TrueVision address, opened on the drawings
            function Na__DrawingsUrl(trueVisionUrl) {
                if (!trueVisionUrl) return null;
                const joiner = trueVisionUrl.indexOf('?') === -1 ? '?' : '&';
                return `${trueVisionUrl}${joiner}${NaDrawingsOpenParam}=${encodeURIComponent(NaDrawingsOpenKey)}`;
            }

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // PUBLIC API | PlanVision Card
        // --------------------------------------------------------

            const PlanVisionCard = {};

            PlanVisionCard.ROUTES = NaRoute;

            // FUNCTION | How many drawings the project has published from TrueVision (0 when none can be found)
            PlanVisionCard.countPublishedDrawings = async function(context, projectFolder, projectYear) {
                const urls = Na__PublishedIndexUrls(context, projectFolder, projectYear);

                for (const url of urls) {
                    const index = await Na__FetchJson(url, NaCheckTimeoutMs);
                    if (index) return Na__CountPublished(index);                  // <-- The first index found answers, as it does for the reader
                }

                return 0;
            };

            // FUNCTION | What the PlanVision card opens for one project
            // ---------------------------------------------------------------
            // options: { context, projectData, projectFolder, projectYear,
            //            planVisionUrl, trueVisionUrl }
            // Resolves { route, href, publishedDrawings, legacyDrawings }.
            // ---------------------------------------------------------------
            PlanVisionCard.resolve = async function(options) {
                const settings    = options || {};
                const projectData = settings.projectData || {};
                const subApps     = projectData.subApps || {};

                const legacyCount = (typeof projectData.planVisionDrawings === 'number') ? projectData.planVisionDrawings : null;
                const hasLegacy   = Boolean(subApps.planVision) && (legacyCount === null || legacyCount > 0);   // <-- An older index without the count: the flag alone, as before

                const published = (subApps.trueVision === false)
                    ? 0                                                           // <-- No TrueVision content, so nothing can have been published from it
                    : await PlanVisionCard.countPublishedDrawings(settings.context, settings.projectFolder, settings.projectYear);

                const drawingsUrl = Na__DrawingsUrl(settings.trueVisionUrl);

                if (published > 0 && drawingsUrl) {
                    return { route : NaRoute.trueVision, href : drawingsUrl, publishedDrawings : published, legacyDrawings : legacyCount };
                }

                if (hasLegacy && settings.planVisionUrl) {
                    return { route : NaRoute.planVision, href : settings.planVisionUrl, publishedDrawings : published, legacyDrawings : legacyCount };
                }

                return { route : NaRoute.none, href : null, publishedDrawings : published, legacyDrawings : legacyCount };
            };

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // EXPORTS | Module API
        // --------------------------------------------------------

            window.NaProjectVision = window.NaProjectVision || {};
            window.NaProjectVision.PlanVisionCard = PlanVisionCard;

        // endregion ----------------------------------------------

    })();

// endregion ----------------------------------------------
