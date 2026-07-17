import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default is 1mb, too small for phone photos uploaded to the gallery.
      bodySizeLimit: "10mb",
    },
  },
  async redirects() {
    return [
      // Not permanent (307): this reorg is fresh, so avoid a hard browser
      // cache in case the structure shifts again soon.
      { source: "/trophy-room", destination: "/frat-history/trophy-room", permanent: false },
      { source: "/beef-tracker", destination: "/frat-history/beef-tracker", permanent: false },
      { source: "/kangaroo-court", destination: "/frat-history/kangaroo-court", permanent: false },
      { source: "/photo-gallery", destination: "/frat-history/photo-gallery", permanent: false },
      { source: "/soundboard", destination: "/frat-history/soundboard", permanent: false },
    ];
  },
};

export default nextConfig;
