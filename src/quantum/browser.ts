import {
  AdderDemoRuntime,
  QftDemoRuntime,
  type QuantumExecutionStep,
  type QuantumRuntimePhase,
} from "./runtime";
import type { QuantumGate } from "./gates";

const element = <T extends Element>(id: string): T => {
  const found = document.querySelector<T>(`#${id}`);
  if (found === null) throw new Error(`Missing quantum UI element #${id}`);
  return found;
};

const binary = (value: number, width: number): string =>
  value.toString(2).padStart(width, "0");

const escapeXml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const angleLabel = (angle: number): string => {
  const sign = angle < 0 ? "−" : "+";
  const absolute = Math.abs(angle);
  if (Math.abs(absolute - Math.PI / 2) < 1e-10) return `${sign}π/2`;
  if (Math.abs(absolute - Math.PI / 4) < 1e-10) return `${sign}π/4`;
  return `${angle.toFixed(2)}`;
};

const gateLabel = (gate: QuantumGate): string => {
  switch (gate.kind) {
    case "x":
      return `X ${gate.target}`;
    case "h":
      return `H ${gate.target}`;
    case "cx":
      return `CX ${gate.control}→${gate.target}`;
    case "ccx":
      return `CCX ${gate.controls.join(",")}→${gate.target}`;
    case "cp":
      return `CP(${angleLabel(gate.angle)}) ${gate.control}→${gate.target}`;
    case "swap":
      return `SWAP ${gate.targets.join("↔")}`;
  }
};

const gateWires = (gate: QuantumGate): readonly string[] => {
  switch (gate.kind) {
    case "x":
    case "h":
      return [gate.target];
    case "cx":
    case "cp":
      return [gate.control, gate.target];
    case "ccx":
      return [...gate.controls, gate.target];
    case "swap":
      return gate.targets;
  }
};

const renderCircuit = (
  svg: SVGSVGElement,
  wires: readonly string[],
  steps: readonly QuantumExecutionStep[],
  current: QuantumExecutionStep | undefined,
): void => {
  const wireY = (wire: string): number => {
    const index = wires.indexOf(wire);
    if (index < 0) throw new Error(`Unknown circuit wire ${wire}.`);
    return 34 + index * 44;
  };
  const width = Math.max(640, steps.length * 62 + 54);
  const height = 24 + wires.length * 44;
  svg.setAttribute("width", String(width));
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const markup: string[] = wires.map(
    (wire) =>
      `<line class="wire" x1="16" y1="${wireY(wire)}" x2="${width - 16}" y2="${wireY(wire)}"></line>`,
  );
  if (steps.length === 0) {
    markup.push(
      '<text class="circuit-empty" x="28" y="24">Waiting for the first emitted gate…</text>',
    );
  }

  steps.forEach((step, index) => {
    const x = 48 + index * 62;
    const ys = gateWires(step.gate).map(wireY);
    const minimum = Math.min(...ys);
    const maximum = Math.max(...ys);
    const isCurrent =
      current?.direction === step.direction && current.step === step.step;
    markup.push(
      `<g class="gate-column${isCurrent ? " is-current" : ""}" data-step="${step.step}">`,
    );
    switch (step.gate.kind) {
      case "h":
      case "x": {
        const y = wireY(step.gate.target);
        markup.push(
          `<rect class="gate-box" x="${x - 14}" y="${y - 14}" width="28" height="28"></rect>`,
          `<text class="gate-text" x="${x}" y="${y}">${step.gate.kind.toUpperCase()}</text>`,
        );
        break;
      }
      case "cx": {
        const controlY = wireY(step.gate.control);
        const targetY = wireY(step.gate.target);
        markup.push(
          `<line class="gate-link" x1="${x}" y1="${minimum}" x2="${x}" y2="${maximum}"></line>`,
          `<circle class="gate-control" cx="${x}" cy="${controlY}" r="4"></circle>`,
          `<circle class="gate-target" cx="${x}" cy="${targetY}" r="10"></circle>`,
          `<line class="gate-mark" x1="${x - 6}" y1="${targetY}" x2="${x + 6}" y2="${targetY}"></line>`,
          `<line class="gate-mark" x1="${x}" y1="${targetY - 6}" x2="${x}" y2="${targetY + 6}"></line>`,
        );
        break;
      }
      case "ccx": {
        const targetY = wireY(step.gate.target);
        markup.push(
          `<line class="gate-link" x1="${x}" y1="${minimum}" x2="${x}" y2="${maximum}"></line>`,
          ...step.gate.controls.map(
            (wire) =>
              `<circle class="gate-control" cx="${x}" cy="${wireY(wire)}" r="4"></circle>`,
          ),
          `<circle class="gate-target" cx="${x}" cy="${targetY}" r="10"></circle>`,
          `<line class="gate-mark" x1="${x - 6}" y1="${targetY}" x2="${x + 6}" y2="${targetY}"></line>`,
          `<line class="gate-mark" x1="${x}" y1="${targetY - 6}" x2="${x}" y2="${targetY + 6}"></line>`,
        );
        break;
      }
      case "cp": {
        const controlY = wireY(step.gate.control);
        const targetY = wireY(step.gate.target);
        markup.push(
          `<line class="gate-link" x1="${x}" y1="${minimum}" x2="${x}" y2="${maximum}"></line>`,
          `<circle class="gate-control" cx="${x}" cy="${controlY}" r="4"></circle>`,
          `<rect class="gate-box" x="${x - 18}" y="${targetY - 12}" width="36" height="24"></rect>`,
          `<text class="gate-text" x="${x}" y="${targetY}">${escapeXml(angleLabel(step.gate.angle))}</text>`,
        );
        break;
      }
      case "swap": {
        const first = wireY(step.gate.targets[0]);
        const second = wireY(step.gate.targets[1]);
        markup.push(
          `<line class="gate-link" x1="${x}" y1="${minimum}" x2="${x}" y2="${maximum}"></line>`,
          ...[first, second].flatMap((y) => [
            `<line class="gate-mark" x1="${x - 6}" y1="${y - 6}" x2="${x + 6}" y2="${y + 6}"></line>`,
            `<line class="gate-mark" x1="${x + 6}" y1="${y - 6}" x2="${x - 6}" y2="${y + 6}"></line>`,
          ]),
        );
        break;
      }
    }
    markup.push("</g>");
  });
  svg.innerHTML = markup.join("");
};

