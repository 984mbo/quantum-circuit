import { describe, it, expect } from 'vitest';
import { parseTexState } from '../sim/texParser.js';

const near = (a, b) => expect(a).toBeCloseTo(b, 6);
const S2 = Math.SQRT1_2;

/** Helper: parse and return vector */
function parse(tex, n) {
  const { vector, error } = parseTexState(tex, n);
  if (error) throw new Error(error);
  return vector;
}

// ─── Basic kets ───────────────────────────────────────────
describe('Basic ket parsing', () => {
  it('|0\\rangle → |0>', () => {
    const v = parse('|0\\rangle', 1);
    near(v[0][0], 1);
    near(v[1][0], 0);
  });

  it('|1\\rangle → |1>', () => {
    const v = parse('|1\\rangle', 1);
    near(v[0][0], 0);
    near(v[1][0], 1);
  });

  it('|00\\rangle → |00>', () => {
    const v = parse('|00\\rangle', 2);
    near(v[0][0], 1);
    near(v[1][0], 0);
    near(v[2][0], 0);
    near(v[3][0], 0);
  });

  it('|11\\rangle → |11>', () => {
    const v = parse('|11\\rangle', 2);
    near(v[3][0], 1);
  });

  it('|01\\rangle → |01>', () => {
    const v = parse('|01\\rangle', 2);
    near(v[1][0], 1);
  });
});

// ─── Coefficients ─────────────────────────────────────────
describe('Coefficient parsing', () => {
  it('\\frac{1}{\\sqrt{2}}|0\\rangle + \\frac{1}{\\sqrt{2}}|1\\rangle → |+>', () => {
    const v = parse('\\frac{1}{\\sqrt{2}}|0\\rangle + \\frac{1}{\\sqrt{2}}|1\\rangle', 1);
    near(v[0][0], S2);
    near(v[1][0], S2);
  });

  it('\\frac{1}{\\sqrt{2}}|0\\rangle - \\frac{1}{\\sqrt{2}}|1\\rangle → |->', () => {
    const v = parse('\\frac{1}{\\sqrt{2}}|0\\rangle - \\frac{1}{\\sqrt{2}}|1\\rangle', 1);
    near(v[0][0], S2);
    near(v[1][0], -S2);
  });

  it('numeric coefficient: 0.5|0\\rangle + 0.5|1\\rangle', () => {
    const v = parse('0.5|0\\rangle + 0.5|1\\rangle', 1);
    near(v[0][0], 0.5);
    near(v[1][0], 0.5);
  });

  it('negative coefficient: -|1\\rangle', () => {
    const v = parse('-|1\\rangle', 1);
    near(v[0][0], 0);
    near(v[1][0], -1);
  });
});

// ─── Bell state ───────────────────────────────────────────
describe('Bell state', () => {
  it('\\frac{1}{\\sqrt{2}}|00\\rangle + \\frac{1}{\\sqrt{2}}|11\\rangle', () => {
    const v = parse('\\frac{1}{\\sqrt{2}}|00\\rangle + \\frac{1}{\\sqrt{2}}|11\\rangle', 2);
    near(v[0][0], S2);
    near(v[1][0], 0);
    near(v[2][0], 0);
    near(v[3][0], S2);
  });
});

// ─── Imaginary coefficients ───────────────────────────────
describe('Imaginary coefficients', () => {
  it('i|1\\rangle', () => {
    const v = parse('i|1\\rangle', 1);
    near(v[0][0], 0);
    near(v[1][0], 0);
    near(v[1][1], 1);
  });

  it('-i|1\\rangle', () => {
    const v = parse('-i|1\\rangle', 1);
    near(v[1][0], 0);
    near(v[1][1], -1);
  });
});

// ─── Symbolic kets ────────────────────────────────────────
describe('Symbolic kets', () => {
  it('|+\\rangle → equal superposition', () => {
    const v = parse('|+\\rangle', 1);
    near(v[0][0], S2);
    near(v[1][0], S2);
  });

  it('|-\\rangle → |0> - |1> / sqrt(2)', () => {
    const v = parse('|-\\rangle', 1);
    near(v[0][0], S2);
    near(v[1][0], -S2);
  });
});

// ─── Euler phase ──────────────────────────────────────────
describe('Euler phase', () => {
  it('e^{i\\pi}|0\\rangle → -|0>', () => {
    const v = parse('e^{i\\pi}|0\\rangle', 1);
    near(v[0][0], -1);
    near(v[0][1], 0);
  });

  it('e^{i\\pi/2}|1\\rangle → i|1>', () => {
    const v = parse('e^{i\\pi/2}|1\\rangle', 1);
    near(v[1][0], 0);
    near(v[1][1], 1);
  });
});

// ─── Distribution with parentheses ───────────────────────
describe('Parenthesized expressions', () => {
  it('\\frac{1}{\\sqrt{2}}(|0\\rangle + |1\\rangle)', () => {
    const v = parse('\\frac{1}{\\sqrt{2}}(|0\\rangle + |1\\rangle)', 1);
    near(v[0][0], S2);
    near(v[1][0], S2);
  });
});

// ─── Error handling ───────────────────────────────────────
describe('Error handling', () => {
  it('empty input returns error', () => {
    const { vector, error } = parseTexState('', 1);
    expect(vector).toBeNull();
    expect(error).toBeTruthy();
  });

  it('invalid ket label returns error', () => {
    const { vector, error } = parseTexState('|abc\\rangle', 1);
    expect(vector).toBeNull();
    expect(error).toContain('Invalid ket');
  });

  it('wrong qubit count ket returns error', () => {
    const { vector, error } = parseTexState('|00\\rangle', 1); // 2-bit ket for 1-qubit system
    expect(vector).toBeNull();
    expect(error).toBeTruthy();
  });
});
