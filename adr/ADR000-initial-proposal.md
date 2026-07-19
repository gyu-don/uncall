# ADR000: Initial UNCALL proposal

## Status

Superseded

## Superseded by

- [ADR001: Minimal MVP](ADR001-minimal-mvp.md)
- [ADR002: Janus86 implementation scope](ADR002-janus86-implementation-scope.md)
- [ADR003: Demo scenario](ADR003-demo-scenario.md)

This record preserves the original product vision and its design context. The
later records are authoritative for current scope.

## Context

Ordinary programs keep forward operations and cleanup or rollback code in
separate places. That separation makes ordering errors, incomplete cleanup,
and untested rollback paths common. UNCALL explores a different model: a
Janus procedure has one structure, while every host primitive supplies paired
forward and backward behavior.

```janus
procedure deploy()
  call create_network()
  call create_database()
  call deploy_application()
```

Calling the procedure runs top to bottom. Uncalling it visits the same
structure in reverse, invoking the backward behavior for the application,
database, and network.

UNCALL is not a debugger that restores a memory snapshot. It is an
experimental runtime for designing an operation and its inverse together.

## Original decision

- Use a Janus86-inspired reversible language as the computation core.
- Connect external effects through TypeScript host primitives.
- Classify operations honestly; do not claim that every effect is exactly
  reversible.
- Record a receipt from each successful forward host operation and pass that
  receipt to its backward handler.
- Derive backward statement order from program structure instead of storing a
  second cleanup program.
- Expose both standalone Janus execution and a TypeScript embedding API.
- Build the first browser experience around forward execution, explicit
  uncall, failure cleanup, current resources, and an execution log.

## Reversibility boundary

The proposal distinguished four useful categories:

- `exact`: backward execution restores the previous state exactly.
- `checked`: backward execution is allowed only when assumptions still hold.
- `compensating`: backward execution performs a semantic compensation rather
  than literal restoration.
- `irreversible`: no backward behavior is claimed.

External operations return receipts because names or current global state are
not enough to identify what a particular forward run created. Snapshot
replacement was rejected: it would hide the actual cleanup behavior and would
not model real external systems.

## Initial product shape

The proposal included a parser, AST, direction-aware evaluator, host runtime,
browser editor, execution visualization, TypeScript API, infrastructure demo,
and a possible quantum-adjoint demo. That combined scope was too broad for the
first validation step. ADR001 split it into smaller phases; ADR002 made the
Janus compatibility claim precise; ADR003 refined the headline demo; ADR004
later specified the quantum demonstration.

## Non-goals of the original MVP

- Full historical Janus86 compatibility
- Native compilation or performance optimization
- Production cloud integrations
- Durable distributed transactions
- Multi-user persistence and authentication
- A general quantum simulator
- A claim that arbitrary real-world effects can be undone perfectly

## Enduring product message

The enduring idea is that forward work and inverse work should be visibly
connected in one program. `call` performs the operation; `uncall` asks the same
program structure to run in the opposite direction.
