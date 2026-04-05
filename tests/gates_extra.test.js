import { describe, it, expect } from 'vitest';
import { applyExtraGate, EXTRA_GATES } from '../sim/gates_extra.js';
import { Gate } from '../model/circuit.js';
import { cAbs2 } from '../sim/complex.js';

const near = (a, b) => expect(a).toBeCloseTo(b, 9);
const S2 = Math.SQRT1_2;

/** Make a 2-qubit state: |q1 q0> indexing */
function basisState(n, idx) {
  const dim = 1 << n;
  return Array.from({ length: dim }, (_, i) => i === idx ? [1, 0] : [0, 0]);
}

// ─── CP (Controlled-Phase) ────────────────────────────────
describe('CP — Controlled Phase', () => {
  it('CP(pi) on |11> gives -|11>', () => {
    const state = basisState(2, 3); // |11>
    const gate = new Gate('CP', [1], [0], { phi: Math.PI }, 0);
    const result = applyExtraGate(state, gate, 2);
    near(result[3][0], -1);
    near(result[3][1], 0);
  });

  it('CP(pi/2) on |11> gives i|11>', () => {
    const state = basisState(2, 3);
    const gate = new Gate('CP', [1], [0], { phi: Math.PI / 2 }, 0);
    const result = applyExtraGate(state, gate, 2);
    near(result[3][0], 0);
    near(result[3][1], 1);
  });

  it('CP on |10> does not change state (target=0)', () => {
    const state = basisState(2, 1); // |10> q0=1, q1=0
    const gate = new Gate('CP', [1], [0], { phi: Math.PI }, 0);
    const result = applyExtraGate(state, gate, 2);
    near(result[1][0], 1);
  });

  it('CP on |01> does not change state (control=0)', () => {
    const state = basisState(2, 2); // |01> q0=0, q1=1
    const gate = new Gate('CP', [1], [0], { phi: Math.PI }, 0);
    const result = applyExtraGate(state, gate, 2);
    near(result[2][0], 1);
  });

  it('CP(0) is identity', () => {
    const state = basisState(2, 3);
    const gate = new Gate('CP', [1], [0], { phi: 0 }, 0);
    const result = applyExtraGate(state, gate, 2);
    near(result[3][0], 1);
    near(result[3][1], 0);
  });
});

// ─── CRZ (Controlled-Rz) ─────────────────────────────────
describe('CRZ — Controlled Rz', () => {
  it('CRZ(pi) on |10> applies e^(-i*pi/2) to |10> (control=1, target=0)', () => {
    const state = basisState(2, 1); // |10> q0=1, q1=0
    const gate = new Gate('CRZ', [1], [0], { theta: Math.PI }, 0);
    const result = applyExtraGate(state, gate, 2);
    // control q0=1, target q1=0 → multiply by e^{-i*pi/2} = -i
    near(result[1][0], 0);
    near(result[1][1], -1);
  });

  it('CRZ(pi) on |11> applies e^(i*pi/2) to |11> (control=1, target=1)', () => {
    const state = basisState(2, 3); // |11>
    const gate = new Gate('CRZ', [1], [0], { theta: Math.PI }, 0);
    const result = applyExtraGate(state, gate, 2);
    // control q0=1, target q1=1 → multiply by e^{i*pi/2} = i
    near(result[3][0], 0);
    near(result[3][1], 1);
  });

  it('CRZ on |00> does nothing (control=0)', () => {
    const state = basisState(2, 0);
    const gate = new Gate('CRZ', [1], [0], { theta: Math.PI }, 0);
    const result = applyExtraGate(state, gate, 2);
    near(result[0][0], 1);
  });

  it('CRZ(0) is identity', () => {
    const state = basisState(2, 3);
    const gate = new Gate('CRZ', [1], [0], { theta: 0 }, 0);
    const result = applyExtraGate(state, gate, 2);
    near(result[3][0], 1);
    near(result[3][1], 0);
  });
});

// ─── CSWAP (Fredkin) ──────────────────────────────────────
describe('CSWAP — Fredkin gate', () => {
  it('CSWAP on |110> swaps targets (control=1)', () => {
    // 3 qubits: control=q0, t1=q1, t2=q2
    // |110> = q0=0, q1=1, q2=1 → index = 0b110 = 6
    // Wait, control q0=0 so no swap happens
    // Let's use |011> = q0=1, q1=1, q2=0 → index = 0b011 = 3
    // control q0=1 → swap q1 and q2
    // q1=1, q2=0 → q1=0, q2=1 → |101> = index 5
    const state = basisState(3, 3); // |011>
    const gate = new Gate('CSWAP', [1, 2], [0], {}, 0);
    const result = applyExtraGate(state, gate, 3);
    near(result[5][0], 1); // |101>
    near(result[3][0], 0);
  });

  it('CSWAP does nothing when control=0', () => {
    // |110> = index 6, q0=0 → no swap
    const state = basisState(3, 6);
    const gate = new Gate('CSWAP', [1, 2], [0], {}, 0);
    const result = applyExtraGate(state, gate, 3);
    near(result[6][0], 1);
  });

  it('CSWAP does nothing when targets are equal', () => {
    // |111> = index 7, control=1 but targets are both 1 → no change
    const state = basisState(3, 7);
    const gate = new Gate('CSWAP', [1, 2], [0], {}, 0);
    const result = applyExtraGate(state, gate, 3);
    near(result[7][0], 1);
  });
});

// ─── EXTRA_GATES constant ─────────────────────────────────
describe('EXTRA_GATES', () => {
  it('contains CP, CRZ, CSWAP', () => {
    expect(EXTRA_GATES).toContain('CP');
    expect(EXTRA_GATES).toContain('CRZ');
    expect(EXTRA_GATES).toContain('CSWAP');
  });
});
