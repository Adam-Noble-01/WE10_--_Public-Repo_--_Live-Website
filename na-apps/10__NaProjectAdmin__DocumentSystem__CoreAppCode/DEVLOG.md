# Noble Architecture - Project Admin & Documentation System
## Development Log

---

## Version 0.1.2 - 31-Jan-2026

### Changed
- **Code Organization** - Refactored `AppCore__Main__.js` with logical regional structure
  - Broke down 751-line file into 9 logical sub-regions for better code navigation
  - Added regions: STATE, INITIALIZATION, PROJECT LOADING, SESSION MANAGEMENT, AUTHENTICATION, CONTENT DISPLAY, SIGNATURE WORKFLOW, UTILITY FUNCTIONS, API EXPORT
  - Improved code folding support and maintainability
  - All functionality preserved, purely organizational refactoring

---

## Version 0.1.1 - 31-Jan-2026

### Fixed
- **Signature Form Submission** - Implemented missing signature form handlers
  - Added `setupSignatureForm()` to handle form submission and cancellation
  - Added `handleSignatureSubmit()` to process signature, create audit record, and store
  - Fixed issue where completing signature returned to default screen instead of project content
  - URL query parameters now preserved after signature completion
  - Navigation menu badges now refresh after signature to show "Signed" status
  - Returns user to signed document view after successful submission
  
- **Logout Function** - Fixed URL parameter preservation on logout
  - Changed from `window.location.reload()` to `window.location.href = currentUrl`
  - Ensures project code and year parameters persist after logout

---

## Version 0.1.0 - 31-Jan-2026

### Added
- **Core App Shell** - Main application structure with index.html entry point
- **Module System** - ES6 module architecture with dependency management
- **Configuration Manager** - Centralised config via AppConfiguration__MainAppSettings__.json

- **Authentication System** (30__Authentication/)
  - PIN-based login with SHA-256 hashing
  - Session management via sessionStorage
  - Lockout protection (5 attempts, 300s duration)
  - Audit logging of all auth attempts

- **Document System** (20__DocumentSystem/)
  - Quotation renderer with line items and phase grouping
  - Terms & Conditions renderer (special + general)
  - General Terms HTML template (15 sections)

- **Signature System** (40__SignatureSystem/)
  - Canvas-based signature capture
  - Court-admissible audit records
  - Dual sign-off (quotation + terms)
  - Dual storage (project folder + archive)

- **Cloudflare Integration** (50__CloudflareIntegration/)
  - ApiClient module for Worker communication
  - R2 bucket integration for dynamic content

- **Cloudflare Workers** (05__CloudflareWorkers/)
  - `na-projectadmin-api` Worker deployed
  - Auth handler for PIN validation
  - Signature handler for record storage
  - R2 handler for bucket operations
  - Worker URL: https://na-projectadmin-api.adam-fb3.workers.dev/

- **Editor Tools** (04__EditorTools/)
  - Quotation Builder - offline line item editor
  - Terms Editor - WYSIWYG for special terms
  - Project Config Editor - PIN and metadata setup

- **UI Components** (10__UserInterface/)
  - Dynamic navigation menu
  - Modal manager
  - Loading overlays

- **Project Loading**
  - URL query parameter support (?project=XX00&year=26)
  - Dynamic project content from R2

### Configuration
- Main config: `03__Src__AppModules/02__AppData/AppConfiguration__MainAppSettings__.json`
- Worker URL: `https://na-projectadmin-api.adam-fb3.workers.dev/`
- R2 Bucket: `noble-architecture-cdn`
- CDN Domain: `https://cdn.noble-architecture.com/`

---

## Planned Features
- Document library viewer
- Email notifications
- PDF export
- Multi-language support

