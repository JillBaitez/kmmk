/**
 * HTOS BusController - Complete Implementation
 * Extracted from bg.refactored.non.stripped.js for standalone integration
 * 
 * This module provides the complete Bus communication system for inter-context messaging
 * in Chrome extensions, supporting background, content script, offscreen, popup, and iframe communication.
 */

// =============================================================================
// UTILITY DEPENDENCIES
// =============================================================================

const utils = {
  // Type checking utilities
  is: {
    null: (e) => e === null,
    defined: (e) => undefined !== e,
    undefined: (e) => undefined === e,
    nil: (e) => e == null,
    boolean: (e) => typeof e == 'boolean',
    number: (e) => typeof e == 'number',
    string: (e) => typeof e == 'string',
    symbol: (e) => typeof e == 'symbol',
    function: (e) => typeof e == 'function',
    map: (e) => e instanceof Map,
    set: (e) => e instanceof Set,
    url: (e) => e instanceof URL,
    blob: (e) => e instanceof Blob,
    file: (e) => e instanceof File,
    error: (e) => e instanceof Error,
    regexp: (e) => e instanceof RegExp,
    array: (e) => Array.isArray(e),
    object: (e) => Object.prototype.toString.call(e) === '[object Object]',
    nan: (e) => Number.isNaN(e),
    nonPrimitive: (e) => utils.is.object(e) || utils.is.array(e),
    numeric: (e) => !utils.is.nan(Number(e)),
    empty: (e) =>
      !!utils.is.nil(e) ||
      (utils.is.array(e)
        ? e.length === 0
        : utils.is.object(e)
          ? Object.keys(e).length === 0
          : !!utils.is.string(e) && e.trim().length === 0),
  },

  // Async sleep utility
  sleep: async (e) =>
    new Promise((t) => {
      setTimeout(t, e);
    }),

  // Array unique utility
  unique: (e) => Array.from(new Set(e)),

  // Wait for condition with timeout
  waitFor: async (
    e,
    { interval: n = 100, timeout: a = 60000 } = {}
  ) => {
    if (a <= 0) throw new Error('$utils.waitFor: timeout exceeded');
    const o = Date.now(),
      i = await e();
    if (i) return i;
    await utils.sleep(n);
    const r = Date.now() - o;
    return utils.waitFor(e, {
      interval: n,
      timeout: a - r,
    });
  },

  // Object URL utilities
  objectUrl: {
    create(e, a = !1) {
      if (!URL.createObjectURL) {
        // Fallback for environments without URL.createObjectURL
        console.warn('URL.createObjectURL not available');
        return null;
      }
      const o = URL.createObjectURL(e);
      if (a) {
        const timeout = utils.is.number(a) ? a : 60000;
        setTimeout(() => URL.revokeObjectURL(o), timeout);
      }
      return o;
    },
    revoke(e) {
      if (!URL.revokeObjectURL) {
        console.warn('URL.revokeObjectURL not available');
        return;
      }
      URL.revokeObjectURL(e);
    },
  },
};

// =============================================================================
// ENVIRONMENT DETECTION
// =============================================================================

const env = {
  getLocus: () => {
    const { protocol: e, host: t, pathname: n, href: a } = location;
    return a === 'https://HTOS.ai/oi' || a === 'http://localhost:3000/oi'
      ? 'oi'
      : e !== 'chrome-extension:' && chrome?.runtime?.getURL
        ? 'cs'
        : t === 'localhost:3050'
          ? 'fg'
          : e !== 'chrome-extension:'
            ? 'nj'
            : n === '/HTOS.html'
              ? 'pp'
              : n === '/offscreen.html'
                ? 'os'
                : 'bg';
  },
};

// =============================================================================
// MOCK DATA CONTEXT
// =============================================================================

const data = {
  name: 'htos', // Updated from 'HTOS1'
};

// =============================================================================
// MAIN BUS CONTROLLER IMPLEMENTATION
// =============================================================================

