import { compileJanus, type StateInput, type StateSnapshot } from "../janus";

export const PURE_CODEC_SOURCE = `message[5]
shift

procedure encode()
    message[0] += shift
    message[1] += shift
    message[2] += shift
    message[3] += shift
    message[4] += shift`;

export type PureCodecState = {
  readonly message: readonly number[];
  readonly shift: number;
};

export const INITIAL_PURE_CODEC_STATE: PureCodecState = {
  message: [72, 69, 76, 76, 79],
  shift: 3,
};

const toCodecState = (snapshot: StateSnapshot): PureCodecState => {
  const message = snapshot.message;
  const shift = snapshot.shift;
  if (!Array.isArray(message) || message.length !== 5) {
    throw new Error("The program must declare message[5].");
  }
  if (typeof shift !== "number") {
    throw new Error("The program must declare scalar shift.");
  }
  return { message: [...message], shift };
};

const inputOf = (state: PureCodecState): StateInput => ({
  message: state.message,
  shift: state.shift,
});

export const callPureEncode = (
  source: string,
  state: PureCodecState,
): PureCodecState =>
  toCodecState(compileJanus(source).call("encode", inputOf(state)));

export const uncallPureEncode = (
  source: string,
  state: PureCodecState,
): PureCodecState =>
  toCodecState(compileJanus(source).uncall("encode", inputOf(state)));

export const codecText = (state: PureCodecState): string =>
  String.fromCodePoint(...state.message);
