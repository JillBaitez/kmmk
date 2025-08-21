import { BusController } from './src/HTOS/BusController.js';

// Initialize BusController in the iframe context
BusController.init().then(() => {
    // Make bus globally available
    window.bus = BusController;
    // Send startup.oiReady message once the iframe is ready
    window.bus.send('startup.oiReady');
    console.log('[oi.js] startup.oiReady sent.');
}).catch(err => {
    console.error('[oi.js] BusController initialization failed:', err);
});