const renderStream = (
  list: HTMLOListElement,
  steps: readonly QuantumExecutionStep[],
  current: QuantumExecutionStep | undefined,
): void => {
  list.innerHTML = steps
    .map(
      (step) =>
        `<li class="${current?.direction === step.direction && current.step === step.step ? "is-current" : ""}">${escapeXml(gateLabel(step.gate))}</li>`,
    )
    .join("");
  list.lastElementChild?.scrollIntoView({ block: "nearest" });
};

const isBusy = (phase: QuantumRuntimePhase): boolean =>
  phase === "running-forward" || phase === "running-backward";

const phaseLabel = (phase: QuantumRuntimePhase): string => {
  switch (phase) {
    case "ready":
      return "ready";
    case "running-forward":
      return "calling";
    case "called":
      return "forward complete";
    case "running-backward":
      return "uncalling";
    case "restored":
      return "restored";
    case "error":
      return "error";
  }
};

const qftTab = element<HTMLButtonElement>("qft-tab");
const adderTab = element<HTMLButtonElement>("adder-tab");
const qftPanel = element<HTMLElement>("qft-panel");
const adderPanel = element<HTMLElement>("adder-panel");
const tabs = [qftTab, adderTab] as const;

type TabName = "qft" | "adder";

const selectTab = (name: TabName, focus = false): void => {
  if (tabs.some((tab) => tab.disabled)) return;
  const qftSelected = name === "qft";
  qftTab.setAttribute("aria-selected", String(qftSelected));
  adderTab.setAttribute("aria-selected", String(!qftSelected));
  qftTab.tabIndex = qftSelected ? 0 : -1;
  adderTab.tabIndex = qftSelected ? -1 : 0;
  qftPanel.hidden = !qftSelected;
  adderPanel.hidden = qftSelected;
  if (focus) (qftSelected ? qftTab : adderTab).focus();
};

qftTab.addEventListener("click", () => selectTab("qft"));
adderTab.addEventListener("click", () => selectTab("adder"));
tabs.forEach((tab, index) => {
  tab.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : event.key === "ArrowRight"
            ? (index + 1) % tabs.length
            : (index - 1 + tabs.length) % tabs.length;
    selectTab(next === 0 ? "qft" : "adder", true);
  });
});

