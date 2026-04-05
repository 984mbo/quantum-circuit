import { describe, it, expect } from 'vitest';
import { QuantumEngine } from '../sim/statevector.js';
import { Circuit, Gate, InputState, registerCustomGate, unregisterCustomGate } from '../model/circuit.js';
import { CustomGateDefinition, initCustomGateEngine } from '../model/customGate.js';
import { cAbs2 } from '../sim/complex.js';

// Initialize custom gate engine (required for C-U tests)
initCustomGateEngine({ QuantumEngine });

const near = (a, b, tol = 1e-9) => expect(a).toBeCloseTo(b, 9);
const S2 = Math.SQRT1_2;

/** Helper: create circuit, simulate in probability mode, return final state */
function simFinal(numQubits, gateSpecs, inputVec = null) {
  const c = new Circuit(numQubits, gateSpecs.length + 2);
  for (const [type, targets, controls, params, col] of gateSpecs) {
    c.addGate(new Gate(type, targets, controls || [], params || {}, col));
  }
  const input = new InputState(numQubits);
  if (inputVec) input.setVector(inputVec);
  const engine = new QuantumEngine();
  const steps = engine.simulate(c, input, 'probability');
  return steps[steps.length - 1].stateVector;
}

/** Helper: probability of basis state */
function prob(state, idx) {
  return cAbs2(state[idx][0], state[idx][1]);
}

/** Helper: state norm */
function stateNorm(state) {
  return state.reduce((s, [re, im]) => s + re * re + im * im, 0);
}

// ─── Identity ─────────────────────────────────────────────
describe('Identity gate', () => {
  it('I on |0> gives |0>', () => {
    const sv = simFinal(1, [['I', [0], [], {}, 0]]);
    near(sv[0][0], 1);
    near(sv[1][0], 0);
  });
});

// ─── Pauli Gates ──────────────────────────────────────────
describe('Pauli gates', () => {
  it('X on |0> gives |1>', () => {
    const sv = simFinal(1, [['X', [0], [], {}, 0]]);
    near(sv[0][0], 0);
    near(sv[1][0], 1);
  });

  it('X on |1> gives |0>', () => {
    const sv = simFinal(1, [['X', [0], [], {}, 0]], [[0, 0], [1, 0]]);
    near(sv[0][0], 1);
    near(sv[1][0], 0);
  });

  it('XX = I (X applied twice)', () => {
    const sv = simFinal(1, [
      ['X', [0], [], {}, 0],
      ['X', [0], [], {}, 1],
    ]);
    near(sv[0][0], 1);
    near(sv[1][0], 0);
  });

  it('Y on |0> gives i|1>', () => {
    const sv = simFinal(1, [['Y', [0], [], {}, 0]]);
    near(sv[0][0], 0);
    near(sv[0][1], 0);
    near(sv[1][0], 0);
    near(sv[1][1], 1); // i
  });

  it('Z on |0> gives |0>', () => {
    const sv = simFinal(1, [['Z', [0], [], {}, 0]]);
    near(sv[0][0], 1);
  });

  it('Z on |1> gives -|1>', () => {
    const sv = simFinal(1, [['Z', [0], [], {}, 0]], [[0, 0], [1, 0]]);
    near(sv[1][0], -1);
  });
});

// ─── Hadamard ─────────────────────────────────────────────
describe('Hadamard gate', () => {
  it('H on |0> gives |+> = (|0>+|1>)/sqrt(2)', () => {
    const sv = simFinal(1, [['H', [0], [], {}, 0]]);
    near(sv[0][0], S2);
    near(sv[1][0], S2);
  });

  it('H on |1> gives |-> = (|0>-|1>)/sqrt(2)', () => {
    const sv = simFinal(1, [['H', [0], [], {}, 0]], [[0, 0], [1, 0]]);
    near(sv[0][0], S2);
    near(sv[1][0], -S2);
  });

  it('HH = I', () => {
    const sv = simFinal(1, [
      ['H', [0], [], {}, 0],
      ['H', [0], [], {}, 1],
    ]);
    near(sv[0][0], 1);
    near(sv[1][0], 0);
  });
});

