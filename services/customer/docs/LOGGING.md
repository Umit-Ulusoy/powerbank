# Structured Logging Guide

This document describes how to use structured logging in the Customer Service.

## Overview

The Customer Service uses [Pino](https://getpino.io/) for structured JSON logging with automatic correlation ID propagation and sensitive data redaction.

## Configuration

Configure logging through environment variables:

```env
LOG_LEVEL=info  # Options: fatal, error, warn, info, debug, trace
NODE_ENV=development  # development uses pino-pretty for readable output
```

## Basic Usage

Import the logger:

```typescript
import { logger } from "./lib/logger.js";
```

Log messages with structured fields:

```typescript
// Info logging
logger.info({ msg: "User created", userId: 123, email: "user@example.com" });

// Warning logging
logger.warn({ msg: "Rate limit approaching", requestCount: 95, limit: 100 });

// Error logging
logger.error({
  msg: "Database query failed",
  err: new Error("Connection timeout"),
  query: "SELECT * FROM customers",
});
```

## Log Levels

Use appropriate log levels:

- **fatal**: Application is terminating due to an unrecoverable error
- **error**: Unexpected errors that require investigation
- **warn**: Unexpected conditions that are recoverable (e.g., 4xx HTTP responses, premature connection closures)
- **info**: Normal operational events (e.g., request completed, service started)
- **debug**: Detailed diagnostic information for development
- **trace**: Very detailed diagnostic information (usually not needed)

## Correlation ID

The logger automatically includes the correlation ID from the current Request Context when available:

```typescript
// No manual correlation ID needed - it's added automatically
logger.info({ msg: "Processing payment", amount: 100 });

// Output includes: { "correlationId": "abc-123", "msg": "Processing payment", "amount": 100 }
```

Outside an HTTP request context (background tasks, startup, shutdown), logs work normally without a correlation ID.

## Error Logging

Use Pino's standard `err` field for error logging:

```typescript
try {
  // ... operation
} catch (error) {
  logger.error({
    msg: "Operation failed",
    err: error,
  });
}
```

Pino's built-in error serializer automatically handles:
- Standard Error objects (name, message, stack)
- AggregateError with multiple errors
- Nested error causes
- Circular error references

```typescript
// AggregateError example
const error1 = new Error("First error");
const error2 = new Error("Second error");
const aggregateError = new AggregateError([error1, error2], "Multiple errors occurred");

logger.error({ msg: "Batch operation failed", err: aggregateError });
// Output includes all individual errors in aggregateErrors array
```

## HTTP Request Logging

HTTP requests are logged automatically by `requestLoggerMiddleware`:

- Completed requests: method, route, status code, duration
- Premature connection closures: logged with warning level

Log levels:
- 2xx/3xx responses: `info`
- 4xx responses: `warn`
- 5xx responses: `error`
- Premature closures: `warn`

The middleware uses route templates when available:
```json
{"method":"GET","path":"/users/:id","statusCode":200,"duration":45}
```

## Sensitive Data Protection

The logger automatically redacts sensitive fields:

- `password`
- `token`, `accessToken`, `access_token`
- `refreshToken`, `refresh_token`
- `apiKey`, `api_key`
- `secret`
- `authorization` header
- `cookie` header
- `connectionString`, `DATABASE_URL`

Never log:
- Customer financial data
- Full request or response bodies
- Database connection strings
- Environment variables containing secrets

Prefer explicitly selecting safe fields:

```typescript
// Good
logger.info({ msg: "Customer updated", customerId: customer.id });

// Bad - might contain sensitive data
logger.info({ msg: "Customer updated", customer });
```

## Development vs Production

**Development** (`NODE_ENV=development`):
- Human-readable output with colors
- Timestamp formatting
- Excludes `pid` and `hostname`

**Production** (`NODE_ENV=production` or `NODE_ENV=test`):
- JSON structured output
- Optimized for log aggregation systems
- Minimal overhead

## Testing

Logger behavior is covered by unit tests in:
- `tests/unit/lib/logger.test.ts` - Correlation ID integration, error serialization, sensitive data redaction
- `tests/unit/middlewares/request-logger.test.ts` - HTTP request logging with response lifecycle events

## Examples

### Logging Business Operations

```typescript
logger.info({
  msg: "Customer account created",
  customerId: newCustomer.id,
  accountType: "checking",
});
```

### Logging External API Calls

```typescript
logger.debug({
  msg: "Calling external API",
  endpoint: "/api/verify",
  method: "POST",
});
```

### Logging Database Operations

```typescript
logger.debug({
  msg: "Database query",
  operation: "findMany",
  table: "customers",
  duration: queryDuration,
});
```

### Logging Validation Errors

```typescript
logger.warn({
  msg: "Validation failed",
  field: "email",
  reason: "Invalid email format",
});
```

### Logging Fatal Startup Errors

```typescript
logger.fatal({
  msg: "Failed to start service",
  err: error,
});
```

## Best Practices

1. **Use structured fields**: Avoid string concatenation
   ```typescript
   // Good
   logger.info({ msg: "User login", userId: 42 });
   
   // Bad
   logger.info(`User ${userId} logged in`);
   ```

2. **Consistent field names**: Use the same field names across the codebase
   - `customerId`, `userId`, `accountId`
   - `duration`, `statusCode`, `method`, `path`
   - `err` (not `error`) for Error objects

3. **Meaningful messages**: Use descriptive `msg` values
   ```typescript
   // Good
   logger.info({ msg: "Payment processed successfully" });
   
   // Bad
   logger.info({ msg: "Done" });
   ```

4. **Avoid over-logging**: Don't log in tight loops or high-frequency operations

5. **Security first**: When in doubt, don't log it

6. **Use Pino's `err` field**: Always use `err` field for Error objects to leverage Pino's built-in error serialization

7. **Performance measurement**: Use `performance.now()` for duration measurements rather than `Date.now()`

## Middleware Ordering

Ensure correct middleware ordering in `app.ts`:

1. Correlation ID middleware
2. Request logging middleware
3. Body parsing middleware
4. Application routes
5. 404 handler
6. Global error handler

This ensures all requests, including those with malformed JSON, are properly logged with correlation IDs.

## Limitations

- **Redaction**: Automatic redaction requires explicit path patterns. Arbitrary nested objects with unexpected field names may not be redacted.
- **Route paths**: Route template logging requires Express route definitions (`app.get('/users/:id', ...)`).
- **Circular references**: While Pino handles circular error references, excessive nesting may be truncated in output.
- **Incoming request logs**: The implementation logs only completed requests to reduce log volume. Incoming request details are not logged separately.

## References

- [ADR-007: Structured Logging with Pino](../../docs/adr/007-structured-logging.md)
- [ADR-006: Correlation ID Propagation](../../docs/adr/006-correlation-id-propagation.md)
- [Pino Documentation](https://getpino.io/)
- [Pino Error Serialization](https://getpino.io/#/docs/api?id=serializers-object)
