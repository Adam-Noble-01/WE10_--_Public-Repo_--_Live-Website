# OBJECTIVE - Build Mini App Launcher Page For Noble Architectures Small Apps

## GOALS
- Build a mini app launcher page that dynamically loads cards for the different apps.
- The mini apps are small tools that are used for all kinds of tasks and are little web apps.
- The mini apps are launched in a new browser tab or window, so the page should be lightweight and fast to load.
  - This feature is driven by the `MiniApp__Index&Launcher__AppData__Config__.json` "
        `MiniApp__LaunchInNewTab"    : "true or false",`
        `MiniApp__LaunchInNewWindow" : "true or false"`


## PLACEHOLDERS CURRENTLY MADE
@Mini Apps/MiniApp__Index&Launcher__Main__.html 
@Mini Apps/MiniApp__Index&Launcher__AppData__Config__.json


### Use this data to build the cards for the mini apps
- Used to index the data for the mini apps and build the cards for the mini apps.
- Study it, I've build the basic structure of the data file and a schema so you need to now look for apps in the `MiniApps` folder and add them to the data file.
`MiniApp__Index&Launcher__AppData__.json`
- The app should be completely Json Driven, all parameters should be stored in the json file instead of being hardcoded in the html file, so if you identify anything that is hardcoded in the html file, assess whether the parameter can be stored in the json file instead to drive the page.

### The Main Page
`MiniApp__Index&Launcher__Main__.html`
- I've made this placeholder for the main page, it is a simple page that will be used to display the cards for the mini apps.
- For now keep the Javascript and css in the html file i will delegate them later to their own separate style and script files if the file gets too large.
- Leave a critical note in the html file that the data for the mini apps is stored in the `MiniApp__Index&Launcher__AppData__Config__.json` file. and explaining that this pafe  is Json Driven as to avoid hardcoding any parameters in the html file.

### The Data File
`MiniApp__Index&Launcher__AppData__Config__.json`
- I've made this placeholder for the data file, it is a simple file that will be used to store the data for the mini apps.
- The data file is a json file that will be used to store the data for the mini apps.
- Your free to add new sections to the data file as you see fit, but keep the structure of the data file as it is currently and my naming style and spacing of the json file code etc.