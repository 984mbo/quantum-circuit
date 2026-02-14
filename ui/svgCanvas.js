// ============================================================
// ui/svgCanvas.js — SVG Circuit Rendering & Animation
// ============================================================

import { GATE_QUBIT_COUNT, GATE_HAS_PARAM, GATE_COLORS } from '../model/circuit.js';

const CELL_W = 70;
const CELL_H = 60;
const WIRE_Y_START = 40;
const WIRE_X_START = 60;
const GATE_SIZE = 40;

export class CircuitCanvas {
    /**
     * @param {SVGElement} svgElement
     * @param {import('../model/circuit.js').Circuit} circuit
     */
    constructor(svgElement, circuit) {
        this.svg = svgElement;
        this.circuit = circuit;

        // Animation state
        this.pulseCol = -1;
        this.pulseColor = '#ffffff';
        this.glowingGates = new Set();

        // Selection state
        this.selectedGateId = null;

        this._setupSVGDefs();
        this.render();
    }

    // ─── Setup ────────────────────────────────────────────────

    _setupSVGDefs() {
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

        // Glow filters
        const mkGlow = (id, std) => {
            const f = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
            f.setAttribute('id', id);
            f.setAttribute('x', '-50%'); f.setAttribute('y', '-50%');
            f.setAttribute('width', '200%'); f.setAttribute('height', '200%');
            const gb = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
            gb.setAttribute('in', 'SourceGraphic');
            gb.setAttribute('stdDeviation', std);
            gb.setAttribute('result', 'blur');
            const merge = this._el('feMerge');
            merge.appendChild(this._el('feMergeNode', { in: 'blur' }));
            merge.appendChild(this._el('feMergeNode', { in: 'SourceGraphic' }));
            f.appendChild(gb);
            f.appendChild(merge);
            return f;
        };

        defs.appendChild(mkGlow('glow', '3'));
        defs.appendChild(mkGlow('glow-intense', '6'));
        defs.appendChild(mkGlow('glow-current', '4'));

        this.svg.appendChild(defs);
    }

    _el(tag, attrs = {}) {
        const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
        for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
        return el;
    }

    // ─── Geometry ─────────────────────────────────────────────

    colX(col) { return WIRE_X_START + col * CELL_W + CELL_W / 2; }
    qubitY(q) { return WIRE_Y_START + q * CELL_H + CELL_H / 2; }

    // ─── Render ───────────────────────────────────────────────

    render() {
        // Preserve defs
        const defs = this.svg.querySelector('defs');
        this.svg.innerHTML = '';
        if (defs) this.svg.appendChild(defs);

        // Update Dimensions
        const totalW = Math.max(800, WIRE_X_START + this.circuit.numCols * CELL_W + 60);
        const totalH = WIRE_Y_START + this.circuit.numQubits * CELL_H + 20;
        this.svg.setAttribute('viewBox', `0 0 ${totalW} ${totalH}`);
        this.svg.style.width = '100%';

        this._renderGrid();
        this._renderWires();
        this._renderCurrentFlow();
        this._renderGates();
        this._renderLabels();

        // Clear any measurement overlays on full render
        this.svg.querySelectorAll('.measure-result').forEach(e => e.remove());
    }

    drawMeasurementResult(gateId, val) {
        const group = this.svg.querySelector(`.gate-group[data-gate-id="${gateId}"]`);
        if (!group) return;

        // Remove existing result for this gate if any
        const existing = group.querySelector('.measure-result-text');
        if (existing) existing.remove();

        // Draw result text
        // Bottom right of the gate?
        const rect = group.querySelector('rect');
        if (!rect) return;

        const x = parseFloat(rect.getAttribute('x')) + parseFloat(rect.getAttribute('width')) + 5;
        const y = parseFloat(rect.getAttribute('y')) + parseFloat(rect.getAttribute('height')) - 5;

        const text = this._el('text', {
            x: x, y: y,
            fill: '#ef4444', // Red color for result
            'font-family': 'monospace', 'font-weight': 'bold', 'font-size': '14',
            class: 'measure-result-text'
        });
        text.textContent = val;
        group.appendChild(text);
    }

    _renderGrid() {
        const g = this._el('g', { class: 'grid' });
        for (let c = 0; c < this.circuit.numCols; c++) {
            const x = WIRE_X_START + c * CELL_W;
            for (let q = 0; q < this.circuit.numQubits; q++) {
                const y = WIRE_Y_START + q * CELL_H;
                g.appendChild(this._el('rect', {
                    x, y, width: CELL_W, height: CELL_H,
                    fill: 'transparent', stroke: 'rgba(255,255,255,0.05)',
                    'stroke-width': '1', rx: 4
                }));
            }
        }
        this.svg.appendChild(g);
    }

