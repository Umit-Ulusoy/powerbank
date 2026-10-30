# ADR-004: Graceful Shutdown Strategy

## Status
Accepted

## Date
2026-10-30

## Context

In production environments, services may restart during deployments, scaling operations, infrastructure maintenance, or unexpected failures.

Without graceful shutdown:
- In-flight HTTP requests may be interrupted, resulting in failed requests and 5xx responses.
- RabbitMQ messages being processed may be redelivered if they are not acknowledged before the consumer connection closes.
- Ongoing database operations may be interrupted, potentially causing transactions to roll back.
- Clients may experience unnecessary failures during deployments.
- Uncontrolled termination may prevent application-level cleanup operations from completing.

Banking operations require reliable transaction handling and predictable failure recovery. Graceful shutdown helps minimize interruptions and ensures that resources are released in a controlled manner.

## Decision

All services must implement graceful shutdown by handling SIGTERM and SIGINT signals.

The shutdown procedure follows these steps:

1. Mark the service as not ready to receive new traffic.
2. Stop accepting new HTTP connections while allowing existing requests to complete.
3. Stop consuming new RabbitMQ messages using consumer cancellation.
4. Wait for in-flight HTTP requests to complete.
5. Allow currently processing RabbitMQ messages to finish.
6. Acknowledge messages only after their processing and required database transactions have completed successfully.
7. Disconnect database connections cleanly.
8. Close RabbitMQ channels and connections.
9. Set the appropriate process exit code and allow the process to terminate.

Shutdown handling must include duplicate signal protection using an `isShuttingDown` flag to prevent concurrent cleanup operations.

A configurable shutdown timeout must prevent services from waiting indefinitely. If the timeout expires, remaining operations are terminated and unacknowledged RabbitMQ messages can be redelivered.

## Consequences

### Positive

- Reduced deployment interruptions: Existing requests can complete before the service terminates.
- Reliable message handling: Unacknowledged messages can be redelivered instead of being silently discarded.
- Controlled resource cleanup: Database connections and message broker resources are closed explicitly.
- Improved fault recovery: Services have predictable termination behavior.
- Better deployment reliability: Graceful shutdown works alongside readiness probes and appropriate deployment strategies to support zero-downtime deployments.

### Negative

- Longer shutdown times: The process must wait for in-flight operations to complete.
- Implementation complexity: HTTP requests, message consumers, and database connections require coordinated shutdown handling.
- Timeout management: Operations exceeding the shutdown deadline require a termination strategy.
- Duplicate processing: RabbitMQ message redelivery can result in duplicate processing, requiring idempotent message handlers.

## Alternatives Considered

**Immediate Process Termination**: Allow the operating system or container runtime to terminate the process without application-level cleanup. Rejected because it unnecessarily interrupts in-flight operations and prevents controlled resource cleanup.

**HTTP-Only Shutdown**: Close the HTTP server without managing RabbitMQ consumers or database connections. Rejected because it leaves other application resources and ongoing message processing unmanaged.

**Unlimited Shutdown Timeout**: Wait indefinitely for all operations to complete. Rejected because stalled operations could prevent deployments and scaling operations from progressing.

**Fixed Long Timeout (5+ Minutes)**: Allow a long period for ongoing operations to finish. Rejected because it can unnecessarily delay deployments and exceed infrastructure termination limits.

## Implementation Notes

The current implementation handles SIGTERM and SIGINT with sequential cleanup operations, including HTTP server closure and Prisma disconnection.

The complete shutdown strategy will also coordinate RabbitMQ consumer cancellation, in-flight message processing, and a configurable termination timeout.

The initial shutdown timeout will be 30 seconds, subject to adjustment based on workload characteristics and deployment environment constraints.

The implementation must avoid calling `process.exit()` immediately after initiating cleanup, allowing pending operations and output streams to complete whenever possible.

## References

- [Node.js Process Signals](https://nodejs.org/api/process.html#process_signal_events)
- [Node.js HTTP Server](https://nodejs.org/api/http.html#serverclosecallback)
- [RabbitMQ Consumer Acknowledgements](https://www.rabbitmq.com/docs/confirms)