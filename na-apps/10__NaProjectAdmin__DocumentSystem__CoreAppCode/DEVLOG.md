# Noble Architecture - Project Admin & Documentation System
## Development Log

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

