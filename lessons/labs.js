// ============================================================
// lessons/labs.js — Lab Scenarios & Validation
// ============================================================

const summarizeTopOutcomes = (counts, topN = 3) => {
    return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, topN)
        .map(([bin, c]) => `${bin}: ${c}`)
        .join(', ');
};

const totalShots = (counts) => Object.values(counts).reduce((a, b) => a + b, 0);

const q0ProbabilityZero = (counts) => {
    const total = totalShots(counts);
    if (!total) return 0;

    let count0 = 0;
    for (const [bin, cnt] of Object.entries(counts)) {
        if (bin.slice(-1) === '0') count0 += cnt;
    }
    return count0 / total;
};

export const LABS = {
    hadamard_test: {
        title: 'Hadamard Test',
        chapter: 'Interference Basics',
        difficulty: 'Beginner',
        goal: '位相差が干渉パターンにどう反映されるかを、測定確率で体感する。',
        intuitionBullets: [
            'Hで作った重ね合わせは、最後のHで位相情報を確率に変換する。',
            'thetaを動かすとP(0)が連続的に振動し、干渉の強弱が見える。',
            'ショット数を増やすと理論値に収束しやすくなる。'
        ],
        guidedSteps: [
            { label: '1) 回路をロード', action: 'load' },
            { label: '2) 入力を設定', action: 'inputs' },
            { label: '3) 実行して比較', action: 'run' }
        ],
        experiments: [
            {
                id: 'ht-constructive',
                label: 'Constructive (theta=0.00)',
                note: '位相差なし。P(0)は1に近づく。',
                params: { theta: 0.0 }
            },
            {
                id: 'ht-balanced',
                label: 'Balanced (theta=0.50)',
                note: '中間位相。P(0)は0.5付近になる。',
                params: { theta: 0.5 }
            },
            {
                id: 'ht-destructive',
                label: 'Destructive (theta=1.00)',
                note: '逆位相。P(0)は0に近づく。',
                params: { theta: 1.0 }
            }
        ],
        descriptionHTML: `
            <p><strong>Hadamard Test</strong> is used to estimate the real part of the expected value of a unitary operator.</p>
            <p>Circuit: Control qubit (q0) controls the Unitary (CRZ) on target (q1).</p>
            <p>Adjust <strong>&theta;</strong> to see how interference affects P(|0⟩) on q0.</p>
            <div class="math-block">P(0) = (1 + Re⟨&psi;|U|&psi;⟩)/2</div>
        `,
        recommendedShots: 1024,
        params: { theta: 0.125 },

        getCircuit: (params) => {
            const theta = params.theta || 0;
            return {
                numQubits: 2,
                numCols: 5,
                gates: [
                    { type: 'H', col: 0, targets: [0], controls: [], params: {} },
                    { type: 'H', col: 2, targets: [0], controls: [], params: {} },
                    { type: 'M', col: 3, targets: [0], controls: [], params: {} },
                    { type: 'CRZ', col: 1, targets: [1], controls: [0], params: { theta: 2 * Math.PI * theta } }
                ]
            };
        },

        inputs: {
            perQubitPreset: ['|0⟩', '|0⟩']
        },

        check: (counts, params) => {
            const theta = params.theta || 0;
            const p0 = q0ProbabilityZero(counts);
            const theoretical = (1 + Math.cos(Math.PI * theta)) / 2;

            if (Math.abs(p0 - theoretical) < 0.1) {
                return {
                    passed: true,
                    message: `PASS: P(0) ≈ ${p0.toFixed(2)} (Expected ~${theoretical.toFixed(2)})`
                };
            }

            return {
                passed: false,
                message: `FAIL: P(0) = ${p0.toFixed(2)}. Expected ~${theoretical.toFixed(2)}. Try increasing shots.`
            };
        },

        getInsight: (counts, params) => {
            const theta = params.theta || 0;
            const measured = q0ProbabilityZero(counts);
            const expected = (1 + Math.cos(Math.PI * theta)) / 2;
            return {
                headline: 'Interference Readout',
                details: [
                    `Measured P(q0=0): ${measured.toFixed(3)}`,
                    `Theoretical P(q0=0): ${expected.toFixed(3)}`,
                    `Top outcomes: ${summarizeTopOutcomes(counts) || 'N/A'}`
                ]
            };
        }
    },

    swap_test: {
        title: 'SWAP Test',
        chapter: 'State Similarity',
        difficulty: 'Beginner',
        goal: '2つの量子状態の類似度を、補助ビット1本で判定する感覚を掴む。',
        intuitionBullets: [
            '補助ビットの0が出やすいほど、2状態の重なりが大きい。',
            '完全一致ならP(0)=1、直交ならP(0)=0.5に近づく。',
            '入力状態を変えると分布が連続的に変わる。'
        ],
        guidedSteps: [
            { label: '1) 回路をロード', action: 'load' },
            { label: '2) シナリオを適用', action: 'experiment' },
            { label: '3) 実行してP(0)確認', action: 'run' }
        ],
        experiments: [
            {
                id: 'swap-same',
                label: 'Same States',
                note: '|psi> = |phi> = |0>. P(0)は1に近づく。',
                inputs: ['|0⟩', '|0⟩', '|0⟩']
            },
            {
                id: 'swap-orthogonal',
                label: 'Orthogonal States',
                note: '|psi>=|0>, |phi>=|1>. P(0)は0.5に近づく。',
                inputs: ['|0⟩', '|0⟩', '|1⟩']
            },
            {
                id: 'swap-partial',
                label: 'Partial Overlap',
                note: '|psi>=|+>, |phi>=|0>. P(0)は0.75付近を狙う。',
                inputs: ['|0⟩', '|+⟩', '|0⟩']
            }
        ],
        descriptionHTML: `
            <p><strong>SWAP Test</strong> checks the overlap (similarity) between two states |&psi;⟩ and |&phi;⟩.</p>
            <p>P(0) = 0.5 + 0.5 |⟨&psi;|&phi;⟩|²</p>
            <p>If states are identical, P(0)=1. If orthogonal, P(0)=0.5.</p>
        `,
        recommendedShots: 1024,
        params: {},
        getCircuit: () => ({
            numQubits: 3,
            numCols: 5,
            gates: [
                { type: 'H', col: 0, targets: [0], controls: [], params: {} },
                { type: 'CSWAP', col: 1, targets: [1, 2], controls: [0], params: {} },
                { type: 'H', col: 2, targets: [0], controls: [], params: {} },
                { type: 'M', col: 3, targets: [0], controls: [], params: {} }
            ]
        }),
        inputs: {
            perQubitPreset: ['|0⟩', '|0⟩', '|1⟩']
        },
        check: (counts) => {
            const p0 = q0ProbabilityZero(counts);
            return {
                passed: true,
                message: `Measured P(0) = ${p0.toFixed(2)}. (1.0 = Same, 0.5 = Orthogonal)`
            };
        },
        getInsight: (counts) => {
            const p0 = q0ProbabilityZero(counts);
            const overlapSq = Math.max(0, Math.min(1, 2 * p0 - 1));
            return {
                headline: 'State Overlap Estimate',
                details: [
                    `Measured P(q0=0): ${p0.toFixed(3)}`,
                    `Estimated |<psi|phi>|^2: ${overlapSq.toFixed(3)}`,
                    `Top outcomes: ${summarizeTopOutcomes(counts) || 'N/A'}`
                ]
            };
        }
    },

    qft: {
        title: 'QFT (3-qubit)',
        chapter: 'Fourier View of States',
        difficulty: 'Intermediate',
        goal: '基底状態が位相空間へどう写るかを、分布の変化として捉える。',
        intuitionBullets: [
            'QFTは「状態を周波数成分で見る」変換。',
            '|000>を入れると一様分布に近い形が見える。',
            '入力基底を変えるとピーク位置が変わる。'
        ],
        guidedSteps: [
            { label: '1) 回路をロード', action: 'load' },
            { label: '2) 入力を適用', action: 'experiment' },
            { label: '3) 分布を観察', action: 'run' }
        ],
        experiments: [
            {
                id: 'qft-zero',
                label: 'Input |000>',
                note: '一様性を観察しやすい基準シナリオ。',
                inputs: ['|0⟩', '|0⟩', '|0⟩']
            },
            {
                id: 'qft-basis-1',
                label: 'Input |001>',
                note: '位相勾配により分布の重みが移動する。',
                inputs: ['|1⟩', '|0⟩', '|0⟩']
            }
        ],
        descriptionHTML: `
            <p>Quantum Fourier Transform on 3 qubits.</p>
            <p>Input basis |x⟩ transforms to Fourier basis.</p>
            <p>Try setting input to |000> -> HHH result.</p>
        `,
        recommendedShots: 1024,
        params: {},
        getCircuit: () => ({
            numQubits: 3,
            numCols: 8,
            gates: [
                { type: 'H', col: 0, targets: [0] },
                { type: 'CP', col: 1, targets: [0], controls: [1], params: { phi: Math.PI / 2 } },
                { type: 'CP', col: 2, targets: [0], controls: [2], params: { phi: Math.PI / 4 } },
                { type: 'H', col: 3, targets: [1] },
                { type: 'CP', col: 4, targets: [1], controls: [2], params: { phi: Math.PI / 2 } },
                { type: 'H', col: 5, targets: [2] },
                { type: 'SWAP', col: 6, targets: [0, 2] },
                { type: 'M', col: 7, targets: [0] },
                { type: 'M', col: 7, targets: [1] },
                { type: 'M', col: 7, targets: [2] }
            ]
        }),
        inputs: { perQubitPreset: ['|0⟩', '|0⟩', '|0⟩'] },
        check: (counts) => {
            return {
                passed: true,
                message: `Top outcomes: ${summarizeTopOutcomes(counts) || 'N/A'}`
            };
        },
        getInsight: (counts) => {
            return {
                headline: 'Distribution Snapshot',
                details: [
                    `Top outcomes: ${summarizeTopOutcomes(counts) || 'N/A'}`,
                    '入力基底を変えて、ピークの移動パターンを比較してください。'
                ]
            };
        }
    },

    phase_estimation: {
        title: 'Phase Estimation (Small)',
        chapter: 'Algorithmic Readout',
        difficulty: 'Advanced',
        goal: '固有位相を、補助レジスタのビット列として読む感覚をつかむ。',
        intuitionBullets: [
            '制御付きU^2^kで位相をビット重みに分解する。',
            '逆QFTで位相情報を計算基底へ戻す。',
            'thetaを変えるとピークのビット列が変化する。'
        ],
        guidedSteps: [
            { label: '1) 回路をロード', action: 'load' },
            { label: '2) thetaを調整', action: 'experiment' },
            { label: '3) ピークを読む', action: 'run' }
        ],
        experiments: [
            {
                id: 'pe-025',
                label: 'theta = 0.25',
                note: '2ビット精度なら 0.01(2) 付近が目標。',
                params: { theta: 0.25 }
            },
            {
                id: 'pe-050',
                label: 'theta = 0.50',
                note: '0.10(2) 付近へのピーク移動を確認。',
                params: { theta: 0.50 }
            },
            {
                id: 'pe-075',
                label: 'theta = 0.75',
                note: '0.11(2) 近傍のピークを確認。',
                params: { theta: 0.75 }
            }
        ],
        descriptionHTML: `
            <p>Estimate phase &theta; of Unitary U=Rz(2&pi;&theta;).</p>
            <p>Using 2 precision qubits (q0, q1) and 1 target (q2).</p>
            <p>If target |1⟩ is eigenstate, we extract &theta;.</p>
        `,
        recommendedShots: 2048,
        params: { theta: 0.25 },
        getCircuit: (params) => {
            const theta = params.theta || 0;
            return {
                numQubits: 3,
                numCols: 10,
                gates: [
                    { type: 'X', col: 0, targets: [2] },
                    { type: 'H', col: 0, targets: [0] },
                    { type: 'H', col: 0, targets: [1] },
                    { type: 'CRZ', col: 1, targets: [2], controls: [1], params: { theta: 2 * Math.PI * theta } },
                    { type: 'CRZ', col: 2, targets: [2], controls: [0], params: { theta: 4 * Math.PI * theta } },
                    { type: 'SWAP', col: 3, targets: [0, 1] },
                    { type: 'H', col: 5, targets: [0] },
                    { type: 'CP', col: 6, targets: [0], controls: [1], params: { phi: -Math.PI / 2 } },
                    { type: 'H', col: 7, targets: [1] },
                    { type: 'M', col: 8, targets: [0] },
                    { type: 'M', col: 8, targets: [1] }
                ]
            };
        },
        inputs: { perQubitPreset: ['|0⟩', '|0⟩', '|0⟩'] },
        check: (counts, params) => {
            return {
                passed: true,
                message: `theta=${params.theta.toFixed(2)} を表すピーク候補: ${summarizeTopOutcomes(counts) || 'N/A'}`
            };
        },
        getInsight: (counts, params) => {
            return {
                headline: 'Phase Bitstring Readout',
                details: [
                    `theta: ${params.theta.toFixed(2)}`,
                    `Top outcomes: ${summarizeTopOutcomes(counts) || 'N/A'}`,
                    '最大カウントのビット列を、小数2進表示と対応づけて確認してください。'
                ]
            };
        }
    }
};
