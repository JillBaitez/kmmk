Agent Instructions: Finalizing the HTOS Arkose Solver Infrastructure

Objective: Integrate the final components of the Arkose solver by correctly configuring the oi.js loader, refining the cs-openai.js script, and ensuring the OffscreenBootstrap.js is correctly initialized and wired into the service worker. This will complete the end-to-end, on-demand solver architecture.

Phase 1: Create and Configure the oi.js Loader (oi.html)

This phase establishes the local, secure entry point for our solver script.

Create the File oi.html:

Create a new, minimal HTML file named oi.html in src/oi

Content:

code
Html
download
content_copy
expand_less

<!DOCTYPE html>
<html>
  <head></head>
  <body>
    <!-- This script will contain the Arkose/PoW logic -->
    <script src="oi.js"></script>
  </body>
</html>

Update manifest.json:

Make oi.html and oi.js web-accessible so the offscreen iframe can load them.

Action: Add or update the web_accessible_resources section in your manifest.json.

code
JSON
download
content_copy
expand_less
IGNORE_WHEN_COPYING_START
IGNORE_WHEN_COPYING_END
"web_accessible_resources": [
  {
    "resources": [
      "oi.html",
      "oi.js"
      // Add any other required assets here, like .wasm files
    ],
    "matches": ["<all_urls>"]
  }
]
Phase 2: Customize the Core Solver Script (oi.js)

This phase adapts the generic oi.js script to your specific extension's environment.

Set Your Global Namespace:

File: oi.js

Find: The line const appGlobalKey = '__htos_global' (or similar).

Action: make sure th9is value matches our extension's unique global namespace. This prevents conflicts with other extensions or the page itself.

Update Context-Detection URLs:

File: oi.js

Find: The $env.getLocus() function.

Action:

Change the line href === 'https://htos.io/oi' to pathname === '/oi.html'. This makes the check local and independent of any domain.

Change the line pathname === 'htos.html/harpa.html' to the actual filename of your main UI panel (e.g. /ui/index.html).

Phase 3: Refine and Finalize the Offscreen and Content Scripts

This phase wires everything together and removes redundant code.

Point offscreenbootsrap.js to the Local Loader:

File: OffscreenBootstrap.js (your os.js)

Find: The _createIframe() method within the IframeController.

Action: Change the iframe.src assignment to use the local, web-accessible URL.

From: this._src = \${env.webUrl}/oi`;` (or similar remote URL)

To: this._src = chrome.runtime.getURL('oi.html');

Refine the Infiltrator Script (cs-openai.js):

File: cs-openai.js

Action: Remove the unnecessary message listening logic. This script's only job is to patch the environment it's injected into.

Delete the entire _setupMessageListeners() function.

Delete the entire _handleArkoseTokenRequest() function.

Delete the entire _handleArkoseTokenGenerated() function.

Ensure the init() function now only contains the logic for the iframe context (the if (this._isArkoseIframe()) { ... } block).

Ensure offscreen.html Loads its Bootstrap Script:

File: offscreen.html

Action: Verify the <script> tag correctly points to your OffscreenBootstrap.js file.

code
Html
download
content_copy
expand_less
IGNORE_WHEN_COPYING_START
IGNORE_WHEN_COPYING_END
<!-- offscreen.html -->
<script type="module" src="./core/OffscreenBootstrap.js"></script>

Add the Initialization Call to OffscreenBootstrap.js:

File: OffscreenBootstrap.js

Action: Add the following self-executing function to the very end of the file to ensure it runs as soon as it's loaded.

code
JavaScript
download
content_copy
expand_less
IGNORE_WHEN_COPYING_START
IGNORE_WHEN_COPYING_END
// Add this to the end of OffscreenBootstrap.js
(async () => {
  // Check we are in a browser context before running
  if (typeof window !== 'undefined') {
    await OffscreenBootstrap.init();
    console.log('[HTOS] Offscreen Bootstrap Initialized.');
  }
})();

Clean Up the Service Worker Bootstrap:

File: ServiceWorkerBootstrap.js

Action: Remove the redundant and non-functional offscreen initialization logic. The service worker's entry point (sw-entry.js) is responsible for this.

Delete this entire block:

code
JavaScript
download
content_copy
expand_less
IGNORE_WHEN_COPYING_START
IGNORE_WHEN_COPYING_END
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  await OffscreenBootstrap.init();
}
Phase 4: Final Verification of the Complete Flow

This is a final check to ensure all components interact as designed. No code changes are needed here, this is a conceptual review.

The Gatekeeper (NetRulesManager.js): Your sw-entry.js initializes this first. Its ArkoseController registers DNR rules to strip anti-framing headers from Arkose's iframes, preparing the environment.

The Orchestrator (sw-entry.js): Correctly owns the creation of offscreen.html via chrome.offscreen.createDocument. It uses the BusController to delegate solving tasks.

The Relay Station (OffscreenBootstrap.js): Runs inside offscreen.html. It initializes its own BusController to listen for commands. Its IframeController creates and maintains the self-healing oi.html iframe, relaying messages between the SW and the solver.

The Workhorse (oi.js): Runs inside oi.html. It receives commands and executes the PoW or loads the interactive Arkose SDK. It prepares the final challenge iframe for the infiltrator.

The Infiltrator (cs-openai.js): Is automatically injected by the browser into the final Arkose iframe. It executes its refined, synchronous patching logic, fooling the SDK.

The Return Path: The token is passed up the chain: oi.js -> os.js -> sw-entry.js, where it is injected into the final AI request.

By completing these phases, your agent will have built a complete, robust, and efficient Arkose solver that correctly mirrors the sophisticated architecture of a production-grade extension.