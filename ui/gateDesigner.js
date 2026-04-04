// ============================================================
// ui/gateDesigner.js — Custom Gate Designer Panel
// ============================================================

import { CustomGateDefinition, CUSTOM_GATE_ICONS, getPresetTemplates, initCustomGateEngine } from '../model/customGate.js';
import { CustomGateStore } from '../storage/customGateStore.js';
import { GATE_COLORS, GATE_LABELS, registerCustomGate, unregisterCustomGate } from '../model/circuit.js';
import { QuantumEngine } from '../sim/statevector.js';

// ─── Constants ─────────────────────────────────────────────

const DESIGNER_GATES = ['I', 'X', 'Y', 'Z', 'H', 'S', 'T', 'Rx', 'Ry', 'Rz', 'CX', 'CZ', 'SWAP'];

// ─── GateDesigner Class ────────────────────────────────────

export class GateDesigner {
    /**
     * @param {Object} opts
     * @param {Function} opts.onSidebarUpdate - Callback to refresh sidebar custom section
     * @param {Function} opts.onCircuitUpdate - Callback to re-render main circuit
     */
    constructor(opts = {}) {
        this.store = new CustomGateStore();
        this.onSidebarUpdate = opts.onSidebarUpdate || (() => {});
        this.onCircuitUpdate = opts.onCircuitUpdate || (() => {});
        this._editingId = null; // ID of gate being edited (null = new gate)

        // Sub-circuit state
        this._subCircuitGates = [];
        this._subCircuitNumQubits = 1;
        this._selectedPaletteGate = null;
        this._nextGateId = 1;

        // Initialize engine reference for matrix computation
        initCustomGateEngine({ QuantumEngine });

        this._initDOM();
        this._initEvents();
        this._loadSavedGates();
        this._renderSavedList();
        this._renderSidebar();
    }

    // ─── DOM Initialization ──────────────────────────────────

    _initDOM() {
        this._overlay = document.getElementById('gate-designer-overlay');
        this._panel = document.getElementById('gate-designer-panel');

        // Fields
        this._nameInput = document.getElementById('designer-name');
        this._qubitsSelect = document.getElementById('designer-qubits');
        this._controlsSelect = document.getElementById('designer-controls');
        this._colorInput = document.getElementById('designer-color');
        this._templateSelect = document.getElementById('designer-templates');

        // Containers
        this._iconGrid = document.getElementById('designer-icon-grid');
        this._gatePalette = document.getElementById('designer-gate-palette');
        this._circuitCanvas = document.getElementById('designer-circuit-canvas');
        this._svg = document.getElementById('designer-svg');
        this._matrixDiv = document.getElementById('designer-matrix');
        this._statePreviewDiv = document.getElementById('designer-state-preview');
        this._savedList = document.getElementById('designer-saved-list');

        // Build icon grid
        this._selectedIcon = 'diamond';
        this._renderIconGrid();

        // Build gate palette
        this._renderGatePalette();

        // Build template options
        this._renderTemplateOptions();
    }

    _renderIconGrid() {
        this._iconGrid.innerHTML = '';
        for (const icon of CUSTOM_GATE_ICONS) {
            const el = document.createElement('div');
            el.className = 'designer-icon-option' + (icon.id === this._selectedIcon ? ' selected' : '');
            el.textContent = icon.symbol;
            el.title = icon.label;
            el.dataset.iconId = icon.id;
            el.addEventListener('click', () => {
                this._selectedIcon = icon.id;
                this._iconGrid.querySelectorAll('.designer-icon-option').forEach(o => o.classList.remove('selected'));
                el.classList.add('selected');
            });
            this._iconGrid.appendChild(el);
        }
    }

