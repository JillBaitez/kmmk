/**
 * HTOS ChatGPT Provider Implementation (scaffold)
 *
 * This module wires ChatGPT integration following existing provider patterns.
 * It retrieves Arkose and PoW tokens via BusController (from the oi iframe)
 * and exposes a simple ask() that currently returns a mocked response.
 *
 * Build-phase safe: emitted to dist/adapters/*
 */
import { BusController, utils } from "../core/vendor-exports.js";

// =============================================================================
// CHATGPT MODELS CONFIGURATION
// =============================================================================
export const ChatGPTModels = {
  auto: {
    id: "auto",
    name: "Auto",
    description: "Use the best available model",
    maxTokens: 128000,
  },
  "gpt-4o": {
    id: "gpt-4o",
    name: "GPT-4o",
    description: "OpenAI multimodal model",
    maxTokens: 128000,
  },
};

// =============================================================================
// ARKOSE ENFORCEMENT CONFIG (extracted from arkose logic docs)
// =============================================================================
const AE_CONFIG = {
  modelRegex: ".*",
  scriptLoadTimeout: 5000,
  tokenFetchTimeout: 5000,
  requirements: {
    $p: "p",
    url: "https://chatgpt.com/backend-api/sentinel/chat-requirements",
    headerName: "Openai-Sentinel-Chat-Requirements-Token",
    dxPath: "arkose.dx",
    arkoseRequiredPath: "arkose.required",
    tokenPath: "token",
  },
  iframeUrl: "https://tcr9i.chat.openai.com/",
  dxUrl: "https://chatgpt.com/backend-api/sentinel/arkose/dx",
  chatUrl: "https://chatgpt.com",
  bodyStartsWith: "bda=",
  siteParam: "site",
  dataSiteParam: "data[site]",
  dataKey: "data",
  blobKey: "blob",
  selectorKey: "selector",
  onErrorKey: "onError",
  onCompletedKey: "onCompleted",
  resultTokenKey: "token",
  headerName: "Openai-Sentinel-Arkose-Token",
  script: {
    src: null,
    "data-status": "loading",
    "data-callback": "useArkoseSetupEnforcement",
  },
  params: { mode: "inline" },
  parameters: {
    capi_mode: "lightbox",
    capi_version: "1.5.2",
    capi_settings: null,
    public_key: "35536E1E-65B4-4D96-9D97-6ADB7EFF8147",
    target_html: "challenge",
    surl: "https://tcr9i.chat.openai.com",
    data: undefined,
    language: undefined,
    isSDK: undefined,
    siteData: {
      location: {
        ancestorOrigins: {},
        href: "https://chatgpt.com/?model=gpt-4",
        origin: "https://chatgpt.com",
        protocol: "https:",
        host: "chatgpt.com",
        hostname: "chatgpt.com",
        port: "",
        pathname: "/",
        hash: "",
      },
    },
    styletheme: "default",
    accessibilitySettings: { lockFocusToModal: true },
  },
  pow: {
    $required: "required",
    $proofofwork: "proofofwork",
    $seed: "seed",
    $difficulty: "difficulty",
    $dpl: "dpl",
    prefix: "gAAAAAB",
    headerName: "Openai-Sentinel-Proof-Token",
  },
};

// =============================================================================
// CHATGPT ERROR TYPES
// =============================================================================
export class ChatGPTProviderError extends Error {
  constructor(type, details) {
    super(type);
    this.name = "ChatGPTProviderError";
    this.type = type;
    this.details = details;
  }
  get is() {
    return {
      login: this.type === "login",
      badModel: this.type === "badModel",
      badApiKey: this.type === "badApiKey",
      requestsLimit: this.type === "requestsLimit",
      messageTooLong: this.type === "messageTooLong",
      failedToReadResponse: this.type === "failedToReadResponse",
      aborted: this.type === "aborted",
      network: this.type === "network",
      unknown: this.type === "unknown",
    };
  }
}

// =============================================================================
// CHATGPT SESSION API
// =============================================================================
export class ChatGPTSessionApi {
  constructor({ sharedState, utils, fetchImpl = fetch } = {}) {
    this._logs = true;
    this.sharedState = sharedState;
    this.utils = utils;
    this.fetch = fetchImpl;
    // Bind/wrap
    this.ask = this._wrapMethod(this.ask);
    // ephemeral caches
    this._accessToken = null;
    this._requirementsProofToken = null;
    this._requirementsProofTokenExpiresAt = 0;
    this._scriptsCache = null;
    this._scriptsCacheExpiresAt = 0;
  }

  isOwnError(e) {
    return e instanceof ChatGPTProviderError;
  }

