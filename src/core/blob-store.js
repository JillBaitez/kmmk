/**
 * HTOS Blob Store
 * - Provides serialization helpers used by the Bus (message passing across contexts)
 * - Compatible with existing BusController patterns
 *
 * Build-phase safe: emitted to dist/core/*
 */
// Build-phase safe: emitted to dist/core/*
export class HTOSBlobStore {
    // Serialize data compatible with BusController patterns
    static serialize(data, context = 'bg') {
        if (data === null || data === undefined)
            return null;
        const replacer = (_key, value) => {
            // Handle Blobs like BusController does
            if (value instanceof Blob) {
                if (context === 'bg') {
                    const newId = this._generateId();
                    this._blobs[newId] = value;
                    return `bus.blob.${newId}`;
                }
                // For other contexts, create object URL
                const objectUrl = URL.createObjectURL(value);
                return `bus.blob.${objectUrl}`;
            }
            // Handle Errors like BusController does
            if (value instanceof Error) {
                return `bus.error.${value.message}`;
            }
            // Handle custom serializable objects
            if (value && typeof value.serialize === 'function') {
                try {
                    return { __htos: true, value: value.serialize() };
                }
                catch {
                    /* ignore serialization errors */
                }
            }
            // Handle typed arrays
            if (value instanceof ArrayBuffer) {
                return { __arrayBuffer: true, value: Array.from(new Uint8Array(value)) };
            }
            if (value instanceof Uint8Array) {
                return { __uint8: true, value: Array.from(value) };
            }
            return value;
        };
        return JSON.stringify(data, replacer);
    }
    // Deserialize compatible with BusController patterns  
    static async deserialize(jsonString) {
        if (typeof jsonString !== 'string')
            return null;
        const blobMap = new Map();
        const reviver = (_key, value) => {
            if (typeof value === 'string') {
                // Handle bus.blob.* patterns
                if (value.startsWith('bus.blob.')) {
                    const blobId = value.slice('bus.blob.'.length);
                    blobMap.set(value, blobId);
                    return value;
                }
                // Handle bus.error.* patterns
                if (value.startsWith('bus.error.')) {
                    return new Error(value.slice('bus.error.'.length));
                }
            }
            // Handle custom objects
            if (value && value.__htos) {
                return value.value;
            }
            if (value && value.__arrayBuffer) {
                return new Uint8Array(value.value).buffer;
            }
            if (value && value.__uint8) {
                return new Uint8Array(value.value);
            }
            return value;
        };
        const parsed = JSON.parse(jsonString, reviver);
        // Resolve blob references
        if (blobMap.size > 0) {
            await Promise.all([...blobMap.keys()].map(async (blobKey) => {
                const blobId = blobMap.get(blobKey);
                let blob;
                if (blobId.startsWith('blob:')) {
                    // Object URL reference
                    blob = await fetch(blobId).then(r => r.blob());
                }
                else if (this._blobs[blobId]) {
                    // Local blob storage
                    const stored = this._blobs[blobId];
                    blob = stored instanceof Blob ? stored : await fetch(stored).then(r => r.blob());
                }
                else {
                    // Fallback: empty blob
                    blob = new Blob([]);
                }
                blobMap.set(blobKey, blob);
            }));
            return this._applyBlobs(parsed, blobMap);
        }
        return parsed;
    }
    // Apply resolved blobs back to object tree
    static _applyBlobs(obj, blobMap) {
        if (blobMap.has(obj))
            return blobMap.get(obj);
        if (Array.isArray(obj) || (obj && typeof obj === 'object')) {
            for (const key in obj) {
                obj[key] = this._applyBlobs(obj[key], blobMap);
            }
        }
        return obj;
    }
    // Blob storage management
    static setBlobById(id, blob) {
        this._blobs[id] = blob;
    }
    static getBlobById(id) {
        return this._blobs[id];
    }
    static clearBlob(id) {
        delete this._blobs[id];
    }
}
HTOSBlobStore._blobs = {};
HTOSBlobStore._generateId = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
// Build-phase safe: CommonJS compatibility
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { HTOSBlobStore };
}
