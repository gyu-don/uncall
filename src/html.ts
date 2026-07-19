import { PURE_CODEC_SOURCE } from "./demo/pure-codec";
import { PURE_SORT_SOURCE } from "./demo/pure-sort";
import { PURE_TREE_CODEC_SOURCE } from "./demo/pure-tree-codec";

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

export const renderHtml = (): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="One Janus program runs in both directions: call transforms state, uncall restores it.">
    <title>UNCALL — One program. Both directions.</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #0b0d0c;
        --panel: #121513;
        --ink: #f4f1e8;
        --muted: #929991;
        --dim: #626861;
        --line: #2b302c;
        --acid: #d7ff64;
        --acid-ink: #151b08;
        --cyan: #76ddff;
        --red: #ff7168;
        --green: #8ee5a1;
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
          radial-gradient(circle at 82% 5%, rgba(118,221,255,.08), transparent 28rem),
          radial-gradient(circle at 15% 28%, rgba(215,255,100,.055), transparent 30rem),
          var(--bg);
        color: var(--ink);
      }
      body::before {
        content: "";
        position: fixed;
        inset: 0;
        pointer-events: none;
        opacity: .22;
        background-image: linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px);
        background-size: 32px 32px;
        mask-image: linear-gradient(to bottom, black, transparent 70%);
      }
      button, input, textarea { font: inherit; }
      button { border-radius: 0; }
      .shell { position: relative; width: min(1240px, calc(100% - 44px)); margin: 0 auto; padding: 28px 0 48px; }
      .topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 68px; }
      .brand { font: 800 14px/1 ui-monospace, monospace; letter-spacing: .18em; }
      .badge { border: 1px solid var(--line); padding: 8px 11px; color: var(--muted); font: var(--font-size-min)/1.3 ui-monospace, monospace; letter-spacing: .08em; text-transform: uppercase; }
      .quantum-link { color: var(--cyan); text-decoration: none; }
      .quantum-link:hover { border-color: var(--cyan); color: var(--ink); }
      .hero { display: grid; grid-template-columns: minmax(0,1.3fr) minmax(290px,.7fr); gap: 52px; align-items: end; margin-bottom: 52px; }
      .kicker { margin: 0 0 16px; color: var(--acid); font: 700 var(--font-size-min)/1.4 ui-monospace, monospace; letter-spacing: .14em; text-transform: uppercase; }
      h1 { margin: 0; font-size: clamp(56px, 8.5vw, 112px); line-height: .87; letter-spacing: -.07em; }
      h1 em { color: var(--acid); font-style: normal; }
      .lede { margin: 0; color: var(--muted); font-size: 17px; line-height: 1.7; }
      .lede code { color: var(--ink); font: var(--font-size-min)/1.4 ui-monospace, monospace; }
      .demo-switch { display: inline-flex; border: 1px solid var(--line); background: var(--panel); }
      .demo-tab { min-width: 275px; min-height: 66px; border: 0; border-right: 1px solid var(--line); padding: 11px 18px; cursor: pointer; background: transparent; color: var(--muted); text-align: left; }
      .demo-tab:last-child { border-right: 0; }
      .demo-tab[aria-selected="true"] { background: var(--acid); color: var(--acid-ink); }
      .demo-tab:focus-visible { outline: 2px solid var(--cyan); outline-offset: 2px; }
      .demo-tab__title { display: block; margin-bottom: 7px; font-size: var(--font-size-min); font-weight: 780; line-height: 1.3; }
      .demo-tab__meta { display: block; opacity: .7; font: var(--font-size-min)/1.4 ui-monospace, monospace; }
      .demo-explainer { max-width: 940px; min-height: 64px; margin: 0 0 18px; border: 1px solid var(--line); border-top: 0; padding: 13px 17px; background: rgba(18,21,19,.86); color: var(--muted); font-size: var(--font-size-min); line-height: 1.65; }
      .demo-explainer strong { color: var(--ink); }
      .demo-explainer code { color: var(--cyan); font: var(--font-size-min)/1.4 ui-monospace, monospace; }
      .tab-panel[hidden] { display: none; }
      .lab { border: 1px solid var(--line); background: var(--panel); box-shadow: 0 30px 100px rgba(0,0,0,.32); }
      .lab-intro { display: grid; grid-template-columns: minmax(0,1.2fr) minmax(280px,.8fr); gap: 34px; align-items: end; padding: 32px; border-bottom: 1px solid var(--line); }
      .lab-intro .kicker { margin-bottom: 11px; }
      .lab-intro h2 { margin: 0; font-size: clamp(32px,4.6vw,62px); line-height: .98; letter-spacing: -.045em; }
      .lab-intro h2 em { color: var(--cyan); font-style: normal; }
      .lab-intro p:last-child { margin: 0; color: var(--muted); font-size: var(--font-size-min); line-height: 1.7; }
      .lab-grid { display: grid; grid-template-columns: minmax(0,1fr) minmax(390px,.95fr); }
      .lab-pane { min-width: 0; padding: 24px; }
      .lab-pane + .lab-pane { border-left: 1px solid var(--line); }
      .pane-head { display: flex; justify-content: space-between; align-items: center; gap: 14px; margin-bottom: 14px; }
      .pane-head h3 { margin: 0; font-size: var(--font-size-min); }
      .tag { color: var(--dim); font: var(--font-size-min)/1.4 ui-monospace, monospace; text-transform: uppercase; letter-spacing: .08em; }
      .editor { border: 1px solid var(--line); background: #090b0a; }
      .editor__bar { display: flex; align-items: center; gap: 6px; padding: 10px 13px; border-bottom: 1px solid var(--line); }
      .dot { width: 7px; height: 7px; border-radius: 50%; background: #343935; }
      .editor__file { margin-left: 5px; color: var(--dim); font: var(--font-size-min)/1.3 ui-monospace, monospace; }
      .source-editor { display: block; width: 100%; min-height: 670px; margin: 0; border: 0; padding: 20px; resize: vertical; outline: 0; background: transparent; color: #d9dfd8; font: var(--font-size-min)/1.65 "SFMono-Regular", Consolas, monospace; tab-size: 4; }
      .source-editor:focus { box-shadow: inset 0 0 0 1px var(--acid); }
      .source-editor:disabled { color: #9ba099; }
      .proof { border: 1px solid rgba(118,221,255,.36); background: rgba(118,221,255,.04); padding: 17px; }
      .equation { margin-bottom: 11px; font: 750 var(--font-size-min)/1.5 ui-monospace, monospace; }
      .equation span { color: var(--cyan); }
      .proof p { margin: 0; color: var(--muted); font-size: var(--font-size-min); line-height: 1.6; }
      .array-label { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin: 22px 0 10px; }
      .array-label h3 { margin: 0; font-size: var(--font-size-min); }
      .value-array { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 8px; }
      .value-cell { min-width: 0; height: 76px; border: 1px solid var(--line); background: #0b0d0c; color: var(--ink); text-align: center; font: 750 27px/1 ui-monospace, monospace; -moz-appearance: textfield; }
      .value-cell::-webkit-inner-spin-button { appearance: none; }
      .value-cell:focus { outline: 1px solid var(--acid); }
      .value-cell.is-output { border-color: rgba(118,221,255,.55); color: var(--cyan); }
      .value-cell.is-output:focus { outline-color: var(--acid); color: var(--ink); }
      .value-cell:disabled { opacity: 1; border-color: rgba(118,221,255,.35); color: var(--cyan); }
      .trace-list { display: grid; grid-template-columns: repeat(5,minmax(0,1fr)); gap: 6px; margin: 0; padding: 0; list-style: none; }
      .trace-bit { min-width: 0; border: 1px solid var(--line); background: #0b0d0c; padding: 10px 5px; text-align: center; }
      .trace-bit code { display: block; margin-bottom: 8px; color: var(--dim); font: var(--font-size-min)/1.3 ui-monospace, monospace; white-space: nowrap; }
      .trace-bit strong { display: block; font: 750 21px/1 ui-monospace, monospace; }
      .trace-bit span { display: block; margin-top: 6px; color: var(--dim); font: var(--font-size-min)/1.3 ui-monospace, monospace; text-transform: uppercase; }
      .trace-bit--swap { border-color: var(--acid); background: rgba(215,255,100,.06); }
      .trace-bit--swap strong, .trace-bit--swap span { color: var(--acid); }
      .trace-bit--keep { border-color: rgba(118,221,255,.3); }
      .trace-bit--keep strong { color: var(--cyan); }
      .stage { display: grid; grid-template-columns: repeat(3,1fr); margin-top: 18px; border: 1px solid var(--line); }
      .stage div { padding: 10px; border-right: 1px solid var(--line); color: var(--dim); font: var(--font-size-min)/1.3 ui-monospace, monospace; text-align: center; text-transform: uppercase; }
      .stage div:last-child { border-right: 0; }
      .stage .is-active { background: rgba(118,221,255,.06); color: var(--cyan); }
      .stage .is-done { color: var(--green); }
      .controls { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 17px; }
      .button { min-height: 44px; border: 1px solid var(--line); padding: 0 16px; cursor: pointer; background: transparent; color: var(--ink); font-size: var(--font-size-min); font-weight: 750; }
      .button:hover:not(:disabled) { border-color: #626b63; }
      .button:disabled { cursor: not-allowed; opacity: .3; }
      .button--acid { border-color: var(--acid); background: var(--acid); color: var(--acid-ink); }
      .button--cyan { border-color: var(--cyan); color: var(--cyan); }
      .button--small { min-height: 44px; padding: 0 12px; font-size: var(--font-size-min); }
      .status { min-height: 62px; margin: 13px 0 0; border-left: 2px solid var(--cyan); padding: 9px 12px; color: var(--muted); font: var(--font-size-min)/1.6 ui-monospace, monospace; }
      .status strong { color: var(--ink); }
      .status.is-verified { border-left-color: var(--green); }
      .status.is-error { border-left-color: var(--red); color: var(--red); }
      .footnote { display: grid; grid-template-columns: repeat(3,1fr); border-top: 1px solid var(--line); }
      .footnote div { padding: 19px 23px; border-right: 1px solid var(--line); }
      .footnote div:last-child { border-right: 0; }
      .footnote span { display: block; margin-bottom: 7px; color: var(--dim); font: var(--font-size-min)/1.3 ui-monospace, monospace; text-transform: uppercase; }
      .footnote p { margin: 0; color: var(--muted); font-size: var(--font-size-min); line-height: 1.55; }
      .codec-grid { grid-template-columns: minmax(0,.82fr) minmax(440px,1.18fr); }
      .codec-source { min-height: 390px; }
      .codec-inputs { display: grid; grid-template-columns: minmax(0,1fr) 110px; gap: 8px; margin: 22px 0; }
      .field { display: block; }
      .field span { display: block; margin-bottom: 7px; color: var(--dim); font: var(--font-size-min)/1.3 ui-monospace, monospace; text-transform: uppercase; }
      .text-input { width: 100%; height: 48px; border: 1px solid var(--line); padding: 0 12px; outline: 0; background: #0b0d0c; color: var(--ink); font: 700 17px/1 ui-monospace, monospace; }
      .text-input:focus { border-color: var(--acid); }
      .text-input.is-output { border-color: rgba(118,221,255,.55); color: var(--cyan); }
      .text-input.is-output:focus { border-color: var(--acid); color: var(--ink); }
      .text-input:disabled { opacity: 1; color: var(--cyan); }
      .codec-word { margin: 0 0 12px; color: var(--cyan); font: 800 clamp(46px,7vw,84px)/1 ui-monospace, monospace; letter-spacing: .08em; }
      .codec-codes { display: grid; grid-template-columns: repeat(5,1fr); gap: 6px; margin: 0; padding: 0; list-style: none; }
      .codec-codes li { border: 1px solid var(--line); padding: 10px 5px; background: #0b0d0c; text-align: center; }
      .codec-codes strong { display: block; margin-bottom: 5px; font: 750 16px/1 ui-monospace, monospace; }
      .codec-codes code { color: var(--dim); font: var(--font-size-min)/1.3 ui-monospace, monospace; }
      .codec-inverse { margin: 17px 0 0; border: 1px solid rgba(215,255,100,.32); padding: 13px; color: var(--muted); font: var(--font-size-min)/1.6 ui-monospace, monospace; }
      .codec-inverse strong { color: var(--acid); }
      .tree-grid { grid-template-columns: minmax(0,.78fr) minmax(520px,1.22fr); }
      .tree-source { min-height: 610px; }
      .tree-visual { border: 1px solid var(--line); background: radial-gradient(circle at 50% 20%, rgba(118,221,255,.07), transparent 46%), #0b0d0c; }
      .tree-map { display: block; width: 100%; height: auto; min-height: 300px; overflow: visible; }
      .tree-edge { stroke: #353b36; stroke-width: 2; transition: stroke .2s ease, stroke-width .2s ease; }
      .tree-edge-label { fill: var(--dim); font: 700 16px/1 ui-monospace, monospace; }
      .tree-edge.is-route { stroke: var(--cyan); stroke-width: 5; stroke-dasharray: 10 8; animation: tree-route 1.1s linear infinite; }
      .tree-edge-label.is-route { fill: var(--cyan); }
      .tree-node circle { fill: #121513; stroke: #424942; stroke-width: 2; transition: fill .2s ease, stroke .2s ease, stroke-width .2s ease; }
      .tree-node text { fill: var(--muted); font: 750 18px/1 ui-monospace, monospace; text-anchor: middle; dominant-baseline: central; pointer-events: none; }
      .tree-node .tree-node-id { fill: var(--dim); font-size: var(--font-size-min); }
      .tree-node.is-route circle { stroke: var(--cyan); }
      .tree-node.is-origin circle { stroke: var(--acid); }
      .tree-node.is-current circle { fill: var(--acid); stroke: var(--acid); stroke-width: 5; filter: drop-shadow(0 0 13px rgba(215,255,100,.34)); }
      .tree-node.is-current text { fill: var(--acid-ink); }
      .tree-node.is-current .tree-node-id { fill: rgba(21,27,8,.64); }
      @keyframes tree-route { to { stroke-dashoffset: -18; } }
      .leaf-picker { display: grid; grid-template-columns: repeat(4,1fr); gap: 7px; margin: 12px; }
      .leaf-choice { min-width: 0; min-height: 44px; border: 1px solid var(--line); padding: 9px 6px; cursor: pointer; background: #101311; color: var(--muted); font: 750 var(--font-size-min)/1.35 ui-monospace, monospace; }
      .leaf-choice span { display: block; margin-top: 3px; color: var(--dim); font-size: var(--font-size-min); }
      .leaf-choice.is-selected { border-color: var(--acid); color: var(--acid); }
      .leaf-choice:disabled { cursor: not-allowed; opacity: .45; }
      .tree-state { display: grid; grid-template-columns: repeat(3,1fr); gap: 7px; margin-top: 14px; }
      .tree-register { border: 1px solid var(--line); padding: 10px; background: #0b0d0c; }
      .tree-register span { display: block; margin-bottom: 7px; color: var(--dim); font: var(--font-size-min)/1.3 ui-monospace, monospace; text-transform: uppercase; }
      .tree-register strong { color: var(--ink); font: 750 16px/1.2 ui-monospace, monospace; }
      .tree-register.is-clean strong { color: var(--green); }
      .path-display { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 14px; align-items: end; margin-top: 14px; }
      .path-stack { display: grid; grid-template-columns: repeat(3,1fr); gap: 7px; margin: 0; padding: 0; list-style: none; }
      .path-slot { border: 1px solid var(--line); padding: 10px 5px; background: #0b0d0c; text-align: center; }
      .path-slot code { display: block; margin-bottom: 7px; color: var(--dim); font: var(--font-size-min)/1.3 ui-monospace, monospace; }
      .path-slot strong { color: var(--dim); font: 750 23px/1 ui-monospace, monospace; }
      .path-slot.is-used { border-color: rgba(118,221,255,.58); background: rgba(118,221,255,.05); }
      .path-slot.is-used strong { color: var(--cyan); }
      .path-bit { width: 100%; min-height: 34px; border: 0; padding: 0; cursor: pointer; background: transparent; color: var(--cyan); font: 750 23px/1 ui-monospace, monospace; }
      .path-bit:disabled { cursor: default; color: var(--dim); }
      .path-slot.is-used .path-bit:disabled { color: var(--cyan); }
      .path-bit:not(:disabled):focus-visible { outline: 1px solid var(--acid); }
      .route-output { min-width: 120px; text-align: right; }
      .route-output span { display: block; margin-bottom: 6px; color: var(--dim); font: var(--font-size-min)/1.3 ui-monospace, monospace; text-transform: uppercase; }
      .route-output strong { color: var(--cyan); font: 800 38px/1 ui-monospace, monospace; letter-spacing: .08em; }
      footer { display: flex; justify-content: space-between; gap: 18px; padding: 21px 2px 0; color: var(--dim); font: var(--font-size-min)/1.5 ui-monospace, monospace; }
      [hidden] { display: none !important; }
      @media (max-width: 850px) {
        .shell { width: min(100% - 24px,700px); }
        .topbar { margin-bottom: 44px; }
        .demo-switch { display: flex; width: 100%; }
        .demo-tab { min-width: 0; flex: 1; }
        .hero, .lab-intro, .lab-grid, .codec-grid, .tree-grid { grid-template-columns: 1fr; }
        .lab-pane + .lab-pane { order: -1; border-left: 0; }
        .lab-pane:first-child { border-top: 1px solid var(--line); }
      }
      @media (max-width: 600px) {
        .shell { padding-top: 18px; }
        .topbar { margin-bottom: 36px; }
        .hero { gap: 24px; margin-bottom: 36px; }
        h1 { font-size: clamp(52px,17vw,72px); }
        .demo-switch { display: grid; grid-template-columns: 1fr; }
        .demo-tab { min-width: 0; min-height: 70px; padding: 10px 14px; border-right: 0; border-bottom: 1px solid var(--line); }
        .demo-tab:last-child { border-bottom: 0; }
        .demo-tab__title { font-size: var(--font-size-min); line-height: 1.35; }
        .demo-tab__meta { font-size: var(--font-size-min); line-height: 1.4; }
        .demo-explainer { min-height: 0; font-size: var(--font-size-min); }
        .lab-intro { padding: 24px 20px; }
        .lab-pane { padding: 20px; }
        .source-editor { min-height: 610px; }
        .codec-source { min-height: 330px; }
        .tree-source { min-height: 520px; }
        .tree-map { min-height: 230px; }
        .trace-list { grid-template-columns: repeat(2,minmax(0,1fr)); }
        .leaf-picker { grid-template-columns: repeat(2,1fr); }
        .path-display { grid-template-columns: 1fr; }
        .route-output { text-align: left; }
        .codec-inputs { grid-template-columns: 1fr 90px; }
        .footnote { grid-template-columns: 1fr; }
        .footnote div { border-right: 0; border-bottom: 1px solid var(--line); }
        .footnote div:last-child { border-bottom: 0; }
        footer { display: block; }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <nav class="topbar" aria-label="Product">
        <span class="brand">UN/CALL</span>
        <a class="badge quantum-link" href="/quantum">Quantum demo →</a>
      </nav>

      <header class="hero">
        <div>
          <p class="kicker">A reversible programming language</p>
          <h1>One program.<br><em>Both directions.</em></h1>
        </div>
        <p class="lede"><code>call</code> transforms state. <code>uncall</code> runs the same Janus program backward—no separate decoder, unsorter, or undo implementation.</p>
      </header>

      <div class="demo-switch" role="tablist" aria-label="Pure Janus demos">
        <button class="demo-tab" id="sort-tab" type="button" role="tab" aria-selected="true" aria-controls="sort-demo" data-testid="sort-tab">
          <span class="demo-tab__title">Sort, then restore</span>
          <span class="demo-tab__meta">Reversible Sort · loop / swap / trace</span>
        </button>
        <button class="demo-tab" id="codec-tab" type="button" role="tab" aria-selected="false" aria-controls="codec-demo" data-testid="codec-tab">
          <span class="demo-tab__title">Encode, then decode</span>
          <span class="demo-tab__meta">Caesar Codec · += becomes -=</span>
        </button>
        <button class="demo-tab" id="tree-tab" type="button" role="tab" aria-selected="false" aria-controls="tree-demo" data-testid="tree-tab">
          <span class="demo-tab__title">Turn a tree leaf into a path</span>
          <span class="demo-tab__meta">Tree Path Codec · loop / stack / tree</span>
        </button>
      </div>
      <p class="demo-explainer" id="demo-explainer" aria-live="polite"><strong>Run the same sort in both directions.</strong> A reversible nested loop orders <code>length</code> inputs; <code>uncall</code> reconstructs the original control flow from the trace.</p>

      <section class="tab-panel" id="sort-demo" role="tabpanel" aria-labelledby="sort-tab">
        <section class="lab">
          <header class="lab-intro">
            <div>
              <p class="kicker">Pure Janus · reversible sort</p>
              <h2>Sort forward.<br><em>Restore backward.</em></h2>
            </div>
            <p>A reversible nested loop sorts <code>length</code> values. Janus keeps each branch decision in trace, then runs those loops and swaps backward.</p>
          </header>
          <div class="lab-grid">
            <section class="lab-pane" aria-labelledby="sort-source-title">
              <div class="pane-head"><h3 id="sort-source-title">sort.janus · editable</h3><span class="tag">parser → checker → evaluator</span></div>
              <div class="editor">
                <div class="editor__bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="editor__file">sort.janus</span></div>
                <textarea class="source-editor" id="pure-source" aria-label="Pure Janus sort source" spellcheck="false">${escapeHtml(PURE_SORT_SOURCE)}</textarea>
              </div>
            </section>
            <section class="lab-pane" aria-labelledby="sort-state-title">
              <div class="pane-head"><h3 id="sort-state-title">Reversible machine state</h3><span class="tag" id="pure-phase">initial</span></div>
              <div class="proof">
                <div class="equation">uncall(sort, <span>call(sort, state)</span>) = state</div>
                <p>The real Pure Janus evaluator reverses updates, swaps, statement order, and control flow.</p>
              </div>
              <div class="array-label"><h3>values[4]</h3><span class="tag" id="pure-values-hint">edit initial state</span></div>
              <div class="value-array">
                <input class="value-cell" type="number" value="4" aria-label="Value 1" data-pure-value="0">
                <input class="value-cell" type="number" value="1" aria-label="Value 2" data-pure-value="1">
                <input class="value-cell" type="number" value="3" aria-label="Value 3" data-pure-value="2">
                <input class="value-cell" type="number" value="2" aria-label="Value 4" data-pure-value="3">
              </div>
              <div class="array-label"><h3>trace[6]</h3><span class="tag">branch history</span></div>
              <ol class="trace-list">
                <li class="trace-bit" data-pure-trace="0"><code>v0↔v1</code><strong>0</strong><span>empty</span></li>
                <li class="trace-bit" data-pure-trace="1"><code>v1↔v2</code><strong>0</strong><span>empty</span></li>
                <li class="trace-bit" data-pure-trace="2"><code>v2↔v3</code><strong>0</strong><span>empty</span></li>
                <li class="trace-bit" data-pure-trace="3"><code>v0↔v1</code><strong>0</strong><span>empty</span></li>
                <li class="trace-bit" data-pure-trace="4"><code>v1↔v2</code><strong>0</strong><span>empty</span></li>
                <li class="trace-bit" data-pure-trace="5"><code>v0↔v1</code><strong>0</strong><span>empty</span></li>
              </ol>
              <div class="stage" aria-label="Sort execution direction">
                <div class="is-active" data-pure-stage="initial">initial</div>
                <div data-pure-stage="called">call sort →</div>
                <div data-pure-stage="restored">← uncall sort</div>
              </div>
              <div class="controls">
                <button class="button button--acid" id="pure-call" type="button" data-testid="pure-call">Call sort →</button>
                <button class="button button--cyan" id="pure-uncall" type="button" disabled data-testid="pure-uncall">← Uncall sort</button>
                <button class="button button--small" id="pure-reset" type="button">Reset</button>
              </div>
              <p class="status" id="pure-status" aria-live="polite"><strong>Ready.</strong> Call the program forward.</p>
            </section>
          </div>
          <div class="footnote">
            <div><span>Call</span><p>Nested reversible loops sort the logical length.</p></div>
            <div><span>Remember</span><p>Trace records only which branches swapped.</p></div>
            <div><span>Uncall</span><p>Exit assertions restore the path, input order, and zero trace.</p></div>
          </div>
        </section>
      </section>

      <section class="tab-panel" id="codec-demo" role="tabpanel" aria-labelledby="codec-tab" hidden>
        <section class="lab">
          <header class="lab-intro">
            <div>
              <p class="kicker">Pure Janus · tiny codec</p>
              <h2>Write encode.<br><em>Uncall is decode.</em></h2>
            </div>
            <p>The program only adds a shift to five character codes. Janus derives the inverse execution: reverse the statements and turn every <code>+=</code> into <code>-=</code>.</p>
          </header>
          <div class="lab-grid codec-grid">
            <section class="lab-pane" aria-labelledby="codec-source-title">
              <div class="pane-head"><h3 id="codec-source-title">encode.janus · no decoder</h3><span class="tag">8 lines</span></div>
              <div class="editor">
                <div class="editor__bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="editor__file">encode.janus</span></div>
                <textarea class="source-editor codec-source" id="codec-source" aria-label="Pure Janus encoder source" spellcheck="false">${escapeHtml(PURE_CODEC_SOURCE)}</textarea>
              </div>
              <p class="codec-inverse"><strong>Derived backward:</strong><br>message[4] -= shift<br>…<br>message[0] -= shift</p>
            </section>
            <section class="lab-pane" aria-labelledby="codec-state-title">
              <div class="pane-head"><h3 id="codec-state-title">Message state</h3><span class="tag" id="codec-phase">plain</span></div>
              <div class="proof">
                <div class="equation">uncall(encode, <span>call(encode, message)</span>) = message</div>
                <p>There is no decoder procedure. The real evaluator executes encode backward.</p>
              </div>
              <div class="codec-inputs">
                <label class="field"><span id="codec-message-label">5-character message</span><input class="text-input" id="codec-input" value="HELLO" maxlength="5" aria-label="Message"></label>
                <label class="field"><span id="codec-shift-label">shift</span><input class="text-input" id="codec-shift" type="number" value="3" aria-label="Shift"></label>
              </div>
              <p class="codec-word" id="codec-word">HELLO</p>
              <ol class="codec-codes" id="codec-codes">
                <li data-codec-char="0"><strong>H</strong><code>72</code></li>
                <li data-codec-char="1"><strong>E</strong><code>69</code></li>
                <li data-codec-char="2"><strong>L</strong><code>76</code></li>
                <li data-codec-char="3"><strong>L</strong><code>76</code></li>
                <li data-codec-char="4"><strong>O</strong><code>79</code></li>
              </ol>
              <div class="stage" aria-label="Codec execution direction">
                <div class="is-active" data-codec-stage="initial">HELLO</div>
                <div data-codec-stage="called">call encode →</div>
                <div data-codec-stage="restored">← uncall encode</div>
              </div>
              <div class="controls">
                <button class="button button--acid" id="codec-call" type="button" data-testid="codec-call">Call encode →</button>
                <button class="button button--cyan" id="codec-uncall" type="button" disabled data-testid="codec-uncall">← Uncall encode</button>
                <button class="button button--small" id="codec-reset" type="button">Reset</button>
              </div>
              <p class="status" id="codec-status" aria-live="polite"><strong>Ready.</strong> Call encode. Then uncall the same procedure to decode.</p>
            </section>
          </div>
        </section>
      </section>

      <section class="tab-panel" id="tree-demo" role="tabpanel" aria-labelledby="tree-tab" hidden>
        <section class="lab">
          <header class="lab-intro">
            <div>
              <p class="kicker">Pure Janus · tree path codec</p>
              <h2>Climb to encode.<br><em>Descend to restore.</em></h2>
            </div>
            <p>A leaf becomes a route at the root. The same loop runs backward, pops each path bit, and walks the fixed tree back to the exact symbol.</p>
          </header>
          <div class="lab-grid tree-grid">
            <section class="lab-pane" aria-labelledby="tree-source-title">
              <div class="pane-head"><h3 id="tree-source-title">encode_path.janus · editable</h3><span class="tag">real loop · no decoder</span></div>
              <div class="editor">
                <div class="editor__bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="editor__file">encode_path.janus</span></div>
                <textarea class="source-editor tree-source" id="tree-source" aria-label="Pure Janus tree path encoder source" spellcheck="false">${escapeHtml(PURE_TREE_CODEC_SOURCE)}</textarea>
              </div>
              <p class="codec-inverse"><strong>Loop invariant:</strong><br><code>temp</code> returns to zero after every edge. The child identity moves into <code>path</code>, never disappears.</p>
            </section>
            <section class="lab-pane" aria-labelledby="tree-state-title">
              <div class="pane-head"><h3 id="tree-state-title">Fixed tree · reversible cursor</h3><span class="tag" id="tree-phase">initial</span></div>
              <div class="proof">
                <div class="equation">uncall(encode_path, <span>call(encode_path, <b id="tree-proof-symbol">C</b>)</span>) = <b id="tree-proof-result">C</b></div>
                <p>The leaf identity moves into a LIFO path. Uncall consumes that path from root to leaf and clears every bit.</p>
              </div>

              <div class="tree-visual">
                <svg class="tree-map" viewBox="0 0 660 380" role="img" aria-label="A fixed binary prefix tree with leaves A, B, C, and D">
                  <line class="tree-edge" data-tree-edge="1" x1="300" y1="52" x2="92" y2="130"></line>
                  <text class="tree-edge-label" data-tree-edge-label="1" x="187" y="82">0</text>
                  <line class="tree-edge" data-tree-edge="2" x1="300" y1="52" x2="405" y2="130"></line>
                  <text class="tree-edge-label" data-tree-edge-label="2" x="365" y="82">1</text>
                  <line class="tree-edge" data-tree-edge="3" x1="405" y1="130" x2="280" y2="230"></line>
                  <text class="tree-edge-label" data-tree-edge-label="3" x="329" y="175">0</text>
                  <line class="tree-edge" data-tree-edge="4" x1="405" y1="130" x2="510" y2="230"></line>
                  <text class="tree-edge-label" data-tree-edge-label="4" x="470" y="175">1</text>
                  <line class="tree-edge" data-tree-edge="5" x1="510" y1="230" x2="435" y2="330"></line>
                  <text class="tree-edge-label" data-tree-edge-label="5" x="457" y="278">0</text>
                  <line class="tree-edge" data-tree-edge="6" x1="510" y1="230" x2="590" y2="330"></line>
                  <text class="tree-edge-label" data-tree-edge-label="6" x="563" y="278">1</text>

                  <g class="tree-node" data-tree-node="0" transform="translate(300 52)"><circle r="32"></circle><text y="-2">ROOT</text><text class="tree-node-id" y="18">node 0</text></g>
                  <g class="tree-node" data-tree-node="1" transform="translate(92 130)"><circle r="30"></circle><text y="-2">A</text><text class="tree-node-id" y="17">node 1</text></g>
                  <g class="tree-node" data-tree-node="2" transform="translate(405 130)"><circle r="25"></circle><text>●</text></g>
                  <g class="tree-node" data-tree-node="3" transform="translate(280 230)"><circle r="30"></circle><text y="-2">B</text><text class="tree-node-id" y="17">node 3</text></g>
                  <g class="tree-node" data-tree-node="4" transform="translate(510 230)"><circle r="25"></circle><text>●</text></g>
                  <g class="tree-node" data-tree-node="5" transform="translate(435 330)"><circle r="30"></circle><text y="-2">C</text><text class="tree-node-id" y="17">node 5</text></g>
                  <g class="tree-node" data-tree-node="6" transform="translate(590 330)"><circle r="30"></circle><text y="-2">D</text><text class="tree-node-id" y="17">node 6</text></g>
                </svg>
                <div class="leaf-picker" aria-label="Select a leaf symbol">
                  <button class="leaf-choice" type="button" data-tree-leaf="1">A<span>route 0</span></button>
                  <button class="leaf-choice" type="button" data-tree-leaf="3">B<span>route 10</span></button>
                  <button class="leaf-choice is-selected" type="button" data-tree-leaf="5">C<span>route 110</span></button>
                  <button class="leaf-choice" type="button" data-tree-leaf="6">D<span>route 111</span></button>
                </div>
              </div>

              <div class="tree-state" aria-label="Tree codec registers">
                <div class="tree-register"><span>node</span><strong id="tree-node-value">5 · C</strong></div>
                <div class="tree-register"><span>depth</span><strong id="tree-depth-value">0</strong></div>
                <div class="tree-register is-clean" id="tree-temp-register"><span>temp · scratch</span><strong id="tree-temp-value">0 · clean</strong></div>
              </div>
              <div class="path-display">
                <div>
                  <div class="array-label"><h3>path[3]</h3><span class="tag">bottom → top · pop right to left</span></div>
                  <ol class="path-stack">
                    <li class="path-slot" data-tree-path="0"><code>path[0]</code><button class="path-bit" type="button" data-tree-path-bit="0" disabled aria-label="Path bit 0">·</button></li>
                    <li class="path-slot" data-tree-path="1"><code>path[1]</code><button class="path-bit" type="button" data-tree-path-bit="1" disabled aria-label="Path bit 1">·</button></li>
                    <li class="path-slot" data-tree-path="2"><code>path[2]</code><button class="path-bit" type="button" data-tree-path-bit="2" disabled aria-label="Path bit 2">·</button></li>
                  </ol>
                </div>
                <div class="route-output"><span>root → leaf</span><strong id="tree-route">—</strong></div>
              </div>
              <div class="stage" aria-label="Tree codec execution direction">
                <div class="is-active" data-tree-stage="initial">leaf selected</div>
                <div data-tree-stage="called">call · climb ↑</div>
                <div data-tree-stage="restored">uncall · descend ↓</div>
              </div>
              <div class="controls">
                <button class="button button--acid" id="tree-call" type="button" data-testid="tree-call">Call encode_path ↑</button>
                <button class="button button--cyan" id="tree-uncall" type="button" disabled data-testid="tree-uncall">↓ Uncall encode_path</button>
                <button class="button button--small" id="tree-reset" type="button">Reset</button>
              </div>
              <p class="status" id="tree-status" aria-live="polite"><strong>Ready.</strong> Choose a leaf, then call the loop to encode its route.</p>
            </section>
          </div>
          <div class="footnote">
            <div><span>Call · push</span><p>Each loop reads left/right, pushes one bit, and moves the cursor to its parent.</p></div>
            <div><span>Keep clean</span><p>The fixed tree reconstructs the old child, allowing scratch <code>temp</code> to return to zero.</p></div>
            <div><span>Uncall · pop</span><p>Bits are consumed from the stack to choose children until the exact leaf returns.</p></div>
          </div>
        </section>
      </section>

      <footer><span>Pure Janus parser · checker · evaluator</span><span>No generated inverse program. The same AST runs backward.</span></footer>
    </main>
    <script src="/app.js" defer></script>
  </body>
</html>`;
