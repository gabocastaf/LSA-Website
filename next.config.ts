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
      { source: "/photo-gallery", destination: "/moments", permanent: false },
      { source: "/frat-history/photo-gallery", destination: "/moments", permanent: false },
      { source: "/roster", destination: "/frat-history/roster", permanent: false },
      { source: "/admin/rush", destination: "/frat-history/admin", permanent: false },
      { source: "/dues", destination: "/frat-history/dues", permanent: false },
    ];
  },
};

export default nextConfig;
