import { DEMO_SOURCE } from "./demo/source";

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
    <meta name="description" content="UNCALL demonstrates forward effects and automatic reverse-order cleanup.">
    <title>UNCALL — reversible effects, made visible</title>
    <style>
      :root {
        color-scheme: dark;
        --ink: #f5f1e8;
        --muted: #a7aca8;
        --line: #2a302f;
        --panel: #151a19;
        --panel-soft: #1b211f;
        --lime: #c9f47c;
        --amber: #ffbf69;
        --blue: #7dcfff;
        --red: #ff7b72;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-synthesis: none;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-width: 320px;
        min-height: 100vh;
        background:
          linear-gradient(rgba(201, 244, 124, .035) 1px, transparent 1px),
          linear-gradient(90deg, rgba(201, 244, 124, .035) 1px, transparent 1px),
          #0d1110;
        background-size: 40px 40px;
        color: var(--ink);
      }
      body::before {
        content: "";
        position: fixed;
        inset: 0 0 auto;
        height: 3px;
        background: linear-gradient(90deg, var(--lime), var(--blue), var(--amber));
      }
      button, input { font: inherit; }
      .shell { width: min(1180px, calc(100% - 40px)); margin: 0 auto; padding: 58px 0 48px; }
      header { display: grid; grid-template-columns: 1fr auto; gap: 28px; align-items: end; margin-bottom: 34px; }
      .eyebrow { margin: 0 0 12px; color: var(--lime); font: 700 12px/1.2 ui-monospace, monospace; letter-spacing: .14em; text-transform: uppercase; }
      h1 { margin: 0; font-size: clamp(46px, 9vw, 104px); line-height: .83; letter-spacing: -.07em; }
      .lede { max-width: 480px; margin: 22px 0 0; color: var(--muted); font-size: 17px; line-height: 1.65; }
      .phase-list { display: flex; gap: 8px; align-items: center; padding-bottom: 5px; }
      .phase { border: 1px solid var(--line); border-radius: 999px; padding: 8px 11px; color: var(--muted); font: 650 11px/1 ui-monospace, monospace; }
      .phase--active { border-color: color-mix(in srgb, var(--lime), transparent 45%); color: var(--lime); background: color-mix(in srgb, var(--lime), transparent 92%); }
      .workspace { display: grid; grid-template-columns: minmax(0, 1.08fr) minmax(360px, .92fr); border: 1px solid var(--line); background: var(--panel); box-shadow: 0 24px 80px rgba(0,0,0,.32); }
      .column { min-width: 0; padding: 28px; }
      .column + .column { border-left: 1px solid var(--line); }
      .section-head { display: flex; justify-content: space-between; align-items: center; gap: 18px; margin-bottom: 18px; }
      h2 { margin: 0; font-size: 15px; letter-spacing: -.01em; }
      .caption { color: var(--muted); font: 11px/1.2 ui-monospace, monospace; text-transform: uppercase; letter-spacing: .08em; }
      .editor { overflow: auto; border: 1px solid var(--line); background: #0b0f0e; }
      .editor__bar { display: flex; align-items: center; gap: 7px; padding: 12px 14px; border-bottom: 1px solid var(--line); }
      .dot { width: 8px; height: 8px; border-radius: 50%; background: #39403e; }
      .editor__file { margin-left: 5px; color: var(--muted); font: 11px/1 ui-monospace, monospace; }
      pre { margin: 0; padding: 25px 22px 28px; color: #d9e1dd; font: 14px/1.9 "SFMono-Regular", Consolas, monospace; tab-size: 4; }
      .notice { margin: 13px 0 25px; padding-left: 12px; border-left: 2px solid var(--amber); color: var(--muted); font-size: 12px; line-height: 1.55; }
      .controls { display: flex; flex-wrap: wrap; gap: 10px; }
      .button { min-height: 44px; border: 1px solid var(--line); padding: 0 18px; cursor: pointer; font-weight: 750; }
      .button--run { border-color: var(--lime); background: var(--lime); color: #10150e; }
      .button--uncall { background: transparent; color: var(--ink); }
      .button:disabled { cursor: not-allowed; opacity: .36; }
      .toggle { display: flex; flex: 1 1 220px; align-items: center; justify-content: space-between; min-height: 44px; border: 1px solid var(--line); padding: 0 14px; color: var(--muted); font-size: 12px; }
      .toggle input { width: 17px; height: 17px; accent-color: var(--amber); }
      .runtime-status { min-height: 42px; margin: 16px 0 0; color: var(--muted); font-size: 12px; line-height: 1.55; }
      .resource-summary { display: flex; align-items: baseline; gap: 9px; }
      #resource-count { color: var(--lime); font: 700 31px/1 ui-monospace, monospace; }
      .empty { margin: 0; border: 1px dashed #343b39; padding: 28px 20px; color: #737a77; text-align: center; font-size: 13px; }
      .resources { display: grid; grid-template-columns: repeat(3, 1fr); gap: 9px; margin: 0 0 26px; padding: 0; list-style: none; }
      .resource { min-width: 0; border: 1px solid var(--line); background: var(--panel-soft); padding: 15px 12px; }
      .resource__icon { display: block; width: 21px; height: 21px; margin-bottom: 18px; border: 1px solid var(--blue); box-shadow: inset 0 0 0 4px var(--panel-soft), inset 0 0 0 9px var(--blue); }
      .resource--database .resource__icon { border-radius: 50%; border-color: var(--amber); box-shadow: inset 0 0 0 4px var(--panel-soft), inset 0 0 0 9px var(--amber); }
      .resource--application .resource__icon { transform: rotate(45deg); border-color: var(--lime); box-shadow: inset 0 0 0 4px var(--panel-soft), inset 0 0 0 9px var(--lime); }
      .resource strong, .resource code { display: block; overflow: hidden; text-overflow: ellipsis; }
      .resource strong { margin-bottom: 5px; font-size: 12px; }
      .resource code { color: var(--muted); font-size: 10px; }
      .log-wrap { position: relative; min-height: 250px; border: 1px solid var(--line); background: #0b0f0e; }
      .logs { max-height: 315px; margin: 0; padding: 8px 0; overflow: auto; list-style: none; }
      .log { display: grid; grid-template-columns: 28px minmax(130px, 1fr) minmax(90px, auto); gap: 10px; align-items: center; padding: 8px 12px; border-left: 2px solid transparent; font-size: 11px; }
      .log--backward { border-left-color: var(--blue); }
      .log--failed { border-left-color: var(--red); background: rgba(255,123,114,.06); }
      .log__sequence { color: #626966; font: 10px/1 ui-monospace, monospace; }
      .log code { color: var(--ink); overflow: hidden; text-overflow: ellipsis; }
      .log__result { color: var(--muted); overflow: hidden; text-overflow: ellipsis; text-align: right; white-space: nowrap; }
      .log--succeeded .log__result { color: var(--lime); }
      .log--failed .log__result { color: var(--red); }
      .log-wrap .empty { position: absolute; inset: 50% auto auto 50%; width: calc(100% - 40px); transform: translate(-50%, -50%); border: 0; }
      footer { display: flex; justify-content: space-between; gap: 24px; margin-top: 18px; color: #68706d; font: 11px/1.5 ui-monospace, monospace; }
      [hidden] { display: none !important; }
      @media (max-width: 860px) {
        .shell { width: min(100% - 24px, 680px); padding-top: 42px; }
        header { grid-template-columns: 1fr; }
        .workspace { grid-template-columns: 1fr; }
        .column + .column { border-left: 0; border-top: 1px solid var(--line); }
      }
      @media (max-width: 500px) {
        .column { padding: 20px; }
        .resources { grid-template-columns: 1fr; }
        .resource { display: grid; grid-template-columns: auto 1fr; gap: 14px; align-items: center; }
        .resource__icon { margin: 0; }
        footer { display: block; }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <header>
        <div>
          <p class="eyebrow">Reversible effect runtime / proof of concept</p>
          <h1>UNCALL</h1>
          <p class="lede">Define the work once. Run it forward, then let the same plan clean up every effect in reverse.</p>
        </div>
        <div class="phase-list" aria-label="Implemented phases">
          <span class="phase phase--active">Phase 0 · demo</span>
          <span class="phase phase--active">Phase 1 · parser</span>
        </div>
      </header>

      <div class="workspace">
        <section class="column" aria-labelledby="source-title">
          <div class="section-head">
            <h2 id="source-title">Janus source</h2>
            <span class="caption">read only</span>
          </div>
          <div class="editor">
            <div class="editor__bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="editor__file">deploy.janus</span></div>
            <pre><code>${escapeHtml(DEMO_SOURCE)}</code></pre>
          </div>
          <p class="notice">Phase 0 executes a fixed TypeScript plan; the displayed source is not parsed by this UI. The independent Phase 1 parser is covered by unit tests and will replace the plan in Phase 2.</p>
          <div class="controls">
            <button class="button button--run" id="run" type="button">Run →</button>
            <button class="button button--uncall" id="uncall" type="button" disabled>← Uncall</button>
            <label class="toggle" for="fail-deploy">
              <span>Fail deploy_application</span>
              <input id="fail-deploy" type="checkbox">
            </label>
          </div>
          <p id="runtime-status" class="runtime-status" aria-live="polite">Ready. Run creates three browser-local mock resources.</p>
        </section>

        <section class="column" aria-labelledby="state-title">
          <div class="section-head">
            <div>
              <span class="caption">browser-local state</span>
              <h2 id="state-title">Live resources</h2>
            </div>
            <div class="resource-summary"><span id="resource-count">0</span><span class="caption">active</span></div>
          </div>
          <p class="empty" id="resources-empty">No resources yet. Run the procedure.</p>
          <ul class="resources" id="resources"></ul>

          <div class="section-head">
            <h2>Execution log</h2>
            <span class="caption">forward / backward</span>
          </div>
          <div class="log-wrap">
            <p class="empty" id="log-empty">Events will appear here in execution order.</p>
            <ol class="logs" id="execution-log"></ol>
          </div>
        </section>
      </div>
      <footer><span>Snapshot restore: disabled</span><span>Receipts stay in this browser tab only</span></footer>
    </main>
    <script src="/app.js" defer></script>
  </body>
</html>`;
