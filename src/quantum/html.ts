import { ADDER_SOURCE } from "./adder-source";
import { QFT_SOURCE } from "./qft-source";

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const amplitudeCards = Array.from(
  { length: 8 },
  (_, basis) => `
    <li class="amplitude" data-amplitude="${basis}">
      <span class="basis">|${basis.toString(2).padStart(3, "0")}⟩</span>
      <svg class="phasor" viewBox="0 0 54 54" role="img" aria-label="Amplitude phasor for basis ${basis}">
        <circle cx="27" cy="27" r="20"></circle>
        <line class="phasor-axis" x1="5" y1="27" x2="49" y2="27"></line>
        <line class="phasor-axis" x1="27" y1="5" x2="27" y2="49"></line>
        <line class="phasor-vector" x1="27" y1="27" x2="47" y2="27"></line>
        <circle class="phasor-tip" cx="47" cy="27" r="2.5"></circle>
      </svg>
      <strong data-amplitude-magnitude>0.000</strong>
      <code data-amplitude-phase>0.000 rad</code>
    </li>`,
).join("");

const qftOptions = Array.from(
  { length: 8 },
  (_, value) =>
    `<option value="${value}"${value === 5 ? " selected" : ""}>${value} · |${value.toString(2).padStart(3, "0")}⟩</option>`,
).join("");

