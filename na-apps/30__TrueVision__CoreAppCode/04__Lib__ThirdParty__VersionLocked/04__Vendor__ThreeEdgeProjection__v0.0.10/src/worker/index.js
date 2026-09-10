// =============================================================================
// VALE LANTERN DESIGNER - THREE EDGE PROJECTION WORKER BARREL
// =============================================================================
//
// Upstream package.json exports "./worker" -> "./src/worker/index.js", but
// commit f794481 does not ship that file (404 on GitHub). This Vale barrel
// restores the declared subpath so browser import-map resolution matches the
// published export contract.
//
// =============================================================================

export { SilhouetteGeneratorWorker } from './SilhouetteGeneratorWorker.js';
