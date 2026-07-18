import {
  callPureEncode,
  codecText,
  INITIAL_PURE_CODEC_STATE,
  PURE_CODEC_SOURCE,
  uncallPureEncode,
  type PureCodecState,
} from "./demo/pure-codec";
import {
  callPureSort,
  INITIAL_PURE_SORT_STATE,
  PURE_SORT_SOURCE,
  uncallPureSort,
  type PureSortState,
} from "./demo/pure-sort";
import {
  callTreePathEncode,
  PURE_TREE_CODEC_SOURCE,
  treeCodecStateForLeaf,
  treePathCode,
  uncallTreePathEncode,
  type PureTreeCodecState,
} from "./demo/pure-tree-codec";

const element = <T extends HTMLElement>(id: string): T => {
  const found = document.querySelector<T>(`#${id}`);
  if (found === null) throw new Error(`Missing UI element #${id}`);
  return found;
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const sortTab = element<HTMLButtonElement>("sort-tab");
const codecTab = element<HTMLButtonElement>("codec-tab");
const treeTab = element<HTMLButtonElement>("tree-tab");
const sortPanel = element<HTMLElement>("sort-demo");
const codecPanel = element<HTMLElement>("codec-demo");
const treePanel = element<HTMLElement>("tree-demo");
const demoExplainer = element<HTMLParagraphElement>("demo-explainer");

type DemoName = "sort" | "codec" | "tree";

const selectDemo = (selected: DemoName): void => {
  const sortSelected = selected === "sort";
  const codecSelected = selected === "codec";
  const treeSelected = selected === "tree";
  sortTab.setAttribute("aria-selected", String(sortSelected));
  codecTab.setAttribute("aria-selected", String(codecSelected));
  treeTab.setAttribute("aria-selected", String(treeSelected));
  sortTab.tabIndex = sortSelected ? 0 : -1;
  codecTab.tabIndex = codecSelected ? 0 : -1;
  treeTab.tabIndex = treeSelected ? 0 : -1;
  sortPanel.hidden = !sortSelected;
  codecPanel.hidden = !codecSelected;
  treePanel.hidden = !treeSelected;
  demoExplainer.innerHTML =
    selected === "sort"
      ? "<strong>同じsort4を両方向に実行します。</strong> <code>call</code>後の出力は編集可能です。<code>uncall</code>はtraceから分岐を復元し、変更後の出力に対応する別の入力を求めます。"
      : selected === "codec"
        ? "<strong>encodeしか書きません。</strong> <code>call encode</code>後の暗号文は編集可能です。<code>uncall encode</code>は変更後の暗号文から、同じprogramの逆実行で別の平文を求めます。"
        : "<strong>葉の位置をpathへ移します。</strong> <code>call encode_path</code>はループでrootへ上がり、<code>uncall</code>はbitをpopしながら同じ木を葉まで降ります。";
};

sortTab.addEventListener("click", () => selectDemo("sort"));
codecTab.addEventListener("click", () => selectDemo("codec"));
treeTab.addEventListener("click", () => selectDemo("tree"));

// Reversible sort
const sortSource = element<HTMLTextAreaElement>("pure-source");
const sortCallButton = element<HTMLButtonElement>("pure-call");
const sortUncallButton = element<HTMLButtonElement>("pure-uncall");
const sortResetButton = element<HTMLButtonElement>("pure-reset");
const sortStatus = element<HTMLParagraphElement>("pure-status");
const sortPhaseLabel = element<HTMLElement>("pure-phase");
const sortValuesHint = element<HTMLElement>("pure-values-hint");
const sortValueInputs = [
  ...document.querySelectorAll<HTMLInputElement>("[data-pure-value]"),
];
const sortTraceItems = [
  ...document.querySelectorAll<HTMLElement>("[data-pure-trace]"),
];

type SortPhase = "initial" | "called" | "restored" | "error";
let sortPhase: SortPhase = "initial";
let sortInitialState: PureSortState = {
  values: [...INITIAL_PURE_SORT_STATE.values],
  trace: [...INITIAL_PURE_SORT_STATE.trace],
};
let sortState: PureSortState = sortInitialState;

const renderSort = (): void => {
  sortValueInputs.forEach((input, index) => {
    input.value = String(sortState.values[index] ?? 0);
    input.disabled = false;
    input.classList.toggle("is-output", sortPhase === "called");
  });
  sortTraceItems.forEach((item, index) => {
    const value = sortState.trace[index] ?? 0;
    const number = item.querySelector<HTMLElement>("strong");
    const meaning = item.querySelector<HTMLElement>("span");
    if (number !== null) number.textContent = String(value);
    if (meaning !== null) {
      meaning.textContent =
        sortPhase === "called" ? (value === 0 ? "kept" : "swapped") : "empty";
    }
    item.classList.toggle("trace-bit--swap", sortPhase === "called" && value !== 0);
    item.classList.toggle("trace-bit--keep", sortPhase === "called" && value === 0);
  });
  for (const stage of document.querySelectorAll<HTMLElement>("[data-pure-stage]")) {
    const name = stage.dataset.pureStage;
    const active =
      (sortPhase === "initial" && name === "initial") ||
      (sortPhase === "called" && name === "called") ||
      (sortPhase === "restored" && name === "restored");
    stage.classList.toggle("is-active", active);
    stage.classList.toggle(
      "is-done",
      sortPhase === "called"
        ? name === "initial"
        : sortPhase === "restored"
          ? name === "initial" || name === "called" || name === "restored"
          : false,
    );
  }
  sortCallButton.disabled = sortPhase === "called";
  sortUncallButton.disabled = sortPhase !== "called";
  sortSource.disabled = sortPhase === "called";
  sortPhaseLabel.textContent = sortPhase;
  sortValuesHint.textContent =
    sortPhase === "called"
      ? "edit output, then uncall"
      : sortPhase === "restored"
        ? "backward result"
        : "edit initial state";
};

const readSortValues = (): number[] =>
  sortValueInputs.map((input) => {
    const value = input.valueAsNumber;
    if (!Number.isInteger(value)) {
      throw new Error("Every value must be an integer.");
    }
    return value;
  });

const readSortState = (): PureSortState => ({
  values: readSortValues(),
  trace: [0, 0, 0, 0, 0],
});

sortCallButton.addEventListener("click", () => {
  try {
    sortInitialState = readSortState();
    sortState = callPureSort(sortSource.value, sortInitialState);
    sortPhase = "called";
    sortStatus.className = "status";
    sortStatus.innerHTML = `<strong>Forward complete.</strong> Edit the cyan output before Uncall, or leave it unchanged for an exact round trip. trace = [${sortState.trace.join(",")}].`;
  } catch (error) {
    sortPhase = "error";
    sortStatus.className = "status is-error";
    sortStatus.textContent = error instanceof Error ? error.message : String(error);
  }
  renderSort();
});

sortUncallButton.addEventListener("click", () => {
  try {
    const backwardInput: PureSortState = {
      values: readSortValues(),
      trace: [...sortState.trace],
    };
    const outputEdited =
      JSON.stringify(backwardInput) !== JSON.stringify(sortState);
    const restored = uncallPureSort(sortSource.value, backwardInput);
    const verified = JSON.stringify(restored) === JSON.stringify(sortInitialState);
    sortState = restored;
    sortPhase = "restored";
    sortStatus.className = "status is-verified";
    sortStatus.innerHTML = outputEdited
      ? `<strong>Backward from edited output.</strong> It maps to [${restored.values.join(", ")}], instead of the original [${sortInitialState.values.join(", ")}].`
      : verified
        ? "<strong>Exact round trip.</strong> Original ordering restored; trace returned to zero."
        : "<strong>Backward complete.</strong> The result differs from the original input.";
  } catch (error) {
    sortStatus.className = "status is-error";
    sortStatus.textContent = `Backward rejected this output: ${error instanceof Error ? error.message : String(error)}`;
    return;
  }
  renderSort();
});

sortValueInputs.forEach((input) => {
  input.addEventListener("input", () => {
    if (sortPhase !== "called") return;
    sortStatus.className = "status";
    sortStatus.innerHTML =
      "<strong>Output edited.</strong> Uncall will run backward from these values using the recorded trace.";
  });
});

sortResetButton.addEventListener("click", () => {
  sortSource.value = PURE_SORT_SOURCE;
  sortInitialState = {
    values: [...INITIAL_PURE_SORT_STATE.values],
    trace: [...INITIAL_PURE_SORT_STATE.trace],
  };
  sortState = sortInitialState;
  sortPhase = "initial";
  sortStatus.className = "status";
  sortStatus.innerHTML = "<strong>Ready.</strong> Call the program forward.";
  renderSort();
});

// Encoder whose inverse execution is the decoder
const codecSource = element<HTMLTextAreaElement>("codec-source");
const codecInput = element<HTMLInputElement>("codec-input");
const codecShift = element<HTMLInputElement>("codec-shift");
const codecWord = element<HTMLParagraphElement>("codec-word");
const codecCallButton = element<HTMLButtonElement>("codec-call");
const codecUncallButton = element<HTMLButtonElement>("codec-uncall");
const codecResetButton = element<HTMLButtonElement>("codec-reset");
const codecStatus = element<HTMLParagraphElement>("codec-status");
const codecPhaseLabel = element<HTMLElement>("codec-phase");
const codecMessageLabel = element<HTMLElement>("codec-message-label");
const codecShiftLabel = element<HTMLElement>("codec-shift-label");
const codecCharItems = [
  ...document.querySelectorAll<HTMLElement>("[data-codec-char]"),
];

type CodecPhase = "initial" | "called" | "restored" | "error";
let codecPhase: CodecPhase = "initial";
let codecInitialState: PureCodecState = {
  message: [...INITIAL_PURE_CODEC_STATE.message],
  shift: INITIAL_PURE_CODEC_STATE.shift,
};
let codecState: PureCodecState = codecInitialState;

const renderCodec = (): void => {
  const text = codecText(codecState);
  codecInput.value = text;
  codecShift.value = String(codecState.shift);
  codecInput.disabled = false;
  codecShift.disabled = false;
  codecInput.classList.toggle("is-output", codecPhase === "called");
  codecShift.classList.toggle("is-output", codecPhase === "called");
  codecSource.disabled = codecPhase === "called";
  codecWord.textContent = text;
  codecCharItems.forEach((item, index) => {
    const code = codecState.message[index] ?? 0;
    const character = item.querySelector<HTMLElement>("strong");
    const number = item.querySelector<HTMLElement>("code");
    if (character !== null) character.textContent = String.fromCodePoint(code);
    if (number !== null) number.textContent = String(code);
  });
  for (const stage of document.querySelectorAll<HTMLElement>("[data-codec-stage]")) {
    const name = stage.dataset.codecStage;
    const active =
      (codecPhase === "initial" && name === "initial") ||
      (codecPhase === "called" && name === "called") ||
      (codecPhase === "restored" && name === "restored");
    stage.classList.toggle("is-active", active);
    stage.classList.toggle(
      "is-done",
      codecPhase === "called"
        ? name === "initial"
        : codecPhase === "restored"
          ? name === "initial" || name === "called" || name === "restored"
          : false,
    );
  }
  codecCallButton.disabled = codecPhase === "called";
  codecUncallButton.disabled = codecPhase !== "called";
  codecPhaseLabel.textContent = codecPhase;
  codecMessageLabel.textContent =
    codecPhase === "called" ? "encoded output · editable" : "5-character message";
  codecShiftLabel.textContent =
    codecPhase === "called" ? "shift · editable" : "shift";
};

const readCodecState = (): PureCodecState => {
  const characters = Array.from(codecInput.value);
  if (characters.length !== 5) {
    throw new Error("Message must contain exactly 5 characters.");
  }
  return {
    message: characters.map((character) => character.codePointAt(0) ?? 0),
    shift: Number(codecShift.value),
  };
};

codecCallButton.addEventListener("click", () => {
  try {
    codecInitialState = readCodecState();
    codecState = callPureEncode(codecSource.value, codecInitialState);
    codecPhase = "called";
    codecStatus.className = "status";
    codecStatus.innerHTML = `<strong>Encoded.</strong> ${escapeHtml(codecText(codecInitialState))} → ${escapeHtml(codecText(codecState))}. Edit the cyan output before Uncall to decode a different message.`;
  } catch (error) {
    codecPhase = "error";
    codecStatus.className = "status is-error";
    codecStatus.textContent = error instanceof Error ? error.message : String(error);
  }
  renderCodec();
});

codecUncallButton.addEventListener("click", () => {
  try {
    const backwardInput = readCodecState();
    const outputEdited =
      JSON.stringify(backwardInput) !== JSON.stringify(codecState);
    const restored = uncallPureEncode(codecSource.value, backwardInput);
    const verified = JSON.stringify(restored) === JSON.stringify(codecInitialState);
    codecState = restored;
    codecPhase = "restored";
    codecStatus.className = "status is-verified";
    codecStatus.innerHTML = outputEdited
      ? `<strong>Decoded from edited output.</strong> It becomes ${escapeHtml(codecText(restored))}, instead of the original ${escapeHtml(codecText(codecInitialState))}.`
      : verified
        ? "<strong>Decoded by uncall.</strong> The exact original message is back."
        : "<strong>Backward complete.</strong> The result differs from the original message.";
  } catch (error) {
    codecStatus.className = "status is-error";
    codecStatus.textContent = `Backward rejected this output: ${error instanceof Error ? error.message : String(error)}`;
    return;
  }
  renderCodec();
});

const previewEditedCodecOutput = (): void => {
  if (codecPhase !== "called") return;
  const characters = Array.from(codecInput.value);
  codecWord.textContent = codecInput.value;
  codecCharItems.forEach((item, index) => {
    const characterValue = characters[index] ?? "";
    const character = item.querySelector<HTMLElement>("strong");
    const number = item.querySelector<HTMLElement>("code");
    if (character !== null) character.textContent = characterValue;
    if (number !== null) {
      number.textContent =
        characterValue === "" ? "—" : String(characterValue.codePointAt(0));
    }
  });
  codecStatus.className = "status";
  codecStatus.innerHTML =
    "<strong>Output edited.</strong> Uncall will decode from this modified state.";
};

codecInput.addEventListener("input", previewEditedCodecOutput);
codecShift.addEventListener("input", previewEditedCodecOutput);

codecResetButton.addEventListener("click", () => {
  codecSource.value = PURE_CODEC_SOURCE;
  codecInitialState = {
    message: [...INITIAL_PURE_CODEC_STATE.message],
    shift: INITIAL_PURE_CODEC_STATE.shift,
  };
  codecState = codecInitialState;
  codecPhase = "initial";
  codecStatus.className = "status";
  codecStatus.innerHTML =
    "<strong>Ready.</strong> Call encode. Then uncall the same procedure to decode.";
  renderCodec();
});

// Fixed tree whose leaf identity becomes a reversible path stack
const treeSource = element<HTMLTextAreaElement>("tree-source");
const treeCallButton = element<HTMLButtonElement>("tree-call");
const treeUncallButton = element<HTMLButtonElement>("tree-uncall");
const treeResetButton = element<HTMLButtonElement>("tree-reset");
const treeStatus = element<HTMLParagraphElement>("tree-status");
const treePhaseLabel = element<HTMLElement>("tree-phase");
const treeNodeValue = element<HTMLElement>("tree-node-value");
const treeDepthValue = element<HTMLElement>("tree-depth-value");
const treeTempValue = element<HTMLElement>("tree-temp-value");
const treeTempRegister = element<HTMLElement>("tree-temp-register");
const treeRoute = element<HTMLElement>("tree-route");
const treeProofSymbol = element<HTMLElement>("tree-proof-symbol");
const treeProofResult = element<HTMLElement>("tree-proof-result");
const treeLeafButtons = [
  ...document.querySelectorAll<HTMLButtonElement>("[data-tree-leaf]"),
];
const treeNodes = [
  ...document.querySelectorAll<SVGElement>("[data-tree-node]"),
];
const treeEdges = [
  ...document.querySelectorAll<SVGElement>("[data-tree-edge]"),
];
const treeEdgeLabels = [
  ...document.querySelectorAll<SVGElement>("[data-tree-edge-label]"),
];
const treePathSlots = [
  ...document.querySelectorAll<HTMLElement>("[data-tree-path]"),
];

const TREE_SYMBOLS: Readonly<Record<number, string>> = {
  0: "ROOT",
  1: "A",
  3: "B",
  5: "C",
  6: "D",
};

type TreePhase = "initial" | "called" | "restored" | "error";
let treePhase: TreePhase = "initial";
let selectedTreeLeaf = 5;
let treeInitialState = treeCodecStateForLeaf(selectedTreeLeaf);
let treeState: PureTreeCodecState = treeInitialState;

const treeSymbol = (node: number): string => TREE_SYMBOLS[node] ?? `node ${node}`;

const encodedTreeNodes = (): Set<number> => {
  const route = new Set<number>();
  let cursor = treeInitialState.node;
  for (let remaining = treeInitialState.parent.length; remaining > 0; remaining -= 1) {
    route.add(cursor);
    if (cursor === treeInitialState.root) break;
    cursor = treeInitialState.parent[cursor] ?? treeInitialState.root;
  }
  return route;
};

const renderTree = (): void => {
  const routeNodes = treePhase === "called" ? encodedTreeNodes() : new Set<number>();
  const symbol = treeSymbol(selectedTreeLeaf);

  treeLeafButtons.forEach((button) => {
    const leaf = Number(button.dataset.treeLeaf);
    button.classList.toggle("is-selected", leaf === selectedTreeLeaf);
    button.disabled = treePhase === "called";
  });

  treeNodes.forEach((nodeElement) => {
    const node = Number(nodeElement.dataset.treeNode);
    nodeElement.classList.toggle("is-current", node === treeState.node);
    nodeElement.classList.toggle("is-origin", node === selectedTreeLeaf);
    nodeElement.classList.toggle("is-route", routeNodes.has(node));
  });
  treeEdges.forEach((edge) => {
    const child = Number(edge.dataset.treeEdge);
    edge.classList.toggle("is-route", routeNodes.has(child));
  });
  treeEdgeLabels.forEach((label) => {
    const child = Number(label.dataset.treeEdgeLabel);
    label.classList.toggle("is-route", routeNodes.has(child));
  });

  treePathSlots.forEach((slot, index) => {
    const used = index < treeState.depth;
    const value = slot.querySelector<HTMLElement>("strong");
    if (value !== null) value.textContent = used ? String(treeState.path[index]) : "·";
    slot.classList.toggle("is-used", used);
  });

  treeNodeValue.textContent = `${treeState.node} · ${treeSymbol(treeState.node)}`;
  treeDepthValue.textContent = String(treeState.depth);
  treeTempValue.textContent =
    treeState.temp === 0 ? "0 · clean" : `${treeState.temp} · not clean`;
  treeTempRegister.classList.toggle("is-clean", treeState.temp === 0);
  treeRoute.textContent = treePhase === "called" ? treePathCode(treeState) : "—";
  treeProofSymbol.textContent = symbol;
  treeProofResult.textContent = symbol;
  treePhaseLabel.textContent = treePhase;
  treeSource.disabled = treePhase === "called";
  treeCallButton.disabled = treePhase === "called";
  treeUncallButton.disabled = treePhase !== "called";

  for (const stage of document.querySelectorAll<HTMLElement>("[data-tree-stage]")) {
    const name = stage.dataset.treeStage;
    const active =
      (treePhase === "initial" && name === "initial") ||
      (treePhase === "called" && name === "called") ||
      (treePhase === "restored" && name === "restored");
    stage.classList.toggle("is-active", active);
    stage.classList.toggle(
      "is-done",
      treePhase === "called"
        ? name === "initial"
        : treePhase === "restored"
          ? name === "initial" || name === "called" || name === "restored"
          : false,
    );
  }
};

treeLeafButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectedTreeLeaf = Number(button.dataset.treeLeaf);
    treeInitialState = treeCodecStateForLeaf(selectedTreeLeaf);
    treeState = treeInitialState;
    treePhase = "initial";
    treeStatus.className = "status";
    treeStatus.innerHTML = `<strong>${treeSymbol(selectedTreeLeaf)} selected.</strong> Call the loop to move this leaf identity into a path stack.`;
    renderTree();
  });
});

