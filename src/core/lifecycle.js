/**
 * HTOS Lifecycle Manager
 * - Prevents background inactivity
 * - Provides heartbeat/keepalive for long-running tasks
 *
 * Build-phase safe: emitted to dist/core/*
 */
// Build-phase safe: emitted to dist/core/*
export class LifecycleManager {
    constructor(ping) {
        this.ping = ping;
        this.keepAlive = false;
        this.heartbeatTimer = null;
        this.heartbeatIntervalMs = 25000; // MV3 service worker idle timeout ~30s; ping before that
    }
    // Build-phase safe: emitted to dist/core/*
    _preventBgInactive() {
        try {
            // Toggle keepAlive flag to signal observers that background should stay active
            this.keepAlive = true;
            // Start heartbeat if not running
            if (!this.heartbeatTimer)
                this.startHeartbeat();
        }
        catch { }
    }
    // Build-phase safe: emitted to dist/core/*
    startHeartbeat(intervalMs) {
        if (intervalMs && intervalMs > 0)
            this.heartbeatIntervalMs = intervalMs;
        if (this.heartbeatTimer)
            return; // idempotent
        const tick = async () => {
            try {
                await this.ping?.();
            }
            catch (e) {
                // eslint-disable-next-line no-console
                console.warn('LifecycleManager ping failed', e);
            }
            // schedule next
            this.heartbeatTimer = setTimeout(tick, this.heartbeatIntervalMs);
        };
        // kick off immediately
        this.heartbeatTimer = setTimeout(tick, 0);
    }
    // Build-phase safe: emitted to dist/core/*
    keepalive(enable) {
        this.keepAlive = !!enable;
        if (enable) {
            if (!this.heartbeatTimer)
                this.startHeartbeat();
        }
        else {
            if (this.heartbeatTimer) {
                clearTimeout(this.heartbeatTimer);
                this.heartbeatTimer = null;
            }
        }
    }
}
// Build-phase safe: CommonJS compatibility
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LifecycleManager };
}
