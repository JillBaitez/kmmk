/**
 * HTOS Arkose Solver Script
 * Adapted from oi.js for HTOS architecture
 * Handles proof-of-work generation and Arkose challenge solving
 */

// Global HTOS application object for solver environment
const htosApp = {
  name: 'htos-solver',
  version: '1.0.0',
  $env: {},
  $utils: {},
  $bus: {},
  $ai: {},
  $startup: {},
  $hashWasm: {}
};

// Make globally available
window.__htos_global = htosApp;
window.htosApp = htosApp;

// Utility functions
(() => {
  const { $utils: utils } = htosApp;
  
  utils.createPromise = () => {
    let resolve = null, reject = null;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    Object.defineProperty(promise, 'resolve', { get: () => resolve });
    Object.defineProperty(promise, 'reject', { get: () => reject });
    return promise;
  };
  
  utils.is = {
    null: (value) => value === null,
    defined: (value) => undefined !== value,
    undefined: (value) => undefined === value,
    nil: (value) => value == null,
    boolean: (value) => typeof value === 'boolean',
    number: (value) => typeof value === 'number',
    string: (value) => typeof value === 'string',
    function: (value) => typeof value === 'function',
    error: (value) => value instanceof Error,
    numeric: (value) => !isNaN(parseFloat(value)) && isFinite(value)
  };
  
  utils.waitFor = async (condition, timeout = 30000, interval = 100) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        const result = await condition();
        if (result) return result;
      } catch (e) {
        // Continue waiting
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    throw new Error('Timeout waiting for condition');
  };
})();

