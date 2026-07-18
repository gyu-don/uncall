# UNCALL

[日本語](README-ja.md)

**One program. Both directions.**

UNCALL is an implementation of the reversible programming language Janus. `call` executes a procedure forward; `uncall` executes that same procedure backward. There is no generated or separately implemented decoder, unsorter, or undo program.

The browser demo directly runs this repository's Pure Janus parser, static checker, resolver, and forward/backward evaluator.

## Two demos

**Reversible Sort** uses five comparators to turn `[4, 1, 3, 2]` into `[1, 2, 3, 4]`, recording the branch history as `trace = [1, 1, 0, 1, 1]`. `uncall sort4` reconstructs the control flow and restores both the original order and the all-zero trace.

**Encode and Decode** defines only an `encode` procedure that shifts five character codes. `call encode` is the encoder; `uncall encode` is the decoder.

```janus
message[5]
shift

procedure encode()
    message[0] += shift
    message[1] += shift
    message[2] += shift
    message[3] += shift
    message[4] += shift
```

For example, `HELLO` with shift `3` becomes `KHOOR`, and uncalling the same `encode` procedure restores `HELLO`.

## Try the demo

Requirements:

- Node.js 22 or newer
- npm

```sh
npm install
npm run dev
```

Wrangler prints the local URL, normally `http://localhost:8787`.

1. In **Reversible Sort**, call `sort4` and inspect the sorted values and five branch bits.
2. Uncall `sort4` and verify that the exact input order and zero trace return.
3. In **Encode and Decode**, call `encode` and watch `HELLO` become `KHOOR`.
4. Without adding a decoder, uncall `encode` and verify that `HELLO` returns.

Run the repository checks with:

```sh
npm run typecheck
npm test
```

## What is guaranteed

UNCALL separates guarantees derived from program structure from the code that must still be trusted.

| Derived by the runtime | Trusted and reviewed at the primitive boundary |
| --- | --- |
| Statements run in reverse order during `uncall` | Forward and backward handlers represent the intended pair |
| `call` and `uncall` exchange direction | A receipt contains enough information to undo safely |
| Only successfully completed actions are compensated after failure | Exact, checked, compensating, or irreversible classification is appropriate |
| Every callable effect must have both directions before execution | Drift and postcondition checks are strict enough for the resource |
| A procedure change updates its inverse plan | External APIs obey their documented behavior |

Pure Janus computation and external effects are intentionally different layers:

- `src/janus` is a synchronous Janus86 clean-core evaluator. Its integer-state programs have actual inverse semantics and are tested by round trips such as `backward(forward(state)) == state`.
- `src/host` is an asynchronous, calls-only effect runtime. It uses trusted primitive pairs, receipts, durable execution records, and checked compensation; deleting a cloud-like resource is not claimed to be a mathematical inverse.

Structured Pure Janus control flow and asynchronous host effects cannot be mixed in one procedure. The host checker rejects that combination rather than implying transaction guarantees it does not provide.

## Pure Janus API

`compileJanus` parses, statically checks, and links a program without host primitives. `call` and `uncall` each use an isolated state and return a new snapshot.

```ts
import { compileJanus } from "./src/janus";

const counter = compileJanus(`
  value delta
  procedure change()
    value += delta
`);

const changed = counter.call("change", { value: 10, delta: 3 });
const restored = counter.uncall("change", changed);
// restored: { value: 10, delta: 3 }
```

The clean core supports:

- global scalars and fixed-length arrays with deterministic signed 32-bit arithmetic;
- reversible updates, XOR, swap, `if` exit assertions, and reversible loops;
- forward references, recursion, and mutual recursion with configurable execution budgets;
- source-spanned parse, static, link, assertion, bounds, and execution-limit errors;
- canonical syntax such as `()`, `^=`, `<=>`, and `//` comments;
- case-insensitive Janus86 syntax, including `!=`, `:`, semicolon comments, and optional empty clauses;
- representative Janus86 programs that do not depend on interactive I/O.

It is specifically **Janus86 clean-core compatible**, not a complete reconstruction of the historical runtime. `READ`, `WRITE`, the command scanner, procedure arguments, local variables, and dynamic data structures are out of scope.

## Effect workflow model

Effect procedures contain only parameterless procedures and `call` / `uncall` statements. Registered TypeScript primitives provide an asynchronous `forward` handler and a matching `backward` handler. A successful forward handler returns a serializable receipt; that receipt is appended only after success and is passed to the matching backward handler.

Forward failure preserves the original error separately from cleanup errors. Backward success removes its receipt only after the handler and validation succeed. Execution records make the plan and each receipt visible before reversal and retain enough state to resume incomplete or blocked cleanup.

The demo does not claim real-cloud integration, crash-time exactly-once execution, concurrent-worker arbitration, automatic plan migration, a cleanup retry scheduler, or atomic transactions across arbitrary external effects.

## Development and deployment

```sh
npm run build:browser
npm run deploy
```

Deployment uses Cloudflare Workers. Local or CI deployment needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`; keep both in environment variables or repository secrets, never in source. The health endpoint is `/health`.

Design decisions and scope are documented in [ADR002: Janus86 clean core](adr/ADR002-Janus86実装範囲.md) and [ADR003: reversible-by-construction demo](adr/ADR003-刺さるデモシナリオ.md).
