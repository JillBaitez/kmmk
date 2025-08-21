/**
 * HTOS Infrastructure Manager
 * - Centralized management of hardened infrastructure components
 * - Coordinates DNR auditing, error handling, and lifecycle management
 * - Provides unified interface for infrastructure monitoring and control
 *
 * Build-phase safe: emitted to dist/core/*
 */

import { DNRRuleAuditor } from './dnr-auditor.js';
import { ErrorUtils } from './error-utils.js';
import { DNRUtils } from './dnr-utils.js';

/** Centralized infrastructure management for HTOS */
export class InfrastructureManager {
  static instance = null;

  constructor(config) {
    this.lifecycleManager = null;
    this.config = config;
    this.startTime = Date.now();
  }

  /** Get or create the infrastructure manager instance */
  static getInstance(config) {
    if (!this.instance) {
      if (!config) {
        throw new Error('InfrastructureManager: Initial configuration required');
      }
      this.instance = new InfrastructureManager(config);
    }
    return this.instance;
  }

  /** Initialize all infrastructure components */
  async initialize(lifecycleManager) {
    const context = { component: 'InfrastructureManager', operation: 'initialize' };
    try {
      console.log('HTOS Infrastructure: Initializing hardened components');
      if (lifecycleManager) this.lifecycleManager = lifecycleManager;
      if (this.config.enableDNRAuditor) {
        const auditorEnabled = await DNRRuleAuditor.enableAuditor();
        if (auditorEnabled) {
          console.log('HTOS Infrastructure: DNR Rule Auditor enabled');
        } else {
          console.warn('HTOS Infrastructure: DNR Rule Auditor failed to enable');
        }
      }
      if (this.config.enableErrorThrottling) {
        console.log('HTOS Infrastructure: Error throttling enabled');
      }
      console.log('HTOS Infrastructure: All components initialized successfully');
    } catch (error) {
      const wrappedError = ErrorUtils.wrapWithContext(error, context);
      ErrorUtils.logError(wrappedError, 'error');
      throw wrappedError;
    }
  }

  /** Get comprehensive infrastructure statistics */
  async getStats() {
    const stats = {
      errorStats: ErrorUtils.getErrorStats(),
      lifecycleStats: { isActive: false, heartbeatInterval: 25000, uptime: Date.now() - this.startTime },
      dnrRuleStats: { activeRules: 0, scopedRules: 0 }
    };
    if (this.config.enableDNRAuditor && DNRRuleAuditor.isAuditorEnabled()) {
      stats.dnrStats = DNRRuleAuditor.getStats();
    }
    if (this.lifecycleManager) {
      // could read from lifecycleManager if exposed
    }
    try {
      const rules = await chrome.declarativeNetRequest.getDynamicRules();
      stats.dnrRuleStats.activeRules = rules.length;
      stats.dnrRuleStats.scopedRules = rules.filter(rule => rule.condition?.tabIds && rule.condition.tabIds.length > 0).length;
    } catch (error) {
      console.warn('HTOS Infrastructure: Failed to get DNR rule stats:', error);
    }
    return stats;
  }

  /** Generate a comprehensive infrastructure health report */
  async generateHealthReport() {
    const stats = await this.getStats();
    const uptime = Math.floor(stats.lifecycleStats.uptime / 1000);
    const uptimeFormatted = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${uptime % 60}s`;
    let report = `\nHTOS Infrastructure Health Report - ${new Date().toISOString()}\n${'='.repeat(60)}\n\n`;
    report += `System Overview:\n`;
    report += `  Uptime: ${uptimeFormatted}\n`;
    report += `  Debug Mode: ${this.config.debugMode ? 'Enabled' : 'Disabled'}\n`;
    report += `  DNR Auditor: ${this.config.enableDNRAuditor ? 'Enabled' : 'Disabled'}\n`;
    report += `  Error Throttling: ${this.config.enableErrorThrottling ? 'Enabled' : 'Disabled'}\n\n`;
    report += `Error Handling:\n`;
    report += `  Total Errors: ${stats.errorStats.totalErrors}\n`;
    report += `  Recent Error Types: ${stats.errorStats.recentErrorTypes}\n\n`;
    report += `DNR Rules:\n`;
    report += `  Active Rules: ${stats.dnrRuleStats.activeRules}\n`;
    report += `  Scoped Rules: ${stats.dnrRuleStats.scopedRules}\n`;
    if (stats.dnrStats) {
      report += `  Total Matches: ${stats.dnrStats.totalMatches}\n`;
      report += `  Matches by Provider:\n`;
      for (const [provider, count] of stats.dnrStats.matchesByProvider) {
        report += `    ${provider}: ${count}\n`;
      }
    }
    report += `\n`;
    report += `Lifecycle Management:\n`;
    report += `  Heartbeat Active: ${stats.lifecycleStats.isActive ? 'Yes' : 'No'}\n`;
    report += `  Heartbeat Interval: ${stats.lifecycleStats.heartbeatInterval}ms\n`;
    report += `  Adaptive Mode: ${this.config.adaptiveHeartbeat ? 'Enabled' : 'Disabled'}\n\n`;
    if (this.config.enableDNRAuditor && DNRRuleAuditor.isAuditorEnabled()) {
      report += DNRRuleAuditor.generateReport();
    }
    return report;
  }

  /** Perform infrastructure cleanup */
  async cleanup() {
    const context = { component: 'InfrastructureManager', operation: 'cleanup' };
    try {
      console.log('HTOS Infrastructure: Starting cleanup');
      if (DNRRuleAuditor.isAuditorEnabled()) {
        DNRRuleAuditor.disableAuditor();
      }
      ErrorUtils.cleanupErrorTracking();
      await DNRUtils.cleanupExpiredRules();
      console.log('HTOS Infrastructure: Cleanup completed');
    } catch (error) {
      const wrappedError = ErrorUtils.wrapWithContext(error, context);
      ErrorUtils.logError(wrappedError, 'error');
      throw wrappedError;
    }
  }

  /** Update infrastructure configuration */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    console.log('HTOS Infrastructure: Configuration updated', this.config);
  }

  /** Get current configuration */
  getConfig() {
    return { ...this.config };
  }

  /** Test infrastructure components */
  async runDiagnostics() {
    const results = {};
    try { await chrome.declarativeNetRequest.getDynamicRules(); results.dnr = true; } catch { results.dnr = false; }
    results.dnrAuditor = DNRRuleAuditor.isAuditorEnabled();
    try { ErrorUtils.getErrorStats(); results.errorHandling = true; } catch { results.errorHandling = false; }
    results.lifecycleManager = this.lifecycleManager !== null;
    return results;
  }

  /** Reset infrastructure manager instance (for testing) */
  static reset() { this.instance = null; }
}

/** Convenience function to initialize infrastructure with default config */
export async function initializeInfrastructure(lifecycleManager, customConfig) {
  const defaultConfig = {
    enableDNRAuditor: (typeof process !== 'undefined' ? process.env.NODE_ENV === 'development' : false),
    enableErrorThrottling: true,
    adaptiveHeartbeat: true,
    debugMode: (typeof process !== 'undefined' ? process.env.NODE_ENV === 'development' : false)
  };
  const config = { ...defaultConfig, ...customConfig };
  const manager = InfrastructureManager.getInstance(config);
  await manager.initialize(lifecycleManager);
  return manager;
}
