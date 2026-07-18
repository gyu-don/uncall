import {
  DemoRuntime,
  MemoryDemoStateStore,
  WebDemoStateStore,
  type DemoPlanStep,
  type DemoSnapshot,
  type DemoStateStore,
} from "./demo/runtime";
import { BASE_DEMO_SOURCE, DEMO_SOURCE } from "./demo/source";
import {
  callPureSort,
  INITIAL_PURE_SORT_STATE,
  PURE_SORT_SOURCE,
  uncallPureSort,
  type PureSortState,
} from "./demo/pure-sort";

const element = <T extends HTMLElement>(id: string): T => {
  const found = document.querySelector<T>(`#${id}`);
  if (found === null) throw new Error(`Missing UI element #${id}`);
  return found;
};

const sourceEditor = element<HTMLTextAreaElement>("source");
const diagnostic = element<HTMLParagraphElement>("source-diagnostic");
const planHash = element<HTMLSpanElement>("plan-hash");
const inversePlan = element<HTMLOListElement>("inverse-plan");
const aiChangeButton = element<HTMLButtonElement>("ai-change");
const openButton = element<HTMLButtonElement>("open-pr");
const driftButton = element<HTMLButtonElement>("drift");
const resumeButton = element<HTMLButtonElement>("resume");
const uncallButton = element<HTMLButtonElement>("uncall");
const failProofButton = element<HTMLButtonElement>("fail-proof");
const resetButton = element<HTMLButtonElement>("reset");
const status = element<HTMLParagraphElement>("runtime-status");
const resourceList = element<HTMLUListElement>("resources");
const resourceEmpty = element<HTMLParagraphElement>("resources-empty");
const resourceCount = element<HTMLSpanElement>("resource-count");
const logList = element<HTMLOListElement>("execution-log");
const logEmpty = element<HTMLParagraphElement>("log-empty");
const recordPanel = element<HTMLElement>("execution-record");
const executionId = element<HTMLElement>("execution-id");
const recordPlanHash = element<HTMLElement>("record-plan-hash");
const receiptCount = element<HTMLElement>("receipt-count");
const blockedPanel = element<HTMLElement>("blocked-panel");
const blockedDetail = element<HTMLElement>("blocked-detail");
const runtimeACard = element<HTMLElement>("runtime-a-card");
const runtimeBCard = element<HTMLElement>("runtime-b-card");
const runtimeAState = element<HTMLElement>("runtime-a-state");
const runtimeBState = element<HTMLElement>("runtime-b-state");
const runtimeACopy = element<HTMLElement>("runtime-a-copy");
const runtimeBCopy = element<HTMLElement>("runtime-b-copy");
const previewTab = element<HTMLButtonElement>("preview-tab");
const pureTab = element<HTMLButtonElement>("pure-tab");
const previewPanel = element<HTMLElement>("preview-demo");
const purePanel = element<HTMLElement>("pure-demo");
const pureSource = element<HTMLTextAreaElement>("pure-source");
const pureCallButton = element<HTMLButtonElement>("pure-call");
const pureUncallButton = element<HTMLButtonElement>("pure-uncall");
const pureResetButton = element<HTMLButtonElement>("pure-reset");
const pureStatus = element<HTMLParagraphElement>("pure-status");
const purePhase = element<HTMLElement>("pure-phase");
const pureValueInputs = [
  ...document.querySelectorAll<HTMLInputElement>("[data-pure-value]"),
];
const pureTraceItems = [
  ...document.querySelectorAll<HTMLElement>("[data-pure-trace]"),
];

type PureDemoPhase = "initial" | "called" | "restored" | "error";
let pureDemoPhase: PureDemoPhase = "initial";
let pureInitialState: PureSortState = {
  values: [...INITIAL_PURE_SORT_STATE.values],
  trace: [...INITIAL_PURE_SORT_STATE.trace],
};
let pureState: PureSortState = pureInitialState;

const createStore = (): DemoStateStore => {
  try {
    return new WebDemoStateStore(window.localStorage);
  } catch {
    return new MemoryDemoStateStore();
  }
};

const runtime = new DemoRuntime({ store: createStore() });
let latestSnapshot = runtime.getSnapshot();
if (latestSnapshot.execution !== undefined) {
  sourceEditor.value = latestSnapshot.execution.source;
}

const renderPlan = (steps: readonly DemoPlanStep[]): void => {
  if (steps.length === 0) {
    const empty = document.createElement("li");
    empty.className = "plan-empty";
    empty.textContent = "Fix the source to derive its inverse plan.";
    inversePlan.replaceChildren(empty);
    return;
  }

  inversePlan.replaceChildren(
    ...steps.map((step) => {
      const item = document.createElement("li");
      item.className = `plan-item${step.primitiveName === "create_cache" ? " plan-item--cache" : ""}`;

      const operation = document.createElement("code");
      operation.textContent = `${step.operation}(receipt)`;
      const receipt = document.createElement("span");
      receipt.className = "plan-item__receipt";
      const receiptValue = step.receipt;
      receipt.textContent =
        typeof receiptValue === "object" &&
        receiptValue !== null &&
        "resourceId" in receiptValue &&
        typeof receiptValue.resourceId === "string"
          ? receiptValue.resourceId
          : "derived";
      item.append(operation, receipt);
      return item;
    }),
  );
};

