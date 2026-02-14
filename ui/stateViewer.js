// ============================================================
// ui/stateViewer.js — Quantum State Visualization
// ============================================================

import { cAbs, cAbs2 } from '../sim/complex.js';

export class StateViewer {
    constructor(container) {
        this.container = container;
        this.activeTab = 'dirac';
        this._renderTabs();
    }

    _renderTabs() {
        this.container.innerHTML = `
      <div class="state-viewer-inner">
        <div class="state-tabs">
          <button class="state-tab active" data-tab="dirac">State Vector</button>
          <button class="state-tab" data-tab="amplitudes">Amplitudes</button>
          <button class="state-tab" data-tab="histogram">Histogram</button>
        </div>
        <div class="state-panel dirac-panel active" id="panel-dirac"></div>
        <div class="state-panel amplitudes-panel" id="panel-amplitudes"></div>
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

    updateState(stateVector, numQubits) {
        this._updateDirac(stateVector, numQubits);
        this._updateAmplitudes(stateVector, numQubits);
    }

    updateHistogram(counts, totalShots) {
        if (!counts) return;
        const chart = document.getElementById('chart-histogram');
        const info = document.getElementById('info-histogram');

        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        const maxVal = Math.max(...Object.values(counts));

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

    // ─── Dirac Notation ──────────────────────────────────────

    _updateDirac(state, numQubits) {
        const el = document.getElementById('panel-dirac');
        const dim = 1 << numQubits;

        // Collect non-zero terms
        const terms = [];
        for (let i = 0; i < dim; i++) {
            const [re, im] = state[i];
            const mag = Math.sqrt(re * re + im * im);
            if (mag > 1e-6) {
                terms.push({ i, re, im, mag });
            }
        }
        terms.sort((a, b) => b.mag - a.mag); // Descending magnitude

        const maxShow = (numQubits >= 4) ? 8 : dim;
        const showTerms = terms.slice(0, maxShow);
        const hidden = terms.length - showTerms.length;

        let html = `<div class="state-formula">|ψ⟩ = `;
        if (showTerms.length === 0) html += '0';

        html += showTerms.map(t => {
            const bin = t.i.toString(2).padStart(numQubits, '0');
            const coeff = this._formatComplex(t.re, t.im);
            return `<span class="state-term">${coeff}<span class="ket">|${bin}⟩</span></span>`;
        }).join(' + ');

        if (hidden > 0) {
            html += ` <span class="state-ellipsis">+ ${hidden} more terms...</span>`;
        }
        html += `</div>`;

        el.innerHTML = html;
    }

    _formatComplex(re, im) {
        const tol = 1e-6;
        const absRe = Math.abs(re);
        const absIm = Math.abs(im);

        const fmt = (v) => {
            if (Math.abs(v - 1) < tol) return '';
            if (Math.abs(v + 1) < tol) return '-';
            if (Math.abs(Math.abs(v) - Math.SQRT1_2) < tol) return (v > 0 ? '' : '-') + '0.707';
            if (Math.abs(Math.abs(v) - 0.5) < tol) return (v > 0 ? '' : '-') + '0.5';
            return v.toFixed(3);
        };

        if (absIm < tol) return fmt(re);
        if (absRe < tol) {
            if (Math.abs(absIm - 1) < tol) return (im > 0 ? 'i' : '-i');
            return fmt(im) + 'i';
        }
        return `(${fmt(re)}${im > 0 ? '+' : ''}${fmt(im)}i)`;
    }

    // ─── Amplitudes Bar Chart ────────────────────────────────

    _updateAmplitudes(state, numQubits) {
        const el = document.getElementById('panel-amplitudes');
        const dim = 1 << numQubits;

        // For large n we clamp max bars?
        // Spec: n<=5 -> 32 bars. OK to show all.
        // But vertical scroll might be needed.

        let html = '<div class="amp-bars">';
        for (let i = 0; i < dim; i++) {
            const [re, im] = state[i];
            const mag = Math.sqrt(re * re + im * im);
            const prob = mag * mag;
            const phase = Math.atan2(im, re);
            const hue = ((phase * 180 / Math.PI) + 360) % 360;

            const bin = i.toString(2).padStart(numQubits, '0');
            const height = (mag * 100).toFixed(1); // relative to max? or absolute 1? 
            // Since sum |a|^2 = 1, max |a| <= 1.

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
