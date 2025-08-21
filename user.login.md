

# Guide: Implementing the Interactive User Login Flow

This document outlines the steps to implement a user-friendly login flow. The goal is to transform an authentication failure from a simple error into an interactive onboarding opportunity, prompting the user to log in and re-engage with a provider.

This process involves three key parts of the application: the provider adapters (detection), the service worker (escalation), and the React UI (interaction).

---

### Part 1: Detect the Authentication Error (Provider Adapters)

**Goal:** The first step is to specifically identify when a request fails because the user isn't logged in.

**Location:** The `sendPrompt` method within each provider adapter file (e.g., `src/providers/claude-adapter.js`, `src/providers/chatgpt-adapter.js`).

**Instructions:**

1.  **Inspect the Error:** In the `catch` block of your `fetch` request, you need to inspect the error object. Authentication errors typically come back as an HTTP status code of `401` (Unauthorized) or `403` (Forbidden).

2.  **Return a Specific Error Code:** If an authentication error is detected, the adapter must return a structured error object with a unique `errorCode`. This is the most critical change.

    **Before (Generic Error):**
    ```javascript
    // Inside a catch block...
    return { ok: false, errorCode: 'provider_failed' };
    ```

    **After (Specific Error):**
    ```javascript
    // Inside a catch block...
    if (error.status === 401 || error.status === 403) {
      return { ok: false, errorCode: 'AUTH_REQUIRED' };
    } else {
      // Handle other errors
      return { ok: false, errorCode: 'provider_failed' };
    }
    ```

---

### Part 2: Escalate the Specific Error (Service Worker)

**Goal:** When the service worker sees the `AUTH_REQUIRED` error, it must notify the UI by sending a special message.

**Location:** `src/sw-entry.js`. (After the refactor, this logic would live inside the `Orchestrator` as it processes results).

**Instructions:**

1.  **Check for the Error Code:** As you process the results from the provider adapters, check if any of them have `errorCode: 'AUTH_REQUIRED'`.

2.  **Send a Dedicated Message:** If the code is found, send a new, specific message to the UI. This is different from the standard `WORKFLOW_COMPLETE` message.

    ```javascript
    // In the logic that handles provider results...

    for (const result of providerResults) {
      if (result.errorCode === 'AUTH_REQUIRED') {
        // This is the new, specific message for the UI
        chrome.runtime.sendMessage({
          type: 'PROVIDER_AUTH_REQUIRED',
          payload: {
            providerId: result.providerId
          }
        });
      }
      // ... handle other results as normal ...
    }
    ```

---

### Part 3: Display the Login Prompt (React UI)

**Goal:** The UI must listen for the new message, update its state, and show a login prompt to the user.

**Location:** `ui/App.tsx`

**Instructions:**

1.  **Add State to `App.tsx`:** Create a new state variable to track which providers require the user to log in.

    ```javascript
    const [loginPrompts, setLoginPrompts] = useState({});
    // This will hold data like: { chatgpt: true, claude: false }
    ```

2.  **Handle the New Message:** In the `useEffect` hook that listens for messages from the service worker, add a `case` to handle our new message type.

    ```javascript
    // Inside the useEffect listening to chrome.runtime.onMessage...
    
    switch (message.type) {
      // ... other cases ...

      case 'PROVIDER_AUTH_REQUIRED':
        setLoginPrompts(prev => ({
          ...prev,
          [message.payload.providerId]: true
        }));
        // Also update the specific LLM's message in the UI
        setMessages(/** logic to show "Login required" in the provider's card **/);
        break;
    }
    ```

3.  **Conditionally Render the Login UI:** In your JSX, where you render the results for each provider (likely within `AIMessageBlock.tsx`), check the `loginPrompts` state. If a provider is marked as needing a login, display the prompt.

    ```jsx
    // Example inside the component that renders provider cards

    {loginPrompts[provider.id] && (
      <div className="login-prompt-container">
        <p>Please log in to {provider.name} to get a response.</p>
        <button onClick={() => chrome.tabs.create({ url: `https://www.${provider.hostnames[0]}` }) }>
          Login to {provider.name}
        </button>
      </div>
    )}
    ```

---

### Summary of the Data Flow

This implementation creates a clean, event-driven chain of events:

`Adapter fails with 401` → `Returns { errorCode: 'AUTH_REQUIRED' }` → `Service Worker sees code` → `Sends { type: 'PROVIDER_AUTH_REQUIRED' }` → `App.tsx receives message` → `Sets state` → `Renders "Login" button`