  /**
   * Ask ChatGPT with mandatory Arkose preflight and PoW.
   */
  async ask(prompt, options = {}, onChunk = () => {}) {
    const {
      signal,
      model = this._model,
      chatId = null,
      parentMessageId = null,
      attachments = [],
    } = options || {};

    // Ensure offscreen (oi) is ready for token generation
    try {
      if (BusController?.poll) await BusController.poll("startup.oiReady");
    } catch {}

    // Ensure we have (or tried to get) access token
    await this._ensureAccessToken();

    // 1) Generate lightweight proof for requirements call
    const reqProof = await this._getRequirementsProofToken();

    // 2) Sentinel preflight
    const requirements = await this._fetchRequirements(reqProof);

    // 3) Build ask payload
    const body = this._buildAskBody(prompt, {
      model,
      chatId,
      parentMessageId,
      attachments,
    });

    // 4) Headers baseline
    const headers = {
      accept: "text/event-stream",
      origin: AE_CONFIG.chatUrl,
      referer: `${AE_CONFIG.chatUrl}/`,
      "content-type": "application/json",
    };

    // 5) Inject AE (requirements token, PoW, Arkose) into headers
    await this._injectAEHeaders(headers, requirements);

    // 6) Execute ask via authenticated fetch
    const res = await this._fetchAuth("/backend-api/conversation", {
      method: "POST",
      headers,
      body,
      signal,
    });

    if (res.status !== 200) {
      const errJson = await this._safeJson(res);
      if (res.status === 503) this._throw("serverError", errJson);
      if (res.status === 413) this._throw("messageTooLong", errJson);
      if (res.status === 429) this._throw("tooManyRequests", errJson);
      if (res.status === 404) this._throw("chatNotFound", errJson);
      if (
        res.status === 400 &&
        errJson?.detail?.message ===
          "Conversation key not found. Try starting a new conversation."
      )
        this._throw("chatNotFound", errJson);
      this._throw("unknown", errJson);
    }

    const ct = (res.headers.get("content-type") || "").toLowerCase();
    // Prefer SSE path
    if (ct.includes("text/event-stream")) {
      const reader = res.body.getReader();
      let carry = "";
      let aggText = "";
      let done = false;
      try {
        while (!done) {
          const { value, done: d } = await reader.read();
          done = d;
          if (value) {
            const chunk = new TextDecoder().decode(value);
            const { dataEvents, remainder } = this._splitSSE(carry + chunk);
            carry = remainder;
            for (const line of dataEvents) {
              const parsed = this._parseSSEData(line);
              if (!parsed) continue;
              const { text, id, finishDetails, conversationId } = parsed;
              if (text) {
                aggText = text; // parsed.text is cumulative
                onChunk({
                  id,
                  text: aggText,
                  chatId: conversationId,
                  finishDetails,
                  model,
                  partial: true,
                });
              }
            }
          }
        }
      } catch (e) {
        if (!String(e).includes("aborted")) {
          this._throw("failedToReadResponse", this._safeString(e));
        }
      } finally {
        try {
          reader.releaseLock();
        } catch {}
      }
      return { text: aggText, model };
    }

    // If server responds JSON (WSS bootstrap), we don't support WSS here.
    this._throw(
      "failedToReadResponse",
      "Unexpected response type; WSS not supported in this path"
    );
  }

  // =============================================================================
  // PRIVATE HELPERS
  // =============================================================================
  get _model() {
    return (
      this.sharedState?.ai?.connections?.get?.("openai-session")?.selectedOption
        ?.id || "auto"
    );
  }

  _wrapMethod(fn) {
    return async (...args) => {
      try {
        return await fn.call(this, ...args);
      } catch (e) {
        let err;
        if (this.isOwnError(e)) err = e;
        else if (String(e) === "TypeError: Failed to fetch")
          err = this._createError("network", e.message);
        else if (String(e)?.includes("aborted"))
          err = this._createError("aborted", e.message);
        else err = this._createError("unknown", e.message);

        if (err.details) this._logError(err.message, err.details);
        else this._logError(err.message);
        throw err;
      }
    };
  }

  _throw(type, details) {
    throw this._createError(type, details);
  }
  _createError(type, details) {
    return new ChatGPTProviderError(type, details);
  }
  _safeString(e) {
    try {
      return String(e);
    } catch {
      return "[error]";
    }
  }
  _logError(...args) {
    if (this._logs) console.error("ChatGPTSessionApi:", ...args);
  }

  // ---- AE + Auth helpers ----
  _url(path) {
    return `${AE_CONFIG.chatUrl}${path}`;
  }

  async _ensureAccessToken() {
    if (this._accessToken) return this._accessToken;
    try {
      const res = await this.fetch(this._url("/api/auth/session"), {
        credentials: "include",
      });
      if (res.status === 429) this._throw("tooManyRequests");
      if (res.status === 403) this._throw("cloudflare");
      const j = await res.json().catch(() => ({}));
      this._accessToken = j?.accessToken || null;
      return this._accessToken;
    } catch (e) {
      return null;
    }
  }