const updateTabAvailability = (): void => {
  const busy = isBusy(qftRuntime.getSnapshot().phase) || isBusy(adderRuntime.getSnapshot().phase);
  tabs.forEach((tab) => {
    tab.disabled = busy;
  });
};

const qftInput = element<HTMLSelectElement>("qft-input");
const qftOutput = element<HTMLSelectElement>("qft-output");
const qftBasis = element<HTMLElement>("qft-basis");
const qftCircuit = element<SVGSVGElement>("qft-circuit");
const qftStep = element<HTMLElement>("qft-step");
const qftExecutionLabel = element<HTMLElement>("qft-execution-label");
const qftCall = element<HTMLButtonElement>("qft-call");
const qftUncall = element<HTMLButtonElement>("qft-uncall");
const qftReset = element<HTMLButtonElement>("qft-reset");
const qftStatus = element<HTMLParagraphElement>("qft-status");
const qftForwardStream = element<HTMLOListElement>("qft-forward-stream");
const qftBackwardStream = element<HTMLOListElement>("qft-backward-stream");
let qftRuntime!: QftDemoRuntime;

const renderQft = (): void => {
  const snapshot = qftRuntime.getSnapshot();
  const displayingBackward = snapshot.backwardSteps.length > 0;
  const displayedSteps = displayingBackward
    ? snapshot.backwardSteps
    : snapshot.forwardSteps;
  qftBasis.textContent = `|${binary(snapshot.input, 3)}⟩`;
  qftInput.value = String(snapshot.input);
  qftOutput.value = String(snapshot.outputInput);
  qftInput.disabled = snapshot.phase !== "ready" && snapshot.phase !== "restored";
  qftOutput.disabled = snapshot.phase !== "called";
  qftCall.disabled = snapshot.phase !== "ready" && snapshot.phase !== "restored";
  qftUncall.disabled = snapshot.phase !== "called";
  qftReset.disabled = isBusy(snapshot.phase);
  qftStep.textContent = `${phaseLabel(snapshot.phase)} · ${displayedSteps.length} / 7`;
  qftExecutionLabel.textContent = displayingBackward
    ? "Uncall: the inverse gates appear in reverse order."
    : "Call: the QFT gates appear from left to right.";
  renderCircuit(
    qftCircuit,
    qftRuntime.wires,
    displayedSteps,
    snapshot.currentStep,
  );
  renderStream(qftForwardStream, snapshot.forwardSteps, snapshot.currentStep);
  renderStream(qftBackwardStream, snapshot.backwardSteps, snapshot.currentStep);

  const maximumMagnitude = Math.max(
    ...snapshot.amplitudes.map(({ magnitude }) => magnitude),
  );
  snapshot.amplitudes.forEach((amplitude) => {
    const card = document.querySelector<HTMLElement>(
      `[data-amplitude="${amplitude.basis}"]`,
    );
    if (card === null) return;
    const length =
      amplitude.magnitude < 1e-9
        ? 0
        : 8 + 12 * (amplitude.magnitude / maximumMagnitude);
    const x = 27 + Math.cos(amplitude.phase) * length;
    const y = 27 - Math.sin(amplitude.phase) * length;
    const vector = card.querySelector<SVGLineElement>(".phasor-vector");
    const tip = card.querySelector<SVGCircleElement>(".phasor-tip");
    vector?.setAttribute("x2", x.toFixed(3));
    vector?.setAttribute("y2", y.toFixed(3));
    tip?.setAttribute("cx", x.toFixed(3));
    tip?.setAttribute("cy", y.toFixed(3));
    const magnitude = card.querySelector<HTMLElement>("[data-amplitude-magnitude]");
    const phase = card.querySelector<HTMLElement>("[data-amplitude-phase]");
    if (magnitude !== null) magnitude.textContent = `|α| ${amplitude.magnitude.toFixed(3)}`;
    if (phase !== null) phase.textContent = `${amplitude.phase.toFixed(3)} rad`;
  });

  qftStatus.className = "status";
  switch (snapshot.phase) {
    case "ready":
      qftStatus.innerHTML = "<strong>Ready.</strong> Call QFT and watch the value move into relative phase.";
      break;
    case "running-forward":
      qftStatus.innerHTML = `<strong>Running QFT.</strong> Gate ${snapshot.currentStep?.step ?? 0} of 7.`;
      break;
    case "called":
      qftStatus.classList.add("is-ok");
      qftStatus.innerHTML = "<strong>The value is now a phase pattern.</strong> All eight magnitudes match, but their arrows point in different directions. Uncall to recover the value.";
      break;
    case "running-backward":
      qftStatus.innerHTML = `<strong>Running inverse QFT.</strong> Gate ${snapshot.currentStep?.step ?? 0} of 7.`;
      break;
    case "restored":
      qftStatus.classList.add("is-ok");
      qftStatus.innerHTML = `<strong>The value is back.</strong> The inverse gate sequence recovered |${binary(snapshot.input, 3)}⟩.`;
      break;
    case "error":
      qftStatus.classList.add("is-error");
      qftStatus.textContent = snapshot.error ?? "QFT execution failed.";
      break;
  }
  updateTabAvailability();
};

