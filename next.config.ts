import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default is 1mb, too small for phone photos uploaded to the gallery.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
