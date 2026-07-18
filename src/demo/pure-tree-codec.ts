import { compileJanus, type StateInput, type StateSnapshot } from "../janus";

export const PURE_TREE_CODEC_SOURCE = `parent[7]
left[7]
right[7]
side[7]
path[3]
node root depth temp

procedure encode_path()
    from depth = 0
    do
        path[depth] += side[node]

        temp += parent[node]
        node <=> temp

        if path[depth] = 0 then
            temp -= left[node]
        else
            temp -= right[node]
        fi path[depth] = 0

        depth += 1
    loop
    until node = root`;

export type PureTreeCodecState = {
  readonly parent: readonly number[];
  readonly left: readonly number[];
  readonly right: readonly number[];
  readonly side: readonly number[];
  readonly path: readonly number[];
  readonly node: number;
  readonly root: number;
  readonly depth: number;
  readonly temp: number;
};

const TREE_STATE = {
  parent: [0, 0, 0, 2, 2, 4, 4],
  left: [1, 0, 3, 0, 5, 0, 0],
  right: [2, 0, 4, 0, 6, 0, 0],
  side: [0, 0, 1, 0, 1, 0, 1],
} as const;

export const TREE_CODEC_LEAVES = [1, 3, 5, 6] as const;

export const treeCodecStateForLeaf = (node: number): PureTreeCodecState => {
  if (!TREE_CODEC_LEAVES.includes(node as (typeof TREE_CODEC_LEAVES)[number])) {
    throw new Error(`Node ${node} is not a selectable leaf.`);
  }
  return {
    parent: [...TREE_STATE.parent],
    left: [...TREE_STATE.left],
    right: [...TREE_STATE.right],
    side: [...TREE_STATE.side],
    path: [0, 0, 0],
    node,
    root: 0,
    depth: 0,
    temp: 0,
  };
};

export const INITIAL_PURE_TREE_CODEC_STATE = treeCodecStateForLeaf(5);

const arrayOf = (
  snapshot: StateSnapshot,
  name: string,
  length: number,
): readonly number[] => {
  const value = snapshot[name];
  if (!Array.isArray(value) || value.length !== length) {
    throw new Error(`The program must declare ${name}[${length}].`);
  }
  return [...value];
};

const scalarOf = (snapshot: StateSnapshot, name: string): number => {
  const value = snapshot[name];
  if (typeof value !== "number") {
    throw new Error(`The program must declare scalar ${name}.`);
  }
  return value;
};

const toTreeCodecState = (snapshot: StateSnapshot): PureTreeCodecState => ({
  parent: arrayOf(snapshot, "parent", 7),
  left: arrayOf(snapshot, "left", 7),
  right: arrayOf(snapshot, "right", 7),
  side: arrayOf(snapshot, "side", 7),
  path: arrayOf(snapshot, "path", 3),
  node: scalarOf(snapshot, "node"),
  root: scalarOf(snapshot, "root"),
  depth: scalarOf(snapshot, "depth"),
  temp: scalarOf(snapshot, "temp"),
});

const inputOf = (state: PureTreeCodecState): StateInput => ({
  parent: state.parent,
  left: state.left,
  right: state.right,
  side: state.side,
  path: state.path,
  node: state.node,
  root: state.root,
  depth: state.depth,
  temp: state.temp,
});

export const callTreePathEncode = (
  source: string,
  state: PureTreeCodecState,
): PureTreeCodecState =>
  toTreeCodecState(compileJanus(source).call("encode_path", inputOf(state)));

export const uncallTreePathEncode = (
  source: string,
  state: PureTreeCodecState,
): PureTreeCodecState =>
  toTreeCodecState(compileJanus(source).uncall("encode_path", inputOf(state)));

export const treePathCode = (state: PureTreeCodecState): string =>
  [...state.path]
    .slice(0, state.depth)
    .reverse()
    .join("");
