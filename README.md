# UNCALL

UNCALL is an experimental reversible-effect runtime inspired by Janus `call` / `uncall`. Two deliberately separate parts currently exist:

- the browser app remains the ADR001 Phase 0 mock deployment, with receipt-based reverse-order cleanup and a Hono Worker;
- `src/janus` is an app-independent synchronous implementation of the ADR002 Pure Janus clean core.

The source shown in the browser is intentionally read-only and is **not** the source executed by the demo. The demo still uses the fixed TypeScript `demoPlan`; connecting it to parsed source and the asynchronous effect layer remains ADR001 Phase 2 work. Pure Janus execution does not depend on that integration.

## Requirements

- Node.js 22 or newer
- npm

## Local development

```sh
npm install
npm run typecheck
npm test
npm run dev
```

Wrangler prints the local URL, normally `http://localhost:8787`. Deployment health is available at `/health`.

## Deploy

```sh
npm run deploy
```

For local deployment, Wrangler needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. The GitHub Actions workflow reads the same names from repository secrets and deploys pushes to `main`; secret values must never be committed.

## Pure Janus API

`compileJanus` parses, statically checks, and links a program without host primitives. `call` and `uncall` each create an isolated state, execute synchronously, and return a new state snapshot.

```ts
import { compileJanus } from "./src/janus";

const counter = compileJanus(`
  value delta
  procedure change()
    value += delta
`);

const changed = counter.call("change", { value: 10, delta: 3 });
const restored = counter.uncall("change", changed);
```

Missing state values start at zero. Scalars and array elements use signed 32-bit arithmetic. Runtime options can bound `totalStepBudget`, `callDepthBudget`, and `loopIterationBudget`.

## Janus86 clean-core compatibility

| Feature | Status |
| --- | --- |
| Global scalar and fixed-length array state | Supported |
| 32-bit expressions, `+=`, `-=`, XOR update, swap | Supported |
| Reversible `if` with exit assertion | Supported |
| Reversible `from` / `do` / `loop` / `until` | Supported |
| Forward references, recursion, mutual recursion | Supported with execution budgets |
| Canonical `()`, `^=`, `<=>`, `//` forms | Supported |
| Janus86 case-insensitive names, optional empty clauses, `!=`, `:`, `;` forms | Supported |
| Source-spanned parse, static, link, assertion, bounds, and limit errors | Supported |
| Janus86 factorization sample without `READ` / `WRITE` | Covered by conformance test |
| `READ`, `WRITE`, runtime command scanner | Out of scope |
| Procedure arguments, locals, dynamic data | Out of scope |
| Mixed Pure Janus control flow and asynchronous host effects | Not integrated; requires a separate recovery ADR |

The parser normalizes canonical and historical syntax to one source-spanned AST. Static checks reject target-dependent updates and array-index aliases that cannot be proven reversible. The Pure evaluator contains no browser, receipt, or mock-resource state.

## Calls-only grammar used by the browser app

```text
module      := procedure+
procedure   := "procedure" IDENT "(" ")" statement*
statement   := ("call" | "uncall") IDENT "(" ")"
```

Procedure bodies end at the next `procedure` token or EOF. Indentation has no meaning. Browser/effect integration remains reserved for ADR001 Phase 2.
