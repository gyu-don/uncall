import { describe, expect, it } from "vitest";
import {
  callPureSort,
  INITIAL_PURE_SORT_STATE,
  PURE_SORT_SOURCE,
  uncallPureSort,
} from "../src/demo/pure-sort";

const permutations = (values: readonly number[]): number[][] => {
  if (values.length === 0) return [[]];
  return values.flatMap((value, index) =>
    permutations(values.filter((_, candidate) => candidate !== index)).map(
      (rest) => [value, ...rest],
    ),
  );
};

describe("Pure Janus reversible sort demo", () => {
  it("shows the expected trace and restores both arrays", () => {
    const sorted = callPureSort(PURE_SORT_SOURCE, INITIAL_PURE_SORT_STATE);

    expect(sorted).toEqual({
      values: [1, 2, 3, 4],
      trace: [1, 1, 0, 1, 1],
    });
    expect(uncallPureSort(PURE_SORT_SOURCE, sorted)).toEqual(
      INITIAL_PURE_SORT_STATE,
    );
  });

  it("sorts and exactly restores all 24 permutations", () => {
    for (const values of permutations([1, 2, 3, 4])) {
      const initial = { values, trace: [0, 0, 0, 0, 0] };
      const sorted = callPureSort(PURE_SORT_SOURCE, initial);

      expect(sorted.values).toEqual([1, 2, 3, 4]);
      expect(uncallPureSort(PURE_SORT_SOURCE, sorted)).toEqual(initial);
    }
  });

  it("maps an edited forward output to a different input", () => {
    const sorted = callPureSort(PURE_SORT_SOURCE, INITIAL_PURE_SORT_STATE);
    const editedOutput = { ...sorted, values: [10, 20, 30, 40] };

    expect(uncallPureSort(PURE_SORT_SOURCE, editedOutput)).toEqual({
      values: [40, 10, 30, 20],
      trace: [0, 0, 0, 0, 0],
    });
  });
});
