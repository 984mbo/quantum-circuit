// ============================================================
// ui/svgCanvas.js — SVG Circuit Rendering & Animation
// ============================================================

import { GATE_QUBIT_COUNT, GATE_HAS_PARAM, GATE_COLORS } from '../model/circuit.js';

export const CELL_W = 47;
export const CELL_H = 40;
export const WIRE_Y_START = 27;
export const WIRE_X_START = 40;
const GATE_SIZE = 27;

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
        this.pulseProgress = 1;
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
        const totalW = Math.max(533, WIRE_X_START + this.circuit.numCols * CELL_W + 40);
        const totalH = WIRE_Y_START + this.circuit.numQubits * CELL_H + 20;
        this.svg.setAttribute('viewBox', `0 0 ${totalW} ${totalH}`);
        this.svg.setAttribute('preserveAspectRatio', 'xMinYMin meet');

        // Dynamic SVG sizing based on wire count
        const container = this.svg.parentElement;
        const containerH = container.clientHeight;
        const numQ = this.circuit.numQubits;

        // Reference: 2 wires = 80% of container height
        const ref2H = WIRE_Y_START + 2 * CELL_H + 20;
        const baseScale = (containerH * 0.8) / ref2H;

        const MAX_FIT_WIRES = 4;
        let svgHeight;

        if (numQ <= 2) {
            // 2 wires: 80% of container
            svgHeight = containerH * 0.8;
        } else if (numQ <= MAX_FIT_WIRES) {
            // 3-4 wires: scale to fit container, but don't exceed
            const neededH = totalH * baseScale;
            svgHeight = Math.min(neededH, containerH);
        } else {
            // 5+ wires: use the same scale as 4-wire-fit, allow scroll
            const ref4H = WIRE_Y_START + MAX_FIT_WIRES * CELL_H + 20;
            const fitScale = Math.min(baseScale, containerH / ref4H);
            svgHeight = totalH * fitScale;
        }

        this.svg.style.width = '100%';
        this.svg.style.height = svgHeight + 'px';

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
            'font-family': 'monospace', 'font-weight': 'bold', 'font-size': '10',
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
                x: 7, y: y + 4, fill: '#94a3b8',
                'font-family': 'monospace', 'font-size': '10', 'font-weight': 'bold'
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
                style: 'cursor: move;'
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
                cx: x, cy: cy, r: 4, fill: color,
                class: 'control-dot', 'data-control-index': 0  // Hook for drag
            }));

            if (gate.type === 'CX' || gate.type === 'CNOT') {
                // Target XOR
                group.appendChild(this._el('circle', {
                    cx: x, cy: ty, r: 11, fill: '#1e293b', stroke: baseColor, 'stroke-width': strokeW
                }));
                // Cross
                group.appendChild(this._el('line', { x1: x, y1: ty - 8, x2: x, y2: ty + 8, stroke: baseColor, 'stroke-width': 2 }));
                group.appendChild(this._el('line', { x1: x - 8, y1: ty, x2: x + 8, y2: ty, stroke: baseColor, 'stroke-width': 2 }));
            } else if (gate.type === 'CZ') {
                // CZ Target Box with Z
                const r = box(ty);
                group.appendChild(r);
                const label = this._el('text', {
                    x, y: ty + 4, 'text-anchor': 'middle',
                    fill: isActive ? '#000' : color,
                    'font-family': 'sans-serif', 'font-weight': 'bold', 'font-size': 11
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
                    x, y: ty + 4, 'text-anchor': 'middle', fill: isActive ? '#000' : color,
                    'font-family': 'sans-serif', 'font-weight': 'bold', 'font-size': 10
                });
                label.textContent = 'P';
                group.appendChild(label);

                // Param
                if (gate.params.phi !== undefined) {
                    const sub = this._el('text', {
                        x, y: ty + 18, 'text-anchor': 'middle', fill: '#94a3b8', 'font-size': 6
                    });
                    sub.textContent = (gate.params.phi / Math.PI).toFixed(2) + 'π';
                    group.appendChild(sub);
                }
            } else if (gate.type === 'CRZ') {
                const r = box(ty);
                group.appendChild(r);
                const label = this._el('text', {
                    x, y: ty + 4, 'text-anchor': 'middle', fill: isActive ? '#000' : color,
                    'font-family': 'sans-serif', 'font-weight': 'bold', 'font-size': 10
                });
                label.textContent = 'Rz';
                group.appendChild(label);

                if (gate.params.theta !== undefined) {
                    const sub = this._el('text', {
                        x, y: ty + 18, 'text-anchor': 'middle', fill: '#94a3b8', 'font-size': 6
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
                group.appendChild(this._el('circle', { cx: x, cy: cy, r: 4, fill: color }));
            }

            const y1 = this.qubitY(gate.targets[0]);
            const y2 = this.qubitY(gate.targets[1]);

            // If simple SWAP, draw line between targets
            if (gate.type === 'SWAP') {
                group.appendChild(this._el('line', { x1: x, y1: y1, x2: x, y2: y2, stroke: color, 'stroke-width': 2 }));
            }

            const drawCross = (y) => {
                const s = 4;
                group.appendChild(this._el('line', { x1: x - s, y1: y - s, x2: x + s, y2: y + s, stroke: baseColor, 'stroke-width': 2 }));
                group.appendChild(this._el('line', { x1: x + s, y1: y - s, x2: x - s, y2: y + s, stroke: baseColor, 'stroke-width': 2 }));
            }
            drawCross(y1);
            drawCross(y2);
        } else if (gate.type === 'Measure') {
            // Measurement gate — meter icon (semicircle + needle)
            const y = this.qubitY(gate.targets[0]);
            group.appendChild(box(y));

            const meterColor = isActive ? '#ffffff' : color;

            // Semicircle arc (bottom half of meter dial)
            const arcR = 8;
            const arcCY = y + 1;
            // SVG arc: from left to right of semicircle
            const arcPath = `M ${x - arcR} ${arcCY} A ${arcR} ${arcR} 0 0 1 ${x + arcR} ${arcCY}`;
            group.appendChild(this._el('path', {
                d: arcPath,
                fill: 'none',
                stroke: meterColor,
                'stroke-width': 1.5,
                'stroke-linecap': 'round'
            }));

            // Baseline of the meter
            group.appendChild(this._el('line', {
                x1: x - arcR - 1, y1: arcCY,
                x2: x + arcR + 1, y2: arcCY,
                stroke: meterColor,
                'stroke-width': 1
            }));

            // Needle pointing to upper-right (~45 degrees)
            const needleLen = arcR - 1;
            const needleAngle = -45 * (Math.PI / 180); // 45 degrees from horizontal
            const nx = x + needleLen * Math.cos(needleAngle);
            const ny = arcCY + needleLen * Math.sin(needleAngle);
            group.appendChild(this._el('line', {
                x1: x, y1: arcCY,
                x2: nx, y2: ny,
                stroke: meterColor,
                'stroke-width': 1.5,
                'stroke-linecap': 'round'
            }));

            // Small dot at the needle pivot
            group.appendChild(this._el('circle', {
                cx: x, cy: arcCY, r: 1.5,
                fill: meterColor
            }));

            // Arrowhead at needle tip
            const arrowSize = 2;
            const arrowAngle1 = needleAngle + 2.5;
            const arrowAngle2 = needleAngle - 0.6;
            const ax1 = nx - arrowSize * Math.cos(arrowAngle1);
            const ay1 = ny - arrowSize * Math.sin(arrowAngle1);
            const ax2 = nx - arrowSize * Math.cos(arrowAngle2);
            const ay2 = ny - arrowSize * Math.sin(arrowAngle2);
            group.appendChild(this._el('polygon', {
                points: `${nx},${ny} ${ax1},${ay1} ${ax2},${ay2}`,
                fill: meterColor
            }));
        } else {
            // Standard single qubit
            const y = this.qubitY(gate.targets[0]);
            group.appendChild(box(y));

            const label = this._el('text', {
                x, y: y + 4, 'text-anchor': 'middle',
                fill: isActive ? '#000' : color,
                'font-family': 'sans-serif', 'font-weight': 'bold', 'font-size': 11
            });
            label.textContent = gate.label;
            if (isActive) label.setAttribute('fill', '#ffffff');
            group.appendChild(label);

            // Parameters
            if (gate.params.theta !== undefined) {
                const sub = this._el('text', {
                    x, y: y + 18, 'text-anchor': 'middle',
                    fill: '#94a3b8', 'font-size': 7
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

    setPulseProgress(progress) {
        this.pulseProgress = Math.max(0, Math.min(1, progress));
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
        this.pulseProgress = 1;
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

        const startX = WIRE_X_START - 20;
        const phase = Math.max(0, this.pulseCol + this.pulseProgress);
        const wireEndX = startX + phase * CELL_W;

        for (let q = 0; q < this.circuit.numQubits; q++) {
            let red = 255, green = 255, blue = 255;

            // Calculate cumulative color up to current column
            for (let c = 0; c <= this.pulseCol; c++) {
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

            // Faint traveled line
            g.appendChild(this._el('line', {
                x1: startX, y1: y, x2: wireEndX, y2: y,
                stroke: finalColor, 'stroke-width': 2.5, 'stroke-linecap': 'round',
                'stroke-opacity': '0.18'
            }));

            // Comet tail (short gradient segment near head)
            const tailLen = 140;
            const tailStart = Math.max(startX, wireEndX - tailLen);
            const tailId = `tail-comet-${q}`;
            let grad = document.getElementById(tailId);
            if (!grad) {
                const defs = this.svg.querySelector('defs');
                if (defs) {
                    grad = this._el('linearGradient', {
                        id: tailId,
                        gradientUnits: 'userSpaceOnUse'
                    });
                    defs.appendChild(grad);
                }
            }
            if (grad) {
                grad.setAttribute('x1', tailStart);
                grad.setAttribute('y1', y);
                grad.setAttribute('x2', wireEndX);
                grad.setAttribute('y2', y);
                grad.innerHTML = '';
                grad.appendChild(this._el('stop', { offset: '0%', 'stop-color': finalColor, 'stop-opacity': '0' }));
                grad.appendChild(this._el('stop', { offset: '60%', 'stop-color': finalColor, 'stop-opacity': '0.35' }));
                grad.appendChild(this._el('stop', { offset: '100%', 'stop-color': finalColor, 'stop-opacity': '1' }));
            }

            g.appendChild(this._el('line', {
                x1: tailStart, y1: y, x2: wireEndX, y2: y,
                stroke: `url(#${tailId})`, 'stroke-width': 6, 'stroke-linecap': 'round'
            }));

            // Comet head
            g.appendChild(this._el('circle', {
                cx: wireEndX, cy: y, r: 5, fill: finalColor,
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

        // Convert to viewbox coords accounting for preserveAspectRatio="xMinYMin meet"
        const vb = this.svg.viewBox.baseVal;
        const scaleX = vb.width / rect.width;
        const scaleY = vb.height / rect.height;
        // meet: use the larger scale factor (content fits within element)
        const scale = Math.max(scaleX, scaleY);

        const svgX = x * scale;
        const svgY = y * scale;

        const col = Math.floor((svgX - WIRE_X_START) / CELL_W);
        const qubit = Math.floor((svgY - WIRE_Y_START) / CELL_H);

        if (col < 0 || qubit < 0 || qubit >= this.circuit.numQubits) return null;
        return { col, qubit };
    }
}
