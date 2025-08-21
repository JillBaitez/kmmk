/**
 * HTOS Safe Fetch Utility
 * - Provides a secure fetch implementation for service worker
 * - Handles request timeouts and aborts
 *
 * Build-phase safe: emitted to dist/utils/*
 */

/**
 * Creates a fetch implementation with timeout and abort support
 */
export function createSafeFetch(options = {}) {
  const { timeout = 30000, headers = {} } = options;
  
  return async function safeFetch(url, init) {
    // Create abort controller for timeout
    const controller = new AbortController();
    const { signal } = controller;
    
    // Combine with existing signal if provided
    const userSignal = init?.signal;
    if (userSignal) {
      if (userSignal.aborted) {
        controller.abort(userSignal.reason);
      } else {
        userSignal.addEventListener('abort', () => {
          controller.abort(userSignal.reason);
        });
      }
    }
    
    // Set up timeout
    const timeoutId = setTimeout(() => {
      controller.abort(new Error(`Request timeout after ${timeout}ms`));
    }, timeout);
    
    try {
      // Merge headers and include credentials
      const mergedInit = {
        ...init,
        credentials: 'include',
        headers: {
          ...headers,
          ...(init?.headers || {})
        },
        signal
      };
      
      // Execute fetch
      const response = await fetch(url, mergedInit);
      
      // Check if response is ok
      if (!response.ok) {
        const text = await response.text().catch(() => null);
        const err = new Error('fetch_error');
        err.status = response.status;
        err.body = text;
        throw err;
      }
      
      return response;
    } catch (err) {
      // Just rethrow the error to be handled by caller
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  };
}

// Default instance
export const safeFetch = createSafeFetch();