const renderAnalysis = (): void => {
  const analysis = runtime.inspectSource(sourceEditor.value);
  diagnostic.classList.toggle("is-error", analysis.status === "invalid");
  if (analysis.status === "invalid") {
    diagnostic.textContent = analysis.error;
    planHash.textContent = "plan / compile error";
    renderPlan([]);
    return;
  }
  diagnostic.textContent = `Valid procedure · ${analysis.forward.length} trusted effects · both directions linked`;
  planHash.textContent = `plan / ${analysis.planHash}`;
  const recordSteps = latestSnapshot.inversePlan;
  renderPlan(recordSteps.length > 0 ? recordSteps : analysis.backward);
};

const renderResources = (snapshot: DemoSnapshot): void => {
  resourceList.replaceChildren(
    ...snapshot.resources.map((resource) => {
      const item = document.createElement("li");
      item.className = "resource";

      const top = document.createElement("div");
      top.className = "resource__top";
      const dot = document.createElement("span");
      dot.className = "resource__dot";
      const label = document.createElement("strong");
      label.textContent = resource.label;
      top.append(dot, label);

      const id = document.createElement("code");
      id.textContent = resource.resourceId;
      const generation = document.createElement("code");
      generation.textContent = `generation ${resource.generation}`;
      item.append(top, id, generation);
      return item;
    }),
  );
  resourceEmpty.hidden = snapshot.resources.length > 0;
  resourceCount.textContent = String(snapshot.resources.length);
};

const renderLog = (snapshot: DemoSnapshot): void => {
  logList.replaceChildren(
    ...snapshot.events.map((event) => {
      const item = document.createElement("li");
      item.className = `log log--${event.status}`;

      const sequence = document.createElement("span");
      sequence.className = "log__seq";
      sequence.textContent = String(event.sequence).padStart(2, "0");
      const process = document.createElement("span");
      process.className = "log__process";
      process.textContent =
        event.process === "runtime-a"
          ? "A / open"
          : event.process === "runtime-b"
            ? "B / merge"
            : "external";
      const operation = document.createElement("code");
      operation.textContent = event.operation;
      const result = document.createElement("span");
      result.className = "log__result";
      result.textContent = event.message ?? event.resourceId ?? event.status;
      item.append(sequence, process, operation, result);
      return item;
    }),
  );
  logEmpty.hidden = snapshot.events.length > 0;
  logList.hidden = snapshot.events.length === 0;
  logList.scrollTop = logList.scrollHeight;
};

const renderStory = (snapshot: DemoSnapshot): void => {
  const order = ["author", "open", "merge", "uncall"] as const;
  let active = 0;
  if (snapshot.stage === "running" || snapshot.stage === "live") active = 1;
  if (snapshot.stage === "review") active = 2;
  if (
    snapshot.stage === "reversing" ||
    snapshot.stage === "blocked" ||
    snapshot.stage === "completed"
  ) {
    active = 3;
  }
  for (const [index, name] of order.entries()) {
    const step = document.querySelector<HTMLElement>(`[data-story-step="${name}"]`);
    if (step === null) continue;
    step.classList.toggle("is-active", index === active);
    step.classList.toggle(
      "is-done",
      index < active || (snapshot.stage === "completed" && index === active),
    );
  }
};

const renderProcess = (snapshot: DemoSnapshot): void => {
  const execution = snapshot.execution;
  const runtimeAEnded = execution !== undefined;
  const runtimeBStarted =
    execution?.status === "review" ||
    execution?.status === "blocked" ||
    execution?.status === "completed";

  runtimeACard.classList.toggle("is-active", snapshot.stage === "running");
  runtimeBCard.classList.toggle(
    "is-active",
    snapshot.stage === "review" || snapshot.stage === "reversing",
  );
  runtimeAState.className = `process-state${runtimeAEnded ? " is-live" : ""}`;
  runtimeAState.textContent = runtimeAEnded ? "process ended" : "waiting";
  runtimeACopy.textContent = runtimeAEnded
    ? "Forward process ended. The preview remains live because its serialized execution record owns the undo intent."
    : "Compiles the forward procedure and creates the preview environment.";
  runtimeBState.className = `process-state${runtimeBStarted ? " is-active" : ""}`;
  runtimeBState.textContent = runtimeBStarted
    ? execution?.status === "completed"
      ? "completed"
      : execution?.status === "blocked"
        ? "blocked"
        : "record loaded"
    : "not started";
  runtimeBCopy.textContent = runtimeBStarted
    ? "Loaded source, verified the plan hash, and restored the serializable receipt stack in a new executor."
    : "A later event will load the serialized receipt stack and inspect the inverse plan before execution.";

  recordPanel.hidden = execution === undefined;
  if (execution !== undefined) {
    executionId.textContent = execution.executionId;
    recordPlanHash.textContent = execution.planHash;
    receiptCount.textContent = String(execution.receipts.length);
  }

  const reason = execution?.blockedReason;
  blockedPanel.hidden = reason === undefined;
  if (reason !== undefined && execution !== undefined) {
    blockedDetail.textContent = `${reason.operation} blocked\nexpected generation: ${reason.expectedGeneration}\ncurrent generation:  ${reason.currentGeneration}\nremaining inverse steps: ${execution.receipts.length}\nmanual decision required`;
  }
};

