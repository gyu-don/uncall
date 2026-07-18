# UNCALL

[日本語](README-ja.md)

**Describe an operation once. Undo it later—even from another process.**

UNCALL is an experimental runtime for work that is temporary but must outlive the command that created it. You describe the setup as a sequence of small operations whose setup and undo handlers have already been reviewed. UNCALL records what actually succeeded, derives the reverse order, and leaves an undo plan that another process can inspect and run later.

## Start with a simple scenario

Suppose you want to put a temporary copy of an application online so that someone else can try it. The setup needs an isolated namespace, a database, the application, and a public URL:

```text
procedure preview_environment()
    call create_namespace()
    call create_database()
    call deploy_application()
    call attach_preview_url()
```

The environment should remain available after the setup command exits. Hours or days later, when nobody needs it, a different command should remove it safely.

UNCALL connects those two moments:

```text
Now / setup command
  call preview_environment
  -> create the namespace, database, application, and URL
  -> save what each successful operation created
  -> finish the command, but leave the environment online

Later / cleanup command
  load the saved execution
  -> show what will be undone
  -> uncall preview_environment
  -> detach the URL, undeploy the application, delete the database and namespace
```

Each completed operation returns the information needed to identify and validate its resource. UNCALL stores those values as **receipts** in an **execution record**. That record lets a fresh runtime instance perform the `uncall` long after the original process has ended.

The included demo labels the two moments “PR opened” and “PR merged,” because a review environment is a familiar example of temporary infrastructure. The Pull Request is only the trigger in this story; UNCALL itself is not tied to GitHub or to preview environments.

## When the scenario changes

Now suppose the application also needs a cache. If `create_cache` is already a trusted primitive, the application change is one line:

```diff
 procedure preview_environment()
     call create_namespace()
     call create_database()
+    call create_cache()
     call deploy_application()
     call attach_preview_url()
```

From that same procedure, the runtime updates the normal undo plan and the cleanup plan for every possible partial failure. There is no second cleanup workflow to keep in sync by hand.

If somebody changes a resource before cleanup, UNCALL does not delete it blindly. It compares the current resource with the saved receipt. On a mismatch it stops, identifies what changed and which undo operations remain, and waits for a manual decision.

This is where UNCALL differs from the usual use of `try/finally`, `with`, or `using`. Those mechanisms normally clean up when the current scope ends. Here, ending the setup scope is intentional: the result stays useful, while an inspectable undo plan is handed to a future event. The same idea can be built with disposables and custom persistence; UNCALL provides a shared model for procedure direction, receipts, validation, and audit history.

> The demo uses mock resources. It does not contact GitHub, Kubernetes, a database service, or a DNS provider.

## Try the demo

Requirements:

- Node.js 22 or newer
- npm

```sh
npm install
npm run dev
```

Wrangler prints the local URL, normally `http://localhost:8787`. In the browser, follow the scenario from start to finish:

1. Compare the original setup with a version that adds a trusted cache operation, and inspect the undo-plan change derived from that one line.
2. Open the mock PR, finish the setup runtime, and confirm that the preview resources remain online.
3. Resume the saved execution in a fresh runtime, inspect the receipts, and run `uncall`.
4. Simulate an external database change and see unsafe cleanup stop with a concrete explanation.
5. Inject a setup failure and verify that only the operations that succeeded are compensated, in reverse order.

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
