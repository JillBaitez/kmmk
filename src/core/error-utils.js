/**
 * HTOS Error Handling Utilities
 * - Provides contextual error wrapping and logging
 * - Preserves original error stacks and root causes
 * - Implements structured logging for better debugging
 *
 * Build-phase safe: emitted to dist/core/*
 */

/**
 * Enhanced error handling utilities
 */
export class ErrorUtils {
  static errorCounter = 0;
  static recentErrors = new Map();
  static THROTTLE_WINDOW_MS = 60000; // 1 minute
  static MAX_SAME_ERROR_COUNT = 5;

  /**
   * Wrap an error with contextual information while preserving the original
   */
  static wrapWithContext(error, context) {
    const originalError = error instanceof Error ? error : new Error(String(error));
    const errorId = `htos-${++this.errorCounter}-${Date.now()}`;
    const wrappedError = new Error(`[${context.component}:${context.operation}] ${originalError.message}`);
    wrappedError.context = { ...context, timestamp: Date.now() };
    wrappedError.originalError = originalError;
    wrappedError.errorId = errorId;
    wrappedError.name = 'HTOSWrappedError';
    // Preserve original stack trace
    if (originalError.stack) {
      wrappedError.stack = `${wrappedError.stack}\n\nCaused by: ${originalError.stack}`;
    }
    return wrappedError;
  }

  /**
   * Log error with throttling to prevent spam
   */
  static logError(error, level = 'error') {
    const errorKey = this.getErrorKey(error);
    const now = Date.now();
    // Check if this error type has been logged recently
    const lastLogged = this.recentErrors.get(errorKey) || 0;
    const timeSinceLastLog = now - lastLogged;

    if (timeSinceLastLog < this.THROTTLE_WINDOW_MS) {
      // Count occurrences but don't log repeatedly
      const count = this.recentErrors.get(`${errorKey}:count`) || 0;
      if (count < this.MAX_SAME_ERROR_COUNT) {
        this.recentErrors.set(`${errorKey}:count`, count + 1);
        return; // Throttled
      }
    } else {
      // Reset counters for this error type
      this.recentErrors.set(errorKey, now);
      this.recentErrors.delete(`${errorKey}:count`);
    }

    // Log the error with structured data
    const logData = this.formatErrorForLogging(error);
    switch (level) {
      case 'error':
        console.error('HTOS Error:', logData);
        break;
      case 'warn':
        console.warn('HTOS Warning:', logData);
        break;
      case 'debug':
        console.debug('HTOS Debug:', logData);
        break;
    }
  }

  /**
   * Create a standardized error key for throttling
   */
  static getErrorKey(error) {
    if ('context' in error && error.context) {
      const ctx = error.context;
      return `${ctx.component}:${ctx.operation}:${error.message.substring(0, 50)}`;
    }
    return `${error.name}:${error.message.substring(0, 50)}`;
  }

  /**
   * Format error for structured logging
   */
  static formatErrorForLogging(error) {
    const baseData = {
      message: error.message,
      name: error.name,
      stack: error.stack
    };
    if ('context' in error && error.context) {
      const wrappedError = error;
      return {
        ...baseData,
        errorId: wrappedError.errorId,
        context: wrappedError.context,
        originalError: wrappedError.originalError ? {
          message: wrappedError.originalError.message,
          name: wrappedError.originalError.name,
          stack: wrappedError.originalError.stack
        } : undefined
      };
    }
    return baseData;
  }

  /**
   * Enhanced wrapper for async operations with automatic error handling
   */
  static async wrapAsync(operation, context) {
    try {
      return await operation();
    } catch (error) {
      const wrappedError = this.wrapWithContext(error, context);
      this.logError(wrappedError);
      throw wrappedError;
    }
  }

  /**
   * Enhanced wrapper for sync operations with automatic error handling
   */
  static wrapSync(operation, context) {
    try {
      return operation();
    } catch (error) {
      const wrappedError = this.wrapWithContext(error, context);
      this.logError(wrappedError);
      throw wrappedError;
    }
  }

  /**
   * Clean up old error tracking data
   */
  static cleanupErrorTracking() {
    const now = Date.now();
    const keysToDelete = [];
    for (const [key, timestamp] of this.recentErrors.entries()) {
      if (typeof timestamp === 'number' && now - timestamp > this.THROTTLE_WINDOW_MS * 2) {
        keysToDelete.push(key);
        keysToDelete.push(`${key}:count`);
      }
    }
    keysToDelete.forEach(key => this.recentErrors.delete(key));
  }

  /**
   * Get error statistics for debugging
   */
  static getErrorStats() {
    return {
      totalErrors: this.errorCounter,
      recentErrorTypes: Array.from(this.recentErrors.keys()).filter(key => !key.includes(':count')).length
    };
  }
}

/**
 * Decorator for automatic error wrapping in class methods
 */
export function withErrorContext(context) {
  return function (target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args) {
      try {
        const result = await originalMethod.apply(this, args);
        return result;
      } catch (error) {
        const wrappedError = ErrorUtils.wrapWithContext(error, { ...context, operation: propertyKey });
        ErrorUtils.logError(wrappedError);
        throw wrappedError;
      }
    };
    return descriptor;
  };
}
