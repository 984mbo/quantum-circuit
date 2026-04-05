import { describe, it, expect } from 'vitest';
import { SymbolicValue, formatComplexTeX } from '../sim/fraction.js';

const near = (a, b) => expect(a).toBeCloseTo(b, 9);

// ─── SymbolicValue.fromFloat ──────────────────────────────
describe('SymbolicValue.fromFloat', () => {
  it('matches 0', () => {
    const sv = SymbolicValue.fromFloat(0);
    expect(sv).not.toBeNull();
    expect(sv.num).toBe(0);
  });

  it('matches 1', () => {
    const sv = SymbolicValue.fromFloat(1);
    expect(sv).not.toBeNull();
    near(sv.toFloat(), 1);
  });

  it('matches -1', () => {
    const sv = SymbolicValue.fromFloat(-1);
    expect(sv).not.toBeNull();
    near(sv.toFloat(), -1);
    expect(sv.sign).toBe(-1);
  });

  it('matches 0.5', () => {
    const sv = SymbolicValue.fromFloat(0.5);
    expect(sv).not.toBeNull();
    near(sv.toFloat(), 0.5);
    expect(sv.num).toBe(1);
    expect(sv.den).toBe(2);
  });

  it('matches 1/sqrt(2)', () => {
    const sv = SymbolicValue.fromFloat(Math.SQRT1_2);
    expect(sv).not.toBeNull();
    near(sv.toFloat(), Math.SQRT1_2);
  });

  it('matches -1/sqrt(2)', () => {
    const sv = SymbolicValue.fromFloat(-Math.SQRT1_2);
    expect(sv).not.toBeNull();
    near(sv.toFloat(), -Math.SQRT1_2);
    expect(sv.sign).toBe(-1);
  });

  it('matches sqrt(3)/2', () => {
    const sv = SymbolicValue.fromFloat(Math.sqrt(3) / 2);
    expect(sv).not.toBeNull();
    near(sv.toFloat(), Math.sqrt(3) / 2);
  });

  it('matches 1/sqrt(3)', () => {
    const sv = SymbolicValue.fromFloat(1 / Math.sqrt(3));
    expect(sv).not.toBeNull();
    near(sv.toFloat(), 1 / Math.sqrt(3));
  });

  it('matches 1/4', () => {
    const sv = SymbolicValue.fromFloat(0.25);
    expect(sv).not.toBeNull();
    near(sv.toFloat(), 0.25);
  });

  it('matches 3/4', () => {
    const sv = SymbolicValue.fromFloat(0.75);
    expect(sv).not.toBeNull();
    near(sv.toFloat(), 0.75);
  });

  it('returns null for unrecognized values', () => {
    const sv = SymbolicValue.fromFloat(0.12345);
    expect(sv).toBeNull();
  });
});

// ─── SymbolicValue.toTeX ──────────────────────────────────
describe('SymbolicValue.toTeX', () => {
  it('0 → "0"', () => {
    const sv = SymbolicValue.fromFloat(0);
    expect(sv.toTeX()).toBe('0');
  });

  it('1 → "1"', () => {
    const sv = SymbolicValue.fromFloat(1);
    expect(sv.toTeX()).toBe('1');
  });

  it('-1 → "-1"', () => {
    const sv = SymbolicValue.fromFloat(-1);
    expect(sv.toTeX()).toBe('-1');
  });

  it('1/2 → "\\frac{1}{2}"', () => {
    const sv = SymbolicValue.fromFloat(0.5);
    expect(sv.toTeX()).toBe('\\frac{1}{2}');
  });

  it('1/sqrt(2) → "\\frac{1}{\\sqrt{2}}"', () => {
    const sv = SymbolicValue.fromFloat(Math.SQRT1_2);
    expect(sv.toTeX()).toBe('\\frac{1}{\\sqrt{2}}');
  });

  it('sqrt(3)/2 → "\\frac{\\sqrt{3}}{2}"', () => {
    const sv = SymbolicValue.fromFloat(Math.sqrt(3) / 2);
    expect(sv.toTeX()).toBe('\\frac{\\sqrt{3}}{2}');
  });
});

// ─── formatComplexTeX ─────────────────────────────────────
describe('formatComplexTeX', () => {
  it('0,0 → "0"', () => {
    expect(formatComplexTeX(0, 0)).toBe('0');
  });

  it('1,0 → "1"', () => {
    expect(formatComplexTeX(1, 0)).toBe('1');
  });

  it('0,1 → "i"', () => {
    expect(formatComplexTeX(0, 1)).toBe('i');
  });

  it('0,-1 → "-i"', () => {
    expect(formatComplexTeX(0, -1)).toBe('-i');
  });

  it('1/sqrt(2), 0 → fraction TeX', () => {
    const tex = formatComplexTeX(Math.SQRT1_2, 0);
    expect(tex).toContain('\\frac');
    expect(tex).toContain('\\sqrt{2}');
  });

  it('0, 1/sqrt(2) → fraction TeX with i', () => {
    const tex = formatComplexTeX(0, Math.SQRT1_2);
    expect(tex).toContain('i');
    expect(tex).toContain('\\sqrt{2}');
  });

  it('0.5, 0.5 → contains + and i', () => {
    const tex = formatComplexTeX(0.5, 0.5);
    expect(tex).toContain('+');
    expect(tex).toContain('i');
  });

  it('unrecognized value falls back to decimal', () => {
    const tex = formatComplexTeX(0.12345, 0);
    expect(tex).toMatch(/0\.123/);
  });
});
