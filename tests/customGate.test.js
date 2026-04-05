import { describe, it, expect } from 'vitest';
import { CustomGateDefinition, initCustomGateEngine, CUSTOM_GATE_ICONS, getPresetTemplates } from '../model/customGate.js';
import { QuantumEngine } from '../sim/statevector.js';
import { cAbs2 } from '../sim/complex.js';

const near = (a, b) => expect(a).toBeCloseTo(b, 9);
const S2 = Math.SQRT1_2;

// Initialize the engine module (required for unitary matrix computation)
initCustomGateEngine({ QuantumEngine });

// ─── CustomGateDefinition basics ──────────────────────────
describe('CustomGateDefinition', () => {
  it('creates with default values', () => {
    const def = new CustomGateDefinition({ name: 'Test' });
    expect(def.name).toBe('Test');
    expect(def.numQubits).toBe(1);
    expect(def.defaultControls).toBe(0);
    expect(def.id).toMatch(/^custom_/);
  });

  it('serializes and deserializes', () => {
    const def = new CustomGateDefinition({
      name: 'MyGate',
      icon: 'star',
      color: '#ff0000',
      numQubits: 2,
      defaultControls: 1,
    });
    const json = def.serialize();
    const def2 = CustomGateDefinition.deserialize(json);
    expect(def2.name).toBe('MyGate');
    expect(def2.icon).toBe('star');
    expect(def2.numQubits).toBe(2);
    expect(def2.defaultControls).toBe(1);
  });

  it('returns correct icon symbol', () => {
    const def = new CustomGateDefinition({ icon: 'star' });
    expect(def.iconSymbol).toBe('★');
  });

  it('returns diamond for unknown icon', () => {
    const def = new CustomGateDefinition({ icon: 'unknown' });
    expect(def.iconSymbol).toBe('◆');
  });
});

// ─── Unitary matrix computation ───────────────────────────
describe('Unitary matrix computation', () => {
  it('empty sub-circuit gives identity matrix', () => {
    const def = new CustomGateDefinition({
      numQubits: 1,
      subCircuit: { numQubits: 1, numCols: 2, gates: [] },
    });
    const U = def.getUnitaryMatrix();
    expect(U.length).toBe(2);
    // Identity: [[1,0],[0,1]]
    near(U[0][0][0], 1);
    near(U[0][1][0], 0);
    near(U[1][0][0], 0);
    near(U[1][1][0], 1);
  });

  it('X sub-circuit gives X matrix', () => {
    const def = new CustomGateDefinition({
      numQubits: 1,
      subCircuit: {
        numQubits: 1,
        numCols: 2,
        gates: [{ type: 'X', targets: [0], controls: [], params: {}, col: 0 }],
      },
    });
    const U = def.getUnitaryMatrix();
    near(U[0][0][0], 0);
    near(U[0][1][0], 1);
    near(U[1][0][0], 1);
    near(U[1][1][0], 0);
  });

  it('H sub-circuit gives Hadamard matrix', () => {
    const def = new CustomGateDefinition({
      numQubits: 1,
      subCircuit: {
        numQubits: 1,
        numCols: 2,
        gates: [{ type: 'H', targets: [0], controls: [], params: {}, col: 0 }],
      },
    });
    const U = def.getUnitaryMatrix();
    near(U[0][0][0], S2);
    near(U[0][1][0], S2);
    near(U[1][0][0], S2);
    near(U[1][1][0], -S2);
  });

  it('cached matrix is returned on second call', () => {
    const def = new CustomGateDefinition({
      numQubits: 1,
      subCircuit: {
        numQubits: 1,
        numCols: 2,
        gates: [{ type: 'H', targets: [0], controls: [], params: {}, col: 0 }],
      },
    });
    const U1 = def.getUnitaryMatrix();
    const U2 = def.getUnitaryMatrix();
    expect(U1).toBe(U2); // same reference
  });

  it('invalidateMatrix forces recomputation', () => {
    const def = new CustomGateDefinition({
      numQubits: 1,
      subCircuit: {
        numQubits: 1,
        numCols: 2,
        gates: [{ type: 'H', targets: [0], controls: [], params: {}, col: 0 }],
      },
    });
    const U1 = def.getUnitaryMatrix();
    def.invalidateMatrix();
    const U2 = def.getUnitaryMatrix();
    expect(U1).not.toBe(U2);
    // But values should be the same
    near(U1[0][0][0], U2[0][0][0]);
  });
});

// ─── Adjoint matrix ───────────────────────────────────────
describe('Adjoint matrix (U†)', () => {
  it('X† = X (self-adjoint)', () => {
    const def = new CustomGateDefinition({
      numQubits: 1,
      subCircuit: {
        numQubits: 1,
        numCols: 2,
        gates: [{ type: 'X', targets: [0], controls: [], params: {}, col: 0 }],
      },
    });
    const U = def.getUnitaryMatrix();
    const Udag = def.getAdjointMatrix();
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        near(U[i][j][0], Udag[i][j][0]);
        near(U[i][j][1], Udag[i][j][1]);
      }
    }
  });

  it('U * U† = I (unitarity check for H)', () => {
    const def = new CustomGateDefinition({
      numQubits: 1,
      subCircuit: {
        numQubits: 1,
        numCols: 2,
        gates: [{ type: 'H', targets: [0], controls: [], params: {}, col: 0 }],
      },
    });
    const U = def.getUnitaryMatrix();
    const Udag = def.getAdjointMatrix();

    // Multiply U * Udag and check it equals I
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        let re = 0, im = 0;
        for (let k = 0; k < 2; k++) {
          // (a+bi)(c+di) = (ac-bd) + (ad+bc)i
          re += U[i][k][0] * Udag[k][j][0] - U[i][k][1] * Udag[k][j][1];
          im += U[i][k][0] * Udag[k][j][1] + U[i][k][1] * Udag[k][j][0];
        }
        near(re, i === j ? 1 : 0);
        near(im, 0);
      }
    }
  });
});

// ─── Preset templates ─────────────────────────────────────
describe('Preset templates', () => {
  it('returns Toffoli, QFT2, SqrtX', () => {
    const presets = getPresetTemplates();
    const names = presets.map(p => p.name);
    expect(names).toContain('Toffoli');
    expect(names).toContain('QFT2');
    expect(names).toContain('SqrtX');
  });

  it('Toffoli has 2 default controls', () => {
    const toffoli = getPresetTemplates().find(p => p.name === 'Toffoli');
    expect(toffoli.defaultControls).toBe(2);
    expect(toffoli.numQubits).toBe(1);
  });

  it('SqrtX sub-circuit uses Rx(pi/2)', () => {
    const sqrtx = getPresetTemplates().find(p => p.name === 'SqrtX');
    expect(sqrtx.subCircuit.gates[0].type).toBe('Rx');
    near(sqrtx.subCircuit.gates[0].params.theta, Math.PI / 2);
  });
});

// ─── CUSTOM_GATE_ICONS ────────────────────────────────────
describe('CUSTOM_GATE_ICONS', () => {
  it('has 10 icon options', () => {
    expect(CUSTOM_GATE_ICONS.length).toBe(10);
  });

  it('each icon has id, symbol, and label', () => {
    for (const icon of CUSTOM_GATE_ICONS) {
      expect(icon.id).toBeTruthy();
      expect(icon.symbol).toBeTruthy();
      expect(icon.label).toBeTruthy();
    }
  });
});