    _renderWires() {
        const g = this._el('g', { class: 'wires' });
        const endX = WIRE_X_START + this.circuit.numCols * CELL_W + 20;
        for (let q = 0; q < this.circuit.numQubits; q++) {
            const y = this.qubitY(q);
            g.appendChild(this._el('line', {
                x1: WIRE_X_START - 20, y1: y, x2: endX, y2: y,
                stroke: '#334155', 'stroke-width': '2'
            }));
        }
        this.svg.appendChild(g);
    }

    _renderLabels() {
        const g = this._el('g', { class: 'labels' });
        for (let q = 0; q < this.circuit.numQubits; q++) {
            const y = this.qubitY(q);
            g.appendChild(this._el('text', {
                x: 10, y: y + 5, fill: '#94a3b8',
                'font-family': 'monospace', 'font-size': '14', 'font-weight': 'bold'
            })).textContent = `q${q}`;
        }
        this.svg.appendChild(g);
    }

    // ─── Gates ────────────────────────────────────────────────

    _renderGates() {
        const g = this._el('g', { class: 'gates' });
        for (const gate of this.circuit.gates) {
            const isActive = this.glowingGates.has(gate.id);
            const isSelected = this.selectedGateId === gate.id;

            const group = this._el('g', {
                class: `gate-group ${isActive ? 'active' : ''} ${isSelected ? 'selected' : ''}`,
                'data-gate-id': gate.id,
                style: 'cursor: pointer;'
            });

            this._renderGateShape(group, gate, isActive, isSelected);
            g.appendChild(group);
        }
        this.svg.appendChild(g);
    }

