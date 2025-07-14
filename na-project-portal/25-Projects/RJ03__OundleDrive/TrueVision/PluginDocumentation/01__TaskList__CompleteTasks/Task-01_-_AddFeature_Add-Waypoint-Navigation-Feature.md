# OBJECTIVE |  Add Waypoint Navigation Feature To The Application And Tidy Up The Codebase
# -------------------------------------
## ROLE    |  Highly Experienced Web Application Developer
## PROJECT |  Noble Architecture "TrueVision" 3D Web Viewer Application
## CONTEXT |  Application Uses Babylon JS Library and renders A Architectural Model Intended For Clients To View Their Designs
## PRIOR   |  You previously created other modules for this Plugin such as a framework configurator and a window and roof lantern configurator.
## TASK    |  Develop a new script containing all method required to implement a waypoint system; Move Other Nave Modes Into New Scripts

## -------------------------------------

### Task 01 - Study Codebase Structure To Understand The Architecture

This Directory Contains A Bunch Of Useful References
`Temporary-Camera-Agent-Reference-Files`

The excted input will always be named . . . . . 
`Data_-_CameraAgentData.json`

- This existsts in the main root `./Data_-_CameraAgentData.json`


### Task 02 - Study New Data_MainAppConfig File
#### New App Configuration File Overview

- Created new app configuration file to control feature toggles and navigation options
- Load JS Files within the index.html at the top in this order of priority.
  - Stylesheet - stops flashing white screen
  - Babylon JS library
  - App Config File.json - This is the new app configuration file
     - `Data_-_MainAppConfig.json`
  - Then load these JS Files
    - NavMode_WaypointNavigationSystemLogic.js
    - NavMode_WalkNavigationSystemLogic.js
    - NavMode_OrbitNavigationSystemLogic.js
    - NavMode_FlyNavigationSystemLogic.js
- All cameras and view modes are always loaded
- New Configuration json file allows me to toggle enable/disable different view modes per client:
  - Tech-savvy clients (e.g. younger users) Can have all navigation modes
  - Less tech-savvy clients (e.g. older users), I Can disable all modes except Waypoint mode
  - Curated projects I Can selectively enable specific modes Etc allowing me easy control over the navigation modes
- Navigation mode scripts need to be moved and offloaded out the the main index html and into to new files in root directory.
  - Ensure these are relinked back in as mentioned in the app config file.
  - Files prefixed with "NavMode_

## -------------------------------------

### Task 03 - Add New Feature  -  Waypoint Navigation System

  - Add a new waypoint navigation system to the application
  - Uses `CameraAgentData.json` to determine waypoints and camera positions
  - Loads this data alongside the Glb File and the `CameraAgentData.json` is used to determine the waypoints and camera positions
  - The waypoints are used to navigate the camera between waypoints
  - The camera positions are used to position the camera at the waypoints
  - The Babylon JS Cameras read the metadata from the `CameraAgentData.json` 
    - This helps with determining cameras properties such as aspect ratio, lens mm for setting the field of view
  - The waypoints are used to navigate the camera between waypoints

#### Waypoint Navigation System Functionality
  - It's important to know that the json file containing the camera information only defines the default position
  - in its default when the user of the app navigate to that Waypoint by cycling between next and previous Waypoint buttons.
  - The user should be able to rotate around the axis point so for example if the camera position was set in the middle of a room they would be able to rotate around and look around the room so set up click and drag handling for this also press and drag handling on tablets and also set up another button to turn on and off sensing a phone or a tablet accelerometer information and converting that to rotation so have it so the user can actually move their phone to navigate and look around the room in a 360 degree circle if they move their phone around or if they drag their fingered or if they click the mouse around you should have the ability to be able to look up and down as well

You can think of this as a photo sphere so each of the waypoints is viewable as a 360 degree sphere because it's effectively moving you around fixed points

The reason it's been designed this way is for clients who will struggle to navigate using traditional 3D Navigation 3D model techniques such as old people who don't understand three finger clicking and dragging etc and get stuck in Walls etc I have extensively tested different versions of the app and other tools and this kind of curated view is much better for architecture and stop to people getting lost in the model and allows me to model much lower levels of detail because they are in fixed positions so this is a design choice

The app cycle's through the waypoints in the order that they are presented in the json file


## -------------------------------------



### Notes
- The Json File is created using a SketchUp Ruby script plugin which has been extensively tested and works very well indeedthistask I am giving you to do effectively takes the JSON Data output from the SketchUp plugin and pairs it with the GLB outputof the SketchUp plugin to create a user friendly navigation experience around a client's projectwhilst also giving regular SketchUp users an easy way to keep on top ofthe camera positions because all they have to do there and is updated JSON file or I might build an actual bridgeto create a live link to the web eventuallybut I thought to give you this context because it's importantto understand why it's structured in this way

---

Once your complete update the Development log document and also create a readme file conveying the functionality of the new waypoint navigation system and alost a broader overview of the app architecture and configs files etc

## -------------------------------------------------------------------------------------------