treeCallButton.addEventListener("click", () => {
  try {
    treeInitialState = treeCodecStateForLeaf(selectedTreeLeaf);
    treeState = callTreePathEncode(treeSource.value, treeInitialState);
    treePhase = "called";
    treeStatus.className = "status";
    treeStatus.innerHTML = `<strong>Encoded ${treeSymbol(selectedTreeLeaf)} → ${treePathCode(treeState)}.</strong> The cursor climbed ${treeState.depth} edge${treeState.depth === 1 ? "" : "s"}; temp returned to zero.`;
  } catch (error) {
    treePhase = "error";
    treeStatus.className = "status is-error";
    treeStatus.textContent = error instanceof Error ? error.message : String(error);
  }
  renderTree();
});

treeUncallButton.addEventListener("click", () => {
  try {
    const restored = uncallTreePathEncode(treeSource.value, treeState);
    const verified = JSON.stringify(restored) === JSON.stringify(treeInitialState);
    treeState = restored;
    treePhase = "restored";
    treeStatus.className = verified ? "status is-verified" : "status is-error";
    treeStatus.innerHTML = verified
      ? `<strong>Exact leaf restored.</strong> Uncall popped the route back to ${treeSymbol(restored.node)}; path, depth, and temp are zero again.`
      : "<strong>Round trip mismatch.</strong> The edited program did not restore the original tree state.";
  } catch (error) {
    treeStatus.className = "status is-error";
    treeStatus.textContent = `Backward rejected this state: ${error instanceof Error ? error.message : String(error)}`;
    return;
  }
  renderTree();
});

treeResetButton.addEventListener("click", () => {
  treeSource.value = PURE_TREE_CODEC_SOURCE;
  selectedTreeLeaf = 5;
  treeInitialState = treeCodecStateForLeaf(selectedTreeLeaf);
  treeState = treeInitialState;
  treePhase = "initial";
  treeStatus.className = "status";
  treeStatus.innerHTML =
    "<strong>Ready.</strong> Choose a leaf, then call the loop to encode its route.";
  renderTree();
});

renderSort();
renderCodec();
renderTree();
const requestedDemo = new URLSearchParams(window.location.search).get("demo");
selectDemo(requestedDemo === "codec" || requestedDemo === "tree" ? requestedDemo : "sort");