    _renderGateShape(group, gate, isActive, isSelected) {
        const x = this.colX(gate.col);
        const color = gate.color;
        const strokeW = isSelected ? 3 : 2;
        const baseColor = isSelected ? '#ffffff' : color;

        // Common box style
        const box = (y) => {
            const r = this._el('rect', {
                x: x - GATE_SIZE / 2, y: y - GATE_SIZE / 2,
                width: GATE_SIZE, height: GATE_SIZE, rx: 6,
                fill: isActive ? color : '#1e293b', // Fill color if active
                stroke: isActive ? '#ffffff' : color,
                'stroke-width': strokeW
            });
            if (isActive) r.setAttribute('filter', 'url(#glow-intense)');
            return r;
        }

        if (['CX', 'CNOT', 'CZ', 'CP', 'CRZ'].includes(gate.type)) {
            const cy = this.qubitY(gate.controls[0]);
            const ty = this.qubitY(gate.targets[0]);
            // Control line
            group.appendChild(this._el('line', {
                x1: x, y1: cy, x2: x, y2: ty, stroke: color, 'stroke-width': 2
            }));
            // Control dot
            group.appendChild(this._el('circle', {
                cx: x, cy: cy, r: 6, fill: color,
                class: 'control-dot', 'data-control-index': 0  // Hook for drag
            }));

            if (gate.type === 'CX' || gate.type === 'CNOT') {
                // Target XOR
                group.appendChild(this._el('circle', {
                    cx: x, cy: ty, r: 16, fill: '#1e293b', stroke: baseColor, 'stroke-width': strokeW
                }));
                // Cross
                group.appendChild(this._el('line', { x1: x, y1: ty - 12, x2: x, y2: ty + 12, stroke: baseColor, 'stroke-width': 2 }));
                group.appendChild(this._el('line', { x1: x - 12, y1: ty, x2: x + 12, y2: ty, stroke: baseColor, 'stroke-width': 2 }));
            } else if (gate.type === 'CZ') {
                // CZ Target Box with Z
                const r = box(ty);
                group.appendChild(r);
                const label = this._el('text', {
                    x, y: ty + 5, 'text-anchor': 'middle',
                    fill: isActive ? '#000' : color,
                    'font-family': 'sans-serif', 'font-weight': 'bold', 'font-size': 16
                });
                label.textContent = 'Z';
                if (isActive) label.setAttribute('fill', '#ffffff');
                group.appendChild(label);
            } else if (gate.type === 'CP') {
                // CP Target box with phi? Or just dot with 'P'?
                // Convention: Control dot - dotted line - Control dot with P?
                // Or just Box on target with 'CP' label?
                // Text book: Control dot - Box(P).
                const r = box(ty);
                group.appendChild(r);
                const label = this._el('text', {
                    x, y: ty + 5, 'text-anchor': 'middle', fill: isActive ? '#000' : color,
                    'font-family': 'sans-serif', 'font-weight': 'bold', 'font-size': 14
                });
                label.textContent = 'P';
                group.appendChild(label);

                // Param
                if (gate.params.phi !== undefined) {
                    const sub = this._el('text', {
                        x, y: ty + 26, 'text-anchor': 'middle', fill: '#94a3b8', 'font-size': 9
                    });
                    sub.textContent = (gate.params.phi / Math.PI).toFixed(2) + 'π';
                    group.appendChild(sub);
                }
            } else if (gate.type === 'CRZ') {
                const r = box(ty);
                group.appendChild(r);
                const label = this._el('text', {
                    x, y: ty + 5, 'text-anchor': 'middle', fill: isActive ? '#000' : color,
                    'font-family': 'sans-serif', 'font-weight': 'bold', 'font-size': 14
                });
                label.textContent = 'Rz';
                group.appendChild(label);

                if (gate.params.theta !== undefined) {
                    const sub = this._el('text', {
                        x, y: ty + 26, 'text-anchor': 'middle', fill: '#94a3b8', 'font-size': 9
                    });
                    sub.textContent = (gate.params.theta / Math.PI).toFixed(2) + 'π';
                    group.appendChild(sub);
                }
            }
        } else if (gate.type === 'SWAP' || gate.type === 'CSWAP') {
            // SWAP or Controlled Swap
            let targets = gate.targets;
            if (gate.type === 'CSWAP') {
                // Control is controls[0]
                const cy = this.qubitY(gate.controls[0]);
                const t1y = this.qubitY(gate.targets[0]);
                // Draw line from control to target1?
                // Line covering all?
                // Find min/max y
                const ys = [cy, this.qubitY(gate.targets[0]), this.qubitY(gate.targets[1])];
                const minY = Math.min(...ys);
                const maxY = Math.max(...ys);

                group.appendChild(this._el('line', {
                    x1: x, y1: minY, x2: x, y2: maxY, stroke: color, 'stroke-width': 2
                }));

                // Control dot
                group.appendChild(this._el('circle', { cx: x, cy: cy, r: 6, fill: color }));
            }

            const y1 = this.qubitY(gate.targets[0]);
            const y2 = this.qubitY(gate.targets[1]);

            // If simple SWAP, draw line between targets
            if (gate.type === 'SWAP') {
                group.appendChild(this._el('line', { x1: x, y1: y1, x2: x, y2: y2, stroke: color, 'stroke-width': 2 }));
            }

            const drawCross = (y) => {
                const s = 6;
                group.appendChild(this._el('line', { x1: x - s, y1: y - s, x2: x + s, y2: y + s, stroke: baseColor, 'stroke-width': 2.5 }));
                group.appendChild(this._el('line', { x1: x + s, y1: y - s, x2: x - s, y2: y + s, stroke: baseColor, 'stroke-width': 2.5 }));
            }
            drawCross(y1);
            drawCross(y2);
        } else {
            // Standard single qubit
            const y = this.qubitY(gate.targets[0]);
            group.appendChild(box(y));

            const label = this._el('text', {
                x, y: y + 5, 'text-anchor': 'middle',
                fill: isActive ? '#000' : color,
                'font-family': 'sans-serif', 'font-weight': 'bold', 'font-size': 16
            });
            label.textContent = gate.label;
            if (isActive) label.setAttribute('fill', '#ffffff');
            group.appendChild(label);

            // Parameters
            if (gate.params.theta !== undefined) {
                const sub = this._el('text', {
                    x, y: y + 26, 'text-anchor': 'middle',
                    fill: '#94a3b8', 'font-size': 10
                });
                sub.textContent = (gate.params.theta / Math.PI).toFixed(2) + 'π';
                group.appendChild(sub);
            }
        }
    }

    // ─── Animation ────────────────────────────────────────────

    setPulseColumn(col) {
        this.pulseCol = col;
        this._renderCurrentFlow();
    }

    setGlowing(gateIds) {
        // Efficiently toggle classes without re-rendering everything
        const ids = new Set(gateIds);
        const groups = this.svg.querySelectorAll('.gate-group');
        groups.forEach(g => {
            const id = parseInt(g.dataset.gateId);
            if (ids.has(id)) {
                g.classList.add('active');
            } else {
                g.classList.remove('active');
            }
        });

        // Also ensure glowingGates set is updated for full re-renders
        this.glowingGates = ids;
    }

