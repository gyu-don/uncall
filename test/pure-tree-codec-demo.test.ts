import { describe, expect, it } from "vitest";
import {
  callTreePathEncode,
  INITIAL_PURE_TREE_CODEC_STATE,
  PURE_TREE_CODEC_SOURCE,
  treeCodecStateForLeaf,
  treePathCode,
  uncallTreePathEncode,
} from "../src/demo/pure-tree-codec";

describe("Pure Janus tree path codec demo", () => {
  it("encodes C as a root-to-leaf route and exactly restores the leaf", () => {
    const encoded = callTreePathEncode(
      PURE_TREE_CODEC_SOURCE,
      INITIAL_PURE_TREE_CODEC_STATE,
    );

    expect(encoded).toMatchObject({
      node: 0,
      root: 0,
      depth: 3,
      temp: 0,
      path: [0, 1, 1],
    });
    expect(treePathCode(encoded)).toBe("110");
    expect(uncallTreePathEncode(PURE_TREE_CODEC_SOURCE, encoded)).toEqual(
      INITIAL_PURE_TREE_CODEC_STATE,
    );
  });

  it.each([
    [1, "0"],
    [3, "10"],
    [5, "110"],
    [6, "111"],
  ])("round-trips leaf node %i with route %s", (node, route) => {
    const initial = treeCodecStateForLeaf(node);
    const encoded = callTreePathEncode(PURE_TREE_CODEC_SOURCE, initial);

    expect(encoded.node).toBe(encoded.root);
    expect(encoded.temp).toBe(0);
    expect(treePathCode(encoded)).toBe(route);
    expect(uncallTreePathEncode(PURE_TREE_CODEC_SOURCE, encoded)).toEqual(initial);
  });

  it("decodes an edited forward output into a different leaf", () => {
    const encodedC = callTreePathEncode(
      PURE_TREE_CODEC_SOURCE,
      treeCodecStateForLeaf(5),
    );
    const editedToD = { ...encodedC, path: [1, 1, 1] };

    expect(uncallTreePathEncode(PURE_TREE_CODEC_SOURCE, editedToD)).toEqual(
      treeCodecStateForLeaf(6),
    );
  });
});
