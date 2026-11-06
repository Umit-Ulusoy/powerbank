# ADR-007: Structured Logging with Pino

## Status
Accepted

## Date
2026-11-05

## Context

Microservices architectures generate logs across multiple services, making debugging and monitoring significantly more challenging than in monolithic applications.

Without structured logging:
- Log entries are unstructured strings that are difficult to parse programmatically.
- Searching and filtering logs requires brittle text pattern matching.
- Aggregating information from logs becomes unreliable.
- Correlation IDs and other metadata cannot be consistently attached to log entries.
- Sensitive information such as passwords and tokens may be accidentally logged.
- Logging overhead can negatively affect application responsiveness.

Banking applications require robust observability, security, and compliance. Structured logging provides machine-readable log entries with consistent formatting, automatic correlation ID enrichment, sensitive data redaction, and efficient serialization.

## Decision

All PowerBank backend services must use Pino as their structured logging library and follow the logging conventions defined in this ADR.

The logging implementation follows these principles:

1. **Structured Log Format**: Log entries are JSON objects with consistent fields rather than unstructured strings.
2. **Automatic Correlation ID Enrichment**: The logger automatically includes the current correlation ID from Request Context when available.
3. **Log Levels**: Services use standard Pino log levels (`fatal`, `error`, `warn`, `info`, `debug`, `trace`) configured through environment variables.
4. **Sensitive Data Redaction**: The logger redacts explicitly configured sensitive fields and patterns, including passwords, tokens, API keys, authorization headers, cookies, and connection strings.
5. **HTTP Request Completion Logging**: Completed requests are logged with method, route, status code, and request duration using response lifecycle events (`finish` and `close`).
6. **Pino Native Error Serialization**: Errors are logged using Pino's built-in error serializer through the standard `err` field.
7. **Development-Friendly Output**: Development environments use `pino-pretty` for human-readable output, while production uses structured JSON output.

Logging outside an HTTP request context (background tasks and application startup) works correctly without requiring a correlation ID.

Correlation ID propagation between services is handled separately through the mechanisms defined in ADR-006.

## Consequences

### Positive

- **Machine-readable logs**: Log aggregation tools can parse and index structured logs reliably.
- **Automatic correlation**: Correlation IDs are automatically included in log entries when available in the current request context.
- **Security**: Explicitly configured sensitive fields are redacted, reducing the risk of credential leakage.
- **Performance**: Pino is designed for low-overhead structured logging and helps reduce the performance impact of application logging.
- **Consistency**: All services use the same logging format and conventions.
- **Debugging efficiency**: Logs can be correlated across services when correlation IDs are propagated through inter-service communication.
- **Reduced log volume**: A single completion log per request avoids unnecessary incoming and completion log duplication.
- **Error handling**: Pino's built-in error serializer provides standardized serialization for Error objects.

### Negative

- **External dependency**: Introduces `pino` and `pino-pretty` dependencies.
- **Learning curve**: Developers must use structured fields instead of string concatenation.
- **Redaction limitations**: Automatic redaction only protects explicitly configured paths and patterns. Sensitive data under unexpected field names or unconfigured paths may still be logged.
- **Route path dependency**: Route templates logged as paths depend on Express route definitions being available.

### Neutral

- **Log volume**: Structured logging does not inherently reduce log volume; log level configuration controls verbosity.
- **Observability tools**: Structured logs work best with log aggregation systems, though they remain readable as raw JSON.

## Alternatives Considered

### Option 1: Winston

Winston is a widely used Node.js logging library with flexible transport support.

Rejected because Pino provides a lower-overhead approach to structured JSON logging and offers a simpler configuration for the application's current requirements.

### Option 2: Console Logging

Continue using `console.log`, `console.error`, and `console.info` throughout the application.

Rejected because console logging does not provide a consistent structured logging convention, automatic correlation ID enrichment, or configurable sensitive data redaction.

### Option 3: Custom Logging Abstraction

Build a custom logging module wrapping multiple libraries.

Rejected because it introduces unnecessary complexity without concrete benefits. Pino provides the required functionality without requiring an additional abstraction layer.

### Option 4: Custom Error Serializer

Implement a custom error serializer instead of using Pino's built-in error handling.

Rejected because Pino provides a built-in error serializer that meets the application's current logging requirements without custom serialization logic.

### Option 5: Incoming + Completion Request Logging

Log both incoming requests and completed requests.

Rejected because it increases request-related log volume without providing sufficient additional operational value. The completion log includes the necessary diagnostic information (method, route, status, duration, and correlation ID when available).

## Implementation Notes

### 1. Logger Initialization

- Centralized logger instance in `src/lib/logger.ts`.
- Log level configured through the `LOG_LEVEL` environment variable.
- Development environments use `pino-pretty` for readable output.
- Production environments use structured JSON output.

### 2. Correlation ID Integration

- Logger `mixin` function retrieves the correlation ID from the existing Request Context.
- Correlation ID is included automatically in log entries when available.
- No changes are required to the existing Request Context or Correlation ID middleware.
- Cross-service correlation ID propagation follows ADR-006.

### 3. HTTP Request Logging

- `requestLoggerMiddleware` logs completed requests using `res.on('finish')`.
- Premature connection closures are detected using `res.on('close')` with a `res.writableEnded` check.
- Middleware must be registered after `correlationIdMiddleware` to include correlation IDs.
- Duration is measured using `performance.now()` for monotonic time measurement.
- Log levels:
  - `info` for 2xx and 3xx responses.
  - `warn` for 4xx responses.
  - `error` for 5xx responses.
  - `warn` for prematurely closed connections.
- Route templates (`req.route.path`) are preferred over dynamic request paths when available.
- A request is logged only once, even if multiple response lifecycle events occur.

### 4. Error Handling Integration

- Errors are logged using the standard `logger.error({ err: error })` format.
- Pino's built-in error serializer handles standard Error serialization.
- The `err` field follows Pino's standard conventions for error logging.

### 5. Sensitive Data Redaction

- Automatic redaction uses explicitly configured path patterns.
- Configured fields include `password`, `token`, `accessToken`, `access_token`, `refreshToken`, `refresh_token`, `apiKey`, `api_key`, `secret`, `authorization`, `cookie`, `connectionString`, and `DATABASE_URL`.
- HTTP header redaction includes authorization, cookie, and set-cookie fields.
- Redaction does not guarantee protection against sensitive data stored under unexpected field names or unconfigured paths.

### 6. Middleware Ordering

- Correlation ID middleware is registered before request logging middleware.
- Request logging middleware is registered before the JSON body parser.
- This ordering ensures that malformed JSON requests are associated with correlation IDs and can be logged by the request logger.

## References

- [Pino Documentation](https://getpino.io/)
- [Pino API Documentation](https://getpino.io/#/docs/api)
- [Pino Error Serialization](https://getpino.io/#/docs/api?id=serializers-object)
- [Node.js Logging Best Practices](https://nodejs.org/en/docs/guides/diagnostics/logging/)
- ADR-004: Graceful Shutdown Strategy
- ADR-006: Correlation ID Propagation and Validation