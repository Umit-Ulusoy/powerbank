# ADR-006: Correlation ID Propagation and Validation

## Status
Accepted

## Date
2026-11-04

## Context
PowerBank follows a microservices architecture where a single business operation may involve multiple services through synchronous HTTP requests and asynchronous message processing.

As the number of services grows, tracking requests across service boundaries becomes increasingly important for debugging, monitoring, and incident investigation.

Without a consistent correlation mechanism, identifying which log entries belong to the same business operation becomes difficult.

Additionally, incoming correlation IDs may be missing or malformed. Since correlation IDs are tracing metadata rather than business data, their validity should not determine whether an otherwise valid business request is accepted.

A consistent approach is therefore required across all services to generate, validate, propagate, and access correlation IDs.

## Decision
We will adopt a system-wide correlation ID strategy to associate requests and operations across all PowerBank services.

The following rules will apply:

1. Every incoming HTTP request must have a correlation ID.
2. The `x-correlation-id` HTTP header will be used to receive and propagate correlation IDs.
3. If a valid correlation ID is provided, the service must preserve it.
4. If the correlation ID is missing, empty, or invalid, the service must generate a new UUID v4.
5. Missing or invalid correlation IDs must not cause otherwise valid HTTP requests to be rejected.
6. Services must propagate the correlation ID when communicating with other services through HTTP.
7. RabbitMQ publishers must include the correlation ID in message metadata, and consumers must preserve it during message processing.
8. Services must make the correlation ID available throughout asynchronous execution.
9. Services must include the correlation ID in structured log entries whenever one is available.

Correlation IDs are tracing metadata and must never be used for authentication, authorization, or business identity.

## Consequences

### Positive
- Enables request tracking across multiple services.
- Makes debugging and incident investigation easier.
- Allows log entries from different services to be associated with the same business operation.
- Establishes a consistent correlation mechanism for synchronous and asynchronous communication.

### Negative
- Requires consistent implementation across all services.
- Requires explicit correlation ID propagation across service boundaries.
- Introduces additional context management requirements for asynchronous message processing.
- Correlation IDs alone do not provide complete distributed tracing capabilities, such as span relationships and execution timing.

### Neutral
- Correlation IDs identify related operations but do not guarantee message ordering or exactly-once processing.
- A new correlation ID may be generated when an incoming ID is missing or invalid, meaning the original value will not be preserved.

## Alternatives Considered

### Option 1: Reject Requests with Invalid Correlation IDs
Rejecting requests with missing or malformed correlation IDs using HTTP 400 was considered.

This option was rejected because correlation IDs are tracing metadata, not business request data. Rejecting otherwise valid requests due to malformed tracing metadata would unnecessarily interrupt business operations.

### Option 2: Generate a New Correlation ID for Every Service Request
Generating a new correlation ID independently in every service was considered.

This option was rejected because it would break correlation across service boundaries and make it difficult to associate logs belonging to the same business operation.

## Implementation Notes

1. **Correlation ID Validation**
   - Accept only alphanumeric characters and the following special characters: `.`, `_`, `:`, and `-`.
   - Maximum accepted length is 128 characters.

2. **Request Context**
   - Node.js services may use `AsyncLocalStorage` to make correlation IDs available throughout asynchronous execution.
   - Message consumers must establish their own context when processing RabbitMQ messages.

3. **RabbitMQ Metadata**
   - Use the AMQP `correlationId` message property to propagate correlation IDs.

4. **Logging**
   - Structured logs must include the correlation ID whenever one is available.
   - Invalid incoming correlation IDs may be logged as warnings without interrupting request processing.

5. **Separation from Business Logic**
   - Correlation ID handling must remain independent of business validation and authorization.

## References
- [Node.js AsyncLocalStorage Documentation](https://nodejs.org/api/async_context.html#class-asynclocalstorage)
- [RabbitMQ Documentation](https://www.rabbitmq.com/docs)
- ADR-001: Microservices Architecture
- ADR-005: Use RabbitMQ for Asynchronous Inter-Service Communication