
import { describe, expect, it } from "vitest";

import { AppError } from "../../../src/errors/app-error.js";

describe("AppError", () => {
  describe("constructor", () => {
    it("should use default values when optional arguments are omitted", () => {
      const error = new AppError("Something went wrong.");

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe("Something went wrong.");
      expect(error.name).toBe("AppError");
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe("INTERNAL_SERVER_ERROR");
      expect(error.isOperational).toBe(true);
      expect(error.errors).toEqual([]);
    });

    it("should assign custom values provided to the constructor", () => {
      const details = [
        { field: "email", message: "Invalid email address." },
      ];

      const error = new AppError(
        "Unexpected error.",
        500,
        "INTERNAL_SERVER_ERROR",
        details,
        false
      );

      expect(error.statusCode).toBe(500);
      expect(error.code).toBe("INTERNAL_SERVER_ERROR");
      expect(error.isOperational).toBe(false);
      expect(error.errors).toEqual(details);
    });

    it("should not be affected by later mutations of the input array", () => {
      const details = [
        { field: "email", message: "Invalid email address." },
      ];

      const error = new AppError(
        "Validation failed.",
        400,
        "VALIDATION_FAILED",
        details
      );

      details.push({
        field: "password",
        message: "Password is required.",
      });

      expect(error.errors).toHaveLength(1);
      expect(error.errors).toEqual([
        { field: "email", message: "Invalid email address." },
      ]);
    });
  });

  describe("getErrors", () => {
    it("should group errors by field", () => {
      const error = new AppError(
        "Validation failed.",
        400,
        "VALIDATION_FAILED",
        [
          { field: "email", message: "Invalid email address." },
          { field: "email", message: "Email is required." },
          { field: "password", message: "Password is too short." },
        ]
      );

      expect(error.getErrors()).toEqual({
        email: [
          "Invalid email address.",
          "Email is required.",
        ],
        password: ["Password is too short."],
      });
    });

    it("should group errors without a field under general", () => {
      const error = new AppError(
        "Validation failed.",
        400,
        "VALIDATION_FAILED",
        [
          { message: "Something went wrong." },
          { field: "email", message: "Invalid email address." },
          { message: "Another general error." },
        ]
      );

      expect(error.getErrors()).toEqual({
        general: [
          "Something went wrong.",
          "Another general error.",
        ],
        email: ["Invalid email address."],
      });
    });

    it("should return an empty object when there are no errors", () => {
      const error = new AppError("Customer not found.", 404);

      expect(error.getErrors()).toEqual({});
    });

    it("should handle __proto__ as a field name safely", () => {
      const error = new AppError("Validation failed.", 400, "VALIDATION_FAILED", [
        { field: "__proto__", message: "Invalid field." },
      ]);

      expect(() => error.getErrors()).not.toThrow();
      expect(error.getErrors()["__proto__"]).toEqual(["Invalid field."]);
    });
  });
});
