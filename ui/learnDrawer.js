// ============================================================
// ui/learnDrawer.js — Learn Mode Side Drawer
// ============================================================

import { LABS } from '../lessons/labs.js';

export class LearnDrawer {
    /**
     * @param {Object} app API from controls.js (loadCircuit, setInputs, runShots, etc.)
     */
    constructor(app) {
        this.app = app;
        this.isOpen = false;
        this.currentLabId = null;
        this.container = null;

        this._init();
    }

    _init() {
        // Create Drawer DOM
        const drawer = document.createElement('div');
        drawer.className = 'learn-drawer';
        drawer.innerHTML = `
            <div class="learn-header">
                <h2>📘 Learn Quantum</h2>
                <button class="close-drawer">×</button>
            </div>
            <div class="learn-content">
                <div class="lab-list">
                    <h3>Chapter 3 Circuits</h3>
                    ${Object.entries(LABS).map(([k, v]) =>
            `<button class="lab-item" data-id="${k}">${v.title}</button>`
        ).join('')}
                </div>
                
                <div class="lab-detail" style="display:none;">
                    <button class="back-list">← Back</button>
                    <h3 id="lab-title"></h3>
                    <div id="lab-desc"></div>
                    
                    <div class="lab-controls">
                        <div class="control-group">
                            <label>1. Setup:</label>
                            <button id="btn-load-lab">Load Lab Circuit</button>
                            <button id="btn-set-inputs">Set Inputs</button>
                        </div>
                        
                        <div class="control-group" id="param-controls" style="display:none;">
                            <label>Param &theta; (<span id="theta-val">0.25</span>):</label>
                            <input type="range" id="theta-slider" min="0" max="1" step="0.05" value="0.25">
                        </div>
                        
                        <div class="control-group">
                            <label>2. Verify:</label>
                            <button id="btn-run-check" class="primary">Run Shots & Check</button>
                        </div>
                    </div>
                    
                    <div id="check-result" class="check-result"></div>
                </div>
            </div>
        `;
        document.body.appendChild(drawer);
        this.container = drawer;

        // Events
        drawer.querySelector('.close-drawer').onclick = () => this.close();

        drawer.querySelectorAll('.lab-item').forEach(b => {
            b.onclick = () => this.selectLab(b.dataset.id);
        });

        drawer.querySelector('.back-list').onclick = () => {
            drawer.querySelector('.lab-list').style.display = 'block';
            drawer.querySelector('.lab-detail').style.display = 'none';
        };

        // Actions
        drawer.querySelector('#btn-load-lab').onclick = () => this._loadCurrentLab();
        drawer.querySelector('#btn-set-inputs').onclick = () => this._setLabInputs();
        drawer.querySelector('#btn-run-check').onclick = () => this._runCheck();

        // Slider
        const slider = drawer.querySelector('#theta-slider');
        slider.oninput = (e) => {
            document.getElementById('theta-val').textContent = e.target.value;
            this._updateLabParams(parseFloat(e.target.value));
        };

        // ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) this.close();
        });
    }

    open() {
        this.isOpen = true;
        this.container.classList.add('open');
    }

    close() {
        this.isOpen = false;
        this.container.classList.remove('open');
    }

    selectLab(id) {
        this.currentLabId = id;
        const lab = LABS[id];

        const detail = this.container.querySelector('.lab-detail');
        this.container.querySelector('.lab-list').style.display = 'none';
        detail.style.display = 'block';

        detail.querySelector('#lab-title').textContent = lab.title;
        detail.querySelector('#lab-desc').innerHTML = lab.descriptionHTML;
        detail.querySelector('#check-result').textContent = '';
        detail.querySelector('#check-result').className = 'check-result';

        // Show/Hide params
        const paramGroup = detail.querySelector('#param-controls');
        if (lab.params && lab.params.theta !== undefined) {
            paramGroup.style.display = 'block';
            const slider = detail.querySelector('#theta-slider');
            // Assuming theta 0-1 range for UI (x 2pi or pi handled in labs.js)
            // Labs.js default is e.g. 0.125
            slider.value = lab.params.theta;
            document.getElementById('theta-val').textContent = lab.params.theta;
        } else {
            paramGroup.style.display = 'none';
        }
    }

    _loadCurrentLab() {
        if (!this.currentLabId) return;
        const lab = LABS[this.currentLabId];

        // Get current params from UI if applicable
        const params = this._getUIParams(lab);

        const circuitData = lab.getCircuit(params);
        this.app.loadCircuit(circuitData);
    }

    _setLabInputs() {
        if (!this.currentLabId) return;
        const lab = LABS[this.currentLabId];
        this.app.setInputs(lab.inputs.perQubitPreset);
    }

    _updateLabParams(val) {
        // Just reload circuit with new param if it's dynamic
        // "Real-time" update might be too aggressive if user is dragging?
        // Let's just update internal state, and let user click "Load Lab" again?
        // OR better: auto-reload circuit if it's lightweight.
        // Labs.js getCircuit is fast.

        if (this.currentLabId) {
            const lab = LABS[this.currentLabId];
            if (lab.getCircuit) {
                // We need to merge existing params with new val
                // Only theta supported now
                const params = { ...lab.params, theta: val };
                const circuitData = lab.getCircuit(params);
                this.app.loadCircuit(circuitData);
            }
        }
    }

    _getUIParams(lab) {
        if (lab.params && lab.params.theta !== undefined) {
            const val = parseFloat(document.getElementById('theta-slider').value);
            return { ...lab.params, theta: val };
        }
        return lab.params || {};
    }

    async _runCheck() {
        if (!this.currentLabId) return;
        const lab = LABS[this.currentLabId];

        // 1. Run Shots
        const shots = lab.recommendedShots || 1024;
        // Call app API. It might be async if animation used, but usually runShots is sync calc + async UI.
        // Actually runShots returns counts immediately in my previous code?
        // Let's check controls.js in next step. If it doesn't return, we need to refactor controls.js
        const counts = this.app.runShots(shots);

        // 2. Check
        const params = this._getUIParams(lab);
        const result = lab.check(counts, params);

        // 3. Display
        const resBox = this.container.querySelector('#check-result');
        resBox.textContent = result.message;
        resBox.className = 'check-result ' + (result.passed ? 'pass' : 'fail');
    }
}
