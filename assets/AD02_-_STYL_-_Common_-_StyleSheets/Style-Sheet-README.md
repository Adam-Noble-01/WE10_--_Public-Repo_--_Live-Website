# Noble Architecture - Stylesheet Documentation

## Core Default Web Utility App Stylesheet

**Filename:** `AD02_30_-_STYL_-_Core-Default-Web-Utility-App-Stylesheet.css`  
**Purpose:** Standardize styling across simple utility web applications

### Overview

This stylesheet serves as a single point of truth for styling simple utility web applications in the Noble Architecture ecosystem. It extracts and consolidates common styling patterns from various utility apps to ensure consistency across all tools.

### Supported Applications

This stylesheet is specifically designed for simple, static, single-page utility web applications, including but not limited to:

1. Text-to-Reader App
   - Location: `/sn-apps/SN10_01_-_UTIL_-_Text-To-Reader-App/SN10_01_01_-_PAGE_-_Text-To-Reader-App.html`

2. Asset Library Query Tool
   - Location: `/sn-apps/SN10_10_-_UTIL_-_Asset-Library-Query-Tool/SN10_10_01_-_PAGE_-_Asset-Library-Query-Utility.html`

### Usage

To use this stylesheet in a utility web app:

1. Include the main Noble Architecture stylesheet:
   ```html
   <link rel="stylesheet" href="/assets/AD02_-_STYL_-_Common_-_StyleSheets/AD02_10_-_STYL_-_Core-Default-Stylesheet_-_Noble-Architecture.css">
   ```

2. Include the utility app stylesheet:
   ```html
   <link rel="stylesheet" href="/assets/AD02_-_STYL_-_Common_-_StyleSheets/AD02_30_-_STYL_-_Core-Default-Web-Utility-App-Stylesheet.css">
   ```

3. Remove any embedded styles from your HTML file that are now covered by this stylesheet.

### Important Note

This stylesheet is intended **only for simple utility web applications**. More complex applications like PlanVision and TrueVision have their own dedicated stylesheets due to their more specific styling requirements.

### Key Components Included

- Page structure and layout
- Header components
- Card blocks and containers
- Form elements
- Button styles
- Results display
- Markdown and table styling
- Responsive design adjustments 