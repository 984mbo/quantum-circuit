// ============================================================
// ui/learnDrawer.js — Learn Mode Side Drawer
// ============================================================

import { LABS } from '../lessons/labs.js';

export class LearnDrawer {
    /**
     * @param {Object} app API from controls.js
     */
    constructor(app) {
        this.app = app;
        this.isOpen = false;
        this.currentLabId = null;
        this.container = null;

        this._init();
    }

    _init() {
        const drawer = document.createElement('div');
        drawer.className = 'learn-drawer';
        drawer.innerHTML = `
            <div class="learn-header">
                <h2>Learn Quantum Lab</h2>
                <button class="close-drawer">×</button>
            </div>
            <div class="learn-content">
                <div class="lab-list">
                    <h3>Learning Paths</h3>
                    <p class="lab-list-note">直感で掴む -> 実験する -> 理論と比較する</p>
                    <div class="lab-list-items">
                        ${Object.entries(LABS).map(([k, v]) => `
                            <button class="lab-item" data-id="${k}">
                                <span class="lab-item-title">${v.title}</span>
                                <span class="lab-item-meta">${v.chapter || 'General'} | ${v.difficulty || 'Core'}</span>
                            </button>
                        `).join('')}
                    </div>
                </div>

                <div class="lab-detail" style="display:none;">
                    <button class="back-list">← Back</button>
                    <h3 id="lab-title"></h3>
                    <div class="lab-tags">
                        <span id="lab-chapter" class="lab-tag"></span>
                        <span id="lab-difficulty" class="lab-tag"></span>
                    </div>
                    <p id="lab-goal" class="lab-goal"></p>
                    <ul id="lab-intuition" class="lab-intuition"></ul>
                    <div id="lab-desc"></div>

                    <div class="guided-panel">
                        <div class="guided-title">Guided Actions</div>
                        <div id="guided-actions" class="guided-actions"></div>
                    </div>

                    <div class="experiment-panel" id="experiment-panel" style="display:none;">
                        <label for="exp-select">Experiment Scenario</label>
                        <div class="experiment-row">
                            <select id="exp-select"></select>
                            <button id="btn-apply-exp">Apply</button>
                        </div>
                        <div id="exp-note" class="exp-note"></div>
                    </div>

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
                    <div id="insight-box" class="insight-box"></div>
                </div>
            </div>
        `;
        document.body.appendChild(drawer);
        this.container = drawer;

        drawer.querySelector('.close-drawer').onclick = () => this.close();
        drawer.querySelectorAll('.lab-item').forEach((button) => {
            button.onclick = () => this.selectLab(button.dataset.id);
        });

        drawer.querySelector('.back-list').onclick = () => {
            drawer.querySelector('.lab-list').style.display = 'block';
            drawer.querySelector('.lab-detail').style.display = 'none';
        };

        drawer.querySelector('#btn-load-lab').onclick = () => this._loadCurrentLab();
        drawer.querySelector('#btn-set-inputs').onclick = () => this._setLabInputs();
        drawer.querySelector('#btn-run-check').onclick = () => this._runCheck();

        drawer.querySelector('#btn-apply-exp').onclick = () => this._applyExperiment();
        drawer.querySelector('#exp-select').onchange = () => this._refreshExperimentNote();

        const slider = drawer.querySelector('#theta-slider');
        slider.oninput = (e) => {
            const val = parseFloat(e.target.value);
            this._setThetaUI(val);
            this._updateLabParams(val);
        };

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
        detail.querySelector('#lab-chapter').textContent = lab.chapter || 'General';
        detail.querySelector('#lab-difficulty').textContent = lab.difficulty || 'Core';
        detail.querySelector('#lab-goal').textContent = lab.goal || '';
        detail.querySelector('#lab-desc').innerHTML = lab.descriptionHTML;
        detail.querySelector('#check-result').textContent = '';
        detail.querySelector('#check-result').className = 'check-result';
        detail.querySelector('#insight-box').innerHTML = '';

        this._renderIntuition(lab);
        this._renderGuidedActions(lab);
        this._renderExperiments(lab);

        const paramGroup = detail.querySelector('#param-controls');
        if (lab.params && lab.params.theta !== undefined) {
            paramGroup.style.display = 'block';
            this._setThetaUI(lab.params.theta);
        } else {
            paramGroup.style.display = 'none';
        }
    }

