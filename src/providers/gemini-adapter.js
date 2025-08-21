/**
 * HTOS Gemini Provider Adapter
 * - Implements ProviderAdapter interface for Gemini
 *
 * Build-phase safe: emitted to dist/adapters/*
 */
import { classifyProviderError } from '../core/request-lifecycle-manager.js';
export class GeminiAdapter {
    constructor(controller) {
        this.id = 'gemini';
        this.capabilities = {
            needsDNR: false,
            needsOffscreen: false,
            supportsStreaming: false,
            supportsContinuation: true,
            synthesis: false
        };
        this.controller = controller;
    }
    /**
     * Initialize the adapter
     */
    async init() {
        // Initialization logic if needed
        return;
    }
    /**
     * Check if the provider is available and working
     */
    async healthCheck() {
        try {
            // Perform a simple check to verify Gemini API is accessible
            return await this.controller.isAvailable();
        }
        catch (error) {
            return false;
        }
    }
    async sendPrompt(req, onChunk, signal) {
        const startTime = Date.now();
        try {
            // Send prompt to Gemini
            const result = await this.controller.geminiSession.ask(req.originalPrompt, { signal, cursor: req.meta?.cursor });
            // Return final result
            return {
                providerId: this.id,
                ok: true,
                id: null, // Request ID not available in BatchRequest type
                text: result.text,
                partial: false,
                latencyMs: Date.now() - startTime,
                meta: {
                    cursor: result.cursor,
                    token: result.token,
                    modelName: result.modelName
                }
            };
        }
        catch (error) {
            // Handle errors with proper classification
            const classification = classifyProviderError('gemini-session', error);
            const errorCode = classification.type || 'unknown';
            return {
                providerId: this.id,
                ok: false,
                text: null,
                errorCode,
                latencyMs: Date.now() - startTime,
                meta: {
                    error: error.toString(),
                    details: error.details,
                    suppressed: classification.suppressed
                }
            };
        }
    }
}
