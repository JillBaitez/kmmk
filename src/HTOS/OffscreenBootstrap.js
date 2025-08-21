/**
 * HTOS Offscreen Bootstrap - Multi-purpose Utility Host
 *
 * This script runs inside the offscreen.html document. Its primary role for the
 * Arkose solver is to manage the oi.html iframe. It also hosts a UtilsController
 * that can be called by the service worker for tasks requiring localStorage access.
 *
 * This file is a pure module; it is initialized by offscreen-entry.js.
 */

// =============================================================================
// DEPENDENCIES
// =============================================================================

import { BusController } from './BusController.js';

// =============================================================================
// IFRAME LIFECYCLE CONTROLLER (Essential for Arkose Solver)
// =============================================================================

const IframeController = {
  async init() {
    console.log('[OffscreenBootstrap] Initializing IframeController...');
    
    this._src = chrome.runtime.getURL('oi.html'); 
    this._iframe = null;
    this._pingInterval = null;
    
    // Create the iframe and start the stability management loop
    this._createIframe();
    this._manageIframeStability();
    
    console.log('[OffscreenBootstrap] IframeController initialized and is being monitored.');
  },

  _createIframe() {
    console.log('[OffscreenBootstrap] Creating new oi.html iframe...');
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = this._src;
    
    document.body.appendChild(iframe);
    this._iframe = iframe;
    
    // Register this iframe with the bus so it knows where to forward messages
    if (window.bus && window.bus.setIframe) {
      window.bus.setIframe(iframe);
    }
    
    return iframe;
  },

  _manageIframeStability() {
    // This is the self-healing mechanism. It periodically checks if the iframe
    // is alive and restarts it if it becomes unresponsive.
    this._pingInterval = setInterval(async () => {
      const isResponsive = await this._pingIframe();
      if (!isResponsive) {
        console.warn('[OffscreenBootstrap] Iframe is not responsive, triggering restart...');
        await this._restartIframe();
      } else {
        console.log('[OffscreenBootstrap] Iframe health check passed.');
      }
    }, 30000); // Ping every 30 seconds
  },

  async _pingIframe() {
    try {
      if (!window.bus || !window.bus.poll) {
        console.warn('[OffscreenBootstrap] Bus is not ready for polling.');
        return false;
      }
      
      // Use poll() to repeatedly send the message until a truthy response is received.
      // This is the correct, race-condition-proof method that waits for oi.js to be ready.
      const result = await Promise.race([
        window.bus.poll('startup.oiReady'),
        new Promise(resolve => setTimeout(() => resolve(false), 5000)) // 5-second timeout
      ]);

      if (!result) {
        console.warn('[OffscreenBootstrap] Iframe poll timed out or returned a falsy value.');
      }

      return !!result; // Ensure the final result is a clean boolean

    } catch (error) {
      console.error('[OffscreenBootstrap] Iframe poll failed with an unexpected error:', error);
      return false;
    }
  },

  async _restartIframe() {
    try {
      console.log('[OffscreenBootstrap] Restarting iframe...');
      if (this._iframe && this._iframe.parentNode) {
        this._iframe.parentNode.removeChild(this._iframe);
      }
      await new Promise(resolve => setTimeout(resolve, 250));
      this._createIframe();
      console.log('[OffscreenBootstrap] Iframe has been restarted.');
    } catch (error) {
      console.error('[OffscreenBootstrap] Failed to restart iframe:', error);
    }
  }
};

// =============================================================================
// GENERAL UTILITY CONTROLLER (Provides localStorage access to Service Worker)
// =============================================================================

const UtilsController = {
  async init() {
    console.log('[OffscreenBootstrap] Initializing UtilsController...');
    if (window.bus) {
      // Listen for requests from the service worker and proxy them to localStorage
      window.bus.on('utils.ls.get', this._localStorageGet.bind(this));
      window.bus.on('utils.ls.set', this._localStorageSet.bind(this));
      window.bus.on('utils.ls.has', this._localStorageHas.bind(this));
      window.bus.on('utils.ls.remove', this._localStorageRemove.bind(this));
    }
  },

  _localStorageGet(key) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (e) { 
      console.warn('[UtilsController] Failed to get/parse localStorage key:', key);
      return null; 
    }
  },

  _localStorageSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('[UtilsController] Failed to set localStorage key:', key, e);
      return false; 
    }
  },

  _localStorageHas(key) {
    try {
      return localStorage.getItem(key) !== null;
    } catch (e) {
      console.warn('[UtilsController] Failed to check localStorage key:', key);
      return false;
    }
  },

  _localStorageRemove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.error('[UtilsController] Failed to remove localStorage key:', key, e);
      return false;
    }
  }
};

// =============================================================================
// MAIN BOOTSTRAP CONTROLLER
// =============================================================================

const OffscreenBootstrap = {
  async init() {
    console.log('[OffscreenBootstrap] Starting initialization inside offscreen.html...');
    
    try {
      // 1. Initialize Bus Controller first.
      await BusController.init();
      window.bus = BusController;
      
      // 2. Initialize all necessary controllers.
      console.log('[OffscreenBootstrap] Initializing specialized controllers...');
      await Promise.all([
        IframeController.init(),
        UtilsController.init()
      ]);
      
      console.log('[OffscreenBootstrap] Initialization completed successfully.');
      
    } catch (error) {
      console.error('[OffscreenBootstrap] Initialization failed:', error);
      throw error; // Re-throw the error for the entry point's catch block
    }
  }
};

// =============================================================================
// EXPORT
// =============================================================================

// Export the main bootstrap object so offscreen-entry.js can import and run it.
export { OffscreenBootstrap };