    _renderIntuition(lab) {
        const list = this.container.querySelector('#lab-intuition');
        const items = lab.intuitionBullets || [];
        list.innerHTML = items.map((line) => `<li>${line}</li>`).join('');
    }

    _renderGuidedActions(lab) {
        const wrap = this.container.querySelector('#guided-actions');
        const steps = lab.guidedSteps || [];
        wrap.innerHTML = steps.map((step) => `
            <button class="guided-action" data-action="${step.action}">${step.label}</button>
        `).join('');

        wrap.querySelectorAll('.guided-action').forEach((button) => {
            button.onclick = () => this._runGuidedAction(button.dataset.action);
        });
    }

    _runGuidedAction(action) {
        switch (action) {
            case 'load':
                this._loadCurrentLab();
                break;
            case 'inputs':
                this._setLabInputs();
                break;
            case 'run':
                this._runCheck();
                break;
            case 'experiment':
                this._applyExperiment();
                break;
            case 'play':
                if (this.app.previewCircuit) {
                    this.app.previewCircuit();
                }
                break;
            default:
                break;
        }
    }

    _renderExperiments(lab) {
        const panel = this.container.querySelector('#experiment-panel');
        const select = this.container.querySelector('#exp-select');
        const experiments = lab.experiments || [];

        if (!experiments.length) {
            panel.style.display = 'none';
            return;
        }

        panel.style.display = 'block';
        select.innerHTML = experiments
            .map((exp) => `<option value="${exp.id}">${exp.label}</option>`)
            .join('');
        this._refreshExperimentNote();
    }

    _refreshExperimentNote() {
        const lab = LABS[this.currentLabId];
        if (!lab || !lab.experiments) return;

        const selectedId = this.container.querySelector('#exp-select').value;
        const scenario = lab.experiments.find((exp) => exp.id === selectedId);
        this.container.querySelector('#exp-note').textContent = scenario?.note || '';
    }

    _applyExperiment() {
        const lab = LABS[this.currentLabId];
        if (!lab || !lab.experiments?.length) return;

        const selectedId = this.container.querySelector('#exp-select').value;
        const scenario = lab.experiments.find((exp) => exp.id === selectedId);
        if (!scenario) return;

        if (scenario.params?.theta !== undefined) {
            this._setThetaUI(scenario.params.theta);
        }

        this._loadCurrentLab();

        if (scenario.inputs) {
            this.app.setInputs(scenario.inputs);
        } else {
            this._setLabInputs();
        }

        if (this.app.toast) this.app.toast(`Scenario: ${scenario.label}`);
    }

    _setThetaUI(val) {
        const slider = this.container.querySelector('#theta-slider');
        const label = this.container.querySelector('#theta-val');
        slider.value = val;
        label.textContent = String(val);
    }

    _loadCurrentLab() {
        if (!this.currentLabId) return;
        const lab = LABS[this.currentLabId];
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
        if (!this.currentLabId) return;
        const lab = LABS[this.currentLabId];
        if (!lab.getCircuit) return;

        const params = { ...lab.params, theta: val };
        this.app.loadCircuit(lab.getCircuit(params));
    }

    _getUIParams(lab) {
        if (lab.params && lab.params.theta !== undefined) {
            const val = parseFloat(this.container.querySelector('#theta-slider').value);
            return { ...lab.params, theta: val };
        }
        return lab.params || {};
    }

    _renderInsight(counts, params) {
        const lab = LABS[this.currentLabId];
        const box = this.container.querySelector('#insight-box');

        if (!lab?.getInsight) {
            box.innerHTML = '';
            return;
        }

        const insight = lab.getInsight(counts, params);
        const details = (insight.details || []).map((line) => `<li>${line}</li>`).join('');

        box.innerHTML = `
            <div class="insight-title">${insight.headline || 'Insight'}</div>
            <ul class="insight-list">${details}</ul>
        `;
    }

    _runCheck() {
        if (!this.currentLabId) return;
        const lab = LABS[this.currentLabId];
        const shots = lab.recommendedShots || 1024;

        const counts = this.app.runShots(shots);
        const params = this._getUIParams(lab);
        const result = lab.check(counts, params);

        const resBox = this.container.querySelector('#check-result');
        resBox.textContent = result.message;
        resBox.className = 'check-result ' + (result.passed ? 'pass' : 'fail');

        this._renderInsight(counts, params);
    }
}