export const renderQuantumHtml = (): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="Run QFT and a reversible logical Toffoli adder forward and backward through Janus host procedures.">
    <title>UNCALL Quantum — QFT and reversible addition</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #090b0c;
        --panel: #111518;
        --panel-2: #0c0f11;
        --ink: #f4f1e8;
        --muted: #929b9d;
        --dim: #626b6d;
        --line: #293035;
        --acid: #d7ff64;
        --acid-ink: #151b08;
        --cyan: #76ddff;
        --violet: #bda5ff;
        --green: #8ee5a1;
        --red: #ff7168;
        --font-size-min: 14px;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-synthesis: none;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-width: 320px;
        min-height: 100vh;
        background:
          radial-gradient(circle at 78% 4%, rgba(189,165,255,.1), transparent 31rem),
          radial-gradient(circle at 12% 22%, rgba(118,221,255,.07), transparent 28rem),
          var(--bg);
        color: var(--ink);
      }
      body::before {
        content: "";
        position: fixed;
        inset: 0;
        pointer-events: none;
        opacity: .2;
        background-image: linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px), linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px);
        background-size: 32px 32px;
        mask-image: linear-gradient(to bottom,black,transparent 70%);
      }
      button, input, select, textarea { font: inherit; }
      a { color: var(--cyan); }
      [hidden] { display: none !important; }
      .shell { position: relative; width: min(1440px,calc(100% - 44px)); margin: 0 auto; padding: 28px 0 48px; }
      .topbar { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 65px; }
      .brand { color: var(--ink); font: 800 14px/1 ui-monospace,monospace; letter-spacing: .18em; text-decoration: none; }
      .back-link { color: var(--muted); font: var(--font-size-min)/1.3 ui-monospace,monospace; letter-spacing: .06em; text-decoration: none; text-transform: uppercase; }
      .back-link:hover { color: var(--ink); }
      .hero { display: grid; grid-template-columns: minmax(0,1.35fr) minmax(300px,.65fr); gap: 52px; align-items: end; margin-bottom: 42px; }
      .kicker { margin: 0 0 15px; color: var(--violet); font: 700 var(--font-size-min)/1.4 ui-monospace,monospace; letter-spacing: .14em; text-transform: uppercase; }
      h1 { margin: 0; max-width: 900px; font-size: clamp(48px,7vw,94px); line-height: .9; letter-spacing: -.065em; }
      h1 em { color: var(--cyan); font-style: normal; }
      .lede { margin: 0; color: var(--muted); font-size: 16px; line-height: 1.75; }
      .lede code { color: var(--ink); font: var(--font-size-min)/1.4 ui-monospace,monospace; }
      .tabs { display: inline-flex; border: 1px solid var(--line); background: var(--panel); }
      .tab { min-width: 260px; min-height: 64px; border: 0; border-right: 1px solid var(--line); padding: 12px 18px; cursor: pointer; background: transparent; color: var(--muted); text-align: left; }
      .tab:last-child { border-right: 0; }
      .tab[aria-selected="true"] { background: var(--violet); color: #151121; }
      .tab:disabled { cursor: wait; opacity: .48; }
      .tab:focus-visible { outline: 2px solid var(--cyan); outline-offset: 2px; }
      .tab strong, .tab span { display: block; }
      .tab strong { margin-bottom: 7px; font-size: var(--font-size-min); }
      .tab span { opacity: .72; font: var(--font-size-min)/1.4 ui-monospace,monospace; }
      .panel { margin-top: 18px; border: 1px solid var(--line); background: rgba(17,21,24,.94); box-shadow: 0 30px 100px rgba(0,0,0,.32); }
      .panel-head { display: grid; grid-template-columns: minmax(0,1.25fr) minmax(300px,.75fr); gap: 34px; align-items: end; padding: 30px; border-bottom: 1px solid var(--line); }
      .panel-head h2 { margin: 0; font-size: clamp(31px,4vw,55px); line-height: .98; letter-spacing: -.045em; }
      .panel-head h2 em { color: var(--cyan); font-style: normal; }
      .panel-head p:last-child { margin: 0; color: var(--muted); font-size: var(--font-size-min); line-height: 1.7; }
      .workbench { display: grid; grid-template-columns: minmax(420px,.82fr) minmax(0,1.18fr); }
      .main-pane, .side-pane { min-width: 0; padding: 24px; }
      .main-pane { grid-column: 2; grid-row: 1; }
      .side-pane { grid-column: 1; grid-row: 1; border-right: 1px solid var(--line); }
      .section-head { display: flex; align-items: baseline; justify-content: space-between; gap: 14px; margin-bottom: 12px; }
      .section-head h3 { margin: 0; font-size: var(--font-size-min); }
      .tag { color: var(--dim); font: var(--font-size-min)/1.4 ui-monospace,monospace; letter-spacing: .07em; text-transform: uppercase; }
      .input-row { display: flex; flex-wrap: wrap; gap: 12px; align-items: end; margin-bottom: 19px; }
      label { display: grid; gap: 7px; color: var(--dim); font: var(--font-size-min)/1.3 ui-monospace,monospace; letter-spacing: .07em; text-transform: uppercase; }
      select, input[type="number"] { min-width: 170px; min-height: 43px; border: 1px solid var(--line); border-radius: 0; padding: 0 12px; background: var(--panel-2); color: var(--ink); }
      select:focus, input:focus { outline: 1px solid var(--cyan); }
      .output-field select:not(:disabled), .register-output:not(:disabled) { border-color: var(--cyan); color: var(--cyan); }
      .basis-readout { margin-left: auto; color: var(--cyan); font: 800 31px/1 ui-monospace,monospace; }
      .circuit-frame { display: grid; grid-template-columns: auto minmax(0,1fr); border: 1px solid var(--line); background: var(--panel-2); }
      .wire-labels { z-index: 1; display: grid; align-content: start; min-width: 84px; border-right: 1px solid var(--line); padding-top: 12px; background: #0c0f11; color: var(--muted); font: var(--font-size-min)/44px ui-monospace,monospace; text-align: center; }
      .circuit-scroll { min-width: 0; overflow-x: auto; }
      .circuit { display: block; min-width: 100%; }
      .circuit .wire { stroke: #394248; stroke-width: 1; }
      .circuit .gate-link { stroke: #758187; stroke-width: 1.5; }
      .circuit .gate-box { fill: #182127; stroke: var(--cyan); stroke-width: 1.5; }
      .circuit .gate-control { fill: var(--violet); }
      .circuit .gate-target { fill: var(--panel-2); stroke: var(--cyan); stroke-width: 1.5; }
      .circuit .gate-mark { stroke: var(--cyan); stroke-width: 1.5; }
      .circuit .gate-text { fill: var(--ink); font: 700 var(--font-size-min) ui-monospace,monospace; text-anchor: middle; dominant-baseline: central; }
      .circuit .gate-column.is-current .gate-box, .circuit .gate-column.is-current .gate-target { filter: drop-shadow(0 0 5px var(--acid)); stroke: var(--acid); }
      .circuit-empty { fill: var(--dim); font: var(--font-size-min) ui-monospace,monospace; }
      .execution-label { margin: 8px 0 0; color: var(--dim); font: var(--font-size-min)/1.4 ui-monospace,monospace; }
      .controls { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
      .button { min-height: 44px; border: 1px solid var(--line); border-radius: 0; padding: 0 15px; cursor: pointer; background: transparent; color: var(--ink); font-size: var(--font-size-min); font-weight: 780; }
      .button:hover:not(:disabled) { border-color: #657279; }
      .button:disabled { cursor: not-allowed; opacity: .3; }
      .button--call { border-color: var(--violet); background: var(--violet); color: #151121; }
      .button--uncall { border-color: var(--cyan); color: var(--cyan); }
      .status { min-height: 58px; margin: 12px 0 0; border-left: 2px solid var(--cyan); padding: 9px 12px; color: var(--muted); font: var(--font-size-min)/1.55 ui-monospace,monospace; }
      .status strong { color: var(--ink); }
      .status.is-ok { border-color: var(--green); }
      .status.is-error { border-color: var(--red); color: var(--red); }
      .amplitudes { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 7px; margin: 18px 0 0; padding: 0; list-style: none; }
      .amplitude { min-width: 0; border: 1px solid var(--line); padding: 10px 6px; background: var(--panel-2); text-align: center; }
      .basis { display: block; color: var(--cyan); font: var(--font-size-min)/1.3 ui-monospace,monospace; }
      .phasor { display: block; width: 54px; height: 54px; margin: 6px auto; }
      .phasor circle { fill: none; stroke: #2f383d; }
      .phasor .phasor-axis { stroke: #242c30; }
      .phasor .phasor-vector { stroke: var(--violet); stroke-width: 2; }
      .phasor .phasor-tip { fill: var(--acid); stroke: none; }
      .amplitude strong { display: block; color: var(--ink); font: var(--font-size-min)/1.3 ui-monospace,monospace; }
      .amplitude code { display: block; margin-top: 4px; color: var(--dim); font: var(--font-size-min)/1.3 ui-monospace,monospace; }
      .registers { display: grid; grid-template-columns: repeat(3,1fr); gap: 7px; margin: 17px 0; }
      .register { border: 1px solid var(--line); padding: 12px; background: var(--panel-2); }
      .register span, .register strong { display: block; }
      .register span { margin-bottom: 7px; color: var(--dim); font: var(--font-size-min)/1.3 ui-monospace,monospace; text-transform: uppercase; }
      .register strong { color: var(--cyan); font: 750 15px/1.25 ui-monospace,monospace; }
      .register-output { display: block; width: 100%; min-width: 0 !important; min-height: 38px !important; color: var(--cyan); font: 750 15px/1.25 ui-monospace,monospace; }
      .register.is-clean { border-color: rgba(142,229,161,.42); }
      .register.is-clean strong { color: var(--green); }
      .editor { border: 1px solid var(--line); background: #080a0b; }
      .editor-bar { padding: 9px 12px; border-bottom: 1px solid var(--line); color: var(--dim); font: var(--font-size-min)/1.3 ui-monospace,monospace; }
      .source { display: block; width: 100%; min-height: 530px; margin: 0; border: 0; padding: 15px; resize: vertical; outline: 0; background: transparent; color: #cdd5d7; font: var(--font-size-min)/1.55 "SFMono-Regular",Consolas,monospace; }
      .adder-source { min-height: 330px; }
      .stream-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 18px; }
      .stream { min-width: 0; border: 1px solid var(--line); background: var(--panel-2); }
      .stream h4 { margin: 0; border-bottom: 1px solid var(--line); padding: 9px; color: var(--muted); font: var(--font-size-min)/1.3 ui-monospace,monospace; }
      .stream ol { max-height: 190px; overflow: auto; margin: 0; padding: 9px 9px 9px 31px; color: var(--dim); font: var(--font-size-min)/1.6 ui-monospace,monospace; }
      .stream li.is-current { color: var(--acid); }
      .scope { margin: 16px 0 0; border: 1px solid rgba(189,165,255,.35); padding: 14px; color: var(--muted); font-size: var(--font-size-min); line-height: 1.65; }
      .scope strong { color: var(--violet); }
      .citation { margin: 13px 0 0; color: var(--muted); font-size: var(--font-size-min); line-height: 1.6; }
      footer { display: flex; justify-content: space-between; gap: 16px; padding: 20px 2px 0; color: var(--dim); font: var(--font-size-min)/1.5 ui-monospace,monospace; }
      @media (max-width: 920px) {
        .shell { width: min(100% - 24px,760px); }
        .hero, .panel-head, .workbench { grid-template-columns: 1fr; }
        .main-pane, .side-pane { grid-column: 1; }
        .side-pane { grid-row: 1; border-right: 0; border-bottom: 1px solid var(--line); }
        .main-pane { grid-row: 2; }
        .tabs { display: flex; width: 100%; }
        .tab { min-width: 0; flex: 1; }
      }
      @media (max-width: 580px) {
        .shell { padding-top: 18px; }
        .topbar { margin-bottom: 36px; }
        .hero { gap: 24px; }
        h1 { font-size: clamp(45px,15vw,68px); }
        .tab { padding: 10px; }
        .panel-head, .main-pane, .side-pane { padding: 20px; }
        .amplitudes { grid-template-columns: repeat(2,minmax(0,1fr)); }
        .stream-grid { grid-template-columns: 1fr; }
        .basis-readout { width: 100%; margin: 0; }
        .registers { grid-template-columns: 1fr; }
        footer { display: block; }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <nav class="topbar" aria-label="Product">
        <a class="brand" href="/">UN/CALL</a>
        <a class="back-link" href="/">← Pure Janus demos</a>
      </nav>

      <header class="hero">
        <div>
          <p class="kicker">Janus host primitives · quantum simulation</p>
          <h1>Quantum circuits have a direction. <em>Janus lets you run both.</em></h1>
        </div>
        <p class="lede">Every visible gate is emitted by a host primitive. <code>call</code> executes the circuit; <code>uncall</code> traverses the same Janus procedure in reverse and asks each primitive for its adjoint.</p>
      </header>

      <div class="tabs" role="tablist" aria-label="Quantum circuit demos">
        <button class="tab" id="qft-tab" type="button" role="tab" aria-selected="true" aria-controls="qft-panel" tabindex="0">
          <strong>QFT</strong><span>3 qubits · phase · inverse QFT</span>
        </button>
        <button class="tab" id="adder-tab" type="button" role="tab" aria-selected="false" aria-controls="adder-panel" tabindex="-1">
          <strong>Adder</strong><span>4 bit · CNOT / Toffoli · modulo 16</span>
        </button>
      </div>

      <section class="panel" id="qft-panel" role="tabpanel" aria-labelledby="qft-tab">
        <header class="panel-head">
          <div><p class="kicker">Question 01 · where did the number go?</p><h2>Magnitude becomes uniform.<br><em>Input becomes phase.</em></h2></div>
          <p>A fixed 3-qubit state-vector simulation applies QFT to one computational basis state. All eight probabilities become 1/8; the phasors retain the relative phase that encodes x.</p>
        </header>
        <div class="workbench">
          <section class="main-pane" aria-labelledby="qft-circuit-title">
            <div class="input-row">
              <label>Computational basis input<select id="qft-input">${qftOptions}</select></label>
              <label class="output-field">Phase-encoded output<select id="qft-output" disabled>${qftOptions}</select></label>
              <strong class="basis-readout" id="qft-basis">|101⟩</strong>
            </div>
            <div class="section-head"><h3 id="qft-circuit-title">Emitted gate circuit</h3><span class="tag" id="qft-step">ready · 0 / 7</span></div>
            <div class="circuit-frame">
              <div class="wire-labels" style="grid-template-rows:repeat(3,44px)"><span>q0 · LSB</span><span>q1</span><span>q2 · MSB</span></div>
              <div class="circuit-scroll"><svg class="circuit" id="qft-circuit" height="156" role="img" aria-label="QFT gate circuit"></svg></div>
            </div>
            <p class="execution-label" id="qft-execution-label">Forward circuit appears gate by gate.</p>
            <div class="controls">
              <button class="button button--call" id="qft-call" type="button">CALL QFT →</button>
              <button class="button button--uncall" id="qft-uncall" type="button" disabled>← UNCALL QFT</button>
              <button class="button" id="qft-reset" type="button">RESET</button>
            </div>
            <p class="status" id="qft-status" aria-live="polite"><strong>Ready.</strong> Call QFT to move the basis value into relative phase.</p>
            <ol class="amplitudes" aria-label="Eight complex amplitudes">${amplitudeCards}</ol>
            <div class="stream-grid">
              <section class="stream"><h4>Forward · QFT</h4><ol id="qft-forward-stream"></ol></section>
              <section class="stream"><h4>Backward · QFT†</h4><ol id="qft-backward-stream"></ol></section>
            </div>
          </section>
          <aside class="side-pane" aria-labelledby="qft-source-title">
            <div class="section-head"><h3 id="qft-source-title">qft.janus</h3><span class="tag">width-generic loop · specialized to 3</span></div>
            <div class="editor"><div class="editor-bar"><code>length</code> drives target/control loops; the adapter lowers indices to primitive names</div><textarea class="source" readonly aria-label="QFT Janus source">${escapeHtml(QFT_SOURCE)}</textarea></div>
            <div class="scope"><strong>Simulation scope</strong><br>3-qubit state vector in this browser. This is not execution on quantum hardware.</div>
          </aside>
        </div>
      </section>

      <section class="panel" id="adder-panel" role="tabpanel" aria-labelledby="adder-tab" hidden>
        <header class="panel-head">
          <div><p class="kicker">Question 02 · can one procedure add and subtract?</p><h2>Add forward.<br><em>Subtract backward.</em></h2></div>
          <p>A Cuccaro-style majority/unmajority carry chain updates computational-basis bits. Janus emits the logical gate sequence forward, then derives subtraction from the same nested procedure.</p>
        </header>
        <div class="workbench">
          <section class="main-pane" aria-labelledby="adder-circuit-title">
            <div class="input-row">
              <label>Register a<input id="adder-a" type="number" min="0" max="15" step="1" value="5"></label>
              <label>Register b<input id="adder-b" type="number" min="0" max="15" step="1" value="11"></label>
              <strong class="basis-readout" id="adder-equation">5 + 11 mod 16</strong>
            </div>
            <div class="registers" aria-label="Adder register state">
              <div class="register"><span>a · unchanged</span><strong id="adder-register-a">0101 · 5</strong></div>
              <div class="register"><span>b · output · editable after call</span><input class="register-output" id="adder-output-b" type="number" min="0" max="15" step="1" value="11" disabled aria-label="Adder output register b"></div>
              <div class="register is-clean" id="adder-ancilla-box"><span>c0 · carry ancilla</span><strong id="adder-ancilla">0 · clean</strong></div>
            </div>
            <div class="section-head"><h3 id="adder-circuit-title">Emitted logical gate circuit</h3><span class="tag" id="adder-step">ready · 0 / 24</span></div>
            <div class="circuit-frame">
              <div class="wire-labels" style="grid-template-rows:repeat(9,44px)"><span>a0</span><span>a1</span><span>a2</span><span>a3</span><span>b0</span><span>b1</span><span>b2</span><span>b3</span><span>c0 · |0⟩</span></div>
              <div class="circuit-scroll"><svg class="circuit" id="adder-circuit" height="420" role="img" aria-label="Logical Toffoli adder gate circuit"></svg></div>
            </div>
            <p class="execution-label" id="adder-execution-label">Forward addition circuit appears gate by gate.</p>
            <div class="controls">
              <button class="button button--call" id="adder-call" type="button">CALL ADD →</button>
              <button class="button button--uncall" id="adder-uncall" type="button" disabled>← UNCALL ADD</button>
              <button class="button" id="adder-reset" type="button">RESET</button>
            </div>
            <p class="status" id="adder-status" aria-live="polite"><strong>Ready.</strong> Call add to compute b = a + b mod 16.</p>
            <div class="stream-grid">
              <section class="stream"><h4>Forward · addition</h4><ol id="adder-forward-stream"></ol></section>
              <section class="stream"><h4>Backward · subtraction</h4><ol id="adder-backward-stream"></ol></section>
            </div>
          </section>
          <aside class="side-pane" aria-labelledby="adder-source-title">
            <div class="section-head"><h3 id="adder-source-title">add.janus</h3><span class="tag">width-generic loop · specialized to 4</span></div>
            <div class="editor"><div class="editor-bar"><code>length</code> drives one MAJ and one reverse UMA traversal</div><textarea class="source adder-source" readonly aria-label="Adder Janus source">${escapeHtml(ADDER_SOURCE)}</textarea></div>
            <div class="scope"><strong>Logical Toffoli primitives; no Clifford+T decomposition.</strong><br>Computational-basis-only logical gate simulation. The demo does not reproduce or claim T-count or T-depth savings.</div>
            <p class="citation">Circuit context: Craig Gidney, <a href="https://doi.org/10.22331/q-2018-06-18-74" rel="external">Halving the cost of quantum addition</a> (<a href="https://arxiv.org/abs/1709.06648" rel="external">arXiv:1709.06648</a>). This demo stays at the reversible logical-adder level.</p>
          </aside>
        </div>
      </section>

      <footer><span>Typed gate stream · HostExecutor call / uncall</span><span>QFT state vector · basis-state logical adder</span></footer>
    </main>
    <script src="/quantum/app.js" defer></script>
  </body>
</html>`;
