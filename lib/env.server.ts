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
  // This school's Cloudflare R2 bucket for uploaded files (lib/storage.ts).
  // R2_ENDPOINT is the account endpoint, without the bucket name.
  R2_ENDPOINT: z.string().url(),
  R2_BUCKET: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  // This school's short id (letters, digits, hyphens). A read-only support link
  // is only accepted if it was issued for this exact slug.
  SCHOOL_SLUG: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]*$/, "SCHOOL_SLUG: lowercase letters, digits and hyphens."),
  // Signs read-only support links (lib/impersonation.ts). Unique per school,
  // known only to this school's env file and the control plane.
  IMPERSONATION_SIGNING_SECRET: z
    .string()
    .min(32, "IMPERSONATION_SIGNING_SECRET should be at least 32 characters."),
});

const parsed = serverEnvSchema.safeParse({
  SUPABASE_URL: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY,
  R2_ENDPOINT: process.env.R2_ENDPOINT,
  R2_BUCKET: process.env.R2_BUCKET,
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
  SCHOOL_SLUG: process.env.SCHOOL_SLUG,
  IMPERSONATION_SIGNING_SECRET: process.env.IMPERSONATION_SIGNING_SECRET,
});

if (!parsed.success) {
  throw new Error(
    `Invalid server environment configuration:\n${parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n")}`
  );
}

export const serverEnv = parsed.data;
