import { z } from "zod";

const envSchema = z.object({
  VITE_HELIUS_API_KEY: z.string().min(1, "VITE_HELIUS_API_KEY is required"),
  VITE_WALLETCONNECT_PROJECT_ID: z.string().optional(),
});

const parsed = envSchema.safeParse(import.meta.env);

if (!parsed.success) {
  const message = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\n${message}`);
}

export const env = parsed.data;
