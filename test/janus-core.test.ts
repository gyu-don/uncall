import { describe, expect, it } from "vitest";
import { StaticCheckError } from "../src/janus/checker";
import { parse } from "../src/janus/parser";
import {
  AssertionFailure,
  compileJanus,
  ExecutionLimitExceeded,
  JanusRuntimeError,
  StateValidationError,
} from "../src/janus/runtime";

describe("Janus reversible data core", () => {
  it("normalizes 32-bit arithmetic and reverses updates", () => {
    const module = compileJanus(`
      x a b truth remainder
      procedure calculate()
        x += a + b * 2
        truth += a < b
        remainder += -7 \\ 3
    `);
    const initial = { x: 2_147_483_647, a: 2, b: 3 };

    const forward = module.call("calculate", initial);

    expect(forward).toEqual({
      x: -2_147_483_639,
      a: 2,
      b: 3,
      truth: -1,
      remainder: -1,
    });
    expect(module.uncall("CALCULATE", forward)).toEqual({
      ...initial,
      truth: 0,
      remainder: 0,
    });
  });

  it("treats XOR and swap as self-inverse, including array elements", () => {
    const module = compileJanus(`
      a[3] i mask x
      procedure permute()
        a[i] ^= mask
        a[0] <=> a[2]
        x ^= mask
    `);
    const initial = { a: [1, 2, 3], i: 1, mask: 7, x: 12 };

    const forward = module.call("permute", initial);

    expect(forward).toEqual({ a: [3, 5, 1], i: 1, mask: 7, x: 11 });
    expect(module.uncall("permute", forward)).toEqual(initial);
  });

  it("satisfies forward/backward and backward/forward round trips over small integers", () => {
    const module = compileJanus(`
      x y delta mask
      procedure transform()
        x += delta
        y ^= mask
        x <=> y
    `);

    for (let x = -2; x <= 2; x += 1) {
      for (let y = -2; y <= 2; y += 1) {
        const initial = { x, y, delta: 2, mask: 3 };
        const forward = module.call("transform", initial);
        const backward = module.uncall("transform", initial);

        expect(module.uncall("transform", forward)).toEqual(initial);
        expect(module.call("transform", backward)).toEqual(initial);
      }
    }
  });

  it("evaluates both logical operands and reports zero division at its source", () => {
    const module = compileJanus(`
      x
      procedure fail()
        x += 0 & (1 / 0)
    `);

    expect(() => module.call("fail")).toThrowError(JanusRuntimeError);
    try {
      module.call("fail");
    } catch (error) {
      expect(error).toMatchObject({
        message: expect.stringContaining("Division by zero"),
        span: { start: { line: 4, column: 18 } },
      });
    }
  });

  it("rejects undeclared names, target-dependent updates, and unsafe swap indices", () => {
    expect(() =>
      compileJanus(`
        a[2] x
        procedure invalid()
          missing += 1
          x += x + 1
          a[0] += a[1]
          x <=> a[x]
      `),
    ).toThrowError(StaticCheckError);

    try {
      compileJanus(`
        a[2] x
        procedure invalid()
          missing += 1
          x += x + 1
          a[0] += a[1]
          x <=> a[x]
      `);
    } catch (error) {
      expect(error).toMatchObject({
        diagnostics: expect.arrayContaining([
          expect.objectContaining({ message: expect.stringContaining("Undeclared variable") }),
          expect.objectContaining({ message: expect.stringContaining("depends on its target") }),
          expect.objectContaining({ message: expect.stringContaining("Swap index depends") }),
        ]),
      });
    }
  });

  it("validates injected state and array bounds", () => {
    const module = compileJanus(`
      a[2] i
      procedure touch()
        a[i] += 1
    `);

    expect(() => module.call("touch", { a: [1] })).toThrowError(StateValidationError);
    expect(() => module.call("touch", { i: 2 })).toThrowError(/out of bounds/);
  });
});

describe("Janus reversible structured control", () => {
  const conditional = compileJanus(`
    x flag
    procedure choose()
      if flag = 0 then
        x += 5
        flag += 1
      else
        x -= 3
        flag -= 1
      fi flag # 0
  `);

  it.each([
    [{ x: 10, flag: 0 }, { x: 15, flag: 1 }],
    [{ x: 10, flag: 1 }, { x: 7, flag: 0 }],
  ])("round-trips both conditional branches", (initial, expected) => {
    const forward = conditional.call("choose", initial);

    expect(forward).toEqual(expected);
    expect(conditional.uncall("choose", forward)).toEqual(initial);
  });

  it("selects the backward branch from the exit assertion", () => {
    expect(conditional.uncall("choose", { x: 15, flag: 1 })).toEqual({
      x: 10,
      flag: 0,
    });
  });

  it("reports an assertion mismatch at the exit condition", () => {
    const module = compileJanus(`x
procedure bad()
  if x = 0 then x += 1 fi x = 0`);

    expect(() => module.call("bad")).toThrowError(AssertionFailure);
    try {
      module.call("bad");
    } catch (error) {
      expect(error).toMatchObject({ span: { start: { line: 3, column: 27 } } });
    }
  });
});