  async _getDeviceId() {
    try {
      if (typeof chrome !== "undefined" && chrome?.cookies?.get) {
        const c = await chrome.cookies.get({
          url: AE_CONFIG.chatUrl,
          name: "oai-did",
        });
        return c?.value || undefined;
      }
    } catch {}
    return undefined;
  }

  async _fetchAuth(path, opts = {}) {
    const did = await this._getDeviceId();
    const headers = {
      "OAI-Device-Id": did,
      "OAI-Language": "en-US",
      ...(opts.headers || {}),
    };
    const payload = { ...opts, headers };
    if (payload.body && typeof payload.body !== "string")
      payload.body = JSON.stringify(payload.body);

    let res = await this.fetch(this._url(path), {
      ...payload,
      headers: {
        ...headers,
        ...(this._accessToken
          ? { Authorization: `Bearer ${this._accessToken}` }
          : {}),
      },
    });

    if (res.status === 401) {
      await this._ensureAccessToken();
      if (!this._accessToken) this._throw("badAccessToken");
      res = await this.fetch(this._url(path), {
        ...payload,
        headers: {
          ...headers,
          Authorization: `Bearer ${this._accessToken}`,
        },
      });
      if (res.status === 401) {
        this._accessToken = null;
        this._throw("badAccessToken");
      }
    }
    if (res.status === 403 || res.status === 418) this._throw("cloudflare");
    return res;
  }

  async _getScripts() {
    const now = Date.now();
    if (this._scriptsCache && this._scriptsCacheExpiresAt > now)
      return this._scriptsCache;
    try {
      const html = await this.fetch(AE_CONFIG.chatUrl).then((r) => r.text());
      const scripts = [...html.matchAll(/src="([^"]*)"/g)].map((m) => m[1]);
      this._scriptsCache = scripts.length ? scripts : [null];
    } catch {
      this._scriptsCache = [null];
    }
    this._scriptsCacheExpiresAt = now + 60 * 60 * 1000; // 1 hour
    return this._scriptsCache;
  }

  async _getDpl() {
    const scripts = await this._getScripts();
    const key = AE_CONFIG.pow.$dpl;
    for (const s of scripts) {
      try {
        const u = new URL(s);
        const v = u.searchParams.get(key);
        if (v) return `${key}=${v}`;
      } catch {}
    }
    return null;
  }

  async _generateProofToken({ seed, difficulty }) {
    const scripts = await this._getScripts();
    const dpl = await this._getDpl();
    const res = await BusController.call("ai.generateProofToken", {
      seed,
      difficulty,
      scripts,
      dpl,
    }).catch(() => null);
    if (!res) return null;
    return `${AE_CONFIG.pow.prefix}${res}`;
  }

  async _getRequirementsProofToken() {
    const now = Date.now();
    if (
      this._requirementsProofToken &&
      this._requirementsProofTokenExpiresAt > now
    )
      return this._requirementsProofToken;
    const token = await this._generateProofToken({
      seed: Math.random().toString(),
      difficulty: "0",
    });
    this._requirementsProofToken = token;
    this._requirementsProofTokenExpiresAt = now + 10 * 60 * 1000; // 10 minutes
    return token;
  }

  async _fetchRequirements(reqProof) {
    const url = AE_CONFIG.requirements?.url;
    if (!url) return null;
    const body = { [AE_CONFIG.requirements.$p]: reqProof };
    const headers = this._accessToken
      ? { Authorization: `Bearer ${this._accessToken}` }
      : undefined;
    try {
      const res = await this.fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      return await res.json();
    } catch (e) {
      this._logError("requirements fetch failed", e);
      return null;
    }
  }

  _get(obj, path, dflt = undefined) {
    try {
      return path
        .split(".")
        .reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
    } catch {
      return dflt;
    }
  }

  async _retrieveArkoseToken(dx) {
    try {
      return await BusController.call("ai.retrieveArkoseToken", {
        dx,
        config: AE_CONFIG,
        accessToken: this._accessToken,
      });
    } catch (e) {
      this._logError("arkose token retrieval failed", e);
      return null;
    }
  }

