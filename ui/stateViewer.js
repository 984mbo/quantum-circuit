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
        this._histogramData = null; // { counts, totalShots }
        this._renderTabs();
    }

    _renderTabs() {
        this.container.innerHTML = `
      <div class="state-viewer-inner">
        <div class="state-tabs">
          <button class="state-tab active" data-tab="dirac">State Vector</button>
          <button class="state-tab" data-tab="timeline">Timeline</button>
          <button class="state-tab" data-tab="measurements">Measurements</button>
        </div>
        <div class="state-panel dirac-panel active" id="panel-dirac"></div>
        <div class="state-panel timeline-panel" id="panel-timeline">
          <div class="timeline-empty">Run simulation to see state evolution</div>
        </div>
        <div class="state-panel measurements-panel" id="panel-measurements">
           <div class="measurements-chart" id="chart-measurements"></div>
           <div class="measurements-info" id="info-measurements"></div>
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
        // Map the original stepIndex to filteredIndex
        this._activeTimelineStep = stepIndex;
        const panel = document.getElementById('panel-timeline');
        if (!panel) return;

        // Find the filtered index corresponding to this stepIndex
        const filteredSteps = this._getFilteredSteps();
        const filteredIdx = filteredSteps.findIndex(s => s._originalIdx === stepIndex);

        // Update active class on step cards
        panel.querySelectorAll('.timeline-step').forEach((el, i) => {
            el.classList.toggle('active', i === filteredIdx);
        });

        // Auto-scroll to active step
        const activeEl = panel.querySelector('.timeline-step.active');
        if (activeEl) {
            activeEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
    }

    /**
     * Filter steps: keep initial state + steps that have gates/measurements
     */
    _getFilteredSteps() {
        const steps = this._timelineSteps;
        if (!steps || steps.length === 0) return [];

        return steps
            .map((step, idx) => ({ ...step, _originalIdx: idx }))
            .filter(step => {
                // Always keep initial state (col < 0)
                if (step.col < 0) return true;
                // Keep only steps that have applied gates
                return step.appliedGates && step.appliedGates.length > 0;
            });
    }

    _renderTimeline() {
        const panel = document.getElementById('panel-timeline');
        if (!panel) return;

        const numQubits = this._timelineNumQubits;
        const filteredSteps = this._getFilteredSteps();

        if (filteredSteps.length === 0) {
            panel.innerHTML = '<div class="timeline-empty">Run simulation to see state evolution</div>';
            return;
        }

        const container = document.createElement('div');
        container.className = 'timeline-container';

        // Auto-adjust histogram bar limit based on wire count
        const dim = 1 << numQubits;
        const maxBars = numQubits <= 3 ? dim : Math.min(dim, 16);

        // Auto-adjust Dirac font size based on wire count
        const diracFontSize = numQubits <= 3 ? 10 : numQubits <= 5 ? 8 : 6;
        // Auto-adjust max terms for Dirac display
        const diracMaxTerms = numQubits <= 3 ? 4 : numQubits <= 5 ? 3 : 2;

        filteredSteps.forEach((step, idx) => {
            // Arrow between steps
            if (idx > 0) {
                const arrow = document.createElement('div');
                arrow.className = 'timeline-arrow';
                arrow.textContent = '\u2192';
                container.appendChild(arrow);
            }

            const isActive = step._originalIdx === this._activeTimelineStep;
            const card = document.createElement('div');
            card.className = 'timeline-step' + (isActive ? ' active' : '');

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

            // ── Upper section: Theoretical amplitude bars ──
            const upperLabel = document.createElement('div');
            upperLabel.className = 'timeline-section-label';
            upperLabel.textContent = '理論値 (振幅)';
            card.appendChild(upperLabel);

            const barsWrapper = document.createElement('div');
            barsWrapper.className = 'timeline-bars-wrapper';

            // Scale marks at 0.5 and 1.0
            const scaleMark1 = document.createElement('div');
            scaleMark1.className = 'timeline-scale-mark';
            scaleMark1.style.bottom = '100%';
            scaleMark1.dataset.label = '1.0';
            barsWrapper.appendChild(scaleMark1);

            const scaleMark05 = document.createElement('div');
            scaleMark05.className = 'timeline-scale-mark';
            scaleMark05.style.bottom = '50%';
            scaleMark05.dataset.label = '0.5';
            barsWrapper.appendChild(scaleMark05);

            const barsDiv = document.createElement('div');
            barsDiv.className = 'timeline-bars';
            const sv = step.stateVector;

            // Collect all amplitudes and filter/sort for display
            const amplitudes = [];
            for (let i = 0; i < dim; i++) {
                const [re, im] = sv[i];
                const mag = Math.sqrt(re * re + im * im);
                if (mag > 1e-6) {
                    const phase = Math.atan2(im, re);
                    amplitudes.push({ idx: i, mag, phase });
                }
            }
            // Sort by magnitude descending, limit to maxBars
            amplitudes.sort((a, b) => b.mag - a.mag);
            const displayAmps = amplitudes.slice(0, maxBars);
            const hiddenCount = amplitudes.length - displayAmps.length;



            // Auto-adjust bar label font size
            const barLabelSize = numQubits <= 4 ? 7 : numQubits <= 6 ? 6 : 5;

            for (const amp of displayAmps) {
                const hue = ((amp.phase * 180 / Math.PI) + 360) % 360;

                const barWrap = document.createElement('div');
                barWrap.className = 'timeline-bar-wrap';

                const bar = document.createElement('div');
                bar.className = 'timeline-bar';
                bar.style.height = (amp.mag * 100).toFixed(1) + '%';
                bar.style.backgroundColor = `hsl(${hue}, 80%, 60%)`;
                barWrap.appendChild(bar);

                const barLabel = document.createElement('div');
                barLabel.className = 'timeline-bar-label';
                barLabel.style.fontSize = barLabelSize + 'px';
                barLabel.textContent = amp.idx.toString(2).padStart(numQubits, '0');
                barWrap.appendChild(barLabel);

                barsDiv.appendChild(barWrap);
            }

            if (hiddenCount > 0) {
                const more = document.createElement('div');
                more.className = 'timeline-bar-more';
                more.textContent = `+${hiddenCount}`;
                barsDiv.appendChild(more);
            }

            barsWrapper.appendChild(barsDiv);
            card.appendChild(barsWrapper);

            // Compact Dirac notation with auto-sizing
            const diracDiv = document.createElement('div');
            diracDiv.className = 'timeline-dirac';
            diracDiv.style.fontSize = diracFontSize + 'px';
            const texStr = stateVectorToTeX(sv, numQubits, diracMaxTerms);
            diracDiv.innerHTML = texToHTML(texStr, { displayMode: false });
            // Auto-scale KaTeX font
            const katexEl = diracDiv.querySelector('.katex');
            if (katexEl) katexEl.style.fontSize = diracFontSize + 'px';
            card.appendChild(diracDiv);

            // ── Lower section: Histogram (measurement shots) ──
            // Only show on the LAST filtered step, and only if histogram data exists
            const isLastStep = (idx === filteredSteps.length - 1);
            if (isLastStep && this._histogramData && this._histogramData.counts) {
                const counts = this._histogramData.counts;
                const totalShots = this._histogramData.totalShots;
                const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

                if (sorted.length > 0) {
                    const lowerLabel = document.createElement('div');
                    lowerLabel.className = 'timeline-section-label timeline-section-label-lower';
                    lowerLabel.textContent = `実測値 (${totalShots} shots)`;
                    card.appendChild(lowerLabel);

                    const histWrapper = document.createElement('div');
                    histWrapper.className = 'timeline-histogram-wrapper';

                    const maxVal = Math.max(...Object.values(counts), 1);
                    const histBars = sorted.slice(0, maxBars);
                    const hiddenHist = sorted.length - histBars.length;

                    for (const [bin, count] of histBars) {
                        const pct = (count / totalShots * 100).toFixed(1);
                        const height = (count / maxVal * 100);

                        const barWrap = document.createElement('div');
                        barWrap.className = 'timeline-hist-bar-wrap';

                        const bar = document.createElement('div');
                        bar.className = 'timeline-hist-bar';
                        bar.style.height = height.toFixed(1) + '%';
                        barWrap.appendChild(bar);

                        const valLabel = document.createElement('div');
                        valLabel.className = 'timeline-hist-value';
                        valLabel.textContent = `${pct}%`;
                        barWrap.appendChild(valLabel);

                        const binLabel = document.createElement('div');
                        binLabel.className = 'timeline-bar-label';
                        binLabel.style.fontSize = barLabelSize + 'px';
                        binLabel.textContent = bin;
                        barWrap.appendChild(binLabel);

                        histWrapper.appendChild(barWrap);
                    }

                    if (hiddenHist > 0) {
                        const moreDiv = document.createElement('div');
                        moreDiv.className = 'timeline-bar-more';
                        moreDiv.textContent = `+${hiddenHist} more`;
                        histWrapper.appendChild(moreDiv);
                    }

                    card.appendChild(histWrapper);
                }
            }

            container.appendChild(card);
        });

        panel.innerHTML = '';
        panel.appendChild(container);
    }

    updateHistogram(counts, totalShots) {
        if (!counts || Object.keys(counts).length === 0) {
            this._histogramData = null;
        } else {
            this._histogramData = { counts, totalShots };
        }
        // Re-render timeline to show/update histogram in last step
        this._renderTimeline();
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
        const sortedIndices = [...indices].sort((a, b) => b - a);
        const marginals = {};

        for (const [label, prob] of Object.entries(fullProbs)) {
            let marginalLabel = '';
            for (const idx of sortedIndices) {
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
}
