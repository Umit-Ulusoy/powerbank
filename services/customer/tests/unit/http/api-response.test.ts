
import { describe, expect, it } from "vitest";

import { requestContext } from "../../../src/lib/request-context.js";
import {
  errorResponse,
  successResponse,
} from "../../../src/http/api-response.js";

describe("successResponse", () => {
  it("should create a basic success response", () => {
    const response = successResponse({ id: "123" });

    expect(response).toEqual({
      success: true,
      data: { id: "123" },
      meta: {},
    });
  });

  it("should include correlation ID when request context is available", () => {
    const response = requestContext.run(
      { correlationId: "test-correlation-id" },
      () => successResponse({ id: "123" })
    );

    expect(response.meta.correlationId).toBe("test-correlation-id");
  });

  it("should not include correlation ID when request context is unavailable", () => {
    const response = successResponse({ id: "123" });

    expect(response.meta.correlationId).toBeUndefined();
  });

  it("should merge custom meta with generated meta", () => {
    const response = successResponse(
      { id: "123" },
      {
        pagination: {
          page: 1,
          limit: 10,
          total: 50,
        },
      }
    );

    expect(response.meta).toEqual({
      pagination: {
        page: 1,
        limit: 10,
        total: 50,
      },
    });
  });

  it("should not allow custom meta to override correlation ID", () => {
    const response = requestContext.run(
      { correlationId: "generated-correlation-id" },
      () =>
        successResponse(
          { id: "123" },
          {
            correlationId: "custom-correlation-id",
            pagination: {
              page: 1,
              limit: 10,
              total: 50,
            },
          } as never
        )
    );

    expect(response.meta.correlationId).toBe("generated-correlation-id");
    expect(response.meta.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 50,
    });
  });

  it("should ignore custom correlation ID when request context is unavailable", () => {
    const response = successResponse(
      { id: "123" },
      {
        correlationId: "custom-correlation-id",
        pagination: {
          page: 1,
          limit: 10,
          total: 50,
        },
      } as never
    );

    expect(response.meta.correlationId).toBeUndefined();
    expect(response.meta.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 50,
    });
  });

  it("should support empty custom meta", () => {
    const response = successResponse({ id: "123" }, {});

    expect(response.meta).toEqual({});
  });

  it("should support null data", () => {
    const response = successResponse(null);

    expect(response.data).toBeNull();
  });

  it("should support array data", () => {
    const response = successResponse([{ id: "1" }, { id: "2" }]);

    expect(response.data).toEqual([{ id: "1" }, { id: "2" }]);
  });
});

describe("errorResponse", () => {
  it("should create a basic error response", () => {
    const response = errorResponse({
      code: "VALIDATION_ERROR",
      message: "Validation failed",
    });

    expect(response).toEqual({
      success: false,
      data: null,
      error: {
        code: "VALIDATION_ERROR",
        message: "Validation failed",
        details: null,
      },
      meta: {},
    });
  });

  it("should include correlation ID when request context is available", () => {
    const response = requestContext.run(
      { correlationId: "test-correlation-id" },
      () =>
        errorResponse({
          code: "INTERNAL_ERROR",
          message: "Something went wrong",
        })
    );

    expect(response.meta.correlationId).toBe("test-correlation-id");
  });

  it("should not include correlation ID when request context is unavailable", () => {
    const response = errorResponse({
      code: "INTERNAL_ERROR",
      message: "Something went wrong",
    });

    expect(response.meta.correlationId).toBeUndefined();
  });

  it("should support error details", () => {
    const response = errorResponse({
      code: "VALIDATION_ERROR",
      message: "Validation failed",
      details: {
        email: ["Invalid email address"],
      },
    });

    expect(response.error.details).toEqual({
      email: ["Invalid email address"],
    });
  });

  it("should support empty error details", () => {
    const response = errorResponse({
      code: "VALIDATION_ERROR",
      message: "Validation failed",
      details: {},
    });

    expect(response.error.details).toEqual({});
  });

  it("should merge custom meta with generated meta", () => {
    const response = errorResponse({
      code: "VALIDATION_ERROR",
      message: "Validation failed",
      meta: {
        pagination: {
          page: 1,
          limit: 10,
          total: 50,
        },
      },
    });

    expect(response.meta).toEqual({
      pagination: {
        page: 1,
        limit: 10,
        total: 50,
      },
    });
  });

  it("should not allow custom meta to override correlation ID", () => {
    const response = requestContext.run(
      { correlationId: "generated-correlation-id" },
      () =>
        errorResponse({
          code: "INTERNAL_ERROR",
          message: "Something went wrong",
          meta: {
            correlationId: "custom-correlation-id",
            pagination: {
              page: 1,
              limit: 10,
              total: 50,
            },
          } as never,
        })
    );

    expect(response.meta.correlationId).toBe("generated-correlation-id");
    expect(response.meta.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 50,
    });
  });

  it("should ignore custom correlation ID when request context is unavailable", () => {
    const response = errorResponse({
      code: "INTERNAL_ERROR",
      message: "Something went wrong",
      meta: {
        correlationId: "custom-correlation-id",
        pagination: {
          page: 1,
          limit: 10,
          total: 50,
        },
      } as never,
    });

    expect(response.meta.correlationId).toBeUndefined();
    expect(response.meta.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 50,
    });
  });

  it("should default error details to null", () => {
    const response = errorResponse({
      code: "INTERNAL_ERROR",
      message: "Something went wrong",
    });

    expect(response.error.details).toBeNull();
  });

  it("should support empty custom meta", () => {
    const response = errorResponse({
      code: "INTERNAL_ERROR",
      message: "Something went wrong",
      meta: {},
    });

    expect(response.meta).toEqual({});
  });
});

