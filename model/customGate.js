// ============================================================
// model/customGate.js — Custom Gate Data Model & Matrix Computation
// ============================================================

import { Gate, GATE_QUBIT_COUNT } from './circuit.js';
import { cMul, cAdd } from '../sim/complex.js';

// ─── Icon options for custom gates ─────────────────────────
export const CUSTOM_GATE_ICONS = [
    { id: 'diamond', symbol: '◆', label: 'Diamond' },
    { id: 'star',    symbol: '★', label: 'Star' },
    { id: 'triangle', symbol: '▲', label: 'Triangle' },
    { id: 'circle',  symbol: '●', label: 'Circle' },
    { id: 'diamond_outline', symbol: '◇', label: 'Diamond Outline' },
    { id: 'star_outline', symbol: '☆', label: 'Star Outline' },
    { id: 'hexagon', symbol: '⬡', label: 'Hexagon' },
    { id: 'square',  symbol: '■', label: 'Square' },
    { id: 'heart',   symbol: '♥', label: 'Heart' },
    { id: 'spade',   symbol: '♠', label: 'Spade' },
];

// ─── Preset templates ──────────────────────────────────────

/**
 * Returns preset custom gate templates.
 * Each is a serialized CustomGateDefinition.
 */
export function getPresetTemplates() {
    return [
        {
            name: 'Toffoli',
            icon: 'diamond',
            color: '#e74c3c',
            numQubits: 1,
            // CCX = Toffoli: two controls + X target
            // Represented as sub-circuit: single X gate on q0
            subCircuit: {
                numQubits: 1,
                numCols: 2,
                gates: [{ type: 'X', targets: [0], controls: [], params: {}, col: 0 }]
            },
            defaultControls: 2, // CC-U: 2 controls by default
        },
        {
            name: 'QFT2',
            icon: 'star',
            color: '#9b59b6',
            numQubits: 2,
            subCircuit: {
                numQubits: 2,
                numCols: 4,
                gates: [
                    { type: 'H', targets: [0], controls: [], params: {}, col: 0 },
                    { type: 'S', targets: [0], controls: [1], params: {}, col: 1 },
                    { type: 'H', targets: [1], controls: [], params: {}, col: 2 },
                    { type: 'SWAP', targets: [0, 1], controls: [], params: {}, col: 3 },
                ]
            },
            defaultControls: 0,
        },
        {
            name: 'SqrtX',
            icon: 'circle',
            color: '#e67e22',
            numQubits: 1,
            subCircuit: {
                numQubits: 1,
                numCols: 2,
                gates: [
                    { type: 'Rx', targets: [0], controls: [], params: { theta: Math.PI / 2 }, col: 0 },
                ]
            },
            defaultControls: 0,
        },
    ];
}

// ─── CustomGateDefinition ──────────────────────────────────

/**
 * A custom gate definition — stores the sub-circuit and
 * computes the unitary matrix once.
 */
export class CustomGateDefinition {
    /**
     * @param {Object} opts
     * @param {string} opts.id         Unique ID (auto-generated if not provided)
     * @param {string} opts.name       Display name
     * @param {string} opts.icon       Icon ID from CUSTOM_GATE_ICONS
     * @param {string} opts.color      Hex color
     * @param {number} opts.numQubits  Number of qubits in U part
     * @param {Object} opts.subCircuit Serialized sub-circuit { numQubits, numCols, gates[] }
     * @param {number} opts.defaultControls  Default number of control qubits (0 = no control)
     */
    constructor(opts) {
        this.id = opts.id || 'custom_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        this.name = opts.name || 'Custom';
        this.icon = opts.icon || 'diamond';
        this.color = opts.color || '#22d3ee';
        this.numQubits = opts.numQubits || 1;
        this.subCircuit = opts.subCircuit || { numQubits: 1, numCols: 2, gates: [] };
        this.defaultControls = opts.defaultControls || 0;
        this._unitaryMatrix = null; // Lazy computed
    }

    /** Get the icon symbol character */
    get iconSymbol() {
        const entry = CUSTOM_GATE_ICONS.find(i => i.id === this.icon);
        return entry ? entry.symbol : '◆';
    }

