import { getCorrelationId } from "../lib/request-context.js";

export type ApiMeta = {
  correlationId?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
  };
};

export type ApiErrorDetails = Record<string, string[]> | null;

type CustomApiMeta = Omit<ApiMeta, "correlationId">;

const getDefaultMeta = (): ApiMeta => {
  const correlationId = getCorrelationId();

  return correlationId ? { correlationId } : {};
};

export const successResponse = <T>(
  data: T,
  meta: CustomApiMeta = {},
) => {
  // Runtime'da correlationId'yi filtrele (TypeScript bypass durumu için)
  const { correlationId: _, ...safeMeta } = meta as ApiMeta;
  
  return {
    success: true as const,
    meta: {
      ...safeMeta,
      ...getDefaultMeta(),
    },
    data,
  };
};

type ErrorResponseOptions = {
  code: string;
  message: string;
  details?: ApiErrorDetails;
  meta?: CustomApiMeta;
};

export const errorResponse = ({
  code,
  message,
  details = null,
  meta = {},
}: ErrorResponseOptions) => {
  // Runtime'da correlationId'yi filtrele (TypeScript bypass durumu için)
  const { correlationId: _, ...safeMeta } = meta as ApiMeta;
  
  return {
    success: false as const,
    meta: {
      ...safeMeta,
      ...getDefaultMeta(),
    },
    data: null,
    error: {
      code,
      message,
      details,
    },
  };
};