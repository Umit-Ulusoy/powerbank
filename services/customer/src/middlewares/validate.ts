import type { RequestHandler } from "express";
import type { ZodType } from "zod";

type SchemaWithOptionalRequest = {
  body?: ZodType;
  query?: ZodType;
};

export const validate = (schema: SchemaWithOptionalRequest): RequestHandler => {
  return async (req, _res, next) => {
    try {
      const validated: {
        body?: unknown;
        query?: unknown;
      } = {};

      if (schema.body) {
        const result = await schema.body.safeParseAsync(req.body);

        if (!result.success) {
          return next(result.error);
        }

        validated.body = result.data;
      }

      if (schema.query) {
        const result = await schema.query.safeParseAsync(req.query);

        if (!result.success) {
          return next(result.error);
        }

        validated.query = result.data;
      }

      req.validated = validated;

      next();
    } catch (error) {
      next(error);
    }
  };
};