
# Core System Upgrades Guide

This document explains the purpose of the advanced, but currently unused, core utility modules in this project. It details how they support the `Orchestrator` and provides a roadmap for integrating them into `sw-entry.js` to build a more resilient and powerful service worker.

---

## 1. Core Engine: Lifecycle and Request Management

These modules are the heart of the `Orchestrator`'s ability to manage operations robustly.

### `lifecycle-manager.js`

*   **What it is:** A manager to prevent the service worker from becoming inactive during long-running tasks. It creates a "heartbeat" using MV3-safe `chrome.alarms` to ensure the worker doesn't get terminated by the browser mid-request.
*   **Orchestrator Usage:** **Direct Dependency.** The `Orchestrator`'s constructor receives a `LifecycleManager` instance and calls its `keepalive()` and `startHeartbeat()` methods to manage the service worker's state during a `batchPrompt`.
*   **Integration Plan:** This is a high-priority integration. You should create a single instance of `LifecycleManager` in `sw-entry.js` and pass it to the `Orchestrator`'s constructor when you initialize it.

### `request-lifecycle-manager.js`

*   **What it is:** A controller for managing individual requests. Its primary job is to create and manage `AbortController` instances, which allow you to cancel a request that is taking too long. It also provides request throttling.
*   **Orchestrator Usage:** **Direct Dependency.** The `Orchestrator` receives an instance of this manager in its constructor. It then uses it to create an `AbortController` for each provider call, which is essential for implementing per-provider timeouts.
*   **Integration Plan:** Like the `LifecycleManager`, you should create a single instance of `HTOSRequestLifecycleManager` in `sw-entry.js` and pass it to the `Orchestrator`'s constructor.

---

## 2. Resilience & Error Handling

These utilities make your extension robust against network failures and provide better debugging information.

### `retry-utils.js`

*   **What it is:** A powerful utility that can automatically retry a failed operation using an "exponential backoff" strategy (waiting progressively longer between each retry). 
*   **Orchestrator Usage:** **Indirect Dependency.** The `Orchestrator` itself doesn't retry a failed prompt. Instead, this utility is meant to be used when you first **initialize** the provider controllers. This ensures the application can start up even if a provider's authentication server is temporarily down.
*   **Integration Plan:** In `sw-entry.js`, when you initialize each provider controller, wrap the initialization call in `RetryableBootstrap.retryableProviderInit(...)`. This will make your extension's startup much more resilient.

### `error-utils.js`

*   **What it is:** A structured error handling system. It wraps native errors to add more context (like which component failed) and throttles repetitive logs to keep the console clean.
*   **Orchestrator Usage:** Not a direct dependency.
*   **Integration Plan:** This is a valuable upgrade for debugging. You can wrap key operations in `ErrorUtils.wrapAsync(...)`. For example, you could wrap the entire `orchestrator.batchPrompt(...)` call to get highly detailed and readable error logs if the whole process fails.

### `safe-fetch.js`

*   **What it is:** A replacement for the standard `fetch` function that automatically includes a timeout. This prevents a single network request from hanging indefinitely.
*   **Orchestrator Usage:** Not a direct dependency. It's intended to be used at a lower level.
*   **Integration Plan:** For maximum resilience, you should refactor the `sendPrompt` method inside each of your **provider adapters** (e.g., `claude-adapter.js`) to use `safeFetch` instead of the native `fetch`.

---

## 3. State and Data Management

These modules provide a sophisticated, centralized way to manage application state.

### `state-store.js`

*   **What it is:** A reactive state management library, similar in concept to Redux or MobX, but tailored for this extension. It provides observable collections and adapters for managing chats, connections, and other application data.
*   **Orchestrator Usage:** Indirect. The `HTOSRequestLifecycleManager` depends on the `sharedState` object that this module creates.
*   **Integration Plan:** This is a more advanced integration. Adopting it would involve creating a central `HTOSStateManager` and having various components (like the `Orchestrator`'s dependencies) read from and write to it. This would be a good "Phase 2" of your refactor to enable more complex, stateful features.

### `blob-store.js`

*   **What it is:** An enhancement for the `BusController` (the extension's messaging system) that allows it to serialize and transfer binary data like images or files.
*   **Orchestrator Usage:** None.
*   **Integration Plan:** This is an optional, feature-specific upgrade. If you plan to add features like file uploads for vision models, you would wire this into your `BusController`'s serialization methods.

---

## 4. Debugging & Infrastructure

These are high-level utilities primarily for development and debugging.

### `dnr-utils.js` & `dnr-auditor.js`

*   **What they are:** `dnr-utils.js` provides fine-grained control over network rules (e.g., rules that only last for 5 minutes). `dnr-auditor.js` is a debugging tool that logs when these rules are matched.
*   **Orchestrator Usage:** None.
*   **Integration Plan:** These are used by provider controllers that have special network requirements (like needing to disable certain headers to work in an iframe). You would call `ProviderDNRGate.ensureProviderDnrPrereqs()` before making a call to a provider that needs it.

### `infrastructure-manager.js`

*   **What it is:** A top-level manager that coordinates and provides a single interface for all the other utilities (`DNRRuleAuditor`, `ErrorUtils`, etc.). It can generate a full health report for the system.
*   **Orchestrator Usage:** None.
*   **Integration Plan:** This is an advanced, optional tool for deep debugging. You could wrap your entire service worker initialization in a call to `initializeInfrastructure()` to enable centralized control and reporting for all the other utilities.