// ─── S and T Gates ────────────────────────────────────────
describe('S and T gates', () => {
  it('S on |1> gives i|1>', () => {
    const sv = simFinal(1, [['S', [0], [], {}, 0]], [[0, 0], [1, 0]]);
    near(sv[0][0], 0);
    near(sv[1][0], 0);
    near(sv[1][1], 1);
  });

  it('SS = Z', () => {
    // S^2|1> = S(i|1>) = i*i|1> = -|1> = Z|1>
    const sv = simFinal(1, [
      ['S', [0], [], {}, 0],
      ['S', [0], [], {}, 1],
    ], [[0, 0], [1, 0]]);
    near(sv[1][0], -1);
    near(sv[1][1], 0);
  });

  it('T on |1> gives e^(i*pi/4)|1>', () => {
    const sv = simFinal(1, [['T', [0], [], {}, 0]], [[0, 0], [1, 0]]);
    near(sv[1][0], S2);
    near(sv[1][1], S2);
  });

  it('TT = S', () => {
    const sv = simFinal(1, [
      ['T', [0], [], {}, 0],
      ['T', [0], [], {}, 1],
    ], [[0, 0], [1, 0]]);
    near(sv[1][0], 0);
    near(sv[1][1], 1);
  });
});

// ─── Rotation Gates ──────────────────────────────────────
describe('Rotation gates', () => {
  it('Rx(pi) on |0> gives -i|1>', () => {
    const sv = simFinal(1, [['Rx', [0], [], { theta: Math.PI }, 0]]);
    near(prob(sv, 0), 0);
    near(prob(sv, 1), 1);
  });

  it('Ry(pi) on |0> gives |1>', () => {
    const sv = simFinal(1, [['Ry', [0], [], { theta: Math.PI }, 0]]);
    near(prob(sv, 0), 0);
    near(prob(sv, 1), 1);
  });

  it('Rz(pi) on |0> gives e^(-i*pi/2)|0>', () => {
    const sv = simFinal(1, [['Rz', [0], [], { theta: Math.PI }, 0]]);
    near(prob(sv, 0), 1);
    near(prob(sv, 1), 0);
  });

  it('Rx(0) is identity', () => {
    const sv = simFinal(1, [['Rx', [0], [], { theta: 0 }, 0]]);
    near(sv[0][0], 1);
    near(sv[1][0], 0);
  });

  it('Ry(pi/2) on |0> gives equal superposition', () => {
    const sv = simFinal(1, [['Ry', [0], [], { theta: Math.PI / 2 }, 0]]);
    near(prob(sv, 0), 0.5);
    near(prob(sv, 1), 0.5);
  });

  it('rotation gates preserve norm', () => {
    const sv = simFinal(1, [['Rx', [0], [], { theta: 1.23 }, 0]]);
    near(stateNorm(sv), 1);
  });
});

// ─── CNOT (CX) ────────────────────────────────────────────
describe('CNOT gate', () => {
  it('CX on |00> gives |00> (control=0, no flip)', () => {
    const sv = simFinal(2, [['CX', [1], [0], {}, 0]]);
    near(sv[0][0], 1); // |00>
  });

  it('CX on |10> gives |11> (control=1, flip target)', () => {
    const sv = simFinal(2, [['CX', [1], [0], {}, 0]], [[0, 0], [1, 0], [0, 0], [0, 0]]);
    // |10> = index 1 (q0=1, q1=0) → |11> = index 3
    near(sv[3][0], 1);
  });

  it('Bell state: H(q0) → CX(q0→q1) on |00>', () => {
    const sv = simFinal(2, [
      ['H', [0], [], {}, 0],
      ['CX', [1], [0], {}, 1],
    ]);
    // (|00> + |11>) / sqrt(2)
    near(sv[0][0], S2);  // |00>
    near(sv[3][0], S2);  // |11>
    near(sv[1][0], 0);
    near(sv[2][0], 0);
  });
});

// ─── CZ ───────────────────────────────────────────────────
describe('CZ gate', () => {
  it('CZ on |11> gives -|11>', () => {
    const sv = simFinal(2, [['CZ', [1], [0], {}, 0]], [[0, 0], [0, 0], [0, 0], [1, 0]]);
    near(sv[3][0], -1);
  });

  it('CZ on |10> gives |10> (no phase)', () => {
    const sv = simFinal(2, [['CZ', [1], [0], {}, 0]], [[0, 0], [1, 0], [0, 0], [0, 0]]);
    near(sv[1][0], 1);
  });
});

