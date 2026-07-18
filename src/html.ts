import { BASE_DEMO_SOURCE } from "./demo/source";
import { PURE_SORT_SOURCE } from "./demo/pure-sort";

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
    <meta name="description" content="UNCALL turns one forward procedure into a durable, inspectable reversal plan.">
    <title>UNCALL — Don't generate rollback. Derive it.</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #0b0d0c;
        --panel: #121513;
        --panel-2: #171b18;
        --ink: #f4f1e8;
        --muted: #929991;
        --dim: #626861;
        --line: #2b302c;
        --acid: #d7ff64;
        --acid-ink: #151b08;
        --cyan: #76ddff;
        --orange: #ffb45d;
        --red: #ff7168;
        --green: #8ee5a1;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-synthesis: none;
      }
      * { box-sizing: border-box; }
      html { scroll-behavior: smooth; }
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
      button, textarea { font: inherit; }
      button { border-radius: 0; }
      .shell { position: relative; width: min(1320px, calc(100% - 44px)); margin: 0 auto; padding: 28px 0 54px; }
      .topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 76px; }
      .brand { font: 800 14px/1 ui-monospace, monospace; letter-spacing: .18em; }
      .mock-badge { border: 1px solid var(--line); padding: 8px 11px; color: var(--muted); font: 10px/1 ui-monospace, monospace; letter-spacing: .08em; text-transform: uppercase; }
      .hero { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(300px, .65fr); gap: 50px; align-items: end; margin-bottom: 62px; }
      .kicker { margin: 0 0 18px; color: var(--acid); font: 700 12px/1.4 ui-monospace, monospace; letter-spacing: .14em; text-transform: uppercase; }
      h1 { max-width: 900px; margin: 0; font-size: clamp(49px, 7.3vw, 104px); line-height: .93; letter-spacing: -.065em; }
      h1 em { color: var(--acid); font-style: normal; }
      .lede { margin: 0; color: var(--muted); font-size: 17px; line-height: 1.7; }
      .lede strong { color: var(--ink); font-weight: 650; }
      .demo-switch { display: inline-flex; margin-bottom: 18px; border: 1px solid var(--line); background: var(--panel); }
      .demo-tab { min-height: 45px; border: 0; border-right: 1px solid var(--line); padding: 0 18px; cursor: pointer; background: transparent; color: var(--muted); font: 700 11px/1 ui-monospace, monospace; }
      .demo-tab:last-child { border-right: 0; }
      .demo-tab[aria-selected="true"] { background: var(--acid); color: var(--acid-ink); }
      .demo-tab:focus-visible { outline: 2px solid var(--cyan); outline-offset: 2px; }
      .tab-panel[hidden] { display: none; }
      .storyline { display: grid; grid-template-columns: repeat(4, 1fr); border: 1px solid var(--line); background: rgba(18,21,19,.76); margin-bottom: 20px; }
      .story-step { position: relative; min-height: 105px; padding: 20px; border-right: 1px solid var(--line); }
      .story-step:last-child { border-right: 0; }
      .story-step::after { content: ""; position: absolute; inset: auto 0 -1px; height: 2px; background: transparent; }
      .story-step.is-active::after { background: var(--acid); }
      .story-step.is-done::after { background: var(--green); }
      .story-step__number { display: block; margin-bottom: 18px; color: var(--dim); font: 11px/1 ui-monospace, monospace; }
      .story-step strong { display: block; margin-bottom: 5px; font-size: 13px; }
      .story-step span:last-child { color: var(--muted); font-size: 11px; }
      .workspace { border: 1px solid var(--line); background: var(--panel); box-shadow: 0 30px 100px rgba(0,0,0,.32); }
      .workspace-head { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 17px 20px; border-bottom: 1px solid var(--line); }
      .workspace-head__title { display: flex; gap: 12px; align-items: center; }
      .workspace-head h2 { margin: 0; font-size: 13px; }
      .tag { color: var(--dim); font: 10px/1 ui-monospace, monospace; text-transform: uppercase; letter-spacing: .09em; }
      .authoring-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(340px, .86fr); }
      .pane { min-width: 0; padding: 22px; }
      .pane + .pane { border-left: 1px solid var(--line); }
      .pane-head { display: flex; justify-content: space-between; align-items: center; gap: 14px; margin-bottom: 14px; }
      .pane-title { margin: 0; font-size: 12px; }
      .editor { border: 1px solid var(--line); background: #090b0a; }
      .editor__bar { display: flex; align-items: center; gap: 6px; padding: 10px 13px; border-bottom: 1px solid var(--line); }
      .dot { width: 7px; height: 7px; border-radius: 50%; background: #343935; }
      .editor__file { margin-left: 5px; color: var(--dim); font: 10px/1 ui-monospace, monospace; }
      .source-editor { display: block; width: 100%; min-height: 244px; margin: 0; border: 0; padding: 20px; resize: vertical; outline: 0; background: transparent; color: #d9dfd8; font: 13px/1.82 "SFMono-Regular", Consolas, monospace; tab-size: 4; }
      .source-editor:focus { box-shadow: inset 0 0 0 1px var(--acid); }
      .source-editor:disabled { color: #9ba099; }
      .diagnostic { min-height: 18px; margin: 10px 0 0; color: var(--muted); font: 10px/1.6 ui-monospace, monospace; }
      .diagnostic.is-error { color: var(--red); }
      .ai-action { display: flex; justify-content: space-between; gap: 16px; align-items: center; margin-top: 16px; border: 1px solid rgba(215,255,100,.34); background: rgba(215,255,100,.045); padding: 14px; }
      .ai-action p { margin: 0; color: var(--muted); font-size: 11px; line-height: 1.5; }
      .ai-action code { color: var(--acid); }
      .button { min-height: 42px; border: 1px solid var(--line); padding: 0 16px; cursor: pointer; background: transparent; color: var(--ink); font-size: 11px; font-weight: 750; letter-spacing: .01em; }
      .button:hover:not(:disabled) { border-color: #626b63; }
      .button:disabled { cursor: not-allowed; opacity: .3; }
      .button--acid { border-color: var(--acid); background: var(--acid); color: var(--acid-ink); }
      .button--cyan { border-color: var(--cyan); color: var(--cyan); }
      .button--danger { border-color: rgba(255,113,104,.45); color: var(--red); }
      .button--small { min-height: 35px; padding: 0 12px; font-size: 10px; white-space: nowrap; }
      .plan { min-height: 244px; margin: 0; padding: 6px 0; border: 1px solid var(--line); background: #090b0a; list-style: none; counter-reset: plan; }
      .plan-item { counter-increment: plan; display: grid; grid-template-columns: 25px minmax(0,1fr) auto; gap: 9px; align-items: center; min-height: 37px; padding: 5px 13px; border-left: 2px solid transparent; }
      .plan-item::before { content: counter(plan, decimal-leading-zero); color: #4e544f; font: 9px/1 ui-monospace, monospace; }
      .plan-item code { overflow: hidden; color: #d9dfd8; font: 11px/1.3 ui-monospace, monospace; text-overflow: ellipsis; white-space: nowrap; }
      .plan-item__receipt { color: var(--dim); font: 9px/1 ui-monospace, monospace; }
      .plan-item--cache { border-left-color: var(--acid); background: rgba(215,255,100,.055); }
      .plan-item--cache code { color: var(--acid); }
      .plan-empty { padding: 30px 18px; color: var(--dim); font-size: 11px; line-height: 1.6; text-align: center; }
      .derivation-note { display: flex; align-items: center; gap: 9px; margin-top: 14px; color: var(--muted); font-size: 10px; line-height: 1.5; }
      .derivation-note::before { content: "↳"; color: var(--cyan); font: 16px/1 ui-monospace, monospace; }
      .handoff { border-top: 1px solid var(--line); }
      .control-strip { display: flex; flex-wrap: wrap; gap: 9px; padding: 18px 20px; border-bottom: 1px solid var(--line); background: var(--panel-2); }
      .control-strip .spacer { flex: 1; }
      .status-line { margin: 0; padding: 12px 20px; border-bottom: 1px solid var(--line); color: var(--muted); font: 10px/1.55 ui-monospace, monospace; }
      .status-line strong { color: var(--ink); }
      .process-grid { display: grid; grid-template-columns: minmax(0, .8fr) 90px minmax(0, 1.2fr); align-items: stretch; padding: 22px; }
      .process-card { border: 1px solid var(--line); background: #0e110f; padding: 18px; }
      .process-card.is-active { border-color: rgba(118,221,255,.5); box-shadow: inset 0 0 0 1px rgba(118,221,255,.08); }
      .process-card__head { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 18px; }
      .process-card h3 { margin: 0; font-size: 12px; }
      .process-state { color: var(--dim); font: 9px/1 ui-monospace, monospace; text-transform: uppercase; }
      .process-state.is-live { color: var(--green); }
      .process-state.is-active { color: var(--cyan); }
      .process-copy { min-height: 34px; margin: 0; color: var(--muted); font-size: 11px; line-height: 1.55; }
      .handoff-arrow { display: grid; place-items: center; color: var(--cyan); font: 24px/1 ui-monospace, monospace; }
      .handoff-arrow span { display: block; transform: translateY(-8px); }
      .record { margin-top: 16px; border-top: 1px solid var(--line); padding-top: 14px; }
      .record-grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 11px; }
      .record-field span { display: block; margin-bottom: 5px; color: var(--dim); font: 8px/1 ui-monospace, monospace; text-transform: uppercase; letter-spacing: .08em; }
      .record-field code { display: block; overflow: hidden; color: var(--ink); font: 9px/1.3 ui-monospace, monospace; text-overflow: ellipsis; white-space: nowrap; }
      .blocked { margin: 0 22px 22px; border: 1px solid rgba(255,113,104,.55); background: rgba(255,113,104,.06); padding: 17px; }
      .blocked__title { display: flex; gap: 10px; align-items: center; margin: 0 0 11px; color: var(--red); font-size: 12px; }
      .blocked pre { margin: 0; color: #e7c4c0; font: 10px/1.65 ui-monospace, monospace; white-space: pre-wrap; }
      .state-grid { display: grid; grid-template-columns: minmax(0,.92fr) minmax(0,1.08fr); border-top: 1px solid var(--line); }
      .state-pane { min-width: 0; padding: 22px; }
      .state-pane + .state-pane { border-left: 1px solid var(--line); }
      .section-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 14px; }
      .section-head h3 { margin: 0; font-size: 12px; }
      .count { color: var(--acid); font: 700 22px/1 ui-monospace, monospace; }
      .resources { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 7px; margin: 0; padding: 0; list-style: none; }
      .resource { min-width: 0; border: 1px solid var(--line); background: #0e110f; padding: 11px; }
      .resource__top { display: flex; align-items: center; gap: 7px; margin-bottom: 8px; }
      .resource__dot { width: 6px; height: 6px; background: var(--green); box-shadow: 0 0 8px rgba(142,229,161,.5); }
      .resource strong { overflow: hidden; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
      .resource code { display: block; overflow: hidden; color: var(--dim); font: 8px/1.5 ui-monospace, monospace; text-overflow: ellipsis; white-space: nowrap; }
      .empty { margin: 0; border: 1px dashed var(--line); padding: 26px 16px; color: var(--dim); font-size: 10px; text-align: center; }
      .logs { max-height: 286px; overflow: auto; margin: 0; padding: 0; list-style: none; border: 1px solid var(--line); background: #0b0d0c; }
      .log { display: grid; grid-template-columns: 24px 57px minmax(0,1fr) auto; gap: 8px; align-items: center; min-height: 30px; padding: 5px 10px; border-bottom: 1px solid rgba(43,48,44,.55); font-size: 9px; }
      .log:last-child { border-bottom: 0; }
      .log--started { opacity: .48; }
      .log--failed { background: rgba(255,113,104,.07); }
      .log__seq { color: var(--dim); font: 8px/1 ui-monospace, monospace; }
      .log__process { color: var(--cyan); font: 8px/1 ui-monospace, monospace; }
      .log code { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .log__result { overflow: hidden; max-width: 130px; color: var(--dim); text-overflow: ellipsis; white-space: nowrap; }
      .log--succeeded .log__result { color: var(--green); }
      .log--failed .log__result { color: var(--red); }
      .principle { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; margin-top: 20px; border: 1px solid var(--line); background: var(--line); }
      .principle div { background: var(--panel); padding: 22px; }
      .principle span { display: block; margin-bottom: 9px; color: var(--dim); font: 9px/1 ui-monospace, monospace; text-transform: uppercase; }
      .principle p { margin: 0; font-size: 13px; line-height: 1.55; }
      .pure-lab { border: 1px solid var(--line); background: var(--panel); box-shadow: 0 30px 100px rgba(0,0,0,.32); }
      .pure-intro { display: grid; grid-template-columns: minmax(0,1.25fr) minmax(280px,.75fr); gap: 34px; align-items: end; padding: 34px; border-bottom: 1px solid var(--line); }
      .pure-intro .kicker { margin-bottom: 12px; }
      .pure-intro h2 { max-width: 780px; margin: 0; font-size: clamp(32px, 4.7vw, 64px); line-height: 1; letter-spacing: -.045em; }
      .pure-intro h2 em { color: var(--cyan); font-style: normal; }
      .pure-intro p:last-child { margin: 0; color: var(--muted); font-size: 13px; line-height: 1.7; }
      .pure-grid { display: grid; grid-template-columns: minmax(0,1fr) minmax(390px,.95fr); }
      .pure-pane { min-width: 0; padding: 25px; }
      .pure-pane + .pure-pane { border-left: 1px solid var(--line); }
      .pure-source { min-height: 690px; font-size: 11px; line-height: 1.65; }
      .pure-proof { border: 1px solid rgba(118,221,255,.36); background: rgba(118,221,255,.04); padding: 18px; }
      .pure-proof__equation { display: flex; flex-wrap: wrap; align-items: center; gap: 9px; margin-bottom: 14px; font: 750 13px/1.4 ui-monospace, monospace; }
      .pure-proof__equation span { color: var(--cyan); }
      .pure-proof p { margin: 0; color: var(--muted); font-size: 11px; line-height: 1.6; }
      .array-label { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin: 24px 0 10px; }
      .array-label h3 { margin: 0; font-size: 11px; }
      .value-array { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 8px; }
      .value-cell { min-width: 0; height: 78px; border: 1px solid var(--line); background: #0b0d0c; color: var(--ink); text-align: center; font: 750 27px/1 ui-monospace, monospace; -moz-appearance: textfield; }
      .value-cell::-webkit-inner-spin-button { appearance: none; }
      .value-cell:focus { outline: 1px solid var(--acid); }
      .value-cell:disabled { opacity: 1; border-color: rgba(118,221,255,.35); color: var(--cyan); }
      .trace-list { display: grid; grid-template-columns: repeat(5, minmax(0,1fr)); gap: 6px; margin: 0; padding: 0; list-style: none; }
      .trace-bit { min-width: 0; border: 1px solid var(--line); background: #0b0d0c; padding: 10px 6px; text-align: center; }
      .trace-bit code { display: block; margin-bottom: 9px; color: var(--dim); font: 8px/1 ui-monospace, monospace; white-space: nowrap; }
      .trace-bit strong { display: block; font: 750 21px/1 ui-monospace, monospace; }
      .trace-bit span { display: block; margin-top: 7px; color: var(--dim); font: 7px/1 ui-monospace, monospace; text-transform: uppercase; }
      .trace-bit--swap { border-color: var(--acid); background: rgba(215,255,100,.06); }
      .trace-bit--swap strong, .trace-bit--swap span { color: var(--acid); }
      .trace-bit--keep { border-color: rgba(118,221,255,.3); }
      .trace-bit--keep strong { color: var(--cyan); }
      .pure-controls { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
      .pure-status { min-height: 66px; margin: 14px 0 0; border-left: 2px solid var(--cyan); padding: 10px 12px; color: var(--muted); font: 10px/1.6 ui-monospace, monospace; }
      .pure-status strong { color: var(--ink); }
      .pure-status.is-verified { border-left-color: var(--green); }
      .pure-status.is-error { border-left-color: var(--red); color: var(--red); }
      .pure-stage { display: grid; grid-template-columns: repeat(3,1fr); margin-top: 18px; border: 1px solid var(--line); }
      .pure-stage div { padding: 10px; border-right: 1px solid var(--line); color: var(--dim); font: 8px/1.3 ui-monospace, monospace; text-align: center; text-transform: uppercase; }
      .pure-stage div:last-child { border-right: 0; }
      .pure-stage .is-active { background: rgba(118,221,255,.06); color: var(--cyan); }
      .pure-stage .is-done { color: var(--green); }
      .pure-footnote { display: grid; grid-template-columns: repeat(3,1fr); border-top: 1px solid var(--line); }
      .pure-footnote div { padding: 20px 24px; border-right: 1px solid var(--line); }
      .pure-footnote div:last-child { border-right: 0; }
      .pure-footnote span { display: block; margin-bottom: 7px; color: var(--dim); font: 8px/1 ui-monospace, monospace; text-transform: uppercase; }
      .pure-footnote p { margin: 0; color: var(--muted); font-size: 10px; line-height: 1.55; }
      footer { display: flex; justify-content: space-between; gap: 18px; padding: 22px 2px 0; color: var(--dim); font: 9px/1.5 ui-monospace, monospace; }
      [hidden] { display: none !important; }
      @media (max-width: 900px) {
        .shell { width: min(100% - 24px, 720px); }
        .topbar { margin-bottom: 48px; }
        .hero, .authoring-grid, .state-grid, .pure-intro, .pure-grid { grid-template-columns: 1fr; }
        .pane + .pane, .state-pane + .state-pane { border-left: 0; border-top: 1px solid var(--line); }
        .pure-pane + .pure-pane { order: -1; border-left: 0; border-top: 0; }
        .pure-pane:first-child { border-top: 1px solid var(--line); }
        .story-step { padding: 15px; }
        .process-grid { grid-template-columns: 1fr; gap: 10px; }
        .handoff-arrow { height: 34px; transform: rotate(90deg); }
      }
      @media (max-width: 600px) {
        .shell { padding-top: 18px; }
        .topbar { margin-bottom: 38px; }
        .hero { gap: 24px; margin-bottom: 38px; }
        .storyline { grid-template-columns: 1fr 1fr; }
        .story-step:nth-child(2) { border-right: 0; }
        .story-step:nth-child(-n+2) { border-bottom: 1px solid var(--line); }
        .ai-action { align-items: stretch; flex-direction: column; }
        .control-strip .button { flex: 1 1 145px; }
        .control-strip .spacer { display: none; }
        .resources { grid-template-columns: 1fr 1fr; }
        .principle { grid-template-columns: 1fr; }
        .demo-switch { display: flex; }
        .demo-tab { flex: 1; padding: 0 10px; }
        .pure-intro { padding: 24px 20px; }
        .pure-pane { padding: 20px; }
        .pure-source { min-height: 610px; }
        .pure-footnote { grid-template-columns: 1fr; }
        .pure-footnote div { border-right: 0; border-bottom: 1px solid var(--line); }
        .pure-footnote div:last-child { border-bottom: 0; }
        footer { display: block; }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <nav class="topbar" aria-label="Product">
        <span class="brand">UN/CALL</span>
        <span class="mock-badge">Real evaluators · mock cloud resources</span>
      </nav>

      <header class="hero">
        <div>
          <p class="kicker">Reversible-by-construction workflows</p>
          <h1>AI writes the change.<br><em>UNCALL derives the way back.</em></h1>
        </div>
        <p class="lede">Add one trusted operation to the forward procedure. The inverse plan, every partial-failure rollback, and the receipt handoff update <strong>without a second cleanup workflow.</strong></p>
      </header>

      <div class="demo-switch" role="tablist" aria-label="UNCALL demos">
        <button class="demo-tab" id="preview-tab" type="button" role="tab" aria-selected="true" aria-controls="preview-demo" data-testid="preview-tab">Preview Environment</button>
        <button class="demo-tab" id="pure-tab" type="button" role="tab" aria-selected="false" aria-controls="pure-demo" data-testid="pure-tab">Pure Janus Lab</button>
      </div>

      <section class="tab-panel" id="preview-demo" role="tabpanel" aria-labelledby="preview-tab">

      <section class="storyline" aria-label="Demo story">
        <div class="story-step is-active" data-story-step="author"><span class="story-step__number">01</span><strong>AI changes one line</strong><span>No rollback code generated</span></div>
        <div class="story-step" data-story-step="open"><span class="story-step__number">02</span><strong>PR opens</strong><span>Runtime A ends; preview stays</span></div>
        <div class="story-step" data-story-step="merge"><span class="story-step__number">03</span><strong>PR merges later</strong><span>Runtime B loads the record</span></div>
        <div class="story-step" data-story-step="uncall"><span class="story-step__number">04</span><strong>UNCALL</strong><span>Checked reverse execution</span></div>
      </section>

      <section class="workspace">
        <div class="workspace-head">
          <div class="workspace-head__title"><h2>1 · Review the application change</h2><span class="tag">trusted primitive catalog</span></div>
          <span class="tag" id="plan-hash">plan / not compiled</span>
        </div>

        <div class="authoring-grid">
          <section class="pane" aria-labelledby="source-title">
            <div class="pane-head"><h3 class="pane-title" id="source-title">Forward procedure · application diff</h3><span class="tag">author-owned</span></div>
            <div class="editor">
              <div class="editor__bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="editor__file">preview.janus</span></div>
              <textarea class="source-editor" id="source" aria-label="Editable Janus source" spellcheck="false">${escapeHtml(BASE_DEMO_SOURCE)}</textarea>
            </div>
            <p class="diagnostic" id="source-diagnostic" aria-live="polite">Valid procedure · 5 trusted effects</p>
            <div class="ai-action">
              <p><span class="tag">Prompt</span><br>Add a preview cache before seed data.</p>
              <button class="button button--acid button--small" id="ai-change" type="button" data-testid="ai-change">Ask AI · apply +1 line</button>
            </div>
          </section>

          <section class="pane" aria-labelledby="inverse-title">
            <div class="pane-head"><h3 class="pane-title" id="inverse-title">Inverse plan · derived live</h3><span class="tag">runtime-owned</span></div>
            <ol class="plan" id="inverse-plan" aria-live="polite"></ol>
            <p class="derivation-note">Reverse order + trusted backward handlers. This panel is not editable application code.</p>
          </section>
        </div>

        <section class="handoff" aria-labelledby="handoff-title">
          <div class="workspace-head">
            <div class="workspace-head__title"><h2 id="handoff-title">2 · Carry undo intent across time and process</h2><span class="tag">durable execution</span></div>
          </div>
          <div class="control-strip">
            <button class="button button--acid" id="open-pr" type="button" data-testid="open-pr">Open PR #418 →</button>
            <button class="button button--danger" id="drift" type="button" disabled data-testid="drift">Simulate DB drift</button>
            <button class="button button--cyan" id="resume" type="button" disabled data-testid="resume">PR merged · start Runtime B</button>
            <button class="button" id="uncall" type="button" disabled data-testid="uncall">UNCALL preview</button>
            <span class="spacer"></span>
            <button class="button button--small" id="fail-proof" type="button">Test partial failure</button>
            <button class="button button--small" id="reset" type="button">Reset demo</button>
          </div>
          <p class="status-line" id="runtime-status" aria-live="polite"><strong>Ready.</strong> Apply the cache change, then open the mock PR.</p>

          <div class="process-grid">
            <article class="process-card" id="runtime-a-card">
              <div class="process-card__head"><h3>Runtime A · PR opened</h3><span class="process-state" id="runtime-a-state">waiting</span></div>
              <p class="process-copy" id="runtime-a-copy">Compiles the forward procedure and creates the preview environment.</p>
            </article>
            <div class="handoff-arrow" aria-hidden="true"><span>→</span></div>
            <article class="process-card" id="runtime-b-card">
              <div class="process-card__head"><h3>Runtime B · PR merged</h3><span class="process-state" id="runtime-b-state">not started</span></div>
              <p class="process-copy" id="runtime-b-copy">A later event will load the serialized receipt stack and inspect the inverse plan before execution.</p>
              <div class="record" id="execution-record" hidden>
                <div class="record-grid">
                  <div class="record-field"><span>execution</span><code id="execution-id">—</code></div>
                  <div class="record-field"><span>plan hash</span><code id="record-plan-hash">—</code></div>
                  <div class="record-field"><span>receipts left</span><code id="receipt-count">0</code></div>
                </div>
              </div>
            </article>
          </div>

          <aside class="blocked" id="blocked-panel" hidden>
            <h3 class="blocked__title">◆ Checked reversal stopped safely</h3>
            <pre id="blocked-detail"></pre>
          </aside>
        </section>

        <div class="state-grid">
          <section class="state-pane" aria-labelledby="resources-title">
            <div class="section-head"><h3 id="resources-title">Mock cloud resources</h3><div><span class="count" id="resource-count">0</span> <span class="tag">live</span></div></div>
            <p class="empty" id="resources-empty">No resources. Runtime A has not run.</p>
            <ul class="resources" id="resources"></ul>
          </section>
          <section class="state-pane" aria-labelledby="audit-title">
            <div class="section-head"><h3 id="audit-title">Audit trail</h3><span class="tag">operation · receipt</span></div>
            <p class="empty" id="log-empty">Forward and backward events will appear here.</p>
            <ol class="logs" id="execution-log"></ol>
          </section>
        </div>
      </section>

      <aside class="principle">
        <div><span>using / with</span><p>Closes what the current scope owns when that scope exits.</p></div>
        <div><span>UNCALL</span><p>Turns what a previous event did into a durable, inspectable undo plan.</p></div>
      </aside>
      </section>

      <section class="tab-panel" id="pure-demo" role="tabpanel" aria-labelledby="pure-tab" hidden>
        <section class="pure-lab">
          <header class="pure-intro">
            <div>
              <p class="kicker">Pure Janus · actual evaluator</p>
              <h2>Sorting destroys order.<br><em>Trace makes it reversible.</em></h2>
            </div>
            <p>A normal sort forgets where each value came from. This program records only five branch decisions, then uses the exit assertions to choose the correct path backward.</p>
          </header>

          <div class="pure-grid">
            <section class="pure-pane" aria-labelledby="pure-source-title">
              <div class="pane-head"><h3 class="pane-title" id="pure-source-title">sort4.janus · editable source</h3><span class="tag">parser → checker → evaluator</span></div>
              <div class="editor">
                <div class="editor__bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="editor__file">pure/sort4.janus</span></div>
                <textarea class="source-editor pure-source" id="pure-source" aria-label="Pure Janus sort source" spellcheck="false">${escapeHtml(PURE_SORT_SOURCE)}</textarea>
              </div>
            </section>

            <section class="pure-pane" aria-labelledby="machine-title">
              <div class="pane-head"><h3 class="pane-title" id="machine-title">Reversible machine state</h3><span class="tag" id="pure-phase">initial</span></div>
              <div class="pure-proof">
                <div class="pure-proof__equation">uncall(sort4, <span>call(sort4, state)</span>) = state</div>
                <p>This is Pure Janus computation: no receipts and no compensating cloud handler. The evaluator reverses updates, swaps, statement order, and control flow.</p>
              </div>

              <div class="array-label"><h3>values[4]</h3><span class="tag">edit the initial state</span></div>
              <div class="value-array" id="pure-values">
                <input class="value-cell" type="number" value="4" aria-label="Value 1" data-pure-value="0">
                <input class="value-cell" type="number" value="1" aria-label="Value 2" data-pure-value="1">
                <input class="value-cell" type="number" value="3" aria-label="Value 3" data-pure-value="2">
                <input class="value-cell" type="number" value="2" aria-label="Value 4" data-pure-value="3">
              </div>

              <div class="array-label"><h3>trace[5]</h3><span class="tag">branch history</span></div>
              <ol class="trace-list" id="pure-trace">
                <li class="trace-bit" data-pure-trace="0"><code>v0↔v1</code><strong>0</strong><span>empty</span></li>
                <li class="trace-bit" data-pure-trace="1"><code>v2↔v3</code><strong>0</strong><span>empty</span></li>
                <li class="trace-bit" data-pure-trace="2"><code>v0↔v2</code><strong>0</strong><span>empty</span></li>
                <li class="trace-bit" data-pure-trace="3"><code>v1↔v3</code><strong>0</strong><span>empty</span></li>
                <li class="trace-bit" data-pure-trace="4"><code>v1↔v2</code><strong>0</strong><span>empty</span></li>
              </ol>

              <div class="pure-stage" aria-label="Execution direction">
                <div class="is-active" data-pure-stage="initial">initial</div>
                <div data-pure-stage="called">call sort4 →</div>
                <div data-pure-stage="restored">← uncall sort4</div>
              </div>
              <div class="pure-controls">
                <button class="button button--acid" id="pure-call" type="button" data-testid="pure-call">Call sort4 →</button>
                <button class="button button--cyan" id="pure-uncall" type="button" disabled data-testid="pure-uncall">← Uncall sort4</button>
                <button class="button button--small" id="pure-reset" type="button">Reset [4,1,3,2]</button>
              </div>
              <p class="pure-status" id="pure-status" aria-live="polite"><strong>Ready.</strong> Call the real Pure Janus evaluator with the state above.</p>
            </section>
          </div>

          <div class="pure-footnote">
            <div><span>Forward</span><p>Five compare-and-swaps sort four values through a fixed sorting network.</p></div>
            <div><span>Information discipline</span><p>Each trace bit records whether its conditional swapped or kept the pair.</p></div>
            <div><span>Backward</span><p>Exit assertions read the trace, restore the branch, undo the swap, then zero the trace.</p></div>
          </div>
        </section>
      </section>
      <footer><span>Pure Janus evaluator + Phase 2 host runtime</span><span>Exact reversal for pure state · checked compensation for external effects.</span></footer>
    </main>
    <script src="/app.js" defer></script>
  </body>
</html>`;