    _renderGatePalette() {
        this._gatePalette.innerHTML = '';
        for (const gateType of DESIGNER_GATES) {
            const btn = document.createElement('button');
            btn.className = 'designer-gate-btn';
            btn.style.background = GATE_COLORS[gateType] || '#555';
            btn.textContent = GATE_LABELS[gateType] || gateType;
            btn.title = gateType;
            btn.dataset.gate = gateType;
            btn.addEventListener('click', () => {
                // Toggle selection
                if (this._selectedPaletteGate === gateType) {
                    this._selectedPaletteGate = null;
                    btn.classList.remove('active');
                } else {
                    this._gatePalette.querySelectorAll('.designer-gate-btn').forEach(b => b.classList.remove('active'));
                    this._selectedPaletteGate = gateType;
                    btn.classList.add('active');
                }
            });
            this._gatePalette.appendChild(btn);
        }

        // Add Delete button
        const delBtn = document.createElement('button');
        delBtn.className = 'designer-gate-btn';
        delBtn.style.background = '#ef4444';
        delBtn.textContent = '🗑';
        delBtn.title = 'Delete mode';
        delBtn.dataset.gate = '__delete__';
        delBtn.addEventListener('click', () => {
            if (this._selectedPaletteGate === '__delete__') {
                this._selectedPaletteGate = null;
                delBtn.classList.remove('active');
            } else {
                this._gatePalette.querySelectorAll('.designer-gate-btn').forEach(b => b.classList.remove('active'));
                this._selectedPaletteGate = '__delete__';
                delBtn.classList.add('active');
            }
        });
        this._gatePalette.appendChild(delBtn);
    }

    _renderTemplateOptions() {
        const templates = getPresetTemplates();
        for (const t of templates) {
            const opt = document.createElement('option');
            opt.value = t.name;
            opt.textContent = t.name;
            this._templateSelect.appendChild(opt);
        }
    }

    // ─── Events ──────────────────────────────────────────────

    _initEvents() {
        // Open button
        document.getElementById('btn-design-gate').addEventListener('click', () => this.open());

        // Close buttons
        document.getElementById('btn-close-designer').addEventListener('click', () => this.close());
        document.getElementById('btn-designer-cancel').addEventListener('click', () => this.close());

        // Click overlay to close
        this._overlay.addEventListener('click', (e) => {
            if (e.target === this._overlay) this.close();
        });

        // Save button
        document.getElementById('btn-designer-save').addEventListener('click', () => this._save());

        // Template selection
        this._templateSelect.addEventListener('change', () => this._loadTemplate());

        // Qubits change
        this._qubitsSelect.addEventListener('change', () => {
            this._subCircuitNumQubits = parseInt(this._qubitsSelect.value);
            this._subCircuitGates = [];
            this._renderSubCircuit();
            this._updatePreview();
        });

        // Sub-circuit canvas click (place/delete gates)
        this._svg.addEventListener('click', (e) => this._handleCanvasClick(e));

        // Import/Export
        document.getElementById('btn-designer-export').addEventListener('click', () => this._exportGates());
        document.getElementById('btn-designer-import').addEventListener('click', () => this._importGates());
    }

    // ─── Open / Close ────────────────────────────────────────

    open(editId = null) {
        this._editingId = editId;

        if (editId) {
            // Load existing gate for editing
            const def = this.store.get(editId);
            if (def) {
                this._nameInput.value = def.name;
                this._qubitsSelect.value = def.numQubits;
                this._controlsSelect.value = def.defaultControls;
                this._colorInput.value = def.color;
                this._selectedIcon = def.icon;
                this._subCircuitNumQubits = def.numQubits;
                this._subCircuitGates = (def.subCircuit.gates || []).map((g, i) => ({
                    ...g, id: i + 1
                }));
                this._nextGateId = this._subCircuitGates.length + 1;
                this._renderIconGrid();
            }
        } else {
            // Reset form for new gate
            this._nameInput.value = '';
            this._qubitsSelect.value = '1';
            this._controlsSelect.value = '1';
            this._colorInput.value = '#22d3ee';
            this._selectedIcon = 'diamond';
            this._subCircuitNumQubits = 1;
            this._subCircuitGates = [];
            this._nextGateId = 1;
            this._renderIconGrid();
            this._templateSelect.value = '';
        }

        this._renderSubCircuit();
        this._updatePreview();
        this._overlay.classList.add('open');
    }

    close() {
        this._overlay.classList.remove('open');
        this._selectedPaletteGate = null;
        this._gatePalette.querySelectorAll('.designer-gate-btn').forEach(b => b.classList.remove('active'));
    }

    // ─── Template Loading ────────────────────────────────────

    _loadTemplate() {
        const name = this._templateSelect.value;
        if (!name) return;
        const templates = getPresetTemplates();
        const t = templates.find(tp => tp.name === name);
        if (!t) return;

        this._nameInput.value = t.name;
        this._qubitsSelect.value = t.numQubits;
        this._controlsSelect.value = t.defaultControls;
        this._colorInput.value = t.color;
        this._selectedIcon = t.icon;
        this._subCircuitNumQubits = t.numQubits;
        this._subCircuitGates = (t.subCircuit.gates || []).map((g, i) => ({
            ...g, id: i + 1
        }));
        this._nextGateId = this._subCircuitGates.length + 1;
        this._renderIconGrid();
        this._renderSubCircuit();
        this._updatePreview();
    }

