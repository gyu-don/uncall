# ADR004: Provide QFT and Toffoli-adder demos as two tabs on a separate page

## Status

Accepted — Implemented

## Date

2026-07-18

## Current state

The quantum demonstration is available at `/quantum`, separate from the three
Pure Janus demos on the main page. It reuses the Janus-to-host-primitive path,
paired primitive handlers, receipt journal, execution events, and derived
forward/backward procedure order. Each handler emits one visible logical gate.

## Context

Quantum circuits make inverse execution concrete: unitary gates have adjoints,
and reversible logical arithmetic can run backward. They also add enough visual
and conceptual density that combining them with the main page would weaken
both experiences.

QFT and a carry-chain adder answer different questions. QFT turns a basis value
into relative phase and needs a complex state vector. The adder demonstrates
forward addition and backward subtraction with logical X, CNOT, and Toffoli
gates on computational-basis bits.

Craig Gidney's temporary logical-AND work provides useful circuit context, but
this demo stays at the logical Toffoli level. It must not claim Clifford+T gate
counts, T-depth, measurement behavior, or the paper's resource savings.

## Decision

### Separate page and tabs

Place the experience at `/quantum` with a QFT tab and a reversible-adder tab.
Keep the Pure Janus headline and navigation intact.

### QFT scope

Simulate a fixed three-qubit state vector in the browser. Accept a
computational-basis input, emit the QFT gates one at a time, visualize all eight
complex amplitudes as magnitude and phase, then emit the adjoint sequence on
uncall. The displayed Janus source remains width-generic and is specialized to
three wires by the adapter.

### Adder scope

Simulate a fixed four-bit computational-basis adder. Register `a` is preserved,
register `b` becomes `a + b mod 16`, and the carry ancilla must return to zero.
Uncall emits the same self-inverse logical gate descriptors in reverse order,
producing subtraction. The Janus source is width-generic and specialized to
four bits.

### Host primitive emission

Represent every specialized gate as a registered host primitive. Forward and
backward handlers emit a typed gate descriptor; controlled-phase backward
handlers negate the angle, while X, CNOT, Toffoli, and swap are self-adjoint.
The UI consumes execution events instead of displaying a disconnected fixed
gate array.

### Specialization

Procedure arguments are outside the clean-core scope. The adapter therefore
specializes width-generic loop indices and encodes concrete operands and phase
angles in primitive names. The source remains the algorithm; specialization is
an explicit boundary between Janus control and the host catalog.

### State simulation

Use only the state required by each tab:

- QFT: eight complex amplitudes with norm checks.
- Adder: nine computational-basis bits with clean-ancilla checks.

This is a browser simulation, not quantum-hardware execution.

## UI requirements

Each tab should focus on one question, animate gate emission, show forward and
backward streams, expose the Janus source, and display verification status.
After forward execution, valid output state can be edited before uncall so the
inverse is visibly a function, not a recorded animation. After a complete
call/uncall cycle, the procedure can be called again without resetting.

## Verification

- Compare QFT amplitudes with the analytic formula for every basis input.
- Check state-vector norm after every gate.
- Verify that backward gates are the reversed adjoints of forward gates.
- Test all 256 four-bit adder inputs.
- Check modulo-16 sums, preservation of `a`, and a clean carry ancilla.
- Check exact round trips, edited-output inverse runs, and repeated cycles.
- Validate gate catalogs, unknown wires, repeated operands, and invalid phase
  angles.
- Test specialization across several logical widths.

## Not implemented

- Quantum hardware or remote execution
- Noise, measurement, shots, or density matrices
- Arbitrary superposition input for the adder
- Clifford+T decomposition and resource estimates
- Temporary logical-AND measurement details
- A combined Draper adder
- General-purpose circuit editing

## Rejected alternatives

- Add quantum demos as more tabs on the main page.
- Combine both questions into a Draper adder.
- Display only complete forward and backward plans.
- Add quantum callbacks to the Pure Janus evaluator.
- Expand the language with gate arguments only for this demo.
- Claim a faithful implementation of temporary logical-AND optimization.

## Trade-off

Specialized primitive names are more verbose than parameterized gate calls, but
they preserve the current language boundary and make every host capability
explicit. Separate simulators duplicate a little orchestration while keeping
their validity claims small and testable.
