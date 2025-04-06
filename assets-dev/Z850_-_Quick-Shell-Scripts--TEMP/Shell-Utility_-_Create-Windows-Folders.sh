$folders = @(
    "04_43_-_Main-App_-_JS-Library_-_System-Level-Functions",
    "04_47_-_JS-Library_-_DOM-Interaction-Functions",
    "04_48_-_JS-Library_-_Event-Handling-Functions",
    "04_49_-_JS-Library_-_String-Utilities",
    "04_50_-_JS-Library_-_Data-Validation-Functions",
    "04_51_-_JS-Library_-_Date-Time-Functions",
    "04_52_-_JS-Library_-_Array-Object-Utilities",
    "04_53_-_JS-Library_-_Storage-Handlers",
    "04_54_-_JS-Library_-_Animation-Functions",
    "04_55_-_JS-Library_-_Error-Handling-Functions",
    "04_56_-_JS-Library_-_Routing-Functions",
    "04_57_-_JS-Library_-_Fetch-API-Utilities",
    "04_58_-_JS-Library_-_UI-Component-Helpers",
    "04_59_-_JS-Library_-_URL-Utilities",
    "04_60_-_JS-Library_-_Logging-Utilities",
    "04_61_-_JS-Library_-_Clipboard-Functions",
    "04_62_-_JS-Library_-_Keyboard-Shortcuts",
    "04_63_-_JS-Library_-_Accessibility-Functions",
    "04_64_-_JS-Library_-_Colour-Functions",
    "04_65_-_JS-Library_-_Unit-Conversion-Functions",
    "04_66_-_JS-Library_-_Easing-Functions",
    "04_67_-_JS-Library_-_Canvas-Helpers",
    "04_68_-_JS-Library_-_Audio-Utilities",
    "04_69_-_JS-Library_-_Randomisation-Functions",
    "04_70_-_JS-Library_-_Geometry-Functions",
    "04_71_-_JS-Library_-_DOM-Mutation-Observers",
    "04_72_-_JS-Library_-_Resize-Observer-Helpers",
    "04_73_-_JS-Library_-_Performance-Metrics",
    "04_74_-_JS-Library_-_Device-Detection",
    "04_75_-_JS-Library_-_Feature-Detection",
    "04_76_-_JS-Library_-_JSON-Utilities",
    "04_77_-_JS-Library_-_State-Management-Core",
    "04_78_-_JS-Library_-_UI-Theme-Switching"
)

foreach ($folder in $folders) {
    New-Item -ItemType Directory -Name $folder | Out-Null
}
