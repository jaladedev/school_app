/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
  experimental: {
    // Default is 1 MB, which rejects uploads before the action runs (so its
    // own "must be 20 MB or smaller" message never appears). Largest allowed
    // upload is 20 MB; the headroom covers multipart overhead.
    serverActions: { bodySizeLimit: "25mb" },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      // Signed links to files in a school's R2 bucket. The account id is part
      // of the host and differs per school, and one image serves every school,
      // so the host cannot be listed at build time. "**." also covers
      // jurisdiction hosts such as <id>.eu.r2.cloudflarestorage.com.
      {
        protocol: "https",
        hostname: "**.r2.cloudflarestorage.com",
      },
    ],
  },
};

export default nextConfig;
