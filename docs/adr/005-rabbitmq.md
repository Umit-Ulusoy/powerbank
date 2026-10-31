# ADR-005: Use RabbitMQ for Asynchronous Inter-Service Communication

## Status
Accepted

## Date
2026-11-01

## Context

PowerBank follows a microservices architecture in which each service owns and manages its own database.
Direct database access between services is prohibited to maintain service boundaries and data ownership.

However, services need to communicate and share information about domain events.

For example, when a customer is successfully created, other services such as Auth, Notification, and Account may need to react to this event.

Synchronous HTTP communication can introduce runtime dependencies between services. If a receiving service is unavailable, the originating service may become dependent on its availability, potentially affecting the primary business operation.

We need a reliable asynchronous communication mechanism that supports loose coupling, message routing, and independent service execution.

## Decision

We will use **RabbitMQ** as the message broker for asynchronous inter-service communication.

Services will publish domain events to RabbitMQ exchanges.
Consumer services will receive relevant events through their own queues, using exchange bindings to determine which messages they should receive.

Each service will remain responsible for its own business logic and database operations.

RabbitMQ will be used for asynchronous event-driven communication, not as a replacement for synchronous communication where an immediate response is required.

## Consequences

### Positive

- **Loose Coupling:** Services do not need direct knowledge of other services or their internal implementation.
- **Asynchronous Processing:** Producers can publish messages without waiting for consumers to finish processing them.
- **Flexible Routing:** Exchanges, queues, and bindings provide flexible message routing mechanisms.
- **Reliability Mechanisms:** RabbitMQ supports durable queues, persistent messages, publisher confirms, consumer acknowledgments, and dead-letter exchanges.
- **Independent Scalability:** Multiple consumers can process messages independently, allowing services to scale according to their workloads.
- **Extensibility:** New consumers can subscribe to existing events without requiring changes to the original producer.

### Negative

- **Eventual Consistency:** The system becomes eventually consistent rather than immediately consistent across services.
- **Duplicate Delivery:** Messages may be delivered more than once, requiring idempotent consumers.
- **Message Ordering:** Ordering must be considered, especially when multiple consumers or queues are involved.
- **Operational Complexity:** Retry and dead-letter handling introduce additional operational complexity.
- **Infrastructure Dependency:** RabbitMQ introduces another infrastructure component that requires monitoring, maintenance, and availability management.

## Alternatives Considered

### Option 1: Synchronous HTTP Communication

Services could communicate directly through HTTP APIs.

**Reasons for rejection as the primary mechanism:**

- Introduces runtime dependencies between services.
- The producer may be affected by the availability of the receiving service.
- Not ideal for background processing and event-driven workflows.
- Adding new consumers may require changes to existing service implementations.

HTTP remains appropriate for operations that require an immediate response.

### Option 2: Apache Kafka

Kafka is a distributed event streaming platform designed for high-throughput event streams and durable event retention.

**Reasons for rejection:**

- Introduces additional operational and architectural complexity for the current project requirements.
- RabbitMQ provides the routing and message-processing capabilities currently needed by PowerBank.
- Kafka's event-streaming capabilities are not a primary requirement at this stage.

## Implementation Notes

The following practices will be adopted when implementing RabbitMQ communication:

1. **Database per Service:** Services must never access another service's database directly.
2. **Minimal Event Payloads:** Events should contain only the information required by their consumers. Sensitive or unnecessary data must not be included.
3. **Event Versioning:** Events should include a version field to support future schema evolution.
4. **Publisher Confirms:** Producers should use publisher confirms to verify that RabbitMQ has accepted published messages.
5. **Consumer Acknowledgments:** Consumers should acknowledge messages only after successful processing.
6. **Graceful Shutdown:** Services must stop accepting new work and safely close RabbitMQ channels and connections during shutdown.

RabbitMQ provides at-least-once delivery capabilities when configured appropriately. It does not guarantee exactly-once message processing. Duplicate delivery and processing must therefore be handled at the application level.

## References

- [RabbitMQ Documentation](https://www.rabbitmq.com/docs)
- [RabbitMQ Publisher Confirms](https://www.rabbitmq.com/docs/confirms)
- [RabbitMQ Exchanges and Queues](https://www.rabbitmq.com/tutorials/amqp-concepts)
