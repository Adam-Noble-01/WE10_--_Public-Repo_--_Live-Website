# Plan Vision Web Application

## File Details

- **File Name:** Noble-Architecture_-_Plan-Vision-App_-_1.8.6.html
- **File Type:** HTML/CSS/JS Web Application
- **Description:** A web application for viewing and interacting with architectural drawings
- **Author:** Adam Noble – Noble Architecture
- **Current Version:** v1.9.0

## Application URL

https://www.noble-architecture.com/na-project-portal/25-Projects/SB03_-_Patterdale-Close/SB03_-_PlanVision_-_Web-Application.html

---

## Overview

This HTML file serves as the main entry point for the Plan Vision web application. It integrates HTML, CSS and JavaScript to provide functionalities including:

- **Linear measurement tool** for precise distance calculations
- **Area measurement tool** for computing polygon areas
- **Rectangle measurement tool** with real-time dimensions
- **PDF download feature** allowing users to download formatted drawings
- **Markup toolset** with technical pen-style drawing tools
- **Responsive design** ensuring compatibility across various devices
- **Dynamic loading** of drawing data via remote JSON configuration file
- **Centralised asset library** for consistent fonts and images across all devices

### Technical Notes

- The application loads a PNG image and a PDF file with the same base file name
- The dual-file approach was introduced in response to earlier issues on iOS where PDF-only implementations led to memory constraints
- The PNG handling ensures compatibility across devices while the PDF file offers a formatted download

---

## Asset Loading Architecture

The application uses a **two-tier approach** for loading resources:

### 1. App Assets (Centralised Asset Library)

- Loads core UI assets from a centralised JSON repository
- Fetches from `SN40_31_--_PlanVision_-_Asset-Link-Library.json`
- Provides consistent fonts, logos, and UI elements across all instances
- Assets include:
  - **Fonts:** Open Sans (regular, light, semi-bold) and Caveat (regular, semi-bold)
  - **Logo:** Noble Architecture brand imagery
  - **UI elements:** Common interface components
- Font loading is handled via dynamic @font-face declarations injected into a style element
- Ensures visual consistency across different deployments and devices

### 2. Project Assets (Drawing Library)

- Loads project-specific drawings from a project JSON repository
- Each project has its own data file (e.g., `GA06_-_DATA_-_Document-Library.json`)
- Contains links to:
  - PNG files for on-screen display
  - PDF files for high-quality downloads
- Supports multiple drawings per project with dynamic toolbar buttons
- Drawing metadata includes document names and proper filenames for downloads

The dual-library approach separates core application assets from project-specific content, allowing the same app version to be used across multiple projects while maintaining consistent branding and UI elements.

---

## Dynamic Loading from Remote JSON Configuration

### JSON Functionality Overview (Updated for v1.8.0)

- Dynamically loads drawing data by fetching a JSON file from a remote source
- Expects a nested JSON structure under `na-project-data-library` → `project-documentation` → `project-drawings`
- Missing keys trigger error messages
- Dynamically creates toolbar buttons for each drawing entry (ignoring template placeholders)
- **NEW IN v1.8.0:** Extracts drawing scale and paper size metadata to configure accurate measurement tools
- **NEW IN v1.8.0:** Automatically applies the correct scale factors based on `document-scale` and `document-size` values
- Updates the PDF download link dynamically based on the selected drawing's metadata
- Implements asynchronous loading (using async/await) to ensure a non-blocking user interface
- Incorporates extensive error checking and logging to aid in debugging

### JSON Keys and Their Roles

#### Root Structure

- **`na-project-data-library`** - Root container for all project-related data
- **`project-documentation`** - Nested under the root; contains documentation details including drawings
- **`project-drawings`** - Nested under "project-documentation"; holds individual drawing entries

#### Drawing Entry Keys

Each drawing entry (keys starting with `drawing-`) includes:

