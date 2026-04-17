import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/growthmap/momentum-case/out',

  // Disable source maps in production to reduce build size
  productionBrowserSourceMaps: false,
};

export default nextConfig;
