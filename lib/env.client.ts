import { z } from "zod";

// Public values the browser needs: this school's Supabase URL and anon key, and
// its Paystack public key. Next.js inlines NEXT_PUBLIC_* values into the build,
// which would tie an image to one school. Instead the root layout reads these
// from the server's runtime environment and writes them into the page as
// window.__PUBLIC_CONFIG__; the browser reads them back with getClientEnv().
const clientEnvSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  PAYSTACK_PUBLIC_KEY: z
    .string()
    .trim()
    .min(1)
    .refine((k) => k.startsWith("pk_"), {
      message: "PAYSTACK_PUBLIC_KEY should start with 'pk_'.",
    }),
});

export type PublicConfig = z.infer<typeof clientEnvSchema>;

declare global {
  interface Window {
    __PUBLIC_CONFIG__?: PublicConfig;
  }
}

/**
 * Server only: read and validate the public values from the runtime
 * environment. Throws with the names of any missing or invalid keys.
 */
export function readPublicConfigFromEnv(): PublicConfig {
  const parsed = clientEnvSchema.safeParse({
    SUPABASE_URL: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    PAYSTACK_PUBLIC_KEY:
      process.env.PAYSTACK_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
  });
  if (!parsed.success) {
    throw new Error(
      `Invalid public environment configuration:\n${parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n")}`
    );
  }
  return parsed.data;
}

/**
 * Public config for the current runtime: the values the layout embedded in the
 * page when running in the browser, or the environment when a client component
 * is rendered on the server.
 */
export function getClientEnv(): PublicConfig {
  if (typeof window !== "undefined") {
    const config = window.__PUBLIC_CONFIG__;
    if (!config) {
      throw new Error("Public configuration is missing from the page (window.__PUBLIC_CONFIG__).");
    }
    return config;
  }
  return readPublicConfigFromEnv();
}
