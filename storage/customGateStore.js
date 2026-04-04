// ============================================================
// storage/customGateStore.js — Persistent Custom Gate Storage
// ============================================================

import { CustomGateDefinition } from '../model/customGate.js';

const STORAGE_KEY = 'quantum-circuit-custom-gates';

/**
 * Manages saving, loading, and deleting custom gate definitions
 * in localStorage.
 */
export class CustomGateStore {
    constructor() {
        this._cache = null; // Map<id, CustomGateDefinition>
    }

    /**
     * Load all custom gates from localStorage.
     * @returns {Map<string, CustomGateDefinition>}
     */
    loadAll() {
        if (this._cache) return this._cache;

        this._cache = new Map();
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const arr = JSON.parse(raw);
                for (const data of arr) {
                    const def = CustomGateDefinition.deserialize(data);
                    this._cache.set(def.id, def);
                }
            }
        } catch (e) {
            console.warn('[CustomGateStore] Failed to load:', e);
        }
        return this._cache;
    }

    /**
     * Save a custom gate definition (add or update).
     * @param {CustomGateDefinition} def
     */
    save(def) {
        const map = this.loadAll();
        map.set(def.id, def);
        this._persist();
    }

    /**
     * Delete a custom gate by ID.
     * @param {string} id
     * @returns {boolean} true if existed and was deleted
     */
    delete(id) {
        const map = this.loadAll();
        const existed = map.delete(id);
        if (existed) this._persist();
        return existed;
    }

    /**
     * Get a single custom gate by ID.
     * @param {string} id
     * @returns {CustomGateDefinition|undefined}
     */
    get(id) {
        return this.loadAll().get(id);
    }

    /**
     * Get all definitions as an array.
     * @returns {CustomGateDefinition[]}
     */
    getAll() {
        return [...this.loadAll().values()];
    }

    /**
     * Export all custom gates as a JSON string.
     * @returns {string}
     */
    exportJSON() {
        const arr = this.getAll().map(d => d.serialize());
        return JSON.stringify(arr, null, 2);
    }

    /**
     * Import custom gates from a JSON string.
     * Merges with existing gates (overwrites on ID collision).
     * @param {string} jsonStr
     * @returns {number} Number of imported gates
     */
    importJSON(jsonStr) {
        try {
            const arr = JSON.parse(jsonStr);
            if (!Array.isArray(arr)) throw new Error('Expected array');

            let count = 0;
            for (const data of arr) {
                if (!data.name || !data.subCircuit) continue;
                // Assign new ID to avoid collisions
                data.id = 'custom_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
                const def = CustomGateDefinition.deserialize(data);
                this.save(def);
                count++;
            }
            return count;
        } catch (e) {
            console.error('[CustomGateStore] Import failed:', e);
            throw new Error('Invalid JSON format');
        }
    }

    /** Persist to localStorage */
    _persist() {
        try {
            const arr = this.getAll().map(d => d.serialize());
            localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
        } catch (e) {
            console.error('[CustomGateStore] Failed to save:', e);
        }
    }

    /** Clear cache (for testing) */
    clearCache() {
        this._cache = null;
    }
}
