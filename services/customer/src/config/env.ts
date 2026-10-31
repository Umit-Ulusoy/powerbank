import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  PORT: z.coerce
    .number()
    .int()
    .min(1)
    .max(65535)
    .default(3001),

  DATABASE_URL: z.string().url(),

  RABBITMQ_URL: z
    .string()
    .url()
    .refine(
      (url) => url.startsWith("amqp://") || url.startsWith("amqps://"),
      {
        message: "RABBITMQ_URL must start with amqp:// or amqps://",
      }
    ),

  RABBITMQ_EXCHANGE: z.string().min(1),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("Invalid environment configuration:", parsedEnv.error.issues);
  throw new Error("Environment configuration is invalid.");
}

export const env = parsedEnv.data;