# ADR003: Choose a reversible-by-construction demo for AI-assisted coding

## Status

Accepted — Implemented; validation and headline scope remain under review

## Date

2026-07-18

## Current state

The PR preview environment, an AI-style one-line `create_cache` addition,
derived inverse plans, execution-record recovery in another runtime, receipts,
drift detection, and partial-failure cleanup are implemented.

User validation for the final acceptance criteria is incomplete. A calls-only
headline can look like ordinary LIFO cleanup and does not expose the reversible
updates, swaps, conditionals, and loops already present in Pure Janus. A later
decision may therefore promote the Pure Janus demonstrations without rewriting
this historical record.

## Context

`try/finally`, Python context managers, TypeScript `using`, and disposable
stacks already provide excellent scope-local LIFO cleanup. “Cleanup happens
after an exception” is not a strong differentiator by itself.

The more interesting problem appears when a workflow evolves across files,
processes, reviews, or AI-generated edits. Forward behavior and rollback logic
can drift apart. UNCALL should demonstrate a narrower guarantee: the reverse
order is derived from the same checked program structure, while primitive
authors remain responsible for the correctness and reversibility class of each
effect.

## Value hypothesis

When a workflow changes, maintaining one operation structure plus paired
primitive contracts reduces the cognitive load and review surface compared
with maintaining a second orchestration path. This is “reversible by
construction” only within the documented boundary; it is not a proof that
arbitrary infrastructure state can be perfectly restored.

## Primary scenario: pull-request preview environment

The demo creates a network, database, application, and cache for a preview
environment. An AI-style edit adds one forward line. The inverse plan changes
automatically because it is derived from the same source.

The experience should show:

- The exact source that executes.
- The derived forward and backward plans side by side.
- Receipts that identify concrete created resources.
- A successful run and explicit uncall.
- Failure after partial success and cleanup of only completed operations.
- A persisted execution record resumed by a separate runtime.
- Drift detection that can stop unsafe cleanup.
- Honest labels for exact, checked, compensating, and irreversible behavior.

## Comparison with `using`

The demo must not claim that `using` is incapable of reverse-order cleanup.
Instead it should distinguish scope-local disposal from a checked workflow
whose plan and receipts can cross a process boundary. Where a language-native
resource scope is sufficient, it should be preferred.

## Supporting scenarios

Incident mitigation and feature-flag rollout remain useful secondary examples,
but they introduce stronger questions about compensation, observation, and
concurrent change. They are not the first headline scenario.

## Implementation direction

- Finish the real parser/linker/evaluator path before polishing the scenario.
- Keep Pure Janus semantics separate from the host effect runtime.
- Serialize execution records and receipts in a versioned format.
- Make drift and blocked cleanup visible rather than silently forcing progress.
- Use mock infrastructure first; real cloud APIs are not required to validate
  the interaction.

## Success criteria

The audience should understand within a short demonstration that one source
produces both directions, a one-line workflow change updates both plans,
receipts drive cleanup, partial success is handled correctly, and the guarantee
has an explicit boundary. User interviews must test whether this is clearer and
more compelling than ordinary cleanup examples.

## Rejected claims and presentations

- Making exception cleanup the headline.
- Claiming that `using` cannot solve cleanup.
- Claiming that every effect returns the world to exactly the old state.
- Connecting a real cloud provider before validating the model.
- Treating persistence alone as the differentiator.
- Claiming that AI-generated effects become reversible automatically.
- Asking a second AI to review separately generated rollback code and calling
  that reversible by construction.

## Trade-off

The scenario is more complex than a three-resource animation, but it tests the
actual product hypothesis. The guarantee remains intentionally partial: UNCALL
derives control flow and preserves receipts; primitive semantics, permissions,
external concurrency, and compensation quality still require engineering.
