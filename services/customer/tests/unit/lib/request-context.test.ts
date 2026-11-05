import { describe, expect, it } from "vitest";

import {
  getCorrelationId,
  requestContext,
} from "../../../src/lib/request-context.js";

describe("Request Context", () => {
  describe("getCorrelationId", () => {
    it("should return undefined outside a request context", () => {
      expect(getCorrelationId()).toBeUndefined();
    });

    it("should return the correlation ID from the current context", () => {
      requestContext.run(
        { correlationId: "request-123" },
        () => {
          expect(getCorrelationId()).toBe("request-123");
        }
      );
    });

    it("should preserve the context across asynchronous operations", async () => {
      const correlationId = await requestContext.run(
        { correlationId: "request-123" },
        async () => {
          await Promise.resolve();

          return getCorrelationId();
        }
      );

      expect(correlationId).toBe("request-123");
    });

    it("should isolate concurrent request contexts", async () => {
      const [first, second] = await Promise.all([
        requestContext.run(
          { correlationId: "request-1" },
          async () => {
            await new Promise((resolve) => setTimeout(resolve, 10));

            return getCorrelationId();
          }
        ),

        requestContext.run(
          { correlationId: "request-2" },
          async () => {
            await new Promise((resolve) => setTimeout(resolve, 5));

            return getCorrelationId();
          }
        ),
      ]);

      expect(first).toBe("request-1");
      expect(second).toBe("request-2");
    });
  });
});