const statusCopy = (snapshot: DemoSnapshot): string => {
  switch (snapshot.stage) {
    case "authoring":
      return "<strong>Ready.</strong> Apply the cache change, then open the mock PR.";
    case "running":
      return "<strong>Runtime A executing.</strong> Successful effects are receiving serializable receipts…";
    case "live":
      return `<strong>Preview live; Runtime A ended.</strong> ${snapshot.execution?.executionId ?? "Execution"} is durable. Merge the PR now or simulate outside drift first.`;
    case "review":
      return "<strong>Runtime B restored the record.</strong> Inspect the derived inverse plan and receipt IDs, then UNCALL.";
    case "reversing":
      return "<strong>Runtime B reversing.</strong> Each receipt is checked immediately before cleanup…";
    case "blocked":
      return "<strong>Cleanup stopped safely.</strong> Database state drifted; dependent Namespace remains for a manual decision.";
    case "completed":
      return "<strong>UNCALL complete.</strong> Runtime B consumed every receipt; all mock preview resources are gone.";
    case "rolled-back":
      return "<strong>Forward failed.</strong> Only successful earlier effects were compensated, in reverse order.";
  }
};

const render = (snapshot: DemoSnapshot): void => {
  latestSnapshot = snapshot;
  const hasExecution = snapshot.execution !== undefined;
  const drifted = snapshot.events.some(
    (event) => event.operation === "external_database_change",
  );
  aiChangeButton.disabled =
    snapshot.isBusy || hasExecution || sourceEditor.value.includes("create_cache()");
  openButton.disabled = snapshot.isBusy || !snapshot.canOpen || hasExecution;
  driftButton.disabled = snapshot.isBusy || !snapshot.canDrift || drifted;
  driftButton.textContent = drifted ? "DB drift simulated ✓" : "Simulate DB drift";
  resumeButton.disabled = snapshot.isBusy || !snapshot.canResume;
  uncallButton.disabled = snapshot.isBusy || !snapshot.canUncall;
  failProofButton.disabled = snapshot.isBusy || !snapshot.canOpen || hasExecution;
  sourceEditor.disabled = snapshot.isBusy || hasExecution;
  status.innerHTML = statusCopy(snapshot);
  renderStory(snapshot);
  renderProcess(snapshot);
  renderResources(snapshot);
  renderLog(snapshot);
  renderAnalysis();
};

runtime.subscribe(render);

const selectDemo = (selected: "preview" | "pure"): void => {
  const previewSelected = selected === "preview";
  previewTab.setAttribute("aria-selected", String(previewSelected));
  pureTab.setAttribute("aria-selected", String(!previewSelected));
  previewTab.tabIndex = previewSelected ? 0 : -1;
  pureTab.tabIndex = previewSelected ? -1 : 0;
  previewPanel.hidden = !previewSelected;
  purePanel.hidden = previewSelected;
};

const renderPureDemo = (): void => {
  pureValueInputs.forEach((input, index) => {
    input.value = String(pureState.values[index] ?? 0);
    input.disabled = pureDemoPhase === "called";
  });
  pureTraceItems.forEach((item, index) => {
    const value = pureState.trace[index] ?? 0;
    const number = item.querySelector<HTMLElement>("strong");
    const meaning = item.querySelector<HTMLElement>("span");
    if (number !== null) number.textContent = String(value);
    if (meaning !== null) {
      meaning.textContent =
        pureDemoPhase === "called" ? (value === 0 ? "kept" : "swapped") : "empty";
    }
    item.classList.toggle("trace-bit--swap", pureDemoPhase === "called" && value !== 0);
    item.classList.toggle("trace-bit--keep", pureDemoPhase === "called" && value === 0);
  });
  for (const stage of document.querySelectorAll<HTMLElement>("[data-pure-stage]")) {
    const name = stage.dataset.pureStage;
    const active =
      (pureDemoPhase === "initial" && name === "initial") ||
      (pureDemoPhase === "called" && name === "called") ||
      (pureDemoPhase === "restored" && name === "restored");
    stage.classList.toggle("is-active", active);
    stage.classList.toggle(
      "is-done",
      pureDemoPhase === "called"
        ? name === "initial"
        : pureDemoPhase === "restored"
          ? name === "initial" || name === "called" || name === "restored"
          : false,
    );
  }
  pureCallButton.disabled = pureDemoPhase === "called";
  pureUncallButton.disabled = pureDemoPhase !== "called";
  pureSource.disabled = pureDemoPhase === "called";
  purePhase.textContent = pureDemoPhase;
};

