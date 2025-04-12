/*
================================================================================
JAVASCRIPT |  EVENT LISTENER MANAGER
- Created for version 2.0.1
DESCRIPTION
- Central management of all application event listeners
- Prevents duplicate event handling and event listener loops
- Standardizes event dispatching throughout the application
================================================================================
*/

// Guard against multiple script execution
if (window._eventListenerManagerLoaded) {
    console.log("EVENT_LISTENER_MANAGER: Already loaded, skipping initialization");
} else {
    window._eventListenerManagerLoaded = true;
    
    // Create namespace for this module
    window.eventListenerManager = window.eventListenerManager || {};
    
    // Track registered event listeners to prevent duplicates
    const registeredListeners = {};
    
    // Track custom event types that have been registered
    const registeredEvents = [];
    
    // Store handler references to allow removal
    const handlerReferences = {};
    
    /**
     * Register a custom event type with the system
     * @param {string} eventName - The name of the custom event
     * @param {Object} options - Event options like bubbles, composed, etc.
     */
    window.eventListenerManager.registerEvent = function(eventName, options = {}) {
        if (!registeredEvents.includes(eventName)) {
            registeredEvents.push(eventName);
            console.log(`EVENT_LISTENER_MANAGER: Registered event type '${eventName}'`);
        }
    };
    
    /**
     * Add an event listener with duplicate prevention
     * @param {string} eventName - The event to listen for
     * @param {Function} callback - The callback function
     * @param {Object|Element} target - The target element (defaults to document)
     * @param {Object} options - Event listener options
     * @returns {string} - Unique ID for this listener
     */
    window.eventListenerManager.addEventListener = function(eventName, callback, target = document, options = {}) {
        // Generate a unique ID for this listener
        const callbackString = callback.toString();
        const handlerId = `${eventName}_${target.toString()}_${callbackString.substring(0, 50)}`;
        
        // Check if this exact listener is already registered
        if (registeredListeners[handlerId]) {
            console.warn(`EVENT_LISTENER_MANAGER: Duplicate listener blocked for '${eventName}'`);
            return handlerId; // Return ID even though we didn't add the listener
        }
        
        // Store handler reference to enable removal
        if (!handlerReferences[eventName]) {
            handlerReferences[eventName] = {};
        }
        handlerReferences[eventName][handlerId] = callback;
        
        // Register the listener
        target.addEventListener(eventName, callback, options);
        registeredListeners[handlerId] = { eventName, target, options };
        
        console.log(`EVENT_LISTENER_MANAGER: Added listener for '${eventName}'`);
        return handlerId;
    };
    
    /**
     * Remove an event listener by its handler ID
     * @param {string} handlerId - The unique handler ID to remove
     */
    window.eventListenerManager.removeEventListener = function(handlerId) {
        const listenerInfo = registeredListeners[handlerId];
        if (!listenerInfo) {
            console.warn(`EVENT_LISTENER_MANAGER: No listener found with ID '${handlerId}'`);
            return;
        }
        
        const { eventName, target, options } = listenerInfo;
        const callback = handlerReferences[eventName][handlerId];
        
        if (callback) {
            target.removeEventListener(eventName, callback, options);
            delete handlerReferences[eventName][handlerId];
            delete registeredListeners[handlerId];
            console.log(`EVENT_LISTENER_MANAGER: Removed listener for '${eventName}'`);
        }
    };
    
    /**
     * Remove all listeners for a specific event type
     * @param {string} eventName - The event type to remove all listeners for
     * @param {Object|Element} target - The target element (defaults to document)
     */
    window.eventListenerManager.removeAllEventListeners = function(eventName, target = document) {
        // Find all matching listeners
        const matchingHandlerIds = Object.keys(registeredListeners).filter(id => {
            const listener = registeredListeners[id];
            return listener.eventName === eventName && listener.target === target;
        });
        
        // Remove each one
        matchingHandlerIds.forEach(id => {
            window.eventListenerManager.removeEventListener(id);
        });
        
        console.log(`EVENT_LISTENER_MANAGER: Removed all listeners for '${eventName}'`);
    };
    
    /**
     * Dispatch a custom event
     * @param {string} eventName - The event to dispatch
     * @param {Object} detail - The event detail object
     * @param {Object|Element} target - The target element (defaults to document)
     */
    window.eventListenerManager.dispatchEvent = function(eventName, detail = {}, target = document) {
        // Add event timestamp
        detail.timestamp = new Date().getTime();
        
        const event = new CustomEvent(eventName, { detail });
        target.dispatchEvent(event);
        
        console.log(`EVENT_LISTENER_MANAGER: Dispatched event '${eventName}'`, detail);
    };
    
    /**
     * Register critical application events
     */
    function registerCriticalEvents() {
        // Register standard application events
        window.eventListenerManager.registerEvent('applicationReady');
        window.eventListenerManager.registerEvent('moduleLoaded');
        window.eventListenerManager.registerEvent('assetsLoaded');
        window.eventListenerManager.registerEvent('drawingLoaded');
        window.eventListenerManager.registerEvent('imageLoaded');
        window.eventListenerManager.registerEvent('fontDataLoaded');
        window.eventListenerManager.registerEvent('projectAssetsReady');
        window.eventListenerManager.registerEvent('rendererReady');
        window.eventListenerManager.registerEvent('refreshRendering');
        window.eventListenerManager.registerEvent('fontsReady');
    }
    
    /**
     * Initialize the event listener manager
     */
    window.eventListenerManager.init = function() {
        console.log("EVENT_LISTENER_MANAGER: Initializing");
        
        // Register standard events
        registerCriticalEvents();
        
        // Register with module integration if available
        if (window.moduleIntegration && typeof window.moduleIntegration.registerModuleReady === 'function') {
            window.moduleIntegration.registerModuleReady("eventListenerManager");
        }
        
        console.log("EVENT_LISTENER_MANAGER: Initialization complete");
    };
    
    // Add compatibility layer for direct event dispatching
    // This replaces direct document.dispatchEvent calls throughout the codebase
    const originalDispatchEvent = document.dispatchEvent;
    document.dispatchEvent = function(event) {
        console.log(`EVENT_LISTENER_MANAGER: Intercepted dispatch of event '${event.type}'`);
        
        // Log all event listeners for debugging purposes
        if (event.type === 'drawingLoaded' || event.type === 'imageLoaded' || event.type === 'assetsLoaded') {
            console.log(`EVENT_LISTENER_MANAGER: Dispatching critical event '${event.type}'`);
        }
        
        // Call the original method
        return originalDispatchEvent.call(this, event);
    };
    
    // Initialize on DOMContentLoaded
    document.addEventListener('DOMContentLoaded', window.eventListenerManager.init);
    
    console.log("EVENT_LISTENER_MANAGER: Module loaded");
} 