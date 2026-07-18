import { compileJanus, type StateInput, type StateSnapshot } from "../janus";

export const PURE_SORT_SOURCE = `values[4]
trace[5]

procedure sort4()
    if values[0] > values[1] then
        values[0] <=> values[1]
        trace[0] += 1
    else skip
    fi trace[0] # 0

    if values[2] > values[3] then
        values[2] <=> values[3]
        trace[1] += 1
    else skip
    fi trace[1] # 0

    if values[0] > values[2] then
        values[0] <=> values[2]
        trace[2] += 1
    else skip
    fi trace[2] # 0

    if values[1] > values[3] then
        values[1] <=> values[3]
        trace[3] += 1
    else skip
    fi trace[3] # 0

    if values[1] > values[2] then
        values[1] <=> values[2]
        trace[4] += 1
    else skip
    fi trace[4] # 0`;

export type PureSortState = {
  readonly values: readonly number[];
  readonly trace: readonly number[];
};

export const INITIAL_PURE_SORT_STATE: PureSortState = {
  values: [4, 1, 3, 2],
  trace: [0, 0, 0, 0, 0],
};

const toSortState = (snapshot: StateSnapshot): PureSortState => {
  const values = snapshot.values;
  const trace = snapshot.trace;
  if (!Array.isArray(values) || values.length !== 4) {
    throw new Error("The program must declare values[4].");
  }
  if (!Array.isArray(trace) || trace.length !== 5) {
    throw new Error("The program must declare trace[5].");
  }
  return { values: [...values], trace: [...trace] };
};

const inputOf = (state: PureSortState): StateInput => ({
  values: state.values,
  trace: state.trace,
});

export const callPureSort = (
  source: string,
  state: PureSortState,
): PureSortState => toSortState(compileJanus(source).call("sort4", inputOf(state)));

export const uncallPureSort = (
  source: string,
  state: PureSortState,
): PureSortState => toSortState(compileJanus(source).uncall("sort4", inputOf(state)));