const readPureInitialState = (): PureSortState => ({
  values: pureValueInputs.map((input) => Number(input.value)),
  trace: [0, 0, 0, 0, 0],
});

previewTab.addEventListener("click", () => selectDemo("preview"));
pureTab.addEventListener("click", () => selectDemo("pure"));

pureCallButton.addEventListener("click", () => {
  try {
    pureInitialState = readPureInitialState();
    pureState = callPureSort(pureSource.value, pureInitialState);
    pureDemoPhase = "called";
    pureStatus.className = "pure-status";
    pureStatus.innerHTML = `<strong>Forward complete.</strong> values is sorted; trace = [${pureState.trace.join(",")}] records the branch history needed to run backward.`;
  } catch (error) {
    pureDemoPhase = "error";
    pureStatus.className = "pure-status is-error";
    pureStatus.textContent = error instanceof Error ? error.message : String(error);
  }
  renderPureDemo();
});

pureUncallButton.addEventListener("click", () => {
  try {
    const restored = uncallPureSort(pureSource.value, pureState);
    const verified = JSON.stringify(restored) === JSON.stringify(pureInitialState);
    pureState = restored;
    pureDemoPhase = "restored";
    pureStatus.className = `pure-status${verified ? " is-verified" : " is-error"}`;
    pureStatus.innerHTML = verified
      ? "<strong>Exact round trip verified.</strong> Original ordering restored and every trace bit returned to zero."
      : "<strong>Round trip mismatch.</strong> The edited program did not restore the initial state.";
  } catch (error) {
    pureDemoPhase = "error";
    pureStatus.className = "pure-status is-error";
    pureStatus.textContent = error instanceof Error ? error.message : String(error);
  }
  renderPureDemo();
});

pureResetButton.addEventListener("click", () => {
  pureSource.value = PURE_SORT_SOURCE;
  pureInitialState = {
    values: [...INITIAL_PURE_SORT_STATE.values],
    trace: [...INITIAL_PURE_SORT_STATE.trace],
  };
  pureState = pureInitialState;
  pureDemoPhase = "initial";
  pureStatus.className = "pure-status";
  pureStatus.innerHTML =
    "<strong>Ready.</strong> Call the real Pure Janus evaluator with the state above.";
  renderPureDemo();
});

renderPureDemo();
selectDemo(
  new URLSearchParams(window.location.search).get("demo") === "pure"
    ? "pure"
    : "preview",
);

sourceEditor.addEventListener("input", renderAnalysis);

aiChangeButton.addEventListener("click", () => {
  sourceEditor.value = DEMO_SOURCE;
  renderAnalysis();
  aiChangeButton.disabled = true;
  status.innerHTML =
    "<strong>Application diff: +1 line.</strong> The cache cleanup appeared in the derived inverse plan; no rollback file changed.";
});

openButton.addEventListener("click", async () => {
  try {
    const result = await runtime.openPreview({ source: sourceEditor.value });
    if (result.status === "compile-failed") {
      status.innerHTML = `<strong>Compile failed.</strong> ${result.error}`;
    } else if (result.status === "rolled-back") {
      status.innerHTML = `<strong>Forward failed and compensated.</strong> ${result.error}`;
    }
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : String(error);
  }
});

driftButton.addEventListener("click", () => {
  try {
    const database = runtime.simulateDatabaseDrift();
    status.innerHTML = `<strong>Outside change simulated.</strong> Database is now generation ${database.generation}; its saved receipt is intentionally stale.`;
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : String(error);
  }
});

resumeButton.addEventListener("click", () => {
  try {
    runtime.resume();
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : String(error);
  }
});

uncallButton.addEventListener("click", async () => {
  try {
    await runtime.uncall();
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : String(error);
  }
});

failProofButton.addEventListener("click", async () => {
  try {
    await runtime.openPreview({
      source: sourceEditor.value,
      failAt: "deploy_application",
    });
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : String(error);
  }
});

resetButton.addEventListener("click", () => {
  runtime.reset();
  sourceEditor.value = BASE_DEMO_SOURCE;
  renderAnalysis();
});
