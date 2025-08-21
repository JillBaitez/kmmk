// ======== File: oi.js ========
// HTOS Refactor Snapshot

// 1. IMPORTS & DEPENDENCIES
// This file is self-contained and primarily uses standard Browser/WebAssembly APIs.
// Its logic will be encapsulated into an ES6 module.

// 2. CORE LOGIC START
// The core logic begins immediately with the setup of a global application object
// and a modular system for handling tasks in an offscreen iframe. The primary
// function is to solve Proof-of-Work challenges using a WASM-based hasher.

/* BEGIN FULL ORIGINAL LOGIC */

let htosApp;
((() => {
  // Renamed from HTOS1: HTOS
  const appGlobalKey = '__htos_global',
    environment = 'production',
    isDebug = !1;
  if (((htosApp = globalThis[appGlobalKey]), htosApp)) return;
  const appConfig = {
      name: appGlobalKey,
      env: environment,
      get: (key) => (key in appConfig ? appConfig[key] : null),
      ...JSON.parse('{"version":"11.2.1"}'),
    },
    proxiedApp = (function createProxiedModule(targetObject) {
      const isRootObject = targetObject === appConfig,
        shouldExposeToGlobal = isRootObject && isDebug,
        moduleCache = {},
        assignProperties = (properties) =>
          Object.assign(targetObject, properties),
        proxiedModule = new Proxy(targetObject, {
          get(target, property) {
            if (property === 'assign') return assignProperties;
            if (isRootObject && !String(property).startsWith('$'))
              return targetObject[property];
            if (!(property in targetObject)) {
              if (((targetObject[property] = {}), isRootObject)) {
                const logFn = logMessage.bind(null, 'log', property, !1),
                  logDevFn = logMessage.bind(null, 'log', property, !0),
                  warnFn = logMessage.bind(null, 'warn', property, !1),
                  warnDevFn = logMessage.bind(null, 'warn', property, !0),
                  errorFn = logMessage.bind(null, 'error', property, !1),
                  errorDevFn = logMessage.bind(null, 'error', property, !0),
                  errorFactoryFn = createError.bind(null, property);
                Object.defineProperties(targetObject[property], {
                  log: {
                    get: () => logFn,
                  },
                  logDev: {
                    get: () => logDevFn,
                  },
                  warn: {
                    get: () => warnFn,
                  },
                  warnDev: {
                    get: () => warnDevFn,
                  },
                  error: {
                    get: () => errorFn,
                  },
                  errorDev: {
                    get: () => errorDevFn,
                  },
                  Error: {
                    get: () => errorFactoryFn,
                  },
                });
              }
              ((moduleCache[property] = createProxiedModule(
                targetObject[property]
              )),
                shouldExposeToGlobal &&
                  (globalThis[property] = targetObject[property]));
            }
            return property in moduleCache
              ? moduleCache[property]
              : targetObject[property];
          },
          set: (target, property, value) => (
            (targetObject[property] = value),
            (moduleCache[property] = value),
            shouldExposeToGlobal &&
              (globalThis[property] = targetObject[property]),
            !0
          ),
        });
      return proxiedModule;
    })(appConfig);
  function logMessage(logLevel, moduleName, skipLog, ...messages) {
    if (skipLog) return;
    const [red, green, blue] = (function (inputString) {
      let hash = 0;
      inputString.split('').forEach((char, index) => {
        hash = inputString.charCodeAt(index) + ((hash << 5) - hash);
      });
      return [(16711680 & hash) >> 16, (65280 & hash) >> 8, 255 & hash];
    })(moduleName);
    console[logLevel](
      `%c[${moduleName}]`,
      `color: rgb(${red}, ${green}, ${blue})`,
      ...messages
    );
  }
  function createError(moduleName, message, ...details) {
    return (
      details.length > 0 &&
        logMessage('error', moduleName, !1, message, ...details),
      new Error(`[${moduleName}] ${message}`)
    );
  }
  ((globalThis[appGlobalKey] = proxiedApp), (htosApp = proxiedApp));
})(),
  (() => {
    function asyncHelper(context, args, PromiseCtor, generator) {
      return new (PromiseCtor || (PromiseCtor = Promise))(function (
        resolve,
        reject
      ) {
        function onFulfilled(value) {
          try {
            step(generator.next(value));
          } catch (error) {
            reject(error);
          }
        }
        function onRejected(value) {
          try {
            step(generator.throw(value));
          } catch (error) {
            reject(error);
          }
        }
        function step(result) {
          var value;
          result.done
            ? resolve(result.value)
            : ((value = result.value),
              value instanceof PromiseCtor
                ? value
                : new PromiseCtor(function (resolve) {
                    resolve(value);
                  })).then(onFulfilled, onRejected);
        }
        step((generator = generator.apply(context, args || [])).next());
      });
    }
    typeof SuppressedError == 'function' && SuppressedError;
    var suppressedError,
      Mutex = class {
        constructor() {
          this.mutex = Promise.resolve();
        }
        lock() {
          let releaseLock = () => {};
          return (
            (this.mutex = this.mutex.then(() => new Promise(releaseLock))),
            new Promise((resolve) => {
              releaseLock = resolve;
            })
          );
        }
        dispatch(task) {
          return asyncHelper(this, undefined, undefined, function* () {
            const release = yield this.lock();
            try {
              return yield Promise.resolve(task());
            } finally {
              release();
            }
          });
        }
      },
      globalContext =
        typeof globalThis != 'undefined'
          ? globalThis
          : typeof self != 'undefined'
            ? self
            : typeof window != 'undefined'
              ? window
              : global,
      BufferPolyfill =
        (suppressedError = globalContext.Buffer) !== null &&
        undefined !== suppressedError
          ? suppressedError
          : null,
      TextEncoderPolyfill = globalContext.TextEncoder
        ? new globalContext.TextEncoder()
        : null;
    function packBytes(charCode1, charCode2) {
      return (
        (((15 & charCode1) + ((charCode1 >> 6) | ((charCode1 >> 3) & 8))) <<
          4) |
        ((15 & charCode2) + ((charCode2 >> 6) | ((charCode2 >> 3) & 8)))
      );
    }
    var hexCharOffsetA = 'a'.charCodeAt(0) - 10,
      hexCharOffset0 = '0'.charCodeAt(0);
    function bytesToHexString(destArray, sourceBytes, byteLength) {
      let destIndex = 0;
      for (let i = 0; i < byteLength; i++) {
        let nibble = sourceBytes[i] >>> 4;
        ((destArray[destIndex++] =
          nibble > 9 ? nibble + hexCharOffsetA : nibble + hexCharOffset0),
          (nibble = 15 & sourceBytes[i]),
          (destArray[destIndex++] =
            nibble > 9 ? nibble + hexCharOffsetA : nibble + hexCharOffset0));
      }
      return String.fromCharCode.apply(null, destArray);
    }
    var toUint8Array =
        BufferPolyfill !== null
          ? (data) => {
              if (typeof data == 'string') {
                const buffer = BufferPolyfill.from(data, 'utf8');
                return new Uint8Array(
                  buffer.buffer,
                  buffer.byteOffset,
                  buffer.length
                );
              }
              if (BufferPolyfill.isBuffer(data))
                return new Uint8Array(
                  data.buffer,
                  data.byteOffset,
                  data.length
                );
              if (ArrayBuffer.isView(data))
                return new Uint8Array(
                  data.buffer,
                  data.byteOffset,
                  data.byteLength
                );
              throw new Error('Invalid data type!');
            }
          : (data) => {
              if (typeof data == 'string')
                return TextEncoderPolyfill.encode(data);
              if (ArrayBuffer.isView(data))
                return new Uint8Array(
                  data.buffer,
                  data.byteOffset,
                  data.byteLength
                );
              throw new Error('Invalid data type!');
            },
      BASE64_CHARS =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',
      base64DecodeTable = new Uint8Array(256);
    for (let i = 0; i < BASE64_CHARS.length; i++)
      base64DecodeTable[BASE64_CHARS.charCodeAt(i)] = i;
    function base64ToUint8Array(base64String) {
      const outputLength = (function (str) {
          let len = Math.floor(0.75 * str.length);
          const originalLength = str.length;
          return (
            str[originalLength - 1] === '=' &&
              ((len -= 1), str[originalLength - 2] === '=' && (len -= 1)),
            len
          );
        })(base64String),
        stringLength = base64String.length,
        destArray = new Uint8Array(outputLength);
      let destIndex = 0;
      for (let i = 0; i < stringLength; i += 4) {
        const b1 = base64DecodeTable[base64String.charCodeAt(i)],
          b2 = base64DecodeTable[base64String.charCodeAt(i + 1)],
          b3 = base64DecodeTable[base64String.charCodeAt(i + 2)],
          b4 = base64DecodeTable[base64String.charCodeAt(i + 3)];
        ((destArray[destIndex] = (b1 << 2) | (b2 >> 4)),
          (destIndex += 1),
          (destArray[destIndex] = ((15 & b2) << 4) | (b3 >> 2)),
          (destIndex += 1),
          (destArray[destIndex] = ((3 & b3) << 6) | (63 & b4)),
          (destIndex += 1));
      }
      return destArray;
    }
    var WASM_MEMORY_CHUNK_SIZE = 16384,
      wasmMutex = new Mutex(),
      wasmModuleCache = new Map();
    function createWasmHasher(wasmConfig, hashLength) {
      return asyncHelper(this, undefined, undefined, function* () {
        let wasmInstance = null,
          wasmMemoryView = null,
          isInitialized = !1;
        if (typeof WebAssembly == 'undefined')
          throw new Error(
            'WebAssembly is not supported in this environment!'
          );
        const getStateSize = () =>
            new DataView(wasmInstance.exports.memory.buffer).getUint32(
              wasmInstance.exports.STATE_SIZE,
              !0
            ),
          instantiatePromise = wasmMutex.dispatch(() =>
            asyncHelper(this, undefined, undefined, function* () {
              if (!wasmModuleCache.has(wasmConfig.name)) {
                const wasmBinary = base64ToUint8Array(wasmConfig.data),
                  compiledModule = WebAssembly.compile(wasmBinary);
                wasmModuleCache.set(wasmConfig.name, compiledModule);
              }
              const modulePromise = yield wasmModuleCache.get(
                wasmConfig.name
              );
              wasmInstance = yield WebAssembly.instantiate(modulePromise, {});
            })
          ),
          initHash = (seed = null) => {
            ((isInitialized = !0), wasmInstance.exports.Hash_Init(seed));
          },
          updateHash = (data) => {
            if (!isInitialized)
              throw new Error('update() called before init()');
            ((dataBytes) => {
              let offset = 0;
              for (; offset < dataBytes.length; ) {
                const chunk = dataBytes.subarray(
                  offset,
                  offset + WASM_MEMORY_CHUNK_SIZE
                );
                ((offset += chunk.length),
                  wasmMemoryView.set(chunk),
                  wasmInstance.exports.Hash_Update(chunk.length));
              }
            })(toUint8Array(data));
          },
          hexDigestBuffer = new Uint8Array(2 * hashLength),
          digestHash = (format, finalData = null) => {
            if (!isInitialized)
              throw new Error('digest() called before init()');
            return (
              (isInitialized = !1),
              wasmInstance.exports.Hash_Final(finalData),
              format === 'binary'
                ? wasmMemoryView.slice(0, hashLength)
                : bytesToHexString(
                    hexDigestBuffer,
                    wasmMemoryView,
                    hashLength
                  )
            );
          },
          isSmallData = (data) =>
            typeof data == 'string'
              ? data.length < 4096
              : data.byteLength < WASM_MEMORY_CHUNK_SIZE;
        let canCalculateInOneShot = isSmallData;
        switch (wasmConfig.name) {
          case 'argon2':
          case 'scrypt':
            canCalculateInOneShot = () => !0;
            break;
          case 'blake2b':
          case 'blake2s':
            canCalculateInOneShot = (data, keySize) =>
              keySize <= 512 && isSmallData(data);
            break;
          case 'blake3':
            canCalculateInOneShot = (data, keySize) =>
              keySize === 0 && isSmallData(data);
            break;
          case 'xxhash64':
          case 'xxhash3':
          case 'xxhash128':
            canCalculateInOneShot = () => !1;
        }
        return (
          yield (() =>
            asyncHelper(this, undefined, undefined, function* () {
              wasmInstance || (yield instantiatePromise);
              const bufferAddress = wasmInstance.exports.Hash_GetBuffer(),
                memoryBuffer = wasmInstance.exports.memory.buffer;
              wasmMemoryView = new Uint8Array(
                memoryBuffer,
                bufferAddress,
                WASM_MEMORY_CHUNK_SIZE
              );
            }))(),
          {
            getMemory: () => wasmMemoryView,
            writeMemory: (data, offset = 0) => {
              wasmMemoryView.set(data, offset);
            },
            getExports: () => wasmInstance.exports,
            setMemorySize: (newSize) => {
              wasmInstance.exports.Hash_SetMemorySize(newSize);
              const bufferAddress = wasmInstance.exports.Hash_GetBuffer(),
                memoryBuffer = wasmInstance.exports.memory.buffer;
              wasmMemoryView = new Uint8Array(
                memoryBuffer,
                bufferAddress,
                newSize
              );
            },
            init: initHash,
            update: updateHash,
            digest: digestHash,
            save: () => {
              if (!isInitialized)
                throw new Error(
                  'save() can only be called after init() and before digest()'
                );
              const stateAddress = wasmInstance.exports.Hash_GetState(),
                stateSize = getStateSize(),
                memoryBuffer = wasmInstance.exports.memory.buffer,
                stateData = new Uint8Array(
                  memoryBuffer,
                  stateAddress,
                  stateSize
                ),
                saveBuffer = new Uint8Array(4 + stateSize);
              return (
                (function (dest, sourceString) {
                  const halfLength = sourceString.length >> 1;
                  for (let i = 0; i < halfLength; i++) {
                    const charIndex = i << 1;
                    dest[i] = packBytes(
                      sourceString.charCodeAt(charIndex),
                      sourceString.charCodeAt(charIndex + 1)
                    );
                  }
                })(saveBuffer, wasmConfig.hash),
                saveBuffer.set(stateData, 4),
                saveBuffer
              );
            },
            load: (savedState) => {
              if (!(savedState instanceof Uint8Array))
                throw new Error(
                  'load() expects an Uint8Array generated by save()'
                );
              const stateAddress = wasmInstance.exports.Hash_GetState(),
                stateSize = getStateSize(),
                expectedLength = 4 + stateSize,
                memoryBuffer = wasmInstance.exports.memory.buffer;
              if (savedState.length !== expectedLength)
                throw new Error(
                  `Bad state length (expected ${expectedLength} bytes, got ${savedState.length})`
                );
              if (
                !(function (hashString, stateBytes) {
                  if (hashString.length !== 2 * stateBytes.length) return !1;
                  for (let i = 0; i < stateBytes.length; i++) {
                    const charIndex = charIndex << 1;
                    if (
                      stateBytes[charIndex] !==
                      packBytes(
                        hashString.charCodeAt(charIndex),
                        hashString.charCodeAt(charIndex + 1)
                      )
                    )
                      return !1;
                  }
                  return !0;
                })(wasmConfig.hash, savedState.subarray(0, 4))
              )
                throw new Error(
                  'This state was written by an incompatible hash implementation'
                );
              const stateData = savedState.subarray(4);
              (new Uint8Array(memoryBuffer, stateAddress, stateSize).set(
                stateData
              ),
                (isInitialized = !0));
            },
            calculate: (data, key = null, salt = null) => {
              if (!canCalculateInOneShot(data, key))
                return (
                  initHash(key),
                  updateHash(data),
                  digestHash('hex', salt)
                );
              const dataBytes = toUint8Array(data);
              return (
                wasmMemoryView.set(dataBytes),
                wasmInstance.exports.Hash_Calculate(
                  dataBytes.length,
                  key,
                  salt
                ),
                bytesToHexString(hexDigestBuffer, wasmMemoryView, hashLength)
              );
            },
            hashLength: hashLength,
          }
        );
      });
    }
    (new Mutex(),
      new Mutex(),
      new DataView(new ArrayBuffer(4)),
      new Mutex(),
      new Mutex(),
      new Mutex(),
      new Mutex(),
      new Mutex(),
      new Mutex(),
      new Mutex());
    var sha3WasmConfig = {
        name: 'sha3',
        data: 'AGFzbQEAAAABFARgAAF/YAF/AGACf38AYAN/f38AAwgHAAEBAgEAAwUEAQECAgYOAn8BQZCNBQt/AEGACAsHcAgGbWVtb3J5AgAOSGFzaF9HZXRCdWZmZXIAAAlIYXNoX0luaXQAAQtIYXNoX1VwZGF0ZQACCkhhc2hfRmluYWwABA1IYXNoX0dldFN0YXRlAAUOSGFzaF9DYWxjdWxhdGUABgpTVEFURV9TSVpFAwEKqBwHBQBBgAoL1wMAQQBCADcDgI0BQQBCADcD+IwBQQBCADcD8IwBQQBCADcD6IwBQQBCADcD4IwBQQBCADcD2IwBQQBCADcDoiwBQQBCADcDyIwBQQBCADcDwIwBQQBCADcDuIwBQQBCADcDsIwBQQBCADcDqIwBQQBCADcDoIwBQQBCADcDmIwBQQBCADcDkIwBQQBCADcDiIwBQQBCADcDgIwBQQBCADcD+IsBQQBCADcD8IsBQQBCADcD6IsBQQBCADcD4IsBQQBCADcD2IsBQQBCADcDoisBQQBCADcDyIsBQQBCADcDwIsBQQBCADcDuIsBQQBCADcDsIsBQQBCADcDqIsBQQBCADcDoIsBQQBCADcDmIsBQQBCADcDkIsBQQBCADcDiIsBQQBCADcDgIsBQQBCADcD+IoBQQBCADcD8IoBQQBCADcD6IoBQQBCADcD4IoBQQBCADcD2IoBQQBCADcDoioBQQBCADcDyIoBQQBCADcDwIoBQQBCADcDuIoBQQBCADcDsIoBQQBCADcDqIoBQQBCADcDoIoBQQBCADcDmIoBQQBCADcDkIoBQQBCADcDiIoBQQBCADcDgIoBQQBBwAwgAEEBdGtBA3Y2AoyNAUEAQQA2AoiNAQuMAwEIfwJAQQAoAoiNASIBQQBIDQBBACABIABqQQAoAoyNASICcDYCiI0BAkACQCABDQBBgAohAwwBCwJAIAIgAWsiBCAAIAQgAEkbIgNFDQAgA0EDcSEFQQAhBgJAIANBBEkNACABQYCKAWohByADQXxxIQhBACEGA0AgByAGaiIDQcgBaiAGQYAKai0AADoAACADQckBaiAGQYEKai0AADoAACADQcoBaiAGQYEKai0AADoAACADQcsBaiAGQYMKai0AADoAACAIIAZBBGoiBkcNAAsLIAVFDQAgAUHIiwFqIQMDQCADIAZqIAZBgApqLQAAOgAAIAZBAWohBiAFQX9qIgUNAAsLIAQgAEsNAUHIiwEgAhADIAAgBGshACAEQYAKaiEDCwJAIAAgAkkNAANAIAMgAhADIAMgAmohAyAAIAJrIgAgAk8NAAsLIABFDQBBACECQcgBIQYDQCAGQYCKAWogAyAGakG4fmotAAA6AAAgBkEBaiEGIAAgAkEBaiICQf8BcUsNAAsLC+QLAS1+IAApA0AhAkEAKQPAigEhAyAAKQM4IQRBACkDuIoBIQUgACkDMCEGQQApA7CKASEHIAApAyghCEEAKQOoigEhCSAAKQMgIQpBACkDoIoBIQsgACkDGCEMQQApA5iKASENIAApAxAhDkEAKQOQigEhDyAAKQMIIRBBACkDiIoBIREgACkDACESQQApA4CKASETQQApA8iKASEUAkACQCABQcgASw0AQQApA9CKASEVQQApA+CKASEWQQApA9iKASEXDAELQQApA+CKASAAKQNghSEWQQApA9iKASAAKQNYhSEXQQApA9CKASAAKQNQhSEVIBQgACkDSIUhFCABQekASQ0AQQBBACkD6IoBIAApA2iFNwPoigFBAEEAKQPwigEgACkDcIU3A/CKAUEAQQApA/iKASAAKQN4hTcD+IoBQQBBACkDgIsBIAApA4ABhTcDgIsBIAFBiQFJDQBBAEEAKQOIiwEgACkDiAGFNwOIiwELIAMgAoUhGCAFIASFIRkgByAGhSEHIAkgCIUhCCALIAqFIRogDSAMhSEJIA8gDoUhCiARIBCFIQsgEyAShSEMQQApA7iLASESQQApA5CLASETQQApA+iKASEbQQApA6CLASEcQQApA/iKASENQQApA7CLASEdQQApA4iLASEOQQApA8CLASEPQQApA5iLASEeQQApA/CKASEQQQApA6iLASERQQApA4CLASEfQcB+IQADQCAaIAcgC4UgF4UgH4UgEYVCAYmFIBSFIBCFIB6FIA+FIQIgDCAZIAqFIBaFIA6FIB2FQgGJhSAIhSAVhSANhSAchSIDIAeFISAgCSAIIAyFIBWFIA2FIByFQgGJhSAYhSAbhSAThSAShSIEIA+FISEgGCAKIBQgGoUgEIUgHoUgD4VCAYmFIBmFIBaFIA6FIB2FIgWFQjeJIiIgCyAYIAmFIBuFIBOFIBKFQgGJhSAHhSAXhSAfhSARhSIGIAqFQj6JIiNCf4WDIAMgEYVCAokiJIUhDyANIAKFQimJIiUgBCAQhUIniSImQn+FgyAihSERIBIgBYVCOIkiEiAGIA6FQg+JIidCf4WDIAMgF4VCCokiKIUhDiAEIBqFQhuJIikgKCAIIAKFQiSJIipCf4WDhSENIAYgGYVCBokiKyADIAuFQgGJIixCf4WDIBwgAoVCEokiLYUhECArIAQgHoVCCIkiLiAbIAWFQhmJIhtCf4WDhSEXIAYgHYVCPYkiGSAEIBSFQhSJIgQgCSAFhUIciSIIQn+Fg4UhFCAIIBlCf4WDIAMgH4VCLYkiA4UhGCAZIANCf4WDIBSgAoVCA4kiCYUhGSAEIAMgCUJ/hYOFIQcgCSAEQn+FgyAIhSEIIAwgAoUiAiAhQg6JIgNCf4WDIBMgBYVCFYkiBIUhCSAGIBaFQiuJIgUgAyAEQn+Fg4UhCiAEIAVCf4WDICBCLIkiBIUhCyAAQdAJaikDACAFIARCf4WDhSAChSEMICcgKEJ/hYMgKoUiBSEfIAMgBCACQn+Fg4UiAiEaICogKUJ/hYMgEoUiAyEeIC0gLkJ/hYMgG4UiBCEWICYgJCAlQn+Fg4UiBiEdIBsgK0J/hYMgLIUiKCEVICMgJiAiQn+Fg4UiIiEcIC4gLCAtQn+Fg4UiJiEbICcgKSASQn+Fg4UiJyETICMgJEJ/hYMgJYUiIyESIABBCGoiAA0AC0EAIBE3A6iLAUEAIAU3A4CLAUEAIBc3A9iKAUEAIAc3A7CKAUEAIAs3A4iKAUEAIA83A8CLAUEAIAM3A5iLAUEAIBA3A/CKAUEAIBQ3A8iKAUEAIAI3A6CKAUEAIAY3A7CLAUEAIA43A4iLAUEAIAQ3A+CKAUEAIBk3A7iKAUEAIAo3A5CKAUEAICI3A6CLAUEAIA03A/iKAUEAICg3A9CKAUEAIAg3A6iKAUEAIAw3A4CKAUEAICM3A7iLAUEAICc3A5CLAUEAICY3A+iKAUEAIBg3A8CKAUEAIAk3A5iKAQv4AgEFf0HkAEEAKAKMjQEiAUEBdmshAgJAQQAoAoiNASIDQQBIDQAgASEEAkAgASADRg0AIANByIsBaiEFQQAhAwNAIAUgA2pBADoAACADQQFqIgMgAUEAKAKIjQEiBGtJDQALCyAEQciLAWoiAyADLQAAIAByOgAAIAFBx4sBaiIDIAMtAABBgAFyOgAAQciLASABEANBAEGAgICAeDYCiI0BCwJAIAJBBEkNACACQQJ2IgNBA3EhBUEAIQQCQCADQX9qQQNJDQAgA0H8////A3EhAUEAIQNBACEEA0AgA0GACmogA0GAigFqKAIANgIAIANBhApqIANBhIoBaigCADYCACADQYgKaiADQYiKAWooAgA2AgAgA0GMCmogA0GMigFqKAIANgIAIANBEGohAyABIARBBGoiBEcNAAsLIAVFDQAgBUECdCEBIARBAnQhAwNAIANBgApqIANBgIoBaigCADYCACADQQRqIQMgAUF8aiIBDQALCwsGAEGAigEL0QYBA39BAEIANwOAjQFBAEIANwP4jAFBAEIANwPwjAFBAEIANwPojAFBAEIANwPgjAFBAEIANwPYjAFBAEIANwPQjAFBAEIANwPIjAFBAEIANwPAjAFBAEIANwO4jAFBAEIANwOwjAFBAEIANwOojAFBAEIANwOgjAFBAEIANwOYjAFBAEIANwOQjAFBAEIANwOIjAFBAEIANwOAjAFBAEIANwPiwFBAEIANwPwiwFBAEIANwPoiwFBAEIANwPgiwFBAEIANwPYiwFBAEIANwPQiwFBAEIANwPIiwFBAEIANwPAiwFBAEIANwO4iwFBAEIANwOwiwFBAEIANwOoiwFBAEIANwOgiwFBAEIANwOYiwFBAEIANwOQiwFBAEIANwOIiwFBAEIANwOAiwFBAEIANwP4igFBAEIANwPwigFBAEIANwPoigFBAEIANwPgigFBAEIANwPYigFBAEIANwPQigFBAEIANwPIigFBAEIANwPAigFBAEIANwO4igFBAEIANwOwigFBAEIANwOoigFBAEIANwOgigFBAEIANwOYigFBAEIANwOQigFBAEIANwOIigFBAEIANwOAiwFBAEIANwP4igFBAEIANwPwigFBAEIANwPoigFBAEIANwPgigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANYwPwigFBAEANY