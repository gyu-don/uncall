# UNCALL

[日本語](README-ja.md)

**Write an operation once. Inspect and run its undo later.**

UNCALL is an experimental runtime for workflows that must be undone after the process that created them has finished. Application code describes the intended forward operation with Janus-style `call` / `uncall`; the runtime derives the reverse order, carries the receipts needed by each inverse operation, and records the result for a later event.

The headline demo is a Pull Request preview environment. Adding a trusted primitive is a one-line application change:

```diff
 procedure preview_environment()
     call create_namespace()
     call create_database()
+    call create_cache()
     call deploy_application()
     call attach_preview_url()
```

There is no second, handwritten cleanup workflow. The runtime updates the inverse plan and every partial-failure cleanup path from the same procedure.

> The included demo uses mock resources. It does not contact GitHub, Kubernetes, a database service, or a DNS provider.

## The preview-environment story

```text
PR opened / runtime A
  call preview_environment
  -> preview URL remains live
  -> execution record exec_7F3 is saved
  -> runtime A ends

PR merged / runtime B
  load exec_7F3
  -> inspect the derived inverse plan and receipts
  -> uncall preview_environment
  -> detach URL, undeploy app, delete cache, database, namespace
```

The execution record contains the procedure identity and plan hash, completed-operation order, and serializable receipts. A new runtime instance can load it and perform the `uncall` hours or days later.

If an external change makes a receipt's generation or postcondition stale, cleanup stops instead of deleting blindly. The record becomes blocked and shows the resource, expected state, current state, and remaining inverse operations for a manual decision.

This differs in emphasis from `try/finally`, `with`, or `using`. Those mechanisms normally clean up values owned by the current scope. UNCALL deliberately lets an operation outlive that scope and preserves an inspectable undo plan for another event. Similar machinery can be built around disposables; UNCALL makes procedure direction, receipts, validation, and audit history a shared runtime model.

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

## Try the demo

Requirements:

- Node.js 22 or newer
- npm

```sh
npm install
npm run dev
```

Wrangler prints the local URL, normally `http://localhost:8787`. In the browser you can:

1. Add or remove a trusted `call` and compare the forward diff with the derived inverse-plan diff.
2. Open the mock PR, finish the forward runtime, and leave the preview resources running.
3. Resume the saved execution from a fresh runtime instance and inspect its receipts before `uncall`.
4. Simulate external drift and see unsafe cleanup stop with a concrete explanation.
5. Inject a forward failure and verify that only completed actions are compensated in reverse order.

Run the repository checks with:

```sh
npm run typecheck
npm test
```

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
