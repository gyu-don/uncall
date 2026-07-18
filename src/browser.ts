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

const element = <T extends HTMLElement>(id: string): T => {
  const found = document.querySelector<T>(`#${id}`);
  if (found === null) throw new Error(`Missing UI element #${id}`);
  return found;
};

const sortTab = element<HTMLButtonElement>("sort-tab");
const codecTab = element<HTMLButtonElement>("codec-tab");
const sortPanel = element<HTMLElement>("sort-demo");
const codecPanel = element<HTMLElement>("codec-demo");
const demoExplainer = element<HTMLParagraphElement>("demo-explainer");

const selectDemo = (selected: "sort" | "codec"): void => {
  const sortSelected = selected === "sort";
  sortTab.setAttribute("aria-selected", String(sortSelected));
  codecTab.setAttribute("aria-selected", String(!sortSelected));
  sortTab.tabIndex = sortSelected ? 0 : -1;
  codecTab.tabIndex = sortSelected ? -1 : 0;
  sortPanel.hidden = !sortSelected;
  codecPanel.hidden = sortSelected;
  demoExplainer.innerHTML = sortSelected
    ? "<strong>同じsort4を両方向に実行します。</strong> <code>call</code>は値を並べ替え、<code>uncall</code>はtraceから分岐を復元して元の順番へ戻します。"
    : "<strong>encodeしか書きません。</strong> <code>call encode</code>は文字codeへshiftを足し、<code>uncall encode</code>は同じprogramを逆実行してshiftを引くため、そのままdecoderになります。";
};

sortTab.addEventListener("click", () => selectDemo("sort"));
codecTab.addEventListener("click", () => selectDemo("codec"));

// Reversible sort
const sortSource = element<HTMLTextAreaElement>("pure-source");
const sortCallButton = element<HTMLButtonElement>("pure-call");
const sortUncallButton = element<HTMLButtonElement>("pure-uncall");
const sortResetButton = element<HTMLButtonElement>("pure-reset");
const sortStatus = element<HTMLParagraphElement>("pure-status");
const sortPhaseLabel = element<HTMLElement>("pure-phase");
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
    input.disabled = sortPhase === "called";
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
};

const readSortState = (): PureSortState => ({
  values: sortValueInputs.map((input) => Number(input.value)),
  trace: [0, 0, 0, 0, 0],
});

sortCallButton.addEventListener("click", () => {
  try {
    sortInitialState = readSortState();
    sortState = callPureSort(sortSource.value, sortInitialState);
    sortPhase = "called";
    sortStatus.className = "status";
    sortStatus.innerHTML = `<strong>Forward complete.</strong> values is sorted; trace = [${sortState.trace.join(",")}] is enough to reverse it.`;
  } catch (error) {
    sortPhase = "error";
    sortStatus.className = "status is-error";
    sortStatus.textContent = error instanceof Error ? error.message : String(error);
  }
  renderSort();
});

sortUncallButton.addEventListener("click", () => {
  try {
    const restored = uncallPureSort(sortSource.value, sortState);
    const verified = JSON.stringify(restored) === JSON.stringify(sortInitialState);
    sortState = restored;
    sortPhase = "restored";
    sortStatus.className = `status${verified ? " is-verified" : " is-error"}`;
    sortStatus.innerHTML = verified
      ? "<strong>Exact round trip.</strong> Original ordering restored; trace returned to zero."
      : "<strong>Round trip mismatch.</strong> The edited program did not restore the input.";
  } catch (error) {
    sortPhase = "error";
    sortStatus.className = "status is-error";
    sortStatus.textContent = error instanceof Error ? error.message : String(error);
  }
  renderSort();
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
  codecInput.disabled = codecPhase === "called";
  codecShift.disabled = codecPhase === "called";
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
    codecStatus.innerHTML = `<strong>Encoded.</strong> ${codecText(codecInitialState)} → ${codecText(codecState)}. No decoder has been written.`;
  } catch (error) {
    codecPhase = "error";
    codecStatus.className = "status is-error";
    codecStatus.textContent = error instanceof Error ? error.message : String(error);
  }
  renderCodec();
});

codecUncallButton.addEventListener("click", () => {
  try {
    const restored = uncallPureEncode(codecSource.value, codecState);
    const verified = JSON.stringify(restored) === JSON.stringify(codecInitialState);
    codecState = restored;
    codecPhase = "restored";
    codecStatus.className = `status${verified ? " is-verified" : " is-error"}`;
    codecStatus.innerHTML = verified
      ? "<strong>Decoded by uncall.</strong> The exact original message is back."
      : "<strong>Round trip mismatch.</strong> The edited program did not restore the message.";
  } catch (error) {
    codecPhase = "error";
    codecStatus.className = "status is-error";
    codecStatus.textContent = error instanceof Error ? error.message : String(error);
  }
  renderCodec();
});

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

renderSort();
renderCodec();
selectDemo(
  new URLSearchParams(window.location.search).get("demo") === "codec"
    ? "codec"
    : "sort",
);
