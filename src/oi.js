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
        data: 'AGFzbQEAAAABFARgAAF/YAF/AGACf38AYAN/f38AAwgHAAEBAgEAAwUEAQECAgYOAn8BQZCNBQt/AEGACAsHcAgGbWVtb3J5AgAOSGFzaF9HZXRCdWZmZXIAAAlIYXNoX0luaXQAAQtIYXNoX1VwZGF0ZQACCkhhc2hfRmluYWwABA1IYXNoX0dldFN0YXRlAAUOSGFzaF9DYWxjdWxhdGUABgpTVEFURV9TSVpFAwEKqBwHBQBBgAoL1wMAQQBCADcDgI0BQQBCADcD+IwBQQBCADcD8IwBQQBCADcD6IwBQQBCADcD4IwBQQBCADcD2IwBQQBCADcDoiwBQQBCADcDyIwBQQBCADcDwIwBQQBCADcDuIwBQQBCADcDsIwBQQBCADcDqIwBQQBCADcDoIwBQQBCADcDmIwBQQBCADcDkIwBQQBCADcDiIwBQQBCADcDgIwBQQBCADcD+IsBQQBCADcD8IsBQQBCADcD6IsBQQBCADcD4IsBQQBCADcD2IsBQQBCADcDoisBQQBCADcDyIsBQQBCADcDwIsBQQBCADcDuIsBQQBCADcDsIsBQQBCADcDqIsBQQBCADcDoIsBQQBCADcDmIsBQQBCADcDkIsBQQBCADcDiIsBQQBCADcDgIsBQQBCADcD+IoBQQBCADcD8IoBQQBCADcD6IoBQQBCADcD4IoBQQBCADcD2IoBQQBCADcDoioBQQBCADcDyIoBQQBCADcDwIoBQQBCADcDuIoBQQBCADcDsIoBQQBCADcDqIoBQQBCADcDoIoBQQBCADcDmIoBQQBCADcDkIoBQQBCADcDiIoBQQBCADcDgIoBQQBBwAwgAEEBdGtBA3Y2AoyNAUEAQQA2AoiNAQuMAwEIfwJAQQAoAoiNASIBQQBIDQBBACABIABqQQAoAoyNASICcDYCiI0BAkACQCABDQBBgAohAwwBCwJAIAIgAWsiBCAAIAQgAEkbIgNFDQAgA0EDcSEFQQAhBgJAIANBBEkNACABQYCKAWohByADQXxxIQhBACEGA0AgByAGaiIDQcgBaiAGQYAKai0AADoAACADQckBaiAGQYEKai0AADoAACADQcoBaiAGQYIKai0AADoAACADQcsBaiAGQYMKai0AADoAACAIIAZBBGoiBkcNAAsLIAVFDQAgAUHIiwFqIQMDQCADIAZqIAZBgApqLQAAOgAAIAZBAWohBiAFQX9qIgUNAAsLIAQgAEsNAUHIiwEgAhADIAAgBGshACAEQYAKaiEDCwJAIAAgAkkNAANAIAMgAhADIAMgAmohAyAAIAJrIgAgAk8NAAsLIABFDQBBACECQcgBIQYDQCAGQYCKAWogAyAGakG4fmotAAA6AAAgBkEBaiEGIAAgAkEBaiICQf8BcUsNAAsLC+QLAS1+IAApA0AhAkEAKQPAigEhAyAAKQM4IQRBACkDuIoBIQUgACkDMCEGQQApA7CKASEHIAApAyghCEEAKQOoigEhCSAAKQMgIQpBACkDoIoBIQsgACkDGCEMQQApA5iKASENIAApAxAhDkEAKQOQigEhDyAAKQMIIRBBACkDiIoBIREgACkDACESQQApA4CKASETQQApA8iKASEUAkACQCABQcgASw0AQQApA9CKASEVQQApA+CKASEWQQApA9iKASEXDAELQQApA+CKASAAKQNghSEWQQApA9iKASAAKQNYhSEXQQApA9CKASAAKQNQhSEVIBQgACkDSIUhFCABQekASQ0AQQBBACkD6IoBIAApA2iFNwPoigFBAEEAKQPwigEgACkDcIU3A/CKAUEAQQApA/iKASAAKQN4hTcD+IoBQQBBACkDgIsBIAApA4ABhTcDgIsBIAFBiQFJDQBBAEEAKQOIiwEgACkDiAGFNwOIiwELIAMgAoUhGCAFIASFIRkgByAGhSEHIAkgCIUhCCALIAqFIRogDSAMhSEJIA8gDoUhCiARIBCFIQsgEyAShSEMQQApA7iLASESQQApA5CLASETQQApA+iKASEbQQApA6CLASEcQQApA/iKASENQQApA7CLASEdQQApA4iLASEOQQApA8CLASEPQQApA5iLASEeQQApA/CKASEQQQApA6iLASERQQApA4CLASEfQcB+IQADQCAaIAcgC4UgF4UgH4UgEYVCAYmFIBSFIBCFIB6FIA+FIQIgDCAZIAqFIBaFIA6FIB2FQgGJhSAIhSAVhSANhSAchSIDIAeFISAgCSAIIAyFIBWFIA2FIByFQgGJhSAYhSAbhSAThSAShSIEIA+FISEgGCAKIBQgGoUgEIUgHoUgD4VCAYmFIBmFIBaFIA6FIB2FIgWFQjeJIiIgCyAYIAmFIBuFIBOFIBKFQgGJhSAHhSAXhSAfhSARhSIGIAqFQj6JIiNCf4WDIAMgEYVCAokiJIUhDyANIAKFQimJIiUgBCAQhUIniSImQn+FgyAihSERIBIgBYVCOIkiEiAGIA6FQg+JIidCf4WDIAMgF4VCCokiKIUhDiAEIBqFQhuJIikgKCAIIAKFQiSJIipCf4WDhSENIAYgGYVCBokiKyADIAuFQgGJIixCf4WDIBwgAoVCEokiLYUhECArIAQgHoVCCIkiLiAbIAWFQhmJIhtCf4WDhSEXIAYgHYVCPYkiGSAEIBSFQhSJIgQgCSAFhUIciSIIQn+Fg4UhFCAIIBlCf4WDIAMgH4VCLYkiA4UhGCAZIANCf4WDIBSgAoVCA4kiCYUhGSAEIAMgCUJ/hYOFIQcgCSAEQn+FgyAIhSEIIAwgAoUiAiAhQg6JIgNCf4WDIBMgBYVCFYkiBIUhCSAGIBaFQiuJIgUgAyAEQn+Fg4UhCiAEIAVCf4WDICBCLIkiBIUhCyAAQdAJaikDACAFIARCf4WDhSAChSEMICcgKEJ/hYMgKoUiBSEfIAMgBCACQn+Fg4UiAiEaICogKUJ/hYMgEoUiAyEeIC0gLkJ/hYMgG4UiBCEWICYgJCAlQn+Fg4UiBiEdIBsgK0J/hYMgLIUiKCEVICMgJiAiQn+Fg4UiIiEcIC4gLCAtQn+Fg4UiJiEbICcgKSASQn+Fg4UiJyETICMgJEJ/hYMgJYUiIyESIABBCGoiAA0AC0EAIBE3A6iLAUEAIAU3A4CLAUEAIBc3A9iKAUEAIAc3A7CKAUEAIAs3A4iKAUEAIA83A8CLAUEAIAM3A5iLAUEAIBA3A/CKAUEAIBQ3A8iKAUEAIAI3A6CKAUEAIAY3A7CLAUEAIA43A4iLAUEAIAQ3A+CKAUEAIBk3A7iKAUEAIAo3A5CKAUEAICI3A6CLAUEAIA03A/iKAUEAICg3A9CKAUEAIAg3A6iKAUEAIAw3A4CKAUEAICM3A7iLAUEAICc3A5CLAUEAICY3A+iKAUEAIBg3A8CKAUEAIAk3A5iKAQv4AgEFf0HkAEEAKAKMjQEiAUEBdmshAgJAQQAoAoiNASIDQQBIDQAgASEEAkAgASADRg0AIANByIsBaiEFQQAhAwNAIAUgA2pBADoAACADQQFqIgMgAUEAKAKIjQEiBGtJDQALCyAEQciLAWoiAyADLQAAIAByOgAAIAFBx4sBaiIDIAMtAABBgAFyOgAAQciLASABEANBAEGAgICAeDYCiI0BCwJAIAJBBEkNACACQQJ2IgNBA3EhBUEAIQQCQCADQX9qQQNJDQAgA0H8////A3EhAUEAIQNBACEEA0AgA0GACmogA0GAigFqKAIANgIAIANBhApqIANBhIoBaigCADYCACADQYgKaiADQYiKAWooAgA2AgAgA0GMCmogA0GMigFqKAIANgIAIANBEGohAyABIARBBGoiBEcNAAsLIAVFDQAgBUECdCEBIARBAnQhAwNAIANBgApqIANBgIoBaigCADYCACADQQRqIQMgAUF8aiIBDQALCwsGAEGAigEL0QYBA39BAEIANwOAjQFBAEIANwP4jAFBAEIANwPwjAFBAEIANwPojAFBAEIANwPgjAFBAEIANwPYjAFBAEIANwPQjAFBAEIANwPIjAFBAEIANwPAjAFBAEIANwO4jAFBAEIANwOwjAFBAEIANwOojAFBAEIANwOgjAFBAEIANwOYjAFBAEIANwOQjAFBAEIANwOIjAFBAEIANwOAjAFBAEIANwPiwFBAEIANwPwiwFBAEIANwPoiwFBAEIANwPgiwFBAEIANwPYiwFBAEIANwPQiwFBAEIANwPIiwFBAEIANwPAiwFBAEIANwO4iwFBAEIANwOwiwFBAEIANwOoiwFBAEIANwOgiwFBAEIANwOYiwFBAEIANwOQiwFBAEIANwOIiwFBAEIANwOAiwFBAEIANwP4igFBAEIANwPwigFBAEIANwPoigFBAEIANwPgigFBAEIANwPYigFBAEIANwPQigFBAEIANwPIigFBAEIANwPAigFBAEIANwO4igFBAEIANwOwigFBAEIANwOoigFBAEIANwOgigFBAEIANwOYigFBAEIANwOQigFBAEIANwOIigFBAEIANwOAigFBAEHADCABQQF0a0EDdjYCjI0BQQBBADYCiI0BIAAQAkHkAEEAKAKMjQEiAEEBdmshAwJAQQAoAoiNASIBQQBIDQAgACEEAkAgACABRg0AIAFByIsBaiEFQQAhAQNAIAUgAWpBADoAACABQQFqIgEgAEEAKAKIjQEiBGtJDQALCyAEQciLAWoiASABLQAAIAJyOgAAIABBx4sBaiIBIAEtAABBgAFyOgAAQciLASAAEANBAEGAgICAeDYCiI0BCwJAIANBBEkNACADQQJ2IgFBA3EhBUEAIQQCQCABQX9qQQNJDQAgAUH8////A3EhAEEAIQFBACEEA0AgAUGACmogAUGAigFqKAIANgIAIAFBhApqIAFBhIoBaigCADYCACABQYgKaiABQYiKAWooAgA2AgAgAUGMCmogAUGMigFqKAIANgIAIAFBEGohASAAIARBBGoiBEcNAAsLIAVFDQAgBUECdCEAIARBAnQhAQNAIAFBgApqIAFBgIoBaigCADYCACABQQRqIQEgAEF8aiIADQALCwsL2AEBAEGACAvQAZABAAAAAAAAAAAAAAAAAAABAAAAAAAAAIKAAAAAAAAAioAAAAAAAIAAgACAAAAAgIuAAAAAAAAAAQAAgAAAAACBgACAAAAAgAmAAAAAAACAigAAAAAAAACIAAAAAAAAAAmAAIAAAAAACgAAgAAAAACLgACAAAAAAIsAAAAAAACAiYAAAAAAAIADgAAAAAAAgAKAAAAAAACAgAAAAAAAAIAKgAAAAAAAAAoAAIAAAACAgYAAgAAAAICAgAAAAAAAgAEAAIAAAAAACIAAgAAAAIA=',
        hash: 'f2f6f5b2',
      },
      sha3Mutex = new Mutex(),
      sha3Hasher = null;
    function validateSha3Variant(variant) {
      return [224, 256, 384, 512].includes(variant)
        ? null
        : new Error('Invalid variant! Valid values: 224, 256, 384, 512');
    }
    // TODO: This WASM hasher is a powerful, self-contained module (Tier 3).
    // It should be extracted into a standalone utility for cryptographic operations
    // that can be imported by any part of the HTOS system needing hashing.
    (new Mutex(),
      new Mutex(),
      new Mutex(),
      new Mutex(),
      new Mutex(),
      new Mutex(),
      new Mutex(),
      new ArrayBuffer(8),
      new Mutex(),
      new ArrayBuffer(8),
      new Mutex(),
      new ArrayBuffer(8),
      new Mutex(),
      new Mutex(),
      new Mutex(),
      (htosApp.$hashWasm = {
        sha3: function (data, variant = 512) {
          if (validateSha3Variant(variant))
            return Promise.reject(validateSha3Variant(variant));
          const hashLengthBytes = variant / 8;
          if (
            sha3Hasher === null ||
            sha3Hasher.hashLength !== hashLengthBytes
          )
            return (function (mutex, wasmConfig, hashLength) {
              return asyncHelper(this, undefined, undefined, function* () {
                const releaseLock = yield mutex.lock(),
                  hasherInstance = yield createWasmHasher(
                    wasmConfig,
                    hashLength
                  );
                return (releaseLock(), hasherInstance);
              });
            })(sha3Mutex, sha3WasmConfig, hashLengthBytes).then((hasher) =>
              (sha3Hasher = hasher).calculate(data, variant, 6)
            );
          try {
            const result = sha3Hasher.calculate(data, variant, 6);
            return Promise.resolve(result);
          } catch (error) {
            return Promise.reject(error);
          }
        },
      }));
  })(),
  // TODO: The following utilities are highly portable (Tier 1) and should be
  // moved to individual files within an HTOS /utils directory. Their direct
  // attachment to the global `htosApp` object should be phased out in favor
  // of ES6 module imports.
  (() => {
    const { $utils: utils } = htosApp;
    utils.createPromise = () => {
      let resolve = null,
        reject = null;
      const promise = new Promise((res, rej) => {
        ((resolve = res), (reject = rej));
      });
      return (
        Object.defineProperty(promise, 'resolve', {
          get: () => resolve,
        }),
        Object.defineProperty(promise, 'reject', {
          get: () => reject,
        }),
        promise
      );
    };
  })(),
  (() => {
    const { $utils: utils } = htosApp;
    utils.is = {
      null: (value) => value === null,
      defined: (value) => undefined !== value,
      undefined: (value) => undefined === value,
      nil: (value) => value == null,
      boolean: (value) => typeof value == 'boolean',
      number: (value) => typeof value == 'number',
      string: (value) => typeof value == 'string',
      symbol: (value) => typeof value == 'symbol',
      function: (value) => typeof value == 'function',
      map: (value) => value instanceof Map,
      set: (value) => value instanceof Set,
      url: (value) => value instanceof URL,
      blob: (value) => value instanceof Blob,
      file: (value) => value instanceof File,
      error: (value) => value instanceof Error,
      regexp: (value) => value instanceof RegExp,
      array: (value) => Array.isArray(value),
      object: (value) =>
        Object.prototype.toString.call(value) === '[object Object]',
      nan: (value) => Number.isNaN(value),
      nonPrimitive: (value) =>
        utils.is.object(value) || utils.is.array(value),
      numeric: (value) => !utils.is.nan(Number(value)),
      empty: (value) =>
        !!utils.is.nil(value) ||
        (utils.is.array(value)
          ? value.length === 0
          : utils.is.object(value)
            ? Object.keys(value).length === 0
            : !!utils.is.string(value) && value.trim().length === 0),
    };
  })(),
  (() => {
    const { $utils: utils, $bus: bus } = htosApp;
    utils.objectUrl = {
      create(object, autoRevokeTimeout = !1) {
        if (!URL.createObjectURL)
          return bus.send(
            'utils.objectUrl.create',
            object,
            autoRevokeTimeout
          );
        const objectUrl = URL.createObjectURL(object);
        if (autoRevokeTimeout) {
          const timeoutMs = utils.is.number(autoRevokeTimeout)
            ? autoRevokeTimeout
            : 60000;
          setTimeout(() => URL.revokeObjectURL(objectUrl), timeoutMs);
        }
        return objectUrl;
      },
      revoke(objectUrl) {
        if (!URL.revokeObjectURL)
          return bus.send('utils.objectUrl.revoke', objectUrl);
        URL.revokeObjectURL(objectUrl);
      },
    };
  })(),
  (() => {
    const { $utils: utils } = htosApp;
    utils.pickRandom = (array) =>
      array[Math.floor(Math.random() * array.length)];
  })(),
  Array.prototype.toReversed &&
    (Array.prototype.toReversed = function () {
      return [...this].reverse();
    }),
  Array.prototype.at ||
    (Array.prototype.at = function (index) {
      return this[index >= 0 ? index : this.length + index];
    }),
  Array.prototype.findLastIndex ||
    (Array.prototype.findLastIndex = function (callback, thisArg) {
      for (let i = this.length - 1; i >= 0; i--)
        if (callback.call(thisArg, this[i], i, this)) return i;
      return -1;
    }),
  (() => {
    const { $utils: utils } = htosApp;
    utils.sleep = async (durationMs) =>
      new Promise((resolve) => {
        setTimeout(resolve, durationMs);
      });
  })(),
  (() => {
    const { $utils: utils } = htosApp;
    utils.waitFor = async (
      conditionFn,
      { interval = 100, timeout = 60000 } = {}
    ) => {
      if (timeout <= 0) throw new Error('$utils.waitFor: timeout exceeded');
      const startTime = Date.now(),
        result = await conditionFn();
      if (result) return result;
      await utils.sleep(interval);
      const elapsedTime = Date.now() - startTime;
      return utils.waitFor(conditionFn, {
        interval: interval,
        timeout: timeout - elapsedTime,
      });
    };
  })(),
  (() => {
    const {
      $ai: ai,
      $utils: utils,
      $bus: bus,
      $hashWasm: hashWasm,
    } = htosApp;
    // TODO: This controller implements a specific Proof-of-Work (POW) solution for Arkose.
    // The logic should be preserved but wrapped in a generic "Engine Adapter" interface
    // as part of the HTOS Offscreen Mesh architecture. The direct dependency on the
    // message bus should be removed in favor of a standardized adapter input/output.
    ai.arkoseController = {
      init() {
        ((this._arkose = null),
          (this._setupPromise = null),
          (this._firstTimeFetchToken = !0),
          (this._fetchTokenPromise = utils.createPromise()),
          bus.on('ai.retrieveArkoseToken', this._retrieveArkoseToken, this),
          bus.on('ai.generateProofToken', this._generateProofToken, this));
      },
      async _retrieveArkoseToken({
        dx: dx,
        config: config,
        accessToken: accessToken,
      }) {
        (await this._ensureSetup(config, accessToken),
          this._arkose.setConfig({
            [config.dataKey]: {
              [config.blobKey]: dx,
            },
          }),
          this._firstTimeFetchToken
            ? (this._arkose.run(), (this._firstTimeFetchToken = !1))
            : ((this._fetchTokenPromise = utils.createPromise()),
              this._arkose.reset()));
        const timeoutId = setTimeout(
            () => this._fetchTokenPromise.reject('Token fetching timed out'),
            config.tokenFetchTimeout
          ),
          token = await this._fetchTokenPromise;
        return (clearTimeout(timeoutId), token);
      },
      async _generateProofToken({
        seed: seed,
        difficulty: difficulty,
        scripts: scripts,
        dpl: dpl,
      }) {
        const dataToBase64 = (data) => {
            const jsonString = JSON.stringify(data);
            return btoa(
              String.fromCharCode(...new TextEncoder().encode(jsonString))
            );
          },
          startTime = performance.now(),
          navigatorKeys = Object.keys(Object.getPrototypeOf(navigator)),
          randomNavProperty = utils.pickRandom(navigatorKeys),
          proofData = [
            navigator.hardwareConcurrency + screen.width + screen.height,
            new Date().toString(),
            performance.memory.jsHeapSizeLimit,
            Math.random(),
            navigator.userAgent,
            utils.pickRandom(scripts),
            dpl,
            navigator.language,
            navigator.languages.join(','),
            Math.random(),
            `${randomNavProperty}-${navigator[randomNavProperty]}`,
            utils.pickRandom(Object.keys(document)),
            utils.pickRandom(Object.keys(window)),
            performance.now(),
            crypto.randomUUID(),
          ];
        for (let nonce = 1; nonce < 100000; nonce++) {
          (nonce % 1000 == 0 && (await utils.sleep(150)),
            (proofData[3] = nonce),
            (proofData[9] = Math.round(performance.now() - startTime)));
          const proofTokenAttempt = dataToBase64(proofData);
          if (
            (await hashWasm.sha3(`${seed}${proofTokenAttempt}`)).substring(
              0,
              difficulty.length
            ) <= difficulty
          )
            return proofTokenAttempt;
        }
        return null;
      },
      async _ensureSetup(config, accessToken) {
        if (this._setupPromise) return this._setupPromise;
        if (
          ((this._setupPromise = utils.createPromise()),
          this._patchArkoseIframe(config),
          (window.useArkoseSetupEnforcement = async (arkoseApi) => {
            (arkoseApi.setConfig({
              ...config.params,
              [config.selectorKey]: '#challenge',
              [config.onErrorKey]: (error) => {
                this._fetchTokenPromise.reject(error);
              },
              [config.onCompletedKey]: (data) => {
                this._fetchTokenPromise.resolve(data[config.resultTokenKey]);
              },
            }),
              (this._arkose = arkoseApi));
          }),
          !document.getElementById('challenge'))
        ) {
          const challengeContainer = document.createElement('div');
          ((challengeContainer.id = 'challenge'),
            document.body.appendChild(challengeContainer));
        }
        const scriptElement = document.createElement('script'),
          scriptConfig = config.script;
        (Object.entries(scriptConfig).forEach(([key, value]) =>
          scriptElement.setAttribute(key, value)
        ),
          document.head.appendChild(scriptElement),
          await new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
              reject('Script loading timed out');
            }, config.scriptLoadTimeout);
            ((scriptElement.onload = () => {
              (clearTimeout(timeoutId),
                scriptElement.setAttribute('data-status', 'loaded'),
                resolve());
            }),
              (scriptElement.onerror = () => {
                (clearTimeout(timeoutId),
                  scriptElement.setAttribute('data-status', 'failed'),
                  reject('Script loading failed'));
              }));
          }),
          this._setupPromise.resolve());
      },
      _patchArkoseIframe(config) {
        const originalAppendChild = HTMLElement.prototype.appendChild;
        HTMLElement.prototype.appendChild = function (...args) {
          const element = args[0];
          return (
            element &&
              utils.is.string(element.tagName) &&
              element.tagName.toLowerCase() === 'iframe' &&
              element.src.startsWith(config.iframeUrl) &&
              element.setAttribute('name', `ae:${JSON.stringify(config)}`),
            originalAppendChild.call(this, ...args)
          );
        };
      },
    };
  })(),
  (() => {
    const { $ai: ai } = htosApp;
    ai.controller = {
      init() {
        ai.arkoseController.init();
      },
    };
  })(),
  (() => {
    const { $bus: bus, $env: env, $utils: utils } = htosApp;
    // TODO: This message bus controller is tightly coupled with the original extension's
    // architecture (e.g., distinguishing between 'pp', 'bg', 'cs', 'oi' contexts).
    // It needs to be replaced with a generic, layered message bus implementation
    // that aligns with the HTOS architecture. The current logic is preserved
    // for dependency analysis and to ensure the ported script remains functional.
    bus.controller = {
      async init() {
        ((bus.on = this.on.bind(this)),
          (bus.off = this.off.bind(this)),
          (bus.once = this.once.bind(this)),
          (bus.send = this._wrapThrowIfError(this.send)),
          (bus.call = this._wrapThrowIfError(this.call)),
          (bus.poll = this.poll.bind(this)),
          (bus.getTabId = this.getTabId.bind(this)),
          (this._locus = env.getLocus()),
          (this._serialize = this._serialize.bind(this)),
          (this._handlers = {}),
          this._is('pp')
            ? (this._setupPp(), (this._tabId = await bus.getTabId()))
            : this._is('bg')
              ? ((this._blobs = {}),
                (this._channel = new BroadcastChannel('bus.channel')),
                this._setupBg())
              : this._is('cs')
                ? await this._setupCs()
                : this._is('nj')
                  ? this._setupNj()
                  : this._is('os')
                    ? ((bus.setIframe = (iframeElement) =>
                        (this._iframe = iframeElement)),
                      (this._iframe = null),
                      (this._channel = new BroadcastChannel('bus.channel')),
                      this._setupOs())
                    : this._is('oi') && this._setupOi());
      },
      on(eventName, handler, thisArg = null) {
        this._on(eventName, null, handler, thisArg);
      },
      off(eventName, handler = null) {
        this._off(eventName, null, handler);
      },
      once(eventName, handler) {
        const onceHandler = async (...args) => (
          this.off(eventName, onceHandler),
          await handler(...args)
        );
        this.on(eventName, onceHandler);
      },
      async send(eventNameOrTabId, ...args) {
        if (utils.is.numeric(eventNameOrTabId)) {
          const tabId = Number(eventNameOrTabId);
          return (
            (eventNameOrTabId = args[0]),
            (args = args.slice(1)),
            await this._pick([
              this._sendToCs(tabId, eventNameOrTabId, ...args),
              this._sendToExt(tabId, eventNameOrTabId, ...args),
            ])
          );
        }
        if (this._is('pp'))
          return await this._sendToExt(eventNameOrTabId, ...args);
        if (this._is('nj'))
          return await this._sendToPage(eventNameOrTabId, ...args);
        if (this._is('oi'))
          return await this._sendToParent(eventNameOrTabId, ...args);
        if (this._is('bg', 'cs', 'os'))
          return await this._pick([
            this._sendToExt(eventNameOrTabId, ...args),
            this._callHandlers(
              {
                name: eventNameOrTabId,
                args: args,
              },
              (handler) => handler.proxy
            ),
          ]);
        if (this._is('fg')) {
          if (eventNameOrTabId === 'store.actions') return;
          if (eventNameOrTabId === 'idb.change') return;
          bus.log(eventNameOrTabId, ...args);
        }
      },
      async call(eventName, ...args) {
        return this._callHandlers(
          {
            name: eventName,
            args: args,
          },
          (handler) => !handler.proxy
        );
      },
      async poll(eventName, ...args) {
        return await utils.waitFor(() => this.send(eventName, ...args));
      },
      async getTabId() {
        if (this._is('bg')) return null;
        if (this._is('pp')) {
          const tabIdFromUrl = new URL(location.href).searchParams.get(
            'tabId'
          );
          if (tabIdFromUrl) return Number(tabIdFromUrl);
        }
        const { tabId: tabId } = await this.send('bus.getTabData');
        return tabId;
      },
      _on(eventName, proxy, handler, thisArg = null) {
        (this._handlers[eventName] || (this._handlers[eventName] = []),
          this._is('cs', 'nj', 'oi') &&
            this._handlers[eventName].length === 0 &&
            this._sendToProxier('bus.proxy', eventName, !0));
        const handlerObject = {
          fn: handler,
          name: eventName,
        };
        (proxy && (handlerObject.proxy = proxy),
          thisArg && (handlerObject.this = thisArg),
          this._handlers[eventName].push(handlerObject));
      },
      _off(eventName, proxy = null, handler = null) {
        this._handlers[eventName] &&
          ((this._handlers[eventName] = this._handlers[eventName].filter(
            (handler) => {
              const handlerMatches = !handler || handler === handler.fn,
                proxyMatches = proxy === (handler.proxy || null);
              return !handlerMatches || !proxyMatches;
            }
          )),
          this._handlers[eventName].length === 0 &&
            (delete this._handlers[eventName],
            this._is('cs', 'nj', 'oi') &&
              this._sendToProxier('bus.proxy', eventName, !1)));
      },
      _setupPp() {},
      _setupBg() {},
      async _setupCs() {},
      _setupNj() {},
      _setupOs() {},
      _setupOi() {
        window.addEventListener('message', async ({ data: data }) => {
          if (!this._isBusMsg(data)) return;
          const result = await this._callHandlers(data);
          window.parent.postMessage(
            {
              resId: data.reqId,
              result: result,
            },
            '*'
          );
        });
      },
      async _sendToExt(eventNameOrTabId, ...args) {
        let tabId = null;
        utils.is.numeric(eventNameOrTabId) &&
          ((tabId = Number(eventNameOrTabId)),
          (eventNameOrTabId = args[0]),
          (args = args.slice(1)));
        const serializedArgs = this._serialize(args),
          busMessage = this._createBusMsg({
            name: eventNameOrTabId,
            argsStr: serializedArgs,
            target: tabId,
          }),
          response = await new Promise((resolve) => {
            try {
              chrome.runtime.sendMessage(busMessage, (response) => {
                chrome.runtime.lastError ? resolve(null) : resolve(response);
              });
            } catch (error) {
              if (error.message === 'Extension context invalidated.') return;
              (bus.error(error), resolve(null));
            }
          });
        return await this._deserialize(response);
      },
      async _sendToCs(tabId, eventName, ...args) {
        if (!chrome.tabs?.sendMessage)
          return await this.send('bus.sendToCs', tabId, eventName, ...args);
        const serializedArgs = this._serialize(args),
          busMessage = this._createBusMsg({
            name: eventName,
            argsStr: serializedArgs,
            target: 'cs',
          }),
          response = await new Promise((resolve) => {
            chrome.tabs.sendMessage(tabId, busMessage, (response) => {
              chrome.runtime.lastError ? resolve(null) : resolve(response);
            });
          });
        return await this._deserialize(response);
      },
      async _sendToPage(eventName, ...args) {
        const requestId = this._generateId(),
          busMessage = this._createBusMsg({
            name: eventName,
            args: args,
            reqId: requestId,
            locus: this._locus,
          });
        return (
          window.postMessage(busMessage, '*'),
          await this._waitForResponseMessage(requestId)
        );
      },
      async _sendToIframe(eventName, ...args) {
        if (!this._iframe) return null;
        const requestId = this._generateId(),
          busMessage = this._createBusMsg({
            name: eventName,
            args: args,
            reqId: requestId,
          });
        return (
          this._iframe.contentWindow.postMessage(busMessage, '*'),
          await this._waitForResponseMessage(requestId)
        );
      },
      async _sendToParent(eventName, ...args) {
        const requestId = this._generateId(),
          busMessage = this._createBusMsg({
            name: eventName,
            args: args,
            reqId: requestId,
          });
        return (
          parent.postMessage(busMessage, '*'),
          await this._waitForResponseMessage(requestId)
        );
      },
      async _sendToProxier(eventName, ...args) {
        return this._is('cs')
          ? await this._sendToExt(eventName, ...args)
          : this._is('nj')
            ? await this._sendToPage(eventName, ...args)
            : this._is('oi')
              ? await this._sendToParent(eventName, ...args)
              : undefined;
      },
      _waitForResponseMessage: async (requestId) =>
        await new Promise((resolve) => {
          const messageHandler = ({ data: data }) => {
            !(!data || data.resId !== requestId) &&
              (window.removeEventListener('message', messageHandler),
              resolve(data.result));
          };
          window.addEventListener('message', messageHandler);
        }),
      _callHandlers(
        { name: name, args: args, argsStr: argsStr },
        filterFn = null
      ) {
        let handlers = this._handlers[name];
        return handlers
          ? (filterFn && (handlers = handlers.filter(filterFn)),
            handlers.length === 0
              ? null
              : new Promise(async (resolve) => {
                  argsStr && (args = await this._deserialize(argsStr));
                  resolve(
                    await this._pick(
                      handlers.map(async (handler) => {
                        try {
                          return await handler.fn.call(handler.this, ...args);
                        } catch (error) {
                          return (
                            bus.error(
                              `failed to handle "${handler.name}".`,
                              error
                            ),
                            error
                          );
                        }
                      })
                    )
                  );
                }))
          : null;
      },
      _removeProxyHandlers(proxy) {
        Object.keys(this._handlers).forEach((eventName) => {
          ((this._handlers[eventName] = this._handlers[eventName].filter(
            (handler) => handler.proxy !== proxy
          )),
            this._handlers[eventName].length === 0 &&
              delete this._handlers[eventName]);
        });
      },
      _serialize(data) {
        return utils.is.nil(data)
          ? null
          : JSON.stringify(data, (key, value) => {
              if (utils.is.blob(value)) {
                if (this._is('bg')) {
                  const blobId = this._generateId();
                  return (
                    (this._blobs[blobId] = value),
                    `bus.blob.${blobId}`
                  );
                }
                return `bus.blob.${utils.objectUrl.create(value, !0)}`;
              }
              return utils.is.error(value)
                ? `bus.error.${value.message}`
                : value;
            });
      },
      async _deserialize(jsonString) {
        if (!utils.is.string(jsonString)) return null;
        const blobMap = new Map(),
          parsedObject = JSON.parse(jsonString, (key, value) => {
            const isString = utils.is.string(value);
            return isString && value.startsWith('bus.blob.')
              ? (blobMap.set(value, value.slice('bus.blob.'.length)), value)
              : isString && value.startsWith('bus.error.')
                ? new Error(value.slice('bus.error.'.length))
                : value;
          });
        return (
          await Promise.all(
            [...blobMap.keys()].map(async (blobKey) => {
              let objectUrl;
              const blobIdentifier = blobMap.get(blobKey);
              objectUrl = blobIdentifier.startsWith('blob:')
                ? blobIdentifier
                : await this._sendToExt(
                    'bus.blobIdToObjectUrl',
                    blobIdentifier
                  );
              const blob = await fetch(objectUrl).then((response) =>
                response.blob()
              );
              blobMap.set(blobKey, blob);
            })
          ),
          this._applyBlobs(parsedObject, blobMap)
        );
      },
      _applyBlobs(data, blobMap) {
        if (blobMap.has(data)) return blobMap.get(data);
        if (utils.is.array(data) || utils.is.object(data))
          for (const key in data)
            data[key] = this._applyBlobs(data[key], blobMap);
        return data;
      },
      async _blobIdToObjectUrl(blobId) {},
      async _blobToObjectUrl(blob) {},
      _is(...loci) {
        return loci.includes(this._locus);
      },
      _isBusMsg: (message) =>
        message && message.$bus && message.appName === htosApp.name,
      _createBusMsg: (props) => ({
        $bus: !0,
        appName: htosApp.name,
        ...props,
      }),
      _generateId: () =>
        `bus-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      _wrapThrowIfError(fn) {
        return async (...args) => {
          const result = await fn.call(this, ...args);
          if (utils.is.error(result)) throw result;
          return result;
        };
      },
      _pick: async (promises = []) =>
        promises.length === 0
          ? null
          : await new Promise((resolve) => {
              let resolvedCount = 0;
              promises.forEach(async (promise) => {
                const result = await promise;
                return utils.is.nil(result)
                  ? resolvedCount === promises.length - 1
                    ? resolve(null)
                    : void resolvedCount++
                  : resolve(result);
              });
            }),
    };
  })(),
  (() => {
    const { $env: env } = htosApp;
    env.getLocus = () => {
      const {
        protocol: protocol,
        host: host,
        pathname: pathname,
        href: href,
      } = location;
      // Renamed from HTOS URL
      return href === 'https://htos.io/oi' ||
        href === 'http://localhost:3000/oi' ||
        pathname === '/oi.html'
        ? 'oi'
        : protocol !== 'chrome-extension:' && chrome?.runtime?.getURL
          ? 'cs'
          : host === 'localhost:3050'
            ? 'fg'
            : protocol !== 'chrome-extension:'
              ? 'nj'
              : pathname === '/ui/index.html'
                ? 'pp'
                : pathname === '/offscreen.html'
                  ? 'os'
                  : 'bg';
    };
  })(),
  (() => {
    const { $startup: startup, $bus: bus, $ai: ai } = htosApp;
    ((startup.controller = {
      async init() {
        // 1. Initialize the bus so it can listen for messages.
        await bus.controller.init();
        
        // 2. Initialize the AI/Arkose controller.
        await ai.controller.init();

        // 3. Set up the listener to respond to pings from os.js.
        //    This is the ONLY part of the handshake this script is responsible for.
        bus.on('startup.oiReady', () => {
          console.log('[oi.js] Received startup.oiReady ping, responding with ack.');
          return true;
        });

        startup.logDev('oi ready and listening for pings');
      },
    }),
      startup.controller.init());
  }))();

/* END FULL ORIGINAL LOGIC */

// 3. GENERALIZATION & RENAMING
// Renaming has been applied inline throughout the code. Key changes include:
// - `HTOS1APP` -> `htosApp`
// - `__app_HTOS` -> `__htos_global`
// - `'https://HTOS1.ai/oi'` -> `'https://htos.io/oi'`

// 4. MODULE EXPORTS
// Export the main app object for potential integration into the HTOS runtime.
// The script's primary effect is creating a global `htosApp` object, which is
// preserved to maintain functionality.
export { htosApp };

// 5. DEFERRED CLEANUP FLAGS
// TODO: Review bus.controller for replacement with a generic HTOS message bus.
// TODO: Gut ai.arkoseController and replace with a generic proof-of-work engine adapter.
// TODO: Extract the self-contained WASM hasher into a standalone utility.
// TODO: Port Tier 1 utilities ($utils) into individual modules in the HTOS utils directory.
