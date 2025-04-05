---
====================================================================================================
NOBLE ARCHITECTURE WEBSITE - PROJECT README FILE AND DESIGN MANIFEST
AD10_01_-_READ_-_Project-ReadMe-File-And-Design-Manifest.txt
 
VERSION HISTORY
04-Apr-2025 - Version 1.0 - Initial Draft

DESCRIPTION
- This file is the core reference document for the project.
- All code should align with the standards set out in this document.
- This document explains the purpose of the project and the core design principles.
====================================================================================================
---

# Website Design Manifest
###### A Breakdown Of The Website Design Manifest
----------------------------------------------------------------------------------------------------

### Website URL
http://www.noble-architecture.com/

### Website URL Shorthand
www.noble-architecture.com

### Main Website Introduction
- The Noble Architecture Website is served by GitHub Pages and is a public-facing website.
- The main website is a static website built using HTML, CSS, and JavaScript.
- The main website is used as a portfolio page to showcase the work of the Architecture business.

### Project Portal Introduction
- The domain also contains a project portal which is a private section of the website.
- The project portal is used to store and share project information with the client.
- The project portal is a web app built using HTML, CSS, and JavaScript.
- These pages will have no robots rules applied to them

```Json
## Site Structure
- Home Page 
  - Main landing page with featured projects
- Projects
  - Gallery of architectural projects
  - Individual project pages with details and interactive web apps
- Internal Tools
  - Private section with utilities for the team (not publicly accessible)
    - Cost Calculator
  - Material Database
  - CRM
  - Timeline Generator
  - Document Templates
  - Resource Scheduler
```


# Website Structure & Visibility  
----------------------------------------------------------------------------------------------------

This site is being developed as a dual-layer system with clearly separated public and private zones, designed to serve both as a public-facing portfolio and a private client project portal.

---

## Current Structure

- **Homepage (`index.html`)** sits at the root level and serves as the landing page.
- **Child pages** are structured in subfolders and named according to a **sequential file system** (e.g. `1001.html`, `1002.html`, etc.) to align with internal project filing.
- Pages can be **manually linked** or dynamically injected into navigation via a central `pages.json` file.

---

## JSON-Driven Metadata

Each page is referenced in `pages.json` with metadata including:
- Title
- Description
- Keywords
- Path
- Search engine visibility toggle

### Example Key
```json
{
    "title": "Project Alpha",
    "path": "folio/1001.html",
    "description": "Private client portal for Project Alpha",
    "keywords": "residential, extension, planning",
    "searchEngineVisible": false
}
```

----------------------------------------------------------------------------------------------------
## Robots & Meta Tag Handling

- During development, **all pages will have `<meta name="robots" content="noindex, nofollow">` applied by default**.
- A JavaScript parser will check each page's `searchEngineVisible` value from the JSON file.
    - If **`false` or missing**, `noindex, nofollow` will remain active.
    - If **`true`**, the tag will be removed or replaced to allow indexing.
- This creates a future-proof system for selectively exposing only the finished and approved public portfolio sections.

---

## Future Considerations

- Potential integration of a basic dashboard or interface for toggling visibility without editing source files.
- Optional lightweight access barriers for client portals if required.
- Support for SPA-style portals using dynamic content loading driven by the JSON manifest.

---

Let me know if you'd like this dropped into a `README.md` or versioned into a `design-notes.md` so it stays separate from build instructions.


----------------------------------------------------------------------------------------------------
## GITHUB REPO DETAILS

  #### GitHub Repo Name
  WE10_--_Public-Repo_--_Live-Website

  #### GitHub Repo URL
  https://GitHub.com/Adam-Noble-01/WE10_--_Public-Repo_--_Live-Website

  #### GitHub Pages URL
  https://adam-noble-01.GitHub.io/

  #### GitHub Local Repo Path
  D:\WE10_--_Public-Repo_--_Live-Website

----------------------------------------------------------------------------------------------------
## DNS SETUP

  #### A Records Configuration
  - GoDaddy serve as the DNS provider
  - Configured 04-Apr-2025
  - Configuration Via GoDaddy DNS Manager

  #### SSL Certificate Configuration
  - Confirmed of Certificate - 04-Apr-2025
  - Configuration Via GitHub Sites Settings Menu

  #### Domain Name
  www.noble-architecture.com

  #### Domain Name Server
  GoDaddy DNS Manager

  #### CNAME Configuration
  - Configured 04-Apr-2025
  - Configuration Via GoDaddy DNS Manager

  #### DNS CNAME - Saved Settings GoDaddy
  **DNS CNAME**  =  www
  **DNS Field**  = adam-noble-01.GitHub.io

  #### CNAME File Location
  D:\WE10_--_Public-Repo_--_Live-Website\CNAME

  GitHub CNAME File Location
  https://github.com/Adam-Noble-01/WE10_--_Public-Repo_--_Live-Website/settings/pages

  ### Website URL
  http://www.noble-architecture.com/



----------------------------------------------------------------------------------------------------
###### END OF FILE 