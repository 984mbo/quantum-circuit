// ============================================================
// ui/inputDrawer.js — Input Configuration Side Drawer
// ============================================================

import { cAbs2, cScale } from '../sim/complex.js';

export class InputDrawer {
    constructor(app) {
        this.app = app;
        this.isOpen = false;
        this.container = document.getElementById('input-rows-container');
        this.drawer = document.getElementById('input-drawer');

        this.btnClose = document.getElementById('btn-close-input');
        this.btnNormalize = document.getElementById('btn-normalize-input');
        this.btnApply = document.getElementById('btn-apply-input');

        this._bindEvents();
    }

    _bindEvents() {
        this.btnClose.onclick = () => this.close();
        this.btnNormalize.onclick = () => this._normalize();
        this.btnApply.onclick = () => this._apply();

        // Close on ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) this.close();
        });
    }

    open() {
        console.log('[InputDrawer] Opening drawer...');
        this.isOpen = true;
        this._renderRows();
        this.drawer.classList.add('open');
    }

    close() {
        this.isOpen = false;
        this.drawer.classList.remove('open');
    }

    _renderRows() {
        const numQubits = this.app.circuit.numQubits;
        const numStates = 1 << numQubits;
        const vector = this.app.inputState.toStateVector(); // current vector

        this.container.innerHTML = '';

        for (let i = 0; i < numStates; i++) {
            const basis = i.toString(2).padStart(numQubits, '0');
            const [re, im] = vector[i];

            const row = document.createElement('div');
            row.className = 'input-row';
            row.innerHTML = `
                <span class="input-row-label">|${basis}⟩</span>
                <div class="complex-input-group">
                    <div class="complex-part">
                        <span class="part-label">Real</span>
                        <input type="number" class="input-val re-input" value="${re}" step="0.1" data-idx="${i}">
                    </div>
                    <span class="plus-sign">+</span>
                    <div class="complex-part">
                        <span class="part-label">Imag</span>
                        <input type="number" class="input-val im-input" value="${im}" step="0.1" data-idx="${i}">
                    </div>
                    <span class="imag-unit">i</span>
                </div>
            `;
            this.container.appendChild(row);
        }
    }

    _readValues() {
        const numStates = 1 << this.app.circuit.numQubits;
        const vec = [];
        const reInputs = this.container.querySelectorAll('.re-input');
        const imInputs = this.container.querySelectorAll('.im-input');

        for (let i = 0; i < numStates; i++) {
            const r = parseFloat(reInputs[i].value) || 0;
            const im = parseFloat(imInputs[i].value) || 0;
            vec.push([r, im]);
        }
        return vec;
    }

    _normalize() {
        const vec = this._readValues();
        let sum2 = 0;
        for (const [re, im] of vec) {
            sum2 += cAbs2(re, im);
        }

        if (sum2 < 1e-12) {
            // All zeros? set |0...0> to 1
            vec[0] = [1, 0];
        } else {
            const scale = 1 / Math.sqrt(sum2);
            for (let i = 0; i < vec.length; i++) {
                vec[i] = cScale(vec[i][0], vec[i][1], scale);
            }
        }

        // Update UI inputs
        const reInputs = this.container.querySelectorAll('.re-input');
        const imInputs = this.container.querySelectorAll('.im-input');
        for (let i = 0; i < vec.length; i++) {
            reInputs[i].value = vec[i][0].toFixed(3);
            imInputs[i].value = vec[i][1].toFixed(3);
        }
    }

    _apply() {
        const vec = this._readValues();

        // Final check for normalization
        let sum2 = 0;
        for (const [re, im] of vec) sum2 += cAbs2(re, im);

        if (Math.abs(sum2 - 1.0) > 0.01) {
            if (!confirm("The state is not normalized. Apply anyway?")) return;
        }

        this.app.inputState.setVector(vec);
        this.app._reloadUI();
        this.app._onCircuitChange(); // triggers correct simulation
        this.close();
    }
}
