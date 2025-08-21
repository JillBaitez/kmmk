/**
 * HTOS ChatGPT Provider Adapter (scaffold)
 * - Implements ProviderAdapter interface for ChatGPT
 *
 * Build-phase safe: emitted to dist/adapters/*
 */
import { classifyProviderError } from "../core/request-lifecycle-manager.js";

export class ChatGPTAdapter {
  constructor(controller) {
    this.id = "chatgpt";
    this.capabilities = {
      needsDNR: false,
      needsOffscreen: true, // Requires oi Arkose/PoW pipeline
      supportsStreaming: false,
      supportsContinuation: true,
      synthesis: false,
    };
    this.controller = controller;
  }

  /** Initialize the adapter */
  async init() {
    return;
  }

  /**
   * Health check to ensure ChatGPT path is available
   */
  async healthCheck() {
    try {
      return await this.controller.isAvailable();
    } catch {
      return false;
    }
  }

  /**
   * Send prompt to ChatGPT. Mirrors Claude/Gemini adapter contract.
   */
  async sendPrompt(req, onChunk, signal) {
    const startTime = Date.now();
    try {
      const result = await this.controller.chatgptSession.ask(
        req.originalPrompt,
        { signal, model: req.meta?.model },
        onChunk
      );
      return {
        providerId: this.id,
        ok: true,
        id: null,
        text: result?.text ?? "",
        partial: false,
        latencyMs: Date.now() - startTime,
        meta: { model: result?.model || req.meta?.model || "auto" },
      };
    } catch (error) {
      const classification = classifyProviderError("openai-session", error);
      const errorCode = classification.type || "unknown";
      return {
        providerId: this.id,
        ok: false,
        text: null,
        errorCode,
        latencyMs: Date.now() - startTime,
        meta: {
          error: error.toString(),
          details: error.details,
          suppressed: classification.suppressed,
        },
      };
    }
  }
}
