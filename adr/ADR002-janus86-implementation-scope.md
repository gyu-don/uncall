# ADR002: Define the Janus86 clean-core implementation scope

## Status

Accepted — Implemented

## Date

2026-07-18

## Current state

Levels 0–3 are implemented. `src/janus` supports scalars, fixed-length arrays,
expressions, reversible updates, swaps, exit-asserted conditionals, reversible
loops, recursion with an execution budget, and canonical and Janus86 syntax
profiles. Round-trip tests include a published Janus86 factorization example.

Pure Janus computation remains separate from asynchronous host effects.
Combining structured Pure Janus control directly with host effects requires a
separate decision.

## Context

Calling the Phase 2 kernel “Janus86 support” would overstate its scope. A useful
compatibility claim needs explicit syntax, semantics, program-state rules,
static restrictions, and conformance tests.

The historical Janus literature and available Janus86 examples are reference
material, but UNCALL does not need interactive I/O or every implementation
detail to provide a clean reversible computation core.

## Decision

Implement the pure reversible-computation portion of Janus86 in levels. Parse
two source profiles into one normalized AST:

- The UNCALL canonical profile uses explicit declarations and clear modern
  spelling.
- The compatibility profile accepts the historical forms needed by reference
  programs.

Compatibility means that supported programs have the expected forward result,
their backward execution is the semantic inverse, and unsupported constructs
fail explicitly rather than being silently reinterpreted.

## Program and state model

- Programs declare scalar integers and fixed-length integer arrays.
- Runtime state must match declarations in name, shape, and integer values.
- Arithmetic uses JavaScript safe integers; overflow or non-integer results are
  errors.
- Array indices are bounds-checked.
- Names are resolved before execution.

## Reversible statements

The clean core includes:

- `x += e` and `x -= e`, with static checks preventing the target from being
  read through the right-hand expression.
- `x <=> y`, requiring distinct non-aliasing locations.
- `call` and `uncall` of procedures.
- Reversible conditionals with an entry test and an exit assertion.
- Reversible loops with paired entry/exit assertions.

Backward execution reverses statement order and each statement's meaning.
Control assertions are semantic checks, not optional debug assertions.

## Procedures and recursion

Procedures remain argument-free in this scope. Recursion is allowed only with
an execution budget so malformed programs terminate with a clear error.
Parsing, static checking, name linking, and execution are separate stages.

## Boundary with host effects

Pure Janus operates on deterministic in-memory integer state and supports
structured reversible control. Host primitives may be asynchronous, return
receipts, fail, compensate, and interact with external systems. Host calls are
resolved through a manifest, but host effect state is not inserted into the
Pure Janus value store.

## Implementation levels

### Level 0: calls-only kernel

Argument-free procedures plus direction-aware `call` and `uncall`, as completed
by ADR001.

### Level 1: reversible data core

Declarations, state validation, expressions, reversible updates, swaps, and
alias restrictions.

### Level 2: structured reversible control

Exit-asserted conditionals and reversible loops with round-trip coverage.

### Level 3: Janus86 clean core

Compatibility syntax, bounded recursion, reference programs, and a documented
conformance boundary.

## Conformance strategy

Every supported construct needs forward examples, backward examples,
round-trip properties, rejection tests for static violations, and runtime tests
for failed assertions or invalid state. Parser fixtures alone are insufficient.

## Not implemented by this decision

- Interactive Janus86 input/output
- Procedure parameters or return values
- Dynamic arrays, pointers, objects, or heap allocation
- Floating-point arithmetic
- Concurrency
- Automatic synthesis of inverses for arbitrary irreversible code
- Mixing asynchronous host effects into Pure Janus structured control

## Rejected alternatives

- Implement every historical construct at once: too much coupled parser,
  checker, alias, control, and runtime work.
- Describe the calls-only kernel as Janus86: an inaccurate compatibility claim.
- Use only historical syntax as canonical syntax: harder to explain and evolve.
- Add host effects as ordinary Pure Janus statements: erases an important
  semantic and failure boundary.
- Define backward execution as snapshot restoration: it does not implement
  reversible statement semantics.