    clearPulse() {
        this.pulseCol = -1;
        this.glowingGates.clear();
        const flow = this.svg.querySelector('.current-flow');
        if (flow) flow.remove();

        // Remove active class
        this.svg.querySelectorAll('.gate-group.active').forEach(g => g.classList.remove('active'));
    }

    _renderCurrentFlow() {
        console.log('[Canvas] _renderCurrentFlow called. pulseCol:', this.pulseCol);
        // Remove existing flow layer to allow animation restart
        const existing = this.svg.querySelector('.current-flow');
        if (existing) existing.remove();

        if (this.pulseCol < 0) return;

        const g = this._el('g', { class: 'current-flow' });
        // Insert before gates so gates draw on top? Or after?
        // Gates glow on top. Flow is "current".
        // Let's put flow BEHIND gates but ON TOP of wires.
        // The render order in render() is: Grid, Wires, Flow, Gates.
        // So we should insert before the first gate group?
        // Or just append if we want it on top.
        // Let's append for now, but `gate-group` has filter, so maybe on top is fine.

        // Actually, to preserve DOM order:
        // Wires are static. Gates are static.
        // We can append to SVG, but make sure z-index (DOM order) is correct.
        // If we append, it covers gates.
        // We want flow behind gates?
        // In `render()`, `_renderCurrentFlow` is called BEFORE `_renderGates`.
        // So we should insert before the `.gates` group.

        const gatesGroup = this.svg.querySelector('.gates');
        if (gatesGroup) {
            this.svg.insertBefore(g, gatesGroup);
        } else {
            this.svg.appendChild(g);
        }

        const col = this.pulseCol;
        const wireEndX = this.colX(col); // Current reaches center of column

        for (let q = 0; q < this.circuit.numQubits; q++) {
            let red = 255, green = 255, blue = 255;

            // Calculate cumulative color up to current column
            for (let c = 0; c < col; c++) {
                const gates = this.circuit.getGatesAtCol(c);
                gates.forEach(gate => {
                    if (gate.allQubits.includes(q)) {
                        // Blend gate color
                        const gc = this._hexToRgb(gate.color);
                        red = (red + gc.r) / 2;
                        green = (green + gc.g) / 2;
                        blue = (blue + gc.b) / 2;
                    }
                });
            }

            const finalColor = `rgb(${Math.round(red)},${Math.round(green)},${Math.round(blue)})`;
            const y = this.qubitY(q);
            const startX = WIRE_X_START - 20;

            // Draw trail
            const trailId = `trail-${q}`;
            let grad = document.getElementById(trailId);
            if (!grad) {
                const defs = this.svg.querySelector('defs');
                if (defs) {
                    grad = this._el('linearGradient', { id: trailId, x1: '0', y1: '0', x2: '1', y2: '0' });
                    defs.appendChild(grad);
                }
            }
            // Update gradient stop color
            if (grad) {
                grad.innerHTML = '';
                grad.appendChild(this._el('stop', { offset: '0%', 'stop-color': '#ffffff', 'stop-opacity': '0' }));
                grad.appendChild(this._el('stop', { offset: '100%', 'stop-color': finalColor, 'stop-opacity': '1' }));
            }

            // Head pulse
            // We use a trick: line with gradient for trail
            g.appendChild(this._el('line', {
                x1: startX, y1: y, x2: wireEndX, y2: y,
                stroke: `url(#${trailId})`, 'stroke-width': 4, 'stroke-linecap': 'round',
                class: 'wire-current' // triggers animation
            }));

            // Head glow
            g.appendChild(this._el('circle', {
                cx: wireEndX, cy: y, r: 4, fill: finalColor,
                filter: 'url(#glow-current)'
            }));
        }
    }

    _hexToRgb(hex) {
        if (!hex || !hex.startsWith('#')) return { r: 255, g: 255, b: 255 };
        const bigint = parseInt(hex.slice(1), 16);
        return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
    }

    // ─── Interaction Helpers ──────────────────────────────────

    getGridPos(clientX, clientY) {
        const rect = this.svg.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        // Convert to viewbox coords
        const vb = this.svg.viewBox.baseVal;
        const scaleX = vb.width / rect.width;
        const scaleY = vb.height / rect.height;

        const svgX = x * scaleX;
        const svgY = y * scaleY;

        const col = Math.floor((svgX - WIRE_X_START) / CELL_W);
        const qubit = Math.floor((svgY - WIRE_Y_START) / CELL_H);

        if (col < 0 || qubit < 0 || qubit >= this.circuit.numQubits) return null;
        return { col, qubit };
    }
}