const resetQft = (): void => {
  qftRuntime = new QftDemoRuntime(Number(qftInput.value), {
    delayMilliseconds: 115,
    onChange: renderQft,
  });
  renderQft();
};

qftInput.addEventListener("change", resetQft);
qftOutput.addEventListener("change", () => {
  try {
    qftRuntime.editCalledOutput(Number(qftOutput.value));
    qftStatus.className = "status";
    qftStatus.innerHTML = `<strong>Phase pattern changed.</strong> Uncall will turn this pattern into |${binary(Number(qftOutput.value), 3)}⟩.`;
  } catch (error) {
    qftStatus.className = "status is-error";
    qftStatus.textContent = error instanceof Error ? error.message : String(error);
  }
});
qftReset.addEventListener("click", resetQft);
qftCall.addEventListener("click", async () => {
  try {
    await qftRuntime.call();
    renderQft();
  } catch {
    renderQft();
  }
});
qftUncall.addEventListener("click", async () => {
  try {
    await qftRuntime.uncall();
    renderQft();
  } catch {
    renderQft();
  }
});

const adderA = element<HTMLInputElement>("adder-a");
const adderB = element<HTMLInputElement>("adder-b");
const adderEquation = element<HTMLElement>("adder-equation");
const adderRegisterA = element<HTMLElement>("adder-register-a");
const adderOutputB = element<HTMLInputElement>("adder-output-b");
const adderAncilla = element<HTMLElement>("adder-ancilla");
const adderAncillaBox = element<HTMLElement>("adder-ancilla-box");
const adderCircuit = element<SVGSVGElement>("adder-circuit");
const adderStep = element<HTMLElement>("adder-step");
const adderExecutionLabel = element<HTMLElement>("adder-execution-label");
const adderCall = element<HTMLButtonElement>("adder-call");
const adderUncall = element<HTMLButtonElement>("adder-uncall");
const adderReset = element<HTMLButtonElement>("adder-reset");
const adderStatus = element<HTMLParagraphElement>("adder-status");
const adderForwardStream = element<HTMLOListElement>("adder-forward-stream");
const adderBackwardStream = element<HTMLOListElement>("adder-backward-stream");
let adderRuntime!: AdderDemoRuntime;

const readAdderInput = (input: HTMLInputElement, name: string): number => {
  const value = input.valueAsNumber;
  if (!Number.isInteger(value) || value < 0 || value > 15) {
    throw new Error(`${name} must be an integer from 0 to 15.`);
  }
  return value;
};