// Async helper for generator functions
function asyncHelper(thisArg, _arguments, P, generator) {
  function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
  return new (P || (P = Promise))(function (resolve, reject) {
    function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
    function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
    function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
}

// Mutex implementation for WASM operations
class Mutex {
  constructor() {
    this._locked = false;
    this._waiting = [];
  }
  
  lock() {
    return new Promise((resolve) => {
      if (!this._locked) {
        this._locked = true;
        resolve(() => this._unlock());
      } else {
        this._waiting.push(resolve);
      }
    });
  }
  
  dispatch(fn) {
    return this.lock().then(release => {
      try {
        return fn();
      } finally {
        release();
      }
    });
  }
  
  _unlock() {
    if (this._waiting.length > 0) {
      const next = this._waiting.shift();
      next(() => this._unlock());
    } else {
      this._locked = false;
    }
  }
}

// WASM Hasher Implementation
(() => {
  const BufferPolyfill = null;
  const TextEncoderPolyfill = new TextEncoder();
  
  const hexCharOffsetA = 'a'.charCodeAt(0) - 10;
  const hexCharOffset0 = '0'.charCodeAt(0);
  
  function bytesToHexString(destArray, sourceBytes, byteLength) {
    let destIndex = 0;
    for (let i = 0; i < byteLength; i++) {
      let nibble = sourceBytes[i] >>> 4;
      destArray[destIndex++] = nibble > 9 ? nibble + hexCharOffsetA : nibble + hexCharOffset0;
      nibble = 15 & sourceBytes[i];
      destArray[destIndex++] = nibble > 9 ? nibble + hexCharOffsetA : nibble + hexCharOffset0;
    }
    return String.fromCharCode.apply(null, destArray);
  }
  
  const toUint8Array = (data) => {
    if (typeof data === 'string') {
      return TextEncoderPolyfill.encode(data);
    }
    if (ArrayBuffer.isView(data)) {
      return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    }
    throw new Error('Invalid data type!');
  };
  
  const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const base64DecodeTable = new Uint8Array(256);
  for (let i = 0; i < BASE64_CHARS.length; i++) {
    base64DecodeTable[BASE64_CHARS.charCodeAt(i)] = i;
  }
  
  function base64ToUint8Array(base64String) {
    const outputLength = (() => {
      let len = Math.floor(0.75 * base64String.length);
      const originalLength = base64String.length;
      if (base64String[originalLength - 1] === '=') {
        len -= 1;
        if (base64String[originalLength - 2] === '=') {
          len -= 1;
        }
      }
      return len;
    })();
    
    const stringLength = base64String.length;
    const destArray = new Uint8Array(outputLength);
    let destIndex = 0;
    
    for (let i = 0; i < stringLength; i += 4) {
      const b1 = base64DecodeTable[base64String.charCodeAt(i)];
      const b2 = base64DecodeTable[base64String.charCodeAt(i + 1)];
      const b3 = base64DecodeTable[base64String.charCodeAt(i + 2)];
      const b4 = base64DecodeTable[base64String.charCodeAt(i + 3)];
      
      destArray[destIndex] = (b1 << 2) | (b2 >> 4);
      destIndex += 1;
      destArray[destIndex] = ((15 & b2) << 4) | (b3 >> 2);
      destIndex += 1;
      destArray[destIndex] = ((3 & b3) << 6) | (63 & b4);
      destIndex += 1;
    }
    
    return destArray;
  }
  
  const WASM_MEMORY_CHUNK_SIZE = 16384;
  const wasmMutex = new Mutex();
  const wasmModuleCache = new Map();
  
  function createWasmHasher(wasmConfig, hashLength) {
    return asyncHelper(this, undefined, undefined, function* () {
      let wasmInstance = null;
      let wasmMemoryView = null;
      let isInitialized = false;
      
      if (typeof WebAssembly === 'undefined') {
        throw new Error('WebAssembly is not supported in this environment!');
      }
      
      const getStateSize = () => new DataView(wasmInstance.exports.memory.buffer)
        .getUint32(wasmInstance.exports.STATE_SIZE, true);
      
      const instantiatePromise = wasmMutex.dispatch(() => asyncHelper(this, undefined, undefined, function* () {
        if (!wasmModuleCache.has(wasmConfig.name)) {
          const wasmBinary = base64ToUint8Array(wasmConfig.data);
          const compiledModule = WebAssembly.compile(wasmBinary);
          wasmModuleCache.set(wasmConfig.name, compiledModule);
        }
        const modulePromise = yield wasmModuleCache.get(wasmConfig.name);
        wasmInstance = yield WebAssembly.instantiate(modulePromise, {});
      }));
      
      const initHash = (seed = null) => {
        isInitialized = true;
        wasmInstance.exports.Hash_Init(seed);
      };
      
      const updateHash = (data) => {
        if (!isInitialized) throw new Error('update() called before init()');
        const dataBytes = toUint8Array(data);
        let offset = 0;
        while (offset < dataBytes.length) {
          const chunk = dataBytes.subarray(offset, offset + WASM_MEMORY_CHUNK_SIZE);
          offset += chunk.length;
          wasmMemoryView.set(chunk);
          wasmInstance.exports.Hash_Update(chunk.length);
        }
      };
      
      const hexDigestBuffer = new Uint8Array(2 * hashLength);
      const digestHash = (format, finalData = null) => {
        if (!isInitialized) throw new Error('digest() called before init()');
        isInitialized = false;
        wasmInstance.exports.Hash_Final(finalData);
        return format === 'binary' 
          ? wasmMemoryView.slice(0, hashLength)
          : bytesToHexString(hexDigestBuffer, wasmMemoryView, hashLength);
      };
      
      const isSmallData = (data) => typeof data === 'string' 
        ? data.length < 4096 
        : data.byteLength < WASM_MEMORY_CHUNK_SIZE;
      
      let canCalculateInOneShot = isSmallData;
      
      yield (() => asyncHelper(this, undefined, undefined, function* () {
        if (!wasmInstance) yield instantiatePromise;
        const bufferAddress = wasmInstance.exports.Hash_GetBuffer();
        const memoryBuffer = wasmInstance.exports.memory.buffer;
        wasmMemoryView = new Uint8Array(memoryBuffer, bufferAddress, WASM_MEMORY_CHUNK_SIZE);
      }))();
      
      return {
        getMemory: () => wasmMemoryView,
        writeMemory: (data, offset = 0) => wasmMemoryView.set(data, offset),
        getExports: () => wasmInstance.exports,
        setMemorySize: (newSize) => {
          wasmInstance.exports.Hash_SetMemorySize(newSize);
          const bufferAddress = wasmInstance.exports.Hash_GetBuffer();
          const memoryBuffer = wasmInstance.exports.memory.buffer;
          wasmMemoryView = new Uint8Array(memoryBuffer, bufferAddress, newSize);
        },
        init: initHash,
        update: updateHash,
        digest: digestHash,
        calculate: (data, key = null, salt = null) => {
          if (!canCalculateInOneShot(data, key)) {
            initHash(key);
            updateHash(data);
            return digestHash('hex', salt);
          }
          const dataBytes = toUint8Array(data);
          wasmMemoryView.set(dataBytes);
          wasmInstance.exports.Hash_Calculate(dataBytes.length, key, salt);
          return bytesToHexString(hexDigestBuffer, wasmMemoryView, hashLength);
        },
        hashLength: hashLength
      };
    });
  }
  
  // SHA3 WASM configuration
  const sha3WasmConfig = {
    name: 'sha3',
    data: 'AGFzbQEAAAABFARgAAF/YAF/AGACf38AYAN/f38AAwgHAAEBAgEAAwUEAQECAgYOAn8BQZCNBQt/AEGACAsHcAgGbWVtb3J5AgAOSGFzaF9HZXRCdWZmZXIAAAlIYXNoX0luaXQAAQtIYXNoX1VwZGF0ZQACCkhhc2hfRmluYWwABA1IYXNoX0dldFN0YXRlAAUOSGFzaF9DYWxjdWxhdGUABgpTVEFURV9TSVpFAwEKqBwHBQBBgAoL1wMAQQBCADcDgI0BQQBCADcD+IwBQQBCADcD8IwBQQBCADcD6IwBQQBCADcD4IwBQQBCADcD2IwBQQBCADcDoiwBQQBCADcDyIwBQQBCADcDwIwBQQBCADcDuIwBQQBCADcDsIwBQQBCADcDqIwBQQBCADcDoIwBQQBCADcDmIwBQQBCADcDkIwBQQBCADcDiIwBQQBCADcDgIwBQQBCADcD+IsBQQBCADcD8IsBQQBCADcD6IsBQQBCADcD4IsBQQBCADcD2IsBQQBCADcDoisBQQBCADcDyIsBQQBCADcDwIsBQQBCADcDuIsBQQBCADcDsIsBQQBCADcDqIsBQQBCADcDoIsBQQBCADcDmIsBQQBCADcDkIsBQQBCADcDiIsBQQBCADcDgIsBQQBCADcD+IoBQQBCADcD8IoBQQBCADcD6IoBQQBCADcD4IoBQQBCADcD2IoBQQBCADcDoioBQQBCADcDyIoBQQBCADcDwIoBQQBCADcDuIoBQQBCADcDsIoBQQBCADcDqIoBQQBCADcDoIoBQQBCADcDmIoBQQBCADcDkIoBQQBCADcDiIoBQQBCADcDgIoBQQBBwAwgAEEBdGtBA3Y2AoyNAUEAQQA2AoiNAQuMAwEIfwJAQQAoAoiNASIBQQBIDQBBACABIABqQQAoAoyNASICcDYCiI0BAkACQCABDQBBgAohAwwBCwJAIAIgAWsiBCAAIAQgAEkbIgNFDQAgA0EDcSEFQQAhBgJAIANBBEkNACABQYCKAWohByADQXxxIQhBACEGA0AgByAGaiIDQcgBaiAGQYAKai0AADoAACADQckBaiAGQYEKai0AADoAACADQcoBaiAGQYIKai0AADoAACADQcsBaiAGQYMKai0AADoAACAIIAZBBGoiBkcNAAsLIAVFDQAgAUHIiwFqIQMDQCADIAZqIAZBgApqLQAAOgAAIAZBAWohBiAFQX9qIgUNAAsLIAQgAEsNAUHIiwEgAhADIAAgBGshACAEQYAKaiEDCwJAIAAgAkkNAANAIAMgAhADIAMgAmohAyAAIAJrIgAgAk8NAAsLIABFDQBBACECQcgBIQYDQCAGQYCKAWogAyAGakG4fmotAAA6AAAgBkEBaiEGIAAgAkEBaiICQf8BcUsNAAsLC+QLAS1+IAApA0AhAkEAKQPAigEhAyAAKQM4IQRBACkDuIoBIQUgACkDMCEGQQApA7CKASEHIAApAyghCEEAKQOoigEhCSAAKQMgIQpBACkDoIoBIQsgACkDGCEMQQApA5iKASENIAApAxAhDkEAKQOQigEhDyAAKQMIIRBBACkDiIoBIREgACkDACESQQApA4CKASETQQApA8iKASEUAkACQCABQcgASw0AQQApA9CKASEVQQApA+CKASEWQQApA9iKASEXDAELQQApA+CKASAAKQNghSEWQQApA9iKASAAKQNYhSEXQQApA9CKASAAKQNQhSEVIBQgACkDSIUhFCABQekASQ0AQQBBACkD6IoBIAApA2iFNwPoigFBAEEAKQPwigEgACkDcIU3A/CKAUEAQQApA/iKASAAKQN4hTcD+IoBQQBBACkDgIsBIAApA4ABhTcDgIsBIAFBiQFJDQBBAEEAKQOIiwEgACkDiAGFNwOIiwELIAMgAoUhGCAFIASFIRkgByAGhSEHIAkgCIUhCCALIAqFIRogDSAMhSEJIA8gDoUhCiARIBCFIQsgEyAShSEMQQApA7iLASESQQApA5CLASETQQApA+iKASEbQQApA6CLASEcQQApA/iKASENQQApA7CLASEdQQApA4iLASEOQQApA8CLASEPQQApA5iLASEeQQApA/CKASEQQQApA6iLASERQQApA4CLASEfQcB+IQADQCAaIAcgC4UgF4UgH4UgEYVCAYmFIBSFIBCFIB6FIA+FIQIgDCAZIAqFIBaFIA6FIB2FQgGJhSAIhSAVhSANhSAchSIDIAeFISAgCSAIIAyFIBWFIA2FIByFQgGJhSAYhSAbhSAThSAShSIEIA+FISEgGCAKIBQgGoUgEIUgHoUgD4VCAYmFIBmFIBaFIA6FIB2FIgWFQjeJIiIgCyAYIAmFIBuFIBOFIBKFQgGJhSAHhSAXhSAfhSARhSIGIAqFQj6JIiNCf4WDIAMgEYVCAokiJIUhDyANIAKFQimJIiUgBCAQhUIniSImQn+FgyAihSERIBIgBYVCOIkiEiAGIA6FQg+JIidCf4WDIAMgF4VCCokiKIUhDiAEIBqFQhuJIikgKCAIIAKFQiSJIipCf4WDhSENIAYgGYVCBokiKyADIAuFQgGJIixCf4WDIBwgAoVCEokiLYUhECArIAQgHoVCCIkiLiAbIAWFQhmJIhtCf4WDhSEXIAYgHYVCPYkiGSAEIBSFQhSJIgQgCSAFhUIciSIIQn+Fg4UhFCAIIBlCf4WDIAMgH4VCLYkiA4UhGCAZIANCf4WDIBSgAoVCA4kiCYUhGSAEIAMgCUJ/hYOFIQcgCSAEQn+FgyAIhSEIIAwgAoUiAiAhQg6JIgNCf4WDIBMgBYVCFYkiBIUhCSAGIBaFQiuJIgUgAyAEQn+Fg4UhCiAEIAVCf4WDICBCLIkiBIUhCyAAQdAJaikDACAFIARCf4WDhSAChSEMICcgKEJ/hYMgKoUiBSEfIAMgBCACQn+Fg4UiAiEaICogKUJ/hYMgEoUiAyEeIC0gLkJ/hYMgG4UiBCEWICYgJCAlQn+Fg4UiBiEdIBsgK0J/hYMgLIUiKCEVICMgJiAiQn+Fg4UiIiEcIC4gLCAtQn+Fg4UiJiEbICcgKSASQn+Fg4UiJyETICMgJEJ/hYMgJYUiIyESIABBCGoiAA0AC0EAIBE3A6iLAUEAIAU3A4CLAUEAIBc3A9iKAUEAIAc3A7CKAUEAIAs3A4iKAUEAIA83A8CLAUEAIAM3A5iLAUEAIBA3A/CKAUEAIBQ3A8iKAUEAIAI3A6CKAUEAIAI3A7CLAUEAIA43A4iLAUEAIAQ3A+CKAUEAIBk3A7iKAUEAIAo3A5CKAUEAICI3A6CLAUEAIA03A/iKAUEAICg3A9CKAUEAIAg3A6iKAUEAIAw3A4CKAUEAICM3A7iLAUEAICc3A5CLAUEAICY3A+iKAUEAIBg3A8CKAUEAIAk3A5iKAQv4AgEFf0HkAEEAKAKMjQEiAUEBdmshAgJAQQAoAoiNASIDQQBIDQAgASEEAkAgASADRg0AIANByIsBaiEFQQAhAwNAIAUgA2pBADoAACADQQFqIgMgAUEAKAKIjQEiBGtJDQALCyAEQciLAWoiAyADLQAAIAByOgAAIAFBx4sBaiIDIAMtAABBgAFyOgAAQciLASABEANBAEGAgICAeDYCiI0BCwJAIAJBBEkNACACQQJ2IgNBA3EhBUEAIQQCQCADQX9qQQNJDQAgA0H8////A3EhAUEAIQNBACEEA0AgA0GACmogA0GAigFqKAIANgIAIANBhApqIANBhIoBaigCADYCACADQYgKaiADQYiKAWooAgA2AgAgA0GMCmogA0GMigFqKAIANgIAIANBEGohAyABIARBBGoiBEcNAAsLIAVFDQAgBUECdCEBIARBAnQhAwNAIANBgApqIANBgIoBaigCADYCACADQQRqIQMgAUF8aiIBDQALCwsGAEGAigEL0QYBA39BAEIANwOAjQFBAEIANwP4jAFBAEIANwPwjAFBAEIANwPojAFBAEIANwPgjAFBAEIANwPYjAFBAEIANwPQjAFBAEIANwPIjAFBAEIANwPAjAFBAEIANwO4jAFBAEIANwOwjAFBAEIANwOojAFBAEIANwOgjAFBAEIANwOYjAFBAEIANwOQjAFBAEIANwOIjAFBAEIANwOAjAFBAEIANwPiwFBAEIANwPwiwFBAEIANwPoiwFBAEIANwPgiwFBAEIANwPYiwFBAEIANwPQiwFBAEIANwPIiwFBAEIANwPAiwFBAEIANwO4iwFBAEIANwOwiwFBAEIANwOoiwFBAEIANwOgiwFBAEIANwOYiwFBAEIANwOQiwFBAEIANwOIiwFBAEIANwOAiwFBAEIANwP4igFBAEIANwPwigFBAEIANwPoigFBAEIANwPgigFBAEIANwPYigFBAEIANwPQigFBAEIANwPIigFBAEIANwPAigFBAEIANwO4igFBAEIANwOwigFBAEIANwOoigFBAEIANwOgigFBAEIANwOYigFBAEIANwOQigFBAEIANwOIigFBAEIANwOAigFBAEHADCABQQF0a0EDdjYCjI0BQQBBADYCiI0BIAAQAkHkAEEAKAKMjQEiAEEBdmshAwJAQQAoAoiNASIBQQBIDQAgACEEAkAgACABRg0AIAFByIsBaiEFQQAhAQNAIAUgAWpBADoAACABQQFqIgEgAEEAKAKIjQEiBGtJDQALCyAEQciLAWoiASABLQAAIAJyOgAAIABBx4sBaiIBIAEtAABBgAFyOgAAQciLASAAEANBAEGAgICAeDYCiI0BCwJAIANBBEkNACADQQJ2IgFBA3EhBUEAIQQCQCABQX9qQQNJDQAgAUH8////A3EhAEEAIQFBACEEA0AgAUGACmogAUGAigFqKAIANgIAIAFBhApqIAFBhIoBaigCADYCACABQYgKaiABQYiKAWooAgA2AgAgAUGMCmogAUGMigFqKAIANgIAIAFBEGohASAAIARBBGoiBEcNAAsLIAVFDQAgBUECdCEAIARBAnQhAQNAIAFBgApqIAFBgIoBaigCADYCACABQQRqIQEgAEF8aiIADQALCwsL2AEBAEGACAvQAZABAAAAAAAAAAAAAAAAAAABAAAAAAAAAIKAAAAAAAAAioAAAAAAAIAAgACAAAAAgIuAAAAAAAAAAQAAgAAAAACBgACAAAAAgAmAAAAAAACAigAAAAAAAACIAAAAAAAAAAmAAIAAAAAACgAAgAAAAACLgACAAAAAAIsAAAAAAACAiYAAAAAAAIADgAAAAAAAgAKAAAAAAACAgAAAAAAAAIAKgAAAAAAAAAoAAIAAAACAgYAAgAAAAICAgAAAAAAAgAEAAIAAAAAACIAAgAAAAIA=',
    hash: 'f2f6f5b2'
  };
  
  const sha3Mutex = new Mutex();
  let sha3Hasher = null;
  
  function validateSha3Variant(variant) {
    return [224, 256, 384, 512].includes(variant) ? null : new Error('Invalid variant! Valid values: 224, 256, 384, 512');
  }
  
  htosApp.$hashWasm = {
    sha3: function(data, variant = 512) {
      if (validateSha3Variant(variant)) {
        return Promise.reject(validateSha3Variant(variant));
      }
      
      const hashLengthBytes = variant / 8;
      
      if (sha3Hasher === null || sha3Hasher.hashLength !== hashLengthBytes) {
        return sha3Mutex.dispatch(() => asyncHelper(this, undefined, undefined, function* () {
          const hasherInstance = yield createWasmHasher(sha3WasmConfig, hashLengthBytes);
          return hasherInstance;
        })).then((hasher) => {
          sha3Hasher = hasher;
          return hasher.calculate(data, variant, 6);
        });
      }
      
      try {
        const result = sha3Hasher.calculate(data, variant, 6);
        return Promise.resolve(result);
      } catch (error) {
        return Promise.reject(error);
      }
    }
  };
})();

// Environment detection
(() => {
  const { $env: env } = htosApp;
  
  env.getLocus = () => {
    const { protocol, host, pathname, href } = location;
    
    if (href === 'https://htos.io/solver' || 
        href === 'http://localhost:3000/solver' || 
        pathname === '/solver.html') {
      return 'solver';
    }
    
    if (protocol !== 'chrome-extension:' && chrome?.runtime?.getURL) {
      return 'cs';
    }
    
    if (protocol !== 'chrome-extension:') {
      return 'nj';
    }
    
    if (pathname === '/offscreen.html') {
      return 'os';
    }
    
    return 'bg';
  };
})();

// Message Bus Controller
(() => {
  const { $bus: bus, $env: env, $utils: utils } = htosApp;
  
  bus.controller = {
    async init() {
      bus.on = this.on.bind(this);
      bus.off = this.off.bind(this);
      bus.once = this.once.bind(this);
      bus.send = this._wrapThrowIfError(this.send);
      bus.call = this._wrapThrowIfError(this.call);
      bus.poll = this.poll.bind(this);
      bus.getTabId = this.getTabId.bind(this);
      
      this._locus = env.getLocus();
      this._serialize = this._serialize.bind(this);
      this._handlers = {};
      
      if (this._is('solver')) {
        this._setupSolver();
      } else if (this._is('os')) {
        this._channel = new BroadcastChannel('htos.solver.channel');
        this._setupOs();
      }
    },
    
    on(eventName, handler, thisArg = null) {
      this._on(eventName, null, handler, thisArg);
    },
    
    off(eventName, handler = null) {
      this._off(eventName, null, handler);
    },
    
    once(eventName, handler) {
      const onceHandler = async (...args) => {
        this.off(eventName, onceHandler);
        return await handler(...args);
      };
      this.on(eventName, onceHandler);
    },
    
    async send(eventName, ...args) {
      if (this._is('solver')) {
        return await this._sendToParent(eventName, ...args);
      }
      
      if (this._is('os')) {
        return await this._callHandlers({
          name: eventName,
          args: args
        }, (handler) => handler.proxy);
      }
      
      return null;
    },
    
    async call(eventName, ...args) {
      return this._callHandlers({
        name: eventName,
        args: args
      }, (handler) => !handler.proxy);
    },
    
    async poll(eventName, ...args) {
      return await utils.waitFor(() => this.send(eventName, ...args));
    },
    
    async getTabId() {
      return null; // Not applicable in solver context
    },
    
    _on(eventName, proxy, handler, thisArg = null) {
      if (!this._handlers[eventName]) {
        this._handlers[eventName] = [];
      }
      
      const handlerObject = {
        fn: handler,
        name: eventName
      };
      
      if (proxy) handlerObject.proxy = proxy;
      if (thisArg) handlerObject.this = thisArg;
      
      this._handlers[eventName].push(handlerObject);
    },
    
    _off(eventName, proxy = null, handler = null) {
      if (this._handlers[eventName]) {
        this._handlers[eventName] = this._handlers[eventName].filter(h => {
          const handlerMatches = !handler || handler === h.fn;
          const proxyMatches = proxy === (h.proxy || null);
          return !handlerMatches || !proxyMatches;
        });
        
        if (this._handlers[eventName].length === 0) {
          delete this._handlers[eventName];
        }
      }
    },
    
    _setupSolver() {
      window.addEventListener('message', async ({ data }) => {
        if (!this._isBusMsg(data)) return;
        
        const result = await this._callHandlers(data);
        window.parent.postMessage({
          resId: data.reqId,
          result: result
        }, '*');
      });
    },
    
    _setupOs() {
      // Setup for offscreen document communication
    },
    
    async _sendToParent(eventName, ...args) {
      const reqId = this._generateId();
      const message = this._createBusMsg({
        reqId: reqId,
        name: eventName,
        args: args
      });
      
      return new Promise((resolve) => {
        const handleResponse = (event) => {
          if (event.data.resId === reqId) {
            window.removeEventListener('message', handleResponse);
            resolve(event.data.result);
          }
        };
        
        window.addEventListener('message', handleResponse);
        window.parent.postMessage(message, '*');
      });
    },
    
    async _callHandlers(data, filter = () => true) {
      const handlers = this._handlers[data.name] || [];
      const filteredHandlers = handlers.filter(filter);
      
      if (filteredHandlers.length === 0) return null;
      
      const results = await Promise.all(
        filteredHandlers.map(async (handler) => {
          try {
            const context = handler.this || this;
            return await handler.fn.apply(context, data.args || []);
          } catch (error) {
            console.error('Handler error:', error);
            return error;
          }
        })
      );
      
      return results.length === 1 ? results[0] : results;
    },
    
    _is(...loci) {
      return loci.includes(this._locus);
    },
    
    _isBusMsg(message) {
      return message && message.$bus && message.appName === htosApp.name;
    },
    
    _createBusMsg(props) {
      return {
        $bus: true,
        appName: htosApp.name,
        ...props
      };
    },
    
    _generateId() {
      return `bus-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    },
    
    _wrapThrowIfError(fn) {
      return async (...args) => {
        const result = await fn.call(this, ...args);
        if (utils.is.error(result)) throw result;
        return result;
      };
    }
  };
})();

// Arkose Controller
(() => {
  const { $ai: ai, $utils: utils } = htosApp;
  
  ai.arkoseController = {
    _setupPromise: utils.createPromise(),
    
    async init() {
      // Initialize Arkose solver capabilities
      this._setupPromise.resolve();
    },
    
    async setup(config) {
      await this._setupPromise;
      
      // Setup challenge container if needed
      if (!document.getElementById('challenge')) {
        const challengeContainer = document.createElement('div');
        challengeContainer.id = 'challenge';
        challengeContainer.style.display = 'none';
        document.body.appendChild(challengeContainer);
      }
      
      // Load Arkose script if provided
      if (config.script) {
        const scriptElement = document.createElement('script');
        Object.entries(config.script).forEach(([key, value]) => {
          scriptElement.setAttribute(key, value);
        });
        
        document.head.appendChild(scriptElement);
        
        await new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error('Script loading timed out'));
          }, config.scriptLoadTimeout || 30000);
          
          scriptElement.onload = () => {
            clearTimeout(timeoutId);
            scriptElement.setAttribute('data-status', 'loaded');
            resolve();
          };
          
          scriptElement.onerror = () => {
            clearTimeout(timeoutId);
            scriptElement.setAttribute('data-status', 'failed');
            reject(new Error('Script loading failed'));
          };
        });
      }
    },
    
    async generateProof(challenge) {
      // Generate proof-of-work for Arkose challenge
      try {
        const { data, difficulty } = challenge;
        const hash = await htosApp.$hashWasm.sha3(data, 256);
        
        // Simple proof-of-work implementation
        let nonce = 0;
        let proof = '';
        
        while (true) {
          const input = data + nonce.toString();
          const result = await htosApp.$hashWasm.sha3(input, 256);
          
          if (result.startsWith('0'.repeat(difficulty || 4))) {
            proof = result;
            break;
          }
          
          nonce++;
          
          // Prevent infinite loops
          if (nonce > 1000000) {
            throw new Error('Proof generation timeout');
          }
        }
        
        return {
          nonce: nonce,
          proof: proof,
          hash: hash
        };
      } catch (error) {
        console.error('Proof generation failed:', error);
        throw error;
      }
    }
  };
})();

// AI Controller
(() => {
  const { $ai: ai } = htosApp;
  
  ai.controller = {
    init() {
      ai.arkoseController.init();
    }
  };
})();

// Startup Controller
(() => {
  const { $startup: startup, $bus: bus, $ai: ai } = htosApp;
  
  startup.controller = {
    async init() {
      await bus.controller.init();
      await ai.controller.init();
      
      // Register event handlers
      bus.on('arkose.setup', async (config) => {
        return await ai.arkoseController.setup(config);
      });
      
      bus.on('arkose.generateProof', async (challenge) => {
        return await ai.arkoseController.generateProof(challenge);
      });
      
      bus.on('startup.solverReady', () => true);
      
      // Signal readiness
      bus.send('startup.solverReady');
      console.log('HTOS Arkose Solver ready');
    }
  };
  
  // Auto-initialize
  startup.controller.init().catch(console.error);
})();

// Export for potential integration
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { htosApp };
} else if (typeof window !== 'undefined') {
  window.htosApp = htosApp;
}