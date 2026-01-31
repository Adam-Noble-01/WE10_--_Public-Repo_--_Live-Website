// ===================================================================================
// LOADING SCREEN MODULE
// ===================================================================================
// OFFLOADED | 12-Apr-2025
// Tested - Confirmed module is working as expected ✔
//
// Description:
// - This module is responsible for displaying a loading screen and error message
// - It also initializes the loading screen and error message
// - It also shows the loading screen and error message
// - It also hides the loading screen and error message
// - It also shows an error message with an optional timeout
// - It also hides the error message
// ----------------------------------------------------------------------------------


// ----------------------------------------------------------------------------------
// MODULE VARIABLES
// ----------------------------------------------------------------------------------
let loadingOverlay = null;
let errorMessage = null;


//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .



// FUNCTION |  Initialize Loading Screen
// ----------------------------------------------------------------------------------
// - This function initializes loading screen elements by getting DOM references

function initLoadingScreen() {
    loadingOverlay = document.getElementById("loading-overlay");
    errorMessage = document.getElementById("error-message");

    if (!loadingOverlay) {
        console.error("Loading overlay element not found in DOM");
    }
    if (!errorMessage) {
        console.error("Error message element not found in DOM");
    }
}

// END OF FUNCTION |  Initialize Loading Screen



// FUNCTION |  Show Loading Screen
// ----------------------------------------------------------------------------------
// - This function displays the loading screen overlay

function showLoadingScreen() {
    if (loadingOverlay) {
        loadingOverlay.style.display = "flex";
    }
}

// END OF FUNCTION |  Show Loading Screen


//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .


// FUNCTION |  Hide Loading Screen
// ----------------------------------------------------------------------------------
// - This function hides the loading screen overlay

function hideLoadingScreen() {
    if (loadingOverlay) {
        loadingOverlay.style.display = "none";
    }
}
// END OF FUNCTION |  Hide Loading Screen


//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .


// FUNCTION |  Show Error Message
// ----------------------------------------------------------------------------------
// - This function displays an error message with optional timeout

function showErrorMessage(message, timeout = 3000) {
    if (errorMessage) {
        errorMessage.textContent = message;
        errorMessage.style.display = "block";
        if (timeout > 0) {
            setTimeout(() => {
                errorMessage.style.display = "none";
            }, timeout);
        }
    }
}

// END OF FUNCTION |  Show Error Message


//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .


// FUNCTION |  Hide Error Message
// ----------------------------------------------------------------------------------
// - This function hides the error message

function hideErrorMessage() {
    if (errorMessage) {
        errorMessage.style.display = "none";
    }
}

// END OF FUNCTION |  Hide Error Message


//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .


// MODULE EXPORTS
// ----------------------------------------------------------------------------------
export {
    initLoadingScreen,
    showLoadingScreen,
    hideLoadingScreen,
    showErrorMessage,
    hideErrorMessage
};