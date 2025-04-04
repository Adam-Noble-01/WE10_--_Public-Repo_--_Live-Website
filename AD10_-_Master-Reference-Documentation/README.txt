---
================================================================================
 GitHub Sites With Noble Architecture Domain Hosting Complete Pages, Apps & Portals
 00_01_-_READ_-_File-Naming-Reference-Document.txt
04-Apr-2025 - Version 1.0
- This file is a reference document for the file naming conventions used in the application.
- All files must be named using this convention.
================================================================================
---

# Website Design Manifest
###### A Breakdown Of The Website Design Manifest
-------------------------------------------------------------------------------

### Website URL
http://www.noble-architecture.com/


# Architecture Studio Website

A GitHub Pages website for an architecture studio, showcasing projects and providing internal tools.

## Site Structure
- **Home Page**: Main landing page with featured projects
- **Projects**: Gallery of architectural projects
  - Individual project pages with details and interactive web apps
- **Internal Tools**: Private section with utilities for the team (not publicly accessible)
  - Cost Calculator
  - Material Database
  - CRM
  - Timeline Generator
  - Document Templates
  - Resource Scheduler

## Making Internal Tools Private

To prevent the internal tools from being publicly accessible, you can:

1. Uncomment the `SN20_-_Static-Web-Applications/` line in the `.gitignore` file before pushing to GitHub
2. Use GitHub's branch protection rules
3. Deploy the internal tools to a separate, private repository
4. Implement authentication for the internal tools section
5. Use environment variables to control visibility

## Local Development

To run this site locally:

1. Clone the repository
2. Navigate to the project directory
3. If using Node.js for development:
   ```
   npm install
   npm start
   ```
4. Or use a simple server like Python's built-in server:
   ```
   python -m http.server
   ```

## Deployment

This site is designed to be deployed using GitHub Pages:

1. Push changes to the `main` branch
2. GitHub will automatically build and deploy the site
3. Access the live site at your GitHub Pages URL

# Website Structure & Visibility  
-----------------------------------------------------------------------------------------------------------------------

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

-------------------------------------------------------------------------------

## Robots & Meta Tag Handling

- During development, **all pages will have `<meta name="robots" content="noindex, nofollow">` applied by default**.
- A JavaScript parser will check each page’s `searchEngineVisible` value from the JSON file.
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

-------------------------------------------------------------------------------

-------------------------------------------------------------------------------

## GITHUB REPO DETAILS

  #### GitHub Repo Name
  WE10_--_Public-Repo_--_Live-Website

  #### GitHub Repo URL
  https://GitHub.com/Adam-Noble-01/WE10_--_Public-Repo_--_Live-Website

  #### GitHub Pages URL
  https://adam-noble-01.GitHub.io/

  #### GitHub Local Repo Path
  D:\WE10_--_Public-Repo_--_Live-Website

-------------------------------------------------------------------------------
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


# =============================================================================





-----
### Project File Type Reference List
READ     =  Generate a Readme files
RULE     =  Text File Defining a strict rule or set of conventions



### Project JavaScript Function Code Reference List
LOAD-FN  =  Loading Function