    // ─── Sub-circuit rendering (simplified SVG) ──────────────

    _renderSubCircuit() {
        const n = this._subCircuitNumQubits;
        const cellW = 50, cellH = 45;
        const wireXStart = 40;
        const wireYStart = 30;

        // Calculate columns needed
        let maxCol = 0;
        for (const g of this._subCircuitGates) {
            if (g.col > maxCol) maxCol = g.col;
        }
        const numCols = Math.max(maxCol + 2, 4);
        const svgW = wireXStart + numCols * cellW + 30;
        const svgH = wireYStart + n * cellH + 10;

        this._svg.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`);
        this._svg.innerHTML = '';

        // Draw wires
        for (let q = 0; q < n; q++) {
            const y = wireYStart + q * cellH;
            // Label
            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.setAttribute('x', 8);
            label.setAttribute('y', y + 5);
            label.setAttribute('fill', '#888');
            label.setAttribute('font-size', '11');
            label.textContent = `q${q}`;
            this._svg.appendChild(label);
            // Wire line
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', wireXStart);
            line.setAttribute('y1', y);
            line.setAttribute('x2', wireXStart + numCols * cellW);
            line.setAttribute('y2', y);
            line.setAttribute('stroke', '#555');
            line.setAttribute('stroke-width', '1.5');
            this._svg.appendChild(line);
        }

        // Draw column grid (clickable areas)
        for (let col = 0; col < numCols; col++) {
            for (let q = 0; q < n; q++) {
                const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                const x = wireXStart + col * cellW;
                const y = wireYStart + q * cellH - cellH / 2;
                rect.setAttribute('x', x);
                rect.setAttribute('y', y);
                rect.setAttribute('width', cellW);
                rect.setAttribute('height', cellH);
                rect.setAttribute('fill', 'transparent');
                rect.setAttribute('class', 'designer-cell');
                rect.dataset.col = col;
                rect.dataset.qubit = q;
                this._svg.appendChild(rect);
            }
        }

        // Draw gates
        for (const gate of this._subCircuitGates) {
            this._drawGateOnSvg(gate, cellW, cellH, wireXStart, wireYStart);
        }
    }

    _drawGateOnSvg(gate, cellW, cellH, wireXStart, wireYStart) {
        const x = wireXStart + gate.col * cellW + cellW / 2;
        const color = GATE_COLORS[gate.type] || '#888';
        const label = GATE_LABELS[gate.type] || gate.type;

        // Draw control dots
        if (gate.controls && gate.controls.length > 0) {
            for (const c of gate.controls) {
                const cy = wireYStart + c * cellH;
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', x);
                circle.setAttribute('cy', cy);
                circle.setAttribute('r', 4);
                circle.setAttribute('fill', color);
                this._svg.appendChild(circle);

                // Control line to target
                const ty = wireYStart + gate.targets[0] * cellH;
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', x);
                line.setAttribute('y1', cy);
                line.setAttribute('x2', x);
                line.setAttribute('y2', ty);
                line.setAttribute('stroke', color);
                line.setAttribute('stroke-width', '1.5');
                this._svg.appendChild(line);
            }
        }

        // Draw SWAP as crosses
        if (gate.type === 'SWAP') {
            for (const t of gate.targets) {
                const ty = wireYStart + t * cellH;
                const sz = 8;
                const l1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                l1.setAttribute('x1', x - sz); l1.setAttribute('y1', ty - sz);
                l1.setAttribute('x2', x + sz); l1.setAttribute('y2', ty + sz);
                l1.setAttribute('stroke', color); l1.setAttribute('stroke-width', '2');
                this._svg.appendChild(l1);
                const l2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                l2.setAttribute('x1', x - sz); l2.setAttribute('y1', ty + sz);
                l2.setAttribute('x2', x + sz); l2.setAttribute('y2', ty - sz);
                l2.setAttribute('stroke', color); l2.setAttribute('stroke-width', '2');
                this._svg.appendChild(l2);
            }
            // Line between targets
            if (gate.targets.length === 2) {
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', x);
                line.setAttribute('y1', wireYStart + gate.targets[0] * cellH);
                line.setAttribute('x2', x);
                line.setAttribute('y2', wireYStart + gate.targets[1] * cellH);
                line.setAttribute('stroke', color);
                line.setAttribute('stroke-width', '1.5');
                this._svg.appendChild(line);
            }
            return;
        }

        // Draw gate box for each target
        for (const t of gate.targets) {
            const ty = wireYStart + t * cellH;
            const boxW = 34, boxH = 26;
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', x - boxW / 2);
            rect.setAttribute('y', ty - boxH / 2);
            rect.setAttribute('width', boxW);
            rect.setAttribute('height', boxH);
            rect.setAttribute('rx', 4);
            rect.setAttribute('fill', color);
            rect.setAttribute('opacity', '0.9');
            rect.dataset.gateId = gate.id;
            this._svg.appendChild(rect);

            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', x);
            text.setAttribute('y', ty + 4);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('fill', '#fff');
            text.setAttribute('font-size', '11');
            text.setAttribute('font-weight', '600');
            text.textContent = label;
            text.dataset.gateId = gate.id;
            this._svg.appendChild(text);
        }
    }

    // ─── Canvas Click Handler ────────────────────────────────

    _handleCanvasClick(e) {
        const cell = e.target.closest('.designer-cell');
        if (!cell) {
            // Check if clicked on a gate (for deletion)
            const gateEl = e.target.closest('[data-gate-id]');
            if (gateEl && this._selectedPaletteGate === '__delete__') {
                const gateId = parseInt(gateEl.dataset.gateId);
                this._subCircuitGates = this._subCircuitGates.filter(g => g.id !== gateId);
                this._renderSubCircuit();
                this._updatePreview();
            }
            return;
        }

        const col = parseInt(cell.dataset.col);
        const qubit = parseInt(cell.dataset.qubit);

        if (!this._selectedPaletteGate || this._selectedPaletteGate === '__delete__') {
            // In delete mode, check if there's a gate at this position
            if (this._selectedPaletteGate === '__delete__') {
                this._subCircuitGates = this._subCircuitGates.filter(g => {
                    return !(g.col === col && (g.targets.includes(qubit) || (g.controls && g.controls.includes(qubit))));
                });
                this._renderSubCircuit();
                this._updatePreview();
            }
            return;
        }

        const gateType = this._selectedPaletteGate;
        const n = this._subCircuitNumQubits;

        // Build gate object
        let newGate;
        if (gateType === 'CX' || gateType === 'CZ') {
            // 2-qubit: control = qubit, target = qubit+1 or qubit-1
            const target = qubit < n - 1 ? qubit + 1 : qubit - 1;
            if (target < 0 || target >= n) return;
            newGate = { id: this._nextGateId++, type: gateType, targets: [target], controls: [qubit], params: {}, col };
        } else if (gateType === 'SWAP') {
            const target2 = qubit < n - 1 ? qubit + 1 : qubit - 1;
            if (target2 < 0 || target2 >= n) return;
            newGate = { id: this._nextGateId++, type: gateType, targets: [qubit, target2], controls: [], params: {}, col };
        } else if (['Rx', 'Ry', 'Rz'].includes(gateType)) {
            const theta = parseFloat(prompt(`Enter θ (radians) for ${gateType}:`, String(Math.PI / 4)));
            if (isNaN(theta)) return;
            newGate = { id: this._nextGateId++, type: gateType, targets: [qubit], controls: [], params: { theta }, col };
        } else {
            // Single qubit gate
            newGate = { id: this._nextGateId++, type: gateType, targets: [qubit], controls: [], params: {}, col };
        }

        // Remove existing gate at same position
        this._subCircuitGates = this._subCircuitGates.filter(g => {
            return !(g.col === col && g.targets.includes(qubit));
        });

        this._subCircuitGates.push(newGate);
        this._renderSubCircuit();
        this._updatePreview();
    }

    // ─── Preview ─────────────────────────────────────────────

    _updatePreview() {
        try {
            const subCircuit = this._buildSubCircuit();
            const def = new CustomGateDefinition({
                name: this._nameInput.value || 'U',
                numQubits: this._subCircuitNumQubits,
                subCircuit
            });
            const U = def.getUnitaryMatrix();
            this._renderMatrix(U);
            this._renderStatePreview(U);
        } catch (e) {
            this._matrixDiv.textContent = 'Error computing matrix';
            this._statePreviewDiv.textContent = e.message;
        }
    }

    _renderMatrix(U) {
        const dim = U.length;
        let html = '<div style="color:#888;font-size:10px;margin-bottom:6px">Unitary Matrix</div>';
        html += '<table style="border-collapse:collapse;width:100%">';
        for (let i = 0; i < dim; i++) {
            html += '<tr>';
            for (let j = 0; j < dim; j++) {
                const [re, im] = U[i][j];
                let val;
                if (Math.abs(re) < 1e-6 && Math.abs(im) < 1e-6) {
                    val = '0';
                } else if (Math.abs(im) < 1e-6) {
                    val = re.toFixed(2);
                } else if (Math.abs(re) < 1e-6) {
                    val = im.toFixed(2) + 'i';
                } else {
                    val = re.toFixed(2) + (im >= 0 ? '+' : '') + im.toFixed(2) + 'i';
                }
                const color = Math.abs(re) < 1e-6 && Math.abs(im) < 1e-6 ? '#555' : '#e0e0e0';
                html += `<td style="padding:2px 4px;color:${color};text-align:center;border:1px solid #333;font-size:9px">${val}</td>`;
            }
            html += '</tr>';
        }
        html += '</table>';
        this._matrixDiv.innerHTML = html;
    }

    _renderStatePreview(U) {
        const dim = U.length;
        const n = this._subCircuitNumQubits;
        let html = '<div style="color:#888;font-size:10px;margin-bottom:6px">State Transform: |0...0⟩ → </div>';

        // Apply U to |0...0⟩ (first column)
        const outputParts = [];
        for (let i = 0; i < dim; i++) {
            const [re, im] = U[i][0];
            if (Math.abs(re) > 1e-6 || Math.abs(im) > 1e-6) {
                const basis = '|' + i.toString(2).padStart(n, '0') + '⟩';
                let coeff;
                if (Math.abs(im) < 1e-6) {
                    coeff = Math.abs(re - 1) < 1e-6 ? '' : (Math.abs(re + 1) < 1e-6 ? '-' : re.toFixed(3));
                } else {
                    coeff = `(${re.toFixed(2)}+${im.toFixed(2)}i)`;
                }
                outputParts.push(`${coeff}${basis}`);
            }
        }
        html += `<div style="font-family:monospace;font-size:12px">${outputParts.join(' + ').replace(/\+ -/g, '- ')}</div>`;
        this._statePreviewDiv.innerHTML = html;
    }

    _buildSubCircuit() {
        return {
            numQubits: this._subCircuitNumQubits,
            numCols: Math.max(...this._subCircuitGates.map(g => g.col + 1), 2),
            gates: this._subCircuitGates.map(g => ({
                type: g.type,
                targets: g.targets,
                controls: g.controls || [],
                params: g.params || {},
                col: g.col
            }))
        };
    }

    // ─── Save ────────────────────────────────────────────────

    _save() {
        const name = this._nameInput.value.trim();
        if (!name) {
            alert('Please enter a gate name.');
            return;
        }

        const def = new CustomGateDefinition({
            id: this._editingId || undefined,
            name,
            icon: this._selectedIcon,
            color: this._colorInput.value,
            numQubits: parseInt(this._qubitsSelect.value),
            subCircuit: this._buildSubCircuit(),
            defaultControls: parseInt(this._controlsSelect.value),
        });

        // If editing, unregister old first
        if (this._editingId) {
            unregisterCustomGate(this._editingId);
        }

        this.store.save(def);
        registerCustomGate(def);

        this._renderSavedList();
        this._renderSidebar();
        this.onSidebarUpdate();
        this.close();
    }

    // ─── Delete ──────────────────────────────────────────────

    _deleteGate(id) {
        if (!confirm('Delete this custom gate?')) return;
        unregisterCustomGate(id);
        this.store.delete(id);
        this._renderSavedList();
        this._renderSidebar();
        this.onSidebarUpdate();
    }

    // ─── Saved Gates List ────────────────────────────────────

    _renderSavedList() {
        const list = this._savedList;
        list.innerHTML = '';
        const gates = this.store.getAll();

        if (gates.length === 0) {
            list.innerHTML = '<div style="color:#666;font-size:12px">No saved gates yet</div>';
            return;
        }

        for (const def of gates) {
            const item = document.createElement('div');
            item.className = 'designer-saved-item';

            const iconSpan = document.createElement('span');
            iconSpan.className = 'designer-saved-icon';
            iconSpan.style.background = def.color;
            iconSpan.textContent = def.iconSymbol;
            item.appendChild(iconSpan);

            const nameSpan = document.createElement('span');
            nameSpan.textContent = def.name;
            item.appendChild(nameSpan);

            const ctrlInfo = document.createElement('span');
            ctrlInfo.style.cssText = 'color:#888;font-size:10px;margin-left:4px';
            const ctrl = def.defaultControls;
            ctrlInfo.textContent = ctrl > 0 ? `(${ctrl} ctrl)` : '(no ctrl)';
            item.appendChild(ctrlInfo);

            const actions = document.createElement('div');
            actions.className = 'designer-saved-actions';

            const editBtn = document.createElement('button');
            editBtn.textContent = '✏️';
            editBtn.title = 'Edit';
            editBtn.addEventListener('click', (e) => { e.stopPropagation(); this.open(def.id); });
            actions.appendChild(editBtn);

            const delBtn = document.createElement('button');
            delBtn.textContent = '🗑';
            delBtn.title = 'Delete';
            delBtn.addEventListener('click', (e) => { e.stopPropagation(); this._deleteGate(def.id); });
            actions.appendChild(delBtn);

            const adjBtn = document.createElement('button');
            adjBtn.textContent = '†';
            adjBtn.title = 'Create adjoint (U†)';
            adjBtn.style.fontWeight = 'bold';
            adjBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._createAdjoint(def);
            });
            actions.appendChild(adjBtn);

            item.appendChild(actions);
            list.appendChild(item);
        }
    }

    // ─── Adjoint Gate ────────────────────────────────────────

    _createAdjoint(originalDef) {
        const adjDef = new CustomGateDefinition({
            name: originalDef.name + '†',
            icon: originalDef.icon,
            color: originalDef.color,
            numQubits: originalDef.numQubits,
            subCircuit: originalDef.subCircuit,
            defaultControls: originalDef.defaultControls,
        });
        // Mark as adjoint in the sub-circuit params
        adjDef._isAdjoint = true;
        adjDef._originalId = originalDef.id;

        // Override getUnitaryMatrix to return adjoint
        adjDef.getUnitaryMatrix = () => originalDef.getAdjointMatrix();
        adjDef.getAdjointMatrix = () => originalDef.getUnitaryMatrix();

        this.store.save(adjDef);
        registerCustomGate(adjDef);

        this._renderSavedList();
        this._renderSidebar();
        this.onSidebarUpdate();
    }

    // ─── Sidebar ─────────────────────────────────────────────

    _renderSidebar() {
        const section = document.getElementById('sidebar-custom-section');
        const container = document.getElementById('sidebar-custom-gates');
        const gates = this.store.getAll();

        if (gates.length === 0) {
            section.style.display = 'none';
            return;
        }

        section.style.display = '';
        container.innerHTML = '';

        for (const def of gates) {
            const el = document.createElement('div');
            el.className = 'drag-gate';
            el.draggable = true;
            el.dataset.gate = def.id;
            el.style.setProperty('--gc', def.color);
            el.textContent = def.iconSymbol;
            el.title = def.name + (def.defaultControls > 0 ? ` (${def.defaultControls} control)` : '');

            // Double-click to expand/show sub-circuit in the designer
            el.addEventListener('dblclick', () => {
                this.open(def.id);
            });

            container.appendChild(el);
        }
    }

    // ─── Load saved gates on startup ─────────────────────────

    _loadSavedGates() {
        const gates = this.store.getAll();
        for (const def of gates) {
            registerCustomGate(def);
        }
    }

    // ─── Export / Import ─────────────────────────────────────

    _exportGates() {
        const json = this.store.exportJSON();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'custom_gates.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    _importGates() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.addEventListener('change', async () => {
            const file = input.files[0];
            if (!file) return;
            try {
                const text = await file.text();
                const count = this.store.importJSON(text);
                // Register all imported gates
                const gates = this.store.getAll();
                for (const def of gates) {
                    registerCustomGate(def);
                }
                this._renderSavedList();
                this._renderSidebar();
                this.onSidebarUpdate();
                alert(`Imported ${count} gate(s) successfully.`);
            } catch (e) {
                alert('Import failed: ' + e.message);
            }
        });
        input.click();
    }
}
