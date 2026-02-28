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
            <p><strong>Hadamard Test</strong> は、ユニタリ演算子の期待値の実部を測定確率として読み取るための基本回路です。</p>
            <p>このラボでは <code>q0</code> を制御ビット、<code>q1</code> を標的ビットとして、位相差が干渉に変換される様子を観察します。</p>
            <p><strong>theta</strong> を変えると、最終測定の <code>P(q0=0)</code> が連続的に変化します。理論値との一致を確認してください。</p>
            <div class="math-block">P(0) = (1 + Re⟨&psi;|U|&psi;⟩)/2 = (1 + cos(&pi;&theta;))/2</div>
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
                    message: `PASS: 測定値 P(0) ≈ ${p0.toFixed(2)}（理論値 ${theoretical.toFixed(2)}）`
                };
            }

            return {
                passed: false,
                message: `FAIL: 測定値 P(0) = ${p0.toFixed(2)}（理論値 ${theoretical.toFixed(2)}）。shots を増やして再検証してください。`
            };
        },

        getInsight: (counts, params) => {
            const theta = params.theta || 0;
            const measured = q0ProbabilityZero(counts);
            const expected = (1 + Math.cos(Math.PI * theta)) / 2;
            return {
                headline: '干渉の読み取り結果',
                details: [
                    `測定 P(q0=0): ${measured.toFixed(3)}`,
                    `理論 P(q0=0): ${expected.toFixed(3)}`,
                    `主要ビット列: ${summarizeTopOutcomes(counts) || 'N/A'}`
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
            <p><strong>SWAP Test</strong> は、2つの量子状態 <code>|&psi;⟩</code> と <code>|&phi;⟩</code> の重なりを測る回路です。</p>
            <p>補助ビット <code>q0</code> の測定確率から、状態の類似度を推定できます。</p>
            <div class="math-block">P(0) = 0.5 + 0.5 |⟨&psi;|&phi;⟩|²</div>
            <p>同一状態では <code>P(0) ≈ 1</code>、直交状態では <code>P(0) ≈ 0.5</code> になります。</p>
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
                message: `測定 P(0) = ${p0.toFixed(2)}（1.0に近いほど類似、0.5に近いほど直交）`
            };
        },
        getInsight: (counts) => {
            const p0 = q0ProbabilityZero(counts);
            const overlapSq = Math.max(0, Math.min(1, 2 * p0 - 1));
            return {
                headline: '状態重なりの推定',
                details: [
                    `測定 P(q0=0): ${p0.toFixed(3)}`,
                    `推定 |<psi|phi>|^2: ${overlapSq.toFixed(3)}`,
                    `主要ビット列: ${summarizeTopOutcomes(counts) || 'N/A'}`
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
            <p><strong>QFT (3量子ビット)</strong> は、計算基底で表した状態を周波数表現へ変換します。</p>
            <p>入力状態を変えると、測定ヒストグラムのピーク配置が変化します。</p>
            <p>まず <code>|000⟩</code> を基準に実行し、その後 <code>|001⟩</code> などへ切り替えて分布の差を比較してください。</p>
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
                message: `主要ビット列: ${summarizeTopOutcomes(counts) || 'N/A'}`
            };
        },
        getInsight: (counts) => {
            return {
                headline: '分布の観察結果',
                details: [
                    `主要ビット列: ${summarizeTopOutcomes(counts) || 'N/A'}`,
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
            <p><strong>Phase Estimation</strong> は、ユニタリ演算子の固有位相 <code>&theta;</code> をビット列として読み出すアルゴリズムです。</p>
            <p>このラボでは精度2ビット（<code>q0, q1</code>）で、位相の近似値をヒストグラムから読み取ります。</p>
            <p><code>theta = 0.25, 0.50, 0.75</code> を切り替え、ピーク位置がどう動くかを比較してください。</p>
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
                message: `theta=${params.theta.toFixed(2)} のピーク候補: ${summarizeTopOutcomes(counts) || 'N/A'}`
            };
        },
        getInsight: (counts, params) => {
            return {
                headline: '位相ビット列の読み取り',
                details: [
                    `設定 theta: ${params.theta.toFixed(2)}`,
                    `主要ビット列: ${summarizeTopOutcomes(counts) || 'N/A'}`,
                    '最大カウントのビット列を、小数2進表示と対応づけて確認してください。'
                ]
            };
        }
    }
};
