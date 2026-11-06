
export type AppErrorDetail = {
  field?: string;
  message: string;
};

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly errors: readonly AppErrorDetail[];

  constructor(
    message: string,
    statusCode = 500,
    code = "INTERNAL_SERVER_ERROR",
    errors: AppErrorDetail[] = [],
    isOperational = true
  ) {
    super(message);

    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.errors = errors.map((error) => ({ ...error }));

    Error.captureStackTrace?.(this, AppError);
  }

  public getErrors(): Record<string, string[]> {
    const result: Record<string, string[]> = {};

    for (const error of this.errors) {
      const key = error.field ?? "general";

      if (!Object.hasOwn(result, key)) {
        result[key] = [];
      }

      result[key].push(error.message);
    }

    return result;
  }
}
