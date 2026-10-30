# ADR-001: Microservices Architecture

## Status
Accepted

## Date
2026-10-30

## Context

PowerBank is a banking application designed to demonstrate understanding of enterprise-level distributed systems. The system encompasses multiple distinct business domains (customer management, authentication, accounts, transfers, ledger, notifications) with different scalability requirements, business rules, and lifecycles.

A monolithic architecture would limit independent scaling, create tight coupling between domains, and prevent demonstration of distributed systems patterns essential for modern banking systems (SAGA, event-driven, eventual consistency).

## Decision

PowerBank will be implemented using **microservices architecture** with database-per-service pattern. Services communicate via REST APIs (synchronous) and RabbitMQ (asynchronous). Each service is independently deployable using Docker containers.

## Consequences

### Positive
- Independent scalability based on service-specific load patterns
- Fault isolation prevents cascading failures
- Clear domain boundaries reduce coupling
- Technology flexibility per service
- Enables implementation of distributed patterns (SAGA, event sourcing, circuit breaker)

### Negative
- Increased complexity (distributed transactions, network latency, debugging)
- Eventual consistency required (no cross-service ACID)
- Higher operational overhead (monitoring, deployment, testing)
- Data duplication across services for autonomy

## Alternatives Considered

**Monolithic Architecture**: Simpler deployment and ACID transactions, but tight coupling and limited scalability. Rejected because it doesn't enable distributed systems patterns.

**Modular Monolith**: Module boundaries without distribution complexity. Rejected because it still shares database and limits independent scaling.

**Serverless Functions**: Auto-scaling and no server management. Rejected due to cloud vendor lock-in and difficulty running locally for demonstrations.

## References
- [Microservices Pattern - Chris Richardson](https://microservices.io/patterns/microservices.html)
- [Building Microservices - Sam Newman](https://www.oreilly.com/library/view/building-microservices-2nd/9781492034018/)
