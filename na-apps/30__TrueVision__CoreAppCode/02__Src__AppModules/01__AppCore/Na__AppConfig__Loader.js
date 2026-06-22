// -----------------------------------------------------------------------------
// REGION | App Config Loader - JSON Source of Truth
// -----------------------------------------------------------------------------

    // FUNCTION | Load App Config JSON
    // ------------------------------------------------------------
    async function Na__AppConfig__LoadConfig() {
        const response = await fetch('./02__Src__AppModules/02__AppData/Na__AppConfig__Main.json');
        
        if (!response.ok) {
            throw new Error(`Na__AppConfig__LoadConfig failed: ${response.status} ${response.statusText}`);
        }
        
        return response.json();
    }
    // ------------------------------------------------------------


    // FUNCTION | Load Hotkeys Config JSON
    // @delegate: ./02__Src__AppModules/02__AppData/Na__AppConfig__Hotkeys.json
    // ------------------------------------------------------------
    async function Na__AppConfig__LoadHotkeysConfig() {
        const response = await fetch('./02__Src__AppModules/02__AppData/Na__AppConfig__Hotkeys.json');

        if (!response.ok) {
            throw new Error(`Na__AppConfig__LoadHotkeysConfig failed: ${response.status} ${response.statusText}`);
        }

        return response.json();
    }
    // ------------------------------------------------------------


    // MODULE EXPORTS | App Config API
    // ------------------------------------------------------------
    export {
        Na__AppConfig__LoadConfig,
        Na__AppConfig__LoadHotkeysConfig
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