const renderAdder = (): void => {
  const snapshot = adderRuntime.getSnapshot();
  const displayingBackward = snapshot.backwardSteps.length > 0;
  const displayedSteps = displayingBackward
    ? snapshot.backwardSteps
    : snapshot.forwardSteps;
  const { basis } = snapshot;
  adderA.value = String(snapshot.inputA);
  adderB.value = String(snapshot.inputB);
  adderA.disabled = snapshot.phase !== "ready" && snapshot.phase !== "restored";
  adderB.disabled = snapshot.phase !== "ready" && snapshot.phase !== "restored";
  adderOutputB.value = String(basis.b);
  adderOutputB.disabled = snapshot.phase !== "called";
  adderCall.disabled = snapshot.phase !== "ready" && snapshot.phase !== "restored";
  adderUncall.disabled = snapshot.phase !== "called";
  adderReset.disabled = isBusy(snapshot.phase);
  adderEquation.textContent = `${snapshot.inputA} + ${snapshot.inputB} mod 16`;
  adderRegisterA.textContent = `${binary(basis.a, 4)} · ${basis.a}`;
  adderAncilla.textContent = String(basis.ancilla);
  adderAncillaBox.classList.toggle("is-clean", basis.ancilla === 0);
  adderStep.textContent = `${phaseLabel(snapshot.phase)} · ${displayedSteps.length} / 24`;
  adderExecutionLabel.textContent = displayingBackward
    ? "Uncall: the same gates appear in reverse to subtract a."
    : "Call: the gates add a into b.";
  renderCircuit(
    adderCircuit,
    adderRuntime.wires,
    displayedSteps,
    snapshot.currentStep,
  );
  renderStream(adderForwardStream, snapshot.forwardSteps, snapshot.currentStep);
  renderStream(adderBackwardStream, snapshot.backwardSteps, snapshot.currentStep);

  adderStatus.className = "status";
  switch (snapshot.phase) {
    case "ready":
      adderStatus.innerHTML = "<strong>Ready.</strong> Call add to compute b = a + b mod 16.";
      break;
    case "running-forward":
      adderStatus.innerHTML = `<strong>Adding.</strong> Gate ${snapshot.currentStep?.step ?? 0} of 24.`;
      break;
    case "called":
      adderStatus.classList.add("is-ok");
      adderStatus.innerHTML = `<strong>Addition complete.</strong> a stayed ${basis.a} and b became ${basis.b}. Uncall to run the same gates backward.`;
      break;
    case "running-backward":
      adderStatus.innerHTML = `<strong>Subtracting.</strong> Reverse gate ${snapshot.currentStep?.step ?? 0} of 24.`;
      break;
    case "restored":
      adderStatus.classList.add("is-ok");
      adderStatus.innerHTML = `<strong>The input is back.</strong> a is ${basis.a}, b is ${basis.b}, and the carry bit is zero.`;
      break;
    case "error":
      adderStatus.classList.add("is-error");
      adderStatus.textContent = snapshot.error ?? "Adder execution failed.";
      break;
  }
  updateTabAvailability();
};

const resetAdder = (): void => {
  try {
    const a = readAdderInput(adderA, "a");
    const b = readAdderInput(adderB, "b");
    adderRuntime = new AdderDemoRuntime(a, b, {
      delayMilliseconds: 75,
      onChange: renderAdder,
    });
    renderAdder();
  } catch (error) {
    adderStatus.className = "status is-error";
    adderStatus.textContent = error instanceof Error ? error.message : String(error);
  }
};

adderA.addEventListener("change", resetAdder);
adderB.addEventListener("change", resetAdder);
adderOutputB.addEventListener("change", () => {
  try {
    const value = readAdderInput(adderOutputB, "Output b");
    adderRuntime.editCalledOutputB(value);
    const snapshot = adderRuntime.getSnapshot();
    const restored = (value - snapshot.inputA + 16) % 16;
    adderStatus.className = "status";
    adderStatus.innerHTML = `<strong>Sum changed to ${value}.</strong> Running backward will subtract ${snapshot.inputA} and produce ${restored}.`;
  } catch (error) {
    adderStatus.className = "status is-error";
    adderStatus.textContent = error instanceof Error ? error.message : String(error);
  }
});
adderReset.addEventListener("click", resetAdder);
adderCall.addEventListener("click", async () => {
  try {
    await adderRuntime.call();
    renderAdder();
  } catch {
    renderAdder();
  }
});
adderUncall.addEventListener("click", async () => {
  try {
    await adderRuntime.uncall();
    renderAdder();
  } catch {
    renderAdder();
  }
});

qftRuntime = new QftDemoRuntime(Number(qftInput.value), {
  delayMilliseconds: 115,
  onChange: renderQft,
});
adderRuntime = new AdderDemoRuntime(5, 11, {
  delayMilliseconds: 75,
  onChange: renderAdder,
});
renderQft();
renderAdder();
