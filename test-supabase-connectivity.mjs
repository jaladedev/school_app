// Run with: node test-supabase-connectivity.mjs
// Replace YOUR_SUPABASE_URL below with your actual NEXT_PUBLIC_SUPABASE_URL
// (the same one from your .env file).
const url = "https://rpmywifckxlwbycazyha.supabase.co/auth/v1/health";

try {
  const start = Date.now();
  const res = await fetch(url);
  console.log(`OK: ${res.status} in ${Date.now() - start}ms`);
} catch (err) {
  console.log("FAILED:", err.message);
  console.log("Cause:", err.cause);
}
