import { DemoRuntime, type DemoSnapshot } from "./demo/runtime";

const element = <T extends HTMLElement>(id: string): T => {
  const found = document.querySelector<T>(`#${id}`);
  if (found === null) throw new Error(`Missing UI element #${id}`);
  return found;
};

const runButton = element<HTMLButtonElement>("run");
const uncallButton = element<HTMLButtonElement>("uncall");
const failToggle = element<HTMLInputElement>("fail-deploy");
const sourceEditor = element<HTMLTextAreaElement>("source");
const resourceList = element<HTMLUListElement>("resources");
const resourceEmpty = element<HTMLParagraphElement>("resources-empty");
const logList = element<HTMLOListElement>("execution-log");
const logEmpty = element<HTMLParagraphElement>("log-empty");
const status = element<HTMLParagraphElement>("runtime-status");
const resourceCount = element<HTMLSpanElement>("resource-count");

const runtime = new DemoRuntime();

const renderResources = (snapshot: DemoSnapshot): void => {
  resourceList.replaceChildren(
    ...snapshot.resources.map((resource) => {
      const item = document.createElement("li");
      item.className = `resource resource--${resource.kind}`;

      const icon = document.createElement("span");
      icon.className = "resource__icon";
      icon.setAttribute("aria-hidden", "true");

      const copy = document.createElement("span");
      const label = document.createElement("strong");
      label.textContent = resource.label;
      const id = document.createElement("code");
      id.textContent = resource.id;
      copy.append(label, id);
      item.append(icon, copy);
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
      item.className = `log log--${event.direction} log--${event.status}`;

      const sequence = document.createElement("span");
      sequence.className = "log__sequence";
      sequence.textContent = String(event.sequence).padStart(2, "0");

      const operation = document.createElement("code");
      operation.textContent = event.operation;

      const result = document.createElement("span");
      result.className = "log__result";
      result.textContent = event.message ?? event.resourceId ?? event.status;
      item.append(sequence, operation, result);
      return item;
    }),
  );
  logEmpty.hidden = snapshot.events.length > 0;
  logList.scrollTop = logList.scrollHeight;
};

runtime.subscribe((snapshot) => {
  runButton.disabled = snapshot.isBusy || snapshot.canUncall;
  uncallButton.disabled = snapshot.isBusy || !snapshot.canUncall;
  failToggle.disabled = snapshot.isBusy;
  sourceEditor.disabled = snapshot.isBusy || snapshot.canUncall;
  renderResources(snapshot);
  renderLog(snapshot);
});

runButton.addEventListener("click", async () => {
  status.textContent = "Forward execution in progress…";
  try {
    const result = await runtime.run({
      source: sourceEditor.value,
      failDeploy: failToggle.checked,
    });
    if (result.status === "succeeded") {
      status.textContent = "Run complete. Uncall can now clean up in reverse order.";
    } else if (result.status === "compile-failed") {
      status.textContent = `Compile failed: ${result.error}`;
    } else if (result.cleanupErrors.length === 0) {
      status.textContent = `Run failed and automatic cleanup completed: ${result.error}`;
    } else {
      status.textContent = `Run failed; cleanup is incomplete: ${result.cleanupErrors.join("; ")}`;
    }
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : String(error);
  }
});

uncallButton.addEventListener("click", async () => {
  status.textContent = "Backward execution in progress…";
  try {
    await runtime.uncall();
    status.textContent = "Uncall complete. All mock resources are gone.";
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : String(error);
  }
});
