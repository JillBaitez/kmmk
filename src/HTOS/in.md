: In src/core/OffscreenBootstrap.js
const IframeController = {
async init() {
console.log('[OffscreenBootstrap] Initializing iframe controller...');
this._src = chrome.runtime.getURL('oi.html');
this._iframe = null;
this._pingInterval = null;
// Create and configure the first iframe instance
this._createIframe();
// Start the stability management loop
await this._manageIframeStability();
console.log('[OffscreenBootstrap] Iframe controller initialized and is being monitored.');
},
_createIframe() {
console.log('[OffscreenBootstrap] Creating new oi.html iframe...');
const iframe = document.createElement('iframe');
iframe.style.display = 'none';
iframe.style.width = '1px';
iframe.style.height = '1px';
iframe.style.border = 'none';
iframe.style.position = 'fixed';
iframe.style.top = '-1000px';
iframe.style.left = '-1000px';
// Set iframe source
iframe.src = this._src;
// Append to document
document.body.appendChild(iframe);
this._iframe = iframe;
// Notify the bus controller about the new iframe instance so it knows where to send messages
if (window.bus && window.bus.setIframe) {
window.bus.setIframe(iframe);
}
return iframe;
},
async _manageIframeStability() {
// Start a periodic health check to ensure the iframe is always responsive
this._pingInterval = setInterval(async () => {
const isResponsive = await this._pingIframe();
if (!isResponsive) {
console.warn('[OffscreenBootstrap] Iframe is not responsive, triggering restart...');
await this._restartIframe();
} else {
console.log('[OffscreenBootstrap] Iframe health check passed.');
}
}, 30000); // Ping every 30 seconds
}
async _pingIframe() {
try {
if (!window.bus || !window.bus.poll) {
console.warn('[OffscreenBootstrap] Bus is not ready for polling.')
return false;
}
console.log('[OffscreenBootstrap] Polling iframe for readiness via "startup.oiReady"...');
// Use poll() to repeatedly send the message until a truthy response is received.
// This is the correct, race-condition-proof method that waits for oi.js to be ready.
const result = await Promise.race([
window.bus.poll('startup.oiReady'),
new Promise(resolve => setTimeout(() => resolve(false), 5000)) // 5-second timeout for the entire poll operation
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
// Remove the old, unresponsive iframe from the DOM
if (this._iframe && this._iframe.parentNode) {
this._iframe.parentNode.removeChild(this._iframe);
}
// Wait a brief moment to ensure cleanup is complete
await new Promise(resolve => setTimeout(resolve, 250));
// Create a brand new iframe instance
this._createIframe();
console.log('[OffscreenBootstrap] Iframe has been restarted.');
} catch (error) {
console.error('[OffscreenBootstrap] Failed to restart iframe:', error);
}
},
destroy() {
console.log('[OffscreenBootstrap] Destroying IframeController...');
// Clear the periodic ping to stop the stability loop
if (this._pingInterval) {
clearInterval(this._pingInterval);
this._pingInterval = null;
}
// Remove the iframe from the DOM
if (this._iframe && this._iframe.parentNode) {
this._iframe.parentNode.removeChild(this._iframe);
this._iframe = null;
}
}
};