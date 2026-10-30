# ADR-002: Technology Stack Selection

## Status
Accepted

## Date
2026-10-30

## Context

The stack must support high concurrency, strong type safety (critical for financial operations), event-driven architecture, and rapid development. The banking domain requires ACID compliance, reliable messaging, and mature tooling.

## Decision

**Core Stack**: Node.js 20+ (runtime), TypeScript 5+ (language), Express.js 5 (web framework), PostgreSQL 16+ (database), Prisma 7+ (ORM), RabbitMQ 3+ (message broker)

**Dev Tools**: npm, Docker & Docker Compose, Zod (validation), tsx (dev server)

## Consequences

### Positive

- TypeScript: Compile-time type checking reduces certain classes of type-related errors and provides strong IDE support.
- PostgreSQL: ACID compliance, mature transaction management, and robust backup and replication capabilities.
- Prisma: Type-safe database queries, schema management, migration tooling, and improved developer experience.
- RabbitMQ: Mature messaging infrastructure supporting acknowledgements, message persistence, and configurable delivery guarantees.
- Node.js: Non-blocking I/O model is well-suited for I/O-heavy banking operations.
- Express: Minimalist, widely understood, and flexible.
- Docker: Consistent development and deployment environments, with containerization concepts transferable to Kubernetes.

### Negative

- Node.js: CPU-intensive workloads can block the event loop and negatively impact application throughput and latency. Worker Threads or dedicated services may be used when necessary.
- Express: Requires more manual configuration and architectural decisions compared to opinionated frameworks.
- Single language: Limits the opportunity to demonstrate polyglot microservices architecture.
- RabbitMQ: Requires operational management, monitoring, and maintenance compared to fully managed messaging services.

## Alternatives Considered

**Go + gRPC**: Better performance for certain workloads and native concurrency support. Rejected due to slower development velocity within the project's timeline.

**Java Spring Boot**: Enterprise standard with a comprehensive ecosystem. Rejected due to more verbose code and slower iteration speed for this project.

**NestJS**: TypeScript-first with dependency injection and built-in architectural conventions. Rejected because explicit Express implementation better demonstrates architectural decisions and underlying mechanisms.

**Python FastAPI**: Rapid development and automatic API documentation. Rejected due to the project's TypeScript-first approach and the desire to maintain a consistent language across services.

**MongoDB**: Flexible document model and schema flexibility. Rejected because PostgreSQL's relational model, referential integrity, and transaction capabilities better fit the banking domain.

## References

- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Prisma Documentation](https://www.prisma.io/docs)