// ─── SWAP ─────────────────────────────────────────────────
describe('SWAP gate', () => {
  it('SWAP on |10> gives |01>', () => {
    // |10> q0=1,q1=0 → index 1. After swap: q0=0,q1=1 → index 2
    const sv = simFinal(2, [['SWAP', [0, 1], [], {}, 0]], [[0, 0], [1, 0], [0, 0], [0, 0]]);
    near(sv[2][0], 1);
  });

  it('SWAP twice is identity', () => {
    const sv = simFinal(2, [
      ['SWAP', [0, 1], [], {}, 0],
      ['SWAP', [0, 1], [], {}, 1],
    ], [[0, 0], [1, 0], [0, 0], [0, 0]]);
    near(sv[1][0], 1);
  });
});

// ─── Multi-qubit circuits ─────────────────────────────────
describe('Multi-qubit circuits', () => {
  it('GHZ state: H → CX → CX on 3 qubits', () => {
    const sv = simFinal(3, [
      ['H', [0], [], {}, 0],
      ['CX', [1], [0], {}, 1],
      ['CX', [2], [1], {}, 2],
    ]);
    // (|000> + |111>) / sqrt(2)
    near(sv[0][0], S2);
    near(sv[7][0], S2);
    for (let i = 1; i < 7; i++) {
      near(prob(sv, i), 0);
    }
  });

  it('preserves normalization for complex circuits', () => {
    const sv = simFinal(2, [
      ['H', [0], [], {}, 0],
      ['H', [1], [], {}, 0],
      ['CX', [1], [0], {}, 1],
      ['H', [0], [], {}, 2],
    ]);
    near(stateNorm(sv), 1);
  });
});

// ─── Simulation history ───────────────────────────────────
describe('Simulation history', () => {
  it('returns numCols + 1 steps (initial + per column)', () => {
    const c = new Circuit(1, 3);
    c.addGate(new Gate('H', [0], [], {}, 0));
    const input = new InputState(1);
    const engine = new QuantumEngine();
    const steps = engine.simulate(c, input, 'probability');
    expect(steps.length).toBe(4); // initial + 3 columns
    expect(steps[0].col).toBe(-1);
    expect(steps[1].col).toBe(0);
  });
});

// ─── Measurement ──────────────────────────────────────────
describe('Measurement', () => {
  it('probability mode: H|0> gives 50/50 probabilities', () => {
    const c = new Circuit(1, 3);
    c.addGate(new Gate('H', [0], [], {}, 0));
    c.addGate(new Gate('Measure', [0], [], {}, 1));
    const input = new InputState(1);
    const engine = new QuantumEngine();
    const steps = engine.simulate(c, input, 'probability');
    const mStep = steps[2]; // col 1
    expect(mStep.measurement).not.toBeNull();
    near(mStep.measurement.probabilities['0'], 0.5);
    near(mStep.measurement.probabilities['1'], 0.5);
  });

  it('probability mode: |0> gives 100% |0>', () => {
    const c = new Circuit(1, 3);
    c.addGate(new Gate('Measure', [0], [], {}, 0));
    const input = new InputState(1);
    const engine = new QuantumEngine();
    const steps = engine.simulate(c, input, 'probability');
    const mStep = steps[1];
    near(mStep.measurement.probabilities['0'], 1);
    near(mStep.measurement.probabilities['1'], 0);
  });
});

// ─── runShots ─────────────────────────────────────────────
describe('runShots', () => {
  it('deterministic |0> state always gives "0"', () => {
    const c = new Circuit(1, 3);
    const input = new InputState(1);
    const engine = new QuantumEngine();
    const counts = engine.runShots(c, input, 100);
    expect(counts['0']).toBe(100);
    expect(counts['1']).toBeUndefined();
  });

  it('H|0> gives roughly 50/50 over many shots', () => {
    const c = new Circuit(1, 3);
    c.addGate(new Gate('H', [0], [], {}, 0));
    const input = new InputState(1);
    const engine = new QuantumEngine();
    const counts = engine.runShots(c, input, 10000);
    const p0 = (counts['0'] || 0) / 10000;
    expect(p0).toBeGreaterThan(0.45);
    expect(p0).toBeLessThan(0.55);
  });

  it('Bell state gives only "00" and "11"', () => {
    const c = new Circuit(2, 6);
    c.addGate(new Gate('H', [0], [], {}, 0));
    c.addGate(new Gate('CX', [1], [0], {}, 1));
    const input = new InputState(2);
    const engine = new QuantumEngine();
    const counts = engine.runShots(c, input, 1000);
    expect(counts['01']).toBeUndefined();
    expect(counts['10']).toBeUndefined();
    expect((counts['00'] || 0) + (counts['11'] || 0)).toBe(1000);
  });

  it('seeded RNG produces reproducible results', () => {
    const c = new Circuit(1, 3);
    c.addGate(new Gate('H', [0], [], {}, 0));
    const input = new InputState(1);

    const e1 = new QuantumEngine();
    e1.seed = 42;
    const c1 = e1.runShots(c, input, 100);

    const e2 = new QuantumEngine();
    e2.seed = 42;
    const c2 = e2.runShots(c, input, 100);

    expect(c1).toEqual(c2);
  });
});

