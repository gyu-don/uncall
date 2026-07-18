import { describe, expect, it } from "vitest";
import {
  callPureEncode,
  codecText,
  INITIAL_PURE_CODEC_STATE,
  PURE_CODEC_SOURCE,
  uncallPureEncode,
} from "../src/demo/pure-codec";

describe("Pure Janus encoder/decoder demo", () => {
  it("uses call as encode and uncall as decode", () => {
    const encoded = callPureEncode(PURE_CODEC_SOURCE, INITIAL_PURE_CODEC_STATE);

    expect(codecText(INITIAL_PURE_CODEC_STATE)).toBe("HELLO");
    expect(encoded).toEqual({ message: [75, 72, 79, 79, 82], shift: 3 });
    expect(codecText(encoded)).toBe("KHOOR");
    expect(uncallPureEncode(PURE_CODEC_SOURCE, encoded)).toEqual(
      INITIAL_PURE_CODEC_STATE,
    );
  });

  it("round-trips a different message and shift without decoder code", () => {
    const initial = { message: [74, 65, 78, 85, 83], shift: 7 };

    expect(
      uncallPureEncode(
        PURE_CODEC_SOURCE,
        callPureEncode(PURE_CODEC_SOURCE, initial),
      ),
    ).toEqual(initial);
  });

  it("decodes an edited encoded output to a different message", () => {
    const encoded = callPureEncode(PURE_CODEC_SOURCE, INITIAL_PURE_CODEC_STATE);
    const editedOutput = { ...encoded, message: [90, 72, 79, 79, 82] };
    const decoded = uncallPureEncode(PURE_CODEC_SOURCE, editedOutput);

    expect(codecText(decoded)).toBe("WELLO");
    expect(decoded.shift).toBe(3);
  });
});
