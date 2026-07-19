# ADR001: Progress from a mock demo to a minimal Janus runtime

## Status

Accepted — Implemented

## Current state

Phases 0–2 are complete. The Cloudflare Workers browser demo derives forward
and backward execution from a parser, AST, linker, and direction-aware
evaluator; it no longer relies on a fixed `demoPlan`.

ADR002 governs later Janus core work and ADR003 governs expansion of the
headline demo. This record keeps the historical phase plan.

## Decision

Validate the smallest understandable version of UNCALL first, but do not let
the mock become permanent. Complete the path from a hard-coded demonstration
to a real minimal Janus implementation in three independently testable phases.

## Value hypothesis

One definition should be able to express both doing work and cleaning it up,
without a separately maintained reverse sequence.

The initial demonstration covers two cases:

- A successful run followed by `uncall`, with resources removed in reverse
  order.
- A failure in the third operation, with only the two successful operations
  cleaned up automatically in reverse order.

## Phase 0: one-session mock

Show read-only Janus-like source, Run and Uncall controls, a failure toggle,
mock resources, and a forward/backward log. Execute a fixed TypeScript array of
three paired primitives:

- create/delete network
- create/delete database
- deploy/remove application

Each successful forward primitive pushes a receipt. Explicit uncall and
failure compensation consume successful receipts in LIFO order. The browser
runtime owns all mock state; the Worker remains stateless.

The mock was acceptable only if it stayed within one uninterrupted
implementation session, deployed through the intended Cloudflare route, and
was immediately followed by the real parser work.

## Phase 1: minimal parser and AST

Implement a real tokenizer, parser, source spans, multiple procedures, and
argument-free `call` / `uncall` statements. Detect invalid tokens, incomplete
procedures, undefined procedures, and unregistered primitives during parsing,
checking, or linking as appropriate. Keep this layer independent of the UI and
mock resources.

## Phase 2: evaluator and demo integration

Replace the fixed plan with a direction-aware evaluator:

- Forward sequences run from first statement to last.
- Backward sequences run from last statement to first.
- Backward execution swaps the meaning of `call` and `uncall`.
- User procedures recurse into their resolved bodies in the effective
  direction.
- Host primitives invoke their paired handlers.
- Forward failure compensates only operations completed in that run.
- Recursion remains forbidden at this level.

The displayed source must be the source that actually executes. Round-trip,
nested-procedure, parse, resolution, and deployment tests form the completion
criteria.

## Deployment

Use a small Hono Worker with routes for the HTML shell, browser JavaScript, and
health response. Keep credentials out of the repository. GitHub Actions should
install dependencies, type-check, test, build, and deploy with repository
secrets when deployment credentials are available.

## Deferred from the initial MVP

- Full Janus86 syntax and semantics
- Variables, expressions, conditionals, loops, and recursion
- Static alias analysis and rich type checking
- Durable or linear receipt types
- Retry and crash recovery for failed cleanup
- Real cloud APIs
- Quantum gates
- Package publication and AI features

## Trade-off

The mock made the interaction testable quickly but did not itself demonstrate
language correctness. Requiring its replacement as part of the MVP prevented
the prototype sequence from becoming the product architecture.
