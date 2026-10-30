# Architecture Decision Records (ADR)

This directory contains Architecture Decision Records (ADRs) documenting significant architectural decisions made during the development of PowerBank.

## What is an ADR?

An Architecture Decision Record (ADR) captures an important architectural decision, including its context, the chosen solution, alternatives considered, and resulting consequences.

ADRs provide a historical record of why architectural decisions were made and help maintain consistency as the system evolves.

## ADR Index

| ID | Title | Status | Date |
|---|---|---|---|
| [001](001-project-structure.md) | Microservices Architecture | Accepted | 2026-10-30 |
| [002](002-technology-stack.md) | Technology Stack Selection | Accepted | 2026-10-30 |
| [003](003-database-per-service.md) | Database Per Service Pattern | Accepted | 2026-10-30 |
| [004](004-graceful-shutdown.md) | Graceful Shutdown Strategy | Accepted | 2026-10-30 |

## Process

When making a significant architectural decision:

1. Copy the [ADR template](000-template.md).
2. Fill in the relevant sections.
3. Assign the next available number.
4. Review and finalize the decision.
5. Update the ADR index.

## Statuses

- **Proposed**: The decision is under discussion and has not been finalized.
- **Accepted**: The decision has been approved and is the current architectural direction. Implementation may still be pending.
- **Deprecated**: The decision is no longer applicable or recommended.
- **Superseded**: The decision has been replaced by another ADR. The superseding ADR should be referenced.