  async _injectAEHeaders(headers, requirements) {
    if (!requirements) return headers;
    // Sentinel token header
    const sentinelToken = this._get(
      requirements,
      AE_CONFIG.requirements.tokenPath
    );
    if (sentinelToken && AE_CONFIG.requirements.headerName) {
      headers[AE_CONFIG.requirements.headerName] = sentinelToken;
    }
    // PoW header
    const pow = requirements?.[AE_CONFIG.pow.$proofofwork];
    if (pow?.[AE_CONFIG.pow.$required]) {
      const seed = pow?.[AE_CONFIG.pow.$seed];
      const difficulty = pow?.[AE_CONFIG.pow.$difficulty];
      const token = await this._generateProofToken({ seed, difficulty });
      if (token) headers[AE_CONFIG.pow.headerName] = token;
    }
    // Arkose header
    const arkoseRequired = !!this._get(
      requirements,
      AE_CONFIG.requirements.arkoseRequiredPath
    );
    if (arkoseRequired) {
      const dx = this._get(requirements, AE_CONFIG.requirements.dxPath);
      const arkoseToken = await this._retrieveArkoseToken(dx);
      if (arkoseToken) headers[AE_CONFIG.headerName] = arkoseToken;
    }
    return headers;
  }

  _buildAskBody(prompt, { model, chatId, parentMessageId, attachments }) {
    const msgId =
      utils?.id?.uuid?.() ||
      crypto?.randomUUID?.() ||
      `${Date.now()}-${Math.random()}`;
    const parentId =
      parentMessageId ||
      utils?.id?.uuid?.() ||
      crypto?.randomUUID?.() ||
      `${Date.now()}-${Math.random()}`;
    const wsReqId =
      utils?.id?.uuid?.() ||
      crypto?.randomUUID?.() ||
      `${Date.now()}-${Math.random()}`;
    const baseMessage = {
      id: msgId,
      author: { role: "user" },
      content: {
        content_type: attachments?.length ? "multimodal_text" : "text",
        parts: attachments?.length ? [prompt] : [prompt],
      },
      metadata: {},
    };
    return {
      action: "next",
      messages: [baseMessage],
      model,
      parent_message_id: parentId,
      conversation_id: chatId || undefined,
      timezone_offset_min: new Date().getTimezoneOffset(),
      websocket_request_id: wsReqId,
      force_paragen: false,
      force_nulligen: false,
      force_rate_limit: false,
      force_paragen_model_slug: "",
      history_and_training_disabled: false,
      conversation_mode: { kind: "primary_assistant" },
    };
  }

  _splitSSE(buffer) {
    const lines = buffer.split("\n");
    const dataEvents = [];
    let remainder = "";
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === "") continue;
      if (line === "data: [DONE]") continue;
      if (line.startsWith("data: {")) dataEvents.push(line);
      else if (i === lines.length - 1) remainder = line; // incomplete JSON
    }
    return { dataEvents, remainder };
  }

  _parseSSEData(line) {
    try {
      const json = JSON.parse(line.replace("data: ", "").trim());
      if (json.error) return null;
      const msg = json.message;
      const conversationId = json.conversation_id || null;
      let text = "";
      let id = null;
      let finishDetails = null;
      if (msg) {
        id = msg.id || null;
        finishDetails = msg.metadata?.finish_details?.type || null;
        if (msg.author?.role === "assistant") {
          if (msg.content?.content_type === "text") {
            text = (msg.content?.parts || []).join("");
          } else if (msg.content?.content_type === "code") {
            text = `\n\n${msg.content?.text || ""}`;
          }
        }
      }
      return { text, id, finishDetails, conversationId };
    } catch {
      return null;
    }
  }

  async _safeJson(res) {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }
}

// =============================================================================
// CHATGPT PROVIDER CONTROLLER
// =============================================================================
export class ChatGPTProviderController {
  constructor(dependencies = {}) {
    this.initialized = false;
    this.api = new ChatGPTSessionApi(dependencies);
  }

  async init() {
    if (this.initialized) return;
    // Register Bus events for cross-context usage (optional parity with others)
    if (typeof BusController !== "undefined" && BusController.on) {
      BusController.on("chatgpt.ask", this._handleAskRequest.bind(this));
    }
    this.initialized = true;
  }

  async _handleAskRequest(payload) {
    return await this.api.ask(
      payload.prompt,
      payload.options || {},
      payload.onChunk || (() => {})
    );
  }

  // Public accessors/utilities
  get chatgptSession() {
    return this.api;
  }
  isOwnError(e) {
    return this.api.isOwnError(e);
  }
  // Optional availability check used by adapter.healthCheck()
  async isAvailable() {
    try {
      if (typeof BusController?.poll === "function") {
        // If Offscreen/oi pipeline is alive, this resolves quickly
        await BusController.poll("startup.oiReady");
      }
      return true;
    } catch (_) {
      return false;
    }
  }
}

// =============================================================================
// EXPORTS
// =============================================================================
export default ChatGPTProviderController;
if (typeof window !== "undefined") {
  window.HTOS = window.HTOS || {};
  window.HTOS.ChatGPTProvider = ChatGPTProviderController;
}