    /**
     * Compute the unitary matrix of the sub-circuit.
     * Returns a 2D array [dim][dim] of [re, im] pairs.
     * @returns {[number,number][][]}
     */
    getUnitaryMatrix() {
        if (this._unitaryMatrix) return this._unitaryMatrix;
        this._unitaryMatrix = computeSubCircuitUnitary(this.subCircuit);
        return this._unitaryMatrix;
    }

    /** Invalidate cached matrix (call after sub-circuit changes) */
    invalidateMatrix() {
        this._unitaryMatrix = null;
    }

    /**
     * Compute the adjoint (U†) unitary matrix.
     * U† = conjugate transpose of U.
     * @returns {[number,number][][]}
     */
    getAdjointMatrix() {
        const U = this.getUnitaryMatrix();
        const dim = U.length;
        const Udag = Array.from({ length: dim }, () => Array(dim).fill([0, 0]));
        for (let i = 0; i < dim; i++) {
            for (let j = 0; j < dim; j++) {
                // Transpose + conjugate: Udag[i][j] = conj(U[j][i])
                Udag[i][j] = [U[j][i][0], -U[j][i][1]];
            }
        }
        return Udag;
    }

    /** Serialize to plain object for storage */
    serialize() {
        return {
            id: this.id,
            name: this.name,
            icon: this.icon,
            color: this.color,
            numQubits: this.numQubits,
            subCircuit: this.subCircuit,
            defaultControls: this.defaultControls,
        };
    }

    /** Recreate from plain object */
    static deserialize(data) {
        return new CustomGateDefinition(data);
    }
}

// ─── Unitary matrix computation ────────────────────────────

/**
 * Compute the unitary matrix of a sub-circuit by applying each gate
 * column by column to each standard basis state.
 *
 * Method: For each basis vector |k⟩, simulate the circuit to get U|k⟩.
 * The k-th column of U is the result.
 *
 * @param {Object} subCircuit  { numQubits, numCols, gates[] }
 * @returns {[number,number][][]}  dim x dim unitary matrix
 */
function computeSubCircuitUnitary(subCircuit) {
    // Lazy import to avoid circular dependency
    const { QuantumEngine } = getEngineModule();

    const n = subCircuit.numQubits;
    const dim = 1 << n;
    const U = Array.from({ length: dim }, () =>
        Array.from({ length: dim }, () => [0, 0])
    );

    // Build a minimal Circuit-like object for the engine
    const mockCircuit = {
        numQubits: n,
        numCols: subCircuit.numCols || 2,
        getGatesAtCol(col) {
            return subCircuit.gates
                .filter(g => g.col === col)
                .map(g => new Gate(g.type, g.targets, g.controls, g.params, g.col));
        }
    };

    const engine = new QuantumEngine();

    for (let k = 0; k < dim; k++) {
        // Create basis vector |k⟩
        const basisState = Array.from({ length: dim }, (_, i) =>
            i === k ? [1, 0] : [0, 0]
        );

        // Create InputState-like object
        const inputState = {
            isMixed: false,
            toStateVector() { return basisState; }
        };

        // Simulate
        const history = engine.simulate(mockCircuit, inputState, 'probability');
        const finalState = history[history.length - 1].stateVector;

        // k-th column of U = finalState
        for (let i = 0; i < dim; i++) {
            U[i][k] = [finalState[i][0], finalState[i][1]];
        }
    }

    return U;
}

// Lazy engine import helper (avoids circular imports)
let _cachedEngineModule = null;
function getEngineModule() {
    if (!_cachedEngineModule) {
        // Dynamic import workaround: we cache after first call
        // This will be set by the init function
        throw new Error('Engine module not initialized. Call initCustomGateEngine() first.');
    }
    return _cachedEngineModule;
}

/**
 * Initialize the custom gate module with the engine reference.
 * Must be called once at app startup.
 * @param {{ QuantumEngine: typeof import('../sim/statevector.js').QuantumEngine }} engineModule
 */
export function initCustomGateEngine(engineModule) {
    _cachedEngineModule = engineModule;
}
