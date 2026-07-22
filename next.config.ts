import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Brotli/gzip text compression (Vercel's edge also compresses; explicit here
  // so `next start` and other hosts compress too).
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,

  // Serve modern image formats when next/image is used.
  images: { formats: ["image/avif", "image/webp"] },

  experimental: {
    // Tree-shake barrel imports so only the icons / helpers actually used ship,
    // instead of pulling whole libraries into the client bundle.
    optimizePackageImports: [
      "framer-motion",
      "lucide-react",
      "@turf/turf",
      "@supabase/supabase-js",
      "@supabase/ssr",
    ],
  },

  async headers() {
    return [
      {
        // Long-lived immutable caching for the self-hosted fonts + static chunks.
        source: "/_next/static/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