describe("response format consistency", () => {
  it("should maintain consistent success response shape", () => {
    const response = successResponse({ id: "123" });

    expect(response).toStrictEqual({
      success: true,
      data: { id: "123" },
      meta: {},
    });
  });

  it("should maintain consistent success response shape with correlation ID", () => {
    const response = requestContext.run(
      { correlationId: "test-correlation-id" },
      () => successResponse({ id: "123" })
    );

    expect(response).toStrictEqual({
      success: true,
      data: { id: "123" },
      meta: {
        correlationId: "test-correlation-id",
      },
    });
  });

  it("should maintain consistent error response shape", () => {
    const response = errorResponse({
      code: "NOT_FOUND",
      message: "Resource not found",
    });

    expect(response).toStrictEqual({
      success: false,
      data: null,
      error: {
        code: "NOT_FOUND",
        message: "Resource not found",
        details: null,
      },
      meta: {},
    });
  });

  it("should maintain consistent error response shape with correlation ID", () => {
    const response = requestContext.run(
      { correlationId: "test-correlation-id" },
      () =>
        errorResponse({
          code: "NOT_FOUND",
          message: "Resource not found",
        })
    );

    expect(response).toStrictEqual({
      success: false,
      data: null,
      error: {
        code: "NOT_FOUND",
        message: "Resource not found",
        details: null,
      },
      meta: {
        correlationId: "test-correlation-id",
      },
    });
  });

  it("should always return null data for error responses", () => {
    const response = errorResponse({
      code: "INTERNAL_ERROR",
      message: "Something went wrong",
    });

    expect(response.data).toBeNull();
  });

  it("should always default error details to null", () => {
    const response = errorResponse({
      code: "INTERNAL_ERROR",
      message: "Something went wrong",
    });

    expect(response.error.details).toBeNull();
  });
});

describe("response JSON serialization", () => {
  it("should serialize success response correctly", () => {
    const response = requestContext.run(
      { correlationId: "test-correlation-id" },
      () =>
        successResponse(
          { id: "123" },
          {
            pagination: {
              page: 1,
              limit: 10,
              total: 50,
            },
          }
        )
    );

    expect(JSON.parse(JSON.stringify(response))).toEqual({
      success: true,
      data: { id: "123" },
      meta: {
        correlationId: "test-correlation-id",
        pagination: {
          page: 1,
          limit: 10,
          total: 50,
        },
      },
    });
  });

  it("should serialize error response correctly", () => {
    const response = requestContext.run(
      { correlationId: "test-correlation-id" },
      () =>
        errorResponse({
          code: "VALIDATION_ERROR",
          message: "Validation failed",
          details: {
            email: ["Invalid email address"],
          },
          meta: {
            pagination: {
              page: 1,
              limit: 10,
              total: 50,
            },
          },
        })
    );

    expect(JSON.parse(JSON.stringify(response))).toEqual({
      success: false,
      data: null,
      error: {
        code: "VALIDATION_ERROR",
        message: "Validation failed",
        details: {
          email: ["Invalid email address"],
        },
      },
      meta: {
        correlationId: "test-correlation-id",
        pagination: {
          page: 1,
          limit: 10,
          total: 50,
        },
      },
    });
  });

  it("should not include undefined fields in JSON output", () => {
    const response = successResponse({ id: "123" });

    const serialized = JSON.stringify(response);

    expect(serialized).not.toContain("correlationId");
    expect(serialized).not.toContain("undefined");
  });
});
