/**
 * HTOS DNR Utilities
 * - Provides scoped and temporary DNR rule management
 * - Implements provider prerequisite gates
 * - Ensures minimal blast radius for network modifications
 *
 * Build-phase safe: emitted to dist/core/*
 */

export class DNRUtils {
  static scopedRules = new Map();
  static ruleIdCounter = 10000; // Start high to avoid conflicts

  /** Register a tab-scoped DNR rule */
  static async registerTabScoped(tabId, rule, providerId) {
    const ruleId = this.ruleIdCounter++;
    const fullRule = { ...rule, id: ruleId, condition: { ...rule.condition, tabIds: [tabId] } };
    try {
      await chrome.declarativeNetRequest.updateDynamicRules({ addRules: [fullRule] });
      this.scopedRules.set(ruleId, { id: ruleId, tabId, providerId, rule: fullRule });
      console.debug(`DNR: Registered tab-scoped rule ${ruleId} for tab ${tabId}`, providerId ? `(${providerId})` : '');
      return ruleId;
    } catch (error) {
      console.error('Failed to register tab-scoped DNR rule:', error);
      throw error;
    }
  }

  /** Register a temporary DNR rule with auto-expiration */
  static async registerTemporary(rule, durationMs, providerId) {
    const ruleId = this.ruleIdCounter++;
    const fullRule = { ...rule, id: ruleId };
    const expiresAt = Date.now() + durationMs;
    try {
      await chrome.declarativeNetRequest.updateDynamicRules({ addRules: [fullRule] });
      this.scopedRules.set(ruleId, { id: ruleId, expiresAt, providerId, rule: fullRule });
      // Schedule automatic removal
      setTimeout(() => {
        this.removeRule(ruleId).catch(err => console.warn(`Failed to auto-remove expired DNR rule ${ruleId}:`, err));
      }, durationMs);
      console.debug(`DNR: Registered temporary rule ${ruleId} (expires in ${durationMs}ms)`, providerId ? `(${providerId})` : '');
      return ruleId;
    } catch (error) {
      console.error('Failed to register temporary DNR rule:', error);
      throw error;
    }
  }

  /** Remove a scoped DNR rule */
  static async removeRule(ruleId) {
    const scopedRule = this.scopedRules.get(ruleId);
    if (!scopedRule) {
      console.warn(`DNR: Rule ${ruleId} not found in scoped rules`);
      return;
    }
    try {
      await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [ruleId] });
      this.scopedRules.delete(ruleId);
      console.debug(`DNR: Removed scoped rule ${ruleId}`);
    } catch (error) {
      console.error(`Failed to remove DNR rule ${ruleId}:`, error);
      throw error;
    }
  }

  /** Remove all rules for a specific provider */
  static async removeProviderRules(providerId) {
    const providerRules = Array.from(this.scopedRules.values()).filter(rule => rule.providerId === providerId);
    if (providerRules.length === 0) return;
    const ruleIds = providerRules.map(rule => rule.id);
    try {
      await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: ruleIds });
      ruleIds.forEach(id => this.scopedRules.delete(id));
      console.debug(`DNR: Removed ${ruleIds.length} rules for provider ${providerId}`);
    } catch (error) {
      console.error(`Failed to remove provider rules for ${providerId}:`, error);
      throw error;
    }
  }

  /** Clean up expired rules */
  static async cleanupExpiredRules() {
    const now = Date.now();
    const expiredRules = Array.from(this.scopedRules.values()).filter(rule => rule.expiresAt && rule.expiresAt <= now);
    if (expiredRules.length === 0) return;
    const ruleIds = expiredRules.map(rule => rule.id);
    try {
      await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: ruleIds });
      ruleIds.forEach(id => this.scopedRules.delete(id));
      console.debug(`DNR: Cleaned up ${ruleIds.length} expired rules`);
    } catch (error) {
      console.error('Failed to cleanup expired DNR rules:', error);
    }
  }

  /** Get active rules for debugging */
  static getActiveRules() {
    return Array.from(this.scopedRules.values());
  }
}

/** Provider DNR Prerequisite Gate */
export class ProviderDNRGate {
  static providerRules = new Map();

  /** Ensure provider prerequisites are met before network operations */
  static async ensureProviderDnrPrereqs(providerId, tabId) {
    console.debug(`DNR Gate: Ensuring prerequisites for ${providerId}`);
    const rules = this.getProviderRules(providerId);
    if (rules.length === 0) {
      console.debug(`DNR Gate: No prerequisites needed for ${providerId}`);
      return;
    }
    const ruleIds = [];
    try {
      for (const rule of rules) {
        let ruleId;
        if (tabId) {
          // Tab-scoped rule
          ruleId = await DNRUtils.registerTabScoped(tabId, rule, providerId);
        } else {
          // Temporary global rule (5 minutes max)
          ruleId = await DNRUtils.registerTemporary(rule, 5 * 60 * 1000, providerId);
        }
        ruleIds.push(ruleId);
      }
      const existingRules = this.providerRules.get(providerId) || [];
      this.providerRules.set(providerId, [...existingRules, ...ruleIds]);
      console.debug(`DNR Gate: Activated ${ruleIds.length} rules for ${providerId}`);
    } catch (error) {
      for (const ruleId of ruleIds) {
        await DNRUtils.removeRule(ruleId).catch(() => {});
      }
      throw error;
    }
  }

  /** Clean up provider rules after workflow completion */
  static async cleanupProviderRules(providerId) {
    await DNRUtils.removeProviderRules(providerId);
    this.providerRules.delete(providerId);
  }

  /** Get provider-specific DNR rules */
  static getProviderRules(providerId) {
    switch (providerId) {
      case 'claude':
        return [
          {
            priority: 1,
            action: {
              type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
              responseHeaders: [
                { header: 'content-security-policy', operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE }
              ]
            },
            condition: { urlFilter: '*://claude.ai/*', resourceTypes: [chrome.declarativeNetRequest.ResourceType.SUB_FRAME] }
          }
        ];
      case 'gemini':
        return [
          {
            priority: 1,
            action: {
              type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
              responseHeaders: [
                { header: 'x-frame-options', operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE }
              ]
            },
            condition: { urlFilter: '*://gemini.google.com/*', resourceTypes: [chrome.declarativeNetRequest.ResourceType.SUB_FRAME] }
          }
        ];
      default:
        return [];
    }
  }
}
