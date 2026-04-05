import { describe, it, expect } from 'vitest';
import {
  Gate, Circuit, InputState, SimulationStep,
  createDemoCircuit, INPUT_PRESETS,
  GATE_COLORS, GATE_LABELS, GATE_CATEGORIES,
  GATE_HAS_PARAM, GATE_QUBIT_COUNT,
} from '../model/circuit.js';

const near = (a, b, tol = 1e-9) => expect(a).toBeCloseTo(b, 9);

// ─── Gate ─────────────────────────────────────────────────
describe('Gate', () => {
  it('creates a gate with correct properties', () => {
    const g = new Gate('H', [0], [], {}, 2);
    expect(g.type).toBe('H');
    expect(g.targets).toEqual([0]);
    expect(g.controls).toEqual([]);
    expect(g.col).toBe(2);
  });

  it('assigns unique IDs', () => {
    const g1 = new Gate('X', [0]);
    const g2 = new Gate('Y', [1]);
    expect(g1.id).not.toBe(g2.id);
  });

  it('computes allQubits correctly', () => {
    const g = new Gate('CX', [1], [0]);
    expect(g.allQubits).toEqual([0, 1]);
  });

  it('returns correct color and label', () => {
    const g = new Gate('H', [0]);
    expect(g.color).toBe(GATE_COLORS.H);
    expect(g.label).toBe(GATE_LABELS.H);
  });

  it('serializes and deserializes', () => {
    const g = new Gate('Rx', [0], [], { theta: Math.PI / 4 }, 3);
    const json = g.toJSON();
    const g2 = Gate.fromJSON(json);
    expect(g2.type).toBe('Rx');
    expect(g2.targets).toEqual([0]);
    expect(g2.params.theta).toBeCloseTo(Math.PI / 4);
    expect(g2.col).toBe(3);
  });
});

// ─── Circuit ──────────────────────────────────────────────
describe('Circuit', () => {
  it('creates with default dimensions', () => {
    const c = new Circuit();
    expect(c.numQubits).toBe(2);
    expect(c.numCols).toBe(6);
    expect(c.gates).toEqual([]);
  });

  it('adds a gate successfully', () => {
    const c = new Circuit(2, 6);
    const g = new Gate('H', [0], [], {}, 0);
    c.addGate(g);
    expect(c.gates.length).toBe(1);
    expect(c.gates[0].type).toBe('H');
  });

  it('auto-extends columns when gate placed at last column', () => {
    const c = new Circuit(2, 3);
    c.addGate(new Gate('H', [0], [], {}, 2));
    expect(c.numCols).toBe(4);
  });

  it('rejects qubit out of range', () => {
    const c = new Circuit(2, 6);
    expect(() => c.addGate(new Gate('H', [5], [], {}, 0)))
      .toThrow('out of range');
  });

  it('rejects cell collision', () => {
    const c = new Circuit(2, 6);
    c.addGate(new Gate('H', [0], [], {}, 0));
    expect(() => c.addGate(new Gate('X', [0], [], {}, 0)))
      .toThrow('collision');
  });

  it('rejects rotation gate without theta', () => {
    const c = new Circuit(2, 6);
    expect(() => c.addGate(new Gate('Rx', [0], [], {}, 0)))
      .toThrow('requires theta');
  });

  it('accepts rotation gate with theta', () => {
    const c = new Circuit(2, 6);
    c.addGate(new Gate('Rx', [0], [], { theta: Math.PI }, 0));
    expect(c.gates.length).toBe(1);
  });

  it('removes a gate by ID', () => {
    const c = new Circuit(2, 6);
    const g = new Gate('H', [0], [], {}, 0);
    c.addGate(g);
    c.removeGate(g.id);
    expect(c.gates.length).toBe(0);
  });

  it('getGatesAtCol returns gates in the specified column', () => {
    const c = new Circuit(2, 6);
    c.addGate(new Gate('H', [0], [], {}, 0));
    c.addGate(new Gate('X', [1], [], {}, 0));
    c.addGate(new Gate('Y', [0], [], {}, 1));
    expect(c.getGatesAtCol(0).length).toBe(2);
    expect(c.getGatesAtCol(1).length).toBe(1);
    expect(c.getGatesAtCol(2).length).toBe(0);
  });

  it('addQubit increments numQubits (max 10)', () => {
    const c = new Circuit(9, 6);
    c.addQubit();
    expect(c.numQubits).toBe(10);
    c.addQubit();
    expect(c.numQubits).toBe(10); // cap at 10
  });

  it('removeQubit decrements and cleans up gates', () => {
    const c = new Circuit(3, 6);
    c.addGate(new Gate('H', [2], [], {}, 0));
    c.addGate(new Gate('X', [0], [], {}, 0));
    c.removeQubit();
    expect(c.numQubits).toBe(2);
    expect(c.gates.length).toBe(1); // gate on qubit 2 removed
    expect(c.gates[0].targets[0]).toBe(0);
  });

  it('removeQubit does not go below 1', () => {
    const c = new Circuit(1, 6);
    c.removeQubit();
    expect(c.numQubits).toBe(1);
  });

  it('serializes and deserializes', () => {
    const c = new Circuit(3, 8);
    c.addGate(new Gate('H', [0], [], {}, 0));
    c.addGate(new Gate('CX', [1], [0], {}, 1));
    const json = c.toJSON();
    const c2 = Circuit.fromJSON(json);
    expect(c2.numQubits).toBe(3);
    expect(c2.gates.length).toBe(2);
    expect(c2.gates[1].type).toBe('CX');
  });
});

