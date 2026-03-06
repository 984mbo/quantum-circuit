// ============================================================
// ui/stateViewer.js — Quantum State Visualization
// ============================================================

import { cAbs, cAbs2 } from '../sim/complex.js';
import { renderTeX, stateVectorToTeX, texToHTML, formatComplexTeX } from './texRenderer.js';
import { SymbolicValue } from '../sim/fraction.js';
import { GATE_COLORS } from '../model/circuit.js';

export class StateViewer {
    constructor(container) {
        this.container = container;
        this.activeTab = 'dirac';
        this._timelineSteps = [];
        this._timelineNumQubits = 0;
        this._activeTimelineStep = -1;
        this._renderTabs();
    }

    _renderTabs() {
        this.container.innerHTML = `
      <div class="state-viewer-inner">
        <div class="state-tabs">
          <button class="state-tab active" data-tab="dirac">State Vector</button>
          <button class="state-tab" data-tab="amplitudes">Amplitudes</button>
          <button class="state-tab" data-tab="timeline">Timeline</button>
          <button class="state-tab" data-tab="histogram">Histogram</button>
          <button class="state-tab" data-tab="measurements">Measurements</button>
        </div>
        <div class="state-panel dirac-panel active" id="panel-dirac"></div>
        <div class="state-panel amplitudes-panel" id="panel-amplitudes"></div>
        <div class="state-panel timeline-panel" id="panel-timeline">
          <div class="timeline-empty">Run simulation to see state evolution</div>
        </div>
        <div class="state-panel measurements-panel" id="panel-measurements">
           <div class="measurements-chart" id="chart-measurements"></div>
           <div class="measurements-info" id="info-measurements"></div>
        </div>
        <div class="state-panel histogram-panel" id="panel-histogram">
           <div class="histogram-chart" id="chart-histogram"></div>
           <div class="histogram-info" id="info-histogram"></div>
        </div>
      </div>
    `;

        this.container.querySelectorAll('.state-tab').forEach(b => {
            b.addEventListener('click', () => {
                this.container.querySelectorAll('.state-tab').forEach(t => t.classList.remove('active'));
                this.container.querySelectorAll('.state-panel').forEach(p => p.classList.remove('active'));
                b.classList.add('active');
                this.container.querySelector(`#panel-${b.dataset.tab}`).classList.add('active');
                this.activeTab = b.dataset.tab;
            });
        });
    }

    updateState(stateVector, numQubits, history = []) {
        this._updateDirac(stateVector, numQubits);
        this._updateAmplitudes(stateVector, numQubits);
        this._updateMeasurementProbabilities(history, numQubits);
    }

    /**
     * Load the full simulation history into the Timeline tab.
     * Called after simulation completes.
     */
    updateTimeline(steps, numQubits) {
        this._timelineSteps = steps;
        this._timelineNumQubits = numQubits;
        this._activeTimelineStep = steps.length > 0 ? 0 : -1;
        this._renderTimeline();
    }

