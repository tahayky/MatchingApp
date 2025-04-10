import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  env: {
    ADMIN_PORT: '3001'
  },
  // Next.js 15 format for port configuration
  poweredByHeader: false,
  // In Next.js, port is handled by CLI arguments or env vars, not in config
};

export default nextConfig;
