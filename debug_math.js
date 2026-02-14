
import { cAdd, cMul, cAbs2 } from './sim/complex.js';
import { QuantumEngine } from './sim/statevector.js';
import { Circuit, Gate, InputState } from './model/circuit.js';

console.log("=== Debugging Quantum Simulation ===");

// 1. Test Complex Math
const c1 = [1, 0];
const c2 = [0, 1];
const prod = cMul(c1[0], c1[1], c2[0], c2[1]);
console.log(`cMul([1,0], [0,1]) = ${prod} (Expected [0, 1])`);

// 2. Test Single Gate Application (X Gate)
const engine = new QuantumEngine();
const numQubits = 1;

// Initial state |0> = [ [1,0], [0,0] ]
const inputState = new InputState(numQubits);
console.log("Initial Input State:", inputState.toStateVector());

const circuit = new Circuit(numQubits, 1);
circuit.addGate(new Gate('X', [0], [], {}, 0));

console.log("Circuit created with 1 X gate on q0");

// Run simulation
const history = engine.simulate(circuit, inputState, 'probability');

console.log("Simulation History Steps:", history.length);
history.forEach((step, i) => {
    console.log(`Step ${i} (Col ${step.col}):`);
    step.stateVector.forEach((amp, idx) => {
        const mag = cAbs2(amp[0], amp[1]);
        console.log(`  |${idx}>: [${amp[0]}, ${amp[1]}] mag=${mag}`);
    });
});