    /**
     * Highlight a specific step in the timeline during animation.
     */
    setActiveTimelineStep(stepIndex) {
        this._activeTimelineStep = stepIndex;
        const panel = document.getElementById('panel-timeline');
        if (!panel) return;

        // Update active class on step cards
        panel.querySelectorAll('.timeline-step').forEach((el, i) => {
            el.classList.toggle('active', i === stepIndex);
        });

        // Auto-scroll to active step
        const activeEl = panel.querySelector('.timeline-step.active');
        if (activeEl) {
            activeEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
    }

    _renderTimeline() {
        const panel = document.getElementById('panel-timeline');
        if (!panel) return;

        const steps = this._timelineSteps;
        const numQubits = this._timelineNumQubits;

        if (!steps || steps.length === 0) {
            panel.innerHTML = '<div class="timeline-empty">Run simulation to see state evolution</div>';
            return;
        }

        const container = document.createElement('div');
        container.className = 'timeline-container';

        steps.forEach((step, idx) => {
            // Arrow between steps
            if (idx > 0) {
                const arrow = document.createElement('div');
                arrow.className = 'timeline-arrow';
                arrow.textContent = '\u2192';
                container.appendChild(arrow);
            }

            const card = document.createElement('div');
            card.className = 'timeline-step' + (idx === this._activeTimelineStep ? ' active' : '');

            // Step header: label + gates
            const header = document.createElement('div');
            header.className = 'timeline-step-header';

            const label = document.createElement('span');
            label.className = 'timeline-step-label';
            if (step.col < 0) {
                label.textContent = 'Initial';
            } else {
                label.textContent = `Step ${step.col}`;
            }
            header.appendChild(label);

            // Gate badges
            if (step.appliedGates && step.appliedGates.length > 0) {
                const gatesDiv = document.createElement('div');
                gatesDiv.className = 'timeline-gates';
                step.appliedGates.forEach(g => {
                    const badge = document.createElement('span');
                    badge.className = 'timeline-gate-badge';
                    const color = GATE_COLORS[g.type] || '#888';
                    badge.style.backgroundColor = color + '33';
                    badge.style.borderColor = color;
                    badge.textContent = g.type === 'CX' || g.type === 'CNOT' ? 'CX' : g.type;
                    gatesDiv.appendChild(badge);
                });
                header.appendChild(gatesDiv);
            }
            card.appendChild(header);

            // Mini amplitude bars
            const barsDiv = document.createElement('div');
            barsDiv.className = 'timeline-bars';
            const dim = 1 << numQubits;
            const sv = step.stateVector;

            for (let i = 0; i < dim; i++) {
                const [re, im] = sv[i];
                const mag = Math.sqrt(re * re + im * im);
                const phase = Math.atan2(im, re);
                const hue = ((phase * 180 / Math.PI) + 360) % 360;

                const barWrap = document.createElement('div');
                barWrap.className = 'timeline-bar-wrap';

                const bar = document.createElement('div');
                bar.className = 'timeline-bar';
                bar.style.height = (mag * 100).toFixed(1) + '%';
                bar.style.backgroundColor = `hsl(${hue}, 80%, 60%)`;
                barWrap.appendChild(bar);

                const barLabel = document.createElement('div');
                barLabel.className = 'timeline-bar-label';
                barLabel.textContent = i.toString(2).padStart(numQubits, '0');
                barWrap.appendChild(barLabel);

                barsDiv.appendChild(barWrap);
            }
            card.appendChild(barsDiv);

            // Compact Dirac notation
            const diracDiv = document.createElement('div');
            diracDiv.className = 'timeline-dirac';
            const texStr = stateVectorToTeX(sv, numQubits, 4);
            diracDiv.innerHTML = texToHTML(texStr, { displayMode: false });
            card.appendChild(diracDiv);

            container.appendChild(card);
        });

        panel.innerHTML = '';
        panel.appendChild(container);
    }

    updateHistogram(counts, totalShots) {
        if (!counts) return;
        const chart = document.getElementById('chart-histogram');
        const info = document.getElementById('info-histogram');

        // Check if chart exists (might be during init)
        if (!chart) return;

        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        const maxVal = Math.max(...Object.values(counts), 1);

        let html = '<div class="hist-bars">';
        for (const [bin, count] of sorted) {
            const pct = (count / totalShots * 100).toFixed(1);
            const width = (count / maxVal * 100);
            html += `
        <div class="hist-bar-container">
          <div class="hist-bar-label">|${bin}⟩</div>
          <div class="hist-bar-track">
             <div class="hist-bar-fill" style="width: ${width}%"></div>
          </div>
          <div class="hist-bar-value">${count} <span class="hist-pct">(${pct}%)</span></div>
        </div>
      `;
        }
        html += '</div>';
        chart.innerHTML = html;
        info.textContent = `Total shots: ${totalShots}`;
    }

    _updateMeasurementProbabilities(history, numQubits) {
        const el = document.getElementById('chart-measurements');
        const infoEl = document.getElementById('info-measurements');
        if (!el || !infoEl) return;

        // Find the last step that had a measurementResult
        let lastMeasurement = null;
        for (let i = history.length - 1; i >= 0; i--) {
            if (history[i].measurement && history[i].measurement.measuredIndices) {
                lastMeasurement = history[i].measurement;
                break;
            }
        }

        if (!lastMeasurement || !lastMeasurement.measuredIndices || lastMeasurement.measuredIndices.length === 0) {
            el.innerHTML = '<div class="no-data">No measurement gates in circuit.</div>';
            infoEl.textContent = '';
            return;
        }

        const indices = lastMeasurement.measuredIndices;
        const fullProbs = lastMeasurement.probabilities; // { "000": 0.5, ... }

        // Calculate marginal distribution for the measured qubits
        // Sort indices to ensure bit string is consistent (most significant first in display)
        const sortedIndices = [...indices].sort((a, b) => b - a);
        const marginals = {};

        for (const [label, prob] of Object.entries(fullProbs)) {
            // Extract bits for the measured indices
            let marginalLabel = '';
            for (const idx of sortedIndices) {
                // label is q_N...q_0. charAt(numQubits - 1 - idx)
                marginalLabel += label.charAt(numQubits - 1 - idx);
            }
            marginals[marginalLabel] = (marginals[marginalLabel] || 0) + prob;
        }

        const sorted = Object.entries(marginals).sort((a, b) => b[1] - a[1]);

        let html = '<div class="hist-bars">';
        for (const [bin, prob] of sorted) {
            if (prob < 1e-6) continue;
            const pct = (prob * 100).toFixed(1);
            const width = (prob * 100);
            html += `
            <div class="hist-bar-container">
              <div class="hist-bar-label">|${bin}⟩</div>
              <div class="hist-bar-track">
                 <div class="hist-bar-fill measurement-fill" style="width: ${width}%"></div>
              </div>
              <div class="hist-bar-value">${prob.toFixed(3)} <span class="hist-pct">(${pct}%)</span></div>
            </div>
          `;
        }
        html += '</div>';
        el.innerHTML = html;

        let labels = sortedIndices.map(i => `q${i}`).join('');
        infoEl.textContent = `Values show theoretical probabilities for qubits |${labels}⟩`;
    }

    // ─── Dirac Notation (KaTeX) ───────────────────────────────

    _updateDirac(state, numQubits) {
        const el = document.getElementById('panel-dirac');
        if (!el) return;

        const texString = stateVectorToTeX(state, numQubits);

        // Create a container for the TeX output
        el.innerHTML = '<div class="state-formula tex-formula"></div>';
        const formulaEl = el.querySelector('.tex-formula');

        renderTeX(texString, formulaEl, { displayMode: true });
    }

    // ─── Amplitudes Bar Chart ────────────────────────────────

    _updateAmplitudes(state, numQubits) {
        const el = document.getElementById('panel-amplitudes');
        const dim = 1 << numQubits;

        let html = '<div class="amp-bars">';
        for (let i = 0; i < dim; i++) {
            const [re, im] = state[i];
            const mag = Math.sqrt(re * re + im * im);
            const prob = mag * mag;
            const phase = Math.atan2(im, re);
            const hue = ((phase * 180 / Math.PI) + 360) % 360;

            const bin = i.toString(2).padStart(numQubits, '0');
            const height = (mag * 100).toFixed(1);

            // Symbolic amplitude label
            const symbLabel = formatComplexTeX(re, im);

            html += `
            <div class="amp-bar-container">
               <div class="amp-bar-label">|${bin}⟩</div>
               <div class="amp-bar-track">
                  <div class="amp-bar-fill" style="width: ${height}%; background-color: hsl(${hue}, 80%, 60%)"></div>
               </div>
               <div class="amp-bar-value">${mag.toFixed(3)} <span class="amp-prob">(P=${prob.toFixed(3)})</span></div>
            </div>
          `;
        }
        html += '</div>';
        el.innerHTML = html;
    }
}