const BusController = {
  async init() {
    // Bind public API methods
    this.on = this.on.bind(this);
    this.off = this.off.bind(this);
    this.once = this.once.bind(this);
    this.send = this._wrapThrowIfError(this.send);
    this.call = this._wrapThrowIfError(this.call);
    this.poll = this.poll.bind(this);
    this.getTabId = this.getTabId.bind(this);

    // Initialize context-specific properties
    this._locus = env.getLocus();
    this._serialize = this._serialize.bind(this);
    this._handlers = {};

    // Context-specific initialization
    if (this._is('pp')) {
      this._setupPp();
      this._tabId = await this.getTabId();
    } else if (this._is('bg')) {
      this._blobs = {};
      this._channel = new BroadcastChannel('bus.channel');
      this._setupBg();
    } else if (this._is('cs')) {
      await this._setupCs();
    } else if (this._is('nj')) {
      this._setupNj();
    } else if (this._is('os')) {
      this.setIframe = (e) => (this._iframe = e);
      this._iframe = null;
      this._channel = new BroadcastChannel('bus.channel');
      this._setupOs();
    } else if (this._is('oi')) {
      this._setupOi();
    }
  },

  // =============================================================================
  // PUBLIC API METHODS
  // =============================================================================

  on(e, t, n = null) {
    this._on(e, null, t, n);
  },

  off(e, t = null) {
    this._off(e, null, t);
  },

  once(e, t) {
    const n = async (...a) => (this.off(e, n), await t(...a));
    this.on(e, n);
  },

  async send(e, ...n) {
    if (utils.is.numeric(e)) {
      const t = Number(e);
      return (
        (e = n[0]),
        (n = n.slice(1)),
        await this._pick([
          this._sendToCs(t, e, ...n),
          this._sendToExt(t, e, ...n),
        ])
      );
    }

    if (this._is('pp')) return await this._sendToExt(e, ...n);
    if (this._is('nj')) return await this._sendToPage(e, ...n);
    if (this._is('oi')) return await this._sendToParent(e, ...n);
    
    if (this._is('bg', 'cs', 'os'))
      return await this._pick([
        this._sendToExt(e, ...n),
        this._callHandlers(
          {
            name: e,
            args: n,
          },
          (e) => e.proxy
        ),
      ]);
    
    if (this._is('fg')) {
      if (e === 'store.actions') return;
      if (e === 'idb.change') return;
      console.log('Bus log:', e, ...n);
    }
  },

  async call(e, ...t) {
    return this._callHandlers(
      {
        name: e,
        args: t,
      },
      (e) => !e.proxy
    );
  },

  async poll(e, ...t) {
    return await utils.waitFor(() => this.send(e, ...t));
  },

  async getTabId() {
    if (this._is('bg')) return null;
    if (this._is('pp')) {
      const tabId = new URL(location.href).searchParams.get('tabId');
      if (tabId) return Number(tabId);
    }
    const { tabId: e } = await this.send('bus.getTabData');
    return e;
  },

  // =============================================================================
  // INTERNAL HANDLER MANAGEMENT
  // =============================================================================

  _on(e, t, n, a = null) {
    (this._handlers[e] || (this._handlers[e] = []),
      this._is('cs', 'nj', 'oi') &&
        this._handlers[e].length === 0 &&
        this._sendToProxier('bus.proxy', e, !0));
    
    const o = {
      fn: n,
      name: e,
    };
    (t && (o.proxy = t), a && (o.this = a), this._handlers[e].push(o));
  },

  _off(e, t = null, n = null) {
    if (!this._handlers[e]) return;
    
    this._handlers[e] = this._handlers[e].filter((e) => {
      const a = !n || n === e.fn,
        o = t === (e.proxy || null);
      return !a || !o;
    });
    
    if (this._handlers[e].length === 0) {
      delete this._handlers[e];
      if (this._is('cs', 'nj', 'oi')) {
        this._sendToProxier('bus.proxy', e, !1);
      }
    }
  },

  // =============================================================================
  // CONTEXT-SPECIFIC SETUP METHODS
  // =============================================================================

  _setupPp() {
    // Popup setup - minimal implementation
  },

  _setupBg() {
    // Background script setup
    console.log('[BusController] Setting up Service Worker (bg) listeners.');
    // For blob handling with OS
    this._channel = new BroadcastChannel('htos-bus-channel');

    chrome.runtime.onMessage.addListener((e, t, n) => {
      if (!this._isBusMsg(e)) return true;
      
      // Special handler for the offscreen ping. Acknowledge it immediately.
      if (e.name === 'startup.oiReady' || e.name === 'startup.0iReady') {
        console.log('[BusController-bg] Acknowledging offscreen ping from:', t.url);
        n({ ok: true });
        return true; // Required to indicate an async response
      }
      
      const a = t.tab?.id || null;
      
      if (e.name === 'bus.proxy') {
        return void (async () => {
          const [t, n2] = await this._deserialize(e.argsStr);
          if (!a) return;
          const o = `cs-${a}`;
          n2
            ? this._on(t, o, (...e2) => this._sendToCs(a, t, ...e2))
            : this._off(t, o);
        })();
      }
      
      if (e.name === 'bus.removeCsProxies') {
        return void this._removeProxyHandlers(`cs-${a}`);
      }
      
      if (e.name === 'bus.getTabData') {
        const windowId = t.tab?.windowId || null;
        return (
          n(
            this._serialize({
              tabId: a,
              windowId: windowId,
            })
          ),
          !0
        );
      }
      
      if (e.name === 'bus.sendToCs') {
        return (
          (async () => {
            const t2 = await this._deserialize(e.argsStr),
              a2 = await this._sendToCs(...t2);
            n(this._serialize(a2));
          })(),
          !0
        );
      }
      
      if (e.name === 'bus.blobIdToObjectUrl') {
        return (
          (async () => {
            const [t3] = await this._deserialize(e.argsStr),
              a3 = await this._blobIdToObjectUrl(t3);
            n(this._serialize(a3));
          })(),
          !0
        );
      }
      
      const o = this._callHandlers(e, (e2) => e2.proxy !== `cs-${a}`);
      return o ? (o.then(this._serialize).then(n), !0) : undefined;
    });
    
    chrome.tabs.onRemoved.addListener((e) => {
      this._removeProxyHandlers(`cs-${e}`);
    });
  },

  async _setupCs() {
    // Content script setup - minimal implementation
  },

  _setupNj() {
    // Injected script setup - minimal implementation
  },

  _setupOs() {
    console.log('[BusController] Setting up Offscreen (os) listeners.');

    // Relay messages from child iframe (0i.js) UP to the service worker
    window.addEventListener('message', (event) => {
      if (!this._isBusMsg(event.data) || event.source !== this._iframe?.contentWindow) return;
      const message = event.data;
      console.log('[BusController-os] Received message from iframe, forwarding to SW:', message.name);
      this.send(message.name, ...(message.args || []));
    });

    // Relay messages from the service worker DOWN to the child iframe (0i.js)
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!this._isBusMsg(message)) return true;

      if (this._iframe && this._iframe.contentWindow) {
        const requestId = this._generateId();
        message.reqId = requestId;

        const responseHandler = async (event) => {
          if (event.source === this._iframe.contentWindow && event.data?.resId === requestId) {
            window.removeEventListener('message', responseHandler);
            const deserialized = await this._deserialize(event.data.result);
            sendResponse(deserialized);
          }
        };
        window.addEventListener('message', responseHandler);

        this._iframe.contentWindow.postMessage(message, '*');
      }
      return true; // keep channel open for async response
    });
  },

  _setupOi() {
    console.log('[BusController] Setting up Offscreen Iframe (oi/0i) listeners.');
    
    // Listen for messages from the parent window (os.js)
    window.addEventListener('message', async (event) => {
      // We only care about bus messages from our direct parent
      if (!this._isBusMsg(event.data) || event.source !== window.parent) return;
      
      const message = event.data;
      console.log('[BusController-oi] Received message from parent:', message.name);

      // Handle the message using the generic handler
      const result = await this._callHandlers(message);

      // If the message had a request ID, send a formatted response back to the parent
      if (message.reqId && window.parent) {
        window.parent.postMessage({
          ...this._createBusMsg({}), // creates {$bus: true, appName: 'htos'}
          resId: message.reqId,
          result: this._serialize(result)
        }, '*');
      }
    });
  },

  // =============================================================================
  // MESSAGE TRANSPORT METHODS
  // =============================================================================

  async _sendToExt(e, ...n) {
    let o = null;
    utils.is.numeric(e) &&
      ((o = Number(e)), (e = n[0]), (n = n.slice(1)));
    
    const i = this._serialize(n),
      r = this._createBusMsg({
        name: e,
        argsStr: i,
        target: o,
      }),
      s = await new Promise((e) => {
        try {
          chrome.runtime.sendMessage(r, (t) => {
            chrome.runtime.lastError ? e(null) : e(t);
          });
        } catch (n) {
          if (n.message === 'Extension context invalidated.') return;
          console.error('Bus error:', n);
          e(null);
        }
      });
    
    return await this._deserialize(s);
  },

  async _sendToCs(e, t, ...n) {
    if (!chrome.tabs?.sendMessage)
      return await this.send('bus.sendToCs', e, t, ...n);
    
    const a = this._serialize(n),
      o = this._createBusMsg({
        name: t,
        argsStr: a,
        target: 'cs',
      }),
      i = await new Promise((t) => {
        chrome.tabs.sendMessage(e, o, (e) => {
          chrome.runtime.lastError ? t(null) : t(e);
        });
      });
    
    return await this._deserialize(i);
  },

  async _sendToPage(e, ...t) {
    const n = this._generateId(),
      a = this._createBusMsg({
        name: e,
        args: t,
        reqId: n,
        locus: this._locus,
      });
    
    return (
      window.postMessage(a, '*'),
      await this._waitForResponseMessage(n)
    );
  },

  async _sendToIframe(e, ...t) {
    if (!this._iframe) return null;
    
    const n = this._generateId(),
      a = this._createBusMsg({
        name: e,
        args: t,
        reqId: n,
      });
    
    return (
      this._iframe.contentWindow.postMessage(a, '*'),
      await this._waitForResponseMessage(n)
    );
  },

  async _sendToParent(e, ...t) {
    const n = this._generateId(),
      a = this._createBusMsg({
        name: e,
        args: t,
        reqId: n,
      });
    
    return (
      parent.postMessage(a, '*'),
      await this._waitForResponseMessage(n)
    );
  },

  async _sendToProxier(e, ...t) {
    return this._is('cs')
      ? await this._sendToExt(e, ...t)
      : this._is('nj')
        ? await this._sendToPage(e, ...t)
        : this._is('oi')
          ? await this._sendToParent(e, ...t)
          : undefined;
  },

  // =============================================================================
  // SERIALIZATION & BLOB HANDLING
  // =============================================================================

  _serialize(e) {
    return utils.is.nil(e)
      ? null
      : JSON.stringify(e, (e, t) => {
          if (utils.is.blob(t)) {
            if (this._is('bg')) {
              const newId = this._generateId();
              return ((this._blobs[newId] = t), `bus.blob.${newId}`);
            }
            return `bus.blob.${utils.objectUrl.create(t, !0)}`;
          }
          return utils.is.error(t) ? `bus.error.${t.message}` : t;
        });
  },

  async _deserialize(e) {
    if (!utils.is.string(e)) return null;
    
    const t = new Map(),
      n = JSON.parse(e, (e, n) => {
        const o = utils.is.string(n);
        return o && n.startsWith('bus.blob.')
          ? (t.set(n, n.slice('bus.blob.'.length)), n)
          : o && n.startsWith('bus.error.')
            ? new Error(n.slice('bus.error.'.length))
            : n;
      });
    
    await Promise.all(
      [...t.keys()].map(async (e) => {
        let n;
        const a = t.get(e);
        n = a.startsWith('blob:')
          ? a
          : await this._sendToExt('bus.blobIdToObjectUrl', a);
        const o = await fetch(n).then((e) => e.blob());
        t.set(e, o);
      })
    );
    
    return this._applyBlobs(n, t);
  },

  _applyBlobs(e, t) {
    if (t.has(e)) return t.get(e);
    if (utils.is.array(e) || utils.is.object(e))
      for (const n in e) e[n] = this._applyBlobs(e[n], t);
    return e;
  },

  async _blobIdToObjectUrl(e) {
    const t = this._blobs[e];
    let n;
    
    if (utils.is.string(t)) {
      n = t;
    } else {
      n = await this._blobToObjectUrl(t);
      this._blobs[e] = n;
    }
    
    setTimeout(() => delete this._blobs[e], 60000);
    return n;
  },

  async _blobToObjectUrl(e) {
    const t = this._generateId();
    
    this._channel.postMessage({
      reqId: t,
      blob: e,
    });
    
    return await new Promise((e) => {
      const n = ({ data: a }) => {
        if (!a || a.resId !== t) return;
        this._channel.removeEventListener('message', n);
        e(a.objectUrl);
      };
      this._channel.addEventListener('message', n);
    });
  },

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  _waitForResponseMessage: async (e) =>
    await new Promise((t) => {
      const n = ({ data: a }) => {
        if (!a || a.resId !== e) return;
        window.removeEventListener('message', n);
        t(a.result);
      };
      window.addEventListener('message', n);
    }),

  _callHandlers({ name: e, args: n, argsStr: a }, o = null) {
    let i = this._handlers[e];
    if (!i) return null;
    
    if (o) {
      i = i.filter(o);
    }
    
    if (i.length === 0) return null;
    
    return new Promise(async (e) => {
      if (a) {
        n = await this._deserialize(a);
      }
      
      e(
        await this._pick(
          i.map(async (e) => {
            try {
              return await e.fn.call(e.this, ...n);
            } catch (n) {
              console.error(`Failed to handle "${e.name}":`, n);
              return n;
            }
          })
        )
      );
    });
  },

  _removeProxyHandlers(e) {
    Object.keys(this._handlers).forEach((t) => {
      this._handlers[t] = this._handlers[t].filter(
        (t) => t.proxy !== e
      );
      if (this._handlers[t].length === 0) {
        delete this._handlers[t];
      }
    });
  },

  _is(...e) {
    return e.includes(this._locus);
  },

  _isBusMsg: (t) => t && t.$bus && t.appName === data.name,

  _createBusMsg: (t) => ({
    $bus: !0,
    appName: data.name,
    ...t,
  }),

  _generateId: () =>
    `bus-${Date.now()}-${Math.random().toString(36).slice(2)}`,

  _wrapThrowIfError(e) {
    return async (...t) => {
      const n = await e.call(this, ...t);
      if (utils.is.error(n)) throw n;
      return n;
    };
  },

  _pick: async (e = []) =>
    e.length === 0
      ? null
      : await new Promise((t) => {
          let n = 0;
          e.forEach(async (o) => {
            const i = await o;
            return utils.is.nil(i)
              ? n === e.length - 1
                ? t(null)
                : void n++
              : t(i);
          });
        }),
};

// =============================================================================
// EXPORT
// =============================================================================

// For ES6 modules
export { BusController, utils, env };



// For global browser usage
if (typeof window !== 'undefined') {
  window.HTOSBusController = BusController;
  window.HTOSBusUtils = utils;
  window.HTOSEnv = env;
}