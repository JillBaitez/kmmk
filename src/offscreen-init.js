// Offscreen document initialization script
// Separated from offscreen.html to comply with CSP

// Import the offscreen bundle for side effects; it exposes globals like
// window.HTOSOffscreenBootstrap in dist/offscreen.js
import './offscreen.js';

// Initialize OffscreenBootstrap via the global defined by the bundle
window.HTOSOffscreenBootstrap?.init?.().catch(err => {
    console.error('[offscreen.html] OffscreenBootstrap init failed:', err);
});