import { describe, it, expect } from 'vitest';
import { DensityMatrixEngine } from '../sim/densitymatrix.js';
import { cAbs2 } from '../sim/complex.js';

const near = (a, b) => expect(a).toBeCloseTo(b, 9);
const S2 = Math.SQRT1_2;

// ─── fromPureState ────────────────────────────────────────
describe('DensityMatrixEngine.fromPureState', () => {
  it('|0> gives rho = [[1,0],[0,0]]', () => {
    const vec = [[1, 0], [0, 0]];
    const rho = DensityMatrixEngine.fromPureState(1, vec);
    near(rho[0][0][0], 1);
    near(rho[0][1][0], 0);
    near(rho[1][0][0], 0);
    near(rho[1][1][0], 0);
  });

  it('|1> gives rho = [[0,0],[0,1]]', () => {
    const vec = [[0, 0], [1, 0]];
    const rho = DensityMatrixEngine.fromPureState(1, vec);
    near(rho[0][0][0], 0);
    near(rho[1][1][0], 1);
  });

  it('|+> gives rho = [[0.5, 0.5],[0.5, 0.5]]', () => {
    const vec = [[S2, 0], [S2, 0]];
    const rho = DensityMatrixEngine.fromPureState(1, vec);
    near(rho[0][0][0], 0.5);
    near(rho[0][1][0], 0.5);
    near(rho[1][0][0], 0.5);
    near(rho[1][1][0], 0.5);
  });

  it('trace = 1 for any pure state', () => {
    const vec = [[0.6, 0], [0.8, 0]]; // |psi> with norm 1
    const rho = DensityMatrixEngine.fromPureState(1, vec);
    const trace = rho[0][0][0] + rho[1][1][0];
    near(trace, 1);
  });
});

// ─── fromEnsemble ─────────────────────────────────────────
describe('DensityMatrixEngine.fromEnsemble', () => {
  it('50/50 mix of |0> and |1> gives maximally mixed state', () => {
    const ensemble = [
      { prob: 0.5, vector: [[1, 0], [0, 0]] },
      { prob: 0.5, vector: [[0, 0], [1, 0]] },
    ];
    const rho = DensityMatrixEngine.fromEnsemble(1, ensemble);
    near(rho[0][0][0], 0.5);
    near(rho[1][1][0], 0.5);
    near(rho[0][1][0], 0);
    near(rho[1][0][0], 0);
  });

  it('trace = 1 for mixed state', () => {
    const ensemble = [
      { prob: 0.3, vector: [[1, 0], [0, 0]] },
      { prob: 0.7, vector: [[S2, 0], [S2, 0]] },
    ];
    const rho = DensityMatrixEngine.fromEnsemble(1, ensemble);
    const trace = rho[0][0][0] + rho[1][1][0];
    near(trace, 1);
  });

  it('pure state ensemble is equivalent to fromPureState', () => {
    const vec = [[S2, 0], [S2, 0]];
    const rho1 = DensityMatrixEngine.fromPureState(1, vec);
    const rho2 = DensityMatrixEngine.fromEnsemble(1, [{ prob: 1, vector: vec }]);
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        near(rho1[i][j][0], rho2[i][j][0]);
        near(rho1[i][j][1], rho2[i][j][1]);
      }
    }
  });
});

// ─── applySingleGate ──────────────────────────────────────
describe('DensityMatrixEngine.applySingleGate', () => {
  const X_MATRIX = [[[0, 0], [1, 0]], [[1, 0], [0, 0]]];
  const H_MATRIX = [
    [[S2, 0], [S2, 0]],
    [[S2, 0], [-S2, 0]],
  ];

  it('X on |0><0| gives |1><1|', () => {
    const rho = DensityMatrixEngine.fromPureState(1, [[1, 0], [0, 0]]);
    const result = DensityMatrixEngine.applySingleGate(rho, X_MATRIX, 0, 1);
    near(result[0][0][0], 0);
    near(result[1][1][0], 1);
  });

  it('H on |0><0| gives |+><+|', () => {
    const rho = DensityMatrixEngine.fromPureState(1, [[1, 0], [0, 0]]);
    const result = DensityMatrixEngine.applySingleGate(rho, H_MATRIX, 0, 1);
    near(result[0][0][0], 0.5);
    near(result[0][1][0], 0.5);
    near(result[1][0][0], 0.5);
    near(result[1][1][0], 0.5);
  });

  it('preserves trace after gate application', () => {
    const rho = DensityMatrixEngine.fromPureState(1, [[0.6, 0], [0.8, 0]]);
    const result = DensityMatrixEngine.applySingleGate(rho, H_MATRIX, 0, 1);
    const trace = result[0][0][0] + result[1][1][0];
    near(trace, 1);
  });

  it('X on maximally mixed state stays maximally mixed', () => {
    const ensemble = [
      { prob: 0.5, vector: [[1, 0], [0, 0]] },
      { prob: 0.5, vector: [[0, 0], [1, 0]] },
    ];
    const rho = DensityMatrixEngine.fromEnsemble(1, ensemble);
    const result = DensityMatrixEngine.applySingleGate(rho, X_MATRIX, 0, 1);
    near(result[0][0][0], 0.5);
    near(result[1][1][0], 0.5);
    near(result[0][1][0], 0);
    near(result[1][0][0], 0);
  });
});

// ─── getQubitProbabilities ────────────────────────────────
describe('DensityMatrixEngine.getQubitProbabilities', () => {
  it('|0> has P(1) = 0', () => {
    const rho = DensityMatrixEngine.fromPureState(1, [[1, 0], [0, 0]]);
    near(DensityMatrixEngine.getQubitProbabilities(rho, 0, 1), 0);
  });

  it('|1> has P(1) = 1', () => {
    const rho = DensityMatrixEngine.fromPureState(1, [[0, 0], [1, 0]]);
    near(DensityMatrixEngine.getQubitProbabilities(rho, 0, 1), 1);
  });

  it('|+> has P(1) = 0.5', () => {
    const rho = DensityMatrixEngine.fromPureState(1, [[S2, 0], [S2, 0]]);
    near(DensityMatrixEngine.getQubitProbabilities(rho, 0, 1), 0.5);
  });

  it('maximally mixed state has P(1) = 0.5', () => {
    const ensemble = [
      { prob: 0.5, vector: [[1, 0], [0, 0]] },
      { prob: 0.5, vector: [[0, 0], [1, 0]] },
    ];
    const rho = DensityMatrixEngine.fromEnsemble(1, ensemble);
    near(DensityMatrixEngine.getQubitProbabilities(rho, 0, 1), 0.5);
  });

  it('2-qubit |01> has P(q0=1) = 1 and P(q1=1) = 0', () => {
    // |01> q0=1, q1=0 → index 1
    const vec = [[0, 0], [1, 0], [0, 0], [0, 0]];
    const rho = DensityMatrixEngine.fromPureState(2, vec);
    near(DensityMatrixEngine.getQubitProbabilities(rho, 0, 2), 1);
    near(DensityMatrixEngine.getQubitProbabilities(rho, 1, 2), 0);
  });
});
