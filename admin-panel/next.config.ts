import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    // This is a moderately strict CSP. Start with this and test.
    // 'unsafe-eval' might be needed for some dev features or specific libraries.
    // 'unsafe-inline' for script-src is generally discouraged but might be needed for Next.js internal scripts or styles from some UI libs if not using nonces.
    // For styles, 'unsafe-inline' is often needed for dynamically injected styles by UI components.
    value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; object-src 'none'; frame-ancestors 'none';"
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN', // Or 'DENY' if you don't need to iframe any part of the admin panel
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block', // Modern browsers might ignore this in favor of CSP, but good for older ones.
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  },
  // Example Permissions-Policy (formerly Feature-Policy). Customize as needed.
  // This example disables common potentially risky features if not used.
  // {
  //   key: 'Permissions-Policy',
  //   value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), display-capture=()"
  // }
];


const nextConfig: NextConfig = {
  /* config options here */
  poweredByHeader: false, // Good for security - already set

  async headers() {
    return [
      {
        // Apply these headers to all routes in your application.
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