// ─── Custom Gate (C-U) ────────────────────────────────────
describe('Custom Gate (C-U) simulation', () => {
  // Helper: register a custom gate, run test, then unregister
  function withCustomGate(opts, fn) {
    const def = new CustomGateDefinition(opts);
    registerCustomGate(def);
    try {
      fn(def);
    } finally {
      unregisterCustomGate(def.id);
    }
  }

  // Helper: simulate with a custom gate in the circuit
  function simCustom(numQubits, gateDef, targets, controls, inputVec = null, params = {}) {
    const c = new Circuit(numQubits, 3);
    const g = new Gate(gateDef.id, targets, controls, params, 0);
    c.gates.push(g); // bypass validation (custom gate qubit count may vary)
    const input = new InputState(numQubits);
    if (inputVec) input.setVector(inputVec);
    const engine = new QuantumEngine();
    const steps = engine.simulate(c, input, 'probability');
    return steps[steps.length - 1].stateVector;
  }

  // ─── No-control custom gate (U only) ───────────────────

  it('Custom X gate (no control) on |0> gives |1>', () => {
    withCustomGate({
      id: 'test_x', name: 'TestX', numQubits: 1, defaultControls: 0,
      subCircuit: { numQubits: 1, numCols: 2, gates: [{ type: 'X', targets: [0], controls: [], params: {}, col: 0 }] },
    }, (def) => {
      const sv = simCustom(1, def, [0], []);
      near(sv[0][0], 0);
      near(sv[1][0], 1);
    });
  });

  it('Custom H gate (no control) on |0> gives |+>', () => {
    withCustomGate({
      id: 'test_h', name: 'TestH', numQubits: 1, defaultControls: 0,
      subCircuit: { numQubits: 1, numCols: 2, gates: [{ type: 'H', targets: [0], controls: [], params: {}, col: 0 }] },
    }, (def) => {
      const sv = simCustom(1, def, [0], []);
      near(sv[0][0], S2);
      near(sv[1][0], S2);
    });
  });

  // ─── 1-control C-U gate ─────────────────────────────────

  it('C-X (1 control): control=|1>, target=|0> → flips target', () => {
    withCustomGate({
      id: 'test_cx', name: 'TestCX', numQubits: 1, defaultControls: 1,
      subCircuit: { numQubits: 1, numCols: 2, gates: [{ type: 'X', targets: [0], controls: [], params: {}, col: 0 }] },
    }, (def) => {
      // |10> = q0=1, q1=0 → index 1
      // C-X with control=q0, target=q1 → should flip q1 → |11> = index 3
      const sv = simCustom(2, def, [1], [0], [[0, 0], [1, 0], [0, 0], [0, 0]]);
      near(sv[3][0], 1);
      near(sv[1][0], 0);
    });
  });

  it('C-X (1 control): control=|0> → does NOT flip target', () => {
    withCustomGate({
      id: 'test_cx2', name: 'TestCX2', numQubits: 1, defaultControls: 1,
      subCircuit: { numQubits: 1, numCols: 2, gates: [{ type: 'X', targets: [0], controls: [], params: {}, col: 0 }] },
    }, (def) => {
      // |00> = index 0 → control q0=0 → no flip → stays |00>
      const sv = simCustom(2, def, [1], [0], [[1, 0], [0, 0], [0, 0], [0, 0]]);
      near(sv[0][0], 1);
    });
  });

  it('C-H (1 control): control=|1> applies H to target', () => {
    withCustomGate({
      id: 'test_ch', name: 'TestCH', numQubits: 1, defaultControls: 1,
      subCircuit: { numQubits: 1, numCols: 2, gates: [{ type: 'H', targets: [0], controls: [], params: {}, col: 0 }] },
    }, (def) => {
      // |10> q0=1, q1=0 → control q0=1 → apply H to q1
      // H|0> = (|0>+|1>)/sqrt(2), so result = |1> ⊗ (|0>+|1>)/sqrt(2) = (|10> + |11>)/sqrt(2)
      // |10> = index 1, |11> = index 3
      const sv = simCustom(2, def, [1], [0], [[0, 0], [1, 0], [0, 0], [0, 0]]);
      near(sv[1][0], S2);  // |10>
      near(sv[3][0], S2);  // |11>
      near(sv[0][0], 0);
      near(sv[2][0], 0);
    });
  });

  it('C-H (1 control): control=|0> does NOT apply H', () => {
    withCustomGate({
      id: 'test_ch2', name: 'TestCH2', numQubits: 1, defaultControls: 1,
      subCircuit: { numQubits: 1, numCols: 2, gates: [{ type: 'H', targets: [0], controls: [], params: {}, col: 0 }] },
    }, (def) => {
      // |01> q0=0, q1=1 → control q0=0 → no change → stays |01> = index 2
      const sv = simCustom(2, def, [1], [0], [[0, 0], [0, 0], [1, 0], [0, 0]]);
      near(sv[2][0], 1);
    });
  });

  // ─── 2-control CC-U gate (Toffoli-like) ─────────────────

  it('CC-X (Toffoli): both controls=|1> → flips target', () => {
    withCustomGate({
      id: 'test_ccx', name: 'TestCCX', numQubits: 1, defaultControls: 2,
      subCircuit: { numQubits: 1, numCols: 2, gates: [{ type: 'X', targets: [0], controls: [], params: {}, col: 0 }] },
    }, (def) => {
      // 3 qubits: control=q0,q1, target=q2
      // |110> = q0=0, q1=1, q2=1 → index 6 → only q1,q2 are 1, q0=0 → no flip
      // Need |011> = q0=1, q1=1, q2=0 → index 3 → controls q0=1, q1=1 → flip q2 → |111> = index 7
      const input = Array.from({ length: 8 }, () => [0, 0]);
      input[3] = [1, 0]; // |011>
      const sv = simCustom(3, def, [2], [0, 1], input);
      near(sv[7][0], 1);  // |111>
      near(sv[3][0], 0);
    });
  });

  it('CC-X (Toffoli): one control=|0> → does NOT flip target', () => {
    withCustomGate({
      id: 'test_ccx2', name: 'TestCCX2', numQubits: 1, defaultControls: 2,
      subCircuit: { numQubits: 1, numCols: 2, gates: [{ type: 'X', targets: [0], controls: [], params: {}, col: 0 }] },
    }, (def) => {
      // |010> = q0=0, q1=1, q2=0 → index 2 → control q0=0 → no flip → stays |010>
      const input = Array.from({ length: 8 }, () => [0, 0]);
      input[2] = [1, 0]; // |010>
      const sv = simCustom(3, def, [2], [0, 1], input);
      near(sv[2][0], 1);
    });
  });

  it('CC-X (Toffoli): no controls set → does NOT flip target', () => {
    withCustomGate({
      id: 'test_ccx3', name: 'TestCCX3', numQubits: 1, defaultControls: 2,
      subCircuit: { numQubits: 1, numCols: 2, gates: [{ type: 'X', targets: [0], controls: [], params: {}, col: 0 }] },
    }, (def) => {
      // |000> = index 0 → both controls off → stays |000>
      const input = Array.from({ length: 8 }, () => [0, 0]);
      input[0] = [1, 0];
      const sv = simCustom(3, def, [2], [0, 1], input);
      near(sv[0][0], 1);
    });
  });

  // ─── Superposition with C-U ─────────────────────────────

  it('C-X on superposition: H(q0) then C-X(q0→q1) creates Bell state', () => {
    withCustomGate({
      id: 'test_cx_bell', name: 'TestCXBell', numQubits: 1, defaultControls: 1,
      subCircuit: { numQubits: 1, numCols: 2, gates: [{ type: 'X', targets: [0], controls: [], params: {}, col: 0 }] },
    }, (def) => {
      // First apply H to q0, then C-X(control=q0, target=q1)
      const c = new Circuit(2, 4);
      c.addGate(new Gate('H', [0], [], {}, 0));
      const cuGate = new Gate(def.id, [1], [0], {}, 1);
      c.gates.push(cuGate);
      const input = new InputState(2);
      const engine = new QuantumEngine();
      const steps = engine.simulate(c, input, 'probability');
      const sv = steps[steps.length - 1].stateVector;

      // Should be (|00> + |11>) / sqrt(2)
      near(sv[0][0], S2);
      near(sv[3][0], S2);
      near(sv[1][0], 0);
      near(sv[2][0], 0);
    });
  });

  // ─── 2-qubit custom gate with control ───────────────────

  it('Controlled-SWAP via 2-qubit custom gate', () => {
    withCustomGate({
      id: 'test_cswap', name: 'TestCSWAP', numQubits: 2, defaultControls: 1,
      subCircuit: {
        numQubits: 2, numCols: 2,
        gates: [{ type: 'SWAP', targets: [0, 1], controls: [], params: {}, col: 0 }],
      },
    }, (def) => {
      // 3 qubits: control=q0, targets=q1,q2
      // |011> = q0=1, q1=1, q2=0 → index 3 → control=1 → SWAP q1,q2 → q1=0, q2=1 → |101> = index 5
      const input = Array.from({ length: 8 }, () => [0, 0]);
      input[3] = [1, 0]; // |011>
      const sv = simCustom(3, def, [1, 2], [0], input);
      near(sv[5][0], 1);  // |101>
      near(sv[3][0], 0);
    });
  });

  it('Controlled-SWAP: control=0 → no swap', () => {
    withCustomGate({
      id: 'test_cswap2', name: 'TestCSWAP2', numQubits: 2, defaultControls: 1,
      subCircuit: {
        numQubits: 2, numCols: 2,
        gates: [{ type: 'SWAP', targets: [0, 1], controls: [], params: {}, col: 0 }],
      },
    }, (def) => {
      // |010> = q0=0, q1=1, q2=0 → index 2 → control q0=0 → no swap → stays |010>
      const input = Array.from({ length: 8 }, () => [0, 0]);
      input[2] = [1, 0];
      const sv = simCustom(3, def, [1, 2], [0], input);
      near(sv[2][0], 1);
    });
  });

  // ─── Adjoint (U†) with control ──────────────────────────

  it('C-S† (adjoint): control=1 applies S† to target', () => {
    withCustomGate({
      id: 'test_cs_adj', name: 'TestCSAdj', numQubits: 1, defaultControls: 1,
      subCircuit: { numQubits: 1, numCols: 2, gates: [{ type: 'S', targets: [0], controls: [], params: {}, col: 0 }] },
    }, (def) => {
      // S|1> = i|1>, so S†|1> = -i|1>
      // |11> index 3, control=q0=1, target=q1=1
      const input = [[0, 0], [0, 0], [0, 0], [1, 0]]; // |11>
      const sv = simCustom(2, def, [1], [0], input, { adjoint: true });
      // S†|1> = -i|1>, so |11> → q0=1, q1 gets S†: amplitude -i
      near(sv[3][0], 0);
      near(sv[3][1], -1);
    });
  });

  it('C-S† (adjoint): control=0 does NOT apply', () => {
    withCustomGate({
      id: 'test_cs_adj2', name: 'TestCSAdj2', numQubits: 1, defaultControls: 1,
      subCircuit: { numQubits: 1, numCols: 2, gates: [{ type: 'S', targets: [0], controls: [], params: {}, col: 0 }] },
    }, (def) => {
      // |01> index 2, control=q0=0 → no change
      const input = [[0, 0], [0, 0], [1, 0], [0, 0]]; // |01>
      const sv = simCustom(2, def, [1], [0], input, { adjoint: true });
      near(sv[2][0], 1);
    });
  });

  // ─── Normalization preservation ─────────────────────────

  it('C-U preserves state normalization', () => {
    withCustomGate({
      id: 'test_norm', name: 'TestNorm', numQubits: 1, defaultControls: 1,
      subCircuit: { numQubits: 1, numCols: 2, gates: [{ type: 'H', targets: [0], controls: [], params: {}, col: 0 }] },
    }, (def) => {
      // Start with equal superposition of all 2-qubit states
      const input = [[0.5, 0], [0.5, 0], [0.5, 0], [0.5, 0]];
      const sv = simCustom(2, def, [1], [0], input);
      near(stateNorm(sv), 1);
    });
  });

  // ─── Unknown custom gate returns state unchanged ────────

  it('unknown custom gate def returns state unchanged', () => {
    // Manually create a gate with an unregistered type
    const c = new Circuit(1, 3);
    const g = new Gate('nonexistent_custom', [0], [], {}, 0);
    c.gates.push(g);
    const input = new InputState(1);
    const engine = new QuantumEngine();
    const steps = engine.simulate(c, input, 'probability');
    const sv = steps[steps.length - 1].stateVector;
    // Should be unchanged from |0>
    near(sv[0][0], 1);
    near(sv[1][0], 0);
  });
});
