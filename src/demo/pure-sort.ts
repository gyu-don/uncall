import { compileJanus, type StateInput, type StateSnapshot } from "../janus";

export const PURE_SORT_SOURCE = `values[4]
trace[6]
length pass index step

procedure compare()
    if values[index] > values[index + 1] then
        values[index] <=> values[index + 1]
        trace[step] += 1
    else skip
    fi trace[step] # 0
    step += 1

procedure bubble_pass()
    from index = 0 do
        call compare()
    loop
        index += 1
    until index = (length - pass - 2)
    index -= length
    index += pass
    index += 2

procedure sort()
    if length > 1 then
        from pass = 0 do
            call bubble_pass()
        loop
            pass += 1
        until pass = (length - 2)
        pass -= length
        pass += 2
        step -= length * (length - 1) / 2
    else skip
    fi length > 1`;

export type PureSortState = {
  readonly values: readonly number[];
  readonly trace: readonly number[];
  readonly length: number;
};

export const INITIAL_PURE_SORT_STATE: PureSortState = {
  values: [4, 1, 3, 2],
  trace: [0, 0, 0, 0, 0, 0],
  length: 4,
};

const toSortState = (snapshot: StateSnapshot): PureSortState => {
  const values = snapshot.values;
  const trace = snapshot.trace;
  if (!Array.isArray(values) || values.length !== 4) {
    throw new Error("The program must declare values[4].");
  }
  if (!Array.isArray(trace) || trace.length !== 6) {
    throw new Error("The program must declare trace[6].");
  }
  const length = snapshot.length;
  if (
    typeof length !== "number" ||
    !Number.isInteger(length) ||
    length < 0 ||
    length > values.length
  ) {
    throw new Error("The program must preserve a length from 0 through 4.");
  }
  for (const scratch of ["pass", "index", "step"] as const) {
    if (snapshot[scratch] !== 0) {
      throw new Error(`The program must return scratch variable ${scratch} to zero.`);
    }
  }
  return { values: [...values], trace: [...trace], length };
};

const inputOf = (state: PureSortState): StateInput => ({
  values: state.values,
  trace: state.trace,
  length: state.length,
  pass: 0,
  index: 0,
  step: 0,
});

export const callPureSort = (
  source: string,
  state: PureSortState,
): PureSortState => toSortState(compileJanus(source).call("sort", inputOf(state)));

export const uncallPureSort = (
  source: string,
  state: PureSortState,
): PureSortState => toSortState(compileJanus(source).uncall("sort", inputOf(state)));