describe("Janus86 clean core", () => {
  it("accepts the historical aliases, comments, omitted empty clauses, and case-insensitive names", () => {
    const source = `
      X Y ; historical line comment
      PROCEDURE EXCHANGE
        X != 7
        X : Y
        FROM X # Y
        LOOP SKIP
        UNTIL X = Y
    `;
    const module = parse(source);

    expect(module.declarations.map((declaration) => declaration.name)).toEqual(["x", "y"]);
    expect(module.procedures[0]).toMatchObject({
      name: "exchange",
      body: [
        { kind: "UpdateStatement", operator: "^=" },
        { kind: "SwapStatement" },
        { kind: "LoopStatement", firstBody: [], nextBody: [{ kind: "SkipStatement" }] },
      ],
    });
  });

  it("executes loops in both directions", () => {
    const module = compileJanus(`
      i n
      procedure count()
        from i = 0
        loop i += 1
        until i = n
    `);
    const initial = { i: 0, n: 5 };

    const forward = module.call("count", initial);

    expect(forward).toEqual({ i: 5, n: 5 });
    expect(module.uncall("count", forward)).toEqual(initial);
  });

  it("supports recursive procedures and reverses the recursive call tree", () => {
    const module = compileJanus(`
      n sum
      procedure accumulate()
        if n > 0 then
          sum += n
          n -= 1
          call accumulate()
          n += 1
        else skip
        fi n > 0
    `);
    const initial = { n: 5, sum: 0 };

    const forward = module.call("accumulate", initial);

    expect(forward).toEqual({ n: 5, sum: 15 });
    expect(module.uncall("accumulate", forward)).toEqual(initial);
  });

  it("bounds recursion, total steps, and loop iterations", () => {
    const recursive = compileJanus(`procedure forever()
      call forever()`);
    expect(() => recursive.call("forever", {}, { callDepthBudget: 4 })).toThrowError(
      ExecutionLimitExceeded,
    );

    const loop = compileJanus(`x
      procedure forever()
        from x = 0
        loop x += 1
        until x < 0`);
    expect(() => loop.call("forever", {}, { loopIterationBudget: 3 })).toThrowError(
      ExecutionLimitExceeded,
    );
    expect(() => loop.call("forever", {}, { totalStepBudget: 2 })).toThrowError(
      ExecutionLimitExceeded,
    );
  });

  it("round-trips the published Janus factorization sample without READ/WRITE", () => {
    // Source: Lutz and Derby, JANUS: A TIME-REVERSIBLE LANGUAGE, factor procedure.
    const module = compileJanus(`
      NUM TRY Z I FACT[20]
      PROCEDURE FACTOR
        FROM (TRY=0) & (NUM>1)
        LOOP CALL NEXTTRY
          FROM FACT[I]#TRY
          LOOP I += 1
            FACT[I] += TRY
            Z += NUM/TRY
            Z : NUM
            Z -= NUM*TRY
          UNTIL (NUM\\TRY)#0
        UNTIL (TRY*TRY)>NUM
        IF NUM # 1
        THEN I += 1
          FACT[I] : NUM
        ELSE NUM -= 1
        FI FACT[I] # FACT[I-1]

        IF (FACT[I-1]*FACT[I-1]) < FACT[I]
        THEN FROM (TRY*TRY) > FACT[I]
          LOOP UNCALL NEXTTRY
          UNTIL TRY=0
        ELSE TRY -= FACT[I-1]
        FI (FACT[I-1]*FACT[I-1]) < FACT[I]
        CALL ZEROI

      PROCEDURE ZEROI
        FROM FACT[I+1] = 0
        LOOP I -= 1
        UNTIL I = 0

      PROCEDURE NEXTTRY
        TRY += 2
        IF TRY=4
        THEN TRY -= 1
        FI TRY=3
    `);
    const initial = { num: 12 };

    const forward = module.call("factor", initial);

    expect(forward).toMatchObject({ num: 0, try: 0, z: 0, i: 0 });
    expect((forward.fact as readonly number[]).slice(0, 4)).toEqual([0, 2, 2, 3]);
    expect(module.uncall("factor", forward)).toEqual({
      num: 12,
      try: 0,
      z: 0,
      i: 0,
      fact: Array.from({ length: 20 }, () => 0),
    });
  });
});