// ─── InputState ───────────────────────────────────────────
describe('InputState', () => {
  it('creates |0..0> default state', () => {
    const s = new InputState(2);
    const v = s.toStateVector();
    expect(v.length).toBe(4); // 2^2
    near(v[0][0], 1); // |00> amplitude
    near(v[1][0], 0);
    near(v[2][0], 0);
    near(v[3][0], 0);
  });

  it('setVector works with valid vector', () => {
    const s = new InputState(1);
    s.setVector([[Math.SQRT1_2, 0], [Math.SQRT1_2, 0]]);
    const v = s.toStateVector();
    near(v[0][0], Math.SQRT1_2);
    near(v[1][0], Math.SQRT1_2);
  });

  it('setVector rejects wrong-size vector', () => {
    const s = new InputState(2);
    expect(() => s.setVector([[1, 0], [0, 0]])) // 2 instead of 4
      .toThrow('does not match');
  });

  it('serializes and deserializes', () => {
    const s = new InputState(2);
    s.setVector([[1, 0], [0, 0], [0, 0], [0, 0]]);
    const json = s.toJSON();
    const s2 = InputState.fromJSON(json);
    expect(s2.numQubits).toBe(2);
    near(s2.toStateVector()[0][0], 1);
  });
});

// ─── INPUT_PRESETS ────────────────────────────────────────
describe('INPUT_PRESETS', () => {
  it('|0> is [1,0,0,0]', () => {
    const p = INPUT_PRESETS['|0⟩'];
    near(p[0], 1);
    near(p[1], 0);
    near(p[2], 0);
    near(p[3], 0);
  });

  it('|+> has equal superposition', () => {
    const p = INPUT_PRESETS['|+⟩'];
    near(p[0], Math.SQRT1_2);
    near(p[2], Math.SQRT1_2);
  });

  it('all presets are normalized', () => {
    for (const [name, p] of Object.entries(INPUT_PRESETS)) {
      const norm = p[0] * p[0] + p[1] * p[1] + p[2] * p[2] + p[3] * p[3];
      near(norm, 1);
    }
  });
});

// ─── Demo Circuits ────────────────────────────────────────
describe('createDemoCircuit', () => {
  it('h-measure has 1 qubit, H and Measure gates', () => {
    const c = createDemoCircuit('h-measure');
    expect(c.numQubits).toBe(1);
    const types = c.gates.map(g => g.type);
    expect(types).toContain('H');
    expect(types).toContain('Measure');
  });

  it('bell has 2 qubits, H, CX, and 2 Measures', () => {
    const c = createDemoCircuit('bell');
    expect(c.numQubits).toBe(2);
    const types = c.gates.map(g => g.type);
    expect(types).toContain('H');
    expect(types).toContain('CX');
    expect(types.filter(t => t === 'Measure').length).toBe(2);
  });

  it('ghz has 3 qubits', () => {
    const c = createDemoCircuit('ghz');
    expect(c.numQubits).toBe(3);
    expect(c.gates.filter(g => g.type === 'CX').length).toBe(2);
    expect(c.gates.filter(g => g.type === 'Measure').length).toBe(3);
  });

  it('unknown name returns empty 2-qubit circuit', () => {
    const c = createDemoCircuit('nonexistent');
    expect(c.numQubits).toBe(2);
    expect(c.gates.length).toBe(0);
  });
});

// ─── SimulationStep ───────────────────────────────────────
describe('SimulationStep', () => {
  it('stores column, stateVector, and gates', () => {
    const step = new SimulationStep(2, [[1, 0], [0, 0]], [new Gate('H', [0])]);
    expect(step.col).toBe(2);
    expect(step.stateVector.length).toBe(2);
    expect(step.appliedGates.length).toBe(1);
    expect(step.measurement).toBeNull();
  });
});

// ─── Gate Metadata ────────────────────────────────────────
describe('Gate metadata', () => {
  it('GATE_CATEGORIES covers all standard gates', () => {
    const all = Object.values(GATE_CATEGORIES).flat();
    expect(all).toContain('H');
    expect(all).toContain('CX');
    expect(all).toContain('Measure');
  });

  it('GATE_HAS_PARAM is true only for rotation gates', () => {
    expect(GATE_HAS_PARAM.Rx).toBe(true);
    expect(GATE_HAS_PARAM.Ry).toBe(true);
    expect(GATE_HAS_PARAM.Rz).toBe(true);
    expect(GATE_HAS_PARAM.H).toBeUndefined();
  });

  it('GATE_QUBIT_COUNT for multi-qubit gates', () => {
    expect(GATE_QUBIT_COUNT.CNOT).toBe(2);
    expect(GATE_QUBIT_COUNT.CX).toBe(2);
    expect(GATE_QUBIT_COUNT.CZ).toBe(2);
    expect(GATE_QUBIT_COUNT.SWAP).toBe(2);
  });
});
