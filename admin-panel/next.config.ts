import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // env: {
  //   ADMIN_PORT: '3001'
  // },
  // publicRuntimeConfig is not strictly necessary if we rely on NEXT_PUBLIC_ prefixes
  // and access them directly via process.env.NEXT_PUBLIC_YOUR_VAR in the code.
  // Let's simplify to see if it resolves the 'process' error in this config file.
  // Next.js automatically handles NEXT_PUBLIC_ variables.
  poweredByHeader: false,
};

export default nextConfig;
