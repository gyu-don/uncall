# UNCALL

[Japanese](README-ja.md)

**One program. Both directions.**

UNCALL is an implementation of the reversible programming language Janus. `call` runs a procedure forward; `uncall` runs that same procedure backward. You do not write a separate decoder, unsorter, or undo program.

**Live demos:** [Pure Janus](https://uncall.gyu-don.workers.dev/) · [Quantum circuits](https://uncall.gyu-don.workers.dev/quantum)

UNCALL is an OpenAI Build Week project in the **Developer Tools** category. The demos run in the browser without an account or setup.

## See a program run both ways

The smallest example is a five-character encoder:

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

`call encode` turns `HELLO` into `KHOOR`. `uncall encode` executes the same statements in reverse, turning each `+=` into `-=`, and brings `HELLO` back.

The browser includes five ways to explore the same idea:

- **Encode and decode:** one `encode` procedure works in both directions.
- **Sort and restore:** six trace bits preserve the branch decisions that an ordinary sort would discard.
- **Tree leaf and path:** moving upward stores a route; running backward consumes that route to find a leaf.
- **Quantum Fourier Transform:** QFT turns a basis value into a phase pattern, and inverse execution recovers the value.
- **Reversible adder:** one gate sequence adds forward and subtracts backward.

The Pure Janus demos parse, check, and execute the editable Janus source in the browser. Try changing an input or the program, run it forward, then run it backward.

## Try it

The fastest route needs no build:

1. Open the [Pure Janus demo](https://uncall.gyu-don.workers.dev/?demo=codec), call `encode`, then uncall it.
2. Open [Quantum circuits](https://uncall.gyu-don.workers.dev/quantum), run QFT, and watch the inverse gates recover the input.

For local development, you need Node.js 22 or newer and npm:

```sh
npm install
npm run dev
```

Wrangler prints the local URL, normally `http://localhost:8787`.

The hosted demos support modern browsers that can run ES2022 JavaScript. Local development and deployment are supported wherever Node.js and the Cloudflare Wrangler CLI run.

Run the checks with:

```sh
npm run typecheck
npm test
```

## Pure Janus API

`compileJanus` parses, statically checks, and links a program. `call` and `uncall` leave their input untouched and return a new state snapshot.

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

- global scalars and fixed-length arrays with signed 32-bit arithmetic;
- reversible updates, XOR, swap, conditionals with exit assertions, and reversible loops;
- forward references, recursion, and mutual recursion with execution budgets;
- source-spanned errors for parsing, checking, linking, assertions, bounds, and execution limits;
- the Janus86 syntax used by representative programs that do not depend on interactive I/O.

`src/janus` implements synchronous reversible computation. `src/host` provides a separate asynchronous layer for pairing forward and backward host actions with receipts and resumable execution records.

## Built with Codex and GPT-5.6

UNCALL was created during the OpenAI Build Week submission period through a series of Codex sessions powered by GPT-5.6. The author chose the product direction, the Janus86 clean-core scope, the separation between reversible computation and host actions, and the design of the five demos.

Codex accelerated the project by:

- building the TypeScript and Cloudflare Workers application;
- implementing and refining the tokenizer, parser, checker, resolver, and bidirectional evaluator;
- developing the host-action layer and the quantum circuit simulators;
- adding round-trip, exhaustive-input, failure-path, and browser-route tests;
- iterating on the demos, documentation, accessibility, and deployment setup.

GPT-5.6 was used through Codex for architecture, implementation, debugging, testing, documentation, and review. UNCALL itself is deterministic and does not call a language model at runtime.

Primary Codex `/feedback` Session ID for the thread where most of the Pure Janus core was built:

```text
019f73c9-9dc8-7663-aeac-4ce20f64e4cf
```

## Development and deployment

```sh
npm run build:browser
npm run deploy
```

Deployment uses Cloudflare Workers. Local or CI deployment needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. The health endpoint is `/health`.

Design decisions are recorded in [ADR002: Janus86 clean core](adr/ADR002-janus86-implementation-scope.md) and [ADR003: reversible-by-construction demo](adr/ADR003-demo-scenario.md).

## License

UNCALL is source-available under the [PolyForm Noncommercial License 1.0.0](LICENSE). Noncommercial use, modification, and distribution are permitted under its terms; commercial use requires a separate license from the repository owner.

Additional permission for OpenAI Build Week judging and testing is provided in [LICENSE-BUILD-WEEK-EXCEPTION.md](LICENSE-BUILD-WEEK-EXCEPTION.md). Third-party components remain subject to their own licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
