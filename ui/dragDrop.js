// ============================================================
// ui/dragDrop.js — Interaction Handler (DnD, Click, Delete)
// ============================================================

import { GATE_QUBIT_COUNT, GATE_HAS_PARAM, Gate } from '../model/circuit.js';

export class DragDropHandler {
    /**
     * @param {import('../model/circuit.js').Circuit} circuit
     * @param {import('./svgCanvas.js').CircuitCanvas} canvas
     * @param {HTMLElement} container
     * @param {function} onUpdate callback when circuit changes
     */
    constructor(circuit, canvas, container, onUpdate) {
        this.circuit = circuit;
        this.canvas = canvas;
        this.container = container;
        this.onUpdate = onUpdate;

        this.clickModeType = null;
        this._skipNextClick = false;

        this._initDnD();
        this._initClickPlacement();
        this._initGateMoveDrag();
        this._initControlDrag();
        this._initDoubleClick();
        this._initSelection();
        this._initDeletion();
    }

    // ─── Drag & Drop ──────────────────────────────────────────

    _initDnD() {
        // Sidebar items are draggable
        document.querySelectorAll('.drag-gate').forEach(el => {
            el.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('gate-type', el.dataset.gate);
                e.dataTransfer.effectAllowed = 'copy';
                this.clickModeType = null; // Cancel click mode
                this._clearSelection();
            });
        });

        // Canvas container as drop zone
        this.container.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            this.container.classList.add('drag-over');

            const pos = this.canvas.getGridPos(e.clientX, e.clientY);
            if (pos) {
                this._showDropHighlight(pos);
            }
        });

        this.container.addEventListener('dragleave', (e) => {
            this.container.classList.remove('drag-over');
            this._hideDropHighlight();
        });

        this.container.addEventListener('drop', (e) => {
            e.preventDefault();
            this.container.classList.remove('drag-over');
            this._hideDropHighlight();

            const type = e.dataTransfer.getData('gate-type');
            const pos = this.canvas.getGridPos(e.clientX, e.clientY);

            if (type && pos) {
                this._tryPlaceGate(type, pos.col, pos.qubit);
            }
        });
    }

    _showDropHighlight(pos) {
        // Implement overlay logic or use canvas method if available
        // For MVP, maybe just rely on CSS cursor, but spec says "blue dotted highlight"
        let overlay = document.getElementById('drop-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'drop-overlay';
            this.container.appendChild(overlay);
        }

        const rect = this.canvas.svg.getBoundingClientRect();
        const vb = this.canvas.svg.viewBox.baseVal;
        const scaleX = rect.width / vb.width;
        const scaleY = rect.height / vb.height;

        const x = this.canvas.colX(pos.col) - 35; // centered
        const y = this.canvas.qubitY(pos.qubit) - 30;

        overlay.style.display = 'block';
        overlay.style.position = 'absolute';
        overlay.style.left = (x * scaleX) + 'px';
        overlay.style.top = (y * scaleY) + 'px';
        overlay.style.width = (70 * scaleX) + 'px';
        overlay.style.height = (60 * scaleY) + 'px';
        overlay.style.border = '2px dashed #22d3ee';
        overlay.style.backgroundColor = 'rgba(34, 211, 238, 0.1)';
        overlay.style.pointerEvents = 'none';
        overlay.style.zIndex = '10';
    }

    _hideDropHighlight() {
        const overlay = document.getElementById('drop-overlay');
        if (overlay) overlay.style.display = 'none';
    }

    // ─── Click Placement ──────────────────────────────────────

    _initClickPlacement() {
        // Sidebar click to enter mode
        document.querySelectorAll('.drag-gate').forEach(el => {
            el.addEventListener('click', (e) => {
                // Toggle if same
                if (this.clickModeType === el.dataset.gate) {
                    this.clickModeType = null;
                    el.classList.remove('selected-tool');
                } else {
                    // Unselect others
                    document.querySelectorAll('.drag-gate').forEach(b => b.classList.remove('selected-tool'));
                    this.clickModeType = el.dataset.gate;
                    el.classList.add('selected-tool');
                }
            });
        });

        // Canvas click
        this.canvas.svg.addEventListener('click', (e) => {
            if (this._skipNextClick) {
                this._skipNextClick = false;
                return;
            }
            if (!this.clickModeType) return;

            const pos = this.canvas.getGridPos(e.clientX, e.clientY);
            if (pos) {
                this._tryPlaceGate(this.clickModeType, pos.col, pos.qubit);
                // Don't exit mode to allow multiple placements? Or exit?
                // "Click placement -> Canvas Click" usually implies one-shot or sticky.
                // Let's make it sticky for convenience? But "Selection" needs click too.
                // If we are in placement mode, click places. If not, click selects.
            }
        });
    }

    _initGateMoveDrag() {
        let drag = null;

        this.canvas.svg.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return; // left click only
            if (this.clickModeType) return; // placing mode disabled
            if (e.target.closest('.control-dot')) return; // handled by control drag

            const group = e.target.closest('.gate-group');
            if (!group) return;
            e.preventDefault();

            const gateId = parseInt(group.dataset.gateId);
            const gate = this.circuit.gates.find((g) => g.id === gateId);
            if (!gate) return;

            const allQubits = gate.allQubits;
            const anchorQubit = Math.min(...allQubits);
            const startPos = this.canvas.getGridPos(e.clientX, e.clientY);

            drag = {
                gateId,
                gate,
                startX: e.clientX,
                startY: e.clientY,
                anchorQubit,
                pointerColOffset: startPos ? (startPos.col - gate.col) : 0,
                pointerQubitOffset: startPos ? (startPos.qubit - anchorQubit) : 0,
                lastPos: startPos || null,
                active: false
            };
        });

        window.addEventListener('mousemove', (e) => {
            if (!drag) return;

            const dx = e.clientX - drag.startX;
            const dy = e.clientY - drag.startY;
            const moved = Math.hypot(dx, dy);

            if (!drag.active && moved > 5) {
                drag.active = true;
                this.container.classList.add('dragging-gate');
                this.canvas.svg
                    .querySelector(`.gate-group[data-gate-id="${drag.gateId}"]`)
                    ?.classList.add('dragging');
            }

            if (!drag.active) return;

            const pos = this.canvas.getGridPos(e.clientX, e.clientY);
            if (pos) {
                drag.lastPos = pos;
                this._showDropHighlight({ col: pos.col, qubit: pos.qubit });
            } else {
                this._hideDropHighlight();
            }
        });

        window.addEventListener('mouseup', (e) => {
            if (!drag) return;

            const wasActive = drag.active;
            if (wasActive) {
                this._skipNextClick = true;
                const group = this.canvas.svg.querySelector(`.gate-group[data-gate-id="${drag.gateId}"]`);
                if (group) group.classList.remove('dragging');
                this.container.classList.remove('dragging-gate');
                this._hideDropHighlight();

                const pos = this.canvas.getGridPos(e.clientX, e.clientY) || drag.lastPos;
                if (pos) {
                    try {
                        const targetCol = Math.max(0, pos.col - drag.pointerColOffset);
                        const targetAnchorQubit = pos.qubit - drag.pointerQubitOffset;
                        const dir = Math.sign(targetCol - drag.gate.col) || 1;
                        this._moveGateSmart(drag.gateId, targetCol, targetAnchorQubit, dir);
                        this.canvas.selectedGateId = drag.gateId;
                        this.canvas.render();
                        this.onUpdate();
                    } catch (err) {
                        // Fallback: use raw drop cell as anchor.
                        try {
                            const rawCol = Math.max(0, pos.col);
                            const dir = Math.sign(rawCol - drag.gate.col) || 1;
                            this._moveGateSmart(drag.gateId, rawCol, pos.qubit, dir);
                            this.canvas.selectedGateId = drag.gateId;
                            this.canvas.render();
                            this.onUpdate();
                        } catch (err2) {
                            console.warn('[DnD] Gate move rejected:', err2.message);
                        }
                    }
                }
            }

            drag = null;
        });
    }

    _moveGateSmart(gateId, col, anchorQubit, preferredDir = 1) {
        try {
            this._moveGateTo(gateId, col, anchorQubit);
            return;
        } catch (err) {
            if (!String(err.message).includes('collision')) throw err;
        }

        const maxTry = Math.max(this.circuit.numCols + 2, col + 6);
        for (let offset = 1; offset <= maxTry; offset++) {
            const c1 = col + offset * preferredDir;
            if (c1 >= 0) {
                try {
                    this._moveGateTo(gateId, c1, anchorQubit);
                    return;
                } catch (_) { }
            }

            const c2 = col - offset * preferredDir;
            if (c2 >= 0) {
                try {
                    this._moveGateTo(gateId, c2, anchorQubit);
                    return;
                } catch (_) { }
            }
        }

        throw new Error('No available column to move');
    }

    _moveGateTo(gateId, newCol, newAnchorQubit) {
        const gate = this.circuit.gates.find((g) => g.id === gateId);
        if (!gate) throw new Error('Gate not found');

        const oldTargets = [...gate.targets];
        const oldControls = [...gate.controls];
        const oldAnchorQubit = Math.min(...gate.allQubits);
        const dQ = newAnchorQubit - oldAnchorQubit;

        const movedTargets = oldTargets.map((q) => q + dQ);
        const movedControls = oldControls.map((q) => q + dQ);
        const occupied = new Set([...movedTargets, ...movedControls]);

        for (const q of occupied) {
            if (q < 0 || q >= this.circuit.numQubits) {
                throw new Error('Move out of wire range');
            }
        }

        for (const other of this.circuit.getGatesAtCol(newCol)) {
            if (other.id === gate.id) continue;
            for (const q of other.allQubits) {
                if (occupied.has(q)) {
                    throw new Error('Cell collision on target column');
                }
            }
        }

        gate.targets = movedTargets;
        gate.controls = movedControls;
        gate.col = newCol;

        if (newCol >= this.circuit.numCols - 1) {
            this.circuit.numCols = newCol + 2;
        }
    }

    _tryPlaceGate(type, col, startQubit) {
        let targets = [startQubit];
        let controls = [];

        // Multi-qubit handling
        const count = GATE_QUBIT_COUNT[type] || 1;
        if (count === 2) {
            // Rule: clicked is control/upper, next is target/lower
            if (startQubit + 1 >= this.circuit.numQubits) {
                alert('Cannot place 2-qubit gate on the bottom wire');
                return;
            }
            if (type === 'CX' || type === 'CNOT' || type === 'CZ') {
                controls = [startQubit];
                targets = [startQubit + 1];
            } else if (type === 'SWAP') {
                targets = [startQubit, startQubit + 1];
            }
        }

        let params = {};
        if (GATE_HAS_PARAM[type]) {
            // "theta is pi unit"
            const input = prompt(`Enter theta for ${type} (units of π):`, '0.5');
            if (input === null) return; // Cancel
            const val = parseFloat(input);
            if (isNaN(val)) {
                alert('Invalid number');
                return;
            }
            params.theta = val * Math.PI;
        }

        try {
            const gate = new Gate(type, targets, controls, params, col);
            this.circuit.addGate(gate);

            // Reset mode if needed?
            // Let's keep mode for rapid placement, but maybe clear selection
            this._clearSelection();
            this.canvas.render();
            this.onUpdate();

        } catch (err) {
            alert(err.message);
        }
    }

    // ─── Selection & Decoration ───────────────────────────────

    _initSelection() {
        // Canvas click to select gate (if not in placement mode)
        this.canvas.svg.addEventListener('click', (e) => {
            if (this._skipNextClick) {
                this._skipNextClick = false;
                return;
            }
            if (this.clickModeType) return;

            // Check if clicked ON a gate
            const target = e.target.closest('.gate-group');
            if (target) {
                const id = parseInt(target.dataset.gateId);
                this.canvas.selectedGateId = id;
                this.canvas.render();
                e.stopPropagation(); // prevent background click clearing?
            } else {
                // Clicked background -> clear selection
                this._clearSelection();
            }
        });
    }

    _clearSelection() {
        this.canvas.selectedGateId = null;
        this.canvas.render();
    }

    // ─── Deletion ─────────────────────────────────────────────

    // ─── Control Dot Dragging ─────────────────────────────────

    _initControlDrag() {
        let draggingControl = null; // { gateId, controlIndex, originalQubit }
        let dragLine = null;

        // Mouse Down on Control Dot
        this.canvas.svg.addEventListener('mousedown', (e) => {
            const dot = e.target.closest('.control-dot');
            if (dot) {
                e.preventDefault();
                e.stopPropagation();
                const group = dot.closest('.gate-group');
                const gateId = parseInt(group.dataset.gateId);
                const controlIndex = parseInt(dot.dataset.controlIndex);

                // Find the gate
                const gate = this.circuit.gates.find(g => g.id === gateId);
                if (gate) {
                    draggingControl = {
                        gateId,
                        controlIndex,
                        originalQubit: gate.controls[controlIndex]
                    };

                    // Create visual drag line
                    dragLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    dragLine.setAttribute('stroke', gate.color);
                    dragLine.setAttribute('stroke-width', '2');
                    dragLine.setAttribute('stroke-dasharray', '4');
                    this.canvas.svg.appendChild(dragLine);
                }
            }
        });

        // Mouse Move
        window.addEventListener('mousemove', (e) => {
            if (draggingControl && dragLine) {
                const rect = this.canvas.svg.getBoundingClientRect();
                const vb = this.canvas.svg.viewBox.baseVal;
                const scaleX = vb.width / rect.width;
                const scaleY = vb.height / rect.height;

                const x = (e.clientX - rect.left) * scaleX;
                const y = (e.clientY - rect.top) * scaleY;

                // Snap to current control pos start
                // Actually start from gate column x?
                const gate = this.circuit.gates.find(g => g.id === draggingControl.gateId);
                if (gate) {
                    const startX = this.canvas.colX(gate.col);
                    const startY = this.canvas.qubitY(draggingControl.originalQubit); // Or current mouse y?
                    // Let's draw line from gate horizontal center to mouse
                    dragLine.setAttribute('x1', startX);
                    dragLine.setAttribute('y1', this.canvas.qubitY(draggingControl.originalQubit));
                    dragLine.setAttribute('x2', x);
                    dragLine.setAttribute('y2', y);
                }
            }
        });

        // Mouse Up
        window.addEventListener('mouseup', (e) => {
            if (draggingControl) {
                const pos = this.canvas.getGridPos(e.clientX, e.clientY);
                if (pos) {
                    const gate = this.circuit.gates.find(g => g.id === draggingControl.gateId);
                    if (gate) {
                        // Check if valid move
                        // - Not on target qubit
                        // - Not on existing control qubit
                        const targetQ = pos.qubit;
                        // const oldQ = draggingControl.originalQubit;

                        if (!gate.targets.includes(targetQ) && !gate.controls.includes(targetQ)) {
                            // Update control
                            gate.controls[draggingControl.controlIndex] = targetQ;
                            // Trigger update
                            this.canvas.render();
                            this.onUpdate();
                        }
                    }
                }

                // Cleanup
                if (dragLine) dragLine.remove();
                dragLine = null;
                draggingControl = null;
            }
        });
    }

    // ─── Double Click Handling ─────────────────────────────────

    _initDoubleClick() {
        this.canvas.svg.addEventListener('dblclick', (e) => {
            e.preventDefault();
            const pos = this.canvas.getGridPos(e.clientX, e.clientY);
            console.log('[DnD] Double click at', pos);

            if (!pos) return;

            // Check if there is a gate at this column
            const gatesInCol = this.circuit.getGatesAtCol(pos.col);
            console.log('[DnD] Gates in col:', gatesInCol);

            // If user clicks on a gate BODY -> Delete it (existing)
            const targetGroup = e.target.closest('.gate-group');
            if (targetGroup) {
                // If clicked on Control Dot? Remove control?
                if (e.target.classList.contains('control-dot')) {
                    // Remove specific control
                    const id = parseInt(targetGroup.dataset.gateId);
                    const gate = this.circuit.gates.find(g => g.id === id);
                    if (gate) {
                        // Which control?
                        // We need control index.
                        // The click event target might be the circle.
                        const cIdx = parseInt(e.target.dataset.controlIndex);
                        if (!isNaN(cIdx)) {
                            gate.controls.splice(cIdx, 1);
                            // If no controls left on CNOT? It becomes unchecked... X gate?
                            // CX with 0 controls is X. CZ with 0 controls is Z.
                            // But let's allow 0 controls.
                            this.canvas.render();
                            this.onUpdate();
                            return;
                        }
                    }
                }

                // Standard delete
                const id = parseInt(targetGroup.dataset.gateId);
                this.circuit.removeGate(id);
                this.canvas.render();
                this.onUpdate();
                return;
            }

            // If Empty Space -> Add Control
            // We want to add a control to a gate in this column.
            // Which gate?
            // If there's only one gate, use it.
            // If there are multiple, maybe the one closest to this wire?
            // For now, strict: only if exactly one gate exists.
            if (gatesInCol.length === 1) {
                const gate = gatesInCol[0];
                console.log('[DnD] Found candidate gate:', gate);

                // Check if target is not this wire
                if (!gate.targets.includes(pos.qubit)) {
                    // Restriction: Only allow adding controls to CX, CNOT, CZ
                    if (!['CX', 'CNOT', 'CZ'].includes(gate.type)) {
                        console.log('[DnD] Cannot add control to gate type:', gate.type);
                        return;
                    }

                    // Check if control already exists (impossible if we are here?)
                    if (!gate.controls.includes(pos.qubit)) {
                        console.log('[DnD] Adding control to qubit', pos.qubit);
                        gate.controls.push(pos.qubit);
                        gate.controls.sort((a, b) => a - b); // Keep controls sorted
                        this.canvas.render();
                        this.onUpdate();
                    } else {
                        console.log('[DnD] Control already exists on', pos.qubit);
                    }
                } else {
                    console.log('[DnD] Cannot add control on target wire');
                }
            } else {
                console.log('[DnD] No single candidate gate found (count: ' + gatesInCol.length + ')');
            }
        });
    }

    // ─── Deletion (Key/Right Click) ───────────────────────────

    _initDeletion() {
        const deleteSelected = () => {
            if (this.canvas.selectedGateId !== null) {
                this.circuit.removeGate(this.canvas.selectedGateId);
                this._clearSelection(); // also re-renders
                this.onUpdate();
            }
        };

        // 1. Toolbar delete button
        const btn = document.getElementById('btn-delete-gate');
        if (btn) btn.addEventListener('click', deleteSelected);

        // 2. Keyboard (Delete/Backspace)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Delete' || e.key === 'Backspace') {
                // Ignore if input focused
                if (document.activeElement.tagName === 'INPUT') return;
                deleteSelected();
            }
        });

        // 3. Right Click
        this.canvas.svg.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const target = e.target.closest('.gate-group');
            if (target) {
                const id = parseInt(target.dataset.gateId);
                this.circuit.removeGate(id);
                this.canvas.render();
                this.onUpdate();
            }
        });

        // Double click is handled in _initDoubleClick
    }
}
