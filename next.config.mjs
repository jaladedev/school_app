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
    ],
  },
};

export default nextConfig;
