# ADR-003: Database Per Service Pattern

## Status
Accepted

## Date
2026-10-30

## Context

In microservices architecture, data management can follow different approaches, including shared databases and database-per-service. This choice directly impacts service coupling, data ownership, deployment independence, transaction management, and scalability.

PowerBank aims to establish clear service boundaries and independent data ownership while addressing distributed data management challenges such as eventual consistency and distributed transaction coordination.

## Decision

Each microservice will own its **own dedicated PostgreSQL database**. Services can access only their own databases. Data sharing occurs exclusively through synchronous APIs or asynchronous events. Direct cross-service database access is prohibited.

During initial development, multiple service databases may run on the same PostgreSQL instance while maintaining separate database-level boundaries and credentials.

## Consequences

### Positive

- Loose coupling: Services maintain independent schemas and data models without direct database dependencies.
- Deployment independence: Database schema changes can be managed independently, reducing coordination between services.
- Independent scaling: Database resources and configurations can be adjusted according to service-specific requirements.
- Fault isolation: Database-level failures can be isolated between services, provided they do not share infrastructure with common failure points.
- Clear ownership: Each service has exclusive ownership and control over its data.
- Security isolation: Separate database credentials and permissions reduce the impact of compromised service credentials.

### Negative

- Data duplication: Some data may need to be replicated across services to support local queries and independent operations.
- Eventual consistency: Cross-service data synchronization is asynchronous, so updates may not be immediately visible everywhere.
- Complex queries: Cross-service JOINs are unavailable; data aggregation must happen through APIs or locally maintained projections.
- Distributed transactions: Business operations spanning multiple services require coordination strategies such as Saga or other eventual consistency patterns.
- Higher storage requirements: Data replication and denormalization can increase storage consumption.
- Operational overhead: Multiple databases require additional backup, monitoring, migration, and maintenance management.

## Alternatives Considered

**Shared Database**: Multiple services access the same database and potentially share schemas. Rejected because it introduces database-level coupling, weakens data ownership boundaries, and makes independent schema evolution more difficult.

**Shared Database with Separate Schemas**: Each service owns a separate schema within a shared database. Rejected because services still share database infrastructure and remain coupled to the same database lifecycle and operational constraints.

**Polyglot Persistence**: Different services use different database technologies according to their domain requirements. Rejected initially due to increased operational complexity and the additional learning curve within the project's timeline. This approach may be reconsidered if future requirements justify it.

## References

- [Database per Service - Chris Richardson](https://microservices.io/patterns/data/database-per-service.html)
- [Saga Pattern](https://microservices.io/patterns/data/saga.html)