- **`file-name`** - Specifies the drawing file's name; template entries are ignored
- **`document-name`** - Provides the display name for the drawing, used as the label on toolbar buttons
- **`document-scale`** (NEW IN v1.8.0) - Specifies the drawing scale (e.g., "1:50") for accurate measurements
  - Supports values from "1:1" through "1:2500"
- **`document-size`** (NEW IN v1.8.0) - Specifies the paper size (e.g., "A1") for dimension calculations
  - Supports standard A-series sizes (A0-A4)
- **`document-links`** - Contains URLs for drawing assets:
  - **`png--github-link-url`** - URL to load the drawing image (PNG) onto the canvas
  - **`pdf--github-link-url`** - URL for the downloadable PDF version

### Supported Values

#### Document Sizes (drives canvas scaling)

- A0
- A1
- A2
- A3
- A4

#### Document Scales (drives measurement and markup tool scaling)

- 1:1
- 1:2
- 1:5
- 1:10
- 1:20
- 1:25
- 1:30
- 1:50
- 1:100
- 1:200
- 1:500
- 1:1250
- 1:2500

---

## Visual JSON Hierarchy Tree

```
na-project-data-library  
└── project-documentation  
    └── project-drawings  
        ├── drawing-01  
        │   ├── file-name          
        │   ├── added-to-register  
        │   ├── document-type      
        │   ├── document-name      
        │   ├── document-scale     // NEW IN v1.8.0
        │   ├── document-size      // NEW IN v1.8.0
        │   ├── document-status    
        │   ├── document-notes     
        │   ├── document-revisions
        │   │   └── revision-a, revision-b, etc.
        │   └── document-links  
        │       ├── png--windows-dir-path
        │       ├── pdf--windows-dir-path
        │       ├── png--github-link-url  
        │       └── pdf--github-link-url  
        └── drawing-02 …  
```

---

## Coding Conventions: Region & Sub-Region Structure

### Main Regions

Main regions must be clearly defined using a header comment that follows this format:

**Format:**
```
{{LANGUAGE_OR_FUNCTION}} |  {{DESCRIPTIVE_TITLE}}
```

- Immediately after the title, include a version note (e.g. "Introduced in v1.8.1")
- Follow with a DESCRIPTION section that briefly explains the purpose and functionality
- A divider line made up of 80 equal signs (=) must separate each main region

### Sub-Regions

Sub-regions are used to further segment code within a main region:

**Format:**
```
{{LANGUAGE_OR_FUNCTION}} |  {{DESCRIPTIVE_TITLE}}
```

- Include a version note indicating when the sub-region was introduced
- Add a DESCRIPTION section and, if needed, an IMPORTANT NOTES section
- A divider line composed of 60 hyphens (-) must be used to mark the beginning of a sub-region
- Types:
  - **PRIMARY FUNCTION** - For the main function definition
  - **HANDLER SECTION** - For major code sections handling different tool categories
  - **EVENT HANDLER** - For specific tool event handling code

### General Guidelines

- All code must be clearly commented and organised in a logical sequence
- Version numbers should be updated dynamically to reflect the most recent changes
- Critical notes or lessons learned should be documented in the IMPORTANT NOTES section
- Consistency is key: this structure should be applied across the entire codebase

### Examples

#### Example of a Main Region Header

```
================================================================================  
JAVASCRIPT |  GLOBAL VARIABLES & CONSTANTS  
- Introduced in v1.0.0  
DESCRIPTION  
- Defines all global variables and constants used throughout the application.  
================================================================================  
```

#### Example of a Sub-Region Header

```
--------------------------------------------  
JAVASCRIPT |  ASSET LIBRARY MANAGEMENT FUNCTIONS  
- Introduced in v1.7.4  
DESCRIPTION  
- Functions responsible for fetching and loading asset data.  
IMPORTANT NOTES  
- Ensure robust error handling for network failures.  
--------------------------------------------  
```

---

## Future Improvements & Ideas

- v1.9.0 Updates Planned
  - List improvements...

---

*For version history and development log, see [Planvision__DevLog__.md](Planvision__DevLog__.md)*

