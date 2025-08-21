/**
 * HTOS Retry Utilities
 * - Implements exponential backoff with jitter
 * - Provides retryable bootstrap wrapper for providers
 * - Uses MV3-safe scheduling with chrome.alarms
 *
 * Build-phase safe: emitted to dist/core/*
 */

/**
 * Exponential backoff with jitter utility
 */
export class RetryUtils {
  static DEFAULT_CONFIG = {
    maxAttempts: 5,
    baseDelayMs: 1000,
    maxDelayMs: 60000,
    jitterMs: 500,
    backoffMultiplier: 2
  };

  /**
   * Retry a function with exponential backoff
   */
  static async retryWithBackoff(fn, config = {}, context) {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    const startTime = Date.now();
    let lastError = new Error('Unknown error');

    for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
      try {
        console.debug(`Retry attempt ${attempt}/${finalConfig.maxAttempts}${context ? ` (${context})` : ''}`);
        const result = await fn();
        const totalTime = Date.now() - startTime;
        console.debug(`Retry succeeded on attempt ${attempt}${context ? ` (${context})` : ''} after ${totalTime}ms`);
        return {
          success: true,
          result,
          attempts: attempt,
          totalTimeMs: totalTime
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt === finalConfig.maxAttempts) {
          break; // Don't delay on final attempt
        }
        const delay = this.calculateDelay(attempt, finalConfig);
        console.warn(`Retry attempt ${attempt} failed${context ? ` (${context})` : ''}, retrying in ${delay}ms:`, lastError.message);
        await this.delay(delay);
      }
    }

    const totalTime = Date.now() - startTime;
    console.error(`Retry failed after ${finalConfig.maxAttempts} attempts${context ? ` (${context})` : ''} in ${totalTime}ms:`, lastError);
    return {
      success: false,
      error: lastError,
      attempts: finalConfig.maxAttempts,
      totalTimeMs: totalTime
    };
  }

  /**
   * Calculate delay with exponential backoff and jitter
   */
  static calculateDelay(attempt, config) {
    const exponentialDelay = config.baseDelayMs * Math.pow(config.backoffMultiplier || 2, attempt - 1);
    const jitter = config.jitterMs ? Math.random() * config.jitterMs : 0;
    const totalDelay = exponentialDelay + jitter;
    return Math.min(totalDelay, config.maxDelayMs);
  }

  /**
   * MV3-safe delay using chrome.alarms when available
   */
  static async delay(ms) {
    if (typeof chrome !== 'undefined' && chrome.alarms && ms > 30000) {
      // Use alarms for longer delays to survive service worker suspension
      return new Promise((resolve) => {
        const alarmName = `htos-retry-delay-${Date.now()}`;
        const listener = (alarm) => {
          if (alarm.name === alarmName) {
            chrome.alarms.onAlarm.removeListener(listener);
            resolve();
          }
        };
        chrome.alarms.onAlarm.addListener(listener);
        chrome.alarms.create(alarmName, { delayInMinutes: ms / (1000 * 60) });
      });
    } else {
      // Use setTimeout for shorter delays
      return new Promise(resolve => setTimeout(resolve, ms));
    }
  }
}

/**
 * Retryable bootstrap wrapper for providers
 */
export class RetryableBootstrap {
  /**
   * Wrap provider initialization with retry logic
   */
  static async retryableProviderInit(providerId, initFn, config) {
    const retryConfig = {
      maxAttempts: 3,
      baseDelayMs: 2000,
      maxDelayMs: 30000,
      jitterMs: 1000,
      ...config
    };

    const result = await RetryUtils.retryWithBackoff(initFn, retryConfig, `${providerId} initialization`);
    if (!result.success) {
      const error = new Error(`Failed to initialize ${providerId} after ${result.attempts} attempts: ${result.error?.message}`);
      error.cause = result.error;
      throw error;
    }
    return result.result;
  }

  /**
   * Wrap health check with retry logic
   */
  static async retryableHealthCheck(providerId, healthCheckFn, config) {
    const retryConfig = {
      maxAttempts: 3,
      baseDelayMs: 1000,
      maxDelayMs: 10000,
      jitterMs: 500,
      ...config
    };

    const result = await RetryUtils.retryWithBackoff(async () => {
      const isHealthy = await healthCheckFn();
      if (!isHealthy) {
        throw new Error(`Health check failed for ${providerId}`);
      }
      return isHealthy;
    }, retryConfig, `${providerId} health check`);

    return result.success && result.result === true;
  }

  /**
   * Wrap offscreen ping with retry logic
   */
  static async retryableOffscreenPing(pingFn, config) {
    const retryConfig = {
      maxAttempts: 5,
      baseDelayMs: 500,
      maxDelayMs: 15000,
      jitterMs: 250,
      ...config
    };

    const result = await RetryUtils.retryWithBackoff(pingFn, retryConfig, 'offscreen ping');
    return result.success;
  }
}
