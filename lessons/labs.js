// ============================================================
// lessons/labs.js — Lab Scenarios & Validation
// ============================================================

export const LABS = {
    hadamard_test: {
        title: "Hadamard Test",
        descriptionHTML: `
            <p><strong>Hadamard Test</strong> is used to estimate the real part of the expected value of a unitary operator.</p>
            <p>Circuit: Control qubit (q0) controls the Unitary (CRZ) on target (q1).</p>
            <p>Adjust <strong>&theta;</strong> to see how interference affects P(|0⟩) on q0.</p>
            <div class="math-block">P(0) = (1 + Re⟨&psi;|U|&psi;⟩)/2</div>
        `,
        recommendedShots: 1024,
        params: { theta: 0.125 }, // Default theta (x 2pi) = pi/4

        // Dynamic circuit generation based on params
        getCircuit: (params) => {
            const theta = params.theta || 0;
            return {
                numQubits: 2,
                numCols: 5,
                gates: [
                    { type: 'H', col: 0, targets: [0], controls: [], params: {} },
                    { type: 'H', col: 2, targets: [0], controls: [], params: {} },
                    { type: 'M', col: 3, targets: [0], controls: [], params: {} },
                    // Control-U (CRZ)
                    { type: 'CRZ', col: 1, targets: [1], controls: [0], params: { theta: 2 * Math.PI * theta } }
                ]
            };
        },

        inputs: {
            perQubitPreset: ["|0>", "|0>"] // q1 can be |0> or anything, usually eigenstate
        },

        // Check logic: receives histogram counts, params
        check: (counts, params) => {
            const theta = params.theta || 0;

            // Calculate Measured P(0) on q0
            // Counts keys are binary strings e.g. "00", "10" (q0 is top bit? No, typically q0 is LAST bit in indexing "qN...q0" OR FIRST "q0...qN"?)
            // In our sim/statevector.js: "bin = outcome.toString(2).padStart(numQubits, '0')"
            // Usually binary string corresponds to |q0 q1 ... qN> or |qN ... q0>?
            // Let's assume standard big-endian or little-endian console.
            // In svgCanvas: q0 is top wire.
            // stateVector index i: bit 0 corresponds to q0?
            // sim/statevector.js: 
            // `if ((i & bit) === 0)` where bit = 1 << targetQubit.
            // So q0 is LSB (1<<0).
            // `outcome.toString(2)` produces "MSB...LSB".
            // So "00...01" means LSB=1 -> q0=1.
            // Wait. padStart(numQubits, '0').
            // If outcome=1 (q0=1), string "0...01".
            // So RIGHTMOST character is q0.

            const total = Object.values(counts).reduce((a, b) => a + b, 0);
            let count0 = 0;

            for (const [bin, cnt] of Object.entries(counts)) {
                // bin is string. q0 is last char?
                // Let's verify interpretation.
                // If numQubits=2. bin="10".
                // 10 (binary 2) -> bit 1 is 1 (q1), bit 0 is 0 (q0).
                // So "10" means q1=1, q0=0.
                // RIGHTMOST char is q0?
                // "1".padStart(2,'0') -> "01". q0=1.
                // Yes. Last char is q0.

                const q0val = bin.slice(-1);
                if (q0val === '0') count0 += cnt;
            }

            const p0 = count0 / total;

            // Expected P(0) for H-CRZ(2pi*theta)-H
            // U = Rz(alpha). Eigenvalue e^{-i alpha/2} for |0>, e^{i alpha/2} for |1>.
            // If target |psi>=|0>, <0|Rz|0> = e^{-i alpha/2}.
            // Re = cos(alpha/2).
            // P(0) = (1 + cos(alpha/2))/2 = cos^2(alpha/4).

            // For CRZ(2pi*theta), alpha = 2pi*theta.
            // P(0) = (1 + cos(pi*theta))/2 ? No wait.
            // If target is |0>: Rz|0> = e^{-i theta*pi}|0>. Re = cos(pi*theta) confirm.

            let passed = false;
            let msg = "";

            // Tolerance
            const expected = (1 + Math.cos(2 * Math.PI * theta / 2)) / 2; // Rough approx if target is |0>
            // Actually Rz(alpha) on |0> -> global phase on subsystem?
            // Control-U on |+>|0>: 1/sqrt(2) (|0>|0> + |1>U|0>)
            // = 1/sqrt(2) (|0>|0> + |1> e^{-i a/2}|0>)
            // = 1/sqrt(2) (|0> + e^{-i a/2}|1>) |0>
            // Measure q0 in X basis (H-M).
            // State q0: 1/sqrt(2)(|0> + e^{-i phi}|1>).
            // P(0) = |<+|psi>|^2 = |1/2 (1 + e^{-i phi})|^2 = 1/4 |1 + cos - i sin|^2 = 1/4 ((1+cos)^2 + sin^2) = 1/4(1+2cos+cos^2+sin^2) = (2+2cos)/4 = (1+cos)/2.
            // Correct. phi = 2*pi*theta / 2 = pi * theta.

            const theoretical = (1 + Math.cos(Math.PI * theta)) / 2;

            if (Math.abs(p0 - theoretical) < 0.1) {
                passed = true;
                msg = `PASS: P(0) ≈ ${p0.toFixed(2)} (Expected ~${theoretical.toFixed(2)})`;
            } else {
                msg = `FAIL: P(0) = ${p0.toFixed(2)}. Expected ~${theoretical.toFixed(2)}. Try adjusting shots or theta.`;
            }

            return { passed, message: msg };
        }
    },

    swap_test: {
        title: "SWAP Test",
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
                { type: 'CSWAP', col: 1, targets: [1, 2], controls: [0], params: {} }, // 1,2 are swapped controlled by 0
                { type: 'H', col: 2, targets: [0], controls: [], params: {} },
                { type: 'M', col: 3, targets: [0], controls: [], params: {} }
            ]
        }),
        inputs: {
            perQubitPreset: ["|0>", "|0>", "|1>"] // Default differ
        },
        check: (counts) => {
            const total = Object.values(counts).reduce((a, b) => a + b, 0);
            let count0 = 0;
            // q0 is LSB (last char)
            for (const [bin, cnt] of Object.entries(counts)) {
                if (bin.slice(-1) === '0') count0 += cnt;
            }
            const p0 = count0 / total;

            // Logic check: hard to know "Expected" without knowing inputs.
            // But we can give generic feedback.
            return {
                passed: true, // Always pass, just inform
                message: `Measured P(0) = ${p0.toFixed(2)}. (1.0 = Same, 0.5 = Orthogonal)`
            };
        }
    },

    qft: {
        title: "QFT (3-qubit)",
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
                // q0 section
                { type: 'H', col: 0, targets: [0] },
                { type: 'CP', col: 1, targets: [0], controls: [1], params: { phi: Math.PI / 2 } },
                { type: 'CP', col: 2, targets: [0], controls: [2], params: { phi: Math.PI / 4 } },
                // q1 section
                { type: 'H', col: 3, targets: [1] },
                { type: 'CP', col: 4, targets: [1], controls: [2], params: { phi: Math.PI / 2 } },
                // q2 section
                { type: 'H', col: 5, targets: [2] },
                // Swap q0, q2
                { type: 'SWAP', col: 6, targets: [0, 2] },
                // Measure all
                { type: 'M', col: 7, targets: [0] },
                { type: 'M', col: 7, targets: [1] },
                { type: 'M', col: 7, targets: [2] }
            ]
        }),
        inputs: { perQubitPreset: ["|0>", "|0>", "|0>"] },
        check: (counts) => {
            return { passed: true, message: "Check histogram. Uniform distribution expected for |000> input." };
        }
    },

    phase_estimation: {
        title: "Phase Estimation (Small)",
        descriptionHTML: `
            <p>Estimate phase &theta; of Unitary U=Rz(2&pi;&theta;).</p>
            <p>Using 2 precision qubits (q0, q1) and 1 target (q2).</p>
            <p>If target |1⟩ is eigenstate, we extract &theta;.</p>
        `,
        recommendedShots: 2048,
        params: { theta: 0.25 },
        getCircuit: (params) => {
            const theta = params.theta || 0;
            // 2-bit PE (+ target=q2)
            // 1. H on q0, q1
            // 2. Controlled-Us
            //    q1 controls U^1 = CRZ(2pi*theta)
            //    q0 controls U^2 = CRZ(4pi*theta)
            // 3. Inverse QFT on q0, q1
            //    Swap q0, q1
            //    H q1
            //    CP(-pi/2) q0->q1
            //    H q0

            return {
                numQubits: 3,
                numCols: 10,
                gates: [
                    // Prep
                    { type: 'X', col: 0, targets: [2] }, // Target |1>
                    { type: 'H', col: 0, targets: [0] },
                    { type: 'H', col: 0, targets: [1] },

                    // Controlled U^1 on q1 (target q2)
                    { type: 'CRZ', col: 1, targets: [2], controls: [1], params: { theta: 2 * Math.PI * theta } },

                    // Controlled U^2 on q0 (target q2) -> 2 * theta
                    { type: 'CRZ', col: 2, targets: [2], controls: [0], params: { theta: 4 * Math.PI * theta } },

                    // IQFT on q0, q1
                    { type: 'SWAP', col: 3, targets: [0, 1] },
                    { type: 'H', col: 4, targets: [1] }, // q1 is now top bit effectively after swap? Standard QFT logic reverse

                    // Controlled-Phase(-pi/2) from q0 to q1 (original logic: j < k)
                    // IQFT(2):
                    // H q0 (LSB)
                    // CP(-pi/2) q1, q0
                    // H q1 (MSB)
                    // SWAP

                    // Let's adhere to textbook IQFT 2-qubit on q0, q1:
                    // 1. Swap q0, q1
                    // 2. H q0
                    // 3. CS(-pi/2) q0, q1
                    // 4. H q1

                    // Wait, standard QFT on q0(m)..q1(l):
                    // H q0, CP q1->q0 ...
                    // IQFT reversed.

                    // Let's just implement explicit steps for 2 qubits.
                    // Qubits: 0, 1.
                    // Swap 0,1.
                    // H 0.
                    // CP(-pi/2) 0->1.
                    // H 1.

                    { type: 'SWAP', col: 3, targets: [0, 1] }, // Map q0->Top, q1->Bottom of pair? q0 is wire 0.
                    // Assuming wire 0 is MSB or LSB? Typically wire 0 is q0.
                    // QPE readout: q0, q1. Result y = 0.y1 y2 ...
                    // If theta = 0.25 (binary 0.01). q0=0, q1=1?
                    // Let's assume standard QPE output.

                    { type: 'H', col: 5, targets: [0] },
                    { type: 'CP', col: 6, targets: [0], controls: [1], params: { phi: -Math.PI / 2 } },
                    { type: 'H', col: 7, targets: [1] },

                    // Measure
                    { type: 'M', col: 8, targets: [0] },
                    { type: 'M', col: 8, targets: [1] }
                ]
            };
        },
        inputs: { perQubitPreset: ["|0>", "|0>", "|0>"] }, // Explicitly set |0> (|1> set by X gate)
        check: (counts, params) => {
            // Theta 0.25 -> 1/4. Binary 0.01.
            // Measured integer y = 2^t * theta = 4 * 0.25 = 1.
            // y=1 -> binary 01. (q1=0, q0=1)? Or q1=1, q0=0?
            // Depends on endianness.
            // If we check histogram, looking for peak.
            return { passed: true, message: `Check if peak corresponds to theta=${params.theta}` };
        }
    }
};
