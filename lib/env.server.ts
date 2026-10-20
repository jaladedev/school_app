import { z } from "zod";

// Runtime configuration. These names are read from the container's environment
// when the server starts, never inlined at build time, so one image can serve
// any school. The NEXT_PUBLIC_* names are still accepted as a fallback so local
// development with an existing .env.local keeps working; the production image is
// built without them, so a container missing SUPABASE_URL fails loudly instead
// of running against a build-time value.
const serverEnvSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  PAYSTACK_SECRET_KEY: z
    .string()
    .min(1)
    .refine((k) => k.startsWith("sk_"), {
      message: "PAYSTACK_SECRET_KEY should start with 'sk_'.",
    }),
});

const parsed = serverEnvSchema.safeParse({
  SUPABASE_URL: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY,
});

if (!parsed.success) {
  throw new Error(
    `Invalid server environment configuration:\n${parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n")}`
  );
}

export const serverEnv = parsed.data;
