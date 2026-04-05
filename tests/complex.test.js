import { describe, it, expect } from 'vitest';
import { cMul, cAdd, cSub, cAbs2, cAbs, cScale, cConj, SeededRNG, parseComplexExpr } from '../sim/complex.js';

// ─── Helper ───────────────────────────────────────────────
const near = (actual, expected, tol = 1e-9) =>
  expect(actual).toBeCloseTo(expected, 9);

// ─── cMul ─────────────────────────────────────────────────
describe('cMul — complex multiplication', () => {
  it('multiplies two real numbers', () => {
    const [re, im] = cMul(3, 0, 4, 0);
    near(re, 12);
    near(im, 0);
  });

  it('multiplies two pure imaginary numbers', () => {
    // (0+2i)(0+3i) = -6
    const [re, im] = cMul(0, 2, 0, 3);
    near(re, -6);
    near(im, 0);
  });

  it('multiplies general complex numbers', () => {
    // (1+2i)(3+4i) = (3-8) + (4+6)i = -5 + 10i
    const [re, im] = cMul(1, 2, 3, 4);
    near(re, -5);
    near(im, 10);
  });

  it('multiplies by zero', () => {
    const [re, im] = cMul(5, 3, 0, 0);
    near(re, 0);
    near(im, 0);
  });

  it('multiplies by one', () => {
    const [re, im] = cMul(5, 3, 1, 0);
    near(re, 5);
    near(im, 3);
  });

  it('multiplies by i', () => {
    // (a+bi) * i = -b + ai
    const [re, im] = cMul(3, 4, 0, 1);
    near(re, -4);
    near(im, 3);
  });
});

// ─── cAdd ─────────────────────────────────────────────────
describe('cAdd — complex addition', () => {
  it('adds two complex numbers', () => {
    const [re, im] = cAdd(1, 2, 3, 4);
    near(re, 4);
    near(im, 6);
  });

  it('adds zero', () => {
    const [re, im] = cAdd(5, 3, 0, 0);
    near(re, 5);
    near(im, 3);
  });

  it('adds negatives', () => {
    const [re, im] = cAdd(1, 2, -1, -2);
    near(re, 0);
    near(im, 0);
  });
});

// ─── cSub ─────────────────────────────────────────────────
describe('cSub — complex subtraction', () => {
  it('subtracts two complex numbers', () => {
    const [re, im] = cSub(5, 7, 2, 3);
    near(re, 3);
    near(im, 4);
  });

  it('subtracting itself gives zero', () => {
    const [re, im] = cSub(3, 4, 3, 4);
    near(re, 0);
    near(im, 0);
  });
});

// ─── cAbs2 ────────────────────────────────────────────────
describe('cAbs2 — squared magnitude', () => {
  it('computes |3+4i|^2 = 25', () => {
    near(cAbs2(3, 4), 25);
  });

  it('computes |1+0i|^2 = 1', () => {
    near(cAbs2(1, 0), 1);
  });

  it('computes |0+0i|^2 = 0', () => {
    near(cAbs2(0, 0), 0);
  });

  it('computes |1/sqrt(2) + i/sqrt(2)|^2 = 1', () => {
    const s = Math.SQRT1_2;
    near(cAbs2(s, s), 1);
  });
});

// ─── cAbs ─────────────────────────────────────────────────
describe('cAbs — magnitude', () => {
  it('computes |3+4i| = 5', () => {
    near(cAbs(3, 4), 5);
  });
});

// ─── cScale ───────────────────────────────────────────────
describe('cScale — scalar multiplication', () => {
  it('scales by 2', () => {
    const [re, im] = cScale(3, 4, 2);
    near(re, 6);
    near(im, 8);
  });

  it('scales by 0', () => {
    const [re, im] = cScale(3, 4, 0);
    near(re, 0);
    near(im, 0);
  });

  it('scales by -1', () => {
    const [re, im] = cScale(3, 4, -1);
    near(re, -3);
    near(im, -4);
  });
});

// ─── cConj ────────────────────────────────────────────────
describe('cConj — complex conjugate', () => {
  it('conjugates 3+4i to 3-4i', () => {
    const [re, im] = cConj(3, 4);
    near(re, 3);
    near(im, -4);
  });

  it('conjugates real number (no change)', () => {
    const [re, im] = cConj(5, 0);
    near(re, 5);
    near(im, 0);
  });
});

// ─── SeededRNG ────────────────────────────────────────────
describe('SeededRNG — reproducible random numbers', () => {
  it('produces values in [0, 1)', () => {
    const rng = new SeededRNG(42);
    for (let i = 0; i < 100; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('is deterministic: same seed gives same sequence', () => {
    const rng1 = new SeededRNG(123);
    const rng2 = new SeededRNG(123);
    for (let i = 0; i < 50; i++) {
      expect(rng1.next()).toBe(rng2.next());
    }
  });

  it('different seeds give different sequences', () => {
    const rng1 = new SeededRNG(1);
    const rng2 = new SeededRNG(2);
    // Very unlikely all 10 values match
    let allSame = true;
    for (let i = 0; i < 10; i++) {
      if (rng1.next() !== rng2.next()) allSame = false;
    }
    expect(allSame).toBe(false);
  });
});

// ─── parseComplexExpr ─────────────────────────────────────
describe('parseComplexExpr — string to complex number', () => {
  it('parses "1"', () => {
    const [re, im] = parseComplexExpr('1');
    near(re, 1);
    near(im, 0);
  });

  it('parses "-1"', () => {
    const [re, im] = parseComplexExpr('-1');
    near(re, -1);
    near(im, 0);
  });

  it('parses "i"', () => {
    const [re, im] = parseComplexExpr('i');
    near(re, 0);
    near(im, 1);
  });

  it('parses "-i"', () => {
    const [re, im] = parseComplexExpr('-i');
    near(re, 0);
    near(im, -1);
  });

  it('parses "0.5"', () => {
    const [re, im] = parseComplexExpr('0.5');
    near(re, 0.5);
    near(im, 0);
  });

  it('parses empty string as zero', () => {
    const [re, im] = parseComplexExpr('');
    near(re, 0);
    near(im, 0);
  });
});
