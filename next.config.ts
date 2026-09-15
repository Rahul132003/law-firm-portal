import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root; without this Turbopack walks up and finds an
  // unrelated package-lock.json in the user profile directory.
  turbopack: {
    root: import.meta.dirname,
  },
  experimental: {
    // Enables forbidden() / unauthorized(), used by the data access layer to
    // terminate rendering with a real 403 instead of a redirect.
    authInterrupts: true,
  },
};

export default nextConfig;
